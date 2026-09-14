import { useState, useEffect } from "react";
import { api } from "../api";
import { T, FieldLabel, TextField, Button, ErrorBanner, Loading, SectionCard, Input, hasRole } from "../ui";

const canManage = (user) => user && (hasRole(user, "admin") || hasRole(user, "supervisor"));

const CATEGORIES = [
  "Active learning",
  "Differentiation",
  "Assessment",
  "Classroom management",
  "Technology",
  "Literacy",
  "Other",
];

export default function StrategiesEditor({ currentUser }) {
  const [items, setItems] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setItems(await api.get("/api/strategies"));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  if (!items) return <Loading />;

  return (
    <div>
      <SectionCard
        title="Teaching Strategies"
        right={canManage(currentUser) && <Button onClick={() => setShowNew((s) => !s)}>{showNew ? "Cancel" : "New strategy"}</Button>}
      >
        <ErrorBanner message={error} />
        {showNew && <StrategyForm onDone={async () => { setShowNew(false); await load(); }} onCancel={() => setShowNew(false)} />}
        {items.length === 0 ? (
          <div style={{ color: T.ink600, fontSize: 13.5, padding: 8 }}>No strategies yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((item) => (
              <StrategyRow key={item.id} strategy={item} canManage={canManage(currentUser)} onChanged={load} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function StrategyForm({ initial, onDone, onCancel }) {
  const [form, setForm] = useState(initial || { name: "", category: CATEGORIES[0], description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));

  async function save() {
    setSaving(true);
    setError("");
    try {
      if (initial) {
        await api.patch(`/api/strategies/${initial.id}`, form);
      } else {
        await api.post("/api/strategies", form);
      }
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, background: T.cream50, marginBottom: 14 }}>
      <ErrorBanner message={error} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <FieldLabel required>Name</FieldLabel>
          <Input value={form.name} onChange={set("name")} />
        </div>
        <div>
          <FieldLabel>Category</FieldLabel>
          <select
            value={form.category}
            onChange={(e) => set("category")(e.target.value)}
            style={{ width: "100%", border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 14.5, color: T.ink900, fontFamily: "inherit", background: "#fff", boxSizing: "border-box" }}
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <FieldLabel>Description</FieldLabel>
          <TextField value={form.description} onChange={set("description")} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <Button onClick={save} disabled={saving || !form.name.trim()}>{saving ? "Saving..." : (initial ? "Save changes" : "Create")}</Button>
        <Button onClick={onCancel} variant="outline">Cancel</Button>
      </div>
    </div>
  );
}

function StrategyRow({ strategy, canManage, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (!window.confirm(`Delete "${strategy.name}"?`)) return;
    setDeleting(true);
    setError("");
    try {
      await api.del(`/api/strategies/${strategy.id}`);
      onChanged();
    } catch (e) {
      setError(e.message);
      setDeleting(false);
    }
  }

  if (editing) {
    return <StrategyForm initial={strategy} onDone={async () => { setEditing(false); await onChanged(); }} onCancel={() => setEditing(false)} />;
  }

  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px", background: "#fff" }}>
      <ErrorBanner message={error} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, color: T.navy900 }}>{strategy.name}</div>
          <div style={{ fontSize: 12.5, color: T.ink600, marginTop: 2 }}>{strategy.category}</div>
          {strategy.description && (
            <div style={{ fontSize: 13.5, color: T.ink900, marginTop: 8, whiteSpace: "pre-wrap" }}>{strategy.description}</div>
          )}
        </div>
        {canManage && (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <Button onClick={() => setEditing(true)} variant="outline" style={{ padding: "6px 12px" }}>Edit</Button>
            <Button onClick={remove} variant="danger" disabled={deleting} style={{ padding: "6px 12px" }}>{deleting ? "..." : "Delete"}</Button>
          </div>
        )}
      </div>
    </div>
  );
}