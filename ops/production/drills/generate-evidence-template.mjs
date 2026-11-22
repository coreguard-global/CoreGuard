#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const drill = process.argv[2] || "drill";
const out = process.argv[3] || `ops/production/evidence/${drill}-TEMPLATE.json`;
mkdirSync(resolve(out, ".."), { recursive: true });
const tmpl = {
  status: "TEMPLATE_NOT_EXECUTED",
  drill,
  executedAt: null,
  environment: "REPLACE_TARGET_ENV",
  operator: "REPLACE_OPERATOR",
  inputs: {},
  observations: [],
  metrics: {},
  artifacts: [],
  pass: null,
  notes: "This is a template only. Fill with real evidence collected during an actual drill on a target environment. Do not treat as evidence of execution.",
};
writeFileSync(out, JSON.stringify(tmpl, null, 2) + "\n");
console.log(out);
