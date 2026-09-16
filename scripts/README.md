# i18n scripts

Guard rails for the EN/AR/FR translation layer. Keys are the English source
strings (see `src/i18n.jsx`); a missing key silently falls back to English, so
these scripts are the only way to catch gaps before they ship.

## `npm run i18n:keys`
Lists every key referenced through `t()` in the frontend source:
literal `t("...")`, ternary `t(c ? "a" : "b")`, and `t(\`...\`)` calls.
Useful to eyeball the referenced surface, and as the input to the verifier.

## `npm run i18n:verify`  ← run after any UI change
The integration gate. Exits non-zero (red) on any of:

1. **Missing literal keys** — a `t("…")` in source that isn't in `ar.js`/`fr.js`.
2. **Missing dynamic keys** — values of data arrays that reach `t(variable)`
   (report columns/tabs, calendar types + weekday abbreviations, admin tiles,
   users chip labels, picker/field labels, lesson statuses). These are
   invisible to literal extraction, so the `DYNAMIC` list in the script
   enumerates them by module — keep it in sync when a module adds translated
   array values (mirror each entry as an English key in both dictionaries).
3. **Dict hygiene** — duplicate keys and empty/non-string values.

Run it alongside `npm run build` after any `t()` change:

```sh
npm run i18n:verify && npm run build
```