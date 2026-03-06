# This file contains the Referral model to add to models.py
# and the updated User class

import datetime as dt
import uuid
import secrets
import string

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from vidra_api.database import Base


def generate_referral_code(length: int = 8) -> str:
    """Generate a unique referral code."""
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


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

    referrer: Mapped["User"] = relationship("User", foreign_keys=[referrer_id], back_populates="referrals_made")
