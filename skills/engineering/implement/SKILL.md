---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

Before starting, record the current commit with `git rev-parse HEAD`. This is the fixed point for the final review.

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, commit your work to the current branch.

Then use /code-review to review the work, supplying the recorded pre-work commit as the fixed point. Address any findings in follow-up commits.
