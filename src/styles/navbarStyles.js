import { StyleSheet } from "react-native";
import colors from "./colors";

const navbarStyles = StyleSheet.create({
  safeArea: {
    backgroundColor: "transparent",
    zIndex: 100,
  },

  // Floating pink pill
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryDark, // #be185d deep pink
    borderRadius: 999,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
    paddingRight: 6,
    paddingLeft: 6,
    paddingVertical: 6,
    // Shadow
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },

  // Left circle logo
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
    flexShrink: 0,
  },
  logoEmoji: {
    fontSize: 18,
  },

  // Scrollable links strip
  linksScroll: {
    flex: 1,
  },
  linksList: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    gap: 2,
  },

  link: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  linkActive: {
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  linkCute: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  linkText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontWeight: "500",
  },
  linkTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  linkTextCute: {
    color: "#ffffff",
    fontWeight: "700",
  },

  // Right user pill
  userPill: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
    flexShrink: 0,
    maxWidth: 180,
  },
  userPillMobile: {
    width: 34,
    height: 34,
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  userPillIcon: {
    fontSize: 16,
  },
  userPillText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },

  // Mobile overrides
  pillMobile: {
    marginHorizontal: 8,
    marginTop: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  logoCircleMobile: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 2,
  },
  logoEmojiMobile: {
    fontSize: 15,
  },
  linksListMobile: {
    gap: 0,
    paddingHorizontal: 2,
  },
  linkMobile: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  linkTextMobile: {
    fontSize: 12,
  },
});

export default navbarStyles;
