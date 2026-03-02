from contextlib import asynccontextmanager
import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from vidra_api.config import settings
from vidra_api.database import Base, engine
from vidra_api.routes import auth, billing, calendar, export, personas

logger = logging.getLogger("vidra_api")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Coolify can start API right after Postgres turns healthy; add retry to avoid startup races.
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
    allow_origins=[settings.frontend_url, "https://vidra.hellolexa.space", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(personas.router, prefix="/api")
app.include_router(calendar.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(billing.router, prefix="/api")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "vidra-api"}
