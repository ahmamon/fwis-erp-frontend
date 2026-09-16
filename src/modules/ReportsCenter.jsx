import { useEffect, useState } from "react";
import { useLang } from "../i18n.jsx";
import { api } from "../api";
import { T, Select, StatusBadge, ErrorBanner, Loading, SectionCard } from "../ui";

const TABS = [
  { id: "plans", label: "Plan completion", path: "plan-completion" },
  { id: "unapproved", label: "Unapproved plans", path: "unapproved-plans" },
  { id: "cpd", label: "CPD hours", path: "cpd" },
  { id: "coverage", label: "Curriculum coverage", path: "curriculum-coverage" },
];

// A small navy-themed table. Columns are { key, label, align?, render? }; when
// render is absent the cell falls back to row[key]. Wide tables scroll inside
// their own container so the page never scrolls sideways.
function ReportTable({ columns, rows, empty = "No data yet." }) {
  const { t } = useLang();
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 520 }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: c.align || "left",
                  fontSize: 11.5, fontWeight: 700, color: T.ink600,
                  textTransform: "uppercase", letterSpacing: 0.6,
                  padding: "8px 12px", borderBottom: `2px solid ${T.line}`, whiteSpace: "nowrap",
                }}
              >
                {t(c.label)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ padding: "18px 12px", color: T.ink600, textAlign: "center" }}>
                {t(empty)}
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={row.key ?? i} style={{ background: i % 2 ? T.cream50 : "#fff" }}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  style={{
                    padding: "9px 12px", borderBottom: `1px solid ${T.line}`, color: T.ink900,
                    textAlign: c.align || "left", whiteSpace: c.nowrap ? "nowrap" : undefined,
                  }}
                >
                  {c.render ? c.render(row) : (row[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Progress({ rate }) {
  const pct = Math.max(0, Math.min(100, Number(rate) || 0));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 130 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(198,161,91,0.2)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: T.gold500, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.ink900, width: 42, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

function OverdueBadge({ overdue }) {
  const { t } = useLang();
  if (overdue === null) return <span style={{ fontSize: 12, color: T.ink600 }}>—</span>;
  if (overdue) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6, background: "#F7E7DE", color: T.copper500,
        fontSize: 12, fontWeight: 600, borderRadius: 999, padding: "3px 9px",
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.copper500 }} />
        {t("Overdue")}
      </span>
    );
  }
  return <span style={{ fontSize: 12, fontWeight: 600, color: "#33622D" }}>{t("On track")}</span>;
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// Report definitions — columns shared by the table render for each tab.
const REPORTS = {
  plans: {
    columns: [
      { key: "group", label: "Group" },
      { key: "total", label: "Plans", align: "right" },
      { key: "approved", label: "Approved", align: "right" },
      { key: "pending", label: "Pending", align: "right" },
      { key: "rate", label: "Completion", render: (r) => <Progress rate={r.rate} /> },
    ],
  },
  unapproved: {
    note: "Plans that still need approval — from any week. Overdue = from an earlier week than the latest one on record and still not approved.",
    columns: [
      { key: "teacher", label: "Teacher" },
      { key: "subject", label: "Subject · Grade", nowrap: true, render: (r) => <>{r.subject} · {r.grade}</> },
      { key: "week", label: "Term · Week", nowrap: true, render: (r) => <>{r.term} · {r.week}</> },
      { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
      { key: "updatedAt", label: "Last updated", render: (r) => fmtDate(r.updatedAt) },
      { key: "overdue", label: "Overdue", render: (r) => <OverdueBadge overdue={r.overdue} /> },
    ],
  },
  cpd: {
    columns: [
      { key: "name", label: "Teacher" },
      { key: "department", label: "Department" },
      { key: "target", label: "Target (hrs)", align: "right" },
      { key: "completed", label: "Completed (hrs)", align: "right" },
      { key: "rate", label: "Progress", render: (r) => <Progress rate={r.rate} /> },
    ],
  },
  coverage: {
    note: "Average planned vs. achieved completion across units; a negative gap means coverage is behind plan.",
    columns: [
      { key: "group", label: "Group" },
      { key: "units", label: "Units", align: "right" },
      { key: "planned", label: "Planned %", align: "right" },
      { key: "achieved", label: "Achieved %", align: "right" },
      { key: "gap", label: "Gap", align: "right", render: (r) => {
        const color = r.gap < 0 ? T.copper500 : r.gap > 0 ? "#33622D" : T.ink600;
        return <span style={{ color, fontWeight: 600 }}>{r.gap > 0 && "+"}{r.gap}%</span>;
      } },
    ],
  },
};

export default function ReportsCenter({ currentUser }) {
  const { t } = useLang();
  const [tab, setTab] = useState("plans");
  const [data, setData] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Group selector is per-report (teacher/department/branch vs subject/grade).
  const [planGroup, setPlanGroup] = useState("teacher");
  const [coverageGroup, setCoverageGroup] = useState("subject");
  // Unapproved week filter — "" means "all weeks" (overdue flags shown).
  const [weekKey, setWeekKey] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    setBusy(true);

    const meta = TABS.find((t) => t.id === tab);
    let qs = "";
    if (tab === "plans") qs = `?group=${encodeURIComponent(planGroup)}`;
    else if (tab === "coverage") qs = `?group=${encodeURIComponent(coverageGroup)}`;
    else if (tab === "unapproved" && weekKey) {
      const avail = data.unapproved?.available || [];
      const pick = avail.find((a) => a.label === weekKey);
      if (pick) qs = `?term=${encodeURIComponent(pick.term)}&week=${encodeURIComponent(pick.week)}`;
    }

    api.get(`/api/reports/${meta.path}${qs}`)
      .then((d) => { if (!cancelled) { setData((p) => ({ ...p, [tab]: d })); } })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setBusy(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, planGroup, coverageGroup, weekKey]);

  const meta = TABS.find((t) => t.id === tab);
  const rep = REPORTS[tab];
  const response = data[tab];
  const rows = response?.rows || [];
  const available = response?.available || [];

  const weekOptions = [ { value: "", label: t("All weeks") }, ...available.map((a) => ({ value: a.label, label: a.label })) ];

  return (
    <div style={{ padding: "20px 28px 60px", maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: 20, color: T.navy900, margin: "0 0 4px" }}>{t("Report Center")}</h1>
      <div style={{ fontSize: 12.5, color: T.ink600, marginBottom: 16 }}>
        {t("Read-only views for HODs, supervisors and admins.")}
      </div>
      <ErrorBanner message={error} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {TABS.map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            style={{
              border: tab === tabItem.id ? `1px solid ${T.gold600}` : `1px solid ${T.line}`,
              background: tab === tabItem.id ? "rgba(198,161,91,0.18)" : "#fff",
              color: T.ink900, borderRadius: 999, padding: "7px 14px", fontSize: 13,
              fontWeight: tab === tabItem.id ? 700 : 500, cursor: "pointer",
            }}
          >
            {t(tabItem.label)}
          </button>
        ))}
      </div>

      {busy && !response ? <Loading /> : (
        <SectionCard
          title={t(meta.label)}
          right={
            <>
              {tab === "plans" && (
                <Select value={planGroup} onChange={setPlanGroup} options={[
                  { value: "teacher", label: t("By teacher") },
                  { value: "department", label: t("By department") },
                  { value: "branch", label: t("By branch") },
                ]} />
              )}
              {tab === "coverage" && (
                <Select value={coverageGroup} onChange={setCoverageGroup} options={[
                  { value: "subject", label: t("By subject") },
                  { value: "grade", label: t("By grade") },
                ]} />
              )}
              {tab === "unapproved" && (
                <Select value={weekKey} onChange={setWeekKey} options={weekOptions} />
              )}
            </>
          }
        >
          {rep.note && <div style={{ fontSize: 12.5, color: T.ink600, marginBottom: 12 }}>{t(rep.note)}</div>}
          <ReportTable columns={rep.columns} rows={rows} />
        </SectionCard>
      )}
    </div>
  );
}