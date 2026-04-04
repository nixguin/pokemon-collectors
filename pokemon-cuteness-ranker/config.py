"""
Central configuration: API keys, file paths, weights, and constants.
All tuneable values live here so the rest of the code stays clean.
"""

import os

# ── Claude API ────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL: str = "claude-sonnet-4-20250514"

# ── Fusion weights (community score IS available) ─────────────────────────────
WEIGHT_COMMUNITY: float = 0.50
WEIGHT_LLM: float = 0.35
WEIGHT_FEATURE: float = 0.15

# ── Fusion weights (community score MISSING) ──────────────────────────────────
WEIGHT_LLM_NO_COMMUNITY: float = 0.70
WEIGHT_FEATURE_NO_COMMUNITY: float = 0.30

# ── Feature bonus values ──────────────────────────────────────────────────────
BONUS_BABY_POKEMON: float = 1.5
BONUS_FIRST_STAGE: float = 1.0
BONUS_FAIRY_TYPE: float = 0.5
BONUS_NORMAL_TYPE: float = 0.3
BONUS_SMALL_SIZE: float = 0.5
BONUS_PASTEL_ART: float = 0.3
MAX_FEATURE_BONUS: float = 3.0

# Set ENABLE_PASTEL_CHECK=1 in the environment to enable the (slow) image-download
# pastel analysis.  Off by default so fusion completes in minutes, not hours.
ENABLE_PASTEL_CHECK: bool = os.environ.get("ENABLE_PASTEL_CHECK", "0") == "1"

# ── Cuteness tier thresholds (lower bound) ────────────────────────────────────
TIER_S_MIN: float = 9.0   # S  9.0 – 10
TIER_A_MIN: float = 7.0   # A  7.0 – 8.99
TIER_B_MIN: float = 5.0   # B  5.0 – 6.99
TIER_C_MIN: float = 3.0   # C  3.0 – 4.99
                           # D  0.0 – 2.99

# ── Rate limiting ─────────────────────────────────────────────────────────────
SCRAPER_DELAY_SECONDS: float = 2.0
LLM_BATCH_SIZE: int = 10
LLM_RETRY_MAX: int = 3
LLM_RETRY_BASE_DELAY: float = 2.0   # seconds; doubles on each retry

# ── File paths ────────────────────────────────────────────────────────────────
DATA_DIR: str = "data"
CARDS_RAW_PATH: str = "data/cards_raw.json"
COMMUNITY_SCORES_PATH: str = "data/community_scores.json"
LLM_SCORES_PATH: str = "data/llm_scores.json"
FINAL_DATASET_PATH: str = "data/final_cuteness_dataset.csv"

# ── Scraper source URLs ───────────────────────────────────────────────────────
RANKER_URLS: list[str] = [
    "https://www.ranker.com/list/cutest-electric-pokemon/ranker-games",
    "https://www.ranker.com/list/cutest-water-type-pokemon/ranker-games",
    "https://www.ranker.com/list/cutest-fairy-type-pokemon/ranker-games",
    "https://www.ranker.com/list/cutest-normal-type-pokemon/ranker-games",
    "https://www.ranker.com/list/cutest-grass-type-pokemon/ranker-games",
    "https://www.ranker.com/list/cutest-fire-type-pokemon/ranker-games",
    "https://www.ranker.com/list/cutest-psychic-type-pokemon/ranker-games",
]
DEXERTO_URL: str = "https://www.dexerto.com/pokemon/cutest-pokemon-1833845/"
BUZZFEED_URL: str = "https://www.buzzfeed.com/gabrielsanchez/cutest-pokemon-ever"
COLLIDER_URL: str = "https://collider.com/cutest-pokemon-ranked/"
FINALBOSS_URL: str = "https://finalboss.io/cutest-pokemon/"

# ── HTTP request headers ──────────────────────────────────────────────────────
REQUEST_HEADERS: dict[str, str] = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# ── LLM vision prompt ─────────────────────────────────────────────────────────
LLM_RATING_PROMPT: str = (
    "Rate this Pokemon card's cuteness from 1-10 based ONLY on the artwork. "
    "Consider: round shapes, big eyes, soft/pastel colors, small size proportions, "
    "playful expressions, baby-like features (large head-to-body ratio). "
    'Respond with ONLY a JSON object: {"score": <number>, "reason": "<1 sentence>"}'
)
