"""
model.py — CutenessModel wrapper around the trained sklearn pipeline.

Provides a clean API so api.py never touches joblib or sklearn directly.
"""

import os
import joblib
import numpy as np
from typing import List, Dict, Any

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model", "cuteness_model.pkl")

# Trainer characters known for cute full-art illustrations
_CUTE_TRAINERS = {
    "misty", "erika", "sabrina", "lorelei", "daisy",
    "whitney", "jasmine", "kris", "lyra",
    "may", "lisia", "winona",
    "dawn", "cynthia", "cheryl", "mira", "marianne",
    "skyla", "elesa", "bianca", "rosa", "hilda", "shauntal",
    "serena", "viola", "korrina", "valerie", "diantha", "shauna",
    "lillie", "mallow", "lana", "lusamine", "wicke",
    "marnie", "nessa", "bea", "sonia", "gloria", "klara", "avery", "honey", "opal",
    "nemona", "penny", "iono", "tulip", "miriam", "juliana",
    "mimosa", "crispin", "lacey", "amarys", "kahili", "allister",
}

_CUTE_RARITY_WORDS = {"full art", "special illustration", "illustration rare", "rainbow", "shining"}


def _build_feature_text(
    name: str,
    card_type: str = "",
    rarity: str = "",
    set_name: str = "",
) -> str:
    name_lc = name.lower()
    rarity_lc = rarity.lower()
    type_lc  = card_type.lower()

    # For trainer cards featuring cute characters, inject "cute" keyword so the
    # TF-IDF model picks them up as likely-cute regardless of training data gaps.
    is_trainer = type_lc in ("trainer", "supporter", "item", "stadium")
    has_cute_trainer = any(t in name_lc for t in _CUTE_TRAINERS)
    has_cute_rarity  = any(r in rarity_lc for r in _CUTE_RARITY_WORDS)

    extra = []
    if is_trainer and has_cute_trainer:
        extra = ["cute", "cute", "cute"]  # weight boost via repetition
    elif is_trainer and has_cute_rarity:
        extra = ["cute", "cute"]

    parts = [name_lc, name_lc, type_lc, rarity_lc, set_name.lower()] + extra
    return " ".join(p for p in parts if p)


class CutenessModel:
    """Lazy-loads the trained model on first use."""

    def __init__(self):
        self._pipeline = None

    def _load(self):
        if self._pipeline is None:
            if not os.path.exists(MODEL_PATH):
                raise FileNotFoundError(
                    "Model not found. Run  python backend/train.py  first."
                )
            self._pipeline = joblib.load(MODEL_PATH)

    def is_ready(self) -> bool:
        return os.path.exists(MODEL_PATH)

    def predict_batch(self, cards: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Score a list of card dicts.

        Each card dict should have: name, type, rarity, set
        Returns the same list augmented with:
          cute        (bool)
          cute_score  (float 0-1, probability of being cute)
        """
        self._load()

        texts = [
            _build_feature_text(
                c.get("name", ""),
                c.get("type", ""),
                c.get("rarity", ""),
                c.get("set", ""),
            )
            for c in cards
        ]

        # probabilities[:, 1] = P(cute)
        probas: np.ndarray = self._pipeline.predict_proba(texts)[:, 1]
        labels: np.ndarray = self._pipeline.predict(texts)

        results = []
        for card, prob, label in zip(cards, probas.tolist(), labels.tolist()):
            results.append({
                **card,
                "cute":       bool(label),
                "cute_score": round(prob, 4),
            })

        return results

    def predict_one(self, card: Dict[str, Any]) -> Dict[str, Any]:
        return self.predict_batch([card])[0]

    def find_cute(
        self,
        cards: List[Dict[str, Any]],
        min_score: float = 0.50,
        limit: int = 24,
    ) -> List[Dict[str, Any]]:
        """
        Return the top-N cutest cards (above min_score), sorted by score desc.
        For trainer cards featuring known cute characters, apply a score floor
        so the ML model's training-data gap doesn't suppress them.
        """
        scored = self.predict_batch(cards)

        boosted = []
        for c in scored:
            score = c["cute_score"]
            name_lc = c.get("name", "").lower()
            type_lc = c.get("type", "").lower()
            rarity_lc = c.get("rarity", "").lower()
            is_trainer = type_lc in ("trainer", "supporter", "item", "stadium")
            has_cute_trainer = any(t in name_lc for t in _CUTE_TRAINERS)
            has_cute_rarity  = any(r in rarity_lc for r in _CUTE_RARITY_WORDS)

            if is_trainer and has_cute_trainer:
                # Give cute trainer cards a floor of 0.65 (full-art → 0.80)
                floor = 0.80 if has_cute_rarity else 0.65
                score = max(score, floor)
            elif is_trainer and has_cute_rarity:
                score = max(score, 0.55)

            if score >= min_score:
                boosted.append({**c, "cute_score": round(score, 4), "cute": True})

        boosted.sort(key=lambda c: c["cute_score"], reverse=True)
        return boosted[:limit]


# Singleton so the model is loaded only once per server process
cuteness_model = CutenessModel()
