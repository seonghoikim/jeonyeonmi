// Read-only: asks Supabase's log analytics where Storage traffic (cached egress) came from.
// Runs from the "Investigate egress" workflow with SUPABASE_ACCESS_TOKEN. The repo is public,
// so the output is deliberately limited to file paths, user-agents and byte counts — never IPs.
const ref = process.env.PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) { console.error("PROJECT_REF / SUPABASE_ACCESS_TOKEN missing"); process.exit(1); }

const HOUR = 3600 * 1000;
async function run(label, sql, startMs, endMs) {
  const url = new URL(`https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/logs.all`);
  url.searchParams.set("sql", sql);
  url.searchParams.set("iso_timestamp_start", new Date(startMs).toISOString());
  url.searchParams.set("iso_timestamp_end", new Date(endMs).toISOString());
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  console.log(`\n=== ${label} [${new Date(startMs).toISOString()} → ${new Date(endMs).toISOString()}] HTTP ${res.status}`);
  let body; try { body = JSON.parse(text); } catch { console.log(text.slice(0, 500)); return []; }
  if (body.error || !res.ok) { console.log(JSON.stringify(body).slice(0, 600)); return []; }
  const rows = body.result ?? [];
  if (!rows.length) console.log("(no rows)");
  for (const r of rows) console.log(JSON.stringify(r));
  return rows;
}

const FROM = `from edge_logs as el
  cross join unnest(el.metadata) as m
  cross join unnest(m.request) as r
  cross join unnest(r.headers) as h
  cross join unnest(m.response) as resp
  cross join unnest(resp.headers) as rh`;
const STORAGE = `r.path like '/storage/v1/object/public/%'`;

const now = Date.now();
const windows = [0, 1, 2, 3].map((i) => [now - (i + 1) * 24 * HOUR, now - i * 24 * HOUR]);

for (const [s, e] of windows) {
  await run("log coverage", `select count(*) as n, min(timestamp) as first_us, max(timestamp) as last_us from edge_logs`, s, e);
  const byUa = await run("storage reads by user-agent",
    `select h.user_agent as ua, count(*) as n, sum(cast(rh.content_length as int64)) as bytes ${FROM} where ${STORAGE} group by ua order by bytes desc limit 25`, s, e);
  if (!byUa.length) await run("storage reads by user-agent (count only)",
    `select h.user_agent as ua, count(*) as n ${FROM} where ${STORAGE} group by ua order by n desc limit 25`, s, e);
  await run("storage reads by file",
    `select r.path as path, count(*) as n, sum(cast(rh.content_length as int64)) as bytes ${FROM} where ${STORAGE} group by path order by bytes desc limit 25`, s, e);
  await run("storage reads by status",
    `select resp.status_code as status, count(*) as n, sum(cast(rh.content_length as int64)) as bytes ${FROM} where ${STORAGE} group by status order by n desc`, s, e);
  await run("storage reads per hour",
    `select timestamp_trunc(el.timestamp, hour) as hour, count(*) as n, sum(cast(rh.content_length as int64)) as bytes ${FROM} where ${STORAGE} group by hour order by hour`, s, e);
  await run("distinct clients (count only)",
    `select count(distinct h.x_real_ip) as clients ${FROM} where ${STORAGE}`, s, e);
}
