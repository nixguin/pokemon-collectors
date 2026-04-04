"""
api.py — FastAPI server for the Pokemon Cuteness ML model.

Endpoints
---------
GET  /health            → liveness + model-ready status
POST /predict           → score a list of cards
POST /find-cute         → return top-N cute cards from a list
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional

from model import cuteness_model

# ── App Setup ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Pokemon Cuteness AI",
    description="ML-powered cute card search for PokéCollect",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Expo dev server + production
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ── Schemas ───────────────────────────────────────────────────────────────────
class CardInput(BaseModel):
    name:     str
    type:     Optional[str] = ""
    rarity:   Optional[str] = ""
    set:      Optional[str] = ""
    imageUrl: Optional[str] = None
    # pass-through fields so the caller gets them back unchanged
    productId: Optional[str] = None
    groupName: Optional[str] = None

    class Config:
        extra = "allow"   # preserves any extra fields the client sends


class PredictRequest(BaseModel):
    cards: List[CardInput] = Field(..., min_length=1, max_length=10000)


class FindCuteRequest(BaseModel):
    cards:     List[CardInput] = Field(..., min_length=1, max_length=50000)
    min_score: float           = Field(default=0.50, ge=0.0, le=1.0)
    limit:     int             = Field(default=24, ge=1, le=50000)


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status":      "ok",
        "model_ready": cuteness_model.is_ready(),
    }


@app.post("/predict")
def predict(req: PredictRequest):
    if not cuteness_model.is_ready():
        raise HTTPException(
            status_code=503,
            detail="Model not trained yet. Run: python backend/train.py",
        )
    cards_dicts = [c.model_dump() for c in req.cards]
    results     = cuteness_model.predict_batch(cards_dicts)
    return {"results": results}


@app.post("/find-cute")
def find_cute(req: FindCuteRequest):
    if not cuteness_model.is_ready():
        raise HTTPException(
            status_code=503,
            detail="Model not trained yet. Run: python backend/train.py",
        )
    cards_dicts = [c.model_dump() for c in req.cards]
    results     = cuteness_model.find_cute(
        cards_dicts,
        min_score=req.min_score,
        limit=req.limit,
    )
    return {
        "cute_cards": results,
        "total":      len(results),
    }


# ── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8001, reload=True)
