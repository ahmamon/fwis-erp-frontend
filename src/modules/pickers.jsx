import { useEffect, useState } from "react";
import { useLang } from "../i18n.jsx";
import { api } from "../api";
import { T, FieldLabel, Input, Button } from "../ui";

// Pickers that let teachers start from lists that already exist in the system
// instead of a blank text box — the "minimize manual typing" principle from
// Round 5. Both load their library once and degrade gracefully offline/empty.

// Chip selector over the Teaching Strategies library. `value` is a list of
// strategy NAMES. Toggling a chip adds/removes the name; a name not in the
// library can be typed and added on the fly so teachers are never locked to
// the current library (library management stays with admin/supervisor).
export function StrategyPicker({ label = "Teaching strategies", value = [], onChange, disabled }) {
  const { t } = useLang();
  const [library, setLibrary] = useState(null);
  const [custom, setCustom] = useState("");

  useEffect(() => {
    api.get("/api/strategies").then(setLibrary).catch(() => setLibrary([]));
  }, []);

  const toggle = (name) => {
    onChange(value.includes(name) ? value.filter((s) => s !== name) : [...value, name]);
  };
  const addCustom = () => {
    const name = custom.trim();
    if (!name || value.includes(name)) return;
    onChange([...value, name]);
    setCustom("");
  };

  // Library names plus any current values that aren't in the library (so a
  // custom or previously-saved strategy always renders as a chip). De-duped,
  // library order first, then customs.
  const names = library
    ? [...new Set([...library.map((s) => s.name), ...value])]
    : [];

  return (
    <div>
      <FieldLabel>{t(label)}</FieldLabel>
      {!library ? (
        <div style={{ fontSize: 12.5, color: T.ink600 }}>{t("Loading strategies…")}</div>
      ) : (
        <>
          {names.length === 0 ? (
            <div style={{ fontSize: 12.5, color: T.ink600, marginBottom: 6 }}>
              {t("No strategies yet — add one below, or an admin can build the library in Teaching Strategies.")}
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {names.map((name) => {
                const on = value.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(name)}
                    style={{
                      border: on ? `1px solid ${T.gold600}` : `1px solid ${T.line}`,
                      background: on ? "rgba(198,161,91,0.18)" : "#fff",
                      color: T.ink900, borderRadius: 999, padding: "5px 12px", fontSize: 12.5,
                      fontWeight: 600, cursor: disabled ? "default" : "pointer",
                    }}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}
          {!disabled && (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Input
                value={custom}
                onChange={setCustom}
                placeholder={t("Add a strategy not in the list…")}
                style={{ width: 240 }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
              />
              <Button variant="outline" onClick={addCustom} disabled={!custom.trim() || value.includes(custom.trim())} style={{ padding: "6px 12px" }}>
                {t("Add")}
              </Button>
            </div>
          )}
          {value.length > 0 && (
            <div style={{ fontSize: 11.5, color: T.ink600, marginTop: 6 }}>
              {t("Chosen")}: {value.join(", ")}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Chip row of the school's Resources library. Clicking a resource appends its
// name to the parent free-text field, so the starting point is "choose from
// what exists" and the teacher still edits the wording afterwards.
export function ResourceLibraryPicker({ label = "Choose from the Resources library", value, onChange, disabled }) {
  const { t } = useLang();
  const [library, setLibrary] = useState(null);

  useEffect(() => {
    api.get("/api/resources").then(setLibrary).catch(() => setLibrary([]));
  }, []);

  if (!library) return <div style={{ fontSize: 12.5, color: T.ink600 }}>{t("Loading resources…")}</div>;
  const names = [...new Set(library.map((r) => r.name).filter(Boolean))];
  if (names.length === 0) return null;

  const listed = String(value || "").split(/[,;]/).map((s) => s.trim().toLowerCase());

  const add = (name) => {
    const existing = String(value || "").trim();
    if (listed.includes(name.toLowerCase())) return; // already in the field
    onChange(existing ? `${existing.replace(/,?\s*$/, "")}, ${name}` : name);
  };

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: T.ink600, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
        {t(label)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {names.map((name) => {
          const on = listed.includes(name.toLowerCase());
          return (
            <button
              key={name}
              type="button"
              disabled={disabled}
              onClick={() => add(name)}
              title={on ? t("Already in the field") : t("Add to the field")}
              style={{
                border: on ? `1px dashed ${T.gold600}` : `1px solid ${T.line}`,
                background: on ? "rgba(198,161,91,0.12)" : "#fff",
                color: T.ink900, borderRadius: 999, padding: "4px 11px", fontSize: 12,
                fontWeight: 500, cursor: disabled ? "default" : "pointer", maxWidth: 260,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {name}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: T.ink600, marginTop: 5 }}>
        {t("Click a title to add it to the field below, then adjust the wording as needed.")}
      </div>
    </div>
  );
}