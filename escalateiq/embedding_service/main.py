"""
EscalateIQ — Python Embedding Microservice
Exposes a FastAPI HTTP server that:
  - Loads all-MiniLM-L6-v2 once at startup
  - POST /embed         → single text → 384-dim vector
  - POST /embed-batch   → list of texts → list of 384-dim vectors
  - POST /similarity    → (vec_a, vec_b) → cosine similarity score
  - GET  /health        → liveness probe
"""

from __future__ import annotations
import os
import numpy as np
from typing import List
from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

# ── Load model once at startup ──────────────────────────────────────
MODEL_NAME = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
print(f"[embedding_service] Loading model: {MODEL_NAME}")
_model = SentenceTransformer(MODEL_NAME)
print(f"[embedding_service] Model loaded — embedding dim: {_model.get_sentence_embedding_dimension()}")

app = FastAPI(title="EscalateIQ Embedding Service")


# ── Request / Response schemas ──────────────────────────────────────

class EmbedRequest(BaseModel):
    text: str

class EmbedResponse(BaseModel):
    embedding: List[float]
    dim: int

class EmbedBatchRequest(BaseModel):
    texts: List[str]

class EmbedBatchResponse(BaseModel):
    embeddings: List[List[float]]
    dim: int

class SimilarityRequest(BaseModel):
    vec_a: List[float]
    vec_b: List[float]

class SimilarityResponse(BaseModel):
    score: float


# ── Helpers ─────────────────────────────────────────────────────────

def cosine_similarity(a: List[float], b: List[float]) -> float:
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)


# ── Routes ──────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest):
    vec = _model.encode(req.text, normalize_embeddings=True).tolist()
    return EmbedResponse(embedding=vec, dim=len(vec))


@app.post("/embed-batch", response_model=EmbedBatchResponse)
def embed_batch(req: EmbedBatchRequest):
    vecs = _model.encode(req.texts, normalize_embeddings=True).tolist()
    return EmbedBatchResponse(embeddings=vecs, dim=len(vecs[0]) if vecs else 0)


@app.post("/similarity", response_model=SimilarityResponse)
def similarity(req: SimilarityRequest):
    score = cosine_similarity(req.vec_a, req.vec_b)
    return SimilarityResponse(score=score)


# ── Entry point ─────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
