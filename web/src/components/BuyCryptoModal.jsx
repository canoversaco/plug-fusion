import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

// Adresse & Anbieter
const ADMIN_BTC_ADDRESS = "bc1qdhqf4axsq4mnd6eq4fjj06jmfgmtlj5ar574z7";
const GUARDARIAN_URL = "https://guardarian.com";


export default function BuyCryptoModal({ user, onClose }) {
  // Step: 0=Start, 1=Pending
  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState(""); // EUR Betrag
  const [btcEstimate, setBtcEstimate] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  
  // --- EUR zu BTC Vorschau (Guardarian liefert keine API, also quick fetch von coinmarketcap)
  const fetchBtcEstimate = async (eur) => {
    try {
      const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur");
      const data = await res.json();
      if (data?.bitcoin?.eur) {
        const btc = (eur / data.bitcoin.eur).toFixed(7);
        setBtcEstimate(btc);
        return btc;
      }
    } catch {}
    setBtcEstimate("");
    return "";
  };

  // --- Clipboard Copy ---
  function handleCopy() {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(ADMIN_BTC_ADDRESS).then(() => setCopied(true));
    } else {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = ADMIN_BTC_ADDRESS;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); setCopied(true); } catch {}
      document.body.removeChild(ta);
    }
    setTimeout(() => setCopied(false), 1100);
  }

  // --- Start Einzahlung: in DB hinterlegen + Step wechseln ---
  async function startDeposit() {
  const userSnap = await getDoc(userRef);
  const userData = userSnap.exists() ? userSnap.data() : {};
    setErr("");
    const eur = parseFloat(amount);
    if (!eur || eur < 10) { setErr("Bitte mind. 10 € eingeben."); return; }
    setPending(true);
    const btc = await fetchBtcEstimate(eur);
    try {
await updateDoc(userRef, {
  guthaben: (userData.guthaben || 0) + eurValue,
  btc_deposits: [
    ...(userData.btc_deposits || []),
    {
      ...passendeTx,
      gutgeschrieben: true,
      eurValue,
      Timestamp: Date.now(),
    },
  ],
  openDeposit: { ...open, erledigt: true, txid: passendeTx.txid },
});
      setStep(1);
    } catch (e) {
      setErr("Fehler beim Speichern. Versuche es erneut!");
    }
    setPending(false);
  }

  // --- Einzahlung abbrechen (openDeposit zurücksetzen) ---
  async function cancelDeposit() {
    try {
      await updateDoc(doc(db, "users", user.id), {
        openDeposit: null,
      });
    } catch {}
    onClose();
  }

  // --- Stepper UI ---
  return (
    <div
      style={{
        minHeight: "100vh",
        minWidth: "100vw",
        background: "rgba(18,22,31,0.93)",
        color: "#fafaf9",
        fontFamily: "'Inter',sans-serif",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 10000,
        backdropFilter: "blur(5px)",
      }}
      onClick={cancelDeposit}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "linear-gradient(137deg, #23272e 89%, #38bdf822 100%)",
          borderRadius: 22,
          padding: "33px 19px 26px 19px",
          maxWidth: 410,
          width: "97vw",
          boxShadow: "0 9px 36px #000a, 0 1px 7px #38bdf822",
          border: "1.5px solid #292933",
          position: "relative",
        }}
      >
        {/* CLOSE */}
        <button
          onClick={cancelDeposit}
          style={{
            position: "absolute", right: 15, top: 14,
            fontSize: 27, background: "rgba(37,40,54,0.74)", border: 0,
            color: "#e5e7eb", fontWeight: 800, borderRadius: 8,
            width: 36, height: 36, cursor: "pointer", zIndex: 2,
          }}
          aria-label="Schließen"
        >×</button>

        <h2 style={{
          color: "#38bdf8", marginBottom: 9, fontWeight: 900, fontSize: 21,
          letterSpacing: 0.8, textAlign: "center"
        }}>
          Guthaben aufladen
        </h2>
        <div style={{
          color: "#f59e42", fontWeight: 700, textAlign: "center",
          fontSize: 14.7, marginBottom: 12, marginTop: -4
        }}>
          <span style={{ color: "#a3e635" }}>Kein KYC, keine Registrierung!</span> Zahlung mit Apple Pay, SEPA & Karten.<br />
          Anbieter: <a href="https://guardarian.com/" target="_blank" rel="noopener noreferrer" style={{ color: "#38bdf8", textDecoration: "underline" }}>Guardarian</a>
        </div>
        
        {/* --- Step 0: Betrag auswählen und Info --- */}
        {step === 0 && (
          <>
            <div style={{
              marginBottom: 9, fontSize: 15.1, color: "#bababa", textAlign: "center"
            }}>
              <b>1.</b> Wunschbetrag (€) eingeben <br />
              <input
                type="number"
                min={10}
                step={1}
                value={amount}
                onChange={e => {
                  setAmount(e.target.value);
                  fetchBtcEstimate(e.target.value);
                }}
                style={{
                  width: 150, fontSize: 16, padding: "7px 9px",
                  borderRadius: 8, border: "1px solid #333", marginTop: 7, fontWeight: 700,
                  marginBottom: 7, color: "#23272e", background: "#f7f7ff",
                  boxShadow: "0 1px 5px #23262e11"
                }}
                placeholder="Betrag in €"
              />
              {btcEstimate && (
                <div style={{ color: "#38bdf8", marginTop: 2 }}>
                  Entspricht ca. <b>{btcEstimate} BTC</b>
                </div>
              )}
            </div>
            <div style={{
              marginBottom: 7, fontSize: 15.1, color: "#bababa", textAlign: "center"
            }}>
              <b>2.</b> Klicke auf <b>„Jetzt via Guardarian kaufen“</b>
              <br />
              <a
                href={GUARDARIAN_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: "#38bdf8", color: "#23272e",
                  fontWeight: 900, padding: "13px 0", borderRadius: 12,
                  width: "100%", display: "block", textAlign: "center",
                  fontSize: 16.5, margin: "8px 0 4px 0", boxShadow: "0 1.5px 9px #38bdf822",
                  textDecoration: "none", letterSpacing: 0.13, marginBottom: 6
                }}
                onClick={startDeposit}
                disabled={pending}
              >
                Jetzt via Guardarian kaufen →
              </a>
            </div>
            <div style={{
              marginBottom: 10, color: "#bababa", fontSize: 14, textAlign: "center"
            }}>
              <b>3.</b> Sende <b>exakt</b> den im Shop angezeigten BTC-Betrag an:<br />
              <span
                style={{
                  color: "#a3e635", fontFamily: "monospace",
                  background: "#18181b", borderRadius: 7, padding: "7px 8px",
                  display: "inline-block", margin: "7px 0 4px 0",
                  boxShadow: "0 1px 5px #23262e22", border: "1.2px solid #292933",
                  letterSpacing: 0.19,
                }}
              >
                {ADMIN_BTC_ADDRESS}
              </span>
              <button
                onClick={handleCopy}
                style={{
                  background: copied ? "#22c55e" : "#23262e",
                  color: copied ? "#fff" : "#38bdf8",
                  border: 0, borderRadius: 7, fontWeight: 700, fontSize: 14.3,
                  padding: "5px 13px", marginLeft: 12, marginBottom: 4, marginTop: 2,
                  cursor: "pointer", transition: "background 0.13s",
                  outline: "none", boxShadow: copied ? "0 0 0 2px #22c55e55" : "",
                }}
                disabled={copied}
              >
                {copied ? "✔️ Kopiert" : "Adresse kopieren"}
              </button>
            </div>
            <div style={{
              color: "#f87171", fontSize: 13.7, textAlign: "center",
              marginBottom: 10, marginTop: 4, background: "#18181b", padding: 8, borderRadius: 7,
              border: "1px solid #23262e"
            }}>
              <b>WICHTIG:</b> Das Guthaben wird <b>nur</b> automatisch gutgeschrieben,<br />
              wenn der <u>exakte</u> Betrag (±1%) und die <b>richtige Adresse</b> genutzt wird.<br />
              Falsche Beträge werden NICHT gutgeschrieben!
            </div>
            {err && (
              <div style={{ color: "#ff4d4f", marginBottom: 6, fontWeight: 700, textAlign: "center" }}>{err}</div>
            )}
            <button
              onClick={cancelDeposit}
              style={{
                width: "100%", background: "#18181b", color: "#bababa",
                padding: "11px 0", border: "none", borderRadius: 10,
                fontWeight: 900, fontSize: 16, marginTop: 9,
                cursor: "pointer", boxShadow: "0 2px 9px #2222",
                letterSpacing: 0.19,
              }}
            >
              Einzahlung abbrechen
            </button>
          </>
        )}

        {/* --- Step 1: Pending View --- */}
        {step === 1 && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              color: "#a3e635", fontSize: 22, fontWeight: 900, marginBottom: 13,
            }}>Warte auf Einzahlung...</div>
            <div style={{
              fontSize: 15.7, color: "#bababa", marginBottom: 15,
            }}>
              Die Einzahlung wurde gespeichert.<br />
              Das System prüft jede Minute, ob die Zahlung eingegangen ist.<br />
              Nach Eingang wird dein Guthaben <b>automatisch</b> gutgeschrieben!
            </div>
            <div style={{
              margin: "17px 0", color: "#38bdf8", fontWeight: 700, fontSize: 15,
            }}>
              Status: <span style={{ color: "#fff" }}>PENDING</span>
            </div>
            <button
              onClick={cancelDeposit}
              style={{
                width: "100%", background: "#18181b", color: "#bababa",
                padding: "12px 0", border: "none", borderRadius: 10,
                fontWeight: 900, fontSize: 16, marginTop: 14,
                cursor: "pointer", boxShadow: "0 2px 8px #2222",
                letterSpacing: 0.18,
              }}
            >
              Einzahlung abbrechen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
