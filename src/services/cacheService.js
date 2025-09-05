import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEYS = {
  TRAINER_CARDS: "trainer_cards_cache",
  ALL_POKEMON_CARDS: "all_pokemon_cards_cache",
  CACHE_TIMESTAMP: "cache_timestamp",
};

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export const cacheService = {
  // Save trainer cards to cache
  async saveTrainerCards(cards) {
    try {
      await AsyncStorage.setItem(
        CACHE_KEYS.TRAINER_CARDS,
        JSON.stringify(cards)
      );
      await AsyncStorage.setItem(
        CACHE_KEYS.CACHE_TIMESTAMP,
        Date.now().toString()
      );
      console.log(`Cached ${cards.length} trainer cards`);
    } catch (error) {
      console.error("Error saving trainer cards to cache:", error);
    }
  },

  // Save all Pokemon cards to cache
  async saveAllPokemonCards(cards) {
    try {
      await AsyncStorage.setItem(
        CACHE_KEYS.ALL_POKEMON_CARDS,
        JSON.stringify(cards)
      );
      console.log(`Cached ${cards.length} Pokemon cards`);
    } catch (error) {
      console.error("Error saving Pokemon cards to cache:", error);
    }
  },

  // Get trainer cards from cache
  async getTrainerCards() {
    try {
      const cachedCards = await AsyncStorage.getItem(CACHE_KEYS.TRAINER_CARDS);
      if (cachedCards) {
        const cards = JSON.parse(cachedCards);
        console.log(`Loaded ${cards.length} trainer cards from cache`);
        return cards;
      }
      return null;
    } catch (error) {
      console.error("Error loading trainer cards from cache:", error);
      return null;
    }
  },

  // Get all Pokemon cards from cache
  async getAllPokemonCards() {
    try {
      const cachedCards = await AsyncStorage.getItem(
        CACHE_KEYS.ALL_POKEMON_CARDS
      );
      if (cachedCards) {
        const cards = JSON.parse(cachedCards);
        console.log(`Loaded ${cards.length} Pokemon cards from cache`);
        return cards;
      }
      return null;
    } catch (error) {
      console.error("Error loading Pokemon cards from cache:", error);
      return null;
    }
  },

  // Check if cache is fresh (less than 24 hours old)
  async isCacheFresh() {
    try {
      const timestamp = await AsyncStorage.getItem(CACHE_KEYS.CACHE_TIMESTAMP);
      if (timestamp) {
        const cacheAge = Date.now() - parseInt(timestamp);
        const isFresh = cacheAge < CACHE_DURATION;
        console.log(
          `Cache age: ${Math.round(
            cacheAge / (60 * 60 * 1000)
          )} hours, fresh: ${isFresh}`
        );
        return isFresh;
      }
      return false;
    } catch (error) {
      console.error("Error checking cache freshness:", error);
      return false;
    }
  },

  // Clear all cached data
  async clearCache() {
    try {
      await AsyncStorage.multiRemove([
        CACHE_KEYS.TRAINER_CARDS,
        CACHE_KEYS.ALL_POKEMON_CARDS,
        CACHE_KEYS.CACHE_TIMESTAMP,
      ]);
      console.log("Cache cleared");
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  },

  // Get cache info for debugging
  async getCacheInfo() {
    try {
      const [trainerCards, allCards, timestamp] = await AsyncStorage.multiGet([
        CACHE_KEYS.TRAINER_CARDS,
        CACHE_KEYS.ALL_POKEMON_CARDS,
        CACHE_KEYS.CACHE_TIMESTAMP,
      ]);

      return {
        trainerCardsCount: trainerCards[1]
          ? JSON.parse(trainerCards[1]).length
          : 0,
        allCardsCount: allCards[1] ? JSON.parse(allCards[1]).length : 0,
        lastUpdated: timestamp[1] ? new Date(parseInt(timestamp[1])) : null,
        isFresh: await this.isCacheFresh(),
      };
    } catch (error) {
      console.error("Error getting cache info:", error);
      return null;
    }
  },
};
