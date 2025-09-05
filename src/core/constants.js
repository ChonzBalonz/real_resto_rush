export function step(station, time) { return { station, time }; }

export const MENU = [
	{ name: "Soup", price: 8, recipe: [ step("cook", 3500) ] },
	{ name: "Burger", price: 12, recipe: [ step("prep", 2500), step("cook", 4000) ] },
	{ name: "Salad", price: 7, recipe: [ step("prep", 2200) ] },
	{ name: "Pasta", price: 11, recipe: [ step("prep", 2500), step("cook", 3500) ] },
	{ name: "Coffee", price: 4, recipe: [ step("drink", 1500) ] },
];

export const STATION_TYPES = [
	{ key: "prep", label: "Prep" },
	{ key: "cook", label: "Cook" },
	{ key: "drink", label: "Drink" },
];

export const EMP_TYPES = {
	junior: { name: "Junior", cost: 60, role: "station", station: "prep", speed: 0.8, quality: 0.9 },
	cook: { name: "Cook", cost: 120, role: "station", station: "cook", speed: 1.0, quality: 1.0 },
	barista: { name: "Barista", cost: 90, role: "station", station: "drink", speed: 1.1, quality: 1.0 },
	runner: { name: "Runner", cost: 80, role: "runner", speed: 0.9 },
	pro: { name: "Pro Chef", cost: 220, role: "station", station: "cook", speed: 1.35, quality: 1.1 },
};

export const VIP_SPAWN_CHANCE = 0.12; 