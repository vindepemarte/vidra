"""Persona creation orchestrator — interactive questionnaire + full generation."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml

from life.ai.llm import LLM
from life.ai.search import BraveSearch
from life.generators.backstory import generate_full_backstory
from life.generators.appearance import generate_full_appearance
from life.generators.world import generate_full_world


PERSONAS_DIR = Path(__file__).parent.parent.parent / "personas"


def slugify(name: str) -> str:
    """Convert name to folder-safe slug."""
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def list_personas() -> list[dict[str, Any]]:
    """List all existing personas."""
    if not PERSONAS_DIR.exists():
        return []
    personas = []
    for d in sorted(PERSONAS_DIR.iterdir()):
        if d.is_dir():
            persona_file = d / "persona.yaml"
            if persona_file.exists():
                with open(persona_file) as f:
                    data = yaml.safe_load(f)
                personas.append({
                    "dir": d,
                    "name": data.get("name", d.name),
                    "handle": data.get("handle", ""),
                    "niche": data.get("niche", ""),
                    "city": data.get("city", ""),
                })
            else:
                personas.append({
                    "dir": d,
                    "name": d.name.replace("_", " ").title(),
                    "handle": "",
                    "niche": "",
                    "city": "",
                })
    return personas


def interactive_create() -> dict[str, Any]:
    """Run the interactive persona creation questionnaire (CLI mode)."""
    from rich.console import Console
    from rich.prompt import Prompt

    console = Console()
    console.print("\n[bold cyan]🧬 New Persona Creation[/]\n")

    name = Prompt.ask("[bold]Full name[/]")
    handle = Prompt.ask(
        "[bold]Handle (token prefix, e.g. GIULIA)[/]",
        default=name.split()[0].upper(),
    )
    age = Prompt.ask("[bold]Age[/]", default="26")
    gender = Prompt.ask("[bold]Gender[/]", choices=["female", "male"], default="female")
    city = Prompt.ask("[bold]City they live in[/]")
    niche = Prompt.ask("[bold]Niche / career[/]")
    vibe = Prompt.ask(
        "[bold]Vibe (3 words)[/]",
        default="elegant, bold, authentic",
    )
    inspirations = Prompt.ask(
        "[bold]Style inspirations (optional)[/]",
        default="",
    )
    income_vibe = Prompt.ask(
        "[bold]Income level vibe[/]",
        default="upper-middle class with occasional luxury",
    )
    soul_id = Prompt.ask(
        "[bold]Higgsfield Soul ID (optional)[/]",
        default="",
    )
    ig_handle = Prompt.ask(
        "[bold]Instagram handle (optional)[/]",
        default=name.lower().replace(" ", ""),
    )

    return {
        "name": name,
        "handle": handle,
        "age": int(age),
        "gender": gender,
        "city": city,
        "niche": niche,
        "vibe": vibe,
        "inspirations": inspirations,
        "income_vibe": income_vibe,
        "soul_id": soul_id,
        "instagram_handle": ig_handle,
    }


def create_from_dict(persona_input: dict[str, Any]) -> dict[str, Any]:
    """Create persona from a dict (used by both CLI and chat mode)."""
    return {
        "name": persona_input["name"],
        "handle": persona_input.get("handle", persona_input["name"].split()[0].upper()),
        "age": persona_input.get("age", 26),
        "gender": persona_input.get("gender", "female"),
        "city": persona_input["city"],
        "niche": persona_input["niche"],
        "vibe": persona_input.get("vibe", "modern, authentic"),
        "inspirations": persona_input.get("inspirations", ""),
        "income_vibe": persona_input.get("income_vibe", "upper-middle class"),
        "soul_id": persona_input.get("soul_id", ""),
        "instagram_handle": persona_input.get(
            "instagram_handle",
            persona_input["name"].lower().replace(" ", ""),
        ),
    }


def generate_persona(persona: dict[str, Any]) -> Path:
    """Full persona generation pipeline.

    Creates the complete persona folder with all assets.
    Returns the path to the persona directory.
    """
    from rich.console import Console

    console = Console()
    llm = LLM()

    try:
        search = BraveSearch()
    except ValueError:
        console.print("[yellow]⚠ Brave Search API key not set. Events will use LLM knowledge only.[/]")
        search = None

    slug = slugify(persona["name"])
    persona_dir = PERSONAS_DIR / slug
    persona_dir.mkdir(parents=True, exist_ok=True)

    console.print(f"\n[bold green]🧬 Generating {persona['name']}...[/]\n")

    # 1. Generate backstory
    console.print("[bold]📖 Backstory[/]")
    generate_full_backstory(llm, persona, persona_dir)
    console.print("  [green]✅ Backstory complete[/]\n")

    # 2. Generate appearance (returns physical dict)
    console.print("[bold]👤 Appearance & Style[/]")
    physical = generate_full_appearance(llm, persona, persona_dir)
    persona["physical"] = physical
    console.print("  [green]✅ Appearance complete[/]\n")

    # 3. Generate world (apartment, devices, events)
    console.print("[bold]🏠 World & Environment[/]")
    if search:
        generate_full_world(llm, search, persona, persona_dir)
    else:
        # Fallback without Brave Search
        from life.generators.world import generate_apartment, generate_devices, _generate_events_fallback
        world_dir = persona_dir / "world"
        world_dir.mkdir(parents=True, exist_ok=True)
        apt_dir = world_dir / "apartment"
        apt_dir.mkdir(exist_ok=True)

        console.print("  [dim]Designing apartment...[/]")
        apartment = generate_apartment(llm, persona)
        with open(world_dir / "apartment.yaml", "w") as f:
            yaml.dump(apartment, f, default_flow_style=False, allow_unicode=True)
        for room_name, room_data in apartment.items():
            if isinstance(room_data, dict):
                room_md = f"# {room_name.replace('_', ' ').title()}\n\n"
                for key, value in room_data.items():
                    room_md += f"## {key.replace('_', ' ').title()}\n{value}\n\n"
                (apt_dir / f"{room_name}.md").write_text(room_md)

        console.print("  [dim]Generating tech setup...[/]")
        devices = generate_devices(llm, persona)
        with open(world_dir / "devices.yaml", "w") as f:
            yaml.dump(devices, f, default_flow_style=False, allow_unicode=True)

        console.print("  [dim]Generating events from knowledge...[/]")
        events = _generate_events_fallback(llm, persona)
        with open(world_dir / "events.yaml", "w") as f:
            yaml.dump(events, f, default_flow_style=False, allow_unicode=True)

    console.print("  [green]✅ World complete[/]\n")

    # 4. Generate content strategy
    console.print("[bold]📋 Content Strategy[/]")
    _generate_content_strategy(llm, persona, persona_dir)
    console.print("  [green]✅ Strategy complete[/]\n")

    # 5. Save persona.yaml (the DNA file)
    _save_persona_yaml(persona, persona_dir)

    console.print(f"[bold green]🎉 {persona['name']} is ready![/]")
    console.print(f"   📁 Saved to: [bold]{persona_dir}[/]\n")

    return persona_dir


def _generate_content_strategy(llm: LLM, persona: dict, output_dir: Path) -> None:
    """Generate the content strategy document."""
    prompt = f"""Create a comprehensive content strategy for this AI influencer:

Name: {persona['name']}
Niche: {persona['niche']}
City: {persona['city']}
Age: {persona['age']}
Vibe: {persona.get('vibe', 'modern')}

Cover:
1. Content Pillars (4-5 core themes they always post about)
2. Brand Voice (how they write, speak, what language patterns they use)
3. Visual Aesthetic (color palette, editing style, composition preferences)
4. Engagement Strategy (how they interact with followers)
5. Growth Tactics (how they'll grow from 0 to 10K, 10K to 100K)
6. Monetization Roadmap (short-term and long-term revenue streams)
7. Collaboration Strategy (who they'd collab with, how)
8. Posting Schedule (optimal times for their audience)

Write in detailed bullet points. This is their content bible."""

    strategy = llm.generate_markdown(prompt, max_tokens=4096)
    content_dir = output_dir / "content"
    content_dir.mkdir(exist_ok=True)
    (content_dir / "strategy.md").write_text(
        f"# {persona['name']} — Content Strategy\n\n{strategy}"
    )


def _save_persona_yaml(persona: dict, output_dir: Path) -> None:
    """Save the full persona.yaml DNA file."""
    yaml_data = {
        "name": persona["name"],
        "handle": persona["handle"],
        "age": persona["age"],
        "gender": persona.get("gender", "female"),
        "city": persona["city"],
        "niche": persona["niche"],
        "vibe": persona.get("vibe", ""),
        "inspirations": persona.get("inspirations", ""),
        "income_vibe": persona.get("income_vibe", ""),
        "soul_id": persona.get("soul_id", ""),
        "instagram_handle": persona.get("instagram_handle", ""),
        "physical": persona.get("physical", {}),
    }
    with open(output_dir / "persona.yaml", "w") as f:
        yaml.dump(yaml_data, f, default_flow_style=False, allow_unicode=True)
