"""
seed_cute_scores.py
-------------------
Scores every Rare+ card in the Supabase `cards` table using the local ML model
and upserts the results to a `cute_scores` table.

Run once (or whenever cards are updated):
    cd backend
    python seed_cute_scores.py

Requires a service-role key (bypasses RLS for bulk inserts):
    Set SUPABASE_SERVICE_KEY in .env.local at the project root.
"""

import os
import sys
import json
import time
import math
from pathlib import Path

# ── resolve project root & load .env.local ────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
env_path = ROOT / ".env.local"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

SUPABASE_URL = os.environ.get("EXPO_PUBLIC_SUPABASE_URL", "")
# Service key bypasses RLS — preferred for bulk writes.
# Falls back to the anon/publishable key so the script still works if you've
# set the cute_scores table to allow public inserts.
SUPABASE_SERVICE_KEY = (
    os.environ.get("SUPABASE_SERVICE_KEY")
    or os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY", "")
)

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    sys.exit("ERROR: SUPABASE_URL / SUPABASE_SERVICE_KEY not set.")

try:
    from supabase import create_client
except ImportError:
    sys.exit("ERROR: Run  pip install supabase  first.")

from model import cuteness_model, _CUTE_RARITY_WORDS

# ── helpers ───────────────────────────────────────────────────────────────────
RARITY_HIERARCHY = {
    "common": 1, "uncommon": 2,
    "rare": 3, "rare holo": 4, "ultra rare": 5,
    "secret rare": 6, "hyper rare": 7, "rainbow rare": 8, "gold rare": 9,
    "special illustration rare": 10, "illustration rare": 11,
    "vmax": 12, "vstar": 13, "amazing rare": 14, "shining": 15,
    "crystal": 16, "gold star": 17, "prime": 18, "legend": 19,
    "break": 20, "gx": 21, "tag team": 22, "v": 23, "radiant": 24,
    "classic collection": 25,
}


def rarity_value(rarity: str) -> int:
    return RARITY_HIERARCHY.get(rarity.lower().strip(), 0)


def is_rare_plus(card_data: dict) -> bool:
    ext = card_data.get("extendedData") or []
    rarity = next((d["value"] for d in ext if d.get("name") == "Rarity"), "")
    val = rarity_value(rarity)
    if val >= 3:
        return True
    r = rarity.lower()
    return any(w in r for w in ("full", "art", "illustration", "rare", "holo", "special", "promo"))


def card_to_input(card_data: dict) -> dict:
    ext = card_data.get("extendedData") or []
    def ext_val(name):
        return next((d["value"] for d in ext if d.get("name") == name), "")
    return {
        "name":      card_data.get("name") or card_data.get("cleanName") or "",
        "type":      ext_val("CardType"),
        "rarity":    ext_val("Rarity"),
        "set":       ext_val("SetName") or card_data.get("groupName", ""),
        "imageUrl":  card_data.get("imageUrl"),
        "productId": str(card_data.get("productId", "")),
        "groupName": card_data.get("groupName", ""),
    }


# ── fetch all cards from Supabase ─────────────────────────────────────────────
def fetch_all_cards(client):
    print("Fetching cards from Supabase…")
    rows = []
    batch = 1000
    offset = 0
    while True:
        res = (
            client.table("cards")
            .select("card_data, card_type")
            .range(offset, offset + batch - 1)
            .execute()
        )
        data = res.data or []
        rows.extend(data)
        print(f"  fetched {len(rows)} rows…", end="\r")
        if len(data) < batch:
            break
        offset += batch
    print(f"\nTotal rows fetched: {len(rows)}")
    return [r["card_data"] for r in rows if r.get("card_data")]


# ── score + upsert ────────────────────────────────────────────────────────────
UPSERT_BATCH = 500
MIN_SCORE = 0.45


def seed(client, cards):
    print(f"Filtering to Rare+ cards…")
    pool = [c for c in cards if is_rare_plus(c)]
    print(f"  {len(pool)} Rare+ cards out of {len(cards)} total")

    print("Scoring with ML model…")
    inputs = [card_to_input(c) for c in pool]
    scored = cuteness_model.find_cute(inputs, min_score=MIN_SCORE, limit=len(inputs))
    print(f"  {len(scored)} cards scored >= {MIN_SCORE}")

    # Build upsert rows: { product_id, cute_score }
    rows = [
        {"product_id": str(c["productId"]), "cute_score": c["cute_score"]}
        for c in scored
        if c.get("productId")
    ]
    print(f"Upserting {len(rows)} rows to cute_scores…")

    total_batches = math.ceil(len(rows) / UPSERT_BATCH)
    for i in range(0, len(rows), UPSERT_BATCH):
        batch = rows[i : i + UPSERT_BATCH]
        client.table("cute_scores").upsert(batch, on_conflict="product_id").execute()
        done = min(i + UPSERT_BATCH, len(rows))
        print(f"  {done}/{len(rows)} ({(i // UPSERT_BATCH) + 1}/{total_batches} batches)")
        time.sleep(0.1)  # be gentle with the API

    print(f"\nDone! {len(rows)} cute scores stored in Supabase.")


# ── main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    cards = fetch_all_cards(client)
    if not cards:
        print("No cards found in Supabase. Seed the cards table first.")
        sys.exit(1)
    seed(client, cards)
