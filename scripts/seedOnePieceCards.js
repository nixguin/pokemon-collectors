// Seed script: Fetches One Piece Card Game data from TCGCSV and stores in Supabase
// Category 68 = One Piece Card Game on TCGPlayer/TCGCSV
//
// Run with:
//   $env:SUPABASE_SERVICE_KEY='your_key'; node scripts/seedOnePieceCards.js

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://wtyxoufpbabvqsjiipuu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("Error: SUPABASE_SERVICE_KEY environment variable is required.");
  console.error(
    "Run with: $env:SUPABASE_SERVICE_KEY='your_key'; node scripts/seedOnePieceCards.js"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TCGCSV_BASE = "https://tcgcsv.com/tcgplayer";
const ONE_PIECE_CATEGORY = 68;

// Map TCGCSV One Piece card to app card_data format
function convertCard(card, groupName) {
  const ext = card.extendedData || [];
  const extVal = (name) => {
    const entry = ext.find((e) => e.name === name);
    return entry ? entry.value : "";
  };

  const cardType = extVal("CardType") || "Character";

  return {
    product_id: "op_" + card.productId,
    name: card.name,
    card_type: "OnePiece",
    card_data: {
      productId: "op_" + card.productId,
      name: card.name,
      cleanName: card.cleanName || card.name,
      imageUrl: card.imageUrl || "",
      categoryId: ONE_PIECE_CATEGORY,
      groupId: String(card.groupId),
      url: card.url || "",
      groupName: groupName || "",
      cardGame: "OnePiece",
      extendedData: [
        { name: "CardType", value: cardType },
        { name: "Rarity",   value: extVal("Rarity") },
        { name: "SetName",  value: groupName || "" },
        { name: "Number",   value: extVal("Number") },
        { name: "Color",    value: extVal("Color") },
        { name: "Power",    value: extVal("Power") },
        { name: "Life",     value: extVal("Life") },
        { name: "Attribute",value: extVal("Attribute") },
        { name: "Subtypes", value: extVal("Subtypes") },
        { name: "Description", value: extVal("Description") },
        { name: "Price",    value: "" },
      ],
    },
  };
}

async function fetchGroups() {
  const url = `${TCGCSV_BASE}/${ONE_PIECE_CATEGORY}/groups`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Groups fetch failed: ${res.status}`);
  const json = await res.json();
  return json.results || [];
}

async function fetchProducts(groupId) {
  const url = `${TCGCSV_BASE}/${ONE_PIECE_CATEGORY}/${groupId}/products`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Products fetch failed: ${res.status} for group ${groupId}`);
  const json = await res.json();
  return json.results || [];
}

async function upsertBatch(rows) {
  if (!rows.length) return 0;
  const { error } = await supabase
    .from("cards")
    .upsert(rows, { onConflict: "product_id", ignoreDuplicates: false });
  if (error) {
    console.error("  Supabase error:", error.message);
    return 0;
  }
  return rows.length;
}

async function seed() {
  console.log("=== One Piece Card Game Seeder ===\n");

  const groups = await fetchGroups();
  console.log(`Found ${groups.length} sets.\n`);

  let totalCards = 0;
  let totalUpserted = 0;

  for (const group of groups) {
    const { groupId, name: groupName } = group;
    process.stdout.write(`  [${groupId}] ${groupName} — fetching...`);

    let products;
    try {
      products = await fetchProducts(groupId);
    } catch (err) {
      console.log(` SKIP (${err.message})`);
      continue;
    }

    if (!products.length) {
      console.log(" 0 cards, skipped");
      continue;
    }

    // Convert and filter to actual playable cards (not sealed products)
    const cards = products
      .filter((p) => {
        const ext = p.extendedData || [];
        // Skip sealed products (no CardType extendedData = likely a booster box)
        return ext.some((e) => e.name === "CardType") || ext.some((e) => e.name === "Rarity");
      })
      .map((p) => convertCard(p, groupName));

    totalCards += cards.length;

    // Upsert in batches of 500
    let upserted = 0;
    for (let i = 0; i < cards.length; i += 500) {
      upserted += await upsertBatch(cards.slice(i, i + 500));
      await new Promise((r) => setTimeout(r, 80));
    }
    totalUpserted += upserted;
    console.log(` ${cards.length} cards → ${upserted} upserted`);
  }

  console.log(`\nDone! ${totalUpserted}/${totalCards} One Piece cards seeded.`);
}

seed().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
