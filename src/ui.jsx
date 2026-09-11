export const T = {
  navy900: "#0B1F3A",
  navy800: "#122A4C",
  navy700: "#1B3A63",
  gold500: "#C6A15B",
  gold600: "#B08A3E",
  copper500: "#A85C32",
  cream50: "#FAF8F3",
  cream100: "#F1ECE0",
  ink900: "#1C2733",
  ink600: "#5B6472",
  line: "#E4DFD1",
};

export const ROLE_LABELS = { teacher: "Teacher", hod: "HOD", supervisor: "Academic Supervisor", admin: "System Admin" };

export const STATUS_META = {
  draft: { label: "Draft", bg: "#EFEDE7", fg: "#5B5A52" },
  submitted: { label: "Submitted", bg: "#E4EBF5", fg: "#2C4E7C" },
  returned: { label: "Returned", bg: "#F7E7DE", fg: "#93401A" },
  hod_approved: { label: "HOD approved", bg: "#EFE7F5", fg: "#5C3A82" },
  completed: { label: "Completed", bg: "#E4EFE2", fg: "#33622D" },
};

export function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.draft;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: m.bg, color: m.fg, fontSize: 12.5, fontWeight: 600,
      padding: "4px 10px", borderRadius: 999,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.fg }} />
      {m.label}
    </span>
  );
}

export function FieldLabel({ children, required }) {
  return (
    <label style={{
      display: "block", fontSize: 12.5, fontWeight: 600, color: T.ink600,
      textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6,
    }}>
      {children}{required && <span style={{ color: T.copper500 }}> *</span>}
    </label>
  );
}

export function TextField({ value, onChange, placeholder, rows = 3, disabled }) {
  return (
    <textarea
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      style={{
        width: "100%", border: `1px solid ${T.line}`, borderRadius: 10,
        padding: "10px 12px", fontSize: 14.5, color: T.ink900, fontFamily: "inherit",
        background: disabled ? T.cream100 : "#fff", resize: "vertical", lineHeight: 1.5,
        boxSizing: "border-box",
      }}
    />
  );
}

export function Button({ children, onClick, variant = "primary", disabled, style }) {
  const base = {
    border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13.5,
    fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1,
  };
  const variants = {
    primary: { background: T.navy900, color: "#fff" },
    outline: { background: "#fff", color: T.ink900, border: `1px solid ${T.line}` },
    danger: { background: T.copper500, color: "#fff" },
    success: { background: "#33622D", color: "#fff" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div style={{
      background: "#F7E7DE", color: "#93401A", border: "1px solid #E8C7B0",
      borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14,
    }}>
      {message}
    </div>
  );
}

export function Loading({ label = "Loading..." }) {
  return <div style={{ padding: 40, textAlign: "center", color: T.ink600, fontSize: 13.5 }}>{label}</div>;
}

export function SectionCard({ title, right, children }) {
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, background: "#fff", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.navy900 }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}
