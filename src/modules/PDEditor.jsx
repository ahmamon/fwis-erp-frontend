import { useState, useEffect } from "react";
import { api } from "../api";
import { T, FieldLabel, TextField, Button, ErrorBanner, Loading, SectionCard, Input, hasRole } from "../ui";
import { useLang } from "../i18n.jsx";

const canViewAll = (user) => user && (hasRole(user, "hod") || hasRole(user, "supervisor") || hasRole(user, "admin"));

export default function PDEditor({ currentUser }) {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setData(canViewAll(currentUser) ? await api.get("/api/pd") : await api.get("/api/pd/me"));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  if (!data) return <Loading />;

  if (canViewAll(currentUser)) {
    // Hides the personal editor; shows each teacher's record read-mostly.
    return (
      <SectionCard title={t("Professional Development — All Records")}>
        <ErrorBanner message={error} />
        {data.length === 0 ? (
          <div style={{ color: T.ink600, fontSize: 13.5, padding: 8 }}>{t("No PD records yet.")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.map((rec) => (
              <ViewRecord key={rec.id} rec={rec} />
            ))}
          </div>
        )}
      </SectionCard>
    );
  }

  return <MyPD record={data} onChanged={load} />;
}

function ViewRecord({ rec }) {
  const { t } = useLang();
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px", background: "#fff" }}>
      <div style={{ fontWeight: 600, color: T.navy900 }}>
        {rec.teacher?.name || rec.teacherId}
      </div>
      <div style={{ fontSize: 12.5, color: T.ink600, marginTop: 2 }}>
        {`${rec.cpdTarget ?? 0}h ${t("target")} · ${rec.cpdCompleted ?? 0}h ${t("done")} · ${rec.trainings.length} ${t(rec.trainings.length === 1 ? "training" : "trainings")}, ${rec.goals.length} ${t(rec.goals.length === 1 ? "goal" : "goals")}, ${rec.meetings.length} ${t(rec.meetings.length === 1 ? "meeting" : "meetings")}`}
      </div>
    </div>
  );
}

function MyPD({ record, onChanged }) {
  const { t } = useLang();
  const [error, setError] = useState("");
  const [newTraining, setNewTraining] = useState({ title: "", type: "", hours: "", date: "" });
  const [newGoal, setNewGoal] = useState("");
  const [newMeeting, setNewMeeting] = useState({ title: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const setT = (k) => (v) => setNewTraining((f) => ({ ...f, [k]: v }));
  const setM = (k) => (v) => setNewMeeting((f) => ({ ...f, [k]: v }));

  async function addTraining() {
    if (!newTraining.title.trim()) { setError(t("Training needs a title.")); return; }
    setSaving(true); setError("");
    try {
      await api.post("/api/pd/me/trainings", {
        title: newTraining.title,
        type: newTraining.type || "Workshop",
        hours: Number(newTraining.hours) || 0,
        date: newTraining.date || new Date().toISOString().slice(0, 10),
      });
      setNewTraining({ title: "", type: "", hours: "", date: "" });
      await onChanged();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  async function addGoal() {
    if (!newGoal.trim()) { setError(t("A goal is required.")); return; }
    setSaving(true); setError("");
    try {
      await api.post("/api/pd/me/goals", { goal: newGoal });
      setNewGoal("");
      await onChanged();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  async function addMeeting() {
    if (!newMeeting.title.trim()) { setError(t("Meeting needs a title.")); return; }
    setSaving(true); setError("");
    try {
      await api.post("/api/pd/me/meetings", { title: newMeeting.title, notes: newMeeting.notes });
      setNewMeeting({ title: "", notes: "" });
      await onChanged();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  const del = (kind) => async (id) => {
    if (!window.confirm(t("Delete this item?"))) return;
    try {
      await api.del(`/api/pd/me/${kind}/${id}`);
      await onChanged();
    } catch (e) { setError(e.message); }
  };

  return (
    <SectionCard title={`${t("My Professional Development")} — ${record.cpdCompleted ?? 0} / ${record.cpdTarget ?? 30} ${t("hours")}`}>
      <ErrorBanner message={error} />

      {/* Landing from a CPD reminder should show one obvious next step. */}
      {((record.cpdTarget ?? 30) - (record.cpdCompleted ?? 0)) > 0 && (
        <div style={{
          border: `1px solid ${T.gold500}`, background: T.cream100, borderRadius: 10,
          padding: "12px 14px", marginBottom: 18, display: "flex", justifyContent: "space-between",
          alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          <div style={{ fontSize: 13.5, color: T.ink900 }}>
            {t("You're {1} short of your {2} this year.")
              .replace("{1}", `${Math.max(0, (record.cpdTarget ?? 30) - (record.cpdCompleted ?? 0))}h`)
              .replace("{2}", `${record.cpdTarget ?? 30}h`)}{" "}
            {t("Add a training below to close the gap.")}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.navy900, marginBottom: 10 }}>{t("Trainings")}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ flex: "1 1 140px" }}>
            <FieldLabel>{t("Title")}</FieldLabel>
            <Input value={newTraining.title} onChange={setT("title")} />
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <FieldLabel>{t("Type")}</FieldLabel>
            <Input value={newTraining.type} onChange={setT("type")} placeholder={t("Workshop")} />
          </div>
          <div style={{ flex: "1 1 80px" }}>
            <FieldLabel>{t("Hours")}</FieldLabel>
            <Input type="number" value={newTraining.hours} onChange={setT("hours")} />
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <FieldLabel>{t("Date")}</FieldLabel>
            <Input type="date" value={newTraining.date} onChange={setT("date")} />
          </div>
          <div style={{ alignSelf: "flex-end" }}>
            <Button onClick={addTraining} disabled={saving} style={{ padding: "10px 14px" }}>{t("Add")}</Button>
          </div>
        </div>
        {record.trainings && record.trainings.length === 0 && (
          <div style={{ color: T.ink600, fontSize: 13 }}>{t("No trainings yet.")}</div>
        )}
        {record.trainings && record.trainings.map((training) => (
          <div key={training.id} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8, background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600, color: T.navy900 }}>{training.title}</div>
              <div style={{ fontSize: 12.5, color: T.ink600 }}>{training.type} · {training.hours}h{/* training.date is a Date */}</div>
            </div>
            <Button onClick={del("trainings")(training.id)} variant="danger" style={{ padding: "6px 10px" }}>{t("Delete")}</Button>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.navy900, marginBottom: 10 }}>{t("Goals")}</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <Input value={newGoal} onChange={setNewGoal} placeholder={t("New professional goal...")} />
          </div>
          <Button onClick={addGoal} disabled={saving}>{t("Add")}</Button>
        </div>
        {record.goals && record.goals.length === 0 && (
          <div style={{ color: T.ink600, fontSize: 13 }}>{t("No goals yet.")}</div>
        )}
        {record.goals && record.goals.map((g) => (
          <div key={g.id} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8, background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600, color: T.navy900 }}>{g.goal}</div>
              <div style={{ fontSize: 12.5, color: T.ink600 }}>{g.status}</div>
            </div>
            <Button onClick={del("goals")(g.id)} variant="danger" style={{ padding: "6px 10px" }}>{t("Delete")}</Button>
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.navy900, marginBottom: 10 }}>{t("Meetings")}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ flex: "1 1 200px" }}>
            <FieldLabel>{t("Title")}</FieldLabel>
            <Input value={newMeeting.title} onChange={setM("title")} />
          </div>
          <div style={{ flex: "1 1 240px" }}>
            <FieldLabel>{t("Notes")}</FieldLabel>
            <Input value={newMeeting.notes} onChange={setM("notes")} />
          </div>
          <div style={{ alignSelf: "flex-end" }}>
            <Button onClick={addMeeting} disabled={saving} style={{ padding: "10px 14px" }}>{t("Add")}</Button>
          </div>
        </div>
        {record.meetings && record.meetings.length === 0 && (
          <div style={{ color: T.ink600, fontSize: 13 }}>{t("No meetings yet.")}</div>
        )}
        {record.meetings && record.meetings.map((m) => (
          <div key={m.id} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8, background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600, color: T.navy900 }}>{m.title}</div>
              {m.notes && <div style={{ fontSize: 13, color: T.ink600 }}>{m.notes}</div>}
            </div>
            <Button onClick={del("meetings")(m.id)} variant="danger" style={{ padding: "6px 10px" }}>{t("Delete")}</Button>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}