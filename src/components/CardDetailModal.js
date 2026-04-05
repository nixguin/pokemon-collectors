import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from "react-native";

const CardDetailModal = ({
  card,
  onClose,
  isInWishlist,
  onToggleWishlist,
  isAlreadyHave,
  onToggleAlreadyHave,
}) => {
  const { width: modalWidth, height: modalHeight } = useWindowDimensions();
  const isModalMobile = modalWidth < 768;
  const [livePrice, setLivePrice] = useState(null);
  const [livePriceLoading, setLivePriceLoading] = useState(false);

  useEffect(() => {
    if (!card) return;
    setLivePrice(null);
    setLivePriceLoading(true);

    const isOnePiece =
      card.cardGame === "OnePiece" ||
      String(card.productId || "").startsWith("op_");

    const isTCGCSVPokemon =
      card.cardGame === "PokemonTCGCSV" ||
      String(card.productId || "").startsWith("pk3_");

    const isJapanesePokemon =
      card.cardGame === "JapanesePokemon" ||
      String(card.productId || "").startsWith("jp_");

    const fetchPrice = async () => {
      try {
        if (isOnePiece) {
          const numericId = String(card.productId).replace(/^op_/, "");
          const groupId = card.groupId;
          if (!groupId) return;
          const res = await fetch(
            `https://tcgcsv.com/tcgplayer/68/${groupId}/prices`,
          );
          if (!res.ok) return;
          const json = await res.json();
          // Keep the highest marketPrice across subTypes (Normal/Foil)
          let best = null;
          for (const p of json.results || []) {
            if (String(p.productId) === numericId && p.marketPrice != null) {
              if (best === null || p.marketPrice > best) best = p.marketPrice;
            }
          }
          if (best !== null) setLivePrice(best);
        } else if (isTCGCSVPokemon) {
          const numericId = String(card.productId).replace(/^pk3_/, "");
          const groupId = card.groupId;
          if (!groupId) return;
          const res = await fetch(
            `https://tcgcsv.com/tcgplayer/3/${groupId}/prices`,
          );
          if (!res.ok) return;
          const json = await res.json();
          let best = null;
          for (const p of json.results || []) {
            if (String(p.productId) === numericId && p.marketPrice != null) {
              if (best === null || p.marketPrice > best) best = p.marketPrice;
            }
          }
          if (best !== null) setLivePrice(best);
        } else if (isJapanesePokemon) {
          const numericId = String(card.productId).replace(/^jp_/, "");
          const groupId = card.groupId;
          if (!groupId) return;
          const res = await fetch(
            `https://tcgcsv.com/tcgplayer/85/${groupId}/prices`,
          );
          if (!res.ok) return;
          const json = await res.json();
          let best = null;
          for (const p of json.results || []) {
            if (String(p.productId) === numericId && p.marketPrice != null) {
              if (best === null || p.marketPrice > best) best = p.marketPrice;
            }
          }
          if (best !== null) setLivePrice(best);
        } else {
          // Pokemon TCG API
          const res = await fetch(
            `https://api.pokemontcg.io/v2/cards/${card.productId}?select=id,tcgplayer`,
          );
          if (!res.ok) return;
          const json = await res.json();
          const prices = json.data?.tcgplayer?.prices || {};
          const SUBTYPES = [
            "holofoil",
            "normal",
            "reverseHolofoil",
            "1stEditionHolofoil",
            "unlimitedHolofoil",
            "1stEditionNormal",
            "unlimitedNormal",
            "specialIllustrationRare",
            "illustrationRare",
            "doubleRare",
            "hyperRare",
            "aceSpec",
            "shiny",
            "shinyHoloRare",
          ];
          let market = null;
          for (const s of SUBTYPES) {
            if (prices[s]?.market != null) {
              market = prices[s].market;
              break;
            }
          }
          if (market == null) {
            for (const s of SUBTYPES) {
              if (prices[s]?.mid != null) {
                market = prices[s].mid;
                break;
              }
            }
          }
          if (market == null) {
            for (const s of SUBTYPES) {
              if (prices[s]?.low != null) {
                market = prices[s].low;
                break;
              }
            }
          }
          if (market != null) setLivePrice(market);
        }
      } catch {
        // silently fall back to stored price
      } finally {
        setLivePriceLoading(false);
      }
    };

    fetchPrice();
  }, [card?.productId]);

  if (!card) return null;

  const cardData =
    card.extendedData?.reduce((acc, d) => {
      acc[d.name] = d.value;
      return acc;
    }, {}) || {};

  const setName = cardData.SetName || card.groupName || "Unknown Set";
  const cardType = cardData.CardType || "Trainer";
  const rarity = cardData.Rarity || "Common";
  const cardNumber = cardData.Number || "";
  const storedPrice = cardData.Price;
  const priceDisplay = livePriceLoading
    ? "Fetching..."
    : livePrice !== null
      ? `$${parseFloat(livePrice).toFixed(2)}`
      : storedPrice && storedPrice !== "N/A" && storedPrice !== ""
        ? `$${parseFloat(storedPrice).toFixed(2)}`
        : "N/A";

  const rarityColor = rarity.toLowerCase().includes("ultra")
    ? "#f59e0b"
    : rarity.toLowerCase().includes("secret") ||
        rarity.toLowerCase().includes("hyper")
      ? "#a78bfa"
      : rarity.toLowerCase().includes("uncommon")
        ? "#34d399"
        : "#9ca3af";

  const ebaySearch = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(card.name + " pokemon card")}`;
  const tcgSearch = `https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${encodeURIComponent(card.name)}`;

  return (
    <Modal
      visible={!!card}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={[
          styles.backdrop,
          isModalMobile && { padding: 0, justifyContent: "flex-end" },
        ]}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.container,
            isModalMobile && {
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              maxHeight: modalHeight * 0.92,
              width: "100%",
            },
          ]}
          onPress={() => {}}
        >
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false}>
            {isModalMobile && <View style={styles.dragHandle} />}

            <Text style={styles.cardName}>{card.name}</Text>
            <Text style={styles.cardMeta}>
              {setName}
              {cardNumber ? ` • ${cardNumber}` : ""}
            </Text>
            <View style={styles.rarityRow}>
              <Text style={[styles.rarityBadge, { color: rarityColor }]}>
                {rarity}
              </Text>
              {cardType && <Text style={styles.typeBadge}>{cardType}</Text>}
            </View>

            <View
              style={[
                styles.body,
                { flexDirection: isModalMobile ? "column" : "row" },
              ]}
            >
              {/* Image */}
              <View
                style={[
                  styles.imageSection,
                  isModalMobile && { marginBottom: 16 },
                ]}
              >
                <Image
                  source={{
                    uri:
                      card.imageUrl ||
                      "https://via.placeholder.com/300x420/fce7f3/ec4899?text=No+Image",
                  }}
                  style={[
                    styles.cardImage,
                    {
                      width: isModalMobile ? modalWidth * 0.45 : 260,
                      height: isModalMobile ? modalWidth * 0.63 : 364,
                    },
                  ]}
                  resizeMode="contain"
                />
              </View>

              {/* Right panel */}
              <View style={styles.infoSection}>
                <View style={styles.priceBox}>
                  <Text style={styles.priceLabel}>Market Price</Text>
                  <Text style={styles.priceValue}>{priceDisplay}</Text>
                </View>

                <TouchableOpacity
                  onPress={() => onToggleWishlist(card)}
                  style={[
                    styles.actionBtn,
                    { backgroundColor: isInWishlist ? "#f43f5e" : "#ec4899" },
                  ]}
                >
                  <Text style={styles.actionBtnText}>
                    {isInWishlist
                      ? "♥  Remove from Wishlist"
                      : "♡  Add to Wishlist"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => onToggleAlreadyHave(card)}
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: isAlreadyHave ? "#059669" : "#374151",
                      marginTop: 10,
                    },
                  ]}
                >
                  <Text style={styles.actionBtnText}>
                    {isAlreadyHave
                      ? "✓  In My Collection"
                      : "+  Add to Collection"}
                  </Text>
                </TouchableOpacity>

                {/* Details table */}
                <View style={styles.detailsBox}>
                  <Text style={styles.sectionHeading}>Details</Text>
                  {[
                    { label: "Set", value: setName },
                    { label: "Rarity", value: rarity, color: rarityColor },
                    ...(cardNumber
                      ? [{ label: "Card #", value: cardNumber }]
                      : []),
                    { label: "Type", value: cardType },
                  ].map(({ label, value, color }) => (
                    <View key={label} style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{label}</Text>
                      <Text style={[styles.detailValue, color && { color }]}>
                        {value}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Shop links */}
                <View style={styles.shopBox}>
                  <Text style={styles.sectionHeading}>Shop</Text>
                  {[
                    {
                      name: "TCGPlayer",
                      url: tcgSearch,
                      label: "View listings →",
                    },
                    { name: "eBay", url: ebaySearch, label: "Check latest →" },
                  ].map(({ name, url, label }) => (
                    <TouchableOpacity
                      key={name}
                      style={styles.shopRow}
                      onPress={() =>
                        Platform.OS === "web" && window.open(url, "_blank")
                      }
                    >
                      <Text style={styles.shopName}>{name}</Text>
                      <Text style={styles.shopLink}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  container: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 780,
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 16,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#e5e7eb",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { color: "#374151", fontSize: 14, fontWeight: "700" },
  cardName: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 4,
    paddingRight: 40,
  },
  cardMeta: { fontSize: 14, color: "#6b7280", marginBottom: 8 },
  rarityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  rarityBadge: { fontSize: 13, fontWeight: "700" },
  typeBadge: {
    fontSize: 13,
    color: "#9ca3af",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  body: { gap: 24 },
  imageSection: { alignItems: "center", justifyContent: "flex-start" },
  cardImage: { borderRadius: 10, backgroundColor: "#fdf2f8" },
  infoSection: { flex: 1, minWidth: 0 },
  priceBox: {
    backgroundColor: "#fdf2f8",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fce7f3",
  },
  priceLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  priceValue: { fontSize: 28, fontWeight: "900", color: "#ec4899" },
  actionBtn: { paddingVertical: 13, borderRadius: 10, alignItems: "center" },
  actionBtnText: { color: "white", fontSize: 15, fontWeight: "700" },
  detailsBox: {
    marginTop: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  shopBox: {
    marginTop: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "800",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  detailLabel: { fontSize: 13, color: "#9ca3af", fontWeight: "600" },
  detailValue: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
    marginLeft: 8,
  },
  shopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  shopName: { fontSize: 13, color: "#374151", fontWeight: "700" },
  shopLink: { fontSize: 13, color: "#ec4899", fontWeight: "600" },
});

export default CardDetailModal;
