"""add idempotency to production

Revision ID: 006_add_idempotency_to_production
Revises: 005_whatsapp_business_integration
Create Date: 2026-09-01 20:59:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '006_add_idempotency_to_production'
down_revision = '005_whatsapp_business_integration'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('production_orders', sa.Column('idempotencyKey', sa.String(length=255), nullable=True))
    op.create_unique_constraint('uq_production_orders_idempotencyKey', 'production_orders', ['idempotencyKey'])

def downgrade():
    op.drop_constraint('uq_production_orders_idempotencyKey', 'production_orders', type_='unique')
    op.drop_column('production_orders', 'idempotencyKey')
