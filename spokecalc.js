/*
 * spokecalc.js — the pure spoke-length math, with no DOM.
 * Shared by index.html (the calculator UI) and tests/spoke.test.cjs.
 * Loadable as a browser global (window.SpokeCalc) or a Node module (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SpokeCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  "use strict";

  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const E_STEEL = 200000;   // N/mm^2, Young's modulus for stainless spokes
  const KGF = 9.80665;      // N per kgf
  const NIP_REF = 12;       // ERD is taken as measured to a 12 mm nipple's slot

  // A pattern is fully described, for spoke-length purposes, by the crossings it
  // uses. parsePattern turns a UI code ("3", "cf2", ...) into {type, cross}.
  function parsePattern(code) {
    code = String(code);
    if (code[0] === 'c' && code[1] === 'f') return { type: 'crowsfoot', cross: parseInt(code.slice(2)) || 2 };
    return { type: 'cross', cross: Math.max(0, parseInt(code) || 0) };
  }
  function patternLabel(pat) {
    if (pat.type === 'crowsfoot') return "crow's foot " + pat.cross + '×';
    return pat.cross === 0 ? 'radial' : pat.cross + '-cross';
  }

  // core spoke geometry for one side.
  // w: center-to-flange, d: flange PCD, x: crosses, sign: -1 left / +1 right
  function side(v, w, d, x, sign) {
    const R = v.erd / 2;                 // rim spoke-bed radius
    const r = d / 2;                     // flange spoke-hole radius
    const theta = x * 720 / v.n;         // deg subtended at axle
    const th = theta * D2R;
    // axial distance flange->nipple. Hub offset shifts hub toward +(right);
    // drilling offset moves this side's nipple outward (away from center).
    const o = (sign < 0) ? v.oL : v.oR;
    const f = Math.abs(w + sign * v.ho - o);   // drilling offset moves the nipple toward its own flange
    const inPlane = Math.sqrt(R * R + r * r - 2 * R * r * Math.cos(th)); // chord in wheel plane
    const lenGeo = Math.sqrt(inPlane * inPlane + f * f) - v.sd / 2;  // geometric; stretch applied later, per side
    const brace = Math.atan2(f, inPlane) * R2D;
    // perpendicular distance from the axle to the spoke line
    const tang = (inPlane > 0) ? (R * r * Math.sin(th)) / inPlane : 0;
    const exit = Math.asin(Math.min(1, tang / r)) * R2D;    // off-radial at hub (90 = tangential)
    const wrap = Math.asin(Math.min(1, tang / R)) * R2D;     // off-radial at rim (side view)
    // total nipple misalignment: combine the in-plane wrap with the edge-on bracing
    const total = Math.acos(Math.cos(wrap * D2R) * Math.cos(brace * D2R)) * R2D;
    // ---- spoke head clearance ----
    // The crossing neighbour one hole over has its head/elbow sitting at its hole.
    // Treat both as circles in the flange plane: clearance = (perpendicular distance
    // from that hole to this spoke's line) - (head radius) - (this spoke's elbow radius).
    // We do NOT credit flange thickness — adjacent heads can foul across the flange.
    const phi = (720 / v.n) * D2R;       // angular hole spacing on the flange
    const gapLine = tang * (Math.cos(phi) - 1) + Math.sqrt(Math.max(0, r * r - tang * tang)) * Math.sin(phi);
    const clr = gapLine - (v.headD || 0) / 2 - (v.sg || 0) / 2;
    return { R, r, theta, th, f, inPlane, lenGeo, len: lenGeo, brace, tang, exit, wrap, total, gapLine, clr, x };
  }

  // spoke groups (each its own length); crow's foot = radial + crossed
  function sideGroups(v, w, d, pat, sign) {
    const nf = v.n / 2;
    let defs, valid = true;
    if (pat.type === 'crowsfoot') {
      valid = Number.isInteger(nf / 3);
      defs = [{ label: 'radial', cross: 0, count: nf / 3 },
              { label: pat.cross + '×', cross: pat.cross, count: 2 * nf / 3 }];
    } else {
      defs = [{ label: pat.cross === 0 ? 'radial' : pat.cross + '×', cross: pat.cross, count: nf }];
    }
    const groups = defs.map(g =>
      Object.assign(side(v, w, d, g.cross, sign), { label: g.label, count: g.count }));
    return { groups, valid };
  }

  // per-hole drawing plan: rim-hole angular offset for each of the nf hub holes
  function buildPlan(pat, nf, n) {
    const plan = [];
    if (pat.type === 'crowsfoot') {
      const cd = pat.cross * 720 / n;
      for (let i = 0; i < nf; i++) { const m = i % 3;
        plan.push(m === 0 ? { off: 0, radial: true } : { off: (m === 1 ? cd : -cd), radial: false }); }
    } else {
      const cd = pat.cross * 720 / n;
      for (let i = 0; i < nf; i++) plan.push({ off: (i % 2 === 0 ? cd : -cd), radial: pat.cross === 0 });
    }
    return plan;
  }

  function compute(v) {
    const buildSide = (w, d, code, sign) => {
      const pat = parsePattern(code);
      const { groups, valid } = sideGroups(v, w, d, pat, sign);
      // the primary (largest-cross) group drives the angle rows, clearance & diagrams
      const primary = groups.reduce((a, b) => b.x > a.x ? b : a, groups[0]);
      const s = Object.assign({}, primary);
      s.groups = groups; s.valid = valid; s.pattern = pat;
      s.label = patternLabel(pat); s.plan = buildPlan(pat, v.n / 2, v.n);
      return s;
    };
    const L = buildSide(v.wL, v.dL, v.xL, -1);
    const Rt = buildSide(v.wR, v.dR, v.xR, +1);
    // Tension balance: for the wheel to sit centered the lateral force components
    // must cancel, so T*sin(bracing) is equal on both sides -> tension is inversely
    // proportional to sin(bracing). Express each side relative to the higher-tension
    // (tighter) side, which is pinned at 100%; the shallower-braced side is highest.
    const sL = Math.max(1e-4, Math.sin(L.brace * D2R));
    const sR = Math.max(1e-4, Math.sin(Rt.brace * D2R));
    const invL = 1 / sL, invR = 1 / sR, mx = Math.max(invL, invR);
    L.tens = 100 * invL / mx;
    Rt.tens = 100 * invR / mx;
    // spoke-stretch compensation (optional): each side stretches by its OWN tension
    // share (not the full build tension), and a spoke elongates in its thin centre
    // section -> use the centre gauge. dL = T*L/(E*A); cut the spoke that much shorter.
    const areaC = Math.PI * (v.sgc / 2) * (v.sgc / 2);
    [L, Rt].forEach(s => {
      const Tn = v.stretch ? (v.tension * (s.tens / 100) * KGF) : 0;   // newtons on this side
      s.groups.forEach(g => {
        g.stretchDelta = (Tn > 0 && areaC > 0) ? Tn * g.lenGeo / (E_STEEL * areaC) : 0;
        g.len = g.lenGeo - g.stretchDelta;
      });
      const prim = s.groups.reduce((a, b) => b.x > a.x ? b : a, s.groups[0]);
      s.len = prim.len; s.stretchDelta = prim.stretchDelta;
    });
    return { L, R: Rt, valid: L.valid && Rt.valid };
  }

  return { D2R, R2D, E_STEEL, KGF, NIP_REF, parsePattern, patternLabel, side, sideGroups, buildPlan, compute };
});
