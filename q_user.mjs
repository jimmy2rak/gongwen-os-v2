import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
const env = readFileSync(".env","utf8");
const get = (k)=>{ const m = env.match(new RegExp("^"+k+"=(.*)$","m")); return m? m[1].trim():null; };
const url = get("DATABASE_URL");
const db = createClient({ url, authToken: get("DATABASE_AUTH_TOKEN") || undefined });
const rows = await db.execute("SELECT id, email, name, role FROM users LIMIT 3");
console.log("用户数:", rows.rows.length);
for (const r of rows.rows) console.log("  id=",r.id, "| email=",r.email, "| name=",r.name, "| role=",r.role);
