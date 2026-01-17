import fetch from "node-fetch";
import admin from "firebase-admin";

/* =========================
   Firebase Initialization
========================= */
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/* =========================
   Eclesiar API Key
========================= */
const ECLESIAR_API_KEY = process.env.ECLESIAR_API_KEY;

/* =========================
   Fetch All Countries
========================= */
async function fetchAllCountries() {
  const res = await fetch("https://api.eclesiar.com/countries", {
    headers: {
      Authorization: `Bearer ${ECLESIAR_API_KEY}`,
      Accept: "application/json",
      "User-Agent": "eclesiar-currency-tracker/1.0",
    },
  });

  const json = await res.json();

  if (!json.data || !Array.isArray(json.data)) {
    console.log("No countries data received");
    return [];
  }

  return json.data;
}

/* =========================
   Fetch Market Rate
========================= */
async function fetchMarketRate(currencyId) {
  const res = await fetch(
    `https://api.eclesiar.com/market/coin/get?currency_id=${currencyId}`,
    {
      headers: {
        Authorization: `Bearer ${ECLESIAR_API_KEY}`,
        Accept: "application/json",
        "User-Agent": "eclesiar-currency-tracker/1.0",
      },
    }
  );

  const json = await res.json();

  if (!json.data || json.data.length === 0) {
    return null;
  }

  // Best (lowest) sell price
  return json.data[0].rate;
}

/* =========================
   Main Runner
========================= */
async function run() {
  console.log("Starting hourly currency fetch...");

  const countries = await fetchAllCountries();
  console.log("Total countries:", countries.length);

  let stored = 0;
  let skipped = 0;

  for (const country of countries) {
    if (!country.currency || !country.currency.id) {
      skipped++;
      continue;
    }

    const rate = await fetchMarketRate(country.currency.id);

    if (!rate) {
      console.log(`No market data for ${country.name}`);
      skipped++;
      continue;
    }

    await db.collection("currency_prices").add({
      country: country.name,
      currency: country.currency.name,
      currency_id: country.currency.id,
      gold_rate: rate,
      unit: "1g",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Stored ${country.name}: ${rate}`);
    stored++;
  }

  console.log(`DONE → Stored: ${stored}, Skipped: ${skipped}`);
}

/* =========================
   Execute
========================= */
run();
