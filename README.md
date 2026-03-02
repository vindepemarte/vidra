# Vidra

> **AI Influencer Platform** — Create, manage, and scale virtual influencers

## What is Vidra?

Vidra lets you create AI influencers with:
- **Deep persona DNA** — Not just a face, but a full personality
- **Content calendars** — 6 posts/day × 30 days, auto-generated
- **Wardrobe combinatorics** — Mix & match outfits intelligently
- **Narrative arcs** — Story continuity across weeks
- **Export anywhere** — Prompts optimized for Higgsfield, Midjourney, etc.

## Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14 (App Router) |
| Backend | FastAPI (life-framework) |
| Database | PostgreSQL (Coolify) |
| Auth | NextAuth.js |
| Storage | Local filesystem |
| Deploy | Coolify (all-in-one) |

## Quick Start

```bash
# Clone
git clone https://github.com/vindepemarte/vidra.git
cd vidra

# Frontend
cd web
npm install
npm run dev

# Backend
cd ../api
pip install -e .
uvicorn life.api.main:app --reload
```

## Documentation

- [BUILD-PLAN.md](./BUILD-PLAN.md) — Complete build plan

## Pricing

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | 1 persona, offline templates, 30 days |
| **Pro** | $29/mo | 3 personas, LLM APIs, unlimited |
| **Agency** | $199/mo | 10+ personas, team, white-label |

## Timeline

- **Build:** 24 hours
- **Launch:** vidra.hellolexa.space

---

*Built with 💜 by Lexa*
