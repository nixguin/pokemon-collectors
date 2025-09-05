import React, { useState, useEffect } from "react";
import { View, Text, Image, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import wishlistDb from "../database/wishlistDb";

const TrainerCard = ({ card, onWishlistChange }) => {
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkWishlistStatus();
  }, [card.productId]);

  const checkWishlistStatus = async () => {
    try {
      const inWishlist = await wishlistDb.isInWishlist(card.productId);
      setIsInWishlist(inWishlist);
    } catch (error) {
      console.error("Error checking wishlist status:", error);
    }
  };

  const toggleWishlist = async () => {
    setLoading(true);
    try {
      if (isInWishlist) {
        await wishlistDb.removeFromWishlist(card.productId);
        setIsInWishlist(false);
        Alert.alert("Removed", `${card.name} removed from wishlist`);
      } else {
        const cardData = extractCardData(card);
        await wishlistDb.addToWishlist({
          ...card,
          ...cardData,
        });
        setIsInWishlist(true);
        Alert.alert("Added", `${card.name} added to wishlist`);
      }

      if (onWishlistChange) {
        onWishlistChange();
      }
    } catch (error) {
      console.error("Error updating wishlist:", error);
      Alert.alert("Error", "Failed to update wishlist");
    }
    setLoading(false);
  };

  const extractCardData = (card) => {
    const extendedData = card.extendedData || [];
    const cardData = {
      rarity: "",
      cardType: "",
      setName: "",
      cardNumber: "",
    };

    extendedData.forEach((data) => {
      switch (data.name) {
        case "CardType":
          cardData.cardType = data.value || "";
          break;
        case "Rarity":
          cardData.rarity = data.value || "";
          break;
        case "SetName":
          cardData.setName = data.value || "";
          break;
        case "Number":
          cardData.cardNumber = data.value || "";
          break;
      }
    });

    return cardData;
  };

  const cardData = extractCardData(card);

  return (
    <View className="bg-white rounded-xl shadow-lg p-4 m-2 border border-gray-200">
      {/* Card Image */}
      <View className="items-center mb-3">
        <Image
          source={{
            uri:
              card.imageUrl ||
              "https://via.placeholder.com/200x280?text=No+Image",
          }}
          className="w-32 h-44 rounded-lg"
          resizeMode="cover"
        />
      </View>

      {/* Card Info */}
      <View className="flex-1">
        <Text
          className="text-lg font-bold text-gray-800 mb-1"
          numberOfLines={2}
        >
          {card.name}
        </Text>

        {cardData.setName && (
          <Text className="text-sm text-blue-600 mb-1">{cardData.setName}</Text>
        )}

        <View className="flex-row flex-wrap mb-2">
          {cardData.cardType && (
            <View className="bg-purple-100 px-2 py-1 rounded-full mr-1 mb-1">
              <Text className="text-xs text-purple-800">
                {cardData.cardType}
              </Text>
            </View>
          )}
          {cardData.rarity && (
            <View className="bg-yellow-100 px-2 py-1 rounded-full mr-1 mb-1">
              <Text className="text-xs text-yellow-800">{cardData.rarity}</Text>
            </View>
          )}
          {cardData.cardNumber && (
            <View className="bg-gray-100 px-2 py-1 rounded-full mr-1 mb-1">
              <Text className="text-xs text-gray-800">
                #{cardData.cardNumber}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Wishlist Button */}
      <TouchableOpacity
        onPress={toggleWishlist}
        disabled={loading}
        className={`flex-row items-center justify-center py-2 px-4 rounded-lg ${
          isInWishlist ? "bg-red-500" : "bg-blue-500"
        } ${loading ? "opacity-50" : ""}`}
      >
        <Ionicons
          name={isInWishlist ? "heart" : "heart-outline"}
          size={16}
          color="white"
          style={{ marginRight: 4 }}
        />
        <Text className="text-white font-medium text-sm">
          {isInWishlist ? "Remove" : "Add to Wishlist"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default TrainerCard;
