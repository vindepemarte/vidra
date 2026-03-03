from fastapi import APIRouter, Depends

from vidra_api.config import settings
from vidra_api.database import get_db
from vidra_api.deps import get_current_user
from vidra_api.models import User
from vidra_api.plans import (
    effective_generation_mode_for_tier,
    generation_days_for_tier,
    included_credits_for_tier,
    normalize_tier,
    personas_limit_for_tier,
    serialize_plan_catalog,
    upgrade_target_for_tier,
)
from vidra_api.schemas import MyPlanOut, PlanCatalogOut
from vidra_api.services.model_preferences import resolve_openrouter_model
from vidra_api.services.wallet import ensure_wallet
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("", response_model=PlanCatalogOut)
async def get_plans() -> PlanCatalogOut:
    return PlanCatalogOut(plans=serialize_plan_catalog())


@router.get("/me", response_model=MyPlanOut)
async def get_my_plan(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MyPlanOut:
    tier = normalize_tier(user.tier)
    openrouter_enabled = bool(settings.openrouter_api_key)

    openrouter_model = await resolve_openrouter_model(db, user.id) if tier in {"pro", "max"} and openrouter_enabled else None

    wallet = await ensure_wallet(db, user.id, tier=tier)
    await db.commit()

    return MyPlanOut(
        current_tier=tier,
        next_tier=upgrade_target_for_tier(tier),
        personas_limit=personas_limit_for_tier(tier),
        generation_days_limit=generation_days_for_tier(tier),
        generation_days_per_run=generation_days_for_tier(tier),
        generation_mode=effective_generation_mode_for_tier(tier, openrouter_enabled=openrouter_enabled),
        openrouter_enabled=openrouter_enabled,
        openrouter_model=openrouter_model,
        calendar_generations="unlimited_fair_use",
        calendar_regenerations="unlimited_fair_use",
        media_generation_requires_credits=True,
        credits_balance=wallet.balance_credits,
        included_credits=wallet.included_monthly_credits,
        included_credits_monthly=included_credits_for_tier(tier),
    )
