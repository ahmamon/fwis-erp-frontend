import { T } from "./ui.jsx";

/**
 * Timing System Component - Shows 90-minute target with warnings
 */
export function TimingSystem({ totalMinutes, onAutoBalance }) {
  const TARGET = 90;
  const difference = totalMinutes - TARGET;
  const isExact = totalMinutes === TARGET;
  const isOver = totalMinutes > TARGET;
  const isUnder = totalMinutes < TARGET;

  return (
    <div
      style={{
        background: isExact ? "#d1fae5" : isOver ? "#fee2e2" : "#fef3c7",
        border: `2px solid ${isExact ? "#10b981" : isOver ? "#ef4444" : "#f59e0b"}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.ink600, marginBottom: 4 }}>Total Time</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: isExact ? "#065f46" : isOver ? "#991b1b" : "#92400e" }}>
            {totalMinutes} / {TARGET} min
          </div>
        </div>

        <div style={{ fontSize: 48, opacity: 0.3 }}>
          {isExact ? "✓" : isOver ? "⚠" : "⚠"}
        </div>
      </div>

      {isExact && (
        <div style={{ fontSize: 14, fontWeight: 600, color: "#065f46", display: "flex", alignItems: "center", gap: 8 }}>
          <span>✓</span> Exactly 90 minutes
        </div>
      )}

      {isUnder && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#92400e", marginBottom: 8 }}>
            {Math.abs(difference)} minutes remaining
          </div>
          <button
            onClick={onAutoBalance}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: 8,
              background: "#f59e0b",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Auto-Balance to 90 Minutes
          </button>
        </div>
      )}

      {isOver && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#991b1b", marginBottom: 8 }}>
            {Math.abs(difference)} minutes over
          </div>
          <button
            onClick={onAutoBalance}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: 8,
              background: "#ef4444",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Auto-Balance to 90 Minutes
          </button>
        </div>
      )}

      {!isExact && (
        <div style={{ fontSize: 11, color: T.ink600, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.line}` }}>
          Auto-balance will adjust flexible sections to reach exactly 90 minutes
        </div>
      )}
    </div>
  );
}
