import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import navbarStyles from "../styles/navbarStyles";

const Navbar = ({
  cardSection,
  setCardSection,
  cuteMode,
  setCuteMode,
  setCurrentView,
  wishlistCount,
  collectionCount,
  currentUser,
  onLogout,
  isResponsive,
}) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  return (
    <SafeAreaView edges={["top"]} style={navbarStyles.safeArea}>
      <View style={[navbarStyles.pill, isMobile && navbarStyles.pillMobile]}>
        {/* ── Logo circle ── */}
        <View
          style={[
            navbarStyles.logoCircle,
            isMobile && navbarStyles.logoCircleMobile,
          ]}
        >
          <Text
            style={[
              navbarStyles.logoEmoji,
              isMobile && navbarStyles.logoEmojiMobile,
            ]}
          >
            🎴
          </Text>
        </View>

        {/* ── Nav links ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            navbarStyles.linksList,
            isMobile && navbarStyles.linksListMobile,
          ]}
          style={navbarStyles.linksScroll}
        >
          <NavLink
            label="Trainers"
            active={cardSection === "trainers" && !cuteMode}
            isMobile={isMobile}
            onPress={() => {
              setCardSection("trainers");
              setCuteMode(false);
            }}
          />
          <NavLink
            label="All Cards"
            active={cardSection === "all" && !cuteMode}
            isMobile={isMobile}
            onPress={() => {
              setCardSection("all");
              setCuteMode(false);
            }}
          />
          <NavLink
            label="✨ Cute"
            cute={cuteMode}
            isMobile={isMobile}
            onPress={() => setCuteMode(!cuteMode)}
          />
          <NavLink
            label="⚓ One Piece"
            active={cardSection === "onePiece" && !cuteMode}
            isMobile={isMobile}
            onPress={() => {
              setCardSection("onePiece");
              setCuteMode(false);
            }}
          />
          <NavLink
            label={`Wishlist${wishlistCount > 0 ? ` (${wishlistCount})` : ""}`}
            isMobile={isMobile}
            onPress={() => setCurrentView("wishlist")}
          />
          <NavLink
            label={`Collection${collectionCount > 0 ? ` (${collectionCount})` : ""}`}
            isMobile={isMobile}
            onPress={() => setCurrentView("collection")}
          />
          {!isMobile && (
            <NavLink label="AI Chat" onPress={() => setCurrentView("chat")} />
          )}
        </ScrollView>

        {/* ── User pill ── */}
        <TouchableOpacity
          onPress={onLogout}
          style={[
            navbarStyles.userPill,
            isMobile && navbarStyles.userPillMobile,
          ]}
        >
          {isMobile ? (
            <Text style={navbarStyles.userPillIcon}>👤</Text>
          ) : (
            <Text style={navbarStyles.userPillText} numberOfLines={1}>
              {currentUser?.email || currentUser?.username || "Logout"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const NavLink = ({ label, active, cute, isMobile, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      navbarStyles.link,
      isMobile && navbarStyles.linkMobile,
      active && navbarStyles.linkActive,
      cute && navbarStyles.linkCute,
    ]}
  >
    <Text
      style={[
        navbarStyles.linkText,
        isMobile && navbarStyles.linkTextMobile,
        active && navbarStyles.linkTextActive,
        cute && navbarStyles.linkTextCute,
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

export default Navbar;
