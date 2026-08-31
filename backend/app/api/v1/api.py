from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, users, organization, hr, inventory, recipe, procurement, wastage, reports, ai, orders, billing, customer_support, maintenance, beverage, finance, hotel, cashier_shift, expense, ai_provider, ai_tools, notifications, ai_document, whatsapp, dashboard

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication & RBAC"])
api_router.include_router(users.router, prefix="/users", tags=["User & Admin Management"])
api_router.include_router(organization.router, prefix="/organization", tags=["Organization, Branches & Staff"])
api_router.include_router(hr.router, prefix="/hr", tags=["HR, Attendance & Payroll"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Multi-Outlet Inventory & Central Commissary"])
api_router.include_router(procurement.router, prefix="/procurement", tags=["Procurement, Consolidation & Supplier WhatsApp"])
api_router.include_router(billing.router, prefix="/procurement", tags=["Supplier Bills, Payments & Vendor Ledger"])
api_router.include_router(recipe.router, prefix="/recipes", tags=["Recipe / BOM Engine & Production"])
api_router.include_router(wastage.router, prefix="/wastage", tags=["Wastage & Food Loss Management"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports & Analytics Foundation"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI & Automation Foundation"])
api_router.include_router(orders.router, prefix="/orders", tags=["Restaurant Orders & Channel Integration"])
api_router.include_router(customer_support.router, prefix="/crm", tags=["Customer CRM & Complaints"])
api_router.include_router(maintenance.router, prefix="/maintenance", tags=["Maintenance & Asset Management"])
api_router.include_router(beverage.router, prefix="/beverage", tags=["Beverage Control"])
api_router.include_router(finance.router, prefix="/finance", tags=["Accounts & Finance"])
api_router.include_router(hotel.router, prefix="/hotel", tags=["Hotel Operations"])
api_router.include_router(health.router, prefix="/health", tags=["Health & Diagnostics"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])



api_router.include_router(cashier_shift.router, prefix="/cashier-shift", tags=["Cashier Shift & Payment Reconciliation"])
api_router.include_router(expense.router, prefix="/finance-control", tags=["Expenses & Account Reconciliation"])

api_router.include_router(ai_provider.router, prefix="/ai-provider", tags=["AI Provider Abstraction"])
api_router.include_router(ai_tools.router, prefix="/ai/tools", tags=["AI Controlled Tools"])

api_router.include_router(notifications.router, prefix="/notifications", tags=["Telegram Notifications"])

api_router.include_router(ai_document.router, prefix="/ai/documents", tags=["AI Invoice & Document Processing"])

api_router.include_router(whatsapp.router, prefix="/whatsapp", tags=["WhatsApp Business Integration"])
