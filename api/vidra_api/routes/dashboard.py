from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from vidra_api.config import settings
from vidra_api.database import get_db
from vidra_api.deps import get_current_user
from vidra_api.models import CalendarMonth, Persona, User
from vidra_api.plans import (
    effective_generation_mode_for_tier,
    generation_days_for_tier,
    normalize_tier,
    personas_limit_for_tier,
)
from vidra_api.schemas import DashboardOverviewOut

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _value_snapshot_for_tier(tier: str) -> list[str]:
    if tier == "free":
        return [
            "You can launch one creator persona and stay consistent every week.",
            "Your content engine runs fully offline with no external API cost.",
            "You get actionable post prompts and captions ready to publish.",
        ]
    if tier == "pro":
        return [
            "You can run up to three personas with a full monthly cadence.",
            "Your calendars are upgraded with AI hooks and stronger CTAs.",
            "You can scale content quality while keeping operational speed.",
        ]
    return [
        "You can run a multi-persona creator portfolio at agency level.",
        "Your campaign output includes monetization-oriented framing.",
        "You can execute premium content systems with higher strategic depth.",
    ]


@router.get("/overview", response_model=DashboardOverviewOut)
async def get_dashboard_overview(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardOverviewOut:
    tier = normalize_tier(user.tier)
    openrouter_enabled = bool(settings.openrouter_api_key)

    personas_count = int((await db.scalar(select(func.count(Persona.id)).where(Persona.user_id == user.id))) or 0)

    generated_months_count = int(
        (
            await db.scalar(
                select(func.count(CalendarMonth.id))
                .join(Persona, Persona.id == CalendarMonth.persona_id)
                .where(Persona.user_id == user.id)
            )
        )
        or 0
    )

    openrouter_model = settings.openrouter_model if tier in {"pro", "max"} and openrouter_enabled else None

    return DashboardOverviewOut(
        current_tier=tier,
        personas_count=personas_count,
        personas_limit=personas_limit_for_tier(tier),
        generated_months_count=generated_months_count,
        generation_days_limit=generation_days_for_tier(tier),
        generation_mode=effective_generation_mode_for_tier(tier, openrouter_enabled=openrouter_enabled),
        openrouter_enabled=openrouter_enabled,
        openrouter_model=openrouter_model,
        value_snapshot=_value_snapshot_for_tier(tier),
    )
