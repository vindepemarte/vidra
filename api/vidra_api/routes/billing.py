import json

import stripe
from fastapi import APIRouter, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from vidra_api.config import settings
from vidra_api.database import SessionLocal
from vidra_api.models import Subscription, User

router = APIRouter(prefix="/billing", tags=["billing"])

if settings.stripe_secret_key:
    stripe.api_key = settings.stripe_secret_key

PLAN_FROM_PRICE = {
    "price_pro": "pro",
    "price_max": "max",
}


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

    if event_type not in {"checkout.session.completed", "customer.subscription.updated", "customer.subscription.created"}:
        return {"status": "ignored", "type": event_type}

    customer_id = data_obj.get("customer")
    subscription_id = data_obj.get("subscription") or data_obj.get("id")
    email = data_obj.get("customer_details", {}).get("email") or data_obj.get("customer_email")
    items = data_obj.get("items", {}).get("data", [])

    plan = "pro"
    for item in items:
        price_id = item.get("price", {}).get("id")
        if price_id in PLAN_FROM_PRICE:
            plan = PLAN_FROM_PRICE[price_id]
            break

    async with SessionLocal() as db:  # type: AsyncSession
        if email:
            user_q = await db.execute(select(User).where(User.email == email.lower()))
            user = user_q.scalar_one_or_none()
        else:
            user = None

        if user is None:
            return {"status": "no-user", "customer": customer_id}

        user.tier = plan

        sub_q = await db.execute(select(Subscription).where(Subscription.user_id == user.id))
        sub = sub_q.scalar_one_or_none()
        if sub is None:
            sub = Subscription(user_id=user.id)
            db.add(sub)

        sub.stripe_customer_id = customer_id
        sub.stripe_subscription_id = subscription_id
        sub.plan = plan
        sub.status = "active"

        await db.commit()

    return {"status": "ok", "plan": plan}
