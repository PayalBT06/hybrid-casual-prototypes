# Hybrid Casual Prototypes

Playable prototypes of hybrid casual game ideas, each testing a twist on merge mechanics.

**Play them in your browser:** https://payalbt06.github.io/hybrid-casual-prototypes/

| Game | Idea | Play |
|---|---|---|
| **Merge Siege** | Turn-based lane merge: merge numbered jellies, fire them into color-matched lanes | [Play](https://payalbt06.github.io/hybrid-casual-prototypes/merge-siege/) |
| **Pocket Find: Lunch Rush** | Hidden object plus in-scene merging in a 3D fast-food restaurant | [Play](https://payalbt06.github.io/hybrid-casual-prototypes/pocket-find/) |

---

## Merge Siege

Portrait, 8 levels including a hard level and a boss.

**Core loop**
- Four lanes of colored enemies march toward your wall. You have a 3x3 grid of colored jellies, a 3-slot bench, and a visible queue.
- Drag a jelly onto a lane whose front enemy matches its color to fire. Drop a jelly on a same-color jelly to merge (values add). Park jellies on the bench to free space.
- Every action moves the enemies one step, except an **exact kill** (zero leftover damage), which is free. Leftover damage **pierces** into the next same-color enemy.
- Wrong-color drops are refused at no cost, so losses come from planning, not mis-taps.

**Monetization hooks (simulated):** one revive per level, Freeze and Hammer boosters with +1 via rewarded ad. Stars: 3 clean, 2 with boosters, 1 with revive.

**Design questions being tested**
- Does "merge or fire" feel like a real decision?
- Does pierce create "aha" setups in the first 10 levels?
- Does a loss feel like the player's own fault?

**Tuning tools:** press **D** in game for a debug panel with a level solver and 400 simulated bot playouts per level.

## Pocket Find: Lunch Rush

Landscape, 3D (Three.js), one room with 10 targets.

**Core loop**
- Find tools and ingredients hidden in a dollhouse-style fast-food restaurant. Order cards show 4 targets at a time.
- Some dishes must be made: tap an ingredient, then its partner, and they merge right in the scene (tomato + tomato = tomato sauce, bread + cheese = sandwich, and so on).
- Tapping scenery counts as a wrong click. Three hints per level point you at the next useful item.

**Built to scale:** rooms, items and recipes are plain data files (`pocket-find/js/data/`), so a new room is a new data file.

**Controls:** drag to pan, scroll or pinch to zoom, **H** for a hint, **D** for debug.

---

## Run locally

Download or clone this repository and open `index.html` in a browser. No install or build step is needed.
