import React, { useState } from "react";
import {
  View,
  FlatList,
  Text,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import Navbar from "../components/Navbar";
import SearchBar from "../components/SearchBar";

import CardItem from "../components/CardItem";
import CardDetailModal from "../components/CardDetailModal";
import homeStyles from "../styles/homeStyles";

/**
 * Main browse screen: navbar + search + filters + card grid + detail modal.
 *
 * Props come from App.js (spread from hooks + state).
 */
const HomeScreen = ({
  // Auth
  currentUser,
  onLogout,
  // Navigation
  cardSection,
  setCardSection,
  setCurrentView,
  // Card data
  loading,
  loadingMore,
  loadRealPokemonData,
  // Collections
  wishlist,
  alreadyHave,
  toggleWishlist,
  toggleAlreadyHave,
  isInWishlist,
  isAlreadyHave,
  // Filters
  filteredCards,
  searchQuery,
  setSearchQuery,
  selectedRarity,
  setSelectedRarity,
  selectedType,
  setSelectedType,
  cuteMode,
  setCuteMode,
  cuteError,
  retryScoring,
  clearFilters,
  // Layout
  numColumns,
  isResponsive,
}) => {
  const [selectedCard, setSelectedCard] = useState(null);

  const renderCard = ({ item }) => (
    <CardItem
      card={item}
      isInWishlist={isInWishlist(item)}
      onToggleWishlist={toggleWishlist}
      isAlreadyHave={isAlreadyHave(item)}
      onToggleAlreadyHave={toggleAlreadyHave}
      onPress={() => setSelectedCard(item)}
    />
  );

  const sectionLabel =
    cardSection === "all"
      ? "cards"
      : cardSection === "onePiece"
        ? "One Piece cards"
        : "trainer cards";
  const resultsLabel = loading
    ? "Loading..."
    : cuteMode
      ? `✨ ${filteredCards.length.toLocaleString()} cute cards`
      : `${filteredCards.length.toLocaleString()} ${sectionLabel}`;

  return (
    <View style={homeStyles.container}>
      <StatusBar style="dark" />

      <Navbar
        cardSection={cardSection}
        setCardSection={setCardSection}
        cuteMode={cuteMode}
        setCuteMode={setCuteMode}
        setCurrentView={setCurrentView}
        wishlistCount={wishlist.length}
        collectionCount={alreadyHave.length}
        currentUser={currentUser}
        onLogout={onLogout}
        isResponsive={isResponsive}
      />

      <SearchBar
        searchQuery={searchQuery}
        onChangeText={setSearchQuery}
        onClear={() => setSearchQuery("")}
        onRefresh={loadRealPokemonData}
        loading={loading}
        cardSection={cardSection}
      />

      <View style={homeStyles.body}>
        <View style={homeStyles.mainContent}>
          {/* Results bar */}
          <View style={homeStyles.resultsBar}>
            <Text style={homeStyles.resultsText}>{resultsLabel}</Text>
            <View style={homeStyles.sortRow}>
              <Text style={homeStyles.sortLabel}>Sort by: </Text>
              <Text style={homeStyles.sortValue}>
                {cuteMode ? "✨ Cuteness" : "Best Match"}
              </Text>
            </View>
          </View>

          {/* Cute AI error banner */}
          {cuteMode && cuteError && (
            <View
              style={{
                backgroundColor: "#fee2e2",
                borderRadius: 8,
                padding: 12,
                margin: 8,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ color: "#dc2626", fontSize: 13, flex: 1 }}>
                ⚠️ {cuteError}
              </Text>
              <TouchableOpacity
                onPress={retryScoring}
                style={{
                  marginLeft: 12,
                  backgroundColor: "#dc2626",
                  borderRadius: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text
                  style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}
                >
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Card grid */}
          <FlatList
            data={filteredCards}
            renderItem={renderCard}
            keyExtractor={(item, index) =>
              `${item.productId}-${index}-${cardSection}`
            }
            numColumns={numColumns}
            key={`${cardSection}-${numColumns}`}
            contentContainerStyle={homeStyles.gridContent}
            columnWrapperStyle={homeStyles.gridRow}
            onEndReachedThreshold={0.3}
            maxToRenderPerBatch={12}
            windowSize={10}
            removeClippedSubviews={true}
            ListFooterComponent={
              loadingMore ? (
                <View style={homeStyles.autoLoadingContainer}>
                  <ActivityIndicator size="small" color="#10b981" />
                  <Text style={homeStyles.autoLoadingText}>
                    Loading more cards...
                  </Text>
                </View>
              ) : null
            }
          />
        </View>
      </View>

      <CardDetailModal
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
        isInWishlist={selectedCard ? isInWishlist(selectedCard) : false}
        onToggleWishlist={toggleWishlist}
        isAlreadyHave={selectedCard ? isAlreadyHave(selectedCard) : false}
        onToggleAlreadyHave={toggleAlreadyHave}
      />
    </View>
  );
};

export default HomeScreen;
