// src/components/btcApi.js

// Hole alle empfangenen Transaktionen für eine Adresse
export async function fetchReceivedTxs(address) {
  // Rückgabe: [{txid, status, value, ...}]
  const r = await fetch(`https://blockstream.info/api/address/${address}/txs`);
  const txs = await r.json();
  // Berechne, wieviel BTC insgesamt eingegangen ist (alle "vin" ignorieren, nur "vout" für diese Adresse summieren)
  let totalReceived = 0;
  let details = [];
  for (const tx of txs) {
    let value = 0;
    for (const out of tx.vout) {
      if (out.scriptpubkey_address === address) value += out.value;
    }
    if (value > 0) {
      details.push({
        txid: tx.txid,
        value, // in Satoshis!
        confirmations: tx.status.block_height ? 1 : 0, // mindestens 1 Block, dann als "bestätigt"
        time: tx.status.block_time * 1000,
      });
      totalReceived += value;
    }
  }
  return { totalReceived, details }; // BTC = totalReceived/1e8
}

export async function fetchBtcPriceEUR() {
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur"
    );
    if (!r.ok) throw new Error("API Error");
    const data = await r.json();
    return data.bitcoin.eur;
  } catch (e) {
    // Fehler abfangen – optional Fallback-Wert!
    console.error("Konnte BTC Kurs nicht laden!", e);
    return null; // oder ein Fallback, z.B. 40000
  }
}
