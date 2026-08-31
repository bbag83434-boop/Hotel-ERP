from typing import Any, Optional, Dict
from fastapi import HTTPException, status

class AppException(HTTPException):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Optional[Any] = None
    ):
        super().__init__(
            status_code=status_code,
            detail={
                "success": False,
                "error": {
                    "code": code,
                    "message": message,
                    "details": details
                }
            }
        )
        self.code = code
        self.message = message
        self.details = details

class UnauthorizedException(AppException):
    def __init__(self, message: str = "Authentication required to access this resource"):
        super().__init__(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", message)

class ForbiddenException(AppException):
    def __init__(self, message: str = "You do not have permission to perform this action or access this outlet scope"):
        super().__init__(status.HTTP_403_FORBIDDEN, "PERMISSION_DENIED", message)

class NotFoundException(AppException):
    def __init__(self, resource: str = "Resource", identifier: Optional[str] = None):
        msg = f"{resource} with id '{identifier}' not found" if identifier else f"{resource} not found"
        super().__init__(status.HTTP_404_NOT_FOUND, "NOT_FOUND", msg)

class ValidationException(AppException):
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(status.HTTP_400_BAD_REQUEST, "VALIDATION_ERROR", message, details)

class BadRequestException(ValidationException):
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(message=message, details=details)

class ConflictException(AppException):
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(status.HTTP_409_CONFLICT, "CONFLICT", message, details)

class InsufficientStockException(AppException):
    def __init__(self, item: str, required: float, available: float, unit: str = "units"):
        shortage = required - available
        msg = f"Insufficient stock for {item}: Required {required} {unit}, Available {available} {unit}. Shortage: {shortage} {unit}"
        super().__init__(
            status.HTTP_400_BAD_REQUEST,
            "INSUFFICIENT_STOCK",
            msg,
            {
                "item": item,
                "required": required,
                "available": available,
                "shortage": shortage,
                "unit": unit
            }
        )

class InvoiceMismatchException(AppException):
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(status.HTTP_400_BAD_REQUEST, "INVOICE_MISMATCH", message, details)

class ApprovalRequiredException(AppException):
    def __init__(self, action: str, threshold: Optional[Any] = None):
        super().__init__(
            status.HTTP_403_FORBIDDEN,
            "APPROVAL_REQUIRED",
            f"Approval required for action: {action}",
            {"action": action, "threshold": threshold}
        )

class DuplicateRequestException(AppException):
    def __init__(self, idempotency_key: str):
        super().__init__(
            status.HTTP_409_CONFLICT,
            "DUPLICATE_REQUEST",
            f"Duplicate request detected with idempotency key: {idempotency_key}",
            {"idempotencyKey": idempotency_key}
        )

class ClosingPeriodLockedException(AppException):
    def __init__(self, period: str, outlet: str):
        super().__init__(
            status.HTTP_400_BAD_REQUEST,
            "CLOSING_PERIOD_LOCKED",
            f"The closing period '{period}' for outlet '{outlet}' has already been finalized and locked.",
            {"period": period, "outlet": outlet}
        )
