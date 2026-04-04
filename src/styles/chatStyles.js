import { StyleSheet } from "react-native";
import colors from "./colors";

const chatStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primaryBg,
  },
  navbar: {
    backgroundColor: colors.primaryLight,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
  },
  navBackBtn: {
    marginRight: 16,
  },
  navBackText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "600",
  },
  navTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  messageList: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: colors.primaryBg,
  },
  messageBubble: {
    marginVertical: 4,
    padding: 12,
    borderRadius: 12,
    maxWidth: "80%",
  },
  botBubble: {
    backgroundColor: colors.white,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
  },
  userBubble: {
    backgroundColor: colors.primary,
    alignSelf: "flex-end",
  },
  botText: {
    color: colors.textMid,
  },
  userText: {
    color: colors.white,
  },
  inputRow: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.primaryBg,
    color: colors.textDark,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: "center",
  },
  sendBtnText: {
    color: colors.white,
    fontWeight: "700",
  },
  cardResultsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  cardResult: {
    width: 80,
    marginRight: 8,
    marginBottom: 8,
  },
  cardResultImage: {
    width: 80,
    height: 112,
    borderRadius: 8,
    backgroundColor: colors.primaryPale,
  },
  cardResultName: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 4,
    color: colors.textMuted,
  },
});

export default chatStyles;
