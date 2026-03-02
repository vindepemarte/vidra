from __future__ import annotations

import datetime as dt
from uuid import UUID

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from vidra_api.config import settings
from vidra_api.database import SessionLocal, get_db
from vidra_api.deps import get_current_user
from vidra_api.models import ApiKeyStore, CalendarDay, CalendarMonth, MediaGeneration, Persona, Post, User
from vidra_api.schemas import MediaEditImageRequest, MediaGenerateImageRequest, MediaJobListOut, MediaJobOut
from vidra_api.services.wallet import apply_wallet_delta, ensure_wallet
from vidra_api.utils.limiter import enforce_rate_limit
from vidra_api.utils.security import decrypt_secret

router = APIRouter(prefix="/media", tags=["media"])


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


async def _call_fal(model: str, api_key: str, payload: dict) -> dict:
    url = f"https://fal.run/{model}"
    headers = {
        "Authorization": f"Key {api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=60) as client:
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
                await apply_wallet_delta(
                    db,
                    user_id=user_id,
                    tier=user_tier,
                    delta=-cost,
                    reason="fal image generation" if job.mode == "image" else "fal image edit",
                    source_type="media_generation",
                    source_id=str(job.id),
                )

            await db.commit()
        except Exception as exc:  # noqa: BLE001
            job.status = "failed"
            job.error_message = str(exc)
            job.updated_at = dt.datetime.utcnow()
            await db.commit()


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

    model = payload.model or settings.fal_image_model
    cost = settings.fal_image_cost_credits if key_source == "platform" else 0

    if key_source == "platform":
        wallet = await ensure_wallet(db, user.id, tier=user.tier)
        if wallet.balance_credits < cost:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Insufficient credits. Required {cost}, available {wallet.balance_credits}.",
            )

    fal_payload = {"prompt": payload.prompt}
    job = MediaGeneration(
        user_id=user.id,
        persona_id=payload.persona_id,
        post_id=payload.post_id,
        provider="fal",
        model=model,
        mode="image",
        status="pending",
        prompt=payload.prompt,
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

    model = payload.model or settings.fal_edit_model
    cost = settings.fal_edit_cost_credits if key_source == "platform" else 0

    if key_source == "platform":
        wallet = await ensure_wallet(db, user.id, tier=user.tier)
        if wallet.balance_credits < cost:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Insufficient credits. Required {cost}, available {wallet.balance_credits}.",
            )

    fal_payload = {"prompt": payload.prompt, "image_url": source.output_url}
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
    )

    return _serialize_job(job)


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
        .limit(200)
    )
    jobs = list(q.scalars().all())
    return MediaJobListOut(jobs=[_serialize_job(job) for job in jobs])
