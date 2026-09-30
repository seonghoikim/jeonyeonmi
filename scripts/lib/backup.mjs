// Helpers for the portfolio backup: a deterministic JSON dump (so a git diff shows only
// real changes) and a generator for the SQL that puts a snapshot back.

// Every content column of portfolio_state (id and updated_at are handled separately).
export const RESTORABLE_COLUMNS = [
  "content", "current_exhibitions", "artworks", "series_list", "slides", "exhibitions",
  "activity_photos", "videos", "contacts", "press", "settings", "image_urls",
];

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys); // array order is content (drag-reorder), keep it
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}

export function stableStringify(value) {
  return JSON.stringify(sortKeys(value), null, 2) + "\n";
}

export function summarize(row) {
  const n = (k) => (Array.isArray(row?.[k]) ? row[k].length : 0);
  return `works=${n("artworks")} current_ex=${n("current_exhibitions")} history=${n("exhibitions")} press=${n("press")} videos=${n("videos")} slides=${n("slides")}`;
}

// A snapshot only counts if it looks like a real, populated row — never back up an error
// page or an empty row over a good history.
export function assertLooksValid(row) {
  if (!row || typeof row !== "object") throw new Error("no row");
  if (!row.content || typeof row.content !== "object") throw new Error("row has no content");
  if (!Array.isArray(row.artworks) || row.artworks.length === 0) throw new Error("row has no artworks");
  if (!row.updated_at) throw new Error("row has no updated_at");
}

export function toRestoreSql(row) {
  assertLooksValid(row);
  const tag = "$portfolio_restore$";
  const sets = RESTORABLE_COLUMNS.map((col) => {
    const json = JSON.stringify(row[col] ?? (["content", "settings", "image_urls"].includes(col) ? {} : []));
    if (json.includes(tag)) throw new Error(`data contains the quoting tag in ${col}`);
    return `  ${col} = ${tag}${json}${tag}::jsonb`;
  });
  return [
    `-- Restores portfolio_state to the snapshot taken when the row's updated_at was ${row.updated_at}.`,
    `-- Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.`,
    `-- It overwrites the site's current content. updated_at becomes now(), so any editor tab that is`,
    `-- still open will be told a newer version exists instead of silently saving over this one.`,
    `update public.portfolio_state set`,
    `${sets.join(",\n")},`,
    `  updated_at = now()`,
    `where id = 1;`,
    ``,
  ].join("\n");
}
