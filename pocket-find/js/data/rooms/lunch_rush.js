/* ROOM: Lunch Rush (Level 1)
   Units are world units. Floor top is y = 0. The open front of the dollhouse faces +z (the camera).
   shell      : size and colors of the floor, walls and base
   targets    : the 10 target cards, in the order they are dealt (4 visible at a time)
   placements : clickable items (ids from items.js). The same item can be placed more than once.
   props      : scenery (builders in js/models.js -> PF.models.props). Clicking a prop is a wrong click.
   pos        : [x, y, z]; rot: degrees [x, y, z]; scale: number
   Floor props use their base as origin. Wall props (signs, boards, clocks) use their center. */
window.PF = window.PF || { data: { rooms: {} } };

PF.data.rooms.lunch_rush = {
  id: "lunch_rush",
  level: 1,
  title: "Lunch Rush",
  location: "Fast-Food Counter",
  hints: 3,
  visibleTargets: 4,

  shell: {
    width: 22, depth: 8, height: 9, zBack: -5,
    floorA: "#fff4dc", floorB: "#e8483b",
    wallLower: "#fff4dc", wallUpper: "#2bb3a3", sideWall: "#f2b631", base: "#d63c30", trim: "#f47c2c",
  },

  targets: [
    "chef_hat", "tomato_sauce", "frying_pan", "sandwich",
    "whisk", "omelette", "wooden_spoon", "salt_shaker",
    "apple_pie", "kettle",
  ],

  placements: [
    { item: "chef_hat",     pos: [-8.25, 5.92, -4.5] },
    { item: "kettle",       pos: [-9.55, 4.52, -4.5], rot: [0, 25, 0] },
    { item: "frying_pan",   pos: [-4.95, 4.15, -4.82], rot: [90, 0, 0] },
    { item: "whisk",        pos: [1.95, 2.24, -3.75], rot: [0, 0, 90] },
    { item: "wooden_spoon", pos: [3.98, 2.16, -4.48], rot: [0, 0, -12] },
    { item: "salt_shaker",  pos: [-2.35, 1.6, 1.72] },

    { item: "tomato", pos: [2.2, 2.19, -4.12] },
    { item: "tomato", pos: [-9.05, 0.6, -1.62] },
    { item: "bread",  pos: [-8.35, 3.12, -4.5], rot: [0, 8, 0] },
    { item: "cheese", pos: [9.55, 2.25, -3.75], rot: [0, 20, 0] },
    { item: "egg",    pos: [3.22, 2.24, -3.92] },
    { item: "egg",    pos: [2.12, 1.67, 1.52] },
    { item: "apple",  pos: [-1.52, 2.34, -1.5] },
    { item: "apple",  pos: [-7.05, 1.6, 1.02] },
  ],

  props: [
    // back wall and framing
    { model: "brandSign",  pos: [-7.3, 7.15, -4.93] },
    { model: "awning",     pos: [0, 8.45, -4.88], params: { width: 21.7 } },
    { model: "menuBoard",  pos: [3.5, 6.6, -4.93] },
    { model: "wallClock",  pos: [-1.05, 7.2, -4.93] },
    { model: "neonOpen",   pos: [9.3, 6.55, -4.93] },

    // kitchen, left
    { model: "wallShelf",      pos: [-8.8, 0, -4.68], params: { width: 3.3, levels: [3.1, 4.5, 5.9] } },
    { model: "container",      pos: [-9.85, 3.1, -4.55], params: { lid: "#e8483b" } },
    { model: "jarSet",         pos: [-7.55, 3.1, -4.55] },
    { model: "container",      pos: [-8.25, 4.5, -4.55], params: { lid: "#2bb3a3", tall: true } },
    { model: "bottleSet",      pos: [-7.55, 4.5, -4.55] },
    { model: "cardboardBoxes", pos: [-9.7, 5.9, -4.55], params: { small: true } },
    { model: "cardboardBoxes", pos: [-9.6, 0, -3.5] },
    { model: "produceCrate",   pos: [-9.35, 0, -1.7] },
    { model: "potRack",        pos: [-5.35, 5.05, -4.93] },
    { model: "rangeHood",      pos: [-3.3, 5.4, -4.45] },
    { model: "grill",          pos: [-3.3, 0, -4.2] },
    { model: "fryer",          pos: [-0.85, 0, -4.2] },
    { model: "ticketRail",     pos: [-0.75, 4.55, -4.9] },

    // kitchen, right
    { model: "prepTable",      pos: [2.4, 0, -4.2], params: { width: 3.7 } },
    { model: "microwave",      pos: [1.05, 2.1, -4.45] },
    { model: "cuttingBoard",   pos: [2.25, 2.1, -4.1] },
    { model: "mixingBowl",     pos: [3.22, 2.1, -3.92] },
    { model: "utensilCrock",   pos: [3.95, 2.1, -4.5] },
    { model: "backCounter",    pos: [6.3, 0, -4.3], params: { width: 2.9 } },
    { model: "sodaMachine",    pos: [6.0, 2.0, -4.35] },
    { model: "cupStack",       pos: [7.35, 2.0, -4.2] },
    { model: "drinksCooler",   pos: [9.6, 0, -4.0] },

    // service counter
    { model: "serviceCounter", pos: [-1.5, 0, -1.6], params: { width: 12, depth: 1.1, height: 2.1 } },
    { model: "floorMat",       pos: [-1.5, 0, -0.35] },
    { model: "donutCase",      pos: [-6.35, 2.1, -1.6] },
    { model: "tray",           pos: [-4.3, 2.1, -1.5], params: { with: ["burger", "fries"] } },
    { model: "napkinDispenser",pos: [-2.85, 2.1, -1.75] },
    { model: "fruitBasket",    pos: [-1.7, 2.1, -1.55] },
    { model: "register",       pos: [0.65, 2.1, -1.7] },
    { model: "tray",           pos: [2.45, 2.1, -1.5], params: { with: ["soda", "bag"] } },
    { model: "milkshake",      pos: [3.85, 2.1, -1.45] },
    { model: "heatLamp",       pos: [-4.3, 5.7, -1.7] },
    { model: "heatLamp",       pos: [2.45, 5.7, -1.7] },

    // condiments and right side
    { model: "condimentStation", pos: [7.6, 0, -1.4] },
    { model: "ketchup",        pos: [6.85, 2.0, -1.35] },
    { model: "mustard",        pos: [7.2, 2.0, -1.35] },
    { model: "pepperShaker",   pos: [7.55, 2.0, -1.25] },
    { model: "saucePump",      pos: [8.05, 2.0, -1.5] },
    { model: "strawHolder",    pos: [8.55, 2.0, -1.35] },
    { model: "balloons",       pos: [5.35, 0, -0.85] },
    { model: "trashBin",       pos: [9.9, 0, 1.35] },
    { model: "wetFloorSign",   pos: [5.7, 0, 2.2], rot: [0, -20, 0] },
    { model: "plant",          pos: [-10.2, 0, 2.2] },
    { model: "plant",          pos: [10.25, 0, -1.9], params: { small: true } },

    // dining
    { model: "diningTable", pos: [-7.4, 0, 1.4] },
    { model: "stool", pos: [-8.85, 0, 1.4] }, { model: "stool", pos: [-5.95, 0, 1.4] },
    { model: "diningTable", pos: [-2.6, 0, 1.8] },
    { model: "stool", pos: [-4.05, 0, 1.8] }, { model: "stool", pos: [-1.15, 0, 1.8] },
    { model: "diningTable", pos: [2.4, 0, 1.4] },
    { model: "stool", pos: [0.95, 0, 1.4] }, { model: "stool", pos: [3.85, 0, 1.4] },
    { model: "friesBasket", pos: [-7.75, 1.6, 1.45] },
    { model: "sodaCup",     pos: [-6.85, 1.6, 1.65] },
    { model: "pepperShaker",pos: [-2.75, 1.6, 1.68] },
    { model: "sodaCup",     pos: [-2.0, 1.6, 1.95], params: { color: "#2bb3a3" } },
    { model: "paperBag",    pos: [-3.1, 1.6, 2.05], rot: [0, 15, 0] },
    { model: "plate",       pos: [2.12, 1.6, 1.5] },
    { model: "burger",      pos: [2.85, 1.6, 1.3] },
  ],
};
