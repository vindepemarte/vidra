from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    name: str | None
    tier: str


class PersonaCreate(BaseModel):
    name: str
    handle: str
    age: int = Field(ge=18, le=100)
    city: str
    niche: str
    vibe: str
    gender: str = Field(pattern="^(male|female)$", default="female")
    template: str = "fashion"


class PersonaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    handle: str
    age: int
    city: str
    niche: str
    vibe: str
    gender: str
    template: str


class GenerateCalendarRequest(BaseModel):
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2025, le=2100)
    force_regenerate: bool = False


class SlideOut(BaseModel):
    slide_number: int
    prompt: str
    edit_instruction: str | None = None


class PostOut(BaseModel):
    id: UUID
    post_number: int
    time: str
    scene_type: str
    caption: str
    prompt: str
    hashtags: str
    slides: list[SlideOut] = Field(default_factory=list)


class DayOut(BaseModel):
    day: int
    date: date
    theme: str
    mood: str
    posts: list[PostOut]


class MonthOut(BaseModel):
    persona_id: UUID
    month: int
    year: int
    mode: str
    days: list[DayOut]


class CalendarMonthSummaryOut(BaseModel):
    id: UUID
    month: int
    year: int
    mode: str
    days_count: int


class CalendarListOut(BaseModel):
    persona_id: UUID
    months: list[CalendarMonthSummaryOut]


class PlanEntitlementsOut(BaseModel):
    calendar_generations: str
    calendar_regenerations: str
    personas_limit: int
    generation_days_per_run: int
    included_credits_monthly: int
    media_generation_requires_credits: bool


class PlanOut(BaseModel):
    id: str
    name: str
    monthly_price_eur: int
    tagline: str
    outcomes: list[str]
    limits: dict[str, int]
    generation_mode: str
    entitlements: PlanEntitlementsOut


class PlanCatalogOut(BaseModel):
    plans: list[PlanOut]


class CheckoutRequest(BaseModel):
    tier: str = Field(pattern="^(pro|max)$")


class CheckoutSessionOut(BaseModel):
    url: str


class CreditWalletOut(BaseModel):
    balance_credits: int
    included_monthly_credits: int


class CreditLedgerEntryOut(BaseModel):
    id: UUID
    delta: int
    reason: str
    source_type: str
    source_id: str
    created_at: datetime


class CreditLedgerOut(BaseModel):
    entries: list[CreditLedgerEntryOut]


class TopupCheckoutRequest(BaseModel):
    pack_id: str = Field(pattern="^(starter|growth|scale)$")


class MyPlanOut(BaseModel):
    current_tier: str
    next_tier: str | None
    personas_limit: int
    generation_days_limit: int
    generation_days_per_run: int
    generation_mode: str
    openrouter_enabled: bool = False
    openrouter_model: str | None = None
    calendar_generations: str = "unlimited_fair_use"
    calendar_regenerations: str = "unlimited_fair_use"
    media_generation_requires_credits: bool = True
    credits_balance: int = 0
    included_credits: int = 0
    included_credits_monthly: int = 0


class DashboardOverviewOut(BaseModel):
    current_tier: str
    personas_count: int
    personas_limit: int
    generated_months_count: int
    generation_days_limit: int
    generation_mode: str
    openrouter_enabled: bool = False
    openrouter_model: str | None = None
    value_snapshot: list[str]
    onboarding_completed: bool = False
    credits_balance: int = 0
    included_credits: int = 0
    persona_health_score: int = 0
    weekly_quests: list[str] = Field(default_factory=list)


class OnboardingStateOut(BaseModel):
    current_step: int
    goal: str | None
    completed: bool


class OnboardingStepRequest(BaseModel):
    step: int = Field(ge=0, le=10)
    goal: str | None = None


class OnboardingCompleteOut(BaseModel):
    completed: bool


class ApiKeySetRequest(BaseModel):
    api_key: str = Field(min_length=4, max_length=4096)


class ApiKeyMaskOut(BaseModel):
    provider: str
    configured: bool
    masked_value: str | None = None


class ApiKeyListOut(BaseModel):
    keys: list[ApiKeyMaskOut]


class ModelPreferencesOut(BaseModel):
    openrouter_model: str | None = None
    fal_image_model: str | None = None
    fal_edit_model: str | None = None
    fal_upscale_model: str | None = None
    fal_train_model: str | None = None


class ModelPreferencesUpdateRequest(BaseModel):
    openrouter_model: str | None = None
    fal_image_model: str | None = None
    fal_edit_model: str | None = None
    fal_upscale_model: str | None = None
    fal_train_model: str | None = None


class ProviderModelOptionOut(BaseModel):
    id: str
    label: str
    operation: str
    credits_hint: str


class ProviderModelCatalogOut(BaseModel):
    openrouter: list[ProviderModelOptionOut] = Field(default_factory=list)
    fal: list[ProviderModelOptionOut] = Field(default_factory=list)


class MediaJobOut(BaseModel):
    id: UUID
    user_id: UUID
    persona_id: UUID
    post_id: UUID | None
    provider: str
    model: str
    mode: str
    status: str
    prompt: str
    reference_asset_id: UUID | None
    output_url: str | None
    error_message: str | None
    cost_credits: int
    external_job_id: str | None
    created_at: datetime
    updated_at: datetime


class MediaJobSummaryOut(BaseModel):
    id: UUID
    status: str
    mode: str
    output_url: str | None
    created_at: datetime


class MediaJobListOut(BaseModel):
    jobs: list[MediaJobOut]


class MediaGenerateImageRequest(BaseModel):
    persona_id: UUID
    post_id: UUID | None = None
    prompt: str = Field(min_length=3)
    model: str | None = None
    persona_lora_id: UUID | None = None
    width: int | None = Field(default=None, ge=256, le=4096)
    height: int | None = Field(default=None, ge=256, le=4096)
    num_images: int | None = Field(default=1, ge=1, le=4)


class MediaEditImageRequest(BaseModel):
    persona_id: UUID
    post_id: UUID | None = None
    prompt: str = Field(min_length=3)
    source_media_id: UUID
    model: str | None = None


class MediaUpscaleImageRequest(BaseModel):
    persona_id: UUID
    post_id: UUID | None = None
    source_media_id: UUID
    model: str | None = None
    upscale_factor: int | None = Field(default=2, ge=2, le=4)


class PersonaLoraAttachRequest(BaseModel):
    persona_id: UUID
    name: str = Field(min_length=2, max_length=255)
    external_lora_id: str = Field(min_length=6, max_length=512)
    trigger_word: str | None = Field(default=None, max_length=255)
    set_default: bool = True


class PersonaLoraOut(BaseModel):
    id: UUID
    persona_id: UUID
    name: str
    provider: str
    external_lora_id: str
    trigger_word: str | None = None
    status: str
    is_default: bool
    created_at: datetime
    updated_at: datetime


class PersonaLoraListOut(BaseModel):
    loras: list[PersonaLoraOut]


class PersonaProfileOut(BaseModel):
    bio: str
    backstory_md: str
    future_plans_md: str
    strategy_md: str
    prompt_blueprint: str
    physical: dict
    wardrobe: dict
    beauty: dict
    world: dict
    carousel_rules: dict
    generated_mode: str


class PersonaProfileStatusOut(BaseModel):
    generation_status: str
    generation_requested_mode: str | None = None
    generation_effective_mode: str | None = None
    generation_model_used: str | None = None
    generation_step: str | None = None
    progress_percent: int = 0
    elapsed_seconds: int = 0
    estimated_total_seconds: int | None = None
    eta_seconds: int | None = None
    can_retry: bool = True
    is_terminal: bool = False
    next_poll_seconds: int = 2
    generation_error: str | None = None
    generation_started_at: datetime | None = None
    generation_completed_at: datetime | None = None
    generation_run_id: str | None = None


class PersonaDetailOut(BaseModel):
    persona: PersonaOut
    profile: PersonaProfileOut | None = None
    profile_status: PersonaProfileStatusOut | None = None
    calendars: list[CalendarMonthSummaryOut]
    media_generated_count: int = 0
    recent_media_jobs: list[MediaJobSummaryOut] = Field(default_factory=list)


class PersonaProfileGenerateRequest(BaseModel):
    mode: str = Field(pattern="^(offline|llm|auto)$", default="auto")


class ConsentCookieRequest(BaseModel):
    session_id: str = Field(min_length=8, max_length=128)
    analytics: bool = False
    marketing: bool = False


class ConsentCookieOut(BaseModel):
    accepted: bool
    policy_version: str


class EventTrackRequest(BaseModel):
    event_name: str = Field(min_length=2, max_length=128)
    payload: dict = Field(default_factory=dict)


class EventTrackOut(BaseModel):
    accepted: bool
