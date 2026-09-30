/* RECIPES
   Two ingredients -> one result. Order does not matter.
   Matching pairs ("tomato" + "tomato") and mixed pairs ("bread" + "cheese") use the same format. */
window.PF = window.PF || { data: { rooms: {} } };

PF.data.recipes = [
  { id: "sauce",    ingredients: ["tomato", "tomato"], result: "tomato_sauce" },
  { id: "sandwich", ingredients: ["bread", "cheese"],  result: "sandwich" },
  { id: "omelette", ingredients: ["egg", "egg"],       result: "omelette" },
  { id: "pie",      ingredients: ["apple", "apple"],   result: "apple_pie" },
];
