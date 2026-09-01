"""add_batch_to_production_consumption

Revision ID: 007_add_batch_to_production_consumption
Revises: 006_add_idempotency_to_production
Create Date: 2026-09-01 21:18:20.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '007_add_batch_to_production_consumption'
down_revision = '006_add_idempotency_to_production'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('production_consumptions', sa.Column('stockBatchId', sa.String(36), nullable=True))
    op.add_column('production_consumptions', sa.Column('batchNumber', sa.String(100), nullable=True))
    op.create_index('ix_production_consumptions_stockBatchId', 'production_consumptions', ['stockBatchId'], unique=False)
    op.create_foreign_key(
        'fk_production_consumptions_stockBatchId', 
        'production_consumptions', 'stock_batches',
        ['stockBatchId'], ['id'],
        ondelete='SET NULL'
    )

def downgrade():
    op.drop_constraint('fk_production_consumptions_stockBatchId', 'production_consumptions', type_='foreignkey')
    op.drop_index('ix_production_consumptions_stockBatchId', table_name='production_consumptions')
    op.drop_column('production_consumptions', 'batchNumber')
    op.drop_column('production_consumptions', 'stockBatchId')
