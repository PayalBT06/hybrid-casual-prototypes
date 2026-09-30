/* UI: every DOM element (HUD, target cards, hint button, overlays, feedback, debug panel).
   It knows nothing about rules. game.js tells it what to show. */
window.PF = window.PF || { data: { rooms: {} } };

(function () {
  const $ = id => document.getElementById(id);
  const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const X_SVG = '<svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true"><circle cx="18" cy="18" r="16" fill="#fff" opacity=".9"/><path d="M11 11l14 14M25 11L11 25" stroke="#e8483b" stroke-width="5" stroke-linecap="round"/></svg>';
  const wait = ms => new Promise(r => setTimeout(r, ms));

  const UI = {
    thumbs: {},
    init(room, thumbs) {
      this.thumbs = thumbs;
      $("lvlLabel").textContent = "Level " + room.level;
      $("roomTitle").textContent = room.title;
      $("locLabel").textContent = room.location;
      $("totalCount").textContent = room.targets.length;
      const cards = $("cards"); cards.innerHTML = "";
      this.cardEls = [];
      for (let k = 0; k < room.visibleTargets; k++) {
        const c = document.createElement("div"); c.className = "card empty"; cards.appendChild(c); this.cardEls.push(c);
      }
      $("statTime").closest(".modal").querySelector("h2").textContent = room.title.toUpperCase() + " COMPLETE!";
    },
    insets() {
      const h = window.innerHeight;
      const hud = $("hud").getBoundingClientRect(); const panel = $("cards").getBoundingClientRect();
      return { top: Math.min(0.3, (hud.bottom + 6) / h), bottom: Math.max(0.5, (panel.top - 8) / h) };
    },

    // ---------------- cards
    setCard(k, target, animate) {
      const el = this.cardEls[k];
      el.className = "card";
      if (!target) { el.className = "card empty"; el.innerHTML = ""; el.dataset.target = ""; return; }
      const def = PF.data.items[target.id];
      el.dataset.target = target.id;
      let recipe = "";
      if (target.recipe) {
        const [a, b] = target.recipe.ingredients;
        recipe = `<div class="recipe" title="${PF.data.items[a].name} + ${PF.data.items[b].name}"><img src="${this.thumbs[a]}" alt="${PF.data.items[a].name}">+<img src="${this.thumbs[b]}" alt="${PF.data.items[b].name}"></div><span class="tag">MERGE</span>`;
        el.classList.add("merge");
      }
      el.innerHTML = `${recipe}<div class="thumb-wrap"><img class="thumb" src="${this.thumbs[target.id]}" alt=""></div><div class="name">${def.name}</div><div class="check"><i>${CHECK_SVG}</i></div>`;
      if (animate) { el.classList.add("enter"); setTimeout(() => el.classList.remove("enter"), 500); }
    },
    async completeCard(k) {
      const el = this.cardEls[k];
      el.classList.add("done");
      await wait(650);
      el.classList.add("leave");
      await wait(330);
    },
    flashCard(k) { const el = this.cardEls[k]; el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); },
    cardCenter(k) {
      const r = (k != null && this.cardEls[k] ? this.cardEls[k] : $("foundCount")).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height * 0.42 };
    },
    flyTo(itemId, from, to) {
      return new Promise(res => {
        const img = document.createElement("img"); img.className = "fly"; img.src = this.thumbs[itemId]; img.alt = "";
        img.style.left = from.x + "px"; img.style.top = from.y + "px";
        $("fx").appendChild(img);
        const dx = to.x - from.x, dy = to.y - from.y;
        const anim = img.animate([
          { transform: "translate(0,0) scale(.6)", opacity: 0 },
          { transform: `translate(${dx * 0.1}px, ${dy * 0.1 - 60}px) scale(1.25)`, opacity: 1, offset: 0.25 },
          { transform: `translate(${dx}px, ${dy}px) scale(.8)`, opacity: 1 },
        ], { duration: 650, easing: "cubic-bezier(.5,0,.3,1)" });
        anim.onfinish = () => { img.remove(); res(); };
      });
    },

    // ---------------- hud
    setProgress(found, total) {
      $("foundCount").textContent = found;
      $("progressFill").style.width = (100 * found / total) + "%";
    },
    setHints(n) {
      $("hintCount").textContent = n;
      $("hintBtn").classList.toggle("empty", n <= 0);
    },

    // ---------------- feedback
    redX(x, y) {
      const d = document.createElement("div"); d.className = "redx"; d.innerHTML = X_SVG;
      d.style.left = x + "px"; d.style.top = y + "px"; $("fx").appendChild(d);
      setTimeout(() => d.remove(), 750);
    },
    note(x, y, text) {
      const d = document.createElement("div"); d.className = "note"; d.textContent = text;
      d.style.left = x + "px"; d.style.top = (y - 16) + "px"; $("fx").appendChild(d);
      setTimeout(() => d.remove(), 1150);
    },
    toast(text, ms = 1800, coach = false) {
      const t = $("toast");
      t.textContent = text; t.hidden = false; t.classList.toggle("coach", coach);
      t.style.animation = "none"; void t.offsetWidth; t.style.animation = "";
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => (t.hidden = true), ms);
    },
    hideToast() { $("toast").hidden = true; },

    // ---------------- overlays
    coach(text, step) {
      return new Promise(res => {
        $("coachText").textContent = text; $("coachStep").textContent = step;
        const o = $("coach"); o.hidden = false;
        const done = () => { o.hidden = true; o.removeEventListener("pointerup", done); res(); };
        setTimeout(() => o.addEventListener("pointerup", done), 250);
      });
    },
    showPause(on) { $("pauseOverlay").hidden = !on; },
    showComplete(stats) {
      const m = Math.floor(stats.time / 60), s = Math.floor(stats.time % 60);
      $("statTime").textContent = `${m}:${String(s).padStart(2, "0")}`;
      $("statWrong").textContent = stats.wrong;
      $("statHints").textContent = stats.hints;
      $("completeOverlay").hidden = false;
    },
    hideComplete() { $("completeOverlay").hidden = true; },
    rotateCheck() { $("rotateNote").hidden = window.innerWidth >= window.innerHeight; },

    // ---------------- debug
    setDebug(on) { $("debugPanel").hidden = !on; if (!on) $("labels").innerHTML = ""; },
    renderDebug(html) { $("debugPanel").innerHTML = html; },
    renderLabels(list) {
      const root = $("labels");
      const have = new Map([...root.children].map(c => [c.dataset.uid, c]));
      const seen = new Set();
      for (const l of list) {
        let el = have.get(l.uid);
        if (!el) { el = document.createElement("div"); el.className = "dlabel"; el.dataset.uid = l.uid; root.appendChild(el); }
        el.textContent = l.text; el.classList.toggle("sel", !!l.sel);
        el.style.left = l.x + "px"; el.style.top = l.y + "px"; seen.add(l.uid);
      }
      for (const [uid, el] of have) if (!seen.has(uid)) el.remove();
    },
  };
  PF.UI = UI;
  PF.wait = wait;
})();
