from fastapi.encoders import jsonable_encoder
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.core.security_hardening import SecurityHeadersMiddleware, RequestSizeLimitMiddleware, AbuseRateLimitMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from contextlib import asynccontextmanager
import time
import logging
from app.core.config import settings
from app.core.database import check_database_connection
from app.core.order_schema_bootstrap import ensure_order_columns
from app.core.billing_schema_bootstrap import ensure_billing_schema
from app.core.customer_support_schema_bootstrap import ensure_customer_support_schema
from app.core.maintenance_schema_bootstrap import ensure_maintenance_schema
from app.core.beverage_schema_bootstrap import ensure_beverage_schema
from app.core.finance_schema_bootstrap import ensure_finance_schema
from app.core.hotel_schema_bootstrap import ensure_hotel_schema
from app.core.cashier_schema_bootstrap import ensure_cashier_schema
from app.core.expense_schema_bootstrap import ensure_expense_schema
from app.core.notification_schema_bootstrap import ensure_notification_schema
from app.core.ai_document_schema_bootstrap import ensure_ai_document_schema
from app.core.exceptions import AppException
from app.api.v1.api import api_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("apex_erp")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting APEX Multi-Outlet ERP Backend (FastAPI + SQLAlchemy)...")
    check_database_connection()
    try:
        ensure_order_columns()
        logger.info("✅ Order channel schema compatibility check complete")
        ensure_billing_schema()
        logger.info("✅ Billing schema compatibility check complete")
        ensure_customer_support_schema()
        logger.info("✅ Customer/complaint schema compatibility check complete")
        ensure_maintenance_schema()
        logger.info("✅ Maintenance/asset schema compatibility check complete")
        ensure_beverage_schema()
        logger.info("✅ Beverage schema compatibility check complete")
        ensure_finance_schema()
        logger.info("✅ Finance schema compatibility check complete")
        ensure_hotel_schema()
        logger.info("✅ Hotel schema compatibility check complete")
        ensure_cashier_schema()
        logger.info("✅ Cashier shift schema compatibility check complete")
        ensure_expense_schema()
        logger.info("✅ Expense/reconciliation schema compatibility check complete")
        ensure_notification_schema()
        ensure_ai_document_schema()
        logger.info("✅ Notification schema compatibility check complete")
    except Exception as exc:
        logger.warning("Schema bootstrap skipped: %s", exc)
    yield
    logger.info("🛑 Shutting down APEX Multi-Outlet ERP Backend...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

if settings.is_production and not settings.security_ready:
    raise RuntimeError("Production JWT secrets are missing or unsafe")

# Part 33 performance middleware
# Compress JSON/API responses while leaving already-compressed payloads untouched.
app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=5)

# Part 32 security middleware
app.add_middleware(RequestSizeLimitMiddleware, max_bytes=12 * 1024 * 1024)
app.add_middleware(AbuseRateLimitMiddleware, limit=30, window_seconds=60)
app.add_middleware(SecurityHeadersMiddleware)

# CORS configuration
if settings.is_production and (not settings.BACKEND_CORS_ORIGINS or "*" in settings.BACKEND_CORS_ORIGINS):
    raise RuntimeError("BACKEND_CORS_ORIGINS must explicitly list trusted frontend origins in production")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Outlet-Id", "X-Request-ID", "X-Telegram-Bot-Api-Secret-Token", "X-Hub-Signature-256", "X-Requested-With", "Accept", "Origin"],
)

# Structured Request Logging Middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = round((time.time() - start_time) * 1000, 2)
    response.headers["X-Response-Time"] = f"{process_time}ms"
    logger.info(f"{request.method} {request.url.path} - {response.status_code} [{process_time}ms]")
    return response

# Standardized Error Handling
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details
            },
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Input validation failed",
                "details": jsonable_encoder(exc.errors())
            },
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Please try again later."
            },
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }
    )

# Register v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "backend": "FastAPI + Python",
        "docs": f"{settings.API_V1_STR}/docs",
        "health": f"{settings.API_V1_STR}/health"
    }
