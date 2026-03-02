from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import stripe

from vidra_api.config import settings
from vidra_api.database import get_db
from vidra_api.deps import get_current_user
from vidra_api.models import CreditLedger, User
from vidra_api.schemas import CheckoutSessionOut, CreditLedgerEntryOut, CreditLedgerOut, CreditWalletOut, TopupCheckoutRequest
from vidra_api.services.wallet import ensure_wallet, included_credits_for_tier

router = APIRouter(prefix="/credits", tags=["credits"])

if settings.stripe_secret_key:
    stripe.api_key = settings.stripe_secret_key


def _topup_pack_config(pack_id: str) -> tuple[int, str | None]:
    if pack_id == "starter":
        return 500, settings.stripe_price_topup_starter
    if pack_id == "growth":
        return 1500, settings.stripe_price_topup_growth
    if pack_id == "scale":
        return 5000, settings.stripe_price_topup_scale
    raise HTTPException(status_code=400, detail="Invalid top-up pack")


@router.get("/wallet", response_model=CreditWalletOut)
async def get_wallet(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CreditWalletOut:
    wallet = await ensure_wallet(db, user.id, tier=user.tier)
    await db.commit()
    return CreditWalletOut(
        balance_credits=wallet.balance_credits,
        included_monthly_credits=wallet.included_monthly_credits,
    )


@router.get("/ledger", response_model=CreditLedgerOut)
async def get_ledger(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CreditLedgerOut:
    q = await db.execute(
        select(CreditLedger)
        .where(CreditLedger.user_id == user.id)
        .order_by(CreditLedger.created_at.desc())
        .limit(100)
    )
    entries = list(q.scalars().all())
    return CreditLedgerOut(
        entries=[
            CreditLedgerEntryOut(
                id=e.id,
                delta=e.delta,
                reason=e.reason,
                source_type=e.source_type,
                source_id=e.source_id,
                created_at=e.created_at,
            )
            for e in entries
        ]
    )


@router.post("/topup/checkout", response_model=CheckoutSessionOut)
async def create_topup_checkout(
    payload: TopupCheckoutRequest,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    user: User = Depends(get_current_user),
) -> CheckoutSessionOut:
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe is not configured. Add STRIPE_SECRET_KEY.",
        )

    credits, price_id = _topup_pack_config(payload.pack_id)
    if not price_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Missing Stripe price for {payload.pack_id} top-up pack.",
        )

    success_url = settings.stripe_success_url or f"{settings.frontend_url}/settings?credits=success"
    cancel_url = settings.stripe_cancel_url or f"{settings.frontend_url}/settings?credits=cancel"

    create_args = {
        "mode": "payment",
        "line_items": [{"price": price_id, "quantity": 1}],
        "customer_email": user.email,
        "success_url": success_url,
        "cancel_url": cancel_url,
        "client_reference_id": str(user.id),
        "metadata": {
            "mode": "topup",
            "user_id": str(user.id),
            "credits": str(credits),
            "pack_id": payload.pack_id,
        },
    }

    try:
        if idempotency_key:
            session = stripe.checkout.Session.create(**create_args, idempotency_key=idempotency_key)
        else:
            session = stripe.checkout.Session.create(**create_args)
    except stripe.error.StripeError as exc:
        raise HTTPException(status_code=502, detail=f"Stripe checkout error: {exc.user_message or str(exc)}") from exc

    url = session.get("url")
    if not url:
        raise HTTPException(status_code=502, detail="Stripe did not return a checkout URL.")

    return CheckoutSessionOut(url=url)


@router.get("/included", response_model=CreditWalletOut)
async def get_included_credits(user: User = Depends(get_current_user)) -> CreditWalletOut:
    included = included_credits_for_tier(user.tier)
    return CreditWalletOut(balance_credits=0, included_monthly_credits=included)
