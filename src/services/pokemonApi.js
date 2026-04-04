import axios from "axios";
import { supabase } from "./supabaseClient";

// ── TCGdex ───────────────────────────────────────────────────────────────────
export const fetchPokemonSets = async () => {
  try {
    const response = await axios.get("https://api.tcgdex.net/v2/en/sets");
    return response.data;
  } catch (error) {
    console.error("Error fetching Pokemon sets:", error);
    return [];
  }
};

export const fetchCardsFromSet = async (setId) => {
  try {
    const response = await axios.get(
      `https://api.tcgdex.net/v2/en/sets/${setId}`,
    );
    return response.data.cards || [];
  } catch (error) {
    console.error(`Error fetching cards for set ${setId}:`, error);
    return [];
  }
};

// ── Pokemon TCG API ───────────────────────────────────────────────────────────
export const fetchAllPokemonCards = async (page = 1, pageSize = 250) => {
  try {
    const response = await axios.get(
      `https://api.pokemontcg.io/v2/cards?page=${page}&pageSize=${pageSize}`,
    );
    return response.data.data || [];
  } catch (error) {
    console.error("Error fetching Pokemon cards from Pokemon TCG API:", error);
    return [];
  }
};

export const fetchPokemonTrainerCards = async (page = 1, pageSize = 250) => {
  try {
    const response = await axios.get(
      `https://api.pokemontcg.io/v2/cards?q=supertype:trainer&page=${page}&pageSize=${pageSize}`,
    );
    return response.data.data || [];
  } catch (error) {
    console.error("Error fetching trainer cards from Pokemon TCG API:", error);
    return [];
  }
};

// TURBO BATCH LOADING: Load multiple pages simultaneously
export const fetchCardsBatch = async (
  pages,
  pageSize = 250,
  cardType = "all",
) => {
  try {
    const promises = pages.map((page) =>
      cardType === "trainers"
        ? fetchPokemonTrainerCards(page, pageSize)
        : fetchAllPokemonCards(page, pageSize),
    );
    const results = await Promise.allSettled(promises);
    const allCards = [];
    results.forEach((result) => {
      if (result.status === "fulfilled" && result.value.length > 0) {
        allCards.push(...result.value);
      }
    });
    return allCards;
  } catch (error) {
    console.error(`Error in batch loading ${cardType}:`, error);
    return [];
  }
};

// Convert Pokemon TCG API format to app format
export const convertPokemonTCGCard = (card, index = 0) => ({
  productId: `${card.id}-${index}-${Date.now()}`.replace(/[^a-zA-Z0-9-]/g, ""),
  name: card.name,
  cleanName: card.name,
  imageUrl: card.images?.small || card.images?.large,
  categoryId:
    card.supertype === "Pokémon" ? 1 : card.supertype === "Energy" ? 2 : 3,
  groupId: card.set?.id || "unknown",
  url: `https://pokemontcg.io/card/${card.id}`,
  groupName: card.set?.name || "Unknown Set",
  extendedData: [
    { name: "CardType", value: card.supertype || "Trainer" },
    { name: "Rarity", value: card.rarity || "Common" },
    { name: "SetName", value: card.set?.name || "Unknown Set" },
    { name: "Number", value: card.number || "" },
    {
      name: "Price",
      value:
        card.tcgplayer?.prices?.holofoil?.market ||
        card.tcgplayer?.prices?.normal?.market ||
        card.tcgplayer?.prices?.reverseHolofoil?.market ||
        "N/A",
    },
  ],
});

export const filterTrainerCards = (products) =>
  products.filter((product) => {
    const name = product.name?.toLowerCase() || "";
    const extendedData = product.extendedData || [];
    return (
      name.includes("trainer") ||
      name.includes("supporter") ||
      name.includes("item") ||
      name.includes("stadium") ||
      name.includes("tool") ||
      name.includes("professor") ||
      name.includes("bill") ||
      name.includes("potion") ||
      name.includes("switch") ||
      name.includes("energy removal") ||
      name.includes("computer search") ||
      extendedData.some(
        (data) =>
          data.name === "CardType" &&
          data.value &&
          (data.value.toLowerCase().includes("trainer") ||
            data.value.toLowerCase().includes("supporter") ||
            data.value.toLowerCase().includes("item") ||
            data.value.toLowerCase().includes("stadium")),
      )
    );
  });

// ── Supabase ──────────────────────────────────────────────────────────────────
export const fetchCardsFromSupabase = async () => {
  let allRows = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("cards")
      .select("card_data, card_type")
      .range(from, from + batchSize - 1);

    if (error) {
      console.error("Supabase fetch error:", error);
      break;
    }

    if (data && data.length > 0) {
      allRows.push(...data);
      from += batchSize;
      if (data.length < batchSize) hasMore = false;
    } else {
      hasMore = false;
    }
  }

  const pokemonCards = allRows.map((row) => row.card_data);
  const trainers = allRows
    .filter((row) => row.card_type === "Trainer")
    .map((row) => row.card_data);

  return { pokemonCards, trainers };
};
