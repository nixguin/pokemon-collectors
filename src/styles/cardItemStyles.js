import { StyleSheet } from "react-native";
import colors from "./colors";

const cardItemStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    overflow: "hidden",
    flex: 1,
    margin: 5,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primaryLight,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  imageWrapper: {
    backgroundColor: colors.primaryBg,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    position: "relative",
  },
  image: {
    width: "100%",
    height: 160,
    resizeMode: "contain",
  },
  wishlistBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  wishlistBtnText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 20,
  },
  content: {
    padding: 8,
  },
  name: {
    color: colors.textDark,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
    lineHeight: 16,
  },
  setName: {
    color: colors.textFaint,
    fontSize: 9,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 4,
  },
  rarityBadge: {
    fontSize: 10,
    fontWeight: "600",
  },
  typeBadge: {
    color: colors.textFaint,
    fontSize: 9,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
    flexWrap: "wrap",
    gap: 4,
  },
  price: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "700",
  },
  ownedBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ownedBtnText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "600",
  },
});

export default cardItemStyles;
