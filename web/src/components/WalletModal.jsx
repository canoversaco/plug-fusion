import React, { useState, useEffect } from "react";
import { fetchBtcPriceEUR } from "./btcApi";
import BuyCryptoModal from "./BuyCryptoModal";

const ADMIN_BTC_ADDRESS = "bc1qdhqf4axsq4mnd6eq4fjj06jmfgmtlj5ar574z7";

export default function WalletModal({
  user,
  btcPrice: propBtcPrice,
  onClose,
}) {
  const [btcPrice, setBtcPrice] = useState(propBtcPrice || null);
  const [showBuy, setShowBuy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    if (!propBtcPrice) {
      fetchBtcPriceEUR().then((p) => active && setBtcPrice(p));
    }
    return () => { active = false; };
  }, [propBtcPrice]);

  const userBtc =
    btcPrice && user?.guthaben
      ? (user.guthaben / btcPrice).toFixed(8)
      : "0.00000000";

  const handleCopy = () => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(ADMIN_BTC_ADDRESS).then(() => setCopied(true));
    } else {
      // Fallback für alte Browser
      const ta = document.createElement("textarea");
      ta.value = ADMIN_BTC_ADDRESS;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); setCopied(true); } catch {}
      document.body.removeChild(ta);
    }
    setTimeout(() => setCopied(false), 1100);
  };

  // Zeigt das BuyCryptoModal
  if (showBuy)
    return (
      <BuyCryptoModal
        user={user}
        btcPrice={btcPrice}
        onClose={() => setShowBuy(false)}
      />
    );

  // Firestore-Transaktionen
  const txList = user?.btc_deposits
    ? [...user.btc_deposits].reverse().slice(0, 7)
    : [];

  return (
    <div
      style={{
        minHeight: "100vh",
        minWidth: "100vw",
        background: "radial-gradient(circle at 45% 40%, #222931 65%, #191e24 100%)",
        fontFamily: "'Inter',sans-serif",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 3000,
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "linear-gradient(137deg, #23272e 89%, #38bdf822 100%)",
          borderRadius: 24,
          margin: "48px 0 24px 0",
          padding: "34px 16px 28px 16px",
          maxWidth: 420,
          width: "97vw",
          boxShadow: "0 10px 44px #000a, 0 1px 9px #38bdf822",
          border: "1.5px solid #292933",
          position: "relative",
        }}
      >
        {/* Header */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", right: 14, top: 14,
            fontSize: 28, background: "rgba(37,40,54,0.75)", border: 0,
            color: "#e5e7eb", fontWeight: 800, borderRadius: 10,
            width: 38, height: 38, cursor: "pointer", zIndex: 2,
            transition: "background 0.13s",
          }}
          aria-label="Schließen"
        >×</button>

        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{
            fontWeight: 900, fontSize: 17.7, letterSpacing: 0.13, color: "#e3ff64",
            textShadow: "0 2px 20px #e3ff6420", marginBottom: 5
          }}>
            {user?.username ? `Wallet von ${user.username}` : "Deine Wallet"}
          </div>
          <div style={{
            fontSize: 38, fontWeight: 900, color: "#fff",
            letterSpacing: 0.5, textShadow: "0 2px 15px #10121a30"
          }}>
            {user?.guthaben?.toFixed(2) ?? "0.00"}
            <span style={{ color: "#e3ff64", fontWeight: 800, fontSize: 20, marginLeft: 6 }}>€</span>
          </div>
          <div style={{
            color: "#38bdf8", fontWeight: 700, fontSize: 16,
            marginTop: -3, marginBottom: 1,
          }}>
            ≈ {userBtc} BTC
          </div>
          <div style={{
            fontSize: 13.7, color: "#bdbdbd", fontWeight: 500, marginTop: 3,
          }}>
            {btcPrice ? (
              <>BTC Kurs: <b style={{ color: "#e3ff64" }}>
                {btcPrice.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </b></>
            ) : <>BTC Kurs wird geladen…</>}
          </div>
        </div>

        {/* Aufladen */}
        <section
          style={{
            background: "#191d23",
            borderRadius: 18,
            marginBottom: 23,
            padding: "20px 16px 14px 16px",
            boxShadow: "0 3px 12px #0005",
            border: "1.5px solid #38bdf844",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            gap: 10,
          }}
        >
          <div
            style={{
              fontWeight: 900, color: "#a3e635", fontSize: 17.2,
              letterSpacing: 0.11, marginBottom: 3,
              textAlign: "center"
            }}
          >
            Guthaben aufladen
          </div>
          <button
            onClick={() => setShowBuy(true)}
            style={{
              width: "100%",
              background: "linear-gradient(94deg,#e3ff64 40%,#38bdf8 180%)",
              color: "#191d23", padding: "15px 0", border: 0, borderRadius: 13,
              fontWeight: 900, fontSize: 18, boxShadow: "0 2px 10px #e3ff6422",
              cursor: "pointer", textShadow: "0 2px 10px #e3ff6430", margin: "7px 0 0 0",
              transition: "background 0.15s, box-shadow 0.13s",
              letterSpacing: 0.14,
            }}
          >
            + Guthaben aufladen
          </button>
          <div style={{ marginTop: 13, textAlign: "center", fontSize: 14.1, color: "#bababa" }}>
            Nach der Einzahlung steht dir das Guthaben in wenigen Minuten zur Verfügung!
          </div>
        </section>

        {/* BTC Adresse */}
        <section
          style={{
            background: "#181a1e",
            borderRadius: 15,
            marginBottom: 22,
            padding: "16px 13px 13px 13px",
            boxShadow: "0 1px 7px #0003",
            border: "1.2px solid #38bdf822",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
          }}
        >
          <div
            style={{
              color: "#38bdf8", fontWeight: 800, fontSize: 15.3, marginBottom: 2, letterSpacing: 0.07,
              textTransform: "uppercase",
            }}
          >
            BTC Einzahlungsadresse
          </div>
          <div
            style={{
              fontFamily: "monospace", background: "#1b1d25", padding: "7px 7px",
              borderRadius: 8, fontSize: 14.8, color: "#e3ff64", letterSpacing: 0.13, wordBreak: "break-all",
              userSelect: "all", textAlign: "center", width: "100%", border: "1.5px solid #23262e", fontWeight: 700,
            }}
          >
            {ADMIN_BTC_ADDRESS}
          </div>
          <button
            onClick={handleCopy}
            style={{
              background: copied ? "#e3ff64" : "#23262e",
              color: copied ? "#18181b" : "#38bdf8",
              border: "1.2px solid #23262e",
              borderRadius: 8,
              fontWeight: 800,
              fontSize: 14.5,
              padding: "7px 0",
              width: 176,
              cursor: "pointer",
              boxShadow: copied ? "0 0 0 4px #e3ff6420" : "none",
              marginTop: 1,
              transition: "all 0.12s",
            }}
          >
            {copied ? "✔️ Adresse kopiert" : "Adresse kopieren"}
          </button>
          <span
            style={{
              color: "#a1a1aa",
              fontSize: 13,
              marginTop: 4,
              fontWeight: 500,
              opacity: 0.88,
              textAlign: "center",
              display: "block"
            }}
          >
            Sende BTC an diese Adresse.<br />
            <b>Wichtig:</b> Nur Zahlungen auf diese Adresse werden automatisch erkannt und als Guthaben gutgeschrieben.
          </span>
        </section>

        {/* Transaktionsliste */}
        <section
          style={{
            background: "#191d23",
            borderRadius: 16,
            padding: "15px 10px 10px 13px",
            boxShadow: "0 1px 7px #10121a0a",
            border: "1.1px solid #23262e",
          }}
        >
          <div
            style={{
              fontWeight: 800,
              color: "#38bdf8",
              fontSize: 15.5,
              marginBottom: 10,
              letterSpacing: 0.13,
              textTransform: "uppercase",
            }}
          >
            Letzte Transaktionen
          </div>
          {txList.length > 0 ? (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                color: "#fff",
                fontSize: 14.1,
                display: "flex",
                flexDirection: "column",
                gap: 7,
              }}
            >
              {txList.map((t, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 13,
                    borderLeft:
                      "4px solid " +
                      (t.gutgeschrieben ? "#e3ff64" : "#f59e42"),
                    paddingLeft: 12,
                    background: "#191a22",
                    borderRadius: 10,
                    boxShadow: "0 1px 8px #0002",
                  }}
                >
                  <span style={{ fontSize: 17, marginRight: 3 }}>
                    {t.gutgeschrieben ? "💸" : "⏳"}
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontWeight: 800 }}>
                      Einzahlung
                    </span>
                    <span
                      style={{
                        color: "#a1a1aa",
                        marginLeft: 7,
                        fontWeight: 500,
                        fontSize: 12.5,
                      }}
                    >
                      {t.Timestamp
                        ? new Date(t.Timestamp).toLocaleDateString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                          }) +
                          " " +
                          new Date(t.Timestamp).toLocaleTimeString("de-DE", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                  </span>
                  <span>
                    <b style={{ color: "#e3ff64" }}>
                      +{t.eurValue?.toFixed(2) ?? "?"} €
                    </b>
                    <span
                      style={{
                        color: t.gutgeschrieben ? "#22c55e" : "#f59e42",
                        fontWeight: 700,
                        marginLeft: 7,
                        fontSize: 12,
                      }}
                    >
                      {t.gutgeschrieben ? "Bestätigt" : "Pending"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div
              style={{
                color: "#a1a1aa",
                textAlign: "center",
                fontSize: 14,
                padding: 10,
              }}
            >
              Noch keine Einzahlungen.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
