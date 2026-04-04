"""
train.py — Train and save the Pokemon Cuteness Classifier.

Pipeline
--------
1. Load ground-truth cute labels (backend/data/cute_labels.json)
2. Build raw feature text per card:  "<name> <type> <rarity> <set>"
3. TF-IDF vectorise the text (character n-grams to catch partial names)
4. Train a Random Forest on those features
5. Evaluate on a held-out split and print accuracy / classification report
6. Save the trained pipeline to backend/model/cuteness_model.pkl
"""

import json
import os
import sys
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, accuracy_score
import joblib

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(__file__)
LABELS_PATH = os.path.join(BASE_DIR, "data", "cute_labels.json")
CSV_PATH    = os.path.join(BASE_DIR, "..", "assets", "data", "pokemon_cards.csv")
MODEL_DIR   = os.path.join(BASE_DIR, "model")
MODEL_PATH  = os.path.join(MODEL_DIR, "cuteness_model.pkl")
os.makedirs(MODEL_DIR, exist_ok=True)


# ── Feature Engineering ───────────────────────────────────────────────────────
def build_feature_text(name: str, card_type: str = "", rarity: str = "", set_name: str = "") -> str:
    """
    Combine card attributes into a single string the TF-IDF can learn from.
    Repeating the name twice slightly boosts its weight vs. metadata fields.
    """
    parts = [
        name.lower(),
        name.lower(),                     # extra weight on name
        card_type.lower(),
        rarity.lower(),
        set_name.lower(),
    ]
    return " ".join(p for p in parts if p)


# ── Load Labels ───────────────────────────────────────────────────────────────
def load_labels() -> pd.DataFrame:
    with open(LABELS_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)["labels"]

    rows = []
    for entry in raw:
        rows.append({
            "name":    entry["name"],
            "cute":    int(entry["cute"]),
            "type":    "",
            "rarity":  "",
            "set":     "",
        })

    return pd.DataFrame(rows)


# ── Augment with CSV Data ─────────────────────────────────────────────────────
def augment_with_csv(df: pd.DataFrame) -> pd.DataFrame:
    """
    Where labels overlap with CSV cards, fill in type/rarity/set for richer features.
    Also generate pseudo-labels for CSV cards that aren't in the label file
    using a simple heuristics so the model can learn from more data.
    """
    if not os.path.exists(CSV_PATH):
        print(f"[WARN] CSV not found at {CSV_PATH}, using labels only.")
        return df

    csv_df = pd.read_csv(CSV_PATH)
    csv_df.columns = [c.lower() for c in csv_df.columns]

    # Build lookup: lowercase name -> row
    csv_lookup = {
        row["name"].lower(): row
        for _, row in csv_df.iterrows()
    }

    # Enrich label rows
    for i, row in df.iterrows():
        key = row["name"].lower()
        if key in csv_lookup:
            ref = csv_lookup[key]
            df.at[i, "type"]   = str(ref.get("type",   ""))
            df.at[i, "rarity"] = str(ref.get("rarity", ""))
            df.at[i, "set"]    = str(ref.get("set",    ""))

    # Build pseudo-labels for unlabelled CSV rows
    #  • Any card whose name matches a known cute card  → cute = 1
    #  • Trainer / Energy cards without a cute name    → cute = 0
    labelled_names = set(df["name"].str.lower())
    cute_names_lower = set(
        e["name"].lower()
        for e in json.load(open(LABELS_PATH))["labels"]
        if e["cute"] == 1
    )

    pseudo_rows = []
    for _, csv_row in csv_df.iterrows():
        name = str(csv_row.get("name", ""))
        if name.lower() in labelled_names:
            continue  # already labelled

        card_type = str(csv_row.get("type", "")).lower()
        rarity    = str(csv_row.get("rarity", "")).lower()

        # Heuristic pseudo-label
        cute = 1 if name.lower() in cute_names_lower else (
            0 if card_type in ("trainer", "energy") else None
        )
        if cute is None:
            continue  # skip uncertain rows

        pseudo_rows.append({
            "name":   name,
            "cute":   cute,
            "type":   str(csv_row.get("type",   "")),
            "rarity": str(csv_row.get("rarity", "")),
            "set":    str(csv_row.get("set",    "")),
        })

    if pseudo_rows:
        print(f"[INFO] Added {len(pseudo_rows)} pseudo-labelled rows from CSV.")
        df = pd.concat([df, pd.DataFrame(pseudo_rows)], ignore_index=True)

    return df


# ── Build Dataset ─────────────────────────────────────────────────────────────
def build_dataset() -> tuple[np.ndarray, np.ndarray]:
    df = load_labels()
    df = augment_with_csv(df)
    df = df.drop_duplicates(subset="name")

    X = df.apply(
        lambda r: build_feature_text(r["name"], r["type"], r["rarity"], r["set"]),
        axis=1,
    ).values
    y = df["cute"].values

    print(f"[INFO] Dataset: {len(X)} samples  |  cute={y.sum()}  not-cute={(1-y).sum()}")
    return X, y


# ── Build Pipeline ────────────────────────────────────────────────────────────
def build_pipeline() -> Pipeline:
    """
    TF-IDF (character 2-4 grams) + Random Forest.

    Character n-grams let the model learn partial name fragments
    (e.g. 'pichu' inside 'pikachu') which word-level TF-IDF would miss.
    """
    vectoriser = TfidfVectorizer(
        analyzer="char_wb",
        ngram_range=(2, 4),
        max_features=8_000,
        sublinear_tf=True,
    )
    classifier = RandomForestClassifier(
        n_estimators=300,
        max_depth=None,
        min_samples_leaf=1,
        class_weight="balanced",   # handles class imbalance
        random_state=42,
        n_jobs=-1,
    )
    return Pipeline([("tfidf", vectoriser), ("rf", classifier)])


# ── Train & Evaluate ──────────────────────────────────────────────────────────
def train():
    print("=" * 60)
    print("  Pokemon Cuteness Classifier — Training")
    print("=" * 60)

    X, y = build_dataset()

    # Cross-validation on full set
    pipeline = build_pipeline()
    cv_scores = cross_val_score(pipeline, X, y, cv=5, scoring="f1", n_jobs=-1)
    print(f"\n[CV]  F1 (5-fold): {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    # Hold-out evaluation
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)

    print(f"\n[EVAL] Accuracy : {accuracy_score(y_test, y_pred):.4f}")
    print("\n[EVAL] Classification Report:\n")
    print(classification_report(y_test, y_pred, target_names=["not cute", "cute"]))

    # Retrain on full dataset before saving
    print("[INFO] Retraining on full dataset...")
    pipeline.fit(X, y)

    joblib.dump(pipeline, MODEL_PATH)
    print(f"\n[DONE] Model saved → {MODEL_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    train()
