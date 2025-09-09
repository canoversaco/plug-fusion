// src/components/WithdrawDialog.js
import React, { useState } from "react";

export default function WithdrawDialog({ user, onWithdraw, onClose }) {
  const [addr, setAddr] = useState("");
  const [betrag, setBetrag] = useState("");
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#23262e",
          borderRadius: 15,
          padding: 24,
          minWidth: 320,
          boxShadow: "0 4px 24px #000a",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 15 }}>
          ➖ BTC auszahlen
        </div>
        <input
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          placeholder="Empfänger-Adresse"
          style={{
            width: "100%",
            padding: 8,
            borderRadius: 8,
            border: 0,
            marginBottom: 10,
          }}
        />
        <input
          type="number"
          value={betrag}
          onChange={(e) => setBetrag(e.target.value)}
          placeholder="Betrag (BTC)"
          style={{
            width: "100%",
            padding: 8,
            borderRadius: 8,
            border: 0,
            marginBottom: 12,
          }}
        />
        <button
          onClick={() => onWithdraw(addr, parseFloat(betrag))}
          style={{
            background: "#a3e635",
            color: "#18181b",
            border: 0,
            borderRadius: 8,
            fontWeight: 900,
            padding: "9px 22px",
            fontSize: 16,
            marginRight: 7,
            cursor: "pointer",
          }}
        >
          Senden
        </button>
        <button
          onClick={onClose}
          style={{
            background: "#23262e",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            fontWeight: 700,
            padding: "8px 15px",
            fontSize: 15,
            marginLeft: 5,
            cursor: "pointer",
          }}
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
