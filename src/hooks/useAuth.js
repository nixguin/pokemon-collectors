import { useState, useEffect } from "react";
import { Alert } from "react-native";
import authService from "../services/authService";

/**
 * Manages authentication state: current user, login, logout.
 * Returns an object consumed by App and passed to screens/components.
 */
const useAuth = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.log("Auth check error:", error);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      setCurrentUser(null);
      setIsAuthenticated(false);
      Alert.alert("Logged Out", "You have been logged out successfully.");
    } catch {
      Alert.alert("Error", "Failed to logout. Please try again.");
    }
  };

  return {
    currentUser,
    isAuthenticated,
    authLoading,
    handleLoginSuccess,
    handleLogout,
  };
};

export default useAuth;
