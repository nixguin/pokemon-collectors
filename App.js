import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import axios from "axios";
import { cacheService } from "./src/services/cacheService";
import { getInstantCards } from "./src/data/csvData";
import * as wishlistDb from "./src/database/wishlistDb";
import authService from "./src/services/authService";
import LoginScreen from "./src/components/LoginScreen";

const { width } = Dimensions.get("window");
const isMobile = width < 768;

// API functions using TCGdex (more reliable than TCGCSV)
const fetchPokemonSets = async () => {
  try {
    const response = await axios.get("https://api.tcgdex.net/v2/en/sets");
    return response.data;
  } catch (error) {
    console.error("Error fetching Pokemon sets:", error);
    return [];
  }
};

const fetchCardsFromSet = async (setId) => {
  try {
    const response = await axios.get(
      `https://api.tcgdx.net/v2/en/sets/${setId}`
    );
    return response.data.cards || [];
  } catch (error) {
    console.error(`Error fetching cards for set ${setId}:`, error);
    return [];
  }
};

const fetchAllPokemonCards = async (page = 1, pageSize = 250) => {
  try {
    // Fetch all Pokemon cards (not just trainers)
    const response = await axios.get(
      `https://api.pokemontcg.io/v2/cards?page=${page}&pageSize=${pageSize}`
    );
    console.log("Pokemon TCG API response:", response.data);
    return response.data.data || [];
  } catch (error) {
    console.error("Error fetching Pokemon cards from Pokemon TCG API:", error);
    return [];
  }
};

const fetchPokemonTrainerCards = async (page = 1, pageSize = 250) => {
  try {
    // Fetch specifically trainer cards with pagination
    const response = await axios.get(
      `https://api.pokemontcg.io/v2/cards?q=supertype:trainer&page=${page}&pageSize=${pageSize}`
    );
    console.log(`Pokemon Trainer cards page ${page} response:`, response.data);
    return response.data.data || [];
  } catch (error) {
    console.error("Error fetching trainer cards from Pokemon TCG API:", error);
    return [];
  }
};

// TURBO BATCH LOADING: Load multiple pages simultaneously
const fetchCardsBatch = async (pages, pageSize = 250, cardType = "all") => {
  try {
    const promises = pages.map((page) => {
      if (cardType === "trainers") {
        return fetchPokemonTrainerCards(page, pageSize);
      } else {
        return fetchAllPokemonCards(page, pageSize);
      }
    });

    const results = await Promise.allSettled(promises);
    const allCards = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value.length > 0) {
        allCards.push(...result.value);
      }
    });

    console.log(
      `🚀 Batch loaded ${allCards.length} ${cardType} cards from ${pages.length} pages`
    );
    return allCards;
  } catch (error) {
    console.error(`Error in batch loading ${cardType}:`, error);
    return [];
  }
};

// Convert Pokemon TCG API format to our app format
const convertPokemonTCGCard = (card, index = 0) => {
  return {
    productId: `${card.id}-${index}-${Date.now()}`.replace(
      /[^a-zA-Z0-9-]/g,
      ""
    ), // Ensure unique ID
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
  };
};

const filterTrainerCards = (products) => {
  return products.filter((product) => {
    const name = product.name?.toLowerCase() || "";
    const extendedData = product.extendedData || [];

    // Check if it's a trainer card based on name patterns or extended data
    const isTrainer =
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
            data.value.toLowerCase().includes("stadium"))
      );

    return isTrainer;
  });
};

// Rarity hierarchy for advanced filtering
const RARITY_HIERARCHY = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  "Rare Holo": 4,
  "Ultra Rare": 5,
  "Secret Rare": 6,
  "Hyper Rare": 7,
  "Rainbow Rare": 8,
  "Gold Rare": 9,
  "Special Illustration Rare": 10,
  "Illustration Rare": 11,
  VMAX: 12,
  VSTAR: 13,
  "Amazing Rare": 14,
  Shining: 15,
  Crystal: 16,
  "Gold Star": 17,
  Prime: 18,
  Legend: 19,
  BREAK: 20,
  GX: 21,
  "TAG TEAM": 22,
  V: 23,
  VMAX: 24,
  Radiant: 25,
  "Classic Collection": 26,
};

const getRarityValue = (rarity) => {
  return RARITY_HIERARCHY[rarity] || 0;
};

const getAllRarities = () => {
  return Object.keys(RARITY_HIERARCHY).sort(
    (a, b) => getRarityValue(a) - getRarityValue(b)
  );
};

// Demo data
const demoTrainerCards = [
  {
    productId: `demo-1001-${Date.now()}`,
    name: "Professor Oak",
    cleanName: "Professor Oak",
    imageUrl:
      "https://via.placeholder.com/200x280/4f46e5/ffffff?text=Professor+Oak",
    extendedData: [
      { name: "CardType", value: "Trainer - Supporter" },
      { name: "Rarity", value: "Uncommon" },
      { name: "SetName", value: "Base Set" },
      { name: "Number", value: "88" },
    ],
  },
  {
    productId: `demo-1002-${Date.now() + 1}`,
    name: "Bill",
    cleanName: "Bill",
    imageUrl: "https://via.placeholder.com/200x280/059669/ffffff?text=Bill",
    extendedData: [
      { name: "CardType", value: "Trainer - Supporter" },
      { name: "Rarity", value: "Common" },
      { name: "SetName", value: "Base Set" },
      { name: "Number", value: "91" },
    ],
  },
  {
    productId: `demo-1003-${Date.now() + 2}`,
    name: "Potion",
    cleanName: "Potion",
    imageUrl: "https://via.placeholder.com/200x280/dc2626/ffffff?text=Potion",
    extendedData: [
      { name: "CardType", value: "Trainer - Item" },
      { name: "Rarity", value: "Common" },
      { name: "SetName", value: "Base Set" },
      { name: "Number", value: "94" },
    ],
  },
  {
    productId: `demo-1004-${Date.now() + 3}`,
    name: "Switch",
    cleanName: "Switch",
    imageUrl: "https://via.placeholder.com/200x280/7c3aed/ffffff?text=Switch",
    extendedData: [
      { name: "CardType", value: "Trainer - Item" },
      { name: "Rarity", value: "Common" },
      { name: "SetName", value: "Base Set" },
      { name: "Number", value: "95" },
    ],
  },
  {
    productId: 1005,
    name: "Pokemon Center",
    cleanName: "Pokemon Center",
    imageUrl:
      "https://via.placeholder.com/200x280/ea580c/ffffff?text=Pokemon+Center",
    extendedData: [
      { name: "CardType", value: "Trainer - Stadium" },
      { name: "Rarity", value: "Uncommon" },
      { name: "SetName", value: "Base Set" },
      { name: "Number", value: "85" },
    ],
  },
  {
    productId: 1006,
    name: "Energy Removal",
    cleanName: "Energy Removal",
    imageUrl:
      "https://via.placeholder.com/200x280/1d4ed8/ffffff?text=Energy+Removal",
    extendedData: [
      { name: "CardType", value: "Trainer - Item" },
      { name: "Rarity", value: "Common" },
      { name: "SetName", value: "Base Set" },
      { name: "Number", value: "92" },
    ],
  },
];

// Simple Card Component
const TrainerCard = ({
  card,
  isInWishlist,
  onToggleWishlist,
  isAlreadyHave,
  onToggleAlreadyHave,
}) => {
  const cardData =
    card.extendedData?.reduce((acc, data) => {
      acc[data.name] = data.value;
      return acc;
    }, {}) || {};

  // Use group name or set name from extended data
  const setName = cardData.SetName || card.groupName || "Unknown Set";
  const cardType = cardData.CardType || "Trainer";
  const rarity = cardData.Rarity || "Common";
  const cardNumber = cardData.Number || "";
  const price = cardData.Price || "N/A";

  return (
    <View style={styles.card}>
      <Image
        source={{
          uri:
            card.imageUrl ||
            "https://via.placeholder.com/200x280/6b7280/ffffff?text=No+Image",
        }}
        style={styles.cardImage}
        resizeMode="cover"
      />
      <View style={styles.cardContent}>
        <Text style={styles.cardName} numberOfLines={2}>
          {card.name}
        </Text>
        <Text style={styles.cardSet} numberOfLines={1}>
          {setName}
        </Text>
        <Text style={styles.cardPrice} numberOfLines={1}>
          💰 ${price !== "N/A" ? price : "Price TBD"}
        </Text>
        <View style={styles.cardTags}>
          {cardType && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{cardType}</Text>
            </View>
          )}
          {rarity && (
            <View style={[styles.tag, { backgroundColor: "#fef3c7" }]}>
              <Text style={[styles.tagText, { color: "#d97706" }]}>
                {rarity}
              </Text>
            </View>
          )}
          {cardNumber && (
            <View style={[styles.tag, { backgroundColor: "#f3f4f6" }]}>
              <Text style={[styles.tagText, { color: "#374151" }]}>
                #{cardNumber}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={() => onToggleWishlist(card)}
          style={[
            styles.wishlistButton,
            {
              backgroundColor: isInWishlist ? "#f43f5e" : "#f8bbd9",
              marginBottom: 8,
            },
          ]}
        >
          <Text style={styles.buttonText}>
            {isInWishlist ? "❤️ Remove" : "🤍 Add to Wishlist"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onToggleAlreadyHave(card)}
          style={[
            styles.wishlistButton,
            { backgroundColor: isAlreadyHave ? "#10b981" : "#e5e7eb" },
          ]}
        >
          <Text
            style={[
              styles.buttonText,
              { color: isAlreadyHave ? "white" : "#374151" },
            ]}
          >
            {isAlreadyHave ? "✅ Have It" : "📦 Mark as Owned"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function App() {
  // Initialize with instant CSV data
  const { allCards: instantAllCards, trainerCards: instantTrainerCards } =
    getInstantCards();

  const [allPokemonCards, setAllPokemonCards] = useState(instantAllCards);
  const [trainerCards, setTrainerCards] = useState(instantTrainerCards);
  const [filteredCards, setFilteredCards] = useState(instantTrainerCards);
  const [searchQuery, setSearchQuery] = useState("");
  const [wishlist, setWishlist] = useState([]);
  const [alreadyHave, setAlreadyHave] = useState([]);
  const [currentView, setCurrentView] = useState("home"); // 'home', 'trainers', 'wishlist', 'chat'
  const [cardSection, setCardSection] = useState("trainers"); // 'all', 'trainers'
  const [selectedRarity, setSelectedRarity] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("exact"); // "exact", "higher", "lower"
  const [showAdvancedRarity, setShowAdvancedRarity] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // User authentication state
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Chat state - moved to top level
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      text: "Hi! I can help you find Pokemon cards. Ask me about specific cards, rarities (common, rare, ultra rare), types (pokemon, trainer, energy), or sets!",
      isBot: true,
    },
  ]);
  const [chatInput, setChatInput] = useState("");

  // Check authentication on app start
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Load data after authentication
  useEffect(() => {
    if (isAuthenticated) {
      loadRealPokemonData();
      loadUserData();
    }
  }, [isAuthenticated]);

  const checkAuthStatus = async () => {
    try {
      console.log("Checking authentication status...");
      const user = await authService.getCurrentUser();
      console.log("Current user from storage:", user);
      if (user) {
        setCurrentUser(user);
        setIsAuthenticated(true);
        console.log("User is authenticated");
      } else {
        console.log("No user found, showing login screen");
      }
    } catch (error) {
      console.log("Auth check error:", error);
    } finally {
      setAuthLoading(false);
    }
  };

  const loadUserData = async () => {
    try {
      const userWishlist = await authService.getWishlist();
      const userCollection = await authService.getCollection();
      setWishlist(userWishlist);
      setAlreadyHave(userCollection);
    } catch (error) {
      console.log("Error loading user data:", error);
    }
  };

  const handleLoginSuccess = (user) => {
    console.log("Login success, user:", user);
    setCurrentUser(user);
    setIsAuthenticated(true);
    console.log("Authentication state updated");
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      setCurrentUser(null);
      setIsAuthenticated(false);
      setWishlist([]);
      setAlreadyHave([]);
      Alert.alert("Logged Out", "You have been logged out successfully.");
    } catch (error) {
      Alert.alert("Error", "Failed to logout. Please try again.");
    }
  };

  const initializeDatabase = async () => {
    try {
      await wishlistDb.initDatabase();
      const savedWishlist = await wishlistDb.getWishlist();
      if (savedWishlist && savedWishlist.length > 0) {
        setWishlist(savedWishlist);
        console.log(`Loaded ${savedWishlist.length} saved wishlist items`);
      }
    } catch (error) {
      console.log("Database initialization error:", error);
    }
  };

  // Check cache and load API data in background if needed
  const loadCachedData = async () => {
    console.log("Checking for cached data updates...");

    try {
      // Check if we have fresh cached API data
      const isFresh = await cacheService.isCacheFresh();

      if (!isFresh) {
        console.log("Cache is stale, loading fresh API data in background...");
        // Load API data in background to update the instant CSV data
        setTimeout(() => loadRealPokemonData(), 1000);
      } else {
        console.log("Cache is fresh, using instant CSV data!");
      }
    } catch (error) {
      console.error("Error checking cache:", error);
      // Load API data as backup
      setTimeout(() => loadRealPokemonData(), 1000);
    }
  };

  useEffect(() => {
    loadCachedData(); // Load cached data instantly on app start
    initializeDatabase(); // Initialize database and load saved data
    applyFilters();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [
    searchQuery,
    trainerCards,
    allPokemonCards,
    cardSection,
    selectedRarity,
    selectedType,
    rarityFilter,
  ]);

  const loadRealPokemonData = async () => {
    setLoading(true);
    try {
      console.log(
        "🚀 TURBO LOADING: Fetching ALL Pokemon cards in parallel..."
      );

      // SUPER FAST PARALLEL LOADING: Load 20 pages simultaneously
      const BATCH_SIZE = 250;
      const PARALLEL_PAGES = 20;

      console.log("Loading 20 pages in parallel for maximum speed...");

      // Create parallel promises for both Pokemon and Trainer cards
      const allPromises = [];
      for (let page = 1; page <= PARALLEL_PAGES; page++) {
        allPromises.push(
          fetchAllPokemonCards(page, BATCH_SIZE).then((cards) => ({
            type: "pokemon",
            page,
            cards,
          }))
        );
        allPromises.push(
          fetchPokemonTrainerCards(page, BATCH_SIZE).then((cards) => ({
            type: "trainer",
            page,
            cards,
          }))
        );
      }

      // Wait for ALL parallel requests to complete
      const results = await Promise.allSettled(allPromises);

      let totalPokemonCards = [];
      let totalTrainerCards = [];

      // Process all results
      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value.cards?.length > 0) {
          const { type, cards, page } = result.value;
          const convertedCards = cards.map((card, cardIndex) =>
            convertPokemonTCGCard(card, cardIndex + index * 1000)
          );

          if (type === "trainer") {
            totalTrainerCards.push(...convertedCards);
          } else {
            totalPokemonCards.push(...convertedCards);
          }

          console.log(`📦 ${type} page ${page} loaded:`, convertedCards.length);
        }
      });

      // Update state with ALL cards at once (much faster than incremental updates)
      if (totalPokemonCards.length > 0) {
        setAllPokemonCards((prev) => {
          const existingIds = new Set(prev.map((c) => c.productId));
          const newCards = totalPokemonCards.filter(
            (c) => !existingIds.has(c.productId)
          );
          const updated = [...prev, ...newCards];
          cacheService.saveAllPokemonCards(updated); // Save immediately
          return updated;
        });
        console.log(
          `🎯 TOTAL Pokemon cards loaded: ${totalPokemonCards.length}`
        );
      }

      if (totalTrainerCards.length > 0) {
        setTrainerCards((prev) => {
          const existingIds = new Set(prev.map((c) => c.productId));
          const newCards = totalTrainerCards.filter(
            (c) => !existingIds.has(c.productId)
          );
          const updated = [...prev, ...newCards];
          cacheService.saveTrainerCards(updated); // Save immediately
          return updated;
        });
        console.log(
          `🎯 TOTAL Trainer cards loaded: ${totalTrainerCards.length}`
        );
      }

      // Continue loading more pages in background for completeness
      console.log("Loading additional pages in background...");
      for (let page = PARALLEL_PAGES + 1; page <= 100; page += 5) {
        setTimeout(() => {
          const backgroundPromises = [];
          for (let p = page; p < page + 5 && p <= 100; p++) {
            backgroundPromises.push(fetchAllPokemonCards(p, BATCH_SIZE));
            backgroundPromises.push(fetchPokemonTrainerCards(p, BATCH_SIZE));
          }

          Promise.allSettled(backgroundPromises).then((bgResults) => {
            let bgPokemon = [];
            let bgTrainers = [];

            bgResults.forEach((result, idx) => {
              if (result.status === "fulfilled" && result.value?.length > 0) {
                const isTrainer = idx % 2 === 1;
                const converted = result.value.map((card, cardIndex) =>
                  convertPokemonTCGCard(
                    card,
                    cardIndex + page * 5000 + idx * 100
                  )
                );

                if (isTrainer) {
                  bgTrainers.push(...converted);
                } else {
                  bgPokemon.push(...converted);
                }
              }
            });

            if (bgPokemon.length > 0) {
              setAllPokemonCards((prev) => {
                const existingIds = new Set(prev.map((c) => c.productId));
                const newCards = bgPokemon.filter(
                  (c) => !existingIds.has(c.productId)
                );
                return [...prev, ...newCards];
              });
            }

            if (bgTrainers.length > 0) {
              setTrainerCards((prev) => {
                const existingIds = new Set(prev.map((c) => c.productId));
                const newCards = bgTrainers.filter(
                  (c) => !existingIds.has(c.productId)
                );
                return [...prev, ...newCards];
              });
            }
          });
        }, (page - PARALLEL_PAGES) * 200); // Stagger background loading
      }
    } catch (error) {
      console.error("Error in turbo loading:", error);
      Alert.alert(
        "Loading Error",
        "Some cards may not have loaded. Try refreshing!"
      );
    } finally {
      setLoading(false);
    }
  };

  // Load more cards on demand
  const loadMoreCards = async () => {
    if (loadingMore) return;

    setLoadingMore(true);
    try {
      const currentPage = Math.floor(allPokemonCards.length / 250) + 1;
      console.log(`Loading more cards - page ${currentPage}...`);

      const moreCards = await fetchAllPokemonCards(currentPage, 250);
      if (moreCards.length > 0) {
        const convertedCards = moreCards.map((card, index) =>
          convertPokemonTCGCard(card, index + currentPage * 3000)
        );
        setAllPokemonCards((prev) => [...prev, ...convertedCards]);
        console.log(`Loaded ${convertedCards.length} more cards`);
      } else {
        Alert.alert("No More Cards", "All available cards have been loaded.");
      }
    } catch (error) {
      console.error("Error loading more cards:", error);
      Alert.alert("Error", "Failed to load more cards.");
    }
    setLoadingMore(false);
  };

  const applyFilters = () => {
    // Choose which card set to filter based on current section
    let cardsToFilter = cardSection === "all" ? allPokemonCards : trainerCards;
    let filtered = [...cardsToFilter];

    // Apply search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (card) =>
          card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          card.cleanName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply rarity filter with advanced options
    if (selectedRarity !== "all") {
      filtered = filtered.filter((card) => {
        const cardData =
          card.extendedData?.find((data) => data.name === "Rarity")?.value ||
          "";
        const cardRarityValue = getRarityValue(cardData);
        const selectedRarityValue = getRarityValue(selectedRarity);

        if (rarityFilter === "exact") {
          return cardData.toLowerCase().includes(selectedRarity.toLowerCase());
        } else if (rarityFilter === "higher") {
          return cardRarityValue >= selectedRarityValue;
        } else if (rarityFilter === "lower") {
          return cardRarityValue <= selectedRarityValue;
        }
        return true;
      });
    }

    // Apply type filter
    if (selectedType !== "all") {
      filtered = filtered.filter((card) => {
        const cardData =
          card.extendedData?.find((data) => data.name === "CardType")?.value ||
          "";
        return cardData.toLowerCase().includes(selectedType.toLowerCase());
      });
    }

    setFilteredCards(filtered);
  };

  const toggleWishlist = async (card) => {
    const isInWishlist = wishlist.some((w) => w.productId === card.productId);
    try {
      if (isInWishlist) {
        const newWishlist = wishlist.filter(
          (w) => w.productId !== card.productId
        );
        setWishlist(newWishlist);
        await authService.saveWishlist(newWishlist);
        Alert.alert("Removed", `${card.name} removed from wishlist`);
      } else {
        const newWishlist = [...wishlist, card];
        setWishlist(newWishlist);
        await authService.saveWishlist(newWishlist);
        Alert.alert("Added", `${card.name} added to wishlist`);
      }
    } catch (error) {
      console.log("Error updating wishlist:", error);
      Alert.alert("Error", "Failed to update wishlist");
    }
  };

  const toggleAlreadyHave = async (card) => {
    const isAlreadyHave = alreadyHave.some(
      (a) => a.productId === card.productId
    );
    try {
      if (isAlreadyHave) {
        const newCollection = alreadyHave.filter(
          (a) => a.productId !== card.productId
        );
        setAlreadyHave(newCollection);
        await authService.saveCollection(newCollection);
        Alert.alert("Removed", `${card.name} removed from collection`);
      } else {
        const newCollection = [...alreadyHave, card];
        setAlreadyHave(newCollection);
        await authService.saveCollection(newCollection);
        Alert.alert("Added", `${card.name} added to collection`);
      }
    } catch (error) {
      console.log("Error updating collection:", error);
      Alert.alert("Error", "Failed to update collection");
    }
  };

  const isInWishlist = (card) =>
    wishlist.some((w) => w.productId === card.productId);

  const isAlreadyHave = (card) =>
    alreadyHave.some((a) => a.productId === card.productId);

  const renderCard = ({ item }) => (
    <TrainerCard
      card={item}
      isInWishlist={isInWishlist(item)}
      onToggleWishlist={toggleWishlist}
      isAlreadyHave={isAlreadyHave(item)}
      onToggleAlreadyHave={toggleAlreadyHave}
    />
  );

  const renderChatMessage = ({ item }) => (
    <View
      style={[
        styles.chatMessage,
        item.isBot ? styles.botMessage : styles.userMessage,
      ]}
    >
      <Text style={item.isBot ? styles.botText : styles.userText}>
        {item.text}
      </Text>
      {item.cards && item.cards.length > 0 && (
        <View style={styles.chatCardsContainer}>
          {item.cards.map((card, index) => (
            <View key={index} style={styles.chatCard}>
              <Image
                source={{ uri: card.imageUrl }}
                style={styles.chatCardImage}
              />
              <Text style={styles.chatCardName} numberOfLines={2}>
                {card.name}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  if (currentView === "wishlist") {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentView("home")}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            My Wishlist ({wishlist.length})
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              onPress={() => setCurrentView("chat")}
              style={styles.headerButton}
            >
              <Text style={styles.headerButtonText}>💬 Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                try {
                  await wishlistDb.clearWishlist();
                  await Promise.all(
                    wishlist.map((card) => wishlistDb.addToWishlist(card))
                  );
                  Alert.alert("Saved!", "Wishlist saved to database");
                } catch (error) {
                  Alert.alert("Error", "Failed to save wishlist");
                }
              }}
              style={styles.headerButton}
            >
              <Text style={styles.headerButtonText}>💾 Save</Text>
            </TouchableOpacity>
          </View>
        </View>

        {wishlist.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
            <Text style={styles.emptyText}>
              Start adding trainer cards to see them here!
            </Text>
          </View>
        ) : (
          <FlatList
            data={wishlist}
            renderItem={({ item }) => (
              <View
                style={isAlreadyHave(item) ? styles.ownedCardContainer : null}
              >
                <TrainerCard
                  card={item}
                  isInWishlist={true}
                  onToggleWishlist={toggleWishlist}
                  isAlreadyHave={isAlreadyHave(item)}
                  onToggleAlreadyHave={toggleAlreadyHave}
                />
                {isAlreadyHave(item) && (
                  <View style={styles.ownedBadge}>
                    <Text style={styles.ownedBadgeText}>✅ OWNED</Text>
                  </View>
                )}
              </View>
            )}
            keyExtractor={(item, index) =>
              `wishlist-${item.productId}-${index}`
            }
            numColumns={isMobile ? 2 : 3}
            contentContainerStyle={{ padding: 8 }}
          />
        )}
      </View>
    );
  }

  if (currentView === "collection") {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentView("home")}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            My Collection ({alreadyHave.length})
          </Text>
          <TouchableOpacity onPress={() => setCurrentView("chat")}>
            <Text style={styles.chatButton}>💬</Text>
          </TouchableOpacity>
        </View>

        {alreadyHave.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Your collection is empty</Text>
            <Text style={styles.emptyText}>
              Start marking cards as owned to see them here!
            </Text>
          </View>
        ) : (
          <FlatList
            data={alreadyHave}
            renderItem={({ item }) => (
              <TrainerCard
                card={item}
                isInWishlist={isInWishlist(item)}
                onToggleWishlist={toggleWishlist}
                isAlreadyHave={true}
                onToggleAlreadyHave={toggleAlreadyHave}
              />
            )}
            keyExtractor={(item, index) =>
              `collection-${item.productId}-${index}`
            }
            numColumns={isMobile ? 2 : 3}
            contentContainerStyle={{ padding: 8 }}
          />
        )}
      </View>
    );
  }

  // Chat message sending function
  const sendMessage = () => {
    if (!chatInput.trim()) return;

    const userMessage = { id: Date.now(), text: chatInput, isBot: false };

    // Simple AI logic to help find cards
    const query = chatInput.toLowerCase();
    let botResponse = "";
    let foundCards = [];

    // Search through current cards
    const cardsToSearch =
      cardSection === "all" ? allPokemonCards : trainerCards;

    if (query.includes("rare") || query.includes("rarity")) {
      if (query.includes("common")) {
        foundCards = cardsToSearch.filter((card) =>
          card.extendedData
            ?.find((data) => data.name === "Rarity")
            ?.value?.toLowerCase()
            .includes("common")
        );
        botResponse = `Found ${foundCards.length} common cards! Common cards are the most basic rarity.`;
      } else if (query.includes("uncommon")) {
        foundCards = cardsToSearch.filter((card) =>
          card.extendedData
            ?.find((data) => data.name === "Rarity")
            ?.value?.toLowerCase()
            .includes("uncommon")
        );
        botResponse = `Found ${foundCards.length} uncommon cards! These are slightly rarer than common cards.`;
      } else if (query.includes("ultra rare") || query.includes("ultra")) {
        foundCards = cardsToSearch.filter((card) =>
          card.extendedData
            ?.find((data) => data.name === "Rarity")
            ?.value?.toLowerCase()
            .includes("ultra")
        );
        botResponse = `Found ${foundCards.length} ultra rare cards! These are very special and valuable cards.`;
      } else if (
        query.includes("higher than") ||
        query.includes("above") ||
        query.includes("better than")
      ) {
        // Extract rarity from query
        const rarityMatch = query.match(
          /(higher than|above|better than)\s+(\w+\s*\w*)/
        );
        if (rarityMatch) {
          const targetRarity = rarityMatch[2].trim();
          const targetValue = getRarityValue(targetRarity);
          foundCards = cardsToSearch.filter((card) => {
            const cardRarity =
              card.extendedData?.find((data) => data.name === "Rarity")
                ?.value || "";
            return getRarityValue(cardRarity) > targetValue;
          });
          botResponse = `Found ${foundCards.length} cards with rarity higher than ${targetRarity}! These include the most valuable cards.`;
        }
      } else if (
        query.includes("lower than") ||
        query.includes("below") ||
        query.includes("worse than")
      ) {
        // Extract rarity from query
        const rarityMatch = query.match(
          /(lower than|below|worse than)\s+(\w+\s*\w*)/
        );
        if (rarityMatch) {
          const targetRarity = rarityMatch[2].trim();
          const targetValue = getRarityValue(targetRarity);
          foundCards = cardsToSearch.filter((card) => {
            const cardRarity =
              card.extendedData?.find((data) => data.name === "Rarity")
                ?.value || "";
            return getRarityValue(cardRarity) < targetValue;
          });
          botResponse = `Found ${foundCards.length} cards with rarity lower than ${targetRarity}.`;
        }
      } else {
        foundCards = cardsToSearch.filter((card) =>
          card.extendedData
            ?.find((data) => data.name === "Rarity")
            ?.value?.toLowerCase()
            .includes("rare")
        );
        botResponse = `Found ${foundCards.length} rare cards! These include regular rare and ultra rare cards.`;
      }
    } else if (query.includes("mimikyu")) {
      foundCards = cardsToSearch.filter((card) =>
        card.name.toLowerCase().includes("mimikyu")
      );

      if (foundCards.length === 0) {
        botResponse =
          "I couldn't find any Mimikyu cards in the current data. Try using the Turbo Load button to load more cards!";
      } else {
        botResponse = `Found ${foundCards.length} Mimikyu cards! Mimikyu is such a beloved Pokemon! 👻`;
      }
    } else if (
      query.includes("trainer") ||
      query.includes("supporter") ||
      query.includes("item") ||
      query.includes("stadium")
    ) {
      foundCards = cardsToSearch.filter((card) => {
        const cardType =
          card.extendedData
            ?.find((data) => data.name === "CardType")
            ?.value?.toLowerCase() || "";
        return (
          cardType.includes("trainer") ||
          cardType.includes("supporter") ||
          cardType.includes("item") ||
          cardType.includes("stadium")
        );
      });
      botResponse = `Found ${foundCards.length} trainer cards! These include supporters, items, stadiums, and tools.`;
    } else if (query.includes("pokemon")) {
      foundCards = cardsToSearch.filter((card) => {
        const cardType =
          card.extendedData
            ?.find((data) => data.name === "CardType")
            ?.value?.toLowerCase() || "";
        return (
          cardType.includes("pokemon") ||
          (!cardType.includes("trainer") && !cardType.includes("energy"))
        );
      });
      botResponse = `Found ${foundCards.length} Pokemon cards! These are the creature cards you use to battle.`;
    } else if (query.includes("energy")) {
      foundCards = cardsToSearch.filter((card) => {
        const cardType =
          card.extendedData
            ?.find((data) => data.name === "CardType")
            ?.value?.toLowerCase() || "";
        return cardType.includes("energy");
      });
      botResponse = `Found ${foundCards.length} energy cards! These power your Pokemon's attacks.`;
    } else {
      // Search by name
      foundCards = cardsToSearch.filter(
        (card) =>
          card.name.toLowerCase().includes(query) ||
          card.cleanName.toLowerCase().includes(query)
      );
      botResponse =
        foundCards.length > 0
          ? `Found ${
              foundCards.length
            } cards matching "${chatInput}"! ${foundCards
              .slice(0, 3)
              .map((c) => c.name)
              .join(", ")}${foundCards.length > 3 ? "..." : ""}`
          : `No cards found matching "${chatInput}". Try searching for card names, rarities (common, rare, ultra rare), or types (pokemon, trainer, energy).`;
    }

    const botMessage = {
      id: Date.now() + 1,
      text: botResponse,
      isBot: true,
      cards: foundCards.slice(0, 6), // Show first 6 matching cards
    };

    setChatMessages([...chatMessages, userMessage, botMessage]);
    setChatInput("");
  };

  if (currentView === "chat") {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentView("home")}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Assistant</Text>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={chatMessages}
          renderItem={renderChatMessage}
          keyExtractor={(item) => item.id.toString()}
          style={styles.chatContainer}
        />

        <View style={styles.chatInputContainer}>
          <TextInput
            value={chatInput}
            onChangeText={setChatInput}
            placeholder="Ask about trainer cards..."
            style={styles.chatInput}
          />
          <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color="#f8bbd9" />
        <Text style={[styles.loadingStatus, { marginTop: 16 }]}>
          🌸 Loading your Pokemon collection...
        </Text>
      </View>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {cardSection === "all" ? "All Pokemon Cards" : "Trainer Cards"}
          </Text>
          <Text style={styles.cacheStatus}>📊 Local Data Loaded</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={loadRealPokemonData}
            style={[
              styles.headerButton,
              {
                backgroundColor: loading
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(255,255,255,0.2)",
              },
            ]}
            disabled={loading}
          >
            <Text style={styles.headerButtonText}>
              {loading ? "🔄 Loading..." : "🔄 Refresh"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={async () => {
              setLoading(true);
              try {
                console.log("🚀 TURBO LOADING ALL CARDS...");

                // Load 20 pages of each type in parallel
                const [pokemonBatch, trainerBatch] = await Promise.all([
                  fetchCardsBatch(
                    [
                      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
                      18, 19, 20,
                    ],
                    250,
                    "all"
                  ),
                  fetchCardsBatch(
                    [
                      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
                      18, 19, 20,
                    ],
                    250,
                    "trainers"
                  ),
                ]);

                // Convert and add all cards
                if (pokemonBatch.length > 0) {
                  const convertedPokemon = pokemonBatch.map((card, index) =>
                    convertPokemonTCGCard(card, index + 70000)
                  );
                  setAllPokemonCards((prev) => {
                    const existingIds = new Set(prev.map((c) => c.productId));
                    const newCards = convertedPokemon.filter(
                      (c) => !existingIds.has(c.productId)
                    );
                    return [...prev, ...newCards];
                  });
                }

                if (trainerBatch.length > 0) {
                  const convertedTrainers = trainerBatch.map((card, index) =>
                    convertPokemonTCGCard(card, index + 80000)
                  );
                  setTrainerCards((prev) => {
                    const existingIds = new Set(prev.map((c) => c.productId));
                    const newCards = convertedTrainers.filter(
                      (c) => !existingIds.has(c.productId)
                    );
                    return [...prev, ...newCards];
                  });
                }

                Alert.alert(
                  "Success!",
                  `🚀 Turbo loaded ${pokemonBatch.length} Pokemon + ${trainerBatch.length} Trainer cards!`
                );
              } catch (error) {
                Alert.alert("Error", "Turbo loading failed");
              } finally {
                setLoading(false);
              }
            }}
            style={styles.headerButton}
          >
            <Text style={styles.headerButtonText}>🚀 Turbo Load</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setCurrentView("wishlist")}
            style={styles.headerButton}
          >
            <Text style={styles.headerButtonText}>
              ❤️ Wishlist ({wishlist.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setCurrentView("collection")}
            style={styles.headerButton}
          >
            <Text style={styles.headerButtonText}>
              📦 Collection ({alreadyHave.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setCurrentView("chat")}
            style={styles.headerButton}
          >
            <Text style={styles.headerButtonText}>💬 AI Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleLogout}
            style={[
              styles.headerButton,
              { backgroundColor: "rgba(255,255,255,0.15)" },
            ]}
          >
            <Text style={styles.headerButtonText}>👋 Logout</Text>
          </TouchableOpacity>
        </View>

        {/* User Info */}
        {currentUser && (
          <View style={styles.userInfo}>
            <Text style={styles.userInfoText}>
              👤 Welcome, {currentUser.username}!
            </Text>
          </View>
        )}
      </View>

      {/* Section Switcher */}
      <View style={styles.sectionSwitcher}>
        <TouchableOpacity
          onPress={() => setCardSection("trainers")}
          style={[
            styles.sectionButton,
            {
              backgroundColor:
                cardSection === "trainers" ? "#f8bbd9" : "#f9fafb",
            },
          ]}
        >
          <Text
            style={[
              styles.sectionButtonText,
              { color: cardSection === "trainers" ? "white" : "#6b7280" },
            ]}
          >
            🎯 Trainer Cards ({trainerCards.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setCardSection("all")}
          style={[
            styles.sectionButton,
            { backgroundColor: cardSection === "all" ? "#f8bbd9" : "#f9fafb" },
          ]}
        >
          <Text
            style={[
              styles.sectionButtonText,
              { color: cardSection === "all" ? "white" : "#6b7280" },
            ]}
          >
            🃏 All Pokemon Cards ({allPokemonCards.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={`Search ${
            cardSection === "all" ? "Pokemon" : "trainer"
          } cards...`}
          style={styles.searchInput}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Text style={styles.clearButton}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <Text style={styles.filterLabel}>Rarity:</Text>
        <TouchableOpacity
          onPress={() =>
            setSelectedRarity(
              selectedRarity === "all"
                ? "rare"
                : selectedRarity === "rare"
                ? "ultra rare"
                : selectedRarity === "ultra rare"
                ? "secret rare"
                : selectedRarity === "secret rare"
                ? "hyper rare"
                : selectedRarity === "hyper rare"
                ? "rainbow rare"
                : selectedRarity === "rainbow rare"
                ? "gold rare"
                : "all"
            )
          }
          style={[
            styles.filterButton,
            {
              backgroundColor: selectedRarity !== "all" ? "#f8bbd9" : "#f9fafb",
            },
          ]}
        >
          <Text
            style={[
              styles.filterButtonText,
              { color: selectedRarity !== "all" ? "white" : "#6b7280" },
            ]}
          >
            {selectedRarity === "all"
              ? "All Rarities"
              : selectedRarity.charAt(0).toUpperCase() +
                selectedRarity.slice(1)}
          </Text>
        </TouchableOpacity>

        {selectedRarity !== "all" && (
          <>
            <TouchableOpacity
              onPress={() => setShowAdvancedRarity(!showAdvancedRarity)}
              style={[
                styles.filterButton,
                { backgroundColor: showAdvancedRarity ? "#f8bbd9" : "#f0f0f0" },
              ]}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  { color: showAdvancedRarity ? "white" : "#6b7280" },
                ]}
              >
                ⚙️ Advanced
              </Text>
            </TouchableOpacity>

            {showAdvancedRarity && (
              <>
                <TouchableOpacity
                  onPress={() => setRarityFilter("exact")}
                  style={[
                    styles.filterButton,
                    {
                      backgroundColor:
                        rarityFilter === "exact" ? "#f8bbd9" : "#f0f0f0",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      { color: rarityFilter === "exact" ? "white" : "#6b7280" },
                    ]}
                  >
                    = Exact
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setRarityFilter("higher")}
                  style={[
                    styles.filterButton,
                    {
                      backgroundColor:
                        rarityFilter === "higher" ? "#f8bbd9" : "#f0f0f0",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      {
                        color: rarityFilter === "higher" ? "white" : "#6b7280",
                      },
                    ]}
                  >
                    ≥ Higher
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setRarityFilter("lower")}
                  style={[
                    styles.filterButton,
                    {
                      backgroundColor:
                        rarityFilter === "lower" ? "#f8bbd9" : "#f0f0f0",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      { color: rarityFilter === "lower" ? "white" : "#6b7280" },
                    ]}
                  >
                    ≤ Lower
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        <Text style={styles.filterLabel}>Type:</Text>
        <TouchableOpacity
          onPress={() =>
            setSelectedType(
              selectedType === "all"
                ? "pokemon"
                : selectedType === "pokemon"
                ? "trainer"
                : selectedType === "trainer"
                ? "energy"
                : "all"
            )
          }
          style={[
            styles.filterButton,
            { backgroundColor: selectedType !== "all" ? "#f8bbd9" : "#f9fafb" },
          ]}
        >
          <Text
            style={[
              styles.filterButtonText,
              { color: selectedType !== "all" ? "white" : "#6b7280" },
            ]}
          >
            {selectedType === "all"
              ? "All Types"
              : selectedType.charAt(0).toUpperCase() + selectedType.slice(1)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setSelectedRarity("all");
            setSelectedType("all");
            setSearchQuery("");
            setRarityFilter("exact");
            setShowAdvancedRarity(false);
          }}
          style={[styles.filterButton, { backgroundColor: "#f8bbd9" }]}
        >
          <Text style={[styles.filterButtonText, { color: "white" }]}>
            Clear Filters
          </Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {loading
            ? "Loading..."
            : `${filteredCards.length} ${
                cardSection === "all" ? "Pokemon" : "trainer"
              } cards found`}
        </Text>
        {(selectedRarity !== "all" || selectedType !== "all") && (
          <Text style={styles.filterIndicator}>
            Filtered by:{" "}
            {selectedRarity !== "all" &&
              (rarityFilter === "exact"
                ? selectedRarity
                : rarityFilter === "higher"
                ? `≥ ${selectedRarity}`
                : `≤ ${selectedRarity}`)}{" "}
            {selectedType !== "all" && selectedType}
          </Text>
        )}
        {cardSection === "trainers" && loading && (
          <Text style={styles.loadingStatus}>📥 Loading trainer cards...</Text>
        )}
        {loading && (
          <View style={styles.loadingIndicator}>
            <ActivityIndicator size="small" color="#f8bbd9" />
            <Text style={styles.loadingText}>
              Loading real data from TCGCSV...
            </Text>
          </View>
        )}
      </View>

      {/* Card Grid */}
      <FlatList
        data={filteredCards}
        renderItem={renderCard}
        keyExtractor={(item, index) =>
          `${item.productId}-${index}-${cardSection}`
        }
        numColumns={isMobile ? 2 : 3}
        key={`${cardSection}-${filteredCards.length}`}
        contentContainerStyle={{
          padding: 16,
          alignItems: "stretch",
          justifyContent: "center",
        }}
        columnWrapperStyle={{
          justifyContent: "space-evenly",
          marginBottom: 16,
        }}
        onEndReached={() => {
          if (
            cardSection === "all" &&
            !loadingMore &&
            allPokemonCards.length > 0
          ) {
            loadMoreCards();
          }
        }}
        onEndReachedThreshold={0.3}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
        ListFooterComponent={
          loadingMore && (
            <View style={styles.autoLoadingContainer}>
              <ActivityIndicator size="small" color="#f8bbd9" />
              <Text style={styles.autoLoadingText}>Loading more cards...</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fef7f7",
  },
  header: {
    backgroundColor: "#f8bbd9",
    paddingTop: isMobile ? 40 : 50,
    paddingHorizontal: isMobile ? 12 : 20,
    paddingBottom: isMobile ? 16 : 20,
    flexDirection: isMobile ? "column" : "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  cacheStatus: {
    fontSize: 12,
    color: "#fde68a",
    fontWeight: "600",
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: isMobile ? "column" : "row",
    marginTop: isMobile ? 12 : 0,
    alignItems: "center",
  },
  headerButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: isMobile ? 10 : 12,
    paddingVertical: isMobile ? 8 : 6,
    borderRadius: 15,
    marginLeft: isMobile ? 0 : 8,
    marginTop: isMobile ? 4 : 0,
    minWidth: isMobile ? 120 : "auto",
    alignItems: "center",
  },
  headerButtonText: {
    color: "white",
    fontSize: isMobile ? 10 : 12,
    fontWeight: "600",
  },
  userInfo: {
    alignItems: "center",
    marginTop: 8,
  },
  userInfoText: {
    color: "white",
    fontSize: isMobile ? 12 : 14,
    fontWeight: "500",
    opacity: 0.9,
  },
  backButton: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  chatButton: {
    color: "white",
    fontSize: 20,
  },
  searchContainer: {
    backgroundColor: "white",
    margin: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#f8bbd9",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 2,
    borderColor: "#f4c2c2",
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1f2937",
  },
  clearButton: {
    color: "#6b7280",
    fontSize: 18,
    fontWeight: "bold",
  },
  resultsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "white",
  },
  resultsText: {
    color: "#6b7280",
    fontSize: 14,
    marginBottom: 4,
  },
  filterIndicator: {
    fontSize: 12,
    color: "#f8bbd9",
    fontStyle: "italic",
  },
  loadingStatus: {
    fontSize: 11,
    color: "#f8bbd9",
    fontStyle: "italic",
    marginTop: 4,
  },
  loadingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  loadingText: {
    color: "#3b82f6",
    fontSize: 12,
    marginLeft: 8,
  },
  sectionSwitcher: {
    backgroundColor: "white",
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#f4c2c2",
  },
  sectionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: "center",
  },
  sectionButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  filtersContainer: {
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#f4c2c2",
    flexWrap: "wrap",
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginRight: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginVertical: 2,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  loadMoreContainer: {
    padding: 16,
    alignItems: "center",
  },
  loadMoreButton: {
    backgroundColor: "#f8bbd9",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  loadMoreText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  autoLoadingContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  autoLoadingText: {
    marginLeft: 8,
    color: "#6b7280",
    fontSize: 14,
  },
  chatCardsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  chatCard: {
    width: 80,
    marginRight: 8,
    marginBottom: 8,
  },
  chatCardImage: {
    width: 80,
    height: 112,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  chatCardName: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 4,
    color: "#374151",
  },
  card: {
    backgroundColor: "white",
    margin: isMobile ? 4 : 8,
    borderRadius: 16,
    padding: isMobile ? 12 : 16,
    flex: 1,
    shadowColor: "#f8bbd9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    minHeight: isMobile ? 320 : 380,
    maxWidth: isMobile ? width / 2 - 16 : 180,
    borderWidth: 2,
    borderColor: "#f4c2c2",
  },
  cardImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
    resizeMode: "contain",
    backgroundColor: "#f8fafc",
  },
  cardContent: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 6,
    textAlign: "center",
    lineHeight: 20,
  },
  cardSet: {
    fontSize: 12,
    color: "#2563eb",
    marginBottom: 4,
    textAlign: "center",
  },
  cardPrice: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#059669",
    marginBottom: 8,
    textAlign: "center",
  },
  cardTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 12,
  },
  tag: {
    backgroundColor: "#f3e8ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 2,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 11,
    color: "#7c3aed",
    fontWeight: "600",
    textAlign: "center",
  },
  wishlistButton: {
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#6b7280",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
  chatContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  chatMessage: {
    marginVertical: 4,
    padding: 12,
    borderRadius: 12,
    maxWidth: "80%",
  },
  botMessage: {
    backgroundColor: "#f3f4f6",
    alignSelf: "flex-start",
  },
  userMessage: {
    backgroundColor: "#f8bbd9",
    alignSelf: "flex-end",
  },
  botText: {
    color: "#1f2937",
  },
  userText: {
    color: "white",
  },
  chatInputContainer: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: "#f8bbd9",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    justifyContent: "center",
  },
  sendButtonText: {
    color: "white",
    fontWeight: "600",
  },
  ownedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#10b981",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  ownedBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  ownedCardContainer: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
