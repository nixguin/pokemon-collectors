"""
main.py — CLI orchestrator for the pokémon cuteness ranker.

Usage
-----
  python main.py scrape          # scrape community rankings only
  python main.py rate            # LLM-rate all card images only
  python main.py fuse            # run score fusion only
  python main.py all             # run full pipeline (scrape → rate → fuse)
  python main.py top [--n 50]    # print top N cutest cards from final CSV
"""

from __future__ import annotations

import argparse
import logging
import sys
from typing import Optional

import pandas as pd
from tqdm import tqdm

from config import FINAL_DATASET_PATH

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    level=logging.INFO,
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Subcommand implementations
# ---------------------------------------------------------------------------

def cmd_pull(args: argparse.Namespace) -> None:
    """Pull all Pokémon TCG cards from the API and save cards_raw.json."""
    from pull_cards import pull

    limit: Optional[int] = getattr(args, "limit", None)
    all_types: bool = getattr(args, "all_types", False)

    logger.info("=== PULL: fetching card data from Pokémon TCG API ===")
    try:
        cards = pull(all_types=all_types, limit=limit)
        logger.info("Done. %d cards saved to cards_raw.json.", len(cards))
    except Exception as exc:
        logger.error("Card pull failed: %s", exc, exc_info=True)
        sys.exit(1)


def cmd_scrape(_args: argparse.Namespace) -> None:
    """Run the community scrapers and save community_scores.json."""
    from scraper import run_scraper

    logger.info("=== SCRAPE: fetching community rankings ===")
    try:
        scores = run_scraper()
        logger.info("Done. %d unique pokémon species scraped.", len(scores))
    except Exception as exc:
        logger.error("Scraping failed: %s", exc, exc_info=True)
        sys.exit(1)


def cmd_rate(_args: argparse.Namespace) -> None:
    """Run the LLM vision rater and save llm_scores.json."""
    from llm_rater import run_rater_async
    import asyncio

    logger.info("=== RATE: LLM vision rating ===")

    with tqdm(desc="LLM rating", unit="cards", dynamic_ncols=True) as bar:
        bar_state = {"last": 0}

        def progress(completed: int, total: int) -> None:
            delta = completed - bar_state["last"]
            bar.total = total
            bar.update(delta)
            bar_state["last"] = completed

        try:
            asyncio.run(run_rater_async(progress_callback=progress))
            logger.info("Done. LLM scores saved.")
        except Exception as exc:
            logger.error("LLM rating failed: %s", exc, exc_info=True)
            sys.exit(1)


def cmd_fuse(_args: argparse.Namespace) -> None:
    """Run score fusion and export the final CSV."""
    from fusion import run_fusion

    logger.info("=== FUSE: merging scores and exporting dataset ===")

    try:
        df = run_fusion()
        if df.empty:
            logger.error("Fusion produced an empty dataframe.")
            sys.exit(1)
        logger.info("Done. %d cards in final dataset.", len(df))
    except Exception as exc:
        logger.error("Fusion failed: %s", exc, exc_info=True)
        sys.exit(1)


def cmd_all(args: argparse.Namespace) -> None:
    """Run the full pipeline: pull → scrape → rate → fuse."""
    logger.info("=== ALL: running full pipeline ===")
    import os
    from config import CARDS_RAW_PATH
    if not os.path.exists(CARDS_RAW_PATH):
        cmd_pull(args)
    cmd_scrape(args)
    cmd_rate(args)
    cmd_fuse(args)
    logger.info("=== ALL: pipeline complete ===")


def cmd_top(args: argparse.Namespace) -> None:
    """Print the top N cutest cards from the final dataset CSV."""
    n: int = args.n

    logger.info("=== TOP %d: loading %s ===", n, FINAL_DATASET_PATH)
    try:
        df = pd.read_csv(FINAL_DATASET_PATH, encoding="utf-8")
    except FileNotFoundError:
        logger.error(
            "%s not found. Run 'python main.py fuse' first.", FINAL_DATASET_PATH
        )
        sys.exit(1)
    except Exception as exc:
        logger.error("Could not read CSV: %s", exc, exc_info=True)
        sys.exit(1)

    df_sorted = df.sort_values("final_cuteness", ascending=False).head(n)

    # Pretty-print as a table
    display_cols = [
        "card_id", "pokemon_name", "types", "rarity",
        "final_cuteness", "cuteness_tier",
    ]
    present = [c for c in display_cols if c in df_sorted.columns]
    print(f"\nTop {n} cutest Pokémon TCG cards:\n")
    print(df_sorted[present].to_string(index=False))
    print()


# ---------------------------------------------------------------------------
# Argument parser
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="pokemon-cuteness-ranker",
        description="Build a composite cuteness dataset for Pokémon TCG cards.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    pull_p = sub.add_parser("pull", help="Pull all card data from the Pokémon TCG API.")
    pull_p.add_argument("--all-types", action="store_true", help="Include trainer and energy cards.")
    pull_p.add_argument("--limit", type=int, default=None, metavar="N", help="Fetch at most N cards (for testing).")

    sub.add_parser("scrape", help="Scrape community cuteness rankings.")
    sub.add_parser("rate", help="Rate card images via the Claude LLM.")
    sub.add_parser("fuse", help="Fuse all scores and export final CSV.")
    sub.add_parser("all", help="Run the full pipeline end-to-end.")

    top_p = sub.add_parser("top", help="Print top N cutest cards from the dataset.")
    top_p.add_argument(
        "--n",
        type=int,
        default=50,
        metavar="N",
        help="Number of top cards to display (default: 50).",
    )

    return parser


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

_COMMAND_MAP = {
    "pull":   cmd_pull,
    "scrape": cmd_scrape,
    "rate":   cmd_rate,
    "fuse":   cmd_fuse,
    "all":    cmd_all,
    "top":    cmd_top,
}


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    handler = _COMMAND_MAP[args.command]
    handler(args)


if __name__ == "__main__":
    main()
