import React from "react";
import images from "./images/images"; // Pfad ggf. anpassen!

const GOLD_GRAD = "linear-gradient(90deg, #ffd700 40%, #bfa14a 100%)";
const DARK_GRAD = "linear-gradient(120deg,#19181c 60%,#2e2b25 100%)";
const GOLD_SHADOW = "0 4px 32px #ffd70026, 0 2px 11px #ffd70016";
const KAT_EMOJIS = {
  Standard: "🛍️",
  Hase: "🐇",
  Shem: "🧊",
  Schoko: "🍫",
  Medikamente: "💊",
  Cali: "🌴",
};

export default class BiggiMenuView extends React.Component {
  constructor(props) {
    super(props);
    const kategorien = Array.from(
      new Set((props.produkte || []).map((p) => p.kategorie || "Standard"))
    ).map((k) => ({ name: k }));
    this.state = {
      kategorien,
      selectedKat: "ALLE",
      menge: {},
      error: "",
      imgActive: "",
      cartOpen: false,
      suche: "",
      searchFocused: false,
    };
  }

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
    setTimeout(() => this.setState({ imgActive: "" }), 190);
  };

  handleCartOpen = () => this.setState({ cartOpen: true });
  handleCartClose = () => this.setState({ cartOpen: false });

  clearSuche = () => this.setState({ suche: "" });

  render() {
    const {
      warenkorb = [],
      onAddToCart,
      onRemoveFromCart,
      onCheckout,
      onGoBack,
      produkte = [],
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
    } = this.state;

    const cartMenge = (produktId) =>
      warenkorb.find((w) => w.produktId === produktId)?.menge || 0;

    const gesamt = warenkorb.reduce((sum, w) => {
      const p = produkte.find((pr) => pr.id === w.produktId);
      return sum + (p?.preis || 0) * w.menge;
    }, 0);

    return (
      <div
        style={{
          minHeight: "100vh",
          background: DARK_GRAD,
          color: "#fff",
          fontFamily: "'Inter', sans-serif",
          padding: "0 0 52px 0",
        }}
      >
        <style>{`
          .gold-menu-head {
            background: ${GOLD_GRAD};
            color: #222;
            border-radius: 0 0 23px 23px;
            box-shadow: 0 7px 44px #ffd70011;
            padding: 28px 7vw 28px 7vw;
            font-size: 2.25rem;
            font-weight: 900;
            letter-spacing: .13em;
            text-shadow: 0 2px 8px #0004;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 17px;
            border-bottom: 2px solid #bfa14a60;
          }
          .gold-btn {
            background: ${GOLD_GRAD};
            color: #222;
            border: none;
            border-radius: 10px;
            padding: 7px 22px;
            font-weight: 800;
            font-size: 16px;
            cursor: pointer;
            box-shadow: ${GOLD_SHADOW};
            margin-right: 12px;
            transition: background 0.13s, box-shadow 0.14s;
            outline: none;
          }
          .gold-btn:active, .gold-btn:hover {
            background: linear-gradient(92deg,#ffea77 72%,#bfa14a 120%);
            color: #1a1a1a;
            box-shadow: 0 7px 32px #ffd70055;
          }
          .gold-cat-btn {
            background: #19181c;
            color: #ffd700;
            border: 2.3px solid #bfa14a70;
            border-radius: 8px;
            padding: 6px 18px;
            font-weight: 800;
            font-size: 15.5px;
            margin-right: 7px;
            margin-bottom: 7px;
            cursor: pointer;
            transition: border 0.15s, color 0.14s, background 0.13s;
            letter-spacing: 0.01em;
          }
          .gold-cat-btn.selected {
            background: ${GOLD_GRAD};
            color: #1a1a1a;
            border: 2.3px solid #ffd700;
            transform: scale(1.06);
          }
          .gold-search {
            background: #221f16;
            border: 1.7px solid #bfa14a40;
            border-radius: 9px;
            color: #ffd700;
            font-weight: 700;
            font-size: 16.5px;
            padding: 7px 34px 7px 36px;
            min-width: 170px;
            max-width: 230px;
            outline: none;
            box-shadow: 0 1px 8px #ffd70017;
            transition: border 0.16s, background 0.13s;
          }
          .gold-search:focus {
            background: #19181c;
            border: 2px solid #ffd700;
            color: #fff;
          }
          .gold-search-clear {
            position: absolute;
            right: 7px;
            top: 7px;
            background: none;
            border: none;
            color: #ffd700;
            font-size: 19px;
            cursor: pointer;
            border-radius: 20px;
            width: 23px;
            height: 23px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.69;
            transition: background 0.14s;
          }
          .gold-search-clear:hover {
            background: #ffd70016;
            opacity: 1;
          }
          .gold-prod-card {
            background: #23201a;
            border-radius: 18px;
            box-shadow: 0 3px 25px #ffd70011;
            border: 2.5px solid #bfa14a22;
            padding: 20px 19px 16px 19px;
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 15px;
            margin-bottom: 9px;
            min-height: 103px;
          }
          .gold-prod-img {
            width: 73px;
            height: 73px;
            border-radius: 17px;
            object-fit: cover;
            border: 2.5px solid #ffd70060;
            background: #1a191a;
            box-shadow: 0 1px 13px #ffd70021;
            transition: transform 0.18s, box-shadow 0.18s;
            cursor: pointer;
          }
          .gold-prod-img.active {
            transform: scale(1.12) !important;
            box-shadow: 0 5px 17px #ffd70070;
          }
          .gold-add-btn {
            background: ${GOLD_GRAD};
            color: #18181b;
            font-weight: 900;
            border-radius: 8px;
            border: none;
            padding: 9px 14px;
            font-size: 15px;
            cursor: pointer;
            margin-right: 1px;
            box-shadow: 0 1px 7px #ffd70044;
            transition: background 0.13s, box-shadow 0.13s;
          }
          .gold-add-btn:active, .gold-add-btn:hover {
            background: linear-gradient(98deg,#ffe45e 57%,#ffd700 110%);
          }
          .gold-remove-btn {
            background: #29271d;
            color: #ffd700;
            border: none;
            border-radius: 8px;
            padding: 8px 13px;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
            margin-left: 1px;
            box-shadow: 0 1px 7px #ffd7001a;
            transition: background 0.13s, color 0.12s;
          }
          .gold-remove-btn:active, .gold-remove-btn:hover {
            background: #ffd700;
            color: #18181b;
          }
          .gold-cart-fab {
            position: fixed;
            right: 22px;
            bottom: 29px;
            z-index: 170;
            background: ${GOLD_GRAD};
            color: #18181b;
            border: none;
            border-radius: 99px;
            box-shadow: 0 5px 28px #ffd70041;
            padding: 0 26px 0 18px;
            font-weight: 900;
            font-size: 23px;
            min-width: 85px;
            min-height: 62px;
            display: flex;
            align-items: center;
            gap: 9px;
            cursor: pointer;
            transition: box-shadow 0.17s, background 0.18s;
            outline: none;
          }
          .gold-cart-fab:hover, .gold-cart-fab:active {
            box-shadow: 0 8px 32px #ffd70081;
            background: linear-gradient(93deg, #ffdb73 84%, #bfa14a 160%);
          }
          .gold-cart-drawer-bg {
            position: fixed;
            inset: 0;
            background: rgba(19,19,21, 0.74);
            z-index: 199;
            animation: fadeinbg .14s;
          }
          .gold-cart-drawer {
            position: fixed;
            right: 0;
            top: 0;
            bottom: 0;
            width: 410px;
            max-width: 100vw;
            background: #1b1a18;
            box-shadow: -3px 0 27px #ffd70029;
            z-index: 200;
            padding: 0;
            display: flex;
            flex-direction: column;
            animation: slideinright .22s cubic-bezier(.31,1.04,.59,.98);
          }
          @keyframes fadeinbg { from { opacity: 0; } to { opacity: 1; } }
          @keyframes slideinright {
            from { transform: translateX(140px); opacity: 0; }
            to { transform: none; opacity: 1; }
          }
          @media (max-width: 700px) {
            .gold-cart-drawer { width: 99vw; }
            .gold-cart-fab { right: 6px; bottom: 13px; min-width: 68px; }
            .gold-menu-head { font-size: 1.5rem; padding: 16px 5vw; }
          }
        `}</style>
        {/* Header */}
        <div className="gold-menu-head">
          <button className="gold-btn" onClick={onGoBack}>
            ⬅️
          </button>
          <span>
            <span style={{ fontSize: 36, marginRight: 7 }}>🥇</span>
            Golden Menü
          </span>
        </div>

        {/* Kategorie + Suche */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          margin: "0 7vw 12px 7vw",
        }}>
          <button
            className={"gold-cat-btn" + (selectedKat === "ALLE" ? " selected" : "")}
            onClick={() => this.setState({ selectedKat: "ALLE" })}
          >
            <span style={{ fontSize: 18 }}>🌐</span> Alle
          </button>
          {kategorien.map((kat) => (
            <button
              key={kat.name}
              className={"gold-cat-btn" + (selectedKat === kat.name ? " selected" : "")}
              onClick={() => this.setState({ selectedKat: kat.name })}
            >
              <span style={{ fontSize: 18 }}>{KAT_EMOJIS[kat.name] || "🛍️"}</span>
              {kat.name}
            </button>
          ))}
          <div style={{ position: "relative", marginLeft: "auto" }}>
            <input
              className="gold-search"
              type="text"
              placeholder="Suchen…"
              value={suche}
              onChange={e => this.setState({ suche: e.target.value })}
              maxLength={44}
              onFocus={() => this.setState({ searchFocused: true })}
              onBlur={() => this.setState({ searchFocused: false })}
              style={{
                background: searchFocused ? "#19181c" : undefined,
                color: searchFocused ? "#fff" : "#ffd700",
                borderColor: searchFocused ? "#ffd700" : "#bfa14a40",
              }}
            />
            {suche && (
              <button
                className="gold-search-clear"
                tabIndex={0}
                onClick={this.clearSuche}
                aria-label="Suchfeld leeren"
                title="Suchfeld leeren"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Produktliste */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 24,
            margin: "0 7vw 29px 7vw",
          }}
        >
          {this.filterProdukte().length === 0 ? (
            <div
              style={{
                color: "#bfa14a",
                gridColumn: "1/-1",
                fontSize: 18,
                fontWeight: 500,
                padding: 23,
                textAlign: "center",
                background: "#22201a",
                borderRadius: 16,
                border: "2px solid #bfa14a30",
              }}
            >
              😕 Keine Produkte gefunden.
            </div>
          ) : (
            this.filterProdukte().map((p) => (
              <div
                key={p.id}
                className="gold-prod-card"
              >
                <img
                  src={images[p.bildName] || images.defaultBild}
                  alt={p.name}
                  className={
                    "gold-prod-img" + (imgActive === p.id ? " active" : "")
                  }
                  onMouseDown={() => this.handleImgClick(p.id)}
                  onMouseUp={() => this.setState({ imgActive: "" })}
                  onMouseLeave={() => this.setState({ imgActive: "" })}
                  tabIndex={0}
                  draggable={false}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: 20,
                      marginBottom: 2,
                      color: "#ffd700",
                      letterSpacing: 0.01,
                      textShadow: "0 1.5px 8px #0004",
                    }}
                  >
                    {p.name}{" "}
                    <span style={{
                      fontSize: 17,
                      fontWeight: 500,
                      color: "#bfa14a",
                      marginLeft: 4
                    }}>
                      {KAT_EMOJIS[p.kategorie] || ""}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 14.3,
                      color: "#bfa14a",
                      marginBottom: 5,
                      minHeight: 20,
                      letterSpacing: 0.01,
                      fontWeight: 500,
                    }}
                  >
                    {p.beschreibung}
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      marginBottom: 2,
                      fontWeight: 700,
                      color: "#ffd700",
                    }}
                  >
                    {p.preis} €/g
                    <span
                      style={{
                        color: "#aaa",
                        fontWeight: 500,
                        marginLeft: 10,
                        fontSize: 14,
                      }}
                    >
                      | Bestand: {p.bestand}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="number"
                      min={1}
                      value={menge[p.id] || 1}
                      onChange={(e) => this.handleMengeChange(p.id, e.target.value)}
                      style={{
                        width: 38,
                        background: "#18181b",
                        color: "#ffd700",
                        border: "1.2px solid #bfa14a80",
                        borderRadius: 6,
                        padding: "5px 6px",
                        fontWeight: 700,
                        fontSize: 15,
                        marginRight: 2,
                      }}
                    />
                    <button
                      className="gold-add-btn"
                      onClick={() => {
                        const m = menge[p.id] || 1;
                        for (let i = 0; i < m; ++i) onAddToCart(p.id);
                      }}
                      disabled={p.bestand === 0}
                      style={{
                        opacity: p.bestand === 0 ? 0.45 : 1,
                        cursor: p.bestand === 0 ? "not-allowed" : "pointer",
                      }}
                    >
                      ➕
                    </button>
                    {cartMenge(p.id) > 0 && (
                      <button
                        className="gold-remove-btn"
                        onClick={() => onRemoveFromCart(p.id)}
                      >
                        −
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Floating Warenkorb Button */}
        <button
          className="gold-cart-fab"
          onClick={this.handleCartOpen}
          aria-label="Warenkorb öffnen"
        >
          🛒
          <span style={{ marginLeft: 0, color: "#18181b", fontWeight: 900 }}>
            {warenkorb.length}
          </span>
          <span style={{
            color: "#bfa14a",
            fontSize: 15,
            fontWeight: 800,
            marginLeft: 9,
            letterSpacing: 0.01,
          }}>
            {gesamt.toFixed(2)} €
          </span>
        </button>

        {/* Warenkorb Drawer */}
        {cartOpen && (
          <>
            <div className="gold-cart-drawer-bg" onClick={this.handleCartClose}></div>
            <div className="gold-cart-drawer">
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1.8px solid #bfa14a24",
                padding: "25px 24px 13px 24px",
                minHeight: 66,
              }}>
                <h3 style={{
                  fontWeight: 900,
                  fontSize: 20,
                  margin: 0,
                  color: "#ffd700"
                }}>
                  🛒 Warenkorb
                </h3>
                <button
                  onClick={this.handleCartClose}
                  className="gold-btn"
                  style={{
                    fontSize: 17,
                    padding: "4px 14px",
                    marginLeft: 7,
                    background: "#23201a",
                    color: "#ffd700"
                  }}
                >
                  ✖
                </button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                {warenkorb.length === 0 ? (
                  <div style={{ color: "#bfa14a", padding: 12, fontSize: 17 }}>
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
                            fontSize: 15.7,
                            marginBottom: 13,
                            paddingBottom: 10,
                            borderBottom: "1.4px solid #bfa14a22",
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
                              background: "#23201a",
                              border: "1.7px solid #bfa14a77",
                              marginRight: 2,
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <b style={{ color: "#ffd700" }}>{p?.name || "?"}</b>
                            <div
                              style={{
                                fontSize: 12.5,
                                color: "#bfa14a",
                                marginBottom: 1,
                                fontWeight: 400,
                              }}
                            >
                              {p?.beschreibung}
                            </div>
                            <div style={{
                              fontSize: 13.5,
                              color: "#ffd700"
                            }}>
                              {p?.preis?.toFixed(2)} € x {item.menge}
                            </div>
                          </div>
                          <button
                            onClick={() => onRemoveFromCart(p.id)}
                            className="gold-remove-btn"
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
                padding: "21px 24px",
                borderTop: "1.6px solid #bfa14a22",
                background: "#23201a",
              }}>
                <div style={{
                  fontWeight: 900,
                  fontSize: 17.5,
                  marginBottom: 8,
                  color: "#ffd700",
                }}>
                  Gesamt: {gesamt.toFixed(2)} €
                </div>
                <button
                  onClick={() => {
                    this.handleCartClose();
                    onCheckout();
                  }}
                  disabled={warenkorb.length === 0}
                  className="gold-btn"
                  style={{
                    background: warenkorb.length === 0 ? "#444" : GOLD_GRAD,
                    color: "#222",
                    fontWeight: 900,
                    borderRadius: 12,
                    border: 0,
                    padding: "14px 32px",
                    fontSize: 16,
                    cursor: warenkorb.length === 0 ? "not-allowed" : "pointer",
                    boxShadow: warenkorb.length === 0 ? "" : GOLD_SHADOW,
                    marginTop: 3,
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
