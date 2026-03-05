"""Add streak system tables

Revision ID: 001_add_streak_system
Revises: 
Create Date: 2026-03-05 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_add_streak_system'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create content_streaks table
    op.create_table(
        'content_streaks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_vreq_generate_v4()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('current_streak', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('longest_streak', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_activity_date', sa.Date(), nullable=True),
        sa.Column('total_active_days', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('streak_frozen', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('freeze_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('user_id', name='uq_content_streak_user'),
    )
    op.create_index('ix_content_streaks_user_id', 'content_streaks', ['user_id'])

    # Create streak_activities table
    op.create_table(
        'streak_activities',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('activity_date', sa.Date(), nullable=False),
        sa.Column('activity_type', sa.String(length=64), nullable=False, server_default='login'),
        sa.Column('points_earned', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('user_id', 'activity_date', name='uq_streak_activity_user_date'),
        sa.Index('ix_streak_activities_user_date', 'user_id', 'activity_date'),
    )

    # Create streak_milestones table
    op.create_table(
        'streak_milestones',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('milestone_type', sa.String(length=64), nullable=False),
        sa.Column('milestone_value', sa.Integer(), nullable=False),
        sa.Column('achieved_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('reward_claimed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('user_id', 'milestone_type', 'milestone_value', name='uq_streak_milestone'),
    )
    op.create_index('ix_streak_milestones_user_id', 'streak_milestones', ['user_id'])


def downgrade():
    op.drop_table('streak_milestones')
    op.drop_table('streak_activities')
    op.drop_table('content_streaks')
