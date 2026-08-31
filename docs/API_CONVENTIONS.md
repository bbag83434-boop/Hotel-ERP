# HOTEL-ERP API CONVENTIONS & DESIGN STANDARDS
**Version:** 2.0.0  
**Base URL:** `/api/v1`  
**Protocol:** HTTPS / REST / JSON  

---

## 1. HTTP METHODS & REST ROUTING

| Method | Purpose | Success Status | Idempotent |
| :--- | :--- | :--- | :--- |
| **GET** | Retrieve single or collection resources | `200 OK` | Yes |
| **POST** | Create new resource or initiate action | `201 Created` / `200 OK` | No |
| **PUT** | Full replacement of resource | `200 OK` | Yes |
| **PATCH** | Partial field update | `200 OK` | Yes |
| **DELETE**| Soft or hard delete resource | `200 OK` / `204 No Content` | Yes |

---

## 2. STANDARD REQUEST HEADERS

All requests sent by the client must provide:
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
X-Outlet-Id: <ACTIVE_BRANCH_UUID>
Content-Type: application/json
X-Requested-With: XMLHttpRequest
```

---

## 3. ENVELOPE RESPONSE STRUCTURE

### 3.1 Successful Response (`success: true`)
```json
{
  "success": true,
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "Basmati Rice 25kg",
    "code": "RM-RIC-001"
  },
  "meta": {
    "total": 1,
    "page": 1,
    "pageSize": 20
  },
  "timestamp": "2026-08-24T15:30:00.000Z"
}
```

### 3.2 Error Response (`success: false`)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input validation failed",
    "details": [
      {
        "loc": ["body", "quantity"],
        "msg": "Input should be greater than 0",
        "type": "greater_than"
      }
    ]
  },
  "timestamp": "2026-08-24T15:30:00.000Z"
}
```

---

## 4. ERROR CODE STANDARDS

| HTTP Status | Error Code | Description |
| :--- | :--- | :--- |
| **400** | `VALIDATION_ERROR` | Request payload fails schema validation or business constraints |
| **400** | `INSUFFICIENT_STOCK` | Warehouse balance cannot fulfill requested consumption or transfer |
| **400** | `CLOSING_PERIOD_LOCKED` | Attempted modification of finalized bi-monthly closing records |
| **401** | `UNAUTHORIZED` | Invalid, missing, or expired JWT token |
| **403** | `PERMISSION_DENIED` | User lacks required RBAC role permission or outlet scope |
| **404** | `NOT_FOUND` | Requested entity ID does not exist |
| **409** | `CONFLICT` | Unique key collision (e.g. duplicate item code or duplicate username) |
| **500** | `INTERNAL_SERVER_ERROR` | Unhandled server exception with structured log capture |

---

## 5. PAGINATION, SORTING & FILTERING

- Pagination Query Params: `?page=1&limit=20` (or `?skip=0&limit=50`)
- Sorting: `?sort_by=createdAt&order=desc`
- Search: `?search=query_string`
- Date Range: `?start_date=2026-08-01&end_date=2026-08-15`
- Branch Scope: Handled implicitly via `X-Outlet-Id` header or explicitly with `?branch_id=...` for HQ queries.
