from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from vidra_api.config import settings
from vidra_api.database import get_db
from vidra_api.deps import get_current_user
from vidra_api.models import CalendarMonth, OnboardingState, Persona, User
from vidra_api.plans import (
    effective_generation_mode_for_tier,
    generation_days_for_tier,
    normalize_tier,
    personas_limit_for_tier,
)
from vidra_api.schemas import DashboardOverviewOut
from vidra_api.services.wallet import ensure_wallet

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


def _weekly_quests_for_tier(tier: str) -> list[str]:
    base = [
        "Publish one hero post with your strongest visual identity.",
        "Post one story sequence with a clear CTA to comments or DMs.",
        "Review one week of content and refresh prompts for next sprint.",
    ]
    if tier == "pro":
        return [
            "Generate one 30-day calendar and save your top 5 conversion hooks.",
            "Run one carousel sequence using slide-to-slide edit prompts.",
            "Test two caption variants and keep the one with higher engagement intent.",
        ]
    if tier == "max":
        return [
            "Ship one campaign bundle across at least two personas.",
            "Generate three image assets from existing post prompts and track results.",
            "Create one monetization-focused weekly report for brand-ready positioning.",
        ]
    return base


def _persona_health_score(*, tier: str, personas_count: int, generated_months_count: int) -> int:
    tier_bonus = {"free": 0, "pro": 10, "max": 20}.get(tier, 0)
    raw = (personas_count * 25) + (generated_months_count * 12) + tier_bonus
    return max(0, min(100, raw))


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

    onboarding_q = await db.execute(select(OnboardingState).where(OnboardingState.user_id == user.id))
    onboarding = onboarding_q.scalar_one_or_none()
    onboarding_completed = bool(onboarding.completed) if onboarding else False
    if not onboarding_completed and (personas_count > 0 or generated_months_count > 0):
        onboarding_completed = True

    wallet = await ensure_wallet(db, user.id, tier=tier)
    await db.commit()

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
        onboarding_completed=onboarding_completed,
        credits_balance=wallet.balance_credits,
        included_credits=wallet.included_monthly_credits,
        persona_health_score=_persona_health_score(
            tier=tier,
            personas_count=personas_count,
            generated_months_count=generated_months_count,
        ),
        weekly_quests=_weekly_quests_for_tier(tier),
    )
