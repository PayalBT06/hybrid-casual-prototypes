/* MAIN: boot and wiring. Change START_ROOM to load a different room file. */
(function () {
  const START_ROOM = "lunch_rush";
  const $ = id => document.getElementById(id);

  function boot() {
    const view = new PF.View3D($("scene"));
    const game = new PF.Game(view, PF.UI);
    game.load(START_ROOM);

    $("hintBtn").addEventListener("click", () => game.hint());
    $("pauseBtn").addEventListener("click", () => game.pause(true));
    $("resumeBtn").addEventListener("click", () => game.pause(false));
    $("restartBtn").addEventListener("click", () => game.restart());
    $("nextRoomBtn").addEventListener("click", () => game.restart());   // prototype: Next Room replays this room
    $("resetCamBtn").addEventListener("click", () => view.resetView());
    for (const id of ["navLeft", "navRight"]) $(id).addEventListener("click", () => PF.UI.toast("Other rooms coming soon"));
    $("debugPanel").addEventListener("click", e => { if (e.target.id === "dbgTut") { game.resetTutorialFlag(); PF.UI.toast("Tutorial will show on next load"); } });

    window.addEventListener("keydown", e => {
      if (e.key === "d" || e.key === "D") game.toggleDebug();
      if (e.key === "Escape") game.pause(!game.paused);
      if (e.key === "h" || e.key === "H") game.hint();
    });
    const relayout = () => { PF.UI.rotateCheck(); requestAnimationFrame(() => game._layout()); };
    window.addEventListener("resize", relayout);
    relayout();

    // small test hook used by the automated checks (safe to leave in a prototype)
    PF.test = {
      game, view,
      instances: () => [...view.instances.values()].filter(i => i.alive).map(i => ({ uid: i.uid, item: i.item, busy: i.busy })),
      screenPos: uid => { const i = view.instances.get(uid); return i && i.center ? view.worldToClient(i.center) : null; },
      state: () => ({ found: game.found, wrong: game.wrong, hintsLeft: game.hintsLeft, selected: game.selected && game.selected.uid,
        slots: game.slots.map(t => t && t.id), complete: game.complete, active: game.active, zoom: view.cam.zoom / view.fit.zoom }),
    };
  }
  if (document.fonts && document.fonts.load) {
    Promise.race([Promise.all([document.fonts.load('800 40px "Baloo 2"'), document.fonts.load('800 20px Nunito')]), new Promise(r => setTimeout(r, 1200))]).then(boot, boot);
  } else boot();
})();
