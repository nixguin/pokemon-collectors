class AIChatbot {
  constructor() {
    this.context = "";
    this.conversationHistory = [];
  }

  // Set context with available trainer cards
  setContext(trainerCards) {
    this.context = trainerCards;
  }

  // Process user query and find relevant cards
  processQuery(query) {
    const lowerQuery = query.toLowerCase();
    const suggestions = [];

    // Keywords for different types of searches
    const typeKeywords = {
      supporter: ["supporter", "support"],
      item: ["item", "tool"],
      stadium: ["stadium", "field"],
      energy: ["energy", "special energy"],
      trainer: ["trainer"],
    };

    const rarityKeywords = {
      common: ["common"],
      uncommon: ["uncommon"],
      rare: ["rare"],
      "ultra rare": ["ultra rare", "ur"],
      "secret rare": ["secret rare", "sr"],
    };

    // Search for specific card types
    let filteredCards = [...this.context];

    // Filter by card type if mentioned
    for (const [type, keywords] of Object.entries(typeKeywords)) {
      if (keywords.some((keyword) => lowerQuery.includes(keyword))) {
        filteredCards = filteredCards.filter((card) => {
          const cardData = this.extractCardData(card);
          return cardData.type.toLowerCase().includes(type);
        });
        suggestions.push(`Showing ${type} cards`);
        break;
      }
    }

    // Filter by rarity if mentioned
    for (const [rarity, keywords] of Object.entries(rarityKeywords)) {
      if (keywords.some((keyword) => lowerQuery.includes(keyword))) {
        filteredCards = filteredCards.filter((card) => {
          const cardData = this.extractCardData(card);
          return cardData.rarity.toLowerCase().includes(rarity);
        });
        suggestions.push(`Filtered by ${rarity} rarity`);
        break;
      }
    }

    // Search by card name
    if (lowerQuery.length > 3) {
      const nameMatches = filteredCards.filter(
        (card) =>
          card.name.toLowerCase().includes(lowerQuery) ||
          card.cleanName.toLowerCase().includes(lowerQuery)
      );

      if (nameMatches.length > 0) {
        filteredCards = nameMatches;
        suggestions.push(`Found cards matching "${query}"`);
      }
    }

    // Search by set name
    const setMatches = filteredCards.filter((card) => {
      const cardData = this.extractCardData(card);
      return cardData.setName.toLowerCase().includes(lowerQuery);
    });

    if (setMatches.length > 0 && lowerQuery.length > 3) {
      filteredCards = setMatches;
      suggestions.push(`Found cards from sets matching "${query}"`);
    }

    // Generate response
    const response = this.generateResponse(query, filteredCards, suggestions);

    // Save to conversation history
    this.conversationHistory.push({
      query,
      response,
      resultCount: filteredCards.length,
      timestamp: new Date().toISOString(),
    });

    return {
      response,
      cards: filteredCards.slice(0, 20), // Limit to 20 results
      suggestions: this.generateSuggestions(query, filteredCards),
    };
  }

  // Extract card data from extended data
  extractCardData(card) {
    const extendedData = card.extendedData || [];
    const cardData = {
      type: "",
      rarity: "",
      setName: "",
      cardNumber: "",
    };

    extendedData.forEach((data) => {
      switch (data.name) {
        case "CardType":
          cardData.type = data.value || "";
          break;
        case "Rarity":
          cardData.rarity = data.value || "";
          break;
        case "SetName":
          cardData.setName = data.value || "";
          break;
        case "Number":
          cardData.cardNumber = data.value || "";
          break;
      }
    });

    return cardData;
  }

  // Generate AI response
  generateResponse(query, results, suggestions) {
    const resultCount = results.length;

    if (resultCount === 0) {
      return `I couldn't find any trainer cards matching "${query}". Try searching for specific card names, types (like "supporter" or "item"), or set names. You can also ask me about card rarities!`;
    }

    if (resultCount === 1) {
      const card = results[0];
      const cardData = this.extractCardData(card);
      return `I found "${card.name}"! It's ${
        cardData.rarity ? `a ${cardData.rarity}` : "a"
      } ${cardData.type || "trainer"} card${
        cardData.setName ? ` from ${cardData.setName}` : ""
      }. Would you like to add it to your wishlist?`;
    }

    if (resultCount <= 5) {
      const cardNames = results.map((card) => card.name).join(", ");
      return `I found ${resultCount} trainer cards: ${cardNames}. ${suggestions.join(
        ". "
      )}`;
    }

    const topCards = results
      .slice(0, 3)
      .map((card) => card.name)
      .join(", ");
    return `I found ${resultCount} trainer cards matching your search! The top results include: ${topCards}. ${suggestions.join(
      ". "
    )} Would you like me to help you narrow down the search?`;
  }

  // Generate search suggestions
  generateSuggestions(query, results) {
    const suggestions = [];

    if (results.length > 10) {
      suggestions.push(
        "Try adding a rarity filter like 'rare' or 'ultra rare'"
      );
    }

    if (results.length > 5) {
      suggestions.push(
        "You can search by specific set names to narrow results"
      );
    }

    if (
      !query.toLowerCase().includes("supporter") &&
      !query.toLowerCase().includes("item") &&
      !query.toLowerCase().includes("stadium")
    ) {
      suggestions.push(
        "Try searching by card type: 'supporter', 'item', or 'stadium'"
      );
    }

    return suggestions;
  }

  // Get conversation history
  getHistory() {
    return this.conversationHistory.slice(-10); // Last 10 conversations
  }

  // Clear conversation history
  clearHistory() {
    this.conversationHistory = [];
  }
}

export default new AIChatbot();
