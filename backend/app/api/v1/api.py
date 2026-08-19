from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, organization

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication & RBAC"])
api_router.include_router(organization.router, prefix="/organization", tags=["Organization, Branches & Staff"])
api_router.include_router(health.router, prefix="/health", tags=["Health & Diagnostics"])
