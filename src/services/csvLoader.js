import Papa from "papaparse";

// Convert CSV row to our card format
const convertCSVToCard = (row) => {
  return {
    productId: row.id || `card-${Date.now()}-${Math.random()}`,
    name: row.name || "Unknown Card",
    cleanName: row.name || "Unknown Card",
    imageUrl: row.imageUrl || "https://images.pokemontcg.io/base1/58.png",
    categoryId: row.type === "Pokemon" ? 1 : row.type === "Energy" ? 2 : 3,
    groupId: row.id?.split("-")[0] || "unknown",
    url: `https://pokemontcg.io/card/${row.id}`,
    groupName: row.set || "Unknown Set",
    extendedData: [
      { name: "CardType", value: row.type || "Pokemon" },
      { name: "Rarity", value: row.rarity || "Common" },
      { name: "SetName", value: row.set || "Unknown Set" },
      { name: "Number", value: row.number || "" },
    ],
  };
};

export const csvLoader = {
  // Load cards from local CSV file
  async loadFromCSV(csvFilePath) {
    try {
      console.log(`Loading cards from CSV: ${csvFilePath}`);

      // For React Native/Expo, we need to use fetch to load local assets
      const response = await fetch(csvFilePath);
      const csvText = await response.text();

      return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (results.errors.length > 0) {
              console.warn("CSV parsing warnings:", results.errors);
            }

            const cards = results.data
              .filter((row) => row.name && row.name.trim()) // Filter out empty rows
              .map(convertCSVToCard);

            console.log(`Loaded ${cards.length} cards from CSV`);
            resolve(cards);
          },
          error: (error) => {
            console.error("CSV parsing error:", error);
            reject(error);
          },
        });
      });
    } catch (error) {
      console.error("Error loading CSV file:", error);
      throw error;
    }
  },

  // Load trainer cards specifically
  async loadTrainerCards(csvFilePath) {
    try {
      const allCards = await this.loadFromCSV(csvFilePath);
      const trainerCards = allCards.filter(
        (card) =>
          card.extendedData.find((data) => data.name === "CardType")?.value ===
          "Trainer"
      );
      console.log(`Filtered ${trainerCards.length} trainer cards from CSV`);
      return trainerCards;
    } catch (error) {
      console.error("Error loading trainer cards from CSV:", error);
      return [];
    }
  },

  // Load Pokemon cards specifically
  async loadPokemonCards(csvFilePath) {
    try {
      const allCards = await this.loadFromCSV(csvFilePath);
      const pokemonCards = allCards.filter(
        (card) =>
          card.extendedData.find((data) => data.name === "CardType")?.value ===
          "Pokemon"
      );
      console.log(`Filtered ${pokemonCards.length} Pokemon cards from CSV`);
      return pokemonCards;
    } catch (error) {
      console.error("Error loading Pokemon cards from CSV:", error);
      return [];
    }
  },

  // Load all cards
  async loadAllCards(csvFilePath) {
    try {
      return await this.loadFromCSV(csvFilePath);
    } catch (error) {
      console.error("Error loading all cards from CSV:", error);
      return [];
    }
  },

  // Create CSV from card data (for exporting)
  exportToCSV(cards) {
    const csvData = cards.map((card) => ({
      id: card.productId,
      name: card.name,
      type:
        card.extendedData.find((data) => data.name === "CardType")?.value ||
        "Pokemon",
      rarity:
        card.extendedData.find((data) => data.name === "Rarity")?.value ||
        "Common",
      set: card.groupName,
      number:
        card.extendedData.find((data) => data.name === "Number")?.value || "",
      imageUrl: card.imageUrl,
    }));

    return Papa.unparse(csvData);
  },
};
