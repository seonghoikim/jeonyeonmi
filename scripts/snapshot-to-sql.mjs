// Turns a snapshot into the SQL that restores it.
//   node scripts/snapshot-to-sql.mjs portfolio_state.json > restore.sql
import { readFileSync } from "node:fs";
import { toRestoreSql } from "./lib/backup.mjs";

const file = process.argv[2];
if (!file) { console.error("usage: snapshot-to-sql.mjs <snapshot.json>"); process.exit(2); }
process.stdout.write(toRestoreSql(JSON.parse(readFileSync(file, "utf-8"))));
