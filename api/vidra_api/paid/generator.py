from __future__ import annotations

import json
from dataclasses import dataclass

from vidra_api.offline.generator import DayDraft, OfflineCalendarEngine


@dataclass
class PaidGenerationResult:
    days: list[DayDraft]
    model_used: str


class PaidCalendarEngine:
    """Calendar enhancement for PRO/MAX using OpenRouter-backed planning."""

    @staticmethod
    def _build_strategy_profile(*, persona_name: str, niche: str, city: str, tier: str) -> tuple[dict, str]:
        from life.ai.llm import LLM

        llm = LLM()
        prompt = f"""
You are building a high-performance Instagram content strategy.
Return valid JSON with this exact structure:
{{
  "positioning": "short sentence",
  "content_pillars": ["...", "...", "..."],
  "hooks": ["..."],
  "cta_patterns": ["..."],
  "visual_directions": ["..."],
  "hashtag_clusters": ["#a #b #c"]
}}

Constraints:
- Tier: {tier.upper()}
- Persona: {persona_name}
- Niche: {niche}
- City: {city}
- Hooks should be short and punchy.
- CTAs should drive comments, saves, and DMs.
- No markdown. JSON only.
""".strip()

        strategy = llm.generate_json(prompt=prompt, temperature=0.6, max_tokens=1400)
        if not isinstance(strategy, dict):
            raise ValueError("Invalid strategy response")

        return strategy, llm.model

    @staticmethod
    def generate_month(*, persona_name: str, niche: str, city: str, month: int, year: int, tier: str) -> PaidGenerationResult:
        base_days = OfflineCalendarEngine.generate_month(
            persona_name=persona_name,
            niche=niche,
            city=city,
            month=month,
            year=year,
        )

        strategy, model_used = PaidCalendarEngine._build_strategy_profile(
            persona_name=persona_name,
            niche=niche,
            city=city,
            tier=tier,
        )

        hooks = strategy.get("hooks") or ["Stop scrolling:", "Today’s move:", "Creator memo:"]
        ctas = strategy.get("cta_patterns") or ["Comment your take.", "Save this for later."]
        visuals = strategy.get("visual_directions") or ["cinematic natural light", "editorial framing"]
        hashtags = strategy.get("hashtag_clusters") or [f"#{niche.lower().replace(' ', '')} #creator #content"]
        pillars = strategy.get("content_pillars") or [niche]

        for day_index, day in enumerate(base_days):
            for post_index, post in enumerate(day.posts):
                hook = hooks[(day_index + post_index) % len(hooks)]
                cta = ctas[(day_index + post_index) % len(ctas)]
                visual = visuals[(day_index + post_index) % len(visuals)]
                pillar = pillars[(day_index + post_index) % len(pillars)]
                tag_line = hashtags[(day_index + post_index) % len(hashtags)]

                if isinstance(tag_line, list):
                    tag_line = " ".join([str(v) for v in tag_line])
                if not isinstance(tag_line, str):
                    tag_line = json.dumps(tag_line)

                post.caption = f"{hook} {post.caption} {cta}".strip()
                ugc_mod = "UGC vibe, shot on phone, slight grain, imperfect framing, half-face crops, wrist/hand in frame, natural light"
                post.prompt = (
                    f"{post.prompt}. Pillar: {pillar}. Visual direction: {visual}. {ugc_mod}. "
                    f"Prioritize authentic feed look over studio perfection."
                )
                post.hashtags = tag_line

                if tier == "max":
                    post.caption = f"{post.caption} DM for partnership details."
                    post.prompt = f"{post.prompt} Include monetization framing and brand-safe composition; retain UGC realism."

        return PaidGenerationResult(days=base_days, model_used=model_used)
