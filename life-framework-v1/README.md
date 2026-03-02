# LIFE — LoRA Influencer Fabrication Engine

AI Influencer Swarm Management System. Create deeply detailed personas, generate daily content calendars with Higgsfield-optimized image prompts, and manage your entire AI influencer swarm from the terminal or chat.

## Quick Start

```bash
# 1. Install
cd /home/alex/Documents/Projects-AGravity/life-framework
pip install -e .

# 2. Configure API keys
cp .env.example .env
# Edit .env with your OpenRouter and Brave API keys

# 3. Run
life                    # Interactive mode
life --create           # Jump to persona creation
life --generate "Giulia"  # Generate calendar for a persona
```

## Features

- **Persona DNA System** — Tokenized physical descriptions for LoRA consistency (`@GIULIA.physical.face`)
- **Wardrobe Combinatorics** — Individual pieces combined algorithmically by occasion/season
- **Scene Composition Pipeline** — 16 scene types with 3-slide carousel variations
- **Narrative Arc Engine** — Multi-week story progressions for content continuity
- **Higgsfield Optimization** — Prompts condensed to 50-80 words for Seedream 4.5
- **Content Calendar** — 6 posts/day × 3 slides + 1-2 stories = ~600 prompts/month
- **Caption Generator** — Instagram captions with hashtag strategy
- **Event Discovery** — Real upcoming events via Brave Search API
- **Chat Mode** — Use from this chat by saying "create" or "calendar"

## Folder Structure

```
personas/giulia_rosetti/
├── persona.yaml           # Core DNA + physical tokens
├── backstory/             # Childhood, life story, future plans
├── appearance/            # Physical DNA + wardrobe/shoes/makeup/hair/nails/accessories
├── world/                 # Apartment (multi-angle), devices, events
├── content/               # Strategy + narrative arcs
└── calendar/2026-03/      # Monthly content with daily post folders
    ├── overview.md
    └── day-01/
        ├── post_01.md     # 3 slides + caption + hashtags
        ├── ...
        ├── post_06.md
        └── stories.md
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | Your OpenRouter API key |
| `OPENROUTER_MODEL` | LLM model (default: `anthropic/claude-sonnet-4-20250514`) |
| `BRAVE_API_KEY` | Brave Search API key (optional, for event discovery) |
