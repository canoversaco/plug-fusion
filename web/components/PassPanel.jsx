// src/components/PassPanel.js
import React, { useState, useMemo } from "react";

const WOCHENPAESSE = [
  {
    id: "w1",
    name: "🟢 Wochenpass S",
    preis: 25,
    guthaben: 20,
    rabatt: 5,
    maxRabatt: 10,
    laufzeit: 7,
    text: "5% Rabatt auf alles (max. 10€) + 20€ Guthaben",
  },
  {
    id: "w2",
    name: "🔵 Wochenpass M",
    preis: 50,
    guthaben: 40,
    rabatt: 10,
    maxRabatt: 20,
    laufzeit: 7,
    text: "10% Rabatt auf alles (max. 20€) + 40€ Guthaben",
  },
  {
    id: "w3",
    name: "🟣 Wochenpass L",
    preis: 100,
    guthaben: 80,
    rabatt: 15,
    maxRabatt: 50,
    laufzeit: 7,
    text: "15% Rabatt auf alles (max. 50€) + 80€ Guthaben",
  },
];

const MONATSPAESSE = [
  {
    id: "m1",
    name: "🟢 Monatspass S",
    preis: 50,
    guthaben: 40,
    rabatt: 5,
    maxRabatt: 25,
    laufzeit: 30,
    text: "5% Rabatt auf alles (max. 25€) + 40€ Guthaben",
  },
  {
    id: "m2",
    name: "🔵 Monatspass M",
    preis: 100,
    guthaben: 80,
    rabatt: 10,
    maxRabatt: 75,
    laufzeit: 30,
    text: "10% Rabatt auf alles (max. 75€) + 80€ Guthaben",
  },
  {
    id: "m3",
    name: "🟣 Monatspass L",
    preis: 250,
    guthaben: 200,
    rabatt: 15,
    maxRabatt: 150,
    laufzeit: 30,
    text: "15% Rabatt auf alles (max. 150€) + 200€ Guthaben",
  },
];

// Restzeit schön
function restzeitString(aktivBis) {
  if (!aktivBis) return "";
  const ms = aktivBis - Date.now();
  if (ms < 0) return "abgelaufen";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${d > 0 ? `${d}d ` : ""}${h}h ${m}min`;
}

export default function PassPanel({ user, onGoBack, onBuyPass }) {
  const [message, setMessage] = useState("");
  const [loadingId, setLoadingId] = useState("");

  // Bessere Detection für gültigen Pass:
  const aktiverPass = useMemo(() => {
    if (user.pass && (user.pass.gültigBis ?? user.pass.aktivBis) > Date.now()) {
      return user.pass;
    }
    return null;
  }, [user.pass]);

  const gespart = aktiverPass?.gespartAktuell ?? 0;
  const maxRabatt = aktiverPass?.maxRabatt ?? 0;
  const restRabatt = Math.max(0, maxRabatt - gespart);

  const handleBuy = async (pass) => {
    setMessage("");
    if (aktiverPass) {
      setMessage("❌ Du hast bereits einen aktiven Pass!");
      return;
    }
    if ((user.guthaben ?? 0) < pass.preis) {
      setMessage("❌ Nicht genug Guthaben für diesen Pass.");
      return;
    }
    setLoadingId(pass.id);
    try {
      await onBuyPass({
        ...pass,
        gekauftAm: Date.now(),
        gültigBis: Date.now() + pass.laufzeit * 24 * 3600 * 1000,
        gespartAktuell: 0,
      });
      setMessage(`✅ Pass "${pass.name}" erfolgreich gekauft!`);
    } catch (err) {
      setMessage("❌ Kauf fehlgeschlagen. Versuche es erneut.");
    }
    setLoadingId("");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(133deg, #161718 60%, #1a222f 100%)",
        color: "#fff",
        fontFamily: "'Inter', sans-serif",
        padding: 30,
      }}
    >
      <style>{`
        .passpanel-card {
          transition: box-shadow 0.17s, transform 0.13s;
        }
        .passpanel-card:hover {
          box-shadow: 0 6px 40px #38bdf844, 0 2px 10px #0003;
          transform: scale(1.025);
        }
        .passpanel-btn {
          transition: background 0.14s, color 0.13s, transform 0.13s;
        }
        .passpanel-btn:active {
          transform: scale(0.96);
        }
      `}</style>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          marginBottom: 18,
        }}
      >
        <button
          onClick={onGoBack}
          style={{
            background: "#23262e",
            color: "#fff",
            borderRadius: 10,
            border: 0,
            padding: "10px 22px",
            fontSize: 16,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          ⬅️ Zurück
        </button>
        <h2
          style={{
            fontWeight: 900,
            fontSize: 27,
            letterSpacing: 0.2,
            margin: 0,
          }}
        >
          🎟️ Pässe kaufen
        </h2>
      </div>
      <div
        style={{
          display: "flex",
          gap: 30,
          marginBottom: 19,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span
          style={{
            background: "#23262e",
            padding: "8px 20px",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 16.5,
            color: "#a3e635",
          }}
        >
          Dein Guthaben:{" "}
          <span style={{ color: "#fff", fontWeight: 900 }}>
            {user.guthaben?.toFixed(2) ?? 0} €
          </span>
        </span>
        {aktiverPass && (
          <span
            style={{
              background: "linear-gradient(113deg,#2b3139 60%,#a3e63544 100%)",
              color: "#fff",
              borderRadius: 14,
              padding: "10px 22px",
              fontWeight: 700,
              fontSize: 16.5,
              minWidth: 275,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              boxShadow: "0 2px 16px #a3e63522, 0 1.5px 10px #0002",
              border: "2px solid #a3e63544",
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 900, color: "#a3e635" }}>
              {aktiverPass.name}
            </span>
            <span style={{ color: "#38bdf8", fontWeight: 700 }}>
              {aktiverPass.rabatt}% Rabatt
            </span>
            <span style={{ fontSize: 15.2, color: "#e5e7eb", fontWeight: 600 }}>
              Max. Rabatt: <b>{maxRabatt.toFixed(2)} €</b>
              {" | "}
              Bereits gespart:{" "}
              <span style={{ color: "#38bdf8" }}>{gespart.toFixed(2)} €</span>
              {" | "}
              <span style={{ color: "#a3e635", fontWeight: 700 }}>
                Übrig: {restRabatt.toFixed(2)} €
              </span>
            </span>
            <span style={{ color: "#a1a1aa", fontSize: 14, fontWeight: 600 }}>
              Gültig noch:{" "}
              <span style={{ color: "#a3e635", fontWeight: 800 }}>
                {restzeitString(aktiverPass.gültigBis ?? aktiverPass.aktivBis)}
              </span>
            </span>
          </span>
        )}
      </div>
      <div style={{ marginBottom: 23 }}>
        <h3
          style={{
            color: "#38bdf8",
            fontWeight: 800,
            fontSize: 22,
            marginBottom: 12,
          }}
        >
          🗓️ Wochenpässe
        </h3>
        <div
          style={{
            display: "flex",
            gap: 19,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          {WOCHENPAESSE.map((p) => {
            const disabled =
              !!aktiverPass || (user.guthaben ?? 0) < p.preis || !!loadingId;
            return (
              <div
                key={p.id}
                className="passpanel-card"
                style={{
                  background: "#23262e",
                  borderRadius: 16,
                  padding: 20,
                  minWidth: 240,
                  minHeight: 155,
                  flex: "1 0 230px",
                  boxShadow: "0 2px 12px #0003",
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 2 }}>
                  {p.name}
                </div>
                <div
                  style={{
                    color: "#a3e635",
                    fontSize: 17,
                    fontWeight: 700,
                    marginBottom: 3,
                  }}
                >
                  {p.preis} € / Woche
                </div>
                <div
                  style={{ fontSize: 15, color: "#a1a1aa", marginBottom: 6 }}
                >
                  {p.text}
                </div>
                <div
                  style={{ fontSize: 15.2, color: "#38bdf8", marginBottom: 4 }}
                >
                  ⏱️ Laufzeit: <b>{p.laufzeit} Tage</b>
                </div>
                <button
                  className="passpanel-btn"
                  onClick={() => handleBuy(p)}
                  disabled={disabled}
                  style={{
                    background: disabled ? "#444" : "#a3e635",
                    color: "#18181b",
                    fontWeight: 900,
                    borderRadius: 9,
                    border: 0,
                    padding: "10px 22px",
                    fontSize: 17,
                    cursor: disabled ? "not-allowed" : "pointer",
                    width: "100%",
                    marginTop: 7,
                  }}
                >
                  {loadingId === p.id ? "Kaufe..." : "Jetzt kaufen"}
                </button>
              </div>
            );
          })}
        </div>
        <h3
          style={{
            color: "#38bdf8",
            fontWeight: 800,
            fontSize: 22,
            marginBottom: 12,
            marginTop: 24,
          }}
        >
          📆 Monatspässe
        </h3>
        <div
          style={{
            display: "flex",
            gap: 19,
            flexWrap: "wrap",
          }}
        >
          {MONATSPAESSE.map((p) => {
            const disabled =
              !!aktiverPass || (user.guthaben ?? 0) < p.preis || !!loadingId;
            return (
              <div
                key={p.id}
                className="passpanel-card"
                style={{
                  background: "#23262e",
                  borderRadius: 16,
                  padding: 20,
                  minWidth: 240,
                  minHeight: 155,
                  flex: "1 0 230px",
                  boxShadow: "0 2px 12px #0003",
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 2 }}>
                  {p.name}
                </div>
                <div
                  style={{
                    color: "#a3e635",
                    fontSize: 17,
                    fontWeight: 700,
                    marginBottom: 3,
                  }}
                >
                  {p.preis} € / Monat
                </div>
                <div
                  style={{ fontSize: 15, color: "#a1a1aa", marginBottom: 6 }}
                >
                  {p.text}
                </div>
                <div
                  style={{ fontSize: 15.2, color: "#38bdf8", marginBottom: 4 }}
                >
                  ⏱️ Laufzeit: <b>{p.laufzeit} Tage</b>
                </div>
                <button
                  className="passpanel-btn"
                  onClick={() => handleBuy(p)}
                  disabled={disabled}
                  style={{
                    background: disabled ? "#444" : "#38bdf8",
                    color: "#18181b",
                    fontWeight: 900,
                    borderRadius: 9,
                    border: 0,
                    padding: "10px 22px",
                    fontSize: 17,
                    cursor: disabled ? "not-allowed" : "pointer",
                    width: "100%",
                    marginTop: 7,
                  }}
                >
                  {loadingId === p.id ? "Kaufe..." : "Jetzt kaufen"}
                </button>
              </div>
            );
          })}
        </div>
        {message && (
          <div
            style={{
              marginTop: 18,
              color: message.startsWith("✅") ? "#a3e635" : "#f87171",
              fontWeight: 700,
              fontSize: 16.5,
            }}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
