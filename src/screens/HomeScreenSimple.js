import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import TrainerCardSimple from "../components/TrainerCardSimple";
import tcgcsvApi from "../services/tcgcsvApi";
import { demoTrainerCards } from "../services/demoData";

const HomeScreenSimple = ({ navigation }) => {
  const [trainerCards, setTrainerCards] = useState([]);
  const [filteredCards, setFilteredCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");

  const filters = [
    { key: "all", label: "All Cards", icon: "grid" },
    { key: "supporter", label: "Supporter", icon: "person" },
    { key: "item", label: "Item", icon: "cube" },
    { key: "stadium", label: "Stadium", icon: "business" },
    { key: "tool", label: "Tool", icon: "hammer" },
  ];

  useEffect(() => {
    loadTrainerCards();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [trainerCards, searchQuery, selectedFilter]);

  const loadTrainerCards = async () => {
    try {
      setLoading(true);

      // Start with demo data for immediate display
      setTrainerCards(demoTrainerCards);

      // Try to load real data from API
      try {
        const groups = await tcgcsvApi.getPokemonGroups();
        const sampleGroups = groups.slice(0, 3); // Load first 3 sets for demo

        let allProducts = [];
        for (const group of sampleGroups) {
          try {
            const products = await tcgcsvApi.getPokemonProducts(group.groupId);
            allProducts.push(...products);
          } catch (error) {
            console.warn(`Failed to load group ${group.groupId}:`, error);
          }
        }

        // Filter for trainer cards
        const trainers = tcgcsvApi.filterTrainerCards(allProducts);
        if (trainers.length > 0) {
          setTrainerCards([...demoTrainerCards, ...trainers]);
        }
      } catch (apiError) {
        console.log("API unavailable, using demo data");
      }
    } catch (error) {
      console.error("Error loading trainer cards:", error);
      setTrainerCards(demoTrainerCards);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTrainerCards();
    setRefreshing(false);
  };

  const applyFilters = () => {
    let filtered = [...trainerCards];

    // Apply search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (card) =>
          card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          card.cleanName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filter
    if (selectedFilter !== "all") {
      filtered = filtered.filter((card) => {
        const extendedData = card.extendedData || [];
        const cardType =
          extendedData
            .find((data) => data.name === "CardType")
            ?.value?.toLowerCase() || "";
        const name = card.name.toLowerCase();

        switch (selectedFilter) {
          case "supporter":
            return cardType.includes("supporter") || name.includes("supporter");
          case "item":
            return cardType.includes("item") || name.includes("item");
          case "stadium":
            return cardType.includes("stadium") || name.includes("stadium");
          case "tool":
            return cardType.includes("tool") || name.includes("tool");
          default:
            return true;
        }
      });
    }

    setFilteredCards(filtered);
  };

  const renderCard = ({ item }) => (
    <View style={{ flex: 1 }}>
      <TrainerCardSimple card={item} onWishlistChange={() => {}} />
    </View>
  );

  const renderFilter = ({ item }) => (
    <TouchableOpacity
      onPress={() => setSelectedFilter(item.key)}
      style={[
        styles.filterButton,
        {
          backgroundColor: selectedFilter === item.key ? "#3b82f6" : "#e5e7eb",
        },
      ]}
    >
      <Ionicons
        name={item.icon}
        size={16}
        color={selectedFilter === item.key ? "white" : "#6b7280"}
        style={{ marginRight: 4 }}
      />
      <Text
        style={[
          styles.filterText,
          { color: selectedFilter === item.key ? "white" : "#6b7280" },
        ]}
      >
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading trainer cards...</Text>
        <Text style={styles.loadingSubtext}>
          This may take a moment as we fetch the latest data
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Trainer Cards</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              onPress={() => navigation.navigate("Wishlist")}
              style={styles.headerButton}
            >
              <Ionicons name="heart" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate("Chatbot", { trainerCards })}
              style={styles.headerButton}
            >
              <Ionicons name="chatbubble-ellipses" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search trainer cards..."
            style={styles.searchInput}
            placeholderTextColor="#9ca3af"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <FlatList
          data={filters}
          renderItem={renderFilter}
          keyExtractor={(item) => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        />
      </View>

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {filteredCards.length} trainer card
          {filteredCards.length !== 1 ? "s" : ""} found
        </Text>
      </View>

      {/* Card List */}
      <FlatList
        data={filteredCards}
        renderItem={renderCard}
        keyExtractor={(item) => item.productId.toString()}
        numColumns={2}
        contentContainerStyle={{ padding: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No trainer cards found</Text>
            <Text style={styles.emptySubtext}>
              Try adjusting your search or filter criteria
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  header: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
  headerButtons: {
    flexDirection: "row",
  },
  headerButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    padding: 8,
    marginLeft: 8,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    color: "#1f2937",
    fontSize: 16,
  },
  filtersContainer: {
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 12,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
  },
  resultsContainer: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  resultsText: {
    color: "#6b7280",
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#f9fafb",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#6b7280",
    marginTop: 16,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  loadingSubtext: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 80,
  },
  emptyTitle: {
    color: "#6b7280",
    fontSize: 18,
    marginTop: 16,
  },
  emptySubtext: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 32,
  },
});

export default HomeScreenSimple;
