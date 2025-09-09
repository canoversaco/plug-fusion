import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send } from "lucide-react";

export default function NotificationPopup({ open = true, onClose, onAction }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.93 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          position: "fixed",
          zIndex: 9999,
          inset: 0,
          background: "rgba(20,22,27,0.93)",
          backdropFilter: "blur(2.5px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <motion.div
          key="popup"
          initial={{ scale: 0.93, opacity: 0, y: 60 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 60 }}
          transition={{ type: "spring", duration: 0.33 }}
          style={{
            background: "linear-gradient(111deg, #222931 85%, #38bdf855 100%)",
            borderRadius: 22,
            boxShadow: "0 7px 40px #38bdf844",
            width: "92vw",
            maxWidth: 400,
            padding: "28px 20px 22px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
            color: "#fff",
            textAlign: "center",
          }}
        >
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 17,
              right: 17,
              background: "none",
              border: "none",
              fontSize: 28,
              color: "#a3e635",
              fontWeight: 900,
              cursor: "pointer",
              opacity: 0.77,
            }}
            aria-label="Schließen"
          >
            ×
          </button>
          <div
            style={{
              background:
                "linear-gradient(135deg,#38bdf8 65%,#a3e635 120%)",
              borderRadius: "50%",
              width: 62,
              height: 62,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 17,
              boxShadow: "0 1.5px 8px #a3e63544",
            }}
          >
            <Send size={35} style={{ color: "#23262e" }} />
          </div>
          <div style={{ fontWeight: 900, fontSize: 21, marginBottom: 11, color: "#a3e635" }}>
            Telegram Benachrichtigungen aktivieren
          </div>
          <div style={{ fontSize: 15.5, color: "#e6ffe6", marginBottom: 22 }}>
            Aktiviere Push-Benachrichtigungen über Telegram, um keine wichtigen Infos, Statusänderungen oder Angebote mehr zu verpassen. <br /><br />
            <span style={{ color: "#fff", fontWeight: 700 }}>
              Wir empfehlen das dringend für maximale Sicherheit &amp; Komfort!
            </span>
          </div>
          <button
            onClick={onAction}
            style={{
              background: "linear-gradient(90deg,#38bdf8 60%,#a3e635 120%)",
              color: "#23262e",
              fontWeight: 900,
              fontSize: 16,
              border: "none",
              borderRadius: 12,
              padding: "14px 0",
              width: "100%",
              marginBottom: 5,
              marginTop: 3,
              boxShadow: "0 1.5px 10px #a3e63529",
              cursor: "pointer",
            }}
          >
            Telegram verbinden
          </button>
          <div style={{ fontSize: 12.5, color: "#38bdf8", marginTop: 8 }}>
            Du kannst diese Erinnerung später in den Einstellungen deaktivieren.
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
