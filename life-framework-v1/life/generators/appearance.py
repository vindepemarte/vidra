"""Appearance generator — physical DNA, wardrobe, shoes, makeup, hair, nails, accessories."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from life.ai.llm import LLM

SYSTEM_PROMPT = """You are an expert fashion stylist, beauty consultant, and character designer.
You create hyper-detailed, visually specific descriptions perfect for AI image generation.
Every item description must be vivid enough to visualize exactly — colors, textures, cuts, brands, materials.
Use real brands, real product names, real colors. Be SPECIFIC, not generic."""


def generate_physical(llm: LLM, persona: dict) -> dict[str, Any]:
    """Generate the physical DNA — tokenized face, body, skin, hair descriptions."""
    prompt = f"""Create an extremely detailed physical description for this AI influencer character.
This description will be used as reference tokens for AI image generation, so be VERY specific and consistent.

Name: {persona['name']}
Age: {persona['age']}
Gender: {persona.get('gender', 'female')}
City: {persona['city']}
Niche: {persona['niche']}
Vibe: {persona.get('vibe', 'modern, attractive')}

Return a JSON object with these exact keys:
{{
    "face": "detailed face description — shape, cheekbones, eye shape + color with specific detail, eyebrows, nose, lips, jaw, any distinctive features",
    "eyes": "detailed eye description — shape, color with nuance (flecks, ring, depth), lashes, brow shape and color",
    "hair_default": "default hairstyle — color with specific shade, length, texture, how it falls naturally",
    "body": "height (specific), build, proportions, posture, notable features",
    "skin": "complexion, undertone, texture, any beauty marks or freckles",
    "hands": "hand description — nail bed shape, finger length, any jewelry marks",
    "smile": "how they smile — teeth, dimples, how it changes their face",
    "ethnicity_features": "ethnic background that informs their look, described respectfully and specifically"
}}

Each value should be 30-60 words of precise visual description. NO vague terms like 'beautiful' or 'attractive' — describe the SPECIFIC features that make them striking."""

    return llm.generate_json(prompt, system=SYSTEM_PROMPT)


def generate_wardrobe_category(
    llm: LLM, persona: dict, category: str, count: int = 8
) -> list[dict[str, Any]]:
    """Generate wardrobe items for a category (tops, bottoms, dresses, outerwear, etc.)."""
    prompt = f"""Create {count} wardrobe items in the "{category}" category for this AI influencer:

Name: {persona['name']}
Age: {persona['age']}
City: {persona['city']}
Niche: {persona['niche']}
Vibe: {persona.get('vibe', 'modern')}
Gender: {persona.get('gender', 'female')}

Return a JSON array. Each item must have:
{{
    "id": "{category}_001",
    "name": "Descriptive name with brand",
    "description": "Full visual description — fabric, cut, fit, color(s), texture, details, buttons/zippers, how it drapes",
    "brand": "Real brand name",
    "style_tags": ["casual", "elegant", "streetwear", "sporty", "cozy", "formal", "date_night", "business"],
    "season": ["spring", "summer", "fall", "winter"],
    "colors": ["primary color", "secondary color"],
    "formality": 5,
    "prompt_snippet": "A condensed 10-15 word description optimized for image generation prompts"
}}

The items should reflect this person's niche and style. Mix everyday pieces with statement pieces.
Include a range of formality levels. Use REAL brands appropriate for their lifestyle.
Make descriptions vivid enough to generate in AI — fabric textures, exact colors, how it fits.
Number IDs sequentially: {category}_001, {category}_002, etc."""

    return llm.generate_list(prompt, system=SYSTEM_PROMPT)


def generate_shoes(llm: LLM, persona: dict) -> list[dict[str, Any]]:
    """Generate shoe collection."""
    prompt = f"""Create 10 pairs of shoes for this AI influencer's collection:

Name: {persona['name']}, Age: {persona['age']}, City: {persona['city']}
Niche: {persona['niche']}, Vibe: {persona.get('vibe', 'modern')}
Gender: {persona.get('gender', 'female')}

Return a JSON array. Each shoe must have:
{{
    "id": "shoes_001",
    "name": "Full name with brand and model",
    "brand": "Real brand",
    "description": "Detailed visual description — material, color, heel height/sole type, hardware, stitching, how it looks on foot",
    "style_tags": ["casual", "elegant", "sporty", "formal", "everyday"],
    "season": ["spring", "summer", "fall", "winter"],
    "colors": ["primary", "secondary"],
    "formality": 5,
    "prompt_snippet": "10-15 word condensed description for prompts"
}}

Mix: sneakers, heels/dress shoes, boots, sandals, loafers, statement shoes. Real brands and models."""

    return llm.generate_list(prompt, system=SYSTEM_PROMPT)


def generate_makeup_styles(llm: LLM, persona: dict) -> list[dict[str, Any]]:
    """Generate makeup style collection."""
    prompt = f"""Create 8 makeup looks for this AI influencer:

Name: {persona['name']}, Age: {persona['age']}, Niche: {persona['niche']}
Vibe: {persona.get('vibe', 'modern')}, Gender: {persona.get('gender', 'female')}

Return a JSON array. Each makeup look must have:
{{
    "id": "makeup_001",
    "name": "Look name (e.g., 'Soft Glam Evening')",
    "description": "Full description — foundation finish, eye look (shadow colors, liner style, lash look), brow style, blush/contour, lip color and finish, highlight placement",
    "occasion": ["everyday", "night_out", "brunch", "gym", "formal", "date_night", "content_creation", "beach"],
    "vibe": "2-3 word mood description",
    "prompt_snippet": "15-20 word condensed description for prompts, structured as: 'wearing [makeup details]'"
}}

Range from natural/no-makeup-makeup to full glam. Each should be distinctly different."""

    return llm.generate_list(prompt, system=SYSTEM_PROMPT)


def generate_hairstyles(llm: LLM, persona: dict, physical: dict) -> list[dict[str, Any]]:
    """Generate hairstyle variations."""
    base_hair = physical.get("hair_default", "mid-length hair")
    prompt = f"""Create 8 hairstyle variations for this AI influencer:

Name: {persona['name']}, Base hair: {base_hair}
Niche: {persona['niche']}, Vibe: {persona.get('vibe', 'modern')}

Their natural hair is: {base_hair}

Return a JSON array. Each hairstyle must have:
{{
    "id": "hair_001",
    "name": "Style name",
    "description": "Full description — how the hair is styled, volume, texture, any accessories, how it frames the face, parting",
    "occasion": ["everyday", "formal", "casual", "workout", "night_out", "content", "cozy"],
    "prompt_snippet": "10-15 word prompt description, always referencing the base hair color/type"
}}

Include: down/natural, ponytail, messy bun, sleek, braided, half-up, styled waves, slicked back, etc.
Each must build on their natural hair characteristics."""

    return llm.generate_list(prompt, system=SYSTEM_PROMPT)


def generate_nail_styles(llm: LLM, persona: dict) -> list[dict[str, Any]]:
    """Generate nail style collection."""
    prompt = f"""Create 6 nail styles for this AI influencer:

Name: {persona['name']}, Niche: {persona['niche']}
Vibe: {persona.get('vibe', 'modern')}, Gender: {persona.get('gender', 'female')}

Return a JSON array. Each nail style must have:
{{
    "id": "nails_001",
    "name": "Style name",
    "description": "Full description — shape (almond, square, coffin, round), length, color/design, finish (matte, glossy, chrome), any art or embellishments",
    "occasion": ["everyday", "formal", "trendy", "minimal", "statement"],
    "prompt_snippet": "8-12 word description for prompts"
}}

Range from minimal/natural to bold statement nails. Include current trends."""

    return llm.generate_list(prompt, system=SYSTEM_PROMPT)


def generate_accessories(llm: LLM, persona: dict) -> list[dict[str, Any]]:
    """Generate accessories collection."""
    prompt = f"""Create 12 accessories for this AI influencer's collection:

Name: {persona['name']}, Age: {persona['age']}, City: {persona['city']}
Niche: {persona['niche']}, Vibe: {persona.get('vibe', 'modern')}
Gender: {persona.get('gender', 'female')}

Return a JSON array. Each accessory must have:
{{
    "id": "acc_001",
    "name": "Full name with brand",
    "type": "jewelry|bag|sunglasses|hat|scarf|belt|watch",
    "brand": "Real brand",
    "description": "Detailed visual description — material, color, size, hardware, how it's worn",
    "style_tags": ["casual", "elegant", "sporty", "statement", "minimal", "everyday"],
    "occasion": ["daily", "formal", "casual", "night_out", "brunch", "travel"],
    "prompt_snippet": "8-12 word description for prompts"
}}

Include: watches, rings, necklaces, earrings, bracelets, bags, sunglasses, belts. Real luxury + accessible brands."""

    return llm.generate_list(prompt, system=SYSTEM_PROMPT)


def generate_full_appearance(llm: LLM, persona: dict, output_dir: Path) -> dict[str, Any]:
    """Generate and save all appearance assets. Returns physical dict for persona.yaml."""
    from rich.console import Console
    console = Console()

    appearance_dir = output_dir / "appearance"
    appearance_dir.mkdir(parents=True, exist_ok=True)
    wardrobe_dir = appearance_dir / "wardrobe"
    wardrobe_dir.mkdir(exist_ok=True)

    # 1. Physical DNA
    console.print("  [dim]Generating physical DNA...[/]")
    physical = generate_physical(llm, persona)
    physical_md = f"# {persona['name']} — Physical Description\n\n"
    for key, value in physical.items():
        token = f"@{persona.get('handle', persona['name'].upper().split()[0])}.physical.{key}"
        physical_md += f"### {key.replace('_', ' ').title()}\n`{token}`\n\n{value}\n\n"
    (appearance_dir / "physical.md").write_text(physical_md)

    # 2. Wardrobe categories
    categories = ["tops", "bottoms", "dresses", "outerwear"]
    if persona.get("gender", "female") == "male":
        categories = ["shirts", "trousers", "suits", "outerwear"]

    for cat in categories:
        console.print(f"  [dim]Generating wardrobe: {cat}...[/]")
        items = generate_wardrobe_category(llm, persona, cat)
        with open(wardrobe_dir / f"{cat}.yaml", "w") as f:
            yaml.dump(items, f, default_flow_style=False, allow_unicode=True)

    # 3. Shoes
    console.print("  [dim]Generating shoes...[/]")
    shoes = generate_shoes(llm, persona)
    with open(appearance_dir / "shoes.yaml", "w") as f:
        yaml.dump(shoes, f, default_flow_style=False, allow_unicode=True)

    # 4. Makeup
    console.print("  [dim]Generating makeup styles...[/]")
    makeup = generate_makeup_styles(llm, persona)
    with open(appearance_dir / "makeup_styles.yaml", "w") as f:
        yaml.dump(makeup, f, default_flow_style=False, allow_unicode=True)

    # 5. Hairstyles
    console.print("  [dim]Generating hairstyles...[/]")
    hairstyles = generate_hairstyles(llm, persona, physical)
    with open(appearance_dir / "hairstyles.yaml", "w") as f:
        yaml.dump(hairstyles, f, default_flow_style=False, allow_unicode=True)

    # 6. Nails
    console.print("  [dim]Generating nail styles...[/]")
    nails = generate_nail_styles(llm, persona)
    with open(appearance_dir / "nail_styles.yaml", "w") as f:
        yaml.dump(nails, f, default_flow_style=False, allow_unicode=True)

    # 7. Accessories
    console.print("  [dim]Generating accessories...[/]")
    accessories = generate_accessories(llm, persona)
    with open(appearance_dir / "accessories.yaml", "w") as f:
        yaml.dump(accessories, f, default_flow_style=False, allow_unicode=True)

    return physical
