import calendar as pycalendar
import datetime as dt
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from vidra_api.config import settings
from vidra_api.database import get_db
from vidra_api.deps import get_current_user
from vidra_api.models import CalendarDay, CalendarMonth, Persona, PersonaProfile, Post, PostSlide, User
from vidra_api.offline.generator import DayDraft, OfflineCalendarEngine
from vidra_api.paid.generator import PaidCalendarEngine
from vidra_api.persona_intel import (
    PersonaProfileBundle,
    build_carousel_slides,
    build_llm_profile,
    build_offline_profile,
    pick_style_snippet,
)
from vidra_api.plans import generation_days_for_tier, generation_mode_for_tier, normalize_tier
from vidra_api.schemas import CalendarListOut, CalendarMonthSummaryOut, DayOut, GenerateCalendarRequest, MonthOut, PostOut, SlideOut

router = APIRouter(prefix="/calendar", tags=["calendar"])
logger = logging.getLogger("vidra_api.calendar")


def _serialize_month_summary(month: CalendarMonth) -> CalendarMonthSummaryOut:
    return CalendarMonthSummaryOut(
        id=month.id,
        month=month.month,
        year=month.year,
        mode=month.mode,
        days_count=len(month.days),
    )


def _serialize_month(month: CalendarMonth) -> MonthOut:
    days_out: list[DayOut] = []
    for day in sorted(month.days, key=lambda d: d.day):
        posts_out = []
        for post in sorted(day.posts, key=lambda p: p.post_number):
            if post.slides:
                slides = [
                    SlideOut(
                        slide_number=s.slide_number,
                        prompt=s.prompt,
                        edit_instruction=s.edit_instruction,
                    )
                    for s in sorted(post.slides, key=lambda s: s.slide_number)
                ]
            else:
                slides = [SlideOut(slide_number=1, prompt=post.prompt, edit_instruction=None)]

            posts_out.append(
                PostOut(
                    id=post.id,
                    post_number=post.post_number,
                    time=post.time,
                    scene_type=post.scene_type,
                    caption=post.caption,
                    prompt=post.prompt,
                    hashtags=post.hashtags,
                    slides=slides,
                )
            )

        days_out.append(DayOut(day=day.day, date=day.date, theme=day.theme, mood=day.mood, posts=posts_out))

    return MonthOut(
        persona_id=month.persona_id,
        month=month.month,
        year=month.year,
        mode=month.mode,
        days=days_out,
    )


def _expected_mode_for_tier(tier: str, *, openrouter_enabled: bool) -> str:
    policy = generation_mode_for_tier(tier)
    if policy == "llm" and openrouter_enabled:
        return f"llm_{tier}"
    return "offline"


def _expected_profile_mode_for_tier(tier: str, *, openrouter_enabled: bool) -> str:
    policy = generation_mode_for_tier(tier)
    if policy == "llm" and openrouter_enabled:
        return "llm"
    return "offline"


def _apply_profile_bundle(profile: PersonaProfile, bundle: PersonaProfileBundle) -> None:
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
    profile.updated_at = dt.datetime.utcnow()


def _generate_drafts(persona: Persona, tier: str, month: int, year: int) -> tuple[list[DayDraft], str]:
    days_cap = generation_days_for_tier(tier)
    mode_policy = generation_mode_for_tier(tier)

    if mode_policy == "llm" and settings.openrouter_api_key:
        try:
            paid = PaidCalendarEngine.generate_month(
                persona_name=persona.name,
                niche=persona.niche,
                city=persona.city,
                month=month,
                year=year,
                tier=tier,
            )
            return paid.days[:days_cap], f"llm_{tier}"
        except Exception as exc:  # noqa: BLE001
            logger.exception("Paid generation failed: %s", exc)
            raise RuntimeError("Paid generation failed. Check OpenRouter API/model configuration.") from exc

    drafts = OfflineCalendarEngine.generate_month(
        persona_name=persona.name,
        niche=persona.niche,
        city=persona.city,
        month=month,
        year=year,
    )
    return drafts[:days_cap], "offline"


def _enrich_drafts_with_profile(drafts: list[DayDraft], profile: PersonaProfile | None) -> dict[tuple[int, int], list[dict]]:
    """Mutates drafts prompts/captions and returns precomputed slides by (day, post_number)."""
    slides_by_post: dict[tuple[int, int], list[dict]] = {}
    if profile is None:
        for day in drafts:
            for post in day.posts:
                slides_by_post[(day.day, post.post_number)] = [
                    {"slide_number": 1, "prompt": post.prompt, "edit_instruction": None},
                    {
                        "slide_number": 2,
                        "prompt": f"EDIT-IMAGE instruction: use slide 1 as reference, same identity and outfit, new angle and action.",
                        "edit_instruction": "Use slide 1 as reference, same identity and outfit, new angle and action.",
                    },
                    {
                        "slide_number": 3,
                        "prompt": "EDIT-IMAGE instruction: use slide 2 as reference, same identity and outfit, narrative closing frame.",
                        "edit_instruction": "Use slide 2 as reference, same identity and outfit, narrative closing frame.",
                    },
                ]
        return slides_by_post

    blueprint = profile.prompt_blueprint or "consistent creator identity, photorealistic"
    wardrobe = profile.wardrobe if isinstance(profile.wardrobe, dict) else {}
    world = profile.world if isinstance(profile.world, dict) else {}
    events = world.get("events") if isinstance(world.get("events"), list) else []
    carousel_rules = profile.carousel_rules if isinstance(profile.carousel_rules, dict) else {}

    for day_index, day in enumerate(drafts):
        event_hint = ""
        if events:
            event = events[day_index % len(events)]
            if isinstance(event, dict):
                event_hint = event.get("name") or event.get("description") or ""

        for post in day.posts:
            style = pick_style_snippet(wardrobe, scene_type=post.scene_type, day_index=day_index, post_number=post.post_number)
            post.prompt = f"{blueprint}. {post.prompt}. Outfit cue: {style}. {event_hint}".strip()
            post.caption = f"{post.caption}"

            slides = build_carousel_slides(
                base_prompt=post.prompt,
                profile_prompt_blueprint=blueprint,
                carousel_rules=carousel_rules,
                scene_type=post.scene_type,
            )
            slides_by_post[(day.day, post.post_number)] = slides

    return slides_by_post


@router.get("/{persona_id}/months", response_model=CalendarListOut)
async def list_calendar_months(
    persona_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CalendarListOut:
    q = await db.execute(
        select(CalendarMonth)
        .join(Persona, Persona.id == CalendarMonth.persona_id)
        .options(selectinload(CalendarMonth.days))
        .where(CalendarMonth.persona_id == persona_id, Persona.user_id == user.id)
        .order_by(CalendarMonth.year.desc(), CalendarMonth.month.desc())
    )
    months = list(q.scalars().all())
    return CalendarListOut(persona_id=persona_id, months=[_serialize_month_summary(m) for m in months])


@router.post("/{persona_id}/generate", response_model=MonthOut)
async def generate_calendar(
    persona_id: UUID,
    payload: GenerateCalendarRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MonthOut:
    tier = normalize_tier(user.tier)
    openrouter_enabled = bool(settings.openrouter_api_key)
    days_cap = generation_days_for_tier(tier)
    _, days_in_month = pycalendar.monthrange(payload.year, payload.month)
    target_days = min(days_cap, days_in_month)
    expected_mode = _expected_mode_for_tier(tier, openrouter_enabled=openrouter_enabled)

    persona_q = await db.execute(
        select(Persona)
        .options(selectinload(Persona.profile))
        .where(Persona.id == persona_id, Persona.user_id == user.id)
    )
    persona = persona_q.scalar_one_or_none()
    if persona is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found")

    expected_profile_mode = _expected_profile_mode_for_tier(tier, openrouter_enabled=openrouter_enabled)
    profile = persona.profile
    should_generate_profile = profile is None or (expected_profile_mode == "llm" and profile.generated_mode != "llm")

    if should_generate_profile:
        try:
            if expected_profile_mode == "llm":
                bundle = build_llm_profile(persona)
            else:
                bundle = build_offline_profile(persona)
        except Exception:  # noqa: BLE001
            logger.exception("Persona profile generation failed; using offline fallback profile.")
            bundle = build_offline_profile(persona)

        if profile is None:
            profile = PersonaProfile(persona_id=persona.id)
            db.add(profile)
            await db.flush()

        _apply_profile_bundle(profile, bundle)
        await db.flush()

    month_q = await db.execute(
        select(CalendarMonth)
        .options(selectinload(CalendarMonth.days).selectinload(CalendarDay.posts).selectinload(Post.slides))
        .where(
            CalendarMonth.persona_id == persona.id,
            CalendarMonth.month == payload.month,
            CalendarMonth.year == payload.year,
        )
    )
    existing = month_q.scalar_one_or_none()
    if existing:
        should_regenerate = payload.force_regenerate or existing.mode != expected_mode or len(existing.days) != target_days
        if not should_regenerate:
            return _serialize_month(existing)
        await db.delete(existing)
        await db.flush()

    try:
        drafts, mode = _generate_drafts(persona=persona, tier=tier, month=payload.month, year=payload.year)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    slides_map = _enrich_drafts_with_profile(drafts, profile)

    month_obj = CalendarMonth(persona_id=persona.id, month=payload.month, year=payload.year, mode=mode)
    db.add(month_obj)
    await db.flush()

    for draft_day in drafts:
        day_obj = CalendarDay(
            month_id=month_obj.id,
            day=draft_day.day,
            date=draft_day.date,
            theme=draft_day.theme,
            mood=draft_day.mood,
        )
        db.add(day_obj)
        await db.flush()

        for draft_post in draft_day.posts:
            post_obj = Post(
                day_id=day_obj.id,
                post_number=draft_post.post_number,
                time=draft_post.time,
                scene_type=draft_post.scene_type,
                caption=draft_post.caption,
                prompt=draft_post.prompt,
                hashtags=draft_post.hashtags,
            )
            db.add(post_obj)
            await db.flush()

            for slide in slides_map.get((draft_day.day, draft_post.post_number), []):
                db.add(
                    PostSlide(
                        post_id=post_obj.id,
                        slide_number=int(slide["slide_number"]),
                        prompt=str(slide["prompt"]),
                        edit_instruction=str(slide["edit_instruction"]) if slide.get("edit_instruction") else None,
                    )
                )

    await db.commit()

    saved_q = await db.execute(
        select(CalendarMonth)
        .options(selectinload(CalendarMonth.days).selectinload(CalendarDay.posts).selectinload(Post.slides))
        .where(CalendarMonth.id == month_obj.id)
    )
    return _serialize_month(saved_q.scalar_one())


@router.get("/{persona_id}/{year}/{month}", response_model=MonthOut)
async def get_calendar(
    persona_id: UUID,
    year: int,
    month: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MonthOut:
    q = await db.execute(
        select(CalendarMonth)
        .join(Persona, Persona.id == CalendarMonth.persona_id)
        .options(selectinload(CalendarMonth.days).selectinload(CalendarDay.posts).selectinload(Post.slides))
        .where(
            CalendarMonth.persona_id == persona_id,
            CalendarMonth.month == month,
            CalendarMonth.year == year,
            Persona.user_id == user.id,
        )
    )
    month_obj = q.scalar_one_or_none()
    if month_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar not found")
    return _serialize_month(month_obj)
