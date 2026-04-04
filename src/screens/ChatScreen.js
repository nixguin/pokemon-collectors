import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { getRarityValue } from "../utils/rarityUtils";
import {
  findCuteCards,
  isCuteQuery,
  getCutenessReason,
} from "../services/cutenessAI";
import chatStyles from "../styles/chatStyles";

/**
 * Props:
 *  allPokemonCards   array
 *  trainerCards      array
 *  cardSection       "all" | "trainers"
 *  onBack            fn()
 */
const ChatScreen = ({ allPokemonCards, trainerCards, cardSection, onBack }) => {
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      text: "Hi! I can help you find Pokemon cards. Ask me about specific cards, rarities (common, rare, ultra rare), types (pokemon, trainer, energy), or sets!",
      isBot: true,
    },
  ]);
  const [chatInput, setChatInput] = useState("");

  const sendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = { id: Date.now(), text: chatInput, isBot: false };
    const query = chatInput.toLowerCase();
    let botResponse = "";
    let foundCards = [];

    const cardsToSearch =
      cardSection === "all" ? allPokemonCards : trainerCards;

    if (query.includes("rare") || query.includes("rarity")) {
      if (query.includes("common")) {
        foundCards = cardsToSearch.filter((card) =>
          card.extendedData
            ?.find((d) => d.name === "Rarity")
            ?.value?.toLowerCase()
            .includes("common"),
        );
        botResponse = `Found ${foundCards.length} common cards! Common cards are the most basic rarity.`;
      } else if (query.includes("uncommon")) {
        foundCards = cardsToSearch.filter((card) =>
          card.extendedData
            ?.find((d) => d.name === "Rarity")
            ?.value?.toLowerCase()
            .includes("uncommon"),
        );
        botResponse = `Found ${foundCards.length} uncommon cards! These are slightly rarer than common cards.`;
      } else if (query.includes("ultra rare") || query.includes("ultra")) {
        foundCards = cardsToSearch.filter((card) =>
          card.extendedData
            ?.find((d) => d.name === "Rarity")
            ?.value?.toLowerCase()
            .includes("ultra"),
        );
        botResponse = `Found ${foundCards.length} ultra rare cards! These are very special and valuable cards.`;
      } else if (
        query.includes("higher than") ||
        query.includes("above") ||
        query.includes("better than")
      ) {
        const rarityMatch = query.match(
          /(higher than|above|better than)\s+(\w+\s*\w*)/,
        );
        if (rarityMatch) {
          const targetRarity = rarityMatch[2].trim();
          const targetValue = getRarityValue(targetRarity);
          foundCards = cardsToSearch.filter((card) => {
            const cardRarity =
              card.extendedData?.find((d) => d.name === "Rarity")?.value || "";
            return getRarityValue(cardRarity) > targetValue;
          });
          botResponse = `Found ${foundCards.length} cards with rarity higher than ${targetRarity}!`;
        }
      } else if (
        query.includes("lower than") ||
        query.includes("below") ||
        query.includes("worse than")
      ) {
        const rarityMatch = query.match(
          /(lower than|below|worse than)\s+(\w+\s*\w*)/,
        );
        if (rarityMatch) {
          const targetRarity = rarityMatch[2].trim();
          const targetValue = getRarityValue(targetRarity);
          foundCards = cardsToSearch.filter((card) => {
            const cardRarity =
              card.extendedData?.find((d) => d.name === "Rarity")?.value || "";
            return getRarityValue(cardRarity) < targetValue;
          });
          botResponse = `Found ${foundCards.length} cards with rarity lower than ${targetRarity}.`;
        }
      } else {
        foundCards = cardsToSearch.filter((card) =>
          card.extendedData
            ?.find((d) => d.name === "Rarity")
            ?.value?.toLowerCase()
            .includes("rare"),
        );
        botResponse = `Found ${foundCards.length} rare cards! These include regular rare and ultra rare cards.`;
      }
    } else if (query.includes("mimikyu")) {
      foundCards = cardsToSearch.filter((card) =>
        card.name.toLowerCase().includes("mimikyu"),
      );
      botResponse =
        foundCards.length === 0
          ? "I couldn't find any Mimikyu cards in the current data. Try using the Refresh button to load more cards!"
          : `Found ${foundCards.length} Mimikyu cards! Mimikyu is such a beloved Pokemon! 👻`;
    } else if (
      query.includes("trainer") ||
      query.includes("supporter") ||
      query.includes("item") ||
      query.includes("stadium")
    ) {
      foundCards = cardsToSearch.filter((card) => {
        const cardType =
          card.extendedData
            ?.find((d) => d.name === "CardType")
            ?.value?.toLowerCase() || "";
        return (
          cardType.includes("trainer") ||
          cardType.includes("supporter") ||
          cardType.includes("item") ||
          cardType.includes("stadium")
        );
      });
      botResponse = `Found ${foundCards.length} trainer cards! These include supporters, items, stadiums, and tools.`;
    } else if (query.includes("pokemon")) {
      foundCards = cardsToSearch.filter((card) => {
        const cardType =
          card.extendedData
            ?.find((d) => d.name === "CardType")
            ?.value?.toLowerCase() || "";
        return (
          cardType.includes("pokemon") ||
          (!cardType.includes("trainer") && !cardType.includes("energy"))
        );
      });
      botResponse = `Found ${foundCards.length} Pokemon cards! These are the creature cards you use to battle.`;
    } else if (query.includes("energy")) {
      foundCards = cardsToSearch.filter((card) => {
        const cardType =
          card.extendedData
            ?.find((d) => d.name === "CardType")
            ?.value?.toLowerCase() || "";
        return cardType.includes("energy");
      });
      botResponse = `Found ${foundCards.length} energy cards! These power your Pokemon's attacks.`;
    } else if (isCuteQuery(query)) {
      foundCards = await findCuteCards(cardsToSearch, {
        minScore: 0.45,
        limit: 12,
      });
      if (foundCards.length > 0) {
        const topCard = foundCards[0];
        botResponse = `Found ${foundCards.length} cute cards using Cuteness AI! ✨ Top pick: ${topCard.name} — ${getCutenessReason(topCard)} You can also toggle "✨ Cute Cards" in the nav to browse all cute cards!`;
      } else {
        botResponse =
          "I couldn't find cute cards in the current set. Try loading more cards with the Refresh button!";
      }
    } else {
      foundCards = cardsToSearch.filter(
        (card) =>
          card.name.toLowerCase().includes(query) ||
          card.cleanName.toLowerCase().includes(query),
      );
      botResponse =
        foundCards.length > 0
          ? `Found ${foundCards.length} cards matching "${chatInput}"! ${foundCards
              .slice(0, 3)
              .map((c) => c.name)
              .join(", ")}${foundCards.length > 3 ? "..." : ""}`
          : `No cards found matching "${chatInput}". Try searching for card names, rarities, types (pokemon, trainer, energy), or ask me to "find cute cards"!`;
    }

    const botMessage = {
      id: Date.now() + 1,
      text: botResponse,
      isBot: true,
      cards: foundCards.slice(0, 6),
    };

    setChatMessages([...chatMessages, userMessage, botMessage]);
    setChatInput("");
  };

  const renderChatMessage = ({ item }) => (
    <View
      style={[
        chatStyles.messageBubble,
        item.isBot ? chatStyles.botBubble : chatStyles.userBubble,
      ]}
    >
      <Text style={item.isBot ? chatStyles.botText : chatStyles.userText}>
        {item.text}
      </Text>
      {item.cards && item.cards.length > 0 && (
        <View style={chatStyles.cardResultsRow}>
          {item.cards.map((card, index) => (
            <View key={index} style={chatStyles.cardResult}>
              <Image
                source={{ uri: card.imageUrl }}
                style={chatStyles.cardResultImage}
              />
              <Text style={chatStyles.cardResultName} numberOfLines={2}>
                {card.name}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaProvider>
      <View style={chatStyles.container}>
        <StatusBar style="dark" />
        <SafeAreaView style={chatStyles.navbar} edges={["top"]}>
          <TouchableOpacity onPress={onBack} style={chatStyles.navBackBtn}>
            <Text style={chatStyles.navBackText}>← Back</Text>
          </TouchableOpacity>
          <Text style={chatStyles.navTitle}>AI Assistant</Text>
          <View style={{ width: 60 }} />
        </SafeAreaView>

        <FlatList
          data={chatMessages}
          renderItem={renderChatMessage}
          keyExtractor={(item) => item.id.toString()}
          style={chatStyles.messageList}
        />

        <SafeAreaView edges={["bottom"]} style={chatStyles.inputRow}>
          <TextInput
            value={chatInput}
            onChangeText={setChatInput}
            placeholder="Ask about trainer cards..."
            placeholderTextColor="#6b7280"
            style={chatStyles.textInput}
          />
          <TouchableOpacity onPress={sendMessage} style={chatStyles.sendBtn}>
            <Text style={chatStyles.sendBtnText}>Send</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </SafeAreaProvider>
  );
};

export default ChatScreen;
