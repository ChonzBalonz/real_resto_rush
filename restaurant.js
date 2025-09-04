(function() {
	"use strict";

	const canvas = document.getElementById("game");
	const ctx = canvas.getContext("2d");

	const ui = {
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

	// Crash diagnostics
	const _breadcrumbs = [];
	function addBreadcrumb(type, details) {
		try {
			_breadcrumbs.push({ at: performance.now(), type, details });
			if (_breadcrumbs.length > 200) _breadcrumbs.shift();
		} catch {}
	}

	function createCrashReport(err, context = {}) {
		const safeCustomers = state.customers.slice(0, 50).map(c => ({
			id: c.id, x: Math.round(c.x), y: Math.round(c.y), state: c.state, patience: Number(c.patience?.toFixed?.(2) ?? c.patience)
		}));
		const safeTickets = state.tickets.slice(0, 50).map(t => ({
			id: t.id, customerId: t.customerId, item: t.item?.name, state: t.state, stepIndex: t.stepIndex
		}));
		const safeStations = state.stations.map(s => ({ key: s.key, capacity: s.slots.length, busy: s.slots.filter(sl => !!sl.job).length }));
		const safeEmployees = state.employees.slice(0, 50).map(e => ({ id: e.id, role: e.role, station: e.station, phase: e.phase, busy: e.busy }));
		const report = {
			meta: {
				when: new Date().toISOString(),
				userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a',
				seed: state.seed,
				lastFrameDtMs: context.lastFrameDtMs ?? null,
				phase: context.phase || 'unknown',
			},
			error: {
				name: err?.name || String(err?.constructor?.name || 'Error'),
				message: err?.message || String(err),
				stack: err?.stack || null,
			},
			state: {
				day: state.day,
				cash: state.cash,
				rep: state.rep,
				health: state.health,
				healthMax: state.healthMax,
				elapsed: state.elapsed,
				spawnTimer: state.spawnTimer,
				difficulty: state.difficulty,
				baseSpawnMs: state.baseSpawnMs,
				combo: state.combo,
				lastServeAt: state.lastServeAt,
				customersCount: state.customers.length,
				ticketsCount: state.tickets.length,
				stationsCount: state.stations.length,
				employeesCount: state.employees.length,
			},
			preview: {
				customers: safeCustomers,
				tickets: safeTickets,
				stations: safeStations,
				employees: safeEmployees,
				layoutSizes: {
					customers: layout.customers.size,
					tickets: layout.tickets.size,
					stations: layout.stations.size,
				},
				breadcrumbs: _breadcrumbs.slice(-100),
			},
		};
		return report;
	}

	function logCrashReport(err, context = {}) {
		try {
			const report = createCrashReport(err, context);
			const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `restaurant-crash-${Date.now()}.json`;
			a.textContent = "Download crash report";
			a.style.display = "inline-block";
			a.style.margin = "4px 0";
			log("Crash captured. Please download the crash report and share it for debugging.");
			ui.log.appendChild(a);
			ui.log.appendChild(document.createElement("br"));
		} catch (e) {
			console.error("Failed to create crash report", e);
		}
	}

	// Simple bleep SFX (singleton AudioContext with throttle)
	let _audio = null;
	let _lastBleepAt = 0;
	function bleep(freq = 440, duration = 0.07, type = "square") {
		try {
			const now = performance.now();
			if (now - _lastBleepAt < 40) return; // throttle
			_lastBleepAt = now;
			if (!_audio) {
				_audio = new (window.AudioContext || window.webkitAudioContext)();
			}
			const osc = _audio.createOscillator();
			const gain = _audio.createGain();
			osc.type = type;
			osc.frequency.value = freq;
			gain.gain.value = 0.05;
			osc.connect(gain).connect(_audio.destination);
			osc.start();
			setTimeout(() => { try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch {} }, duration * 1000);
		} catch {}
	}

	// Employee skin image
	const EMP_SKIN_IMG = new Image();
	EMP_SKIN_IMG.crossOrigin = "anonymous";
	EMP_SKIN_IMG.src = "https://art.pixilart.com/a98f8556e678d95.png";
	let empSkinReady = false;
	EMP_SKIN_IMG.onload = () => { empSkinReady = true; };

	// Game state
	const state = {
		running: false,
		paused: false,
		day: 1,
		cash: 0,
		rep: 0,
		healthMax: 10,
		health: 10,
		gameOver: false,
		baseSpawnMs: 7000,
		seed: Math.random() * 1e9 >>> 0,
		elapsed: 0,
		spawnTimer: 0,
		customers: [],
		tickets: [],
		stations: [],
		cookSpeedLevel: 0,
		capacityLevel: 0,
		repLevel: 0,
		dailyTimeMs: 60_000,
		difficulty: 0,
		combo: 0,
		lastServeAt: 0,
		employees: [],
		highlightStationKey: null,
		maxWaitingCustomers: 4,
	};

	const rng = mulberry32(state.seed);

	function mulberry32(a) {
		return function() {
			let t = a += 0x6D2B79F5;
			t = Math.imul(t ^ t >>> 15, t | 1);
			t ^= t + Math.imul(t ^ t >>> 7, t | 61);
			return ((t ^ t >>> 14) >>> 0) / 4294967296;
		};
	}

	function log(msg) {
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

	function resetDay() {
		state.elapsed = 0;
		state.spawnTimer = 0;
		state.customers.length = 0;
		state.tickets.length = 0;
		for (const st of state.stations) {
			st.slots = Array.from({ length: st.baseCapacity + state.capacityLevel }, () => ({ job: null }));
		}
	}

	function startDay() {
		if (state.running) return;
		resetDay();
		state.running = true;
		state.paused = false;
		state.gameOver = false;
		state.health = state.healthMax;
		state.difficulty = 0;
		state.baseSpawnMs = 7000;
		log(`Day ${state.day} started.`);
		updateHUD();
	}

	function endDay() {
		// Endless mode: seamlessly advance to the next day without stopping the game
		state.day += 1;
		state.difficulty += 0.25;
		// slightly increase spawn rate base each day to ramp difficulty
		state.baseSpawnMs = Math.max(2000, state.baseSpawnMs - 500);
		log(`Day ended. New day: ${state.day}`);
		// Reset day timers/queues but keep the game running
		resetDay();
		updateHUD();
	}

	function updateHUD() {
		ui.day.textContent = String(state.day);
		ui.cash.textContent = String(state.cash);
		ui.rep.textContent = String(state.rep);
		if (ui.healthFill) {
			const pct = Math.max(0, Math.min(1, state.health / state.healthMax));
			ui.healthFill.style.width = `${pct * 100}%`;
			ui.healthFill.style.background = pct > 0.6 ? '#7bd88f' : pct > 0.3 ? '#ffb86b' : '#ff6b6b';
		}
		// Toggle affordability glow for upgrades
		if (ui.uSpeed) {
			const cost = 50 + state.cookSpeedLevel * 30;
			ui.uSpeed.classList.toggle('can-afford', state.cash >= cost);
		}
		if (ui.uCap) {
			const cost = 75 + state.capacityLevel * 40;
			ui.uCap.classList.toggle('can-afford', state.cash >= cost);
		}
		if (ui.uRep) {
			const cost = 40 + state.repLevel * 25;
			ui.uRep.classList.toggle('can-afford', state.cash >= cost);
		}
		// Toggle affordability glow for employee hire buttons
		ui.shopButtons?.forEach(btn => {
			const key = btn.getAttribute('data-emp');
			const def = EMP_TYPES[key];
			if (!def) return;
			btn.classList.toggle('can-afford', state.cash >= def.cost);
		});
		updateEmpList();
	}

	// Menu and recipes
	const MENU = [
		{ name: "Soup", price: 8, recipe: [ step("cook", 3500) ] },
		{ name: "Burger", price: 12, recipe: [ step("prep", 2500), step("cook", 4000) ] },
		{ name: "Salad", price: 7, recipe: [ step("prep", 2200) ] },
		{ name: "Pasta", price: 11, recipe: [ step("prep", 2500), step("cook", 3500) ] },
		{ name: "Coffee", price: 4, recipe: [ step("drink", 1500) ] },
	];

	function step(station, time) { return { station, time }; }
	function randomMenuItem() { return MENU[Math.floor(rng() * MENU.length)]; }

	// Stations layout
	const STATION_TYPES = [
		{ key: "prep", label: "Prep" },
		{ key: "cook", label: "Cook" },
		{ key: "drink", label: "Drink" },
	];

	function createStations() {
		state.stations = STATION_TYPES.map((t, i) => ({
			key: t.key,
			label: t.label,
			baseCapacity: 1,
			speedMult: 1,
			slots: Array.from({ length: 1 + state.capacityLevel }, () => ({ job: null })),
			_rect: { x: 0, y: 0, w: 0, h: 0 },
		}));
	}
	createStations();

	// Employees
	const EMP_TYPES = {
		junior: { name: "Junior", cost: 60, role: "station", station: "prep", speed: 0.8, quality: 0.9 },
		cook: { name: "Cook", cost: 120, role: "station", station: "cook", speed: 1.0, quality: 1.0 },
		barista: { name: "Barista", cost: 90, role: "station", station: "drink", speed: 1.1, quality: 1.0 },
		runner: { name: "Runner", cost: 80, role: "runner", speed: 0.9 },
		pro: { name: "Pro Chef", cost: 220, role: "station", station: "cook", speed: 1.35, quality: 1.1 },
	};

	function hireEmployee(key, free = false) {
		const def = EMP_TYPES[key];
		if (!def) return;
		if (!free && state.cash < def.cost) { log(`Need $${def.cost} to hire ${def.name}.`); return; }
		if (!free) state.cash -= def.cost;
		const emp = {
			id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.floor(rng()*1e6)}`,
			...def,
			busy: false,
			carrying: null,
			thinkCd: 0,
			phase: "idle", // idle | toCustomer | toStation | working
			x: 40 + Math.floor(rng() * 60),
			y: canvas.height - 160 + Math.floor(rng() * 40),
			task: null,
		};
		state.employees.push(emp);
		log(`Hired ${def.name}!`);
		updateHUD();
	}

	function updateEmpList() {
		if (!ui.empList) return;
		ui.empList.innerHTML = "";
		for (const e of state.employees) {
			const li = document.createElement("li");
			li.textContent = `${e.name}${e.role==='station'?` (${e.station})`:''} – x${e.speed}`;
			ui.empList.appendChild(li);
		}
	}

	ui.shopButtons?.forEach(btn => {
		btn.addEventListener("click", () => {
			const key = btn.getAttribute("data-emp");
			hireEmployee(key);
		});
	});

	// Ticket model
	function makeTicket(customerId, item) {
		return {
			id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.floor(rng()*1e6)}`,
			customerId,
			item,
			recipe: item.recipe.slice(),
			stepIndex: 0,
			createdAt: performance.now(),
			state: "tray", // tray | claimed | in_station | ready | dragging | delivering
			assignedTo: null,
			_drag: { x: 0, y: 0, offX: 0, offY: 0 },
		};
	}

	// Customer model
	function spawnCustomer() {
		const patience = 9 + Math.floor(rng() * 5) - Math.min(2, state.repLevel);
		const menu = randomMenuItem();
		const customer = {
			id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.floor(rng()*1e6)}`,
			x: -60,
			y: 300 + Math.floor(rng() * 120) - 60,
			speed: 0.5 + rng() * 0.4,
			state: "waiting",
			patience,
			order: menu,
			bumpTimer: 0,
		};
		state.customers.push(customer);
		const ticket = makeTicket(customer.id, menu);
		state.tickets.push(ticket);
		log(`Ticket created: ${menu.name}`);
	}

	function tryPlaceTicketOnStation(ticket, station, empId = null, desiredSlotIndex = null) {
		const step = ticket.recipe[ticket.stepIndex];
		if (!step || step.station !== station.key) return false;
		const slot = desiredSlotIndex != null ? station.slots[desiredSlotIndex] : station.slots.find(s => !s.job);
		if (!slot || slot.job) return false;
		// place job
		slot.job = {
			ticketId: ticket.id,
			remaining: step.time,
			stepIndex: ticket.stepIndex,
			empId: empId || null,
		};
		ticket.state = "in_station";
		ticket.assignedTo = empId || ticket.assignedTo;
		bleep(620, 0.06, "triangle");
		return true;
	}

	function completeJob(station, slot) {
		const job = slot.job;
		if (!job) return;
		const ticket = state.tickets.find(t => t.id === job.ticketId);
		if (!ticket) { slot.job = null; return; }
		ticket.stepIndex += 1;
		ticket.state = ticket.stepIndex >= ticket.recipe.length ? "ready" : "tray";
		// Award base cash when order is prepared
		if (ticket.state === "ready") {
			state.cash += ticket.item.price;
			log(`Prepared ${ticket.item.name} (+$${ticket.item.price})`);
			updateHUD();
		}
		slot.job = null;
		// free employee if was working
		if (job.empId) {
			const emp = state.employees.find(e => e.id === job.empId);
			if (emp && emp.phase === "working") {
				emp.phase = "idle";
				emp.task = null;
			}
		}
		bleep(880, 0.06, "sine");
	}

	function deliverTicketToCustomer(ticket, customer) {
		if (ticket.state !== "ready" || customer.id !== ticket.customerId) return false;
		// payout (tips/combos) and rep
		const tip = Math.max(0, Math.floor(customer.patience));
		const comboBonus = state.combo >= 2 ? state.combo : 0;
		state.cash += tip + comboBonus;
		state.rep += 1 + state.repLevel + (state.combo >= 3 ? 1 : 0);
		state.lastServeAt = performance.now();
		state.combo = (state.lastServeAt - (state.lastServeAtPrev || 0) < 3000) ? state.combo + 1 : 1;
		state.lastServeAtPrev = state.lastServeAt;
		log(`Served ${ticket.item.name} (+$${tip} tip${comboBonus?` +$${comboBonus} combo`:``})`);
		state.tickets = state.tickets.filter(t => t.id !== ticket.id);
		// Immediately remove the customer after they are served
		state.customers = state.customers.filter(c => c.id !== customer.id);
		bleep(1040, 0.08, "square");
		updateHUD();
		return true;
	}

	function removeTicketForCustomer(customerId) {
		const ticket = state.tickets.find(t => t.customerId === customerId);
		if (!ticket) return;
		// Clear any station jobs tied to this ticket and free employees
		for (const station of state.stations) {
			for (const slot of station.slots) {
				if (slot.job && slot.job.ticketId === ticket.id) {
					const empId = slot.job.empId;
					slot.job = null;
					if (empId) {
						const emp = state.employees.find(e => e.id === empId);
						if (emp) { emp.phase = "idle"; emp.task = null; emp.busy = false; }
					}
				}
			}
		}
		// Clear any employee task pointing to this ticket
		for (const e of state.employees) {
			if (e.task && e.task.ticketId === ticket.id) {
				e.phase = "idle";
				e.task = null;
				e.busy = false;
			}
		}
		// Remove the ticket itself
		state.tickets = state.tickets.filter(t => t.id !== ticket.id);
	}

	// Layout cache for hit tests
	const layout = {
		tickets: new Map(), // id -> {x,y,w,h}
		customers: new Map(), // id -> {x,y,w,h}
		stations: new Map(), // key -> {x,y,w,h}
	};

	function getStationAnchor(key) {
		const rect = layout.stations.get(key);
		if (!rect) return { x: 40, y: canvas.height - 140 };
		return { x: rect.x + rect.w / 2, y: rect.y + rect.h - 12 };
	}

	function getCustomerAnchor(customerId) {
		const rect = layout.customers.get(customerId);
		if (!rect) return null;
		return { x: rect.x + 12, y: rect.y + rect.h - 10 };
	}

	function moveTowards(pos, target, maxDist) {
		const dx = target.x - pos.x;
		const dy = target.y - pos.y;
		const d = Math.hypot(dx, dy);
		if (d <= maxDist) return { x: target.x, y: target.y, arrived: true };
		const nx = pos.x + (dx / d) * maxDist;
		const ny = pos.y + (dy / d) * maxDist;
		return { x: nx, y: ny, arrived: false };
	}

	function thinkEmployees(dt) {
		for (const e of state.employees) {
			e.thinkCd -= dt;
			if (e.role === "station") {
				// handle movement phases
				if (e.phase === "toCustomer" && e.task) {
					const anchor = getCustomerAnchor(e.task.customerId);
					if (anchor) {
						const stepDist = 0.25 * dt * (0.9 + 0.2 * e.speed);
						const moved = moveTowards({ x: e.x, y: e.y }, anchor, stepDist);
						e.x = moved.x; e.y = moved.y;
						if (moved.arrived) {
							const cust = state.customers.find(c => c.id === e.task.customerId);
							if (cust) cust.bumpTimer = 200;
							bleep(300, 0.05, "square");
							e.phase = "toStation";
						}
					}
					continue;
				}
				if (e.phase === "toStation" && e.task) {
					const home = getStationAnchor(e.station);
					const stepDist = 0.25 * dt * (0.9 + 0.2 * e.speed);
					const moved = moveTowards({ x: e.x, y: e.y }, home, stepDist);
					e.x = moved.x; e.y = moved.y;
					if (moved.arrived) {
						// try to start job now
						const station = state.stations.find(s => s.key === e.station);
						const t = state.tickets.find(tk => tk.id === e.task.ticketId);
						if (!station || !t || t.state !== "claimed") {
							e.phase = "idle";
							e.task = null;
							continue;
						}
						const step = t.recipe ? t.recipe[t.stepIndex] : null;
						if (!step || step.station !== e.station) {
							if (t.assignedTo === e.id) t.assignedTo = null;
							t.state = t.stepIndex >= (t.recipe?.length || 0) ? "ready" : "tray";
							e.phase = "idle";
							e.task = null;
							continue;
						}
						const slotIndex = station.slots.findIndex(s => !s.job);
						if (slotIndex !== -1) {
							const placed = tryPlaceTicketOnStation(t, station, e.id, slotIndex);
							if (placed) {
								// reduce time based on employee speed
								const slot = station.slots[slotIndex];
								const jobStep = t.recipe[t.stepIndex] || step;
								const baseTime = jobStep?.time ?? 1500;
								slot.job.remaining = Math.max(200, baseTime / e.speed);
								e.phase = "working";
							}
						}
					}
					continue;
				}
				if (e.phase === "idle" && e.thinkCd <= 0) {
					e.thinkCd = 300;
					const ticket = state.tickets.find(t => t.state === "tray" && !t.assignedTo && t.recipe[t.stepIndex]?.station === e.station);
					if (!ticket) continue;
					// claim ticket then go to customer
					ticket.state = "claimed";
					ticket.assignedTo = e.id;
					e.task = { ticketId: ticket.id, customerId: ticket.customerId };
					e.phase = "toCustomer";
					bleep(520, 0.05, "triangle");
					continue;
				}
			}

			if (e.role === "runner") {
				// existing runner automation (no movement visual for now)
				e.thinkCd -= dt;
				if (e.thinkCd > 0) continue;
				e.thinkCd = 300;
				const ticket = state.tickets.find(t => t.state === "ready");
				if (!ticket) continue;
				const cust = state.customers.find(c => c.id === ticket.customerId && c.state === "waiting");
				if (!cust) continue;
				if (!e.carrying) {
					e.carrying = { ticketId: ticket.id, eta: 300 / e.speed };
					bleep(420, 0.05, "sine");
				} else {
					e.carrying.eta -= dt;
					if (e.carrying.eta <= 0) {
						const t = state.tickets.find(x => x.id === e.carrying.ticketId);
						if (t && cust) deliverTicketToCustomer(t, cust);
						e.carrying = null;
					}
				}
			}
		}
	}

	function cook(dt) {
		for (const station of state.stations) {
			for (const slot of station.slots) {
				if (!slot.job) continue;
				const globalSpeed = 0.7 + state.difficulty * 0.15; // start slow, scale up
				const speedMult = (1 + state.cookSpeedLevel * 0.3 + (station.key === "drink" ? 0.2 : 0)) * globalSpeed;
				slot.job.remaining -= dt * speedMult;
				if (slot.job.remaining <= 0) {
					completeJob(station, slot);
				}
			}
		}
	}

	function updateCustomers(dt) {
		for (const cust of state.customers) {
			if (cust.bumpTimer && cust.bumpTimer > 0) cust.bumpTimer -= dt;
			if (cust.state === "waiting") {
				cust.x += cust.speed * dt * 0.05;
				cust.patience -= dt / 1200; // slower decay for more forgiving pacing
				if (cust.patience <= 0) {
					cust.state = "leaving";
					removeTicketForCustomer(cust.id);
					state.rep = Math.max(0, state.rep - 2);
					state.health = Math.max(0, state.health - 1);
					log(`Customer left unhappy (-rep, -health)`);
					updateHUD();
					if (state.health <= 0) {
						triggerGameOver();
					}

				}
			}
			if (cust.state === "served") {
				cust.x += 0.3 * dt * 0.05;
				if (cust.x > canvas.width + 50) cust.state = "gone";
			}
			if (cust.state === "leaving") {
				cust.x -= 0.4 * dt * 0.05;
				if (cust.x < -60) cust.state = "gone";
			}
		}
		state.customers = state.customers.filter(c => c.state !== "gone");
	}

	function drawStations() {
		const baseY = canvas.height - 130;
		const totalW = canvas.width - 40;
		const stationW = Math.min(260, Math.floor((totalW - 40) / state.stations.length));
		layout.stations.clear();
		for (let i = 0; i < state.stations.length; i++) {
			const st = state.stations[i];
			const x = 20 + i * (stationW + 20);
			const y = baseY;
			const w = stationW;
			const h = 110;
			// highlight glow if needed
			if (state.highlightStationKey === st.key) {
				ctx.save();
				ctx.shadowColor = "rgba(123, 216, 143, 0.7)";
				ctx.shadowBlur = 24;
				ctx.fillStyle = "#2e3350";
				ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
				ctx.restore();
			}
			// panels
			ctx.fillStyle = "#2e3350";
			ctx.fillRect(x, y, w, h);
			ctx.fillStyle = "#22263a";
			ctx.fillRect(x, y + h - 28, w, 28);
			// label
			ctx.fillStyle = "#c9cdea";
			ctx.font = "12px sans-serif";
			ctx.fillText(`${st.label}`, x + 8, y + h - 10);
			// slots
			const gap = 8;
			const slotW = (w - (gap * (st.slots.length + 1))) / st.slots.length;
			for (let s = 0; s < st.slots.length; s++) {
				const sx = x + gap + s * (slotW + gap);
				const sy = y + 10;
				const sh = h - 40;
				ctx.fillStyle = "#1f2338";
				ctx.fillRect(sx, sy, slotW, sh);
				const job = st.slots[s].job;
				if (job) {
					// filled in overlay later
				}
			}
			layout.stations.set(st.key, { x, y, w, h });
		}
	}

	function drawStationJobs() {
		for (let i = 0; i < state.stations.length; i++) {
			const st = state.stations[i];
			const rect = layout.stations.get(st.key);
			if (!rect) continue;
			const gap = 8;
			const slotW = (rect.w - (gap * (st.slots.length + 1))) / st.slots.length;
			const sy = rect.y + 10;
			const sh = rect.h - 40;
			for (let s = 0; s < st.slots.length; s++) {
				const slot = st.slots[s];
				const sx = rect.x + gap + s * (slotW + gap);
				if (slot.job) {
					const ticket = state.tickets.find(t => t.id === slot.job.ticketId);
					const step = ticket?.recipe[slot.job.stepIndex];
					const total = step?.time || 1;
					const remaining = slot.job.remaining;
					const pct = Math.max(0, Math.min(1, 1 - remaining / total));
					ctx.fillStyle = "#7bd88f";
					ctx.fillRect(sx + 8, sy + sh - 16, (slotW - 16) * pct, 8);
					ctx.fillStyle = "#9aa0b4";
					ctx.font = "12px sans-serif";
					ctx.fillText(ticket?.item.name || "", sx + 8, sy + 16);
				}
			}
		}
	}

	function drawCustomers() {
		layout.customers.clear();
		for (const cust of state.customers) {
			const hue = 180 + Math.floor(rng() * 100);
			ctx.fillStyle = `hsl(${hue} 50% 60%)`;
			const bumpY = cust.bumpTimer && cust.bumpTimer > 0 ? -3 : 0;
			ctx.fillRect(cust.x, cust.y - 40 + bumpY, 30, 40);
			// patience bar
			ctx.fillStyle = "#30354e";
			ctx.fillRect(cust.x - 4, cust.y - 50 + bumpY, 38, 6);
			ctx.fillStyle = cust.state === "served" ? "#7bd88f" : cust.state === "leaving" ? "#ff6b6b" : "#ffb86b";
			const patiencePct = Math.max(0, Math.min(1, cust.patience / 12));
			ctx.fillRect(cust.x - 4, cust.y - 50 + bumpY, 38 * patiencePct, 6);
			// order bubble
			ctx.fillStyle = "#0f1020";
			ctx.fillRect(cust.x + 34, cust.y - 44 + bumpY, 76, 22);
			ctx.fillStyle = "#c9cdea";
			ctx.font = "12px sans-serif";
			ctx.fillText(cust.order.name, cust.x + 38, cust.y - 29 + bumpY);
			layout.customers.set(cust.id, { x: cust.x, y: cust.y - 60 + bumpY, w: 110, h: 60 });
		}
	}

	function drawEmployee(e) {
		const roleColor = e.role === "runner" ? "#6aa3ff" : (e.station === "cook" ? "#ffb86b" : e.station === "drink" ? "#7bd88f" : "#c9cdea");
		const r = 32;
		ctx.save();
		// Clip circle
		ctx.beginPath();
		ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
		ctx.closePath();
		ctx.clip();
		// White background for visibility
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(e.x - r, e.y - r, r * 2, r * 2);
		// Draw skin if loaded
		if (empSkinReady) {
			ctx.drawImage(EMP_SKIN_IMG, e.x - r, e.y - r, r * 2, r * 2);
		}
		ctx.restore();
		// Role-colored ring
		ctx.save();
		ctx.strokeStyle = roleColor;
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.arc(e.x, e.y, r - 1, 0, Math.PI * 2);
		ctx.stroke();
		ctx.restore();
	}

	function drawEmployees() {
		for (const e of state.employees) {
			drawEmployee(e);
		}
	}

	function drawTicket(ctx, x, y, ticket, ghost = false) {
		const w = 150, h = 64;
		ctx.globalAlpha = ghost ? 0.6 : 1;
		const isReady = ticket.state === "ready";
		if (isReady) {
			// Flashing green ticket
			const t = performance.now();
			const pulse = 0.75 + 0.25 * Math.sin(t / 600);
			ctx.fillStyle = `rgba(123, 216, 143, ${pulse})`;
			ctx.fillRect(x, y, w, h);
			ctx.fillStyle = "#0e1a12";
			ctx.fillRect(x, y, w, 18);
			// Centered $ icon
			ctx.fillStyle = "#0e1a12";
			ctx.font = "28px sans-serif";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText("$", x + w / 2, y + h / 2 + 4);
			// Top-left item name muted
			ctx.textAlign = "left";
			ctx.textBaseline = "alphabetic";
			ctx.fillStyle = "#0e1a12";
			ctx.font = "12px sans-serif";
			ctx.fillText(ticket.item.name, x + 8, y + 14);
		} else {
			ctx.fillStyle = "#1a1e33";
			ctx.fillRect(x, y, w, h);
			ctx.fillStyle = "#262b45";
			ctx.fillRect(x, y, w, 18);
			ctx.fillStyle = "#c9cdea";
			ctx.font = "12px sans-serif";
			ctx.fillText(ticket.item.name, x + 8, y + 14);
			ctx.fillStyle = "#9aa0b4";
			const step = ticket.recipe[ticket.stepIndex];
			ctx.fillText(`Step: ${step?.station ?? "-"}`, x + 8, y + 32);
		}
		ctx.fillStyle = isReady ? "#0e1a12" : "#9aa0b4";
		ctx.font = "12px sans-serif";
		ctx.fillText(`#${ticket.customerId.slice(0, 4)}`, x + 8, y + 48);
		ctx.globalAlpha = 1;
		return { x, y, w, h };
	}

	function drawTickets() {
		layout.tickets.clear();
		// tray on left
		let x = 16, y = 20;
		for (const ticket of state.tickets) {
			if (ticket.state === "in_station") continue;
			if (ticket.state === "dragging") continue;
			if (ticket.state === "claimed") continue;
			const rect = drawTicket(ctx, x, y, ticket);
			layout.tickets.set(ticket.id, rect);
			y += rect.h + 10;
			if (y > canvas.height - 200) { y = 20; x += 160; }
		}
		// dragging ticket on top
		const dragging = state.tickets.find(t => t.state === "dragging");
		if (dragging) {
			drawTicket(ctx, dragging._drag.x - dragging._drag.offX, dragging._drag.y - dragging._drag.offY, dragging);
		}
	}

	function draw() {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		// Background
		ctx.fillStyle = "#11131b";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		// Stations and jobs
		drawStations();
		drawStationJobs();
		// Customers
		drawCustomers();
		// Employees on top of customers
		drawEmployees();
		// Tickets
		drawTickets();
	}

	function update(dt) {
		if (!state.running || state.paused) return;
		state.elapsed += dt;
		state.spawnTimer += dt;

		// Start very slow and ramp up based on elapsed time and difficulty
		const timeFactor = Math.min(1, state.elapsed / 60000); // up to 1 after a minute
		const dynamicBase = state.baseSpawnMs * (1 - 0.4 * timeFactor); // faster within a day
		const spawnEvery = Math.max(1000, dynamicBase - state.difficulty * 250);
		state.maxWaitingCustomers = Math.min(12, 4 + Math.floor(state.difficulty * 1.5));
		const waiting = state.customers.filter(c => c.state === "waiting").length;
		if (state.spawnTimer > spawnEvery && waiting < state.maxWaitingCustomers) {
			state.spawnTimer = 0;
			spawnCustomer();
		}

		thinkEmployees(dt);
		cook(dt);
		updateCustomers(dt);

		if (state.elapsed >= state.dailyTimeMs) {
			endDay();
		}
	}

	let last = performance.now();
	function loop(now) {
		const dt = Math.min(50, now - last);
		last = now;
		try {
			addBreadcrumb('loop', { dt });
			update(dt);
			draw();
			if (state.gameOver) {
				drawGameOver();
			}
		} catch (err) {
			state.running = false;
			state.paused = true;
			console.error(err);
			log(`Error: ${err?.message || err}`);
			logCrashReport(err, { lastFrameDtMs: dt, phase: 'loop' });
		}
		requestAnimationFrame(loop);
	}
	requestAnimationFrame(loop);

	// Input and hit tests
	function getMouse(evt) {
		const r = canvas.getBoundingClientRect();
		const sx = canvas.width / r.width;
		const sy = canvas.height / r.height;
		return { x: (evt.clientX - r.left) * sx, y: (evt.clientY - r.top) * sy };
	}

	// Touch helpers (map single-finger touch to mouse semantics)
	function getTouch(evt) {
		const t = evt.touches && evt.touches[0] ? evt.touches[0] : (evt.changedTouches && evt.changedTouches[0]);
		if (!t) return null;
		const r = canvas.getBoundingClientRect();
		const sx = canvas.width / r.width;
		const sy = canvas.height / r.height;
		return { x: (t.clientX - r.left) * sx, y: (t.clientY - r.top) * sy };
	}

	let mouseDown = false;
	canvas.addEventListener("mousedown", (e) => {
		if (!state.running) return;
		mouseDown = true;
		const m = getMouse(e);
		addBreadcrumb('input', { type: 'mousedown', x: Math.round(m.x), y: Math.round(m.y) });
		// pick ticket under mouse
		let picked = null;
		for (const [id, rect] of layout.tickets) {
			if (m.x >= rect.x && m.x <= rect.x + rect.w && m.y >= rect.y && m.y <= rect.y + rect.h) { picked = { id, rect }; }
		}
		if (picked) {
			const t = state.tickets.find(tk => tk.id === picked.id);
			if (!t) return;
			// Click-to-deliver for ready tickets
			if (t.state === "ready") {
				const cust = state.customers.find(c => c.id === t.customerId && c.state === "waiting");
				if (cust) {
					deliverTicketToCustomer(t, cust);
					state.cash += 1;
					log("Customer tipped +$1");
					updateHUD();
				}
				return;
			}
			if (t.state !== "in_station") {
				t.state = "dragging";
				t._drag.x = m.x;
				t._drag.y = m.y;
				t._drag.offX = m.x - picked.rect.x;
				t._drag.offY = m.y - picked.rect.y;
				// highlight the station needed for this ticket's current step
				const step = t.recipe[t.stepIndex];
				state.highlightStationKey = step?.station || null;
			}
		}
	});
	// Touch -> mouse mapping
	canvas.addEventListener("touchstart", (e) => {
		if (!state.running) return;
		if (e.touches && e.touches.length > 1) return; // ignore multi-touch for now
		e.preventDefault();
		mouseDown = true;
		const m = getTouch(e);
		if (!m) return;
		addBreadcrumb('input', { type: 'touchstart', x: Math.round(m.x), y: Math.round(m.y) });
		// reuse mousedown logic
		const evt = { clientX: m.x, clientY: m.y };
		const mm = getMouse(evt);
		// pick ticket under touch
		let picked = null;
		for (const [id, rect] of layout.tickets) {
			if (mm.x >= rect.x && mm.x <= rect.x + rect.w && mm.y >= rect.y && mm.y <= rect.y + rect.h) { picked = { id, rect }; }
		}
		if (picked) {
			const t = state.tickets.find(tk => tk.id === picked.id);
			if (!t) return;
			if (t.state === "ready") {
				const cust = state.customers.find(c => c.id === t.customerId && c.state === "waiting");
				if (cust) {
					deliverTicketToCustomer(t, cust);
					state.cash += 1;
					log("Customer tipped +$1");
					updateHUD();
				}
				return;
			}
			if (t.state !== "in_station") {
				t.state = "dragging";
				t._drag.x = mm.x;
				t._drag.y = mm.y;
				t._drag.offX = mm.x - picked.rect.x;
				t._drag.offY = mm.y - picked.rect.y;
				const step = t.recipe[t.stepIndex];
				state.highlightStationKey = step?.station || null;
			}
		}
	}, { passive: false });
	canvas.addEventListener("touchmove", (e) => {
		if (!mouseDown) return;
		if (e.touches && e.touches.length > 1) return;
		e.preventDefault();
		const m = getTouch(e);
		if (!m) return;
		addBreadcrumb('input', { type: 'touchmove', x: Math.round(m.x), y: Math.round(m.y) });
		const t = state.tickets.find(tk => tk.state === "dragging");
		if (t) {
			t._drag.x = m.x;
			t._drag.y = m.y;
		}
	}, { passive: false });
	canvas.addEventListener("touchend", (e) => {
		mouseDown = false;
		e.preventDefault();
		const m = getTouch(e) || { x: 0, y: 0 };
		addBreadcrumb('input', { type: 'touchend', x: Math.round(m.x), y: Math.round(m.y) });
		const t = state.tickets.find(tk => tk.state === "dragging");
		if (!t) { state.highlightStationKey = null; return; }
		let dropped = false;
		for (const [key, rect] of layout.stations) {
			if (m.x >= rect.x && m.x <= rect.x + rect.w && m.y >= rect.y && m.y <= rect.y + rect.h) {
				const station = state.stations.find(s => s.key === key);
				if (tryPlaceTicketOnStation(t, station)) { dropped = true; break; }
			}
		}
		if (!dropped) {
			for (const [cid, rect] of layout.customers) {
				if (m.x >= rect.x && m.x <= rect.x + rect.w && m.y >= rect.y && m.y <= rect.y + rect.h) {
					const cust = state.customers.find(c => c.id === cid);
					if (deliverTicketToCustomer(t, cust)) { dropped = true; break; }
				}
			}
		}
		if (!dropped) {
			bleep(220, 0.06, "sawtooth");
			t.state = t.stepIndex >= t.recipe.length ? "ready" : "tray";
		}
		state.highlightStationKey = null;
	}, { passive: false });
	canvas.addEventListener("mousemove", (e) => {
		if (!mouseDown) return;
		const m = getMouse(e);
		addBreadcrumb('input', { type: 'mousemove', x: Math.round(m.x), y: Math.round(m.y) });
		const t = state.tickets.find(tk => tk.state === "dragging");
		if (t) {
			t._drag.x = m.x;
			t._drag.y = m.y;
		}
	});
	canvas.addEventListener("mouseup", (e) => {
		mouseDown = false;
		const m = getMouse(e);
		addBreadcrumb('input', { type: 'mouseup', x: Math.round(m.x), y: Math.round(m.y) });
		const t = state.tickets.find(tk => tk.state === "dragging");
		if (!t) { state.highlightStationKey = null; return; }
		// drop on station?
		let dropped = false;
		for (const [key, rect] of layout.stations) {
			if (m.x >= rect.x && m.x <= rect.x + rect.w && m.y >= rect.y && m.y <= rect.y + rect.h) {
				const station = state.stations.find(s => s.key === key);
				if (tryPlaceTicketOnStation(t, station)) { dropped = true; break; }
			}
		}
		if (!dropped) {
			// drop on customer to deliver
			for (const [cid, rect] of layout.customers) {
				if (m.x >= rect.x && m.x <= rect.x + rect.w && m.y >= rect.y && m.y <= rect.y + rect.h) {
					const cust = state.customers.find(c => c.id === cid);
					if (deliverTicketToCustomer(t, cust)) { dropped = true; break; }
				}
			}
		}
		if (!dropped) {
			bleep(220, 0.06, "sawtooth");
			t.state = t.stepIndex >= t.recipe.length ? "ready" : "tray";
		}
		// clear highlight on release
		state.highlightStationKey = null;
	});

	// UI events
	ui.start.addEventListener("click", startDay);
	ui.pause.addEventListener("click", () => {
		if (state.gameOver) return;
		state.paused = !state.paused;
		ui.pause.textContent = state.paused ? "Resume" : "Pause";
	});
	ui.reset.addEventListener("click", () => {
		addBreadcrumb('ui', { action: 'reset' });
		state.running = false;
		state.gameOver = false;
		state.day = 1;
		state.cash = 0;
		state.rep = 0;
		state.health = state.healthMax;
		state.difficulty = 0;
		state.baseSpawnMs = 7000;
		state.cookSpeedLevel = 0;
		state.capacityLevel = 0;
		state.repLevel = 0;
		state.employees = [];
		createStations();
		resetDay();
		updateHUD();
		log("Game reset.");
	});

	ui.uSpeed.addEventListener("click", () => {
		const cost = 50 + state.cookSpeedLevel * 30;
		if (state.cash < cost) { log(`Need $${cost} for Faster Cook.`); return; }
		state.cash -= cost;
		state.cookSpeedLevel += 1;
		updateHUD();
		log(`Station speed upgraded to Lv.${state.cookSpeedLevel}`);
	});

	ui.uCap.addEventListener("click", () => {
		const cost = 75 + state.capacityLevel * 40;
		if (state.cash < cost) { log(`Need $${cost} for Extra Counter.`); return; }
		state.cash -= cost;
		state.capacityLevel += 1;
		for (const st of state.stations) {
			st.slots.push({ job: null });
		}
		updateHUD();
		log(`Added capacity to all stations!`);
	});

	ui.uRep.addEventListener("click", () => {
		const cost = 40 + state.repLevel * 25;
		if (state.cash < cost) { log(`Need $${cost} for Better Decor.`); return; }
		state.cash -= cost;
		state.repLevel += 1;
		updateHUD();
		log(`Reputation boost Lv.${state.repLevel}`);
	});

	function starterEmployees() {
		// intentionally left empty: starting with no employees
	}

	function triggerGameOver() {
		state.gameOver = true;
		state.running = false;
		log("Game Over! Health depleted.");
		addBreadcrumb('state', { event: 'gameOver' });
	}

	function drawGameOver() {
		ctx.save();
		ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = "#ffffff";
		ctx.font = "28px sans-serif";
		ctx.textAlign = "center";
		ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 10);
		ctx.font = "16px sans-serif";
		ctx.fillText("Click Reset to try again", canvas.width / 2, canvas.height / 2 + 20);
		ctx.restore();
	}

	// Init
	// no starter employees; start with none
	updateHUD();
	log("Welcome! Hire employees or drag tickets yourself. Keep your health up!");
	// Global error hooks for diagnostics
	window.addEventListener('error', (e) => {
		try {
			log(`Unhandled Error: ${e?.error?.message || e.message || e}`);
			logCrashReport(e.error || e, { phase: 'window.error' });
		} catch {}
	});
	window.addEventListener('unhandledrejection', (e) => {
		try {
			const reason = e?.reason || new Error('unhandledrejection with unknown reason');
			log(`Unhandled Rejection: ${reason?.message || reason}`);
			logCrashReport(reason, { phase: 'unhandledrejection' });
		} catch {}
	});
})(); 