from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from vidra_api.models import CreditLedger, CreditWallet
from vidra_api.plans import included_credits_for_tier


async def ensure_wallet(db: AsyncSession, user_id: UUID, *, tier: str | None) -> CreditWallet:
    q = await db.execute(select(CreditWallet).where(CreditWallet.user_id == user_id))
    wallet = q.scalar_one_or_none()
    included = included_credits_for_tier(tier)
    if wallet is None:
        wallet = CreditWallet(user_id=user_id, balance_credits=included, included_monthly_credits=included)
        db.add(wallet)
        await db.flush()
    elif wallet.included_monthly_credits != included:
        # Grant delta when moving to a higher included-credits tier.
        if included > wallet.included_monthly_credits:
            wallet.balance_credits += included - wallet.included_monthly_credits
        wallet.included_monthly_credits = included
        wallet.updated_at = dt.datetime.utcnow()
        await db.flush()
    return wallet


async def add_credit_ledger(
    db: AsyncSession,
    *,
    user_id: UUID,
    delta: int,
    reason: str,
    source_type: str,
    source_id: str,
) -> tuple[CreditLedger, bool]:
    existing_q = await db.execute(
        select(CreditLedger).where(
            CreditLedger.user_id == user_id,
            CreditLedger.source_type == source_type,
            CreditLedger.source_id == source_id,
        )
    )
    existing = existing_q.scalar_one_or_none()
    if existing is not None:
        return existing, False

    entry = CreditLedger(
        user_id=user_id,
        delta=delta,
        reason=reason,
        source_type=source_type,
        source_id=source_id,
    )
    db.add(entry)
    await db.flush()
    return entry, True


async def apply_wallet_delta(
    db: AsyncSession,
    *,
    user_id: UUID,
    tier: str | None,
    delta: int,
    reason: str,
    source_type: str,
    source_id: str,
) -> tuple[CreditWallet, CreditLedger]:
    wallet = await ensure_wallet(db, user_id, tier=tier)
    ledger, created = await add_credit_ledger(
        db,
        user_id=user_id,
        delta=delta,
        reason=reason,
        source_type=source_type,
        source_id=source_id,
    )

    if created and wallet.balance_credits + delta >= 0:
        wallet.balance_credits += delta
        wallet.updated_at = dt.datetime.utcnow()

    await db.flush()
    return wallet, ledger
