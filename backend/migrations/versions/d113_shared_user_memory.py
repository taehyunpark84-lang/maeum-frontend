"""기존 기록을 유지하면서 사용자 공통 요약과 잠금을 추가합니다."""
from alembic import op
import sqlalchemy as sa

revision = 'd113_shared_user_memory'
down_revision = 'ca7279440180'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('user_memories',
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('summary_through', sa.Integer(), nullable=False))
    op.create_table('user_chat_locks',
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('owner', sa.String(36), nullable=False),
        sa.Column('expires', sa.Float(53), nullable=False))


def downgrade():
    op.drop_table('user_chat_locks')
    op.drop_table('user_memories')
