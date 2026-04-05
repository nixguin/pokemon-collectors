// For all Pokemon cards in Supabase whose price is "N/A" or empty,
// look up prices from TCGCSV category 3 by matching set name + card number.
//
// Run with:
//   $env:SUPABASE_SERVICE_KEY='your_key'; node scripts/fillMissingPricesFromTCGCSV.js

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://wtyxoufpbabvqsjiipuu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_SERVICE_KEY) {
  console.error("Error: SUPABASE_SERVICE_KEY env var required.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const DELAY_MS = 150;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Strip common prefixes like "ME03: ", "ME: ", "SVE: ", "SV: ", "SWSH01: ", "XY - ", etc.
function normalizeSetName(name) {
  let s = String(name || "")
    .replace(/^(ME\d*|SVE?|SWSH\d*|XY|SM\d*|BW\d*|DP\d*|POP|EX)[^:]*:\s*/i, "")
    .replace(/^(XY|SM|BW|DP|EX)\s+-\s+/i, "")
    .replace(/^Pokémon TCG:\s*/i, "")
    .toLowerCase()
    .trim();

  // Alias map: pokemontcg.io name → TCGCSV normalized name
  const ALIASES = {
    "sun & moon": "sm base set",
    "mcdonald's collection 2014": "mcdonald's promos 2014",
    "mcdonald's collection 2015": "mcdonald's promos 2015",
    "mcdonald's collection 2016": "mcdonald's promos 2016",
    "mcdonald's collection 2017": "mcdonald's promos 2017",
    "mcdonald's collection 2018": "mcdonald's promos 2018",
    "mcdonald's collection 2019": "mcdonald's promos 2019",
    "ex trainer kit 2 plusle": "ex trainer kit 2: plusle & minun",
    "ex trainer kit 2 minun": "ex trainer kit 2: plusle & minun",
    "ex trainer kit latias": "ex trainer kit 1: latias & latios",
    "ex trainer kit latios": "ex trainer kit 1: latias & latios",
  };
  return ALIASES[s] || s;
}

// "083/088" → "83",  "GG01/GG70" → "GG01",  "SWSH001" → "SWSH001"
function normalizeNumber(num) {
  const s = String(num || "").split("/")[0].trim();
  const n = parseInt(s, 10);
  return isNaN(n) ? s.toUpperCase() : String(n);
}

async function main() {
  console.log("=== Fill Missing Pokemon Prices from TCGCSV ===\n");

  // 1. Fetch all TCGCSV cat 3 groups
  console.log("Fetching TCGCSV category 3 groups...");
  const groupsRes = await fetch("https://tcgcsv.com/tcgplayer/3/groups");
  const groupsJson = await groupsRes.json();
  const groups = groupsJson.results || [];
  console.log(`Found ${groups.length} groups.\n`);

  // 2. For each group, fetch products + prices and build lookup
  //    key: `${normalizedSetName}|||${normalizedNumber}` -> price
  const lookup = {};

  for (let i = 0; i < groups.length; i++) {
    const { groupId, name: groupName } = groups[i];
    const normSet = normalizeSetName(groupName);
    process.stdout.write(`  [${i + 1}/${groups.length}] ${groupName}... `);

    try {
      const prodRes = await fetch(
        `https://tcgcsv.com/tcgplayer/3/${groupId}/products`,
      );
      await sleep(60);
      const priceRes = await fetch(
        `https://tcgcsv.com/tcgplayer/3/${groupId}/prices`,
      );

      const prodJson = await prodRes.json();
      const priceJson = await priceRes.json();

      // productId -> best price
      const priceById = {};
      for (const p of priceJson.results || []) {
        const mp = p.marketPrice ?? p.midPrice ?? p.lowPrice;
        if (mp == null) continue;
        if (!priceById[p.productId] || mp > priceById[p.productId]) {
          priceById[p.productId] = mp;
        }
      }

      let count = 0;
      for (const card of prodJson.results || []) {
        const numExt = card.extendedData?.find((e) => e.name === "Number");
        if (!numExt) continue; // sealed product, skip
        const normNum = normalizeNumber(numExt.value);
        const key = `${normSet}|||${normNum}`;
        const price = priceById[card.productId];
        if (price != null && lookup[key] == null) {
          lookup[key] = price;
          count++;
        }
      }

      console.log(`${count} cards indexed`);
    } catch (err) {
      console.log(`SKIP (${err.message})`);
    }

    await sleep(DELAY_MS);
  }

  const totalIndexed = Object.keys(lookup).length;
  console.log(`\nTotal TCGCSV price entries indexed: ${totalIndexed}\n`);

  // 3. Fetch all Supabase Pokemon cards with missing/N/A price
  console.log("Fetching Supabase cards with missing prices...");
  let allRows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("cards")
      .select("product_id, card_data")
      .not("product_id", "like", "op_%")
      .not("product_id", "like", "pk3_%")
      .range(from, from + 999);
    if (error) {
      console.error(error.message);
      break;
    }
    if (!data?.length) break;
    allRows.push(...data);
    from += 1000;
    if (data.length < 1000) break;
  }

  const missingPrice = allRows.filter((row) => {
    const price = row.card_data?.extendedData?.find(
      (e) => e.name === "Price",
    )?.value;
    return !price || price === "N/A" || price === "";
  });

  console.log(`Total Pokemon cards: ${allRows.length}`);
  console.log(`Cards with missing/N/A price: ${missingPrice.length}\n`);

  // 4. Match against TCGCSV lookup
  const updatedRows = [];
  let matched = 0;
  let unmatched = 0;
  const unmatchedSets = {};

  for (const row of missingPrice) {
    const ext = row.card_data?.extendedData || [];
    const setName =
      ext.find((e) => e.name === "SetName")?.value ||
      row.card_data?.groupName ||
      "";
    const number = ext.find((e) => e.name === "Number")?.value || "";

    if (!setName || !number) {
      unmatched++;
      continue;
    }

    const normSet = normalizeSetName(setName);
    const normNum = normalizeNumber(number);
    const key = `${normSet}|||${normNum}`;
    const price = lookup[key];

    if (price == null) {
      unmatched++;
      unmatchedSets[setName] = (unmatchedSets[setName] || 0) + 1;
      continue;
    }

    const newExt = ext.map((e) =>
      e.name === "Price" ? { ...e, value: String(price) } : e,
    );
    updatedRows.push({
      product_id: row.product_id,
      name: row.card_data.name || row.product_id,
      card_data: { ...row.card_data, extendedData: newExt },
    });
    matched++;
  }

  console.log(`Matched: ${matched}, Unmatched: ${unmatched}`);

  if (Object.keys(unmatchedSets).length > 0) {
    const topUnmatched = Object.entries(unmatchedSets)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    console.log(
      "\nTop unmatched sets:",
      topUnmatched.map(([s, n]) => `${s} (${n})`).join(", "),
    );
  }

  if (!updatedRows.length) {
    console.log("\nNothing to update.");
    return;
  }

  // 5. Upsert in batches
  console.log(`\nUpserting ${updatedRows.length} rows...`);
  let total = 0;
  for (let i = 0; i < updatedRows.length; i += 500) {
    const { error } = await supabase
      .from("cards")
      .upsert(updatedRows.slice(i, i + 500), { onConflict: "product_id" });
    if (error) {
      console.error("Upsert error:", error.message);
      continue;
    }
    total += Math.min(500, updatedRows.length - i);
    process.stdout.write(`  Upserted ${total}/${updatedRows.length}...\r`);
    await sleep(80);
  }

  console.log(`\n\nDone! ${total} cards updated with TCGCSV prices.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
