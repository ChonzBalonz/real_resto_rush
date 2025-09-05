const _breadcrumbs = [];

export function addBreadcrumb(type, details) {
	try {
		_breadcrumbs.push({ at: performance.now(), type, details });
		if (_breadcrumbs.length > 200) _breadcrumbs.shift();
	} catch {}
}

export function createCrashReport(err, state, layout, context = {}) {
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

export function logCrashReport(err, state, layout, ui, log, context = {}) {
	try {
		const report = createCrashReport(err, state, layout, context);
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