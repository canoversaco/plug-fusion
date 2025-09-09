import React, { useState, useEffect } from "react";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import images from "./images/images";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import { fromLonLat, toLonLat } from "ol/proj";
import Overlay from "ol/Overlay";
import "ol/ol.css";

// Statusoptionen
const STATUS_OPTIONS = [
  "offen",
  "akzeptiert",
  "unterwegs",
  "angekommen",
  "abgeschlossen",
  "storniert",
];
const STATUS_COLORS = {
  offen: "#fbbf24",
  akzeptiert: "#38bdf8",
  unterwegs: "#a3e635",
  angekommen: "#38bdf8",
  abgeschlossen: "#22c55e",
  storniert: "#f87171",
};

// =============== MAP PICKER ===================
function TreffpunktMapPicker({ value, onChange, onCancel }) {
  const mapRef = React.useRef();
  const markerRef = React.useRef();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [marker, setMarker] = useState(value || [51.5, 7.0]);

  useEffect(() => {
    const markerEl = document.createElement("div");
    markerEl.style.background = "#38bdf8";
    markerEl.style.width = "24px";
    markerEl.style.height = "24px";
    markerEl.style.borderRadius = "50%";
    markerEl.style.boxShadow = "0 2px 8px #0004";
    markerEl.style.transform = "translate(-50%, -50%)";
    markerEl.style.border = "3px solid white";
    markerEl.style.position = "absolute";
    markerEl.style.zIndex = 11;
    markerEl.innerHTML =
      '<svg style="margin:1.5px 0 0 1.5px;" width="20" height="20" fill="none" viewBox="0 0 20 20"><circle cx="10" cy="10" r="6" fill="#18181b"/><circle cx="10" cy="10" r="3" fill="#38bdf8"/></svg>';

    const markerOv = new Overlay({
      element: markerEl,
      positioning: "center-center",
      stopEvent: false,
    });
    markerRef.current = markerOv;

    const center = fromLonLat([marker[1], marker[0]]);
    const map = new Map({
      target: "kurier-treffpunkt-map",
      layers: [new TileLayer({ source: new OSM() })],
      overlays: [markerOv],
      view: new View({
        center,
        zoom: 13,
      }),
    });
    markerOv.setPosition(center);

    map.on("click", (evt) => {
      const coords = toLonLat(evt.coordinate);
      setMarker([coords[1], coords[0]]);
      markerOv.setPosition(evt.coordinate);
    });

    mapRef.current = map;

    return () => map.setTarget(null);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (mapRef.current && markerRef.current && marker) {
      const coord = fromLonLat([marker[1], marker[0]]);
      markerRef.current.setPosition(coord);
      mapRef.current.getView().setCenter(coord);
    }
  }, [marker]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    setLoading(true);
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          search
        )}`
      );
      const data = await resp.json();
      if (data && data[0]) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setMarker([lat, lon]);
        if (mapRef.current) {
          const center = fromLonLat([lon, lat]);
          mapRef.current.getView().setCenter(center);
          mapRef.current.getView().setZoom(16);
        }
      } else {
        alert("Adresse nicht gefunden!");
      }
    } catch {
      alert("Fehler bei der Suche.");
    }
    setLoading(false);
  };

  const handleSave = () => {
    if (marker) onChange(marker);
  };

  return (
    <div style={{ margin: "10px 0" }}>
      <form onSubmit={handleSearch} style={{ marginBottom: 8, display: "flex" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Adresse suchen (z.B. Hauptstraße Essen)"
          style={{
            padding: 7,
            borderRadius: 8,
            border: "1.5px solid #38bdf8",
            width: 220,
            fontSize: 15,
            background: "#23262e",
            color: "#fff",
            marginRight: 7,
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            background: "#38bdf8",
            color: "#18181b",
            border: 0,
            borderRadius: 8,
            padding: "6px 16px",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          {loading ? "..." : "Suchen"}
        </button>
      </form>
      <div
        id="kurier-treffpunkt-map"
        style={{
          width: 320,
          height: 180,
          borderRadius: 12,
          marginBottom: 10,
          background: "#111",
        }}
      />
      <div style={{ fontSize: 14, color: "#a1a1aa" }}>
        Auf die Karte klicken oder Adresse suchen, um einen Treffpunkt zu wählen.
      </div>
      <div style={{ marginTop: 10 }}>
        <button
          onClick={handleSave}
          disabled={!marker}
          style={{
            background: marker ? "#a3e635" : "#383838",
            color: "#18181b",
            border: 0,
            borderRadius: 8,
            padding: "8px 18px",
            fontWeight: 700,
            fontSize: 15,
            marginRight: 10,
            cursor: marker ? "pointer" : "not-allowed",
          }}
        >
          Speichern
        </button>
        <button
          onClick={onCancel}
          style={{
            background: "#23262e",
            color: "#fff",
            borderRadius: 7,
            border: 0,
            padding: "8px 18px",
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}

// Status Popover Component
function StatusPopover({ value, onChange, onClose }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 38,
        left: 0,
        background: "#23262e",
        borderRadius: 8,
        boxShadow: "0 4px 24px #0009",
        padding: 8,
        zIndex: 99,
        minWidth: 120,
      }}
    >
      {STATUS_OPTIONS.map((s) => (
        <div
          key={s}
          onClick={() => { onChange(s); onClose(); }}
          style={{
            padding: "7px 10px",
            color: value === s ? "#fff" : "#a1a1aa",
            background: value === s ? STATUS_COLORS[s] : "none",
            borderRadius: 6,
            fontWeight: 700,
            fontSize: 15,
            marginBottom: 2,
            cursor: "pointer",
            textTransform: "capitalize",
            transition: "background 0.13s",
          }}
        >
          {s}
        </div>
      ))}
    </div>
  );
}

// ===================== PRODUKTE-ÄNDERUNGSPANEL ===================
function EditOrderPanel({ order, produkte, onSave, onCancel }) {
  const [items, setItems] = useState(
    (order.warenkorb || []).map((item) => ({
      ...item,
      removed: false,
      changed: false,
      note: "",
    }))
  );
  const [extraNote, setExtraNote] = useState("");

  const handleChange = (idx, field, value) => {
    setItems((old) =>
      old.map((it, i) =>
        i === idx
          ? {
              ...it,
              [field]: value,
              changed: field !== "note" ? true : it.changed,
              removed: field === "removed" ? value : it.removed,
            }
          : it
      )
    );
  };

  const handleSave = () => {
    const changedItems = items
      .filter((it) => it.removed || it.changed)
      .map((it) => ({
        produktId: it.produktId,
        oldMenge: order.warenkorb.find((oi) => oi.produktId === it.produktId)
          ?.menge,
        newMenge: it.removed ? 0 : it.menge,
        note: it.note,
        removed: it.removed,
      }));
    if (changedItems.length === 0 && !extraNote.trim()) {
      alert("Keine Änderung vorgenommen.");
      return;
    }
    const newWarenkorb = items
      .filter((it) => !it.removed)
      .map((it) => ({
        produktId: it.produktId,
        menge: Number(it.menge),
      }));
    onSave({ newWarenkorb, changedItems, extraNote });
  };

  return (
    <div
      style={{
        background: "#23262e",
        borderRadius: 10,
        padding: 18,
        marginTop: 14,
        marginBottom: 18,
        color: "#fff",
        boxShadow: "0 4px 32px #0009",
        maxWidth: 430,
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 7 }}>
        Produkte ändern/nicht verfügbar:
      </div>
      <ul style={{ paddingLeft: 0 }}>
        {items.map((item, idx) => {
          const p = produkte.find((pr) => pr.id === item.produktId);
          return (
            <li key={item.produktId} style={{ marginBottom: 15, listStyle: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img
                  src={images[p?.bildName] || images.defaultBild}
                  alt={p?.name}
                  style={{
                    width: 28,
                    height: 28,
                    objectFit: "cover",
                    borderRadius: 6,
                  }}
                />
                <b style={{ minWidth: 80 }}>{p?.name || "?"}</b>
                <span style={{ fontSize: 15, marginRight: 4 }}>Menge:</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={item.menge}
                  onChange={(e) =>
                    handleChange(idx, "menge", Number(e.target.value))
                  }
                  disabled={item.removed}
                  style={{
                    width: 44,
                    background: item.removed ? "#262626" : "#191a20",
                    color: "#fff",
                    borderRadius: 6,
                    border: "1px solid #383838",
                    fontSize: 15,
                    marginRight: 8,
                  }}
                />
                <button
                  onClick={() => handleChange(idx, "removed", !item.removed)}
                  style={{
                    background: item.removed ? "#f87171" : "#23262e",
                    color: "#fff",
                    borderRadius: 7,
                    border: "none",
                    padding: "6px 12px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {item.removed ? "Wieder hinzufügen" : "Entfernen"}
                </button>
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Notiz (z.B. ausverkauft, nur halbe Menge)"
                  value={item.note}
                  onChange={(e) => handleChange(idx, "note", e.target.value)}
                  disabled={!item.removed && !item.changed}
                  style={{
                    marginTop: 4,
                    width: "100%",
                    borderRadius: 7,
                    border: "1px solid #333",
                    padding: 6,
                    background: "#191a20",
                    color: "#fff",
                    fontSize: 15,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <div style={{ marginTop: 13, marginBottom: 8 }}>
        <textarea
          placeholder="Zusätzliche Notiz für den Kunden (optional)..."
          value={extraNote}
          onChange={(e) => setExtraNote(e.target.value)}
          style={{
            width: "100%",
            borderRadius: 8,
            border: "1px solid #383838",
            padding: 9,
            background: "#18181b",
            color: "#fff",
            fontSize: 15,
          }}
          rows={2}
        />
      </div>
      <button
        onClick={handleSave}
        style={{
          background: "#a3e635",
          color: "#18181b",
          border: 0,
          borderRadius: 8,
          padding: "9px 26px",
          fontWeight: 900,
          fontSize: 16,
          cursor: "pointer",
        }}
      >
        Änderung senden
      </button>
      <button
        onClick={onCancel}
        style={{
          marginLeft: 9,
          background: "#23262e",
          color: "#fff",
          border: 0,
          borderRadius: 8,
          padding: "9px 22px",
          fontWeight: 700,
          fontSize: 15,
          cursor: "pointer",
        }}
      >
        Abbrechen
      </button>
    </div>
  );
}

// ========== KURIER VIEW =============
export default function KurierView({
  user,
  orders = [],
  produkte = [],
  onGoBack,
  onChat,
  onOrderDelete,
  onOrderStatusUpdate,
}) {
  const [statusPopoverId, setStatusPopoverId] = useState(null);
  const [treffpunktEdit, setTreffpunktEdit] = useState(null);
  const [loadingUpdate, setLoadingUpdate] = useState(false);
  const [orderEditId, setOrderEditId] = useState(null);
  const [etaInputs, setEtaInputs] = useState({});
  const [expandedOrder, setExpandedOrder] = useState(null);

  // ETA-Timer: auto-close
  useEffect(() => {
    const interval = setInterval(async () => {
      for (let order of orders) {
        if (
          order.eta &&
          order.eta > 0 &&
          order.eta < Date.now() &&
          order.status !== "abgeschlossen"
        ) {
          await handleStatusChange(order.id, "abgeschlossen");
        }
      }
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, [orders]);

  const handleStatusChange = async (orderId, status) => {
    if (typeof onOrderStatusUpdate === "function") {
      await onOrderStatusUpdate(orderId, status);
    } else {
      await updateDoc(doc(db, "orders", orderId), { status });
    }
    setStatusPopoverId(null);
  };

  const handleSaveTreffpunkt = async (orderId, pos) => {
    setLoadingUpdate(true);
    await updateDoc(doc(db, "orders", orderId), { treffpunkt: pos });
    setTreffpunktEdit(null);
    setLoadingUpdate(false);
  };

  const handleSetEta = async (orderId) => {
    const etaMin = Number(etaInputs[orderId]);
    if (!etaMin || etaMin < 1) {
      alert("Bitte gültige Minuten eingeben.");
      return;
    }
    const eta = Date.now() + etaMin * 60000;
    await updateDoc(doc(db, "orders", orderId), { eta });
    setEtaInputs((old) => ({ ...old, [orderId]: "" }));
  };

  const renderEta = (etaTimestamp) => {
    const diff = Math.round((etaTimestamp - Date.now()) / 1000);
    if (diff < 0) return "Abgelaufen";
    const min = Math.floor(diff / 60);
    const sec = diff % 60;
    return `${min}m ${sec < 10 ? "0" : ""}${sec}s`;
  };

  const handleDelete = async (orderId) => {
    if (window.confirm("Bestellung wirklich löschen?")) {
      await deleteDoc(doc(db, "orders", orderId));
    }
  };

  const handleSaveOrderEdit = async (orderId, { newWarenkorb, changedItems, extraNote }) => {
    await updateDoc(doc(db, "orders", orderId), {
      changeRequest: {
        from: user?.username || "Kurier",
        text: extraNote || "",
        status: "offen",
        ts: Date.now(),
        changedItems: changedItems,
        newWarenkorb: newWarenkorb,
      },
    });
    setOrderEditId(null);
    alert("Änderungsvorschlag wurde an den Kunden gesendet!");
  };

  const offeneOrders = orders
    .filter((o) => o.status === "offen")
    .sort((a, b) => b.ts - a.ts);
  const andereOrders = orders
    .filter((o) => o.status !== "offen")
    .sort((a, b) => b.ts - a.ts);

  // ---- CARD/KACHEL LAYOUT ----
  const OrderCard = ({ order }) => {
    const isExpanded = expandedOrder === order.id;
    return (
      <div
        style={{
          background: "#23262e",
          borderRadius: 16,
          boxShadow: "0 3px 20px #0004",
          margin: "16px 0",
          padding: "22px 24px",
          maxWidth: 530,
          width: "100%",
          position: "relative",
          cursor: "pointer",
          transition: "box-shadow 0.18s, background 0.14s",
          border: isExpanded ? "2.5px solid #38bdf8" : "2px solid #222",
        }}
        onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 13 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#e3ff64" }}>
              {order.kunde}
            </div>
            {order.notiz && (
              <div style={{
                background: "#fbbf247a",
                color: "#23262e",
                padding: "4px 10px",
                borderRadius: 9,
                marginTop: 5,
                fontWeight: 800,
                fontSize: 14,
                display: "inline-block"
              }}>
                📝 {order.notiz}
              </div>
            )}
            <div style={{ fontSize: 14, color: "#a1a1aa", marginTop: 5 }}>
              <b>Preis:</b> {order.endpreis?.toFixed(2) ?? "-"} €
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <ul style={{ margin: "5px 0 0 0", padding: 0, listStyle: "none" }}>
              {(order.warenkorb || []).map((item, idx) => {
                const p = produkte.find((pr) => pr.id === item.produktId);
                return (
                  <li key={idx} style={{ fontSize: 14, marginBottom: 2, display: "flex", alignItems: "center" }}>
                    <img
                      src={images[p?.bildName] || images.defaultBild}
                      alt={p?.name}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        objectFit: "cover",
                        verticalAlign: "middle",
                        marginRight: 7,
                      }}
                    />
                    {p?.name || "?"} × {item.menge}
                  </li>
                );
              })}
            </ul>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 7 }}>
            <button
              onClick={e => { e.stopPropagation(); setStatusPopoverId(statusPopoverId === order.id ? null : order.id); }}
              style={{
                background: STATUS_COLORS[order.status] || "#191a20",
                color: "#18181b",
                border: "none",
                borderRadius: 7,
                fontWeight: 900,
                fontSize: 14,
                padding: "6px 19px",
                boxShadow: "0 1px 6px #18181b15",
                cursor: "pointer",
                position: "relative"
              }}
            >
              {order.status}
              {statusPopoverId === order.id && (
                <StatusPopover
                  value={order.status}
                  onChange={(s) => handleStatusChange(order.id, s)}
                  onClose={() => setStatusPopoverId(null)}
                />
              )}
            </button>
            <div style={{ fontSize: 13, color: "#a3e635", fontWeight: 700, minHeight: 26 }}>
              {order.eta && order.eta > Date.now() ? (
                <>
                  ⏰ ETA: {renderEta(order.eta)}
                </>
              ) : null}
            </div>
          </div>
        </div>

        {isExpanded && (
          <div style={{ marginTop: 15, borderTop: "1px solid #222", paddingTop: 15, display: "flex", flexWrap: "wrap", gap: 18 }}>
            <div style={{ minWidth: 175 }}>
              <b>Treffpunkt:</b>
              <br />
              {treffpunktEdit === order.id ? (
                <TreffpunktMapPicker
                  value={order.treffpunkt}
                  onChange={(pos) => handleSaveTreffpunkt(order.id, pos)}
                  onCancel={() => setTreffpunktEdit(null)}
                />
              ) : order.treffpunkt ? (
                <span>
                  <a
                    href={`https://maps.google.com/?q=${order.treffpunkt[0]},${order.treffpunkt[1]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#38bdf8",
                      textDecoration: "underline",
                      fontWeight: 600,
                      marginRight: 7,
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    Karte öffnen
                  </a>
                  <button
                    onClick={e => { e.stopPropagation(); setTreffpunktEdit(order.id); }}
                    style={{
                      background: "#38bdf8",
                      color: "#18181b",
                      border: 0,
                      borderRadius: 7,
                      fontWeight: 700,
                      padding: "5px 9px",
                      fontSize: 13,
                      marginLeft: 3,
                      cursor: "pointer",
                    }}
                    disabled={loadingUpdate}
                  >
                    🖉 Ändern
                  </button>
                </span>
              ) : (
                <button
                  onClick={e => { e.stopPropagation(); setTreffpunktEdit(order.id); }}
                  style={{
                    background: "#a3e635",
                    color: "#18181b",
                    border: 0,
                    borderRadius: 7,
                    fontWeight: 700,
                    padding: "5px 10px",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                  disabled={loadingUpdate}
                >
                  Treffpunkt setzen
                </button>
              )}
            </div>
            <div>
              <b>ETA setzen:</b>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 2 }}>
                <input
                  type="number"
                  min={1}
                  value={etaInputs[order.id] || ""}
                  onChange={(e) =>
                    setEtaInputs((old) => ({
                      ...old,
                      [order.id]: e.target.value,
                    }))
                  }
                  style={{
                    width: 50,
                    borderRadius: 6,
                    border: "1px solid #383838",
                    fontSize: 14,
                    padding: 4,
                    background: "#191a20",
                    color: "#fff",
                  }}
                  placeholder="Min"
                />
                <button
                  onClick={e => { e.stopPropagation(); handleSetEta(order.id); }}
                  style={{
                    background: "#a3e635",
                    color: "#18181b",
                    border: 0,
                    borderRadius: 8,
                    padding: "6px 10px",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Setzen
                </button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button
                onClick={e => { e.stopPropagation(); onChat && onChat(order); }}
                style={{
                  background: "#38bdf8",
                  color: "#18181b",
                  border: 0,
                  borderRadius: 7,
                  fontWeight: 700,
                  padding: "6px 13px",
                  fontSize: 14,
                  cursor: "pointer",
                  marginBottom: 2
                }}
              >
                💬 Chat
              </button>
              <button
                onClick={e => { e.stopPropagation(); onOrderDelete ? onOrderDelete(order.id) : handleDelete(order.id); }}
                style={{
                  background: "#f87171",
                  color: "#fff",
                  border: 0,
                  borderRadius: 7,
                  fontWeight: 700,
                  padding: "6px 13px",
                  fontSize: 14,
                  cursor: "pointer",
                  marginBottom: 2
                }}
              >
                🗑️ Löschen
              </button>
              <button
                onClick={e => { e.stopPropagation(); setOrderEditId(order.id); }}
                style={{
                  background: "#fbbf24",
                  color: "#18181b",
                  border: 0,
                  borderRadius: 7,
                  fontWeight: 700,
                  padding: "6px 12px",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                ✏️ Produkte ändern
              </button>
            </div>
            {/* Bewertung anzeigen */}
            {order.status === "abgeschlossen" && order.rating && (
              <div
                style={{
                  background: "#18181b",
                  color: "#a3e635",
                  borderRadius: 9,
                  padding: "11px 17px 8px 15px",
                  marginTop: 13,
                  fontWeight: 600,
                  fontSize: 15.5,
                  minWidth: 150,
                  maxWidth: 310,
                  boxShadow: "0 2px 14px #0003"
                }}
              >
                <div>
                  <span style={{ fontSize: 18 }}>🌟 Bewertung:</span>
                  <br />
                  <b>Service:</b> {order.rating.service}/5<br />
                  <b>Wartezeit:</b> {order.rating.wartezeit}/5<br />
                  <b>Qualität:</b> {order.rating.qualitaet}/5
                </div>
              </div>
            )}
          </div>
        )}
        {/* Produkt-Edit Panel */}
        {orderEditId === order.id && (
          <EditOrderPanel
            order={order}
            produkte={produkte}
            onSave={(changeObj) => handleSaveOrderEdit(order.id, changeObj)}
            onCancel={() => setOrderEditId(null)}
          />
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#101014",
        color: "#fff",
        fontFamily: "'Inter',sans-serif",
        padding: "36px 7vw 38px 7vw",
        maxWidth: 1300,
        margin: "0 auto"
      }}
    >
      <h2 style={{ fontSize: 30, fontWeight: 900, marginBottom: 20, color: "#e3ff64", letterSpacing: 1 }}>
        🛵 Kurier Panel
      </h2>
      <button
        onClick={onGoBack}
        style={{
          background: "#23262e",
          color: "#fff",
          borderRadius: 9,
          border: 0,
          padding: "10px 22px",
          fontSize: 17,
          fontWeight: 700,
          cursor: "pointer",
          marginBottom: 30,
        }}
      >
        ⬅️ Zurück
      </button>
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 40,
        alignItems: "flex-start",
        justifyContent: "flex-start"
      }}>
        <div style={{ flex: 1, minWidth: 320 }}>
          <h3
            style={{
              fontWeight: 800,
              fontSize: 20,
              marginBottom: 8,
              color: "#fbbf24",
              letterSpacing: 0.4,
            }}
          >
            Offene Bestellungen
          </h3>
          {offeneOrders.length === 0 ? (
            <div style={{ color: "#aaa", marginTop: 13 }}>Keine offenen Bestellungen.</div>
          ) : (
            offeneOrders.map((order) => <OrderCard key={order.id} order={order} />)
          )}
        </div>
        <div style={{ flex: 1, minWidth: 320 }}>
          <h3
            style={{
              fontWeight: 800,
              fontSize: 20,
              marginBottom: 8,
              color: "#38bdf8",
              letterSpacing: 0.4,
            }}
          >
            Angenommene & alte Bestellungen
          </h3>
          {andereOrders.length === 0 ? (
            <div style={{ color: "#aaa", marginTop: 13 }}>Keine angenommenen oder alten Bestellungen.</div>
          ) : (
            andereOrders.map((order) => <OrderCard key={order.id} order={order} />)
          )}
        </div>
      </div>
    </div>
  );
}
