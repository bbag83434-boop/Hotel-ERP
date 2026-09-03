from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = 'd2474ee7ccd1'
down_revision: Union[str, None] = '007_add_batch_to_production_consumption'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Safely add the columns if they don't already exist
    conn = op.get_bind()
    
    statements = [
        'ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS "issuedQty" NUMERIC(14,4) NOT NULL DEFAULT 0.0000;',
        'ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS "approvedById" VARCHAR(36) NULL;',
        'ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP WITHOUT TIME ZONE NULL;',
        'ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS "rejectedById" VARCHAR(36) NULL;',
        'ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP WITHOUT TIME ZONE NULL;',
        'ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS "rejectionReason" VARCHAR(500) NULL;',
        'ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS "cancelledById" VARCHAR(36) NULL;',
        'ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP WITHOUT TIME ZONE NULL;',
        'ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS "cancelReason" VARCHAR(500) NULL;',
        'ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS "createdById" VARCHAR(36) NULL;',
    ]
    
    for stmt in statements:
        conn.execute(text(stmt))

def downgrade() -> None:
    pass
