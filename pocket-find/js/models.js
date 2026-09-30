/* MODELS
   Every 3D object is built from Three.js primitives here. No external assets.
   PF.models.items[key]()        -> THREE.Group for a clickable item (origin = base center)
   PF.models.props[key](params)  -> THREE.Group for scenery (floor props: base center, wall props: center)
   PF.models.shell(shellDef)     -> floor, walls and base of a room
   To add a new object: write a builder, register it in the matching table, reference it by key in data. */
window.PF = window.PF || { data: { rooms: {} } };

(function () {
  const T = THREE;
  const C = {
    red: "#e8483b", redDark: "#b8322a", mustard: "#f2b631", cream: "#fff4dc", teal: "#2bb3a3",
    tealDark: "#1d7f78", orange: "#f47c2c", white: "#fbfaf5", steel: "#c7d0d8", steelDark: "#8a96a3",
    dark: "#343a46", wood: "#c98b55", woodDark: "#8f5b31", woodLight: "#e3b47d", green: "#5dbb5a",
    leaf: "#3f9b4a", bun: "#e2a04f", patty: "#6b3b24", kraft: "#c9a06a", pink: "#ff8fb1", glass: "#cfeef2",
  };
  PF.palette = C;

  // ---------- caches and helpers
  const geoCache = new Map();
  const G = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
  const matCache = new Map();
  function mat(color, o = {}) {
    const key = color + "|" + JSON.stringify(o);
    if (matCache.has(key)) return matCache.get(key);
    const op = o.opacity ?? 1;
    const m = new T.MeshStandardMaterial({
      color, roughness: o.rough ?? 0.42, metalness: o.metal ?? 0.0,
      transparent: op < 1, opacity: op, depthWrite: op >= 1,
      emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1,
      side: o.double ? T.DoubleSide : T.FrontSide,
    });
    matCache.set(key, m);
    return m;
  }
  const M = c => (c && c.isMaterial ? c : mat(c));
  const shiny = c => mat(c, { rough: 0.22 });
  const metal = c => mat(c, { rough: 0.3, metal: 0.55 });
  const glassM = (c = C.glass, op = 0.28) => mat(c, { rough: 0.05, opacity: op });
  const glow = (c, ei = 1) => mat(c, { emissive: c, ei });

  function add(p, geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const m = new T.Mesh(geo, M(material));
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz);
    m.castShadow = true; m.receiveShadow = true;
    p.add(m); return m;
  }
  function rrectShape(w, h, r) {
    const s = new T.Shape(); const x = -w / 2, y = -h / 2; r = Math.max(0.0005, Math.min(r, w / 2, h / 2));
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  }
  function rboxGeo(w, h, d, r) {
    return G(`rb${w},${h},${d},${r}`, () => {
      const b = Math.min(r, d * 0.45, w * 0.45, h * 0.45);
      const g = new T.ExtrudeGeometry(rrectShape(w - 2 * b, h - 2 * b, Math.max(0.001, r - b)),
        { depth: Math.max(0.001, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 5 });
      g.center(); g.computeVertexNormals(); return g;
    });
  }
  const box = (p, w, h, d, c, x, y, z, rx, ry, rz) => add(p, G(`b${w},${h},${d}`, () => new T.BoxGeometry(w, h, d)), c, x, y, z, rx, ry, rz);
  const rbox = (p, w, h, d, r, c, x, y, z, rx, ry, rz) => add(p, rboxGeo(w, h, d, r), c, x, y, z, rx, ry, rz);
  const cyl = (p, rt, rb, h, c, x, y, z, rx, ry, rz, seg = 24, open = false) =>
    add(p, G(`c${rt},${rb},${h},${seg},${open}`, () => new T.CylinderGeometry(rt, rb, h, seg, 1, open)), c, x, y, z, rx, ry, rz);
  const sph = (p, r, c, x, y, z, sx = 1, sy = 1, sz = 1) =>
    add(p, G(`s${r}`, () => new T.SphereGeometry(r, 24, 16)), c, x, y, z, 0, 0, 0, sx, sy, sz);
  const hemi = (p, r, c, x, y, z, top = true, sx = 1, sy = 1, sz = 1) =>
    add(p, G(`h${r}${top}`, () => new T.SphereGeometry(r, 24, 12, 0, Math.PI * 2, top ? 0 : Math.PI / 2, Math.PI / 2)), c, x, y, z, 0, 0, 0, sx, sy, sz);
  const torus = (p, R, t, c, x, y, z, rx = 0, ry = 0, rz = 0, arc = Math.PI * 2) =>
    add(p, G(`t${R},${t},${arc}`, () => new T.TorusGeometry(R, t, 12, 32, arc)), c, x, y, z, rx, ry, rz);
  const cone = (p, r, h, c, x, y, z, rx, ry, rz, seg = 20) => add(p, G(`k${r},${h},${seg}`, () => new T.ConeGeometry(r, h, seg)), c, x, y, z, rx, ry, rz);
  function plane(p, w, h, material, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), material);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.receiveShadow = true; p.add(m); return m;
  }
  const group = () => new T.Group();

  // deterministic random for scatter
  function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // canvas textures
  function canvasTex(w, h, draw) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const FONT = '"Baloo 2", "Fredoka", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
  function texPlaneMat(tex, o = {}) {
    return new T.MeshStandardMaterial({ map: tex, transparent: !!o.transparent, roughness: o.rough ?? 0.6,
      emissive: o.glow ? 0xffffff : 0x000000, emissiveMap: o.glow ? tex : null, emissiveIntensity: o.glow ?? 0, side: T.FrontSide });
  }

  // =====================================================================================
  // ITEMS (clickable)
  // =====================================================================================
  const items = {
    chefHat() {
      const g = group(); const w = shiny("#ffffff");
      cyl(g, 0.26, 0.25, 0.22, w, 0, 0.11, 0);
      cyl(g, 0.262, 0.262, 0.04, mat("#e9edf2"), 0, 0.2, 0);
      for (const [x, z] of [[0.17, 0.05], [-0.17, 0.05], [0, -0.16], [0.02, 0.17]]) sph(g, 0.19, w, x, 0.36, z);
      sph(g, 0.25, w, 0, 0.44, 0, 1, 0.85, 1);
      return g;
    },
    fryingPan() { // flat, handle toward -z (rotate x 90 to hang it on a wall)
      const g = group();
      cyl(g, 0.36, 0.3, 0.09, metal("#2f3440"), 0, 0.045, 0, 0, 0, 0, 32);
      cyl(g, 0.31, 0.31, 0.012, mat("#4d5563", { rough: 0.25, metal: 0.4 }), 0, 0.093, 0, 0, 0, 0, 32);
      box(g, 0.08, 0.05, 0.52, mat(C.woodDark), 0, 0.075, -0.6);
      cyl(g, 0.045, 0.045, 0.14, metal(C.steelDark), 0, 0.075, -0.36, Math.PI / 2, 0, 0);
      torus(g, 0.04, 0.012, metal(C.steelDark), 0, 0.075, -0.88, Math.PI / 2, 0, 0);
      return g;
    },
    whisk() { // upright, handle at the bottom
      const g = group();
      cyl(g, 0.035, 0.03, 0.28, shiny(C.red), 0, 0.14, 0);
      cyl(g, 0.04, 0.04, 0.04, metal(C.steel), 0, 0.29, 0);
      for (let i = 0; i < 4; i++) {
        const m = torus(g, 0.1, 0.009, metal("#dfe6ec"), 0, 0.46, 0, 0, i * Math.PI / 4, 0);
        m.scale.set(1, 1.7, 1);
      }
      return g;
    },
    woodenSpoon() {
      const g = group(); const w = mat(C.woodLight, { rough: 0.6 });
      cyl(g, 0.026, 0.03, 0.62, w, 0, 0.31, 0);
      sph(g, 0.1, w, 0, 0.7, 0, 0.9, 1.35, 0.42);
      return g;
    },
    saltShaker() {
      const g = group();
      cyl(g, 0.085, 0.1, 0.2, mat("#eef7fb", { rough: 0.12 }), 0, 0.1, 0);
      cyl(g, 0.07, 0.085, 0.1, mat("#ffffff", { rough: 0.8 }), 0, 0.06, 0);
      hemi(g, 0.088, metal("#dfe6ec"), 0, 0.2, 0);
      cyl(g, 0.09, 0.09, 0.03, metal("#dfe6ec"), 0, 0.205, 0);
      return g;
    },
    kettle() {
      const g = group(); const t = shiny(C.teal);
      cyl(g, 0.24, 0.27, 0.05, metal(C.steelDark), 0, 0.025, 0);
      sph(g, 0.3, t, 0, 0.27, 0, 1, 0.78, 1);
      cyl(g, 0.15, 0.17, 0.05, t, 0, 0.5, 0);
      sph(g, 0.05, mat(C.dark), 0, 0.56, 0);
      cyl(g, 0.028, 0.065, 0.3, t, 0.37, 0.37, 0, 0, 0, -0.8);
      torus(g, 0.2, 0.032, mat(C.dark), 0, 0.5, 0, 0, 0, 0, Math.PI);
      return g;
    },
    tomato() {
      const g = group();
      sph(g, 0.15, shiny("#ff4a36"), 0, 0.13, 0, 1, 0.86, 1);
      for (let i = 0; i < 5; i++) box(g, 0.13, 0.015, 0.035, mat(C.leaf), Math.cos(i * 1.256) * 0.05, 0.255, Math.sin(i * 1.256) * 0.05, 0, -i * 1.256, 0.15);
      cyl(g, 0.012, 0.015, 0.06, mat(C.leaf), 0, 0.28, 0);
      return g;
    },
    bread() {
      const g = group();
      add(g, G("capBread", () => new T.CapsuleGeometry(0.14, 0.3, 8, 16)), mat("#d9914a", { rough: 0.55 }), 0, 0.12, 0, 0, 0, Math.PI / 2, 1, 1, 1);
      g.children[0].scale.set(0.85, 1, 1.05);
      for (let i = -1; i <= 1; i++) box(g, 0.035, 0.012, 0.2, mat("#a8621f"), i * 0.12, 0.245, 0, 0, 0.5, 0);
      return g;
    },
    cheese() {
      const g = group();
      const s = new T.Shape(); s.moveTo(-0.2, -0.13); s.lineTo(0.25, 0); s.lineTo(-0.2, 0.13); s.lineTo(-0.2, -0.13);
      const geo = G("cheeseW", () => { const e = new T.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }); e.rotateX(-Math.PI / 2); return e; });
      add(g, geo, shiny("#ffcc3d"), 0, 0.015, 0);
      const h = mat("#e3a61b");
      for (const [x, z] of [[-0.08, 0.02], [0.05, -0.03], [-0.13, -0.06]]) sph(g, 0.028, h, x, 0.17, -z, 1, 0.35, 1);
      sph(g, 0.03, h, -0.215, 0.08, 0.03, 0.3, 1, 1);
      return g;
    },
    egg() {
      const g = group();
      sph(g, 0.1, shiny("#fff6e8"), 0, 0.13, 0, 1, 1.3, 1);
      return g;
    },
    apple() {
      const g = group();
      sph(g, 0.15, shiny("#8fd14f"), 0, 0.14, 0, 1, 0.92, 1);
      sph(g, 0.06, shiny("#e8483b"), 0.09, 0.15, 0.09, 0.9, 1.2, 0.5).material = mat("#c9e36b", { rough: 0.3 });
      cyl(g, 0.012, 0.016, 0.1, mat(C.woodDark), 0, 0.3, 0, 0, 0, 0.2);
      sph(g, 0.05, mat(C.leaf), 0.05, 0.31, 0, 1.3, 0.3, 0.7);
      return g;
    },
    tomatoSauce() {
      const g = group();
      cyl(g, 0.15, 0.15, 0.28, mat("#d8322a", { rough: 0.18 }), 0, 0.14, 0);
      cyl(g, 0.153, 0.153, 0.12, mat(C.cream), 0, 0.14, 0);
      sph(g, 0.045, shiny("#ff4a36"), 0, 0.14, 0.15, 1, 1, 0.5);
      cyl(g, 0.16, 0.16, 0.07, shiny(C.mustard), 0, 0.31, 0);
      return g;
    },
    sandwich() {
      const g = group(); const br = mat("#f3c47d", { rough: 0.6 }); const crust = mat("#c98033");
      rbox(g, 0.44, 0.07, 0.44, 0.03, crust, 0, 0.035, 0);
      rbox(g, 0.4, 0.075, 0.4, 0.03, br, 0, 0.038, 0);
      rbox(g, 0.48, 0.03, 0.48, 0.015, mat("#6cc36a"), 0, 0.088, 0, 0, 0.2, 0);
      box(g, 0.42, 0.025, 0.42, shiny("#ffcc3d"), 0, 0.115, 0, 0, Math.PI / 4, 0);
      cyl(g, 0.09, 0.09, 0.025, shiny("#ff4a36"), -0.08, 0.14, 0.06);
      cyl(g, 0.09, 0.09, 0.025, shiny("#ff4a36"), 0.1, 0.14, -0.05);
      rbox(g, 0.44, 0.07, 0.44, 0.03, crust, 0, 0.19, 0);
      rbox(g, 0.4, 0.075, 0.4, 0.03, br, 0, 0.193, 0);
      cyl(g, 0.008, 0.008, 0.22, mat(C.woodLight), 0, 0.3, 0);
      sph(g, 0.035, shiny("#4e9a3a"), 0, 0.42, 0);
      return g;
    },
    omelette() {
      const g = group();
      cyl(g, 0.32, 0.28, 0.035, shiny("#ffffff"), 0, 0.018, 0, 0, 0, 0, 32);
      hemi(g, 0.24, shiny("#ffd45a"), 0, 0.035, 0, true, 1, 0.45, 0.62);
      torus(g, 0.08, 0.014, shiny("#e8483b"), 0.02, 0.14, 0.01, Math.PI / 2, 0, 0, Math.PI * 1.3);
      for (const [x, z] of [[-0.1, 0.05], [0.12, -0.04], [-0.02, -0.08]]) sph(g, 0.018, mat(C.leaf), x, 0.13, z);
      return g;
    },
    applePie() {
      const g = group();
      cyl(g, 0.32, 0.27, 0.1, metal("#cfd6dc"), 0, 0.05, 0, 0, 0, 0, 32);
      cyl(g, 0.31, 0.31, 0.06, mat("#e9a551", { rough: 0.55 }), 0, 0.11, 0, 0, 0, 0, 32);
      hemi(g, 0.29, mat("#b86b2a"), 0, 0.13, 0, true, 1, 0.12, 1);
      const l = mat("#f6c783", { rough: 0.55 });
      for (let i = -1; i <= 1; i++) { box(g, 0.55, 0.03, 0.06, l, 0, 0.165, i * 0.15); box(g, 0.06, 0.035, 0.55, l, i * 0.15, 0.17, 0); }
      torus(g, 0.3, 0.035, l, 0, 0.14, 0, Math.PI / 2, 0, 0);
      return g;
    },
  };

  // =====================================================================================
  // PROPS (scenery)
  // =====================================================================================
  function burger(g, x = 0, y = 0, z = 0, s = 1) {
    const b = group(); b.position.set(x, y, z); b.scale.setScalar(s); g.add(b);
    cyl(b, 0.2, 0.18, 0.08, mat(C.bun), 0, 0.04, 0);
    cyl(b, 0.21, 0.21, 0.07, mat(C.patty, { rough: 0.7 }), 0, 0.115, 0);
    box(b, 0.36, 0.02, 0.36, shiny("#ffcc3d"), 0, 0.16, 0, 0, Math.PI / 4, 0);
    cyl(b, 0.225, 0.225, 0.03, mat("#6cc36a"), 0, 0.18, 0);
    cyl(b, 0.19, 0.19, 0.03, shiny("#ff4a36"), 0, 0.205, 0);
    hemi(b, 0.205, shiny(C.bun), 0, 0.22, 0, true, 1, 0.72, 1);
    const r = rng(7);
    for (let i = 0; i < 7; i++) { const a = r() * 6.28, d = 0.05 + r() * 0.1; sph(b, 0.015, mat(C.cream), Math.cos(a) * d, 0.35 - d * 0.35, Math.sin(a) * d, 1, 0.5, 1.6); }
    return b;
  }
  function friesCarton(g, x = 0, y = 0, z = 0, s = 1) {
    const f = group(); f.position.set(x, y, z); f.scale.setScalar(s); g.add(f);
    cyl(f, 0.17, 0.11, 0.26, shiny(C.red), 0, 0.13, 0, 0, Math.PI / 4, 0, 4);
    cyl(f, 0.05, 0.05, 0.01, mat(C.mustard), 0, 0.14, 0.12, Math.PI / 2 - 0.2, 0, 0, 16);
    const y1 = mat("#ffd35c"); const r = rng(11);
    for (let i = 0; i < 10; i++) box(f, 0.034, 0.26, 0.034, y1, (r() - 0.5) * 0.18, 0.33 + r() * 0.05, (r() - 0.5) * 0.12, (r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4);
    return f;
  }
  function sodaCup(g, x = 0, y = 0, z = 0, color = C.red, s = 1) {
    const c = group(); c.position.set(x, y, z); c.scale.setScalar(s); g.add(c);
    cyl(c, 0.12, 0.09, 0.34, shiny(color), 0, 0.17, 0);
    cyl(c, 0.112, 0.105, 0.08, mat(C.white), 0, 0.2, 0);
    cyl(c, 0.125, 0.125, 0.03, mat(C.white), 0, 0.355, 0);
    cyl(c, 0.013, 0.013, 0.3, shiny(C.mustard), 0.03, 0.46, 0, 0, 0, -0.15);
    return c;
  }
  function squeeze(g, color, x = 0, y = 0, z = 0) {
    const b = group(); b.position.set(x, y, z); g.add(b);
    cyl(b, 0.075, 0.085, 0.3, shiny(color), 0, 0.15, 0);
    cyl(b, 0.06, 0.07, 0.05, mat(C.white), 0, 0.325, 0);
    cone(b, 0.028, 0.09, shiny(color), 0, 0.395, 0);
    return b;
  }
  function shaker(g, body, x = 0, y = 0, z = 0) {
    const s = group(); s.position.set(x, y, z); g.add(s);
    cyl(s, 0.085, 0.1, 0.2, mat(body, { rough: 0.2 }), 0, 0.1, 0);
    hemi(s, 0.088, metal("#6f7884"), 0, 0.2, 0);
    cyl(s, 0.09, 0.09, 0.03, metal("#6f7884"), 0, 0.205, 0);
    return s;
  }

  const props = {
    // ---------------- wall decor
    brandSign() {
      const g = group();
      rbox(g, 5.5, 1.35, 0.14, 0.25, shiny(C.red), 0, 0, 0);
      rbox(g, 5.2, 1.1, 0.06, 0.2, mat(C.cream), 0, 0, 0.06);
      const tex = canvasTex(1024, 210, (x, w, h) => {
        x.fillStyle = C.red; x.textAlign = "left"; x.textBaseline = "middle";
        x.font = `800 118px ${FONT}`; x.fillText("POCKET BURGER", 160, h / 2 + 8, w - 190);
        x.fillStyle = C.mustard; x.beginPath(); x.arc(70, h / 2, 60, Math.PI, 0); x.fill();
        x.fillStyle = C.patty; x.fillRect(12, h / 2 + 2, 116, 20); x.fillStyle = C.mustard; x.fillRect(16, h / 2 + 24, 108, 22);
      });
      plane(g, 5.0, 1.02, texPlaneMat(tex, { transparent: true }), 0, 0, 0.1);
      return g;
    },
    awning({ width = 21 }) {
      const g = group(); const n = Math.round(width / 0.9); const sw = width / n;
      for (let i = 0; i < n; i++) {
        const x = -width / 2 + sw * (i + 0.5); const c = i % 2 ? C.cream : C.red;
        box(g, sw, 0.8, 0.06, mat(c, { rough: 0.55 }), x, 0.14, 0.26, 0.62, 0, 0);
        const sc = new T.Mesh(G(`scal${sw}`, () => new T.CircleGeometry(sw / 2, 16, Math.PI, Math.PI)), mat(c, { rough: 0.55, double: true }));
        sc.position.set(x, -0.2, 0.5); sc.rotation.x = 0.1; sc.castShadow = true; g.add(sc);
      }
      box(g, width, 0.12, 0.12, metal(C.steelDark), 0, 0.46, 0.05);
      return g;
    },
    menuBoard() {
      const g = group();
      rbox(g, 6.5, 2.35, 0.16, 0.12, mat("#23303c"), 0, 0, 0);
      const tex = canvasTex(1300, 440, (x, w, h) => {
        x.fillStyle = "#153a3a"; x.fillRect(0, 0, w, h);
        const cols = [["BURGERS", C.mustard, [["Classic", "5.49"], ["Cheese Stack", "6.29"], ["Big Pocket", "7.99"]]],
                      ["SIDES", "#ff8a65", [["Fries", "2.49"], ["Onion Rings", "3.19"], ["Apple Pie", "2.99"]]],
                      ["DRINKS", "#7fe3d6", [["Soda", "1.99"], ["Shake", "3.49"], ["Iced Tea", "1.79"]]]];
        cols.forEach(([title, col, rows], i) => {
          const x0 = 30 + i * (w / 3);
          x.fillStyle = col; x.font = `800 58px ${FONT}`; x.textAlign = "left"; x.textBaseline = "alphabetic";
          x.fillText(title, x0, 80);
          x.fillRect(x0, 96, 170, 7);
          rows.forEach(([n, p], k) => {
            x.fillStyle = "#fff4dc"; x.font = `600 40px ${FONT}`; x.fillText(n, x0, 170 + k * 72);
            x.fillStyle = col; x.textAlign = "right"; x.fillText(p, x0 + w / 3 - 60, 170 + k * 72); x.textAlign = "left";
          });
          if (i) { x.fillStyle = "rgba(255,255,255,.15)"; x.fillRect(i * w / 3, 30, 4, h - 60); }
        });
        x.fillStyle = C.red; x.fillRect(0, h - 44, w, 44);
        x.fillStyle = "#fff"; x.font = `700 28px ${FONT}`; x.textAlign = "center"; x.fillText("LUNCH COMBO  +  FRIES  +  DRINK   8.49", w / 2, h - 12);
      });
      plane(g, 6.15, 2.05, texPlaneMat(tex, { glow: 0.55, rough: 0.35 }), 0, 0, 0.09);
      return g;
    },
    wallClock() {
      const g = group();
      cyl(g, 0.62, 0.62, 0.12, shiny(C.red), 0, 0, 0, Math.PI / 2, 0, 0, 40);
      cyl(g, 0.52, 0.52, 0.02, mat(C.cream), 0, 0, 0.065, Math.PI / 2, 0, 0, 40);
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; box(g, 0.035, i % 3 ? 0.06 : 0.12, 0.01, mat(C.dark), Math.sin(a) * 0.43, Math.cos(a) * 0.43, 0.08, 0, 0, -a); }
      box(g, 0.05, 0.28, 0.015, mat(C.dark), 0.05, 0.12, 0.09, 0, 0, -0.4);
      box(g, 0.035, 0.38, 0.015, mat(C.dark), -0.12, 0.13, 0.1, 0, 0, 0.9);
      sph(g, 0.04, mat(C.red), 0, 0, 0.1);
      return g;
    },
    neonOpen() {
      const g = group();
      rbox(g, 2.5, 1.05, 0.08, 0.2, mat("#1f2a33"), 0, 0, 0);
      const tex = canvasTex(512, 220, (x, w, h) => {
        x.textAlign = "center"; x.textBaseline = "middle"; x.font = `800 140px ${FONT}`;
        x.shadowColor = "#ff5fa2"; x.shadowBlur = 30; x.fillStyle = "#ffd1e6"; x.fillText("OPEN", w / 2, h / 2 + 8);
        x.shadowBlur = 0; x.strokeStyle = "#5ff2e0"; x.lineWidth = 8; x.shadowColor = "#5ff2e0"; x.shadowBlur = 20;
        x.beginPath(); x.roundRect(14, 14, w - 28, h - 28, 40); x.stroke();
      });
      plane(g, 2.35, 0.95, texPlaneMat(tex, { transparent: true, glow: 1.2 }), 0, 0, 0.05);
      return g;
    },
    pennants({ width = 22 }) {
      const g = group(); const posts = [-width / 2, -width / 6, width / 6, width / 2];
      const cols = [C.red, C.mustard, C.teal, C.orange, C.cream];
      let k = 0;
      for (let s = 0; s < 3; s++) {
        const a = posts[s], b = posts[s + 1]; const n = 9;
        const pts = [];
        for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new T.Vector3(a + (b - a) * t, -0.45 * 4 * t * (1 - t), 0)); }
        const curve = new T.CatmullRomCurve3(pts);
        add(g, new T.TubeGeometry(curve, 24, 0.012, 5), mat(C.dark), 0, 0, 0);
        for (let i = 1; i < n; i++) {
          const t = i / n; const x = a + (b - a) * t, y = -0.45 * 4 * t * (1 - t);
          const f = new T.Mesh(G("flag", () => new T.CircleGeometry(0.26, 3)), mat(cols[k++ % cols.length], { double: true, rough: 0.6 }));
          f.position.set(x, y - 0.13, 0); f.rotation.z = -Math.PI / 2; f.scale.set(1, 0.7, 1); f.castShadow = true; g.add(f);
        }
      }
      return g;
    },

    // ---------------- kitchen
    wallShelf({ width = 3, levels = [3, 4.4] }) {
      const g = group();
      for (const y of levels) {
        rbox(g, width, 0.1, 0.62, 0.03, mat(C.wood, { rough: 0.6 }), 0, y - 0.05, 0.05);
        for (const s of [-1, 1]) box(g, 0.08, 0.35, 0.45, mat(C.woodDark), s * (width / 2 - 0.3), y - 0.27, -0.05);
      }
      return g;
    },
    container({ lid = C.red, tall = false }) {
      const g = group(); const h = tall ? 0.52 : 0.36;
      cyl(g, 0.24, 0.2, h, mat("#f4efe4", { rough: 0.3 }), 0, h / 2, 0);
      cyl(g, 0.255, 0.255, 0.05, shiny(lid), 0, h + 0.02, 0);
      box(g, 0.2, 0.12, 0.01, mat(C.white), 0, h * 0.5, 0.225);
      return g;
    },
    jarSet() {
      const g = group(); const fills = ["#6cae3f", "#3b3f2a", "#e05a33"];
      fills.forEach((c, i) => {
        const x = (i - 1) * 0.33;
        cyl(g, 0.11, 0.11, 0.22, mat(c, { rough: 0.5 }), x, 0.12, 0);
        cyl(g, 0.125, 0.125, 0.3, glassM("#dff4f7", 0.35), x, 0.15, 0);
        cyl(g, 0.13, 0.13, 0.05, shiny(i === 1 ? C.red : C.mustard), x, 0.325, 0);
      });
      return g;
    },
    bottleSet() {
      const g = group(); const cols = [["#f4c542", 0.65], ["#8e2a2a", 0.8], ["#7a4a1f", 0.85]];
      cols.forEach(([c, op], i) => {
        const x = (i - 1) * 0.27;
        cyl(g, 0.09, 0.09, 0.42, mat(c, { rough: 0.1, opacity: op }), x, 0.21, 0);
        cyl(g, 0.035, 0.06, 0.16, mat(c, { rough: 0.1, opacity: op }), x, 0.5, 0);
        cyl(g, 0.04, 0.04, 0.05, mat(C.dark), x, 0.6, 0);
        box(g, 0.14, 0.12, 0.01, mat(C.cream), x, 0.22, 0.09);
      });
      return g;
    },
    cardboardBoxes({ small = false }) {
      const g = group(); const s = small ? 0.5 : 1; const k = mat(C.kraft, { rough: 0.8 }), tape = mat("#e6cf9a", { rough: 0.5 });
      rbox(g, 1.0 * s, 0.7 * s, 0.8 * s, 0.03, k, 0, 0.35 * s, 0);
      box(g, 1.01 * s, 0.1 * s, 0.81 * s, tape, 0, 0.66 * s, 0);
      rbox(g, 0.75 * s, 0.55 * s, 0.6 * s, 0.03, k, 0.05 * s, 0.975 * s, 0.02, 0, 0.25, 0);
      box(g, 0.3 * s, 0.18 * s, 0.01, mat(C.red), -0.2 * s, 0.35 * s, 0.405 * s);
      return g;
    },
    produceCrate() {
      const g = group(); const w = mat(C.wood, { rough: 0.7 });
      box(g, 1.3, 0.06, 0.8, w, 0, 0.03, 0);
      for (const y of [0.15, 0.38]) { box(g, 1.3, 0.14, 0.05, w, 0, y, 0.38); box(g, 1.3, 0.14, 0.05, w, 0, y, -0.38); box(g, 0.05, 0.14, 0.8, w, 0.63, y, 0); box(g, 0.05, 0.14, 0.8, w, -0.63, y, 0); }
      const r = rng(3);
      for (let i = 0; i < 16; i++) {
        const onion = i % 4 === 0;
        sph(g, onion ? 0.13 : 0.12, mat(onion ? "#b56a8f" : "#b58a55", { rough: 0.75 }), (r() - 0.5) * 1.05, 0.28 + r() * 0.12, (r() - 0.5) * 0.55, 1, 0.85, 1.15);
      }
      return g;
    },
    potRack() {
      const g = group(); const s = metal(C.steelDark);
      cyl(g, 0.03, 0.03, 1.9, s, 0, 0, 0.12, 0, 0, Math.PI / 2);
      for (const x of [-0.85, 0.85]) box(g, 0.05, 0.05, 0.14, s, x, 0, 0.05);
      // ladle
      cyl(g, 0.018, 0.018, 0.7, metal(C.steel), -0.55, -0.4, 0.12);
      hemi(g, 0.12, metal(C.steel), -0.55, -0.75, 0.15, false);
      // spatula
      cyl(g, 0.02, 0.02, 0.5, mat(C.dark), -0.1, -0.28, 0.12);
      box(g, 0.2, 0.26, 0.015, metal(C.steel), -0.1, -0.65, 0.12);
      // copper saucepan
      const p = group(); p.position.set(0.95, -0.55, 0.16); g.add(p);
      cyl(p, 0.26, 0.24, 0.3, metal("#c77a4a"), 0, 0, 0, Math.PI / 2, 0, 0);
      box(p, 0.06, 0.45, 0.04, mat(C.dark), 0, 0.4, 0);
      return g;
    },
    rangeHood() {
      const g = group(); const s = metal(C.steel);
      box(g, 2.7, 0.45, 1.2, s, 0, 0, 0);
      box(g, 2.75, 0.1, 1.25, metal(C.steelDark), 0, -0.25, 0.02);
      box(g, 0.95, 1.2, 0.7, s, 0, 0.8, -0.25);
      for (let i = -3; i <= 3; i++) box(g, 0.06, 0.02, 0.9, mat(C.dark), i * 0.3, -0.3, 0.05);
      return g;
    },
    grill() {
      const g = group();
      box(g, 2.4, 2.0, 1.2, metal("#9aa6b2"), 0, 1.0, 0);
      box(g, 2.3, 1.2, 0.02, metal(C.steel), 0, 0.8, 0.61);
      box(g, 2.35, 0.08, 1.15, mat("#2a2d33", { rough: 0.35, metal: 0.4 }), 0, 2.04, 0);
      for (let i = -4; i <= 4; i++) box(g, 0.03, 0.02, 1.0, mat("#15171b"), i * 0.25, 2.09, 0);
      for (const [x, z] of [[-0.6, 0.1], [0.05, -0.15], [0.65, 0.15]]) cyl(g, 0.23, 0.23, 0.08, mat(C.patty, { rough: 0.75 }), x, 2.12, z);
      box(g, 0.4, 0.02, 0.4, shiny("#ffcc3d"), 0.65, 2.17, 0.15, 0, Math.PI / 4, 0);
      for (const x of [-0.8, -0.3, 0.3, 0.8]) cyl(g, 0.07, 0.07, 0.06, shiny(C.red), x, 1.72, 0.62, Math.PI / 2, 0, 0);
      box(g, 2.5, 0.25, 0.12, metal(C.steel), 0, 2.2, -0.62);
      return g;
    },
    fryer() {
      const g = group();
      box(g, 1.6, 2.1, 1.2, metal(C.steel), 0, 1.05, 0);
      box(g, 1.5, 1.1, 0.02, metal("#aab5bf"), 0, 0.75, 0.61);
      for (const x of [-0.38, 0.38]) {
        box(g, 0.62, 0.03, 0.8, mat("#a86d14", { rough: 0.08 }), x, 2.1, 0.05);
        const b = group(); b.position.set(x, 2.45, 0.05); g.add(b);
        box(b, 0.52, 0.3, 0.46, metal("#dfe6ec"), 0, 0, 0).material = mat("#dfe6ec", { rough: 0.3, metal: 0.6, opacity: 0.8 });
        const y1 = mat("#ffd35c"); const r = rng(x > 0 ? 5 : 9);
        for (let i = 0; i < 8; i++) box(b, 0.035, 0.03, 0.3, y1, (r() - 0.5) * 0.4, 0.14, (r() - 0.5) * 0.2, 0, r(), 0);
        cyl(b, 0.025, 0.025, 0.5, mat(C.red), 0, 0.15, 0.45, Math.PI / 2.4, 0, 0);
      }
      box(g, 1.6, 0.55, 0.14, metal("#aab5bf"), 0, 2.37, -0.55);
      sph(g, 0.04, glow("#ff3b30", 1.4), -0.5, 2.4, -0.47);
      sph(g, 0.04, glow("#4cd964", 1.4), -0.35, 2.4, -0.47);
      return g;
    },
    ticketRail() {
      const g = group();
      box(g, 2.3, 0.08, 0.08, metal(C.steel), 0, 0, 0.04);
      [-0.8, -0.35, 0.15, 0.6].forEach((x, i) => {
        box(g, 0.3, 0.42, 0.012, mat(C.white, { rough: 0.9 }), x, -0.22, 0.09, 0, 0, (i % 2 ? 0.06 : -0.05));
        box(g, 0.3, 0.05, 0.014, mat(C.red), x, -0.05, 0.095);
      });
      return g;
    },
    prepTable({ width = 3.4 }) {
      const g = group(); const s = metal(C.steel);
      box(g, width, 0.1, 1.1, s, 0, 2.05, 0);
      box(g, width, 0.18, 0.04, metal("#aab5bf"), 0, 1.93, 0.55);
      for (const x of [-1, 1]) for (const z of [-1, 1]) cyl(g, 0.05, 0.05, 2.0, s, x * (width / 2 - 0.1), 1.0, z * 0.45);
      box(g, width - 0.1, 0.05, 1.0, s, 0, 0.45, 0);
      for (let i = 0; i < 4; i++) cyl(g, 0.28, 0.26, 0.04, mat(C.white), -width / 2 + 0.55, 0.5 + i * 0.045, 0);
      cyl(g, 0.3, 0.3, 0.42, metal("#b0bac3"), width / 2 - 0.6, 0.69, 0);
      return g;
    },
    microwave() {
      const g = group();
      rbox(g, 0.95, 0.56, 0.6, 0.05, mat("#eef0f2", { rough: 0.3 }), 0, 0.28, 0);
      box(g, 0.56, 0.38, 0.02, mat("#1c2530", { rough: 0.1 }), -0.12, 0.29, 0.3);
      box(g, 0.2, 0.44, 0.02, mat("#cfd5da"), 0.33, 0.28, 0.3);
      box(g, 0.1, 0.05, 0.02, glow("#5ff2e0", 0.8), 0.33, 0.42, 0.315);
      return g;
    },
    cuttingBoard() {
      const g = group();
      rbox(g, 0.95, 0.07, 0.55, 0.05, mat(C.woodLight, { rough: 0.7 }), 0, 0.035, 0);
      box(g, 0.34, 0.012, 0.07, metal("#e2e8ed"), 0.22, 0.08, 0.2, 0, 0.3, 0);
      box(g, 0.16, 0.03, 0.05, mat(C.dark), -0.02, 0.085, 0.27, 0, 0.3, 0);
      return g;
    },
    mixingBowl() {
      const g = group();
      add(g, G("bowl", () => new T.SphereGeometry(0.27, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), mat(C.teal, { rough: 0.25, double: true }), 0, 0.27, 0);
      torus(g, 0.27, 0.018, shiny(C.teal), 0, 0.27, 0, Math.PI / 2, 0, 0);
      return g;
    },
    utensilCrock() {
      const g = group();
      cyl(g, 0.17, 0.15, 0.42, shiny(C.mustard), 0, 0.21, 0);
      cyl(g, 0.15, 0.15, 0.02, mat("#5a4632"), 0, 0.41, 0);
      const sp = group(); sp.position.set(-0.07, 0.2, -0.03); sp.rotation.z = 0.28; g.add(sp);
      cyl(sp, 0.02, 0.02, 0.6, mat(C.dark), 0, 0.3, 0); box(sp, 0.16, 0.2, 0.012, mat(C.red), 0, 0.68, 0);
      const la = group(); la.position.set(0.08, 0.2, -0.05); la.rotation.z = -0.35; g.add(la);
      cyl(la, 0.016, 0.016, 0.62, metal(C.steel), 0, 0.31, 0); hemi(la, 0.09, metal(C.steel), 0, 0.66, 0, true, 1, 0.7, 1);
      return g;
    },
    backCounter({ width = 2.8 }) {
      const g = group();
      box(g, width, 1.9, 1.0, mat(C.teal), 0, 0.95, 0);
      rbox(g, width + 0.12, 0.1, 1.08, 0.03, mat(C.cream), 0, 1.95, 0.02);
      for (const x of [-width / 4, width / 4]) {
        box(g, width / 2 - 0.12, 1.5, 0.03, mat(C.tealDark), x, 0.9, 0.5);
        box(g, 0.05, 0.3, 0.04, metal(C.steel), x + (x < 0 ? 0.45 : -0.45), 1.1, 0.53);
      }
      return g;
    },
    sodaMachine() {
      const g = group();
      rbox(g, 1.6, 1.4, 0.8, 0.06, shiny(C.red), 0, 0.7, 0);
      rbox(g, 1.65, 0.5, 0.85, 0.06, mat(C.cream), 0, 1.62, 0);
      const tex = canvasTex(512, 150, (x, w, h) => {
        x.fillStyle = C.teal; x.font = `800 110px ${FONT}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("SODA", w / 2, h / 2 + 6);
      });
      plane(g, 1.3, 0.38, texPlaneMat(tex, { transparent: true }), 0, 1.62, 0.44);
      [-0.48, 0, 0.48].forEach((x, i) => {
        box(g, 0.34, 0.26, 0.03, glow([C.orange, "#7a3cff", C.teal][i], 0.5), x, 1.1, 0.41);
        cyl(g, 0.035, 0.05, 0.14, metal(C.dark), x, 0.8, 0.36);
      });
      box(g, 1.45, 0.08, 0.35, metal(C.steelDark), 0, 0.1, 0.35);
      return g;
    },
    cupStack() {
      const g = group();
      [[0, C.red], [0.26, C.white]].forEach(([x, c]) => {
        for (let i = 0; i < 5; i++) cyl(g, 0.11, 0.085, 0.3, shiny(c), x, 0.15 + i * 0.07, 0);
      });
      return g;
    },
    drinksCooler() {
      // hollow cabinet so the bottles (and anything placed inside) can be seen through the glass
      const g = group(); const shell = shiny(C.red);
      box(g, 2.0, 0.12, 1.4, shell, 0, 0.06, 0);            // floor
      box(g, 2.0, 0.6, 1.4, shell, 0, 4.3, 0);              // header
      box(g, 0.12, 4.6, 1.4, shell, -0.94, 2.3, 0);         // left side
      box(g, 0.12, 4.6, 1.4, shell, 0.94, 2.3, 0);          // right side
      box(g, 2.0, 4.6, 0.1, shell, 0, 2.3, -0.65);          // back
      box(g, 1.76, 3.9, 0.04, mat("#eaf6f7"), 0, 2.1, -0.58); // light liner
      box(g, 1.9, 0.35, 1.3, mat(C.dark), 0, 0.3, 0);        // compressor grille
      for (const y of [0.95, 2.1, 3.25]) box(g, 1.76, 0.05, 1.1, metal(C.steel), 0, y, 0);
      const bottleCols = ["#ff8a3d", "#5dbb5a", "#3d8bff", "#e8483b", "#f2b631"];
      const rows = [[0.975, [-0.65, -0.35, -0.05, 0.25, 0.55]], [2.125, [-0.65, -0.42, 0.45, 0.68]], [3.275, [-0.6, -0.3, 0, 0.3, 0.6]]];
      let k = 0;
      for (const [y, xs] of rows) for (const x of xs) {
        const c = bottleCols[k++ % bottleCols.length];
        cyl(g, 0.09, 0.09, 0.42, mat(c, { rough: 0.15 }), x, y + 0.21, 0.1);
        cyl(g, 0.035, 0.06, 0.14, mat(c, { rough: 0.15 }), x, y + 0.49, 0.1);
        cyl(g, 0.04, 0.04, 0.04, mat(C.white), x, y + 0.58, 0.1);
      }
      box(g, 1.76, 3.5, 0.03, glassM("#bfeaf0", 0.16), 0, 2.2, 0.66);
      box(g, 1.9, 0.1, 0.08, shiny(C.cream), 0, 3.97, 0.68);
      box(g, 1.9, 0.1, 0.08, shiny(C.cream), 0, 0.47, 0.68);
      box(g, 0.08, 3.6, 0.08, shiny(C.cream), -0.9, 2.2, 0.68);
      box(g, 0.08, 3.6, 0.08, shiny(C.cream), 0.9, 2.2, 0.68);
      cyl(g, 0.035, 0.035, 1.2, metal(C.steel), 0.74, 2.3, 0.78);
      const tex = canvasTex(512, 110, (x, w, h) => { x.fillStyle = "#fff"; x.font = `800 70px ${FONT}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("COLD DRINKS", w / 2, h / 2 + 4); });
      plane(g, 1.7, 0.36, texPlaneMat(tex, { transparent: true }), 0, 4.3, 0.705);
      return g;
    },

    // ---------------- front of house
    serviceCounter({ width = 12, depth = 1.1, height = 2.1 }) {
      const g = group();
      box(g, width, height - 0.12, depth, mat(C.cream), 0, (height - 0.12) / 2, 0);
      const n = Math.round(width / 0.6); const sw = width / n;
      for (let i = 0; i < n; i++) box(g, sw, height - 0.45, 0.05, mat(i % 2 ? C.cream : C.red, { rough: 0.5 }), -width / 2 + sw * (i + 0.5), (height - 0.45) / 2 + 0.25, depth / 2 + 0.02);
      box(g, width, 0.25, 0.06, mat(C.dark), 0, 0.125, depth / 2 + 0.03);
      rbox(g, width + 0.2, 0.14, depth + 0.3, 0.05, shiny(C.teal), 0, height - 0.07, 0.05);
      cyl(g, 0.42, 0.42, 0.06, shiny(C.mustard), 0, height / 2, depth / 2 + 0.07, Math.PI / 2, 0, 0, 36);
      const tex = canvasTex(256, 256, (x, w, h) => { x.fillStyle = C.red; x.font = `800 190px ${FONT}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("P", w / 2, h / 2 + 14); });
      plane(g, 0.6, 0.6, texPlaneMat(tex, { transparent: true }), 0, height / 2, depth / 2 + 0.105);
      return g;
    },
    floorMat() { const g = group(); rbox(g, 4.2, 0.03, 0.9, 0.02, mat("#9c2f28", { rough: 0.9 }), 0, 0.015, 0); rbox(g, 3.9, 0.035, 0.65, 0.02, mat("#b8322a", { rough: 0.9 }), 0, 0.02, 0); return g; },
    donutCase() {
      const g = group();
      cyl(g, 0.47, 0.5, 0.07, shiny(C.cream), 0, 0.035, 0, 0, 0, 0, 36);
      const cols = [C.pink, "#7a4a2a", C.pink, "#fff4dc", "#7a4a2a"];
      [[-0.2, 0.1, -0.12], [0.18, 0.1, -0.1], [-0.02, 0.1, 0.18], [0, 0.18, -0.02], [0.2, 0.1, 0.18]].forEach(([x, y, z], i) => {
        torus(g, 0.1, 0.055, mat(cols[i], { rough: 0.5 }), x, y, z, Math.PI / 2, 0, 0);
      });
      hemi(g, 0.46, glassM("#e7fbff", 0.22), 0, 0.07, 0, true);
      sph(g, 0.05, shiny(C.red), 0, 0.55, 0);
      return g;
    },
    tray({ with: w = [] }) {
      const g = group();
      rbox(g, 1.0, 0.06, 0.66, 0.04, shiny(C.orange), 0, 0.03, 0);
      box(g, 0.7, 0.01, 0.45, mat(C.cream, { rough: 0.9 }), 0, 0.065, 0);
      let x = -0.22;
      for (const it of w) {
        if (it === "burger") burger(g, x, 0.06, 0, 0.9);
        if (it === "fries") friesCarton(g, x, 0.06, 0, 0.95);
        if (it === "soda") sodaCup(g, x, 0.06, 0, C.red, 0.95);
        if (it === "bag") props.paperBag.call(null, {}, g, x, 0.06, 0);
        x += 0.45;
      }
      return g;
    },
    napkinDispenser() {
      const g = group();
      rbox(g, 0.36, 0.36, 0.24, 0.04, metal(C.steel), 0, 0.18, 0);
      box(g, 0.28, 0.08, 0.16, mat("#ffffff", { rough: 0.9 }), 0, 0.38, 0);
      return g;
    },
    fruitBasket() {
      const g = group();
      cyl(g, 0.34, 0.25, 0.22, mat(C.wood, { rough: 0.8 }), 0, 0.11, 0, 0, 0, 0, 20, true).material = mat(C.wood, { rough: 0.8, double: true });
      cyl(g, 0.25, 0.25, 0.02, mat(C.woodDark), 0, 0.02, 0);
      torus(g, 0.34, 0.025, mat(C.woodDark), 0, 0.22, 0, Math.PI / 2, 0, 0);
      for (const [x, z] of [[-0.12, -0.05], [0.05, -0.14], [-0.02, 0.1]]) sph(g, 0.11, shiny("#ff9a2e"), x, 0.25, z);
      torus(g, 0.17, 0.045, shiny("#ffd84a"), -0.05, 0.36, -0.02, 0.4, 0, 0.3, 1.5);
      return g;
    },
    register() {
      const g = group();
      rbox(g, 0.85, 0.3, 0.62, 0.04, mat(C.dark), 0, 0.15, 0);
      box(g, 0.8, 0.02, 0.01, mat("#222"), 0, 0.12, 0.31);
      rbox(g, 0.52, 0.06, 0.3, 0.02, mat("#4a5160"), -0.1, 0.34, 0.12, -0.3, 0, 0);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) box(g, 0.08, 0.02, 0.06, mat(i === 2 && j === 2 ? C.teal : C.cream), -0.22 + i * 0.12, 0.38 - j * 0.025, 0.05 + j * 0.08, -0.3, 0, 0);
      cyl(g, 0.03, 0.03, 0.42, mat(C.dark), 0.22, 0.5, -0.1);
      const tex = canvasTex(256, 180, (x, w, h) => {
        x.fillStyle = "#0e2a3d"; x.fillRect(0, 0, w, h);
        x.fillStyle = "#7fe3d6"; x.font = `700 30px ${FONT}`; x.fillText("ORDER 42", 18, 42);
        x.fillStyle = "#fff4dc"; x.font = `500 24px ${FONT}`; x.fillText("Combo x2", 18, 90); x.fillText("Shake", 18, 124);
        x.fillStyle = C.mustard; x.font = `700 30px ${FONT}`; x.textAlign = "right"; x.fillText("16.98", w - 16, 160);
      });
      rbox(g, 0.52, 0.38, 0.05, 0.02, mat(C.dark), 0.22, 0.84, -0.1);
      plane(g, 0.46, 0.32, texPlaneMat(tex, { glow: 0.7 }), 0.22, 0.84, -0.07);
      return g;
    },
    milkshake() {
      const g = group();
      cyl(g, 0.12, 0.07, 0.36, glassM("#ffffff", 0.35), 0, 0.18, 0);
      cyl(g, 0.11, 0.065, 0.32, mat(C.pink, { rough: 0.5 }), 0, 0.17, 0);
      sph(g, 0.12, mat(C.white, { rough: 0.7 }), 0, 0.38, 0, 1, 0.7, 1);
      sph(g, 0.045, shiny("#d6173c"), 0.02, 0.48, 0);
      cyl(g, 0.012, 0.012, 0.35, shiny(C.teal), -0.04, 0.5, 0, 0, 0, 0.25);
      return g;
    },
    heatLamp() {
      const g = group();
      cyl(g, 0.015, 0.015, 3.4, mat(C.dark), 0, 1.85, 0);
      cyl(g, 0.1, 0.4, 0.38, mat(C.red, { rough: 0.35, double: true }), 0, 0, 0, 0, 0, 0, 24, true);
      sph(g, 0.12, glow("#ffb24a", 1.6), 0, -0.1, 0);
      return g;
    },
    condimentStation() {
      const g = group();
      box(g, 2.2, 1.9, 1.0, mat(C.cream), 0, 0.95, 0);
      rbox(g, 2.32, 0.1, 1.1, 0.03, shiny(C.mustard), 0, 1.95, 0);
      for (const x of [-0.55, 0.55]) { box(g, 1.0, 1.55, 0.04, shiny(C.red), x, 0.9, 0.5); box(g, 0.05, 0.35, 0.05, metal(C.steel), x + (x < 0 ? 0.4 : -0.4), 1.1, 0.54); }
      box(g, 2.2, 0.15, 0.04, mat(C.dark), 0, 0.075, 0.5);
      return g;
    },
    ketchup() { const g = group(); squeeze(g, "#e0281f"); return g; },
    mustard() { const g = group(); squeeze(g, "#f7c400"); return g; },
    pepperShaker() { const g = group(); shaker(g, "#3a3f4b"); return g; },
    saucePump() {
      const g = group();
      box(g, 0.55, 0.06, 0.32, metal(C.steel), 0, 0.03, 0);
      [[-0.14, "#e0281f"], [0.14, "#7a4a1f"]].forEach(([x, c]) => {
        cyl(g, 0.1, 0.1, 0.32, mat(C.white, { rough: 0.3 }), x, 0.22, 0);
        box(g, 0.14, 0.12, 0.01, mat(c), x, 0.22, 0.1);
        cyl(g, 0.025, 0.025, 0.14, metal(C.dark), x, 0.45, 0);
        box(g, 0.16, 0.04, 0.05, mat(C.dark), x + 0.04, 0.53, 0);
      });
      return g;
    },
    strawHolder() {
      const g = group(); const cols = [C.red, C.teal, C.mustard, C.red, C.orange, C.teal];
      cols.forEach((c, i) => { const a = i * 1.05; cyl(g, 0.012, 0.012, 0.5, shiny(c), Math.cos(a) * 0.04, 0.3, Math.sin(a) * 0.04, Math.sin(a) * 0.12, 0, Math.cos(a) * 0.12); });
      cyl(g, 0.1, 0.09, 0.32, glassM("#e7fbff", 0.3), 0, 0.16, 0);
      return g;
    },
    balloons() {
      const g = group();
      [[-0.3, 4.6, 0, C.red], [0.25, 5.0, 0.1, C.mustard], [0.05, 4.2, -0.2, C.teal]].forEach(([x, y, z, c]) => {
        sph(g, 0.36, mat(c, { rough: 0.18 }), x, y, z, 1, 1.15, 1);
        cone(g, 0.05, 0.08, mat(c), x, y - 0.43, z, Math.PI, 0, 0);
        const len = y - 0.45; const m = cyl(g, 0.006, 0.006, len, mat(C.dark), x * 0.5, len / 2 + 0.1, z * 0.5);
        m.rotation.z = -x * 0.08; m.castShadow = false;
      });
      rbox(g, 0.2, 0.14, 0.2, 0.03, shiny(C.red), 0, 0.07, 0);
      return g;
    },
    trashBin() {
      const g = group();
      rbox(g, 0.95, 1.5, 0.8, 0.05, shiny(C.teal), 0, 0.75, 0);
      rbox(g, 1.0, 0.18, 0.85, 0.05, shiny(C.tealDark), 0, 1.55, 0);
      box(g, 0.55, 0.12, 0.02, mat("#12383a"), 0, 1.5, 0.43);
      const tex = canvasTex(256, 80, (x, w, h) => { x.fillStyle = C.cream; x.font = `800 44px ${FONT}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("THANK YOU", w / 2, h / 2 + 3); });
      plane(g, 0.8, 0.25, texPlaneMat(tex, { transparent: true }), 0, 1.0, 0.41);
      return g;
    },
    wetFloorSign() {
      const g = group(); const y = shiny("#ffd21f");
      box(g, 0.55, 1.05, 0.03, y, 0, 0.5, 0.15, -0.2, 0, 0);
      box(g, 0.55, 1.05, 0.03, y, 0, 0.5, -0.15, 0.2, 0, 0);
      cone(g, 0.16, 0.24, mat(C.dark), 0, 0.6, 0.27, -0.2 + Math.PI / 2 - Math.PI / 2, 0, 0, 3);
      box(g, 0.45, 0.07, 0.035, mat(C.dark), 0, 0.28, 0.21, -0.2, 0, 0);
      return g;
    },
    plant({ small = false }) {
      const g = group(); if (small) g.scale.setScalar(0.7);
      cyl(g, 0.38, 0.28, 0.62, shiny(C.orange), 0, 0.31, 0);
      cyl(g, 0.34, 0.34, 0.02, mat("#5a3a22"), 0, 0.6, 0);
      for (let i = 0; i < 9; i++) {
        const a = i * 0.7; const l = sph(g, 0.14, mat(i % 2 ? C.green : C.leaf, { rough: 0.5 }), Math.cos(a) * 0.18, 1.0 + (i % 3) * 0.15, Math.sin(a) * 0.18, 0.7, 3.2, 0.35);
        l.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5);
      }
      return g;
    },
    diningTable() {
      const g = group(); const s = metal(C.steel);
      cyl(g, 0.46, 0.5, 0.06, s, 0, 0.03, 0, 0, 0, 0, 32);
      cyl(g, 0.06, 0.06, 1.5, s, 0, 0.8, 0);
      cyl(g, 0.97, 0.97, 0.07, shiny(C.red), 0, 1.51, 0, 0, 0, 0, 40);
      cyl(g, 0.93, 0.93, 0.06, shiny(C.cream), 0, 1.57, 0, 0, 0, 0, 40);
      return g;
    },
    stool() {
      const g = group(); const s = metal(C.steel);
      cyl(g, 0.3, 0.32, 0.05, s, 0, 0.025, 0);
      cyl(g, 0.05, 0.05, 0.95, s, 0, 0.5, 0);
      torus(g, 0.22, 0.02, s, 0, 0.4, 0, Math.PI / 2, 0, 0);
      cyl(g, 0.35, 0.33, 0.14, shiny(C.red), 0, 1.03, 0, 0, 0, 0, 32);
      sph(g, 0.34, shiny(C.red), 0, 1.09, 0, 1, 0.18, 1);
      return g;
    },
    pendantLamp() {
      const g = group();
      cyl(g, 0.012, 0.012, 2.8, mat(C.dark), 0, 1.55, 0);
      cyl(g, 0.1, 0.48, 0.42, mat(C.mustard, { rough: 0.3, double: true }), 0, 0, 0, 0, 0, 0, 28, true);
      sph(g, 0.1, glow("#fff1c2", 1.8), 0, -0.14, 0);
      return g;
    },
    friesBasket() {
      const g = group();
      rbox(g, 0.55, 0.12, 0.38, 0.05, shiny(C.red), 0, 0.06, 0);
      box(g, 0.48, 0.01, 0.32, mat("#fff4dc"), 0, 0.125, 0);
      const r = rng(21); const y1 = mat("#ffd35c");
      for (let i = 0; i < 12; i++) box(g, 0.035, 0.035, 0.28, y1, (r() - 0.5) * 0.36, 0.15 + r() * 0.05, (r() - 0.5) * 0.12, 0, r() * 3, 0);
      return g;
    },
    sodaCup({ color = C.red }) { const g = group(); sodaCup(g, 0, 0, 0, color); return g; },
    paperBag(_, parent, x = 0, y = 0, z = 0) {
      const g = group(); if (parent) { g.position.set(x, y, z); g.scale.setScalar(0.8); parent.add(g); }
      box(g, 0.36, 0.46, 0.24, mat(C.kraft, { rough: 0.85 }), 0, 0.23, 0);
      box(g, 0.36, 0.08, 0.26, mat("#b18853", { rough: 0.85 }), 0, 0.49, 0);
      cyl(g, 0.08, 0.08, 0.01, mat(C.red), 0, 0.26, 0.125, Math.PI / 2, 0, 0);
      return g;
    },
    plate() { const g = group(); cyl(g, 0.3, 0.26, 0.035, shiny("#ffffff"), 0, 0.018, 0, 0, 0, 0, 32); return g; },
    burger() { const g = group(); burger(g, 0, 0, 0, 1); return g; },
  };

  // =====================================================================================
  // SHELL (floor, walls, dollhouse base)
  // =====================================================================================
  function shell(s) {
    const g = group();
    const W = s.width, D = s.depth, H = s.height, zb = s.zBack, zf = zb + D;
    const floorTex = canvasTex(256, 256, (x, w, h) => {
      x.fillStyle = s.floorA; x.fillRect(0, 0, w, h);
      x.fillStyle = s.floorB; x.fillRect(0, 0, w / 2, h / 2); x.fillRect(w / 2, h / 2, w / 2, h / 2);
      x.strokeStyle = "rgba(0,0,0,.08)"; x.lineWidth = 3; x.strokeRect(0, 0, w, h); x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke();
    });
    floorTex.wrapS = floorTex.wrapT = T.RepeatWrapping; floorTex.repeat.set(W / 2.2, D / 2.2);
    const floor = new T.Mesh(new T.BoxGeometry(W, 0.1, D), new T.MeshStandardMaterial({ map: floorTex, roughness: 0.35 }));
    floor.position.set(0, -0.05, zb + D / 2); floor.receiveShadow = true; g.add(floor);
    // dollhouse base
    box(g, W + 0.8, 0.7, D + 0.8, shiny(s.base), 0, -0.45, zb + D / 2).castShadow = false;
    box(g, W + 0.9, 0.12, D + 0.9, shiny(s.trim), 0, -0.1, zb + D / 2).castShadow = false;
    // back wall with tile texture on the lower half
    const tileTex = canvasTex(256, 128, (x, w, h) => {
      x.fillStyle = s.wallLower; x.fillRect(0, 0, w, h); x.strokeStyle = "rgba(120,90,50,.18)"; x.lineWidth = 4;
      for (let r = 0; r < 4; r++) { x.beginPath(); x.moveTo(0, r * 32); x.lineTo(w, r * 32); x.stroke(); for (let c = 0; c < 4; c++) { const ox = (c * 64 + (r % 2) * 32); x.beginPath(); x.moveTo(ox, r * 32); x.lineTo(ox, r * 32 + 32); x.stroke(); } }
    });
    tileTex.wrapS = tileTex.wrapT = T.RepeatWrapping; tileTex.repeat.set(W / 2, 4.4 / 1);
    const low = new T.Mesh(new T.BoxGeometry(W, 4.4, 0.3), new T.MeshStandardMaterial({ map: tileTex, roughness: 0.3 }));
    low.position.set(0, 2.2, zb - 0.15); low.receiveShadow = true; g.add(low);
    box(g, W, H - 4.4, 0.3, mat(s.wallUpper, { rough: 0.7 }), 0, 4.4 + (H - 4.4) / 2, zb - 0.15).castShadow = false;
    box(g, W, 0.18, 0.12, shiny(s.trim), 0, 4.4, zb + 0.05);
    // side walls
    for (const sx of [-1, 1]) {
      const w = box(g, 0.3, H, D, mat(s.sideWall, { rough: 0.6 }), sx * (W / 2 + 0.15), H / 2, zb + D / 2); w.castShadow = false;
      box(g, 0.34, 0.25, D + 0.02, shiny(s.trim), sx * (W / 2 + 0.15), H - 0.05, zb + D / 2);
    }
    box(g, W + 0.6, 0.25, 0.34, shiny(s.trim), 0, H - 0.05, zb - 0.15);
    // baseboard
    box(g, W, 0.2, 0.05, mat(s.base), 0, 0.1, zb + 0.02);
    g.traverse(o => { if (o.isMesh) o.userData.structure = true; });
    return g;
  }

  PF.models = { items, props, shell, mat, palette: C };
})();
