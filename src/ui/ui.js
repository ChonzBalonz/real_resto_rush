export const ui = {
	day: document.getElementById("day"),
	cash: document.getElementById("cash"),
	rep: document.getElementById("rep"),
	healthFill: document.getElementById("health-fill"),
	log: document.getElementById("log"),
	start: document.getElementById("start-day"),
	pause: document.getElementById("pause"),
	reset: document.getElementById("reset"),
	uSpeed: document.getElementById("upgrade-speed"),
	uCap: document.getElementById("upgrade-capacity"),
	uRep: document.getElementById("upgrade-rep"),
	empList: document.getElementById("emp-list"),
	shopButtons: Array.from(document.querySelectorAll(".hire-btn")),
};

export function log(msg) {
	const el = document.createElement("div");
	el.textContent = msg;
	ui.log.appendChild(el);
	// Cap log lines to avoid DOM bloat
	const maxLines = 200;
	while (ui.log.childNodes.length > maxLines) {
		ui.log.removeChild(ui.log.firstChild);
	}
	ui.log.scrollTop = ui.log.scrollHeight;
}

export function updateEmpList(employees) {
	if (!ui.empList) return;
	ui.empList.innerHTML = "";
	for (const e of employees || []) {
		const li = document.createElement("li");
		const level = e.level || 1;
		const xp = e.xp || 0;
		const xpTo = e.xpToNext || 0;
		const specials = e.specialStacks ? `  b7 ${e.specialStacks}★` : "";
		li.textContent = `${e.name}${e.role==='station'?` (${e.station})`:''} – Lv.${level} (${xp}/${xpTo}) – x${e.speed.toFixed(2)}${specials}`;
		ui.empList.appendChild(li);
	}
} 