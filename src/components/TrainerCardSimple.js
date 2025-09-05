import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import wishlistDb from "../database/wishlistDb";

const TrainerCardSimple = ({ card, onWishlistChange }) => {
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
    <View style={styles.container}>
      {/* Card Image */}
      <View style={styles.imageContainer}>
        <Image
          source={{
            uri:
              card.imageUrl ||
              "https://via.placeholder.com/200x280?text=No+Image",
          }}
          style={styles.cardImage}
          resizeMode="cover"
        />
      </View>

      {/* Card Info */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={2}>
          {card.name}
        </Text>

        {cardData.setName && (
          <Text style={styles.setName}>{cardData.setName}</Text>
        )}

        <View style={styles.tagsContainer}>
          {cardData.cardType && (
            <View style={[styles.tag, styles.typeTag]}>
              <Text style={styles.typeTagText}>{cardData.cardType}</Text>
            </View>
          )}
          {cardData.rarity && (
            <View style={[styles.tag, styles.rarityTag]}>
              <Text style={styles.rarityTagText}>{cardData.rarity}</Text>
            </View>
          )}
          {cardData.cardNumber && (
            <View style={[styles.tag, styles.numberTag]}>
              <Text style={styles.numberTagText}>#{cardData.cardNumber}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Wishlist Button */}
      <TouchableOpacity
        onPress={toggleWishlist}
        disabled={loading}
        style={[
          styles.wishlistButton,
          { backgroundColor: isInWishlist ? "#ef4444" : "#3b82f6" },
          loading && styles.disabled,
        ]}
      >
        <Ionicons
          name={isInWishlist ? "heart" : "heart-outline"}
          size={16}
          color="white"
          style={{ marginRight: 4 }}
        />
        <Text style={styles.buttonText}>
          {isInWishlist ? "Remove" : "Add to Wishlist"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    margin: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  cardImage: {
    width: 128,
    height: 176,
    borderRadius: 8,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
  },
  setName: {
    fontSize: 14,
    color: "#2563eb",
    marginBottom: 4,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 4,
    marginBottom: 4,
  },
  typeTag: {
    backgroundColor: "#f3e8ff",
  },
  typeTagText: {
    fontSize: 12,
    color: "#7c3aed",
  },
  rarityTag: {
    backgroundColor: "#fef3c7",
  },
  rarityTagText: {
    fontSize: 12,
    color: "#d97706",
  },
  numberTag: {
    backgroundColor: "#f3f4f6",
  },
  numberTagText: {
    fontSize: 12,
    color: "#374151",
  },
  wishlistButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default TrainerCardSimple;
