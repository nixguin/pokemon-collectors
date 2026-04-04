import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
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
}) => (
  <SafeAreaView edges={["top"]} style={navbarStyles.safeArea}>
    <View style={navbarStyles.pill}>
      {/* ── Logo circle ── */}
      <View style={navbarStyles.logoCircle}>
        <Text style={navbarStyles.logoEmoji}>🎴</Text>
      </View>

      {/* ── Nav links ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={navbarStyles.linksList}
        style={navbarStyles.linksScroll}
      >
        <NavLink
          label={isResponsive ? "Trainers" : "Trainer Cards"}
          active={cardSection === "trainers" && !cuteMode}
          onPress={() => {
            setCardSection("trainers");
            setCuteMode(false);
          }}
        />
        <NavLink
          label="All Cards"
          active={cardSection === "all" && !cuteMode}
          onPress={() => {
            setCardSection("all");
            setCuteMode(false);
          }}
        />
        <NavLink
          label={isResponsive ? "✨ Cute" : "✨ Cute Cards"}
          cute={cuteMode}
          onPress={() => setCuteMode(!cuteMode)}
        />
        <NavLink
          label={`Wishlist${wishlistCount > 0 ? ` (${wishlistCount})` : ""}`}
          onPress={() => setCurrentView("wishlist")}
        />
        <NavLink
          label={`Collection${collectionCount > 0 ? ` (${collectionCount})` : ""}`}
          onPress={() => setCurrentView("collection")}
        />
        <NavLink label="AI Chat" onPress={() => setCurrentView("chat")} />
      </ScrollView>

      {/* ── User pill ── */}
      <TouchableOpacity onPress={onLogout} style={navbarStyles.userPill}>
        <Text style={navbarStyles.userPillText} numberOfLines={1}>
          {currentUser?.email || currentUser?.username || "Logout"}
        </Text>
      </TouchableOpacity>
    </View>
  </SafeAreaView>
);

const NavLink = ({ label, active, cute, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      navbarStyles.link,
      active && navbarStyles.linkActive,
      cute && navbarStyles.linkCute,
    ]}
  >
    <Text
      style={[
        navbarStyles.linkText,
        active && navbarStyles.linkTextActive,
        cute && navbarStyles.linkTextCute,
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

export default Navbar;
