import fetch from "node-fetch";
import admin from "firebase-admin";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const ECLESIAR_API_KEY = process.env.ECLESIAR_API_KEY;

async function fetchAllCountries() {
  const res = await fetch("https://api.eclesiar.com/countries", {
    headers: {
      "X-API-KEY": ECLESIAR_API_KEY,
      "Accept": "application/json",
      "User-Agent": "eclesiar-currency-tracker/1.0"
    }
  });

  const json = await res.json();

  console.log("Countries API FULL response:", JSON.stringify(json, null, 2));

  if (!json.data || !Array.isArray(json.data)) {
    console.log("No countries data");
    return [];
  }

  return json.data;
  }
  if (Array.isArray(json.data.countries)) {
    return json.data.countries;
  }

  console.log("Unexpected countries format:", json.data);
  return [];
}

async function fetchMarketRate(currencyId) {
  const res = await fetch(
    `https://api.eclesiar.com/market/coin/get?currency_id=${currencyId}`,
    {
      headers: {
        "X-API-KEY": ECLESIAR_API_KEY,
        "Accept": "application/json",
        "User-Agent": "eclesiar-currency-tracker/1.0"
      }
    }
  );

  const json = await res.json();

  if (!json.data || json.data.length === 0) return null;

  return json.data[0].rate;
}

async function getLastKnownRate(currencyId) {
  const snapshot = await db
    .collection("currency_prices")
    .where("currency_id", "==", currencyId)
    .orderBy("timestamp", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  return snapshot.docs[0].data().gold_rate;
}

async function run() {
  const countries = await fetchAllCountries();

  console.log("Total countries:", countries.length);

  let stored = 0;
  let reused = 0;
  let skipped = 0;

  for (const c of countries) {
    if (!c.currency || !c.currency.id) {
      skipped++;
      continue;
    }

    // 1️⃣ Try live market
    let rate = await fetchMarketRate(c.currency.id);

    // 2️⃣ If no live market → fallback to last known
    if (!rate) {
      rate = await getLastKnownRate(c.currency.id);

      if (!rate) {
        console.log(`No data ever for ${c.name}`);
        skipped++;
        continue;
      }

      console.log(`Reusing last price for ${c.name}: ${rate}`);
      reused++;
    } else {
      console.log(`Live price for ${c.name}: ${rate}`);
    }

    await db.collection("currency_prices").add({
      country: c.name,
      currency: c.currency.name,
      currency_id: c.currency.id,
      gold_rate: rate,
      unit: "1g",
      source: rate ? "live_or_cached" : "unknown",
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    stored++;
  }

  console.log(
    `DONE → Stored: ${stored}, Reused: ${reused}, Skipped: ${skipped}`
  );
}

run();
