"""Content streak service for gamification and engagement tracking."""

import datetime as dt
import uuid
from typing import Optional

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from vidra_api.models import ContentStreak, StreakActivity, StreakMilestone


# Milestone definitions
STREAK_MILESTONES = [3, 7, 14, 21, 30, 60, 90, 180, 365]
TOTAL_DAYS_MILESTONES = [7, 14, 30, 60, 90, 180, 365]
MILESTONE_REWARDS = {
    3: {"credits": 5, "title": "3-Day Streak! 🔥"},
    7: {"credits": 15, "title": "Week Warrior! ⚡"},
    14: {"credits": 30, "title": "Two-Week Champion! 💪"},
    21: {"credits": 50, "title": "Three-Week Legend! 🌟"},
    30: {"credits": 100, "title": "Monthly Master! 👑"},
    60: {"credits": 200, "title": "Two-Month Titan! 🚀"},
    90: {"credits": 350, "title": "Quarterly Queen! 💎"},
    180: {"credits": 750, "title": "Half-Year Hero! 🏆"},
    365: {"credits": 2000, "title": "Year-Long Legend! 🎊"},
}


async def ensure_streak(db: AsyncSession, user_id: uuid.UUID) -> ContentStreak:
    """Ensure a streak record exists for the user."""
    result = await db.execute(select(ContentStreak).where(ContentStreak.user_id == user_id))
    streak = result.scalar_one_or_none()
    
    if not streak:
        streak = ContentStreak(
            user_id=user_id,
            current_streak=0,
            longest_streak=0,
            last_activity_date=None,
            total_active_days=0,
            streak_frozen=False,
            freeze_count=0,
        )
        db.add(streak)
        await db.flush()
    
    return streak


async def record_streak_activity(
    db: AsyncSession,
    user_id: uuid.UUID,
    activity_type: str = "login",
    activity_date: Optional[dt.date] = None,
) -> tuple[ContentStreak, list[StreakMilestone], bool]:
    """
    Record a streak activity and update streak counters.
    
    Returns:
        tuple: (streak, new_milestones, is_new_day)
    """
    today = activity_date or dt.date.today()
    streak = await ensure_streak(db, user_id)
    new_milestones = []
    is_new_day = False
    
    # Check if we already have activity for this date
    existing = await db.execute(
        select(StreakActivity).where(
            and_(
                StreakActivity.user_id == user_id,
                StreakActivity.activity_date == today,
            )
        )
    )
    if existing.scalar_one_or_none():
        # Already recorded for today, just return
        return streak, new_milestones, False
    
    # Record the activity
    activity = StreakActivity(
        user_id=user_id,
        activity_date=today,
        activity_type=activity_type,
        points_earned=1,
    )
    db.add(activity)
    
    # Update streak logic
    last_date = streak.last_activity_date
    
    if last_date is None:
        # First ever activity
        streak.current_streak = 1
        streak.longest_streak = max(streak.longest_streak, 1)
        streak.total_active_days = 1
        is_new_day = True
    elif last_date == today:
        # Same day, no streak change
        pass
    elif (today - last_date).days == 1:
        # Consecutive day - streak continues
        streak.current_streak += 1
        streak.longest_streak = max(streak.longest_streak, streak.current_streak)
        streak.total_active_days += 1
        is_new_day = True
    elif streak.streak_frozen and (today - last_date).days == 2:
        # Streak was frozen, but still within grace period
        streak.current_streak += 1
        streak.longest_streak = max(streak.longest_streak, streak.current_streak)
        streak.total_active_days += 1
        streak.streak_frozen = False
        streak.freeze_count = max(0, streak.freeze_count - 1)
        is_new_day = True
    else:
        # Streak broken - start over
        streak.current_streak = 1
        streak.total_active_days += 1
        streak.streak_frozen = False
        is_new_day = True
    
    streak.last_activity_date = today
    streak.updated_at = dt.datetime.utcnow()
    
    # Check for new milestones
    new_milestones = await _check_milestones(db, user_id, streak)
    
    await db.flush()
    return streak, new_milestones, is_new_day


async def _check_milestones(
    db: AsyncSession,
    user_id: uuid.UUID,
    streak: ContentStreak,
) -> list[StreakMilestone]:
    """Check and create new milestones."""
    new_milestones = []
    
    # Check current streak milestones
    for milestone_value in STREAK_MILESTONES:
        if streak.current_streak >= milestone_value:
            existing = await db.execute(
                select(StreakMilestone).where(
                    and_(
                        StreakMilestone.user_id == user_id,
                        StreakMilestone.milestone_type == "streak_days",
                        StreakMilestone.milestone_value == milestone_value,
                    )
                )
            )
            if not existing.scalar_one_or_none():
                milestone = StreakMilestone(
                    user_id=user_id,
                    milestone_type="streak_days",
                    milestone_value=milestone_value,
                )
                db.add(milestone)
                new_milestones.append(milestone)
    
    # Check total days milestones
    for milestone_value in TOTAL_DAYS_MILESTONES:
        if streak.total_active_days >= milestone_value:
            existing = await db.execute(
                select(StreakMilestone).where(
                    and_(
                        StreakMilestone.user_id == user_id,
                        StreakMilestone.milestone_type == "total_days",
                        StreakMilestone.milestone_value == milestone_value,
                    )
                )
            )
            if not existing.scalar_one_or_none():
                milestone = StreakMilestone(
                    user_id=user_id,
                    milestone_type="total_days",
                    milestone_value=milestone_value,
                )
                db.add(milestone)
                new_milestones.append(milestone)
    
    # Check longest streak milestones
    for milestone_value in STREAK_MILESTONES:
        if streak.longest_streak >= milestone_value:
            existing = await db.execute(
                select(StreakMilestone).where(
                    and_(
                        StreakMilestone.user_id == user_id,
                        StreakMilestone.milestone_type == "longest_streak",
                        StreakMilestone.milestone_value == milestone_value,
                    )
                )
            )
            if not existing.scalar_one_or_none():
                milestone = StreakMilestone(
                    user_id=user_id,
                    milestone_type="longest_streak",
                    milestone_value=milestone_value,
                )
                db.add(milestone)
                new_milestones.append(milestone)
    
    return new_milestones


async def freeze_streak(db: AsyncSession, user_id: uuid.UUID) -> tuple[bool, str]:
    """
    Freeze the current streak to protect it for one day.
    PRO feature only.
    
    Returns:
        tuple: (success, message)
    """
    streak = await ensure_streak(db, user_id)
    
    if streak.streak_frozen:
        return False, "Streak is already frozen"
    
    if streak.current_streak < 3:
        return False, "Need at least a 3-day streak to freeze"
    
    streak.streak_frozen = True
    streak.freeze_count += 1
    streak.updated_at = dt.datetime.utcnow()
    await db.flush()
    
    return True, f"Streak frozen! Your {streak.current_streak}-day streak is protected for 24 hours."


async def get_streak_status(db: AsyncSession, user_id: uuid.UUID) -> dict:
    """Get the full streak status for a user."""
    streak = await ensure_streak(db, user_id)
    
    # Get recent milestones
    recent_milestones = await db.execute(
        select(StreakMilestone)
        .where(StreakMilestone.user_id == user_id)
        .order_by(StreakMilestone.achieved_at.desc())
        .limit(5)
    )
    milestones = recent_milestones.scalars().all()
    
    # Get next milestone
    next_streak_milestone = None
    for m in STREAK_MILESTONES:
        if m > streak.current_streak:
            next_streak_milestone = m
            break
    
    # Calculate streak health
    today = dt.date.today()
    if streak.last_activity_date:
        days_since_activity = (today - streak.last_activity_date).days
    else:
        days_since_activity = 999
    
    streak_health = "active" if days_since_activity == 0 else "at_risk" if days_since_activity == 1 else "broken"
    
    return {
        "current_streak": streak.current_streak,
        "longest_streak": streak.longest_streak,
        "total_active_days": streak.total_active_days,
        "last_activity_date": streak.last_activity_date.isoformat() if streak.last_activity_date else None,
        "streak_frozen": streak.streak_frozen,
        "freeze_count": streak.freeze_count,
        "streak_health": streak_health,
        "days_since_activity": days_since_activity,
        "next_milestone": next_streak_milestone,
        "recent_milestones": [
            {
                "type": m.milestone_type,
                "value": m.milestone_value,
                "achieved_at": m.achieved_at.isoformat(),
                "reward": MILESTONE_REWARDS.get(m.milestone_value, {}),
            }
            for m in milestones
        ],
        "milestone_reward_available": any(
            not m.reward_claimed for m in milestones
        ),
    }


def get_milestone_info(milestone_value: int) -> dict:
    """Get info about a specific milestone."""
    return MILESTONE_REWARDS.get(milestone_value, {"credits": 0, "title": f"{milestone_value}-Day Milestone"})
