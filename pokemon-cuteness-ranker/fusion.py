"""
fusion.py — Weighted score fusion and final dataset export.

Loads four data sources:
  - cards_raw.json          (card metadata, one dict per card)
  - community_scores.json   (species-level scraped scores)
  - llm_scores.json         (per-card LLM vision scores)
  - feature bonuses         (computed on the fly via feature_heuristics)

Computes a weighted final cuteness score per card, assigns tier labels,
normalises to 0-10, and exports a sorted CSV to FINAL_DATASET_PATH.

Fusion formula
--------------
  With community score:    0.50*community + 0.35*llm + 0.15*feature_bonus
  Without community score: 0.70*llm       + 0.30*feature_bonus
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

import pandas as pd

from config import (
    CARDS_RAW_PATH,
    COMMUNITY_SCORES_PATH,
    FINAL_DATASET_PATH,
    LLM_SCORES_PATH,
    TIER_A_MIN,
    TIER_B_MIN,
    TIER_C_MIN,
    TIER_S_MIN,
    WEIGHT_COMMUNITY,
    WEIGHT_FEATURE,
    WEIGHT_FEATURE_NO_COMMUNITY,
    WEIGHT_LLM,
    WEIGHT_LLM_NO_COMMUNITY,
)
from feature_heuristics import run_heuristics

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data loaders
# ---------------------------------------------------------------------------

def _load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _load_community() -> Dict[str, dict]:
    try:
        return _load_json(COMMUNITY_SCORES_PATH)
    except FileNotFoundError:
        logger.warning(
            "%s not found – community scores will be absent for all cards.",
            COMMUNITY_SCORES_PATH,
        )
        return {}


def _load_llm_scores() -> Dict[str, dict]:
    try:
        return _load_json(LLM_SCORES_PATH)
    except FileNotFoundError:
        logger.warning(
            "%s not found – LLM scores will be absent.",
            LLM_SCORES_PATH,
        )
        return {}


# ---------------------------------------------------------------------------
# Community score mapping
# ---------------------------------------------------------------------------

def _match_community(
    card_name: str,
    community: Dict[str, dict],
) -> Optional[float]:
    """Try exact then case-insensitive then prefix match on species name."""
    if not card_name:
        return None

    # Strip common card-name suffixes (e.g. "Pikachu V", "Eevee GX")
    base = card_name.split(" ")[0].title()

    # 1. Exact match
    if card_name in community:
        return community[card_name]["avg_score"]
    # 2. Title-cased base name
    if base in community:
        return community[base]["avg_score"]
    # 3. Case-insensitive scan
    lower_map = {k.lower(): v for k, v in community.items()}
    if card_name.lower() in lower_map:
        return lower_map[card_name.lower()]["avg_score"]
    if base.lower() in lower_map:
        return lower_map[base.lower()]["avg_score"]

    return None


# ---------------------------------------------------------------------------
# Score computation
# ---------------------------------------------------------------------------

def _compute_raw_score(
    community_score: Optional[float],
    llm_score: float,
    feature_bonus: float,
) -> float:
    """Return the weighted composite score on the LLM/feature 0-10 scale."""
    # Normalise feature bonus (max 3.0) to a 0-10 contribution
    feature_normalised = (feature_bonus / 3.0) * 10.0

    if community_score is not None:
        return (
            WEIGHT_COMMUNITY * community_score
            + WEIGHT_LLM * llm_score
            + WEIGHT_FEATURE * feature_normalised
        )
    return WEIGHT_LLM_NO_COMMUNITY * llm_score + WEIGHT_FEATURE_NO_COMMUNITY * feature_normalised


def _assign_tier(score: float) -> str:
    if score >= TIER_S_MIN:
        return "S"
    if score >= TIER_A_MIN:
        return "A"
    if score >= TIER_B_MIN:
        return "B"
    if score >= TIER_C_MIN:
        return "C"
    return "D"


def _minmax_normalise(series: pd.Series) -> pd.Series:
    """Min-max normalise a series to [0, 10]. Returns original if all same."""
    lo, hi = series.min(), series.max()
    if hi == lo:
        return series.clip(0, 10)
    return ((series - lo) / (hi - lo)) * 10.0


# ---------------------------------------------------------------------------
# Card field extraction helpers
# ---------------------------------------------------------------------------

def _get(card: Dict[str, Any], *keys: str, default: Any = None) -> Any:
    for k in keys:
        if k in card and card[k] is not None:
            return card[k]
    return default


def _types_str(card: Dict[str, Any]) -> str:
    types = _get(card, "types", "type", default=[])
    if isinstance(types, list):
        return ", ".join(types)
    return str(types)


def _image_url(card: Dict[str, Any]) -> str:
    url = _get(card, "image_url", default="")
    if not url:
        url = card.get("images", {}).get("large", "")
    return str(url)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_fusion() -> pd.DataFrame:
    """Build the final cuteness dataset and export it to CSV.

    Returns:
        DataFrame sorted descending by final_cuteness.
    """
    logger.info("Loading source data…")
    cards: List[Dict[str, Any]] = _load_json(CARDS_RAW_PATH)
    community = _load_community()
    llm_scores = _load_llm_scores()

    logger.info("Computing feature bonuses for %d cards…", len(cards))
    feature_bonuses = run_heuristics()

    logger.info("Fusing scores…")
    rows = []
    for card in cards:
        card_id = str(_get(card, "id", "card_id", default=""))
        if not card_id:
            continue

        pokemon_name = str(_get(card, "name", "pokemon_name", default=""))
        pokedex_number = _get(card, "nationalPokedexNumbers", "pokedex_number", default=None)
        if isinstance(pokedex_number, list):
            pokedex_number = pokedex_number[0] if pokedex_number else None

        community_score = _match_community(pokemon_name, community)

        llm_data = llm_scores.get(card_id, {})
        llm_score = float(llm_data.get("score", 5.0))
        llm_reason = str(llm_data.get("reason", ""))

        feat_data = feature_bonuses.get(card_id, {})
        feature_bonus = float(feat_data.get("bonus", 0.0))

        raw_score = _compute_raw_score(community_score, llm_score, feature_bonus)

        rows.append(
            {
                "card_id": card_id,
                "pokemon_name": pokemon_name,
                "pokedex_number": pokedex_number,
                "types": _types_str(card),
                "rarity": _get(card, "rarity", default=""),
                "artist": _get(card, "artist", default=""),
                "image_url": _image_url(card),
                "community_score": round(community_score, 4) if community_score is not None else None,
                "llm_score": round(llm_score, 4),
                "feature_bonus": round(feature_bonus, 4),
                "_raw_score": raw_score,
                "llm_reason": llm_reason,
            }
        )

    df = pd.DataFrame(rows)

    if df.empty:
        logger.error("No rows produced — check that cards_raw.json is valid.")
        return df

    # Normalise final_cuteness to 0-10
    df["final_cuteness"] = _minmax_normalise(df["_raw_score"]).round(4)
    df.drop(columns=["_raw_score"], inplace=True)

    df["cuteness_tier"] = df["final_cuteness"].apply(_assign_tier)

    # Sort descending by final score
    df.sort_values("final_cuteness", ascending=False, inplace=True)
    df.reset_index(drop=True, inplace=True)

    # Reorder columns for readability
    col_order = [
        "card_id", "pokemon_name", "pokedex_number", "types", "rarity",
        "artist", "image_url", "community_score", "llm_score",
        "feature_bonus", "final_cuteness", "cuteness_tier", "llm_reason",
    ]
    df = df[[c for c in col_order if c in df.columns]]

    df.to_csv(FINAL_DATASET_PATH, index=False, encoding="utf-8")
    logger.info(
        "Final dataset saved: %d cards → %s", len(df), FINAL_DATASET_PATH
    )

    # Log tier distribution
    tier_counts = df["cuteness_tier"].value_counts().to_dict()
    logger.info("Tier distribution: %s", tier_counts)

    return df
