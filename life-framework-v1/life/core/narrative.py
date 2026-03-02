"""Narrative arc engine — multi-week story progressions for content continuity."""

from __future__ import annotations

import random
from typing import Any

from life.ai.llm import LLM

ARC_SYSTEM = """You are a master storyteller designing realistic narrative arcs for AI influencers.
Each arc should span 3-7 days and create a mini-story that followers can follow.
The arcs should feel natural, not forced — like real life unfolding on social media."""


# Pre-built arc templates by niche
ARC_TEMPLATES = {
    "fashion": [
        "Preparing for a fashion event",
        "Shopping spree and haul reveal",
        "Styling challenge — one piece, five ways",
        "Apartment redecorating project",
        "Weekend trip to a nearby city",
        "Launching a personal project",
        "Fitness routine week",
        "Trying a new cuisine/cooking adventure",
        "Vintage shopping and thrift finds",
        "Behind the scenes of a photoshoot",
        "Spring wardrobe refresh",
        "Coffee shop hopping guide",
    ],
    "wellness": [
        "7-day wellness challenge",
        "New skincare routine journey",
        "Meditation retreat weekend",
        "Meal prep and healthy eating week",
        "Sunrise yoga series",
        "Self-care Sunday rituals",
        "Digital detox weekend",
        "Exploring a farmers market",
        "Home spa transformation",
        "Journaling and reflection week",
    ],
    "gentleman": [
        "Building the perfect capsule wardrobe",
        "Mastering a new skill",
        "Weekend of culture — museums and dining",
        "Fitness transformation week",
        "Grooming routine overhaul",
        "Hosting a dinner party",
        "Business trip to a major city",
        "Reading challenge — book a week",
        "Learning to cook a signature dish",
        "Charity event preparation",
    ],
}


def generate_monthly_arcs(
    llm: LLM, persona: dict, month: str, year: str, events: list[dict] = None
) -> list[dict[str, Any]]:
    """Generate narrative arcs for a full month.

    Returns a list of arcs with date ranges and daily themes.
    """
    niche = persona.get("niche", "lifestyle").lower()

    # Determine template category
    if "fashion" in niche or "luxury" in niche:
        templates = ARC_TEMPLATES["fashion"]
    elif "wellness" in niche or "beauty" in niche or "mindful" in niche:
        templates = ARC_TEMPLATES["wellness"]
    elif "gentleman" in niche or "masculine" in niche or "self-improvement" in niche:
        templates = ARC_TEMPLATES["gentleman"]
    else:
        templates = ARC_TEMPLATES["fashion"] + ARC_TEMPLATES["wellness"]

    events_context = ""
    if events:
        events_context = "\n".join(
            f"- {e['name']} ({e.get('date_range', 'TBD')}): {e.get('description', '')}"
            for e in events[:8]
        )

    prompt = f"""Design a full month of narrative arcs for this AI influencer for {month} {year}:

Name: {persona['name']}
Niche: {persona['niche']}
City: {persona['city']}

Available arc inspirations: {', '.join(random.sample(templates, min(8, len(templates))))}

{f"Upcoming real events to incorporate:{chr(10)}{events_context}" if events_context else ""}

Rules:
- Create 5-7 arcs that span the entire month
- Each arc lasts 3-7 days
- Leave some "regular days" between arcs (1-2 days of standalone content)
- At least one arc should involve a real or realistic event
- Arcs should vary in tone (fun, professional, personal, social)

Return a JSON array:
[
    {{
        "arc_name": "Name of the story arc",
        "start_day": 1,
        "end_day": 5,
        "description": "What happens in this arc",
        "daily_themes": ["day 1 theme", "day 2 theme", "..."],
        "mood": "excited|reflective|adventurous|cozy|professional|playful",
        "outfit_vibes": ["casual", "glam"],
        "locations": ["apartment", "cafe", "outdoor"]
    }},
    ...
]

Fill the entire month. Regular days (not in an arc) should have daily_themes as ["standalone"]."""

    return llm.generate_list(prompt, system=ARC_SYSTEM, temperature=0.85)


def get_day_context(arcs: list[dict[str, Any]], day: int) -> dict[str, Any]:
    """Get the narrative context for a specific day of the month.

    Returns arc info if the day is part of an arc, or standalone context.
    """
    for arc in arcs:
        start = arc.get("start_day", 0)
        end = arc.get("end_day", 0)
        if start <= day <= end:
            day_index = day - start
            themes = arc.get("daily_themes", [])
            theme = themes[day_index] if day_index < len(themes) else "continuation"
            return {
                "in_arc": True,
                "arc_name": arc.get("arc_name", ""),
                "day_in_arc": day_index + 1,
                "total_arc_days": end - start + 1,
                "theme": theme,
                "mood": arc.get("mood", "casual"),
                "outfit_vibes": arc.get("outfit_vibes", ["casual"]),
                "locations": arc.get("locations", ["apartment"]),
                "description": arc.get("description", ""),
            }

    return {
        "in_arc": False,
        "theme": "standalone",
        "mood": random.choice(["casual", "cozy", "playful", "reflective"]),
        "outfit_vibes": ["casual"],
        "locations": ["apartment", "cafe", "outdoor"],
    }
