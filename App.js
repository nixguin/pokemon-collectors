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
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import axios from "axios";
import { cacheService } from "./src/services/cacheService";
import { getInstantCards } from "./src/data/csvData";
import * as wishlistDb from "./src/database/wishlistDb";
import authService from "./src/services/authService";
import { supabase } from "./src/services/supabaseClient";
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
      `https://api.tcgdex.net/v2/en/sets/${setId}`,
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
      `https://api.pokemontcg.io/v2/cards?page=${page}&pageSize=${pageSize}`,
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
      `https://api.pokemontcg.io/v2/cards?q=supertype:trainer&page=${page}&pageSize=${pageSize}`,
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
      `🚀 Batch loaded ${allCards.length} ${cardType} cards from ${pages.length} pages`,
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
      "",
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
            data.value.toLowerCase().includes("stadium")),
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
  Radiant: 24,
  "Classic Collection": 25,
};

const getRarityValue = (rarity) => {
  return RARITY_HIERARCHY[rarity] || 0;
};

const getAllRarities = () => {
  return Object.keys(RARITY_HIERARCHY).sort(
    (a, b) => getRarityValue(a) - getRarityValue(b),
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

// Card Component — Collectr-inspired dark card design
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

  const setName = cardData.SetName || card.groupName || "Unknown Set";
  const cardType = cardData.CardType || "Trainer";
  const rarity = cardData.Rarity || "Common";
  const cardNumber = cardData.Number || "";
  const price = cardData.Price;
  const priceDisplay = price && price !== "N/A" ? `$${price}` : "Price TBD";

  const rarityColor =
    rarity.toLowerCase().includes("rare holo") ||
    rarity.toLowerCase().includes("ultra")
      ? "#f59e0b"
      : rarity.toLowerCase().includes("secret") ||
          rarity.toLowerCase().includes("hyper")
        ? "#a78bfa"
        : rarity.toLowerCase().includes("uncommon")
          ? "#34d399"
          : "#9ca3af";

  return (
    <View style={styles.card}>
      {/* Card Image */}
      <View style={styles.cardImageWrapper}>
        <Image
          source={{
            uri:
              card.imageUrl ||
              "https://via.placeholder.com/200x280/1e293b/ffffff?text=No+Image",
          }}
          style={styles.cardImage}
          resizeMode="contain"
        />
        {/* Wishlist badge overlay */}
        <TouchableOpacity
          onPress={() => onToggleWishlist(card)}
          style={[
            styles.addButton,
            { backgroundColor: isInWishlist ? "#f43f5e" : "#10b981" },
          ]}
        >
          <Text style={styles.addButtonText}>{isInWishlist ? "♥" : "+"}</Text>
        </TouchableOpacity>
      </View>

      {/* Card Info */}
      <View style={styles.cardContent}>
        <Text style={styles.cardName} numberOfLines={2}>
          {card.name}
        </Text>
        <Text style={styles.cardSet} numberOfLines={1}>
          {setName}
          {cardNumber ? ` • ${cardNumber}` : ""}
        </Text>
        <View style={styles.cardMeta}>
          <Text style={[styles.rarityBadge, { color: rarityColor }]}>
            {rarity}
          </Text>
          {cardType && (
            <Text style={styles.cardTypeBadge}>
              {cardType.split(" - ")[1] || cardType}
            </Text>
          )}
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.cardPrice}>{priceDisplay}</Text>
          <TouchableOpacity
            onPress={() => onToggleAlreadyHave(card)}
            style={[
              styles.ownedButton,
              { backgroundColor: isAlreadyHave ? "#059669" : "#374151" },
            ]}
          >
            <Text style={styles.ownedButtonText}>
              {isAlreadyHave ? "✓ Owned" : "Own it"}
            </Text>
          </TouchableOpacity>
        </View>
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

  // Responsive layout
  const { width: windowWidth } = useWindowDimensions();
  const isResponsive = windowWidth < 768;
  const numColumns = isResponsive ? 2 : 3;

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
      console.log("WishlistDb initialized (user data loaded via authService)");
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

  // Load all cards from Supabase (pre-seeded, instant)
  const loadRealPokemonData = async () => {
    setLoading(true);
    try {
      console.log("⚡ Loading cards from Supabase...");

      // Fetch all cards from Supabase in batches of 1000 (Supabase default limit)
      let allCards = [];
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
          allCards.push(...data);
          from += batchSize;
          if (data.length < batchSize) hasMore = false;
        } else {
          hasMore = false;
        }
      }

      if (allCards.length > 0) {
        const pokemonCards = allCards.map((row) => row.card_data);
        const trainers = allCards
          .filter((row) => row.card_type === "Trainer")
          .map((row) => row.card_data);

        setAllPokemonCards(pokemonCards);
        setTrainerCards(trainers);
        console.log(
          `✅ Loaded ${pokemonCards.length} total cards (${trainers.length} trainers) from Supabase`,
        );
      } else {
        console.log("No cards found in Supabase, using local data.");
      }
    } catch (error) {
      console.error("Error loading cards from Supabase:", error);
    } finally {
      setLoading(false);
    }
  };

  // Load more cards — no longer needed since all cards are in Supabase
  const loadMoreCards = async () => {
    Alert.alert(
      "All Loaded",
      "All available cards have been loaded from the database.",
    );
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
          card.cleanName.toLowerCase().includes(searchQuery.toLowerCase()),
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
    const wasInWishlist = wishlist.some((w) => w.productId === card.productId);
    const previousWishlist = wishlist;
    try {
      let newWishlist;
      if (wasInWishlist) {
        newWishlist = wishlist.filter((w) => w.productId !== card.productId);
      } else {
        newWishlist = [...wishlist, card];
      }
      setWishlist(newWishlist);
      const result = await authService.saveWishlist(newWishlist);
      if (!result.success) {
        setWishlist(previousWishlist);
        Alert.alert("Error", "Failed to save wishlist. Please try again.");
        return;
      }
      Alert.alert(
        wasInWishlist ? "Removed" : "Added",
        `${card.name} ${wasInWishlist ? "removed from" : "added to"} wishlist`,
      );
    } catch (error) {
      console.log("Error updating wishlist:", error);
      setWishlist(previousWishlist);
      Alert.alert("Error", "Failed to update wishlist");
    }
  };

  const toggleAlreadyHave = async (card) => {
    const wasOwned = alreadyHave.some((a) => a.productId === card.productId);
    const previousCollection = alreadyHave;
    try {
      let newCollection;
      if (wasOwned) {
        newCollection = alreadyHave.filter(
          (a) => a.productId !== card.productId,
        );
      } else {
        newCollection = [...alreadyHave, card];
      }
      setAlreadyHave(newCollection);
      const result = await authService.saveCollection(newCollection);
      if (!result.success) {
        setAlreadyHave(previousCollection);
        Alert.alert("Error", "Failed to save collection. Please try again.");
        return;
      }
      Alert.alert(
        wasOwned ? "Removed" : "Added",
        `${card.name} ${wasOwned ? "removed from" : "added to"} collection`,
      );
    } catch (error) {
      console.log("Error updating collection:", error);
      setAlreadyHave(previousCollection);
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
      <SafeAreaProvider>
        <View style={styles.container}>
          <StatusBar style="dark" />
          {/* Top Nav */}
          <SafeAreaView style={styles.navbar} edges={["top"]}>
            <TouchableOpacity onPress={() => setCurrentView("home")} style={styles.navBack}>
              <Text style={styles.navBackText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.navTitle}>My Wishlist</Text>
            <View style={styles.navRight}>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    const result = await authService.saveWishlist(wishlist);
                    await wishlistDb.clearWishlist();
                    await Promise.all(wishlist.map((card) => wishlistDb.addToWishlist(card)));
                    Alert.alert(result.success ? "Saved!" : "Warning", result.success ? "Wishlist saved to your account" : "Saved locally but account sync failed.");
                  } catch {
                    Alert.alert("Error", "Failed to save wishlist");
                  }
                }}
                style={styles.navActionBtn}
              >
                <Text style={styles.navActionBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {wishlist.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
              <Text style={styles.emptyText}>Add trainer cards from the home page!</Text>
            </View>
          ) : (
            <FlatList
              data={wishlist}
              renderItem={({ item }) => (
                <View style={isAlreadyHave(item) ? styles.ownedCardContainer : null}>
                  <TrainerCard
                    card={item}
                    isInWishlist={true}
                    onToggleWishlist={toggleWishlist}
                    isAlreadyHave={isAlreadyHave(item)}
                    onToggleAlreadyHave={toggleAlreadyHave}
                  />
                  {isAlreadyHave(item) && (
                    <View style={styles.ownedBadge}>
                      <Text style={styles.ownedBadgeText}>OWNED</Text>
                    </View>
                  )}
                </View>
              )}
              keyExtractor={(item, index) => `wishlist-${item.productId}-${index}`}
              numColumns={numColumns}
              key={`wishlist-${numColumns}`}
              contentContainerStyle={styles.gridContent}
            />
          )}
        </View>
      </SafeAreaProvider>
    );
  }

  if (currentView === "collection") {
    return (
      <SafeAreaProvider>
        <View style={styles.container}>
          <StatusBar style="dark" />
          <SafeAreaView style={styles.navbar} edges={["top"]}>
            <TouchableOpacity onPress={() => setCurrentView("home")} style={styles.navBack}>
              <Text style={styles.navBackText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.navTitle}>My Collection</Text>
            <View style={{ width: 60 }} />
          </SafeAreaView>

          {alreadyHave.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Your collection is empty</Text>
              <Text style={styles.emptyText}>Mark cards as owned from the home page!</Text>
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
              keyExtractor={(item, index) => `collection-${item.productId}-${index}`}
              numColumns={numColumns}
              key={`collection-${numColumns}`}
              contentContainerStyle={styles.gridContent}
            />
          )}
        </View>
      </SafeAreaProvider>
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
            .includes("common"),
        );
        botResponse = `Found ${foundCards.length} common cards! Common cards are the most basic rarity.`;
      } else if (query.includes("uncommon")) {
        foundCards = cardsToSearch.filter((card) =>
          card.extendedData
            ?.find((data) => data.name === "Rarity")
            ?.value?.toLowerCase()
            .includes("uncommon"),
        );
        botResponse = `Found ${foundCards.length} uncommon cards! These are slightly rarer than common cards.`;
      } else if (query.includes("ultra rare") || query.includes("ultra")) {
        foundCards = cardsToSearch.filter((card) =>
          card.extendedData
            ?.find((data) => data.name === "Rarity")
            ?.value?.toLowerCase()
            .includes("ultra"),
        );
        botResponse = `Found ${foundCards.length} ultra rare cards! These are very special and valuable cards.`;
      } else if (
        query.includes("higher than") ||
        query.includes("above") ||
        query.includes("better than")
      ) {
        // Extract rarity from query
        const rarityMatch = query.match(
          /(higher than|above|better than)\s+(\w+\s*\w*)/,
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
          /(lower than|below|worse than)\s+(\w+\s*\w*)/,
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
            .includes("rare"),
        );
        botResponse = `Found ${foundCards.length} rare cards! These include regular rare and ultra rare cards.`;
      }
    } else if (query.includes("mimikyu")) {
      foundCards = cardsToSearch.filter((card) =>
        card.name.toLowerCase().includes("mimikyu"),
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
          card.cleanName.toLowerCase().includes(query),
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
      <SafeAreaProvider>
        <View style={styles.container}>
          <StatusBar style="dark" />
          <SafeAreaView style={styles.navbar} edges={["top"]}>
            <TouchableOpacity onPress={() => setCurrentView("home")} style={styles.navBack}>
              <Text style={styles.navBackText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.navTitle}>AI Assistant</Text>
            <View style={{ width: 60 }} />
          </SafeAreaView>

          <FlatList
            data={chatMessages}
            renderItem={renderChatMessage}
            keyExtractor={(item) => item.id.toString()}
            style={styles.chatContainer}
          />

          <SafeAreaView edges={["bottom"]} style={styles.chatInputContainer}>
            <TextInput
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="Ask about trainer cards..."
              placeholderTextColor="#6b7280"
              style={styles.chatInput}
            />
            <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    );
  }

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <SafeAreaProvider>
        <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={[styles.loadingStatus, { marginTop: 16, fontSize: 14 }]}>
            Loading your collection...
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <SafeAreaProvider>
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="dark" />

        {/* ── Top Navbar ── */}
        <SafeAreaView style={styles.navbar} edges={["top"]}>
          {/* Logo / Brand */}
          <View style={styles.navBrand}>
            <Text style={styles.navLogo}>POKÉCOLLECT</Text>
            <Text style={styles.navLogoSub}>Collect. Track. Profit.</Text>
          </View>

          {/* Nav links */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navLinks}>
            <TouchableOpacity
              onPress={() => setCardSection("trainers")}
              style={[styles.navLink, cardSection === "trainers" && styles.navLinkActive]}
            >
              <Text style={[styles.navLinkText, cardSection === "trainers" && styles.navLinkTextActive]}>
                Trainer Cards
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCardSection("all")}
              style={[styles.navLink, cardSection === "all" && styles.navLinkActive]}
            >
              <Text style={[styles.navLinkText, cardSection === "all" && styles.navLinkTextActive]}>
                All Cards
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCurrentView("wishlist")} style={styles.navLink}>
              <Text style={styles.navLinkText}>Wishlist {wishlist.length > 0 ? `(${wishlist.length})` : ""}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCurrentView("collection")} style={styles.navLink}>
              <Text style={styles.navLinkText}>Collection {alreadyHave.length > 0 ? `(${alreadyHave.length})` : ""}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCurrentView("chat")} style={styles.navLink}>
              <Text style={styles.navLinkText}>AI Chat</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Right side — user + logout */}
          <View style={styles.navRight}>
            {currentUser && (
              <Text style={styles.navUser}>{currentUser.username}</Text>
            )}
            <TouchableOpacity onPress={handleLogout} style={styles.navLogoutBtn}>
              <Text style={styles.navLogoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* ── Search Bar ── */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={`Search ${cardSection === "all" ? "any card" : "trainer cards"}...`}
              placeholderTextColor="#6b7280"
              style={styles.searchInput}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.searchClearBtn}>
                <Text style={styles.searchClearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={loadRealPokemonData}
            style={[styles.refreshBtn, loading && { opacity: 0.5 }]}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.refreshBtnText}>Refresh</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Body: Sidebar + Grid ── */}
        <View style={styles.body}>
          {/* Left Sidebar Filters — hidden on narrow screens */}
          {!isResponsive && (
            <View style={styles.sidebar}>
              <Text style={styles.sidebarHeading}>Filters</Text>

              <Text style={styles.sidebarLabel}>Sort by</Text>
              <View style={styles.sidebarDivider} />

              <Text style={styles.sidebarLabel}>Rarity</Text>
              {["all", "Common", "Uncommon", "Rare", "Rare Holo", "Ultra Rare", "Secret Rare"].map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setSelectedRarity(r === "all" ? "all" : r.toLowerCase())}
                  style={styles.sidebarOption}
                >
                  <View style={[
                    styles.sidebarRadio,
                    (selectedRarity === (r === "all" ? "all" : r.toLowerCase())) && styles.sidebarRadioActive,
                  ]} />
                  <Text style={styles.sidebarOptionText}>{r === "all" ? "All Rarities" : r}</Text>
                </TouchableOpacity>
              ))}

              <View style={styles.sidebarDivider} />
              <Text style={styles.sidebarLabel}>Type</Text>
              {["all", "pokemon", "trainer", "energy"].map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setSelectedType(t)}
                  style={styles.sidebarOption}
                >
                  <View style={[styles.sidebarRadio, selectedType === t && styles.sidebarRadioActive]} />
                  <Text style={styles.sidebarOptionText}>{t === "all" ? "All Types" : t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                </TouchableOpacity>
              ))}

              {(selectedRarity !== "all" || selectedType !== "all" || searchQuery) && (
                <>
                  <View style={styles.sidebarDivider} />
                  <TouchableOpacity
                    onPress={() => { setSelectedRarity("all"); setSelectedType("all"); setSearchQuery(""); }}
                    style={styles.clearFiltersBtn}
                  >
                    <Text style={styles.clearFiltersBtnText}>Clear Filters</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* Main Content */}
          <View style={styles.mainContent}>
            {/* Filter chips row (mobile only) */}
            {isResponsive && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowInner}>
                {["all", "common", "uncommon", "rare", "ultra rare"].map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setSelectedRarity(r)}
                    style={[styles.chip, selectedRarity === r && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, selectedRarity === r && styles.chipTextActive]}>
                      {r === "all" ? "All" : r.charAt(0).toUpperCase() + r.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
                {selectedType !== "all" && (
                  <TouchableOpacity onPress={() => setSelectedType("all")} style={styles.chipActive}>
                    <Text style={styles.chipTextActive}>{selectedType} ✕</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}

            {/* Results count + sort */}
            <View style={styles.resultsBar}>
              <Text style={styles.resultsText}>
                {loading ? "Loading..." : `${filteredCards.length.toLocaleString()} ${cardSection === "all" ? "cards" : "trainer cards"}`}
              </Text>
              <View style={styles.sortRow}>
                <Text style={styles.sortLabel}>Sort by: </Text>
                <Text style={styles.sortValue}>Best Match</Text>
              </View>
            </View>

            {/* Card Grid */}
            <FlatList
              data={filteredCards}
              renderItem={renderCard}
              keyExtractor={(item, index) => `${item.productId}-${index}-${cardSection}`}
              numColumns={numColumns}
              key={`${cardSection}-${numColumns}`}
              contentContainerStyle={styles.gridContent}
              columnWrapperStyle={styles.gridRow}
              onEndReached={() => {
                if (cardSection === "all" && !loadingMore && allPokemonCards.length > 0) {
                  loadMoreCards();
                }
              }}
              onEndReachedThreshold={0.3}
              maxToRenderPerBatch={12}
              windowSize={10}
              removeClippedSubviews={true}
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.autoLoadingContainer}>
                    <ActivityIndicator size="small" color="#10b981" />
                    <Text style={styles.autoLoadingText}>Loading more cards...</Text>
                  </View>
                ) : null
              }
            />
          </View>
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // ── Layout ──────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  body: {
    flex: 1,
    flexDirection: "row",
  },

  // ── Navbar ──────────────────────────────────────────────
  navbar: {
    backgroundColor: "#1e293b",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  navBrand: {
    marginRight: 24,
  },
  navLogo: {
    color: "#10b981",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1,
  },
  navLogoSub: {
    color: "#64748b",
    fontSize: 9,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  navLinks: {
    flexDirection: "row",
    alignItems: "center",
    flexGrow: 1,
  },
  navLink: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 4,
    borderRadius: 6,
  },
  navLinkActive: {
    backgroundColor: "rgba(16,185,129,0.1)",
  },
  navLinkText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "500",
  },
  navLinkTextActive: {
    color: "#10b981",
    fontWeight: "700",
  },
  navRight: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: "auto",
  },
  navUser: {
    color: "#94a3b8",
    fontSize: 13,
    marginRight: 12,
  },
  navLogoutBtn: {
    borderWidth: 1,
    borderColor: "#475569",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  navLogoutText: {
    color: "#94a3b8",
    fontSize: 13,
  },
  navBack: {
    marginRight: 16,
  },
  navBackText: {
    color: "#10b981",
    fontSize: 15,
    fontWeight: "600",
  },
  navTitle: {
    color: "#f1f5f9",
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  navActionBtn: {
    backgroundColor: "#10b981",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  navActionBtnText: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
  },

  // ── Search Section ───────────────────────────────────────
  searchSection: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#f1f5f9",
  },
  searchClearBtn: {
    paddingLeft: 8,
  },
  searchClearText: {
    color: "#64748b",
    fontSize: 14,
  },
  refreshBtn: {
    backgroundColor: "#10b981",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
  },
  refreshBtnText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },

  // ── Sidebar ──────────────────────────────────────────────
  sidebar: {
    width: 200,
    backgroundColor: "#1e293b",
    borderRightWidth: 1,
    borderRightColor: "#334155",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  sidebarHeading: {
    color: "#f1f5f9",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sidebarLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 8,
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: "#334155",
    marginVertical: 12,
  },
  sidebarOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  sidebarRadio: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#475569",
    marginRight: 10,
  },
  sidebarRadioActive: {
    borderColor: "#10b981",
    backgroundColor: "#10b981",
  },
  sidebarOptionText: {
    color: "#cbd5e1",
    fontSize: 13,
  },
  clearFiltersBtn: {
    marginTop: 8,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#475569",
    alignItems: "center",
  },
  clearFiltersBtnText: {
    color: "#94a3b8",
    fontSize: 13,
  },

  // ── Main Content ─────────────────────────────────────────
  mainContent: {
    flex: 1,
  },

  // Mobile filter chips
  chipRow: {
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    maxHeight: 48,
  },
  chipRowInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
    marginRight: 8,
    backgroundColor: "#0f172a",
  },
  chipActive: {
    backgroundColor: "rgba(16,185,129,0.15)",
    borderColor: "#10b981",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginRight: 8,
  },
  chipText: {
    color: "#94a3b8",
    fontSize: 12,
  },
  chipTextActive: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "600",
  },

  // Results bar
  resultsBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  resultsText: {
    color: "#94a3b8",
    fontSize: 13,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sortLabel: {
    color: "#64748b",
    fontSize: 13,
  },
  sortValue: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
  },

  // Grid
  gridContent: {
    padding: 12,
  },
  gridRow: {
    justifyContent: "flex-start",
    marginBottom: 12,
  },

  // ── Card ─────────────────────────────────────────────────
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    overflow: "hidden",
    flex: 1,
    margin: 6,
    borderWidth: 1,
    borderColor: "#334155",
    maxWidth: isMobile ? width / 2 - 18 : 200,
  },
  cardImageWrapper: {
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: 180,
    resizeMode: "contain",
  },
  addButton: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
  },
  addButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 20,
  },
  cardContent: {
    padding: 12,
  },
  cardName: {
    color: "#f1f5f9",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 3,
    lineHeight: 18,
  },
  cardSet: {
    color: "#64748b",
    fontSize: 11,
    marginBottom: 6,
  },
  cardMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 8,
  },
  rarityBadge: {
    fontSize: 11,
    fontWeight: "600",
  },
  cardTypeBadge: {
    color: "#64748b",
    fontSize: 11,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  cardPrice: {
    color: "#10b981",
    fontSize: 13,
    fontWeight: "700",
  },
  ownedButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ownedButtonText: {
    color: "white",
    fontSize: 11,
    fontWeight: "600",
  },

  // ── Empty state ──────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#94a3b8",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },

  // ── Chat ─────────────────────────────────────────────────
  chatContainer: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: "#0f172a",
  },
  chatMessage: {
    marginVertical: 4,
    padding: 12,
    borderRadius: 12,
    maxWidth: "80%",
  },
  botMessage: {
    backgroundColor: "#1e293b",
    alignSelf: "flex-start",
  },
  userMessage: {
    backgroundColor: "#10b981",
    alignSelf: "flex-end",
  },
  botText: {
    color: "#e2e8f0",
  },
  userText: {
    color: "white",
  },
  chatInputContainer: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#1e293b",
    borderTopWidth: 1,
    borderTopColor: "#334155",
    gap: 8,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#0f172a",
    color: "#f1f5f9",
  },
  sendButton: {
    backgroundColor: "#10b981",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: "center",
  },
  sendButtonText: {
    color: "white",
    fontWeight: "700",
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
    backgroundColor: "#1e293b",
  },
  chatCardName: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 4,
    color: "#94a3b8",
  },

  // ── Misc ─────────────────────────────────────────────────
  loadingStatus: {
    fontSize: 12,
    color: "#10b981",
    fontStyle: "italic",
    marginTop: 4,
  },
  autoLoadingContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  autoLoadingText: {
    marginLeft: 8,
    color: "#64748b",
    fontSize: 14,
  },
  ownedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#10b981",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    elevation: 4,
  },
  ownedBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "700",
  },
  ownedCardContainer: {
    opacity: 0.85,
  },
});
