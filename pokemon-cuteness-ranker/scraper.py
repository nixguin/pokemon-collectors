"""
scraper.py — Community cuteness scraper.

Fetches ranked pokémon cuteness lists from multiple web sources, normalises
every entry to a 0-10 scale, and merges the results into a species-level JSON
file saved to COMMUNITY_SCORES_PATH.

If live sources are unavailable (404/blocked), falls back to a curated
hardcoded seed list so the pipeline always produces meaningful community scores.
"""

from __future__ import annotations

import json
import logging
import os
import time
from collections import defaultdict
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup

from config import (
    BUZZFEED_URL,
    CARDS_RAW_PATH,
    COLLIDER_URL,
    COMMUNITY_SCORES_PATH,
    DEXERTO_URL,
    FINALBOSS_URL,
    RANKER_URLS,
    REQUEST_HEADERS,
    SCRAPER_DELAY_SECONDS,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Hardcoded community-consensus seed scores
# Compiled from widely-cited "cutest Pokémon" lists (2020-2025).
# Scores are on the 0-10 scale; absence = null (not in any community list).
# ---------------------------------------------------------------------------

COMMUNITY_SEED: Dict[str, float] = {
    # ── Tier S  (9.5 – 10) ─────────────────────────────────────────────────
    "Eevee": 9.8, "Pikachu": 9.7, "Mew": 9.6, "Jigglypuff": 9.5,
    "Togepi": 9.5, "Sylveon": 9.5, "Pichu": 9.5, "Clefairy": 9.4,
    "Piplup": 9.4, "Marill": 9.3,
    # ── Tier A  (8.0 – 9.4) ────────────────────────────────────────────────
    "Espeon": 9.2, "Vaporeon": 9.0, "Leafeon": 8.9, "Glaceon": 8.9,
    "Flareon": 8.8, "Jolteon": 8.7, "Umbreon": 8.7, "Togekiss": 8.8,
    "Togetic": 8.6, "Clefable": 8.5, "Wigglytuff": 8.5, "Ralts": 8.9,
    "Gardevoir": 8.6, "Kirlia": 8.7, "Snubbull": 8.3, "Granbull": 8.0,
    "Chansey": 8.7, "Blissey": 8.5, "Happiny": 9.1, "Azumarill": 8.8,
    "Azurill": 9.0, "Plusle": 8.8, "Minun": 8.8, "Pachirisu": 8.9,
    "Emolga": 8.8, "Dedenne": 8.9, "Mimikyu": 9.0, "Shaymin": 9.1,
    "Manaphy": 9.0, "Phione": 8.8, "Celebi": 9.1, "Jirachi": 9.2,
    "Victini": 9.3, "Meloetta": 9.0, "Diancie": 8.9, "Comfey": 9.0,
    "Ribombee": 8.9, "Cutiefly": 9.0, "Alcremie": 9.2, "Milcery": 9.1,
    "Swirlix": 8.8, "Slurpuff": 8.6, "Snubbull": 8.4, "Snorunt": 8.5,
    "Glalie": 8.0, "Snowrunt": 8.5, "Froslass": 8.4,
    "Buneary": 8.9, "Lopunny": 8.6, "Skitty": 9.0, "Delcatty": 8.7,
    "Meowth": 8.8, "Persian": 8.4, "Glameow": 8.8, "Purugly": 7.8,
    "Purrloin": 8.6, "Liepard": 8.2, "Espurr": 9.0, "Meowstic": 8.8,
    "Sprigatito": 9.3, "Floragato": 8.8, "Meowscarada": 8.5,
    "Scorbunny": 9.2, "Raboot": 8.7, "Cinderace": 8.5,
    "Sobble": 9.2, "Drizzile": 8.5, "Inteleon": 8.2,
    # ── Tier B  (6.5 – 7.9) ────────────────────────────────────────────────
    "Bulbasaur": 8.3, "Ivysaur": 7.8, "Squirtle": 8.4, "Wartortle": 7.9,
    "Charmander": 8.5, "Charmeleon": 7.5, "Caterpie": 7.2, "Metapod": 7.0,
    "Butterfree": 7.8, "Weedle": 6.8, "Cleffa": 9.3, "Igglybuff": 9.2,
    "Togepi": 9.5, "Elekid": 8.5, "Magby": 8.3, "Smoochum": 8.7,
    "Tyrogue": 8.0, "Bonsly": 8.8, "Mime Jr": 8.2, "Munchlax": 8.5,
    "Riolu": 8.9, "Mantyke": 8.6, "Budew": 8.8, "Chingling": 8.7,
    "Wynaut": 8.6, "Wobbuffet": 8.0, "Toxel": 8.5, "Hatenna": 8.8,
    "Hattrem": 8.4, "Hatterene": 8.2, "Milcery": 9.0,
    "Popplio": 9.1, "Brionne": 8.7, "Primarina": 8.5,
    "Rowlet": 9.2, "Dartrix": 8.5, "Decidueye": 8.0,
    "Litten": 9.0, "Torracat": 8.5, "Incineroar": 7.5,
    "Phanpy": 8.6, "Donphan": 7.5, "Teddiursa": 9.2, "Ursaring": 7.5,
    "Swinub": 8.7, "Piloswine": 7.5, "Mamoswine": 7.0,
    "Snubbull": 8.5, "Chikorita": 8.9, "Cyndaquil": 8.8, "Totodile": 8.7,
    "Mudkip": 9.1, "Torchic": 9.0, "Treecko": 8.5,
    "Oshawott": 9.1, "Dewott": 8.5, "Samurott": 8.0,
    "Snivy": 8.8, "Servine": 8.3, "Serperior": 8.0,
    "Tepig": 8.6, "Pignite": 7.8, "Emboar": 7.2,
    "Chespin": 8.8, "Quilladin": 7.8, "Chesnaught": 7.5,
    "Fennekin": 9.1, "Braixen": 8.7, "Delphox": 8.2,
    "Froakie": 8.8, "Frogadier": 8.3, "Greninja": 8.0,
    "Grookey": 8.9, "Thwackey": 8.3, "Rillaboom": 7.8,
    "Fuecoco": 9.0, "Crocalor": 8.4, "Skeledirge": 8.0,
    "Quaxly": 8.9, "Quaxwell": 8.4, "Quaquaval": 8.0,
    "Charcadet": 8.7, "Armarouge": 8.2, "Ceruledge": 8.0,
    "Fidough": 9.0, "Dachsbun": 8.5, "Maschiff": 8.2,
    "Sinistea": 8.6, "Polteageist": 8.2, "Wooloo": 9.0, "Dubwool": 8.2,
    "Alolan Vulpix": 9.2, "Vulpix": 9.0, "Ninetales": 8.8,
    "Alolan Ninetales": 9.1, "Ponyta": 9.0, "Rapidash": 8.5,
    "Galarian Ponyta": 9.4, "Galarian Rapidash": 9.1,
    "Mareep": 8.8, "Flaaffy": 8.3, "Ampharos": 8.0,
    "Snover": 8.4, "Abomasnow": 7.8, "Amaura": 8.8, "Aurorus": 8.5,
    "Corsola": 8.5, "Galarian Corsola": 9.0, "Cursola": 8.2,
    "Spritzee": 8.8, "Aromatisse": 8.3, "Swirlix": 8.9,
    "Flabebe": 8.9, "Floette": 8.7, "Florges": 8.5,
    "Goomy": 9.0, "Sliggoo": 8.3, "Goodra": 8.5,
    "Phantump": 8.7, "Trevenant": 8.0, "Pumpkaboo": 8.5, "Gourgeist": 8.0,
    "Xerneas": 8.8, "Deerling": 8.7, "Sawsbuck": 8.0,
    "Audino": 8.6, "Swablu": 8.8, "Altaria": 8.5,
    "Cottonee": 8.7, "Whimsicott": 8.5, "Petilil": 8.8, "Lilligant": 8.5,
    "Minccino": 9.0, "Cinccino": 8.7, "Cubchoo": 8.7, "Beartic": 7.8,
    "Vanillite": 8.6, "Vanillish": 8.2, "Vanilluxe": 7.8,
    "Dewpider": 8.4, "Araquanid": 7.8, "Crabrawler": 7.8,
    "Bounsweet": 9.0, "Steenee": 8.6, "Tsareena": 8.3,
    "Comfey": 9.0, "Oranguru": 7.5, "Passimian": 7.5,
    "Popplio": 9.1, "Sandygast": 8.3, "Palossand": 7.8,
    "Drampa": 8.5, "Togedemaru": 9.0, "Morelull": 8.8, "Shiinotic": 8.3,
    "Wishiwashi": 8.5, "Pyukumuku": 8.6, "Type Null": 7.5,
    "Silvally": 7.8, "Turtonator": 7.5, "Mimikyu": 9.1,
    "Bruxish": 7.5, "Drampa": 8.5, "Dhelmise": 7.5,
    "Jangmo-o": 8.0, "Hakamo-o": 7.5, "Kommo-o": 7.5,
    "Marshadow": 8.5, "Zeraora": 8.5, "Meltan": 8.8, "Melmetal": 7.8,
    "Grubbin": 7.8, "Dewpider": 8.5, "Morelull": 8.9,
    "Stufful": 9.1, "Bewear": 8.5, "Wimpod": 8.3,
    "Salandit": 8.0, "Salazzle": 7.8, "Rockruff": 9.2, "Lycanroc": 8.5,
    "Wishiwashi": 8.5, "Komala": 8.7, "Turtonator": 7.5,
    "Sandygast": 8.2, "Palossand": 7.8, "Pyukumuku": 8.5,
    "Minior": 8.6, "Oricorio": 8.8, "Rowlet": 9.2,
    # ── Tier C  (5.0 – 6.4) ────────────────────────────────────────────────
    "Charizard": 7.0, "Venusaur": 7.2, "Blastoise": 7.3,
    "Gengar": 7.5, "Haunter": 7.0, "Gastly": 7.2,
    "Alakazam": 7.0, "Kadabra": 6.8, "Abra": 7.5,
    "Machamp": 6.5, "Machoke": 6.2, "Machop": 6.8,
    "Geodude": 6.5, "Graveler": 6.0, "Golem": 5.8,
    "Onix": 5.5, "Steelix": 5.2,
    "Snorlax": 8.0, "Munchlax": 8.5,
    "Slowpoke": 8.0, "Slowbro": 7.5, "Slowking": 7.5,
    "Psyduck": 8.4, "Golduck": 7.5, "Poliwag": 8.0, "Poliwhirl": 7.5,
    "Magikarp": 7.8, "Gyarados": 6.5,
    "Ditto": 8.5, "Porygon": 7.5, "Porygon2": 7.2, "Porygon-Z": 7.0,
    "Lapras": 8.8, "Kangaskhan": 8.0, "Tauros": 6.5,
    "Mr Mime": 7.0, "Scyther": 6.5, "Jynx": 7.0, "Electabuzz": 6.8,
    "Magmar": 6.8, "Pinsir": 5.5, "Farfetchd": 7.5, "Doduo": 6.5,
    "Seel": 8.0, "Dewgong": 7.8, "Shellder": 7.0, "Cloyster": 6.5,
    "Drowzee": 6.5, "Hypno": 6.2, "Krabby": 6.8, "Kingler": 6.5,
    "Voltorb": 7.0, "Electrode": 6.8, "Exeggcute": 7.0, "Exeggutor": 6.5,
    "Cubone": 8.0, "Marowak": 7.5, "Lickitung": 7.5, "Koffing": 6.8,
    "Weezing": 6.5, "Rhyhorn": 6.8, "Rhydon": 6.2, "Chansey": 8.7,
    "Tangela": 7.2, "Horsea": 8.0, "Seadra": 7.5, "Kingdra": 7.5,
    "Staryu": 7.0, "Starmie": 6.8, "Scyther": 6.5, "Tauros": 6.5,
    "Gyarados": 6.5, "Lapras": 8.8, "Vaporeon": 9.0, "Jolteon": 8.7,
    "Flareon": 8.8, "Porygon": 7.5, "Omanyte": 7.8, "Omastar": 7.2,
    "Kabuto": 7.5, "Kabutops": 7.0, "Aerodactyl": 6.5,
    "Articuno": 8.0, "Zapdos": 7.5, "Moltres": 7.5, "Dratini": 9.0,
    "Dragonair": 8.8, "Dragonite": 8.5,
}


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

RawEntry = Dict[str, float]  # {pokemon_name: score}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _fetch(url: str) -> Optional[BeautifulSoup]:
    """GET a URL and return a BeautifulSoup document, or None on failure."""
    try:
        time.sleep(SCRAPER_DELAY_SECONDS)
        response = requests.get(url, headers=REQUEST_HEADERS, timeout=20)
        response.raise_for_status()
        return BeautifulSoup(response.text, "lxml")
    except Exception as exc:
        logger.warning("Failed to fetch %s: %s", url, exc)
        return None


def _ranked_score(position: int, total: int) -> float:
    """Convert a 1-based position in a ranked list to a 0-10 score.

    The top entry receives 10, the last entry receives just above 0.
    """
    if total <= 1:
        return 10.0
    return 10.0 * (1.0 - (position - 1) / total)


TIER_MAP = {"S": 10.0, "A": 8.0, "B": 6.0, "C": 4.0, "D": 2.0, "F": 0.0}


def _normalise_name(name: str) -> str:
    """Strip suffixes like '♀', '♂', region tags, and extra whitespace."""
    for ch in ("♀", "♂", "⚥"):
        name = name.replace(ch, "")
    # Drop parenthetical notes: "Eevee (Gen 1)"
    if "(" in name:
        name = name[: name.index("(")]
    return name.strip().title()


# ---------------------------------------------------------------------------
# Per-source scrapers
# ---------------------------------------------------------------------------

def _scrape_ranker(url: str) -> RawEntry:
    """Scrape a single Ranker pokémon cuteness list.

    Ranker renders ranked items in <li> elements that contain the pokémon name.
    Each list position → ranked score.
    """
    soup = _fetch(url)
    if soup is None:
        return {}

    entries: Dict[str, float] = {}
    # Ranker uses data-item-id attributes on list items; the pokémon name is
    # in the first non-empty text node or an <h2> inside each item.
    items = soup.select("li[data-item-id]")
    if not items:
        # Fallback: any ordered list entry with a heading
        items = soup.select("ol li")

    total = len(items)
    if total == 0:
        logger.warning("Ranker: no list items found at %s", url)
        return {}

    for position, item in enumerate(items, start=1):
        heading = item.find(["h2", "h3", "span", "a"])
        if heading is None:
            continue
        name = _normalise_name(heading.get_text())
        if name:
            score = _ranked_score(position, total)
            entries[name] = max(entries.get(name, 0.0), score)

    logger.info("Ranker (%s): scraped %d entries", url, len(entries))
    return entries


def _scrape_dexerto() -> RawEntry:
    """Scrape Dexerto's 'cutest pokémon' article.

    These articles typically contain an ordered or numbered list of pokémon
    names inside <ol>/<li> or <p> tags with a number prefix.
    """
    soup = _fetch(DEXERTO_URL)
    if soup is None:
        return {}

    entries: Dict[str, float] = {}

    # Try structured <ol> first
    ol = soup.find("ol")
    if ol:
        items = ol.find_all("li")
        total = len(items)
        for pos, li in enumerate(items, start=1):
            name = _normalise_name(li.get_text())
            if name:
                entries[name] = _ranked_score(pos, total)
    else:
        # Fallback: look for numbered headings h2/h3 with "N." prefix
        headings = soup.select("h2, h3, h4")
        candidates = []
        for h in headings:
            text = h.get_text(strip=True)
            if text and text[0].isdigit():
                parts = text.split(".", 1)
                if len(parts) == 2:
                    candidates.append(parts[1].strip())
        total = len(candidates)
        for pos, name in enumerate(candidates, start=1):
            name = _normalise_name(name)
            if name:
                entries[name] = _ranked_score(pos, total)

    logger.info("Dexerto: scraped %d entries", len(entries))
    return entries


def _scrape_buzzfeed() -> RawEntry:
    """Scrape BuzzFeed's cutest pokémon list."""
    soup = _fetch(BUZZFEED_URL)
    if soup is None:
        return {}

    entries: Dict[str, float] = {}

    # BuzzFeed quiz/list articles often have <h2> or bold text as entry titles
    items = soup.select("h2, .bfp-numbered-list-item__title, .js-numbered-list-item")
    if not items:
        items = soup.select("ol li, ul.ranked-list li")

    candidates: List[str] = []
    for item in items:
        text = item.get_text(strip=True)
        if text:
            candidates.append(text)

    total = len(candidates)
    for pos, raw_name in enumerate(candidates, start=1):
        name = _normalise_name(raw_name)
        if name:
            entries[name] = _ranked_score(pos, total)

    logger.info("BuzzFeed: scraped %d entries", len(entries))
    return entries


def _scrape_collider() -> RawEntry:
    """Scrape Collider's cutest pokémon ranking."""
    soup = _fetch(COLLIDER_URL)
    if soup is None:
        return {}

    entries: Dict[str, float] = {}

    # Collider articles commonly use numbered <h2> headings for rankings
    headings = soup.select("h2, h3")
    candidates: List[str] = []
    for h in headings:
        text = h.get_text(strip=True)
        # Match "10. Eevee" or "10) Eevee" style headings
        if text and (text[0].isdigit() or text[:2].replace(".", "").isdigit()):
            for sep in (".", ")", " "):
                if sep in text:
                    parts = text.split(sep, 1)
                    if len(parts) == 2 and parts[0].strip().isdigit():
                        candidates.append(parts[1].strip())
                        break
        elif text and not any(c.isdigit() for c in text[:2]):
            # Plain heading — include if it looks like a pokémon name (short)
            if 2 < len(text) < 30:
                candidates.append(text)

    total = len(candidates)
    for pos, raw_name in enumerate(candidates, start=1):
        name = _normalise_name(raw_name)
        if name:
            entries[name] = _ranked_score(pos, total)

    logger.info("Collider: scraped %d entries", len(entries))
    return entries


def _scrape_finalboss() -> RawEntry:
    """Scrape FinalBoss.io's cutest pokémon poll/list."""
    soup = _fetch(FINALBOSS_URL)
    if soup is None:
        return {}

    entries: Dict[str, float] = {}

    ol = soup.find("ol")
    if ol:
        items = ol.find_all("li")
        total = len(items)
        for pos, li in enumerate(items, start=1):
            name = _normalise_name(li.get_text())
            if name:
                entries[name] = _ranked_score(pos, total)
    else:
        headings = soup.select("h2, h3, strong")
        candidates = [_normalise_name(h.get_text()) for h in headings if h.get_text(strip=True)]
        total = len(candidates)
        for pos, name in enumerate(candidates, start=1):
            if name:
                entries[name] = _ranked_score(pos, total)

    logger.info("FinalBoss: scraped %d entries", len(entries))
    return entries


# ---------------------------------------------------------------------------
# Merge helpers
# ---------------------------------------------------------------------------

def _merge(
    aggregate: Dict[str, List[float]], new_entries: RawEntry, source_name: str
) -> None:
    """Append new_entries scores to the running aggregate."""
    for name, score in new_entries.items():
        aggregate[name].append(score)
    logger.debug("Merged %d entries from %s", len(new_entries), source_name)


def _build_community_scores(
    aggregate: Dict[str, List[float]]
) -> Dict[str, dict]:
    """Convert raw aggregated scores to the output schema."""
    result = {}
    for name, scores in aggregate.items():
        if not scores:
            continue
        result[name] = {
            "avg_score": round(sum(scores) / len(scores), 4),
            "sources_count": len(scores),
            "raw_scores": [round(s, 4) for s in scores],
        }
    return result


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def _load_cute_labels_seed() -> RawEntry:
    """Load the backend cute_labels.json as an additional seed source.

    Maps cute=1 → 9.0 and cute=0 → 2.0 so the backend-labelled cards
    contribute to community scores even when web scraping is unavailable.
    """
    labels_path = os.path.join(
        os.path.dirname(__file__), "..", "backend", "data", "cute_labels.json"
    )
    labels_path = os.path.normpath(labels_path)
    if not os.path.exists(labels_path):
        logger.debug("cute_labels.json not found at %s – skipping", labels_path)
        return {}
    try:
        with open(labels_path, "r", encoding="utf-8") as fh:
            raw = json.load(fh)
        entries: RawEntry = {}
        for entry in raw.get("labels", []):
            name = _normalise_name(str(entry.get("name", "")))
            cute = int(entry.get("cute", 0))
            if name:
                entries[name] = 9.0 if cute == 1 else 2.0
        logger.info("cute_labels seed: %d entries loaded", len(entries))
        return entries
    except Exception as exc:
        logger.warning("Failed to load cute_labels seed: %s", exc)
        return {}


def run_scraper() -> Dict[str, dict]:
    """Run all scrapers, merge results, save to disk, and return the data."""
    aggregate: Dict[str, List[float]] = defaultdict(list)

    # ── 1. Community seed (always applied first) ──────────────────────────
    # Seed from the hardcoded community-consensus list
    _merge(aggregate, COMMUNITY_SEED, "community_seed")
    # Seed from the backend's hand-labelled cute_labels.json
    _merge(aggregate, _load_cute_labels_seed(), "cute_labels_seed")

    # ── 2. Live web scraping (fail-gracefully per source) ─────────────────
    live_total = 0

    for url in RANKER_URLS:
        entries = _scrape_ranker(url)
        live_total += len(entries)
        _merge(aggregate, entries, f"ranker:{url.split('/')[-1]}")

    for scrape_fn, name in [
        (_scrape_dexerto,  "dexerto"),
        (_scrape_buzzfeed, "buzzfeed"),
        (_scrape_collider, "collider"),
        (_scrape_finalboss,"finalboss"),
    ]:
        entries = scrape_fn()
        live_total += len(entries)
        _merge(aggregate, entries, name)

    if live_total == 0:
        logger.warning(
            "All live web sources returned 0 entries (URLs may be stale). "
            "Using seed data only — community scores will still be available."
        )
    else:
        logger.info("Live web scraping yielded %d total entries.", live_total)

    community_scores = _build_community_scores(aggregate)

    with open(COMMUNITY_SCORES_PATH, "w", encoding="utf-8") as fh:
        json.dump(community_scores, fh, indent=2, ensure_ascii=False)

    logger.info(
        "Community scores saved: %d unique species → %s",
        len(community_scores),
        COMMUNITY_SCORES_PATH,
    )
    return community_scores
