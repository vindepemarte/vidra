"""Add user model preferences and persona lora storage.

Revision ID: 20260303_0003
Revises: 20260303_0002
Create Date: 2026-03-03
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260303_0003"
down_revision = "20260303_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "user_model_preferences" not in tables:
        op.create_table(
            "user_model_preferences",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("openrouter_model", sa.String(length=255), nullable=True),
            sa.Column("fal_image_model", sa.String(length=255), nullable=True),
            sa.Column("fal_edit_model", sa.String(length=255), nullable=True),
            sa.Column("fal_upscale_model", sa.String(length=255), nullable=True),
            sa.Column("fal_train_model", sa.String(length=255), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", name="uq_user_model_preferences_user"),
        )
        op.create_index("ix_user_model_preferences_user_id", "user_model_preferences", ["user_id"], unique=False)

    if "persona_loras" not in tables:
        op.create_table(
            "persona_loras",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("persona_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("provider", sa.String(length=64), nullable=False),
            sa.Column("external_lora_id", sa.String(length=512), nullable=False),
            sa.Column("trigger_word", sa.String(length=255), nullable=True),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("is_default", sa.Boolean(), nullable=False),
            sa.Column("last_error", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["persona_id"], ["personas.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", "persona_id", "name", name="uq_persona_lora_name"),
        )
        op.create_index("ix_persona_loras_user_id", "persona_loras", ["user_id"], unique=False)
        op.create_index("ix_persona_loras_persona_id", "persona_loras", ["persona_id"], unique=False)
        op.create_index("ix_persona_loras_created_at", "persona_loras", ["created_at"], unique=False)
        op.create_index("ix_persona_loras_persona_created", "persona_loras", ["persona_id", "created_at"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "persona_loras" in tables:
        op.drop_index("ix_persona_loras_persona_created", table_name="persona_loras")
        op.drop_index("ix_persona_loras_created_at", table_name="persona_loras")
        op.drop_index("ix_persona_loras_persona_id", table_name="persona_loras")
        op.drop_index("ix_persona_loras_user_id", table_name="persona_loras")
        op.drop_table("persona_loras")

    if "user_model_preferences" in tables:
        op.drop_index("ix_user_model_preferences_user_id", table_name="user_model_preferences")
        op.drop_table("user_model_preferences")

