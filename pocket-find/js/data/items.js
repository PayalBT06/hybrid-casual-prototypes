/* ITEM DEFINITIONS
   Every clickable thing in any room is an item. Scenery is NOT listed here (see rooms/*.js "props").
   - name:  shown on target cards and in debug labels
   - model: key of a builder in js/models.js (PF.models.items)
   - hitPad: optional extra padding (world units) for the click collider
   Whether an item is an ingredient, a direct-find tool, or a merge result is derived from recipes.js,
   so you never have to tag it twice. */
window.PF = window.PF || { data: { rooms: {} } };

PF.data.items = {
  // direct-find tools
  chef_hat:     { name: "Chef Hat",     model: "chefHat" },
  frying_pan:   { name: "Frying Pan",   model: "fryingPan" },
  whisk:        { name: "Whisk",        model: "whisk" },
  wooden_spoon: { name: "Wooden Spoon", model: "woodenSpoon" },
  salt_shaker:  { name: "Salt Shaker",  model: "saltShaker" },
  kettle:       { name: "Kettle",       model: "kettle" },

  // ingredients
  tomato: { name: "Tomato", model: "tomato" },
  bread:  { name: "Bread",  model: "bread" },
  cheese: { name: "Cheese", model: "cheese" },
  egg:    { name: "Egg",    model: "egg", hitPad: 0.12 },
  apple:  { name: "Apple",  model: "apple" },

  // merge results (never placed in a room at start)
  tomato_sauce: { name: "Tomato Sauce", model: "tomatoSauce" },
  sandwich:     { name: "Sandwich",     model: "sandwich" },
  omelette:     { name: "Omelette",     model: "omelette" },
  apple_pie:    { name: "Apple Pie",    model: "applePie" },
};
