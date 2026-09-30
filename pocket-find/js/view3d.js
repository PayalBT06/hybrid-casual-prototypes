/* VIEW3D
   Everything that touches Three.js: renderer, lights, the orthographic dollhouse camera,
   pan / zoom / pinch, picking, item instances, effects and thumbnails.
   Gameplay rules live in game.js; this file only draws and reports clicks. */
window.PF = window.PF || { data: { rooms: {} } };

(function () {
  const T = THREE;
  const TILT = 15 * Math.PI / 180;           // camera elevation: frontal, slightly from above
  const BASE_H = 7;                          // half height of the ortho frustum at zoom 1
  const ease = {
    linear: k => k,
    outCubic: k => 1 - Math.pow(1 - k, 3),
    inCubic: k => k * k * k,
    inOutCubic: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    outBack: k => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
  };

  function makeSpriteTex(draw, size = 128) {
    const c = document.createElement("canvas"); c.width = c.height = size;
    draw(c.getContext("2d"), size);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  const STAR_TEX = () => makeSpriteTex((x, s) => {
    x.translate(s / 2, s / 2); x.fillStyle = "#fff"; x.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * 0.18 : s * 0.46; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    x.closePath(); x.fill();
  });
  const GLOW_TEX = () => makeSpriteTex((x, s) => {
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, s, s);
  });
  const RING_TEX = () => makeSpriteTex((x, s) => {
    x.strokeStyle = "#fff"; x.lineWidth = s * 0.07; x.beginPath(); x.arc(s / 2, s / 2, s * 0.4, 0, Math.PI * 2); x.stroke();
  });

  class View3D {
    constructor(container) {
      this.container = container;
      this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = T.PCFSoftShadowMap;
      this.renderer.setClearColor(0xf7e3c4);
      container.appendChild(this.renderer.domElement);
      this.canvas = this.renderer.domElement;

      this.scene = new T.Scene();
      this.scene.background = new T.Color("#f9e6c8");
      this.camera = new T.OrthographicCamera(-10, 10, BASE_H, -BASE_H, 0.1, 200);
      this.right = new T.Vector3(1, 0, 0);
      this.up = new T.Vector3(0, Math.cos(TILT), -Math.sin(TILT));
      this.back = new T.Vector3(0, Math.sin(TILT), Math.cos(TILT));
      this.cam = { r: 0, u: 3, zoom: 1 };
      this.fit = { r: 0, u: 3, zoom: 1 };
      this.ui = { topFrac: 0.1, bottomFrac: 0.76 };

      // lights: warm key with soft shadows, cool fill, sky/ground bounce
      this.scene.add(new T.HemisphereLight(0xfff4e0, 0xd9a88a, 1.25));
      const key = new T.DirectionalLight(0xfff0dc, 2.3);
      key.position.set(-8, 16, 14); key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      Object.assign(key.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 60 });
      key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
      this.scene.add(key);
      const fill = new T.DirectionalLight(0xcfeaff, 0.7); fill.position.set(10, 6, 12); this.scene.add(fill);
      this.scene.add(new T.AmbientLight(0xffffff, 0.25));

      this.roomRoot = new T.Group(); this.scene.add(this.roomRoot);
      this.fxRoot = new T.Group(); this.scene.add(this.fxRoot);
      this.instances = new Map();    // uid -> instance
      this.tweens = [];
      this.particles = [];
      this.raycaster = new T.Raycaster();
      this.tex = { star: STAR_TEX(), glow: GLOW_TEX(), ring: RING_TEX() };
      this.debug = false;
      this.onClick = null;          // (hit, clientX, clientY) => void
      this.onFrame = null;
      this.clock = new T.Clock();
      this.fps = 0; this._fpsAcc = 0; this._fpsN = 0;

      this._bindInput();
      window.addEventListener("resize", () => this.resize());
      this.resize();
      this.renderer.setAnimationLoop(() => this._frame());
    }

    // ------------------------------------------------------------------ room building
    buildRoom(room) {
      this.clearRoom();
      this.room = room;
      const shell = PF.models.shell(room.shell);
      this.roomRoot.add(shell);
      room.props.forEach((p, i) => {
        const b = PF.models.props[p.model];
        if (!b) { console.warn("missing prop model", p.model); return; }
        const g = b(p.params || {});
        place(g, p);
        g.userData.propId = p.model + "#" + i;
        g.traverse(o => { if (o.isMesh) o.userData.prop = g.userData.propId; });
        this.roomRoot.add(g);
      });
      const counts = {};
      room.placements.forEach(pl => {
        counts[pl.item] = (counts[pl.item] || 0) + 1;
        const pos = new T.Vector3(...pl.pos);
        this.spawnInstance(pl.item, pos, pl.rot, pl.item + "#" + counts[pl.item]);
      });
      this._computeBounds();
      this.fitView(true);
    }
    clearRoom() {
      for (const inst of this.instances.values()) this._disposeInstance(inst);
      this.instances.clear();
      while (this.roomRoot.children.length) this.roomRoot.remove(this.roomRoot.children[0]);
    }
    spawnInstance(itemId, pos, rot, uid) {
      const def = PF.data.items[itemId];
      const g = PF.models.items[def.model]();
      // per-instance materials so glow does not leak to other objects
      const mats = [];
      g.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.userData.baseEmissive = o.material.emissive.clone(); mats.push(o.material); } });
      const pivot = new T.Group();
      pivot.add(g);
      pivot.position.copy(pos);
      if (rot) g.rotation.set(...rot.map(d => d * Math.PI / 180));
      this.roomRoot.add(pivot);
      uid = uid || itemId + "#" + Math.random().toString(36).slice(2, 7);
      const inst = { uid, item: itemId, def, pivot, model: g, mats, home: pos.clone(), selected: false,
        pulseUntil: 0, pulseStart: 0, busy: false, scale: 1, hitbox: null, halo: null, alive: true };
      this.instances.set(uid, inst);
      this._makeHitbox(inst);
      return inst;
    }
    _makeHitbox(inst) {
      if (inst.hitbox) { this.scene.remove(inst.hitbox); }
      inst.pivot.updateMatrixWorld(true);
      const bb = new T.Box3().setFromObject(inst.model);
      const size = bb.getSize(new T.Vector3()); const c = bb.getCenter(new T.Vector3());
      const pad = inst.def.hitPad ?? 0.08;
      size.x = Math.max(size.x + pad * 2, 0.42); size.y = Math.max(size.y + pad * 2, 0.42); size.z = Math.max(size.z + pad * 2, 0.42);
      const hb = new T.Mesh(new T.BoxGeometry(size.x, size.y, size.z), new T.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true }));
      hb.position.copy(c); hb.visible = this.debug; hb.userData.inst = inst.uid;
      this.scene.add(hb);
      inst.hitbox = hb; inst.center = c.clone(); inst.size = size.clone();
    }
    _disposeInstance(inst) {
      inst.alive = false;
      if (inst.hitbox) this.scene.remove(inst.hitbox);
      if (inst.halo) this.fxRoot.remove(inst.halo);
      if (inst.pivot.parent) inst.pivot.parent.remove(inst.pivot);
      if (inst.label) inst.label.remove();
    }
    removeInstance(inst) { this._disposeInstance(inst); this.instances.delete(inst.uid); }

    _computeBounds() {
      const s = this.room.shell;
      const xs = [-s.width / 2 - 0.5, s.width / 2 + 0.5], ys = [-0.9, s.height + 0.15], zs = [s.zBack - 0.35, s.zBack + s.depth + 0.5];
      let rMin = Infinity, rMax = -Infinity, uMin = Infinity, uMax = -Infinity;
      for (const x of xs) for (const y of ys) for (const z of zs) {
        const p = new T.Vector3(x, y, z);
        const r = p.dot(this.right), u = p.dot(this.up);
        rMin = Math.min(rMin, r); rMax = Math.max(rMax, r); uMin = Math.min(uMin, u); uMax = Math.max(uMax, u);
      }
      this.bounds = { rMin, rMax, uMin, uMax };
    }

    // ------------------------------------------------------------------ camera
    resize() {
      const w = this.container.clientWidth, h = this.container.clientHeight;
      this.renderer.setSize(w, h, false);
      this.canvas.style.width = w + "px"; this.canvas.style.height = h + "px";
      this.aspect = w / Math.max(1, h);
      this.camera.left = -BASE_H * this.aspect; this.camera.right = BASE_H * this.aspect;
      this.camera.top = BASE_H; this.camera.bottom = -BASE_H;
      if (this.bounds) { const wasFit = Math.abs(this.cam.zoom - this.fit.zoom) < 1e-3; this.fitView(wasFit); }
      this._applyCamera();
    }
    setUiInsets(topFrac, bottomFrac) { this.ui = { topFrac, bottomFrac }; if (this.bounds) this.fitView(true); }
    fitView(apply) {
      const b = this.bounds; const { topFrac, bottomFrac } = this.ui;
      const roomW = b.rMax - b.rMin, roomH = b.uMax - b.uMin;
      const V = Math.max(roomH / Math.max(0.3, bottomFrac - topFrac), roomW / this.aspect / 0.97);
      const zoom = (2 * BASE_H) / V;
      const c = (topFrac + bottomFrac) / 2;
      const cu = (b.uMin + b.uMax) / 2 - (0.5 - c) * V;
      this.fit = { r: (b.rMin + b.rMax) / 2, u: cu, zoom };
      this.zoomMin = zoom * 0.95; this.zoomMax = zoom * 3.4;
      if (apply) { Object.assign(this.cam, this.fit); this._applyCamera(); }
    }
    viewSize() { const V = (2 * BASE_H) / this.cam.zoom; return { V, Wv: V * this.aspect }; }
    _clamp() {
      const b = this.bounds; if (!b) return;
      this.cam.zoom = Math.min(this.zoomMax, Math.max(this.zoomMin, this.cam.zoom));
      const { V, Wv } = this.viewSize(); const m = 1.0;
      let lo = b.rMin + Wv / 2 - m, hi = b.rMax - Wv / 2 + m;
      this.cam.r = lo > hi ? (b.rMin + b.rMax) / 2 : Math.min(hi, Math.max(lo, this.cam.r));
      const { topFrac, bottomFrac } = this.ui;
      lo = b.uMin - m - V * (0.5 - bottomFrac); hi = b.uMax + m - V * (0.5 - topFrac);
      this.cam.u = lo > hi ? this.fit.u + (this.cam.u - this.fit.u) * 0 : Math.min(hi, Math.max(lo, this.cam.u));
      if (lo > hi) this.cam.u = (lo + hi) / 2;
    }
    _applyCamera() {
      const center = this.right.clone().multiplyScalar(this.cam.r).add(this.up.clone().multiplyScalar(this.cam.u));
      this.camera.position.copy(center).addScaledVector(this.back, 60);
      this.camera.up.copy(this.up);
      this.camera.lookAt(center);
      this.camera.zoom = this.cam.zoom;
      this.camera.updateProjectionMatrix();
      this.camera.updateMatrixWorld();
    }
    clientToRU(cx, cy) {
      const rect = this.canvas.getBoundingClientRect();
      const nx = ((cx - rect.left) / rect.width) * 2 - 1, ny = -((cy - rect.top) / rect.height) * 2 + 1;
      const { V, Wv } = this.viewSize();
      return { r: this.cam.r + nx * Wv / 2, u: this.cam.u + ny * V / 2 };
    }
    zoomAt(cx, cy, factor) {
      const before = this.clientToRU(cx, cy);
      this.cam.zoom = Math.min(this.zoomMax, Math.max(this.zoomMin, this.cam.zoom * factor));
      const after = this.clientToRU(cx, cy);
      this.cam.r += before.r - after.r; this.cam.u += before.u - after.u;
      this._clamp(); this._applyCamera();
    }
    animateCamera(to, dur = 650) {
      const from = { ...this.cam };
      return this.tween(dur, k => {
        this.cam.r = from.r + (to.r - from.r) * k; this.cam.u = from.u + (to.u - from.u) * k; this.cam.zoom = from.zoom + (to.zoom - from.zoom) * k;
        this._applyCamera();
      }, ease.inOutCubic).then(() => { this._clamp(); this._applyCamera(); });
    }
    resetView() { this.fitView(false); return this.animateCamera({ ...this.fit }); }
    focusOn(inst, minZoomMul = 1.9) {
      const c = inst.center || inst.pivot.position;
      const zoom = Math.max(this.cam.zoom, this.fit.zoom * minZoomMul);
      const V = (2 * BASE_H) / zoom; const { topFrac, bottomFrac } = this.ui;
      const mid = (topFrac + bottomFrac) / 2;
      const to = { r: c.dot(this.right), u: c.dot(this.up) - (0.5 - mid) * V, zoom };
      const save = { ...this.cam }; Object.assign(this.cam, to); this._clamp(); const clamped = { ...this.cam }; Object.assign(this.cam, save);
      return this.animateCamera(clamped, 600);
    }
    isOnScreen(inst) {
      const p = this.worldToClient(inst.center || inst.pivot.position);
      const rect = this.canvas.getBoundingClientRect();
      const { topFrac, bottomFrac } = this.ui;
      return p.x > rect.left + 40 && p.x < rect.right - 40 && p.y > rect.top + rect.height * topFrac && p.y < rect.top + rect.height * bottomFrac;
    }

    // ------------------------------------------------------------------ input
    _bindInput() {
      const el = this.canvas;
      const ptrs = new Map(); let drag = null, pinch = null, multi = false;
      el.addEventListener("pointerdown", e => {
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or already released pointer */ }
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ptrs.size === 1) { drag = { x: e.clientX, y: e.clientY, r: this.cam.r, u: this.cam.u, moved: false }; multi = false; }
        if (ptrs.size === 2) {
          const [a, b] = [...ptrs.values()];
          pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.cam.zoom }; multi = true; drag = null;
        }
      });
      el.addEventListener("pointermove", e => {
        if (!ptrs.has(e.pointerId)) return;
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ptrs.size === 2 && pinch) {
          const [a, b] = [...ptrs.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          const target = pinch.zoom * d / Math.max(1, pinch.d);
          this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, target / this.cam.zoom);
          return;
        }
        if (drag) {
          const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
          if (!drag.moved && Math.hypot(dx, dy) > 6) { drag.moved = true; el.style.cursor = "grabbing"; }
          if (drag.moved) {
            const rect = el.getBoundingClientRect(); const { V, Wv } = this.viewSize();
            this.cam.r = drag.r - dx * Wv / rect.width; this.cam.u = drag.u + dy * V / rect.height;
            this._clamp(); this._applyCamera();
          }
        }
      });
      const end = e => {
        if (!ptrs.has(e.pointerId)) return;
        ptrs.delete(e.pointerId);
        el.style.cursor = "";
        if (ptrs.size < 2) pinch = null;
        if (ptrs.size === 0) {
          if (drag && !drag.moved && !multi && e.type === "pointerup" && this.onClick) this.onClick(this.pick(e.clientX, e.clientY), e.clientX, e.clientY);
          drag = null;
        }
      };
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
      el.addEventListener("wheel", e => { e.preventDefault(); this.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
      el.addEventListener("contextmenu", e => e.preventDefault());
    }
    pick(cx, cy) {
      const rect = this.canvas.getBoundingClientRect();
      const ndc = new T.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.camera);
      const boxes = [...this.instances.values()].filter(i => i.alive && !i.busy && i.hitbox).map(i => i.hitbox);
      const hits = this.raycaster.intersectObjects(boxes, false);
      if (hits.length) {
        // several colliders can overlap: prefer the one whose center is closest to the ray
        let best = null, bestD = Infinity;
        for (const h of hits.slice(0, 4)) {
          const inst = this.instances.get(h.object.userData.inst);
          const d = this.raycaster.ray.distanceSqToPoint(inst.center) / Math.max(0.05, inst.size.lengthSq());
          if (d < bestD) { bestD = d; best = inst; }
        }
        return { type: "item", inst: best };
      }
      const sh = this.raycaster.intersectObjects(this.roomRoot.children, true);
      for (const h of sh) {
        if (h.object.userData.prop) return { type: "prop", prop: h.object.userData.prop, point: h.point };
        if (h.object.userData.structure) return { type: "structure", point: h.point };
      }
      return { type: "none" };
    }
    worldToClient(v) {
      const p = v.clone().project(this.camera); const rect = this.canvas.getBoundingClientRect();
      return { x: rect.left + (p.x + 1) / 2 * rect.width, y: rect.top + (1 - p.y) / 2 * rect.height };
    }

    // ------------------------------------------------------------------ effects
    tween(dur, fn, e = ease.linear) {
      return new Promise(res => this.tweens.push({ t0: performance.now(), dur, fn, e, res }));
    }
    setSelected(inst, on) {
      inst.selected = on;
      this._setGlow(inst, on ? new T.Color("#ffcf4a") : null, on ? 0.45 : 0);
      this._setHalo(inst, on ? "#fff3b0" : null);
    }
    pulse(inst, ms = 2000) {
      inst.pulseStart = performance.now(); inst.pulseUntil = inst.pulseStart + ms;
      this._setHalo(inst, "#ffffff");
    }
    _setGlow(inst, color, intensity) {
      for (const m of inst.mats) {
        if (color) { m.emissive.copy(color); m.emissiveIntensity = intensity; }
        else { m.emissive.copy(m.userData.baseEmissive); m.emissiveIntensity = 1; }
      }
    }
    _setHalo(inst, color) {
      if (!color) { if (inst.halo && !inst.selected && performance.now() > inst.pulseUntil) { this.fxRoot.remove(inst.halo); inst.halo = null; } return; }
      if (!inst.halo) {
        const s = new T.Sprite(new T.SpriteMaterial({ map: this.tex.glow, transparent: true, depthTest: false, depthWrite: false, opacity: 0.8 }));
        s.renderOrder = 10; this.fxRoot.add(s); inst.halo = s;
      }
      inst.halo.material.color.set(color);
      inst.halo.position.copy(inst.center);
    }
    sparkles(pos, colors = ["#ffd24a", "#ffffff", "#ff8fb1", "#5ff2e0"], n = 22, spread = 1) {
      for (let i = 0; i < n; i++) {
        const s = new T.Sprite(new T.SpriteMaterial({ map: this.tex.star, color: colors[i % colors.length], transparent: true, depthTest: false, depthWrite: false }));
        s.renderOrder = 20; s.position.copy(pos);
        const a = Math.random() * Math.PI * 2, sp = (1.5 + Math.random() * 3) * spread;
        s.userData = { v: new T.Vector3(Math.cos(a) * sp, 2 + Math.random() * 3.5, Math.sin(a) * sp * 0.4), t0: performance.now(), life: 650 + Math.random() * 450, size: 0.18 + Math.random() * 0.2, spin: (Math.random() - 0.5) * 8 };
        this.fxRoot.add(s); this.particles.push(s);
      }
      const ring = new T.Sprite(new T.SpriteMaterial({ map: this.tex.ring, color: "#fff6c2", transparent: true, depthTest: false, depthWrite: false }));
      ring.renderOrder = 19; ring.position.copy(pos); ring.userData = { ring: true, t0: performance.now(), life: 450, size: 0.3 };
      this.fxRoot.add(ring); this.particles.push(ring);
    }
    async popRemove(inst) {
      inst.busy = true; this.setSelected(inst, false);
      if (inst.hitbox) { this.scene.remove(inst.hitbox); inst.hitbox = null; }
      this.sparkles(inst.center.clone());
      await this.tween(420, k => {
        const s = k < 0.35 ? 1 + 0.4 * ease.outCubic(k / 0.35) : 1.4 * (1 - ease.inCubic((k - 0.35) / 0.65));
        inst.scale = Math.max(0.001, s);
      });
      this.removeInstance(inst);
    }
    async merge(a, b, resultItem) {
      a.busy = b.busy = true;
      this.setSelected(a, false); this.setSelected(b, false);
      for (const i of [a, b]) if (i.hitbox) { this.scene.remove(i.hitbox); i.hitbox = null; }
      const pa = a.pivot.position.clone(), pb = b.pivot.position.clone();
      const ca = a.center.clone().sub(pa), cb = b.center.clone().sub(pb);
      const mid = a.center.clone().add(b.center).multiplyScalar(0.5).add(new T.Vector3(0, 0.9, 0));
      await this.tween(460, k => {
        const lift = Math.sin(k * Math.PI) * 0.6;
        a.pivot.position.lerpVectors(pa, mid.clone().sub(ca), k).y += lift;
        b.pivot.position.lerpVectors(pb, mid.clone().sub(cb), k).y += lift;
        a.scale = b.scale = 1 - 0.35 * k;
        a.model.rotation.y += 0.2; b.model.rotation.y -= 0.2;
      }, ease.inCubic);
      this.removeInstance(a); this.removeInstance(b);
      this.sparkles(mid, undefined, 30, 1.3);
      const res = this.spawnInstance(resultItem, mid.clone(), null);
      if (res.hitbox) { this.scene.remove(res.hitbox); res.hitbox = null; }
      res.busy = true;
      const off = res.center.clone().sub(res.pivot.position);
      res.pivot.position.copy(mid).sub(off);
      await this.tween(380, k => { res.scale = Math.max(0.01, ease.outBack(k)) * 1.25; }, ease.linear);
      res.restAt = pb.clone();
      return res;
    }
    async settle(inst, pos) {
      const from = inst.pivot.position.clone();
      await this.tween(420, k => {
        inst.pivot.position.lerpVectors(from, pos, k).y += Math.sin(k * Math.PI) * 0.3;
        inst.scale = 1.25 - 0.25 * k;
      }, ease.outCubic);
      inst.home = pos.clone(); inst.busy = false; inst.scale = 1;
      this._makeHitbox(inst);
    }

    setDebug(on) {
      this.debug = on;
      for (const i of this.instances.values()) if (i.hitbox) i.hitbox.visible = on;
    }

    // ------------------------------------------------------------------ per frame
    _frame() {
      const now = performance.now(); const dt = Math.min(0.05, this.clock.getDelta());
      this._fpsAcc += dt; this._fpsN++; if (this._fpsAcc > 0.5) { this.fps = Math.round(this._fpsN / this._fpsAcc); this._fpsAcc = 0; this._fpsN = 0; }
      // tweens
      for (let i = this.tweens.length - 1; i >= 0; i--) {
        const tw = this.tweens[i]; const k = Math.min(1, (now - tw.t0) / tw.dur);
        tw.fn(tw.e(k));
        if (k >= 1) { this.tweens.splice(i, 1); tw.res(); }
      }
      // instances
      const t = now / 1000;
      for (const inst of this.instances.values()) {
        let s = inst.scale; let bob = 0;
        if (inst.selected) { s *= 1.16; bob = 0.06 + Math.sin(t * 5) * 0.04; }
        if (now < inst.pulseUntil) {
          const k = (now - inst.pulseStart) / 1000;
          s *= 1 + 0.16 * Math.abs(Math.sin(k * Math.PI * 2.5));
          this._setGlow(inst, new T.Color("#ffffff"), 0.35 + 0.35 * Math.abs(Math.sin(k * Math.PI * 2.5)));
        } else if (inst.pulseUntil) {
          inst.pulseUntil = 0; this._setGlow(inst, inst.selected ? new T.Color("#ffcf4a") : null, inst.selected ? 0.45 : 0);
          if (!inst.selected) this._setHalo(inst, null);
        }
        inst.pivot.scale.setScalar(s);
        inst.model.position.y = bob;
        if (inst.halo) {
          inst.halo.position.copy(inst.center || inst.pivot.position);
          const base = Math.max(inst.size ? inst.size.length() : 0.8, 0.7) * 1.5;
          inst.halo.scale.setScalar(base * (1 + 0.12 * Math.sin(t * 6)));
          inst.halo.material.opacity = now < inst.pulseUntil ? 0.9 : 0.6;
        }
      }
      // particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i]; const d = p.userData; const k = (now - d.t0) / d.life;
        if (k >= 1) { this.fxRoot.remove(p); p.material.dispose(); this.particles.splice(i, 1); continue; }
        if (d.ring) { p.scale.setScalar(0.4 + k * 2.4); p.material.opacity = 1 - k; continue; }
        d.v.y -= 9 * dt; p.position.addScaledVector(d.v, dt);
        p.material.rotation += d.spin * dt;
        p.scale.setScalar(d.size * (1 - k * 0.6)); p.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      }
      if (this.onFrame) this.onFrame(now);
      this.renderer.render(this.scene, this.camera);
    }

    // ------------------------------------------------------------------ thumbnails for target cards
    makeThumbnails(itemIds, size = 192) {
      const r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setSize(size, size); r.setPixelRatio(1);
      const sc = new T.Scene();
      sc.add(new T.HemisphereLight(0xffffff, 0xd9b99a, 1.6));
      const d = new T.DirectionalLight(0xffffff, 2.2); d.position.set(2, 4, 5); sc.add(d);
      const cam = new T.PerspectiveCamera(30, 1, 0.01, 50);
      const out = {};
      for (const id of itemIds) {
        const g = PF.models.items[PF.data.items[id].model]();
        g.rotation.y = -0.45; sc.add(g);
        const bs = new T.Box3().setFromObject(g).getBoundingSphere(new T.Sphere());
        const dist = bs.radius / Math.sin((30 / 2) * Math.PI / 180) * 1.02;
        cam.position.set(bs.center.x, bs.center.y + dist * 0.42, bs.center.z + dist * 0.9);
        cam.lookAt(bs.center);
        r.render(sc, cam);
        out[id] = r.domElement.toDataURL("image/png");
        sc.remove(g);
      }
      r.dispose(); r.forceContextLoss();
      return out;
    }
  }

  function place(obj, p) {
    obj.position.set(...p.pos);
    if (p.rot) obj.rotation.set(...p.rot.map(d => d * Math.PI / 180));
    if (p.scale) obj.scale.setScalar(p.scale);
  }

  PF.View3D = View3D;
  PF.ease = ease;
})();
