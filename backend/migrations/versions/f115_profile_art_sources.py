"""표시 설정, 성별과 작품의 근거 대화 범위. 기존 기록은 수정하지 않습니다."""
from alembic import op
import sqlalchemy as sa

revision = 'f115_profile_art_sources'
down_revision = 'e114_art_preview_range'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('gender', sa.String(6), nullable=False, server_default='male'))
    op.add_column('users', sa.Column('show_history', sa.Boolean(), nullable=False, server_default=sa.false()))
    for table in ('jobs', 'art_previews'):
        op.add_column(table, sa.Column('source_after', sa.Integer(), nullable=True))
        op.add_column(table, sa.Column('source_end', sa.Integer(), nullable=True))
    op.add_column('jobs', sa.Column('gender_snapshot', sa.String(6), nullable=True))


def downgrade():
    op.drop_column('jobs', 'gender_snapshot')
    for table in ('jobs', 'art_previews'):
        op.drop_column(table, 'source_end')
        op.drop_column(table, 'source_after')
    op.drop_column('users', 'show_history')
    op.drop_column('users', 'gender')
