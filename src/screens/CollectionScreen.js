import React from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import CardItem from "../components/CardItem";
import {
  screenBaseStyles,
  screenNavStyles,
  emptyStateStyles,
  gridStyles,
} from "../styles/screenStyles";

/**
 * Props:
 *  alreadyHave         array
 *  toggleWishlist      fn(card)
 *  toggleAlreadyHave   fn(card)
 *  isInWishlist        fn(card) => bool
 *  numColumns          number
 *  onBack              fn()
 */
const CollectionScreen = ({
  alreadyHave,
  toggleWishlist,
  toggleAlreadyHave,
  isInWishlist,
  numColumns,
  onBack,
}) => (
  <SafeAreaProvider>
    <View style={screenBaseStyles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={screenNavStyles.navbar} edges={["top"]}>
        <TouchableOpacity onPress={onBack} style={screenNavStyles.backBtn}>
          <Text style={screenNavStyles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={screenNavStyles.title}>My Collection</Text>
        <View style={{ width: 60 }} />
      </SafeAreaView>

      {alreadyHave.length === 0 ? (
        <View style={emptyStateStyles.container}>
          <Text style={emptyStateStyles.title}>Your collection is empty</Text>
          <Text style={emptyStateStyles.subtitle}>
            Mark cards as owned from the home page!
          </Text>
        </View>
      ) : (
        <FlatList
          data={alreadyHave}
          renderItem={({ item }) => (
            <CardItem
              card={item}
              isInWishlist={isInWishlist(item)}
              onToggleWishlist={toggleWishlist}
              isAlreadyHave={true}
              onToggleAlreadyHave={toggleAlreadyHave}
            />
          )}
          keyExtractor={(item, index) =>
            `collection-${item.productId}-${index}`
          }
          numColumns={numColumns}
          key={`collection-${numColumns}`}
          contentContainerStyle={gridStyles.content}
        />
      )}
    </View>
  </SafeAreaProvider>
);

export default CollectionScreen;
