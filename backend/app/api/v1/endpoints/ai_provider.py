from typing import List, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from app.core.auth import require_outlet_scope
from app.services.ai_provider import AIProviderError, get_provider, get_provider_status

router = APIRouter()

class GenerateRequest(BaseModel):
    messages: List[Dict[str, str]] = Field(min_length=1, max_length=20)
    provider: str | None = None
    temperature: float = Field(default=0.2, ge=0, le=1)
    max_tokens: int = Field(default=800, ge=1, le=4000)

@router.get("/providers")
def provider_status(outlet_id: str = Depends(require_outlet_scope)):
    # outlet_id dependency ensures this metadata endpoint remains authenticated/scoped.
    return {"success": True, "data": get_provider_status()}

@router.post("/generate")
def generate(req: GenerateRequest, outlet_id: str = Depends(require_outlet_scope)):
    try:
        provider = get_provider(req.provider)
        result = provider.generate(req.messages, req.temperature, req.max_tokens)
        return {"success": True, "outlet_id": outlet_id, "data": {"text": result.text, "provider": result.provider, "model": result.model, "usage": result.usage, "request_id": result.request_id}}
    except AIProviderError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
