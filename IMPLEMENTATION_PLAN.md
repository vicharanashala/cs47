# EscalateIQ — Full Implementation Plan

> **Purpose:** This document is the single source of truth for building EscalateIQ — a crowdsourced, semantically-aware FAQ generation platform. Any LLM or developer reading this should be able to understand the full scope, architecture, folder structure, and build every feature step by step without ambiguity.
>
> **Do not deviate from the folder structure, import paths, or naming conventions defined here. Every path in this document is canonical.**

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Core Concepts & Terminology](#2-core-concepts--terminology)
3. [Tech Stack](#3-tech-stack)
4. [Project Folder Structure](#4-project-folder-structure)
5. [Database Schema](#5-database-schema)
6. [Environment Variables](#6-environment-variables)
7. [Feature List & Implementation Steps](#7-feature-list--implementation-steps)
   - [F1 — Project Bootstrapping](#f1--project-bootstrapping)
   - [F2 — Authentication & User Profiles](#f2--authentication--user-profiles)
   - [F3 — Semantic Safety Layer](#f3--semantic-safety-layer)
   - [F4 — Embedding Service](#f4--embedding-service)
   - [F5 — FAQ Knowledge Base](#f5--faq-knowledge-base)
   - [F6 — Escalation Engine](#f6--escalation-engine)
   - [F7 — Public Feed](#f7--public-feed)
   - [F8 — Answer Pipeline](#f8--answer-pipeline)
   - [F9 — Admin Verification Queue](#f9--admin-verification-queue)
   - [F10 — FAQ Auto-Promotion](#f10--faq-auto-promotion)
   - [F11 — Reputation & Points System](#f11--reputation--points-system)
   - [F12 — Penalty System](#f12--penalty-system)
   - [F13 — Flagging System](#f13--flagging-system)
   - [F14 — Notification Service](#f14--notification-service)
   - [F15 — RAG Answer Generation](#f15--rag-answer-generation)
   - [F16 — Frontend: Web App](#f16--frontend-web-app)
8. [API Route Reference](#8-api-route-reference)
9. [Build Order](#9-build-order)
10. [Key Business Rules Summary](#10-key-business-rules-summary)

---

## 1. Product Overview

EscalateIQ is a social-media-style platform where users raise queries (called "escalations") and the system:

1. Checks if the FAQ already answers it — if yes, shows the FAQ answer via RAG (no new post created)
2. Checks if a similar open escalation already exists in the feed — if yes, auto-upvotes it (no new post created)
3. Only if both miss — creates a new escalation in the public feed
4. Community members answer escalations; admins verify answers
5. Verified answers are automatically promoted to the FAQ knowledge base
6. The FAQ grows over time, catching more queries at step 1, creating a self-improving loop

Users earn points for verified answers, lose points for violations. Flagging requires 50 pts minimum to prevent abuse.

---

## 2. Core Concepts & Terminology

| Term | Definition |
|---|---|
| **Escalation** | A user-submitted query that passed both FAQ and feed semantic checks and is now live in the public feed |
| **FAQ Entry** | A verified, permanent knowledge base item — question + verified answer + tags + source escalation reference |
| **Unverified Answer** | An answer submitted by any user, not yet reviewed by admin |
| **Verified Answer** | An admin-approved answer; triggers FAQ promotion and points award |
| **Auto-upvote** | System automatically upvotes an existing escalation on behalf of a new user whose query semantically matched it |
| **Semantic threshold — FAQ** | Cosine similarity score ≥ 0.85 → treat as FAQ match |
| **Semantic threshold — Feed** | Cosine similarity score ≥ 0.75 → treat as feed match, auto-upvote |
| **Embedding** | 384-dimensional float vector representing the semantic meaning of a text, produced by `all-MiniLM-L6-v2` |
| **RAG** | Retrieval-Augmented Generation — retrieve top-k FAQ chunks, pass as context to LLM to generate a grounded answer |
| **Flag** | A user report on a post/answer for admin review. Requires 50 pts to submit |
| **Penalty points** | Negative reputation impact for violations |

---

## 3. Tech Stack

### Backend
- **Runtime:** Python 3.11+
- **Framework:** FastAPI
- **Task queue:** Celery + Redis (async jobs: embedding, notifications, verification processing)
- **Primary DB:** PostgreSQL 15 (via SQLAlchemy 2.0 async + Alembic migrations)
- **Vector store:** pgvector extension on PostgreSQL (keeps everything in one DB, no extra service)
- **Cache:** Redis (sessions, feed cache, rate limiting)
- **Embedding model:** `sentence-transformers` — model `all-MiniLM-L6-v2` (local, no API call needed)
- **Safety classifier:** `detoxify` library (local inference)
- **LLM for RAG:** OpenAI GPT-4o-mini via API (or Gemini Flash — configurable via env var)
- **Auth:** JWT (access + refresh tokens) via `python-jose` + `passlib[bcrypt]`
- **WebSocket:** FastAPI native WebSocket for real-time feed updates

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State:** Zustand (global), React Query (server state + caching)
- **Real-time:** native WebSocket client hook
- **HTTP client:** axios with interceptors for JWT refresh

### Infrastructure
- **Containerisation:** Docker + docker-compose (local dev)
- **Reverse proxy:** Nginx (production)
- **Object storage:** Local filesystem (dev), S3-compatible (prod) — for profile images only

---

## 4. Project Folder Structure

This is the canonical structure. Every import path in the codebase must resolve against this layout.

```
escalateiq/
├── backend/
│   ├── alembic/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/                    # migration files go here
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                      # FastAPI app entry point
│   │   ├── config.py                    # settings via pydantic-settings
│   │   ├── database.py                  # async SQLAlchemy engine + session factory
│   │   ├── dependencies.py              # FastAPI Depends() — get_db, get_current_user, etc.
│   │   │
│   │   ├── models/                      # SQLAlchemy ORM models
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── escalation.py
│   │   │   ├── answer.py
│   │   │   ├── faq.py
│   │   │   ├── flag.py
│   │   │   ├── vote.py
│   │   │   └── notification.py
│   │   │
│   │   ├── schemas/                     # Pydantic request/response schemas
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── escalation.py
│   │   │   ├── answer.py
│   │   │   ├── faq.py
│   │   │   ├── flag.py
│   │   │   └── notification.py
│   │   │
│   │   ├── routers/                     # FastAPI APIRouter per domain
│   │   │   ├── __init__.py
│   │   │   ├── auth.py                  # /api/auth/*
│   │   │   ├── users.py                 # /api/users/*
│   │   │   ├── escalations.py           # /api/escalations/*
│   │   │   ├── answers.py               # /api/answers/*
│   │   │   ├── faq.py                   # /api/faq/*
│   │   │   ├── flags.py                 # /api/flags/*
│   │   │   ├── admin.py                 # /api/admin/*
│   │   │   └── websocket.py             # /ws/*
│   │   │
│   │   ├── services/                    # Business logic layer
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py
│   │   │   ├── user_service.py
│   │   │   ├── escalation_service.py    # core escalation lifecycle
│   │   │   ├── answer_service.py
│   │   │   ├── faq_service.py
│   │   │   ├── flag_service.py
│   │   │   ├── semantic_service.py      # embedding + similarity search
│   │   │   ├── safety_service.py        # detoxify classifier
│   │   │   ├── rag_service.py           # RAG answer generation
│   │   │   ├── reputation_service.py    # points + badges
│   │   │   └── notification_service.py
│   │   │
│   │   ├── tasks/                       # Celery async tasks
│   │   │   ├── __init__.py
│   │   │   ├── celery_app.py            # Celery instance
│   │   │   ├── embedding_tasks.py       # async embed + upsert to vector store
│   │   │   └── notification_tasks.py    # async email/push dispatch
│   │   │
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── jwt.py                   # token create/decode helpers
│   │       └── pagination.py            # cursor-based pagination helper
│   │
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   ├── test_escalations.py
│   │   ├── test_semantic.py
│   │   └── test_reputation.py
│   │
│   ├── alembic.ini
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/                         # Next.js App Router
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                 # / → redirect to /feed
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── register/page.tsx
│   │   │   ├── feed/
│   │   │   │   └── page.tsx             # public escalation feed
│   │   │   ├── escalation/
│   │   │   │   └── [id]/page.tsx        # single escalation detail + answers
│   │   │   ├── faq/
│   │   │   │   ├── page.tsx             # FAQ index/search
│   │   │   │   └── [id]/page.tsx        # single FAQ entry
│   │   │   ├── profile/
│   │   │   │   └── [username]/page.tsx
│   │   │   └── admin/
│   │   │       ├── layout.tsx           # admin guard wrapper
│   │   │       ├── page.tsx             # admin dashboard
│   │   │       ├── queue/page.tsx       # verification queue
│   │   │       └── flags/page.tsx       # flagged content
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                      # generic reusable components
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   └── Toast.tsx
│   │   │   ├── escalation/
│   │   │   │   ├── EscalationCard.tsx
│   │   │   │   ├── EscalationFeed.tsx
│   │   │   │   ├── RaiseEscalationModal.tsx
│   │   │   │   └── SemanticMatchBanner.tsx  # shown when FAQ/feed match found
│   │   │   ├── answer/
│   │   │   │   ├── AnswerCard.tsx
│   │   │   │   └── AnswerForm.tsx
│   │   │   ├── faq/
│   │   │   │   ├── FAQCard.tsx
│   │   │   │   └── FAQSearchBar.tsx
│   │   │   └── admin/
│   │   │       ├── VerificationCard.tsx
│   │   │       └── FlagReviewCard.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useFeed.ts
│   │   │   ├── useWebSocket.ts
│   │   │   └── useReputation.ts
│   │   │
│   │   ├── lib/
│   │   │   ├── api.ts                   # axios instance + interceptors
│   │   │   └── queryClient.ts           # React Query client config
│   │   │
│   │   ├── store/
│   │   │   ├── authStore.ts             # Zustand: user, tokens
│   │   │   └── notificationStore.ts     # Zustand: toast queue
│   │   │
│   │   └── types/
│   │       └── index.ts                 # shared TypeScript interfaces
│   │
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml
├── nginx.conf
└── README.md
```

---

## 5. Database Schema

All tables live in PostgreSQL. pgvector extension must be enabled before first migration.

### users
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
username      VARCHAR(50) UNIQUE NOT NULL
email         VARCHAR(255) UNIQUE NOT NULL
password_hash VARCHAR(255) NOT NULL
role          VARCHAR(20) NOT NULL DEFAULT 'user'   -- 'user' | 'moderator' | 'admin'
reputation    INTEGER NOT NULL DEFAULT 0
is_banned     BOOLEAN NOT NULL DEFAULT false
ban_expires_at TIMESTAMPTZ NULL
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```

### escalations
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id       UUID NOT NULL REFERENCES users(id)
title         VARCHAR(300) NOT NULL
body          TEXT NOT NULL
status        VARCHAR(20) NOT NULL DEFAULT 'open'   -- 'open' | 'answered' | 'resolved' | 'removed'
upvote_count  INTEGER NOT NULL DEFAULT 0
view_count    INTEGER NOT NULL DEFAULT 0
tags          TEXT[]
embedding     VECTOR(384)                           -- pgvector column
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```

### answers
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
escalation_id    UUID NOT NULL REFERENCES escalations(id)
user_id          UUID NOT NULL REFERENCES users(id)
body             TEXT NOT NULL
status           VARCHAR(20) NOT NULL DEFAULT 'unverified'  -- 'unverified' | 'verified' | 'rejected'
rejection_reason TEXT NULL
verified_at      TIMESTAMPTZ NULL
verified_by      UUID NULL REFERENCES users(id)
upvote_count     INTEGER NOT NULL DEFAULT 0
created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
```

### faq_entries
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
question          TEXT NOT NULL
answer            TEXT NOT NULL
source_escalation UUID NULL REFERENCES escalations(id)
source_answer     UUID NULL REFERENCES answers(id)
tags              TEXT[]
embedding         VECTOR(384)                              -- pgvector column
is_published      BOOLEAN NOT NULL DEFAULT true
created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
```

### votes
```sql
id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id        UUID NOT NULL REFERENCES users(id)
target_id      UUID NOT NULL                              -- escalation_id or answer_id
target_type    VARCHAR(20) NOT NULL                       -- 'escalation' | 'answer'
created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE(user_id, target_id, target_type)
```

### flags
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
reporter_id  UUID NOT NULL REFERENCES users(id)
target_id    UUID NOT NULL
target_type  VARCHAR(20) NOT NULL                         -- 'escalation' | 'answer' | 'comment'
reason       VARCHAR(50) NOT NULL                         -- 'spam' | 'abuse' | 'duplicate' | 'off_topic' | 'pii'
status       VARCHAR(20) NOT NULL DEFAULT 'pending'       -- 'pending' | 'resolved' | 'dismissed'
reviewed_by  UUID NULL REFERENCES users(id)
created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
```

### reputation_events
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id     UUID NOT NULL REFERENCES users(id)
delta       INTEGER NOT NULL                              -- positive or negative
reason      VARCHAR(100) NOT NULL
ref_id      UUID NULL                                     -- escalation/answer/flag that triggered it
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```

### notifications
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id     UUID NOT NULL REFERENCES users(id)
type        VARCHAR(50) NOT NULL
payload     JSONB NOT NULL DEFAULT '{}'
is_read     BOOLEAN NOT NULL DEFAULT false
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```

### refresh_tokens
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id     UUID NOT NULL REFERENCES users(id)
token_hash  VARCHAR(255) NOT NULL
expires_at  TIMESTAMPTZ NOT NULL
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```

---

## 6. Environment Variables

Create `backend/.env` — never commit this file.

```env
# App
APP_ENV=development
SECRET_KEY=your-secret-key-min-32-chars
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Database
DATABASE_URL=postgresql+asyncpg://escalateiq:password@localhost:5432/escalateiq
SYNC_DATABASE_URL=postgresql://escalateiq:password@localhost:5432/escalateiq

# Redis
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

# LLM (pick one)
LLM_PROVIDER=openai                     # 'openai' | 'gemini'
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...

# Semantic thresholds
FAQ_SIMILARITY_THRESHOLD=0.85
FEED_SIMILARITY_THRESHOLD=0.75
RAG_TOP_K=5

# Safety
SAFETY_BLOCK_THRESHOLD=0.85
SAFETY_FLAG_THRESHOLD=0.60

# Email (optional for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...

# Admin escalation timeout (days before admin must answer)
ADMIN_ANSWER_TIMEOUT_DAYS=7
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

---

## 7. Feature List & Implementation Steps

---

### F1 — Project Bootstrapping

**Goal:** Get both services running locally with hot-reload and DB connected.

#### Steps

1. Create root folder `escalateiq/`. Inside it create `backend/`, `frontend/`.

2. In `backend/`, create `requirements.txt`:
   ```
   fastapi==0.111.0
   uvicorn[standard]==0.29.0
   sqlalchemy[asyncio]==2.0.30
   asyncpg==0.29.0
   alembic==1.13.1
   pydantic-settings==2.2.1
   pydantic[email]==2.7.1
   python-jose[cryptography]==3.3.0
   passlib[bcrypt]==1.7.4
   python-multipart==0.0.9
   pgvector==0.2.5
   sentence-transformers==2.7.0
   detoxify==0.5.2
   celery==5.4.0
   redis==5.0.4
   httpx==0.27.0
   openai==1.30.0
   google-generativeai==0.5.4
   pytest==8.2.0
   pytest-asyncio==0.23.6
   httpx==0.27.0
   ```

3. Create `backend/app/__init__.py` (empty).

4. Create `backend/app/config.py`:
   - Define `class Settings(BaseSettings)` loading all env vars listed in section 6
   - Instantiate `settings = Settings()` at module level
   - Import pattern everywhere: `from app.config import settings`

5. Create `backend/app/database.py`:
   - Create async SQLAlchemy engine using `settings.DATABASE_URL`
   - Create `AsyncSessionLocal` factory with `expire_on_commit=False`
   - Define `Base = declarative_base()`
   - Define `async def get_db()` as async generator yielding session — this is the standard FastAPI dependency
   - Import pattern: `from app.database import Base, get_db`

6. Create `backend/app/main.py`:
   - Instantiate `app = FastAPI(title="EscalateIQ")`
   - Add CORS middleware (allow `http://localhost:3000` in dev)
   - Register all routers with prefix `/api` (routers are empty stubs at this stage)
   - Add `/health` GET endpoint returning `{"status": "ok"}`

7. Create `backend/alembic.ini` pointing to `SYNC_DATABASE_URL`.

8. Run `alembic init alembic` inside `backend/`, then edit `alembic/env.py`:
   - Import `Base` from `app.database`
   - Import all models so Alembic sees them: `from app.models import user, escalation, answer, faq, flag, vote, notification`
   - Set `target_metadata = Base.metadata`

9. Enable pgvector in Postgres manually once: `CREATE EXTENSION IF NOT EXISTS vector;`

10. In `frontend/`, run `npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"`. Accept all defaults.

11. Create `docker-compose.yml` at root with services: `postgres` (image: `pgvector/pgvector:pg15`), `redis`, `backend` (build: `./backend`, port 8000), `frontend` (build: `./frontend`, port 3000), `celery_worker` (same build as backend, command: `celery -A app.tasks.celery_app worker`).

12. Verify: `docker-compose up` → `GET http://localhost:8000/health` returns 200.

---

### F2 — Authentication & User Profiles

**Goal:** Register, login, JWT access+refresh token flow, get current user.

#### Steps

1. Create `backend/app/models/user.py`:
   - Define `User` SQLAlchemy model matching the `users` schema exactly
   - Import `Base` from `app.database`
   - Add `__tablename__ = "users"`

2. Create first Alembic migration: `alembic revision --autogenerate -m "create_users_table"`. Run `alembic upgrade head`.

3. Create `backend/app/utils/jwt.py`:
   - `create_access_token(data: dict) -> str` — signs with `settings.SECRET_KEY`, expiry from settings
   - `create_refresh_token(data: dict) -> str` — longer expiry
   - `decode_token(token: str) -> dict` — raises `HTTPException 401` on failure

4. Create `backend/app/schemas/user.py`:
   - `UserCreate`: `username`, `email`, `password` (min 8 chars)
   - `UserLogin`: `email`, `password`
   - `UserOut`: `id`, `username`, `email`, `role`, `reputation`, `created_at` — no password
   - `TokenResponse`: `access_token`, `refresh_token`, `token_type`

5. Create `backend/app/services/auth_service.py`:
   - `async def register_user(db, data: UserCreate) -> User` — checks email/username uniqueness, hashes password with `passlib`, inserts user, returns ORM object
   - `async def login_user(db, data: UserLogin) -> TokenResponse` — fetches user by email, verifies password, creates both tokens, stores refresh token hash in `refresh_tokens` table, returns tokens
   - `async def refresh_access_token(db, refresh_token: str) -> TokenResponse` — decodes refresh token, validates against DB hash, issues new access token

6. Create `backend/app/dependencies.py`:
   - `async def get_current_user(token: str = Depends(oauth2_scheme), db = Depends(get_db)) -> User` — decodes JWT, fetches user from DB, raises 401 if invalid or banned
   - `async def require_admin(current_user = Depends(get_current_user)) -> User` — raises 403 if role != 'admin'
   - `async def require_min_reputation(min_pts: int)` — returns a Depends factory that checks user reputation

7. Create `backend/app/routers/auth.py`:
   - `POST /api/auth/register` → calls `auth_service.register_user`, returns `UserOut`
   - `POST /api/auth/login` → calls `auth_service.login_user`, returns `TokenResponse`
   - `POST /api/auth/refresh` → calls `auth_service.refresh_access_token`, returns new `TokenResponse`
   - `POST /api/auth/logout` → deletes refresh token from DB, returns 204

8. Create `backend/app/routers/users.py`:
   - `GET /api/users/me` → returns `UserOut` for current authenticated user
   - `GET /api/users/{username}` → returns public profile (no email)

9. Register both routers in `app/main.py`:
   ```python
   from app.routers import auth, users
   app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
   app.include_router(users.router, prefix="/api/users", tags=["users"])
   ```

10. In frontend, create `src/lib/api.ts`:
    - Axios instance with `baseURL = process.env.NEXT_PUBLIC_API_URL`
    - Request interceptor: attach `Authorization: Bearer <access_token>` from Zustand store
    - Response interceptor: on 401, attempt refresh via `/api/auth/refresh`, retry original request once, on second failure clear auth store and redirect to `/login`

11. Create `src/store/authStore.ts` (Zustand):
    - State: `user: UserOut | null`, `accessToken: string | null`, `refreshToken: string | null`
    - Actions: `setAuth`, `clearAuth`

12. Create `src/hooks/useAuth.ts`:
    - Wraps Zustand store, exposes `login(email, password)`, `register(...)`, `logout()`, `isAuthenticated`

13. Create `src/app/(auth)/login/page.tsx` and `register/page.tsx` — forms calling `useAuth` hooks.

---

### F3 — Semantic Safety Layer

**Goal:** Every user-submitted text (escalation body, answer body) passes through a safety check before any other processing.

#### Steps

1. Create `backend/app/services/safety_service.py`:
   - At module level, load the detoxify model once: `_model = Detoxify('original')` — this runs on startup, not per request
   - Define `class SafetyResult(BaseModel): is_blocked: bool; is_flagged: bool; scores: dict`
   - Define `def check_text(text: str) -> SafetyResult`:
     - Call `_model.predict(text)` — returns dict of toxicity scores
     - `toxicity` score ≥ `settings.SAFETY_BLOCK_THRESHOLD` → `is_blocked = True`
     - `toxicity` score ≥ `settings.SAFETY_FLAG_THRESHOLD` → `is_flagged = True`
     - Return `SafetyResult`

2. Add PII detection to `safety_service.py`:
   - Use regex patterns to detect: email addresses (`[\w.-]+@[\w.-]+\.\w+`), phone numbers (`\+?[\d\s\-().]{10,}`)
   - If PII found: set `is_flagged = True`, add `"pii"` to scores dict

3. The safety check is a **synchronous function** called directly inside the escalation and answer service functions — not a separate HTTP call. Pattern:
   ```python
   from app.services.safety_service import check_text
   result = check_text(body_text)
   if result.is_blocked:
       raise HTTPException(status_code=422, detail="Content flagged as inappropriate")
   ```

4. If `is_flagged` (grey zone, not hard blocked): allow the submission but create a `Flag` record automatically with `reporter_id = None` (system-generated flag) and `reason = "auto_safety"`, status `"pending"`.

---

### F4 — Embedding Service

**Goal:** Convert any text to a 384-dim vector. Used for both storage (new escalations/FAQ entries) and search (incoming queries).

#### Steps

1. Create `backend/app/services/semantic_service.py`:
   - Load model once at module level: `_encoder = SentenceTransformer('all-MiniLM-L6-v2')` 
   - `def embed_text(text: str) -> list[float]` — calls `_encoder.encode(text).tolist()`
   - `def embed_texts(texts: list[str]) -> list[list[float]]` — batch encode

2. Add similarity search functions to `semantic_service.py`:
   - `async def search_faq(db, query_embedding: list[float], threshold: float, limit: int = 5) -> list[faq_entries row]`:
     - Uses pgvector operator: `SELECT *, (embedding <=> :vec) as distance FROM faq_entries WHERE is_published = true ORDER BY distance LIMIT :limit`
     - Filter to rows where `1 - distance >= threshold`
     - Use SQLAlchemy `text()` query with bound params
   - `async def search_escalations(db, query_embedding: list[float], threshold: float, limit: int = 3) -> list[escalations row]`:
     - Same pattern but against `escalations` table where `status = 'open'`

3. Create `backend/app/tasks/embedding_tasks.py`:
   - `@celery_app.task def embed_and_store_escalation(escalation_id: str)`:
     - Opens a sync DB session (Celery workers use sync SQLAlchemy)
     - Fetches escalation by id
     - Calls `embed_text(escalation.title + " " + escalation.body)`
     - Updates `escalation.embedding` column
     - Commits
   - `@celery_app.task def embed_and_store_faq(faq_id: str)`:
     - Same pattern for `faq_entries`

4. Create `backend/app/tasks/celery_app.py`:
   ```python
   from celery import Celery
   from app.config import settings
   celery_app = Celery("escalateiq", broker=settings.CELERY_BROKER_URL, backend=settings.CELERY_RESULT_BACKEND)
   celery_app.autodiscover_tasks(["app.tasks.embedding_tasks", "app.tasks.notification_tasks"])
   ```

5. Note on sync vs async: Celery tasks use **sync** SQLAlchemy sessions. Create a separate sync session factory in `database.py`:
   ```python
   from sqlalchemy import create_engine
   from sqlalchemy.orm import sessionmaker
   sync_engine = create_engine(settings.SYNC_DATABASE_URL)
   SyncSessionLocal = sessionmaker(bind=sync_engine)
   ```

---

### F5 — FAQ Knowledge Base

**Goal:** CRUD for FAQ entries (admin only for create/edit), public read + semantic search.

#### Steps

1. Create `backend/app/models/faq.py`:
   - `FAQEntry` model matching `faq_entries` schema
   - Import `Vector` from `pgvector.sqlalchemy`
   - Column: `embedding = Column(Vector(384), nullable=True)`

2. Create Alembic migration for `faq_entries`. Run `alembic upgrade head`.

3. Create `backend/app/schemas/faq.py`:
   - `FAQEntryOut`: all fields except `embedding` (never expose raw vectors to client)
   - `FAQEntryCreate`: `question`, `answer`, `tags`
   - `FAQEntryUpdate`: all fields optional

4. Create `backend/app/services/faq_service.py`:
   - `async def get_faq_list(db, skip, limit) -> list[FAQEntry]` — paginated
   - `async def get_faq_by_id(db, faq_id) -> FAQEntry`
   - `async def search_faq_text(db, query: str) -> list[FAQEntry]` — full-text search using `to_tsvector` on question+answer
   - `async def create_faq_entry(db, data: FAQEntryCreate, admin_id) -> FAQEntry` — inserts, triggers embedding task
   - `async def update_faq_entry(db, faq_id, data: FAQEntryUpdate, admin_id) -> FAQEntry`
   - `async def delete_faq_entry(db, faq_id)` — soft delete: sets `is_published = False`

5. Create `backend/app/routers/faq.py`:
   - `GET /api/faq` → public, paginated list
   - `GET /api/faq/search?q=...` → public, calls `search_faq_text`
   - `GET /api/faq/{id}` → public, single entry
   - `POST /api/faq` → admin only (`Depends(require_admin)`)
   - `PATCH /api/faq/{id}` → admin only
   - `DELETE /api/faq/{id}` → admin only

6. Register in `main.py`: `app.include_router(faq.router, prefix="/api/faq", tags=["faq"])`

---

### F6 — Escalation Engine

**Goal:** Core flow — safety check → FAQ semantic search → feed semantic search → create or redirect/upvote.

#### Steps

1. Create `backend/app/models/escalation.py`:
   - `Escalation` model with `embedding = Column(Vector(384), nullable=True)`
   - Relationship: `user = relationship("User", back_populates="escalations")`
   - Relationship: `answers = relationship("Answer", back_populates="escalation")`

2. Create `backend/app/models/vote.py`: `Vote` model matching schema.

3. Run Alembic migration for both tables.

4. Create `backend/app/schemas/escalation.py`:
   - `EscalationCreate`: `title` (5–300 chars), `body` (min 20 chars), `tags: list[str]` (optional, max 5)
   - `EscalationOut`: all fields except `embedding`, plus `author_username`, `has_user_voted` (bool, computed per request)
   - `EscalationCheckResponse`: `action: str` (`"faq_match"` | `"feed_match"` | `"created"`), `payload: dict` (FAQ entry or escalation or new escalation)

5. Create `backend/app/services/escalation_service.py`:

   ```
   async def check_and_raise(db, user: User, data: EscalationCreate) -> EscalationCheckResponse:
       Step 1: safety check
           result = check_text(data.title + " " + data.body)
           if result.is_blocked → raise HTTPException 422
   
       Step 2: embed the incoming query
           query_vec = embed_text(data.title + " " + data.body)
   
       Step 3: search FAQ
           faq_matches = await search_faq(db, query_vec, settings.FAQ_SIMILARITY_THRESHOLD)
           if faq_matches:
               top_match = faq_matches[0]
               return EscalationCheckResponse(action="faq_match", payload=FAQEntryOut.from_orm(top_match))
   
       Step 4: search open escalations
           feed_matches = await search_escalations(db, query_vec, settings.FEED_SIMILARITY_THRESHOLD)
           if feed_matches:
               top_match = feed_matches[0]
               await _auto_upvote(db, user, top_match)
               await notification_service.notify_user(db, top_match.user_id, "auto_upvote", {"escalation_id": str(top_match.id)})
               return EscalationCheckResponse(action="feed_match", payload=EscalationOut.from_orm(top_match))
   
       Step 5: create new escalation
           new_esc = Escalation(user_id=user.id, title=data.title, body=data.body, tags=data.tags)
           db.add(new_esc)
           await db.commit()
           await db.refresh(new_esc)
           embed_and_store_escalation.delay(str(new_esc.id))   # async Celery task
           return EscalationCheckResponse(action="created", payload=EscalationOut.from_orm(new_esc))
   ```

   - `async def _auto_upvote(db, user, escalation)`:
     - Check if `Vote` already exists for this user + escalation — if yes, skip silently
     - Insert `Vote(user_id=user.id, target_id=escalation.id, target_type='escalation')`
     - Increment `escalation.upvote_count`
     - Commit

   - `async def upvote_escalation(db, user, escalation_id)`:
     - Manual upvote from feed — same logic as `_auto_upvote` but returns updated count

   - `async def get_escalation(db, escalation_id, current_user) -> EscalationOut`:
     - Fetches escalation, increments `view_count`, computes `has_user_voted`

   - `async def list_escalations(db, current_user, skip, limit, sort_by, tag_filter) -> list[EscalationOut]`:
     - `sort_by`: `"newest"` (default) | `"most_upvoted"` | `"unanswered"`
     - Only returns escalations with `status IN ('open', 'answered')`

6. Create `backend/app/routers/escalations.py`:
   - `POST /api/escalations` → authenticated, calls `check_and_raise`, returns `EscalationCheckResponse`
   - `GET /api/escalations` → public, paginated feed with sort + tag filter
   - `GET /api/escalations/{id}` → public, single escalation with answers
   - `POST /api/escalations/{id}/upvote` → authenticated

7. Register router in `main.py`.

---

### F7 — Public Feed

**Goal:** Real-time feed updates via WebSocket when new escalations are posted or answered.

#### Steps

1. Create `backend/app/routers/websocket.py`:
   - Maintain a global `connected_clients: set[WebSocket] = set()`
   - `WS /ws/feed` endpoint:
     - On connect: add to `connected_clients`
     - On disconnect: remove from `connected_clients`
     - Listen for messages (ping/pong keepalive only)
   - `async def broadcast(event_type: str, payload: dict)`:
     - Serialize `{"event": event_type, "data": payload}` to JSON
     - Send to all connected clients, remove any that raise `WebSocketDisconnect`

2. Call `broadcast` from `escalation_service.py` after new escalation is created:
   ```python
   from app.routers.websocket import broadcast
   await broadcast("new_escalation", EscalationOut.from_orm(new_esc).dict())
   ```

3. Call `broadcast` after an answer is verified (in answer_service.py):
   ```python
   await broadcast("escalation_answered", {"escalation_id": str(escalation.id)})
   ```

4. In frontend, create `src/hooks/useWebSocket.ts`:
   - Connect to `process.env.NEXT_PUBLIC_WS_URL + "/ws/feed"` on mount
   - Parse incoming JSON messages
   - On `new_escalation`: prepend to React Query cache for feed list
   - On `escalation_answered`: invalidate that escalation's query key
   - Auto-reconnect with exponential backoff on disconnect

5. In `src/components/escalation/EscalationFeed.tsx`:
   - Use `useFeed` hook (React Query) for initial data
   - Mount `useWebSocket` hook for live updates
   - Render list of `EscalationCard` components

---

### F8 — Answer Pipeline

**Goal:** Users submit answers, answers are stored as unverified, upvoting within answers, admin can verify.

#### Steps

1. Create `backend/app/models/answer.py`: `Answer` model matching schema. Relationship to `Escalation` and `User`.

2. Run Alembic migration.

3. Create `backend/app/schemas/answer.py`:
   - `AnswerCreate`: `body` (min 30 chars)
   - `AnswerOut`: all fields, plus `author_username`, `has_user_voted`, `is_author` (computed)

4. Create `backend/app/services/answer_service.py`:
   - `async def submit_answer(db, user, escalation_id, data: AnswerCreate) -> Answer`:
     - Safety check on `data.body`
     - Check escalation exists and status is `'open'` or `'answered'`
     - Insert `Answer`
     - Update escalation `status` to `'answered'`
     - Notify escalation author: "Your escalation received an answer"
     - Return answer
   - `async def upvote_answer(db, user, answer_id)`:
     - Same Vote pattern as escalation upvote
   - `async def list_answers(db, escalation_id) -> list[AnswerOut]`:
     - Order: verified first, then by upvote_count desc

5. Create `backend/app/routers/answers.py`:
   - `POST /api/escalations/{escalation_id}/answers` → authenticated
   - `GET /api/escalations/{escalation_id}/answers` → public
   - `POST /api/answers/{id}/upvote` → authenticated

6. Register router in `main.py`.

---

### F9 — Admin Verification Queue

**Goal:** Admins see all unverified answers, can verify, reject (with reason), or request edit.

#### Steps

1. Create `backend/app/services/answer_service.py` additions:
   - `async def verify_answer(db, admin, answer_id) -> Answer`:
     - Fetch answer, set `status = 'verified'`, `verified_by = admin.id`, `verified_at = now()`
     - Call `reputation_service.award_points(db, answer.user_id, +10, "answer_verified", answer.id)`
     - Call `faq_service.promote_to_faq(db, answer)` (defined in F10)
     - Notify answer author: "Your answer was verified and added to FAQ"
     - Broadcast `escalation_answered` WebSocket event
     - Commit
   - `async def reject_answer(db, admin, answer_id, reason: str) -> Answer`:
     - Set `status = 'rejected'`, `rejection_reason = reason`
     - Call `reputation_service.award_points(db, answer.user_id, -5, "answer_rejected", answer.id)`
     - Notify answer author with rejection reason
     - Commit

2. Create `backend/app/routers/admin.py`:
   - All routes require `Depends(require_admin)`
   - `GET /api/admin/queue` → paginated list of answers where `status = 'unverified'`, ordered by `created_at asc`
   - `POST /api/admin/answers/{id}/verify` → calls `verify_answer`
   - `POST /api/admin/answers/{id}/reject` body: `{"reason": "..."}` → calls `reject_answer`
   - `GET /api/admin/flags` → paginated list of flags where `status = 'pending'`
   - `POST /api/admin/flags/{id}/resolve` body: `{"action": "remove_content" | "dismiss"}`
   - `GET /api/admin/stats` → counts of open escalations, unverified answers, pending flags, users

3. Register in `main.py`.

4. In frontend, create `src/app/admin/layout.tsx`:
   - Wraps all `/admin/*` routes
   - Reads `user.role` from Zustand — if not `'admin'`, redirect to `/feed`

5. Create `src/app/admin/queue/page.tsx`:
   - Fetches `/api/admin/queue` with React Query
   - Renders `VerificationCard` per answer — shows full answer body, escalation context, Verify / Reject buttons

---

### F10 — FAQ Auto-Promotion

**Goal:** When an answer is verified, automatically create a FAQ entry from the escalation+answer pair.

#### Steps

1. Create `backend/app/services/faq_service.py` addition:
   - `async def promote_to_faq(db, answer: Answer) -> FAQEntry`:
     - Fetch the parent `Escalation` from `answer.escalation_id`
     - Check if a FAQ entry already exists for this escalation (via `source_escalation = escalation.id`) — if yes, skip
     - Create `FAQEntry`:
       - `question = escalation.title`
       - `answer = answer.body`
       - `source_escalation = escalation.id`
       - `source_answer = answer.id`
       - `tags = escalation.tags`
       - `is_published = True`
     - Insert to DB, commit, refresh
     - Dispatch Celery task: `embed_and_store_faq.delay(str(faq_entry.id))`
     - Update `escalation.status = 'resolved'`
     - Commit
     - Return `faq_entry`

2. This function is called exclusively from `answer_service.verify_answer` — no other code path triggers FAQ promotion. Keep it that way.

3. After the FAQ entry embedding is stored (Celery task completes), the new FAQ entry will participate in all future `search_faq` calls automatically — no additional wiring needed.

4. Note: the escalation is removed from the active feed automatically because `list_escalations` only returns `status IN ('open', 'answered')` — resolved escalations fall off naturally.

---

### F11 — Reputation & Points System

**Goal:** Track all point changes, maintain running total on user, expose leaderboard.

#### Steps

1. Create `backend/app/models/notification.py` and also make sure `reputation_events` table is migrated. Create migration if not yet done.

2. Create `backend/app/services/reputation_service.py`:
   - `async def award_points(db, user_id, delta: int, reason: str, ref_id: UUID = None)`:
     - Insert `ReputationEvent(user_id, delta, reason, ref_id)`
     - Execute: `UPDATE users SET reputation = reputation + :delta WHERE id = :user_id`
     - Commit
   - `async def get_reputation_history(db, user_id, skip, limit) -> list[ReputationEvent]`
   - `async def get_leaderboard(db, period: str = "all_time") -> list[dict]`:
     - `"all_time"` → top 20 users ordered by `reputation` desc
     - `"weekly"` → sum `delta` from `reputation_events` where `created_at > now() - interval '7 days'`, group by `user_id`, top 20

3. Points rules — implement these in the relevant service functions, not in `reputation_service` itself:
   - +10: answer verified (`answer_service.verify_answer`)
   - +2: answer upvoted (`answer_service.upvote_answer`)
   - +1: escalation you raised gets an answer (`answer_service.submit_answer`)
   - +5: escalation promoted to FAQ (`faq_service.promote_to_faq` — award to escalation author)

4. Add `GET /api/users/{username}/reputation` to `users.py` router — returns history + current total.

5. Add `GET /api/leaderboard` to `users.py` router — public endpoint, accepts `?period=weekly|all_time`.

---

### F12 — Penalty System

**Goal:** Deduct points for violations, handle repeat offenders with temp/permanent bans.

#### Steps

1. Add to `reputation_service.py`:
   - `async def penalize(db, user_id, delta: int, reason: str, ref_id)`:
     - Same as `award_points` but delta is always negative — enforce this: `delta = -abs(delta)`
     - After update, check if user has 3+ violations in last 30 days by querying `reputation_events` where `delta < 0` and `created_at > now() - '30 days'`
     - If yes: set `user.ban_expires_at = now() + timedelta(days=7)` and commit

2. Penalty trigger points — implement at the call site:
   - -5: answer rejected → called in `answer_service.reject_answer`
   - -10: answer rejected after 3+ user flags confirmed by admin → called in `flag_service.resolve_flag`
   - -5: escalation removed by admin → called in `admin_service` (part of flag resolution)

3. Update `dependencies.py` → `get_current_user`:
   - After fetching user, check `user.is_banned` and `user.ban_expires_at`
   - If `ban_expires_at` is set and still in future: raise `HTTPException(403, "Account temporarily suspended")`
   - If `ban_expires_at` is past: clear it and continue normally

4. Admin can permanently ban: add `POST /api/admin/users/{id}/ban` route — sets `user.is_banned = True`, clears `ban_expires_at`. Add `POST /api/admin/users/{id}/unban` too.

---

### F13 — Flagging System

**Goal:** Users with 50+ pts can flag content for admin review.

#### Steps

1. Create `backend/app/models/flag.py`: `Flag` model.

2. Run Alembic migration.

3. Create `backend/app/schemas/flag.py`:
   - `FlagCreate`: `target_id: UUID`, `target_type: str`, `reason: str`

4. Create `backend/app/services/flag_service.py`:
   - `async def submit_flag(db, reporter: User, data: FlagCreate) -> Flag`:
     - Gate: `if reporter.reputation < 50: raise HTTPException(403, "Need 50 reputation to flag")`
     - Check no duplicate flag from same user on same target
     - Insert Flag
     - Commit
   - `async def resolve_flag(db, admin, flag_id, action: str)`:
     - `action = "remove_content"`:
       - Fetch target (escalation or answer)
       - Set target `status = 'removed'`
       - Penalize target author: `penalize(db, target.user_id, -10, "content_removed_after_flags", flag_id)`
       - Set flag `status = 'resolved'`, `reviewed_by = admin.id`
     - `action = "dismiss"`:
       - Set flag `status = 'dismissed'`, `reviewed_by = admin.id`
     - Commit

5. Create `backend/app/routers/flags.py`:
   - `POST /api/flags` → authenticated, 50 pt gate (checked in service)
   - Register in `main.py`

---

### F14 — Notification Service

**Goal:** In-app notifications stored in DB, delivered via WebSocket to active users.

#### Steps

1. Create `backend/app/models/notification.py`: `Notification` model.

2. Run Alembic migration.

3. Create `backend/app/services/notification_service.py`:
   - `async def notify_user(db, user_id, notif_type: str, payload: dict)`:
     - Insert `Notification(user_id, type=notif_type, payload=payload)`
     - Commit
     - Try to send via WebSocket if user is in `connected_clients` (check by user_id, not by WebSocket object — maintain a `user_id → WebSocket` dict in websocket.py)
   - `async def get_notifications(db, user_id, skip, limit) -> list[Notification]`
   - `async def mark_read(db, user_id, notification_id)`
   - `async def mark_all_read(db, user_id)`

4. Update `websocket.py`:
   - Change `connected_clients` from `set[WebSocket]` to `dict[str, WebSocket]` keyed by `user_id`
   - WS endpoint requires auth: accept `?token=<access_token>` query param, decode it to get `user_id`
   - On connect: `connected_clients[user_id] = websocket`
   - On disconnect: `del connected_clients[user_id]`

5. Add notification routes to `users.py` router:
   - `GET /api/users/me/notifications` → authenticated
   - `POST /api/users/me/notifications/read-all` → authenticated

6. In frontend, create `src/store/notificationStore.ts` (Zustand):
   - State: `notifications: Notification[]`, `unreadCount: number`
   - WebSocket events of type `notification` update this store

---

### F15 — RAG Answer Generation

**Goal:** When a user's query matches the FAQ, return a grounded, synthesized answer rather than a raw FAQ entry.

#### Steps

1. Create `backend/app/services/rag_service.py`:
   - `async def generate_faq_answer(user_query: str, faq_chunks: list[FAQEntry]) -> str`:
     - Build context string: concatenate up to `settings.RAG_TOP_K` FAQ entries as:
       ```
       Q: {entry.question}
       A: {entry.answer}
       ---
       ```
     - Build system prompt:
       ```
       You are a helpful support assistant. Answer the user's question using ONLY the provided FAQ context.
       If the context does not contain the answer, say "I couldn't find a specific answer in our FAQ."
       Do not make up information. Be concise.
       ```
     - Call LLM based on `settings.LLM_PROVIDER`:
       - `openai`: `openai.chat.completions.create(model="gpt-4o-mini", messages=[system, user])`
       - `gemini`: `google.generativeai.GenerativeModel("gemini-1.5-flash").generate_content(...)`
     - Return the generated text string

2. Update `escalation_service.check_and_raise` — the `faq_match` branch:
   ```python
   if faq_matches:
       generated_answer = await rag_service.generate_faq_answer(
           user_query=data.title + " " + data.body,
           faq_chunks=faq_matches
       )
       return EscalationCheckResponse(
           action="faq_match",
           payload={
               "faq_entries": [FAQEntryOut.from_orm(m) for m in faq_matches],
               "generated_answer": generated_answer
           }
       )
   ```

3. In frontend, `src/components/escalation/RaiseEscalationModal.tsx`:
   - When `POST /api/escalations` returns `action: "faq_match"`:
     - Do not show "escalation posted" toast
     - Instead render `SemanticMatchBanner` component showing the generated answer and source FAQ entries
     - Offer "This didn't answer my question — post anyway" button which calls a separate `POST /api/escalations/force` endpoint
   - When returns `action: "feed_match"`:
     - Show banner: "A similar question is already open — we've registered your vote"
     - Link to the matched escalation
   - When returns `action: "created"`:
     - Show success toast, close modal, prepend to feed

4. Add `POST /api/escalations/force` route in `escalations.py`:
   - Same as regular raise but skips semantic check, goes directly to step 5 (create new escalation)
   - Still runs safety check
   - User must be authenticated

---

### F16 — Frontend: Web App

**Goal:** Complete UI for all features.

#### Steps

1. Create `src/types/index.ts` with TypeScript interfaces for all backend response shapes:
   - `User`, `Escalation`, `Answer`, `FAQEntry`, `Notification`, `Flag`, `ReputationEvent`, `EscalationCheckResponse`

2. Create `src/app/feed/page.tsx`:
   - Server component fetches initial feed data
   - Mounts `EscalationFeed` client component with initial data hydration
   - Floating action button: "Raise Escalation" → opens `RaiseEscalationModal`

3. Create `src/components/escalation/EscalationCard.tsx`:
   - Shows: title, author, upvote count, answer count, status badge, tags, time ago
   - Upvote button — calls `POST /api/escalations/{id}/upvote`, optimistic update via React Query

4. Create `src/app/escalation/[id]/page.tsx`:
   - Fetch escalation + answers
   - If escalation is resolved: show link to FAQ entry
   - Show `AnswerForm` if authenticated and escalation is open/answered
   - List `AnswerCard` components — verified answers shown with a green badge at top

5. Create `src/app/faq/page.tsx`:
   - Search bar calls `GET /api/faq/search?q=...` with 300ms debounce
   - Grid of `FAQCard` components

6. Create `src/app/profile/[username]/page.tsx`:
   - Shows user stats: reputation, answered count, verified count
   - Tabs: Escalations raised | Answers given | Reputation history

7. Create `src/app/admin/queue/page.tsx` (admin-gated):
   - Fetches `/api/admin/queue`
   - `VerificationCard` shows: answer body, parent escalation context, author reputation, Verify / Reject (with reason textarea) buttons

8. Wrap authenticated routes: create `src/components/AuthGuard.tsx` — checks `useAuth().isAuthenticated`, redirects to `/login` if false. Use in layouts for `/profile`, `/admin`.

---

## 8. API Route Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/auth/register | Public | Register new user |
| POST | /api/auth/login | Public | Login, get tokens |
| POST | /api/auth/refresh | Public | Refresh access token |
| POST | /api/auth/logout | User | Invalidate refresh token |
| GET | /api/users/me | User | Get own profile |
| GET | /api/users/{username} | Public | Get public profile |
| GET | /api/users/me/notifications | User | Get notifications |
| POST | /api/users/me/notifications/read-all | User | Mark all read |
| GET | /api/leaderboard | Public | Reputation leaderboard |
| POST | /api/escalations | User | Raise escalation (core flow) |
| POST | /api/escalations/force | User | Force-post after FAQ match |
| GET | /api/escalations | Public | Paginated feed |
| GET | /api/escalations/{id} | Public | Single escalation |
| POST | /api/escalations/{id}/upvote | User | Upvote |
| POST | /api/escalations/{id}/answers | User | Submit answer |
| GET | /api/escalations/{id}/answers | Public | List answers |
| POST | /api/answers/{id}/upvote | User | Upvote answer |
| POST | /api/flags | User (50 pts) | Flag content |
| GET | /api/faq | Public | FAQ list |
| GET | /api/faq/search | Public | Semantic FAQ search |
| GET | /api/faq/{id} | Public | Single FAQ entry |
| POST | /api/faq | Admin | Create FAQ entry |
| PATCH | /api/faq/{id} | Admin | Update FAQ entry |
| DELETE | /api/faq/{id} | Admin | Soft delete FAQ entry |
| GET | /api/admin/queue | Admin | Unverified answers queue |
| POST | /api/admin/answers/{id}/verify | Admin | Verify answer |
| POST | /api/admin/answers/{id}/reject | Admin | Reject answer |
| GET | /api/admin/flags | Admin | Pending flags |
| POST | /api/admin/flags/{id}/resolve | Admin | Resolve flag |
| GET | /api/admin/stats | Admin | Platform stats |
| POST | /api/admin/users/{id}/ban | Admin | Ban user |
| POST | /api/admin/users/{id}/unban | Admin | Unban user |
| WS | /ws/feed | Optional auth | Real-time feed events |

---

## 9. Build Order

Build in this exact sequence. Each phase depends on the previous.

```
Phase 1 — Foundation
  F1  Project bootstrapping + Docker
  F2  Auth + Users

Phase 2 — Intelligence core
  F4  Embedding service (semantic_service + celery tasks)
  F3  Safety layer (safety_service)
  F5  FAQ knowledge base (model + CRUD + embedding)

Phase 3 — Core product loop
  F6  Escalation engine (the full check_and_raise flow)
  F7  Public feed + WebSocket
  F8  Answer pipeline

Phase 4 — Admin + moderation
  F9  Admin verification queue
  F10 FAQ auto-promotion (called from F9)
  F13 Flagging system

Phase 5 — Engagement layer
  F11 Reputation + points
  F12 Penalty system
  F14 Notification service

Phase 6 — Intelligence surface
  F15 RAG answer generation

Phase 7 — Frontend
  F16 Web app (build pages in order: auth → feed → escalation detail → FAQ → admin → profile)
```

---

## 10. Key Business Rules Summary

These rules must be respected everywhere in the codebase. If a rule is violated by a code path, it is a bug.

1. **An escalation is never created if the FAQ matches** (score ≥ 0.85). No exceptions.
2. **An escalation is never created if an open feed escalation matches** (score ≥ 0.75). The existing one gets auto-upvoted instead.
3. **Users can force-post after a FAQ match** via `/api/escalations/force` — this is the explicit override path. It still runs the safety check.
4. **Safety check runs on every user-submitted text** before any other processing — escalation bodies, answer bodies.
5. **Answers are always unverified on creation.** Only admins can verify.
6. **FAQ promotion happens only via admin verification.** No other code path writes to `faq_entries` except admin manual creation.
7. **Embedding is always async** (Celery task). Never block an HTTP request for embedding.
8. **Reputation is append-only** via `reputation_events`. Never directly `SET reputation = X` except via the `award_points` / `penalize` functions which also insert the event row.
9. **Flagging requires 50 pts.** Checked in `flag_service`, not in the router, so it can't be bypassed.
10. **Resolved escalations never appear in the feed.** `list_escalations` always filters `status IN ('open', 'answered')`.
11. **Embedding vectors are never returned to the client.** All `*Out` schemas exclude the `embedding` field.
12. **A user cannot vote on their own content.** Check `if target.user_id == current_user.id: raise HTTPException(400, "Cannot vote on own content")` in upvote functions.
13. **Auto-upvote is idempotent.** If a Vote record already exists for that user+target combination, skip silently — no error, no duplicate.
