#!/usr/bin/env node
// Fails if the promoted catalog (engineering/ + productivity/) drifts from
// plugin.json, README listings, docs pages, SKILL.md front matter, or
// agents/openai.yaml invocation flags. Also rejects U+2014 in prose other
// than CHANGELOG.md (historical entries still contain it).
//
// Changes nothing. Exit 0 when the tree matches AGENTS.md; exit 1 with one
// line per violation.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROMOTED = ["engineering", "productivity"];
const SKIP_DIRS = new Set(["node_modules", ".git"]);
const PROSE_EXT = new Set([
  ".md",
  ".json",
  ".yml",
  ".yaml",
  ".sh",
  ".mjs",
  ".js",
  ".html",
  ".css",
  ".txt",
]);
const EMDASH = "\u2014";
const errors = [];

const fail = (msg) => {
  errors.push(msg);
};

const read = (rel) => readFileSync(join(repo, rel), "utf8");

const listSkillDirs = (bucket) => {
  const root = join(repo, "skills", bucket);
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, d.name, "SKILL.md")))
    .map((d) => d.name)
    .sort();
};

const parseFrontmatter = (text, rel) => {
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) {
    fail(`${rel}: SKILL.md must start with YAML front matter (---)`);
    return null;
  }
  const end = text.indexOf("\n---", 4);
  if (end === -1) {
    fail(`${rel}: SKILL.md front matter is not closed`);
    return null;
  }
  const block = text.slice(text.indexOf("\n") + 1, end);
  const fields = {};
  for (const rawLine of block.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (!line.trim()) continue;
    // Nested YAML (metadata.credits, etc.) is ignored; we only need the
    // top-level keys that AGENTS.md names.
    if (/^\s/.test(rawLine.replace(/\r$/, ""))) continue;
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) {
      fail(`${rel}: cannot parse front matter line: ${line}`);
      continue;
    }
    const key = m[1];
    let value = m[2];
    const quoted =
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2);
    if (value.includes(": ") && !quoted) {
      fail(
        `${rel}: description/value for "${key}" contains an unquoted colon-space; wrap it in double quotes so the YAML stays valid`,
      );
    }
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      try {
        value = JSON.parse(value);
      } catch {
        fail(`${rel}: quoted front matter value for "${key}" is not valid JSON-style YAML`);
        continue;
      }
    } else if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
      value = value.slice(1, -1).replace(/''/g, "'");
    } else if (value === "true") {
      value = true;
    } else if (value === "false") {
      value = false;
    }
    fields[key] = value;
  }
  return fields;
};

const openaiHasImplicitFalse = (yaml) =>
  /allow_implicit_invocation:\s*false/.test(yaml);

const walkFiles = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
};

const plugin = JSON.parse(read(".claude-plugin/plugin.json"));
const pluginSkills = Array.isArray(plugin.skills) ? plugin.skills : [];
const pluginByName = new Map();
for (const entry of pluginSkills) {
  if (typeof entry !== "string") {
    fail(`plugin.json skills entry is not a string: ${JSON.stringify(entry)}`);
    continue;
  }
  const norm = entry.replace(/^\.\//, "").replace(/\/$/, "");
  const parts = norm.split("/");
  if (parts.length !== 3 || parts[0] !== "skills") {
    fail(`plugin.json skill path must be ./skills/<bucket>/<name>: ${entry}`);
    continue;
  }
  const [, bucket, name] = parts;
  if (!PROMOTED.includes(bucket)) {
    fail(`plugin.json lists a non-promoted skill: ${entry}`);
    continue;
  }
  pluginByName.set(name, { bucket, entry });
}

const topReadme = read("README.md");
const askMatt = read("skills/engineering/ask-matt/SKILL.md");
const promoted = [];

for (const bucket of PROMOTED) {
  const names = listSkillDirs(bucket);
  const bucketReadmeRel = `skills/${bucket}/README.md`;
  const bucketReadme = read(bucketReadmeRel);
  const userIdx = bucketReadme.indexOf("## User-invoked");
  const modelIdx = bucketReadme.indexOf("## Model-invoked");
  if (userIdx === -1 || modelIdx === -1) {
    fail(`${bucketReadmeRel}: missing ## User-invoked or ## Model-invoked`);
  }
  const userSection =
    userIdx !== -1 && modelIdx !== -1 && userIdx < modelIdx
      ? bucketReadme.slice(userIdx, modelIdx)
      : bucketReadme;
  const modelSection =
    userIdx !== -1 && modelIdx !== -1 && userIdx < modelIdx
      ? bucketReadme.slice(modelIdx)
      : "";

  for (const name of names) {
    const skillRel = `skills/${bucket}/${name}`;
    const skillMdRel = `${skillRel}/SKILL.md`;
    const docsRel = `docs/${bucket}/${name}.md`;
    const openaiRel = `${skillRel}/agents/openai.yaml`;
    const fm = parseFrontmatter(read(skillMdRel), skillMdRel);
    const userInvoked = Boolean(fm && fm["disable-model-invocation"] === true);

    promoted.push({ bucket, name, userInvoked });

    if (fm && fm.name !== name) {
      fail(`${skillMdRel}: front matter name "${fm.name}" does not match directory "${name}"`);
    }
    if (!fm || typeof fm.description !== "string" || !fm.description.trim()) {
      fail(`${skillMdRel}: missing description in front matter`);
    }

    const listed = pluginByName.get(name);
    if (!listed) {
      fail(`${skillRel}: promoted skill is missing from .claude-plugin/plugin.json`);
    } else if (listed.bucket !== bucket) {
      fail(`${skillRel}: plugin.json lists it under ${listed.bucket}, not ${bucket}`);
    }

    const topLink = `./skills/${bucket}/${name}/SKILL.md`;
    if (!topReadme.includes(topLink)) {
      fail(`README.md: missing link ${topLink}`);
    }

    const bucketLink = `./${name}/SKILL.md`;
    const inUser = userSection.includes(bucketLink);
    const inModel = modelSection.includes(bucketLink);
    if (!inUser && !inModel) {
      fail(`${bucketReadmeRel}: missing link ${bucketLink}`);
    } else if (userInvoked && !inUser) {
      fail(`${bucketReadmeRel}: ${name} is user-invoked but listed under Model-invoked`);
    } else if (!userInvoked && !inModel) {
      fail(`${bucketReadmeRel}: ${name} is model-invoked but listed under User-invoked`);
    }

    if (!existsSync(join(repo, docsRel))) {
      fail(`${docsRel}: missing docs page for promoted skill ${name}`);
    }

    if (!existsSync(join(repo, openaiRel))) {
      fail(`${openaiRel}: missing agents/openai.yaml`);
    } else {
      const yaml = read(openaiRel);
      const implicitFalse = openaiHasImplicitFalse(yaml);
      if (userInvoked && !implicitFalse) {
        fail(
          `${openaiRel}: user-invoked skill needs policy.allow_implicit_invocation: false`,
        );
      }
      if (!userInvoked && implicitFalse) {
        fail(
          `${openaiRel}: model-invoked skill must not set allow_implicit_invocation: false`,
        );
      }
    }

    if (name !== "ask-matt" && !askMatt.includes(`/${name}`)) {
      fail(`skills/engineering/ask-matt/SKILL.md: does not mention /${name}`);
    }
  }
}

for (const [name, { bucket, entry }] of pluginByName) {
  if (!promoted.some((s) => s.name === name && s.bucket === bucket)) {
    fail(`plugin.json lists ${entry} but there is no SKILL.md there`);
  }
}

for (const bucket of PROMOTED) {
  const docsDir = join(repo, "docs", bucket);
  if (!existsSync(docsDir)) continue;
  const skillNames = new Set(promoted.filter((s) => s.bucket === bucket).map((s) => s.name));
  for (const file of readdirSync(docsDir)) {
    if (!file.endsWith(".md")) continue;
    const stem = file.slice(0, -3);
    if (skillNames.has(stem)) continue;
    const rel = `docs/${bucket}/${file}`;
    const body = read(rel);
    if (!body.startsWith("> **Archived.**")) {
      fail(`${rel}: extra docs page must be marked archived (promoted skill removed)`);
    }
  }
}

for (const full of walkFiles(repo)) {
  const rel = relative(repo, full).replaceAll("\\", "/");
  if (rel === "CHANGELOG.md") continue;
  const ext = full.slice(full.lastIndexOf("."));
  if (!PROSE_EXT.has(ext)) continue;
  const text = readFileSync(full, "utf8");
  const idx = text.indexOf(EMDASH);
  if (idx !== -1) {
    const line = text.slice(0, idx).split("\n").length;
    fail(`${rel}:${line}: em-dash (U+2014) is forbidden in repo prose`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(e);
  console.error(`check-catalog: ${errors.length} problem(s)`);
  process.exit(1);
}

console.log(
  `check-catalog: ${promoted.length} promoted skills, plugin.json, READMEs, docs, front matter, invocation flags, ask-matt, and prose (no em-dashes) are in sync`,
);
