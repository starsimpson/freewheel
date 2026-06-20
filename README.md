# freewheel

A bicycle spoke length calculator with crisp, to-scale diagrams — verify the dish
and the lacing **before** you cut. In the spirit of the late, great *Freespoke*.

It's a single static `index.html`: all calculations run in your browser, nothing is
sent anywhere.

## Features

- Spoke length per side from the standard triangle
  `L = √(R² + r² + f² − 2·R·r·cos θ) − ½·hole`.
- A **to-scale dish cross-section** showing the bracing triangle and flange offsets.
- A **lacing overview** per flange (full crossing pattern).
- A **zoomed hub detail** per flange that draws the spoke heads (head-in / head-out)
  so you can *see* whether a head fouls its crossing neighbour.
- A physically-grounded **head-clearance model**:
  `clearance = √(gap² + flange_thickness²) − spoke_gauge`.
- A **spoke-length rounding helper** (nearest mm, and nearest even length).
- Derived numbers: bracing angle, tension distribution, flange exit / wrap angles,
  effective tangential PCD, theta.
- Shareable permalinks — the full wheel spec lives in the URL hash.

## Develop locally

It's just a file. Open `index.html`, or serve the folder:

```sh
python3 -m http.server 8770
# then visit http://localhost:8770/
```

## Deploy

Configured for [Render](https://render.com) as a static site via `render.yaml`.
In the Render dashboard: **New → Blueprint**, point it at this repo, and it will pick
up the blueprint automatically. Any static host (GitHub Pages, Netlify, Cloudflare
Pages) works too — just publish the repo root.
