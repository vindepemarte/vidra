import asyncio
import datetime as dt
import uuid
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from vidra_api.config import settings
from vidra_api.database import SessionLocal, get_db
from vidra_api.deps import get_current_user
from vidra_api.models import CalendarMonth, MediaGeneration, Persona, PersonaProfile, User
from vidra_api.persona_intel import PersonaProfileBundle, build_llm_profile, build_offline_profile
from vidra_api.plans import normalize_tier, personas_limit_for_tier, upgrade_target_for_tier
from vidra_api.schemas import (
    CalendarMonthSummaryOut,
    MediaJobSummaryOut,
    PersonaCreate,
    PersonaDetailOut,
    PersonaOut,
    PersonaProfileOut,
    PersonaProfileGenerateRequest,
    PersonaProfileStatusOut,
)
from vidra_api.services.model_preferences import resolve_openrouter_model

router = APIRouter(prefix="/personas", tags=["personas"])


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _as_utc(value: dt.datetime | None) -> dt.datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=dt.timezone.utc)
    return value.astimezone(dt.timezone.utc)


def _auto_mode_for_tier(tier: str) -> str:
    if tier in {"pro", "max"} and settings.openrouter_api_key:
        return "llm"
    return "offline"


def _resolve_effective_mode(*, tier: str, requested_mode: str) -> str:
    if requested_mode == "auto":
        return _auto_mode_for_tier(tier)
    return requested_mode


def _serialize_calendar_summary(month: CalendarMonth) -> CalendarMonthSummaryOut:
    return CalendarMonthSummaryOut(
        id=month.id,
        month=month.month,
        year=month.year,
        mode=month.mode,
        days_count=len(month.days),
    )


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
    profile.updated_at = _utc_now()


def _compute_profile_status(profile: PersonaProfile | None) -> PersonaProfileStatusOut:
    if profile is None:
        return PersonaProfileStatusOut(
            generation_status="empty",
            generation_step="Waiting to start",
            progress_percent=0,
            elapsed_seconds=0,
            estimated_total_seconds=None,
            eta_seconds=None,
            can_retry=True,
            is_terminal=False,
            next_poll_seconds=2,
        )

    has_profile_content = bool((profile.prompt_blueprint or "").strip() or (profile.bio or "").strip())
    status_value = (profile.generation_status or "").strip().lower()
    if status_value not in {"empty", "queued", "generating", "ready", "failed"}:
        status_value = "ready" if has_profile_content else "empty"

    effective_mode = profile.generation_effective_mode
    if not effective_mode and status_value == "ready":
        effective_mode = "llm" if profile.generated_mode == "llm" else "offline"

    requested_mode = (profile.generation_requested_mode or "").strip().lower() or None
    mode_hint = (effective_mode or requested_mode or "offline").lower()

    if mode_hint == "llm":
        # LLM persona build performs many sequential calls; keep expectation generous (1.5h default).
        estimated_total_seconds = max(5400, settings.profile_generation_timeout_seconds)
    elif mode_hint == "offline":
        estimated_total_seconds = 20
    else:
        estimated_total_seconds = max(45, settings.profile_generation_timeout_seconds)

    elapsed_seconds = 0
    started_at = _as_utc(profile.generation_started_at)
    completed_at = _as_utc(profile.generation_completed_at)
    if started_at:
        if status_value in {"ready", "failed"} and completed_at:
            elapsed_seconds = max(0, int((completed_at - started_at).total_seconds()))
        elif status_value in {"ready", "failed"}:
            # Backward compatibility for legacy rows where completed_at may be missing.
            terminal_at = _as_utc(profile.updated_at) or _utc_now()
            elapsed_seconds = max(0, int((terminal_at - started_at).total_seconds()))
        else:
            elapsed_seconds = max(0, int((_utc_now() - started_at).total_seconds()))

    if status_value == "empty":
        progress_percent = 0
        generation_step = "Waiting to start"
    elif status_value == "queued":
        progress_percent = 5
        generation_step = "Queued in worker pipeline"
    elif status_value == "generating":
        progress_percent = 12 + int(min(1.0, elapsed_seconds / max(estimated_total_seconds, 1)) * 78)
        progress_percent = max(12, min(progress_percent, 90))
        if elapsed_seconds < 4:
            generation_step = "Preparing persona context"
        elif mode_hint == "llm":
            model_label = profile.generation_model_used or settings.openrouter_model
            generation_step = f"Generating with OpenRouter ({model_label})"
        else:
            generation_step = "Building offline persona intelligence"
    elif status_value == "ready":
        progress_percent = 100
        generation_step = "Profile generation completed"
    else:
        progress_percent = 100
        generation_step = "Profile generation failed"

    eta_seconds = None
    if status_value in {"queued", "generating"}:
        eta_seconds = max(0, estimated_total_seconds - elapsed_seconds)

    is_terminal = status_value in {"ready", "failed"}
    can_retry = status_value in {"empty", "ready", "failed"}

    return PersonaProfileStatusOut(
        generation_status=status_value,
        generation_requested_mode=profile.generation_requested_mode,
        generation_effective_mode=effective_mode,
        generation_model_used=profile.generation_model_used,
        generation_step=generation_step,
        progress_percent=progress_percent,
        elapsed_seconds=elapsed_seconds,
        estimated_total_seconds=estimated_total_seconds,
        eta_seconds=eta_seconds,
        can_retry=can_retry,
        is_terminal=is_terminal,
        next_poll_seconds=0 if is_terminal else 2,
        generation_error=profile.generation_error,
        generation_started_at=profile.generation_started_at,
        generation_completed_at=profile.generation_completed_at,
        generation_run_id=profile.generation_run_id,
    )


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


def _mark_profile_queued(profile: PersonaProfile, *, requested_mode: str, run_id: str) -> None:
    profile.generation_status = "queued"
    profile.generation_requested_mode = requested_mode
    profile.generation_error = None
    profile.generation_started_at = None
    profile.generation_completed_at = None
    profile.generation_run_id = run_id
    profile.updated_at = _utc_now()


def _profile_job_is_stale(profile: PersonaProfile) -> bool:
    now = _utc_now()
    status_value = (profile.generation_status or "").strip().lower()

    if status_value == "generating":
        started_at = _as_utc(profile.generation_started_at or profile.updated_at)
        if not started_at:
            return False
        # Keep generous to avoid false negatives on long LLM profile builds (4h guard).
        return (now - started_at).total_seconds() > 14400

    if status_value == "queued":
        queued_since = _as_utc(profile.updated_at or profile.created_at)
        if not queued_since:
            return False
        return (now - queued_since).total_seconds() > 180

    return False


async def _recover_stale_profile_job(db: AsyncSession, profile: PersonaProfile) -> bool:
    if not _profile_job_is_stale(profile):
        return False

    profile.generation_status = "failed"
    profile.generation_error = "Profile generation stalled (deploy/restart/timeout). Retry now."
    profile.generation_completed_at = _utc_now()
    profile.updated_at = _utc_now()
    await db.commit()
    await db.refresh(profile)
    return True


async def _run_profile_generation_job(*, user_id: UUID, persona_id: UUID, requested_mode: str, run_id: str) -> None:
    async with SessionLocal() as db:  # type: AsyncSession
        user_q = await db.execute(select(User).where(User.id == user_id))
        user = user_q.scalar_one_or_none()
        if user is None:
            return

        persona_q = await db.execute(
            select(Persona).options(selectinload(Persona.profile)).where(Persona.id == persona_id, Persona.user_id == user.id)
        )
        persona = persona_q.scalar_one_or_none()
        if persona is None:
            return

        profile = persona.profile
        if profile is None:
            profile = PersonaProfile(persona_id=persona.id)
            db.add(profile)
            await db.flush()

        # Ignore stale queued jobs.
        if profile.generation_run_id != run_id:
            return

        tier = normalize_tier(user.tier)
        effective_mode = _resolve_effective_mode(tier=tier, requested_mode=requested_mode)

        profile.generation_status = "generating"
        profile.generation_requested_mode = requested_mode
        profile.generation_effective_mode = effective_mode
        profile.generation_model_used = None
        profile.generation_error = None
        profile.generation_started_at = _utc_now()
        profile.generation_completed_at = None
        profile.updated_at = _utc_now()
        await db.commit()

        selected_openrouter_model = None
        if effective_mode == "llm":
            if tier not in {"pro", "max"}:
                profile.generation_status = "failed"
                profile.generation_error = "LLM profile generation is available only for PRO/MAX tiers."
                profile.generation_completed_at = _utc_now()
                profile.updated_at = _utc_now()
                await db.commit()
                return
            if not settings.openrouter_api_key:
                profile.generation_status = "failed"
                profile.generation_error = "OPENROUTER_API_KEY is not configured."
                profile.generation_completed_at = _utc_now()
                profile.updated_at = _utc_now()
                await db.commit()
                return
            selected_openrouter_model = await resolve_openrouter_model(db, user.id)
            profile.generation_model_used = selected_openrouter_model
            await db.commit()

        llm_error: Exception | None = None
        bundle: PersonaProfileBundle
        model_used: str
        final_effective_mode = effective_mode

        if effective_mode == "llm":
            max_attempts = 3
            for attempt in range(1, max_attempts + 1):
                try:
                    bundle = await asyncio.to_thread(build_llm_profile, persona, selected_openrouter_model)
                    model_used = selected_openrouter_model or settings.openrouter_model
                    llm_error = None
                    break
                except Exception as exc:  # noqa: BLE001
                    llm_error = exc
                    if attempt < max_attempts:
                        profile.generation_error = f"OpenRouter attempt {attempt}/{max_attempts} failed: {exc}. Retrying..."
                        profile.updated_at = _utc_now()
                        await db.commit()
                        await asyncio.sleep(2.0 * attempt)
                        continue
                    profile.generation_status = "failed"
                    profile.generation_error = f"OpenRouter profile generation failed after {max_attempts} attempts: {exc}"
                    profile.generation_completed_at = _utc_now()
                    profile.updated_at = _utc_now()
                    await db.commit()
                    return
        else:
            try:
                bundle = build_offline_profile(persona)
                model_used = "offline"
            except Exception as exc:  # noqa: BLE001
                profile.generation_status = "failed"
                profile.generation_error = f"Offline profile generation failed: {exc}"
                profile.generation_completed_at = _utc_now()
                profile.updated_at = _utc_now()
                await db.commit()
                return

        await db.refresh(profile)
        if profile.generation_run_id != run_id:
            return

        _apply_bundle(profile, bundle)
        profile.generation_status = "ready"
        profile.generation_requested_mode = requested_mode
        profile.generation_effective_mode = final_effective_mode
        profile.generation_model_used = model_used
        profile.generation_error = None
        if llm_error is not None and effective_mode == "llm":
            profile.generation_model_used = f"{model_used} (retried, last error: {llm_error})"
        if profile.generation_started_at is None:
            profile.generation_started_at = _utc_now()
        profile.generation_completed_at = _utc_now()
        profile.updated_at = _utc_now()
        await db.commit()


@router.get("", response_model=list[PersonaOut])
async def list_personas(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> list[PersonaOut]:
    result = await db.execute(select(Persona).where(Persona.user_id == user.id).order_by(Persona.created_at.desc()))
    return list(result.scalars().all())


@router.post("", response_model=PersonaOut)
async def create_persona(
    payload: PersonaCreate,
    background_tasks: BackgroundTasks,
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

    profile = PersonaProfile(persona_id=persona.id)
    db.add(profile)
    await db.flush()

    run_id = uuid.uuid4().hex
    _mark_profile_queued(profile, requested_mode="auto", run_id=run_id)

    await db.commit()
    await db.refresh(persona)

    background_tasks.add_task(
        _run_profile_generation_job,
        user_id=user.id,
        persona_id=persona.id,
        requested_mode="auto",
        run_id=run_id,
    )

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

    if persona.profile is not None:
        await _recover_stale_profile_job(db, persona.profile)
        await db.refresh(persona, attribute_names=["profile"])

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
        profile_status=_compute_profile_status(persona.profile),
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


@router.get("/{persona_id}/profile/status", response_model=PersonaProfileStatusOut)
async def get_persona_profile_status(
    persona_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PersonaProfileStatusOut:
    result = await db.execute(
        select(Persona).options(selectinload(Persona.profile)).where(Persona.id == persona_id, Persona.user_id == user.id)
    )
    persona = result.scalar_one_or_none()
    if persona is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found")

    if persona.profile is not None:
        await _recover_stale_profile_job(db, persona.profile)

    return _compute_profile_status(persona.profile)


@router.post("/{persona_id}/profile/generate", response_model=PersonaProfileStatusOut)
async def generate_persona_profile(
    persona_id: UUID,
    payload: PersonaProfileGenerateRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PersonaProfileStatusOut:
    result = await db.execute(
        select(Persona).options(selectinload(Persona.profile)).where(Persona.id == persona_id, Persona.user_id == user.id)
    )
    persona = result.scalar_one_or_none()
    if persona is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found")

    profile = persona.profile
    if profile is None:
        profile = PersonaProfile(persona_id=persona.id)
        db.add(profile)
        await db.flush()

    run_id = uuid.uuid4().hex
    _mark_profile_queued(profile, requested_mode=payload.mode, run_id=run_id)
    await db.commit()

    background_tasks.add_task(
        _run_profile_generation_job,
        user_id=user.id,
        persona_id=persona.id,
        requested_mode=payload.mode,
        run_id=run_id,
    )

    return _compute_profile_status(profile)


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

    for field, value in payload.model_dump().items():
        setattr(persona, field, value)

    persona.updated_at = _utc_now()
    await db.commit()
    await db.refresh(persona)
    return persona
