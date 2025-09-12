// src/hooks/useRealtimeToasts.js
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";

// FCM optional – lade nur wenn vorhanden
let messagingApi = null;
try {
  const mod = await import("firebase/messaging");
  messagingApi = mod;
} catch (e) {
  // noop
}

export default function useRealtimeToasts({ enableTelegram = true } = {}) {
  const db = getFirestore();
  const [queue, setQueue] = useState([]);
  const lastSeen = useRef({});

  const pushToast = useCallback((text) => {
    if (!text) return;
    setQueue((q) => [...q, text]);
  }, []);

  const popToast = useCallback(() => {
    setQueue((q) => q.slice(1));
  }, []);

  // Optional: Telegram Relay
  const notifyTelegram = useCallback(
    async (text) => {
      if (!enableTelegram) return;
      try {
        await fetch("/send-telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId: "<YOUR_TELEGRAM_CHAT_ID>",
            text,
          }),
        });
      } catch (e) {
        // silent fail
      }
    },
    [enableTelegram]
  );

  // Chat (letzte Nachricht)
  useEffect(() => {
    const qMsg = query(collection(db, "messages"), orderBy("createdAt", "desc"), limit(1));
    const unsub = onSnapshot(qMsg, (snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type !== "added") return;
        if (lastSeen.current[ch.doc.id]) return;
        lastSeen.current[ch.doc.id] = true;
        const d = ch.doc.data();
        pushToast(d?.text ? `Neue Nachricht: ${d.text}` : "Neue Nachricht");
      });
    });
    return () => unsub();
  }, [db, pushToast]);

  // Orders (neu + Statuswechsel)
  useEffect(() => {
    const qOrders = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(5));
    const unsub = onSnapshot(qOrders, (snap) => {
      snap.docChanges().forEach((ch) => {
        const key = `order-${ch.doc.id}-${ch.type}`;
        if (lastSeen.current[key]) return;
        lastSeen.current[key] = true;
        const o = ch.doc.data();
        if (ch.type === "added") {
          pushToast(`🛒 Neue Bestellung: ${o?.productName ?? "Unbekannt"}`);
          notifyTelegram(`🛒 Neue Bestellung: ${o?.productName ?? "Unbekannt"} (${o?.price ?? "?"}€)`);
        } else if (ch.type === "modified") {
          pushToast(`ℹ️ Bestellstatus: ${o?.status ?? "aktualisiert"}`);
        }
      });
    });
    return () => unsub();
  }, [db, pushToast, notifyTelegram]);

  // Broadcasts (letzte)
  useEffect(() => {
    const qBc = query(collection(db, "broadcasts"), orderBy("createdAt", "desc"), limit(1));
    const unsub = onSnapshot(qBc, (snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type !== "added") return;
        if (lastSeen.current[ch.doc.id]) return;
        lastSeen.current[ch.doc.id] = true;
        const d = ch.doc.data();
        pushToast(d?.text ? `📢 ${d.text}` : "📢 Neue Broadcast-Nachricht");
      });
    });
    return () => unsub();
  }, [db, pushToast]);

  // FCM Foreground (optional)
  useEffect(() => {
    (async () => {
      if (!messagingApi) return;
      try {
        const { getMessaging, onMessage, isSupported } = messagingApi;
        if (!(await isSupported())) return;
        const messaging = getMessaging();
        onMessage(messaging, (payload) => {
          const title = payload?.notification?.title;
          const body = payload?.notification?.body;
          pushToast([title, body].filter(Boolean).join(" • ") || "🔔 Neue Benachrichtigung");
        });
      } catch (e) {
        // ignore
      }
    })();
  }, [pushToast]);

  return { toasts: queue, popToast };
}