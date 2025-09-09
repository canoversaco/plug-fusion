// fixMysteryBoxProdukte.js
const admin = require("firebase-admin");
const path = require("path");

// HIER ggf. Pfad anpassen:
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

function normalizeProdukte(p) {
  if (Array.isArray(p)) return p;
  if (!p) return [];
  if (typeof p === "object") {
    return Object.keys(p)
      .filter((k) => !isNaN(k))
      .sort((a, b) => a - b)
      .map((k) => p[k]);
  }
  return [];
}

async function main() {
  const boxesSnap = await db.collection("mysteryBoxes").get();
  let changed = 0;
  for (const doc of boxesSnap.docs) {
    const data = doc.data();
    const orig = data.produkte;
    const fixed = normalizeProdukte(orig);
    // Nur speichern, wenn geändert (oder leeres Feld zu [] machen)
    const origIsArray = Array.isArray(orig);
    const origIsObject =
      typeof orig === "object" && orig !== null && !origIsArray;
    const needsFix =
      (origIsObject && Object.keys(orig).length > 0) ||
      (origIsObject && Object.keys(orig).length === 0 && fixed.length === 0) ||
      (!origIsArray && !origIsObject) ||
      (origIsArray && fixed.length !== orig.length);

    if (needsFix) {
      await doc.ref.update({ produkte: fixed });
      console.log(
        `✔️ ${doc.id}: produkte wurde als korrektes Array gespeichert (${fixed.length} Einträge)`
      );
      changed++;
    }
  }
  if (changed === 0) {
    console.log("Alles schon in Ordnung, keine Änderung nötig.");
  } else {
    console.log(`Fertig! ${changed} Boxen wurden korrigiert.`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
