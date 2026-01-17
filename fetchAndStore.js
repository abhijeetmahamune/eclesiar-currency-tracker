import fetch from "node-fetch";
import admin from "firebase-admin";

// 🔐 Firebase service account (from secrets)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🔐 Eclesiar API Key
const ECLESIAR_API_KEY = process.env.ECLESIAR_API_KEY;

// India currency ID (we’ll expand later)
const CURRENCY_ID = 40;

async function fetchCurrency() {
  const res = await fetch(
    `https://api.eclesiar.com/market/coin/get?currency_id=${CURRENCY_ID}`,
    {
      headers: {
        "X-API-KEY": ECLESIAR_API_KEY,
        "Accept": "application/json"
      }
    }
  );

const json = await res.json();

if (!json.data || json.data.length === 0) {
  console.log("No market data available. Skipping this run.");
  return;
}

const bestRate = json.data[0].rate;

  await db.collection("currency_prices").add({
    country: "India",
    currency: "INR",
    currency_id: CURRENCY_ID,
    gold_rate: bestRate,
    unit: "1g",
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log("Stored:", bestRate);
}

fetchCurrency();
