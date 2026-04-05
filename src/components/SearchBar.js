import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import homeStyles from "../styles/homeStyles";

/**
 * Top search bar with clear button and refresh button.
 *
 * Props:
 *  searchQuery   string
 *  onChangeText  fn(text)
 *  onClear       fn()
 *  onRefresh     fn()
 *  loading       bool
 *  cardSection   "all" | "trainers"
 */
const SearchBar = ({
  searchQuery,
  onChangeText,
  onClear,
  onRefresh,
  loading,
  cardSection,
}) => (
  <View style={homeStyles.searchSection}>
    <View style={homeStyles.searchInputWrapper}>
      <Text style={homeStyles.searchIcon}>🔍</Text>
      <TextInput
        value={searchQuery}
        onChangeText={onChangeText}
        placeholder={`Search ${cardSection === "all" ? "any card" : "trainer cards"} or set name...`}
        placeholderTextColor="#6b7280"
        style={homeStyles.searchInput}
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={onClear} style={homeStyles.searchClearBtn}>
          <Text style={homeStyles.searchClearText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>

    <TouchableOpacity
      onPress={onRefresh}
      style={[homeStyles.refreshBtn, loading && { opacity: 0.5 }]}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color="white" />
      ) : (
        <Text style={homeStyles.refreshBtnText}>Refresh</Text>
      )}
    </TouchableOpacity>
  </View>
);

export default SearchBar;
