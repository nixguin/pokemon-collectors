import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import TrainerCard from "../components/TrainerCard";
import wishlistDb from "../database/wishlistDb";

const WishlistScreen = ({ navigation }) => {
  const [wishlistCards, setWishlistCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadWishlist();
    }, [])
  );

  const loadWishlist = async () => {
    try {
      setLoading(true);
      const wishlist = await wishlistDb.getWishlist();
      setWishlistCards(wishlist);
    } catch (error) {
      console.error("Error loading wishlist:", error);
      Alert.alert("Error", "Failed to load wishlist");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWishlist();
    setRefreshing(false);
  };

  const clearWishlist = () => {
    Alert.alert(
      "Clear Wishlist",
      "Are you sure you want to remove all cards from your wishlist?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              for (const card of wishlistCards) {
                await wishlistDb.removeFromWishlist(card.productId);
              }
              setWishlistCards([]);
              Alert.alert("Success", "Wishlist cleared successfully");
            } catch (error) {
              console.error("Error clearing wishlist:", error);
              Alert.alert("Error", "Failed to clear wishlist");
            }
          },
        },
      ]
    );
  };

  const renderCard = ({ item }) => (
    <View style={{ flex: 1, margin: 8 }}>
      <TrainerCard card={item} onWishlistChange={loadWishlist} />
    </View>
  );

  const calculateTotalValue = () => {
    return wishlistCards
      .reduce((total, card) => total + (card.price || 0), 0)
      .toFixed(2);
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-blue-600 p-4 pt-12">
        <View className="flex-row items-center justify-between mb-4">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">My Wishlist</Text>
          {wishlistCards.length > 0 && (
            <TouchableOpacity onPress={clearWishlist}>
              <Ionicons name="trash-outline" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>

        {/* Wishlist Stats */}
        <View className="bg-white/20 rounded-xl p-4">
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-white text-lg font-semibold">
                {wishlistCards.length} Cards
              </Text>
              <Text className="text-white/80 text-sm">
                Total Est. Value: ${calculateTotalValue()}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("Chatbot", { trainerCards: wishlistCards })
              }
              className="bg-white/20 rounded-full p-3"
            >
              <Ionicons name="chatbubble-ellipses" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Card List */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-600">Loading your wishlist...</Text>
        </View>
      ) : wishlistCards.length === 0 ? (
        <View className="flex-1 justify-center items-center px-8">
          <Ionicons name="heart-outline" size={64} color="#d1d5db" />
          <Text className="text-gray-500 text-xl font-semibold mt-4 text-center">
            Your Wishlist is Empty
          </Text>
          <Text className="text-gray-400 text-sm mt-2 text-center">
            Start browsing trainer cards and add them to your wishlist to see
            them here
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("Home")}
            className="bg-blue-500 px-6 py-3 rounded-full mt-6"
          >
            <Text className="text-white font-medium">Browse Trainer Cards</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={wishlistCards}
          renderItem={renderCard}
          keyExtractor={(item) =>
            item.id?.toString() || item.productId?.toString()
          }
          numColumns={2}
          contentContainerStyle={{ padding: 8 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
};

export default WishlistScreen;
