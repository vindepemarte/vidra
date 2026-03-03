from __future__ import annotations

import asyncio
import datetime as dt
import json
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from vidra_api.config import settings
from vidra_api.database import get_db
from vidra_api.deps import get_current_user
from vidra_api.models import Persona, PersonaProfile, User
from vidra_api.plans import normalize_tier
from vidra_api.schemas import StudioActionSuggestionOut, StudioMessageOut, StudioMessageRequest
from vidra_api.services.model_preferences import resolve_openrouter_model

router = APIRouter(prefix="/studio", tags=["studio"])


def _profile_state(profile: PersonaProfile | None) -> str:
    if profile is None:
        return "empty"

    state = (profile.generation_status or "").strip().lower()
    if state in {"empty", "queued", "generating", "ready", "failed"}:
        return state

    has_content = bool((profile.bio or "").strip() or (profile.prompt_blueprint or "").strip())
    return "ready" if has_content else "empty"


def _fallback_reply(*, persona: Persona | None, profile_state: str, tier: str, message: str) -> str:
    if persona is None:
        return (
            "Start by creating a persona project first. "
            "Then build profile, generate month calendar, and produce media in sequence."
        )

    if profile_state in {"empty", "queued", "generating", "failed"}:
        return (
            f"{persona.name} profile is {profile_state.upper()}. "
            "Recommended next step: run profile build (AUTO) and wait for READY before calendar/media."
        )

    if re.search(r"\b(calendar|month|plan|schedule)\b", message, flags=re.IGNORECASE):
        return (
            f"Profile is READY for {persona.name}. "
            "Generate the current month calendar now, then select a post and produce media."
        )

    if re.search(r"\b(image|photo|media|render|fal)\b", message, flags=re.IGNORECASE):
        return (
            f"Media flow is unlocked for {persona.name}. "
            "Pick a calendar post, generate hero image first, then edit/upscale variants."
        )

    tier_hint = "LLM-enabled" if tier in {"pro", "max"} and settings.openrouter_api_key else "offline-first"
    return (
        f"{persona.name} workspace is active ({tier_hint}). "
        "You can ask me to build profile, generate calendar, or generate media from selected posts."
    )


def _build_suggestions(
    *,
    message: str,
    persona: Persona | None,
    profile_state: str,
) -> list[StudioActionSuggestionOut]:
    text = message.lower()
    now = dt.datetime.now(dt.timezone.utc)
    suggestions: list[StudioActionSuggestionOut] = []

    def push(action: str, label: str, payload: dict | None = None) -> None:
        if any(item.action == action for item in suggestions):
            return
        suggestions.append(
            StudioActionSuggestionOut(
                action=action,
                label=label,
                payload=payload or {},
            )
        )

    if persona is None:
        push("create_persona", "Create Persona")
        return suggestions

    push("select_persona", f"Open {persona.name}", {"persona_id": str(persona.id)})

    if profile_state in {"empty", "failed"}:
        push("build_profile_auto", "Build Profile (Auto)", {"persona_id": str(persona.id), "mode": "auto"})
        push("build_profile_llm", "Force LLM Profile", {"persona_id": str(persona.id), "mode": "llm"})
        push("build_profile_offline", "Force Offline Profile", {"persona_id": str(persona.id), "mode": "offline"})
        return suggestions

    if profile_state in {"queued", "generating"}:
        push("refresh_profile_status", "Refresh Profile Status", {"persona_id": str(persona.id)})
        return suggestions

    if any(k in text for k in ["calendar", "month", "plan", "schedule"]):
        push(
            "generate_calendar",
            "Generate Current Month Calendar",
            {"persona_id": str(persona.id), "month": now.month, "year": now.year, "force_regenerate": True},
        )
    if any(k in text for k in ["image", "media", "render", "photo", "fal"]):
        push("generate_image_from_post", "Generate Image From Selected Post", {"persona_id": str(persona.id)})
    if any(k in text for k in ["preview", "mockup", "instagram", "feed"]):
        push("open_preview", "Open Preview View")
    if any(k in text for k in ["data", "dna", "backstory", "world", "prompt"]):
        push("open_data", "Open Data View")

    if not suggestions or len(suggestions) < 2:
        push(
            "generate_calendar",
            "Generate Current Month Calendar",
            {"persona_id": str(persona.id), "month": now.month, "year": now.year, "force_regenerate": True},
        )
        push("generate_image_from_post", "Generate Image From Selected Post", {"persona_id": str(persona.id)})

    return suggestions[:4]


def _persona_snapshot(persona: Persona | None, profile: PersonaProfile | None) -> str:
    if persona is None:
        return "No persona selected."

    profile_mode = "N/A"
    if profile is not None:
        profile_mode = profile.generated_mode or profile.generation_effective_mode or "unknown"

    return (
        f"Persona: {persona.name} (@{persona.handle}), {persona.age}y, {persona.gender}, "
        f"{persona.city}, niche={persona.niche}, vibe={persona.vibe}, profile_mode={profile_mode}"
    )


def _compose_prompt(payload: StudioMessageRequest, persona: Persona | None, profile: PersonaProfile | None, tier: str) -> str:
    history = payload.history[-8:]
    history_text = "\n".join([f"{msg.role.upper()}: {msg.content}" for msg in history])
    profile_state = _profile_state(profile)
    snapshot = _persona_snapshot(persona, profile)

    return (
        "Workspace context:\n"
        f"- Tier: {tier}\n"
        f"- Profile state: {profile_state}\n"
        f"- {snapshot}\n"
        "- Product pipeline: create persona -> build profile -> generate calendar -> generate media.\n\n"
        f"Recent chat:\n{history_text or '(none)'}\n\n"
        f"User message:\n{payload.message}\n\n"
        "Respond with concise, practical guidance (max 5 short lines), focused on next action."
    )


async def _llm_reply(*, model: str, prompt: str) -> str:
    def _call() -> str:
        from life.ai.llm import LLM

        llm = LLM(model=model)
        return llm.chat(
            prompt=prompt,
            system=(
                "You are Vidra Studio Copilot (Vidra by Lexa AI). "
                "Be direct, action-oriented, and product-specific. "
                "Never mention hidden implementation details."
            ),
            temperature=0.35,
            max_tokens=420,
        ).strip()

    return await asyncio.to_thread(_call)


@router.post("/message", response_model=StudioMessageOut)
async def studio_message(
    payload: StudioMessageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StudioMessageOut:
    persona: Persona | None = None
    profile: PersonaProfile | None = None

    if payload.persona_id:
        q = await db.execute(
            select(Persona).options(selectinload(Persona.profile)).where(Persona.id == payload.persona_id, Persona.user_id == user.id)
        )
        persona = q.scalar_one_or_none()
        if persona is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found")
        profile = persona.profile

    tier = normalize_tier(user.tier)
    state = _profile_state(profile)
    suggestions = _build_suggestions(message=payload.message, persona=persona, profile_state=state)

    if tier in {"pro", "max"} and settings.openrouter_api_key:
        selected_model = await resolve_openrouter_model(db, user.id)
        prompt = _compose_prompt(payload, persona, profile, tier)
        try:
            llm_text = await _llm_reply(model=selected_model, prompt=prompt)
            if llm_text:
                return StudioMessageOut(reply=llm_text, model_used=selected_model, suggestions=suggestions)
        except Exception:
            # Controlled fallback to deterministic assistant, no hidden errors leaked.
            pass

    reply = _fallback_reply(persona=persona, profile_state=state, tier=tier, message=payload.message)
    return StudioMessageOut(reply=reply, model_used=None, suggestions=suggestions)
