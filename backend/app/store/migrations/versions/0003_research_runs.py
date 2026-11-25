"""research runs (how each claim was investigated)

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-23 14:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Expand-only: a new table, nothing existing changes.
    op.create_table(
        'research_runs',
        sa.Column('claim_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('depth', sa.String(length=8), nullable=False),
        sa.Column('record', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['claim_id'], ['claims.claim_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('claim_id'),
    )
    with op.batch_alter_table('research_runs', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_research_runs_user_id'), ['user_id'], unique=False)


def downgrade() -> None:
    # Downgrades are destructive and never run automatically. See docs/SECURITY.md section 5.
    raise NotImplementedError("Restore from the pre-migration backup instead.")
