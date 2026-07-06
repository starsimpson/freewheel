# Freewheel — Project Handoff / Migration Summary

_Prepared 2026-07-06 for moving this project to another builder's Claude Code._

> **Read this first — what kind of project this is.** This is a **Claude Code CLI**
> project: a local git repository (`/Users/starstar/src/spokecalculator`) pushed to
> GitHub and deployed on Render. It is **not** a Claude.ai "Project," so there is **no
> custom system prompt, no project-level custom instructions, no `CLAUDE.md`, and no
> uploaded knowledge-base documents**. The "knowledge base" is the git repo itself. The
> Claude Code memory store for this project is empty. Where the requested sections assume
> Claude.ai artifacts that don't exist, that is stated explicitly rather than invented.

---

## 1. Project Purpose

**What it is.** A **bicycle spoke-length calculator** — working name **"Spokes,"** repo
name **`freewheel`**. It computes left/right spoke lengths for a wheel build and draws
crisp, to-scale diagrams so the builder can *visually verify the dish and the lacing
before cutting spokes*.

**Origin / why it exists.** It is a deliberate revival of **Freespoke** (kstoerz.com/
freespoke), a beloved calculator that went offline. Freespoke's standout features were
(a) very clear, non-dithered graphical renderings of the wheel that let you confirm
spokes wouldn't overlap the head of the next spoke, and (b) a large rim/hub database.
This project reproduces and improves on both. It also draws on **Roger Musson's**
calculator (spokelength-project.com) for math conventions and terminology, and on
**Damon Rinard's spocalc** for the core formula.

**Who it serves.** Serious/expert wheelbuilders. The owner (Star Simpson) built it; it is
now moving to a **wheelbuilder friend** who will continue development. The audience
expectation drives every design choice: **correctness and trust over feature count.**

**Live + source.**
- Repo: `https://github.com/starsimpson/freewheel.git` (branch `main`)
- Hosting: **Render** static site (blueprint in `render.yaml`), auto-deploys on push to `main`
- Backend for optional login/sync: **Supabase** (see §4 and the migration caveats)

---

## 2. Custom Instructions

**There are none in the Claude.ai sense** (no project custom instructions, no system
prompt authored by the user, no `CLAUDE.md`). Flagged explicitly per the request.

However, a consistent set of **operating conventions** emerged and functioned as de-facto
instructions throughout. Reproduce these in the new environment (consider committing them
as a `CLAUDE.md`):

- **Trust > features.** Never ship math you can't stand behind. When a model (e.g. head
  clearance, 2:1 triplet) is approximate, say so plainly in the UI's "method" note and
  document the assumption. Preferred to *defer* triplet/straight-pull for weeks rather
  than ship an unverified formula.
- **The method note is the product's credibility.** Every number is defined; every
  modelling choice is stated; the whole calculation is one readable file with a test
  suite. "View source and check our work" is the pitch.
- **Static site, no server we run.** Everything is static files. Optional login/sync uses
  a hosted BaaS (Supabase) called directly from the browser — still "no server of ours."
- **Commit and push every change.** The owner reviews on the **live Render deploy**, not
  localhost. End every working session with a commit + `git push origin main`.
- **Commit message co-author trailer:** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **Language:** professional and terse for experts. **No "thinking out loud," no
  editorializing.** (Rejected copy examples: "there's no money in this," "plain,
  hand-editable JSON," "measure twice — rims are rarely perfectly round.")
- **Verify in the browser before committing** (there's a preview harness); check console
  for errors; run `node tests/spoke.test.cjs`.
- Cache-bust `spokecalc.js` with a `?v=N` query when its math changes (currently `v=6`).

---

## 3. Key Decisions and Outcomes

Chronological, grouped. (Commit hashes in parentheses.)

**Architecture & deploy**
- Single static page, calculations in JS, **SVG** diagrams (perfectly non-dithered,
  scalable — the Freespoke aesthetic). (`8985e52`)
- Deployed to Render via `render.yaml` blueprint; owner connects Render↔GitHub. (`8985e52`,`71d5154`)
- **Extracted all pure math into `spokecalc.js`** (a UMD module usable in the browser and
  Node), with a **cross-validating test suite** (`tests/spoke.test.cjs`): regression
  fixtures + a 5000-random-wheel check comparing the closed-form length to an
  independently-coded 3-D coordinate computation (agree to 1e-9). Currently **28/28
  passing**. (`f987ed5`, extended since)

**Core math & terminology (corrections made after builder review)**
- Spoke length: `L = √(R² + r² + f² − 2·R·r·cos θ) − ½·(flange spoke-hole dia)`,
  `θ = crosses × 360 / (spokes on that flange)`. Matches spocalc/Musson.
- **Tension distribution fixed**: tighter side pinned at **100%**, other side shown as its
  true ratio (`∝ 1/(count·sin bracing)`), *not* a share of a shared total. (`8d17058`, `7271fcd`)
- **Hub-hole subtraction relabeled/moved** to the Hub panel (it's a hub dimension). (`d48a95a`)
- **Removed** "Lever arm" and "Theta angle" (Musson-nerd / unexplained); **renamed**
  "Rim entry angle" → **"Wrap angle"**; **added "Total angle at rim"** =
  `acos(cos wrap · cos bracing)` with a user-set red threshold (default 6°). (`7102b05`, `08dbb3e`)
- **Spoke-stretch compensation** (optional): each side stretches by *its own* tension
  share, using a separate **centre gauge** (thin butted section). `ΔL = T·L/(E·A)`. (`3493408`,`7102b05`)
- **Nipple/ERD coupling added then removed** — deemed a "can of worms." (`3493408` add, `08dbb3e` remove)
- **ERD uncertainty band added (#6) then removed** — owner unsure of its utility. (`1498e43` add, `08dbb3e` remove)
- **Head-clearance model — evolved three times; this is the most-scrutinised piece:**
  1. Original hand-wavy `√(gap²+t²) − spoke_gauge` → rejected ("made up," no head dia).
  2. Rebuilt as pure in-plane `clearance = g − head_dia/2 − elbow_gauge/2`,
     `g = p·(cosφ−1) + √(r²−p²)·sinφ`, `p = R·r·sinθ/in-plane`, `φ = 360/nf`. (`7102b05`)
  3. Builder said the resulting negative values (e.g. −1.8 mm for 3× on a 56 mm flange)
     are **"correct math but physically wrong."** Fixed by treating the neighbour head as
     axially offset by the flange thickness: **`clearance = √(g² + flange_thickness²) −
     head_dia/2 − elbow_gauge/2`**. Demo 3× went −1.8 → ~0 mm. (`2a54d85`)
  - **Still flagged as an approximation** in the method note — should be calibrated
    against real builds. This is the single most likely area to still need work.
- **Lacing patterns**: radial + 1×–5× (one length); **crow's foot** (radial+crossed, two
  lengths, needs spokes/side ÷3); **2:1 "triplet"** (drive/right flange gets 2/3 of the
  spokes; per-flange θ and count-weighted tension balance; needs total ÷6) — documented
  with an honest caveat that real 2:1 spaces rim holes slightly unevenly. **Straight-pull**
  hubs (drop the ½-hole J-bend term). (`d48a95a`, `7271fcd`)
- **Offset / asymmetric rims**: every offset rim in the DB carries a per-side drilling
  string (`6.3 L, −6.3 R` = net bed shift; `11 L, 11 R` = widened bed). Determined these
  are **one length per side** and map to the calculator's per-side **drilling offsets
  (oL/oR)**; picking such a rim fills them from the catalogue. (There is also a manual
  single "Rim offset" input.) (`c9271b1`, `2a54d85`)

**The rim/hub database — recovered from the Internet Archive**
- Freespoke is offline, so the DB was **scraped from the Wayback Machine**. The clean
  paginated listing (`/rims?Page=N`, `/hubs?Page=N`) was archived across 2024–2026. Pulled
  every page, parsed by mapping each page's header, deduped. Result: **561 rims, 622 hubs**
  (`data/rims.json`, `data/hubs.json`). Asymmetric L/R flange values are parsed into
  structured fields. (`89a4750`)
- A red-herring: 2015 `/rims/filter??Page=N` captures (double `?`) all returned page 1 —
  the owner corrected the pagination URL, which unblocked the scrape.
- **Provenance model**: every value carries a source tier (`Catalogue` / `Measured` /
  `Mfr spec` / `Community`), shown as a chip. All current data is **`Catalogue`
  (Freespoke via the Archive — unverified)**. The other tiers are wired but unused. (`3493408`)
- Because the DB was saved by the Archive, the site asks users to **donate to the Internet
  Archive** (`archive.org/donate`). (`f8a10c4`)

**Workbench + login/sync**
- **Bench** = a personal shortlist of rims/hubs saved in `localStorage`, with dropdowns on
  the calculator to swap parts without re-typing (the real time-saver vs other tools). Add
  catalogue parts (`+ bench`) or your own; editable in place; plain JSON export/import
  (replace or merge); share-by-link. (`08dbb3e`, `ea2911a`)
- **Login + cross-device sync via Supabase** — opt-in, still static. `cloud.js` loads
  supabase-js from a CDN, email **magic-link** sign-in; signed-in, the bench syncs to a
  per-user row protected by RLS. Signed out = local-only. **Magic-link confirmed working.** (`5f0725f`)
- **Framing decision**: the "your data is only on this device" warning is about
  **portability** (it won't travel with you), **not privacy** — nobody cares if rim
  dimensions leave the device. (`3975b4c`)

**UX**
- Tabs: **Calculator · Bench · Rims · Hubs**. The former "Measure" tab (two-spoke ERD
  helper + hub-dimension helper) was **folded into the Bench page**. (`edd1caa`)
- **Print/PDF**: `@media print` layout — compact build summary (rim/hub names + spec) +
  results table + the three diagrams on one page. Fixed a page-overflow where the tall
  dish SVG spilled to page 2 (explicit per-SVG height caps). (`3415f22`, `ad30425`)

---

## 4. Work in Progress / Open Items

**Migration blockers (accounts tied to the current owner) — most important:**
- **Supabase** project is Star's: URL `https://ohqokgotuyxodempqhho.supabase.co` +
  publishable key are **hardcoded in `cloud.js`**. The `benches` table + Row-Level-Security
  policies were created by running the SQL in `README`/handoff. The new builder should
  either (a) be given access to this project, or (b) create **their own** Supabase project,
  run the table+RLS SQL, and replace the two constants at the top of `cloud.js`. (Publishable
  key is public by design; RLS protects data.)
- **Render + GitHub** deploy is Star's. The new builder forks/clones the repo, connects
  their own Render (New → Blueprint, picks up `render.yaml`), and adds their live URL +
  `http://localhost:8770` to Supabase **Auth → URL Configuration** (Site URL + Redirect
  URLs) so magic-link returns work.

**Open technical items:**
- **Head-clearance calibration.** The 3-D model (`√(g²+ft²) − head/2 − elbow/2`) is an
  approximation and explicitly labelled so. Run real builds and check the numbers against
  wheels known to lace (or foul) — the **flange-thickness term is the honest knob**.
- **Print layout** was fixed but couldn't be verified in a true print preview from the dev
  harness — eyeball a live Cmd-P and nudge `#svgDish{max-height}` / lacing `max-height` if
  needed.
- **Auth email limits.** Supabase built-in email has low rate limits (fine personal, add
  custom SMTP for real traffic). **Google sign-in** not implemented (needs a provider
  config in Supabase); email magic-link only.
- **Catalogue growth + provenance.** Data is all unverified "Catalogue." Growing it and
  surfacing measured/manufacturer/community tiers is the big content project.
- **Alternating-within-flange offset drilling** does **not** occur in the current DB (all
  offset rims are per-side / one length per side). If a genuinely alternating rim ever
  appears it would need a two-length model like crow's foot — noted as a limit.
- **2:1 triplet** length is the even-rim-hole approximation (real 2:1 is ~0.16-cross off);
  documented, acceptable, but could be refined if a builder wants exactness.

---

## 5. Knowledge Base Contents

No uploaded documents exist (see the preamble). The "knowledge base" is the **git repo**.
Every tracked file and what it contributes:

| File | What it is / contributes |
|---|---|
| `index.html` | The **calculator** (main app). Inputs (Rim/Hub/Spoke/Build panels + Bench picker), results table, the three SVG diagrams (dish cross-section, per-flange lacing overview, zoomed hub-detail), the collapsible **method note** (all formulas + honest caveats), print CSS, and all the calculator-side JS (read inputs, render, draw, permalink/localStorage state, bench pickers). Loads `spokecalc.js`, `bench.js`, `cloud.js`. |
| `spokecalc.js` | **All pure spoke math, no DOM.** UMD module (`window.SpokeCalc` / Node `require`). Functions: `parsePattern`, `patternLabel`, `side`, `sideGroups`, `buildPlan`, `compute`. Shared by the page and the tests. **Bump `?v=N` in `index.html` when this changes.** |
| `tests/spoke.test.cjs` | Node test suite for `spokecalc.js`. Run `node tests/spoke.test.cjs` or `npm test`. Regression fixtures + properties (radial closed form, monotonic cross, tension pinning, crow's foot, stretch, total angle, straight-pull, rim offset, clearance-vs-thickness) + the 5000-wheel closed-form-vs-3D-coordinate cross-check. **28 passing.** |
| `bench.js` | The personal **workbench** API over `localStorage` (`window.Bench`): load/save, add/update/remove rim & hub, dedupe, JSON export/import, `onChange` hook (for sync). |
| `cloud.js` | **Optional** Supabase login + bench sync (`window.Cloud`). Loads supabase-js from CDN, email magic-link auth, merges local+remote bench on sign-in, debounced push on change. **Contains the Supabase URL + publishable key.** |
| `bench.html` | The **Bench page**: Account panel (sign in/out), device-local/synced banner, editable Rims & Hubs tables, the folded-in **Measure** tools (two-spoke ERD helper + hub flange-dimension helper), and Export/Import + share-link. |
| `rims.html` | Browsable **rim database** (sortable/filterable table, Source chips). Row actions: `+ bench` and `use` (sends ERD + parsed per-side offsets to the calculator). |
| `hubs.html` | Browsable **hub database**, same pattern; `use` sends flange diameter + centre-to-flange (L/R) to the calculator. |
| `data/rims.json` | **561 rims** scraped from the Archive. Fields incl. mfg, model, iso, erd, offsetDrilling, offsetAvg, widths, weight. |
| `data/hubs.json` | **622 hubs**. Fields incl. mfg, model, position, oln, axle/brake/drive, flangeDia L/R, flangeOff L/R, midFlangeOffset, weight. |
| `render.yaml` | Render static-site blueprint (build = none, publish = repo root, cache header). |
| `package.json` | Just the `test` script (`node tests/spoke.test.cjs`). No dependencies. |
| `README.md` | Short project readme (features, run locally, deploy). |
| `.gitignore` | Ignores `.DS_Store`, `.claude/`, `node_modules/`. |
| `HANDOFF.md` | This document. |

**Deleted along the way:** `measure.html` (its two tools were folded into `bench.html`).
**Not tracked but present locally:** `.claude/launch.json` (preview dev-server config for
`python3 -m http.server 8770`), gitignored.

---

## 6. Recurring Context (preferences, constraints, terminology)

- **Audience:** expert wheelbuilders. Assume domain fluency; don't over-explain.
- **Correctness/trust is the north star.** Approximate models must say so. The method note
  is sacred.
- **Voice:** terse, professional, no thinking-out-loud, no editorializing about openness/
  privacy/ethos. Utility over ideology.
- **Portability, not privacy**, is the frame for local-vs-synced bench data.
- **Terminology (use these):** ERD (effective rim diameter), flange **PCD**, **centre-to-
  flange**, **bracing angle**, **wrap angle** (side-view spoke-to-rim), **total angle at
  rim** (3-D nipple misalignment), **dish**, **crow's foot**, **2:1 / triplet**, **J-bend /
  straight-pull**, **flange thickness**, **elbow gauge / centre gauge**, **head diameter**,
  **offset / asymmetric rim**, **drilling offset**. **Do NOT use:** "lever arm," "theta
  angle," "rim entry angle," "effective tangential PCD" (all removed as jargon/unclear).
- **Workflow:** verify in the browser preview → run tests → **commit + push to `main`** →
  owner reviews on the live Render URL. Use the `Co-Authored-By: Claude Opus 4.8` trailer.
- **Handoff pattern:** catalogue/measure tools write to `localStorage` (`spokes.state` for
  the calculator, `spokes.bench` for the bench); the calculator reads them on load. A full
  build spec also round-trips through the **URL hash** (shareable permalink).
- **Diagrams must stay crisp** (SVG, non-dithered) — that clarity is the whole point vs
  other calculators.

**Q&A on record (questions asked + answers given):**
- **"Which should I build next?"** (formal multiple-choice) → **"2 then 1 then 3"** =
  ① Triplet + straight-pull, then ② Login + sync, then ③ Share-by-link polish. *(All three
  are now done.)*
- **"Can we do the login layer and keep it a static site?"** → Yes, via a hosted BaaS
  (Supabase) called from the browser; owner chose to proceed.
- **Supabase setup options** → recommended **Data API: ON, auto-expose new tables: OFF,
  automatic RLS: ON** (secure by default); owner enabled accordingly and ran the table+RLS
  SQL.
- **Open design questions raised but not hard-locked:** data-trust posture (broad
  manufacturer-seed vs small-and-measured), whether to accept community submissions early,
  and preferred auth provider. Direction that emerged: seed from the Archive catalogue
  (marked unverified), email magic-link auth.

---

## 7. Recommended Starting Prompt

Paste this into the new project's first conversation:

> I'm taking over development of **Freewheel** (working name "Spokes"), a static bicycle
> spoke-length calculator that revives the offline **Freespoke** and borrows math
> conventions from Roger Musson's calculator and Damon Rinard's spocalc. The code is a git
> repo (GitHub `starsimpson/freewheel`, deployed on Render as a static site). Read
> `HANDOFF.md` at the repo root first — it has the full history, decisions, and file map.
>
> Key things to honour: **correctness and trust over features** — never ship spoke math I
> can't stand behind, and keep the collapsible "method note" in `index.html` accurate
> (every formula defined, every approximation flagged). All pure math lives in
> `spokecalc.js` (shared with `tests/spoke.test.cjs` — run `node tests/spoke.test.cjs`,
> currently 28 passing; bump `spokecalc.js?v=N` in `index.html` when the math changes).
> Voice is terse and professional for expert wheelbuilders — no thinking-out-loud, no
> editorializing. The rim/hub DB (`data/*.json`, 561 rims / 622 hubs) was scraped from the
> Internet Archive and is all unverified "Catalogue" provenance. The optional login/sync is
> Supabase (keys in `cloud.js`) — I'll need to point it at **my own** Supabase project
> (create it, run the `benches` table + RLS SQL, swap the URL/key) and my own Render deploy.
> Workflow: verify in the browser, run tests, then commit + push to `main` (I review on the
> live Render URL); commit trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
>
> The most likely thing that still needs work is the **head-clearance model** — it's an
> approximation (`√(g² + flange_thickness²) − head/2 − elbow/2`) and should be calibrated
> against real builds. To start: read `HANDOFF.md` and `index.html`'s method note, run the
> tests, and confirm the app builds and the calculator computes a sane result for a
> standard 32h 622 wheel.
