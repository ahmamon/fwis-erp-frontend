import { useEffect, useMemo, useState } from "react";
import { useLang } from "../i18n.jsx";
import { api } from "../api";
import { T, FieldLabel, Input, Select, Button, SectionCard, ErrorBanner, Loading, hasRole } from "../ui";

// School calendar — a shared month grid of quizzes, exams, and general events.
// Everyone reads it; only admins add/edit/delete (per the Round-6 decision).
// Dates are stored at UTC midnight and shown by their YYYY-MM-DD parts so the
// day never shifts across timezones (school is UTC+3; your browser may not be).

const TYPE_META = {
  quiz: { label: "Quiz", color: T.gold600, bg: "rgba(198,161,91,0.18)" },
  exam: { label: "Exam", color: T.copper500, bg: "rgba(168,92,50,0.14)" },
  event: { label: "Event", color: T.navy700, bg: "rgba(27,58,99,0.10)" },
};
const TYPE_OPTIONS = Object.entries(TYPE_META).map(([value, m]) => ({ value, label: m.label }));

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY = 86400000;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function addMonths(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
// 42 cells (6 weeks) covering the month, built in UTC so each cell's
// YYYY-MM-DD is stable and matches an event's stored date exactly.
function gridDays(month) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = new Date(Date.UTC(y, m - 1, 1 - first.getUTCDay())); // Sunday before/on the 1st
  return Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * DAY));
}
const dayKey = (d) => d.toISOString().slice(0, 10);

function CalendarForm({ initial, onSave, onCancel }) {
  const { t } = useLang();
  const [form, setForm] = useState({
    title: initial.title || "",
    type: initial.type || "event",
    date: initial.date || todayKey(),
    time: initial.time || "",
    allDay: initial.allDay !== false,
    grade: initial.grade || "",
    subject: initial.subject || "",
    location: initial.location || "",
    description: initial.description || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  // GradeBand/Subject lookups for the pickers — loaded once by the parent.
  const grades = initial.grades || [];
  const subjects = initial.subjects || [];

  async function submit() {
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, background: T.cream100, marginBottom: 16 }}>
      <ErrorBanner message={error} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <FieldLabel required>{t("Title")}</FieldLabel>
          <Input value={form.title} onChange={set("title")} placeholder={t("e.g. Term 1 English exam")} />
        </div>
        <div>
          <FieldLabel>{t("Type")}</FieldLabel>
          <Select value={form.type} onChange={set("type")} options={TYPE_OPTIONS.map((o) => ({ ...o, label: t(o.label) }))} />
        </div>
        <div>
          <FieldLabel required>{t("Date")}</FieldLabel>
          <Input type="date" value={form.date} onChange={set("date")} />
        </div>
        <div>
          <FieldLabel>{t("Start time")}</FieldLabel>
          <Input type="time" value={form.time} onChange={set("time")} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 26 }}>
          <input id="allDay" type="checkbox" checked={form.allDay} onChange={(e) => set("allDay")(e.target.checked)} />
          <label htmlFor="allDay" style={{ fontSize: 13, color: T.ink900, cursor: "pointer" }}>{t("All day")}</label>
        </div>
        <div>
          <FieldLabel>{t("Grade")}</FieldLabel>
          <Select
            value={form.grade}
            onChange={set("grade")}
            options={[{ value: "", label: t("— Whole school") }, ...grades.map((g) => ({ value: g.label, label: g.label }))]}
          />
        </div>
        <div>
          <FieldLabel>{t("Subject")}</FieldLabel>
          <Select
            value={form.subject}
            onChange={set("subject")}
            options={[{ value: "", label: t("— All subjects") }, ...subjects.map((s) => ({ value: s.name, label: s.name }))]}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <FieldLabel>{t("Location")}</FieldLabel>
          <Input value={form.location} onChange={set("location")} placeholder={t("e.g. Hall A")} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <FieldLabel>{t("Description")}</FieldLabel>
          <Input value={form.description} onChange={set("description")} placeholder={t("Optional notes for staff")} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <Button onClick={submit} disabled={saving}>{saving ? t("Saving…") : initial.id ? t("Save changes") : t("Add event")}</Button>
        <Button variant="outline" onClick={onCancel}>{t("Cancel")}</Button>
      </div>
    </div>
  );
}

export default function Calendar({ currentUser }) {
  const { t } = useLang();
  const [month, setMonth] = useState(todayKey().slice(0, 7));
  const [events, setEvents] = useState(null);
  const [editing, setEditing] = useState(null); // null | { id?, ...defaults, grades, subjects }
  const [error, setError] = useState("");
  const [lookups, setLookups] = useState({ grades: [], subjects: [] });

  function load(m) {
    const days = gridDays(m);
    setEvents(null);
    api.get(`/api/calendar?from=${dayKey(days[0])}&to=${dayKey(days[41])}`).then(setEvents).catch((e) => setError(e.message));
  }
  useEffect(() => { load(month); }, [month]);
  useEffect(() => {
    Promise.all([api.get("/api/settings/grade-bands"), api.get("/api/settings/subjects")])
      .then(([grades, subjects]) => setLookups({ grades, subjects }))
      .catch(() => {});
  }, []);

  const admin = hasRole(currentUser, "admin");
  const today = todayKey();
  const byDay = useMemo(() => {
    const map = {};
    for (const ev of events || []) {
      const k = String(ev.date).slice(0, 10);
      (map[k] = map[k] || []).push(ev);
    }
    return map;
  }, [events]);

  const days = gridDays(month);
  const inMonth = (d) => d.slice(0, 7) === month;

  async function saveEvent(form) {
    if (editing?.id) await api.patch(`/api/calendar/${editing.id}`, form);
    else await api.post("/api/calendar", form);
    setEditing(null);
    load(month);
  }
  async function removeEvent(ev) {
    if (!window.confirm(`${t("Delete")} "${ev.title}"?`)) return;
    try {
      await api.del(`/api/calendar/${ev.id}`);
      load(month);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 22, color: T.navy900, margin: 0 }}>{t("School calendar")}</h1>
        {admin && (
          <Button onClick={() => setEditing({ id: null, ...lookups })}>{t("+ Add event")}</Button>
        )}
      </div>
      <ErrorBanner message={error} />

      {editing && (
        <CalendarForm initial={editing} onSave={saveEvent} onCancel={() => setEditing(null)} />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <Button variant="outline" onClick={() => setMonth((m) => addMonths(m, -1))}>←</Button>
        <input
          type="month"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: "7px 10px", fontSize: 13.5, color: T.ink900, background: "#fff" }}
        />
        <Button variant="outline" onClick={() => setMonth((m) => addMonths(m, 1))}>→</Button>
        <Button variant="outline" onClick={() => setMonth(today.slice(0, 7))}>{t("Today")}</Button>
        <div style={{ display: "flex", gap: 12, marginLeft: 8 }}>
          {TYPE_OPTIONS.map((o) => (
            <span key={o.value} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.ink600 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: TYPE_META[o.value].color }} />
              {t(o.label)}
            </span>
          ))}
        </div>
      </div>

      {!events ? (
        <Loading />
      ) : (
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden", background: "#fff" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: T.navy900 }}>
            {WEEKDAYS.map((w) => (
              <div key={w} style={{ padding: "7px 4px", textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: T.gold500 }}>{t(w)}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {days.map((d) => {
              const k = dayKey(d);
              const dayEvents = byDay[k] || [];
              const dim = !inMonth(k);
              return (
                <div key={k} style={{
                  minHeight: 74, borderTop: `1px solid ${T.line}`, position: "relative",
                  background: dim ? T.cream50 : "#fff", padding: "5px 6px",
                  borderRight: "none",
                }}>
                  <div style={{
                    fontSize: 11.5, fontWeight: k === today ? 700 : 500,
                    color: k === today ? T.copper500 : dim ? "#b9b3a3" : T.ink600,
                  }}>{Number(k.slice(8))}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 3 }}>
                    {dayEvents.slice(0, 3).map((ev) => {
                      const m = TYPE_META[ev.type] || TYPE_META.event;
                      return (
                        <button key={ev.id} type="button"
                          onClick={() => admin && setEditing({ id: ev.id, ...ev, ...lookups })}
                          disabled={!admin}
                          title={`${ev.title}${ev.time ? ` · ${ev.time}` : ""}`}
                          style={{
                            width: "100%", border: "none", borderRadius: 5, padding: "2px 5px",
                            background: m.bg, color: m.color, fontSize: 10.5, fontWeight: 600,
                            textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            cursor: admin ? "pointer" : "default", font: "inherit",
                          }}>
                          {ev.title}
                        </button>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div style={{ fontSize: 9.5, color: T.ink600, paddingLeft: 5 }}>+{dayEvents.length - 3} {t("more")}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <SectionCard title={`${t("Events")} — ${month}`}>
          {!events || events.length === 0 ? (
            <p style={{ fontSize: 13, color: T.ink600, margin: 0 }}>{t("Nothing scheduled in this month.")}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {events.map((ev) => {
                const m = TYPE_META[ev.type] || TYPE_META.event;
                const on = String(ev.date).slice(0, 10);
                return (
                  <div key={ev.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
                    borderBottom: `1px solid ${T.line}`,
                  }}>
                    <span style={{
                      minWidth: 52, textAlign: "center", borderRadius: 8, padding: "5px 4px",
                      background: m.bg, color: m.color, fontSize: 11.5, fontWeight: 700,
                    }}>
                      {new Date(`${on}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink900 }}>{ev.title}</div>
                      <div style={{ fontSize: 12, color: T.ink600 }}>
                        {t(m.label)}{ev.time ? ` · ${ev.time}` : ""}
                        {ev.grade ? ` · ${ev.grade}` : ""}{ev.subject ? ` · ${ev.subject}` : ""}
                        {ev.location ? ` · ${ev.location}` : ""}
                      </div>
                    </div>
                    {admin && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <Button variant="outline" onClick={() => setEditing({ id: ev.id, ...ev, ...lookups })} style={{ padding: "5px 10px" }}>{t("Edit")}</Button>
                        <Button variant="danger" onClick={() => removeEvent(ev)} style={{ padding: "5px 10px" }}>{t("Delete")}</Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}