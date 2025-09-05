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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import TrainerCard from "../components/TrainerCard";
import tcgcsvApi from "../services/tcgcsvApi";
import { demoTrainerCards } from "../services/demoData";

const HomeScreen = ({ navigation }) => {
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

      // For demo purposes, let's load a sample of Pokemon products
      // In a real app, you'd want to implement pagination or caching
      const groups = await tcgcsvApi.getPokemonGroups();
      const sampleGroups = groups.slice(0, 5); // Load first 5 sets for demo

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
      setTrainerCards(trainers.length > 0 ? trainers : demoTrainerCards);
    } catch (error) {
      console.error("Error loading trainer cards:", error);
      console.log("Using demo data as fallback");
      setTrainerCards(demoTrainerCards);
      Alert.alert(
        "Using Demo Data",
        "Could not connect to TCGCSV API. Using demo trainer cards for testing."
      );
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
    <View style={{ flex: 1, margin: 8 }}>
      <TrainerCard card={item} onWishlistChange={() => {}} />
    </View>
  );

  const renderFilter = ({ item }) => (
    <TouchableOpacity
      onPress={() => setSelectedFilter(item.key)}
      className={`flex-row items-center px-4 py-2 rounded-full mr-3 ${
        selectedFilter === item.key ? "bg-blue-500" : "bg-gray-200"
      }`}
    >
      <Ionicons
        name={item.icon}
        size={16}
        color={selectedFilter === item.key ? "white" : "#6b7280"}
        style={{ marginRight: 4 }}
      />
      <Text
        className={`text-sm font-medium ${
          selectedFilter === item.key ? "text-white" : "text-gray-600"
        }`}
      >
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-gray-600 mt-4 text-center px-8">
          Loading trainer cards from TCGCSV...
        </Text>
        <Text className="text-gray-400 text-sm mt-2 text-center px-8">
          This may take a moment as we fetch the latest data
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-blue-600 p-4 pt-12">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white text-xl font-bold">Trainer Cards</Text>
          <View className="flex-row">
            <TouchableOpacity
              onPress={() => navigation.navigate("Wishlist")}
              className="bg-white/20 rounded-full p-2 mr-2"
            >
              <Ionicons name="heart" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate("Chatbot", { trainerCards })}
              className="bg-white/20 rounded-full p-2"
            >
              <Ionicons name="chatbubble-ellipses" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-white rounded-full px-4 py-3">
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search trainer cards..."
            className="flex-1 ml-3 text-gray-800"
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
      <View className="bg-white border-b border-gray-200 py-3">
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
      <View className="bg-white px-4 py-2 border-b border-gray-200">
        <Text className="text-gray-600 text-sm">
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
          <View className="flex-1 justify-center items-center py-20">
            <Ionicons name="search" size={64} color="#d1d5db" />
            <Text className="text-gray-500 text-lg mt-4">
              No trainer cards found
            </Text>
            <Text className="text-gray-400 text-sm mt-2 text-center px-8">
              Try adjusting your search or filter criteria
            </Text>
          </View>
        }
      />
    </View>
  );
};

export default HomeScreen;
