"""
llm_rater.py — Async Claude vision rater for pokémon TCG cards.

For each card in cards_raw.json this module:
  1. Downloads the card's image.
  2. Encodes it to base64.
  3. Sends it to Claude with a cuteness-rating prompt.
  4. Parses the JSON response (score + reason).
  5. Caches results progressively to llm_scores.json so runs are resumable.

Concurrency is controlled via asyncio.Semaphore(LLM_BATCH_SIZE).
Failed cards receive a fallback score of 5.0 after LLM_RETRY_MAX retries.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
from typing import Any, Dict, Optional

import aiohttp
import anthropic

from config import (
    ANTHROPIC_API_KEY,
    CARDS_RAW_PATH,
    CLAUDE_MODEL,
    LLM_BATCH_SIZE,
    LLM_RATING_PROMPT,
    LLM_RETRY_BASE_DELAY,
    LLM_RETRY_MAX,
    LLM_SCORES_PATH,
)

logger = logging.getLogger(__name__)

FALLBACK_SCORE = 5.0
FALLBACK_REASON = "Score unavailable – used fallback."


# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------

async def _download_image_b64(
    session: aiohttp.ClientSession, url: str
) -> Optional[str]:
    """Download an image and return its base64 encoding, or None on failure."""
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
            resp.raise_for_status()
            data = await resp.read()
            return base64.standard_b64encode(data).decode("ascii")
    except Exception as exc:
        logger.warning("Image download failed (%s): %s", url, exc)
        return None


def _detect_media_type(url: str) -> str:
    """Infer image MIME type from URL extension."""
    low = url.lower()
    if low.endswith(".png"):
        return "image/png"
    if low.endswith(".webp"):
        return "image/webp"
    if low.endswith(".gif"):
        return "image/gif"
    return "image/jpeg"


# ---------------------------------------------------------------------------
# LLM call with retry
# ---------------------------------------------------------------------------

def _build_message(image_b64: str, media_type: str) -> list[dict]:
    """Construct the messages payload for Claude vision."""
    return [
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": image_b64,
                    },
                },
                {"type": "text", "text": LLM_RATING_PROMPT},
            ],
        }
    ]


def _parse_llm_response(text: str) -> Dict[str, Any]:
    """Extract JSON from the raw LLM response text.

    Looks for the first {...} block; falls back to default on parse error.
    """
    start = text.find("{")
    end = text.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"No JSON object found in: {text!r}")
    return json.loads(text[start:end])


async def _rate_card_with_retry(
    client: anthropic.AsyncAnthropic,
    image_b64: str,
    media_type: str,
    card_id: str,
) -> Dict[str, Any]:
    """Call Claude up to LLM_RETRY_MAX times with exponential back-off."""
    last_exc: Exception = RuntimeError("Unreachable")

    for attempt in range(LLM_RETRY_MAX):
        try:
            message = await client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=256,
                messages=_build_message(image_b64, media_type),
            )
            raw = message.content[0].text
            parsed = _parse_llm_response(raw)
            score = float(parsed.get("score", FALLBACK_SCORE))
            score = max(0.0, min(10.0, score))
            reason = str(parsed.get("reason", "")).strip() or FALLBACK_REASON
            return {"score": score, "reason": reason}
        except anthropic.RateLimitError as exc:
            last_exc = exc
            delay = LLM_RETRY_BASE_DELAY * (2 ** attempt)
            logger.warning(
                "Rate limit on card %s (attempt %d/%d), sleeping %.1fs",
                card_id, attempt + 1, LLM_RETRY_MAX, delay,
            )
            await asyncio.sleep(delay)
        except Exception as exc:
            last_exc = exc
            delay = LLM_RETRY_BASE_DELAY * (2 ** attempt)
            logger.warning(
                "Error rating card %s (attempt %d/%d): %s – retrying in %.1fs",
                card_id, attempt + 1, LLM_RETRY_MAX, exc, delay,
            )
            await asyncio.sleep(delay)

    logger.error(
        "Card %s failed after %d attempts (%s). Using fallback score.",
        card_id, LLM_RETRY_MAX, last_exc,
    )
    return {"score": FALLBACK_SCORE, "reason": FALLBACK_REASON}


# ---------------------------------------------------------------------------
# Per-card async worker
# ---------------------------------------------------------------------------

async def _process_card(
    sem: asyncio.Semaphore,
    http_session: aiohttp.ClientSession,
    llm_client: anthropic.AsyncAnthropic,
    card: Dict[str, Any],
    results: Dict[str, Any],
) -> None:
    """Download image, call LLM, store result – all under the semaphore."""
    card_id = str(card.get("id", card.get("card_id", "")))
    image_url = card.get("image_url") or card.get("images", {}).get("large", "")

    if not card_id:
        logger.warning("Skipping card with missing id: %s", card)
        return

    async with sem:
        if not image_url:
            results[card_id] = {"score": FALLBACK_SCORE, "reason": "No image URL."}
            return

        image_b64 = await _download_image_b64(http_session, image_url)
        if image_b64 is None:
            results[card_id] = {
                "score": FALLBACK_SCORE,
                "reason": "Image download failed.",
            }
            return

        media_type = _detect_media_type(image_url)
        result = await _rate_card_with_retry(llm_client, image_b64, media_type, card_id)
        results[card_id] = result
        logger.debug("Rated card %s → %.1f", card_id, result["score"])


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------

def _load_existing_scores() -> Dict[str, Any]:
    """Load previously cached scores (empty dict if file missing/corrupt)."""
    try:
        with open(LLM_SCORES_PATH, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError as exc:
        logger.warning("Could not parse %s: %s – starting fresh.", LLM_SCORES_PATH, exc)
        return {}


def _save_scores(scores: Dict[str, Any]) -> None:
    """Persist the current scores dict to disk."""
    with open(LLM_SCORES_PATH, "w", encoding="utf-8") as fh:
        json.dump(scores, fh, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def run_rater_async(progress_callback=None) -> Dict[str, Any]:
    """Rate all unrated cards and return the full scores dict.

    Args:
        progress_callback: optional callable(completed_count, total_count).
    """
    with open(CARDS_RAW_PATH, "r", encoding="utf-8") as fh:
        cards: list[Dict[str, Any]] = json.load(fh)

    existing = _load_existing_scores()
    already_rated = set(existing.keys())

    pending = [
        c for c in cards
        if str(c.get("id", c.get("card_id", ""))) not in already_rated
    ]

    logger.info(
        "Cards total: %d | already rated: %d | pending: %d",
        len(cards), len(already_rated), len(pending),
    )

    if not pending:
        logger.info("All cards already rated — nothing to do.")
        return existing

    if not ANTHROPIC_API_KEY:
        raise RuntimeError(
            "ANTHROPIC_API_KEY environment variable is not set."
        )

    results: Dict[str, Any] = {}
    sem = asyncio.Semaphore(LLM_BATCH_SIZE)
    llm_client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

    async with aiohttp.ClientSession() as http_session:
        # Process in batches so we can flush to disk between batches
        batch_size = LLM_BATCH_SIZE * 2  # flush every 2× concurrency slots
        for batch_start in range(0, len(pending), batch_size):
            batch = pending[batch_start : batch_start + batch_size]
            tasks = [
                _process_card(sem, http_session, llm_client, card, results)
                for card in batch
            ]
            await asyncio.gather(*tasks)

            # Flush after each batch
            existing.update(results)
            _save_scores(existing)
            completed = len(existing) - len(already_rated)
            logger.info(
                "Progress: %d / %d rated (%.1f%%)",
                completed, len(pending), 100 * completed / max(len(pending), 1),
            )
            if progress_callback:
                progress_callback(completed, len(pending))

    return existing


def run_rater() -> Dict[str, Any]:
    """Synchronous entry point (wraps the async implementation)."""
    return asyncio.run(run_rater_async())
