import { useState, useEffect } from "react";
import { getInstantCards } from "../data/csvData";
import { fetchCardsFromSupabase } from "../services/pokemonApi";
import * as wishlistDb from "../database/wishlistDb";
import { cacheService } from "../services/cacheService";

/**
 * Manages Pokemon card data: loading from CSV cache and Supabase,
 * and exposing filtered card sets.
 */
const useCardData = (isAuthenticated) => {
  const { allCards: instantAllCards, trainerCards: instantTrainerCards } =
    getInstantCards();

  const [allPokemonCards, setAllPokemonCards] = useState(instantAllCards);
  const [trainerCards, setTrainerCards] = useState(instantTrainerCards);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    initializeDatabase();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadRealPokemonData();
    }
  }, [isAuthenticated]);

  const initializeDatabase = async () => {
    try {
      await wishlistDb.initDatabase();
    } catch (error) {
      console.log("Database initialization error:", error);
    }
  };

  const loadRealPokemonData = async () => {
    setLoading(true);
    try {
      const { pokemonCards, trainers } = await fetchCardsFromSupabase();
      if (pokemonCards.length > 0) {
        setAllPokemonCards(pokemonCards);
        setTrainerCards(trainers);
      } else {
        console.log("No cards found in Supabase, using local data.");
      }
    } catch (error) {
      console.error("Error loading cards from Supabase:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreCards = async () => {
    // All cards already loaded; this is a placeholder for future pagination
  };

  return {
    allPokemonCards,
    trainerCards,
    loading,
    loadingMore,
    loadRealPokemonData,
    loadMoreCards,
  };
};

export default useCardData;
