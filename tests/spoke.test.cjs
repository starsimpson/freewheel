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
  erd: 602.3, oL: 0, oR: 0, sd: 2.6, sg: 2.0, sgc: 2.0, headD: 3.8,
  wL: 36, wR: 18, dL: 40.5, dR: 55, n: 32, xL: '0', xR: '3',
  ho: 0, tension: 110, stretch: false, spStyle: 'jbend', triplet: false,
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
  const s = SC.side(V(), 36, 40.5, 0, -1, 16);
  const R = 602.3 / 2, r = 40.5 / 2, f = 36;
  near(s.lenGeo, Math.hypot(R - r, f) - 2.6 / 2, 1e-9, 'radial closed form');
}
// more cross -> longer spoke
ok(SC.side(V(), 18, 55, 3, 1, 16).lenGeo > SC.side(V(), 18, 55, 0, 1, 16).lenGeo, 'more cross -> longer spoke');
// straight-pull omits the J-bend half-hole, so it reads longer by exactly sd/2
{
  const jb = SC.side(V({ spStyle: 'jbend' }), 18, 55, 3, 1, 16).lenGeo;
  const sp = SC.side(V({ spStyle: 'sp' }), 18, 55, 3, 1, 16).lenGeo;
  near(sp - jb, 2.6 / 2, 1e-9, 'straight-pull = J-bend + ½ hole');
}
// 2:1 triplet: drive (right) gets 2/3 of spokes, non-drive 1/3, heavy side runs slacker
{
  const t = SC.compute(V({ n: 24, triplet: true, xL: '1', xR: '3' }));
  near(t.R.nf, 16, 1e-9, '24h 2:1 -> 16 drive spokes');
  near(t.L.nf, 8, 1e-9, '24h 2:1 -> 8 non-drive spokes');
  near(t.R.theta, 3 * 360 / 16, 1e-9, 'drive theta uses its own spoke count');
  ok(t.valid, '24h 2:1 is valid (24 / 6)');
  ok(!SC.compute(V({ n: 28, triplet: true })).valid, '28h 2:1 is flagged invalid (28 not /6)');
  // 2:1 evens out per-spoke tension: the low side's share is higher than at 1:1
  const nonTrip = SC.compute(V({ n: 24, xL: '1', xR: '3' }));
  ok(Math.min(t.L.tens, t.R.tens) > Math.min(nonTrip.L.tens, nonTrip.R.tens),
     '2:1 raises the low-side tension share vs the same dish at 1:1');
}
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
// total angle at rim combines wrap and bracing in 3-D
{
  const c = SC.compute(V());
  const w = c.R.wrap, b = c.R.brace;
  const expect = Math.acos(Math.cos(w * Math.PI / 180) * Math.cos(b * Math.PI / 180)) * 180 / Math.PI;
  near(c.R.total, expect, 1e-9, 'total angle = acos(cos wrap * cos bracing)');
  ok(c.R.total >= c.R.wrap && c.R.total >= c.R.brace, 'total angle >= both components');
}

// ---- 3. cross-validation: law of cosines vs independent 3-D coordinates ----
{
  const coordLen = (v, w, d, x, sign, nf) => {
    const R = v.erd / 2, r = d / 2, th = x * 360 / nf * Math.PI / 180;
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
    const x = Math.floor(Math.random() * 5), sign = (i % 2) ? 1 : -1, nf = v.n / 2;
    maxErr = Math.max(maxErr, Math.abs(SC.side(v, w, d, x, sign, nf).lenGeo - coordLen(v, w, d, x, sign, nf)));
  }
  near(maxErr, 0, 1e-9, 'closed form == 3-D coordinate length over 5000 random wheels');
}

// ---- report ---------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
