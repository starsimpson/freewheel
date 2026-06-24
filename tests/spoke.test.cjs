/*
 * Tests for spokecalc.js — run with:  node tests/spoke.test.cjs   (or: npm test)
 *
 * Three kinds of check:
 *   1. Regression fixtures — hand-verified lengths that must not drift.
 *   2. Properties — radial closed form, monotonicity, tension, crow's foot, etc.
 *   3. Cross-validation — an independently-coded 3-D coordinate distance must
 *      agree with the law-of-cosines length across thousands of random wheels.
 */
const SC = require('../spokecalc.js');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗ ' + msg); } };
const near = (a, b, eps, msg) => ok(Math.abs(a - b) <= eps, `${msg}  (got ${a}, want ${b} ±${eps})`);

// a complete input object with sensible defaults; override as needed
const V = over => Object.assign({
  erd: 602.3, erdTol: 0, oL: 0, oR: 0, sd: 2.6, sg: 2.0, sgc: 2.0, headD: 3.8,
  wL: 36, wR: 18, dL: 40.5, dR: 55, n: 32, xL: '0', xR: '3',
  ho: 0, tension: 110, stretch: false,
}, over || {});

// ---- 1. regression fixtures (hand-verified) -------------------------------
const demo = SC.compute(V());
near(demo.L.len, 281.9, 0.1, 'demo: 32h, 622 ERD 602.3, radial / PCD 40.5 / offset 36 -> 281.9');
near(demo.R.len, 291.0, 0.1, 'demo: 3-cross / PCD 55 / offset 18 -> 291.0');
near(demo.R.theta, 67.5, 0.01, 'demo: theta = 3 x 720 / 32 = 67.5');
near(demo.R.tens, 100, 1e-9, 'demo: tighter (right) side pinned at 100%');
near(demo.L.tens, 48, 1.0, 'demo: left side ~48% of right');

// ---- 2. properties --------------------------------------------------------
// radial spoke is exactly sqrt((R-r)^2 + f^2) - hole/2
{
  const s = SC.side(V(), 36, 40.5, 0, -1);
  const R = 602.3 / 2, r = 40.5 / 2, f = 36;
  near(s.lenGeo, Math.hypot(R - r, f) - 2.6 / 2, 1e-9, 'radial closed form');
}
// more cross -> longer spoke
ok(SC.side(V(), 18, 55, 3, 1).lenGeo > SC.side(V(), 18, 55, 0, 1).lenGeo, 'more cross -> longer spoke');
// one side is always pinned at exactly 100%
ok(Math.abs(demo.L.tens - 100) < 1e-9 || Math.abs(demo.R.tens - 100) < 1e-9, 'one side pinned at 100%');
// crow's foot yields two groups with the right split, and validates the spoke count
{
  const cf = SC.compute(V({ n: 36, xR: 'cf3' }));
  ok(cf.R.groups.length === 2, "crow's foot -> two length groups");
  near(cf.R.groups[0].count, 6, 1e-9, "crow's foot radial count = nf/3 = 6");
  near(cf.R.groups[1].count, 12, 1e-9, "crow's foot crossed count = 2nf/3 = 12");
  ok(cf.valid, "36h crow's foot is valid (18 / 3)");
  ok(!SC.compute(V({ n: 32, xR: 'cf3' })).valid, "32h crow's foot is flagged invalid (16 not /3)");
}
// stretch compensation shortens, by the SIDE's own tension, using the centre gauge
{
  const dry = SC.compute(V({ stretch: false }));
  const wet = SC.compute(V({ stretch: true }));
  ok(wet.R.len < dry.R.len, 'stretch compensation shortens the spoke');
  // right side is the 100% (tighter) side here
  const expect = (110 * (wet.R.tens / 100) * 9.80665) * dry.R.lenGeo / (200000 * Math.PI * 1 * 1);
  near(dry.R.len - wet.R.len, expect, 0.02, 'stretch delta = T_side * L / (E * A_centre)');
  ok((dry.L.len - wet.L.len) < (dry.R.len - wet.R.len), 'lower-tension side stretches less');
}
// nipple adjustment is already in v.erd; uncertainty propagates ~0.5mm per 1mm ERD
{
  const u = SC.compute(V({ erdTol: 1 }));
  near(u.R.groups[0].lenTol, 0.5, 0.1, 'ERD ±1 mm -> ~±0.5 mm on length');
  ok(SC.compute(V({ erdTol: 0 })).R.groups[0].lenTol === 0, 'no tolerance -> no band');
}

// ---- 3. cross-validation: law of cosines vs independent 3-D coordinates ----
{
  const coordLen = (v, w, d, x, sign) => {
    const R = v.erd / 2, r = d / 2, th = x * 720 / v.n * Math.PI / 180;
    const f = Math.abs(w + sign * v.ho - (sign < 0 ? v.oL : v.oR));
    // hub hole at angle 0, rim hole at angle theta, separated axially by f
    const dx = R * Math.cos(th) - r, dy = R * Math.sin(th), dz = f;
    return Math.hypot(dx, dy, dz) - v.sd / 2;
  };
  let maxErr = 0;
  const counts = [24, 28, 32, 36, 48];
  for (let i = 0; i < 5000; i++) {
    const v = V({
      erd: 300 + Math.random() * 320, n: counts[i % counts.length],
      sd: 1 + Math.random() * 2, ho: (Math.random() - 0.5) * 40,
      oL: (Math.random() - 0.5) * 6, oR: (Math.random() - 0.5) * 6,
    });
    const w = 12 + Math.random() * 30, d = 28 + Math.random() * 32;
    const x = Math.floor(Math.random() * 5), sign = (i % 2) ? 1 : -1;
    maxErr = Math.max(maxErr, Math.abs(SC.side(v, w, d, x, sign).lenGeo - coordLen(v, w, d, x, sign)));
  }
  near(maxErr, 0, 1e-9, 'closed form == 3-D coordinate length over 5000 random wheels');
}

// ---- report ---------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
