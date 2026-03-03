from __future__ import annotations
import datetime as dt
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


def _persona_gender(persona: Persona) -> str:
    gender = (persona.gender or "").strip().lower()
    if gender in {"male", "female"}:
        return gender
    legacy_template = (persona.template or "").strip().lower()
    return "male" if legacy_template == "male" else "female"


def _persona_dict(persona: Persona) -> dict[str, Any]:
    return {
        "name": persona.name,
        "handle": persona.handle,
        "age": persona.age,
        "city": persona.city,
        "niche": persona.niche,
        "vibe": persona.vibe,
        "gender": _persona_gender(persona),
        "income_vibe": "upper-middle class with occasional luxury",
    }


def _offline_wardrobe(persona: Persona) -> dict[str, list[dict[str, Any]]]:
    niche = persona.niche
    gender = _persona_gender(persona)
    if gender == "male":
        return {
            "shirts": [
                {
                    "id": "shirt_001",
                    "name": "Tailored oxford shirt",
                    "prompt_snippet": f"tailored oxford shirt, clean collar, premium {niche} aesthetic",
                    "occasion": ["casual", "content", "day"],
                },
                {
                    "id": "shirt_002",
                    "name": "Merino knit polo",
                    "prompt_snippet": "fine-gauge merino knit polo, fitted silhouette, polished texture",
                    "occasion": ["business", "urban", "dinner"],
                },
            ],
            "trousers": [
                {
                    "id": "trousers_001",
                    "name": "Tapered wool trousers",
                    "prompt_snippet": "tapered wool trousers, soft drape, modern tailored fit",
                    "occasion": ["business", "city", "content"],
                },
                {
                    "id": "trousers_002",
                    "name": "Dark selvedge denim",
                    "prompt_snippet": "dark selvedge denim, minimal wash, premium casual structure",
                    "occasion": ["casual", "weekend", "street"],
                },
            ],
            "suits": [
                {
                    "id": "suit_001",
                    "name": "Midnight structured suit",
                    "prompt_snippet": "midnight structured suit, modern lapel, editorial fit",
                    "occasion": ["formal", "event", "luxury"],
                }
            ],
            "shoes": [
                {
                    "id": "shoes_001",
                    "name": "Minimal leather sneakers",
                    "prompt_snippet": "minimal leather sneakers, clean white sole, discreet branding",
                    "occasion": ["casual", "travel", "street"],
                },
                {
                    "id": "shoes_002",
                    "name": "Polished derby shoes",
                    "prompt_snippet": "polished derby shoes in deep brown leather, premium finish",
                    "occasion": ["formal", "business", "event"],
                },
            ],
            "accessories": [
                {
                    "id": "accessories_001",
                    "name": "Steel watch",
                    "prompt_snippet": "minimal steel watch with dark dial, refined masculine styling",
                    "occasion": ["daily", "business", "evening"],
                }
            ],
        }

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
        "dresses": [
            {
                "id": "dress_001",
                "name": "Slip midi dress",
                "prompt_snippet": "silk slip midi dress, elegant movement, editorial styling",
                "occasion": ["date_night", "event", "lifestyle"],
            }
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
                "name": "Block-heel pumps",
                "prompt_snippet": "block-heel pumps with elegant straps and polished finish",
                "occasion": ["night_out", "formal", "date_night"],
            },
        ],
        "accessories": [
            {
                "id": "accessories_001",
                "name": "Signature jewelry set",
                "prompt_snippet": "signature layered jewelry, subtle luxury accents, cohesive styling",
                "occasion": ["daily", "event", "editorial"],
            }
        ],
    }


def build_offline_profile(persona: Persona) -> PersonaProfileBundle:
    gender = _persona_gender(persona)
    wardrobe = _offline_wardrobe(persona)

    bio = (
        f"{persona.name} · {persona.city}. {persona.niche} creator with a {persona.vibe.lower()} tone. "
        "Publishing consistent story-driven content with signature visual identity."
    )

    backstory = (
        f"# {persona.name} — Backstory\n\n"
        f"{persona.name}, a {persona.age}-year-old creator from {persona.city}, built their online voice by translating "
        f"everyday city moments into cinematic micro-stories. The niche focus is {persona.niche}, with a {persona.vibe.lower()} "
        "creative signature that blends aspirational lifestyle with practical value.\n\n"
        "The origin arc starts from small, routine documentation: cafe notes, street textures, and behind-the-scenes rituals. "
        "Consistency, not virality, became the growth lever. Over time, this evolved into a recognizable personal brand system."
    )

    future = (
        f"# {persona.name} — Future Plans\n\n"
        f"## Short Term (Next 90 Days)\n"
        f"- Lock a weekly publishing rhythm around {persona.niche} educational + aspirational posts.\n"
        "- Improve hooks, retention loops, and story continuity across reels and carousel formats.\n\n"
        f"## Mid Term (6-12 Months)\n"
        f"- Build recurring collaborations with brands aligned to {persona.niche} values.\n"
        "- Launch one lightweight digital asset for monetization (guide, mini-course, or template).\n\n"
        "## Long Term (1-3 Years)\n"
        "- Evolve into a premium creator business with stable sponsorship and owned revenue streams."
    )

    strategy = (
        f"# {persona.name} — Strategy\n\n"
        f"- **Positioning:** {persona.niche} creator from {persona.city} with a {persona.vibe.lower()} POV.\n"
        "- **Core Pillars:** authority posts, lifestyle proof, BTS trust moments, conversion hooks.\n"
        "- **Cadence:** daily short-form + weekly narrative arc + monthly campaign objective.\n"
        "- **CTA Pattern:** save/share/discuss/DM mix to balance reach and conversion."
    )

    physical = {
        "identity_lock": f"{persona.name}, {persona.age}, {gender}, from {persona.city}",
        "face": "symmetrical facial structure, expressive eyes, editorial-ready details",
        "hair_default": "camera-friendly hair texture with polished shape and natural movement",
        "body": "balanced proportions, upright posture, confident body language",
        "skin": "realistic skin texture with natural highlights and soft detail retention",
        "signature_expression": "calm confidence with subtle smile; poised and intentional",
    }

    if gender == "female":
        beauty: dict[str, list[dict[str, Any]]] = {
            "makeup": [
                {
                    "id": "makeup_001",
                    "name": "Soft daily glam",
                    "prompt_snippet": "soft skin finish, subtle liner, natural blush, hydrated lips",
                },
                {
                    "id": "makeup_002",
                    "name": "Editorial evening look",
                    "prompt_snippet": "defined eyeliner, satin skin, warm contour, glossy nude lips",
                },
            ],
            "hairstyles": [
                {
                    "id": "hair_001",
                    "name": "Natural volume",
                    "prompt_snippet": "natural flowing hair with clean center part and soft volume",
                },
                {
                    "id": "hair_002",
                    "name": "Sleek low bun",
                    "prompt_snippet": "sleek low bun with polished edges and clean face framing",
                },
            ],
            "nails": [
                {
                    "id": "nails_001",
                    "name": "Clean nude manicure",
                    "prompt_snippet": "short almond nude manicure, glossy finish",
                },
                {
                    "id": "nails_002",
                    "name": "Statement chrome set",
                    "prompt_snippet": "medium chrome manicure with precise reflective finish",
                },
            ],
            "skincare": [
                {
                    "id": "skincare_001",
                    "name": "Hydration prep",
                    "prompt_snippet": "hydrated skin prep with natural dewy highlights, no harsh shine",
                }
            ],
        }
    else:
        beauty = {
            "hairstyles": [
                {
                    "id": "hair_001",
                    "name": "Textured modern crop",
                    "prompt_snippet": "textured modern crop with natural matte volume and sharp line-up",
                },
                {
                    "id": "hair_002",
                    "name": "Classic side part",
                    "prompt_snippet": "classic side part with clean fade and controlled top movement",
                },
            ],
            "grooming": [
                {
                    "id": "grooming_001",
                    "name": "Clean shave",
                    "prompt_snippet": "clean shave with precise neckline and even skin tone",
                },
                {
                    "id": "grooming_002",
                    "name": "Short boxed beard",
                    "prompt_snippet": "short boxed beard, sharp cheek line, tidy mustache blend",
                },
            ],
            "skincare": [
                {
                    "id": "skincare_001",
                    "name": "Matte daily routine",
                    "prompt_snippet": "balanced matte complexion, healthy skin detail, no heavy shine",
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
            {
                "name": f"{persona.city} seasonal premium venues",
                "type": "lifestyle",
                "content_opportunity": "high-intent product placement and premium audience hooks",
            },
        ],
        "devices": [
            {
                "type": "phone",
                "name": "flagship smartphone",
                "prompt_snippet": "holding modern smartphone with transparent case",
            },
            {
                "type": "camera",
                "name": "mirrorless camera",
                "prompt_snippet": "using a compact mirrorless camera for behind-the-scenes creator shots",
            }
        ],
    }

    prompt_blueprint = (
        f"{persona.name}, {persona.age} years old, {gender} {persona.niche} creator from {persona.city}, "
        f"{persona.vibe.lower()} energy, identity lock enabled, consistent face geometry, "
        "photorealistic, natural skin texture, premium editorial framing, coherent wardrobe continuity"
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
    now = dt.datetime.now(dt.timezone.utc)
    current_year = now.year
    current_month = now.month
    month_names = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ]
    # Next 8 months window (wrapping to next year if needed)
    months_window: list[tuple[str, int]] = []
    for i in range(8):
        idx = (current_month - 1 + i) % 12
        year_offset = (current_month - 1 + i) // 12
        months_window.append((month_names[idx], current_year + year_offset))
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

    if p["gender"] == "female":
        beauty = {
            "makeup": generate_makeup_styles(llm, p),
            "hairstyles": generate_hairstyles(llm, p, physical),
            "nails": generate_nail_styles(llm, p),
        }
    else:
        try:
            grooming = llm.generate_list(
                f"""
Generate 8 concise male grooming prompt objects for {p['name']} from {p['city']}.
Return JSON list with keys: id, name, prompt_snippet.
Focus on beard options, clean shave variants, and facial grooming details.
"""
            )
        except Exception:
            grooming = [
                {"id": "grooming_001", "name": "Clean shave", "prompt_snippet": "clean shave, precise neckline, balanced skin texture"},
                {"id": "grooming_002", "name": "Short boxed beard", "prompt_snippet": "short boxed beard with sharp cheek line and tidy mustache"},
            ]

        try:
            skincare = llm.generate_list(
                f"""
Generate 6 concise male skincare prompt objects for {p['name']}.
Return JSON list with keys: id, name, prompt_snippet.
"""
            )
        except Exception:
            skincare = [
                {"id": "skincare_001", "name": "Daily matte prep", "prompt_snippet": "matte balanced skin prep, realistic pores, no heavy shine"}
            ]

        beauty = {
            "hairstyles": generate_hairstyles(llm, p, physical),
            "grooming": grooming,
            "skincare": skincare,
        }

    # World + events
    apartment = generate_apartment(llm, p)
    devices = generate_devices(llm, p)

    try:
        search = BraveSearch()
        raw_events: list[dict] = []
        for month_name, year_val in months_window:
            raw_events.extend(search.discover_events(p["city"], month_name, str(year_val)))
        results_text = "\n".join([f"- {r.get('title', '')}: {r.get('description', '')}" for r in raw_events[:30]])
        events = llm.generate_list(
            f"""
Extract realistic upcoming creator-relevant events from this data for {p['city']}.
Time window: from {month_names[current_month-1]} {current_year} through {month_names[(current_month-1+7)%12]} {current_year + ((current_month-1+7)//12)}.
Exclude any event dated before {current_year}.
Return JSON list items with keys: name, type, date_range, location, description, content_opportunity, outfit_vibe.

Search results:
{results_text}
"""
        )
    except Exception:
        events = llm.generate_list(
            f"""
Generate 12 realistic upcoming events in {p['city']} for a creator in {p['niche']}, between {month_names[current_month-1]} {current_year} and {month_names[current_month-1]} {current_year + 1}.
Return JSON list items with keys: name, type, date_range, location, description, content_opportunity, outfit_vibe.
Do NOT output any event with a year earlier than {current_year}.
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
        f"{p['name']}, {p['age']} years old, {p['gender']} {p['niche']} creator from {p['city']}, "
        f"{p['vibe']} vibe, face identity locked, details: {physical.get('face', '')}, "
        f"skin: {physical.get('skin', '')}, hair: {physical.get('hair_default', '')}, "
        "UGC-first, shot on smartphone, natural ambient light, slight grain, authentic social-feed look"
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
