"""Streak API routes for gamification features."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from vidra_api.database import get_db
from vidra_api.deps import get_current_user
from vidra_api.models import User
from vidra_api.services.streak import (
    record_streak_activity,
    get_streak_status,
    freeze_streak,
    get_milestone_info,
)

router = APIRouter(prefix="/streak", tags=["streak"])


class StreakStatusOut(BaseModel):
    current_streak: int
    longest_streak: int
    total_active_days: int
    last_activity_date: str | None
    streak_frozen: bool
    freeze_count: int
    streak_health: str
    days_since_activity: int
    next_milestone: int | None
    recent_milestones: list[dict]
    milestone_reward_available: bool


class FreezeOut(BaseModel):
    success: bool
    message: str


class MilestoneInfoOut(BaseModel):
    credits: int
    title: str


@router.get("/status", response_model=StreakStatusOut)
async def get_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreakStatusOut:
    """Get the current streak status for the authenticated user."""
    status = await get_streak_status(db, user.id)
    return StreakStatusOut(**status)


@router.post("/record")
async def record_activity(
    activity_type: str = "login",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a streak activity (called automatically on login/content generation)."""
    streak, new_milestones, is_new_day = await record_streak_activity(
        db, user.id, activity_type=activity_type
    )
    
    milestone_rewards = []
    for m in new_milestones:
        info = get_milestone_info(m.milestone_value)
        milestone_rewards.append({
            "type": m.milestone_type,
            "value": m.milestone_value,
            **info,
        })
    
    return {
        "current_streak": streak.current_streak,
        "is_new_day": is_new_day,
        "new_milestones": milestone_rewards,
        "streak_frozen": streak.streak_frozen,
    }


@router.post("/freeze", response_model=FreezeOut)
async def freeze(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FreezeOut:
    """Freeze the current streak (PRO feature)."""
    # Check if user is PRO or MAX
    if user.tier not in ("pro", "max"):
        return FreezeOut(
            success=False,
            message="Streak freeze is a PRO feature. Upgrade to protect your streak!",
        )
    
    success, message = await freeze_streak(db, user.id)
    return FreezeOut(success=success, message=message)


@router.get("/milestone/{milestone_value}", response_model=MilestoneInfoOut)
async def milestone_info(milestone_value: int) -> MilestoneInfoOut:
    """Get info about a specific milestone."""
    info = get_milestone_info(milestone_value)
    return MilestoneInfoOut(**info)
