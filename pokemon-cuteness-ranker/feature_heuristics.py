"""
feature_heuristics.py — Rule-based cuteness bonus calculator.

For each card this module inspects metadata and artwork to award additive
bonuses capped at MAX_FEATURE_BONUS (3.0).

Bonus rules
-----------
+1.5  is_baby_pokemon   — species is in the canonical baby pokémon list
+1.0  is_first_stage    — Basic/Stage 1 with further evolutions (non-baby)
+0.5  is_fairy_type     — card has Fairy type
+0.3  is_normal_type    — card has Normal type
+0.5  small_size        — PokeAPI: height < 5 dm (0.5 m) OR weight < 100 hg (10 kg)
+0.3  has_pastel_art    — Pillow: avg saturation < 150 AND brightness > 150 (HSV)

PokeAPI and pastel-art results are persisted to disk so repeat runs are fast.
"""

from __future__ import annotations

import io
import json
import logging
import os
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional, Set

import requests
from PIL import Image

from config import (
    BONUS_BABY_POKEMON,
    BONUS_FAIRY_TYPE,
    BONUS_FIRST_STAGE,
    BONUS_NORMAL_TYPE,
    BONUS_PASTEL_ART,
    BONUS_SMALL_SIZE,
    CARDS_RAW_PATH,
    DATA_DIR,
    ENABLE_PASTEL_CHECK,
    MAX_FEATURE_BONUS,
    REQUEST_HEADERS,
    SCRAPER_DELAY_SECONDS,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Baby pokémon — canonical list (National Dex, all generations)
# ---------------------------------------------------------------------------

BABY_POKEMON: Set[str] = {
    "Pichu", "Cleffa", "Igglybuff", "Togepi", "Smoochum", "Elekid", "Magby",
    "Magby", "Tyrogue", "Azurill", "Wynaut", "Budew", "Chingling", "Bonsly",
    "Mime Jr.", "Happiny", "Munchlax", "Riolu", "Mantyke", "Toxel",
    # Normalize alternate spellings that may appear on cards
    "Mime Jr", "Bonsly",
}

# First-stage pokémon that have at least one evolution (not baby, not NFE legendaries)
# We infer this from card `supertype`/`subtypes` fields rather than a hardcoded list.
_BASIC_WITH_EVOLUTIONS_HINT = {"Basic"}  # card subtypes value


# ---------------------------------------------------------------------------
# Persistent disk caches
# ---------------------------------------------------------------------------

_POKEAPI_CACHE_PATH = os.path.join(DATA_DIR, "pokeapi_cache.json")
_PASTEL_CACHE_PATH  = os.path.join(DATA_DIR, "pastel_cache.json")


def _load_disk_cache(path: str) -> Dict:
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _save_disk_cache(path: str, data: Dict) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False)


# In-memory caches (loaded from disk lazily once)
_pokeapi_cache: Optional[Dict[str, Any]] = None
_pastel_cache:  Optional[Dict[str, bool]] = None
_POKEAPI_BASE = "https://pokeapi.co/api/v2/pokemon/"
# Flush every N new cache entries to avoid losing work if interrupted
_CACHE_FLUSH_INTERVAL = 50
_pokeapi_new_entries = 0
_pastel_new_entries  = 0
# Thread-safety lock for cache writes
_cache_lock = threading.Lock()


def _get_pokeapi_cache() -> Dict[str, Any]:
    global _pokeapi_cache
    if _pokeapi_cache is None:
        _pokeapi_cache = _load_disk_cache(_POKEAPI_CACHE_PATH)
    return _pokeapi_cache


def _get_pastel_cache() -> Dict[str, bool]:
    global _pastel_cache
    if _pastel_cache is None:
        _pastel_cache = _load_disk_cache(_PASTEL_CACHE_PATH)
    return _pastel_cache


# ---------------------------------------------------------------------------
# PokeAPI size lookups
# ---------------------------------------------------------------------------

def _fetch_pokeapi(name: str) -> Optional[Dict[str, Any]]:
    """Fetch size data for a pokémon species from PokeAPI (disk-cached, thread-safe)."""
    global _pokeapi_new_entries
    key = name.lower().strip()

    # Fast path: already in cache (no lock needed for reads once warmed)
    cache = _get_pokeapi_cache()
    if key in cache:
        return cache[key]

    # Network fetch (outside lock to allow concurrency)
    result: Optional[Dict[str, Any]] = None
    try:
        resp = requests.get(
            f"{_POKEAPI_BASE}{key}",
            headers=REQUEST_HEADERS,
            timeout=10,
        )
        if resp.status_code == 404:
            result = None
        elif resp.status_code == 429:
            logger.debug("PokeAPI rate-limited for %r, storing None", name)
            result = None
        else:
            resp.raise_for_status()
            data = resp.json()
            result = {"height": data["height"], "weight": data["weight"]}
    except Exception as exc:
        logger.debug("PokeAPI lookup failed for %r: %s", name, exc)
        result = None

    # Thread-safe write + conditional flush
    with _cache_lock:
        if key not in cache:  # avoid duplicate writes from concurrent fetches
            cache[key] = result
            _pokeapi_new_entries += 1
            if _pokeapi_new_entries % _CACHE_FLUSH_INTERVAL == 0:
                _save_disk_cache(_POKEAPI_CACHE_PATH, dict(cache))
                logger.debug("Flushed PokeAPI cache (%d entries)", len(cache))

    return result


def _is_small(pokemon_name: str) -> bool:
    """Return True if the pokémon is height<5dm OR weight<100hg per PokeAPI."""
    data = _fetch_pokeapi(pokemon_name)
    if data is None:
        return False
    return data["height"] < 5 or data["weight"] < 100


# TCG card name suffixes that are NOT part of the PokeAPI species name
_TCG_SUFFIXES = (
    " ex", " EX", " GX", " V", " VMAX", " VSTAR", " VUNION",
    " -GX", " -EX", " -V", " -VMAX",
    " Prime", " LV.X", " SP", " FB", " GL", " C", " M ",
    " ☆", " ★",
)


def _pokeapi_name(card_name: str) -> str:
    """Strip TCG-specific suffixes to get a clean species name for PokeAPI."""
    name = card_name.strip()
    for suffix in _TCG_SUFFIXES:
        if name.endswith(suffix):
            name = name[: -len(suffix)].strip()
    # Replace spaces with hyphens for PokeAPI slug format (e.g. "Mr. Mime" → "mr-mime")
    return name.lower().replace(" ", "-").replace(".", "").replace("'", "")


# ---------------------------------------------------------------------------
# Artwork colour analysis
# ---------------------------------------------------------------------------

def _download_image(url: str) -> Optional[Image.Image]:
    try:
        resp = requests.get(url, headers=REQUEST_HEADERS, timeout=20)
        resp.raise_for_status()
        return Image.open(io.BytesIO(resp.content)).convert("RGB")
    except Exception as exc:
        logger.debug("Image download failed (%s): %s", url, exc)
        return None


def _has_pastel_art(image_url: str) -> bool:
    """Return True if the card artwork has predominantly pastel colours.

    Converts to HSV and checks that the average saturation is below 150
    (desaturated / soft) AND average value (brightness) is above 150 (light).
    Both thresholds are on the 0-255 scale.
    Results are disk-cached by URL.
    """
    global _pastel_new_entries
    cache = _get_pastel_cache()
    if image_url in cache:
        return cache[image_url]

    img = _download_image(image_url)
    if img is None:
        cache[image_url] = False
        return False

    # Resize for speed; we only need colour averages
    img = img.resize((64, 64), Image.LANCZOS)
    hsv = img.convert("HSV")
    pixels = list(hsv.getdata())

    if not pixels:
        cache[image_url] = False
        return False

    avg_sat = sum(p[1] for p in pixels) / len(pixels)
    avg_val = sum(p[2] for p in pixels) / len(pixels)
    result = avg_sat < 150 and avg_val > 150
    cache[image_url] = result

    _pastel_new_entries += 1
    if _pastel_new_entries % _CACHE_FLUSH_INTERVAL == 0:
        _save_disk_cache(_PASTEL_CACHE_PATH, cache)
        logger.debug("Flushed pastel cache (%d entries)", len(cache))

    return result


# ---------------------------------------------------------------------------
# Card-level feature extraction
# ---------------------------------------------------------------------------

def _card_types(card: Dict[str, Any]) -> List[str]:
    """Return a lowercased list of the card's types."""
    types = card.get("types") or card.get("type") or []
    if isinstance(types, str):
        types = [types]
    return [t.lower() for t in types]


def _card_subtypes(card: Dict[str, Any]) -> List[str]:
    subtypes = card.get("subtypes") or []
    if isinstance(subtypes, str):
        subtypes = [subtypes]
    return subtypes


def _pokemon_name(card: Dict[str, Any]) -> str:
    return str(card.get("name") or card.get("pokemon_name") or "").strip()


def _image_url(card: Dict[str, Any]) -> str:
    url = card.get("image_url") or card.get("images", {}).get("large", "")
    return str(url).strip()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def calculate_bonus(card: Dict[str, Any]) -> Dict[str, Any]:
    """Compute the feature bonus for a single card.

    Returns:
        {"bonus": float, "flags": [str]}
    """
    bonus = 0.0
    flags: List[str] = []

    name = _pokemon_name(card)
    types = _card_types(card)
    subtypes = _card_subtypes(card)

    # Baby pokémon
    if name in BABY_POKEMON:
        bonus += BONUS_BABY_POKEMON
        flags.append("is_baby_pokemon")

    # First-stage evolution (Basic card, with evolutions, not a baby)
    elif "Basic" in subtypes and "is_baby_pokemon" not in flags:
        # We award first-stage bonus only if the card has HP (not a trainer/energy)
        if card.get("hp"):
            bonus += BONUS_FIRST_STAGE
            flags.append("is_first_stage")

    # Type bonuses
    if "fairy" in types:
        bonus += BONUS_FAIRY_TYPE
        flags.append("is_fairy_type")

    if "normal" in types:
        bonus += BONUS_NORMAL_TYPE
        flags.append("is_normal_type")

    # Size check via PokeAPI (uses normalised species slug)
    if name:
        api_slug = _pokeapi_name(name)
        if _is_small(api_slug):
            bonus += BONUS_SMALL_SIZE
            flags.append("small_size")

    # Pastel artwork check (opt-in — set ENABLE_PASTEL_CHECK=1)
    if ENABLE_PASTEL_CHECK:
        url = _image_url(card)
        if url and _has_pastel_art(url):
            bonus += BONUS_PASTEL_ART
            flags.append("has_pastel_art")

    # Cap total bonus
    bonus = min(bonus, MAX_FEATURE_BONUS)

    return {"bonus": round(bonus, 4), "flags": flags}


def _prewarm_pokeapi(cards: List[Dict[str, Any]], workers: int = 8) -> None:
    """Concurrently fetch PokeAPI size data for all unique species not yet cached."""
    cache = _get_pokeapi_cache()
    slugs: Set[str] = set()
    for card in cards:
        raw = _pokemon_name(card)
        if raw:
            slugs.add(_pokeapi_name(raw))

    missing = [s for s in slugs if s.lower().strip() not in cache]
    if not missing:
        logger.info("PokeAPI cache already warm (%d species)", len(slugs))
        return

    logger.info("Pre-warming PokeAPI cache: %d / %d species to fetch …", len(missing), len(slugs))

    def _fetch_one(slug: str) -> None:
        try:
            _fetch_pokeapi(slug)
        except Exception as exc:
            logger.debug("prewarm _fetch_one error for %r: %s", slug, exc)

    try:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(_fetch_one, s): s for s in missing}
            done = 0
            for _ in as_completed(futures):
                done += 1
                if done % 100 == 0:
                    logger.info("PokeAPI prewarm: %d / %d done", done, len(missing))
    except Exception as exc:
        logger.warning("PokeAPI prewarm aborted (%s); continuing with partial cache", exc)

    # Final flush after batch
    with _cache_lock:
        _save_disk_cache(_POKEAPI_CACHE_PATH, dict(_get_pokeapi_cache()))
    logger.info("PokeAPI cache warm: %d total species cached", len(_get_pokeapi_cache()))


def run_heuristics(progress_callback=None) -> Dict[str, Any]:
    """Compute bonuses for all cards in CARDS_RAW_PATH.

    Args:
        progress_callback: optional callable(completed, total).

    Returns:
        Dict keyed by card_id: {"bonus": float, "flags": [...]}
    """
    with open(CARDS_RAW_PATH, "r", encoding="utf-8") as fh:
        cards: List[Dict[str, Any]] = json.load(fh)

    total = len(cards)
    results: Dict[str, Any] = {}

    # Pre-warm PokeAPI cache in parallel so the main loop has no network waits
    _prewarm_pokeapi(cards)

    for i, card in enumerate(cards):
        card_id = str(card.get("id") or card.get("card_id") or "")
        if not card_id:
            continue
        results[card_id] = calculate_bonus(card)

        if (i + 1) % 500 == 0:
            logger.info("Heuristics: %d / %d processed", i + 1, total)
        if progress_callback:
            progress_callback(i + 1, total)

    # Final flush of both caches
    _save_disk_cache(_POKEAPI_CACHE_PATH, _get_pokeapi_cache())
    _save_disk_cache(_PASTEL_CACHE_PATH,  _get_pastel_cache())

    logger.info("Feature heuristics complete: %d cards processed.", len(results))
    return results
