# HTML Report Format

The architectural review is a single self-contained HTML file in the OS temp directory. Copy [scaffold.html](scaffold.html), fill in the candidates, and write it there. All layout and colour live in the `<style>` block in that file. Do not add `<script>` tags. Do not load fonts, CSS, or diagram libraries from the network: a blocked fetch leaves the report unreadable, and you never see that because you do not render the page.

Diagrams are hand-built HTML and inline SVG. Mix the patterns below. Do not lean on one shape for every card.

## Scaffold

Start from `scaffold.html`. Keep its `<style>` block byte-for-byte. Replace the title, date, candidate articles, and the top-recommendation section. The example card ("Collapse the Order intake pipeline") is a filled-in specimen: delete it once your real candidates are in.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Architecture review for {{repo name}}</title>
    <!-- paste the <style> block from scaffold.html, unchanged -->
  </head>
  <body>
    <main>
      <header>
        <h1>Architecture review for {{repo name}}</h1>
        <p class="meta">{{date}}</p>
        <div class="legend">
          <span><i class="swatch solid"></i> module</span>
          <span><i class="swatch dashed"></i> seam</span>
          <span><i class="swatch leak"></i> leakage</span>
          <span><i class="swatch deep"></i> deep module</span>
        </div>
      </header>
      <section id="candidates">...</section>
      <section id="top-recommendation">...</section>
    </main>
  </body>
</html>
```

## Header

Repo name, date, and the compact legend already in the scaffold. No introduction paragraph. Straight into the candidates.

## Candidate card

The diagrams carry the weight. Prose is sparse, plain, and uses the glossary terms (from the `/codebase-design` skill) without ceremony.

Each candidate is one `<article class="candidate" id="...">`:

- **Title**: short, names the deepening (e.g. "Collapse the Order intake pipeline").
- **Badge row**: recommendation strength (`badge strong`, `badge explore`, `badge speculative`) plus a tag for the dependency category (`in-process`, `local-substitutable`, `ports & adapters`, `mock`).
- **Files**: a `<ul class="files">` of monospaced paths.
- **Before / After diagram**: the centrepiece. Two columns, `.diagrams` > `.diagram`. See patterns below.
- **Problem**: one sentence. What hurts.
- **Solution**: one sentence. What changes.
- **Wins**: bullets, ≤6 words each. e.g. "Tests hit one interface", "Pricing logic stops leaking", "Delete 4 shallow wrappers".
- **ADR callout** (if applicable): `<div class="adr">` with one line.

No paragraphs of explanation. If the diagram needs a paragraph to be understood, redraw the diagram.

## Diagram patterns

Pick the pattern that fits the candidate. Mix them. Don't make every diagram look the same. Variety is part of the point.

### Boxes and arrows (the workhorse for dependencies / call flow)

Modules as `.mod.shallow`, `.mod.deep`, or `.mod.ghost`. Arrows as `.arrow` or `.arrow.leak`. Use this when the point is "X calls Y calls Z, and look at the mess." The scaffold's Order intake card is this pattern.

```html
<div class="diagrams">
  <div class="diagram">
    <h3>Before</h3>
    <div class="mod shallow">OrderHandler</div>
    <div class="arrow">calls</div>
    <div class="mod shallow">OrderValidator</div>
    <div class="arrow leak">leak → PricingClient</div>
  </div>
  <div class="diagram">
    <h3>After</h3>
    <div class="mod deep">Order intake</div>
    <div class="arrow">one interface</div>
    <div class="mod ghost">validator, repo (internal)</div>
  </div>
</div>
```

### Inline SVG (when you need a real arrow or a mass diagram)

Modules as labelled `<rect>`s, edges as `<line>` or `<path>`. Reach for this when the "after" diagram should feel like one thick-bordered deep module with greyed-out internals, or when two rectangles (interface vs implementation) have to sit at different heights. Keep the SVG inside `.diagram` and size it to ~320px tall.

```html
<svg viewBox="0 0 280 160" width="100%" height="160" aria-hidden="true">
  <rect x="16" y="20" width="110" height="36" fill="none" stroke="#0f172a" />
  <text x="71" y="42" text-anchor="middle" font-size="11">OrderHandler</text>
  <line x1="71" y1="56" x2="71" y2="88" stroke="#dc2626" stroke-width="2" />
  <text x="88" y="78" font-size="10" fill="#dc2626">leak</text>
  <rect x="16" y="88" width="110" height="36" fill="none" stroke="#dc2626" />
  <text x="71" y="110" text-anchor="middle" font-size="11">PricingClient</text>
</svg>
```

Special characters in SVG text (`<`, `&`) must be escaped. Quote any label that would break the parser.

### Cross-section (good for layered shallowness)

Stack `.mod` bands to show layers a call passes through. Before: 6 thin shallow bands each doing nothing. After: 1 thick `.mod.deep` labelled with the consolidated responsibility.

### Mass diagram (good for "interface as wide as implementation")

Two rectangles per module, as inline SVG: one for interface surface area, one for implementation. Before: interface rectangle is nearly as tall as the implementation rectangle (shallow). After: interface rectangle is short, implementation rectangle is tall (deep).

### Call-graph collapse

Before: a tree of function calls as nested `.mod.shallow` boxes. After: the same tree collapsed into one `.mod.deep`, with the now-internal calls shown as `.mod.ghost` inside it.

## Style guidance

- Lean editorial, not corporate-dashboard. Generous whitespace. Headings are serif already (`h1, h2, h3` in the scaffold).
- Colour sparingly: the stylesheet already gives you emerald (`strong`), amber (`explore` / `.adr`), red (`.arrow.leak`), and a thick dark deep module. Do not invent a fifth accent.
- Keep diagrams ~320px tall so before/after sits side by side without scrolling.
- Module labels inside diagrams use the `.mod` uppercase tracking. They read as schematic, not as UI.
- The only CSS is the scaffold's `<style>` block. The report is otherwise static: no scripts, no network, no interactivity.

If you need a rule the scaffold does not have (a dashed seam line, a second column width), add it as a few lines in `<style>`. Do not pull in a class name from a utility library that is not defined there: it will do nothing, and the page will look unstyled in that spot.

## Top recommendation section

One larger card (`#top-recommendation`). Candidate name as an in-page link to its `id`, one sentence on why. That's it.

## Tone

Plain English, concise, but the architectural nouns and verbs come straight from the `/codebase-design` skill. Concision is not an excuse to drift.

**Use exactly:** module, interface, implementation, depth, deep, shallow, seam, adapter, leverage, locality.

**Never substitute:** component, service, unit (for module) · API, signature (for interface) · boundary (for seam) · layer, wrapper (for module, when you mean module).

**Phrasings that fit the style:**

- "Order intake module is shallow: interface nearly matches the implementation."
- "Pricing leaks across the seam."
- "Deepen: one interface, one place to test."
- "Two adapters justify the seam: HTTP in prod, in-memory in tests."

**Wins bullets** name the gain in glossary terms: *"locality: bugs concentrate in one module"*, *"leverage: one interface, N call sites"*, *"interface shrinks; implementation absorbs the wrappers"*. Don't write *"easier to maintain"* or *"cleaner code"*, because those terms aren't in the glossary and don't earn their place.

No hedging, no throat-clearing, no "it's worth noting that…". If a sentence could be a bullet, make it a bullet. If a bullet could be cut, cut it. If a term isn't in the `/codebase-design` glossary, reach for one that is before inventing a new one.
