// src/components/MysteryBoxUserView.js

import React from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

// SOUNDS (liegen im public/sounds/)
const soundBoxOpen = "/sounds/box_open.mp3";
const soundWin = "/sounds/win.mp3";
const soundCoin = "/sounds/coin.mp3";

// Utility für Produktbild
const BILD_URL = (produkt) =>
  produkt?.bildName
    ? `/images/${produkt.bildName}.jpg`
    : "/images/default.jpg";

// Utility für Sound abspielen
const playSound = (src, volume = 1) => {
  try {
    const audio = new window.Audio(src);
    audio.volume = volume;
    audio.play();
  } catch {}
};

export default class MysteryBoxUserView extends React.Component {
  state = {
    boxes: [],
    produkte: [],
    selectedBox: null,
    opening: false,
    won: null,
    message: "",
    boxHistory: [],
    loading: true,
    showWinModal: false,
    orderLoading: false,
    swapLoading: false,
    inventarLoading: false,
  };

  async componentDidMount() {
    await this.loadData();
  }

  async loadData() {
    try {
      this.setState({ loading: true });
      const boxSnap = await getDocs(collection(db, "mysteryBoxes"));
      const boxes = boxSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
        items: Array.isArray(docSnap.data().items) ? docSnap.data().items : [],
      }));

      const produktSnap = await getDocs(collection(db, "produkte"));
      const produkte = produktSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      // Firestore User live holen
      const userDoc = await getDoc(doc(db, "users", this.props.user.id));
      const userData = userDoc.data();
      const boxHistory = userData?.boxHistory || [];

      this.setState({
        boxes,
        produkte,
        boxHistory,
        loading: false,
      });
    } catch (e) {
      this.setState({
        message: "❌ Fehler beim Laden der Daten",
        loading: false,
      });
    }
  }

  getProdukt = (produktId) => {
    if (!produktId) return null;
    return this.state.produkte.find((p) => String(p.id) === String(produktId));
  };

  draw(box) {
    if (!box.items || !box.items.length) {
      this.setState({ message: "❌ Diese Box hat keine Inhalte!" });
      return null;
    }
    const roll = Math.random() * 100;
    let acc = 0;
    for (const p of box.items) {
      acc += Number(p.wahrscheinlichkeit) || 0;
      if (roll < acc) return p.produktId;
    }
    return box.items[box.items.length - 1]?.produktId || null;
  }

  handleOpenBox = async () => {
    const { selectedBox, opening } = this.state;
    const { user } = this.props;
    if (!selectedBox || opening) return;

    this.setState({ opening: true, won: null, message: "" });

    try {
      // IMMER AKTUELLEN USER holen
      const userDocRef = doc(db, "users", user.id);
      const userSnap = await getDoc(userDocRef);
      const userData = userSnap.data();
      const userGuthaben = userData?.guthaben || 0;
      const userInventory = Array.isArray(userData?.inventory)
        ? userData.inventory
        : [];
      const userHistory = Array.isArray(userData?.boxHistory)
        ? userData.boxHistory
        : [];

      // Validierungen
      if (!selectedBox.items?.length) {
        this.setState({
          message: "❌ Diese Box hat keine Inhalte!",
          opening: false,
        });
        return;
      }
      if (userGuthaben < selectedBox.preis) {
        this.setState({ message: "❌ Nicht genug Guthaben!", opening: false });
        return;
      }

      playSound(soundBoxOpen, 0.8);
      await new Promise((res) => setTimeout(res, 1200 + Math.random() * 600));

      // Ziehung
      const produktId = this.draw(selectedBox);
      const produkt = this.getProdukt(produktId);
      if (!produktId) throw new Error("Keine produktId erhalten");
      if (!produkt)
        throw new Error(`Produkt mit ID ${produktId} existiert nicht`);

      playSound(soundWin, 1);

      // Gewinnobjekt
      const newGewinn = {
        produktId,
        name: produkt.name || "",
        bildName: produkt.bildName || "",
        preis: typeof produkt.preis === "number" ? produkt.preis : 0,
        kategorie: produkt.kategorie || "",
        gewonnenAm: Date.now(),
        boxName: selectedBox.name || "",
        status: "verfügbar",
        bestellDatum: null,
      };

      // History-Eintrag
      const newEntry = {
        boxId: selectedBox.id,
        boxName: selectedBox.name,
        produktId,
        produktName: produkt.name || "???",
        produktBild: produkt.bildName || "",
        timestamp: Date.now(),
      };

      // Update Firestore
      const newGuthaben = +(userGuthaben - selectedBox.preis).toFixed(2);
      const newHistory = [newEntry, ...userHistory].slice(0, 10);
      const newInventory = [newGewinn, ...userInventory].slice(0, 50);

      await updateDoc(userDocRef, {
        guthaben: newGuthaben,
        boxHistory: newHistory,
        inventory: newInventory,
      });

      // Lokalen State aktualisieren
      this.setState({
        boxHistory: newHistory,
        won: produktId,
        showWinModal: true,
        message: "",
      });

      // Optionale Rückmeldung nach außen
      if (typeof this.props.onUserUpdated === "function")
        this.props.onUserUpdated();
    } catch (error) {
      this.setState({
        message: "❌ Technischer Fehler beim Öffnen: " + error.message,
      });
    } finally {
      this.setState({ opening: false });
    }
  };

  handleOrderWin = async () => {
    const produkt = this.getProdukt(this.state.won);
    if (!produkt) return;
    this.setState({ orderLoading: true });
    try {
      if (this.props.onOrderFromInventory) {
        await this.props.onOrderFromInventory(produkt);
        this.setState({ showWinModal: false, orderLoading: false });
      }
    } catch (e) {
      this.setState({
        orderLoading: false,
        message: "❌ Bestellung fehlgeschlagen",
      });
    }
  };

  handleSwapWin = async () => {
    const produkt = this.getProdukt(this.state.won);
    if (!produkt) return;
    this.setState({ swapLoading: true });
    playSound(soundCoin, 0.9);

    if (this.props.onSwapFromInventory) {
      await this.props.onSwapFromInventory(produkt);
      this.setState({ showWinModal: false, swapLoading: false });
    }
  };

  handleAddToInventory = async () => {
    this.setState({ inventarLoading: true });
    try {
      if (this.props.onGoInventar) {
        this.setState({ showWinModal: false, inventarLoading: false });
        this.props.onGoInventar();
      }
    } catch {
      this.setState({ inventarLoading: false });
    }
  };

  renderMysteryBox(box, selected, opening) {
    return (
      <div
        onClick={() => this.setState({ selectedBox: box })}
        style={{
          background:
            selected?.id === box.id
              ? "linear-gradient(96deg, #222c37 72%, #38bdf822 100%)"
              : "#191e26",
          border:
            selected?.id === box.id
              ? "2.4px solid #e3ff64"
              : "1.1px solid #23262e",
          borderRadius: 22,
          padding: "32px 13px 21px 13px",
          minHeight: 210,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          cursor: "pointer",
          boxShadow:
            selected?.id === box.id
              ? "0 2px 20px #38bdf822, 0 1px 6px #e3ff6412"
              : "0 3px 13px #22242b14",
          transform: selected?.id === box.id ? "scale(1.045)" : "scale(1)",
          transition: "all 0.22s cubic-bezier(.5,1.5,.25,1)",
        }}
      >
        <div
          style={{
            fontWeight: 900,
            fontSize: 20,
            color: "#e3ff64",
            marginBottom: 4,
            display: "flex",
            alignItems: "center",
            gap: 6,
            letterSpacing: 0.18,
          }}
        >
          <span style={{ fontSize: 24 }}>🎁</span> {box.name}
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#38bdf8",
            marginBottom: 9,
            letterSpacing: 0.07,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          💶 {box.preis} €
        </div>
        <div style={{ width: "100%", minHeight: 36, marginBottom: 10 }}>
          {this.renderBoxProducts(box)}
        </div>
        <button
          style={{
            marginTop: 9,
            background:
              opening || (this.props.user.guthaben || 0) < box.preis
                ? "#23262e"
                : "linear-gradient(90deg,#38bdf8,#e3ff64 100%)",
            color:
              opening || (this.props.user.guthaben || 0) < box.preis
                ? "#a1a1aa"
                : "#191d23",
            border: 0,
            borderRadius: 9,
            fontWeight: 900,
            fontSize: 15,
            padding: "8px 24px",
            cursor:
              opening || (this.props.user.guthaben || 0) < box.preis
                ? "not-allowed"
                : "pointer",
            boxShadow: "0 1.5px 9px #38bdf822",
            letterSpacing: 0.11,
            opacity: opening && selected?.id === box.id ? 0.67 : 1,
            filter: opening ? "blur(0.6px)" : "none",
            transition: "all .13s",
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
          onClick={(e) => {
            e.stopPropagation();
            this.setState({ selectedBox: box }, () => {
              this.handleOpenBox();
            });
          }}
          disabled={opening || (this.props.user.guthaben || 0) < box.preis}
        >
          <span role="img" aria-label="box">
            🪄
          </span>
          {opening && selected?.id === box.id
            ? "Box öffnet..."
            : (this.props.user.guthaben || 0) < box.preis
            ? "Nicht genug €"
            : "Öffnen"}
        </button>
      </div>
    );
  }

  renderBoxProducts(box) {
    if (!box.items?.length)
      return (
        <div style={{ color: "#a1a1aa", textAlign: "center", fontSize: 13 }}>
          Keine Produkte
        </div>
      );
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 7,
          justifyContent: "center",
        }}
      >
        {box.items.map((item, idx) => {
          const produkt = this.getProdukt(item.produktId);
          return (
            <div
              key={idx}
              style={{
                background: "#232940",
                borderRadius: 7,
                padding: "5px 9px",
                display: "flex",
                alignItems: "center",
                minWidth: 98,
                maxWidth: 140,
                margin: "0 1px 5px 1px",
                fontSize: 12.3,
                fontWeight: 700,
              }}
            >
              <img
                src={BILD_URL(produkt)}
                alt={produkt?.name || "?"}
                style={{
                  width: 26,
                  height: 26,
                  objectFit: "cover",
                  borderRadius: 6,
                  marginRight: 6,
                  background: "#18191c",
                  border: "1px solid #252529",
                }}
                onError={(e) => {
                  e.target.src = "/images/produkte/placeholder.webp";
                }}
              />
              <div>
                <div
                  style={{ fontWeight: 900, color: "#e3ff64", fontSize: 12 }}
                >
                  {produkt?.name ?? "?"}
                </div>
                <div
                  style={{
                    fontSize: 10.2,
                    color: "#38bdf8",
                    fontWeight: 700,
                  }}
                >
                  {item.wahrscheinlichkeit}% Chance
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  render() {
    const { onGoBack, user } = this.props;
    const {
      boxes,
      selectedBox,
      opening,
      won,
      showWinModal,
      message,
      boxHistory,
      loading,
      orderLoading,
      swapLoading,
      inventarLoading,
    } = this.state;

    const winProdukt = won ? this.getProdukt(won) : null;

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(120deg,#10121a 82%,#23262e 100%)",
          color: "#fff",
          fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "24px 0 11px 0",
            background: "linear-gradient(92deg,#181b24 88%,#23262e 100%)",
            boxShadow: "0 8px 22px #0005",
            position: "sticky",
            top: 0,
            zIndex: 2,
          }}
        >
          <button
            onClick={onGoBack}
            style={{
              marginLeft: 13,
              background: "none",
              border: 0,
              color: "#e3ff64",
              fontWeight: 900,
              fontSize: 24,
              cursor: "pointer",
            }}
            title="Zurück"
          >
            🔙
          </button>
          <h2
            style={{
              flex: 1,
              color: "#e3ff64",
              textAlign: "center",
              fontWeight: 900,
              fontSize: 23,
              letterSpacing: 1.3,
              margin: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
            }}
          >
            🎁 Mystery Boxen
          </h2>
          <span style={{ width: 28 }} />
        </div>

        {/* Guthaben */}
        <div style={{ textAlign: "center", margin: "21px 0 0 0" }}>
          <div style={{ fontWeight: 700, color: "#a1a1aa", fontSize: 14 }}>
            Guthaben
          </div>
          <div
            style={{
              fontSize: 29,
              fontWeight: 900,
              color: "#e3ff64",
              letterSpacing: 1.2,
              marginTop: 2,
            }}
          >
            💸 {user?.guthaben?.toFixed(2) ?? "0.00"} €
          </div>
        </div>

        {/* Boxen-Auswahl */}
        {loading ? (
          <div
            style={{
              textAlign: "center",
              margin: "52px auto",
              color: "#38bdf8",
              fontSize: 18,
              letterSpacing: 1.1,
            }}
          >
            ⏳ Lade Boxen...
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
              gap: 28,
              maxWidth: 980,
              margin: "32px auto 20px auto",
              padding: "0 12px",
              alignItems: "start",
            }}
          >
            {boxes.length > 0 ? (
              boxes.map((box) =>
                this.renderMysteryBox(box, selectedBox, opening)
              )
            ) : (
              <div
                style={{
                  gridColumn: "1 / -1",
                  textAlign: "center",
                  color: "#a1a1aa",
                  marginTop: 20,
                }}
              >
                😶‍🌫️ Keine Boxen verfügbar
              </div>
            )}
          </div>
        )}

        {/* Ziehungs-Animation */}
        {opening && (
          <div
            style={{
              margin: "53px auto 10px auto",
              maxWidth: 250,
              textAlign: "center",
              fontSize: 25,
              fontWeight: 900,
              color: "#38bdf8",
              textShadow: "0 1px 8px #38bdf822",
            }}
          >
            🎁 Die Box dreht...
            <div className="pop-anim-wrap">
              <div className="pop-anim"></div>
            </div>
            <style>{`
              .pop-anim-wrap {
                margin: 17px auto 6px auto;
                width: 54px;
                height: 54px;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .pop-anim {
                width: 39px;
                height: 39px;
                border-radius: 9px 10px 10px 9px;
                background: linear-gradient(112deg, #191d23 80%, #38bdf8 120%);
                border: 3px solid #38bdf8;
                border-top: 3px solid #e3ff64;
                box-shadow: 0 2px 18px #38bdf877, 0 2px 8px #10121a44;
                animation: boxSpin 1.2s cubic-bezier(.4,.7,.4,1) infinite;
                position: relative;
              }
              .pop-anim::before {
                content: "";
                display: block;
                position: absolute;
                left: 50%; top: -6px;
                transform: translateX(-50%);
                width: 22px; height: 9px;
                border-radius: 5px 5px 5px 5px/5px 5px 5px 5px;
                background: linear-gradient(92deg, #e3ff64 60%, #38bdf8 120%);
                box-shadow: 0 2px 10px #e3ff6455;
              }
              @keyframes boxSpin {
                0% { transform: rotate(0deg);}
                100% { transform: rotate(360deg);}
              }
            `}</style>
          </div>
        )}

        {/* Gewinn-Popup */}
        {showWinModal && winProdukt && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(18,22,30,0.95)",
              zIndex: 99,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "modalfade .21s cubic-bezier(.1,.75,.3,1)",
            }}
          >
            <div
              style={{
                background: "linear-gradient(108deg,#161d23 85%,#23262e 100%)",
                border: "2.4px solid #e3ff64",
                borderRadius: 19,
                minWidth: 300,
                maxWidth: 340,
                boxShadow: "0 8px 44px #38bdf877",
                padding: "29px 21px 18px 21px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                animation: "popfade .56s cubic-bezier(.15,1.9,.5,.87)",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 15,
                  right: 14,
                  cursor: "pointer",
                  fontWeight: 900,
                  color: "#a1a1aa",
                  fontSize: 21,
                }}
                title="Schließen"
                onClick={() => this.setState({ showWinModal: false })}
              >
                ✖️
              </div>
              <div
                style={{
                  fontSize: 21,
                  fontWeight: 900,
                  color: "#e3ff64",
                  marginBottom: 11,
                  letterSpacing: 0.16,
                  textShadow: "0 1px 10px #e3ff6455",
                }}
              >
                🎉 Glückwunsch!
              </div>
              <img
                src={BILD_URL(winProdukt)}
                alt="Produkt"
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 12,
                  boxShadow: "0 3px 24px #10121a66",
                  border: "2px solid #38bdf8",
                  background: "#191d23",
                  objectFit: "cover",
                  marginBottom: 8,
                  animation: "popfade .53s cubic-bezier(.2,2.1,.6,.95)",
                }}
                onError={(e) => {
                  e.target.src = "/images/produkte/placeholder.webp";
                }}
              />
              <div
                style={{
                  color: "#38bdf8",
                  fontWeight: 800,
                  fontSize: 17,
                  marginBottom: 2,
                  textAlign: "center",
                }}
              >
                {winProdukt?.name ?? "Geheimnisvolles Item"}
              </div>
              <div style={{ color: "#e3ff64", fontWeight: 500, fontSize: 12 }}>
                Kategorie: {winProdukt?.kategorie ?? "-"}
              </div>
              <div
                style={{
                  color: "#a1a1aa",
                  fontSize: 11,
                  marginBottom: 11,
                  marginTop: 3,
                }}
              >
                Wert: {winProdukt?.preis ? winProdukt.preis + " €" : "-"}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 7,
                  marginTop: 5,
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                <button
                  style={{
                    background: "#38bdf8",
                    color: "#191d23",
                    border: "0",
                    borderRadius: 8,
                    fontWeight: 900,
                    fontSize: 14.5,
                    padding: "8px 18px",
                    cursor: orderLoading ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                  onClick={this.handleOrderWin}
                  disabled={orderLoading}
                  title="Jetzt direkt bestellen!"
                >
                  🛒 Bestellen
                </button>
                <button
                  style={{
                    background: "#191d23",
                    color: "#38bdf8",
                    border: "1.4px solid #38bdf888",
                    borderRadius: 8,
                    fontWeight: 900,
                    fontSize: 14.5,
                    padding: "8px 12px",
                    cursor: swapLoading ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                  onClick={this.handleSwapWin}
                  disabled={swapLoading}
                  title="In Guthaben tauschen"
                >
                  💱 Umtauschen
                </button>
                <button
                  style={{
                    background: "#e3ff64",
                    color: "#181b1e",
                    border: 0,
                    borderRadius: 8,
                    fontWeight: 900,
                    fontSize: 14.5,
                    padding: "8px 13px",
                    cursor: inventarLoading ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                  onClick={this.handleAddToInventory}
                  disabled={inventarLoading}
                  title="Zum Inventar"
                >
                  🎒 Inventar
                </button>
              </div>
            </div>
            <style>{`
              @keyframes modalfade { 0% { opacity: 0; } 100% { opacity: 1; } }
              @keyframes popfade {
                0% { opacity: 0; transform: scale(.8);}
                70% { opacity: 1; transform: scale(1.08);}
                100% { opacity: 1; transform: scale(1);}
              }
            `}</style>
          </div>
        )}

        {/* Meldungen */}
        {message && (
          <div
            style={{
              margin: "8px auto",
              maxWidth: 370,
              background: "#181a1e",
              color: "#e3ff64",
              fontWeight: 700,
              borderRadius: 7,
              textAlign: "center",
              padding: "7px 0",
              fontSize: 13.5,
              boxShadow: "0 1px 9px #e3ff6433",
            }}
          >
            {message}
          </div>
        )}

        {/* History */}
        <div
          style={{
            margin: "30px auto 20px auto",
            maxWidth: 440,
            background: "#181a1e",
            borderRadius: 17,
            padding: "14px 18px 13px 18px",
            color: "#fff",
            boxShadow: "0 1px 9px #23262e18",
          }}
        >
          <div
            style={{
              fontWeight: 800,
              color: "#38bdf8",
              fontSize: 14.8,
              marginBottom: 7,
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            🕑 Deine letzten Box-Öffnungen
          </div>
          {boxHistory.length === 0 ? (
            <div style={{ color: "#a1a1aa", fontSize: 13 }}>
              Noch keine Öffnungen.
            </div>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {boxHistory.slice(0, 7).map((h, i) => {
                const produkt = this.getProdukt(h.produktId);
                return (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      background: "#23262e",
                      borderRadius: 7,
                      padding: "7px 8px",
                      fontSize: 12.5,
                      animation:
                        "fadeIn .35s cubic-bezier(.21,1.1,.6,.99) both",
                      animationDelay: `${i * 0.07}s`,
                    }}
                  >
                    <img
                      src={BILD_URL(produkt)}
                      alt={produkt?.name || "?"}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 5,
                        marginRight: 5,
                        background: "#191d23",
                        border: "1px solid #333",
                        objectFit: "cover",
                      }}
                      onError={(e) => {
                        e.target.src = "/images/produkte/placeholder.webp";
                      }}
                    />
                    <span
                      style={{
                        fontWeight: 900,
                        color: "#e3ff64",
                        minWidth: 55,
                      }}
                    >
                      {h.boxName}
                    </span>
                    <span
                      style={{
                        color: "#38bdf8",
                        fontWeight: 700,
                        marginLeft: 2,
                        minWidth: 70,
                      }}
                    >
                      {produkt?.name ?? "?"}
                    </span>
                    <span
                      style={{
                        color: "#a1a1aa",
                        marginLeft: "auto",
                        fontSize: 11,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {new Date(h.timestamp).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                      })}{" "}
                      {new Date(h.timestamp).toLocaleTimeString("de-DE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <style>{`
            @keyframes fadeIn {
              0% { opacity: 0; transform: translateY(18px);}
              100% { opacity: 1; transform: translateY(0);}
            }
          `}</style>
        </div>
      </div>
    );
  }
}
