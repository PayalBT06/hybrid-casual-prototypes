/* GAME: rules and state. Reads data (items, recipes, rooms), drives View3D and UI.
   Nothing here is specific to the fast-food room, so new rooms only need a new data file. */
window.PF = window.PF || { data: { rooms: {} } };

(function () {
  const TUTORIAL_KEY = "pocketFind.tutorialDone";
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };

  class Game {
    constructor(view, ui) {
      this.view = view; this.ui = ui;
      // derived recipe lookups (order independent, supports matching and mixed pairs)
      this.recipes = PF.data.recipes;
      this.pairKey = (a, b) => [a, b].sort().join("+");
      this.byPair = new Map(this.recipes.map(r => [this.pairKey(...r.ingredients), r]));
      this.byResult = new Map(this.recipes.map(r => [r.result, r]));
      this.ingredients = new Set(this.recipes.flatMap(r => r.ingredients));
      view.onClick = (hit, x, y) => this.onClick(hit, x, y);
      view.onFrame = now => this.onFrame(now);
    }

    // ------------------------------------------------------------ lifecycle
    load(roomId, { skipTutorial = false } = {}) {
      const room = PF.data.rooms[roomId];
      this.room = room;
      this.targets = room.targets.map(id => ({ id, done: false, recipe: this.byResult.get(id) || null }));
      this.slots = new Array(room.visibleTargets).fill(null);
      this.queue = this.targets.slice();
      this.selected = null;
      this.hintsLeft = room.hints; this.hintsUsed = 0; this.wrong = 0;
      this.elapsed = 0; this.lastTick = null;
      this.active = false; this.paused = false; this.complete = false;
      this.firstSelectTip = false;
      this.view.buildRoom(room);
      this.ui.init(room, this.thumbs || (this.thumbs = this.view.makeThumbnails(Object.keys(PF.data.items))));
      for (let k = 0; k < this.slots.length; k++) this._fillSlot(k, false);
      this.ui.setProgress(0, this.targets.length);
      this.ui.setHints(this.hintsLeft);
      this.ui.hideComplete();
      this._layout();
      if (!skipTutorial && store.get(TUTORIAL_KEY) !== "1") this._tutorial();
      else this._start();
    }
    async _tutorial() {
      await PF.wait(500);
      await this.ui.coach("Find ingredients and tools hidden around the restaurant.", "1 / 2");
      await this.ui.coach("Some dishes need to be created.", "2 / 2");
      this.firstSelectTip = true;
      this._start();
    }
    _start() { this.active = true; this.lastTick = performance.now(); }
    restart() { this.ui.showPause(false); this.load(this.room.id, { skipTutorial: true }); }
    pause(on) {
      if (this.complete) return;
      this.paused = on; this.ui.showPause(on);
      if (!on) this.lastTick = performance.now();
    }
    _layout() { const i = this.ui.insets(); this.view.setUiInsets(i.top, i.bottom); }

    // ------------------------------------------------------------ helpers
    target(id) { return this.targets.find(t => t.id === id); }
    unfinished(id) { const t = this.target(id); return !!t && !t.done; }
    slotOf(id) { return this.slots.findIndex(t => t && t.id === id); }
    recipeFor(a, b) { return this.byPair.get(this.pairKey(a, b)) || null; }
    alive(itemId) { return [...this.view.instances.values()].filter(i => i.alive && i.item === itemId && !i.busy); }
    get found() { return this.targets.filter(t => t.done).length; }
    get canPlay() { return this.active && !this.paused && !this.complete; }

    _fillSlot(k, animate) {
      const next = this.queue.find(t => !t.done && !this.slots.includes(t));
      if (next) this.queue = this.queue.filter(t => t !== next);
      this.slots[k] = next || null;
      this.ui.setCard(k, next || null, animate);
      // a merge result that was made early and is waiting in the room gets collected as soon as its card shows up
      if (next && next.recipe) {
        const waiting = this.alive(next.id)[0];
        if (waiting) setTimeout(() => { if (waiting.alive && !waiting.busy && this.unfinished(next.id)) this.collect(waiting); }, 700);
      }
    }

    // ------------------------------------------------------------ input
    onClick(hit, x, y) {
      if (!this.canPlay) return;
      if (hit.type === "item") {
        const inst = hit.inst;
        if (this.ingredients.has(inst.item)) {
          if (this.selected === inst) return this.select(null);
          if (this.selected && this.recipeFor(this.selected.item, inst.item)) return this.merge(this.selected, inst);
          return this.select(inst);
        }
        this.select(null);
        if (this.unfinished(inst.item)) return this.collect(inst);
        this.ui.note(x, y, "Not on your list");
        return;
      }
      if (hit.type === "prop") {
        this.wrong++;
        this.ui.redX(x, y);
        this.select(null);
        return;
      }
      this.select(null);
    }
    select(inst) {
      if (this.selected) this.view.setSelected(this.selected, false);
      this.selected = inst;
      if (inst) {
        this.view.setSelected(inst, true);
        if (this.firstSelectTip) {
          this.firstSelectTip = false; store.set(TUTORIAL_KEY, "1");
          this.ui.toast("Find another matching ingredient to merge them!", 4200, true);
        }
      }
    }

    // ------------------------------------------------------------ core actions
    async collect(inst) {
      const t = this.target(inst.item);
      if (!t || t.done || inst.busy) return;
      t.done = true;
      const k = this.slotOf(t.id);
      const from = this.view.worldToClient(inst.center);
      this.view.popRemove(inst);
      this.ui.setProgress(this.found, this.targets.length);
      await this.ui.flyTo(t.id, from, this.ui.cardCenter(k >= 0 ? k : null));
      if (k >= 0) {
        await this.ui.completeCard(k);
        this._fillSlot(k, true);
      } else {
        this.queue = this.queue.filter(q => q !== t);
      }
      if (this.found === this.targets.length) this._finish();
    }
    async merge(a, b) {
      const recipe = this.recipeFor(a.item, b.item);
      this.selected = null;
      this.ui.hideToast();
      const res = await this.view.merge(a, b, recipe.result);
      if (this.unfinished(recipe.result) && this.slotOf(recipe.result) >= 0) {
        await PF.wait(180);
        res.busy = false;
        this.collect(res);
      } else {
        await this.view.settle(res, res.restAt);
        const k = this.slotOf(recipe.result);
        if (this.unfinished(recipe.result) && k < 0) {
          const p = this.view.worldToClient(res.center);
          this.ui.note(p.x, p.y - 20, "Saved for a later order");
        }
      }
    }
    async hint() {
      if (!this.canPlay) return;
      if (this.hintsLeft <= 0) { this.ui.toast("No hints left"); return; }
      const inst = this.findHint();
      if (!inst) { this.ui.toast("Nothing left to hint"); return; }
      this.hintsLeft--; this.hintsUsed++;
      this.ui.setHints(this.hintsLeft);
      const zoomedIn = this.view.cam.zoom >= this.view.fit.zoom * 1.5;
      if (!zoomedIn || !this.view.isOnScreen(inst)) await this.view.focusOn(inst);
      this.view.pulse(inst, 2000);
    }
    findHint() {
      // 1. an ingredient is selected: point at its partner
      if (this.selected) {
        for (const r of this.recipes) {
          if (!r.ingredients.includes(this.selected.item) || !this.unfinished(r.result)) continue;
          const other = r.ingredients[0] === this.selected.item ? r.ingredients[1] : r.ingredients[0];
          const p = this.alive(other).find(i => i !== this.selected);
          if (p) return p;
        }
      }
      // 2. visible cards first, then upcoming targets
      const order = [...this.slots.filter(Boolean), ...this.queue].filter(t => !t.done);
      for (const t of order) {
        const direct = this.alive(t.id)[0];
        if (direct) return direct;
        if (t.recipe) {
          const [a, b] = t.recipe.ingredients;
          const ia = this.alive(a), ib = this.alive(b);
          const okPair = a === b ? ia.length >= 2 : ia.length >= 1 && ib.length >= 1;
          if (okPair) return ia[0];
        }
      }
      return null;
    }
    _finish() {
      this.complete = true; this.active = false;
      this.select(null);
      setTimeout(() => this.ui.showComplete({ time: this.elapsed, wrong: this.wrong, hints: this.hintsUsed }), 450);
    }

    // ------------------------------------------------------------ frame + debug
    onFrame(now) {
      if (this.canPlay && this.lastTick != null) { this.elapsed += (now - this.lastTick) / 1000; }
      this.lastTick = now;
      if (this.debug) {
        const labels = [];
        for (const i of this.view.instances.values()) {
          if (!i.alive || !i.center) continue;
          const p = this.view.worldToClient(i.center.clone().add(new THREE.Vector3(0, (i.size ? i.size.y / 2 : 0.3) + 0.05, 0)));
          labels.push({ uid: i.uid, text: i.uid + (i.busy ? " (busy)" : ""), x: p.x, y: p.y, sel: this.selected === i });
        }
        this.ui.renderLabels(labels);
        if (!this._dbgT || now - this._dbgT > 250) { this._dbgT = now; this.ui.renderDebug(this.debugHtml()); }
      }
    }
    toggleDebug() {
      this.debug = !this.debug;
      this.view.setDebug(this.debug);
      this.ui.setDebug(this.debug);
      if (this.debug) this.ui.renderDebug(this.debugHtml());
    }
    debugHtml() {
      const count = id => this.alive(id).length;
      const rem = this.targets.filter(t => !t.done).map(t => {
        const where = this.slotOf(t.id) >= 0 ? "card " + (this.slotOf(t.id) + 1) : "queued";
        return `  ${t.id.padEnd(13)} ${t.recipe ? "merge" : "find "} ${where}`;
      }).join("\n");
      const rec = this.recipes.map(r => {
        const [a, b] = r.ingredients;
        const have = a === b ? `${a} x${count(a)}` : `${a} x${count(a)}, ${b} x${count(b)}`;
        return `  ${a} + ${b} = ${r.result}${this.unfinished(r.result) ? "" : " (done)"}\n    in room: ${have}`;
      }).join("\n");
      return `<b>DEBUG</b>  (press D to close)
FPS ${this.view.fps}   time ${this.elapsed.toFixed(1)}s
selected: ${this.selected ? this.selected.uid : "none"}
wrong clicks ${this.wrong}   hints left ${this.hintsLeft}
zoom ${(this.view.cam.zoom / this.view.fit.zoom).toFixed(2)}x of fit

<b>Remaining targets (${this.targets.length - this.found})</b>
${rem || "  none"}

<b>Recipes</b>
${rec}

<button id="dbgTut" style="margin-top:8px;font:inherit;border:0;border-radius:6px;padding:4px 8px;cursor:pointer">Reset tutorial flag</button>`;
    }
    resetTutorialFlag() { store.del(TUTORIAL_KEY); }
  }

  PF.Game = Game;
})();
