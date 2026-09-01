// birdy-gaze.js — cursor tracking for the "follow" state.
// attachGaze(svgEl) starts it; the returned function detaches.
// Everything else in the motion set is pure CSS and needs no JS.
// Ported verbatim from the design handoff (design_handoff_birdy_animations).

export function attachGaze(svg) {
  const state = { L: { x: 0, y: 0 }, R: { x: 0, y: 0 } };
  const limits = {};
  let pt = null, raf = null, last = 0;

  function glintLimit(eye) {
    const cache = limits;
    if (eye.side in cache) return cache[eye.side];
    cache[eye.side] = null;
    try {
      const ball = eye.g.ownerSVGElement.querySelector('[data-p="eye' + eye.side + '"] > use');
      const bb = ball.getBBox();
      const db = eye.s.getBBox();
      const bc = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
      const dc = { x: db.x + db.width / 2, y: db.y + db.height / 2 };
      cache[eye.side] = {
        ox: dc.x - bc.x,
        oy: dc.y - bc.y,
        r: Math.max(0, Math.min(bb.width, bb.height) / 2 - Math.max(db.width, db.height) / 2 - 14)
      };
    } catch (e) { /* geometry unavailable — run unclamped */ }
    return cache[eye.side];
  }

  function track() {
    if (!pt) { raf = null; return; }
    const r = svg.getBoundingClientRect();
    if (!r.width) { raf = null; return; }

    const now = performance.now();
    const dt = Math.min(64, now - (last || now));
    last = now;

    const eyes = [
      { side: 'L', g: svg.querySelector('[data-p="irisL"]'), s: svg.querySelector('[data-p="glintL"]'), st: state.L, fx: 0.30, fy: 0.66 },
      { side: 'R', g: svg.querySelector('[data-p="irisR"]'), s: svg.querySelector('[data-p="glintR"]'), st: state.R, fx: 0.72, fy: 0.66 }
    ];

    let moving = false;
    for (const eye of eyes) {
      if (!eye.g) continue;
      const ex = r.left + r.width * eye.fx;
      const ey = r.top + r.height * eye.fy;
      let ax = (pt.x - ex) / (r.width * 0.62);
      let ay = (pt.y - ey) / (r.height * 0.62);
      // radial clamp with a soft knee — far cursor pins to the rim, near cursor is proportional
      const d = Math.hypot(ax, ay);
      if (d > 0.0001) {
        const m = Math.min(1, d) / d * (1 - Math.exp(-d * 1.6)) / (1 - Math.exp(-1.6));
        ax *= m; ay *= m;
      }
      eye.aim = { x: ax, y: ay };
    }

    for (const eye of eyes) {
      if (!eye.g || !eye.aim) continue;
      const st = eye.st;
      // saccade-ish ease: fast catch-up, no overshoot
      const k = 1 - Math.pow(0.0016, dt / 1000);
      st.x += (eye.aim.x - st.x) * k;
      st.y += (eye.aim.y - st.y) * k;
      if (Math.abs(eye.aim.x - st.x) > 0.002 || Math.abs(eye.aim.y - st.y) > 0.002) moving = true;

      const ix = st.x * 74, iy = st.y * 62;
      eye.g.style.transform = 'translate(' + ix.toFixed(1) + 'px,' + iy.toFixed(1) + 'px)';
      /* The glint is the strongest read of where the bird is looking, so it is
         driven absolutely rather than as a nudge on the artwork: the dot is
         pulled off its painted position to the centre of the eyeball and then
         thrown a long way toward the cursor. Both eyes share one radius, so the
         mirrored art no longer makes one dot travel further than the other. */
      if (eye.s) {
        const lim = glintLimit(eye);
        const reach = (lim ? lim.r : 150) * 0.8;
        const w = Math.min(1, Math.hypot(st.x, st.y) / 0.3);
        const gx = (lim ? -lim.ox * w : 0) + st.x * reach;
        const gy = (lim ? -lim.oy * w : 0) + st.y * reach;
        eye.s.style.transform = 'translate(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px)';
      }
    }

    raf = moving ? requestAnimationFrame(track) : null;
  }

  const onMove = (e) => {
    pt = { x: e.clientX, y: e.clientY };
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(track); }
  };
  window.addEventListener('mousemove', onMove, { passive: true });
  return () => {
    window.removeEventListener('mousemove', onMove);
    if (raf) cancelAnimationFrame(raf);
  };
}
