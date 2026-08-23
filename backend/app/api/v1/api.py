from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, users, organization, hr, inventory, recipe, procurement, wastage, reports, ai

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication & RBAC"])
api_router.include_router(users.router, prefix="/users", tags=["User & Admin Management"])
api_router.include_router(organization.router, prefix="/organization", tags=["Organization, Branches & Staff"])
api_router.include_router(hr.router, prefix="/hr", tags=["HR, Attendance & Payroll"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Multi-Outlet Inventory & Central Commissary"])
api_router.include_router(procurement.router, prefix="/procurement", tags=["Procurement, Consolidation & Supplier WhatsApp"])
api_router.include_router(recipe.router, prefix="/recipes", tags=["Recipe / BOM Engine & Production"])
api_router.include_router(wastage.router, prefix="/wastage", tags=["Wastage & Food Loss Management"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports & Analytics Foundation"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI & Automation Foundation"])
api_router.include_router(health.router, prefix="/health", tags=["Health & Diagnostics"])


