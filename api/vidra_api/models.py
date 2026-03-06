import datetime as dt
import uuid

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from vidra_api.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tier: Mapped[str] = mapped_column(String(32), default="free")
    api_keys: Mapped[dict] = mapped_column(JSONB, default=dict)
    referral_code: Mapped[str | None] = mapped_column(String(16), unique=True, index=True, nullable=True)
    referred_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)

    personas: Mapped[list["Persona"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Persona(Base):
    __tablename__ = "personas"
    __table_args__ = (Index("ix_personas_user_created", "user_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    handle: Mapped[str] = mapped_column(String(255))
    age: Mapped[int] = mapped_column(Integer)
    city: Mapped[str] = mapped_column(String(255))
    niche: Mapped[str] = mapped_column(String(255))
    vibe: Mapped[str] = mapped_column(Text)
    gender: Mapped[str] = mapped_column(String(16), default="female")
    template: Mapped[str] = mapped_column(String(64), default="fashion")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="personas")
    months: Mapped[list["CalendarMonth"]] = relationship(back_populates="persona", cascade="all, delete-orphan")
    profile: Mapped["PersonaProfile | None"] = relationship(
        back_populates="persona",
        cascade="all, delete-orphan",
        uselist=False,
    )


class CalendarMonth(Base):
    __tablename__ = "calendar_months"
    __table_args__ = (UniqueConstraint("persona_id", "month", "year", name="uq_persona_month_year"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    persona_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("personas.id", ondelete="CASCADE"), index=True)
    month: Mapped[int] = mapped_column(Integer)
    year: Mapped[int] = mapped_column(Integer)
    mode: Mapped[str] = mapped_column(String(32), default="offline")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)

    persona: Mapped[Persona] = relationship(back_populates="months")
    days: Mapped[list["CalendarDay"]] = relationship(back_populates="month_ref", cascade="all, delete-orphan")


class CalendarDay(Base):
    __tablename__ = "calendar_days"
    __table_args__ = (UniqueConstraint("month_id", "day", name="uq_month_day"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    month_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("calendar_months.id", ondelete="CASCADE"), index=True)
    day: Mapped[int] = mapped_column(Integer)
    date: Mapped[dt.date] = mapped_column(Date)
    theme: Mapped[str] = mapped_column(String(255))
    mood: Mapped[str] = mapped_column(String(255))

    month_ref: Mapped[CalendarMonth] = relationship(back_populates="days")
    posts: Mapped[list["Post"]] = relationship(back_populates="day_ref", cascade="all, delete-orphan")


class Post(Base):
    __tablename__ = "posts"
    __table_args__ = (UniqueConstraint("day_id", "post_number", name="uq_day_post_number"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    day_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("calendar_days.id", ondelete="CASCADE"), index=True)
    post_number: Mapped[int] = mapped_column(Integer)
    time: Mapped[str] = mapped_column(String(64))
    scene_type: Mapped[str] = mapped_column(String(255))
    caption: Mapped[str] = mapped_column(Text)
    prompt: Mapped[str] = mapped_column(Text)
    hashtags: Mapped[str] = mapped_column(Text)

    day_ref: Mapped[CalendarDay] = relationship(back_populates="posts")
    slides: Mapped[list["PostSlide"]] = relationship(back_populates="post", cascade="all, delete-orphan")


class PostSlide(Base):
    __tablename__ = "post_slides"
    __table_args__ = (UniqueConstraint("post_id", "slide_number", name="uq_post_slide_number"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    slide_number: Mapped[int] = mapped_column(Integer)
    prompt: Mapped[str] = mapped_column(Text)
    edit_instruction: Mapped[str | None] = mapped_column(Text, nullable=True)

    post: Mapped[Post] = relationship(back_populates="slides")


class PersonaProfile(Base):
    __tablename__ = "persona_profiles"
    __table_args__ = (
        UniqueConstraint("persona_id", name="uq_profile_persona"),
        Index("ix_persona_profiles_persona_status", "persona_id", "generation_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    persona_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("personas.id", ondelete="CASCADE"), index=True)
    bio: Mapped[str] = mapped_column(Text, default="")
    backstory_md: Mapped[str] = mapped_column(Text, default="")
    future_plans_md: Mapped[str] = mapped_column(Text, default="")
    strategy_md: Mapped[str] = mapped_column(Text, default="")
    prompt_blueprint: Mapped[str] = mapped_column(Text, default="")
    physical: Mapped[dict] = mapped_column(JSONB, default=dict)
    wardrobe: Mapped[dict] = mapped_column(JSONB, default=dict)
    beauty: Mapped[dict] = mapped_column(JSONB, default=dict)
    world: Mapped[dict] = mapped_column(JSONB, default=dict)
    carousel_rules: Mapped[dict] = mapped_column(JSONB, default=dict)
    generation_status: Mapped[str] = mapped_column(String(32), default="empty")
    generation_requested_mode: Mapped[str | None] = mapped_column(String(16), nullable=True)
    generation_effective_mode: Mapped[str | None] = mapped_column(String(16), nullable=True)
    generation_model_used: Mapped[str | None] = mapped_column(String(255), nullable=True)
    generation_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    generation_started_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    generation_completed_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    generation_run_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    generated_mode: Mapped[str] = mapped_column(String(32), default="offline")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)

    persona: Mapped[Persona] = relationship(back_populates="profile")


class ApiUsage(Base):
    __tablename__ = "api_usage"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_user_date_usage"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date: Mapped[dt.date] = mapped_column(Date)
    llm_calls: Mapped[int] = mapped_column(Integer, default=0)
    search_calls: Mapped[int] = mapped_column(Integer, default=0)
    estimated_cost: Mapped[float] = mapped_column(Numeric(10, 4), default=0)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    plan: Mapped[str] = mapped_column(String(64), default="free")
    status: Mapped[str] = mapped_column(String(64), default="inactive")

    user: Mapped[User] = relationship(back_populates="subscriptions")


class OnboardingState(Base):
    __tablename__ = "onboarding_states"
    __table_args__ = (UniqueConstraint("user_id", name="uq_onboarding_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    current_step: Mapped[int] = mapped_column(Integer, default=0)
    goal: Mapped[str | None] = mapped_column(String(128), nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)


class CreditWallet(Base):
    __tablename__ = "credit_wallets"
    __table_args__ = (UniqueConstraint("user_id", name="uq_credit_wallet_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    balance_credits: Mapped[int] = mapped_column(Integer, default=0)
    included_monthly_credits: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)


class CreditLedger(Base):
    __tablename__ = "credit_ledger"
    __table_args__ = (UniqueConstraint("user_id", "source_type", "source_id", name="uq_credit_ledger_source"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    delta: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(255))
    source_type: Mapped[str] = mapped_column(String(64), default="manual")
    source_id: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)


class ApiKeyStore(Base):
    __tablename__ = "api_key_store"
    __table_args__ = (UniqueConstraint("user_id", "provider", name="uq_api_key_user_provider"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(64))
    encrypted_key: Mapped[str] = mapped_column(Text)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)


class UserModelPreference(Base):
    __tablename__ = "user_model_preferences"
    __table_args__ = (UniqueConstraint("user_id", name="uq_user_model_preferences_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    openrouter_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    fal_image_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    fal_edit_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    fal_upscale_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    fal_train_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)


class PersonaLora(Base):
    __tablename__ = "persona_loras"
    __table_args__ = (
        Index("ix_persona_loras_persona_created", "persona_id", "created_at"),
        UniqueConstraint("user_id", "persona_id", "name", name="uq_persona_lora_name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    persona_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("personas.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    provider: Mapped[str] = mapped_column(String(64), default="fal")
    external_lora_id: Mapped[str] = mapped_column(String(512))
    trigger_word: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="ready")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow, index=True)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)


class ConsentRecord(Base):
    __tablename__ = "consent_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    session_id: Mapped[str] = mapped_column(String(128), index=True)
    policy_version: Mapped[str] = mapped_column(String(64), default="1.0")
    analytics: Mapped[bool] = mapped_column(Boolean, default=False)
    marketing: Mapped[bool] = mapped_column(Boolean, default=False)
    ip_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    user_agent_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)


class ProductEvent(Base):
    __tablename__ = "product_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    event_name: Mapped[str] = mapped_column(String(128), index=True)
    payload_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    occurred_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow, index=True)


class MediaGeneration(Base):
    __tablename__ = "media_generations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    persona_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("personas.id", ondelete="CASCADE"), index=True)
    post_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="SET NULL"), nullable=True, index=True)
    provider: Mapped[str] = mapped_column(String(64), default="fal")
    model: Mapped[str] = mapped_column(String(255))
    mode: Mapped[str] = mapped_column(String(32), default="image")
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    prompt: Mapped[str] = mapped_column(Text)
    reference_asset_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("media_generations.id", ondelete="SET NULL"), nullable=True)
    output_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    input_payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    cost_credits: Mapped[int] = mapped_column(Integer, default=0)
    external_job_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow, index=True)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)


class ContentStreak(Base):
    """Tracks daily content creation streaks for engagement and gamification."""
    __tablename__ = "content_streaks"
    __table_args__ = (UniqueConstraint("user_id", name="uq_content_streak_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0)
    last_activity_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    total_active_days: Mapped[int] = mapped_column(Integer, default=0)
    streak_frozen: Mapped[bool] = mapped_column(Boolean, default=False)
    freeze_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)


class StreakActivity(Base):
    """Records individual streak activities for history tracking."""
    __tablename__ = "streak_activities"
    __table_args__ = (
        UniqueConstraint("user_id", "activity_date", name="uq_streak_activity_user_date"),
        Index("ix_streak_activities_user_date", "user_id", "activity_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    activity_date: Mapped[dt.date] = mapped_column(Date)
    activity_type: Mapped[str] = mapped_column(String(64), default="login")  # login, calendar_generated, media_created
    points_earned: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)


class StreakMilestone(Base):
    """Tracks milestone achievements for streak gamification."""
    __tablename__ = "streak_milestones"
    __table_args__ = (UniqueConstraint("user_id", "milestone_type", "milestone_value", name="uq_streak_milestone"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    milestone_type: Mapped[str] = mapped_column(String(64))  # streak_days, total_days, longest_streak
    milestone_value: Mapped[int] = mapped_column(Integer)
    achieved_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    reward_claimed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)


class Referral(Base):
    """Tracks referral relationships and rewards."""
    __tablename__ = "referrals"
    __table_args__ = (
        UniqueConstraint("referrer_id", "referred_user_id", name="uq_referral_pair"),
        Index("ix_referrals_referrer", "referrer_id"),
        Index("ix_referrals_referred", "referred_user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    referrer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    referred_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    referrer_rewarded: Mapped[bool] = mapped_column(Boolean, default=False)
    referred_rewarded: Mapped[bool] = mapped_column(Boolean, default=False)
    referrer_credits: Mapped[int] = mapped_column(Integer, default=100)  # Credits given to referrer
    referred_credits: Mapped[int] = mapped_column(Integer, default=50)   # Credits given to new user
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)

    referrer: Mapped["User"] = relationship("User", foreign_keys=[referrer_id])
