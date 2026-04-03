import { supabase } from "./supabaseClient";
import AsyncStorage from "@react-native-async-storage/async-storage";

class AuthService {
  constructor() {
    this.currentUser = null;
  }

  // Register new user with Supabase Auth
  async register(username, email, password) {
    try {
      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          throw new Error(
            "An account with this email already exists. Please sign in instead.",
          );
        }
        throw error;
      }

      const user = data.user;
      if (!user) {
        throw new Error("Registration failed. Please try again.");
      }

      // Check if session is active (email confirmation may block this)
      const session = data.session;
      if (!session) {
        console.warn(
          "No session after signup — email confirmation may be enabled in Supabase.",
        );
      }

      // Create profile row in profiles table
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        username,
        email,
        created_at: new Date().toISOString(),
      });

      if (profileError) {
        console.error(
          "Error creating profile:",
          profileError.message,
          profileError.details,
        );
      }

      const appUser = {
        id: user.id,
        username,
        email,
        createdAt: user.created_at,
      };

      this.currentUser = appUser;
      await AsyncStorage.setItem("currentUser", JSON.stringify(appUser));

      return { success: true, user: appUser };
    } catch (error) {
      console.error("Registration error:", error);
      return { success: false, error: error.message };
    }
  }

  // Login user with Supabase Auth
  async login(username, password) {
    try {
      console.log("AuthService: Attempting login for:", username);

      // Supabase Auth uses email, so if username provided, look it up
      let email = username;
      if (!username.includes("@")) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("username", username)
          .single();

        if (profile) {
          email = profile.email;
        } else {
          throw new Error("Username not found. Please check and try again.");
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error("Email or password is incorrect. Please try again.");
      }

      const user = data.user;
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

      const appUser = {
        id: user.id,
        username: profile?.username || user.user_metadata?.username || email,
        email: user.email,
        createdAt: user.created_at,
      };

      this.currentUser = appUser;
      await AsyncStorage.setItem("currentUser", JSON.stringify(appUser));
      console.log("AuthService: Login successful");

      return { success: true, user: appUser };
    } catch (error) {
      console.log("AuthService: Login error:", error.message);
      return { success: false, error: error.message };
    }
  }

  // Logout user
  async logout() {
    this.currentUser = null;
    await AsyncStorage.removeItem("currentUser");
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Supabase signout error:", error);
    }
    return { success: true };
  }

  // Get current user
  async getCurrentUser() {
    try {
      // Always check Supabase session — do NOT fall back to AsyncStorage cache
      // if there is no live session, as it will be stale after logout.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const user = session.user;
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .single();

        const appUser = {
          id: user.id,
          username:
            profile?.username || user.user_metadata?.username || user.email,
          email: user.email,
          createdAt: user.created_at,
        };

        this.currentUser = appUser;
        await AsyncStorage.setItem("currentUser", JSON.stringify(appUser));
        return appUser;
      }

      // No active session — ensure stale cache is cleared
      this.currentUser = null;
      await AsyncStorage.removeItem("currentUser");
    } catch (error) {
      console.error("Error getting current user:", error);
    }

    return null;
  }

  // Check if user is logged in
  async isLoggedIn() {
    const user = await this.getCurrentUser();
    return user !== null;
  }

  // Save user's wishlist to Supabase
  async saveWishlist(wishlist) {
    try {
      if (!this.currentUser) {
        throw new Error("No user logged in");
      }

      const rows = wishlist.map((card) => ({
        user_id: this.currentUser.id,
        product_id: String(card.productId),
        card_data: card,
      }));

      // Delete existing wishlist for this user, then insert new
      const { error: deleteError } = await supabase
        .from("wishlists")
        .delete()
        .eq("user_id", this.currentUser.id);

      if (deleteError) {
        console.error("Error clearing wishlist:", deleteError);
      }

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from("wishlists")
          .insert(rows);

        if (insertError) {
          console.error("Error saving wishlist:", insertError);
          throw insertError;
        }
      }

      return { success: true };
    } catch (error) {
      console.error("saveWishlist error:", error);
      return { success: false, error: error.message };
    }
  }

  // Save user's collection to Supabase
  async saveCollection(collection) {
    try {
      if (!this.currentUser) {
        throw new Error("No user logged in");
      }

      const rows = collection.map((card) => ({
        user_id: this.currentUser.id,
        product_id: String(card.productId),
        card_data: card,
      }));

      // Delete existing collection for this user, then insert new
      const { error: deleteError } = await supabase
        .from("collections")
        .delete()
        .eq("user_id", this.currentUser.id);

      if (deleteError) {
        console.error("Error clearing collection:", deleteError);
      }

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from("collections")
          .insert(rows);

        if (insertError) {
          console.error("Error saving collection:", insertError);
          throw insertError;
        }
      }

      return { success: true };
    } catch (error) {
      console.error("saveCollection error:", error);
      return { success: false, error: error.message };
    }
  }

  // Get user's wishlist from Supabase
  async getWishlist() {
    try {
      if (!this.currentUser) return [];

      const { data, error } = await supabase
        .from("wishlists")
        .select("card_data")
        .eq("user_id", this.currentUser.id);

      if (error) {
        console.error("Error fetching wishlist:", error);
        return [];
      }

      return data ? data.map((row) => row.card_data) : [];
    } catch (error) {
      console.error("getWishlist error:", error);
      return [];
    }
  }

  // Get user's collection from Supabase
  async getCollection() {
    try {
      if (!this.currentUser) return [];

      const { data, error } = await supabase
        .from("collections")
        .select("card_data")
        .eq("user_id", this.currentUser.id);

      if (error) {
        console.error("Error fetching collection:", error);
        return [];
      }

      return data ? data.map((row) => row.card_data) : [];
    } catch (error) {
      console.error("getCollection error:", error);
      return [];
    }
  }
}

const authService = new AuthService();
export default authService;
