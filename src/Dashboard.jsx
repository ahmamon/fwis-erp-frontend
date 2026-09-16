import { useEffect, useState } from "react";
import { api } from "./api.js";
import { T, Loading, ErrorBanner, SectionCard } from "./ui.jsx";
import { useLang } from "./i18n.jsx";

function StatCard({ label, value, sublabel }) {
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 18, background: "#fff" }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: T.ink600, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 700, color: T.navy900 }}>{value}</div>
      {sublabel && <div style={{ fontSize: 12.5, color: T.ink600, marginTop: 4 }}>{sublabel}</div>}
    </div>
  );
}

// Kinds returned by GET /api/reminders → color accent + which module a tap opens.
const REMINDER_META = {
  returned: { color: T.copper500, dest: "planning" },
  overdue: { color: "#B33030", dest: "planning" },
  due_soon: { color: T.gold600, dest: "planning" },
  cpd: { color: "#2A5D8F", dest: "pd" },
  hod_approval: { color: "#5C3A82", dest: "planning" },
  supervisor_approval: { color: "#33622D", dest: "planning" },
  event: { color: "#2A5D8F", dest: "calendar" },
};

function RemindersCard({ items, onNavigate }) {
  const { t } = useLang();
  const meta = (kind) => REMINDER_META[kind] || REMINDER_META.returned;
  return (
    <SectionCard title={t("Reminders")}>
      {items.length === 0 && (
        <p style={{ fontSize: 13, color: T.ink600, margin: 0 }}>{t("You're all caught up — nothing needs your attention.")}</p>
      )}
      {items.map((r) => (
        <button
          key={r.id}
          onClick={() => onNavigate(meta(r.kind).dest)}
          title={`Open ${meta(r.kind).dest}`}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 12,
            padding: "10px 0", borderBottom: `1px solid ${T.line}`, borderLeft: "none",
            borderRight: "none", borderTop: "none", background: "none",
            textAlign: "start", cursor: "pointer", font: "inherit",
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta(r.kind).color, flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: T.ink900 }}>{r.title}</span>
            <span style={{ fontSize: 12, color: T.ink600 }}>{r.detail}</span>
          </span>
          <span style={{ fontSize: 12, color: T.ink600, flexShrink: 0 }}>{t("Open →")}</span>
        </button>
      ))}
    </SectionCard>
  );
}

function AnnouncementsCard({ notes }) {
  const { t } = useLang();
  return (
    <SectionCard title={t("Announcements")}>
      {notes.length === 0 && (
        <p style={{ fontSize: 13, color: T.ink600, margin: 0 }}>{t("No announcements for you right now.")}</p>
      )}
      {notes.map((n) => (
        <div key={n.id} style={{ padding: "10px 0", borderBottom: `1px solid ${T.line}` }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink900 }}>{n.text}</div>
          <div style={{ fontSize: 12, color: T.ink600 }}>
            {n.authorName} · {new Date(n.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </div>
        </div>
      ))}
    </SectionCard>
  );
}

export default function Dashboard({ currentUser, persona, onNavigate }) {
  const { t } = useLang();
  const [plans, setPlans] = useState(null);
  const [reminders, setReminders] = useState(null);
  const [notes, setNotes] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Refetch on persona change so the "acting as" lens re-scopes the views
    // (the backend filters by the x-active-role header sent with every request).
    setPlans(null);
    setReminders(null);
    setNotes(null);
    setError("");
    api.get("/api/plans").then(setPlans).catch((e) => setError(e.message));
    api.get("/api/reminders").then(setReminders).catch((e) => setError(e.message));
    api.get("/api/notes").then(setNotes).catch((e) => setError(e.message));
  }, [persona]);

  if (error) return <div style={{ padding: 24 }}><ErrorBanner message={error} /></div>;
  // Notes can trail slightly behind; the other two are needed for the core view.
  if (!plans || !reminders) return <Loading />;

  const isTeacher = persona === "teacher";
  const returned = plans.filter((p) => p.status === "returned");
  const waitingOnMe = plans.filter((p) =>
    (persona === "hod" && p.status === "submitted") || (persona === "supervisor" && p.status === "hod_approved")
  );
  const completed = plans.filter((p) => p.status === "completed").length;

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: 22, color: T.navy900, margin: "0 0 18px" }}>
        {t(isTeacher ? "My dashboard" : "Academic overview")}
      </h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 18 }}>
        <StatCard label={t(isTeacher ? "My weekly plans" : "Total plans")} value={plans.length} />
        <StatCard
          label={t("Awaiting your action")}
          value={isTeacher ? returned.length : waitingOnMe.length}
          sublabel={t(isTeacher ? "Returned for revision" : "In the review queue")}
        />
        <StatCard label={t("Completed")} value={completed} />
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 460px", minWidth: 280 }}>
          <RemindersCard items={reminders.items || []} onNavigate={onNavigate} />
        </div>
        <div style={{ flex: "1 1 460px", minWidth: 280 }}>
          <AnnouncementsCard notes={notes || []} />
        </div>
      </div>
    </div>
  );
}