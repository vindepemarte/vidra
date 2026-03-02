import asyncio
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from vidra_api.config import settings
from vidra_api.database import get_db
from vidra_api.deps import get_current_user
from vidra_api.models import CalendarMonth, MediaGeneration, Persona, PersonaProfile, User
from vidra_api.persona_intel import PersonaProfileBundle, build_llm_profile, build_offline_profile
from vidra_api.plans import normalize_tier, personas_limit_for_tier, upgrade_target_for_tier
from vidra_api.schemas import (
    CalendarMonthSummaryOut,
    PersonaCreate,
    PersonaDetailOut,
    PersonaOut,
    PersonaProfileGenerateRequest,
    PersonaProfileOut,
    MediaJobSummaryOut,
)

router = APIRouter(prefix="/personas", tags=["personas"])


async def _bundle_for_persona(persona: Persona, *, tier: str, mode: str) -> PersonaProfileBundle:
    if mode == "llm":
        if not settings.openrouter_api_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OPENROUTER_API_KEY is not configured.",
            )
        if tier not in {"pro", "max"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="LLM profile generation is available only for PRO/MAX tiers.",
            )
        try:
            # Offload blocking LLM/network work to a thread so API health checks remain responsive.
            return await asyncio.wait_for(
                asyncio.to_thread(build_llm_profile, persona),
                timeout=settings.profile_generation_timeout_seconds,
            )
        except asyncio.TimeoutError as exc:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail=(
                    "LLM profile generation timed out. "
                    "Try again or switch model, or use offline mode for immediate output."
                ),
            ) from exc
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"LLM profile generation failed: {exc}",
            ) from exc

    return build_offline_profile(persona)


def _auto_mode_for_tier(tier: str) -> str:
    if tier in {"pro", "max"} and settings.openrouter_api_key:
        return "llm"
    return "offline"


def _apply_bundle(profile: PersonaProfile, bundle: PersonaProfileBundle) -> None:
    profile.bio = bundle.bio
    profile.backstory_md = bundle.backstory_md
    profile.future_plans_md = bundle.future_plans_md
    profile.strategy_md = bundle.strategy_md
    profile.prompt_blueprint = bundle.prompt_blueprint
    profile.physical = bundle.physical
    profile.wardrobe = bundle.wardrobe
    profile.beauty = bundle.beauty
    profile.world = bundle.world
    profile.carousel_rules = bundle.carousel_rules
    profile.generated_mode = bundle.generated_mode
    profile.updated_at = datetime.utcnow()


def _serialize_profile(profile: PersonaProfile | None) -> PersonaProfileOut | None:
    if profile is None:
        return None
    return PersonaProfileOut(
        bio=profile.bio,
        backstory_md=profile.backstory_md,
        future_plans_md=profile.future_plans_md,
        strategy_md=profile.strategy_md,
        prompt_blueprint=profile.prompt_blueprint,
        physical=profile.physical if isinstance(profile.physical, dict) else {},
        wardrobe=profile.wardrobe if isinstance(profile.wardrobe, dict) else {},
        beauty=profile.beauty if isinstance(profile.beauty, dict) else {},
        world=profile.world if isinstance(profile.world, dict) else {},
        carousel_rules=profile.carousel_rules if isinstance(profile.carousel_rules, dict) else {},
        generated_mode=profile.generated_mode,
    )


def _serialize_calendar_summary(month: CalendarMonth) -> CalendarMonthSummaryOut:
    return CalendarMonthSummaryOut(
        id=month.id,
        month=month.month,
        year=month.year,
        mode=month.mode,
        days_count=len(month.days),
    )


@router.get("", response_model=list[PersonaOut])
async def list_personas(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> list[PersonaOut]:
    result = await db.execute(select(Persona).where(Persona.user_id == user.id).order_by(Persona.created_at.desc()))
    return list(result.scalars().all())


@router.post("", response_model=PersonaOut)
async def create_persona(
    payload: PersonaCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PersonaOut:
    tier = normalize_tier(user.tier)
    personas_limit = personas_limit_for_tier(tier)
    current_count = int((await db.scalar(select(func.count(Persona.id)).where(Persona.user_id == user.id))) or 0)

    if current_count >= personas_limit:
        next_tier = upgrade_target_for_tier(tier)
        detail = (
            f"{tier.upper()} plan allows up to {personas_limit} persona(s). Upgrade to {next_tier.upper()} to add more."
            if next_tier
            else "Persona limit reached."
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)

    persona = Persona(user_id=user.id, **payload.model_dump())
    db.add(persona)
    await db.flush()

    mode = _auto_mode_for_tier(tier)
    try:
        bundle = await _bundle_for_persona(persona, tier=tier, mode=mode)
    except HTTPException:
        # Persona creation should stay available even if paid profile generation fails.
        bundle = build_offline_profile(persona)
    profile = PersonaProfile(persona_id=persona.id)
    _apply_bundle(profile, bundle)
    db.add(profile)

    await db.commit()
    await db.refresh(persona)
    return persona


@router.get("/{persona_id}", response_model=PersonaDetailOut)
async def get_persona_detail(
    persona_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PersonaDetailOut:
    result = await db.execute(
        select(Persona)
        .options(
            selectinload(Persona.profile),
            selectinload(Persona.months).selectinload(CalendarMonth.days),
        )
        .where(Persona.id == persona_id, Persona.user_id == user.id)
    )
    persona = result.scalar_one_or_none()
    if persona is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found")

    media_count = int(
        (
            await db.scalar(
                select(func.count(MediaGeneration.id)).where(
                    MediaGeneration.user_id == user.id,
                    MediaGeneration.persona_id == persona.id,
                )
            )
        )
        or 0
    )

    jobs_q = await db.execute(
        select(MediaGeneration)
        .where(MediaGeneration.user_id == user.id, MediaGeneration.persona_id == persona.id)
        .order_by(MediaGeneration.created_at.desc())
        .limit(10)
    )
    recent_jobs = list(jobs_q.scalars().all())
    sorted_months = sorted(persona.months, key=lambda m: (m.year, m.month), reverse=True)
    return PersonaDetailOut(
        persona=persona,
        profile=_serialize_profile(persona.profile),
        calendars=[_serialize_calendar_summary(month) for month in sorted_months],
        media_generated_count=media_count,
        recent_media_jobs=[
            MediaJobSummaryOut(
                id=job.id,
                status=job.status,
                mode=job.mode,
                output_url=job.output_url,
                created_at=job.created_at,
            )
            for job in recent_jobs
        ],
    )


@router.post("/{persona_id}/profile/generate", response_model=PersonaProfileOut)
async def generate_persona_profile(
    persona_id: UUID,
    payload: PersonaProfileGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PersonaProfileOut:
    tier = normalize_tier(user.tier)
    requested_mode = payload.mode
    mode = _auto_mode_for_tier(tier) if requested_mode == "auto" else requested_mode

    result = await db.execute(
        select(Persona).options(selectinload(Persona.profile)).where(Persona.id == persona_id, Persona.user_id == user.id)
    )
    persona = result.scalar_one_or_none()
    if persona is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found")

    try:
        bundle = await _bundle_for_persona(persona, tier=tier, mode=mode)
    except HTTPException as exc:
        # In auto mode keep UX reliable: fall back to offline profile instead of hanging/failing.
        if requested_mode == "auto":
            bundle = build_offline_profile(persona)
        else:
            raise exc

    profile = persona.profile
    if profile is None:
        profile = PersonaProfile(persona_id=persona.id)
        db.add(profile)

    _apply_bundle(profile, bundle)

    await db.commit()
    await db.refresh(profile)
    serialized = _serialize_profile(profile)
    if serialized is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Profile serialization failed")
    return serialized


@router.delete("/{persona_id}", status_code=204)
async def delete_persona(
    persona_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(Persona).where(Persona.id == persona_id, Persona.user_id == user.id))
    persona = result.scalar_one_or_none()
    if persona is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found")
    await db.delete(persona)
    await db.commit()


@router.put("/{persona_id}", response_model=PersonaOut)
async def update_persona(
    persona_id: UUID,
    payload: PersonaCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PersonaOut:
    result = await db.execute(select(Persona).where(Persona.id == persona_id, Persona.user_id == user.id))
    persona = result.scalar_one_or_none()
    if persona is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found")

    for key, value in payload.model_dump().items():
        setattr(persona, key, value)
    persona.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(persona)
    return persona
