import React, { useState } from "react";
import {
  View,
  ActivityIndicator,
  Text,
  useWindowDimensions,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import useAuth from "./src/hooks/useAuth";
import useCardData from "./src/hooks/useCardData";
import useCollections from "./src/hooks/useCollections";
import useCardFilters from "./src/hooks/useCardFilters";
import LoginScreen from "./src/components/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import WishlistScreen from "./src/screens/WishlistScreen";
import CollectionScreen from "./src/screens/CollectionScreen";
import ChatScreen from "./src/screens/ChatScreen";

export default function App() {
  const [currentView, setCurrentView] = useState("home");
  const [cardSection, setCardSection] = useState("trainers");

  // Responsive layout
  const { width: windowWidth } = useWindowDimensions();
  const isResponsive = windowWidth < 768;
  const gridWidth = isResponsive ? windowWidth : windowWidth - 180;
  const numColumns = isResponsive
    ? Math.max(2, Math.floor(gridWidth / 190))
    : Math.max(3, Math.floor(gridWidth / 180));

  // Hooks
  const auth = useAuth();
  const cardData = useCardData(auth.isAuthenticated);
  const collections = useCollections(auth.isAuthenticated);
  const filters = useCardFilters(
    cardData.allPokemonCards,
    cardData.trainerCards,
    cardSection,
    cardData.onePieceCards,
    cardData.japaneseCards,
  );

  // Auth loading screen
  if (auth.authLoading) {
    return (
      <SafeAreaProvider>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#fdf2f8",
          }}
        >
          <ActivityIndicator size="large" color="#ec4899" />
          <Text style={{ marginTop: 16, fontSize: 14, color: "#ec4899" }}>
            Loading your collection...
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  // Login screen
  if (!auth.isAuthenticated) {
    return (
      <SafeAreaProvider>
        <LoginScreen onLoginSuccess={auth.handleLoginSuccess} />
      </SafeAreaProvider>
    );
  }

  if (currentView === "wishlist") {
    return (
      <WishlistScreen
        wishlist={collections.wishlist}
        toggleWishlist={collections.toggleWishlist}
        toggleAlreadyHave={collections.toggleAlreadyHave}
        isAlreadyHave={collections.isAlreadyHave}
        numColumns={numColumns}
        onBack={() => setCurrentView("home")}
      />
    );
  }

  if (currentView === "collection") {
    return (
      <CollectionScreen
        alreadyHave={collections.alreadyHave}
        toggleWishlist={collections.toggleWishlist}
        toggleAlreadyHave={collections.toggleAlreadyHave}
        isInWishlist={collections.isInWishlist}
        numColumns={numColumns}
        onBack={() => setCurrentView("home")}
      />
    );
  }

  if (currentView === "chat") {
    return (
      <ChatScreen
        allPokemonCards={cardData.allPokemonCards}
        trainerCards={cardData.trainerCards}
        cardSection={cardSection}
        onBack={() => setCurrentView("home")}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <HomeScreen
        currentUser={auth.currentUser}
        onLogout={auth.handleLogout}
        cardSection={cardSection}
        setCardSection={setCardSection}
        setCurrentView={setCurrentView}
        loading={cardData.loading}
        loadingMore={cardData.loadingMore}
        loadRealPokemonData={cardData.loadRealPokemonData}
        wishlist={collections.wishlist}
        alreadyHave={collections.alreadyHave}
        toggleWishlist={collections.toggleWishlist}
        toggleAlreadyHave={collections.toggleAlreadyHave}
        isInWishlist={collections.isInWishlist}
        isAlreadyHave={collections.isAlreadyHave}
        filteredCards={filters.filteredCards}
        searchQuery={filters.searchQuery}
        setSearchQuery={filters.setSearchQuery}
        selectedRarity={filters.selectedRarity}
        setSelectedRarity={filters.setSelectedRarity}
        selectedType={filters.selectedType}
        setSelectedType={filters.setSelectedType}
        cuteMode={filters.cuteMode}
        setCuteMode={filters.setCuteMode}
        cuteError={filters.cuteError}
        retryScoring={filters.retryScoring}
        clearFilters={filters.clearFilters}
        numColumns={numColumns}
        isResponsive={isResponsive}
      />
    </SafeAreaProvider>
  );
}
