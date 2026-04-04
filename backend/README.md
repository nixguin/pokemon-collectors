# Pokemon Cuteness ML Backend

A Python machine learning backend that predicts how "cute" a Pokemon card is.

## Stack

- **scikit-learn** — TF-IDF + Random Forest classifier
- **FastAPI** — REST API server
- **uvicorn** — ASGI server

## Setup

```bash
cd backend
pip install -r requirements.txt
```

## Train the model

```bash
python train.py
```

Output: `backend/model/cuteness_model.pkl`

## Start the API server

```bash
python api.py
# Server runs on http://localhost:8000
```

## API Reference

| Method | Endpoint     | Description                           |
| ------ | ------------ | ------------------------------------- |
| GET    | `/health`    | Check server & model status           |
| POST   | `/predict`   | Score a list of cards for cuteness    |
| POST   | `/find-cute` | Return top-N cutest cards from a list |

### `POST /find-cute` example

```json
{
  "cards": [
    {
      "name": "Pikachu",
      "type": "Pokemon",
      "rarity": "Common",
      "set": "Base Set"
    },
    {
      "name": "Charizard",
      "type": "Pokemon",
      "rarity": "Rare",
      "set": "Base Set"
    }
  ],
  "min_score": 0.5,
  "limit": 24
}
```

Response:

```json
{
  "cute_cards": [
    { "name": "Pikachu", "cute": true, "cute_score": 0.91, ... }
  ],
  "total": 1
}
```

## How it works

1. **Feature Engineering** — card name (weighted ×2), type, rarity, and set name are concatenated into a single text string.
2. **TF-IDF Vectorisation** — character 2–4 grams are extracted, letting the model recognise name fragments like `pichu` inside `pikachu`.
3. **Random Forest** — 300-tree ensemble with balanced class weights, trained on ~200 ground-truth cute/not-cute labels + CSV pseudo-labels.
4. **Scoring** — `predict_proba` returns P(cute) for each card; cards sorted by score descending.
