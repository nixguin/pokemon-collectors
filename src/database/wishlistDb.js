import AsyncStorage from "@react-native-async-storage/async-storage";

class WishlistDatabase {
  constructor() {
    this.initialized = false;
  }

  async initDatabase() {
    // For web compatibility, we just use AsyncStorage
    this.initialized = true;
    console.log("WishlistDb: Initialized (AsyncStorage-based)");
  }

  async addToWishlist(card) {
    try {
      const wishlist = await this.getWishlist();
      const exists = wishlist.find((item) => item.productId === card.productId);
      if (!exists) {
        wishlist.push({ ...card, addedAt: new Date().toISOString() });
        await AsyncStorage.setItem("wishlist", JSON.stringify(wishlist));
      }
      return true;
    } catch (error) {
      console.error("WishlistDb: Error adding to wishlist:", error);
      return false;
    }
  }

  async removeFromWishlist(productId) {
    try {
      const wishlist = await this.getWishlist();
      const filtered = wishlist.filter((item) => item.productId !== productId);
      await AsyncStorage.setItem("wishlist", JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error("WishlistDb: Error removing from wishlist:", error);
      return false;
    }
  }

  async getWishlist() {
    try {
      const wishlist = await AsyncStorage.getItem("wishlist");
      return wishlist ? JSON.parse(wishlist) : [];
    } catch (error) {
      console.error("WishlistDb: Error getting wishlist:", error);
      return [];
    }
  }

  async isInWishlist(productId) {
    try {
      const wishlist = await this.getWishlist();
      return wishlist.some((item) => item.productId === productId);
    } catch (error) {
      console.error("WishlistDb: Error checking wishlist:", error);
      return false;
    }
  }

  async updateNotes(productId, notes) {
    try {
      const wishlist = await this.getWishlist();
      const item = wishlist.find((item) => item.productId === productId);
      if (item) {
        item.notes = notes;
        await AsyncStorage.setItem("wishlist", JSON.stringify(wishlist));
        return true;
      }
      return false;
    } catch (error) {
      console.error("WishlistDb: Error updating notes:", error);
      return false;
    }
  }

  async saveSearchHistory(query) {
    try {
      const history = await this.getSearchHistory();
      const filtered = history.filter((item) => item !== query);
      filtered.unshift(query);
      const limited = filtered.slice(0, 10); // Keep only last 10 searches
      await AsyncStorage.setItem("searchHistory", JSON.stringify(limited));
      return true;
    } catch (error) {
      console.error("WishlistDb: Error saving search history:", error);
      return false;
    }
  }

  async getSearchHistory() {
    try {
      const history = await AsyncStorage.getItem("searchHistory");
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error("WishlistDb: Error getting search history:", error);
      return [];
    }
  }

  async clearWishlist() {
    try {
      await AsyncStorage.removeItem("wishlist");
      return true;
    } catch (error) {
      console.error("WishlistDb: Error clearing wishlist:", error);
      return false;
    }
  }

  async addSearchHistory(item) {
    // For compatibility with existing code
    try {
      const collection = await AsyncStorage.getItem("collection");
      const items = collection ? JSON.parse(collection) : [];
      const exists = items.find(
        (existing) => existing.productId === item.productId
      );
      if (!exists) {
        items.push({ ...item, addedAt: new Date().toISOString() });
        await AsyncStorage.setItem("collection", JSON.stringify(items));
      }
      return true;
    } catch (error) {
      console.error("WishlistDb: Error adding to collection:", error);
      return false;
    }
  }
}

// Export individual functions for compatibility
const wishlistDb = new WishlistDatabase();

export const initDatabase = () => wishlistDb.initDatabase();
export const addToWishlist = (card) => wishlistDb.addToWishlist(card);
export const removeFromWishlist = (productId) =>
  wishlistDb.removeFromWishlist(productId);
export const getWishlist = () => wishlistDb.getWishlist();
export const isInWishlist = (productId) => wishlistDb.isInWishlist(productId);
export const updateNotes = (productId, notes) =>
  wishlistDb.updateNotes(productId, notes);
export const saveSearchHistory = (query) => wishlistDb.saveSearchHistory(query);
export const getSearchHistory = () => wishlistDb.getSearchHistory();
export const clearWishlist = () => wishlistDb.clearWishlist();
export const addSearchHistory = (item) => wishlistDb.addSearchHistory(item);

export default wishlistDb;
