import { useState, useEffect } from "react";
import { api } from "../api";
import { T, FieldLabel, Button, ErrorBanner, Loading, SectionCard, Input } from "../ui";

const canManage = (user) => user && user.role === "admin";

export default function SettingsEditor({ currentUser }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BranchesPanel canManage={canManage(currentUser)} />
      <SubjectsPanel canManage={canManage(currentUser)} />
      <GradeBandsPanel canManage={canManage(currentUser)} />
      <TemplateFieldsPanel canManage={canManage(currentUser)} />
    </div>
  );
}

function BranchesPanel({ canManage }) {
  return <SimplePanel title="Branches" endpoint="branches" canManage={canManage} fields={[["name", "Name"], ["code", "Code"], ["location", "Location"]]} labelOf={(b) => b.name || b.code} />;
}

function SubjectsPanel({ canManage }) {
  return <SimplePanel title="Subjects" endpoint="subjects" canManage={canManage} fields={[["name", "Name"]]} labelOf={(s) => s.name} />;
}

function GradeBandsPanel({ canManage }) {
  return <SimplePanel title="Grade Bands" endpoint="grade-bands" canManage={canManage} fields={[["label", "Label"]]} labelOf={(g) => g.label} />;
}

function SimplePanel({ title, endpoint, canManage, fields, labelOf }) {
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
    if (!window.confirm(`Delete "${labelOf(row)}"?`)) return;
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
      {canManage && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
          {fields.map(([key, label]) => (
            <div key={key} style={{ flex: "1 1 150px" }}>
              <FieldLabel>{label}</FieldLabel>
              <Input value={newForm[key] || ""} onChange={setN(key)} />
            </div>
          ))}
          <Button onClick={saveNew} disabled={!newForm[fields[0][0]]}>Add</Button>
        </div>
      )}
      {rows.length === 0 ? (
        <div style={{ color: T.ink600, fontSize: 13.5, padding: 8 }}>Nothing here yet.</div>
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
                  <Button onClick={saveEdit} style={{ padding: "6px 12px" }}>Save</Button>
                  <Button onClick={() => setEditingId(null)} variant="outline" style={{ padding: "6px 12px" }}>Cancel</Button>
                </div>
              ) : (
                <>
                  <div>
                    <div style={{ fontWeight: 600, color: T.navy900 }}>{labelOf(row)}</div>
                    <div style={{ fontSize: 12.5, color: T.ink600 }}>{fields.slice(1).map(([k]) => row[k]).filter(Boolean).join(" · ")}</div>
                  </div>
                  {canManage && (
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <Button onClick={() => { setEditDraft({ ...row }); setEditingId(row.id); }} variant="outline" style={{ padding: "6px 12px" }}>Edit</Button>
                      <Button onClick={() => removeRow(row)} variant="danger" style={{ padding: "6px 12px" }}>Delete</Button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function TemplateFieldsPanel({ canManage }) {
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
      await api.patch(`/api/settings/template-fields/${key}`, { [field]: !rows.find((r) => r.key === key)[field] });
      await load();
    } catch (e) { setError(e.message); }
  }

  const Check = ({ label, checked, onToggle }) => (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: T.ink600, cursor: canManage ? "pointer" : "default" }}>
      <input type="checkbox" checked={checked} disabled={!canManage} onChange={onToggle} />
      {label}
    </label>
  );

  return (
    <SectionCard title="Weekly Plan Template Fields">
      <ErrorBanner message={error} />
      {!canManage && (
        <div style={{ fontSize: 12.5, color: T.ink600, marginBottom: 12 }}>Only admins can change template field settings.</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r) => (
          <div key={r.key} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 600, color: T.navy900 }}>{r.label}</div>
              <div style={{ fontSize: 12, color: T.ink600 }}>{r.key}</div>
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Check label="Required" checked={r.required} onToggle={() => toggle(r.key, "required")} />
              <Check label="Needs approval" checked={r.needsApproval} onToggle={() => toggle(r.key, "needsApproval")} />
              <Check label="Visible" checked={r.visible} onToggle={() => toggle(r.key, "visible")} />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}