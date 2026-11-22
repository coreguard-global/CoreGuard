#!/usr/bin/env node
import { readFileSync } from "node:fs";
const file = process.argv[2] || "ops/production/env.example";
const s = readFileSync(file, "utf8");
const required = ["NODE_ENV","PORT","CGCP_STORE_MODE","DATABASE_URL","AUTH_MODE","KMS_PROVIDER","ANCHOR_PROVIDER","OTEL_EXPORTER_OTLP_ENDPOINT"];
const missing = required.filter(k => !new RegExp(`^${k}=`, "m").test(s));
const placeholders = ["REPLACE","example.com","USER:PASSWORD","cgcp_dev_only"];
const found = placeholders.filter(p => s.includes(p));
console.log(JSON.stringify({ ok: missing.length===0, missing, placeholderWarnings: found, note: "env.example is a template; placeholders must be replaced in real target env." }, null, 2));
if (missing.length) process.exit(2);
