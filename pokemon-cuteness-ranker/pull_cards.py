"""
pull_cards.py — Fetch all Pokémon TCG cards from api.pokemontcg.io and save
to data/cards_raw.json.

Each card is stored in the native API format which includes:
  id, name, supertype, subtypes, hp, types, evolvesFrom, evolvesTo,
  rules, attacks, weaknesses, resistances, retreatCost, convertedRetreatCost,
  set, number, artist, rarity, flavorText, nationalPokedexNumbers,
  legalities, images (small + large), tcgplayer, cardmarket

Usage:
  python pull_cards.py               # fetch all cards (Pokemon only)
  python pull_cards.py --all-types   # fetch trainers + energy too
  python pull_cards.py --limit 500   # fetch at most 500 cards (for testing)
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
BASE_URL      = "https://api.pokemontcg.io/v2/cards"
PAGE_SIZE     = 250          # max allowed by the API
DELAY_SECONDS = 0.25         # polite delay between page requests
DATA_DIR      = os.path.join(os.path.dirname(__file__), "data")
OUTPUT_PATH   = os.path.join(DATA_DIR, "cards_raw.json")

HEADERS: Dict[str, str] = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; pokemon-cuteness-ranker/1.0; "
        "+https://github.com/nixguin/pokemon-collectors)"
    ),
}
# Add API key if available (increases rate limit from 30→100 req/min)
_API_KEY = os.environ.get("POKEMONTCG_API_KEY", "")
if _API_KEY:
    HEADERS["X-Api-Key"] = _API_KEY


# ── Fetch helpers ─────────────────────────────────────────────────────────────

def _fetch_page(page: int, query: str = "supertype:pokemon") -> Optional[Dict[str, Any]]:
    """Fetch one page of cards from the API. Returns None on failure."""
    params: Dict[str, Any] = {
        "page":     page,
        "pageSize": PAGE_SIZE,
    }
    if query:
        params["q"] = query

    try:
        resp = requests.get(BASE_URL, headers=HEADERS, params=params, timeout=30)
        resp.raise_for_status()
        return resp.json()
    except requests.HTTPError as exc:
        logger.error("HTTP error on page %d: %s", page, exc)
    except Exception as exc:
        logger.error("Request failed on page %d: %s", page, exc)
    return None


def fetch_all_cards(query: str = "supertype:pokemon", limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """Pages through the API and returns every card matching `query`."""
    all_cards: List[Dict[str, Any]] = []
    page = 1

    # First request tells us total count
    logger.info("Fetching page 1 (query=%r) …", query)
    data = _fetch_page(page, query)
    if data is None:
        logger.error("First page fetch failed — aborting.")
        return []

    total_count: int = data.get("totalCount", 0)
    cards = data.get("data", [])
    all_cards.extend(cards)
    logger.info("Total cards in API: %d  |  page size: %d", total_count, PAGE_SIZE)

    total_pages = (total_count + PAGE_SIZE - 1) // PAGE_SIZE

    for page in range(2, total_pages + 1):
        if limit and len(all_cards) >= limit:
            break

        time.sleep(DELAY_SECONDS)
        logger.info("Fetching page %d / %d  (%d cards so far) …", page, total_pages, len(all_cards))
        data = _fetch_page(page, query)
        if data is None:
            logger.warning("Page %d failed — skipping.", page)
            continue
        all_cards.extend(data.get("data", []))

    if limit:
        all_cards = all_cards[:limit]

    return all_cards


# ── Normalise to a stable schema ──────────────────────────────────────────────

def _normalise(card: Dict[str, Any]) -> Dict[str, Any]:
    """Flatten/rename fields so downstream code has consistent keys."""
    images = card.get("images", {})
    set_info = card.get("set", {})
    return {
        "id":                   card.get("id", ""),
        "name":                 card.get("name", ""),
        "supertype":            card.get("supertype", ""),
        "subtypes":             card.get("subtypes", []),
        "hp":                   card.get("hp"),
        "types":                card.get("types", []),
        "evolvesFrom":          card.get("evolvesFrom"),
        "evolvesTo":            card.get("evolvesTo", []),
        "rarity":               card.get("rarity", ""),
        "artist":               card.get("artist", ""),
        "flavorText":           card.get("flavorText", ""),
        "nationalPokedexNumbers": card.get("nationalPokedexNumbers", []),
        "image_url":            images.get("large") or images.get("small") or "",
        "image_url_small":      images.get("small", ""),
        "set_id":               set_info.get("id", ""),
        "set_name":             set_info.get("name", ""),
        "set_series":           set_info.get("series", ""),
        "number":               card.get("number", ""),
        "legalities":           card.get("legalities", {}),
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def pull(all_types: bool = False, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """Pull cards, normalise them, and save to OUTPUT_PATH."""
    os.makedirs(DATA_DIR, exist_ok=True)

    if all_types:
        # Fetch all card types (pokemon + trainer + energy)
        cards = fetch_all_cards(query="", limit=limit)
    else:
        cards = fetch_all_cards(query="supertype:pokemon", limit=limit)

    normalised = [_normalise(c) for c in cards]

    with open(OUTPUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(normalised, fh, indent=2, ensure_ascii=False)

    logger.info(
        "Saved %d cards → %s",
        len(normalised), OUTPUT_PATH,
    )
    return normalised


def main() -> None:
    logging.basicConfig(
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        level=logging.INFO,
        stream=sys.stdout,
    )

    parser = argparse.ArgumentParser(description="Pull Pokémon TCG card data.")
    parser.add_argument(
        "--all-types",
        action="store_true",
        help="Include trainer and energy cards (default: Pokémon only).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        metavar="N",
        help="Stop after fetching N cards (for quick testing).",
    )
    args = parser.parse_args()

    cards = pull(all_types=args.all_types, limit=args.limit)
    print(f"\nDone — {len(cards)} cards saved to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
