"""Caption and hashtag generator for Instagram posts."""

from __future__ import annotations

from life.ai.llm import LLM

CAPTION_SYSTEM = """You are an expert Instagram caption writer for AI influencers.
You write captions that feel authentic, engaging, and on-brand.
Mix long-form storytelling captions with short punchy ones.
Always include a call-to-action or engagement hook.
Use emojis sparingly but effectively."""


def generate_caption(
    llm: LLM,
    persona: dict,
    scene_type: str,
    outfit_desc: str,
    post_number: int,
    narrative_context: str = "",
) -> dict[str, str]:
    """Generate an Instagram caption with hashtags.

    Returns dict with 'caption' and 'hashtags' keys.
    """
    prompt = f"""Write an Instagram carousel caption for this AI influencer's post:

Influencer: {persona['name']} (@{persona.get('instagram_handle', persona['name'].lower().replace(' ', ''))})
Niche: {persona['niche']}
City: {persona['city']}
Scene: {scene_type}
Outfit: {outfit_desc}
{"Story arc context: " + narrative_context if narrative_context else ""}

Post #{post_number} of the day — vary the length and style:
- Posts 1, 3, 5: Short and punchy (1-2 lines + emoji)
- Posts 2, 4: Medium storytelling (3-4 lines, personal touch)
- Post 6: Engaging question or call-to-action

Return a JSON object:
{{
    "caption": "The full caption text with emojis",
    "hashtags": "15 hashtags separated by spaces (5 popular + 5 niche + 5 branded/personal)"
}}"""

    result = llm.generate_json(prompt, system=CAPTION_SYSTEM, temperature=0.85)
    return {
        "caption": result.get("caption", ""),
        "hashtags": result.get("hashtags", ""),
    }


def generate_story_caption(llm: LLM, persona: dict, story_context: str) -> str:
    """Generate a short, casual story caption/text overlay."""
    prompt = f"""Write a short Instagram story text overlay for {persona['name']}:

Context: {story_context}

Return just 5-15 words. Casual, personal, trendy. Can include 1-2 emojis.
No quotes, just the text."""

    return llm.chat(prompt, system=CAPTION_SYSTEM, temperature=0.9, max_tokens=50).strip()
