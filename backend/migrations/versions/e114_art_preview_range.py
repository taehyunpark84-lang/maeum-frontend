"""작품별 대화 범위와 확인 화면의 스냅샷을 저장합니다."""
from alembic import op
import sqlalchemy as sa

revision = 'e114_art_preview_range'
down_revision = 'd113_shared_user_memory'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('jobs', sa.Column('source_through', sa.Integer(), nullable=True))
    op.create_table('art_previews',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('session_id', sa.String(36), sa.ForeignKey('conversations.id'), nullable=False),
        sa.Column('source_through', sa.Integer(), nullable=False),
        sa.Column('story', sa.Text(), nullable=False),
        sa.Column('created', sa.Float(53), nullable=False))
    op.create_index('ix_art_previews_user_id', 'art_previews', ['user_id'])


def downgrade():
    op.drop_table('art_previews')
    # jobs를 참조하는 작품이 있으므로 테이블 재생성 대신 열만 제거합니다.
    op.drop_column('jobs', 'source_through')
