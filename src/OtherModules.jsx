import { useEffect, useState } from "react";
import { api } from "./api.js";
import { T, Loading, ErrorBanner } from "./ui.jsx";

function GenericList({ title, note, fetchPath, renderRow }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(fetchPath).then(setItems).catch((e) => setError(e.message));
  }, [fetchPath]);

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: 22, color: T.navy900, margin: "0 0 6px" }}>{title}</h1>
      {note && <p style={{ fontSize: 12.5, color: T.ink600, margin: "0 0 18px" }}>{note}</p>}
      <ErrorBanner message={error} />
      {!items && !error && <Loading />}
      {items && items.length === 0 && <p style={{ fontSize: 13.5, color: T.ink600 }}>Nothing here yet.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items && items.map(renderRow)}
      </div>
    </div>
  );
}

function Row({ children }) {
  return <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 14, background: "#fff" }}>{children}</div>;
}

export function LessonsList() {
  return (
    <GenericList
      title="Lesson preparation" fetchPath="/api/lessons"
      note="Live from your database — full editing here comes in a follow-up round."
      renderRow={(l) => (
        <Row key={l.id}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{l.teacher?.name} — {l.subject}, {l.grade}</div>
          <div style={{ fontSize: 12, color: T.ink600 }}>{l.term}, {l.week} · {l.status}</div>
        </Row>
      )}
    />
  );
}

export function CurriculumList() {
  return (
    <GenericList
      title="Curriculum mapping" fetchPath="/api/curriculum"
      note="Live planned vs. achieved coverage."
      renderRow={(u) => (
        <Row key={u.id}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{u.unit}</div>
          <div style={{ fontSize: 12, color: T.ink600 }}>{u.subject} · {u.grade} — Planned {u.plannedPct}% / Achieved {u.achievedPct}%</div>
        </Row>
      )}
    />
  );
}

export function StrategiesList() {
  return (
    <GenericList
      title="Teaching strategies library" fetchPath="/api/strategies"
      renderRow={(s) => (
        <Row key={s.id}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.name}</div>
          <div style={{ fontSize: 12, color: T.ink600 }}>{s.category} — {s.description}</div>
        </Row>
      )}
    />
  );
}

export function ResourcesList() {
  return (
    <GenericList
      title="Resources library" fetchPath="/api/resources"
      renderRow={(r) => (
        <Row key={r.id}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.name}</div>
          <div style={{ fontSize: 12, color: T.ink600 }}>{r.category} · {r.subject} · {r.grade} · v{r.versions?.length || 1}</div>
        </Row>
      )}
    />
  );
}

export function PDList() {
  return (
    <GenericList
      title="Professional development" fetchPath="/api/pd"
      renderRow={(p) => (
        <Row key={p.id}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.teacher?.name}</div>
          <div style={{ fontSize: 12, color: T.ink600 }}>{p.cpdCompleted}/{p.cpdTarget} CPD hours</div>
        </Row>
      )}
    />
  );
}

export function EvaluationList() {
  return (
    <GenericList
      title="Teacher evaluation" fetchPath="/api/evaluations"
      renderRow={(e) => (
        <Row key={e.id}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{e.teacher?.name}</div>
          <div style={{ fontSize: 12, color: T.ink600 }}>Evaluated by {e.evaluator?.name} · {new Date(e.date).toLocaleDateString()}</div>
        </Row>
      )}
    />
  );
}

export function SettingsView() {
  const [branches, setBranches] = useState(null);
  useEffect(() => { api.get("/api/settings/branches").then(setBranches).catch(() => {}); }, []);
  return (
    <div style={{ padding: "24px 28px", maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: 22, color: T.navy900, margin: "0 0 18px" }}>Settings</h1>
      <p style={{ fontSize: 13.5, color: T.ink600 }}>Branches, users, and template configuration — full editing UI comes in a follow-up round.</p>
      {branches && branches.map((b) => (
        <div key={b.id} style={{ fontSize: 13.5, padding: "8px 0" }}>{b.name} ({b.code})</div>
      ))}
    </div>
  );
}

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
        {saved && <span style={{ marginLeft: 10, color: "#33622D", fontSize: 12.5, fontWeight: 600 }}>Saved</span>}
      </div>
    </div>
  );
}
