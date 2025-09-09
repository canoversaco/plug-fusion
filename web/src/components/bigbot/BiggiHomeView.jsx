import React, { useState, useEffect } from "react";
import {
  Wallet,
  ShoppingCart,
  Package,
  LogOut,
  Info,
  UserCog,
  Truck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import NotificationPopup from "./NotificationPopup";

const DEMO_BROADCASTS = [
  {
    id: 1,
    text: "ℹ️ Dies ist der reduzierte Modus für BigBot – Features je nach Rolle.",
  },
];

const ACTIONS_BASE = [
  {
    id: "menu",
    label: "Menü",
    icon: <ShoppingCart size={26} />,
    color: "#18181b",
    bg: "linear-gradient(133deg,#a3e635 85%,#38bdf855 100%)",
    action: "onGotoMenu",
  },
  {
    id: "orders",
    label: "Bestellungen",
    icon: <Package size={26} />,
    color: "#fff",
    bg: "linear-gradient(135deg,#38bdf8 85%,#a3e63533 100%)",
    action: "onGotoOrders",
  },
  {
    id: "info",
    label: "Info",
    icon: <Info size={24} />,
    color: "#fff",
    bg: "linear-gradient(135deg,#818cf8 75%,#38bdf877 100%)",
    action: "onGotoInfo",
  },
];

const ACTION_KURIER = {
  id: "kurier",
  label: "Kurier Panel",
  icon: <Truck size={24} />,
  color: "#fff",
  bg: "linear-gradient(122deg,#18181b 60%,#38bdf877 100%)",
  border: "2px solid #38bdf8",
  action: "onGotoKurier",
};

const ACTION_ADMIN = {
  id: "admin",
  label: "Admin Panel",
  icon: <UserCog size={24} />,
  color: "#fff",
  bg: "linear-gradient(122deg,#18181b 60%,#a3e63577 100%)",
  border: "2px solid #a3e635",
  action: "onGotoAdmin",
};

const ACTION_LOGOUT = {
  id: "logout",
  label: "Abmelden",
  icon: <LogOut size={25} />,
  color: "#fff",
  bg: "linear-gradient(133deg,#f87171 75%,#18181b 100%)",
  action: "onLogout",
};

export default function HomeView({
  user,
  onGotoMenu,
  onGotoOrders,
  onGotoAdmin,
  onGotoKurier,
  onGotoInfo,
  onLogout,
  onWalletClick,
}) {
  const [broadcasts, setBroadcasts] = useState(DEMO_BROADCASTS);
  const [notification, setNotification] = useState(null);

  const removeBroadcast = (id) =>
    setBroadcasts((prev) => prev.filter((b) => b.id !== id));

  // Action-Grid dynamisch bauen
  let actions = [...ACTIONS_BASE];
  const role = (user.role || user.rolle || "").toLowerCase();

  if (role.includes("admin")) actions.push(ACTION_KURIER, ACTION_ADMIN);
  else if (role.includes("kurier")) actions.push(ACTION_KURIER);
  actions.push(ACTION_LOGOUT);

  // Action-Handler zuweisen
  const handleAction = (action) => {
    switch (action) {
      case "onGotoMenu":
        return onGotoMenu;
      case "onGotoOrders":
        return onGotoOrders;
      case "onGotoAdmin":
        return onGotoAdmin;
      case "onGotoKurier":
        return onGotoKurier;
      case "onGotoInfo":
        return onGotoInfo;
      case "onLogout":
        return onLogout;
      default:
        return undefined;
    }
  };

  // Simple Telegram-Anbindung – optional
  useEffect(() => {
    if (user && !user.telegramChatId) {
      setNotification({
        message:
          "Willst du wichtige Infos direkt per Telegram bekommen?",
        actionText: "Telegram verbinden",
        onAction: () => {
          setNotification(null);
          const tgBotName = "PlugApp_bot";
          const url = `https://t.me/${tgBotName}?start=plug_${user.id}`;
          window.open(url, "_blank");
        },
      });
    }
  }, [user]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 35% 40%, #222931 63%, #191e24 100%)",
        fontFamily: "'Inter',sans-serif",
        padding: 0,
        margin: 0,
        overflow: "auto",
      }}
    >
      {/* Notification Popup */}
      {notification && (
        <div
          style={{
            position: "fixed",
            top: "14vh",
            left: 0,
            right: 0,
            zIndex: 2222,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div style={{ width: "100%", maxWidth: 350, pointerEvents: "all" }}>
            <NotificationPopup
              message={notification.message}
              actionText={notification.actionText}
              onAction={notification.onAction}
              onClose={() => setNotification(null)}
              style={{
                fontSize: 16,
                borderRadius: 16,
                boxShadow: "0 2px 22px #0007",
                padding: 20,
              }}
            />
          </div>
        </div>
      )}

      {/* Wallet oben rechts */}
      <div style={{ position: "fixed", right: 32, top: 32, zIndex: 80 }}>
        <button
          onClick={onWalletClick}
          style={{
            background: "#18181b",
            color: "#a3e635",
            border: "2px solid #23262e",
            borderRadius: "50%",
            padding: 13,
            fontWeight: 900,
            fontSize: 26,
            cursor: "pointer",
            boxShadow: "0 2px 12px #38bdf844, 0 2px 10px #0006",
            transition: "background 0.12s",
          }}
          title="Wallet öffnen"
        >
          <Wallet size={26} />
        </button>
      </div>

      {/* User Header */}
      <div
        style={{
          maxWidth: 630,
          margin: "0 auto",
          padding: "0 10px",
          paddingTop: 74,
          paddingBottom: 42,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 18,
            alignItems: "center",
            marginBottom: 15,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              background:
                "linear-gradient(135deg,#38bdf8cc 60%,#a3e63577 100%)",
              borderRadius: "50%",
              width: 56,
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 26,
              color: "#fff",
              boxShadow: "0 3px 17px #38bdf822",
              userSelect: "none",
            }}
          >
            {user.username?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div
              style={{
                fontSize: 19,
                fontWeight: 900,
                color: "#fff",
                letterSpacing: 1,
              }}
            >
              Willkommen, {user.username}
            </div>
            <div
              style={{
                color: "#a3e635",
                fontWeight: 700,
                fontSize: 15.5,
                marginTop: 2,
              }}
            >
              Guthaben:{" "}
              <span style={{ color: "#fff", fontWeight: 900 }}>
                {user.guthaben?.toFixed(2) ?? "0.00"} €
              </span>
            </div>
          </div>
        </div>

        {/* Broadcast-Karten animiert */}
        <AnimatePresence>
          {broadcasts.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ x: 60, opacity: 0, scale: 0.92 }}
              animate={{
                x: 0,
                opacity: 1,
                scale: 1,
                background: [
                  "linear-gradient(93deg,#38bdf8dd 65%,#a3e63544 100%)",
                  "linear-gradient(93deg,#a3e635dd 70%,#38bdf855 100%)",
                ],
              }}
              exit={{ x: 55, opacity: 0, scale: 0.85 }}
              transition={{
                duration: 0.35,
                type: "spring",
                background: {
                  repeat: Infinity,
                  duration: 4.4,
                  ease: "linear",
                },
              }}
              style={{
                borderRadius: 12,
                padding: "10px 15px",
                fontSize: 15.5,
                fontWeight: 700,
                marginBottom: 9,
                boxShadow: "0 1.5px 8px #23262e44",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: "#fff",
              }}
            >
              <span style={{ flex: 1 }}>{b.text}</span>
              <button
                onClick={() => removeBroadcast(b.id)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#fff",
                  fontSize: 19,
                  fontWeight: 800,
                  marginLeft: 15,
                  cursor: "pointer",
                  lineHeight: "1.3",
                  transition: "color 0.14s",
                  opacity: 0.84,
                }}
                aria-label="Schließen"
              >
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Grid-Layout für Aktionen */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 13,
            marginTop: 7,
          }}
        >
          {actions.map((a) =>
            a.animate ? (
              <motion.button
                key={a.id}
                onClick={handleAction(a.action)}
                whileHover={{ scale: 1.08, rotate: [0, -3, 3, 0] }}
                style={{
                  background: a.bg,
                  color: a.color,
                  border: a.border || "none",
                  borderRadius: 14,
                  fontWeight: 800,
                  fontSize: 15.5,
                  padding: "19px 0 11px 0",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 9,
                  transition: "background 0.12s, color 0.13s, box-shadow 0.13s",
                  minHeight: 74,
                  position: "relative",
                  userSelect: "none",
                }}
              >
                <div>{a.icon}</div>
                <div style={{ letterSpacing: 0.08 }}>{a.label}</div>
              </motion.button>
            ) : (
              <button
                key={a.id}
                onClick={handleAction(a.action)}
                style={{
                  background: a.bg,
                  color: a.color,
                  border: a.border || "none",
                  borderRadius: 14,
                  boxShadow: "0 2px 10px #0001",
                  fontWeight: 800,
                  fontSize: 15.5,
                  padding: "19px 0 11px 0",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 9,
                  transition: "background 0.12s, color 0.13s, box-shadow 0.13s",
                  minHeight: 74,
                  position: "relative",
                  userSelect: "none",
                }}
              >
                <div>{a.icon}</div>
                <div style={{ letterSpacing: 0.08 }}>{a.label}</div>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
