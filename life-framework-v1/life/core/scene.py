"""Scene composition pipeline — modular prompt assembly for Higgsfield."""

from __future__ import annotations

import random
from typing import Any


# Scene types with their typical components
SCENE_TYPES = {
    "selfie_home": {
        "location_type": "apartment",
        "action": "taking a selfie",
        "camera": "close-up selfie angle, phone held at eye level",
        "occasions": ["casual", "cozy", "content"],
    },
    "mirror_selfie": {
        "location_type": "apartment",
        "rooms": ["bedroom", "bathroom"],
        "action": "taking a mirror selfie",
        "camera": "full-body mirror reflection, phone visible in hand",
        "occasions": ["casual", "date_night", "content"],
    },
    "ootd": {
        "location_type": "apartment",
        "rooms": ["bedroom", "living_room"],
        "action": "posing for an outfit-of-the-day photo",
        "camera": "full-body shot, straight-on angle, well-lit",
        "occasions": ["casual", "formal", "date_night"],
    },
    "cafe": {
        "location_type": "venue",
        "action": "sitting at a café table, coffee in hand",
        "camera": "medium shot, warm natural light through window",
        "occasions": ["casual", "brunch"],
        "venue_desc": "cozy European-style café with marble table, light pastries, warm ambient lighting",
    },
    "restaurant": {
        "location_type": "venue",
        "action": "dining at a restaurant",
        "camera": "medium shot, candlelit evening ambiance",
        "occasions": ["formal", "date_night"],
        "venue_desc": "upscale restaurant with dim lighting, elegant table setting, wine glasses",
    },
    "street_style": {
        "location_type": "outdoor",
        "action": "walking down the street confidently",
        "camera": "full-body shot, shallow depth of field, urban background",
        "occasions": ["casual", "date_night"],
    },
    "golden_hour": {
        "location_type": "outdoor",
        "action": "posing in golden hour sunlight",
        "camera": "portrait shot, warm golden backlighting, soft bokeh",
        "occasions": ["casual", "content"],
    },
    "gym": {
        "location_type": "venue",
        "action": "working out at the gym",
        "camera": "medium shot, bright overhead lighting",
        "occasions": ["gym"],
        "venue_desc": "modern minimalist gym with clean equipment, mirrors, motivational atmosphere",
    },
    "getting_ready": {
        "location_type": "apartment",
        "rooms": ["bathroom", "bedroom"],
        "action": "getting ready, applying finishing touches",
        "camera": "candid medium shot, warm bathroom/vanity lighting",
        "occasions": ["casual", "date_night", "night_out"],
    },
    "night_out": {
        "location_type": "venue",
        "action": "enjoying a night out",
        "camera": "medium shot, moody atmospheric lighting",
        "occasions": ["night_out"],
        "venue_desc": "stylish rooftop bar with city lights in background, cocktail in hand",
    },
    "cooking": {
        "location_type": "apartment",
        "rooms": ["kitchen"],
        "action": "cooking in the kitchen",
        "camera": "medium shot, bright natural kitchen light",
        "occasions": ["casual", "cozy"],
    },
    "working": {
        "location_type": "apartment",
        "rooms": ["living_room", "bedroom"],
        "action": "working on laptop, focused",
        "camera": "candid shot, natural desk lighting",
        "occasions": ["casual", "content"],
    },
    "balcony": {
        "location_type": "apartment",
        "rooms": ["balcony"],
        "action": "relaxing on the balcony with a view",
        "camera": "medium shot, natural outdoor light, city view background",
        "occasions": ["casual", "cozy"],
    },
    "event": {
        "location_type": "venue",
        "action": "attending an event",
        "camera": "full-body shot, event lighting, photo wall background",
        "occasions": ["formal", "night_out"],
        "venue_desc": "glamorous event venue with step-and-repeat backdrop",
    },
    "flat_lay": {
        "location_type": "apartment",
        "action": "outfit flat lay on bed/surface",
        "camera": "top-down overhead shot, clean white/neutral background",
        "occasions": ["content"],
        "no_person": True,
    },
    "reading": {
        "location_type": "apartment",
        "rooms": ["living_room", "bedroom", "balcony"],
        "action": "reading a book, relaxed and cozy",
        "camera": "candid medium shot, soft warm lighting",
        "occasions": ["casual", "cozy"],
    },
}


def get_scene_types_for_time(time_of_day: str) -> list[str]:
    """Return appropriate scene types for time of day."""
    morning = ["selfie_home", "getting_ready", "cooking", "ootd", "gym", "cafe"]
    midday = ["street_style", "cafe", "working", "ootd", "flat_lay"]
    afternoon = ["golden_hour", "street_style", "balcony", "reading", "cafe"]
    evening = ["restaurant", "night_out", "event", "getting_ready", "mirror_selfie"]
    night = ["night_out", "event", "selfie_home", "cozy_home"]

    mapping = {
        "morning": morning,
        "midday": midday,
        "afternoon": afternoon,
        "evening": evening,
        "night": night,
    }
    return mapping.get(time_of_day, morning + midday)


def compose_scene(
    scene_type: str,
    outfit_snippet: str,
    persona_physical: dict[str, str],
    location_data: dict | None = None,
    device_snippet: str = "",
    handle: str = "",
) -> dict[str, Any]:
    """Compose a scene from modular components.

    Returns a dict with all scene components and the assembled raw prompt.
    """
    scene = SCENE_TYPES.get(scene_type, SCENE_TYPES["selfie_home"])

    # Build physical description (condensed to key features)
    physical_parts = []
    if persona_physical.get("face"):
        # Condense face to key identifiers
        physical_parts.append(persona_physical["face"][:80])
    if persona_physical.get("hair_default"):
        physical_parts.append(persona_physical["hair_default"][:50])
    if persona_physical.get("body"):
        physical_parts.append(persona_physical["body"][:40])
    physical_desc = ", ".join(physical_parts)

    # Build location description
    if scene["location_type"] == "apartment" and location_data:
        rooms = scene.get("rooms", ["living_room"])
        room = random.choice(rooms)
        room_data = location_data.get(room, {})
        # Pick a random angle
        angles = ["angle_1", "angle_2", "angle_3"]
        angle = random.choice(angles)
        location_desc = room_data.get("prompt_base", room_data.get(angle, f"in a modern {room.replace('_', ' ')}"))
    elif scene.get("venue_desc"):
        location_desc = scene["venue_desc"]
    else:
        location_desc = f"urban {scene['location_type']} setting"

    # Build action
    action = scene.get("action", "posing naturally")

    # Camera / composition
    camera = scene.get("camera", "medium shot, natural lighting")

    # Device (for selfie scenes)
    device_part = ""
    if "selfie" in scene_type and device_snippet:
        device_part = f", {device_snippet}"

    # Assemble components
    components = {
        "scene_type": scene_type,
        "physical": physical_desc,
        "outfit": outfit_snippet,
        "location": location_desc,
        "action": action,
        "camera": camera,
        "device": device_part,
        "is_flat_lay": scene.get("no_person", False),
    }

    return components


def assemble_raw_prompt(components: dict[str, Any]) -> str:
    """Assemble components into a raw prompt string (before condensation)."""
    if components.get("is_flat_lay"):
        return (
            f"Flat lay arrangement: {components['outfit']}, "
            f"arranged on {components['location']}, "
            f"{components['camera']}. "
            f"4K, photorealistic, clean composition."
        )

    prompt = (
        f"A young woman with {components['physical']}, "
        f"{components['outfit']}, "
        f"{components['action']} in {components['location']}"
        f"{components.get('device', '')}. "
        f"{components['camera']}. "
        f"4K, photorealistic, natural skin texture, sharp focus."
    )
    return prompt


def assemble_minimal_prompt(components: dict[str, Any]) -> str:
    """Assemble a minimal 'differential' prompt for use with a Character Reference.
    
    Omit the physical appearance and outfit details completely, focusing only
    on the new camera angle, action/pose, and location. This prevents the AI
    from hallucinating different clothing variations across slides.
    """
    if components.get("is_flat_lay"):
        return assemble_raw_prompt(components)

    prompt = (
        f"{components['camera']}, {components['action'].replace('posing', 'standing naturally')} "
        f"in {components['location']}. "
        f"4K, photorealistic, cinematic lighting."
    )
    # Capitalize first letter
    return prompt[0].upper() + prompt[1:]


def get_slide_variations(
    scene_type: str,
    base_components: dict[str, Any],
) -> list[str]:
    """Generate 3 slide variations of the same scene for a carousel.

    Each slide varies the angle, pose, or framing while keeping the outfit/location.
    """
    scene = SCENE_TYPES.get(scene_type, SCENE_TYPES["selfie_home"])

    # Slide 1: Main shot (Anchor image - full prompt)
    slide_1 = assemble_raw_prompt(base_components)

    # Slide 2: Different angle/framing (Minimal prompt for Character Ref)
    alt_components_2 = dict(base_components)
    camera_variations = [
        "close-up portrait, soft focus background",
        "three-quarter body shot, slight angle",
        "medium shot from slightly below, confident angle",
        "candid shot, looking away, natural expression",
    ]
    alt_components_2["camera"] = random.choice(camera_variations)
    alt_components_2["action"] = base_components["action"].replace(
        "posing", "laughing naturally"
    ) if "posing" in base_components.get("action", "") else base_components.get("action", "")
    slide_2 = assemble_minimal_prompt(alt_components_2)

    # Slide 3: Detail/mood shot (Minimal prompt for Character Ref)
    alt_components_3 = dict(base_components)
    detail_variations = [
        "close-up detail shot focused on hands and accessories",
        "over-the-shoulder perspective, looking back",
        "wide shot capturing the full scene and atmosphere",
        "profile view, dramatic lighting, editorial feel",
    ]
    alt_components_3["camera"] = random.choice(detail_variations)
    slide_3 = assemble_minimal_prompt(alt_components_3)

    return [slide_1, slide_2, slide_3]
