# EscalateIQ

A crowdsourced, semantically-aware FAQ generation platform built with MERN stack.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Next.js 14 Frontend  (localhost:3000)                  │
│  React Query + Zustand + WebSocket                      │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP + WebSocket
┌────────────────────────▼────────────────────────────────┐
│  Express.js API  (localhost:5000)                       │
│  JWT Auth │ Bull Queue │ WebSocket Server               │
└──────┬─────────┬──────────────┬──────────────┬──────────┘
       │         │              │              │
  MongoDB     Redis        Python Embedding   Gemini API
  (27017)    (6379)        Sidecar (8001)
```

## Quick Start

### Option 1: Docker Compose (recommended)

```bash
cd escalateiq/

# Copy env files
cp backend/.env.example backend/.env
# Edit backend/.env and add your GEMINI_API_KEY

docker-compose up --build
```

Services:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- MongoDB: mongodb://localhost:27017
- Embedding service: http://localhost:8001

### Option 2: Manual (local dev)

**Prerequisites:** MongoDB, Redis running locally.

```bash
# 1. Start Python embedding service
cd escalateiq/embedding_service
pip install -r requirements.txt
python main.py

# 2. Start backend
cd escalateiq/backend
cp .env.example .env
# Edit .env
npm install
npm run dev

# 3. Start frontend
cd escalateiq/frontend
npm install
npm run dev
```

## Environment Variables

See `backend/.env.example` for all required variables. Key ones:

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection string |
| `GEMINI_API_KEY` | Google Gemini API key for RAG |
| `SECRET_KEY` | JWT signing secret (min 32 chars) |
| `EMBEDDING_SERVICE_URL` | Python sidecar URL |

## Core Flow (check_and_raise)

When a user submits an escalation:

1. **Safety check** — block if toxic
2. **Embed** the query (Python sidecar → all-MiniLM-L6-v2)
3. **FAQ search** (cosine similarity ≥ 0.85) → return Gemini RAG answer
4. **Feed search** (cosine similarity ≥ 0.75) → auto-upvote existing escalation
5. **Create new escalation** if no match found

## API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/auth/register | Public | Register |
| POST | /api/auth/login | Public | Login |
| POST | /api/auth/refresh | Public | Refresh token |
| GET | /api/escalations | Public | Feed |
| POST | /api/escalations | User | Raise (check_and_raise) |
| POST | /api/escalations/force | User | Force-post |
| GET | /api/faq | Public | FAQ list |
| GET | /api/faq/search?q= | Public | Text search |
| POST | /api/admin/answers/:id/verify | Admin | Verify answer |
| GET | /api/admin/queue | Admin | Unverified answers |
| WS | /ws/feed | Optional | Live feed events |

## Making a User Admin

Connect to MongoDB and run:
```js
db.users.updateOne({ username: "yourusername" }, { $set: { role: "admin" } })
```

## Project Structure

```
escalateiq/
├── backend/          # Express.js + MongoDB API
│   ├── src/
│   │   ├── models/   # Mongoose models
│   │   ├── routes/   # Express routers
│   │   ├── services/ # Business logic
│   │   ├── jobs/     # Bull queue workers
│   │   ├── middleware/
│   │   └── websocket/
│   └── server.js
├── frontend/         # Next.js 14 App Router
│   └── src/
│       ├── app/      # Pages (feed, faq, admin, auth)
│       ├── components/
│       ├── hooks/
│       ├── store/    # Zustand stores
│       └── types/
└── embedding_service/ # Python FastAPI sidecar
    └── main.py        # all-MiniLM-L6-v2 embedding server
```
