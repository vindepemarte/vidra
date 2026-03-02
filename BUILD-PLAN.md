# VIDRA - AI Influencer Platform
## Complete Build Plan (Coolify-Only)

> Domain: vidra.hellolexa.space (subdomain) → vidra.ai (later)
> Timeline: 1 DAY
> Stack: Next.js 14 + PostgreSQL + FastAPI (all on Coolify)
> Auth: NextAuth.js
> Storage: Local filesystem (or S3 later)

---

## PART 1: ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────┐
│                    COOLIFY (Your Server)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   VIDRA STACK                        │  │
│  │                                                      │  │
│  │  ┌──────────────┐      ┌──────────────┐             │  │
│  │  │  NEXT.JS 14  │─────▶│  POSTGRESQL  │             │  │
│  │  │  FRONTEND    │      │  DATABASE    │             │  │
│  │  │              │      │              │             │  │
│  │  │ - Dashboard  │      │ - personas   │             │  │
│  │  │ - Onboarding │      │ - wardrobe   │             │  │
│  │  │ - Calendar   │      │ - calendar   │             │  │
│  │  │ - Auth       │      │ - users      │             │  │
│  │  └──────────────┘      └──────────────┘             │  │
│  │         │                      │                     │  │
│  │         │                      │                     │  │
│  │         ▼                      ▼                     │  │
│  │  ┌──────────────┐      ┌──────────────┐             │  │
│  │  │  FASTAPI     │      │  FILE        │             │  │
│  │  │  BACKEND     │      │  STORAGE     │             │  │
│  │  │              │      │  (LOCAL)     │             │  │
│  │  │ life-        │      │              │             │  │
│  │  │ framework    │      │ - wardrobe   │             │  │
│  │  │              │      │   images     │             │  │
│  │  │ - Offline    │      │ - exports    │             │  │
│  │  │   templates  │      │              │             │  │
│  │  │ - LLM APIs   │      │              │             │  │
│  │  │ - Export     │      │              │             │  │
│  │  └──────────────┘      └──────────────┘             │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              EXTERNAL APIs (PAID TIER)               │  │
│  │                                                      │  │
│  │  - OpenRouter (LLM) ──► $0.01-0.03/request          │  │
│  │  - Brave Search ──────► $0.005/search               │  │
│  │  - Higgsfield ─────────► User brings own account    │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘

WHY COOLIFY-ONLY?
─────────────────────────────────────────────────────────────
✅ Full control (your server, your data)
✅ No external dependencies
✅ No rate limits or quotas
✅ Free forever (no vendor lock-in)
✅ Already deployed and running
✅ PostgreSQL included
✅ Easy to scale
✅ One platform to manage
```

---

## PART 2: TECH STACK DETAILS

### 2.1 Frontend (Next.js 14)

| Component | Technology | Why |
|-----------|------------|-----|
| Framework | Next.js 14 (App Router) | Modern, fast, good DX |
| Styling | TailwindCSS | Already using |
| UI Components | shadcn/ui | Beautiful, accessible |
| State | React Context + SWR | Simple, effective |
| Auth | NextAuth.js | Self-contained, no external deps |
| Forms | React Hook Form + Zod | Type-safe validation |

### 2.2 Backend (FastAPI)

| Component | Technology | Why |
|-----------|------------|-----|
| Framework | FastAPI | Already in life-framework |
| Database | PostgreSQL | Robust, scalable, free |
| ORM | SQLAlchemy | Python standard |
| Migrations | Alembic | Built into SQLAlchemy |
| Validation | Pydantic | Built into FastAPI |
| Auth | JWT (NextAuth compatible) | Standard, secure |

### 2.3 Database (PostgreSQL on Coolify)

| Table | Purpose |
|-------|---------|
| users | User accounts (synced with NextAuth) |
| personas | AI influencer profiles |
| wardrobe_items | Clothing/accessories |
| calendar_days | Daily content structure |
| posts | Individual posts (6/day) |
| stories | Daily stories (2/day) |
| api_usage | Track LLM/search usage |

### 2.4 Storage (Local Filesystem)

```
/var/lib/vidra/
├── wardrobe/           # Wardrobe images
│   ├── {user_id}/
│   │   ├── tops/
│   │   ├── bottoms/
│   │   ├── dresses/
│   │   └── ...
│
├── exports/            # Generated exports
│   ├── {user_id}/
│   │   ├── calendar_2026-03.md
│   │   ├── calendar_2026-03.json
│   │   └── ...
│
└── temp/               # Temporary files
```

---

## PART 3: AUTHENTICATION (NextAuth.js)

### 3.1 Setup

```typescript
// lib/auth.ts
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { Pool } from "pg"
import { compare } from "bcrypt"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const pool = new Pool({ connectionString: process.env.DATABASE_URL })
        const result = await pool.query(
          "SELECT * FROM users WHERE email = $1",
          [credentials.email]
        )
        const user = result.rows[0]
        
        if (user && await compare(credentials.password, user.password)) {
          return { id: user.id, email: user.email, name: user.name }
        }
        
        return null
      }
    })
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    signUp: "/signup"
  }
})
```

### 3.2 User Schema

```sql
-- Users table (managed by NextAuth)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,  -- bcrypt hashed
    name TEXT,
    tier TEXT DEFAULT 'free',  -- 'free', 'pro', 'agency'
    api_keys JSONB DEFAULT '{}',  -- {"openrouter": "xxx", "brave": "xxx"}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users NOT NULL,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    UNIQUE(provider, provider_account_id)
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users NOT NULL,
    expires TIMESTAMPTZ NOT NULL,
    session_token TEXT UNIQUE NOT NULL
);
```

---

## PART 4: LIFE-FRAMEWORK ADDITIONS

### 4.1 New Directory Structure

```
life-framework/
├── life/
│   ├── api/                    # NEW: FastAPI endpoints
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI app
│   │   ├── database.py         # PostgreSQL connection
│   │   ├── auth.py             # JWT validation
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── personas.py     # CRUD for personas
│   │   │   ├── wardrobe.py     # Wardrobe management
│   │   │   ├── calendar.py     # Calendar generation
│   │   │   └── export.py       # Export endpoints
│   │   └── schemas.py          # Pydantic models
│   │
│   ├── templates/              # NEW: Offline templates (FREE tier)
│   │   ├── personas/           # 20+ persona templates
│   │   │   ├── fashion.yaml
│   │   │   ├── fitness.yaml
│   │   │   ├── lifestyle.yaml
│   │   │   ├── travel.yaml
│   │   │   ├── beauty.yaml
│   │   │   ├── food.yaml
│   │   │   ├── tech.yaml
│   │   │   ├── gaming.yaml
│   │   │   ├── business.yaml
│   │   │   ├── art.yaml
│   │   │   ├── music.yaml
│   │   │   └── comedy.yaml
│   │   ├── captions/           # 200+ caption templates
│   │   │   ├── selfie.yaml     # 40+ selfie captions
│   │   │   ├── outfit.yaml     # 40+ outfit captions
│   │   │   ├── lifestyle.yaml  # 40+ lifestyle captions
│   │   │   ├── travel.yaml     # 40+ travel captions
│   │   │   └── fitness.yaml    # 40+ fitness captions
│   │   └── narratives/         # 30+ narrative patterns
│   │       ├── new_beginning.yaml
│   │       ├── romance.yaml
│   │       ├── travel.yaml
│   │       ├── fitness_journey.yaml
│   │       ├── career_growth.yaml
│   │       └── ...
│   │
│   ├── offline/                # NEW: Offline-first features
│   │   ├── __init__.py
│   │   ├── persona_builder.py  # Template-based persona creation
│   │   ├── caption_gen.py      # Template-based captions
│   │   ├── narrative.py        # Rule-based narrative arcs
│   │   └── wardrobe_ai.py      # Color theory + style rules
│   │
│   └── export/                 # NEW: Export formats
│       ├── __init__.py
│       ├── markdown.py
│       ├── json_export.py
│       ├── csv_export.py
│       ├── ical.py
│       └── notion.py
│
├── migrations/                 # NEW: Database migrations
│   ├── versions/
│   │   ├── 001_initial.py
│   │   └── ...
│   └── alembic.ini
│
├── tests/                      # NEW: Tests
│   ├── test_api.py
│   ├── test_offline.py
│   └── test_export.py
│
├── web/                        # NEW: Next.js dashboard
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── public/
│
├── docker-compose.yml          # UPDATED: Full stack
├── Dockerfile.api              # NEW: FastAPI container
├── Dockerfile.web              # NEW: Next.js container
├── .env.example
└── pyproject.toml              # UPDATED: New deps
```

### 4.2 New Dependencies

```toml
# pyproject.toml additions
[project.dependencies]
# ... existing deps ...

# API
fastapi = "^0.115.0"
uvicorn = {extras = ["standard"], version = "^0.34.0"}
python-multipart = "^0.0.20"

# Database
sqlalchemy = "^2.0.0"
alembic = "^1.14.0"
asyncpg = "^0.30.0"  # Async PostgreSQL

# Auth
python-jose = {extras = ["cryptography"], version = "^3.3.0"}
passlib = {extras = ["bcrypt"], version = "^1.7.4"}

# Image processing
pillow = "^11.1.0"

# Export
icalendar = "^6.1.0"
```

### 4.3 FastAPI Main App

```python
# life/api/main.py
"""FastAPI server for Vidra."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from life.api.routes import personas, wardrobe, calendar, export
from life.api.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown
    pass

app = FastAPI(
    title="Vidra API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://vidra.hellolexa.space",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files (wardrobe images, exports)
app.mount("/static", StaticFiles(directory="/var/lib/vidra"), name="static")

# Routes
app.include_router(personas.router, prefix="/api/personas", tags=["personas"])
app.include_router(wardrobe.router, prefix="/api/wardrobe", tags=["wardrobe"])
app.include_router(calendar.router, prefix="/api/calendar", tags=["calendar"])
app.include_router(export.router, prefix="/api/export", tags=["export"])

@app.get("/health")
async def health():
    return {"status": "ok", "service": "vidra-api"}
```

### 4.4 Database Connection

```python
# life/api/database.py
"""PostgreSQL database connection."""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://vidra:vidra@localhost/vidra")

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

async def init_db():
    """Initialize database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db():
    """Get database session."""
    async with async_session() as session:
        yield session
```

---

## PART 5: DATABASE SCHEMA

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users (managed by NextAuth, replicated here for API access)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'agency')),
    api_keys JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Personas (AI Influencers)
CREATE TABLE personas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users NOT NULL ON DELETE CASCADE,
    name TEXT NOT NULL,
    handle TEXT NOT NULL,
    age INTEGER CHECK (age >= 18 AND age <= 100),
    gender TEXT CHECK (gender IN ('female', 'male', 'other')),
    city TEXT,
    niche TEXT,
    vibe TEXT,
    inspirations TEXT,
    income_vibe TEXT,
    soul_id TEXT,  -- Higgsfield Soul ID
    instagram_handle TEXT,
    physical JSONB DEFAULT '{}',
    template TEXT,  -- Which template was used (fashion, fitness, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wardrobe Items
CREATE TABLE wardrobe_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    persona_id UUID REFERENCES personas NOT NULL ON DELETE CASCADE,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    color TEXT,
    style_tags TEXT[] DEFAULT '{}',
    season TEXT[] DEFAULT '{}',
    occasion TEXT[] DEFAULT '{}',
    prompt_snippet TEXT,
    image_path TEXT,  -- Local file path
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content Calendar
CREATE TABLE calendar_months (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    persona_id UUID REFERENCES personas NOT NULL ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    arcs JSONB DEFAULT '[]',  -- Narrative arcs for this month
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(persona_id, month, year)
);

-- Calendar Days
CREATE TABLE calendar_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    month_id UUID REFERENCES calendar_months NOT NULL ON DELETE CASCADE,
    day INTEGER NOT NULL CHECK (day >= 1 AND day <= 31),
    date DATE NOT NULL,
    arc_name TEXT,
    theme TEXT,
    mood TEXT,
    locations TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts (6 per day)
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    day_id UUID REFERENCES calendar_days NOT NULL ON DELETE CASCADE,
    post_number INTEGER NOT NULL CHECK (post_number >= 1 AND post_number <= 6),
    time TEXT NOT NULL,
    scene_type TEXT NOT NULL,
    outfit_summary TEXT,
    caption TEXT,
    hashtags TEXT,
    slides JSONB DEFAULT '[]',
    reference_images TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stories (2 per day)
CREATE TABLE stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    day_id UUID REFERENCES calendar_days NOT NULL ON DELETE CASCADE,
    story_number INTEGER NOT NULL CHECK (story_number >= 1 AND story_number <= 2),
    time TEXT NOT NULL,
    prompt TEXT,
    caption_overlay TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Usage Tracking (for paid tier)
CREATE TABLE api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users NOT NULL,
    date DATE NOT NULL,
    llm_calls INTEGER DEFAULT 0,
    search_calls INTEGER DEFAULT 0,
    estimated_cost DECIMAL(10, 4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Indexes for performance
CREATE INDEX idx_personas_user ON personas(user_id);
CREATE INDEX idx_wardrobe_persona ON wardrobe_items(persona_id);
CREATE INDEX idx_calendar_persona ON calendar_months(persona_id);
CREATE INDEX idx_calendar_days ON calendar_days(month_id);
CREATE INDEX idx_posts_day ON posts(day_id);
CREATE INDEX idx_stories_day ON stories(day_id);
CREATE INDEX idx_api_usage_user_date ON api_usage(user_id, date);

-- Row Level Security (RLS)
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE wardrobe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can only access their own personas"
    ON personas FOR ALL
    USING (user_id = current_setting('app.user_id')::uuid);

CREATE POLICY "Users can only access their own wardrobe"
    ON wardrobe_items FOR ALL
    USING (persona_id IN (SELECT id FROM personas WHERE user_id = current_setting('app.user_id')::uuid));

-- Similar policies for other tables...
```

---

## PART 6: DOCKER DEPLOYMENT

### 6.1 docker-compose.yml

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: vidra-db
    environment:
      POSTGRES_USER: vidra
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: vidra
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vidra"]
      interval: 10s
      timeout: 5s
      retries: 5

  # FastAPI Backend
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    container_name: vidra-api
    environment:
      DATABASE_URL: postgresql+asyncpg://vidra:${POSTGRES_PASSWORD}@postgres:5432/vidra
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
      BRAVE_API_KEY: ${BRAVE_API_KEY}
      JWT_SECRET: ${JWT_SECRET}
    volumes:
      - vidra_data:/var/lib/vidra
    ports:
      - "8001:8000"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Next.js Frontend
  web:
    build:
      context: ./web
      dockerfile: Dockerfile
    container_name: vidra-web
    environment:
      DATABASE_URL: postgresql://vidra:${POSTGRES_PASSWORD}@postgres:5432/vidra
      NEXTAUTH_URL: https://vidra.hellolexa.space
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      API_URL: http://api:8000
    ports:
      - "3001:3000"
    depends_on:
      - api
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
  vidra_data:
```

### 6.2 Dockerfile.api

```dockerfile
# Dockerfile.api
FROM python:3.14-slim

WORKDIR /app

# Install dependencies
COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

# Copy application
COPY life/ ./life/
COPY migrations/ ./migrations/

# Create data directory
RUN mkdir -p /var/lib/vidra/wardrobe /var/lib/vidra/exports /var/lib/vidra/temp

# Expose port
EXPOSE 8000

# Run server
CMD ["uvicorn", "life.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 6.3 Dockerfile.web

```dockerfile
# web/Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Build application
COPY . .
RUN npm run build

# Production image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["npm", "start"]
```

---

## PART 7: COOLIFY DEPLOYMENT

### 7.1 Coolify Setup Steps

1. **Create new project** in Coolify: `vidra`

2. **Add PostgreSQL resource:**
   - Name: `vidra-db`
   - Database: `vidra`
   - User: `vidra`
   - Password: (auto-generated)

3. **Add FastAPI service:**
   - Name: `vidra-api`
   - Source: Git repository
   - Repository: `https://github.com/vindepemarte/life-framework-v1`
   - Build Pack: Docker
   - Dockerfile: `Dockerfile.api`
   - Domain: `api.vidra.hellolexa.space`
   - Environment variables from `.env`

4. **Add Next.js service:**
   - Name: `vidra-web`
   - Source: Git repository
   - Repository: `https://github.com/vindepemarte/life-framework-v1`
   - Build Pack: Docker
   - Dockerfile: `web/Dockerfile`
   - Domain: `vidra.hellolexa.space`
   - Environment variables from `.env`

5. **Configure SSL:**
   - Coolify auto-generates Let's Encrypt SSL
   - Enable for both services

### 7.2 Environment Variables

```env
# .env (Coolify)

# Database
POSTGRES_PASSWORD=your-secure-password
DATABASE_URL=postgresql+asyncpg://vidra:your-secure-password@vidra-db:5432/vidra

# Auth
JWT_SECRET=your-jwt-secret-min-32-chars
NEXTAUTH_SECRET=your-nextauth-secret-min-32-chars
NEXTAUTH_URL=https://vidra.hellolexa.space

# External APIs (for PAID tier)
OPENROUTER_API_KEY=your-openrouter-key
BRAVE_API_KEY=your-brave-key

# App
NODE_ENV=production
```

---

## PART 8: OFFLINE TEMPLATES (FREE TIER)

### 8.1 Persona Templates

```yaml
# life/templates/personas/fashion.yaml
name: "Fashion & Lifestyle Influencer"
icon: "👗"

age_range: [22, 32]
default:
  niche: "Fashion & Lifestyle"
  vibe: "elegant, bold, authentic"
  inspirations: "Chiara Ferragni, Kendall Jenner"
  income_vibe: "upper-middle class with occasional luxury"

content_pillars:
  - name: "Style"
    weight: 40
    scenes: ["ootd", "mirror_selfie", "street_style"]
  - name: "Travel"
    weight: 20
    scenes: ["golden_hour", "street_style", "cafe"]
  - name: "Lifestyle"
    weight: 25
    scenes: ["cafe", "working", "reading"]
  - name: "Beauty"
    weight: 15
    scenes: ["getting_ready", "selfie_home"]

default_wardrobe:
  categories: ["tops", "bottoms", "dresses", "shoes", "accessories", "outerwear"]

sample_outfits:
  casual: "White silk blouse, high-waisted jeans, white sneakers"
  date_night: "Black midi dress, strappy heels, gold earrings"
  work: "Beige blazer, cream blouse, tailored trousers, loafers"

caption_templates:
  selfie:
    - "{time_of_day} check-in ✨ #{niche}"
    - "Just another {day_of_week} vibe 💜"
    - "Feeling {mood} today. Who else? 🦊"
  outfit:
    - "Today's fit: {outfit_summary} ✨ #{style}"
    - "{occasion} vibes in this look 💜"
    - "When {brand} just hits different 🖤"
```

```yaml
# life/templates/personas/fitness.yaml
name: "Fitness & Wellness Influencer"
icon: "💪"

age_range: [24, 35]
default:
  niche: "Fitness & Wellness"
  vibe: "motivated, authentic, energetic"
  inspirations: "Kayla Itsines, Whitney Simmons"
  income_vibe: "health-conscious professional"

content_pillars:
  - name: "Workouts"
    weight: 40
    scenes: ["gym", "outdoor_workout"]
  - name: "Nutrition"
    weight: 25
    scenes: ["cooking", "cafe"]
  - name: "Lifestyle"
    weight: 25
    scenes: ["working", "reading", "selfie_home"]
  - name: "Wellness"
    weight: 10
    scenes: ["yoga", "meditation"]

default_wardrobe:
  categories: ["activewear", "gym", "casual", "shoes"]

sample_outfits:
  gym: "Black sports bra, high-waisted leggings, training shoes"
  casual: "Oversized hoodie, bike shorts, white sneakers"
  yoga: "Matching yoga set, barefoot"

caption_templates:
  workout:
    - "Killed today's {workout_type} 💪 #{niche}"
    - "Day {day_number} of showing up 🦊"
    - "Progress > perfection ✨"
  meal:
    - "Fueling right: {meal_description} 🥗 #{niche}"
    - "Simple, delicious, nourishing 💜"
```

### 8.2 Caption Templates

```yaml
# life/templates/captions/selfie.yaml
templates:
  # Morning
  - time: morning
    captions:
      - "Morning check-in ✨ How's everyone starting their day?"
      - "Just woke up like this 💜"
      - "Rise and shine, beautiful people ☀️"
      - "Coffee first, then conquer 🦊"
      - "New day, new opportunities ✨"

  # Afternoon
  - time: afternoon
    captions:
      - "Afternoon vibes 💜"
      - "Midday check-in. How's your day going?"
      - "Still glowing ✨"
      - "Afternoon light hitting different 🦊"
      - "Halfway through the day, still going strong 💜"

  # Evening
  - time: evening
    captions:
      - "Evening check-in ✨"
      - "Day well spent 💜"
      - "Night mode activated 🌙"
      - "Winding down 🦊"
      - "Grateful for today ✨"

  # Any time
  - time: any
    captions:
      - "Just vibing ✨"
      - "Living my best life 💜"
      - "Feeling myself today 🦊"
      - "Good energy only ✨"
      - "Main character energy 💜"

variables:
  - "{day_of_week}"      # Monday, Tuesday, etc.
  - "{time_of_day}"      # morning, afternoon, evening
  - "{mood}"             # happy, excited, cozy, etc.
  - "{niche}"            # fashion, fitness, etc.
  - "{city}"             # user's city
```

### 8.3 Narrative Patterns

```yaml
# life/templates/narratives/new_beginning.yaml
name: "New Beginning"
description: "Fresh start, new chapter, positive energy"
duration: 7 days

day_by_day:
  - day: 1
    theme: "excited"
    mood: "hopeful"
    caption_hint: "New chapter starts today"
    locations: ["apartment", "cafe"]
    
  - day: 2
    theme: "curious"
    mood: "exploring"
    caption_hint: "Discovering new things"
    locations: ["street", "park"]
    
  - day: 3
    theme: "determined"
    mood: "focused"
    caption_hint: "Setting intentions"
    locations: ["gym", "working"]
    
  - day: 4
    theme: "grateful"
    mood: "peaceful"
    caption_hint: "Appreciating the journey"
    locations: ["balcony", "cafe"]
    
  - day: 5
    theme: "confident"
    mood: "empowered"
    caption_hint: "Feeling strong"
    locations: ["street_style", "golden_hour"]
    
  - day: 6
    theme: "social"
    mood: "connected"
    caption_hint: "Surrounding myself with good people"
    locations: ["restaurant", "night_out"]
    
  - day: 7
    theme: "ready"
    mood: "prepared"
    caption_hint: "Ready for what's next"
    locations: ["apartment", "selfie_home"]
```

---

## PART 9: ONBOARDING FLOW

### 9.1 6-Step Wizard

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Welcome                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🎨 "Create your AI influencer in 3 minutes"       │   │
│  │                                                     │   │
│  │  [Start from Template] ← Recommended               │   │
│  │  [Start from Scratch]                              │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  STEP 2: Choose Template                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  👗 Fashion      💪 Fitness      🌴 Lifestyle      │   │
│  │  ✈️ Travel       💄 Beauty       🍕 Food           │   │
│  │  💻 Tech         🎮 Gaming       💼 Business       │   │
│  │  🎨 Art          🎵 Music        😂 Comedy         │   │
│  │                                                     │   │
│  │  [Preview] shows example content                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  STEP 3: Customize                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Name: [Sofia Rossi]                                │   │
│  │  Age: [26]  City: [Milan]                          │   │
│  │  Niche: [Fashion & Lifestyle]                      │   │
│  │  Vibe: [Elegant, Bold, Authentic]                  │   │
│  │                                                     │   │
│  │  [Generate Preview] ← Shows outfit examples        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  STEP 4: Upload Wardrobe (Optional)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📁 Drag & drop images here                        │   │
│  │                                                     │   │
│  │  or [Skip for now]                                 │   │
│  │                                                     │   │
│  │  Auto-categorizes: tops, bottoms, shoes, etc.     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  STEP 5: Preview Calendar                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📅 Your First Week                                │   │
│  │                                                     │   │
│  │  [Mon] [Tue] [Wed] [Thu] [Fri] [Sat] [Sun]        │   │
│  │                                                     │   │
│  │  Each day shows 6 post thumbnails                  │   │
│  │  Theme: "New Beginning"                            │   │
│  │                                                     │   │
│  │  [✨ Upgrade to PRO for full month]               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  STEP 6: Success!                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🎉 Sofia Rossi is ready!                          │   │
│  │                                                     │   │
│  │  [Go to Dashboard]                                 │   │
│  │                                                     │   │
│  │  Quick stats:                                       │   │
│  │  • 1 persona created                               │   │
│  │  • 7 days of content ready                         │   │
│  │  • 42 posts generated                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## PART 10: API INTEGRATION STRATEGY

### 10.1 Free vs Paid Logic

```typescript
// lib/calendar/generate.ts

export async function generateCalendar(
  personaId: string,
  month: number,
  year: number,
  user: User
) {
  // Check if user has their own API keys
  const hasOpenRouter = user.api_keys?.openrouter;
  const hasBrave = user.api_keys?.brave;
  
  // Determine generation mode
  const mode = (user.tier === 'pro' || hasOpenRouter) ? 'llm' : 'offline';
  
  if (mode === 'offline') {
    // Use templates (no API calls, no cost)
    return generateOfflineCalendar(personaId, month, year);
  }
  
  if (mode === 'llm') {
    // Use APIs (better quality, costs money)
    const apiKey = hasOpenRouter || process.env.OPENROUTER_API_KEY;
    return generateLLMCalendar(personaId, month, year, apiKey);
  }
}
```

### 10.2 Cost Tracking

```python
# life/utils/cost_tracker.py

class CostTracker:
    COSTS = {
        "backstory_generation": 0.02,   # One-time per persona
        "prompt_optimization": 0.01,    # Per prompt
        "caption_generation": 0.005,    # Per caption
        "event_search": 0.005,          # Per search
    }
    
    @staticmethod
    async def track(user_id: str, operation: str, db):
        cost = CostTracker.COSTS.get(operation, 0)
        
        # Update daily usage
        await db.execute("""
            INSERT INTO api_usage (user_id, date, estimated_cost)
            VALUES ($1, CURRENT_DATE, $2)
            ON CONFLICT (user_id, date)
            DO UPDATE SET estimated_cost = api_usage.estimated_cost + $2
        """, user_id, cost)
        
        return cost
```

---

## PART 11: 24-HOUR BUILD SCHEDULE

```
HOUR 1-2: SETUP
─────────────────────────────────────────────
[ ] Initialize Next.js app in life-framework/web/
[ ] Setup PostgreSQL on Coolify
[ ] Run database schema
[ ] Configure environment variables
[ ] Test database connection

HOUR 3-4: AUTH + LANDING
─────────────────────────────────────────────
[ ] Setup NextAuth.js
[ ] Create login page
[ ] Create signup page
[ ] Create landing page
[ ] Test auth flow

HOUR 5-6: ONBOARDING
─────────────────────────────────────────────
[ ] Step 1: Welcome screen
[ ] Step 2: Template selection
[ ] Step 3: Persona customization
[ ] Step 4: Wardrobe upload
[ ] Step 5: Calendar preview
[ ] Step 6: Success screen

HOUR 7-8: PERSONA MANAGEMENT
─────────────────────────────────────────────
[ ] Persona list page
[ ] Persona detail page
[ ] Edit persona
[ ] Delete persona
[ ] Persona DNA display

HOUR 9-10: WARDROBE SYSTEM
─────────────────────────────────────────────
[ ] Wardrobe grid view
[ ] Add item form + upload
[ ] Category management
[ ] Outfit preview
[ ] Image storage

HOUR 11-12: CALENDAR SYSTEM
─────────────────────────────────────────────
[ ] Month view
[ ] Day detail view
[ ] Post detail view
[ ] Slide prompts display
[ ] Caption display

HOUR 13-14: OFFLINE TEMPLATES
─────────────────────────────────────────────
[ ] Create 12 persona templates
[ ] Create 100 caption templates
[ ] Create 10 narrative patterns
[ ] Template loading logic
[ ] Template preview

HOUR 15-16: EXPORT SYSTEM
─────────────────────────────────────────────
[ ] Export to Markdown
[ ] Export to JSON
[ ] Export to CSV
[ ] Copy to clipboard
[ ] Download as ZIP

HOUR 17-18: API ROUTES
─────────────────────────────────────────────
[ ] FastAPI server setup
[ ] Persona CRUD endpoints
[ ] Wardrobe endpoints
[ ] Calendar generation
[ ] Export endpoints

HOUR 19-20: DEPLOYMENT
─────────────────────────────────────────────
[ ] Build Docker images
[ ] Deploy to Coolify
[ ] Configure domain (vidra.hellolexa.space)
[ ] Configure SSL
[ ] Test production

HOUR 21-22: POLISH
─────────────────────────────────────────────
[ ] UI polish
[ ] Mobile responsive
[ ] Error handling
[ ] Loading states
[ ] Success/error toasts

HOUR 23-24: LAUNCH
─────────────────────────────────────────────
[ ] Final testing
[ ] Create demo content
[ ] Update landing page
[ ] Announce on Twitter
[ ] Collect feedback
```

---

## PART 12: SUCCESS METRICS

### Launch Day
- [ ] Landing page live
- [ ] Auth working
- [ ] Onboarding complete
- [ ] 1 template working end-to-end
- [ ] 1 week of content generated
- [ ] Export working

### Week 1
- [ ] 100 signups
- [ ] 50 personas created
- [ ] 10 PRO upgrades
- [ ] $290 MRR

### Month 1
- [ ] 500 signups
- [ ] 200 personas created
- [ ] 50 PRO upgrades
- [ ] 5 AGENCY upgrades
- [ ] $2,450 MRR

---

## PART 13: NEXT ACTIONS

**When you say "start":**

1. Initialize Next.js app
2. Create PostgreSQL database on Coolify
3. Run schema migration
4. Start Hour 1

---

*Plan updated. Ready to execute.* 💜
