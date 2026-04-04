import React from "react";
import { ScrollView, TouchableOpacity, Text } from "react-native";
import homeStyles from "../styles/homeStyles";

const RARITY_CHIPS = ["all", "common", "uncommon", "rare", "ultra rare"];

/**
 * Horizontal scrollable chip bar for mobile filter quick-picks.
 *
 * Props:
 *  cuteMode          bool
 *  setCuteMode       fn(bool)
 *  selectedRarity    string
 *  setSelectedRarity fn(val)
 *  selectedType      string
 *  setSelectedType   fn(val)
 */
const FilterChips = ({
  cuteMode,
  setCuteMode,
  selectedRarity,
  setSelectedRarity,
  selectedType,
  setSelectedType,
}) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={homeStyles.chipRow}
    contentContainerStyle={homeStyles.chipRowInner}
  >
    {/* Cute toggle */}
    <TouchableOpacity
      onPress={() => setCuteMode(!cuteMode)}
      style={[homeStyles.chip, cuteMode && homeStyles.chipCute]}
    >
      <Text style={[homeStyles.chipText, cuteMode && homeStyles.chipTextCute]}>
        ✨ Cute
      </Text>
    </TouchableOpacity>

    {/* Rarity chips */}
    {RARITY_CHIPS.map((r) => (
      <TouchableOpacity
        key={r}
        onPress={() => setSelectedRarity(r)}
        style={[homeStyles.chip, selectedRarity === r && homeStyles.chipActive]}
      >
        <Text
          style={[
            homeStyles.chipText,
            selectedRarity === r && homeStyles.chipTextActive,
          ]}
        >
          {r === "all" ? "All" : r.charAt(0).toUpperCase() + r.slice(1)}
        </Text>
      </TouchableOpacity>
    ))}

    {/* Active type chip (shows as removable tag) */}
    {selectedType !== "all" && (
      <TouchableOpacity
        onPress={() => setSelectedType("all")}
        style={homeStyles.chipActive}
      >
        <Text style={homeStyles.chipTextActive}>{selectedType} ✕</Text>
      </TouchableOpacity>
    )}
  </ScrollView>
);

export default FilterChips;
