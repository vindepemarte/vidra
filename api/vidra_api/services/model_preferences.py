from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from vidra_api.config import settings
from vidra_api.models import UserModelPreference


async def get_model_preferences(db: AsyncSession, user_id) -> UserModelPreference | None:
    q = await db.execute(select(UserModelPreference).where(UserModelPreference.user_id == user_id))
    return q.scalar_one_or_none()


async def resolve_openrouter_model(db: AsyncSession, user_id) -> str:
    prefs = await get_model_preferences(db, user_id)
    if prefs and prefs.openrouter_model:
        return prefs.openrouter_model
    return settings.openrouter_model


async def resolve_fal_models(db: AsyncSession, user_id) -> dict[str, str]:
    prefs = await get_model_preferences(db, user_id)
    return {
        "image": (prefs.fal_image_model if prefs and prefs.fal_image_model else settings.fal_image_model),
        "edit": (prefs.fal_edit_model if prefs and prefs.fal_edit_model else settings.fal_edit_model),
        "upscale": (prefs.fal_upscale_model if prefs and prefs.fal_upscale_model else settings.fal_upscale_model),
        "train": (prefs.fal_train_model if prefs and prefs.fal_train_model else settings.fal_train_model),
    }

