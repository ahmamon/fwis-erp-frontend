import { useState, useEffect } from "react";
import { api } from "../api";
import { T, FieldLabel, Input, Select, Button, ErrorBanner, Loading, SectionCard, ROLE_OPTIONS, ROLE_LABELS } from "../ui";
import { useLang, fmtDate, fmtDateTime } from "../i18n.jsx";
import UsersEditor from "./UsersEditor.jsx";

// The Admin Control Panel — the single admin-only area that replaced Settings.
// It consolidates staff & roles, the school-data settings tabs that used to
// live in Settings (branches, subjects, grade bands, template fields), the
// system-wide audit log, the Report Center and the Notes (announcements) tab
// admins use to post dashboard announcements for staff.

const TABS = [
  ["staff", "Staff & Roles"],
  ["branches", "Branches"],
  ["subjects", "Subjects"],
  ["grades", "Grade Bands"],
  ["template", "Template Fields"],
  ["audit", "Audit Log"],
  ["reports", "Reports"],
  ["notes", "Notes"],
];

export default function AdminPanel({ currentUser, onNavigate }) {
  const { t } = useLang();
  const [tab, setTab] = useState("staff");
  return (
    <div style={{ padding: "20px 28px 60px", maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: 20, color: T.navy900, margin: "0 0 6px" }}>{t("Admin Control Panel")}</h1>
      <div style={{ fontSize: 12.5, color: T.ink600, marginBottom: 16 }}>
        {t("Staff, school data, audit trail and reports — admin access only.")}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18, paddingBottom: 4 }}>
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              border: tab === id ? `1px solid ${T.navy900}` : `1px solid ${T.line}`,
              background: tab === id ? T.navy900 : "#fff",
              color: tab === id ? "#fff" : T.ink600,
              borderRadius: 999, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            }}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {tab === "staff" && <UsersEditor currentUser={currentUser} />}
      {tab === "branches" && <SimplePanel title={t("Branches")} endpoint="branches" fields={[["name", "Name"], ["code", "Code"], ["location", "Location"]]} labelOf={(b) => b.name || b.code} />}
      {tab === "subjects" && <SimplePanel title={t("Subjects")} endpoint="subjects" fields={[["name", "Name"]]} labelOf={(s) => s.name} />}
      {tab === "grades" && <SimplePanel title={t("Grade Bands")} endpoint="grade-bands" fields={[["label", "Label"]]} labelOf={(g) => g.label} />}
      {tab === "template" && <TemplateFieldsPanel />}
      {tab === "audit" && <AuditLogPanel />}
      {tab === "reports" && <ReportsPanel onNavigate={onNavigate} />}
      {tab === "notes" && <NotesPanel />}
    </div>
  );
}

// Branches / Subjects / Grade Bands are one shape: a small list of settings
// rows, each editable/deletable. Only reaches AdminPanel, which is admin-only,
// so every panel is always managed.
function SimplePanel({ title, endpoint, fields, labelOf }) {
  const { t } = useLang();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [newForm, setNewForm] = useState({});

  async function load() {
    try {
      setRows(await api.get(`/api/settings/${endpoint}`));
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => { load(); }, [endpoint]);

  const setN = (k) => (v) => setNewForm((f) => ({ ...f, [k]: v }));
  const setD = (k) => (v) => setEditDraft((f) => ({ ...f, [k]: v }));

  async function saveNew() {
    setError("");
    try {
      await api.post(`/api/settings/${endpoint}`, newForm);
      setNewForm({});
      await load();
    } catch (e) { setError(e.message); }
  }

  async function saveEdit() {
    setError("");
    try {
      await api.patch(`/api/settings/${endpoint}/${editingId}`, editDraft);
      setEditingId(null);
      await load();
    } catch (e) { setError(e.message); }
  }

  async function removeRow(row) {
    if (!window.confirm(`${t("Delete")} "${labelOf(row)}"?`)) return;
    setError("");
    try {
      await api.del(`/api/settings/${endpoint}/${row.id}`);
      await load();
    } catch (e) { setError(e.message); }
  }

  if (!rows) return <Loading />;

  return (
    <SectionCard title={title}>
      <ErrorBanner message={error} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
        {fields.map(([key, label]) => (
          <div key={key} style={{ flex: "1 1 150px" }}>
            <FieldLabel>{t(label)}</FieldLabel>
            <Input value={newForm[key] || ""} onChange={setN(key)} />
          </div>
        ))}
        <Button onClick={saveNew} disabled={!newForm[fields[0][0]]}>{t("Add")}</Button>
      </div>
      {rows.length === 0 ? (
        <div style={{ color: T.ink600, fontSize: 13.5, padding: 8 }}>{t("Nothing here yet.")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((row) => (
            <div key={row.id} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              {editingId === row.id ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", flex: 1 }}>
                  {fields.map(([key, label]) => (
                    <div key={key} style={{ flex: "1 1 120px" }}>
                      <Input value={editDraft[key] || ""} onChange={setD(key)} />
                    </div>
                  ))}
                  <Button onClick={saveEdit} style={{ padding: "6px 12px" }}>{t("Save")}</Button>
                  <Button onClick={() => setEditingId(null)} variant="outline" style={{ padding: "6px 12px" }}>{t("Cancel")}</Button>
                </div>
              ) : (
                <>
                  <div>
                    <div style={{ fontWeight: 600, color: T.navy900 }}>{labelOf(row)}</div>
                    <div style={{ fontSize: 12.5, color: T.ink600 }}>{fields.slice(1).map(([k]) => row[k]).filter(Boolean).join(" · ")}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <Button onClick={() => { setEditDraft({ ...row }); setEditingId(row.id); }} variant="outline" style={{ padding: "6px 12px" }}>{t("Edit")}</Button>
                    <Button onClick={() => removeRow(row)} variant="danger" style={{ padding: "6px 12px" }}>{t("Delete")}</Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function TemplateFieldsPanel() {
  const { t } = useLang();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setRows(await api.get("/api/settings/template-fields"));
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => { load(); }, []);

  if (!rows) return <Loading />;

  async function toggle(key, field) {
    setError("");
    try {
      const row = rows.find((r) => r.key === key);
      await api.patch(`/api/settings/template-fields/${key}`, { [field]: !row[field] });
      await load();
    } catch (e) { setError(e.message); }
  }

  const Check = ({ label, checked, onToggle }) => (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: T.ink600, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      {label}
    </label>
  );

  return (
    <SectionCard title={t("Weekly Plan Template Fields")}>
      <ErrorBanner message={error} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r) => (
          <div key={r.key} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 600, color: T.navy900 }}>{r.label}</div>
              <div style={{ fontSize: 12, color: T.ink600 }}>{r.key}</div>
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Check label={t("Required")} checked={r.required} onToggle={() => toggle(r.key, "required")} />
              <Check label={t("Needs approval")} checked={r.needsApproval} onToggle={() => toggle(r.key, "needsApproval")} />
              <Check label={t("Visible")} checked={r.visible} onToggle={() => toggle(r.key, "visible")} />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function AuditLogPanel() {
  const { t } = useLang();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/audit")
      .then((d) => setRows(d.rows))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!rows) return <Loading />;

  return (
    <SectionCard title={t("Audit Log")}>
      <div style={{ fontSize: 12.5, color: T.ink600, marginBottom: 12 }}>
        {t("The 100 most recent actions across the system — plan lifecycles and staff management.")}
      </div>
      {rows.length === 0 ? (
        <div style={{ color: T.ink600, fontSize: 13.5, padding: 8 }}>{t("No activity recorded yet.")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: `1px solid ${T.line}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink900 }}>{r.action}</div>
                <div style={{ fontSize: 12, color: T.ink600 }}>
                  {r.authorName}
                  {r.target ? ` · ${r.target}` : ""}
                </div>
              </div>
              <div style={{ fontSize: 12, color: T.ink600, whiteSpace: "nowrap", flexShrink: 0 }}>
                {fmtDateTime(r.at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

const REPORT_TILES = [
  { key: "completion", label: "Plan completion rate" },
  { key: "unapproved", label: "Unapproved / overdue plans" },
  { key: "cpd", label: "CPD progress vs target" },
  { key: "coverage", label: "Curriculum coverage vs planned" },
];

function ReportsPanel({ onNavigate }) {
  const { t } = useLang();
  return (
    <SectionCard title={t("Report Center")}>
      <div style={{ fontSize: 12.5, color: T.ink600, marginBottom: 12 }}>
        {t("Jump to the full Report Center for these views.")}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {REPORT_TILES.map((tile) => (
          <Button key={tile.key} variant="outline" onClick={() => onNavigate("reports")}>{t(tile.label)}</Button>
        ))}
      </div>
    </SectionCard>
  );
}

function NotesPanel() {
  const { t } = useLang();
  const [notes, setNotes] = useState(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [department, setDepartment] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});

  async function load() {
    try {
      setNotes(await api.get("/api/notes"));
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  // <input type="date"> value ("YYYY-MM-DD") ↔ the note's stored ISO string.
  const toDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-CA") : "");
  const toIso = (d) => (d ? `${d}T00:00:00` : null);

  async function createNote() {
    setError("");
    try {
      await api.post("/api/notes", {
        text,
        targetRole: targetRole || null,
        department: department.trim() || null,
        expiresAt: toIso(expiresAt),
      });
      setText(""); setTargetRole(""); setDepartment(""); setExpiresAt("");
      await load();
    } catch (e) { setError(e.message); }
  }

  async function saveEdit() {
    setError("");
    try {
      await api.patch(`/api/notes/${editingId}`, {
        text: draft.text,
        targetRole: draft.targetRole || null,
        department: draft.department || null,
        expiresAt: toIso(draft.expiresAt),
        active: draft.active,
      });
      setEditingId(null);
      await load();
    } catch (e) { setError(e.message); }
  }

  async function removeNote(n) {
    if (!window.confirm(t("Delete this announcement?"))) return;
    setError("");
    try {
      await api.del(`/api/notes/${n.id}`);
      await load();
    } catch (e) { setError(e.message); }
  }

  if (!notes) return <Loading />;

  const audience = (n) => [
    n.targetRole ? t(ROLE_LABELS[n.targetRole]) : t("Everyone"),
    n.department && `${t("Department:")} ${n.department}`,
  ].filter(Boolean).join(" · ");

  return (
    <SectionCard title={t("Notes & Announcements")}>
      <div style={{ fontSize: 12.5, color: T.ink600, marginBottom: 16 }}>
        {t("Post short announcements that surface on staff dashboards. People see them until they expire or are paused.")}
      </div>
      <ErrorBanner message={error} />

      {/* Create */}
      <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, background: T.cream100, marginBottom: 18 }}>
        <FieldLabel required>{t("Announcement text")}</FieldLabel>
        <Input value={text} onChange={setText} placeholder={t("e.g. Staff meeting Tuesday 3:30pm in the library")} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 150px" }}>
            <FieldLabel>{t("Audience")}</FieldLabel>
            <Select value={targetRole} onChange={setTargetRole} placeholder={t("Everyone")} options={ROLE_OPTIONS} />
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <FieldLabel>{t("Department (optional)")}</FieldLabel>
            <Input value={department} onChange={setDepartment} placeholder={t("e.g. English")} />
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <FieldLabel>{t("Expires (optional)")}</FieldLabel>
            <Input type="date" value={expiresAt} onChange={setExpiresAt} />
          </div>
          <Button onClick={createNote} disabled={!text.trim()}>{t("Post announcement")}</Button>
        </div>
      </div>

      {/* List — admins see every note, paused or expired, so they can re-enable. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {notes.length === 0 && <div style={{ color: T.ink600, fontSize: 13.5, padding: 8 }}>{t("Nothing posted yet.")}</div>}
        {notes.map((n) =>
          editingId === n.id ? (
            <div key={n.id} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 12, background: "#fff" }}>
              <Input value={draft.text} onChange={(v) => setDraft({ ...draft, text: v })} />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10, alignItems: "flex-end" }}>
                <div style={{ flex: "1 1 140px" }}>
                  <FieldLabel>{t("Audience")}</FieldLabel>
                  <Select value={draft.targetRole || ""} onChange={(v) => setDraft({ ...draft, targetRole: v })} placeholder={t("Everyone")} options={ROLE_OPTIONS} />
                </div>
                <div style={{ flex: "1 1 140px" }}>
                  <FieldLabel>{t("Department")}</FieldLabel>
                  <Input value={draft.department || ""} onChange={(v) => setDraft({ ...draft, department: v })} placeholder={t("Optional")} />
                </div>
                <div style={{ flex: "1 1 140px" }}>
                  <FieldLabel>{t("Expires")}</FieldLabel>
                  <Input type="date" value={toDate(draft.expiresAt)} onChange={(v) => setDraft({ ...draft, expiresAt: v || null })} />
                </div>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: T.ink600, cursor: "pointer" }}>
                  <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
                  {t("Active")}
                </label>
                <Button onClick={saveEdit} style={{ padding: "6px 12px" }}>{t("Save")}</Button>
                <Button variant="outline" onClick={() => setEditingId(null)} style={{ padding: "6px 12px" }}>{t("Cancel")}</Button>
              </div>
            </div>
          ) : (
            <div key={n.id} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 12, background: "#fff", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink900, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {n.text}
                  {!n.active && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, background: "#EFEDE7", color: T.ink600, borderRadius: 999, padding: "2px 8px" }}>{t("Paused")}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: T.ink600, marginTop: 3 }}>
                  {n.authorName} · {fmtDate(n.createdAt, { year: "numeric", month: "numeric", day: "numeric" })} · {audience(n)}
                  {n.expiresAt ? ` · ${t("Expires")} ${fmtDate(n.expiresAt, { year: "numeric", month: "numeric", day: "numeric" })}` : ` · ${t("No expiry")}`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <Button variant="outline" onClick={() => { setDraft({ ...n, expiresAt: toDate(n.expiresAt) }); setEditingId(n.id); }} style={{ padding: "6px 12px" }}>{t("Edit")}</Button>
                <Button variant="danger" onClick={() => removeNote(n)} style={{ padding: "6px 12px" }}>{t("Delete")}</Button>
              </div>
            </div>
          )
        )}
      </div>
    </SectionCard>
  );
}