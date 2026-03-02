from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from vidra_api.database import get_db
from vidra_api.deps import get_current_user
from vidra_api.models import ApiKeyStore, User
from vidra_api.schemas import ApiKeyListOut, ApiKeyMaskOut, ApiKeySetRequest
from vidra_api.utils.security import decrypt_secret, encrypt_secret, mask_secret

router = APIRouter(prefix="/account", tags=["account"])

ALLOWED_PROVIDERS = {"openrouter", "fal"}


@router.get("/api-keys", response_model=ApiKeyListOut)
async def list_api_keys(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiKeyListOut:
    q = await db.execute(select(ApiKeyStore).where(ApiKeyStore.user_id == user.id))
    rows = {row.provider: row for row in q.scalars().all()}

    keys: list[ApiKeyMaskOut] = []
    for provider in sorted(ALLOWED_PROVIDERS):
        row = rows.get(provider)
        if row is None:
            keys.append(ApiKeyMaskOut(provider=provider, configured=False, masked_value=None))
        else:
            try:
                plain = decrypt_secret(row.encrypted_key)
                masked = mask_secret(plain)
            except Exception:
                masked = "****"
            keys.append(ApiKeyMaskOut(provider=provider, configured=True, masked_value=masked))

    return ApiKeyListOut(keys=keys)


@router.put("/api-keys/{provider}", response_model=ApiKeyMaskOut)
async def set_api_key(
    provider: str,
    payload: ApiKeySetRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiKeyMaskOut:
    provider = provider.strip().lower()
    if provider not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported provider")

    q = await db.execute(select(ApiKeyStore).where(ApiKeyStore.user_id == user.id, ApiKeyStore.provider == provider))
    row = q.scalar_one_or_none()

    encrypted = encrypt_secret(payload.api_key.strip())
    if row is None:
        row = ApiKeyStore(user_id=user.id, provider=provider, encrypted_key=encrypted)
        db.add(row)
    else:
        row.encrypted_key = encrypted
        row.updated_at = dt.datetime.utcnow()

    await db.commit()
    return ApiKeyMaskOut(provider=provider, configured=True, masked_value=mask_secret(payload.api_key.strip()))


@router.delete("/api-keys/{provider}", response_model=ApiKeyMaskOut)
async def delete_api_key(
    provider: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiKeyMaskOut:
    provider = provider.strip().lower()
    if provider not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported provider")

    q = await db.execute(select(ApiKeyStore).where(ApiKeyStore.user_id == user.id, ApiKeyStore.provider == provider))
    row = q.scalar_one_or_none()
    if row is not None:
        await db.delete(row)
        await db.commit()

    return ApiKeyMaskOut(provider=provider, configured=False, masked_value=None)
