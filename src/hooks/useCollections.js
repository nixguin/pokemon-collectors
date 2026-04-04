import { useState, useEffect } from "react";
import { Alert } from "react-native";
import authService from "../services/authService";
import * as wishlistDb from "../database/wishlistDb";

/**
 * Manages wishlist and owned-collection state.
 * Syncs with authService (Supabase) on every toggle.
 */
const useCollections = (isAuthenticated) => {
  const [wishlist, setWishlist] = useState([]);
  const [alreadyHave, setAlreadyHave] = useState([]);

  // Load saved data when the user logs in
  useEffect(() => {
    if (isAuthenticated) {
      loadUserCollections();
    }
  }, [isAuthenticated]);

  const loadUserCollections = async () => {
    try {
      const savedWishlist = await authService.getWishlist();
      const savedCollection = await authService.getCollection();
      setWishlist(savedWishlist);
      setAlreadyHave(savedCollection);
    } catch (error) {
      console.log("Error loading user collections:", error);
    }
  };

  const clearCollections = () => {
    setWishlist([]);
    setAlreadyHave([]);
  };

  const toggleWishlist = async (card) => {
    const wasInWishlist = wishlist.some((w) => w.productId === card.productId);
    const previous = wishlist;
    const updated = wasInWishlist
      ? wishlist.filter((w) => w.productId !== card.productId)
      : [...wishlist, card];

    setWishlist(updated);
    try {
      const result = await authService.saveWishlist(updated);
      if (!result.success) {
        setWishlist(previous);
        Alert.alert("Error", "Failed to save wishlist. Please try again.");
        return;
      }
      Alert.alert(
        wasInWishlist ? "Removed" : "Added",
        `${card.name} ${wasInWishlist ? "removed from" : "added to"} wishlist`,
      );
    } catch {
      setWishlist(previous);
      Alert.alert("Error", "Failed to update wishlist");
    }
  };

  const toggleAlreadyHave = async (card) => {
    const wasOwned = alreadyHave.some((a) => a.productId === card.productId);
    const previous = alreadyHave;
    const updated = wasOwned
      ? alreadyHave.filter((a) => a.productId !== card.productId)
      : [...alreadyHave, card];

    setAlreadyHave(updated);
    try {
      const result = await authService.saveCollection(updated);
      if (!result.success) {
        setAlreadyHave(previous);
        Alert.alert("Error", "Failed to save collection. Please try again.");
        return;
      }
      Alert.alert(
        wasOwned ? "Removed" : "Added",
        `${card.name} ${wasOwned ? "removed from" : "added to"} collection`,
      );
    } catch {
      setAlreadyHave(previous);
      Alert.alert("Error", "Failed to update collection");
    }
  };

  const isInWishlist = (card) =>
    wishlist.some((w) => w.productId === card.productId);

  const isAlreadyHave = (card) =>
    alreadyHave.some((a) => a.productId === card.productId);

  return {
    wishlist,
    alreadyHave,
    toggleWishlist,
    toggleAlreadyHave,
    isInWishlist,
    isAlreadyHave,
    clearCollections,
    loadUserCollections,
  };
};

export default useCollections;
