from app.core.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    res = conn.execute(text("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'menu_items'
        ORDER BY ordinal_position;
    """)).fetchall()
    print("MENU_ITEMS COLUMNS:")
    for r in res:
        print(f"  {r[0]} ({r[1]})")
