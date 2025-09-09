import React from "react";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import images from "./images/images";

// sendTelegramNotification ist global via window verfügbar (siehe unten!)
function notifyTelegram(user, text) {
  if (window.sendTelegramNotification && user?.telegramChatId) {
    window.sendTelegramNotification(user, text);
  }
}

// --- NEU: Bewertungs-Popup als großes Fullscreen-Modal ---
function BewertungPopup({ onBewerten, onClose }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.77)",
        zIndex: 20000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 18px",
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 370,
          background: "linear-gradient(115deg,#a3e635 70%,#38bdf8 110%)",
          borderRadius: 19,
          boxShadow: "0 6px 36px #a3e63555, 0 2px 18px #38bdf844",
          padding: "33px 20px 25px 20px",
          textAlign: "center",
          color: "#18181b",
          fontFamily: "inherit",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 10 }}>🌟</div>
        <h2 style={{ fontWeight: 900, fontSize: 22, marginBottom: 9 }}>
          Bestellung bewerten
        </h2>
        <div style={{ fontSize: 17, marginBottom: 17 }}>
          Du hast eine abgeschlossene Bestellung,<br /> die noch keine Bewertung hat.<br />
          Bitte bewerte sie für ein besseres Erlebnis!
        </div>
        <button
          onClick={onBewerten}
          style={{
            marginTop: 5,
            background: "#23262e",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            padding: "12px 0",
            width: "100%",
            fontWeight: 800,
            fontSize: 17,
            cursor: "pointer",
            letterSpacing: 0.3,
            boxShadow: "0 2px 13px #23262e25",
          }}
        >
          Jetzt bewerten
        </button>
        <button
          onClick={onClose}
          style={{
            marginTop: 17,
            background: "none",
            border: 0,
            color: "#23262e",
            fontWeight: 700,
            fontSize: 16,
            cursor: "pointer",
            opacity: 0.64,
            textDecoration: "underline",
          }}
        >
          Später
        </button>
      </div>
    </div>
  );
}

export default class KundeView extends React.Component {
  state = {
    rateModal: null,
    ratings: { service: 0, wartezeit: 0, qualitaet: 0 },
    error: "",
    changeConfirmLoading: null,
    showBewertungPopup: false,
    pendingOrderId: null,
  };

  componentDidMount() {
    this.checkOpenBewertung(this.props, true);
    this.checkAndNotifyNewOrder(this.props);
  }
  componentDidUpdate(prevProps) {
    if (
      prevProps.orders !== this.props.orders ||
      prevProps.user !== this.props.user
    ) {
      this.checkOpenBewertung(this.props, false);
      this.checkAndNotifyNewOrder(this.props);
    }
  }

  // --- Notify Telegram bei neuer Bestellung ---
  checkAndNotifyNewOrder = (props) => {
    const { user, orders } = props;
    if (!user || !orders || !Array.isArray(orders)) return;

    // Du kannst "offen", "bestellt" oder den Status anpassen
    const newOrders = orders.filter(
      o =>
        o.kunde === user.username &&
        (o.status === "offen" || o.status === "bestellt" || o.status === "neu" || !o.status)
    );
    if (newOrders.length === 0) return;

    newOrders.forEach(order => {
      // Einzigartiger Flag für jede Order
      const flagKey = `orderNotified_${order.id}`;
      if (!sessionStorage.getItem(flagKey)) {
        // Benachrichtigung an dich (Admin/Owner): Passe user hier ggf. an
        // Wenn du immer an den gleichen Telegram-Account willst, ersetze "user" mit deinem Admin-Objekt!
        notifyTelegram(
          user,
          `🆕 Neue Bestellung von ${user.username || "Unbekannt"}\nID: ${order.id}\nWarenkorb: ${
            (order.warenkorb || [])
              .map(w =>
                (this.props.produkte?.find(pr => pr.id === w.produktId)?.name || "Produkt") +
                " x" + w.menge
              )
              .join(", ")
          }\nGesamtpreis: ${(order.endpreis ?? 0).toFixed(2)} €`
        );
        sessionStorage.setItem(flagKey, "1");
      }
    });
  };

  // --- Bewertungs-Popup-Logik ---
  checkOpenBewertung(props, forceShow) {
    const { user, orders } = props;
    if (!user || !orders) return;

    const offeneOrder = orders?.find(
      (o) =>
        o.kunde === user.username &&
        o.status === "abgeschlossen" &&
        !o.rating
    );

    if (offeneOrder) {
      const flagKey = `bewertungPopup_${user.username}_${offeneOrder.id}`;
      const alreadyShown = sessionStorage.getItem(flagKey);

      if (!alreadyShown || forceShow) {
        this.setState({
          showBewertungPopup: true,
          pendingOrderId: offeneOrder.id,
        });
        sessionStorage.setItem(flagKey, "1");
      } else {
        this.setState({
          showBewertungPopup: false,
          pendingOrderId: offeneOrder.id,
        });
      }
    } else {
      this.setState({
        showBewertungPopup: false,
        pendingOrderId: null,
      });
    }
  }

  openRating(orderId) {
    this.setState({
      rateModal: orderId,
      ratings: { service: 5, wartezeit: 5, qualitaet: 5 },
      error: "",
      showBewertungPopup: false,
    });
  }

  handleDismissPopup() {
    this.setState({
      showBewertungPopup: false,
    });
  }

  async handleRate(orderId) {
    const { ratings } = this.state;
    if (
      !ratings.service ||
      !ratings.wartezeit ||
      !ratings.qualitaet ||
      ratings.service < 1 ||
      ratings.service > 5 ||
      ratings.wartezeit < 1 ||
      ratings.wartezeit > 5 ||
      ratings.qualitaet < 1 ||
      ratings.qualitaet > 5
    ) {
      this.setState({ error: "Alle Felder müssen mit 1-5 ausgefüllt werden." });
      return;
    }
    try {
      await updateDoc(doc(db, "orders", orderId), {
        rating: { ...ratings, ts: Date.now() },
      });
      this.setState({ rateModal: null, ratings: {}, error: "" });
      alert("Danke für deine Bewertung!");
    } catch (err) {
      this.setState({ error: "Fehler beim Speichern der Bewertung." });
    }
  }

  // Annahme der Änderung
  async handleAcceptChange(order) {
    this.setState({ changeConfirmLoading: order.id });
    const { changeRequest = {} } = order;
    try {
      let newWarenkorb = changeRequest.newWarenkorb || order.warenkorb;
      let endpreis = 0;
      if (Array.isArray(newWarenkorb) && this.props.produkte) {
        endpreis = newWarenkorb.reduce((sum, item) => {
          const p = this.props.produkte.find((pr) => pr.id === item.produktId);
          return sum + (p?.preis || 0) * Number(item.menge);
        }, 0);
      }
      await updateDoc(doc(db, "orders", order.id), {
        warenkorb: newWarenkorb,
        endpreis,
        changeRequest: null,
      });

      const { user } = this.props;
      notifyTelegram(
        user,
        "✅ Du hast den Änderungsvorschlag deines Kuriers angenommen. Die Bestellung wurde aktualisiert."
      );

      alert("Änderung übernommen.");
    } catch (e) {
      alert("Fehler beim Übernehmen.");
    }
    this.setState({ changeConfirmLoading: null });
  }

  async handleDeclineChange(order) {
    this.setState({ changeConfirmLoading: order.id });
    try {
      await updateDoc(doc(db, "orders", order.id), {
        changeRequest: null,
        status: "storniert",
      });

      const { user } = this.props;
      notifyTelegram(
        user,
        "❌ Du hast den Änderungsvorschlag deines Kuriers abgelehnt. Die Bestellung wurde storniert."
      );

      alert("Änderung wurde abgelehnt. Die Bestellung ist jetzt storniert.");
    } catch (e) {
      alert("Fehler beim Ablehnen.");
    }
    this.setState({ changeConfirmLoading: null });
  }

  renderTreffpunkt(treffpunkt) {
    if (
      Array.isArray(treffpunkt) &&
      treffpunkt.length === 2 &&
      typeof treffpunkt[0] === "number" &&
      typeof treffpunkt[1] === "number" &&
      (treffpunkt[0] !== 0 || treffpunkt[1] !== 0)
    ) {
      return (
        <>
          <a
            href={`https://maps.google.com/?q=${treffpunkt[0]},${treffpunkt[1]}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#38bdf8",
              textDecoration: "underline",
              fontWeight: 700,
            }}
          >
            Karte öffnen
          </a>
          <span style={{ color: "#52525b", marginLeft: 7, fontSize: 13 }}>
            ({treffpunkt[0].toFixed(5)}, {treffpunkt[1].toFixed(5)})
          </span>
        </>
      );
    }
    return (
      <span style={{ color: "#f87171", fontWeight: 600 }}>
        Noch nicht festgelegt
      </span>
    );
  }

  renderEta(etaTimestamp) {
    const diff = Math.round((etaTimestamp - Date.now()) / 60000);
    return diff > 1 ? diff : 1;
  }

  renderChangeRequest(order) {
    const { produkte } = this.props;
    const { changeRequest } = order;
    if (!changeRequest) return null;

    const changed = Array.isArray(changeRequest.changedItems)
      ? changeRequest.changedItems
      : [];

    const newWarenkorb = Array.isArray(changeRequest.newWarenkorb)
      ? changeRequest.newWarenkorb
      : order.warenkorb;

    return (
      <div
        style={{
          background: "#18181b",
          border: "2px dashed #fbbf24",
          borderRadius: 14,
          margin: "15px 0 18px 0",
          padding: 14,
          boxShadow: "0 4px 28px #a3e63522",
        }}
      >
        <div style={{ color: "#fbbf24", fontWeight: 800, fontSize: 17 }}>
          🚧 Änderungsvorschlag von Kurier:
        </div>
        {changeRequest.text && (
          <div
            style={{
              color: "#eab308",
              margin: "7px 0",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            {changeRequest.text}
          </div>
        )}
        {changed.length > 0 && (
          <div
            style={{
              color: "#fbbf24",
              margin: "8px 0 5px 0",
              fontWeight: 600,
            }}
          >
            Änderungen:
            <ul style={{ color: "#fff", marginTop: 4 }}>
              {changed.map((c, idx) => {
                const p = produkte.find((pr) => pr.id === c.produktId);
                return (
                  <li key={idx}>
                    <b>{p?.name || "?"}</b>{" "}
                    {c.oldMenge !== c.newMenge
                      ? `Menge: ${c.oldMenge} → ${c.newMenge}`
                      : c.removed
                      ? `ENTFERNT`
                      : null}{" "}
                    {c.note && (
                      <span style={{ color: "#fbbf24", fontWeight: 600 }}>
                        ({c.note})
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div
          style={{
            color: "#fbbf24",
            fontWeight: 600,
            marginTop: 8,
            marginBottom: 3,
          }}
        >
          Neuer Warenkorb (nach Änderung):
        </div>
        <ul style={{ paddingLeft: 16, margin: "5px 0 0 0" }}>
          {newWarenkorb.map((item, idx) => {
            const p = produkte.find((pr) => pr.id === item.produktId);
            return (
              <li key={idx} style={{ marginBottom: 2 }}>
                <img
                  src={images[p?.bildName] || images.defaultBild}
                  alt={p?.name}
                  style={{
                    width: 22,
                    height: 22,
                    objectFit: "cover",
                    borderRadius: 6,
                    marginRight: 8,
                    verticalAlign: "middle",
                  }}
                />
                {p?.name || "?"} × {item.menge}
              </li>
            );
          })}
        </ul>

        <div style={{ marginTop: 15 }}>
          <button
            onClick={() => this.handleAcceptChange(order)}
            style={{
              background: "#a3e635",
              color: "#18181b",
              border: 0,
              borderRadius: 8,
              padding: "9px 24px",
              fontWeight: 800,
              fontSize: 17,
              cursor: "pointer",
              marginRight: 7,
              opacity: this.state.changeConfirmLoading === order.id ? 0.5 : 1,
            }}
            disabled={this.state.changeConfirmLoading === order.id}
          >
            ✅ Änderung übernehmen
          </button>
          <button
            onClick={() => this.handleDeclineChange(order)}
            style={{
              background: "#f87171",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              padding: "9px 22px",
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
              opacity: this.state.changeConfirmLoading === order.id ? 0.5 : 1,
            }}
            disabled={this.state.changeConfirmLoading === order.id}
          >
            ❌ Ablehnen
          </button>
        </div>
      </div>
    );
  }

  render() {
    const { user, orders, produkte, onGoBack, onChat } = this.props;
    const {
      rateModal,
      ratings,
      error,
      showBewertungPopup,
      pendingOrderId,
    } = this.state;
    const eigeneBestellungen = orders
      .filter((o) => o.kunde === user.username)
      .sort((a, b) => b.ts - a.ts);

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#18181b",
          color: "#fff",
          fontFamily: "'Inter',sans-serif",
          padding: 26,
        }}
      >
        {/* Bewertungs-Popup (über alles, bei offener Bewertung) */}
        {showBewertungPopup && pendingOrderId && (
          <BewertungPopup
            onBewerten={() => this.openRating(pendingOrderId)}
            onClose={() => this.handleDismissPopup()}
          />
        )}
        <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 17 }}>
          📦 Meine Bestellungen
        </h2>
        <button
          onClick={onGoBack}
          style={{
            marginBottom: 23,
            background: "#23262e",
            color: "#fff",
            borderRadius: 8,
            border: 0,
            padding: "10px 22px",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ⬅️ Zurück
        </button>
        {eigeneBestellungen.length === 0 && (
          <div style={{ color: "#a1a1aa" }}>
            Du hast noch keine Bestellungen.
          </div>
        )}
        <div>
          {eigeneBestellungen.map((order) => (
            <div
              key={order.id}
              style={{
                background: "#23262e",
                borderRadius: 13,
                marginBottom: 23,
                padding: 18,
                boxShadow: "0 2px 8px #00000018",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 18 }}>
                Status:{" "}
                <span
                  style={{
                    color:
                      order.status === "abgeschlossen"
                        ? "#22c55e"
                        : order.status === "storniert"
                        ? "#f87171"
                        : "#fff",
                  }}
                >
                  {order.status || "?"}
                </span>
              </div>

              {/* Änderungsvorschlag von Kurier */}
              {order.changeRequest && this.renderChangeRequest(order)}

              {/* ETA-Anzeige, falls unterwegs */}
              {order.status === "unterwegs" &&
                order.eta &&
                order.eta > Date.now() && (
                  <div
                    style={{
                      background: "linear-gradient(90deg,#a3e63555,#38bdf855)",
                      color: "#0e820e",
                      borderRadius: 9,
                      padding: "7px 14px",
                      fontWeight: 800,
                      fontSize: 17,
                      margin: "9px 0 12px 0",
                      display: "inline-block",
                      boxShadow: "0 2px 12px #38bdf822",
                    }}
                  >
                    ⏳ ETA: Ankunft in ca.{" "}
                    <b>{this.renderEta(order.eta)}</b> Minuten 🛵
                  </div>
                )}

              <div style={{ marginBottom: 6 }}>
                Bestellt am:{" "}
                {order.ts ? new Date(order.ts).toLocaleString() : "-"}
              </div>
              <ul style={{ paddingLeft: 16, marginBottom: 8 }}>
                {order.warenkorb &&
                  order.warenkorb.map((item, idx) => {
                    const p = produkte.find((pr) => pr.id === item.produktId);
                    return (
                      <li key={idx} style={{ marginBottom: 2 }}>
                        <img
                          src={images[p?.bildName] || images.defaultBild}
                          alt={p?.name}
                          style={{
                            width: 28,
                            height: 28,
                            objectFit: "cover",
                            borderRadius: 6,
                            marginRight: 8,
                            verticalAlign: "middle",
                          }}
                        />
                        {p?.name || "?"} × {item.menge} (
                        {(p?.preis * item.menge).toFixed(2)} €)
                      </li>
                    );
                  })}
              </ul>
              <div style={{ fontWeight: 700 }}>
                Gesamtpreis: {order.endpreis?.toFixed(2) ?? "-"} €
              </div>
              <div>Treffpunkt: {this.renderTreffpunkt(order.treffpunkt)}</div>
              <div>
                Zahlungsart: {order.zahlung}{" "}
                {order.kryptoWaehrung ? `(${order.kryptoWaehrung})` : ""}
              </div>
              <div style={{ marginTop: 7, marginBottom: 4 }}>
                Notiz:{" "}
                <span style={{ color: "#a1a1aa" }}>
                  {order.notiz || "—"}
                </span>
              </div>
              <button
                style={{
                  marginRight: 10,
                  background: "#38bdf8",
                  color: "#18181b",
                  border: 0,
                  borderRadius: 8,
                  padding: "7px 22px",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                }}
                onClick={() => onChat(order)}
              >
                💬 Chat zur Bestellung
              </button>
              {/* Bewertung abgeben */}
              {order.status === "abgeschlossen" && !order.rating && (
                <button
                  onClick={() => this.openRating(order.id)}
                  style={{
                    background: "#a3e635",
                    color: "#18181b",
                    border: 0,
                    borderRadius: 8,
                    padding: "7px 22px",
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: "pointer",
                  }}
                >
                  🌟 Bewertung abgeben
                </button>
              )}
              {/* Bewertung anzeigen */}
              {order.rating && (
                <div style={{ marginTop: 7, color: "#a3e635" }}>
                  ⭐ Service: {order.rating.service} | Wartezeit:{" "}
                  {order.rating.wartezeit} | Qualität: {order.rating.qualitaet}
                </div>
              )}
            </div>
          ))}
        </div>
        {/* Bewertungs-Modal */}
        {rateModal && (
          <div
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              width: "100vw",
              height: "100vh",
              background: "#0009",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1111,
            }}
            onClick={() => this.setState({ rateModal: null })}
          >
            <div
              style={{
                background: "#23262e",
                borderRadius: 18,
                minWidth: 320,
                padding: 30,
                color: "#fff",
                fontFamily: "inherit",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Bewerte deine Bestellung</h3>
              <div>
                <b>Service:</b>{" "}
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={ratings.service}
                  onChange={(e) =>
                    this.setState({
                      ratings: { ...ratings, service: Number(e.target.value) },
                    })
                  }
                  style={{ width: 44 }}
                />
                <span style={{ color: "#a1a1aa" }}> (1-5)</span>
              </div>
              <div>
                <b>Wartezeit:</b>{" "}
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={ratings.wartezeit}
                  onChange={(e) =>
                    this.setState({
                      ratings: {
                        ...ratings,
                        wartezeit: Number(e.target.value),
                      },
                    })
                  }
                  style={{ width: 44 }}
                />
                <span style={{ color: "#a1a1aa" }}> (1-5)</span>
              </div>
              <div>
                <b>Qualität:</b>{" "}
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={ratings.qualitaet}
                  onChange={(e) =>
                    this.setState({
                      ratings: {
                        ...ratings,
                        qualitaet: Number(e.target.value),
                      },
                    })
                  }
                  style={{ width: 44 }}
                />
                <span style={{ color: "#a1a1aa" }}> (1-5)</span>
              </div>
              <button
                style={{
                  marginTop: 17,
                  background: "#a3e635",
                  color: "#18181b",
                  border: 0,
                  borderRadius: 8,
                  padding: "8px 22px",
                  fontWeight: 800,
                  fontSize: 17,
                  cursor: "pointer",
                }}
                onClick={() => this.handleRate(rateModal)}
              >
                Bewertung senden
              </button>
              <button
                style={{
                  marginTop: 9,
                  marginLeft: 8,
                  background: "#23262e",
                  color: "#fff",
                  border: 0,
                  borderRadius: 8,
                  padding: "8px 22px",
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: "pointer",
                }}
                onClick={() => this.setState({ rateModal: null })}
              >
                Abbrechen
              </button>
              <div style={{ color: "#f87171", marginTop: 10 }}>{error}</div>
            </div>
          </div>
        )}
      </div>
    );
  }
}
