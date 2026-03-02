from __future__ import annotations

import hashlib

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from vidra_api.config import settings
from vidra_api.database import get_db
from vidra_api.deps import get_optional_user
from vidra_api.models import ConsentRecord, User
from vidra_api.schemas import ConsentCookieOut, ConsentCookieRequest

router = APIRouter(prefix="/consent", tags=["consent"])


def _hash_optional(raw: str | None) -> str | None:
    if not raw:
        return None
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


@router.post("/cookies", response_model=ConsentCookieOut)
async def save_cookie_consent(
    payload: ConsentCookieRequest,
    request: Request,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> ConsentCookieOut:
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    db.add(
        ConsentRecord(
            user_id=user.id if user else None,
            session_id=payload.session_id,
            policy_version=settings.app_policy_version,
            analytics=payload.analytics,
            marketing=payload.marketing,
            ip_hash=_hash_optional(ip),
            user_agent_hash=_hash_optional(user_agent),
        )
    )
    await db.commit()

    return ConsentCookieOut(accepted=True, policy_version=settings.app_policy_version)
