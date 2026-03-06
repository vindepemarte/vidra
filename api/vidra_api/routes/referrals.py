"""Referral system routes for viral growth and credit rewards."""

from __future__ import annotations

import secrets
import string
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from vidra_api.database import get_db
from vidra_api.deps import get_current_user
from vidra_api.models import Referral, User
from vidra_api.services.wallet import apply_wallet_delta


router = APIRouter(prefix="/referrals", tags=["referrals"])


# Referral rewards config
REFERRER_CREDITS = 100  # Credits given to the person who referred
REFERRED_CREDITS = 50   # Credits given to the new user


class ReferralStatsOut(BaseModel):
    referral_code: str | None
    total_referrals: int
    successful_referrals: int
    credits_earned: int
    referral_link: str


class ReferralLeaderboardEntry(BaseModel):
    user_name: str | None
    referral_code: str
    total_referrals: int
    rank: int


class ReferralLeaderboardOut(BaseModel):
    entries: list[ReferralLeaderboardEntry]
    your_rank: int | None


def generate_referral_code(length: int = 8) -> str:
    """Generate a unique 8-character alphanumeric referral code."""
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


async def ensure_user_referral_code(db: AsyncSession, user: User) -> str:
    """Ensure user has a referral code, generate one if missing."""
    if user.referral_code:
        return user.referral_code
    
    # Generate unique code
    for _ in range(10):  # Try 10 times to generate unique code
        code = generate_referral_code()
        existing = await db.execute(select(User).where(User.referral_code == code))
        if not existing.scalar_one_or_none():
            user.referral_code = code
            await db.commit()
            return code
    
    # Fallback to UUID-based code if random generation fails
    user.referral_code = str(user.id)[:8].upper()
    await db.commit()
    return user.referral_code


@router.get("/stats", response_model=ReferralStatsOut)
async def get_referral_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReferralStatsOut:
    """Get user's referral statistics and referral link."""
    code = await ensure_user_referral_code(db, user)
    
    # Count total and successful referrals
    total_q = select(func.count()).select_from(Referral).where(Referral.referrer_id == user.id)
    total_result = await db.execute(total_q)
    total_referrals = total_result.scalar() or 0
    
    successful_q = select(func.count()).select_from(Referral).where(
        Referral.referrer_id == user.id,
        Referral.referrer_rewarded == True
    )
    successful_result = await db.execute(successful_q)
    successful_referrals = successful_result.scalar() or 0
    
    # Calculate credits earned from referrals
    credits_q = select(func.sum(Referral.referrer_credits)).select_from(Referral).where(
        Referral.referrer_id == user.id,
        Referral.referrer_rewarded == True
    )
    credits_result = await db.execute(credits_q)
    credits_earned = credits_result.scalar() or 0
    
    # Generate referral link
    frontend_url = "https://vidra.life"  # Could be configurable
    referral_link = f"{frontend_url}/signup?ref={code}"
    
    return ReferralStatsOut(
        referral_code=code,
        total_referrals=total_referrals,
        successful_referrals=successful_referrals,
        credits_earned=credits_earned,
        referral_link=referral_link,
    )


@router.get("/leaderboard", response_model=ReferralLeaderboardOut)
async def get_referral_leaderboard(
    limit: int = 10,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReferralLeaderboardOut:
    """Get top referrers leaderboard."""
    # Get top referrers by successful referral count
    top_q = (
        select(
            User.name,
            User.referral_code,
            func.count(Referral.id).label("total")
        )
        .join(Referral, Referral.referrer_id == User.id)
        .where(Referral.referrer_rewarded == True)
        .group_by(User.id, User.name, User.referral_code)
        .order_by(func.count(Referral.id).desc())
        .limit(limit)
    )
    top_result = await db.execute(top_q)
    top_rows = top_result.all()
    
    entries = []
    for idx, row in enumerate(top_rows, 1):
        entries.append(ReferralLeaderboardEntry(
            user_name=row.name or "Anonymous",
            referral_code=row.referral_code or "",
            total_referrals=row.total,
            rank=idx,
        ))
    
    # Get user's rank
    user_count_q = select(func.count()).select_from(Referral).where(
        Referral.referrer_id == user.id,
        Referral.referrer_rewarded == True
    )
    user_count_result = await db.execute(user_count_q)
    user_count = user_count_result.scalar() or 0
    
    your_rank = None
    if user_count > 0:
        # Count how many users have more referrals
        rank_q = (
            select(func.count()).select_from(
                select(func.count(Referral.id).label("cnt"))
                .select_from(Referral)
                .where(Referral.referrer_rewarded == True)
                .group_by(Referral.referrer_id)
                .having(func.count(Referral.id) > user_count)
            )
        )
        rank_result = await db.execute(rank_q)
        users_above = rank_result.scalar() or 0
        your_rank = users_above + 1
    
    return ReferralLeaderboardOut(
        entries=entries,
        your_rank=your_rank,
    )


async def process_referral_signup(
    db: AsyncSession,
    new_user: User,
    referral_code: str,
) -> bool:
    """Process a referral when a new user signs up with a referral code.
    
    Returns True if referral was processed successfully.
    """
    if not referral_code:
        return False
    
    # Find referrer by code
    referrer_q = await db.execute(
        select(User).where(User.referral_code == referral_code.upper())
    )
    referrer = referrer_q.scalar_one_or_none()
    
    if not referrer or referrer.id == new_user.id:
        return False
    
    # Check if this referral already exists
    existing_q = await db.execute(
        select(Referral).where(
            Referral.referrer_id == referrer.id,
            Referral.referred_user_id == new_user.id,
        )
    )
    if existing_q.scalar_one_or_none():
        return False
    
    # Create referral record
    referral = Referral(
        referrer_id=referrer.id,
        referred_user_id=new_user.id,
        referrer_credits=REFERRER_CREDITS,
        referred_credits=REFERRED_CREDITS,
    )
    db.add(referral)
    
    # Mark user as referred
    new_user.referred_by = referrer.id
    
    # Award credits to new user immediately
    await apply_wallet_delta(
        db,
        user_id=new_user.id,
        tier=new_user.tier,
        delta=REFERRED_CREDITS,
        reason="Welcome bonus - referred by friend",
        source_type="referral_signup",
        source_id=str(referral.id),
    )
    referral.referred_rewarded = True
    
    # Award credits to referrer
    await apply_wallet_delta(
        db,
        user_id=referrer.id,
        tier=referrer.tier,
        delta=REFERRER_CREDITS,
        reason=f"Referral bonus - {new_user.name or 'new user'} signed up",
        source_type="referral_reward",
        source_id=str(referral.id),
    )
    referral.referrer_rewarded = True
    
    await db.commit()
    return True
