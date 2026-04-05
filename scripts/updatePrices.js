// Price refresh script: Fetches latest market prices from TCGCSV (One Piece)
// and Pokemon TCG API (Pokemon cards), then updates Supabase.
//
// Run with:
//   $env:SUPABASE_SERVICE_KEY='your_key'; node scripts/updatePrices.js
//
// You can also limit scope:
//   node scripts/updatePrices.js --only=onepiece
//   node scripts/updatePrices.js --only=pokemon

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://wtyxoufpbabvqsjiipuu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error(
    "Error: SUPABASE_SERVICE_KEY environment variable is required.",
  );
  console.error(
    "Run with: $env:SUPABASE_SERVICE_KEY='your_key'; node scripts/updatePrices.js",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith("--only="))?.split("=")[1];
const DELAY_MS = 100;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Fetch all cards of a given type from Supabase ────────────────────────────
async function fetchSupabaseCards(cardType) {
  let allRows = [];
  let from = 0;
  while (true) {
    const query = supabase
      .from("cards")
      .select("product_id, card_data")
      .range(from, from + 999);
    if (cardType === "OnePiece") {
      query.eq("card_type", "OnePiece");
    } else {
      query.neq("card_type", "OnePiece");
    }
    const { data, error } = await query;
    if (error) {
      console.error("Supabase error:", error.message);
      break;
    }
    if (!data?.length) break;
    allRows.push(...data);
    from += 1000;
    if (data.length < 1000) break;
  }
  return allRows;
}

// ── Update a batch of rows in Supabase ───────────────────────────────────────
async function upsertBatch(rows) {
  if (!rows.length) return 0;
  const { error } = await supabase
    .from("cards")
    .upsert(rows, { onConflict: "product_id" });
  if (error) {
    console.error("  Upsert error:", error.message);
    return 0;
  }
  return rows.length;
}

// ── ONE PIECE: prices from TCGCSV category 68 ────────────────────────────────
async function updateOnePiecePrices() {
  console.log("\n=== Updating One Piece Prices (TCGCSV category 68) ===");

  const allCards = await fetchSupabaseCards("OnePiece");
  console.log(`Found ${allCards.length} One Piece cards in Supabase.`);
  if (!allCards.length) return;

  // Group by TCGCSV groupId
  const byGroup = {};
  for (const row of allCards) {
    const groupId = row.card_data?.groupId;
    if (!groupId) continue;
    if (!byGroup[groupId]) byGroup[groupId] = [];
    byGroup[groupId].push(row);
  }

  const groups = Object.keys(byGroup);
  console.log(`${groups.length} unique groups to fetch prices for.\n`);

  const updatedRows = [];

  for (let i = 0; i < groups.length; i++) {
    const groupId = groups[i];
    const cards = byGroup[groupId];
    process.stdout.write(`  [${i + 1}/${groups.length}] Group ${groupId} — `);

    let priceMap = {};
    try {
      const res = await fetch(
        `https://tcgcsv.com/tcgplayer/68/${groupId}/prices`,
      );
      if (res.ok) {
        const json = await res.json();
        // For each product, keep the highest marketPrice across subTypes (Normal/Foil/etc.)
        for (const p of json.results || []) {
          if (p.marketPrice == null) continue;
          const existing = priceMap[p.productId];
          if (existing === undefined || p.marketPrice > existing) {
            priceMap[p.productId] = p.marketPrice;
          }
        }
      }
    } catch (err) {
      console.log(`SKIP (${err.message})`);
      continue;
    }

    let matched = 0;
    for (const row of cards) {
      // product_id is "op_12345" → strip prefix for lookup
      const numericId = parseInt(
        String(row.product_id).replace(/^op_/, ""),
        10,
      );
      const price = priceMap[numericId];
      if (price === undefined) continue;

      const extendedData = (row.card_data.extendedData || []).map((e) =>
        e.name === "Price" ? { ...e, value: String(price) } : e,
      );
      updatedRows.push({
        product_id: row.product_id,
        name: row.card_data.name || row.product_id,
        card_data: { ...row.card_data, extendedData },
      });
      matched++;
    }
    console.log(`${matched}/${cards.length} prices found`);
    await sleep(DELAY_MS);
  }

  // Upsert in batches of 500
  let total = 0;
  for (let i = 0; i < updatedRows.length; i += 500) {
    total += await upsertBatch(updatedRows.slice(i, i + 500));
    await sleep(80);
  }
  console.log(`\nOne Piece done: ${total} cards updated.`);
}

// ── POKEMON: prices from Pokemon TCG API ─────────────────────────────────────
async function updatePokemonPrices() {
  console.log("\n=== Updating Pokemon Prices (api.pokemontcg.io) ===");

  const allCards = await fetchSupabaseCards("Pokemon");
  console.log(`Found ${allCards.length} Pokemon cards in Supabase.`);
  if (!allCards.length) return;

  // Build a Set of productIds we have in Supabase
  const ourIds = new Set(allCards.map((r) => r.product_id));

  // Fetch all pages from Pokemon TCG API — only request id + tcgplayer fields
  console.log("Fetching prices from Pokemon TCG API (paginated)...");
  const priceMap = {};
  let page = 1;

  while (true) {
    try {
      const url = `https://api.pokemontcg.io/v2/cards?page=${page}&pageSize=250&select=id,tcgplayer`;
      const res = await fetch(url);
      if (!res.ok) {
        console.log(`  Page ${page}: HTTP ${res.status}, stopping.`);
        break;
      }
      const json = await res.json();
      const cards = json.data || [];
      if (!cards.length) break;

      for (const c of cards) {
        const prices = c.tcgplayer?.prices || {};
        const SUBTYPES = [
          "holofoil", "normal", "reverseHolofoil", "1stEditionHolofoil",
          "unlimitedHolofoil", "1stEditionNormal", "unlimitedNormal",
          "specialIllustrationRare", "illustrationRare", "doubleRare",
          "hyperRare", "aceSpec", "shiny", "shinyHoloRare",
        ];
        let market = null;
        for (const s of SUBTYPES) {
          if (prices[s]?.market != null) { market = prices[s].market; break; }
        }
        if (market == null) {
          for (const s of SUBTYPES) {
            if (prices[s]?.mid != null) { market = prices[s].mid; break; }
          }
        }
        if (market == null) {
          for (const s of SUBTYPES) {
            if (prices[s]?.low != null) { market = prices[s].low; break; }
          }
        }
        if (market !== null) {
          priceMap[c.id] = market;
        }
      }

      process.stdout.write(
        `  Page ${page} — ${cards.length} cards, ${Object.keys(priceMap).length} prices collected  \r`,
      );
      if (cards.length < 250) break;
      page++;
      await sleep(DELAY_MS);
    } catch (err) {
      console.log(`\n  Page ${page} error: ${err.message}, stopping.`);
      break;
    }
  }
  console.log(
    `\nFetched ${Object.keys(priceMap).length} prices from Pokemon TCG API.`,
  );

  const updatedRows = [];
  for (const row of allCards) {
    const price = priceMap[row.product_id];
    if (price === undefined) continue;
    const extendedData = (row.card_data.extendedData || []).map((e) =>
      e.name === "Price" ? { ...e, value: String(price) } : e,
    );
    updatedRows.push({
      product_id: row.product_id,
      name: row.card_data.name || row.product_id,
      card_data: { ...row.card_data, extendedData },
    });
  }

  let total = 0;
  for (let i = 0; i < updatedRows.length; i += 500) {
    total += await upsertBatch(updatedRows.slice(i, i + 500));
    process.stdout.write(`  Upserted ${total}/${updatedRows.length}...\r`);
    await sleep(80);
  }
  console.log(`\nPokemon done: ${total} cards updated.`);
}

// ── POKEMON TCGCSV EXTRAS: prices from TCGCSV category 3 ────────────────────
async function updateTCGCSVPokemonPrices() {
  console.log(
    "\n=== Updating TCGCSV Pokemon Prices (category 3, pk3_ prefix) ===",
  );

  let allRows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("cards")
      .select("product_id, card_data")
      .like("product_id", "pk3_%")
      .range(from, from + 999);
    if (error) {
      console.error("Supabase error:", error.message);
      break;
    }
    if (!data?.length) break;
    allRows.push(...data);
    from += 1000;
    if (data.length < 1000) break;
  }

  console.log(
    `Found ${allRows.length} TCGCSV Pokemon (pk3_) cards in Supabase.`,
  );
  if (!allRows.length) return;

  const byGroup = {};
  for (const row of allRows) {
    const groupId = row.card_data?.groupId;
    if (!groupId) continue;
    if (!byGroup[groupId]) byGroup[groupId] = [];
    byGroup[groupId].push(row);
  }

  const groups = Object.keys(byGroup);
  const updatedRows = [];

  for (let i = 0; i < groups.length; i++) {
    const groupId = groups[i];
    const cards = byGroup[groupId];
    process.stdout.write(`  [${i + 1}/${groups.length}] Group ${groupId} — `);

    let priceMap = {};
    try {
      const res = await fetch(
        `https://tcgcsv.com/tcgplayer/3/${groupId}/prices`,
      );
      if (res.ok) {
        const json = await res.json();
        for (const p of json.results || []) {
          if (p.marketPrice == null) continue;
          const existing = priceMap[p.productId];
          if (existing === undefined || p.marketPrice > existing) {
            priceMap[p.productId] = p.marketPrice;
          }
        }
      }
    } catch (err) {
      console.log(`SKIP (${err.message})`);
      continue;
    }

    let matched = 0;
    for (const row of cards) {
      const numericId = parseInt(
        String(row.product_id).replace(/^pk3_/, ""),
        10,
      );
      const price = priceMap[numericId];
      if (price === undefined) continue;
      const extendedData = (row.card_data.extendedData || []).map((e) =>
        e.name === "Price" ? { ...e, value: String(price) } : e,
      );
      updatedRows.push({
        product_id: row.product_id,
        name: row.card_data.name || row.product_id,
        card_data: { ...row.card_data, extendedData },
      });
      matched++;
    }
    console.log(`${matched}/${cards.length} prices found`);
    await sleep(DELAY_MS);
  }

  let total = 0;
  for (let i = 0; i < updatedRows.length; i += 500) {
    total += await upsertBatch(updatedRows.slice(i, i + 500));
    await sleep(80);
  }
  console.log(`\nTCGCSV Pokemon done: ${total} cards updated.`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Price Refresh Script ===");
  if (onlyArg) console.log(`Scope: ${onlyArg} only`);

  if (!onlyArg || onlyArg === "onepiece") await updateOnePiecePrices();
  if (!onlyArg || onlyArg === "pokemon") await updatePokemonPrices();
  if (!onlyArg || onlyArg === "pokemon") await updateTCGCSVPokemonPrices();

  console.log("\n=== All done! ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
