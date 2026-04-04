import { StyleSheet } from "react-native";
import colors from "./colors";

const homeStyles = StyleSheet.create({
  // Layout
  container: {
    flex: 1,
    backgroundColor: colors.primaryBg,
  },
  body: {
    flex: 1,
    flexDirection: "row",
  },

  // Search bar
  searchSection: {
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  searchInputWrapper: {
    flex: 1,
    backgroundColor: colors.primaryBg,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textDark,
  },
  searchClearBtn: {
    paddingLeft: 8,
  },
  searchClearText: {
    color: colors.textFaint,
    fontSize: 14,
  },
  refreshBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 72,
    alignItems: "center",
  },
  refreshBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },

  // Sidebar (desktop only)
  sidebar: {
    width: 180,
    backgroundColor: colors.white,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  sidebarHeading: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  sidebarLabel: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 8,
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  sidebarOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
  },
  sidebarRadio: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.inputBorder,
    marginRight: 10,
  },
  sidebarRadioActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  sidebarOptionText: {
    color: colors.textMid,
    fontSize: 13,
  },
  clearFiltersBtn: {
    marginTop: 8,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: colors.primaryPale,
    alignItems: "center",
  },
  clearFiltersBtnText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "600",
  },

  // Main content area
  mainContent: {
    flex: 1,
    minWidth: 0,
  },

  // Mobile filter chips
  chipRow: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chipRowInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.white,
  },
  chipActive: {
    backgroundColor: colors.primaryPale,
    borderColor: colors.primary,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipCute: {
    backgroundColor: colors.accentPurplePale,
    borderColor: colors.accentPurple,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipText: {
    color: colors.textFaint,
    fontSize: 14,
    fontWeight: "500",
  },
  chipTextActive: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  chipTextCute: {
    color: colors.accentPurple,
    fontSize: 14,
    fontWeight: "700",
  },

  // Results bar
  resultsBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultsText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sortLabel: {
    color: colors.textFaint,
    fontSize: 13,
  },
  sortValue: {
    color: colors.textMid,
    fontSize: 13,
    fontWeight: "600",
  },

  // Card grid
  gridContent: {
    padding: 10,
  },
  gridRow: {
    justifyContent: "flex-start",
    marginBottom: 10,
  },

  // Loading / misc
  loadingSpinner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingStatus: {
    fontSize: 12,
    color: colors.primary,
    fontStyle: "italic",
    marginTop: 4,
  },
  autoLoadingContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  autoLoadingText: {
    marginLeft: 8,
    color: colors.textFaint,
    fontSize: 14,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textFaint,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textFaintest,
    textAlign: "center",
  },

  // Owned card overlay
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
  ownedCardContainer: {
    opacity: 0.85,
  },
});

export default homeStyles;
