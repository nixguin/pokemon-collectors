/**
 * cutenessAI.js
 *
 * Client for the Python ML Cuteness Classifier backend.
 * Backend must be running: cd backend && python -m uvicorn api:app --port 8001
 */

import axios from "axios";

// ── Configuration ─────────────────────────────────────────────────────────────

const ML_API_URL =
  process.env.EXPO_PUBLIC_CUTENESS_API_URL || "http://localhost:8001";

const API_TIMEOUT_MS = 8_000;

// ── Card Normaliser ───────────────────────────────────────────────────────────

const normaliseCard = (card) => ({
  name: card.name || card.cleanName || "",
  type: card.extendedData?.find((d) => d.name === "CardType")?.value || "",
  rarity: card.extendedData?.find((d) => d.name === "Rarity")?.value || "",
  set:
    card.extendedData?.find((d) => d.name === "SetName")?.value ||
    card.groupName ||
    "",
  imageUrl: card.imageUrl || null,
  productId: String(card.productId ?? ""),
  groupName: card.groupName || "",
});

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Find the cutest cards using the Python ML backend.
 *
 * @param {Array}   cards
 * @param {object}  opts  - { minScore: 0-1 (default 0.45), limit: number (default 24) }
 * @returns {Promise<Array>}  cards augmented with `cutenessScore` (0-1), or [] if backend unreachable
 */
export const findCuteCards = async (cards, opts = {}) => {
  const { minScore = 0.45, limit = 24 } = opts;

  if (!cards || cards.length === 0) return [];

  const payload = {
    cards: cards.map(normaliseCard),
    min_score: minScore,
    limit: Math.max(1, limit),
  };

  const response = await axios.post(`${ML_API_URL}/find-cute`, payload, {
    timeout: API_TIMEOUT_MS,
  });

  const cuteCards = response.data.cute_cards;
  const scoreById = Object.fromEntries(
    cuteCards.map((c) => [c.productId, c.cute_score]),
  );

  return cards
    .filter((c) => scoreById[String(c.productId)] !== undefined)
    .map((c) => ({ ...c, cutenessScore: scoreById[String(c.productId)] }))
    .sort((a, b) => b.cutenessScore - a.cutenessScore)
    .slice(0, Math.max(1, limit));
};

/** Returns true if the user's query is asking for cute cards. */
export const isCuteQuery = (query) => {
  const q = query.toLowerCase();
  return [
    "cute",
    "adorable",
    "kawaii",
    "sweet",
    "pretty",
    "beautiful",
    "lovely",
    "charming",
    "precious",
  ].some((term) => q.includes(term));
};

/** Human-readable reason why a card was flagged as cute. */
export const getCutenessReason = (card) => {
  const score = card.cutenessScore ?? 0;
  if (score >= 0.85) return "One of the most beloved cute cards! 💕";
  if (score >= 0.7) return "Known for being super adorable! 🌸";
  if (score >= 0.55) return "A fan-favourite cute card! ✨";
  return "Has cute features! 🌟";
};
