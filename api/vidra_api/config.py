from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Vidra API"
    app_env: str = "development"
    frontend_url: str = "http://localhost:3000"

    database_url: str | None = None
    db_host: str = "postgres"
    db_port: int = 5432
    db_user: str = "vidra"
    db_password: str = "vidra"
    db_name: str = "vidra"

    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_exp_minutes: int = 60 * 24 * 7

    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_price_pro: str | None = None
    stripe_price_max: str | None = None
    stripe_success_url: str | None = None
    stripe_cancel_url: str | None = None
    stripe_portal_return_url: str | None = None

    openrouter_api_key: str | None = None
    openrouter_model: str = "anthropic/claude-sonnet-4-20250514"


settings = Settings()

if not settings.database_url:
    settings.database_url = URL.create(
        drivername="postgresql+asyncpg",
        username=settings.db_user,
        password=settings.db_password,
        host=settings.db_host,
        port=settings.db_port,
        database=settings.db_name,
    ).render_as_string(hide_password=False)
