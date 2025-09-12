import React, { useEffect, useRef } from "react";

// Liste der Farben für Flash/Animation
const COLORS = [
  "#facc15", // Gelb
  "#38bdf8", // Blau
  "#a3e635", // Grün
  "#f87171", // Rot
  "#f472b6", // Pink
];

export default function Broadcasts({ broadcasts = [], onClose }) {
  if (!broadcasts.length) return null;

  return (
    <div style={{ marginBottom: 25 }}>
      {broadcasts.map((bc, idx) => (
        <AnimatedBroadcast
          key={bc.id || idx}
          text={bc.text}
          colorIndex={idx % COLORS.length}
          onClose={() => onClose && onClose(bc.id)}
        />
      ))}
    </div>
  );
}

// Einzelner Broadcast mit Farb-Animation
function AnimatedBroadcast({ text, colorIndex, onClose }) {
  const ref = useRef();

  useEffect(() => {
    // Setze Animation auf das Element (nur einmal)
    if (ref.current) {
      ref.current.style.animation = `flash-colors 2.5s linear infinite`;
      ref.current.style.setProperty("--flash-color-1", COLORS[colorIndex]);
      ref.current.style.setProperty(
        "--flash-color-2",
        COLORS[(colorIndex + 1) % COLORS.length]
      );
      ref.current.style.setProperty(
        "--flash-color-3",
        COLORS[(colorIndex + 2) % COLORS.length]
      );
    }
  }, [colorIndex]);

  return (
    <div
      ref={ref}
      style={{
        background: "var(--flash-color-1)",
        color: "#18181b",
        padding: 15,
        borderRadius: 10,
        fontWeight: 700,
        maxWidth: 480,
        margin: "0 auto",
        marginBottom: 10,
        position: "relative",
        transition: "background 0.7s",
        animationName: "flash-colors",
        animationDuration: "2.5s",
        animationIterationCount: "infinite",
        animationTimingFunction: "linear",
      }}
    >
      {text}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          right: 12,
          top: 9,
          background: "none",
          border: "none",
          color: "#18181b",
          fontWeight: 900,
          fontSize: 22,
          cursor: "pointer",
        }}
      >
        ×
      </button>
      {/* Animation CSS */}
      <style>{`
        @keyframes flash-colors {
          0%   { background: var(--flash-color-1); }
          33%  { background: var(--flash-color-2); }
          66%  { background: var(--flash-color-3); }
          100% { background: var(--flash-color-1); }
        }
      `}</style>
    </div>
  );
}
