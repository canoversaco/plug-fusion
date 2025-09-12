import React from "react";
import images from "./images/images"; // ggf. anpassen!

const KAT_EMOJIS = {
  Standard: "🛍️",
  Hase: "🍀",
  Shem: "🧊",
  Schoko: "🍫",
  Medikamente: "🧪",
  Cali: "🍹",
};

function timeAgo(ts) {
  if (!ts) return "";
  const now = Date.now();
  const diff = Math.floor((now - ts) / 1000);
  if (diff < 90) return "Gerade eben";
  if (diff < 3600) return Math.floor(diff / 60) + " min";
  if (diff < 86400) return Math.floor(diff / 3600) + "h";
  return new Date(ts).toLocaleDateString();
}

function notifyTelegram(user, text) {
  if (window.sendTelegramNotification && user?.telegramChatId) {
    window.sendTelegramNotification(user, text);
  }
}

export default class MenuView extends React.Component {
  constructor(props) {
    super(props);
    const kategorien = Array.from(
      new Set((props.produkte || []).map((p) => p.kategorie || "Standard"))
    ).map((k) => ({ name: k }));
    this.state = {
      kategorien,
      selectedKat: "ALLE",
      tab: "produkte",
      menge: {},
      error: "",
      imgActive: "",
      cartOpen: false,
      suche: "",
      searchFocused: false,
      kommentarInput: {},
      kommentarError: {},
      submitting: {},
      publicChatInput: "",
      publicChatSending: false,
      publicChatError: "",
      publicChatScroll: null,
    };
    this.isCheckoutRunning = false;
  }

  // === TELEGRAM NOTIFY ON CHECKOUT ===
  sendCheckoutTelegramNotification = () => {
    const { warenkorb = [], user, produkte = [] } = this.props;
    if (!user || !warenkorb.length) return;

    const cartKey =
      "checkoutNotified_" +
      warenkorb
        .map((w) => w.produktId + ":" + w.menge)
        .sort()
        .join("_");
    if (sessionStorage.getItem(cartKey)) return;

    notifyTelegram(
      user,
      `🛒 Neue Bestellung von ${user.username || "Unbekannt"}\nWarenkorb: ${
        warenkorb
          .map(
            (w) =>
              (produkte.find((p) => p.id === w.produktId)?.name || "Produkt") +
              " x" +
              w.menge
          )
          .join(", ")
      }\nGesamtpreis: ${warenkorb
        .reduce((sum, w) => {
          const p = produkte.find((pr) => pr.id === w.produktId);
          return sum + (p?.preis || 0) * w.menge;
        }, 0)
        .toFixed(2)} €`
    );
    sessionStorage.setItem(cartKey, "1");
  };

  filterProdukte = () => {
    const { produkte } = this.props;
    const { selectedKat, suche } = this.state;
    let res = produkte;
    if (selectedKat !== "ALLE") {
      res = res.filter((p) => (p.kategorie || "Standard") === selectedKat);
    }
    if (suche.trim()) {
      const s = suche.trim().toLowerCase();
      res = res.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(s)) ||
          (p.beschreibung && p.beschreibung.toLowerCase().includes(s))
      );
    }
    return res.sort((a, b) => (a.preis || 0) - (b.preis || 0));
  };

  handleMengeChange = (produktId, val) => {
    this.setState((s) => ({
      menge: { ...s.menge, [produktId]: Math.max(1, Number(val) || 1) },
    }));
  };

  handleImgClick = (id) => {
    this.setState({ imgActive: id });
    setTimeout(() => this.setState({ imgActive: "" }), 210);
  };

  handleCartOpen = () => this.setState({ cartOpen: true });
  handleCartClose = () => this.setState({ cartOpen: false });

  clearSuche = () => this.setState({ suche: "" });

  userHatBestellt = (produktId) => {
    const { user, orders } = this.props;
    if (!user || !orders) return false;
    return orders.some(
      (o) =>
        o.kunde === user.username &&
        Array.isArray(o.warenkorb) &&
        o.warenkorb.some((w) => w.produktId === produktId)
    );
  };

  handleKommentarChange = (produktId, text) => {
    this.setState((s) => ({
      kommentarInput: { ...s.kommentarInput, [produktId]: text },
      kommentarError: { ...s.kommentarError, [produktId]: "" },
    }));
  };

  handleKommentarAbschicken = async (produktId) => {
    const { onProduktKommentarSubmit } = this.props;
    const text = (this.state.kommentarInput[produktId] || "").trim();
    if (!text || text.length < 2) {
      this.setState((s) => ({
        kommentarError: {
          ...s.kommentarError,
          [produktId]: "Bitte einen sinnvollen Kommentar eingeben.",
        },
      }));
      return;
    }
    this.setState((s) => ({
      submitting: { ...s.submitting, [produktId]: true },
      kommentarError: { ...s.kommentarError, [produktId]: "" },
    }));
    try {
      await onProduktKommentarSubmit(produktId, text);
      this.setState((s) => ({
        kommentarInput: { ...s.kommentarInput, [produktId]: "" },
        submitting: { ...s.submitting, [produktId]: false },
      }));
    } catch (e) {
      this.setState((s) => ({
        kommentarError: {
          ...s.kommentarError,
          [produktId]: "Fehler beim Absenden.",
        },
        submitting: { ...s.submitting, [produktId]: false },
      }));
    }
  };

  handlePublicChatInput = (e) =>
    this.setState({ publicChatInput: e.target.value, publicChatError: "" });

  // === Checkout Handler mit Telegram Notify, Cart schließt & wird geleert ===
  handleCheckout = async () => {
    if (this.isCheckoutRunning) return;
    this.isCheckoutRunning = true;

    // Telegram Nachricht
    this.sendCheckoutTelegramNotification();

    // Schließe Warenkorb Drawer
    this.handleCartClose();

    // Leere Mengen (input Felder zurücksetzen)
    this.setState({ menge: {} });

    // Leere Warenkorb über Parent Callback, falls vorhanden
    if (this.props.onCheckout) {
      await this.props.onCheckout(); // Erwartet async möglich!
    }

    // Nur als Schutz: nach 0.5s Checkout wieder freigeben
    setTimeout(() => (this.isCheckoutRunning = false), 500);
  };

  render() {
    const {
      warenkorb = [],
      onAddToCart,
      onRemoveFromCart,
      onCheckout,
      onGoBack,
      produkte = [],
      produktKommentare = {},
      user,
      orders,
      publicChatMessages = [],
    } = this.props;
    const {
      kategorien,
      selectedKat,
      menge,
      error,
      imgActive,
      cartOpen,
      suche,
      searchFocused,
      kommentarInput,
      kommentarError,
      submitting,
      tab,
      publicChatInput,
      publicChatSending,
      publicChatError,
    } = this.state;

    const cartMenge = (produktId) =>
      warenkorb.find((w) => w.produktId === produktId)?.menge || 0;

    const gesamt = warenkorb.reduce((sum, w) => {
      const p = produkte.find((pr) => pr.id === w.produktId);
      return sum + (p?.preis || 0) * w.menge;
    }, 0);

    const tabBtnStyle = (active) => ({
      flex: 1,
      background: active
        ? "linear-gradient(91deg, #38bdf8 64%, #a3e635 120%)"
        : "#23262e",
      color: active ? "#18181b" : "#fff",
      border: "none",
      borderRadius: 9,
      fontWeight: 800,
      fontSize: 15.6,
      padding: "12px 5px",
      marginRight: 6,
      marginBottom: 0,
      cursor: "pointer",
      transition: "background 0.13s",
      outline: "none",
      letterSpacing: 0.01,
      boxShadow: active ? "0 3px 15px #38bdf850" : "0 2px 10px #23262e18",
      zIndex: 2,
    });

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(130deg, #191c22 60%, #1a2330 100%)",
          color: "#fff",
          fontFamily: "'Inter', sans-serif",
          padding: "9px 2vw 33px 2vw",
          maxWidth: 660,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 19,
            marginBottom: 6,
          }}
        >
          <button
            onClick={onGoBack}
            style={{
              background: "#22242b",
              color: "#fff",
              borderRadius: 9,
              border: 0,
              padding: "8px 19px",
              fontSize: 15.5,
              fontWeight: 800,
              cursor: "pointer",
              marginRight: 7,
              boxShadow: "0 2px 8px #0003",
            }}
          >
            ⬅️ Zurück
          </button>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 900,
              margin: 0,
              letterSpacing: 0.13,
            }}
          >
            Menü
          </h2>
        </div>
        {/* TAB BAR */}
        <div style={{ display: "flex", gap: 7, marginBottom: 18 }}>
          <button
            style={tabBtnStyle(tab === "produkte")}
            onClick={() => this.setState({ tab: "produkte" })}
          >
            🛒 Produkte
          </button>
          <button
            style={tabBtnStyle(tab === "chat")}
            onClick={() => this.setState({ tab: "chat" })}
          >
            💬 Öffentlicher Chat
          </button>
        </div>

        {/* TAB INHALT */}
        {tab === "produkte" && (
          <>
            {/* Kategorie + Suche */}
            <div className="menu-kat-bar" style={{display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 13}}>
              <button
                className={"menu-kat-btn" + (selectedKat === "ALLE" ? " selected" : "")}
                onClick={() => this.setState({ selectedKat: "ALLE" })}
                style={{
                  background: selectedKat === "ALLE"
                    ? "linear-gradient(93deg, #38bdf8 64%, #a3e635 125%)"
                    : "#22242b",
                  color: selectedKat === "ALLE" ? "#18181b" : "#fff",
                  border: "none",
                  borderRadius: 12,
                  padding: "7px 20px",
                  fontSize: 15.3,
                  fontWeight: 800,
                  cursor: "pointer",
                  transition: "background 0.17s, color 0.12s, transform 0.13s",
                  boxShadow: "0 2px 10px #23262e18",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  opacity: 0.94,
                  outline: "none",
                  transform: selectedKat === "ALLE" ? "scale(1.07)" : undefined,
                }}
              >
                <span style={{ fontSize: 18 }}>🌐</span> Alle
              </button>
              {kategorien.map((kat) => (
                <button
                  key={kat.name}
                  className={"menu-kat-btn" + (selectedKat === kat.name ? " selected" : "")}
                  onClick={() => this.setState({ selectedKat: kat.name })}
                  style={{
                    background: selectedKat === kat.name
                      ? "linear-gradient(93deg, #38bdf8 64%, #a3e635 125%)"
                      : "#22242b",
                    color: selectedKat === kat.name ? "#18181b" : "#fff",
                    border: "none",
                    borderRadius: 12,
                    padding: "7px 20px",
                    fontSize: 15.3,
                    fontWeight: 800,
                    cursor: "pointer",
                    transition: "background 0.17s, color 0.12s, transform 0.13s",
                    boxShadow: "0 2px 10px #23262e18",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    opacity: 0.94,
                    outline: "none",
                    transform: selectedKat === kat.name ? "scale(1.07)" : undefined,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{KAT_EMOJIS[kat.name] || "🛍️"}</span>
                  {kat.name}
                </button>
              ))}
              <div className="search-wrap" style={{
                position: "relative", marginLeft: "auto", minWidth: 120, flex: 1, maxWidth: 270, display: "flex", alignItems: "center", background: "#1c1e25", borderRadius: 9, boxShadow: "0 2px 10px #38bdf820", marginRight: 7, height: 40,
              }}>
                <span className="search-icon" style={{
                  position: "absolute", left: 10, top: 10, fontSize: 18.5, color: "#38bdf8", opacity: 0.89,
                }}>🔍</span>
                <input
                  className="search-input"
                  type="text"
                  placeholder="Suchen…"
                  value={suche}
                  onChange={e => this.setState({ suche: e.target.value })}
                  maxLength={44}
                  onFocus={() => this.setState({ searchFocused: true })}
                  onBlur={() => this.setState({ searchFocused: false })}
                  style={{
                    background: searchFocused ? "#21222b" : "transparent",
                    boxShadow: searchFocused ? "0 2px 15px #38bdf822" : undefined,
                    border: "none",
                    borderRadius: 9,
                    padding: "8px 35px 8px 36px",
                    fontSize: 16,
                    color: "#fff",
                    width: "100%",
                    fontWeight: 600,
                    outline: "none",
                  }}
                />
                {suche && (
                  <button
                    className="search-clear-btn"
                    tabIndex={0}
                    onClick={this.clearSuche}
                    aria-label="Suchfeld leeren"
                    title="Suchfeld leeren"
                    style={{
                      position: "absolute",
                      right: 7,
                      top: 8,
                      background: "none",
                      border: "none",
                      color: "#f87171",
                      fontSize: 19,
                      cursor: "pointer",
                      borderRadius: 20,
                      width: 25,
                      height: 25,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: 0.74,
                      transition: "opacity 0.14s, background 0.14s",
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
            {/* PRODUKTLISTE + KOMMENTARE */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                marginBottom: 28,
              }}
            >
              {this.filterProdukte().length === 0 ? (
                <div
                  style={{
                    color: "#a1a1aa",
                    fontSize: 17,
                    fontWeight: 500,
                    padding: 17,
                    textAlign: "center",
                    background: "#23262e",
                    borderRadius: 13,
                  }}
                >
                  😕 Keine Produkte gefunden.
                </div>
              ) : (
                this.filterProdukte().map((p) => (
                  <div
                    key={p.id}
                    style={{
                      background: "#23262e",
                      borderRadius: 16,
                      padding: "13px 12px 8px 10px",
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "flex-start",
                      boxShadow: "0 2px 12px #00000013",
                      gap: 12,
                      minHeight: 88,
                      position: "relative",
                    }}
                  >
                    <img
                      src={images[p.bildName] || images.defaultBild}
                      alt={p.name}
                      className={
                        "menu-prod-img" + (imgActive === p.id ? " active" : "")
                      }
                      style={{
                        width: 60,
                        height: 60,
                        objectFit: "cover",
                        borderRadius: 13,
                        border: "2px solid #18181b",
                        background: "#18181b",
                      }}
                      onMouseDown={() => this.handleImgClick(p.id)}
                      onMouseUp={() => this.setState({ imgActive: "" })}
                      onMouseLeave={() => this.setState({ imgActive: "" })}
                      tabIndex={0}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: 16,
                          marginBottom: 1,
                          letterSpacing: 0.01,
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                        }}
                      >
                        {p.name}
                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: 500,
                            color: "#38bdf8",
                          }}
                        >
                          {KAT_EMOJIS[p.kategorie] || ""}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 13.2,
                          color: "#a1a1aa",
                          marginBottom: 2,
                          minHeight: 16,
                          letterSpacing: 0.01,
                          fontWeight: 500,
                        }}
                      >
                        {p.beschreibung}
                      </div>
                      <div
                        style={{
                          fontSize: 14.7,
                          marginBottom: 2,
                          fontWeight: 700,
                          color: "#a3e635",
                        }}
                      >
                        {p.preis} €/g
                        <span
                          style={{
                            color: "#bbb",
                            fontWeight: 500,
                            marginLeft: 7,
                            fontSize: 13,
                          }}
                        >
                          | Bestand: {p.bestand}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                          marginTop: 2,
                        }}
                      >
                        <input
                          type="number"
                          min={1}
                          value={menge[p.id] || 1}
                          onChange={(e) =>
                            this.handleMengeChange(p.id, e.target.value)
                          }
                          style={{
                            width: 35,
                            background: "#18181b",
                            color: "#fff",
                            border: "1px solid #333",
                            borderRadius: 6,
                            padding: "4px 6px",
                            fontWeight: 700,
                            fontSize: 13.5,
                            marginRight: 2,
                          }}
                        />
                        <button
                          className="menu-cart-btn"
                          onClick={() => {
                            const m = menge[p.id] || 1;
                            for (let i = 0; i < m; ++i) onAddToCart(p.id);
                          }}
                          disabled={p.bestand === 0}
                          style={{
                            background: "#a3e635",
                            color: "#18181b",
                            fontWeight: 900,
                            borderRadius: 8,
                            border: 0,
                            padding: "7px 11px",
                            fontSize: 14,
                            cursor: p.bestand === 0 ? "not-allowed" : "pointer",
                            opacity: p.bestand === 0 ? 0.5 : 1,
                            marginRight: 2,
                            boxShadow: "0 2px 8px #a3e63524",
                          }}
                        >
                          ➕
                        </button>
                        {cartMenge(p.id) > 0 && (
                          <button
                            className="menu-remove-btn"
                            onClick={() => onRemoveFromCart(p.id)}
                            style={{
                              background: "#f87171",
                              color: "#fff",
                              border: 0,
                              borderRadius: 8,
                              padding: "6px 10px",
                              fontWeight: 700,
                              fontSize: 13,
                              cursor: "pointer",
                              marginLeft: 0,
                              boxShadow: "0 1px 7px #f8717122",
                            }}
                          >
                            −
                          </button>
                        )}
                      </div>
                      {/* Kommentarbereich */}
                      <div style={{
                        marginTop: 10,
                        background: "#18181b",
                        borderRadius: 8,
                        padding: "7px 8px 3px 10px",
                      }}>
                        <div style={{
                          color: "#38bdf8",
                          fontWeight: 800,
                          fontSize: 14,
                          marginBottom: 2,
                          letterSpacing: 0.04,
                        }}>
                          💬 Kommentare
                        </div>
                        <div style={{
                          maxHeight: 85,
                          overflowY: "auto",
                          marginBottom: 3,
                        }}>
                          {(produktKommentare[p.id] || []).length === 0 ? (
                            <div style={{
                              color: "#888",
                              fontSize: 13,
                              fontWeight: 400,
                              marginBottom: 4
                            }}>
                              Keine Kommentare vorhanden.
                            </div>
                          ) : (
                            produktKommentare[p.id]
                              .slice()
                              .reverse()
                              .map((k, idx) => (
                              <div key={idx} style={{
                                background: "#222a",
                                borderRadius: 7,
                                padding: "4px 8px",
                                marginBottom: 4,
                                fontSize: 13.4,
                              }}>
                                <span style={{
                                  fontWeight: 700,
                                  color: k.user === user?.username ? "#a3e635" : "#38bdf8",
                                }}>
                                  {k.user}
                                </span>
                                <span style={{
                                  fontWeight: 400,
                                  color: "#aaa",
                                  marginLeft: 7,
                                  fontSize: 12.5,
                                }}>
                                  {timeAgo(k.ts)}
                                </span>
                                <div style={{
                                  marginTop: 2,
                                  fontWeight: 500,
                                  color: "#fff",
                                  wordBreak: "break-word"
                                }}>{k.text}</div>
                              </div>
                            ))
                          )}
                        </div>
                        {this.userHatBestellt(p.id) && (
                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            marginTop: 5
                          }}>
                            <input
                              type="text"
                              placeholder="Kommentiere dieses Produkt..."
                              maxLength={120}
                              value={kommentarInput[p.id] || ""}
                              onChange={e => this.handleKommentarChange(p.id, e.target.value)}
                              style={{
                                flex: 1,
                                borderRadius: 7,
                                border: "1.1px solid #333",
                                padding: "5px 8px",
                                fontSize: 13.5,
                                background: "#23262e",
                                color: "#fff",
                              }}
                            />
                            <button
                              onClick={() => this.handleKommentarAbschicken(p.id)}
                              disabled={submitting[p.id] || !kommentarInput[p.id] || kommentarInput[p.id].trim().length < 2}
                              style={{
                                background: "#38bdf8",
                                color: "#18181b",
                                fontWeight: 800,
                                borderRadius: 7,
                                border: 0,
                                padding: "6px 13px",
                                fontSize: 13,
                                cursor: (submitting[p.id] || !kommentarInput[p.id] || kommentarInput[p.id].trim().length < 2)
                                  ? "not-allowed"
                                  : "pointer",
                                opacity: submitting[p.id] ? 0.7 : 1,
                              }}
                            >
                              {submitting[p.id] ? "..." : "Senden"}
                            </button>
                          </div>
                        )}
                        {kommentarError[p.id] && (
                          <div style={{
                            color: "#f87171",
                            fontSize: 12.7,
                            fontWeight: 600,
                            marginTop: 3
                          }}>{kommentarError[p.id]}</div>
                        )}
                      </div>
                      {/* Ende Kommentarbereich */}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {tab === "chat" && (
          <div style={{
            maxWidth: 540,
            margin: "0 auto",
            borderRadius: 14,
            background: "#23262e",
            padding: "13px 7px 6px 11px",
            boxShadow: "0 2px 14px #18181b13",
            display: "flex",
            flexDirection: "column",
            minHeight: 330,
            height: "60vh",
          }}>
            <div style={{
              fontSize: 17,
              fontWeight: 900,
              marginBottom: 7,
              color: "#38bdf8",
              letterSpacing: 0.03
            }}>
              Öffentlicher Chat
            </div>
            <div
              ref={(el) => {
                if (el && publicChatMessages.length > 0 && (!this.state.publicChatScroll || el !== this.state.publicChatScroll)) {
                  el.scrollTop = el.scrollHeight;
                  this.setState({ publicChatScroll: el });
                }
              }}
              style={{
                flex: 1,
                overflowY: "auto",
                background: "#191c22",
                borderRadius: 11,
                padding: "9px 7px 7px 7px",
                marginBottom: 6,
                minHeight: 120,
                maxHeight: 310,
              }}
            >
              {publicChatMessages.length === 0 ? (
                <div style={{ color: "#aaa", fontSize: 15, marginTop: 15, textAlign: "center" }}>
                  Noch keine Nachrichten. Sei der Erste!
                </div>
              ) : (
                publicChatMessages.slice(-50).map((msg, idx) => (
                  <div key={idx} style={{
                    marginBottom: 7,
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 7,
                  }}>
                    <div style={{
                      background: msg.user === user?.username ? "linear-gradient(100deg, #38bdf8 60%, #a3e635 120%)" : "#2e3440",
                      color: msg.user === user?.username ? "#18181b" : "#fff",
                      padding: "8px 11px",
                      borderRadius: 11,
                      fontSize: 14.6,
                      fontWeight: msg.user === user?.username ? 800 : 500,
                      boxShadow: msg.user === user?.username ? "0 2px 8px #a3e63530" : "",
                      maxWidth: "88%",
                      wordBreak: "break-word",
                    }}>
                      <span style={{ fontWeight: 700 }}>
                        {msg.user}
                      </span>
                      <span style={{
                        fontWeight: 400,
                        color: "#888",
                        marginLeft: 8,
                        fontSize: 12,
                      }}>
                        {timeAgo(msg.ts)}
                      </span>
                      <div style={{
                        marginTop: 2,
                        fontWeight: 500,
                        color: msg.user === user?.username ? "#18181b" : "#fff"
                      }}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
               {/* Chat Regeln */}
  <div style={{
    background: "#23262e",
    borderRadius: 7,
    padding: "7px 11px",
    color: "#a3e635",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 8
  }}>
    <b>Chat-Regeln:</b> Keine Beleidigungen. Keine Links oder Werbung. Kein Spam.<br />
    Kein treffen unter Kunden. Kein abwerben von Kunden. Keine Geld/Kombi fragen. Verstöße führen zum auschluss.
  </div>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 3
            }}>
              <input
                type="text"
                placeholder="Nachricht schreiben…"
                maxLength={222}
                value={publicChatInput}
                onChange={this.handlePublicChatInput}
                onKeyDown={e => {
                  if (e.key === "Enter" && publicChatInput.trim().length >= 2 && !publicChatSending) {
                    this.handlePublicChatSend();
                  }
                }}
                style={{
                  flex: 1,
                  borderRadius: 8,
                  border: "1.2px solid #2e3440",
                  padding: "8px 12px",
                  fontSize: 15,
                  background: "#191c22",
                  color: "#fff",
                  outline: "none",
                  fontWeight: 600,
                }}
              />
              <button
                onClick={this.handlePublicChatSend}
                disabled={publicChatSending || publicChatInput.trim().length < 2}
                style={{
                  background: "#38bdf8",
                  color: "#18181b",
                  fontWeight: 900,
                  borderRadius: 8,
                  border: 0,
                  padding: "9px 19px",
                  fontSize: 15.5,
                  cursor: (publicChatSending || publicChatInput.trim().length < 2) ? "not-allowed" : "pointer",
                  opacity: publicChatSending ? 0.6 : 1,
                }}
              >
                {publicChatSending ? "..." : "Senden"}
              </button>
            </div>
            {publicChatError && (
              <div style={{ color: "#f87171", fontWeight: 600, fontSize: 13.3, marginTop: 2 }}>
                {publicChatError}
              </div>
            )}
          </div>
        )}

        {/* FLOATING WARENKORB-BUTTON */}
        <button
          className="menu-cart-fab"
          onClick={this.handleCartOpen}
          aria-label="Warenkorb öffnen"
          style={{
            position: "fixed",
            right: 18,
            bottom: 18,
            zIndex: 120,
            background: "linear-gradient(100deg, #a3e635 69%, #38bdf8 128%)",
            color: "#18181b",
            border: "none",
            borderRadius: 100,
            boxShadow: "0 3px 24px #a3e63555",
            padding: "0 22px 0 17px",
            fontWeight: 900,
            fontSize: 21,
            minWidth: 85,
            minHeight: 61,
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            transition: "box-shadow 0.17s, background 0.18s",
            outline: "none",
          }}
        >
          🛒
          <span style={{ marginLeft: 0, color: "#18181b", fontWeight: 900 }}>
            {warenkorb.length}
          </span>
          <span style={{ color: "#23262e", fontSize: 15, fontWeight: 700, marginLeft: 7 }}>
            {gesamt.toFixed(2)} €
          </span>
        </button>

        {/* CART DRAWER */}
        {cartOpen && (
          <>
            <div
              className="cart-drawer-bg"
              onClick={this.handleCartClose}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(24,24,27, 0.74)",
                zIndex: 199,
                animation: "fadeinbg .16s",
              }}
            ></div>
            <div
              className="cart-drawer"
              style={{
                position: "fixed",
                right: 0,
                top: 0,
                bottom: 0,
                width: "98vw",
                maxWidth: 375,
                background: "#18181b",
                boxShadow: "-3px 0 25px #23262e88",
                zIndex: 200,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                animation: "slideinright .20s cubic-bezier(.31,1.04,.59,.98)",
              }}
            >
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #23262e",
                padding: "23px 23px 12px 23px",
                minHeight: 66,
              }}>
                <h3 style={{ fontWeight: 900, fontSize: 19.5, margin: 0 }}>
                  🛒 Dein Warenkorb
                </h3>
                <button
                  onClick={this.handleCartClose}
                  style={{
                    background: "#23262e",
                    color: "#fff",
                    borderRadius: 7,
                    border: 0,
                    fontSize: 19,
                    fontWeight: 800,
                    padding: "5px 14px",
                    cursor: "pointer",
                    marginLeft: 7,
                  }}
                >
                  ✖
                </button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 19 }}>
                {warenkorb.length === 0 ? (
                  <div style={{ color: "#a1a1aa", padding: 10, fontSize: 16.2 }}>
                    Noch keine Produkte im Warenkorb.
                  </div>
                ) : (
                  <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                    {warenkorb.map((item, idx) => {
                      const p = produkte.find(
                        (pr) => pr.id === item.produktId
                      );
                      return (
                        <li
                          key={idx}
                          style={{
                            fontSize: 15.5,
                            marginBottom: 11,
                            paddingBottom: 10,
                            borderBottom: "1px solid #23262e",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <img
                            src={images[p?.bildName] || images.defaultBild}
                            alt={p?.name}
                            style={{
                              width: 33,
                              height: 33,
                              objectFit: "cover",
                              borderRadius: 8,
                              background: "#23262e",
                              border: "1.3px solid #333",
                              marginRight: 2,
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <b>{p?.name || "?"}</b>
                            <div
                              style={{
                                fontSize: 12.5,
                                color: "#a1a1aa",
                                marginBottom: 1,
                                fontWeight: 400,
                              }}
                            >
                              {p?.beschreibung}
                            </div>
                            <div style={{ fontSize: 13.3 }}>
                              <span style={{ color: "#a3e635", fontWeight: 800 }}>
                                {p?.preis?.toFixed(2)} € x {item.menge}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => onRemoveFromCart(p.id)}
                            style={{
                              background: "#f87171",
                              color: "#fff",
                              border: 0,
                              borderRadius: 7,
                              padding: "6px 10px",
                              fontWeight: 700,
                              fontSize: 14,
                              cursor: "pointer",
                            }}
                          >
                            −
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {/* Checkout-Bereich */}
              <div style={{
                padding: "19px 22px 19px 22px",
                borderTop: "1px solid #23262e",
                background: "#18181b",
              }}>
                <div style={{
                  fontWeight: 900,
                  fontSize: 16.5,
                  marginBottom: 7,
                  color: "#a3e635",
                }}>
                  Gesamt: {gesamt.toFixed(2)} €
                </div>
                <button
                  onClick={this.handleCheckout}
                  disabled={warenkorb.length === 0}
                  style={{
                    background: warenkorb.length === 0 ? "#444" : "#38bdf8",
                    color: "#18181b",
                    fontWeight: 900,
                    borderRadius: 11,
                    border: 0,
                    padding: "12px 28px",
                    fontSize: 16,
                    cursor: warenkorb.length === 0 ? "not-allowed" : "pointer",
                    boxShadow: warenkorb.length === 0 ? "" : "0 2px 12px #38bdf822",
                    transition: "background 0.13s, transform 0.13s",
                    marginTop: 2,
                  }}
                >
                  ✅ Zur Kasse
                </button>
              </div>
            </div>
          </>
        )}

        {/* FEHLER-ANZEIGE */}
        <div style={{ color: "#f87171", marginTop: 13, minHeight: 19 }}>
          {error}
        </div>
      </div>
    );
  }
}
