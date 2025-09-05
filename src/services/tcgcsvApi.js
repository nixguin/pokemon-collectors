import axios from "axios";

const BASE_URL = "https://tcgcsv.com";
const POKEMON_CATEGORY_ID = 3;

class TCGCSVApi {
  constructor() {
    this.baseURL = BASE_URL;
  }

  // Fetch Pokemon categories and groups
  async getPokemonGroups() {
    try {
      const response = await axios.get(
        `${this.baseURL}/categories/${POKEMON_CATEGORY_ID}/groups.json`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching Pokemon groups:", error);
      throw error;
    }
  }

  // Fetch Pokemon products (cards) for a specific group
  async getPokemonProducts(groupId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/groups/${groupId}/products.json`
      );
      return response.data;
    } catch (error) {
      console.error(`Error fetching products for group ${groupId}:`, error);
      throw error;
    }
  }

  // Fetch all Pokemon products
  async getAllPokemonProducts() {
    try {
      const groups = await this.getPokemonGroups();
      const allProducts = [];

      // Fetch products for each group
      for (const group of groups) {
        try {
          const products = await this.getPokemonProducts(group.groupId);
          allProducts.push(...products);
        } catch (error) {
          console.warn(
            `Failed to fetch products for group ${group.groupId}:`,
            error.message
          );
        }
      }

      return allProducts;
    } catch (error) {
      console.error("Error fetching all Pokemon products:", error);
      throw error;
    }
  }

  // Filter trainer cards from all products
  filterTrainerCards(products) {
    return products.filter((product) => {
      const name = product.name?.toLowerCase() || "";
      const extendedData = product.extendedData || [];

      // Check if it's a trainer card based on name patterns or extended data
      const isTrainer =
        name.includes("trainer") ||
        name.includes("supporter") ||
        name.includes("item") ||
        name.includes("stadium") ||
        name.includes("tool") ||
        extendedData.some(
          (data) =>
            data.name === "CardType" &&
            (data.value?.toLowerCase().includes("trainer") ||
              data.value?.toLowerCase().includes("supporter") ||
              data.value?.toLowerCase().includes("item") ||
              data.value?.toLowerCase().includes("stadium"))
        );

      return isTrainer;
    });
  }

  // Get market prices for products
  async getProductPrices(productIds) {
    try {
      const response = await axios.get(
        `${this.baseURL}/pricing/marketprices/${productIds.join(",")}.json`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching product prices:", error);
      throw error;
    }
  }
}

export default new TCGCSVApi();
