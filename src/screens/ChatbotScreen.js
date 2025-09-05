import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Chatbot from "../components/Chatbot";

const ChatbotScreen = ({ navigation, route }) => {
  const { trainerCards = [] } = route.params || {};

  const handleCardSelect = (card) => {
    // Navigate back to home screen and potentially scroll to the selected card
    navigation.navigate("Home", { selectedCard: card });
  };

  return (
    <View className="flex-1">
      <Chatbot trainerCards={trainerCards} onCardSelect={handleCardSelect} />

      {/* Back button overlay */}
      <View className="absolute top-12 left-4">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="bg-white/20 rounded-full p-2"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ChatbotScreen;
