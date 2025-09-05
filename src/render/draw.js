export function drawStations(ctx, canvas, state, layout) {
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
		if (state.highlightStationKey === st.key) {
			ctx.save();
			ctx.shadowColor = "rgba(123, 216, 143, 0.7)";
			ctx.shadowBlur = 24;
			ctx.fillStyle = "#2e3350";
			ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
			ctx.restore();
		}
		ctx.fillStyle = "#2e3350";
		ctx.fillRect(x, y, w, h);
		ctx.fillStyle = "#22263a";
		ctx.fillRect(x, y + h - 28, w, 28);
		ctx.fillStyle = "#c9cdea";
		ctx.font = "12px sans-serif";
		ctx.fillText(`${st.label}`, x + 8, y + h - 10);
		const gap = 8;
		const slotW = (w - (gap * (st.slots.length + 1))) / st.slots.length;
		for (let s = 0; s < st.slots.length; s++) {
			const sx = x + gap + s * (slotW + gap);
			const sy = y + 10;
			const sh = h - 40;
			ctx.fillStyle = "#1f2338";
			ctx.fillRect(sx, sy, slotW, sh);
		}
		layout.stations.set(st.key, { x, y, w, h });
	}
}

export function drawStationJobs(ctx, state, layout) {
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

export function drawCustomers(ctx, canvas, state, layout, rng) {
	layout.customers.clear();
	for (const cust of state.customers) {
		const bumpY = cust.bumpTimer && cust.bumpTimer > 0 ? -3 : 0;
		if (cust.vip) {
			// VIP: golden body
			ctx.fillStyle = "#e6c14a";
			ctx.fillRect(cust.x, cust.y - 40 + bumpY, 30, 40);
			// crown
			ctx.fillStyle = "#ffd76a";
			const cx = cust.x + 15;
			const cy = cust.y - 48 + bumpY;
			ctx.beginPath();
			ctx.moveTo(cx - 10, cy + 8);
			ctx.lineTo(cx - 5, cy);
			ctx.lineTo(cx, cy + 8);
			ctx.lineTo(cx + 5, cy);
			ctx.lineTo(cx + 10, cy + 8);
			ctx.closePath();
			ctx.fill();
		} else {
			const hue = 180 + Math.floor(rng() * 100);
			ctx.fillStyle = `hsl(${hue} 50% 60%)`;
			ctx.fillRect(cust.x, cust.y - 40 + bumpY, 30, 40);
		}
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
		ctx.fillText((cust.vip?"VIP ":"") + cust.order.name, cust.x + 38, cust.y - 29 + bumpY);
		layout.customers.set(cust.id, { x: cust.x, y: cust.y - 60 + bumpY, w: 110, h: 60 });
	}
}

export function drawEmployee(ctx, e, empSkinReady, EMP_SKIN_IMG) {
	const roleColor = e.role === "runner" ? "#6aa3ff" : (e.station === "cook" ? "#ffb86b" : e.station === "drink" ? "#7bd88f" : "#c9cdea");
	const r = 32;
	ctx.save();
	ctx.beginPath();
	ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
	ctx.closePath();
	ctx.clip();
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(e.x - r, e.y - r, r * 2, r * 2);
	if (empSkinReady) {
		ctx.drawImage(EMP_SKIN_IMG, e.x - r, e.y - r, r * 2, r * 2);
	}
	ctx.restore();
	ctx.save();
	ctx.strokeStyle = roleColor;
	ctx.lineWidth = 4;
	ctx.beginPath();
	ctx.arc(e.x, e.y, r - 1, 0, Math.PI * 2);
	ctx.stroke();
	ctx.restore();
}

export function drawEmployees(ctx, state, empSkinReady, EMP_SKIN_IMG) {
	for (const e of state.employees) {
		drawEmployee(ctx, e, empSkinReady, EMP_SKIN_IMG);
	}
}

export function drawTicket(ctx, x, y, ticket, ghost = false) {
	const w = 150, h = 64;
	ctx.globalAlpha = ghost ? 0.6 : 1;
	const isReady = ticket.state === "ready";
	if (isReady) {
		const t = performance.now();
		const pulse = 0.75 + 0.25 * Math.sin(t / 600);
		ctx.fillStyle = `rgba(123, 216, 143, ${pulse})`;
		ctx.fillRect(x, y, w, h);
		ctx.fillStyle = "#0e1a12";
		ctx.fillRect(x, y, w, 18);
		ctx.fillStyle = "#0e1a12";
		ctx.font = "28px sans-serif";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText("$", x + w / 2, y + h / 2 + 4);
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

export function drawTickets(ctx, canvas, state, layout) {
	layout.tickets.clear();
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
	const dragging = state.tickets.find(t => t.state === "dragging");
	if (dragging) {
		drawTicket(ctx, dragging._drag.x - dragging._drag.offX, dragging._drag.y - dragging._drag.offY, dragging);
	}
}

export function drawFx(ctx, state) {
	for (const fx of state.fx) {
		if (fx.type === 'cash') {
			const t = fx.life / fx.lifeMax;
			const alpha = Math.max(0, 1 - t);
			const y = fx.y - 28 * t;
			ctx.save();
			ctx.globalAlpha = alpha;
			ctx.fillStyle = "#7bd88f";
			ctx.font = "16px sans-serif";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(fx.text, fx.x, y);
			ctx.restore();
		}
	}
}

function drawDiningLayout(ctx, canvas, state) {
	// Base background
	ctx.fillStyle = "#101218";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	// Dining floor (top area), leave space for stations at bottom
	const floorH = canvas.height - 130;
	const grad = ctx.createLinearGradient(0, 0, 0, floorH);
	grad.addColorStop(0, "#1a1f2b");
	grad.addColorStop(1, "#131827");
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, canvas.width, floorH);
	// Subtle grid lines to suggest tiles
	ctx.strokeStyle = "rgba(255,255,255,0.04)";
	ctx.lineWidth = 1;
	const gridSize = 40;
	for (let y = gridSize; y < floorH; y += gridSize) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(canvas.width, y);
		ctx.stroke();
	}
	for (let x = gridSize; x < canvas.width; x += gridSize) {
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, floorH);
		ctx.stroke();
	}
	// Tables
	for (const t of (state.tables || [])) {
		// Table top
		ctx.save();
		ctx.fillStyle = "#3a2f45"; // muted table color
		ctx.strokeStyle = "#2a2435";
		ctx.lineWidth = 2;
		ctx.fillRect(t.x, t.y, t.w, t.h);
		ctx.strokeRect(t.x, t.y, t.w, t.h);
		// If occupied, add a soft highlight
		if (t.occupiedBy) {
			ctx.globalAlpha = 0.08;
			ctx.fillStyle = "#7bd88f";
			ctx.fillRect(t.x - 4, t.y - 4, t.w + 8, t.h + 8);
			ctx.globalAlpha = 1;
		}
		ctx.restore();
	}
}

export function renderAll(ctx, canvas, state, layout, rng, empSkinReady, EMP_SKIN_IMG) {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	drawDiningLayout(ctx, canvas, state);
	drawStations(ctx, canvas, state, layout);
	drawStationJobs(ctx, state, layout);
	drawCustomers(ctx, canvas, state, layout, rng);
	drawEmployees(ctx, state, empSkinReady, EMP_SKIN_IMG);
	drawTickets(ctx, canvas, state, layout);
	drawFx(ctx, state);
}

export function drawGameOver(ctx, canvas) {
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