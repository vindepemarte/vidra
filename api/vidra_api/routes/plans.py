from fastapi import APIRouter, Depends

from vidra_api.config import settings
from vidra_api.deps import get_current_user
from vidra_api.models import User
from vidra_api.plans import (
    generation_days_for_tier,
    generation_mode_for_tier,
    normalize_tier,
    personas_limit_for_tier,
    serialize_plan_catalog,
    upgrade_target_for_tier,
)
from vidra_api.schemas import MyPlanOut, PlanCatalogOut

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("", response_model=PlanCatalogOut)
async def get_plans() -> PlanCatalogOut:
    return PlanCatalogOut(plans=serialize_plan_catalog())


@router.get("/me", response_model=MyPlanOut)
async def get_my_plan(
    user: User = Depends(get_current_user),
) -> MyPlanOut:
    tier = normalize_tier(user.tier)

    openrouter_model = settings.openrouter_model if tier in {"pro", "max"} and settings.openrouter_api_key else None

    return MyPlanOut(
        current_tier=tier,
        next_tier=upgrade_target_for_tier(tier),
        personas_limit=personas_limit_for_tier(tier),
        generation_days_limit=generation_days_for_tier(tier),
        generation_mode=generation_mode_for_tier(tier),
        openrouter_model=openrouter_model,
    )
