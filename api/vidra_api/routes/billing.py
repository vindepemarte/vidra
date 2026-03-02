import json
from uuid import UUID

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from vidra_api.config import settings
from vidra_api.database import SessionLocal, get_db
from vidra_api.deps import get_current_user
from vidra_api.models import Subscription, User
from vidra_api.plans import normalize_tier
from vidra_api.schemas import CheckoutRequest, CheckoutSessionOut
from vidra_api.services.wallet import apply_wallet_delta

router = APIRouter(prefix="/billing", tags=["billing"])

if settings.stripe_secret_key:
    stripe.api_key = settings.stripe_secret_key


def _ensure_stripe_configured() -> None:
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe is not configured. Add STRIPE_SECRET_KEY.",
        )


def _price_id_for_tier(tier: str) -> str | None:
    if tier == "pro":
        return settings.stripe_price_pro
    if tier == "max":
        return settings.stripe_price_max
    return None


def _plan_from_price_ids(price_ids: list[str]) -> str:
    if settings.stripe_price_max and settings.stripe_price_max in price_ids:
        return "max"
    if settings.stripe_price_pro and settings.stripe_price_pro in price_ids:
        return "pro"
    # Conservative fallback to PRO when unknown paid checkout arrives.
    return "pro"


def _extract_price_ids_from_subscription_obj(data_obj: dict) -> list[str]:
    items = data_obj.get("items", {}).get("data", [])
    result: list[str] = []
    for item in items:
        price_id = item.get("price", {}).get("id")
        if price_id:
            result.append(price_id)
    return result


def _extract_checkout_line_item_price_ids(data_obj: dict) -> list[str]:
    lines = data_obj.get("line_items", {}).get("data", [])
    ids: list[str] = []
    for line in lines:
        price_id = line.get("price", {}).get("id")
        if price_id:
            ids.append(price_id)
    return ids


async def _find_user(db: AsyncSession, user_id_ref: str | None, email: str | None, customer_id: str | None) -> User | None:
    if user_id_ref:
        try:
            parsed = UUID(user_id_ref)
            user_q = await db.execute(select(User).where(User.id == parsed))
            user = user_q.scalar_one_or_none()
            if user:
                return user
        except ValueError:
            pass

    if email:
        user_q = await db.execute(select(User).where(User.email == email.lower()))
        user = user_q.scalar_one_or_none()
        if user:
            return user

    if customer_id:
        sub_q = await db.execute(select(Subscription).where(Subscription.stripe_customer_id == customer_id))
        sub = sub_q.scalars().first()
        if sub:
            user_q = await db.execute(select(User).where(User.id == sub.user_id))
            return user_q.scalar_one_or_none()

    return None


@router.post("/checkout", response_model=CheckoutSessionOut)
async def create_checkout_session(
    payload: CheckoutRequest,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    user: User = Depends(get_current_user),
) -> CheckoutSessionOut:
    _ensure_stripe_configured()

    current_tier = normalize_tier(user.tier)
    target_tier = payload.tier.lower()

    if target_tier == "pro" and current_tier in {"pro", "max"}:
        raise HTTPException(status_code=409, detail="You are already on PRO or higher.")
    if target_tier == "max" and current_tier == "max":
        raise HTTPException(status_code=409, detail="You are already on MAX.")

    price_id = _price_id_for_tier(target_tier)
    if not price_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Stripe price for {target_tier.upper()} is not configured.",
        )

    success_url = settings.stripe_success_url or f"{settings.frontend_url}/dashboard?billing=success"
    cancel_url = settings.stripe_cancel_url or f"{settings.frontend_url}/dashboard?billing=cancel"

    create_args = {
        "mode": "subscription",
        "line_items": [{"price": price_id, "quantity": 1}],
        "customer_email": user.email,
        "success_url": success_url,
        "cancel_url": cancel_url,
        "client_reference_id": str(user.id),
        "metadata": {
            "user_id": str(user.id),
            "target_tier": target_tier,
        },
        "subscription_data": {
            "metadata": {
                "user_id": str(user.id),
                "target_tier": target_tier,
            }
        },
    }

    try:
        if idempotency_key:
            checkout = stripe.checkout.Session.create(**create_args, idempotency_key=idempotency_key)
        else:
            checkout = stripe.checkout.Session.create(**create_args)
    except stripe.error.StripeError as exc:
        raise HTTPException(status_code=502, detail=f"Stripe checkout error: {exc.user_message or str(exc)}") from exc

    url = checkout.get("url")
    if not url:
        raise HTTPException(status_code=502, detail="Stripe did not return a checkout URL.")

    return CheckoutSessionOut(url=url)


@router.post("/portal", response_model=CheckoutSessionOut)
async def create_portal_session(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckoutSessionOut:
    _ensure_stripe_configured()

    sub_q = await db.execute(select(Subscription).where(Subscription.user_id == user.id))
    sub = sub_q.scalars().first()

    if not sub or not sub.stripe_customer_id:
        raise HTTPException(status_code=404, detail="No Stripe customer found for this account yet.")

    return_url = settings.stripe_portal_return_url or f"{settings.frontend_url}/settings"

    try:
        portal = stripe.billing_portal.Session.create(customer=sub.stripe_customer_id, return_url=return_url)
    except stripe.error.StripeError as exc:
        raise HTTPException(status_code=502, detail=f"Stripe portal error: {exc.user_message or str(exc)}") from exc

    url = portal.get("url")
    if not url:
        raise HTTPException(status_code=502, detail="Stripe did not return a portal URL.")

    return CheckoutSessionOut(url=url)


@router.post("/webhook")
async def stripe_webhook(request: Request, stripe_signature: str | None = Header(default=None, alias="stripe-signature")):
    payload = await request.body()

    if settings.stripe_webhook_secret and stripe_signature:
        try:
            event = stripe.Webhook.construct_event(payload, stripe_signature, settings.stripe_webhook_secret)
        except stripe.error.SignatureVerificationError as exc:
            raise HTTPException(status_code=400, detail="Invalid webhook signature") from exc
    else:
        event = json.loads(payload.decode("utf-8"))

    event_type = event.get("type")
    data_obj = event.get("data", {}).get("object", {})

    if event_type not in {
        "checkout.session.completed",
        "customer.subscription.updated",
        "customer.subscription.created",
        "customer.subscription.deleted",
    }:
        return {"status": "ignored", "type": event_type}

    customer_id = data_obj.get("customer")
    subscription_id = data_obj.get("subscription") or data_obj.get("id")
    email = data_obj.get("customer_details", {}).get("email") or data_obj.get("customer_email")
    metadata = data_obj.get("metadata") or {}
    user_id_ref = metadata.get("user_id")

    # Handle one-time credits top-up checkouts.
    if event_type == "checkout.session.completed" and metadata.get("mode") == "topup":
        credits_raw = metadata.get("credits") or "0"
        try:
            credits = int(credits_raw)
        except ValueError:
            credits = 0

        if credits > 0:
            async with SessionLocal() as db:  # type: AsyncSession
                user = await _find_user(db=db, user_id_ref=user_id_ref, email=email, customer_id=customer_id)
                if user is None:
                    return {"status": "no-user", "customer": customer_id}

                await apply_wallet_delta(
                    db,
                    user_id=user.id,
                    tier=user.tier,
                    delta=credits,
                    reason=f"Top-up credits ({metadata.get('pack_id', 'custom')})",
                    source_type="stripe_topup",
                    source_id=str(data_obj.get("id") or metadata.get("session_id") or ""),
                )
                await db.commit()

        return {"status": "ok", "type": event_type, "credits_added": credits}

    price_ids: list[str] = []
    sub_status = data_obj.get("status") or "active"

    if event_type.startswith("customer.subscription"):
        price_ids = _extract_price_ids_from_subscription_obj(data_obj)
    elif event_type == "checkout.session.completed":
        price_ids = _extract_checkout_line_item_price_ids(data_obj)
        if settings.stripe_secret_key and subscription_id:
            try:
                subscription_obj = stripe.Subscription.retrieve(subscription_id, expand=["items.data.price"])
                price_ids = price_ids or _extract_price_ids_from_subscription_obj(subscription_obj)
                customer_id = customer_id or subscription_obj.get("customer")
                sub_status = subscription_obj.get("status") or sub_status
                sub_meta = subscription_obj.get("metadata") or {}
                user_id_ref = user_id_ref or sub_meta.get("user_id")
            except stripe.error.StripeError:
                pass

    plan = "free" if event_type == "customer.subscription.deleted" else _plan_from_price_ids(price_ids)

    async with SessionLocal() as db:  # type: AsyncSession
        user = await _find_user(db=db, user_id_ref=user_id_ref, email=email, customer_id=customer_id)
        if user is None:
            return {"status": "no-user", "customer": customer_id}

        user.tier = plan

        sub_q = await db.execute(select(Subscription).where(Subscription.user_id == user.id))
        sub = sub_q.scalars().first()
        if sub is None:
            sub = Subscription(user_id=user.id)
            db.add(sub)

        sub.stripe_customer_id = customer_id
        sub.stripe_subscription_id = subscription_id
        sub.plan = plan
        sub.status = sub_status

        await db.commit()

    return {"status": "ok", "plan": plan, "type": event_type}
