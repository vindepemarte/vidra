"""Prompt quality scoring and validation."""

from __future__ import annotations

import re


def score_prompt(prompt: str, handle: str) -> dict[str, any]:
    """Score a Higgsfield prompt for quality and completeness.

    Returns a dict with individual scores and overall rating.
    """
    scores = {}

    # 1. Length check (optimal: 50-80 words for Higgsfield)
    word_count = len(prompt.split())
    if 50 <= word_count <= 80:
        scores["length"] = 10
    elif 40 <= word_count <= 100:
        scores["length"] = 7
    elif 30 <= word_count <= 120:
        scores["length"] = 5
    else:
        scores["length"] = 3
    scores["word_count"] = word_count

    # 2. Physical detail coverage
    physical_markers = ["face", "eyes", "hair", "skin", "body", "lips", "height"]
    found = sum(1 for m in physical_markers if m.lower() in prompt.lower())
    scores["physical_coverage"] = min(10, int((found / len(physical_markers)) * 10))

    # 3. Scene detail coverage
    scene_markers = ["wearing", "dressed", "outfit", "standing", "sitting", "room",
                     "lighting", "natural light", "soft light", "golden hour",
                     "selfie", "photo", "camera", "angle"]
    found = sum(1 for m in scene_markers if m.lower() in prompt.lower())
    scores["scene_coverage"] = min(10, int((found / 5) * 10))

    # 4. Contradiction check
    contradictions = []
    if re.search(r"indoor|room|apartment|kitchen|bedroom", prompt, re.I) and \
       re.search(r"outdoor|park|street|beach|garden", prompt, re.I):
        contradictions.append("indoor + outdoor conflict")
    if re.search(r"sneakers|trainers", prompt, re.I) and \
       re.search(r"heels|stilettos|pumps", prompt, re.I):
        contradictions.append("sneakers + heels conflict")
    if re.search(r"morning|sunrise", prompt, re.I) and \
       re.search(r"night|evening|sunset|dark", prompt, re.I):
        contradictions.append("morning + night conflict")
    scores["contradictions"] = contradictions
    scores["contradiction_score"] = 10 if not contradictions else max(0, 10 - len(contradictions) * 5)

    # 5. Unresolved tokens
    unresolved = re.findall(r"\[UNRESOLVED:.*?\]", prompt)
    scores["unresolved_tokens"] = unresolved
    scores["token_score"] = 10 if not unresolved else 0

    # 6. Quality modifiers
    quality_markers = ["4K", "photorealistic", "ultra-detailed", "sharp focus",
                       "professional", "high quality", "detailed"]
    found = sum(1 for m in quality_markers if m.lower() in prompt.lower())
    scores["quality_modifiers"] = min(10, found * 3)

    # Overall
    numeric_scores = [
        scores["length"],
        scores["physical_coverage"],
        scores["scene_coverage"],
        scores["contradiction_score"],
        scores["token_score"],
        scores["quality_modifiers"],
    ]
    scores["overall"] = round(sum(numeric_scores) / len(numeric_scores), 1)

    return scores


def validate_prompt_batch(prompts: list[str], handle: str) -> dict[str, any]:
    """Validate a batch of prompts and return aggregate stats."""
    results = [score_prompt(p, handle) for p in prompts]
    avg_score = sum(r["overall"] for r in results) / len(results) if results else 0
    low_quality = [i for i, r in enumerate(results) if r["overall"] < 5]
    contradicted = [i for i, r in enumerate(results) if r["contradictions"]]

    return {
        "total_prompts": len(prompts),
        "average_score": round(avg_score, 1),
        "low_quality_indices": low_quality,
        "contradicted_indices": contradicted,
        "individual_scores": results,
    }
