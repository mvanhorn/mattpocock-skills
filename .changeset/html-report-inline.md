---
"mattpocock-skills": patch
---

`improve-codebase-architecture` now copies a self-contained `scaffold.html` with inline CSS and hand-built diagrams. The HTML report no longer loads styles or diagrams from the network, so it still reads when a fetch is blocked or the machine is offline.
