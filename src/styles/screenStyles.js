import { StyleSheet } from "react-native";
import colors from "./colors";

// Shared page container used by all detail screens
const screenBaseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primaryBg,
  },
});

// Shared nav bar used by WishlistScreen and CollectionScreen
const screenNavStyles = StyleSheet.create({
  navbar: {
    backgroundColor: colors.primaryLight,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
  },
  backBtn: {
    marginRight: 16,
  },
  backBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "600",
  },
  title: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  actionBtn: {
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
  },
});

// Shared empty state used by WishlistScreen and CollectionScreen
const emptyStateStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textFaint,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textFaintest,
    textAlign: "center",
  },
});

// Shared grid content padding
const gridStyles = StyleSheet.create({
  content: { padding: 10 },
  ownedCardContainer: { opacity: 0.85 },
  ownedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    elevation: 4,
  },
  ownedBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "700",
  },
});

export { screenBaseStyles, screenNavStyles, emptyStateStyles, gridStyles };
