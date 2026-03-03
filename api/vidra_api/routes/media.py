from __future__ import annotations

import datetime as dt
import math
from uuid import UUID

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from vidra_api.config import settings
from vidra_api.database import SessionLocal, get_db
from vidra_api.deps import get_current_user
from vidra_api.models import ApiKeyStore, CalendarDay, CalendarMonth, MediaGeneration, Persona, PersonaLora, Post, User
from vidra_api.schemas import (
    MediaEditImageRequest,
    MediaGenerateImageRequest,
    MediaJobListOut,
    MediaJobOut,
    MediaUpscaleImageRequest,
    PersonaLoraAttachRequest,
    PersonaLoraListOut,
    PersonaLoraOut,
)
from vidra_api.services.model_preferences import resolve_fal_models
from vidra_api.services.wallet import apply_wallet_delta, ensure_wallet
from vidra_api.utils.limiter import enforce_rate_limit
from vidra_api.utils.security import decrypt_secret

router = APIRouter(prefix="/media", tags=["media"])

FAL_PRICE_USD_PER_UNIT: dict[str, float] = {
    "fal-ai/flux-lora-fast-training": 0.02,  # per step
    "fal-ai/flux-lora": 0.035,  # per megapixel
    "fal-ai/clarity-upscaler": 0.03,  # per megapixel
    "fal-ai/nano-banana-pro/edit": 0.15,  # per image
}


def _serialize_job(job: MediaGeneration) -> MediaJobOut:
    return MediaJobOut(
        id=job.id,
        user_id=job.user_id,
        persona_id=job.persona_id,
        post_id=job.post_id,
        provider=job.provider,
        model=job.model,
        mode=job.mode,
        status=job.status,
        prompt=job.prompt,
        reference_asset_id=job.reference_asset_id,
        output_url=job.output_url,
        error_message=job.error_message,
        cost_credits=job.cost_credits,
        external_job_id=job.external_job_id,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


def _serialize_lora(row: PersonaLora) -> PersonaLoraOut:
    return PersonaLoraOut(
        id=row.id,
        persona_id=row.persona_id,
        name=row.name,
        provider=row.provider,
        external_lora_id=row.external_lora_id,
        trigger_word=row.trigger_word,
        status=row.status,
        is_default=row.is_default,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def _assert_persona_access(db: AsyncSession, *, user: User, persona_id: UUID) -> Persona:
    q = await db.execute(select(Persona).where(Persona.id == persona_id, Persona.user_id == user.id))
    persona = q.scalar_one_or_none()
    if persona is None:
        raise HTTPException(status_code=404, detail="Persona not found")
    return persona


async def _assert_post_access(db: AsyncSession, *, post_id: UUID, persona_id: UUID) -> Post:
    post_q = await db.execute(
        select(Post)
        .join(CalendarDay, CalendarDay.id == Post.day_id)
        .join(CalendarMonth, CalendarMonth.id == CalendarDay.month_id)
        .where(Post.id == post_id, CalendarMonth.persona_id == persona_id)
    )
    post = post_q.scalar_one_or_none()
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


async def _get_byok_fal_key(db: AsyncSession, user_id: UUID) -> str | None:
    q = await db.execute(select(ApiKeyStore).where(ApiKeyStore.user_id == user_id, ApiKeyStore.provider == "fal"))
    row = q.scalar_one_or_none()
    if row is None:
        return None
    try:
        return decrypt_secret(row.encrypted_key)
    except Exception:
        return None


def _select_fal_credential(byok_key: str | None) -> tuple[str, str]:
    if byok_key:
        return byok_key, "byok"
    if settings.fal_api_key:
        return settings.fal_api_key, "platform"
    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail="fal.ai key missing. Add BYOK key in settings or configure platform FAL_API_KEY.",
    )


def _extract_output_url(payload: dict) -> str | None:
    if isinstance(payload.get("images"), list) and payload["images"]:
        first = payload["images"][0]
        if isinstance(first, dict):
            return first.get("url") or first.get("image_url")
        if isinstance(first, str):
            return first

    if isinstance(payload.get("output"), list) and payload["output"]:
        first = payload["output"][0]
        if isinstance(first, dict):
            return first.get("url") or first.get("image_url")
        if isinstance(first, str):
            return first

    if isinstance(payload.get("image"), dict):
        return payload["image"].get("url") or payload["image"].get("image_url")

    if isinstance(payload.get("url"), str):
        return payload.get("url")

    return None


def _estimate_megapixels(width: int | None, height: int | None, *, fallback_mp: float = 1.05) -> float:
    if width and height and width > 0 and height > 0:
        return max(0.25, (width * height) / 1_000_000.0)
    return fallback_mp


def _credits_from_usd(usd_amount: float) -> int:
    safe_usd = usd_amount * settings.media_safety_multiplier * settings.media_margin_multiplier
    credits = math.ceil(safe_usd / max(settings.media_credit_value_usd, 0.0001))
    return max(1, credits)


def _estimate_cost_credits(
    *,
    model: str,
    operation: str,
    key_source: str,
    width: int | None = None,
    height: int | None = None,
    num_images: int | None = 1,
    upscale_factor: int | None = 2,
    source_payload: dict | None = None,
) -> int:
    if key_source != "platform":
        return 0

    model_id = (model or "").strip()
    unit_price = FAL_PRICE_USD_PER_UNIT.get(model_id)

    if unit_price is None:
        # Unknown platform-routed model: keep conservative pricing to avoid negative unit economics.
        if operation == "image":
            return max(settings.fal_image_cost_credits, 60)
        if operation == "edit":
            return max(settings.fal_edit_cost_credits, 40)
        return max(settings.fal_edit_cost_credits, 30)

    count_images = max(1, num_images or 1)
    source_width = None
    source_height = None
    if isinstance(source_payload, dict):
        source_width = source_payload.get("width")
        source_height = source_payload.get("height")
        if not isinstance(source_width, int):
            source_width = None
        if not isinstance(source_height, int):
            source_height = None

    if model_id == "fal-ai/nano-banana-pro/edit":
        return _credits_from_usd(unit_price * count_images)

    if model_id == "fal-ai/clarity-upscaler":
        base_mp = _estimate_megapixels(source_width or width, source_height or height, fallback_mp=1.05)
        factor = max(2, min(4, upscale_factor or 2))
        # Conservative estimate: pricing follows output megapixels.
        return _credits_from_usd(unit_price * base_mp * factor * factor)

    # Megapixel-based generation defaults
    mp = _estimate_megapixels(width, height, fallback_mp=1.05)
    return _credits_from_usd(unit_price * mp * count_images)


async def _call_fal(model: str, api_key: str, payload: dict) -> dict:
    url = f"https://fal.run/{model}"
    headers = {
        "Authorization": f"Key {api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(url, json=payload, headers=headers)
    if res.status_code >= 400:
        raise RuntimeError(f"fal.ai request failed ({res.status_code}): {res.text[:400]}")
    try:
        return res.json()
    except Exception as exc:
        raise RuntimeError("fal.ai response is not valid JSON") from exc


async def _run_media_job(
    *,
    job_id: UUID,
    user_id: UUID,
    user_tier: str,
    model: str,
    api_key: str,
    key_source: str,
    fal_payload: dict,
    cost: int,
    operation: str,
) -> None:
    async with SessionLocal() as db:  # type: AsyncSession
        q = await db.execute(select(MediaGeneration).where(MediaGeneration.id == job_id, MediaGeneration.user_id == user_id))
        job = q.scalar_one_or_none()
        if job is None:
            return

        try:
            result = await _call_fal(model, api_key, fal_payload)
            output_url = _extract_output_url(result)
            if not output_url:
                raise RuntimeError("fal.ai response missing output URL")

            job.status = "completed"
            job.output_url = output_url
            job.external_job_id = str(result.get("request_id") or result.get("id") or "") or None
            job.updated_at = dt.datetime.utcnow()
            job.error_message = None

            if key_source == "platform" and cost > 0:
                reason_map = {
                    "image": "fal image generation",
                    "edit": "fal image edit",
                    "upscale": "fal image upscale",
                }
                await apply_wallet_delta(
                    db,
                    user_id=user_id,
                    tier=user_tier,
                    delta=-cost,
                    reason=reason_map.get(operation, "fal media generation"),
                    source_type="media_generation",
                    source_id=str(job.id),
                )

            await db.commit()
        except Exception as exc:  # noqa: BLE001
            job.status = "failed"
            job.error_message = str(exc)
            job.updated_at = dt.datetime.utcnow()
            await db.commit()


async def _resolve_lora_for_persona(
    db: AsyncSession,
    *,
    user_id: UUID,
    persona_id: UUID,
    persona_lora_id: UUID | None,
) -> PersonaLora | None:
    if persona_lora_id:
        q = await db.execute(
            select(PersonaLora).where(
                PersonaLora.id == persona_lora_id,
                PersonaLora.user_id == user_id,
                PersonaLora.persona_id == persona_id,
            )
        )
        row = q.scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="LoRA not found for this persona")
        return row

    q = await db.execute(
        select(PersonaLora).where(
            PersonaLora.user_id == user_id,
            PersonaLora.persona_id == persona_id,
            PersonaLora.is_default.is_(True),
        )
    )
    return q.scalar_one_or_none()


@router.post("/generate-image", response_model=MediaJobOut)
async def generate_image(
    payload: MediaGenerateImageRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MediaJobOut:
    client_ip = request.client.host if request.client else "unknown"
    enforce_rate_limit(key=f"media:generate:{user.id}:{client_ip}", limit=30, window_seconds=60)

    await _assert_persona_access(db, user=user, persona_id=payload.persona_id)
    if payload.post_id:
        await _assert_post_access(db, post_id=payload.post_id, persona_id=payload.persona_id)

    byok_key = await _get_byok_fal_key(db, user.id)
    api_key, key_source = _select_fal_credential(byok_key)

    models = await resolve_fal_models(db, user.id)
    model = payload.model or models["image"]

    selected_lora = await _resolve_lora_for_persona(
        db,
        user_id=user.id,
        persona_id=payload.persona_id,
        persona_lora_id=payload.persona_lora_id,
    )

    effective_prompt = payload.prompt
    fal_payload: dict[str, object] = {
        "prompt": effective_prompt,
        "num_images": max(1, payload.num_images or 1),
    }
    if payload.width and payload.height:
        fal_payload["width"] = payload.width
        fal_payload["height"] = payload.height

    if selected_lora and "lora" in model:
        if selected_lora.trigger_word and selected_lora.trigger_word not in effective_prompt:
            effective_prompt = f"{selected_lora.trigger_word}, {effective_prompt}"
            fal_payload["prompt"] = effective_prompt
        fal_payload["loras"] = [{"path": selected_lora.external_lora_id, "scale": 1.0}]

    cost = _estimate_cost_credits(
        model=model,
        operation="image",
        key_source=key_source,
        width=payload.width,
        height=payload.height,
        num_images=payload.num_images,
    )

    if key_source == "platform":
        wallet = await ensure_wallet(db, user.id, tier=user.tier)
        if wallet.balance_credits < cost:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Insufficient credits. Required {cost}, available {wallet.balance_credits}.",
            )

    job = MediaGeneration(
        user_id=user.id,
        persona_id=payload.persona_id,
        post_id=payload.post_id,
        provider="fal",
        model=model,
        mode="image",
        status="pending",
        prompt=effective_prompt,
        input_payload=fal_payload,
        cost_credits=cost,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    background_tasks.add_task(
        _run_media_job,
        job_id=job.id,
        user_id=user.id,
        user_tier=user.tier,
        model=model,
        api_key=api_key,
        key_source=key_source,
        fal_payload=fal_payload,
        cost=cost,
        operation="image",
    )

    return _serialize_job(job)


@router.post("/edit-image", response_model=MediaJobOut)
async def edit_image(
    payload: MediaEditImageRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MediaJobOut:
    client_ip = request.client.host if request.client else "unknown"
    enforce_rate_limit(key=f"media:edit:{user.id}:{client_ip}", limit=30, window_seconds=60)

    await _assert_persona_access(db, user=user, persona_id=payload.persona_id)
    if payload.post_id:
        await _assert_post_access(db, post_id=payload.post_id, persona_id=payload.persona_id)

    source_q = await db.execute(select(MediaGeneration).where(MediaGeneration.id == payload.source_media_id, MediaGeneration.user_id == user.id))
    source = source_q.scalar_one_or_none()
    if source is None or not source.output_url:
        raise HTTPException(status_code=404, detail="Source media not found or missing output URL")

    byok_key = await _get_byok_fal_key(db, user.id)
    api_key, key_source = _select_fal_credential(byok_key)

    models = await resolve_fal_models(db, user.id)
    model = payload.model or models["edit"]

    fal_payload = {"prompt": payload.prompt, "image_url": source.output_url}
    cost = _estimate_cost_credits(model=model, operation="edit", key_source=key_source, source_payload=source.input_payload)

    if key_source == "platform":
        wallet = await ensure_wallet(db, user.id, tier=user.tier)
        if wallet.balance_credits < cost:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Insufficient credits. Required {cost}, available {wallet.balance_credits}.",
            )

    job = MediaGeneration(
        user_id=user.id,
        persona_id=payload.persona_id,
        post_id=payload.post_id,
        provider="fal",
        model=model,
        mode="edit",
        status="pending",
        prompt=payload.prompt,
        reference_asset_id=source.id,
        input_payload=fal_payload,
        cost_credits=cost,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    background_tasks.add_task(
        _run_media_job,
        job_id=job.id,
        user_id=user.id,
        user_tier=user.tier,
        model=model,
        api_key=api_key,
        key_source=key_source,
        fal_payload=fal_payload,
        cost=cost,
        operation="edit",
    )

    return _serialize_job(job)


@router.post("/upscale-image", response_model=MediaJobOut)
async def upscale_image(
    payload: MediaUpscaleImageRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MediaJobOut:
    client_ip = request.client.host if request.client else "unknown"
    enforce_rate_limit(key=f"media:upscale:{user.id}:{client_ip}", limit=30, window_seconds=60)

    await _assert_persona_access(db, user=user, persona_id=payload.persona_id)
    if payload.post_id:
        await _assert_post_access(db, post_id=payload.post_id, persona_id=payload.persona_id)

    source_q = await db.execute(select(MediaGeneration).where(MediaGeneration.id == payload.source_media_id, MediaGeneration.user_id == user.id))
    source = source_q.scalar_one_or_none()
    if source is None or not source.output_url:
        raise HTTPException(status_code=404, detail="Source media not found or missing output URL")

    byok_key = await _get_byok_fal_key(db, user.id)
    api_key, key_source = _select_fal_credential(byok_key)

    models = await resolve_fal_models(db, user.id)
    model = payload.model or models["upscale"]

    fal_payload = {
        "image_url": source.output_url,
        "upscale_factor": max(2, min(4, payload.upscale_factor or 2)),
    }
    cost = _estimate_cost_credits(
        model=model,
        operation="upscale",
        key_source=key_source,
        upscale_factor=payload.upscale_factor,
        source_payload=source.input_payload,
    )

    if key_source == "platform":
        wallet = await ensure_wallet(db, user.id, tier=user.tier)
        if wallet.balance_credits < cost:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Insufficient credits. Required {cost}, available {wallet.balance_credits}.",
            )

    job = MediaGeneration(
        user_id=user.id,
        persona_id=payload.persona_id,
        post_id=payload.post_id,
        provider="fal",
        model=model,
        mode="upscale",
        status="pending",
        prompt=f"Upscale image x{fal_payload['upscale_factor']}",
        reference_asset_id=source.id,
        input_payload=fal_payload,
        cost_credits=cost,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    background_tasks.add_task(
        _run_media_job,
        job_id=job.id,
        user_id=user.id,
        user_tier=user.tier,
        model=model,
        api_key=api_key,
        key_source=key_source,
        fal_payload=fal_payload,
        cost=cost,
        operation="upscale",
    )

    return _serialize_job(job)


@router.get("/lora/persona/{persona_id}", response_model=PersonaLoraListOut)
async def list_persona_loras(
    persona_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PersonaLoraListOut:
    await _assert_persona_access(db, user=user, persona_id=persona_id)
    q = await db.execute(
        select(PersonaLora)
        .where(PersonaLora.user_id == user.id, PersonaLora.persona_id == persona_id)
        .order_by(PersonaLora.is_default.desc(), PersonaLora.created_at.desc())
    )
    rows = list(q.scalars().all())
    return PersonaLoraListOut(loras=[_serialize_lora(row) for row in rows])


@router.post("/lora/attach", response_model=PersonaLoraOut)
async def attach_persona_lora(
    payload: PersonaLoraAttachRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PersonaLoraOut:
    await _assert_persona_access(db, user=user, persona_id=payload.persona_id)

    if payload.set_default:
        current_default_q = await db.execute(
            select(PersonaLora).where(
                PersonaLora.user_id == user.id,
                PersonaLora.persona_id == payload.persona_id,
                PersonaLora.is_default.is_(True),
            )
        )
        current_default = current_default_q.scalar_one_or_none()
        if current_default:
            current_default.is_default = False
            current_default.updated_at = dt.datetime.utcnow()

    existing_q = await db.execute(
        select(PersonaLora).where(
            PersonaLora.user_id == user.id,
            PersonaLora.persona_id == payload.persona_id,
            PersonaLora.name == payload.name.strip(),
        )
    )
    row = existing_q.scalar_one_or_none()
    if row is None:
        row = PersonaLora(
            user_id=user.id,
            persona_id=payload.persona_id,
            name=payload.name.strip(),
            provider="fal",
            external_lora_id=payload.external_lora_id.strip(),
            trigger_word=(payload.trigger_word.strip() if payload.trigger_word else None),
            status="ready",
            is_default=payload.set_default,
        )
        db.add(row)
    else:
        row.external_lora_id = payload.external_lora_id.strip()
        row.trigger_word = payload.trigger_word.strip() if payload.trigger_word else None
        row.is_default = payload.set_default
        row.status = "ready"
        row.updated_at = dt.datetime.utcnow()

    await db.commit()
    await db.refresh(row)
    return _serialize_lora(row)


@router.get("/jobs/{job_id}", response_model=MediaJobOut)
async def get_job(
    job_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MediaJobOut:
    q = await db.execute(select(MediaGeneration).where(MediaGeneration.id == job_id, MediaGeneration.user_id == user.id))
    job = q.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Media job not found")
    return _serialize_job(job)


@router.get("/persona/{persona_id}", response_model=MediaJobListOut)
async def list_persona_jobs(
    persona_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MediaJobListOut:
    await _assert_persona_access(db, user=user, persona_id=persona_id)
    q = await db.execute(
        select(MediaGeneration)
        .where(MediaGeneration.user_id == user.id, MediaGeneration.persona_id == persona_id)
        .order_by(MediaGeneration.created_at.desc())
        .limit(300)
    )
    jobs = list(q.scalars().all())
    return MediaJobListOut(jobs=[_serialize_job(job) for job in jobs])
