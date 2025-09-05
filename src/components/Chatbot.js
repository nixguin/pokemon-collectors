import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import aiChatbot from "../services/aiChatbot";

const Chatbot = ({ trainerCards, onCardSelect }) => {
  const [messages, setMessages] = useState([
    {
      id: "1",
      text: "Hi! I'm here to help you find Pokemon trainer cards. You can ask me about specific cards, card types (supporter, item, stadium), rarities, or sets. What are you looking for?",
      isBot: true,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef();

  const sendMessage = async () => {
    if (!inputText.trim() || loading) return;

    const userMessage = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isBot: false,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setLoading(true);

    try {
      // Set context for AI chatbot
      aiChatbot.setContext(trainerCards);

      // Process the query
      const result = aiChatbot.processQuery(userMessage.text);

      // Create bot response
      const botMessage = {
        id: (Date.now() + 1).toString(),
        text: result.response,
        isBot: true,
        timestamp: new Date().toISOString(),
        cards: result.cards,
        suggestions: result.suggestions,
      };

      setMessages((prev) => [...prev, botMessage]);

      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("Error processing message:", error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I encountered an error while searching for cards. Please try again.",
        isBot: true,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }

    setLoading(false);
  };

  const selectCard = (card) => {
    if (onCardSelect) {
      onCardSelect(card);
    }
  };

  const renderMessage = (message) => (
    <View
      key={message.id}
      className={`mb-4 ${message.isBot ? "items-start" : "items-end"}`}
    >
      <View
        className={`max-w-4/5 p-3 rounded-2xl ${
          message.isBot
            ? "bg-gray-100 rounded-bl-sm"
            : "bg-blue-500 rounded-br-sm"
        }`}
      >
        <Text
          className={`text-sm ${
            message.isBot ? "text-gray-800" : "text-white"
          }`}
        >
          {message.text}
        </Text>

        {/* Display suggestions */}
        {message.suggestions && message.suggestions.length > 0 && (
          <View className="mt-2">
            {message.suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setInputText(suggestion)}
                className="bg-blue-50 p-2 rounded-lg mt-1"
              >
                <Text className="text-xs text-blue-600">{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Display card results */}
        {message.cards && message.cards.length > 0 && (
          <ScrollView
            horizontal
            className="mt-3"
            showsHorizontalScrollIndicator={false}
          >
            {message.cards.slice(0, 5).map((card) => (
              <TouchableOpacity
                key={card.productId}
                onPress={() => selectCard(card)}
                className="bg-white p-2 rounded-lg mr-2 border border-gray-200"
                style={{ width: 120 }}
              >
                <Text
                  className="text-xs font-medium text-gray-800"
                  numberOfLines={2}
                >
                  {card.name}
                </Text>
                <Text className="text-xs text-gray-500 mt-1">Tap to view</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      <Text
        className={`text-xs text-gray-400 mt-1 ${
          message.isBot ? "text-left" : "text-right"
        }`}
      >
        {new Date(message.timestamp).toLocaleTimeString()}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View className="bg-blue-600 p-4 pt-12">
        <View className="flex-row items-center">
          <View className="w-8 h-8 bg-white rounded-full items-center justify-center mr-3">
            <Ionicons name="chatbubble-ellipses" size={16} color="#2563eb" />
          </View>
          <Text className="text-white text-lg font-semibold">
            AI Card Assistant
          </Text>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        className="flex-1 p-4"
        showsVerticalScrollIndicator={false}
      >
        {messages.map(renderMessage)}
        {loading && (
          <View className="items-start mb-4">
            <View className="bg-gray-100 p-3 rounded-2xl rounded-bl-sm">
              <View className="flex-row items-center">
                <View className="flex-row space-x-1">
                  <View className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
                  <View
                    className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"
                    style={{ animationDelay: "0.2s" }}
                  />
                  <View
                    className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"
                    style={{ animationDelay: "0.4s" }}
                  />
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View className="p-4 bg-white border-t border-gray-200">
        <View className="flex-row items-center">
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask me about trainer cards..."
            className="flex-1 bg-gray-100 rounded-full px-4 py-3 mr-3 text-sm"
            multiline={false}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity
            onPress={sendMessage}
            disabled={!inputText.trim() || loading}
            className={`w-12 h-12 rounded-full items-center justify-center ${
              inputText.trim() && !loading ? "bg-blue-500" : "bg-gray-300"
            }`}
          >
            <Ionicons name="send" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default Chatbot;
