import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  doc,
  updateDoc,
  getDoc,
  onSnapshot,
  addDoc,
  query,
  orderBy,
} from "firebase/firestore";

function anonymisiereName(name) {
  if (!name) return "";
  if (name.length < 2) return "***";
  return name.slice(0, 2) + "***" + name.slice(-2);
}

export default function LottoView({ user, onGoBack }) {
  const [lottos, setLottos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Lade alle Ziehungen (letzte zuerst)
  useEffect(() => {
    const q = query(collection(db, "lottos"), orderBy("end", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const allLottos = [];
      snap.forEach((d) => allLottos.push({ id: d.id, ...d.data() }));
      setLottos(allLottos);
    });
    return unsub;
  }, []);

  // Finde aktuelles Lotto (offen oder die zuletzt beendete)
  const aktuelleLotto = lottos.find((l) => !l.finished) || lottos[0] || null;

  // Hat User schon teilgenommen?
  const hatTeilgenommen = aktuelleLotto?.teilnehmer?.some(
    (t) => t.userId === user.id
  );

  function timeLeft(end) {
    if (!end) return "";
    const ms = end - Date.now();
    if (ms < 0) return "Beendet";
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${d > 0 ? `${d}d ` : ""}${h}h ${m}min`;
  }

  // Teilnahme kaufen
  async function handleTeilnahme() {
    setLoading(true);
    setMessage("");
    try {
      // Genug Guthaben?
      const userRef = doc(db, "users", user.id);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : {};
      if ((userData.guthaben ?? 0) < 5) {
        setMessage("❌ Nicht genug Guthaben!");
        setLoading(false);
        return;
      }
      if (hatTeilgenommen) {
        setMessage("Du hast schon teilgenommen.");
        setLoading(false);
        return;
      }
      // Update Lotto
      const lottoDoc = doc(db, "lottos", aktuelleLotto.id);
      const lottoSnap = await getDoc(lottoDoc);
      const data = lottoSnap.data();
      await updateDoc(lottoDoc, {
        pot: (data.pot || 0) + 5,
        teilnehmer: [
          ...(data.teilnehmer || []),
          {
            userId: user.id,
            username: user.username,
            teilgenommenAm: Date.now(),
          },
        ],
      });
      await updateDoc(userRef, {
        guthaben: (userData.guthaben ?? 0) - 5,
      });
      setMessage("✅ Teilnahme erfolgreich!");
    } catch (e) {
      setMessage("Fehler bei Teilnahme.");
    }
    setLoading(false);
  }

  // Gewinner-Block
  function WinnerBlock({ lotto }) {
    if (!lotto.finished || !lotto.gewinner) return null;
    const gewinnerArr = Array.isArray(lotto.gewinner)
      ? lotto.gewinner
      : [lotto.gewinner];
    const gewinnBetrag = ((lotto.pot || 0) * 0.9) / gewinnerArr.length;
    return (
      <div
        style={{
          marginTop: 14,
          marginBottom: 9,
          background: "#23262e",
          borderRadius: 11,
          padding: 12,
          boxShadow: "0 2px 14px #a3e63522",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontWeight: 900,
            fontSize: 19,
            color: "#a3e635",
            marginBottom: 5,
          }}
        >
          🏆 Gewinner
        </div>
        {gewinnerArr.map((w, i) => (
          <div
            key={i}
            style={{
              color: "#38bdf8",
              fontWeight: 700,
              fontSize: 16,
              marginBottom: 1,
            }}
          >
            {anonymisiereName(w.username || w)}
            <span
              style={{
                color: "#a3e635",
                fontWeight: 900,
                fontSize: 15,
                marginLeft: 7,
              }}
            >
              +{gewinnBetrag.toFixed(2)} €
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Verlauf-Block
  function VerlaufBlock() {
    // Zeige alle vergangenen Lottos (ohne das aktuell laufende, max 10)
    const vergangene = lottos.filter((l) => l.finished).slice(0, 10);
    if (!vergangene.length) return null;
    return (
      <div
        style={{
          marginTop: 32,
          marginBottom: 20,
          background: "#18181b",
          borderRadius: 13,
          padding: 15,
          boxShadow: "0 2px 12px #23262e66",
        }}
      >
        <div
          style={{
            fontWeight: 900,
            fontSize: 20,
            color: "#38bdf8",
            marginBottom: 8,
          }}
        >
          🎲 Verlauf der letzten Runden
        </div>
        {vergangene.map((lotto, i) => (
          <div
            key={lotto.id || i}
            style={{
              borderBottom:
                i !== vergangene.length - 1 ? "1px solid #2a2a32" : "none",
              paddingBottom: 9,
              marginBottom: 9,
            }}
          >
            <div style={{ color: "#fff", fontWeight: 700 }}>
              <span style={{ color: "#a3e635" }}>
                {new Date(lotto.end).toLocaleDateString()}
              </span>
              {" | "}
              Pot: {lotto.pot?.toFixed(2) || "0.00"} €
            </div>
            <WinnerBlock lotto={lotto} />
            <div style={{ fontSize: 13, color: "#aaa" }}>
              Teilnehmer:&nbsp;
              {(lotto.teilnehmer || []).map((t, j) => (
                <span key={j}>
                  {anonymisiereName(t.username)}
                  {j !== (lotto.teilnehmer?.length ?? 1) - 1 ? ", " : ""}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Falls keine Ziehung
  if (!aktuelleLotto)
    return (
      <div style={{ color: "#fff", padding: 40 }}>
        <button onClick={onGoBack}>⬅️ Zurück</button>
        <h2 style={{ marginTop: 30 }}>🎰 Lotto</h2>
        <div>Aktuell läuft keine Ziehung.</div>
        <VerlaufBlock />
      </div>
    );

  // Haupt-Render
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(133deg,#18181b 65%,#23262e 100%)",
        color: "#fff",
        fontFamily: "'Inter',sans-serif",
        padding: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          margin: "0 auto",
          paddingTop: 60,
        }}
      >
        <button
          onClick={onGoBack}
          style={{
            background: "#23262e",
            color: "#fff",
            borderRadius: 9,
            border: 0,
            padding: "10px 23px",
            fontSize: 17,
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: 14,
          }}
        >
          ⬅️ Zurück
        </button>
        <h2
          style={{
            textAlign: "center",
            fontSize: 32,
            fontWeight: 900,
            letterSpacing: 1,
            marginBottom: 6,
          }}
        >
          {aktuelleLotto.finished
            ? "🎰 Lotto - Ziehung beendet"
            : "🎰 Wöchentliches Lotto"}
        </h2>
        <div
          style={{
            background: "linear-gradient(97deg,#38bdf8 70%,#a3e635 100%)",
            color: "#18181b",
            fontWeight: 800,
            borderRadius: 12,
            fontSize: 23,
            padding: "16px 0 14px 0",
            margin: "23px 0 19px 0",
            textAlign: "center",
            boxShadow: "0 2px 24px #38bdf822",
          }}
        >
          🏆 Pot: {aktuelleLotto.pot?.toFixed(2) || "0.00"} €
        </div>
        {!aktuelleLotto.finished && (
          <div style={{ textAlign: "center", fontSize: 18, marginBottom: 18 }}>
            Ziehung endet in:{" "}
            <span style={{ color: "#38bdf8" }}>
              {timeLeft(aktuelleLotto.end)}
            </span>
          </div>
        )}
        <div
          style={{
            textAlign: "center",
            fontSize: 15.2,
            background: "#23262e",
            borderRadius: 10,
            padding: "14px 7px",
            marginBottom: 17,
          }}
        >
          Teilnahme: <b>5 €</b> <br />
          Gebühren: <b>10%</b> <br />
          Gewinner bekommt:{" "}
          <b style={{ color: "#a3e635" }}>
            {((aktuelleLotto.pot || 0) * 0.9).toFixed(2)} €
          </b>
        </div>

        {/* Teilnahme-Button */}
        {!aktuelleLotto.finished && (
          <button
            onClick={handleTeilnahme}
            disabled={hatTeilgenommen || loading}
            style={{
              background: hatTeilgenommen
                ? "#38bdf866"
                : "linear-gradient(100deg,#a3e635 70%,#38bdf8 100%)",
              color: "#18181b",
              fontWeight: 900,
              border: 0,
              borderRadius: 11,
              fontSize: 22,
              padding: "15px 0",
              cursor: hatTeilgenommen ? "not-allowed" : "pointer",
              width: "100%",
              boxShadow: "0 2px 12px #38bdf822",
              marginBottom: 19,
              marginTop: 3,
              transition: "all 0.18s",
            }}
          >
            {hatTeilgenommen
              ? "✅ Teilnahme gebucht"
              : loading
              ? "..."
              : "Jetzt teilnehmen"}
          </button>
        )}
        {message && (
          <div
            style={{
              color: message.startsWith("✅") ? "#a3e635" : "#f87171",
              marginTop: 7,
              fontWeight: 700,
            }}
          >
            {message}
          </div>
        )}

        {/* Gewinner-Anzeige */}
        {aktuelleLotto.finished && <WinnerBlock lotto={aktuelleLotto} />}

        {/* Teilnehmer-Liste */}
        <div
          style={{
            marginTop: 21,
            background: "#18181b",
            borderRadius: 9,
            padding: 14,
            boxShadow: "0 1px 8px #0003",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 7 }}>
            Teilnehmer (anonymisiert)
          </div>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gap: 4,
            }}
          >
            {(aktuelleLotto.teilnehmer || []).map((t, i) => (
              <li key={i} style={{ color: "#38bdf8", fontWeight: 600 }}>
                {anonymisiereName(t.username)}
              </li>
            ))}
          </ul>
        </div>

        {/* Verlauf der letzten Ziehungen */}
        <VerlaufBlock />
      </div>
    </div>
  );
}
