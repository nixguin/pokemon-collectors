import { useState, useEffect } from "react";
import { getRarityValue } from "../utils/rarityUtils";
import { findCuteCards } from "../services/cutenessAI";
import { fetchCuteScoresFromSupabase } from "../services/pokemonApi";

const useCardFilters = (
  allPokemonCards,
  trainerCards,
  cardSection,
  onePieceCards = [],
  japaneseCards = [],
) => {
  const [filteredCards, setFilteredCards] = useState(trainerCards);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRarity, setSelectedRarity] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("exact");
  const [cuteMode, setCuteMode] = useState(false);
  const [cuteError, setCuteError] = useState(null);
  const [scoredCuteCards, setScoredCuteCards] = useState([]);
  const [cuteRetry, setCuteRetry] = useState(0);

  // Re-score all cards whenever cute mode turns on or the card pool changes.
  // This runs once — search/filter then works on the cached scored results.
  useEffect(() => {
    if (!cuteMode) {
      setScoredCuteCards([]);
      setCuteError(null);
      return;
    }
    let cancelled = false;
    const fetchScores = async () => {
      try {
        setCuteError(null);

        // ── Fast path: pre-computed scores from Supabase ─────────────────────
        const scoreMap = await fetchCuteScoresFromSupabase();
        if (scoreMap && Object.keys(scoreMap).length > 0) {
          const scored = allPokemonCards
            .filter((c) => scoreMap[String(c.productId)] !== undefined)
            .map((c) => ({
              ...c,
              cutenessScore: scoreMap[String(c.productId)],
            }))
            .sort((a, b) => b.cutenessScore - a.cutenessScore);
          if (!cancelled) setScoredCuteCards(scored);
          return;
        }

        // ── Slow path: ML backend inference ──────────────────────────────────
        // Only score Rare+ and full-art cards — skip Common/Uncommon
        const cutePool = allPokemonCards.filter((card) => {
          const rarity =
            card.extendedData?.find((d) => d.name === "Rarity")?.value || "";
          const val = getRarityValue(rarity);
          if (val >= 3) return true; // Rare and above
          // val === 0 means unknown rarity string — keep if it looks special
          const r = rarity.toLowerCase();
          return (
            r.includes("full") ||
            r.includes("art") ||
            r.includes("illustration") ||
            r.includes("rare") ||
            r.includes("holo") ||
            r.includes("special") ||
            r.includes("promo")
          );
        });
        const scored = await findCuteCards(cutePool, {
          minScore: 0.45,
          limit: Math.min(cutePool.length, 50000),
        });
        if (!cancelled) setScoredCuteCards(scored);
      } catch {
        if (!cancelled) {
          setCuteError(
            "Cute AI backend is offline. Start it with: cd backend && python -m uvicorn api:app --port 8001",
          );
          setScoredCuteCards([]);
        }
      }
    };
    fetchScores();
    return () => {
      cancelled = true;
    };
  }, [cuteMode, allPokemonCards, cuteRetry]);

  // Apply search/filters — runs on every filter change.
  // In cute mode, filters the cached scored results locally (no extra backend call).
  useEffect(() => {
    applyFilters();
  }, [
    searchQuery,
    trainerCards,
    allPokemonCards,
    onePieceCards,
    japaneseCards,
    cardSection,
    selectedRarity,
    selectedType,
    rarityFilter,
    scoredCuteCards,
    cuteMode,
  ]);

  const applyFilters = () => {
    if (cardSection === "japanese") {
      let results = [...japaneseCards];
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        results = results.filter(
          (card) =>
            card.name.toLowerCase().includes(query) ||
            card.cleanName?.toLowerCase().includes(query) ||
            (card.groupName || "").toLowerCase().includes(query) ||
            (card.extendedData?.find((d) => d.name === "SetName")?.value || "")
              .toLowerCase()
              .includes(query),
        );
      }
      if (selectedRarity !== "all") {
        results = results.filter((card) => {
          const cardRarity =
            card.extendedData?.find((d) => d.name === "Rarity")?.value || "";
          return cardRarity.toLowerCase().includes(selectedRarity.toLowerCase());
        });
      }
      if (selectedType !== "all") {
        results = results.filter((card) => {
          const cardType =
            card.extendedData?.find((d) => d.name === "CardType")?.value || "";
          return cardType.toLowerCase().includes(selectedType.toLowerCase());
        });
      }
      setFilteredCards(results);
      return;
    }

    if (cardSection === "onePiece") {
      let results = [...onePieceCards];
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        results = results.filter(
          (card) =>
            card.name.toLowerCase().includes(query) ||
            card.cleanName?.toLowerCase().includes(query) ||
            (card.groupName || "").toLowerCase().includes(query) ||
            (card.extendedData?.find((d) => d.name === "SetName")?.value || "")
              .toLowerCase()
              .includes(query) ||
            (card.extendedData?.find((d) => d.name === "Color")?.value || "")
              .toLowerCase()
              .includes(query),
        );
      }
      if (selectedType !== "all") {
        results = results.filter((card) => {
          const cardType =
            card.extendedData?.find((d) => d.name === "CardType")?.value || "";
          return cardType.toLowerCase().includes(selectedType.toLowerCase());
        });
      }
      setFilteredCards(results);
      return;
    }

    if (cuteMode) {
      let results = [...scoredCuteCards];
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        results = results.filter(
          (card) =>
            card.name.toLowerCase().includes(query) ||
            card.cleanName?.toLowerCase().includes(query) ||
            (card.groupName || "").toLowerCase().includes(query) ||
            (card.extendedData?.find((d) => d.name === "SetName")?.value || "")
              .toLowerCase()
              .includes(query),
        );
      }
      setFilteredCards(results);
      return;
    }

    let pool = cardSection === "all" ? allPokemonCards : trainerCards;
    let results = [...pool];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter(
        (card) =>
          card.name.toLowerCase().includes(query) ||
          card.cleanName?.toLowerCase().includes(query) ||
          (card.groupName || "").toLowerCase().includes(query) ||
          (card.extendedData?.find((d) => d.name === "SetName")?.value || "")
            .toLowerCase()
            .includes(query),
      );
    }

    if (selectedRarity !== "all") {
      results = results.filter((card) => {
        const cardRarity =
          card.extendedData?.find((d) => d.name === "Rarity")?.value || "";
        const cardVal = getRarityValue(cardRarity);
        const selectedVal = getRarityValue(selectedRarity);
        if (rarityFilter === "exact")
          return cardRarity
            .toLowerCase()
            .includes(selectedRarity.toLowerCase());
        if (rarityFilter === "higher") return cardVal >= selectedVal;
        if (rarityFilter === "lower") return cardVal <= selectedVal;
        return true;
      });
    }

    if (selectedType !== "all") {
      results = results.filter((card) => {
        const cardType =
          card.extendedData?.find((d) => d.name === "CardType")?.value || "";
        return cardType.toLowerCase().includes(selectedType.toLowerCase());
      });
    }

    setFilteredCards(results);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedRarity("all");
    setSelectedType("all");
  };

  return {
    filteredCards,
    searchQuery,
    setSearchQuery,
    selectedRarity,
    setSelectedRarity,
    selectedType,
    setSelectedType,
    rarityFilter,
    setRarityFilter,
    cuteMode,
    setCuteMode,
    cuteError,
    retryScoring: () => setCuteRetry((n) => n + 1),
    clearFilters,
  };
};

export default useCardFilters;
