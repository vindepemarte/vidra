from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Vidra API"
    app_env: str = "development"
    frontend_url: str = "https://vidra.life"
    auto_create_tables: bool = True
    app_policy_version: str = "1.0"
    app_encryption_key: str | None = None
    posthog_host: str | None = None
    posthog_project_key: str | None = None

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
    profile_generation_timeout_seconds: int = 5400
    calendar_generation_timeout_seconds: int = 180
    fal_api_key: str | None = None
    fal_image_model: str = "fal-ai/flux-lora"
    fal_edit_model: str = "fal-ai/nano-banana-pro/edit"
    fal_upscale_model: str = "fal-ai/clarity-upscaler"
    fal_train_model: str = "fal-ai/flux-lora-fast-training"
    fal_image_cost_credits: int = 20
    fal_edit_cost_credits: int = 12
    media_credit_value_usd: float = 0.01
    media_margin_multiplier: float = 1.35
    media_safety_multiplier: float = 1.08

    stripe_price_topup_starter: str | None = None
    stripe_price_topup_growth: str | None = None
    stripe_price_topup_scale: str | None = None


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
