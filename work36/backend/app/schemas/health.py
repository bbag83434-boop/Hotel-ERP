from pydantic import BaseModel
from typing import Optional, Dict, Any, List

class MemoryUsage(BaseModel):
    heapUsedMB: float
    heapTotalMB: float
    rssMB: float

class DatabaseHealth(BaseModel):
    status: str
    latencyMs: Optional[float] = None
    message: Optional[str] = None

class SystemFeatures(BaseModel):
    multiOutletScope: bool = True
    centralPurchaseControl: bool = True
    linkedTransactions: bool = True
    biMonthlyClosing: bool = True
    aiAutomationReady: bool = True

class SystemHealthResponse(BaseModel):
    status: str
    version: str
    environment: str
    timestamp: str
    uptimeSeconds: int
    memoryUsage: MemoryUsage
    database: DatabaseHealth
    features: SystemFeatures

class ApiResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None
    meta: Optional[Dict[str, Any]] = None
    timestamp: str
