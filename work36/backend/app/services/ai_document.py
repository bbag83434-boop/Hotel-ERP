from __future__ import annotations
import base64, hashlib, json, os, re, uuid
from datetime import datetime
from typing import Any, Dict
from app.services.ai_provider import get_provider, AIProviderError

ALLOWED = {'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png', 'text/plain': '.txt'}

def decode_file(file_type: str, b64: str) -> bytes:
    if file_type not in ALLOWED:
        raise ValueError('Unsupported document type. Use PDF, JPG, PNG, or TXT.')
    try: raw = base64.b64decode(b64, validate=True)
    except Exception as exc: raise ValueError('Invalid base64 document data.') from exc
    if not raw: raise ValueError('Empty document.')
    if len(raw) > 10 * 1024 * 1024: raise ValueError('Document exceeds 10 MB limit.')
    if file_type == 'application/pdf' and not raw.startswith(b'%PDF-'): raise ValueError('Invalid PDF signature.')
    if file_type in {'image/jpeg','image/jpg'} and not raw.startswith(b'\xff\xd8'): raise ValueError('Invalid JPEG signature.')
    if file_type == 'image/png' and not raw.startswith(b'\x89PNG\r\n\x1a\n'): raise ValueError('Invalid PNG signature.')
    return raw

def extract_text(raw: bytes, file_type: str) -> str:
    if file_type == 'text/plain': return raw.decode('utf-8', errors='replace')[:30000]
    if file_type == 'application/pdf':
        try:
            from pypdf import PdfReader
            import io
            reader = PdfReader(io.BytesIO(raw))
            return '\n'.join((p.extract_text() or '') for p in reader.pages)[:30000]
        except Exception:
            return ''
    # OCR is optional. If unavailable, the document remains safely stored for manual review.
    try:
        import io
        from PIL import Image
        import pytesseract
        return pytesseract.image_to_string(Image.open(io.BytesIO(raw)))[:30000]
    except Exception:
        return ''

def deterministic_fields(text: str) -> Dict[str, Any]:
    patterns = {
        'invoice_number': [r'(?:invoice\s*(?:no|number|#)\s*[:\-]?\s*)([A-Z0-9\-/]+)'],
        'invoice_date': [r'(?:invoice\s*date|date)\s*[:\-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})'],
        'gst_number': [r'\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b'],
        'total_amount': [r'(?:grand\s*total|total\s*(?:amount|payable)|net\s*amount)\s*[:\-]?\s*(?:₹|INR|Rs\.?\s*)?([0-9,]+(?:\.\d{1,2})?)']
    }
    out: Dict[str, Any] = {}
    for key, ps in patterns.items():
        for p in ps:
            m = re.search(p, text, flags=re.I)
            if m:
                out[key] = m.group(1).replace(',', '')
                break
    return out

def ai_extract(text: str) -> tuple[Dict[str, Any], str|None, str|None]:
    if not text.strip(): return {}, None, None
    provider = get_provider()
    prompt = '''Extract supplier invoice fields from the document text. Return ONLY valid JSON with keys: invoice_number, invoice_date, supplier_name, supplier_gst_number, po_number, subtotal, tax_amount, total_amount, currency, line_items. line_items must be an array of {description, quantity, unit, unit_price, tax_percent, line_total}. Use null when unknown. Never invent values.'''
    result = provider.generate([
        {'role':'system','content':'You are a strict invoice data extraction engine. Never invent data. Return JSON only.'},
        {'role':'user','content':prompt+'\n\nDOCUMENT TEXT:\n'+text[:28000]}
    ], temperature=0, max_tokens=1800)
    try:
        data = json.loads(result.text)
        if not isinstance(data, dict): raise ValueError
    except Exception as exc:
        raise AIProviderError('AI invoice extraction returned invalid JSON.') from exc
    return data, result.provider, result.model
