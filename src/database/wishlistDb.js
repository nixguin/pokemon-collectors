import * as SQLite from "expo-sqlite";

class WishlistDatabase {
  constructor() {
    this.db = null;
  }

  async initDatabase() {
    try {
      this.db = await SQLite.openDatabaseAsync("wishlist.db");

      // Create wishlist table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS wishlist (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          productId INTEGER UNIQUE,
          name TEXT NOT NULL,
          cleanName TEXT,
          imageUrl TEXT,
          groupId INTEGER,
          categoryId INTEGER,
          url TEXT,
          rarity TEXT,
          cardType TEXT,
          setName TEXT,
          price REAL,
          dateAdded DATETIME DEFAULT CURRENT_TIMESTAMP,
          notes TEXT
        );
      `);

      // Create search history table for AI chatbot
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS search_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          query TEXT NOT NULL,
          results TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      console.log("Database initialized successfully");
    } catch (error) {
      console.error("Error initializing database:", error);
    }
  }

  // Add card to wishlist
  async addToWishlist(card) {
    try {
      const result = await this.db.runAsync(
        `INSERT OR REPLACE INTO wishlist 
         (productId, name, cleanName, imageUrl, groupId, categoryId, url, rarity, cardType, setName, price, notes) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          card.productId,
          card.name,
          card.cleanName,
          card.imageUrl,
          card.groupId,
          card.categoryId,
          card.url,
          card.rarity || "",
          card.cardType || "",
          card.setName || "",
          card.price || 0,
          card.notes || "",
        ]
      );
      return result;
    } catch (error) {
      console.error("Error adding to wishlist:", error);
      throw error;
    }
  }

  // Remove card from wishlist
  async removeFromWishlist(productId) {
    try {
      const result = await this.db.runAsync(
        "DELETE FROM wishlist WHERE productId = ?",
        [productId]
      );
      return result;
    } catch (error) {
      console.error("Error removing from wishlist:", error);
      throw error;
    }
  }

  // Get all wishlist items
  async getWishlist() {
    try {
      const result = await this.db.getAllAsync(
        "SELECT * FROM wishlist ORDER BY dateAdded DESC"
      );
      return result;
    } catch (error) {
      console.error("Error getting wishlist:", error);
      throw error;
    }
  }

  // Check if card is in wishlist
  async isInWishlist(productId) {
    try {
      const result = await this.db.getFirstAsync(
        "SELECT productId FROM wishlist WHERE productId = ?",
        [productId]
      );
      return !!result;
    } catch (error) {
      console.error("Error checking wishlist status:", error);
      return false;
    }
  }

  // Update card notes
  async updateNotes(productId, notes) {
    try {
      const result = await this.db.runAsync(
        "UPDATE wishlist SET notes = ? WHERE productId = ?",
        [notes, productId]
      );
      return result;
    } catch (error) {
      console.error("Error updating notes:", error);
      throw error;
    }
  }

  // Save search history for AI chatbot
  async saveSearchHistory(query, results) {
    try {
      const result = await this.db.runAsync(
        "INSERT INTO search_history (query, results) VALUES (?, ?)",
        [query, JSON.stringify(results)]
      );
      return result;
    } catch (error) {
      console.error("Error saving search history:", error);
      throw error;
    }
  }

  // Get search history
  async getSearchHistory(limit = 10) {
    try {
      const result = await this.db.getAllAsync(
        "SELECT * FROM search_history ORDER BY timestamp DESC LIMIT ?",
        [limit]
      );
      return result;
    } catch (error) {
      console.error("Error getting search history:", error);
      return [];
    }
  }

  // Clear all wishlist items
  async clearWishlist() {
    try {
      const result = await this.db.runAsync("DELETE FROM wishlist");
      return result;
    } catch (error) {
      console.error("Error clearing wishlist:", error);
      throw error;
    }
  }

  // Add search history (for collection tracking)
  async addSearchHistory(query, results) {
    try {
      const result = await this.db.runAsync(
        "INSERT INTO search_history (query, results) VALUES (?, ?)",
        [query, results]
      );
      return result;
    } catch (error) {
      console.error("Error adding search history:", error);
      throw error;
    }
  }
}

const wishlistDb = new WishlistDatabase();

// Export individual functions for easier use
export const initDatabase = () => wishlistDb.initDatabase();
export const addToWishlist = (card) => wishlistDb.addToWishlist(card);
export const removeFromWishlist = (productId) =>
  wishlistDb.removeFromWishlist(productId);
export const getWishlist = () => wishlistDb.getWishlist();
export const clearWishlist = () => wishlistDb.clearWishlist();
export const addSearchHistory = (query, results) =>
  wishlistDb.addSearchHistory(query, results);
export const getSearchHistory = (limit) => wishlistDb.getSearchHistory(limit);

export default wishlistDb;
