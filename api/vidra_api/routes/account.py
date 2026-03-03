from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from vidra_api.config import settings
from vidra_api.database import get_db
from vidra_api.deps import get_current_user
from vidra_api.models import ApiKeyStore, User, UserModelPreference
from vidra_api.schemas import (
    ApiKeyListOut,
    ApiKeyMaskOut,
    ApiKeySetRequest,
    ModelPreferencesOut,
    ModelPreferencesUpdateRequest,
    ProviderModelCatalogOut,
    ProviderModelOptionOut,
)
from vidra_api.utils.security import decrypt_secret, encrypt_secret, mask_secret

router = APIRouter(prefix="/account", tags=["account"])

ALLOWED_PROVIDERS = {"openrouter", "fal"}

OPENROUTER_MODEL_OPTIONS = [
    "x-ai/grok-4-fast",
    "openai/gpt-4.1-mini",
    "openai/gpt-4.1",
    "anthropic/claude-sonnet-4-20250514",
    "deepseek/deepseek-v3.2",
    "google/gemini-2.5-pro",
]

FAL_MODEL_OPTIONS: list[dict[str, str]] = [
    {"id": "fal-ai/flux-lora", "label": "Flux LoRA (Generate)", "operation": "generate", "credits_hint": "4 credits / MP"},
    {"id": "fal-ai/nano-banana-pro/edit", "label": "Nano Banana Pro (Edit)", "operation": "edit", "credits_hint": "14 credits / image"},
    {"id": "fal-ai/clarity-upscaler", "label": "Clarity Upscaler", "operation": "upscale", "credits_hint": "3 credits / MP"},
    {"id": "fal-ai/flux-lora-fast-training", "label": "Flux LoRA Fast Training", "operation": "train", "credits_hint": "2 credits / step"},
]


async def _get_model_preferences(db: AsyncSession, user_id) -> UserModelPreference | None:
    q = await db.execute(select(UserModelPreference).where(UserModelPreference.user_id == user_id))
    return q.scalar_one_or_none()


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


@router.get("/model-preferences", response_model=ModelPreferencesOut)
async def get_model_preferences(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ModelPreferencesOut:
    row = await _get_model_preferences(db, user.id)
    if row is None:
        return ModelPreferencesOut(
            openrouter_model=settings.openrouter_model,
            fal_image_model=settings.fal_image_model,
            fal_edit_model=settings.fal_edit_model,
            fal_upscale_model=settings.fal_upscale_model,
            fal_train_model=settings.fal_train_model,
        )

    return ModelPreferencesOut(
        openrouter_model=row.openrouter_model or settings.openrouter_model,
        fal_image_model=row.fal_image_model or settings.fal_image_model,
        fal_edit_model=row.fal_edit_model or settings.fal_edit_model,
        fal_upscale_model=row.fal_upscale_model or settings.fal_upscale_model,
        fal_train_model=row.fal_train_model or settings.fal_train_model,
    )


@router.put("/model-preferences", response_model=ModelPreferencesOut)
async def set_model_preferences(
    payload: ModelPreferencesUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ModelPreferencesOut:
    row = await _get_model_preferences(db, user.id)
    if row is None:
        row = UserModelPreference(user_id=user.id)
        db.add(row)
        await db.flush()

    if payload.openrouter_model is not None:
        row.openrouter_model = payload.openrouter_model.strip() or None
    if payload.fal_image_model is not None:
        row.fal_image_model = payload.fal_image_model.strip() or None
    if payload.fal_edit_model is not None:
        row.fal_edit_model = payload.fal_edit_model.strip() or None
    if payload.fal_upscale_model is not None:
        row.fal_upscale_model = payload.fal_upscale_model.strip() or None
    if payload.fal_train_model is not None:
        row.fal_train_model = payload.fal_train_model.strip() or None
    row.updated_at = dt.datetime.utcnow()

    await db.commit()

    return ModelPreferencesOut(
        openrouter_model=row.openrouter_model or settings.openrouter_model,
        fal_image_model=row.fal_image_model or settings.fal_image_model,
        fal_edit_model=row.fal_edit_model or settings.fal_edit_model,
        fal_upscale_model=row.fal_upscale_model or settings.fal_upscale_model,
        fal_train_model=row.fal_train_model or settings.fal_train_model,
    )


@router.get("/provider-models", response_model=ProviderModelCatalogOut)
async def get_provider_models() -> ProviderModelCatalogOut:
    openrouter_rows = [
        ProviderModelOptionOut(
            id=model_id,
            label=model_id,
            operation="llm_profile",
            credits_hint="Included in PRO/MAX plan",
        )
        for model_id in dict.fromkeys([settings.openrouter_model, *OPENROUTER_MODEL_OPTIONS])
        if model_id
    ]
    fal_rows = [ProviderModelOptionOut(**row) for row in FAL_MODEL_OPTIONS]
    return ProviderModelCatalogOut(openrouter=openrouter_rows, fal=fal_rows)
