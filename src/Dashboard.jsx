import { useEffect, useState } from "react";
import { api } from "./api.js";
import { T, StatusBadge, Loading, ErrorBanner, SectionCard } from "./ui.jsx";

function StatCard({ label, value, sublabel }) {
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 18, background: "#fff" }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: T.ink600, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 700, color: T.navy900 }}>{value}</div>
      {sublabel && <div style={{ fontSize: 12.5, color: T.ink600, marginTop: 4 }}>{sublabel}</div>}
    </div>
  );
}

export default function Dashboard({ currentUser }) {
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/plans").then(setPlans).catch((e) => setError(e.message));
  }, []);

  if (error) return <div style={{ padding: 24 }}><ErrorBanner message={error} /></div>;
  if (!plans) return <Loading />;

  const { role } = currentUser;

  if (role === "teacher") {
    const returned = plans.filter((p) => p.status === "returned");
    const completed = plans.filter((p) => p.status === "completed").length;
    return (
      <div style={{ padding: "24px 28px", maxWidth: 1000, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 22, color: T.navy900, margin: "0 0 18px" }}>My dashboard</h1>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 18 }}>
          <StatCard label="My weekly plans" value={plans.length} />
          <StatCard label="Awaiting my action" value={returned.length} sublabel="Returned for revision" />
          <StatCard label="Completed" value={completed} />
        </div>
        <SectionCard title="Needs your attention">
          {returned.length === 0 && <p style={{ fontSize: 13, color: T.ink600, margin: 0 }}>Nothing needs your attention right now.</p>}
          {returned.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.line}` }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.subject} · {p.grade}, {p.week}</div>
                <div style={{ fontSize: 12, color: T.ink600 }}>{p.comments?.[p.comments.length - 1]?.text?.slice(0, 60)}</div>
              </div>
              <StatusBadge status={p.status} />
            </div>
          ))}
        </SectionCard>
      </div>
    );
  }

  const waitingOnMe = plans.filter((p) =>
    (role === "hod" && p.status === "submitted") || (role === "supervisor" && p.status === "hod_approved")
  );
  const completed = plans.filter((p) => p.status === "completed").length;

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: 22, color: T.navy900, margin: "0 0 18px" }}>Academic overview</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 18 }}>
        <StatCard label="Total plans" value={plans.length} />
        <StatCard label="Awaiting your decision" value={waitingOnMe.length} />
        <StatCard label="Completed" value={completed} />
      </div>
      <SectionCard title="Plans awaiting your review">
        {waitingOnMe.length === 0 && <p style={{ fontSize: 13, color: T.ink600, margin: 0 }}>Nothing waiting on you right now.</p>}
        {waitingOnMe.map((p) => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.line}` }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.teacher?.name}</div>
              <div style={{ fontSize: 12, color: T.ink600 }}>{p.subject} · {p.grade}, {p.week}</div>
            </div>
            <StatusBadge status={p.status} />
          </div>
        ))}
      </SectionCard>
    </div>
  );
}
