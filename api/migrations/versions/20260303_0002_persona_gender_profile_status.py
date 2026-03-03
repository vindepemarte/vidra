"""Add persona gender and profile generation status fields.

Revision ID: 20260303_0002
Revises: 20260302_0001
Create Date: 2026-03-03
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = "20260303_0002"
down_revision = "20260302_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    persona_columns = {col["name"] for col in inspector.get_columns("personas")}
    persona_indexes = {idx["name"] for idx in inspector.get_indexes("personas")}

    if "gender" not in persona_columns:
        op.add_column("personas", sa.Column("gender", sa.String(length=16), nullable=True, server_default="female"))
    if "ix_personas_user_created" not in persona_indexes:
        op.create_index("ix_personas_user_created", "personas", ["user_id", "created_at"], unique=False)

    profile_columns = {col["name"] for col in inspector.get_columns("persona_profiles")}
    profile_indexes = {idx["name"] for idx in inspector.get_indexes("persona_profiles")}

    if "generation_status" not in profile_columns:
        op.add_column("persona_profiles", sa.Column("generation_status", sa.String(length=32), nullable=False, server_default="empty"))
    if "generation_requested_mode" not in profile_columns:
        op.add_column("persona_profiles", sa.Column("generation_requested_mode", sa.String(length=16), nullable=True))
    if "generation_effective_mode" not in profile_columns:
        op.add_column("persona_profiles", sa.Column("generation_effective_mode", sa.String(length=16), nullable=True))
    if "generation_model_used" not in profile_columns:
        op.add_column("persona_profiles", sa.Column("generation_model_used", sa.String(length=255), nullable=True))
    if "generation_error" not in profile_columns:
        op.add_column("persona_profiles", sa.Column("generation_error", sa.Text(), nullable=True))
    if "generation_started_at" not in profile_columns:
        op.add_column("persona_profiles", sa.Column("generation_started_at", sa.DateTime(timezone=True), nullable=True))
    if "generation_completed_at" not in profile_columns:
        op.add_column("persona_profiles", sa.Column("generation_completed_at", sa.DateTime(timezone=True), nullable=True))
    if "generation_run_id" not in profile_columns:
        op.add_column("persona_profiles", sa.Column("generation_run_id", sa.String(length=64), nullable=True))
    if "ix_persona_profiles_persona_status" not in profile_indexes:
        op.create_index(
            "ix_persona_profiles_persona_status",
            "persona_profiles",
            ["persona_id", "generation_status"],
            unique=False,
        )

    op.execute(
        """
        UPDATE personas
        SET gender = CASE
            WHEN lower(coalesce(template, '')) = 'male' THEN 'male'
            ELSE 'female'
        END
        WHERE gender IS NULL OR gender = ''
        """
    )

    op.execute(
        """
        UPDATE persona_profiles
        SET generation_status = CASE
            WHEN coalesce(prompt_blueprint, '') <> '' OR coalesce(bio, '') <> '' THEN 'ready'
            ELSE 'empty'
        END
        WHERE generation_status IS NULL OR generation_status = ''
        """
    )

    op.execute(
        """
        UPDATE persona_profiles
        SET generation_effective_mode = CASE
            WHEN lower(coalesce(generated_mode, 'offline')) = 'llm' THEN 'llm'
            ELSE 'offline'
        END
        WHERE generation_effective_mode IS NULL
        """
    )

    op.execute(
        """
        UPDATE persona_profiles
        SET generation_completed_at = now()
        WHERE generation_status = 'ready' AND generation_completed_at IS NULL
        """
    )

    op.alter_column("personas", "gender", existing_type=sa.String(length=16), nullable=False, server_default="female")


def downgrade() -> None:
    op.drop_index("ix_persona_profiles_persona_status", table_name="persona_profiles")
    op.drop_column("persona_profiles", "generation_run_id")
    op.drop_column("persona_profiles", "generation_completed_at")
    op.drop_column("persona_profiles", "generation_started_at")
    op.drop_column("persona_profiles", "generation_error")
    op.drop_column("persona_profiles", "generation_model_used")
    op.drop_column("persona_profiles", "generation_effective_mode")
    op.drop_column("persona_profiles", "generation_requested_mode")
    op.drop_column("persona_profiles", "generation_status")

    op.drop_index("ix_personas_user_created", table_name="personas")
    op.drop_column("personas", "gender")
