// Seed script: Fetches Pokemon cards from the Pokemon TCG API and stores them in Supabase
// Run with: SUPABASE_SERVICE_KEY=your_key node scripts/seedCards.js

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://wtyxoufpbabvqsjiipuu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("Error: SUPABASE_SERVICE_KEY environment variable is required.");
  console.error("Run with: $env:SUPABASE_SERVICE_KEY='your_key'; node scripts/seedCards.js");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const API_BASE = "https://api.pokemontcg.io/v2/cards";

// Convert Pokemon TCG API card to our app format
function convertCard(card) {
  return {
    product_id: card.id,
    name: card.name,
    card_type: card.supertype || "Pokemon",
    card_data: {
      productId: card.id,
      name: card.name,
      cleanName: card.name,
      imageUrl: card.images?.small || card.images?.large || "",
      categoryId:
        card.supertype === "Pokémon" ? 1 : card.supertype === "Energy" ? 2 : 3,
      groupId: card.set?.id || "unknown",
      url: `https://pokemontcg.io/card/${card.id}`,
      groupName: card.set?.name || "Unknown Set",
      extendedData: [
        { name: "CardType", value: card.supertype || "Pokemon" },
        { name: "Rarity", value: card.rarity || "Common" },
        { name: "SetName", value: card.set?.name || "Unknown Set" },
        { name: "Number", value: card.number || "" },
        {
          name: "Price",
          value:
            card.tcgplayer?.prices?.holofoil?.market ||
            card.tcgplayer?.prices?.normal?.market ||
            card.tcgplayer?.prices?.reverseHolofoil?.market ||
            "N/A",
        },
      ],
    },
  };
}

async function fetchPage(page, pageSize = 250) {
  const url = `${API_BASE}?page=${page}&pageSize=${pageSize}`;
  console.log(`  Fetching page ${page}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API returned ${response.status} for page ${page}`);
  }
  const json = await response.json();
  return { cards: json.data || [], totalCount: json.totalCount || 0 };
}

async function upsertBatch(cards) {
  if (cards.length === 0) return 0;

  const { error } = await supabase
    .from("cards")
    .upsert(cards, { onConflict: "product_id", ignoreDuplicates: true });

  if (error) {
    console.error("  Supabase insert error:", error.message);
    return 0;
  }
  return cards.length;
}

async function seed() {
  console.log("=== Pokemon Card Seeder ===\n");

  // Get total count first
  const { totalCount } = await fetchPage(1, 1);
  const totalPages = Math.ceil(totalCount / 250);
  console.log(`Total cards available: ${totalCount} (${totalPages} pages)\n`);

  let totalInserted = 0;

  for (let page = 1; page <= totalPages; page++) {
    try {
      const { cards } = await fetchPage(page, 250);
      if (cards.length === 0) {
        console.log(`  Page ${page}: no cards returned, stopping.`);
        break;
      }

      const converted = cards.map(convertCard);
      const inserted = await upsertBatch(converted);
      totalInserted += inserted;

      console.log(
        `  Page ${page}/${totalPages}: inserted ${inserted} cards (total: ${totalInserted})`,
      );

      // Small delay to avoid rate limiting
      if (page < totalPages) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (err) {
      console.error(`  Error on page ${page}:`, err.message);
      // Wait longer on rate limit
      console.log("  Waiting 5s before retry...");
      await new Promise((r) => setTimeout(r, 5000));
      page--; // Retry this page
    }
  }

  console.log(`\n=== Done! Inserted ${totalInserted} cards into Supabase ===`);
}

seed().catch(console.error);
