import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from vidra_api.config import settings
from vidra_api.database import get_db
from vidra_api.deps import get_current_user
from vidra_api.models import CalendarDay, CalendarMonth, Persona, Post, User
from vidra_api.offline.generator import OfflineCalendarEngine
from vidra_api.paid.generator import PaidCalendarEngine
from vidra_api.plans import generation_days_for_tier, generation_mode_for_tier, normalize_tier
from vidra_api.schemas import DayOut, GenerateCalendarRequest, MonthOut, PostOut

router = APIRouter(prefix="/calendar", tags=["calendar"])
logger = logging.getLogger("vidra_api.calendar")


def _serialize_month(month: CalendarMonth) -> MonthOut:
    days_out: list[DayOut] = []
    for day in sorted(month.days, key=lambda d: d.day):
        posts_out = [
            PostOut(
                post_number=p.post_number,
                time=p.time,
                scene_type=p.scene_type,
                caption=p.caption,
                prompt=p.prompt,
                hashtags=p.hashtags,
            )
            for p in sorted(day.posts, key=lambda p: p.post_number)
        ]
        days_out.append(DayOut(day=day.day, date=day.date, theme=day.theme, mood=day.mood, posts=posts_out))

    return MonthOut(
        persona_id=month.persona_id,
        month=month.month,
        year=month.year,
        mode=month.mode,
        days=days_out,
    )


def _generate_drafts(persona: Persona, tier: str, month: int, year: int):
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
            drafts = paid.days[:days_cap]
            return drafts, f"llm_{tier}"
        except Exception as exc:  # noqa: BLE001
            logger.exception("Paid generation failed, fallback to offline: %s", exc)

    drafts = OfflineCalendarEngine.generate_month(
        persona_name=persona.name,
        niche=persona.niche,
        city=persona.city,
        month=month,
        year=year,
    )
    return drafts[:days_cap], "offline"


@router.post("/{persona_id}/generate", response_model=MonthOut)
async def generate_calendar(
    persona_id: UUID,
    payload: GenerateCalendarRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MonthOut:
    tier = normalize_tier(user.tier)

    persona_q = await db.execute(select(Persona).where(Persona.id == persona_id, Persona.user_id == user.id))
    persona = persona_q.scalar_one_or_none()
    if persona is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found")

    month_q = await db.execute(
        select(CalendarMonth)
        .options(selectinload(CalendarMonth.days).selectinload(CalendarDay.posts))
        .where(
            CalendarMonth.persona_id == persona.id,
            CalendarMonth.month == payload.month,
            CalendarMonth.year == payload.year,
        )
    )
    existing = month_q.scalar_one_or_none()
    if existing:
        return _serialize_month(existing)

    drafts, mode = _generate_drafts(persona=persona, tier=tier, month=payload.month, year=payload.year)

    month = CalendarMonth(persona_id=persona.id, month=payload.month, year=payload.year, mode=mode)
    db.add(month)
    await db.flush()

    for draft_day in drafts:
        day = CalendarDay(
            month_id=month.id,
            day=draft_day.day,
            date=draft_day.date,
            theme=draft_day.theme,
            mood=draft_day.mood,
        )
        db.add(day)
        await db.flush()

        for draft_post in draft_day.posts:
            db.add(
                Post(
                    day_id=day.id,
                    post_number=draft_post.post_number,
                    time=draft_post.time,
                    scene_type=draft_post.scene_type,
                    caption=draft_post.caption,
                    prompt=draft_post.prompt,
                    hashtags=draft_post.hashtags,
                )
            )

    await db.commit()

    saved_q = await db.execute(
        select(CalendarMonth)
        .options(selectinload(CalendarMonth.days).selectinload(CalendarDay.posts))
        .where(CalendarMonth.id == month.id)
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
        .options(selectinload(CalendarMonth.days).selectinload(CalendarDay.posts))
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
