// Seed Pokemon card groups that exist on TCGCSV (category 3) but NOT on pokemontcg.io.
// Uses "pk3_" product_id prefix to avoid collision with pokemontcg.io cards.
//
// Run with:
//   $env:SUPABASE_SERVICE_KEY='your_key'; node scripts/seedTCGCSVPokemonExtras.js
//
// To add more groups later, append to EXTRA_GROUPS.

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://wtyxoufpbabvqsjiipuu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error(
    "Error: SUPABASE_SERVICE_KEY environment variable is required.",
  );
  console.error(
    "Run: $env:SUPABASE_SERVICE_KEY='your_key'; node scripts/seedTCGCSVPokemonExtras.js",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const TCGCSV_BASE = "https://tcgcsv.com/tcgplayer";
const POKEMON_CATEGORY = 3;

// Groups on TCGCSV that are NOT covered by pokemontcg.io.
// Add new groupIds here as sets release.
const EXTRA_GROUPS = [
  { groupId: 2776, name: "First Partner Pack (2021)" },
  { groupId: 24451, name: "ME: Mega Evolution Promo" },
  { groupId: 24461, name: "MEE: Mega Evolution Energies" },
  { groupId: 24529, name: "Player Placement Trainer Promos" },
  // ME04: Chaos Rising — add when released (May 22, 2026)
  // { groupId: 24655, name: "ME04: Chaos Rising" },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getExtVal(extendedData, name) {
  const entry = extendedData.find((e) => e.name === name);
  return entry ? entry.value : "";
}

function detectCardType(extendedData) {
  // If it has HP or Stage it's a Pokémon.  Energy or Trainer otherwise.
  if (extendedData.some((e) => e.name === "HP" || e.name === "Stage"))
    return "Pokémon";
  const cardTypeFld =
    getExtVal(extendedData, "Card Type") || getExtVal(extendedData, "CardType");
  if (/trainer|supporter|item|stadium/i.test(cardTypeFld)) return "Trainer";
  if (/energy/i.test(cardTypeFld)) return "Energy";
  return "Pokémon";
}

function convertCard(card, groupName) {
  const ext = card.extendedData || [];
  const cardType = detectCardType(ext);

  return {
    product_id: "pk3_" + card.productId,
    name: card.name,
    card_type: cardType,
    card_data: {
      productId: "pk3_" + card.productId,
      name: card.name,
      cleanName: card.cleanName || card.name,
      imageUrl: card.imageUrl || "",
      categoryId: POKEMON_CATEGORY,
      groupId: String(card.groupId),
      url: card.url || "",
      groupName: groupName,
      cardGame: "PokemonTCGCSV",
      extendedData: [
        { name: "CardType", value: cardType },
        { name: "Rarity", value: getExtVal(ext, "Rarity") },
        { name: "SetName", value: groupName },
        { name: "Number", value: getExtVal(ext, "Number") },
        { name: "HP", value: getExtVal(ext, "HP") },
        { name: "Stage", value: getExtVal(ext, "Stage") },
        { name: "Price", value: "" },
      ],
    },
  };
}

async function fetchProducts(groupId) {
  const url = `${TCGCSV_BASE}/${POKEMON_CATEGORY}/${groupId}/products`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.results || [];
}

async function upsertBatch(rows) {
  if (!rows.length) return 0;
  const { error } = await supabase
    .from("cards")
    .upsert(rows, { onConflict: "product_id", ignoreDuplicates: false });
  if (error) {
    console.error("  Upsert error:", error.message);
    return 0;
  }
  return rows.length;
}

async function main() {
  console.log("=== TCGCSV Pokemon Extras Seeder ===\n");
  let grandTotal = 0;

  for (const group of EXTRA_GROUPS) {
    const { groupId, name: groupName } = group;
    process.stdout.write(`[${groupId}] ${groupName} — fetching...`);

    let products;
    try {
      products = await fetchProducts(groupId);
    } catch (err) {
      console.log(` SKIP (${err.message})`);
      continue;
    }

    // Filter to actual playable cards (have Rarity or HP)
    const cards = products
      .filter((p) => {
        const ext = p.extendedData || [];
        return (
          ext.some((e) => e.name === "Rarity") ||
          ext.some((e) => e.name === "HP")
        );
      })
      .map((p) => convertCard(p, groupName));

    if (!cards.length) {
      console.log(` 0 cards, skipped (${products.length} total products)`);
      continue;
    }

    let upserted = 0;
    for (let i = 0; i < cards.length; i += 500) {
      upserted += await upsertBatch(cards.slice(i, i + 500));
      await sleep(80);
    }
    grandTotal += upserted;
    console.log(` ${upserted}/${cards.length} upserted`);
  }

  console.log(`\nDone! ${grandTotal} cards seeded.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
