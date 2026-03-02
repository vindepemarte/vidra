"""Higgsfield-optimized prompt assembly and condensation."""

from __future__ import annotations

from life.ai.llm import LLM

CONDENSER_SYSTEM = """You are an expert AI image prompt engineer specializing in Higgsfield Seedream 4.5.
Your job is to condense detailed scene descriptions into optimized 50-80 word prompts.

Rules:
1. Use natural, flowing language — no keyword spam
2. Structure: Subject → Style → Composition → Lighting → Camera
3. Keep the MOST important visual details (face, outfit, setting)
4. Remove redundant words but keep specificity
5. Always end with quality modifiers
6. The prompt must feel like a coherent sentence, not a list
7. Preserve specific brand names, colors, and materials
8. NEVER exceed 80 words"""


def condense_prompt(llm: LLM, raw_prompt: str) -> str:
    """Use LLM to condense a raw detailed prompt to 50-80 words for Higgsfield.
    
    If the prompt is already short (e.g. a minimal differential prompt for 
    Slide 2 or 3), just return it as-is without LLM modification.
    """
    if len(raw_prompt.split()) <= 40:
        return raw_prompt
        
    prompt = f"""Condense this detailed image description into an optimized 50-80 word prompt 
for Higgsfield Seedream 4.5 image generation. Keep the most visually important details.

Raw description:
{raw_prompt}

Return ONLY the condensed prompt, nothing else. No quotes, no explanation."""

    result = llm.chat(prompt, system=CONDENSER_SYSTEM, temperature=0.6, max_tokens=200)
    return result.strip().strip('"').strip("'")


def condense_prompts_batch(llm: LLM, raw_prompts: list[str]) -> list[str]:
    """Condense a batch of prompts (calls LLM once with all prompts for efficiency)."""
    if len(raw_prompts) <= 3:
        return [condense_prompt(llm, p) for p in raw_prompts]

    # For larger batches, process in groups
    numbered = "\n\n".join(f"[PROMPT {i+1}]\n{p}" for i, p in enumerate(raw_prompts))

    prompt = f"""Condense each of these detailed descriptions into separate optimized 50-80 word prompts 
for Higgsfield Seedream 4.5. Keep the most visually important details.

{numbered}

Return each condensed prompt on a separate line, prefixed with [PROMPT N]:
[PROMPT 1] condensed prompt here
[PROMPT 2] condensed prompt here
etc.

No quotes, no extra explanation."""

    result = llm.chat(prompt, system=CONDENSER_SYSTEM, temperature=0.6, max_tokens=2000)

    # Parse the numbered responses
    condensed = []
    for line in result.strip().split("\n"):
        line = line.strip()
        if line.startswith("[PROMPT"):
            # Remove the [PROMPT N] prefix
            idx = line.index("]")
            condensed.append(line[idx + 1:].strip())
        elif line and not line.startswith("["):
            condensed.append(line)

    # Pad if we got fewer results than expected
    while len(condensed) < len(raw_prompts):
        condensed.append(condense_prompt(llm, raw_prompts[len(condensed)]))

    return condensed[:len(raw_prompts)]


def generate_story_prompt(llm: LLM, persona: dict, scene_context: str) -> str:
    """Generate a behind-the-scenes story prompt."""
    prompt = f"""Create a casual, behind-the-scenes Instagram story image prompt for this influencer.
The story should feel candid and personal, like a real moment captured.

Influencer: {persona['name']}, {persona['niche']} in {persona['city']}
Today's content context: {scene_context}

Generate a 40-60 word natural language prompt for Higgsfield Seedream 4.5.
The story should show a casual, unpolished moment — getting ready, behind the camera, 
walking somewhere, a detail shot, or a genuine reaction.

Return ONLY the prompt, nothing else."""

    return llm.chat(prompt, system=CONDENSER_SYSTEM, temperature=0.8, max_tokens=150).strip()
