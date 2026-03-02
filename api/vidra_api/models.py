import datetime as dt
import uuid

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
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
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)

    personas: Mapped[list["Persona"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Persona(Base):
    __tablename__ = "personas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    handle: Mapped[str] = mapped_column(String(255))
    age: Mapped[int] = mapped_column(Integer)
    city: Mapped[str] = mapped_column(String(255))
    niche: Mapped[str] = mapped_column(String(255))
    vibe: Mapped[str] = mapped_column(Text)
    template: Mapped[str] = mapped_column(String(64), default="fashion")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="personas")
    months: Mapped[list["CalendarMonth"]] = relationship(back_populates="persona", cascade="all, delete-orphan")


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
