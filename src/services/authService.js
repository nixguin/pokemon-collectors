import AsyncStorage from "@react-native-async-storage/async-storage";

class AuthService {
  constructor() {
    this.currentUser = null;
  }

  // Generate a simple user ID
  generateUserId() {
    return "user_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  }

  // Hash password (simple implementation for demo)
  hashPassword(password) {
    // In a real app, use proper encryption like bcrypt
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  // Register new user
  async register(username, email, password) {
    try {
      // Check if user already exists
      const existingUsers = await this.getAllUsers();
      const userExists = existingUsers.find(
        (user) => user.username === username || user.email === email
      );

      if (userExists) {
        // Check if it's username or email that's taken
        if (userExists.username === username) {
          throw new Error(
            "Username is already taken. Please choose a different username."
          );
        } else {
          throw new Error(
            "An account with this email already exists. Please use a different email or sign in instead."
          );
        }
      }

      // Create new user
      const newUser = {
        id: this.generateUserId(),
        username,
        email,
        password: this.hashPassword(password),
        createdAt: new Date().toISOString(),
        wishlist: [],
        collection: [],
      };

      // Save user
      const users = [...existingUsers, newUser];
      await AsyncStorage.setItem("users", JSON.stringify(users));

      // Set current user (without password)
      const { password: _, ...userWithoutPassword } = newUser;
      this.currentUser = userWithoutPassword;
      await AsyncStorage.setItem(
        "currentUser",
        JSON.stringify(userWithoutPassword)
      );

      return { success: true, user: userWithoutPassword };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Login user
  async login(username, password) {
    try {
      console.log("AuthService: Attempting login for:", username);
      const users = await this.getAllUsers();
      console.log("AuthService: Found users:", users.length);
      const user = users.find(
        (u) =>
          (u.username === username || u.email === username) &&
          u.password === this.hashPassword(password)
      );

      if (!user) {
        console.log("AuthService: No matching user found");
        throw new Error("Username or password is incorrect. Please try again.");
      }

      // Set current user (without password)
      const { password: _, ...userWithoutPassword } = user;
      this.currentUser = userWithoutPassword;
      await AsyncStorage.setItem(
        "currentUser",
        JSON.stringify(userWithoutPassword)
      );
      console.log("AuthService: Login successful, user saved to storage");

      return { success: true, user: userWithoutPassword };
    } catch (error) {
      console.log("AuthService: Login error:", error.message);
      return { success: false, error: error.message };
    }
  }

  // Logout user
  async logout() {
    this.currentUser = null;
    await AsyncStorage.removeItem("currentUser");
    return { success: true };
  }

  // Get current user
  async getCurrentUser() {
    console.log(
      "AuthService: getCurrentUser called, currentUser in memory:",
      !!this.currentUser
    );
    if (this.currentUser) {
      return this.currentUser;
    }

    try {
      const userData = await AsyncStorage.getItem("currentUser");
      console.log("AuthService: userData from storage:", !!userData);
      if (userData) {
        this.currentUser = JSON.parse(userData);
        console.log(
          "AuthService: User loaded from storage:",
          this.currentUser.username
        );
        return this.currentUser;
      }
    } catch (error) {
      console.error("Error getting current user:", error);
    }

    console.log("AuthService: No user found");
    return null;
  }

  // Check if user is logged in
  async isLoggedIn() {
    const user = await this.getCurrentUser();
    return user !== null;
  }

  // Get all users (for internal use)
  async getAllUsers() {
    try {
      const usersData = await AsyncStorage.getItem("users");
      return usersData ? JSON.parse(usersData) : [];
    } catch (error) {
      console.error("Error getting users:", error);
      return [];
    }
  }

  // Update user data
  async updateUserData(updates) {
    try {
      if (!this.currentUser) {
        throw new Error("No user logged in");
      }

      const users = await this.getAllUsers();
      const userIndex = users.findIndex((u) => u.id === this.currentUser.id);

      if (userIndex === -1) {
        throw new Error("User not found");
      }

      // Update user data
      users[userIndex] = { ...users[userIndex], ...updates };
      await AsyncStorage.setItem("users", JSON.stringify(users));

      // Update current user
      const { password: _, ...userWithoutPassword } = users[userIndex];
      this.currentUser = userWithoutPassword;
      await AsyncStorage.setItem(
        "currentUser",
        JSON.stringify(userWithoutPassword)
      );

      return { success: true, user: userWithoutPassword };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Save user's wishlist
  async saveWishlist(wishlist) {
    return await this.updateUserData({ wishlist });
  }

  // Save user's collection
  async saveCollection(collection) {
    return await this.updateUserData({ collection });
  }

  // Get user's wishlist
  async getWishlist() {
    const user = await this.getCurrentUser();
    return user ? user.wishlist || [] : [];
  }

  // Get user's collection
  async getCollection() {
    const user = await this.getCurrentUser();
    return user ? user.collection || [] : [];
  }
}

const authService = new AuthService();
export default authService;
