from __future__ import annotations

import uuid

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from vidra_api.config import settings
from vidra_api.database import get_db
from vidra_api.deps import get_optional_user
from vidra_api.models import ProductEvent, User
from vidra_api.schemas import EventTrackOut, EventTrackRequest

router = APIRouter(prefix="/events", tags=["events"])


async def _send_to_posthog(*, user: User | None, event_name: str, payload: dict) -> None:
    if not settings.posthog_host or not settings.posthog_project_key:
        return

    host = settings.posthog_host.rstrip("/")
    distinct_id = str(user.id) if user else f"anon-{uuid.uuid4()}"

    body = {
        "api_key": settings.posthog_project_key,
        "event": event_name,
        "distinct_id": distinct_id,
        "properties": {
            **payload,
            "$lib": "vidra-api",
        },
    }

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(f"{host}/i/v0/e/", json=body)
    except Exception:
        # Product analytics must never block product flows.
        return


@router.post("/track", response_model=EventTrackOut)
async def track_event(
    payload: EventTrackRequest,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> EventTrackOut:
    db.add(
        ProductEvent(
            user_id=user.id if user else None,
            event_name=payload.event_name,
            payload_json=payload.payload,
        )
    )
    await db.commit()
    await _send_to_posthog(user=user, event_name=payload.event_name, payload=payload.payload)
    return EventTrackOut(accepted=True)
