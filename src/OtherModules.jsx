import { useState } from "react";
import { api } from "./api.js";
import { T } from "./ui.jsx";

export function ProfileView({ currentUser, onUpdated }) {
  const [phone, setPhone] = useState(currentUser.phone || "");
  const [bio, setBio] = useState(currentUser.bio || "");
  const [saved, setSaved] = useState(false);

  async function save() {
    const updated = await api.patch("/api/users/me", { phone, bio });
    onUpdated(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: 700, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: 22, color: T.navy900, margin: "0 0 18px" }}>My profile</h1>
      <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 18, background: "#fff" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{currentUser.name}</div>
        <div style={{ fontSize: 12.5, color: T.ink600, marginBottom: 16 }}>{currentUser.email}</div>
        <label style={{ fontSize: 12, fontWeight: 600, color: T.ink600, display: "block", marginBottom: 4 }}>Phone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: "100%", padding: 8, border: `1px solid ${T.line}`, borderRadius: 8, marginBottom: 12, boxSizing: "border-box" }} />
        <label style={{ fontSize: 12, fontWeight: 600, color: T.ink600, display: "block", marginBottom: 4 }}>Bio</label>
        <input value={bio} onChange={(e) => setBio(e.target.value)} style={{ width: "100%", padding: 8, border: `1px solid ${T.line}`, borderRadius: 8, marginBottom: 14, boxSizing: "border-box" }} />
        <button onClick={save} style={{ border: "none", background: T.navy900, color: "#fff", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Save
        </button>
        {saved && <span style={{ marginInlineStart: 10, color: "#33622D", fontSize: 12.5, fontWeight: 600 }}>Saved</span>}
      </div>
    </div>
  );
}