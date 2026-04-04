import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import homeStyles from "../styles/homeStyles";

const RARITIES = [
  "all",
  "Common",
  "Uncommon",
  "Rare",
  "Rare Holo",
  "Ultra Rare",
  "Secret Rare",
];
const TYPES = ["all", "pokemon", "trainer", "energy"];

/**
 * Desktop left sidebar with rarity + type radio filters.
 *
 * Props:
 *  selectedRarity    string
 *  setSelectedRarity fn(val)
 *  selectedType      string
 *  setSelectedType   fn(val)
 *  searchQuery       string  (used to show Clear Filters button)
 *  clearFilters      fn()
 */
const SidebarFilters = ({
  selectedRarity,
  setSelectedRarity,
  selectedType,
  setSelectedType,
  searchQuery,
  clearFilters,
}) => {
  const hasActiveFilters =
    selectedRarity !== "all" || selectedType !== "all" || searchQuery;

  return (
    <View style={homeStyles.sidebar}>
      <Text style={homeStyles.sidebarHeading}>Filters</Text>

      <Text style={homeStyles.sidebarLabel}>Rarity</Text>
      {RARITIES.map((r) => {
        const value = r === "all" ? "all" : r.toLowerCase();
        return (
          <TouchableOpacity
            key={r}
            onPress={() => setSelectedRarity(value)}
            style={homeStyles.sidebarOption}
          >
            <View
              style={[
                homeStyles.sidebarRadio,
                selectedRarity === value && homeStyles.sidebarRadioActive,
              ]}
            />
            <Text style={homeStyles.sidebarOptionText}>
              {r === "all" ? "All Rarities" : r}
            </Text>
          </TouchableOpacity>
        );
      })}

      <View style={homeStyles.sidebarDivider} />

      <Text style={homeStyles.sidebarLabel}>Type</Text>
      {TYPES.map((t) => (
        <TouchableOpacity
          key={t}
          onPress={() => setSelectedType(t)}
          style={homeStyles.sidebarOption}
        >
          <View
            style={[
              homeStyles.sidebarRadio,
              selectedType === t && homeStyles.sidebarRadioActive,
            ]}
          />
          <Text style={homeStyles.sidebarOptionText}>
            {t === "all" ? "All Types" : t.charAt(0).toUpperCase() + t.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}

      {hasActiveFilters && (
        <>
          <View style={homeStyles.sidebarDivider} />
          <TouchableOpacity
            onPress={clearFilters}
            style={homeStyles.clearFiltersBtn}
          >
            <Text style={homeStyles.clearFiltersBtnText}>Clear Filters</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

export default SidebarFilters;
