import React from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import authService from "../services/authService";
import * as wishlistDb from "../database/wishlistDb";
import CardItem from "../components/CardItem";
import {
  screenBaseStyles,
  screenNavStyles,
  emptyStateStyles,
  gridStyles,
} from "../styles/screenStyles";

/**
 * Props:
 *  wishlist            array
 *  toggleWishlist      fn(card)
 *  toggleAlreadyHave   fn(card)
 *  isInWishlist        fn(card) => bool
 *  isAlreadyHave       fn(card) => bool
 *  numColumns          number
 *  onBack              fn()
 */
const getCardPrice = (card) => {
  const val = card.extendedData?.find((d) => d.name === "Price")?.value;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
};

const WishlistScreen = ({
  wishlist,
  toggleWishlist,
  toggleAlreadyHave,
  isAlreadyHave,
  numColumns,
  onBack,
}) => {
  const totalPrice = wishlist.reduce(
    (sum, card) => sum + getCardPrice(card),
    0,
  );
  const knownCount = wishlist.filter((c) => getCardPrice(c) > 0).length;
  const handleSave = async () => {
    try {
      const result = await authService.saveWishlist(wishlist);
      await wishlistDb.clearWishlist();
      await Promise.all(wishlist.map((card) => wishlistDb.addToWishlist(card)));
      Alert.alert(
        result.success ? "Saved!" : "Warning",
        result.success
          ? "Wishlist saved to your account"
          : "Saved locally but account sync failed.",
      );
    } catch {
      Alert.alert("Error", "Failed to save wishlist");
    }
  };

  return (
    <SafeAreaProvider>
      <View style={screenBaseStyles.container}>
        <StatusBar style="dark" />
        <SafeAreaView style={screenNavStyles.navbar} edges={["top"]}>
          <TouchableOpacity onPress={onBack} style={screenNavStyles.backBtn}>
            <Text style={screenNavStyles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={screenNavStyles.title}>My Wishlist</Text>
          <View style={screenNavStyles.rightSection}>
            <TouchableOpacity
              onPress={handleSave}
              style={screenNavStyles.actionBtn}
            >
              <Text style={screenNavStyles.actionBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {wishlist.length === 0 ? (
          <View style={emptyStateStyles.container}>
            <Text style={emptyStateStyles.title}>Your wishlist is empty</Text>
            <Text style={emptyStateStyles.subtitle}>
              Add trainer cards from the home page!
            </Text>
          </View>
        ) : (
          <>
            {/* Total price bar */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#fdf2f8",
                borderBottomWidth: 1,
                borderBottomColor: "#f9a8d4",
                paddingHorizontal: 16,
                paddingVertical: 10,
              }}
            >
              <Text style={{ fontSize: 14, color: "#6b7280" }}>
                {wishlist.length} card{wishlist.length !== 1 ? "s" : ""}
                {knownCount < wishlist.length
                  ? ` · ${wishlist.length - knownCount} without price`
                  : ""}
              </Text>
              <Text
                style={{ fontSize: 16, fontWeight: "700", color: "#ec4899" }}
              >
                Est. Total: ${totalPrice.toFixed(2)}
              </Text>
            </View>

            <FlatList
              data={wishlist}
              renderItem={({ item }) => (
                <View
                  style={
                    isAlreadyHave(item) ? gridStyles.ownedCardContainer : null
                  }
                >
                  <CardItem
                    card={item}
                    isInWishlist={true}
                    onToggleWishlist={toggleWishlist}
                    isAlreadyHave={isAlreadyHave(item)}
                    onToggleAlreadyHave={toggleAlreadyHave}
                  />
                  {isAlreadyHave(item) && (
                    <View style={gridStyles.ownedBadge}>
                      <Text style={gridStyles.ownedBadgeText}>OWNED</Text>
                    </View>
                  )}
                </View>
              )}
              keyExtractor={(item, index) =>
                `wishlist-${item.productId}-${index}`
              }
              numColumns={numColumns}
              key={`wishlist-${numColumns}`}
              contentContainerStyle={gridStyles.content}
            />
          </>
        )}
      </View>
    </SafeAreaProvider>
  );
};

export default WishlistScreen;
