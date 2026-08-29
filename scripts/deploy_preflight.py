"""Part 34 deployment preflight. Never deploys or mutates infrastructure."""
from pathlib import Path
import os, sys

errors=[]
root=Path(__file__).resolve().parents[1]
required=["render.yaml","backend/requirements.txt","frontend/package.json",".env.example"]
for rel in required:
    if not (root/rel).exists(): errors.append(f"missing: {rel}")

if os.getenv("ENVIRONMENT","development").lower()=="production":
    for key in ("DATABASE_URL","JWT_ACCESS_SECRET","JWT_REFRESH_SECRET","BACKEND_CORS_ORIGINS"):
        if not os.getenv(key): errors.append(f"production env missing: {key}")
    if os.getenv("BACKEND_CORS_ORIGINS","").strip()=="*": errors.append("BACKEND_CORS_ORIGINS cannot be * in production")

render=(root/"render.yaml").read_text()
if 'CORS_ORIGINS\n        value: "*"' in render: errors.append("render.yaml contains wildcard CORS")
if 'healthCheckPath:' not in render: errors.append("render.yaml missing health checks")

print("PART 34 DEPLOYMENT PREFLIGHT")
if errors:
    for e in errors: print("FAIL:",e)
    sys.exit(1)
print("PASS: deployment configuration is structurally ready")
print("NOTE: this script does not deploy, migrate, seed, push, or modify production.")
