// src/components/ChatWindow.js
import React from "react";
import { db } from "../firebase";
import { doc, updateDoc, arrayUnion, onSnapshot } from "firebase/firestore";

export default class ChatWindow extends React.Component {
  state = {
    input: "",
    chat: [],
    unsub: null,
    loading: true,
  };

  componentDidMount() {
    const { order } = this.props;
    if (order && order.id) {
      const unsub = onSnapshot(doc(db, "orders", order.id), (snap) => {
        const data = snap.data();
        this.setState({ chat: data?.chat || [], loading: false });
      });
      this.setState({ unsub });
    }
  }

  componentWillUnmount() {
    if (this.state.unsub) this.state.unsub();
  }

 handleSend = async () => {
  const { order, user, onSendMessage } = this.props;
  const { input } = this.state;
  if (!input.trim()) return;
  await updateDoc(doc(db, "orders", order.id), {
    chat: arrayUnion({
      user: user.username,
      text: input, 
      ts: Date.now(),
    }),
  });

  // <-- NEU: Notification auslösen! (WICHTIG)
  if (typeof onSendMessage === "function") {
    console.log("[ChatWindow] onSendMessage triggered"); // <--- WICHTIGER LOG!
    await onSendMessage(order.id, user.id);
  }

  this.setState({ input: "" });
};

  render() {
    const { user, onClose } = this.props;
    const { chat, input, loading } = this.state;

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#18181b",
          color: "#fff",
          fontFamily: "'Inter', sans-serif",
          padding: 30,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 17 }}>
          💬 Chat zu Bestellung
        </h2>
        <button
          style={{
            background: "#23262e",
            color: "#fff",
            borderRadius: 8,
            border: 0,
            padding: "10px 22px",
            fontSize: 17,
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: 17,
          }}
          onClick={onClose}
        >
          ⬅️ Zurück
        </button>
        <div
          style={{
            background: "#23262e",
            padding: 18,
            borderRadius: 10,
            minHeight: 160,
            maxHeight: 300,
            overflowY: "auto",
            marginBottom: 17,
          }}
        >
          {loading ? (
            <div style={{ color: "#a1a1aa" }}>Lade Nachrichten...</div>
          ) : chat.length === 0 ? (
            <div style={{ color: "#a1a1aa" }}>Keine Nachrichten vorhanden.</div>
          ) : (
            chat
              .sort((a, b) => a.ts - b.ts)
              .map((msg, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: 9,
                    textAlign: msg.user === user.username ? "right" : "left",
                    color: msg.user === user.username ? "#a3e635" : "#fff",
                  }}
                >
                  <b>{msg.user}:</b> {msg.text}
                  <span
                    style={{
                      color: "#666",
                      fontSize: 11,
                      marginLeft: 8,
                      fontWeight: 400,
                    }}
                  >
                    {msg.ts ? new Date(msg.ts).toLocaleTimeString() : ""}
                  </span>
                </div>
              ))
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={(e) => this.setState({ input: e.target.value })}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 7,
              border: 0,
              background: "#18181b",
              color: "#fff",
              fontSize: 16,
            }}
            placeholder="Nachricht eingeben…"
            onKeyDown={(e) => {
              if (e.key === "Enter") this.handleSend();
            }}
          />
          <button
            onClick={this.handleSend}
            style={{
              background: "#a3e635",
              color: "#18181b",
              fontWeight: 900,
              borderRadius: 7,
              border: 0,
              padding: "12px 18px",
              fontSize: 17,
              cursor: "pointer",
            }}
          >
            Senden
          </button>
        </div>
      </div>
    );
  }
}
