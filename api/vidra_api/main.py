from contextlib import asynccontextmanager
import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from vidra_api.config import settings
from vidra_api.database import Base, engine
from vidra_api.routes import account, auth, billing, calendar, consent, credits, dashboard, events, export, media, onboarding, personas, plans, referrals, streak, studio

logger = logging.getLogger("vidra_api")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Coolify can start API right after Postgres turns healthy; add retry to avoid startup races.
    if not settings.auto_create_tables:
        yield
        return

    max_attempts = 20
    for attempt in range(1, max_attempts + 1):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            break
        except Exception:
            logger.exception("Database init failed on attempt %s/%s", attempt, max_attempts)
            if attempt == max_attempts:
                raise
            await asyncio.sleep(2)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "https://vidra.life",
        "https://api.vidra.life",
        "https://vidra.hellolexa.space",
        "http://localhost:3000",
    ],
    allow_origin_regex=r"https://([a-zA-Z0-9-]+\.)?(vidra\.life|hellolexa\.space)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(personas.router, prefix="/api")
app.include_router(calendar.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(billing.router, prefix="/api")
app.include_router(plans.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(onboarding.router, prefix="/api")
app.include_router(credits.router, prefix="/api")
app.include_router(account.router, prefix="/api")
app.include_router(consent.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(media.router, prefix="/api")
app.include_router(studio.router, prefix="/api")
app.include_router(streak.router, prefix="/api")
app.include_router(referrals.router, prefix="/api")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "vidra-api"}
