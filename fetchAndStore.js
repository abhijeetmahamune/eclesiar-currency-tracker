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
      "Accept": "application/json"
    }
  });

  const json = await res.json();

  // 🔍 Detect correct array
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.countries)) return json.countries;
  if (json.data && Array.isArray(json.data.countries)) return json.data.countries;

  console.log("Unexpected countries response:", json);
  return [];
}


  // const json = await res.json();
  // return json.data;
}

async function fetchMarketRate(currencyId) {
  const res = await fetch(
    `https://api.eclesiar.com/market/coin/get?currency_id=${currencyId}`,
    {
      headers: {
        "X-API-KEY": ECLESIAR_API_KEY,
        "Accept": "application/json"
      }
    }
  );

  const json = await res.json();
  if (!json.data || json.data.length === 0) return null;

  return json.data[0].rate; // best price
}

async function run() {
  const countries = await fetchAllCountries();

if (!Array.isArray(countries) || countries.length === 0) {
  console.log("No countries fetched. Exiting safely.");
  return;
}

  
  for (const c of countries) {
    if (!c.currency || !c.currency.id) continue;

    const rate = await fetchMarketRate(c.currency.id);
    if (!rate) continue;

    await db.collection("currency_prices").add({
      country: c.name,
      currency: c.currency.name,
      currency_id: c.currency.id,
      gold_rate: rate,
      unit: "1g",
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`Stored ${c.name}: ${rate}`);
  }
}

run();
