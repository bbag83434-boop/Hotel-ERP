from pydantic import BaseModel
from typing import List

class DailyTrendItem(BaseModel):
    date: str
    sales: float
    purchase: float

class DashboardTrendResponse(BaseModel):
    trend: List[DailyTrendItem]
