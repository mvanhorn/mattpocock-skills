---
"mattpocock-skills": patch
---

`npm run check` now verifies the promoted catalog against this repo's own rules: every engineering and productivity skill is in the plugin manifest and both READMEs, has a docs page, has valid SKILL.md front matter, matches its `agents/openai.yaml` invocation flag, and is named by `ask-matt`. It also rejects em-dashes in prose other than CHANGELOG.md.
