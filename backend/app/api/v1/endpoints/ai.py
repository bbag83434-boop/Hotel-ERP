from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import require_outlet_scope, get_current_active_user
from app.services.ai_engine import AIEngine

router = APIRouter()

@router.get("/recommendations/stock", status_code=status.HTTP_200_OK)
def get_ai_stock_recommendations(
    db: Session = Depends(get_db),
    outlet_id: str = Depends(require_outlet_scope)
):
    engine = AIEngine(db, outlet_id)
    return {
        "success": True,
        "outlet_id": outlet_id,
        "data": engine.get_stock_recommendations()
    }

@router.get("/intelligence/wastage-sales", status_code=status.HTTP_200_OK)
def get_wastage_sales_intelligence(
    days: int = 7,
    db: Session = Depends(get_db),
    outlet_id: str = Depends(require_outlet_scope),
    current_user = Depends(get_current_active_user),
):
    from app.services.ai_wastage_sales_intelligence import build_wastage_sales_intelligence
    try:
        data = build_wastage_sales_intelligence(db, current_user.company_id, outlet_id, days)
    except ValueError as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=str(exc))
    return {"success": True, "data": data}
