import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import cardItemStyles from "../styles/cardItemStyles";

const rarityColor = (rarity = "") => {
  const r = rarity.toLowerCase();
  if (r.includes("rare holo") || r.includes("ultra")) return "#f59e0b";
  if (r.includes("secret") || r.includes("hyper")) return "#a78bfa";
  if (r.includes("uncommon")) return "#34d399";
  return "#9ca3af";
};

const CardItem = ({
  card,
  isInWishlist,
  onToggleWishlist,
  isAlreadyHave,
  onToggleAlreadyHave,
  onPress,
}) => {
  const data =
    card.extendedData?.reduce((acc, d) => {
      acc[d.name] = d.value;
      return acc;
    }, {}) || {};

  const setName = data.SetName || card.groupName || "Unknown Set";
  const cardType = data.CardType || "Trainer";
  const rarity = data.Rarity || "Common";
  const cardNumber = data.Number || "";
  const price = data.Price;
  const priceDisplay = price && price !== "N/A" ? `$${price}` : "Price TBD";
  const color = rarityColor(rarity);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={cardItemStyles.card}
    >
      {/* Image */}
      <View style={cardItemStyles.imageWrapper}>
        <Image
          source={{
            uri:
              card.imageUrl ||
              "https://via.placeholder.com/200x280/1e293b/ffffff?text=No+Image",
          }}
          style={cardItemStyles.image}
          resizeMode="contain"
        />
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation?.();
            onToggleWishlist(card);
          }}
          style={[
            cardItemStyles.wishlistBtn,
            { backgroundColor: isInWishlist ? "#f43f5e" : "#10b981" },
          ]}
        >
          <Text style={cardItemStyles.wishlistBtnText}>
            {isInWishlist ? "♥" : "+"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={cardItemStyles.content}>
        <Text style={cardItemStyles.name} numberOfLines={2}>
          {card.name}
        </Text>
        <Text style={cardItemStyles.setName} numberOfLines={1}>
          {setName}
          {cardNumber ? ` • ${cardNumber}` : ""}
        </Text>
        <View style={cardItemStyles.metaRow}>
          <Text style={[cardItemStyles.rarityBadge, { color }]}>{rarity}</Text>
          {cardType && (
            <Text style={cardItemStyles.typeBadge}>
              {cardType.split(" - ")[1] || cardType}
            </Text>
          )}
        </View>
        <View style={cardItemStyles.footer}>
          <Text style={cardItemStyles.price}>{priceDisplay}</Text>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation?.();
              onToggleAlreadyHave(card);
            }}
            style={[
              cardItemStyles.ownedBtn,
              { backgroundColor: isAlreadyHave ? "#059669" : "#374151" },
            ]}
          >
            <Text style={cardItemStyles.ownedBtnText}>
              {isAlreadyHave ? "✓ Owned" : "Own it"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default CardItem;
