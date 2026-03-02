"""World generator — apartment/living space, devices, events."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from life.ai.llm import LLM
from life.ai.search import BraveSearch

SYSTEM_PROMPT = """You are an expert interior designer and tech reviewer creating hyper-detailed descriptions 
for AI image generation. Every room description must be vivid enough to reconstruct visually — 
furniture brands/styles, exact colors, textures, lighting sources, plants, artwork, objects.
Describe as if giving instructions to a set designer. Be SPECIFIC about spatial layout."""


def generate_apartment(llm: LLM, persona: dict) -> dict[str, str]:
    """Generate detailed room-by-room apartment descriptions."""
    rooms = ["living_room", "bedroom", "kitchen", "bathroom", "balcony"]
    if persona.get("apartment_extras"):
        rooms.extend(persona["apartment_extras"])

    prompt = f"""Design a complete apartment/home for this AI influencer. The home should reflect their personality, niche, and aesthetic perfectly.

Name: {persona['name']}, Age: {persona['age']}, City: {persona['city']}
Niche: {persona['niche']}, Vibe: {persona.get('vibe', 'modern')}
Income level: {persona.get('income_vibe', 'upper-middle class, some luxury touches')}

For each room, provide descriptions from 3 DIFFERENT camera angles/positions.
This is critical — we need variety in our AI-generated images.

Return a JSON object with these rooms as keys: {rooms}

Each room value should be a JSON object:
{{
    "overview": "General description of the room — size, layout, color palette, flooring, ceiling, overall mood",
    "angle_1": "Description from the main entrance/doorway looking in — what you see first, furniture arrangements, focal points, lighting",
    "angle_2": "Description from the window/far side looking back — natural light, how it falls on surfaces, view of other furniture",
    "angle_3": "Description from a corner/side angle — close-up details, textures, small objects, plants, artwork on walls",
    "lighting_day": "How the room looks in natural daylight — where sun comes in, shadows, brightness",
    "lighting_evening": "How the room looks in evening — which lights are on, warm/cool, ambient mood",
    "prompt_base": "A 20-30 word base prompt for this room that captures the essential visual identity"
}}

Be extremely specific: IKEA KALLAX shelf vs just 'bookshelf', Monstera deliciosa vs just 'plant', 
terrazzo flooring vs just 'tile'. Include brand names where it makes sense."""

    return llm.generate_json(prompt, system=SYSTEM_PROMPT)


def generate_devices(llm: LLM, persona: dict) -> list[dict[str, Any]]:
    """Generate the tech devices this influencer uses."""
    prompt = f"""Create the complete tech setup for this AI influencer:

Name: {persona['name']}, Age: {persona['age']}, Niche: {persona['niche']}
City: {persona['city']}

Return a JSON array of devices they use. Each device:
{{
    "id": "device_001",
    "type": "phone|laptop|tablet|camera|headphones|ring_light|tripod",
    "name": "Exact model name",
    "brand": "Brand",
    "description": "Detailed visual description — color, case/cover, stickers, condition, how they hold/use it",
    "prompt_snippet": "10-15 word description for image prompts (e.g., 'holding a rose gold iPhone 16 Pro Max in a clear case')"
}}

Include at minimum: phone (with case description), laptop, headphones, camera (if content creator).
Use current 2025-2026 models. Be specific about colors and accessories."""

    return llm.generate_list(prompt, system=SYSTEM_PROMPT)


def discover_events(search: BraveSearch, llm: LLM, persona: dict) -> list[dict[str, Any]]:
    """Discover upcoming real-world events for the influencer's city."""
    city = persona["city"]

    # Search for events in March and April 2026
    raw_results = search.discover_events(city, "March", "2026")
    raw_results.extend(search.discover_events(city, "April", "2026"))

    # Use LLM to parse and structure the events
    results_text = "\n".join(
        f"- {r['title']}: {r['description']}" for r in raw_results[:20]
    )

    prompt = f"""Based on these search results about upcoming events in {city} for March-April 2026, 
extract and structure the actual events. If the search results are sparse, use your knowledge 
of typical recurring events in {city} during spring (fashion weeks, art fairs, festivals, etc.)

Search results:
{results_text}

Influencer niche: {persona['niche']}

Return a JSON array of 10-15 events. Each event:
{{
    "name": "Event name",
    "type": "fashion|art|music|food|cultural|sports|tech|social",
    "date_range": "March 10-15, 2026 (approximate if unknown)",
    "location": "Venue or area in {city}",
    "description": "What the event is about, why this influencer would attend",
    "content_opportunity": "What kind of content they could create there",
    "outfit_vibe": "What they'd wear — casual, formal, streetwear, etc."
}}

Mix confirmed events with highly likely recurring ones (e.g., Milan Fashion Week happens every year)."""

    return llm.generate_list(prompt, system=SYSTEM_PROMPT)


def generate_full_world(
    llm: LLM, search: BraveSearch, persona: dict, output_dir: Path
) -> None:
    """Generate and save all world assets."""
    from rich.console import Console
    console = Console()

    world_dir = output_dir / "world"
    world_dir.mkdir(parents=True, exist_ok=True)
    apt_dir = world_dir / "apartment"
    apt_dir.mkdir(exist_ok=True)

    # 1. Apartment
    console.print("  [dim]Designing apartment...[/]")
    apartment = generate_apartment(llm, persona)
    # Save overview
    overview_parts = [f"# {persona['name']}'s Apartment — {persona['city']}\n"]
    for room_name, room_data in apartment.items():
        if isinstance(room_data, dict):
            room_md = f"# {room_name.replace('_', ' ').title()}\n\n"
            for key, value in room_data.items():
                room_md += f"## {key.replace('_', ' ').title()}\n{value}\n\n"
            (apt_dir / f"{room_name}.md").write_text(room_md)
            overview_parts.append(f"- **{room_name.replace('_', ' ').title()}**: {room_data.get('overview', 'See details')}")
    (apt_dir / "overview.md").write_text("\n".join(overview_parts))

    # Save apartment data as YAML for programmatic access
    with open(world_dir / "apartment.yaml", "w") as f:
        yaml.dump(apartment, f, default_flow_style=False, allow_unicode=True)

    # 2. Devices
    console.print("  [dim]Generating tech setup...[/]")
    devices = generate_devices(llm, persona)
    with open(world_dir / "devices.yaml", "w") as f:
        yaml.dump(devices, f, default_flow_style=False, allow_unicode=True)

    # 3. Events
    console.print("  [dim]Discovering upcoming events...[/]")
    try:
        events = discover_events(search, llm, persona)
    except Exception as e:
        console.print(f"  [yellow]Event discovery failed ({e}), generating from knowledge...[/]")
        events = _generate_events_fallback(llm, persona)
    with open(world_dir / "events.yaml", "w") as f:
        yaml.dump(events, f, default_flow_style=False, allow_unicode=True)


def _generate_events_fallback(llm: LLM, persona: dict) -> list[dict[str, Any]]:
    """Generate events from LLM knowledge when Brave Search fails."""
    prompt = f"""Create 10-15 realistic upcoming events in {persona['city']} for March-April 2026 
that this influencer would attend:

Name: {persona['name']}, Niche: {persona['niche']}

Use your knowledge of real recurring events in {persona['city']} (fashion weeks, art fairs, 
food festivals, etc.) and extrapolate to 2026.

Return a JSON array. Each event:
{{
    "name": "Event name",
    "type": "fashion|art|music|food|cultural|sports|tech|social",
    "date_range": "Approximate dates",
    "location": "Venue or area",
    "description": "Brief description",
    "content_opportunity": "What content they could create",
    "outfit_vibe": "Dress code/style for the event"
}}"""
    return llm.generate_list(prompt)
