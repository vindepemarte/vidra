"""Content calendar engine — full month generation with 6+ posts/day."""

from __future__ import annotations

import calendar as cal
import random
from pathlib import Path
from typing import Any

import yaml

from life.ai.llm import LLM
from life.ai.search import BraveSearch
from life.core.narrative import generate_monthly_arcs, get_day_context
from life.core.scene import (
    SCENE_TYPES,
    compose_scene,
    get_scene_types_for_time,
    get_slide_variations,
)
from life.core.tokens import load_persona_data
from life.core.wardrobe import WardrobeEngine
from life.generators.caption import generate_caption, generate_story_caption
from life.generators.prompt import condense_prompt, generate_story_prompt
from life.utils.scoring import score_prompt


# Posting schedule (6 posts + 1-2 stories spread across the day)
POSTING_SCHEDULE = [
    {"time": "08:00", "period": "morning", "post_number": 1},
    {"time": "10:30", "period": "midday", "post_number": 2},
    {"time": "13:00", "period": "midday", "post_number": 3},
    {"time": "16:00", "period": "afternoon", "post_number": 4},
    {"time": "19:00", "period": "evening", "post_number": 5},
    {"time": "21:30", "period": "evening", "post_number": 6},
]

STORY_TIMES = [
    {"time": "09:00", "period": "morning"},
    {"time": "20:00", "period": "evening"},
]


def get_season(month: int) -> str:
    """Determine season from month number."""
    if month in (3, 4, 5):
        return "spring"
    elif month in (6, 7, 8):
        return "summer"
    elif month in (9, 10, 11):
        return "fall"
    else:
        return "winter"


def generate_day_content(
    llm: LLM,
    persona: dict,
    wardrobe: WardrobeEngine,
    day_context: dict[str, Any],
    day: int,
    month: int,
    year: int,
    apartment_data: dict | None = None,
    devices: list[dict] | None = None,
) -> dict[str, Any]:
    """Generate all content for a single day.

    Returns a dict with 6 posts (each with 3 slides) + 1-2 stories.
    """
    season = get_season(month)
    day_content = {
        "date": f"{year}-{month:02d}-{day:02d}",
        "arc": day_context.get("arc_name", "standalone"),
        "theme": day_context.get("theme", "everyday"),
        "posts": [],
        "stories": [],
    }

    # Track used scene types for variety
    used_scenes = set()

    # Get device snippet for selfie scenes
    phone = None
    if devices:
        phone = next((d for d in devices if d.get("type") == "phone"), None)
    device_snippet = phone.get("prompt_snippet", "") if phone else ""

    physical = persona.get("physical", {})

    for slot in POSTING_SCHEDULE:
        # Pick scene type based on time and narrative context
        available_scenes = get_scene_types_for_time(slot["period"])

        # Filter by narrative context locations
        if day_context.get("locations"):
            preferred = []
            for scene_name in available_scenes:
                scene_def = SCENE_TYPES.get(scene_name, {})
                loc_type = scene_def.get("location_type", "")
                context_locs = day_context["locations"]
                if loc_type in context_locs or scene_name in context_locs or any(
                    loc in scene_name for loc in context_locs
                ):
                    preferred.append(scene_name)
            if preferred:
                available_scenes = preferred + [s for s in available_scenes if s not in preferred]

        # Avoid repeating scene types
        fresh_scenes = [s for s in available_scenes if s not in used_scenes]
        if not fresh_scenes:
            fresh_scenes = available_scenes

        scene_type = random.choice(fresh_scenes[:4])
        used_scenes.add(scene_type)

        # Determine occasion from context
        mood = day_context.get("mood", "casual")
        occasion_map = {
            "excited": "casual",
            "reflective": "cozy",
            "adventurous": "casual",
            "cozy": "cozy",
            "professional": "formal",
            "playful": "casual",
        }
        occasion = occasion_map.get(mood, "casual")
        if slot["period"] == "evening":
            occasion = random.choice(["date_night", "night_out", "casual"])

        # Combine outfit
        outfit = wardrobe.combine_outfit(
            occasion=occasion,
            season=season,
            time_of_day=slot["period"],
        )

        # Compose scene
        components = compose_scene(
            scene_type=scene_type,
            outfit_snippet=outfit["prompt_snippet"],
            persona_physical=physical,
            location_data=apartment_data,
            device_snippet=device_snippet,
            handle=persona.get("handle", ""),
        )

        # Generate 3 slide variations
        raw_slides = get_slide_variations(scene_type, components)

        # Condense each slide prompt for Higgsfield
        condensed_slides = [condense_prompt(llm, slide) for slide in raw_slides]

        # Score prompts
        scores = [score_prompt(p, persona.get("handle", "")) for p in condensed_slides]

        # Generate caption (with error handling)
        narrative_context = ""
        if day_context.get("in_arc"):
            narrative_context = (
                f"Arc: {day_context['arc_name']} — "
                f"Day {day_context['day_in_arc']}/{day_context['total_arc_days']} — "
                f"Theme: {day_context['theme']}"
            )

        try:
            caption_data = generate_caption(
                llm, persona, scene_type, outfit["prompt_snippet"],
                slot["post_number"], narrative_context,
            )
        except Exception:
            caption_data = {
                "caption": f"✨ {scene_type.replace('_', ' ').title()} vibes ✨",
                "hashtags": f"#{persona.get('instagram_handle', 'life')} #lifestyle #aesthetic",
            }

        post = {
            "post_number": slot["post_number"],
            "time": slot["time"],
            "scene_type": scene_type,
            "slides": [
                {
                    "slide_number": i + 1,
                    "prompt": condensed_slides[i],
                    "raw_prompt": raw_slides[i],
                    "quality_score": scores[i]["overall"],
                }
                for i in range(3)
            ],
            "caption": caption_data["caption"],
            "hashtags": caption_data["hashtags"],
            "outfit_summary": outfit["prompt_snippet"],
            "reference_images": outfit.get("reference_images", []),
        }
        day_content["posts"].append(post)

    # Generate 1-2 stories (Minimal differential prompts for Character Ref)
    for i, story_slot in enumerate(STORY_TIMES):
        scene_context = f"{day_context.get('theme', 'everyday')} day, {story_slot['period']}"
        try:
            # Minimal prompt for stories (relies on prior generated image as Character Ref)
            story_prompt = f"{story_slot['period'].title()} story selfie video angle, natural motion blur. 4K, photorealistic."
            story_caption = generate_story_caption(llm, persona, scene_context)
        except Exception:
            story_prompt = f"Casual {story_slot['period']} video selfie angle, candid movement, 4K photorealistic."
            story_caption = "living my best life ✨"

        day_content["stories"].append({
            "story_number": i + 1,
            "time": story_slot["time"],
            "prompt": story_prompt,
            "caption_overlay": story_caption,
        })

    return day_content


def save_day_content(day_content: dict[str, Any], calendar_dir: Path) -> None:
    """Save a day's content to files."""
    date_str = day_content["date"]
    day_num = date_str.split("-")[2]
    day_dir = calendar_dir / f"day-{day_num}"
    day_dir.mkdir(parents=True, exist_ok=True)

    for post in day_content["posts"]:
        post_file = day_dir / f"post_{post['post_number']:02d}.md"
        lines = [
            f"# Post {post['post_number']} — {post['time']}",
            f"**Scene:** {post['scene_type']}",
            f"**Outfit:** {post['outfit_summary']}",
            "",
        ]
        for slide in post["slides"]:
            lines.append(f"## Slide {slide['slide_number']} (Score: {slide['quality_score']}/10)")
            
            if slide["slide_number"] == 1 and post.get("reference_images"):
                lines.append("**📸 Local Style References (drag into Higgsfield):**")
                for img_path in post["reference_images"]:
                    lines.append(f"- `{img_path}`")
                lines.append("")
                
            if slide["slide_number"] > 1:
                lines.append("**💡 TIP:** Use Slide 1 as a Character Reference and generate this minimal prompt:")
                lines.append("")

            lines.append(f"```")
            lines.append(slide["prompt"])
            lines.append(f"```")
            lines.append("")

        lines.append("## Caption")
        lines.append(post["caption"])
        lines.append("")
        lines.append("## Hashtags")
        lines.append(post["hashtags"])

        post_file.write_text("\n".join(lines))

    # Stories
    if day_content["stories"]:
        story_file = day_dir / "stories.md"
        lines = [f"# Stories — {date_str}", ""]
        for story in day_content["stories"]:
            lines.append(f"## Story {story['story_number']} — {story['time']}")
            lines.append(f"```")
            lines.append(story["prompt"])
            lines.append(f"```")
            lines.append(f"**Text overlay:** {story['caption_overlay']}")
            lines.append("")
        story_file.write_text("\n".join(lines))


def generate_month_calendar(
    llm: LLM,
    search: BraveSearch | None,
    persona_dir: str | Path,
    month: int,
    year: int,
) -> Path:
    """Generate a full month's content calendar.

    This is the main entry point for calendar generation.
    Returns the path to the generated calendar directory.
    """
    from rich.console import Console
    from rich.progress import Progress, SpinnerColumn, TextColumn

    console = Console()
    persona_dir = Path(persona_dir)

    # Load persona data
    persona = load_persona_data(persona_dir)

    # Load apartment data
    apt_path = persona_dir / "world" / "apartment.yaml"
    apartment_data = None
    if apt_path.exists():
        with open(apt_path) as f:
            apartment_data = yaml.safe_load(f)

    # Load devices
    devices_path = persona_dir / "world" / "devices.yaml"
    devices = None
    if devices_path.exists():
        with open(devices_path) as f:
            devices = yaml.safe_load(f)

    # Load events
    events_path = persona_dir / "world" / "events.yaml"
    events = []
    if events_path.exists():
        with open(events_path) as f:
            events = yaml.safe_load(f) or []

    # Initialize wardrobe engine
    wardrobe = WardrobeEngine(persona_dir)

    # Generate narrative arcs
    month_name = cal.month_name[month]
    console.print(f"\n📖 Generating narrative arcs for {month_name} {year}...")
    arcs = generate_monthly_arcs(llm, persona, month_name, str(year), events)

    # Save arcs
    content_dir = persona_dir / "content"
    content_dir.mkdir(exist_ok=True)
    arcs_file = content_dir / "arcs.yaml"
    with open(arcs_file, "w") as f:
        yaml.dump(arcs, f, default_flow_style=False, allow_unicode=True)

    # Create calendar directory
    calendar_dir = persona_dir / "calendar" / f"{year}-{month:02d}"
    calendar_dir.mkdir(parents=True, exist_ok=True)

    # Generate content for each day
    num_days = cal.monthrange(year, month)[1]

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task(
            f"Generating {num_days} days of content...", total=num_days
        )

        overview_lines = [
            f"# {persona['name']} — {month_name} {year} Content Calendar",
            f"**Total posts:** {num_days * 6} ({num_days} days × 6 posts)",
            f"**Total slides:** {num_days * 18} ({num_days * 6} posts × 3 slides)",
            f"**Stories:** {num_days * 2}",
            "",
            "## Narrative Arcs",
        ]
        for arc in arcs:
            overview_lines.append(
                f"- **{arc.get('arc_name', 'unnamed')}** "
                f"(Day {arc.get('start_day', '?')}-{arc.get('end_day', '?')}): "
                f"{arc.get('description', '')}"
            )
        overview_lines.append("")
        overview_lines.append("## Daily Content")

        for day in range(1, num_days + 1):
            progress.update(task, description=f"Day {day}/{num_days}...")

            # Resume support: skip days that already have all 6 posts
            day_dir = calendar_dir / f"day-{day:02d}"
            if day_dir.exists() and len(list(day_dir.glob("post_*.md"))) >= 6:
                progress.update(task, advance=1)
                overview_lines.append(
                    f"### Day {day:02d} — (resumed, already generated)\n"
                )
                continue

            day_context = get_day_context(arcs, day)

            day_content = generate_day_content(
                llm=llm,
                persona=persona,
                wardrobe=wardrobe,
                day_context=day_context,
                day=day,
                month=month,
                year=year,
                apartment_data=apartment_data,
                devices=devices,
            )

            save_day_content(day_content, calendar_dir)

            # Add to overview
            arc_label = day_content.get("arc", "standalone")
            theme_label = day_content.get("theme", "everyday")
            scenes = ", ".join(p["scene_type"] for p in day_content["posts"])
            overview_lines.append(
                f"### Day {day:02d} — {arc_label} / {theme_label}\n"
                f"Scenes: {scenes}\n"
            )

            progress.update(task, advance=1)

    # Save overview
    (calendar_dir / "overview.md").write_text("\n".join(overview_lines))

    console.print(f"\n✅ Calendar saved to [bold]{calendar_dir}[/]")
    console.print(f"   📊 {num_days * 6} posts, {num_days * 18} slides, {num_days * 2} stories\n")

    return calendar_dir
