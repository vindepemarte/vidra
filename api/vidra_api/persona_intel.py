from __future__ import annotations
from dataclasses import dataclass
from typing import Any

from vidra_api.models import Persona


@dataclass
class PersonaProfileBundle:
    bio: str
    backstory_md: str
    future_plans_md: str
    strategy_md: str
    prompt_blueprint: str
    physical: dict[str, Any]
    wardrobe: dict[str, list[dict[str, Any]]]
    beauty: dict[str, list[dict[str, Any]]]
    world: dict[str, Any]
    carousel_rules: dict[str, str]
    generated_mode: str


def _persona_dict(persona: Persona) -> dict[str, Any]:
    return {
        "name": persona.name,
        "handle": persona.handle,
        "age": persona.age,
        "city": persona.city,
        "niche": persona.niche,
        "vibe": persona.vibe,
        "gender": "female" if persona.template.lower() != "male" else "male",
        "income_vibe": "upper-middle class with occasional luxury",
    }


def _offline_wardrobe(persona: Persona) -> dict[str, list[dict[str, Any]]]:
    niche = persona.niche
    return {
        "tops": [
            {
                "id": "top_001",
                "name": "Structured monochrome top",
                "prompt_snippet": f"structured monochrome top, clean silhouette, {niche} vibe",
                "occasion": ["casual", "content", "day"],
            },
            {
                "id": "top_002",
                "name": "Soft knit statement top",
                "prompt_snippet": "soft knit top with tailored fit and premium texture",
                "occasion": ["cozy", "indoor", "lifestyle"],
            },
        ],
        "bottoms": [
            {
                "id": "bottom_001",
                "name": "High-waist tailored trousers",
                "prompt_snippet": "high-waist tailored trousers, elegant street style",
                "occasion": ["business", "urban", "content"],
            },
            {
                "id": "bottom_002",
                "name": "Clean denim silhouette",
                "prompt_snippet": "premium clean denim, flattering fit, minimal folds",
                "occasion": ["casual", "weekend", "city"],
            },
        ],
        "shoes": [
            {
                "id": "shoes_001",
                "name": "Minimal sneakers",
                "prompt_snippet": "minimal sneakers with clean white base and subtle metallic details",
                "occasion": ["casual", "street", "travel"],
            },
            {
                "id": "shoes_002",
                "name": "Evening heels",
                "prompt_snippet": "sleek evening heels with elegant thin straps",
                "occasion": ["night_out", "formal", "date_night"],
            },
        ],
    }


def build_offline_profile(persona: Persona) -> PersonaProfileBundle:
    wardrobe = _offline_wardrobe(persona)

    bio = (
        f"{persona.name} | {persona.city}. Building a {persona.niche} digital brand with a "
        f"{persona.vibe.lower()} identity and consistent storytelling."
    )

    backstory = (
        f"# {persona.name} — Backstory\n\n"
        f"{persona.name} grows up with strong creative instincts and turns everyday moments in {persona.city} "
        f"into visual stories. The personal brand is built around consistent style, intentional routines, and "
        f"a clear niche focus on {persona.niche}."
    )

    future = (
        f"# {persona.name} — Future Plans\n\n"
        f"Short term: grow a reliable posting system and strengthen audience retention.\n"
        f"Mid term: launch collaborations aligned with {persona.niche}.\n"
        f"Long term: evolve into a premium creator brand with a repeatable monetization strategy."
    )

    strategy = (
        f"# {persona.name} — Strategy\n\n"
        f"Content pillars: lifestyle scenes, niche authority, conversion hooks, behind-the-scenes trust.\n"
        f"Voice: concise, confident, intimate.\n"
        f"Cadence: daily execution with weekly storyline continuity."
    )

    physical = {
        "face": "symmetrical facial structure, expressive eyes, clean skin texture, editorial-ready look",
        "hair_default": "natural movement with polished finish, medium length and camera-friendly volume",
        "body": "balanced proportions, upright posture, confident body language",
        "skin": "smooth complexion with subtle realistic texture and natural highlights",
    }

    beauty = {
        "makeup": [
            {
                "id": "makeup_001",
                "name": "Soft daily glam",
                "prompt_snippet": "soft skin finish, subtle liner, natural blush, hydrated lips",
            }
        ],
        "hairstyles": [
            {
                "id": "hair_001",
                "name": "Natural volume",
                "prompt_snippet": "natural flowing hair with clean center part and soft volume",
            }
        ],
        "nails": [
            {
                "id": "nails_001",
                "name": "Clean nude manicure",
                "prompt_snippet": "short almond nude manicure, glossy finish",
            }
        ],
    }

    world = {
        "events": [
            {
                "name": f"{persona.city} weekend creator meetups",
                "type": "social",
                "content_opportunity": "street clips, mini vlogs, networking stories",
            },
            {
                "name": f"{persona.city} niche pop-up experiences",
                "type": "cultural",
                "content_opportunity": "outfit reels, carousel storytelling, location mood posts",
            },
        ],
        "devices": [
            {
                "type": "phone",
                "name": "flagship smartphone",
                "prompt_snippet": "holding modern smartphone with transparent case",
            }
        ],
    }

    prompt_blueprint = (
        f"{persona.name}, {persona.age} years old, {persona.niche} creator from {persona.city}, "
        f"{persona.vibe.lower()} energy, consistent facial identity, photorealistic, detailed skin texture"
    )

    carousel_rules = {
        "slide_1": "Hero shot: establish scene, outfit, mood, and direct eye-contact or dominant pose.",
        "slide_2": "Edit from slide 1: preserve same identity/outfit, change camera angle and action.",
        "slide_3": "Edit from slide 2: preserve continuity, add narrative payoff or close detail.",
    }

    return PersonaProfileBundle(
        bio=bio,
        backstory_md=backstory,
        future_plans_md=future,
        strategy_md=strategy,
        prompt_blueprint=prompt_blueprint,
        physical=physical,
        wardrobe=wardrobe,
        beauty=beauty,
        world=world,
        carousel_rules=carousel_rules,
        generated_mode="offline",
    )


def build_llm_profile(persona: Persona) -> PersonaProfileBundle:
    from life.ai.llm import LLM
    from life.ai.search import BraveSearch
    from life.generators.appearance import (
        generate_accessories,
        generate_hairstyles,
        generate_makeup_styles,
        generate_nail_styles,
        generate_physical,
        generate_shoes,
        generate_wardrobe_category,
    )
    from life.generators.backstory import generate_childhood, generate_future_plans, generate_life_story
    from life.generators.world import generate_apartment, generate_devices

    p = _persona_dict(persona)
    llm = LLM()

    # Backstory arc
    childhood = generate_childhood(llm, p)
    life_story = generate_life_story(llm, p, childhood)
    future = generate_future_plans(llm, p, life_story)
    backstory_md = f"# Childhood\n\n{childhood}\n\n# Life Story\n\n{life_story}"
    future_md = f"# Future Plans\n\n{future}"

    # Appearance DNA
    physical = generate_physical(llm, p)
    main_categories = ["tops", "bottoms", "dresses"] if p["gender"] == "female" else ["shirts", "trousers", "suits"]
    wardrobe: dict[str, list[dict[str, Any]]] = {}
    for cat in main_categories:
        wardrobe[cat] = generate_wardrobe_category(llm, p, cat, count=6)
    wardrobe["shoes"] = generate_shoes(llm, p)
    wardrobe["accessories"] = generate_accessories(llm, p)

    beauty = {
        "makeup": generate_makeup_styles(llm, p),
        "hairstyles": generate_hairstyles(llm, p, physical),
        "nails": generate_nail_styles(llm, p),
    }

    # World + events
    apartment = generate_apartment(llm, p)
    devices = generate_devices(llm, p)

    try:
        search = BraveSearch()
        raw_events = search.discover_events(p["city"], "March", "2026") + search.discover_events(p["city"], "April", "2026")
        results_text = "\n".join([f"- {r.get('title', '')}: {r.get('description', '')}" for r in raw_events[:20]])
        events = llm.generate_list(
            f"""
Extract realistic upcoming creator-relevant events from this data for {p['city']}.
Return JSON list items with keys: name, type, date_range, location, description, content_opportunity, outfit_vibe.

Search results:
{results_text}
"""
        )
    except Exception:
        events = llm.generate_list(
            f"""
Generate 12 realistic upcoming events in {p['city']} for a creator in {p['niche']}.
Return JSON list items with keys: name, type, date_range, location, description, content_opportunity, outfit_vibe.
"""
        )

    world = {
        "apartment": apartment,
        "devices": devices,
        "events": events,
    }

    strategy = llm.generate_markdown(
        f"""
Create a concise but high-impact content strategy for:
Name: {p['name']}
City: {p['city']}
Niche: {p['niche']}
Vibe: {p['vibe']}

Cover: pillars, positioning, voice, hooks, CTA styles, monetization angles.
""",
        max_tokens=1800,
    )

    bio = llm.generate_markdown(
        f"Write a premium Instagram bio (max 150 chars + line breaks) for {p['name']} from {p['city']} in {p['niche']}."
    ).strip()

    prompt_blueprint = (
        f"{p['name']}, {p['age']} years old, {p['niche']} creator from {p['city']}, "
        f"{p['vibe']} vibe, face identity locked, details: {physical.get('face', '')}, "
        f"skin: {physical.get('skin', '')}, hair: {physical.get('hair_default', '')}, photorealistic"
    )

    carousel_rules = {
        "slide_1": "Hero frame with full context, outfit readability, and emotional anchor.",
        "slide_2": "Edit from slide 1 preserving identity/outfit; change angle and action for progression.",
        "slide_3": "Edit from slide 2 preserving continuity; add climax detail or narrative resolution.",
    }

    return PersonaProfileBundle(
        bio=bio,
        backstory_md=backstory_md,
        future_plans_md=future_md,
        strategy_md=strategy,
        prompt_blueprint=prompt_blueprint,
        physical=physical,
        wardrobe=wardrobe,
        beauty=beauty,
        world=world,
        carousel_rules=carousel_rules,
        generated_mode="llm",
    )


def pick_style_snippet(profile_wardrobe: dict[str, Any], *, scene_type: str, day_index: int, post_number: int) -> str:
    candidate_lists: list[list[dict[str, Any]]] = []
    for key in ["tops", "shirts", "dresses", "bottoms", "trousers", "suits", "shoes", "accessories"]:
        values = profile_wardrobe.get(key)
        if isinstance(values, list) and values:
            candidate_lists.append(values)

    if not candidate_lists:
        return "clean creator outfit with premium styling"

    selected_list = candidate_lists[(day_index + post_number + len(scene_type)) % len(candidate_lists)]
    item = selected_list[(day_index + post_number) % len(selected_list)]
    snippet = item.get("prompt_snippet") if isinstance(item, dict) else None
    return snippet if isinstance(snippet, str) and snippet.strip() else "cohesive outfit styling"


def build_carousel_slides(base_prompt: str, profile_prompt_blueprint: str, carousel_rules: dict[str, str], *, scene_type: str) -> list[dict[str, str | int | None]]:
    anchor = profile_prompt_blueprint.strip()
    prompt_1 = (
        f"{anchor}. {base_prompt}. {carousel_rules.get('slide_1', '')} Scene type: {scene_type}."
        " Maintain same identity consistency and realistic skin texture."
    ).strip()

    instruction_2 = carousel_rules.get("slide_2", "Edit from slide 1 preserving same identity and outfit, with new action.")
    prompt_2 = (
        f"EDIT-IMAGE instruction: use slide 1 as reference. {instruction_2} "
        "Subject turns slightly left, changes hand gesture, keeps same outfit and location context."
    )

    instruction_3 = carousel_rules.get("slide_3", "Edit from slide 2 preserving continuity, add narrative payoff.")
    prompt_3 = (
        f"EDIT-IMAGE instruction: use slide 2 as reference. {instruction_3} "
        "Subject expression evolves naturally, cinematic continuity preserved."
    )

    return [
        {"slide_number": 1, "prompt": prompt_1, "edit_instruction": None},
        {"slide_number": 2, "prompt": prompt_2, "edit_instruction": instruction_2},
        {"slide_number": 3, "prompt": prompt_3, "edit_instruction": instruction_3},
    ]
