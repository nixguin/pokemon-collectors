// Seed missing Pokemon sets from pokemontcg.io into Supabase.
// Compares all sets on pokemontcg.io vs what's already in Supabase,
// then fetches and upserts only the missing sets. Safe to re-run.
//
// Run with:
//   $env:SUPABASE_SERVICE_KEY='your_key'; node scripts/seedMissingPokemonSets.js

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://wtyxoufpbabvqsjiipuu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error(
    "Error: SUPABASE_SERVICE_KEY environment variable is required.",
  );
  console.error(
    "Run: $env:SUPABASE_SERVICE_KEY='your_key'; node scripts/seedMissingPokemonSets.js",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const API_BASE = "https://api.pokemontcg.io/v2";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function convertCard(card) {
  return {
    product_id: card.id,
    name: card.name,
    card_type: card.supertype || "Pokémon",
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
        { name: "CardType", value: card.supertype || "Pokémon" },
        { name: "Rarity", value: card.rarity || "Common" },
        { name: "SetName", value: card.set?.name || "Unknown Set" },
        { name: "Number", value: card.number || "" },
        {
          name: "Price",
          value:
            card.tcgplayer?.prices?.holofoil?.market ??
            card.tcgplayer?.prices?.normal?.market ??
            card.tcgplayer?.prices?.reverseHolofoil?.market ??
            card.tcgplayer?.prices?.["1stEditionHolofoil"]?.market ??
            card.tcgplayer?.prices?.unlimitedHolofoil?.market ??
            "",
        },
      ],
    },
  };
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

// Fetch all sets from pokemontcg.io
async function fetchAllSets() {
  const res = await fetch(`${API_BASE}/sets?orderBy=-releaseDate&pageSize=250`);
  if (!res.ok) throw new Error(`Sets fetch failed: ${res.status}`);
  const json = await res.json();
  return json.data || [];
}

// Fetch one card from a set to probe if it exists in Supabase
async function existsInSupabase(setId) {
  const { data } = await supabase
    .from("cards")
    .select("product_id")
    .like("product_id", `${setId}-%`)
    .limit(1);
  return data && data.length > 0;
}

// Fetch all cards for a set from pokemontcg.io
async function fetchSetCards(setId, setName) {
  const allCards = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `${API_BASE}/cards?q=set.id:${setId}&page=${page}&pageSize=250`,
    );
    if (!res.ok) {
      console.log(`    API error ${res.status} on page ${page}`);
      break;
    }
    const json = await res.json();
    const cards = json.data || [];
    allCards.push(...cards);
    if (cards.length < 250) break;
    page++;
    await sleep(300);
  }
  return allCards;
}

async function main() {
  console.log("=== Missing Pokemon Sets Seeder ===\n");

  const allSets = await fetchAllSets();
  console.log(`Found ${allSets.length} sets on pokemontcg.io.\n`);

  const missingSets = [];
  process.stdout.write("Checking which sets are already in Supabase...\n");

  for (let i = 0; i < allSets.length; i++) {
    const set = allSets[i];
    const exists = await existsInSupabase(set.id);
    process.stdout.write(
      `  [${i + 1}/${allSets.length}] ${set.id}: ${set.name} → ${exists ? "OK" : "MISSING"}\n`,
    );
    if (!exists) missingSets.push(set);
    await sleep(50);
  }

  console.log(
    `\nFound ${missingSets.length} missing set(s):\n${missingSets.map((s) => `  • ${s.id}: ${s.name} (${s.releaseDate})`).join("\n")}\n`,
  );

  if (!missingSets.length) {
    console.log("All sets already in Supabase. Nothing to do.");
    return;
  }

  let totalInserted = 0;

  for (const set of missingSets) {
    console.log(`\nSeeding: ${set.id} — ${set.name} (${set.releaseDate})`);
    const cards = await fetchSetCards(set.id, set.name);
    if (!cards.length) {
      console.log("  No cards found, skipping.");
      continue;
    }
    console.log(`  ${cards.length} cards fetched.`);

    const rows = cards.map(convertCard);
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 250) {
      inserted += await upsertBatch(rows.slice(i, i + 250));
      await sleep(80);
    }
    totalInserted += inserted;
    console.log(`  ${inserted}/${cards.length} upserted.`);
    await sleep(500);
  }

  console.log(
    `\n=== Done! ${totalInserted} cards seeded across ${missingSets.length} missing sets. ===`,
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
