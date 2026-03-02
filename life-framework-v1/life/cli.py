"""LIFE CLI — Rich-powered interactive terminal interface."""

from __future__ import annotations

import datetime
import sys
from pathlib import Path

import click
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt, IntPrompt
from rich.table import Table

from life.core.persona import (
    PERSONAS_DIR,
    interactive_create,
    generate_persona,
    list_personas,
)
from life.core.calendar import generate_month_calendar
from life.ai.llm import LLM
from life.ai.search import BraveSearch


console = Console()


def print_banner():
    """Print the LIFE Framework banner."""
    banner = """
[bold cyan]██╗     ██╗███████╗███████╗
██║     ██║██╔════╝██╔════╝
██║     ██║█████╗  █████╗  
██║     ██║██╔══╝  ██╔══╝  
███████╗██║██║     ███████╗
╚══════╝╚═╝╚═╝     ╚══════╝[/]
    """
    console.print(banner)
    console.print(
        Panel(
            "[bold]LoRA Influencer Fabrication Engine[/]\n"
            "[dim]AI Influencer Swarm Management System[/]",
            border_style="cyan",
        )
    )


def show_personas_table(personas: list[dict]) -> None:
    """Display a table of existing personas."""
    table = Table(title="Existing Personas", border_style="cyan")
    table.add_column("#", style="bold")
    table.add_column("Name", style="bold green")
    table.add_column("Handle", style="cyan")
    table.add_column("Niche", style="yellow")
    table.add_column("City", style="magenta")

    for i, p in enumerate(personas, 1):
        table.add_row(
            str(i),
            p["name"],
            f"@{p['handle']}",
            p["niche"],
            p["city"],
        )
    console.print(table)


def persona_menu(persona: dict) -> None:
    """Show options for an existing persona."""
    console.print(f"\n[bold green]📋 {persona['name']}[/] ({persona['city']} — {persona['niche']})\n")

    choices = {
        "g": "Generate monthly content calendar",
        "d": "Generate today's content only",
        "v": "View persona summary",
        "b": "Back to main menu",
    }
    for key, desc in choices.items():
        console.print(f"  [bold cyan][{key.upper()}][/] {desc}")

    choice = Prompt.ask("\nWhat would you like to do?", choices=list(choices.keys()), default="g")

    if choice == "g":
        generate_calendar_flow(persona)
    elif choice == "d":
        generate_today_flow(persona)
    elif choice == "v":
        view_persona_summary(persona)
    elif choice == "b":
        return


def generate_calendar_flow(persona_info: dict) -> None:
    """Interactive calendar generation flow."""
    now = datetime.datetime.now()
    default_month = now.month
    default_year = now.year

    # If we're past the 20th, default to next month
    if now.day > 20:
        default_month = now.month + 1 if now.month < 12 else 1
        default_year = now.year if now.month < 12 else now.year + 1

    month = IntPrompt.ask(
        "Which month?",
        default=default_month,
    )
    year = IntPrompt.ask(
        "Which year?",
        default=default_year,
    )

    console.print(f"\n⏳ Generating content calendar for {month}/{year}...")
    console.print("[dim]This will create 6 posts × 3 slides + 2 stories per day.[/]\n")

    llm = LLM()
    try:
        search = BraveSearch()
    except ValueError:
        search = None

    generate_month_calendar(
        llm=llm,
        search=search,
        persona_dir=persona_info["dir"],
        month=month,
        year=year,
    )


def generate_today_flow(persona_info: dict) -> None:
    """Generate content for today only."""
    from life.core.calendar import generate_day_content, save_day_content
    from life.core.narrative import get_day_context
    from life.core.tokens import load_persona_data
    from life.core.wardrobe import WardrobeEngine
    import yaml

    now = datetime.datetime.now()
    console.print(f"\n⏳ Generating today's content ({now.strftime('%B %d, %Y')})...\n")

    llm = LLM()
    persona = load_persona_data(persona_info["dir"])
    wardrobe = WardrobeEngine(persona_info["dir"])

    # Load apartment and devices
    apt_path = persona_info["dir"] / "world" / "apartment.yaml"
    apartment_data = None
    if apt_path.exists():
        with open(apt_path) as f:
            apartment_data = yaml.safe_load(f)

    devices_path = persona_info["dir"] / "world" / "devices.yaml"
    devices = None
    if devices_path.exists():
        with open(devices_path) as f:
            devices = yaml.safe_load(f)

    # Simple standalone context for single day
    day_context = {
        "in_arc": False,
        "theme": "standalone",
        "mood": "casual",
        "outfit_vibes": ["casual"],
        "locations": ["apartment", "cafe", "outdoor"],
    }

    day_content = generate_day_content(
        llm=llm,
        persona=persona,
        wardrobe=wardrobe,
        day_context=day_context,
        day=now.day,
        month=now.month,
        year=now.year,
        apartment_data=apartment_data,
        devices=devices,
    )

    # Save
    calendar_dir = persona_info["dir"] / "calendar" / f"{now.year}-{now.month:02d}"
    calendar_dir.mkdir(parents=True, exist_ok=True)
    save_day_content(day_content, calendar_dir)

    console.print(f"[green]✅ Today's content saved to {calendar_dir}/day-{now.day:02d}/[/]")


def view_persona_summary(persona_info: dict) -> None:
    """Display a summary of the persona."""
    import yaml

    persona_file = persona_info["dir"] / "persona.yaml"
    if not persona_file.exists():
        console.print("[red]No persona.yaml found.[/]")
        return

    with open(persona_file) as f:
        data = yaml.safe_load(f)

    console.print(Panel(
        f"[bold]{data.get('name', '?')}[/] (@{data.get('handle', '?')})\n"
        f"Age: {data.get('age', '?')} | City: {data.get('city', '?')}\n"
        f"Niche: {data.get('niche', '?')}\n"
        f"Vibe: {data.get('vibe', '?')}\n"
        f"Soul ID: {data.get('soul_id', 'not set')}\n"
        f"Instagram: @{data.get('instagram_handle', '?')}",
        title="Persona DNA",
        border_style="green",
    ))

    # Show physical traits
    physical = data.get("physical", {})
    if physical:
        console.print("\n[bold]Physical Traits:[/]")
        for key, value in physical.items():
            console.print(f"  [cyan]@{data.get('handle', '?')}.physical.{key}[/]")
            console.print(f"  {value[:100]}{'...' if len(str(value)) > 100 else ''}\n")

    # Show folder contents
    console.print("[bold]Folder Structure:[/]")
    for item in sorted(persona_info["dir"].rglob("*")):
        if item.is_file() and not item.name.startswith("."):
            rel = item.relative_to(persona_info["dir"])
            size = item.stat().st_size
            console.print(f"  📄 {rel} ({size:,} bytes)")


@click.command()
@click.option("--create", "do_create", is_flag=True, help="Jump straight to persona creation")
@click.option("--generate", "persona_name", help="Generate calendar for a persona by name")
@click.option("--month", type=int, help="Month for calendar generation")
@click.option("--year", type=int, help="Year for calendar generation")
def main(do_create: bool, persona_name: str | None, month: int | None, year: int | None):
    """LIFE — LoRA Influencer Fabrication Engine."""
    print_banner()

    # Quick create mode
    if do_create:
        persona_data = interactive_create()
        generate_persona(persona_data)
        return

    # Quick generate mode
    if persona_name:
        personas = list_personas()
        match = next((p for p in personas if persona_name.lower() in p["name"].lower()), None)
        if match:
            now = datetime.datetime.now()
            m = month or now.month
            y = year or now.year
            llm = LLM()
            try:
                search = BraveSearch()
            except ValueError:
                search = None
            generate_month_calendar(llm, search, match["dir"], m, y)
        else:
            console.print(f"[red]No persona matching '{persona_name}' found.[/]")
        return

    # Interactive mode
    while True:
        personas = list_personas()

        if not personas:
            console.print("\n[yellow]No personas found. Let's create your first influencer![/]\n")
            persona_data = interactive_create()
            generate_persona(persona_data)
            continue

        console.print()
        show_personas_table(personas)
        console.print()
        console.print("  [bold cyan][C][/] Create new persona")
        console.print("  [bold cyan][1-{}][/] Select existing persona".format(len(personas)))
        console.print("  [bold cyan][Q][/] Quit")

        choice = Prompt.ask("\nYour choice", default="1")

        if choice.lower() == "q":
            console.print("\n[dim]See you next time! 👋[/]\n")
            break
        elif choice.lower() == "c":
            persona_data = interactive_create()
            generate_persona(persona_data)
        elif choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(personas):
                persona_menu(personas[idx])
            else:
                console.print("[red]Invalid selection.[/]")
        else:
            console.print("[red]Invalid input.[/]")


if __name__ == "__main__":
    main()
