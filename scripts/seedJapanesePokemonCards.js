// Seed script: Fetches Japanese Pokemon Card Game data from TCGCSV category 85
// and stores in Supabase with `jp_` product_id prefix.
//
// Run with:
//   $env:SUPABASE_SERVICE_KEY='your_key'; node scripts/seedJapanesePokemonCards.js

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://wtyxoufpbabvqsjiipuu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error(
    "Error: SUPABASE_SERVICE_KEY environment variable is required.",
  );
  console.error(
    "Run with: $env:SUPABASE_SERVICE_KEY='your_key'; node scripts/seedJapanesePokemonCards.js",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TCGCSV_BASE = "https://tcgcsv.com/tcgplayer";
const JP_POKEMON_CATEGORY = 85;
const DELAY_MS = 150;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Map a TCGCSV Japanese Pokemon card to our app card_data format
function convertCard(card, groupName) {
  const ext = card.extendedData || [];
  const extVal = (name) => {
    const entry = ext.find((e) => e.name === name);
    return entry ? entry.value : "";
  };

  return {
    product_id: "jp_" + card.productId,
    name: card.name,
    card_type: "JapanesePokemon",
    card_data: {
      productId: "jp_" + card.productId,
      name: card.name,
      cleanName: card.cleanName || card.name,
      imageUrl: card.imageUrl || "",
      categoryId: JP_POKEMON_CATEGORY,
      groupId: String(card.groupId),
      url: card.url || "",
      groupName: groupName || "",
      cardGame: "JapanesePokemon",
      extendedData: [
        { name: "CardType", value: extVal("CardType") || "Pokémon" },
        { name: "Rarity", value: extVal("Rarity") },
        { name: "SetName", value: groupName || "" },
        { name: "Number", value: extVal("Number") },
        { name: "HP", value: extVal("HP") },
        { name: "Stage", value: extVal("Stage") },
        { name: "Weakness", value: extVal("Weakness") },
        { name: "Retreat Cost", value: extVal("Retreat Cost") },
        { name: "Attack 1", value: extVal("Attack 1") },
        { name: "Attack 2", value: extVal("Attack 2") },
        { name: "Flavor Text", value: extVal("Flavor Text") },
        { name: "Description", value: extVal("Description") },
        { name: "Price", value: "" },
      ],
    },
  };
}

async function fetchGroups() {
  const url = `${TCGCSV_BASE}/${JP_POKEMON_CATEGORY}/groups`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Groups fetch failed: ${res.status}`);
  const json = await res.json();
  return json.results || [];
}

async function fetchProducts(groupId) {
  const url = `${TCGCSV_BASE}/${JP_POKEMON_CATEGORY}/${groupId}/products`;
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Products fetch failed: ${res.status} for group ${groupId}`);
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
  console.log("=== Japanese Pokemon Card Game Seeder ===");
  console.log("Category: TCGCSV #85 — Pokemon Japan\n");

  const groups = await fetchGroups();
  console.log(`Found ${groups.length} sets.\n`);

  let totalCards = 0;
  let totalUpserted = 0;

  for (let i = 0; i < groups.length; i++) {
    const { groupId, name: groupName } = groups[i];
    process.stdout.write(
      `  [${i + 1}/${groups.length}] ${groupName} — fetching...`,
    );

    let products;
    try {
      products = await fetchProducts(groupId);
    } catch (err) {
      console.log(` SKIP (${err.message})`);
      await sleep(DELAY_MS);
      continue;
    }

    // Only seed actual cards (those with a Number extendedData field)
    const cards = products.filter((p) =>
      p.extendedData?.some((e) => e.name === "Number"),
    );

    if (!cards.length) {
      console.log(` 0 cards (sealed/empty)`);
      await sleep(DELAY_MS);
      continue;
    }

    const rows = cards.map((c) => convertCard(c, groupName));
    const upserted = await upsertBatch(rows);

    totalCards += cards.length;
    totalUpserted += upserted;
    console.log(` ${upserted} cards seeded`);

    await sleep(DELAY_MS);
  }

  console.log("\n=== Done ===");
  console.log(`Total cards processed: ${totalCards}`);
  console.log(`Total upserted to Supabase: ${totalUpserted}`);
}

seed().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
