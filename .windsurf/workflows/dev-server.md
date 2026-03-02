---
description: How to start the full dev environment (backend, frontend, Redis, Celery, ngrok) without conflicts
---

# Full Dev Environment Startup Guide

## Prerequisites
- Docker Desktop installed (used only for Redis)
- Python 3.13+ with backend dependencies installed (`pip install -r backend/requirements.txt`)
- Node.js with frontend dependencies installed (`npm install` in `frontend/`)
- ngrok installed and authenticated

## ⚠️ Known Issues & Pitfalls

### 1. Docker Compose Starts Conflicting Containers
**Problem**: Docker Desktop may auto-start containers from `docker-compose.prod.yml` including `linkedinwarrior-backend` (port 8000), `linkedinwarrior-celery`, and `linkedinwarrior-beat`. The Docker backend container binds to port 8000, conflicting with your local uvicorn. This causes **intermittent 404 errors** — requests randomly hit either Docker's stale backend or local uvicorn.

**Fix**: Always stop these containers before starting the local dev server. Only keep `linkedinwarrior-redis` running.

### 2. Redis URL: `localhost` Not `redis`
**Problem**: The `.env` file may have `REDIS_URL=redis://redis:6379/0`. The hostname `redis` is a Docker internal hostname that only resolves inside the Docker network. Native Celery on Windows cannot resolve it, causing `Error 11001 connecting to redis:6379. getaddrinfo failed`.

**Fix**: Ensure `.env` has `REDIS_URL=redis://localhost:6379/0` for local dev.

### 3. Celery `-B` Flag Doesn't Work on Windows
**Problem**: Running `celery -A app.celery_app worker -B` fails with `Invalid value for '-B': -B option does not work on Windows`.

**Fix**: Run Celery worker and Celery beat as **separate processes**.

### 4. Stale Python Processes on Port 8000
**Problem**: Killing uvicorn sometimes leaves orphan child processes (from `--reload` mode) still bound to port 8000. New uvicorn starts alongside the ghost, causing random routing.

**Fix**: Always verify port 8000 is clear before starting uvicorn. Kill ALL listening processes on 8000 first.

### 5. Docker Desktop Instability
**Problem**: Docker Desktop on this machine occasionally crashes, killing the Redis container. When Redis dies, Celery tasks fail silently and emails get stuck in `new` status.

**Fix**: The `email_webhook.py` has an inline fallback — if Celery/Redis is unavailable, emails are processed directly via the LangGraph agent. No emails should be lost even if Redis goes down.

---

## Startup Steps (Follow in Order)

### Step 1: Stop Conflicting Docker Containers
// turbo
```
docker stop linkedinwarrior-backend linkedinwarrior-celery linkedinwarrior-beat 2>$null
```
This prevents Docker's production containers from conflicting with local dev servers.

### Step 2: Start Redis (Docker)
// turbo
```
docker start linkedinwarrior-redis
```
Verify it's running:
// turbo
```
python -c "import redis; r = redis.Redis(host='localhost', port=6379); print('Redis ping:', r.ping())"
```
If the container doesn't exist, create it:
```
docker run -d --name linkedinwarrior-redis -p 6379:6379 redis:7-alpine
```

### Step 3: Verify .env Configuration
// turbo
```
python -c "from app.config import settings; print('REDIS_URL:', settings.REDIS_URL); print('BACKEND_URL:', settings.BACKEND_URL)"
```
Ensure:
- `REDIS_URL=redis://localhost:6379/0` (NOT `redis://redis:6379/0`)
- `BACKEND_URL` matches your ngrok URL (if using ngrok) or `http://localhost:8000`

### Step 4: Kill Any Stale Processes on Port 8000
// turbo
```
$pids = netstat -ano | Select-String ":8000.*LISTENING" | ForEach-Object { ($_ -split '\s+')[-1] } | Sort-Object -Unique; foreach ($p in $pids) { Write-Host "Killing PID $p"; taskkill /F /PID $p 2>$null }; Start-Sleep 2; $check = netstat -ano | Select-String ":8000.*LISTENING"; if ($check) { Write-Host "WARNING: Port 8000 still in use" } else { Write-Host "Port 8000 clear" }
```

### Step 5: Start Backend (uvicorn)
```
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Run in its own terminal. Wait for `Application startup complete.`

Verify email routes are loaded:
// turbo
```
python -c "import httpx; r = httpx.get('http://localhost:8000/openapi.json'); paths = r.json()['paths']; email_paths = [p for p in paths if 'email' in p]; print(len(email_paths), 'email routes — expected 12')"
```
If 0 email routes, there's still a stale process. Repeat Step 4.

### Step 6: Start Celery Worker
```
cd backend
celery -A app.celery_app worker --loglevel=info -Q default,publishing,analytics,email --pool=solo
```
Run in its own terminal. Wait for `Connected to redis://localhost:6379/0`.

**Important**: Do NOT use `-B` flag on Windows. Beat runs separately (Step 7).

### Step 7: Start Celery Beat
```
cd backend
celery -A app.celery_app beat --loglevel=info --schedule=celerybeat-schedule
```
Run in its own terminal. Wait for `beat: Starting...`.

### Step 8: Start Frontend
```
cd frontend
npm run dev
```
Run in its own terminal. Frontend runs on `http://localhost:3000`.

### Step 9: Start ngrok (if needed for webhooks)
```
ngrok http 8000
```
Run in its own terminal. Copy the HTTPS forwarding URL and update:
1. `backend/.env` → `BACKEND_URL=https://<your-ngrok-url>`
2. Restart the backend (Step 5) so the Unipile webhook re-registers with the new URL

---

## Quick Health Check
// turbo
```
python -c "import httpx; print('Backend:', httpx.get('http://localhost:8000/health').json()); print('Email routes:', len([p for p in httpx.get('http://localhost:8000/openapi.json').json()['paths'] if 'email' in p]))"
```

## Reprocessing Stuck Emails
If emails are stuck in `new` status (e.g., after a Redis crash), run from `backend/`:
```python
import asyncio
from app.db import get_supabase
from app.agents.email_responder import process_email

async def main():
    db = get_supabase()
    stuck = db.table("emails").select("id, subject, body_text, from_name, from_email, user_id").eq("status", "new").execute()
    for e in (stuck.data or []):
        await process_email(user_id=e["user_id"], email_id=e["id"], email_subject=e.get("subject",""), email_body=(e.get("body_text","") or "")[:10000], from_name=e.get("from_name",""), from_email=e.get("from_email",""))
        print(f"Processed: {e['id']}")

asyncio.run(main())
```

## Process Summary (5 terminals needed)

| Terminal | Command | Port |
|----------|---------|------|
| 1 | `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` | 8000 |
| 2 | `celery -A app.celery_app worker --loglevel=info -Q default,publishing,analytics,email --pool=solo` | — |
| 3 | `celery -A app.celery_app beat --loglevel=info --schedule=celerybeat-schedule` | — |
| 4 | `npm run dev` (in frontend/) | 3000 |
| 5 | `ngrok http 8000` (optional, for webhooks) | 4040 |
