import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send } from "lucide-react";

/**
 * Adapted NotificationPopup:
 * - Backward compatible default "modal" mode
 * - New "toast" mode for small bottom toasts
 * Props:
 *  - open (bool)
 *  - mode: "modal" | "toast"
 *  - message (string) used in toast mode
 *  - autoCloseMs (number) only for toast
 *  - onClose, onAction (callbacks)
 */
export default function NotificationPopup({
  open = true,
  mode = "modal",
  message,
  autoCloseMs = 3000,
  onClose,
  onAction,
}) {
  if (!open) return null;

  if (mode === "toast") {
    useEffect(() => {
      if (!autoCloseMs) return;
      const t = setTimeout(() => onClose && onClose(), autoCloseMs);
      return () => clearTimeout(t);
    }, [autoCloseMs, onClose]);

    return (
      <div
        style={{
          position: "fixed",
          left: "50%",
          bottom: 70,
          transform: "translateX(-50%)",
          background: "#1db954",
          color: "#fff",
          padding: "10px 14px",
          borderRadius: 10,
          fontSize: 14,
          zIndex: 3000,
          boxShadow: "0 4px 16px rgba(0,0,0,.25)",
          maxWidth: "90%",
          textAlign: "center",
        }}
        onClick={() => onClose && onClose()}
      >
        {message || "Benachrichtigung"}
      </div>
    );
  }

  // Original modal design (keine Änderung am Layout)
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
          inset: 0,
          background: "#0f172a",
          zIndex: 2800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
        onClick={onClose}
      >
        <motion.div
          key="card"
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 10, opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            width: "100%",
            maxWidth: 420,
            background: "#111827",
            borderRadius: 14,
            padding: 16,
            color: "#e5e7eb",
            boxShadow: "0 10px 30px rgba(0,0,0,.35)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              background: "linear-gradient(135deg,#bbf7d0,#a3e635)",
              width: 70,
              height: 70,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
              boxShadow: "0 1.5px 8px #a3e63544",
            }}
          >
            <Send size={35} style={{ color: "#23262e" }} />
          </div>

          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Benachrichtigung</h3>
            <p style={{ margin: "6px 0 0", fontSize: 14, opacity: 0.9 }}>
              {message || "Aktion erfolgreich ausgeführt."}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #374151",
                background: "#111827",
                color: "#e5e7eb",
                fontSize: 14,
              }}
            >
              Schließen
            </button>
            {onAction && (
              <button
                onClick={onAction}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "none",
                  background: "#22c55e",
                  color: "#0b0f14",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                Ausführen
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}