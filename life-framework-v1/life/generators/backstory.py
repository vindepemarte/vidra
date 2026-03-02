"""Backstory generator — childhood, life story, future plans."""

from __future__ import annotations

from pathlib import Path

from life.ai.llm import LLM

SYSTEM_PROMPT = """You are a world-class fiction writer creating deeply authentic backstories for AI influencer personas. 
Write vivid, specific, emotionally resonant narratives. Include real place names, schools, relationships, and turning points.
The stories should feel REAL — as if reading someone's actual memoir. No generic platitudes.
Write in third person present for descriptions, past tense for events."""


def generate_childhood(llm: LLM, persona: dict) -> str:
    """Generate a detailed childhood backstory."""
    prompt = f"""Create a detailed childhood backstory for this person:

Name: {persona['name']}
Age: {persona['age']}
City (currently lives in): {persona['city']}
Niche/Career: {persona['niche']}
Vibe: {persona.get('vibe', 'authentic, modern')}

Write a rich childhood narrative covering:
- Family background (parents' occupations, siblings, family dynamics)
- Where they grew up (specific city/neighborhood)
- Early personality traits and interests
- Formative childhood experiences (3-4 specific vivid memories)
- School life and early friendships
- The first signs of their future path/interests
- Any challenges or turning points in early life

Write 600-800 words. Be specific with names, places, ages. Make it feel like a real person's story."""

    return llm.generate_markdown(prompt, system=SYSTEM_PROMPT)


def generate_life_story(llm: LLM, persona: dict, childhood: str) -> str:
    """Generate life story from teenage years to present day."""
    prompt = f"""Continue the life story for this person from teenage years to present:

Name: {persona['name']}
Age: {persona['age']}
City: {persona['city']}  
Niche/Career: {persona['niche']}
Vibe: {persona.get('vibe', 'authentic, modern')}

Their childhood:
{childhood[:1000]}...

Write their life story covering:
- Teenage years (high school, first loves, identity formation)
- Education (university/college, what they studied, key experiences)
- Career journey (how they got into their niche, early struggles, breakthroughs)
- Relationships (friendships, romantic, mentors)
- How they became who they are today
- Current daily life, routines, lifestyle
- Their personality NOW — how they speak, what makes them laugh, their quirks

Write 800-1000 words. Be vivid and specific. Include real-world references."""

    return llm.generate_markdown(prompt, system=SYSTEM_PROMPT)


def generate_future_plans(llm: LLM, persona: dict, life_story: str) -> str:
    """Generate future aspirations and plans."""
    prompt = f"""Create the future plans and aspirations for this person:

Name: {persona['name']}
Age: {persona['age']}
City: {persona['city']}
Niche/Career: {persona['niche']}

Their life so far:
{life_story[:1000]}...

Write their future plans covering:
- Short-term goals (next 3-6 months) — specific projects, trips, milestones
- Medium-term dreams (1-2 years) — career moves, personal growth
- Long-term vision (5+ years) — where they see themselves
- Dream collaborations and partnerships
- Places they want to visit/live
- Skills they want to develop
- How their content/career will evolve

Write 400-600 words. Be specific and aspirational but grounded."""

    return llm.generate_markdown(prompt, system=SYSTEM_PROMPT)


def generate_full_backstory(llm: LLM, persona: dict, output_dir: Path) -> None:
    """Generate and save the complete backstory."""
    from rich.console import Console
    console = Console()

    backstory_dir = output_dir / "backstory"
    backstory_dir.mkdir(parents=True, exist_ok=True)

    console.print("  [dim]Generating childhood...[/]")
    childhood = generate_childhood(llm, persona)
    (backstory_dir / "childhood.md").write_text(f"# {persona['name']} — Childhood\n\n{childhood}")

    console.print("  [dim]Generating life story...[/]")
    life_story = generate_life_story(llm, persona, childhood)
    (backstory_dir / "life_story.md").write_text(f"# {persona['name']} — Life Story\n\n{life_story}")

    console.print("  [dim]Generating future plans...[/]")
    future = generate_future_plans(llm, persona, life_story)
    (backstory_dir / "future_plans.md").write_text(f"# {persona['name']} — Future Plans\n\n{future}")
