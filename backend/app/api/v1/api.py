from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, organization, hr, inventory, recipe, procurement

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication & RBAC"])
api_router.include_router(organization.router, prefix="/organization", tags=["Organization, Branches & Staff"])
api_router.include_router(hr.router, prefix="/hr", tags=["HR, Attendance & Payroll"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Multi-Outlet Inventory & Central Commissary"])
api_router.include_router(procurement.router, prefix="/procurement", tags=["Procurement, Consolidation & Supplier WhatsApp"])
api_router.include_router(recipe.router, prefix="/recipes", tags=["Recipe / BOM Engine & Production"])
api_router.include_router(health.router, prefix="/health", tags=["Health & Diagnostics"])

