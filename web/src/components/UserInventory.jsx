import React from "react";
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";

// Helper für Bild-Pfad
const BILD_URL = (produkt) =>
  produkt?.bildName
    ? `/images/produkte/${produkt.bildName}.webp`
    : "/images/produkte/placeholder.webp";

export default class UserInventory extends React.Component {
  state = {
    inventory: [],
    loading: true,
    message: "",
    goToOrder: false,
    gratisWarenkorb: null,
  };

  async componentDidMount() {
    await this.loadInventory();
  }

  async loadInventory() {
    try {
      const userDoc = await getDoc(doc(db, "users", this.props.user.id));
      const inventory = userDoc.data()?.inventory || [];
      this.setState({ inventory, loading: false });
    } catch (e) {
      this.setState({
        message: "❌ Fehler beim Laden des Inventars",
        loading: false,
      });
    }
  }

  // Produkt als Bestellung markieren und direkt OrderView aufrufen
  handleOrder = async (idx) => {
    const inventory = [...this.state.inventory];
    const produkt = inventory[idx];
    if (produkt.status !== "verfügbar") {
      this.setState({ message: "❌ Dieses Produkt ist nicht mehr verfügbar." });
      return;
    }

    // Firestore-Produkt-ID aus Produkte-Liste suchen!
    const produkteList = this.props.produkte || [];
    let produktId = produkt.produktId || produkt.id;
    if (!produktId && produkteList.length > 0) {
      const gefunden = produkteList.find(
        (p) =>
          (produkt.produktId && p.id === produkt.produktId) ||
          p.name === produkt.name
      );
      if (gefunden) produktId = gefunden.id;
    }

    if (!produktId) {
      this.setState({ message: "❌ Produkt konnte nicht gefunden werden!" });
      return;
    }

    // Markiere das Item als bestellt (optional)
    inventory[idx].status = "bestellt";
    inventory[idx].bestellDatum = Date.now();
    await updateDoc(doc(db, "users", this.props.user.id), { inventory });

    // Fertigen Warenkorb-Eintrag übergeben
    this.setState({
      inventory,
      message: "",
      goToOrder: true,
      gratisWarenkorb: [
        {
          produktId,
          menge: 1,
          gratis: true,
        },
      ],
    });
  };

  // Produkt gegen Guthaben eintauschen
  handleExchange = async (idx) => {
    const inventory = [...this.state.inventory];
    const produkt = inventory[idx];
    if (produkt.status !== "verfügbar") {
      this.setState({ message: "❌ Dieses Produkt ist nicht mehr verfügbar." });
      return;
    }
    inventory[idx].status = "eingetauscht";
    await updateDoc(doc(db, "users", this.props.user.id), { inventory });

    // Guthaben erhöhen
    const userDoc = await getDoc(doc(db, "users", this.props.user.id));
    const currentBalance = userDoc.data()?.guthaben || 0;
    await updateDoc(doc(db, "users", this.props.user.id), {
      guthaben: currentBalance + (produkt.preis || 0),
    });
    this.setState({
      inventory,
      message: "💸 Produkt wurde gegen Guthaben getauscht.",
    });
  };

  render() {
    const { inventory, loading, message, goToOrder, gratisWarenkorb } =
      this.state;
    const { onGoBack, produkte, onOrderFromInventory } = this.props;

    // Bei Bestellung: Parent-Callback aufrufen (du leitest in App.js dann auf <OrderView ... /> weiter)
    if (goToOrder && typeof onOrderFromInventory === "function") {
      onOrderFromInventory(gratisWarenkorb);
      return null;
    }

    return (
      <div
        style={{
          maxWidth: 680,
          margin: "38px auto",
          background: "linear-gradient(135deg, #1a1b20 83%, #222329 100%)",
          borderRadius: 22,
          padding: "28px 25px 28px 25px",
          color: "#fff",
          boxShadow: "0 2px 16px #23262e44",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {/* Zurück-Button */}
        <button
          onClick={onGoBack}
          style={{
            background: "#222329",
            color: "#e3ff64",
            border: "none",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 16,
            padding: "9px 20px",
            marginBottom: 18,
            marginRight: 8,
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
            gap: 9,
            boxShadow: "0 1px 8px #23262e33",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <ArrowLeft size={21} />
          Zurück
        </button>

        <h2
          style={{
            color: "#e3ff64",
            fontWeight: 900,
            textAlign: "center",
            marginBottom: 23,
            letterSpacing: 1,
            fontSize: 28,
            textShadow: "0 1px 16px #b7fa2266",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          🎁 Dein Inventar
        </h2>
        {loading ? (
          <div
            style={{
              textAlign: "center",
              color: "#38bdf8",
              fontSize: 20,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Lade...
          </div>
        ) : (
          <>
            {inventory.length === 0 ? (
              <div
                style={{
                  color: "#a1a1aa",
                  textAlign: "center",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 17,
                  marginTop: 50,
                  marginBottom: 50,
                }}
              >
                Keine Gewinne bisher.
              </div>
            ) : (
              <table
                style={{
                  width: "100%",
                  fontSize: 16.2,
                  borderSpacing: 0,
                  background: "#23262e",
                  borderRadius: 12,
                  overflow: "hidden",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                <thead>
                  <tr
                    style={{
                      color: "#38bdf8",
                      background: "#202228",
                      fontSize: 15.5,
                    }}
                  >
                    <th
                      style={{
                        textAlign: "left",
                        padding: 11,
                        fontWeight: 700,
                      }}
                    >
                      Produkt
                    </th>
                    <th style={{ fontWeight: 700 }}>Status</th>
                    <th style={{ fontWeight: 700 }}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item, idx) => (
                    <tr
                      key={idx}
                      style={{
                        background: idx % 2 ? "#23262e" : "#1a1b20",
                        borderRadius: 7,
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      <td
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 15,
                          padding: "12px 9px",
                        }}
                      >
                        <img
                          src={BILD_URL(item)}
                          alt={item.name}
                          style={{
                            width: 45,
                            height: 45,
                            borderRadius: 10,
                            background: "#1d1d1d",
                            border: "1px solid #333",
                            objectFit: "cover",
                          }}
                          onError={(e) => {
                            e.target.src = "/images/produkte/placeholder.webp";
                          }}
                        />
                        <div>
                          <div
                            style={{
                              fontWeight: 900,
                              color: "#e3ff64",
                              fontSize: 17.5,
                              marginBottom: 1,
                              fontFamily: "'Inter', sans-serif",
                            }}
                          >
                            {item.name}
                          </div>
                          <div
                            style={{
                              color: "#a1a1aa",
                              fontSize: 13.5,
                              fontFamily: "'Inter', sans-serif",
                            }}
                          >
                            {item.boxName}
                          </div>
                        </div>
                      </td>
                      <td
                        style={{
                          color:
                            item.status === "verfügbar" ? "#38bdf8" : "#e3ff64",
                          fontWeight: 700,
                          textAlign: "center",
                          fontSize: 15.2,
                        }}
                      >
                        {item.status === "verfügbar" && "Verfügbar"}
                        {item.status === "bestellt" && "Bestellt"}
                        {item.status === "eingetauscht" && "Eingetauscht"}
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        {item.status === "verfügbar" && (
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              justifyContent: "center",
                            }}
                          >
                            <button
                              onClick={() => this.handleOrder(idx)}
                              style={{
                                background:
                                  "linear-gradient(90deg,#38bdf8 70%,#a3e635 100%)",
                                color: "#18181b",
                                border: 0,
                                borderRadius: 10,
                                fontWeight: 800,
                                fontSize: 15.2,
                                padding: "10px 20px",
                                cursor: "pointer",
                                boxShadow: "0 2px 8px #38bdf822",
                                marginBottom: 2,
                                fontFamily: "'Inter', sans-serif",
                                letterSpacing: 0.2,
                              }}
                            >
                              Gratis bestellen
                            </button>
                            <button
                              onClick={() => this.handleExchange(idx)}
                              style={{
                                background: "#e3ff64",
                                color: "#191d23",
                                border: 0,
                                borderRadius: 10,
                                fontWeight: 800,
                                fontSize: 15.2,
                                padding: "10px 20px",
                                cursor: "pointer",
                                boxShadow: "0 1px 8px #e3ff6444",
                                fontFamily: "'Inter', sans-serif",
                              }}
                            >
                              Gegen Guthaben ({item.preis ?? "?"} €)
                            </button>
                          </div>
                        )}
                        {item.status !== "verfügbar" && (
                          <span style={{ color: "#a1a1aa", fontSize: 15 }}>
                            -
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        <div
          style={{
            marginTop: 33,
            color: "#a1a1aa",
            fontSize: 15,
            textAlign: "center",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Gewinne aus Mystery Boxen oder Lotto erscheinen hier.
          <br />
          <span style={{ color: "#e3ff64", fontWeight: 700, fontSize: 15.3 }}>
            Gratis-Bestellungen aus dem Inventar kosten <b>0 €</b>!
          </span>
        </div>
        {message && (
          <div
            style={{
              marginTop: 20,
              background: "#23262e",
              color: "#e3ff64",
              fontWeight: 700,
              borderRadius: 9,
              textAlign: "center",
              padding: "11px 0",
              fontFamily: "'Inter', sans-serif",
              fontSize: 16,
            }}
          >
            {message}
          </div>
        )}
      </div>
    );
  }
}
