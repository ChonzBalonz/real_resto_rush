let cachedBg = null;
let cachedBgW = 0;
let cachedBgH = 0;
// New: background map image
let MAP_IMG = null;
let mapReady = false;
(function initMap() {
	try {
		MAP_IMG = new Image();
		MAP_IMG.crossOrigin = "anonymous";
		MAP_IMG.src = "images/map.png";
		MAP_IMG.onload = () => { mapReady = true; cachedBg = null; };
	} catch {}
})();

function buildStaticBackground(canvas, state) {
	const w = canvas.width, h = canvas.height;
	if (!w || !h) return;
	cachedBg = document.createElement('canvas');
	cachedBg.width = w; cachedBg.height = h;
	const g = cachedBg.getContext('2d');
	// Base background (warm wood/amber gradient)
	g.fillStyle = "#120f0c";
	g.fillRect(0, 0, w, h);
	const floorH = h - 130;
	// If map image is ready, draw it with cover scaling into dining area
	if (mapReady && MAP_IMG && MAP_IMG.naturalWidth && MAP_IMG.naturalHeight) {
		const targetX = 0, targetY = 0, targetW = w, targetH = h;
		const iw = MAP_IMG.naturalWidth, ih = MAP_IMG.naturalHeight;
		// contain: fit entirely without cropping
		const scale = Math.min(targetW / iw, targetH / ih);
		const dw = iw * scale, dh = ih * scale;
		const dx = targetX + (targetW - dw) / 2;
		const dy = targetY + (targetH - dh) / 2;
		try { g.imageSmoothingQuality = 'high'; } catch {}
		g.drawImage(MAP_IMG, dx, dy, dw, dh);
		// expose transform so gameplay anchors can map image coords -> canvas
		try { state._mapDraw = { dx, dy, scale, iw, ih, canvasW: w, canvasH: h }; } catch {}
	} else {
		// Fallback warm gradient + subtle checker pattern
		const grad = g.createLinearGradient(0, 0, 0, floorH);
		grad.addColorStop(0, "#221913");
		grad.addColorStop(1, "#1a140f");
		g.fillStyle = grad;
		g.fillRect(0, 0, w, floorH);
		g.strokeStyle = "rgba(243,234,215,0.03)";
		g.lineWidth = 1;
		const gridSize = 40;
		for (let y = gridSize; y < floorH; y += gridSize) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
		for (let x = gridSize; x < w; x += gridSize) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, floorH); g.stroke(); }
	}
	cachedBgW = w; cachedBgH = h;
}

function drawBgParallaxOverlay(ctx, canvas, state) {
	const t = state.elapsed || 0;
	const floorH = canvas.height - 130;
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, canvas.width, floorH);
	ctx.clip();
	// Soft moving warm light sweep
	const sweepW = 260;
	const lx = ((t * 0.04) % (canvas.width + sweepW)) - sweepW;
	const lg = ctx.createLinearGradient(lx, 0, lx + sweepW, 0);
	lg.addColorStop(0, "rgba(232,178,108,0)");
	lg.addColorStop(0.5, "rgba(232,178,108,0.06)");
	lg.addColorStop(1, "rgba(232,178,108,0)");
	ctx.fillStyle = lg;
	ctx.fillRect(0, 0, canvas.width, floorH);
	ctx.restore();
}
// Ambient FX: dust motes, extra color sweeps, vignette, scanlines
let __ambient = { motes: [], w: 0, h: 0, scanPattern: null };
function ensureAmbient(canvas) {
	if (!canvas) return;
	if (__ambient.w !== canvas.width || __ambient.h !== canvas.height || __ambient.motes.length === 0) {
		__ambient.w = canvas.width; __ambient.h = canvas.height;
		// Lower density on small screens (e.g., iPhone 14 width <= 430px CSS, ~3x DPR)
		const isSmall = (window.innerWidth <= 430);
		const baseCount = Math.floor((canvas.width * canvas.height) / (isSmall ? 90000 : 45000));
		const count = Math.max(isSmall ? 14 : 24, baseCount);
		__ambient.motes = Array.from({ length: count }, () => ({
			x: Math.random() * canvas.width,
			y: Math.random() * (canvas.height - 130),
			r: 0.6 + Math.random() * 1.4,
			vx: (-0.10 + Math.random() * 0.20),
			vy: (-0.06 + Math.random() * 0.12),
			alpha: (isSmall ? 0.035 : 0.06) + Math.random() * (isSmall ? 0.05 : 0.08),
			phase: Math.random() * Math.PI * 2,
		}));
		// Build scanline pattern (once per size)
		const pat = document.createElement('canvas');
		pat.width = 2; pat.height = 2;
		const pg = pat.getContext('2d');
		pg.fillStyle = "rgba(0,0,0,0.10)"; pg.fillRect(0, 0, 2, 1);
		pg.fillStyle = "rgba(0,0,0,0.0)"; pg.fillRect(0, 1, 2, 1);
		__ambient.scanPattern = pg.createPattern ? pg.createPattern(pat, 'repeat') : null;
	}
}
function updateAmbient(canvas, state) {
	ensureAmbient(canvas);
	const floorH = canvas.height - 130;
	for (const m of __ambient.motes) {
		m.x += m.vx * (0.5 + 0.5 * Math.sin((state.elapsed + m.phase * 500) / 1800));
		m.y += m.vy * (0.5 + 0.5 * Math.cos((state.elapsed + m.phase * 350) / 2200));
		if (m.x < -5) m.x = canvas.width + 5; if (m.x > canvas.width + 5) m.x = -5;
		if (m.y < -5) m.y = floorH + 5; if (m.y > floorH + 5) m.y = -5;
	}
}
function drawAmbientBackLayer(ctx, canvas, state) {
	updateAmbient(canvas, state);
	const floorH = canvas.height - 130;
	ctx.save();
	ctx.beginPath(); ctx.rect(0, 0, canvas.width, floorH); ctx.clip();
	// Extra bold color sweeps (subtle but layered)
	const t = (state.elapsed || 0);
	for (let i = 0; i < 2; i++) {
		const w = 180 + i * 80;
		const speed = 0.02 + i * 0.015;
		const x = ((t * speed) % (canvas.width + w)) - w;
		const g = ctx.createLinearGradient(x, 0, x + w, 0);
		g.addColorStop(0, "rgba(106,163,255,0)");
		g.addColorStop(0.5, i === 0 ? "rgba(106,163,255,0.06)" : "rgba(232,178,108,0.05)");
		g.addColorStop(1, "rgba(232,178,108,0)");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, canvas.width, floorH);
	}
	// Dust motes (additive)
	ctx.globalCompositeOperation = 'lighter';
	for (const m of __ambient.motes) {
		ctx.save();
		ctx.globalAlpha = m.alpha;
		const grad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 12 * m.r);
		grad.addColorStop(0, 'rgba(255,255,200,0.8)');
		grad.addColorStop(1, 'rgba(255,255,200,0)');
		ctx.fillStyle = grad;
		ctx.beginPath(); ctx.arc(m.x, m.y, 12 * m.r, 0, Math.PI * 2); ctx.fill();
		ctx.restore();
	}
	ctx.restore();
}
function drawAmbientFrontLayer(ctx, canvas) {
	// Vignette
	const cx = canvas.width / 2, cy = (canvas.height - 130) / 2;
	const r = Math.hypot(cx, cy);
	ctx.save();
	const vg = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
	vg.addColorStop(0, 'rgba(0,0,0,0)');
	vg.addColorStop(1, 'rgba(0,0,0,0.16)');
	ctx.fillStyle = vg;
	ctx.fillRect(0, 0, canvas.width, canvas.height - 130);
	ctx.restore();
	// Scanlines overlay (lighter on small screens)
	if (__ambient.scanPattern) {
		ctx.save();
		const isSmall = (window.innerWidth <= 430);
		ctx.globalAlpha = isSmall ? 0.035 : 0.06;
		ctx.fillStyle = __ambient.scanPattern;
		ctx.fillRect(0, 0, canvas.width, canvas.height - 130);
		ctx.restore();
	}
}

function drawDiningLayout(ctx, canvas, state) {
	// Rebuild cache if size changed
	if (!cachedBg || cachedBgW !== canvas.width || cachedBgH !== canvas.height) {
		buildStaticBackground(canvas, state);
	}
	if (cachedBg) {
		ctx.drawImage(cachedBg, 0, 0);
	} else {
		// Fallback direct render (should rarely happen)
		ctx.fillStyle = "#120f0c";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		const floorH = canvas.height - 130;
		const grad = ctx.createLinearGradient(0, 0, 0, floorH);
		grad.addColorStop(0, "#221913");
		grad.addColorStop(1, "#1a140f");
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, canvas.width, floorH);
	}
	// Animated warm overlay
	drawBgParallaxOverlay(ctx, canvas, state);
	// Ambient background FX under props/entities
	drawAmbientBackLayer(ctx, canvas, state);
	// Day-night tint shift over day
	try {
		const ratio = Math.max(0, Math.min(1, (state.elapsed % (state.dailyTimeMs||60000)) / (state.dailyTimeMs||60000)));
		const evening = Math.max(0, Math.min(1, (ratio - 0.6) / 0.4));
		if (evening > 0) {
			ctx.save();
			ctx.fillStyle = `rgba(60,80,140, ${0.18 * evening})`;
			ctx.fillRect(0, 0, canvas.width, canvas.height - 130);
			ctx.restore();
		}
	} catch {}
	// Decor background pulse if active
	const hasDecorFx = (state.fx || []).some(f => f.type === 'decor');
	if (hasDecorFx) {
		const fx = state.fx.find(f => f.type === 'decor');
		const t = fx ? (fx.life / fx.lifeMax) : 0;
		const alpha = Math.max(0, Math.min(0.16, 0.20 * Math.sin(t * Math.PI)));
		ctx.save();
		ctx.fillStyle = `rgba(232,178,108, ${alpha})`;
		ctx.fillRect(0, 0, canvas.width, canvas.height - 130);
		ctx.restore();
	}
	// Rush mode red panic overlay
	if (state.rushActive) {
		const tt = (state.elapsed || 0) / 350;
		const a = 0.08 + 0.06 * (0.5 + 0.5 * Math.sin(tt));
		ctx.save();
		ctx.fillStyle = `rgba(201, 58, 58, ${a})`;
		ctx.fillRect(0, 0, canvas.width, canvas.height - 130);
		ctx.restore();
	}
	// Draw tables (including occupancy highlight) on top of cached floor
	for (const t of (state.tables || [])) {
		ctx.save();
		ctx.fillStyle = "#3b2a1f";
		ctx.strokeStyle = "#2a211b";
		ctx.lineWidth = 2;
		// Table drop shadow
		ctx.shadowColor = "rgba(0,0,0,0.35)";
		ctx.shadowBlur = 14;
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 6;
		ctx.fillRect(t.x, t.y, t.w, t.h);
		ctx.strokeRect(t.x, t.y, t.w, t.h);
		if (t.occupiedBy) {
			ctx.globalAlpha = 0.08;
			ctx.fillStyle = "#e8b26c";
			ctx.fillRect(t.x - 4, t.y - 4, t.w + 8, t.h + 8);
			ctx.globalAlpha = 1;
		}
		// Draw chairs
		for (const ch of (t.chairs || [])) {
			ctx.save();
			ctx.fillStyle = "#2a1f18";
			ctx.strokeStyle = "#1f1813";
			ctx.shadowColor = "rgba(0,0,0,0.25)";
			ctx.shadowBlur = 10;
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 4;
			ctx.fillRect(ch.x, ch.y, ch.w, ch.h);
			ctx.strokeRect(ch.x, ch.y, ch.w, ch.h);
			ctx.restore();
			if (ch.occupiedBy) {
				ctx.globalAlpha = 0.1;
				ctx.fillStyle = "#e8b26c";
				ctx.fillRect(ch.x - 2, ch.y - 2, ch.w + 4, ch.h + 4);
				ctx.globalAlpha = 1;
			}
		}
		// Table glow when decor fx pulses
		if (hasDecorFx) {
			const fx = state.fx.find(f => f.type === 'decor');
			const tt = fx ? (fx.life / fx.lifeMax) : 0;
			const pulse = 0.35 + 0.35 * Math.sin(tt * Math.PI);
			ctx.save();
			ctx.shadowColor = `rgba(232, 178, 108, ${0.5 * pulse})`;
			ctx.shadowBlur = 24 * pulse;
			ctx.strokeStyle = `rgba(232, 178, 108, ${0.7 * pulse})`;
			ctx.lineWidth = 3;
			ctx.strokeRect(t.x - 3, t.y - 3, t.w + 6, t.h + 6);
			ctx.restore();
		}
		ctx.restore();
	}
}

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
		ctx.save();
		ctx.shadowColor = "rgba(0,0,0,0.35)";
		ctx.shadowBlur = 16;
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 6;
		ctx.fillStyle = "#2e3350";
		ctx.fillRect(x, y, w, h);
		ctx.fillStyle = "#22263a";
		ctx.fillRect(x, y + h - 28, w, 28);
		ctx.restore();
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
			const job = st.slots[s].job;
			if (job) {
				// filled in overlay later
			}
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
				let barColor = "#7bd88f";
				if (step?.station === "drink") {
					const drinkColor = ticket?.item?.drinkColor;
					barColor = drinkColor || barColor;
				}
				ctx.fillStyle = barColor;
				ctx.fillRect(sx + 8, sy + sh - 16, (slotW - 16) * pct, 8);
				// Drink station splashes and color-matched emojis
				if (step?.station === "drink") {
					const filledW = (slotW - 16) * pct;
					if (filledW > 6) {
						const baseX = sx + 8;
						const baseY = sy + sh - 16;
						const t = state.elapsed || 0;
						const isSmall = (window.innerWidth || 0) <= 430;
						// Liquid splashes
						const splashSpacing = isSmall ? 28 : 20;
						const splashCount = Math.max(1, Math.floor(filledW / splashSpacing));
						for (let i = 0; i < splashCount; i++) {
							const rx = (splashCount === 1) ? (baseX + filledW - 10) : (baseX + 6 + i * splashSpacing);
							const rise = 6 + Math.abs(Math.sin((t * 0.024) + i * 1.2)) * (isSmall ? 8 : 12);
							const sway = Math.sin((t * 0.02) + i * 1.6) * 1.6;
							const x = Math.min(baseX + filledW - 10, rx) + sway;
							const y = baseY - 10 - rise;
							const r = isSmall ? 2.5 : 3.5;
							ctx.save();
							ctx.globalAlpha = 0.5 + 0.4 * Math.sin((t * 0.035) + i);
							ctx.fillStyle = barColor;
							ctx.beginPath();
							ctx.arc(x, y, r, 0, Math.PI * 2);
							ctx.fill();
							// small splash droplet above
							ctx.beginPath();
							ctx.arc(x + r * 0.8, y - r * 1.2, r * 0.6, 0, Math.PI * 2);
							ctx.fill();
							ctx.restore();
						}
						// Color-matched emoji accents
						let colorEmoji = "🥤";
						const nm = (ticket?.item?.name || "").toLowerCase();
						if (nm.includes("coffee")) colorEmoji = "🟤";
						else if (nm.includes("coke")) colorEmoji = "⚫";
						else if (nm.includes("fanta")) colorEmoji = "🟠";
						else if (nm.includes("gatorade") || nm.includes("blue")) colorEmoji = "🔵";
						const emojiSpacing = isSmall ? 110 : 80;
						const emojiCount = Math.max(1, Math.floor(filledW / emojiSpacing));
						ctx.save();
						ctx.font = (isSmall ? "13px" : "15px") + " sans-serif";
						ctx.textAlign = "center";
						ctx.textBaseline = "alphabetic";
						for (let j = 0; j < emojiCount; j++) {
							const rx = (emojiCount === 1) ? (baseX + filledW - 14) : (baseX + 10 + j * emojiSpacing);
							const rise = 14 + Math.abs(Math.sin((t * 0.018) + j * 1.05)) * (isSmall ? 10 : 16);
							const sway = Math.sin((t * 0.017) + j * 1.4) * 2.0;
							const x = Math.min(baseX + filledW - 14, rx) + sway;
							const y = baseY - 12 - rise;
							ctx.globalAlpha = 0.45 + 0.45 * Math.sin((t * 0.03) + j * 0.9);
							ctx.fillText(colorEmoji, x, y);
						}
						ctx.restore();
					}
				}
				// Animated flames for cooking station
				if (step?.station === "cook") {
					const filledW = (slotW - 16) * pct;
					if (filledW > 6) {
						const baseX = sx + 8;
						const baseY = sy + sh - 16;
						const t = state.elapsed || 0;
						const spacing = 18;
						const count = Math.max(1, Math.floor(filledW / spacing));
						for (let f = 0; f < count; f++) {
							const rx = (count === 1) ? (baseX + filledW - 12) : (baseX + 4 + f * spacing);
							const jitterX = Math.sin((t * 0.02) + f * 1.7) * 1.5;
							const jitterY = Math.sin((t * 0.03) + f * 2.1) * 1.5;
							const x = Math.min(baseX + filledW - 12, rx) + jitterX;
							const y = baseY - 10 + jitterY;
							const alpha = 0.7 + 0.3 * Math.sin((t * 0.04) + f);
							ctx.save();
							ctx.globalAlpha = Math.max(0.5, Math.min(1, alpha));
							// base flame
							ctx.fillStyle = "#ff8a3c";
							ctx.beginPath();
							ctx.moveTo(x - 6, y + 10);
							ctx.lineTo(x, y);
							ctx.lineTo(x + 6, y + 10);
							ctx.closePath();
							ctx.fill();
							// inner flame
							ctx.fillStyle = "#ffd15c";
							ctx.beginPath();
							ctx.moveTo(x - 3, y + 10);
							ctx.lineTo(x, y + 3);
							ctx.lineTo(x + 3, y + 10);
							ctx.closePath();
							ctx.fill();
							ctx.restore();
						}
						// Cooking emoji particles above flames
						const icons = ["🥩","🍖","🍳","🥓","🍗"];
						const isSmall = (window.innerWidth || 0) <= 430;
						const confSpacing = isSmall ? 90 : 64;
						const confCount = Math.max(1, Math.floor(filledW / confSpacing));
						ctx.save();
						ctx.font = (isSmall ? "14px" : "16px") + " sans-serif";
						ctx.textAlign = "center";
						ctx.textBaseline = "alphabetic";
						for (let j = 0; j < confCount; j++) {
							const rx = (confCount === 1) ? (baseX + filledW - 14) : (baseX + 10 + j * confSpacing);
							const rise = 10 + Math.abs(Math.sin((t * 0.02) + j * 1.05)) * 14;
							const sway = Math.sin((t * 0.017) + j * 1.3) * 2.4;
							const x = Math.min(baseX + filledW - 14, rx) + sway;
							const y = baseY - 16 - rise;
							const alpha = 0.55 + 0.45 * Math.sin((t * 0.035) + j * 0.8);
							ctx.globalAlpha = Math.max(0.35, Math.min(0.9, alpha));
							const icon = icons[j % icons.length];
							ctx.fillText(icon, x, y);
						}
						ctx.restore();
					}
				}
				// Prep station effects: chop sparks + ingredient confetti
				if (step?.station === "prep") {
					const filledW = (slotW - 16) * pct;
					if (filledW > 6) {
						const baseX = sx + 8;
						const baseY = sy + sh - 16;
						const t = state.elapsed || 0;
						// Chop sparks
						const chopSpacing = 22;
						const chopCount = Math.max(1, Math.floor(filledW / chopSpacing));
						for (let i = 0; i < chopCount; i++) {
							const rx = (chopCount === 1) ? (baseX + filledW - 10) : (baseX + 6 + i * chopSpacing);
							const up = Math.abs(Math.sin((t * 0.03) + i * 1.4));
							const jitterX = Math.sin((t * 0.015) + i * 2.3) * 1.2;
							const x = Math.min(baseX + filledW - 10, rx) + jitterX;
							const y = baseY - 6 - up * 10;
							const alpha = 0.6 + 0.4 * Math.sin((t * 0.05) + i);
							ctx.save();
							ctx.globalAlpha = Math.max(0.4, Math.min(1, alpha));
							ctx.fillStyle = "#ffd15c";
							ctx.fillRect(x - 1, y, 2, 4);
							ctx.restore();
						}
						// Ingredient confetti (emoji)
						const icons = ["🥕","🍅","🧅","🫑","🥒"];
						const confSpacing = 56;
						const confCount = Math.max(1, Math.floor(filledW / confSpacing));
						ctx.save();
						ctx.font = "14px sans-serif";
						ctx.textAlign = "center";
						ctx.textBaseline = "alphabetic";
						for (let j = 0; j < confCount; j++) {
							const rx = (confCount === 1) ? (baseX + filledW - 14) : (baseX + 10 + j * confSpacing);
							const rise = 6 + Math.abs(Math.sin((t * 0.02) + j * 1.1)) * 10;
							const sway = Math.sin((t * 0.018) + j * 1.7) * 2.2;
							const x = Math.min(baseX + filledW - 14, rx) + sway;
							const y = baseY - 8 - rise;
							const alpha = 0.55 + 0.45 * Math.sin((t * 0.04) + j * 0.9);
							ctx.globalAlpha = Math.max(0.35, Math.min(0.9, alpha));
							const icon = icons[j % icons.length];
							ctx.fillText(icon, x, y);
						}
						ctx.restore();
					}
				}
				ctx.fillStyle = "#9aa0b4";
				ctx.font = "12px sans-serif";
				const label = ticket?.item ? `${ticket.item.emoji ?? ''} ${ticket.item.name}`.trim() : "";
				ctx.fillText(label, sx + 8, sy + 16);
			}
		}
	}
}

export function drawRegister(ctx, canvas, state, layout) {
	// Position at the bottom center (opposite of previous top)
	const w = Math.min(220, Math.max(160, Math.floor(canvas.width * 0.18)));
	const h = 40;
	const x = Math.floor((canvas.width - w) / 2);
	const bottomMargin = 130;
	const y = Math.max(10, canvas.height - bottomMargin - h - 10);
	// Counter base
	ctx.save();
	ctx.fillStyle = "#2e3350";
	ctx.fillRect(x, y, w, h);
	ctx.fillStyle = "#22263a";
	ctx.fillRect(x, y + h - 14, w, 14);
	// Label
	ctx.fillStyle = "#c9cdea";
	ctx.font = "14px sans-serif";
	ctx.textAlign = "center";
	ctx.fillText("REGISTER", x + w / 2, y + 24);
	// Cashier NPC (visual only) mirrored to the left side
	const npcX = x + 30;
	const npcY = y - 6;
	ctx.save();
	ctx.fillStyle = "#ffffff";
	ctx.beginPath();
	ctx.arc(npcX, npcY, 8, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = "#6aa3ff"; // shirt
	ctx.fillRect(npcX - 10, npcY + 8, 20, 10);
	ctx.restore();
	// Scan light sweep
	const t = state.elapsed || 0;
	const sweepW = 30;
	const lx = ((t * 0.06) % (w + sweepW)) - sweepW;
	const lg = ctx.createLinearGradient(x + lx, y, x + lx + sweepW, y);
	lg.addColorStop(0, "rgba(255,255,255,0)");
	lg.addColorStop(0.5, "rgba(255,255,255,0.15)");
	lg.addColorStop(1, "rgba(255,255,255,0)");
	ctx.fillStyle = lg;
	ctx.fillRect(x, y, w, h);
	ctx.restore();
	layout.register = { x, y, w, h };
}

export function drawCustomers(ctx, canvas, state, layout, rng, custSkinReady, CUSTOMER_SKIN_IMG) {
	layout.customers.clear();
	for (const cust of state.customers) {
		const bumpY = cust.bumpTimer && cust.bumpTimer > 0 ? -3 : 0;
		// Sit-in animation offset (slide slightly downwards when seated)
		const sitOffset = Math.min(10, Math.floor((cust.sitProgress || 0) * 10));
		// Procedural anim: walk bob/tilt and impatience shake
		const tms = (cust._anim?.t || 0) + (cust._anim?.phase || 0);
		const walkBob = cust._moving ? Math.sin(tms / 140) * 4 : 0;
		const walkTilt = cust._moving ? Math.sin(tms / 180) * 0.08 : 0; // radians
		const impatientShake = cust.patience < 4 ? Math.sin(tms / 50) * (4 - cust.patience) : 0;
		const yOffset = bumpY + sitOffset + walkBob;
		const xOffset = impatientShake;

		// Soft ground shadow
		ctx.save();
		ctx.globalAlpha = 0.25;
		ctx.fillStyle = "#000";
		const shX = cust.x + xOffset + 15;
		const shY = cust.y + yOffset - 4;
		ctx.beginPath();
		ctx.ellipse?.(shX, shY, 18, 6, 0, 0, Math.PI * 2);
		if (!ctx.ellipse) { ctx.fillRect(shX - 18, shY - 3, 36, 6); } else { ctx.fill(); }
		ctx.restore();

		ctx.save();
		ctx.translate(xOffset, 0);
		if (walkTilt) {
			ctx.translate(cust.x + 15, cust.y + yOffset - 30);
			ctx.rotate(walkTilt);
			ctx.translate(-(cust.x + 15), -(cust.y + yOffset - 30));
		}
		// Body draw: GIF skin if ready, else fallback shapes
		if (custSkinReady) {
			const w = 54, h = 72; // larger sprite
			ctx.drawImage(CUSTOMER_SKIN_IMG, cust.x - 10, cust.y - h + yOffset, w, h);
		} else if (cust.vip) {
			ctx.fillStyle = "#e6c14a";
			ctx.fillRect(cust.x, cust.y - 40 + yOffset, 30, 40);
		} else {
			const hue = 180 + Math.floor(rng() * 100);
			ctx.fillStyle = `hsl(${hue} 50% 60%)`;
			ctx.fillRect(cust.x, cust.y - 40 + yOffset, 30, 40);
		}
		// VIP crown overlay remains
		if (cust.vip) {
			ctx.fillStyle = "#ffd76a";
			const cx = cust.x + 15;
			const cy = cust.y - 48 + yOffset;
			ctx.beginPath();
			ctx.moveTo(cx - 10, cy + 8);
			ctx.lineTo(cx - 5, cy);
			ctx.lineTo(cx, cy + 8);
			ctx.lineTo(cx + 5, cy);
			ctx.lineTo(cx + 10, cy + 8);
			ctx.closePath();
			ctx.fill();
		}
		// patience bar
		ctx.fillStyle = "#30354e";
		ctx.fillRect(cust.x - 4, cust.y - 50 + yOffset, 38, 6);
		ctx.fillStyle = cust.state === "served" ? "#7bd88f" : cust.state === "leaving" ? "#ff6b6b" : "#ffb86b";
		const patiencePct = Math.max(0, Math.min(1, cust.patience / 12));
		ctx.fillRect(cust.x - 4, cust.y - 50 + yOffset, 38 * patiencePct, 6);
		// order bubble
		ctx.fillStyle = "#0f1020";
		ctx.fillRect(cust.x + 34, cust.y - 44 + yOffset, 76, 22);
		ctx.fillStyle = "#c9cdea";
		ctx.font = "12px sans-serif";
		const orderLabel = `${cust.order.emoji ?? ''} ${cust.order.name}`.trim();
		ctx.fillText((cust.vip?"VIP ":"") + orderLabel, cust.x + 38, cust.y - 29 + yOffset);
		ctx.restore();
		// Hit rect (taller if GIF used)
		const hitH = custSkinReady ? 84 : 60;
		layout.customers.set(cust.id, { x: cust.x, y: cust.y - hitH + yOffset, w: 110, h: hitH });
		// Chat bubble
		if (cust._chat && cust._chat.text) {
			const t = Math.max(0, Math.min(1, cust._chat.life / cust._chat.lifeMax));
			const fadeIn = Math.min(1, t / 0.2);
			const fadeOut = Math.min(1, (1 - t) / 0.2);
			const alpha = Math.max(0, Math.min(1, Math.min(fadeIn, fadeOut)));
			const bubbleW = 160;
			const bubbleX = cust.x - 20;
			const bubbleY = (cust.y - 72 + yOffset) - 36;
			ctx.save();
			ctx.globalAlpha = alpha;
			ctx.fillStyle = "#171a2b";
			ctx.fillRect(bubbleX, bubbleY, bubbleW, 36);
			ctx.strokeStyle = "#2a2f48";
			ctx.strokeRect(bubbleX, bubbleY, bubbleW, 36);
			// tail
			ctx.beginPath();
			ctx.moveTo(bubbleX + 24, bubbleY + 36);
			ctx.lineTo(bubbleX + 34, bubbleY + 36);
			ctx.lineTo(bubbleX + 30, bubbleY + 42);
			ctx.closePath();
			ctx.fill();
			// text wrap (2 lines max)
			ctx.fillStyle = "#c9cdea";
			ctx.font = "12px sans-serif";
			const words = String(cust._chat.text).split(/\s+/);
			let line = "";
			const lines = [];
			for (let i = 0; i < words.length; i++) {
				const test = line ? (line + " " + words[i]) : words[i];
				if (ctx.measureText(test).width > bubbleW - 10) {
					lines.push(line);
					line = words[i];
				} else {
					line = test;
				}
			}
			if (line) lines.push(line);
			const maxLines = 2;
			for (let i = 0; i < Math.min(maxLines, lines.length); i++) {
				ctx.fillText(lines[i], bubbleX + 6, bubbleY + 14 + i * 14);
			}
			ctx.restore();
		}
	}
}

export function drawEmployee(ctx, e, empSkinReady, EMP_SKIN_IMG) {
	const roleColor = e.role === "runner" ? "#6aa3ff" : (e.station === "cook" ? "#ffb86b" : e.station === "drink" ? "#7bd88f" : "#c9cdea");
	const isMinion = !!e.isMinion;
	const r = isMinion ? 16 : 32;
	// Ground shadow
	ctx.save();
	ctx.globalAlpha = 0.28;
	ctx.fillStyle = "#000";
	ctx.beginPath();
	ctx.ellipse?.(e.x, e.y + (isMinion ? 2 : 4), isMinion ? 12 : 20, isMinion ? 4 : 7, 0, 0, Math.PI * 2);
	if (!ctx.ellipse) { ctx.fillRect(e.x - (isMinion?12:20), e.y + (isMinion?0:2), (isMinion?24:40), (isMinion?4:7)); } else { ctx.fill(); }
	ctx.restore();
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
	ctx.lineWidth = isMinion ? 2 : 4;
	ctx.beginPath();
	ctx.arc(e.x, e.y, r - 1, 0, Math.PI * 2);
	ctx.stroke();
	ctx.restore();
	// XP progress ring (non-minions)
	if (!isMinion && (e.xpToNext || 0) > 0) {
		const prog = Math.max(0, Math.min(1, (e.xp || 0) / (e.xpToNext || 1)));
		ctx.save();
		ctx.strokeStyle = "#ffd15c";
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.arc(e.x, e.y, r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog);
		ctx.stroke();
		ctx.restore();
	}

	// Manager silly overlays
	try {
		const isManager = (ctx.__state && ctx.__state.managerEmpId === e.id);
		if (isManager) {
			const t = (ctx.__state?.elapsed || 0) / 1000;
			// Aura pulse
			const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
			ctx.save();
			ctx.globalAlpha = 0.25 + 0.2 * pulse;
			ctx.strokeStyle = `rgba(123,216,143,${0.8})`;
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.arc(e.x, e.y, (isMinion ? 16 : 32) + 8 + pulse * 4, 0, Math.PI * 2);
			ctx.stroke();
			ctx.restore();
			// Rotor hat
			ctx.save();
			const spin = (t * 6.0) % (Math.PI * 2);
			ctx.translate(e.x, e.y - (isMinion ? 16 : 32) - 6);
			ctx.rotate(spin);
			ctx.fillStyle = "#ffb86b";
			ctx.fillRect(-12, -2, 24, 4);
			ctx.fillStyle = "#6aa3ff";
			ctx.fillRect(-2, -6, 4, 8);
			ctx.restore();
			// Orbiting clipboard
			ctx.save();
			const orbitR = (isMinion ? 16 : 32) + 18;
			const ox = e.x + Math.cos(t * 1.8) * orbitR;
			const oy = e.y + Math.sin(t * 1.8) * orbitR;
			ctx.translate(ox, oy);
			ctx.rotate(Math.cos(t * 1.8) * 0.4);
			ctx.fillStyle = "#2b2d45";
			ctx.fillRect(-10, -14, 20, 28);
			ctx.fillStyle = "#9aa0b4";
			ctx.fillRect(-8, -10, 16, 18);
			ctx.restore();
		}
	} catch {}
}

export function drawEmployees(ctx, state, empSkinReady, EMP_SKIN_IMG) {
	// pass state into ctx so drawEmployee can detect manager
	ctx.__state = state;
	for (const e of state.employees) {
		drawEmployee(ctx, e, empSkinReady, EMP_SKIN_IMG);
	}
	ctx.__state = null;
}

export function drawTicket(ctx, x, y, ticket, ghost = false) {
	const w = 150, h = 64;
	ctx.globalAlpha = ghost ? 0.6 : 1;
	const isReady = ticket.state === "ready";
	if (isReady) {
		const t = performance.now();
		const pulse = 0.75 + 0.25 * Math.sin(t / 600);
		ctx.fillStyle = `rgba(232, 178, 108, ${pulse})`;
		ctx.fillRect(x, y, w, h);
		ctx.fillStyle = "#2a211b";
		ctx.fillRect(x, y, w, 18);
		ctx.fillStyle = "#2a211b";
		ctx.font = "28px sans-serif";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText("$", x + w / 2, y + h / 2 + 4);
		ctx.textAlign = "left";
		ctx.textBaseline = "alphabetic";
		ctx.fillStyle = "#2a211b";
		ctx.font = "12px sans-serif";
		const tLabel = `${ticket.item.emoji ?? ''} ${ticket.item.name}`.trim();
		ctx.fillText(tLabel, x + 8, y + 14);
	} else {
		ctx.fillStyle = "#2a231c";
		ctx.fillRect(x, y, w, h);
		ctx.fillStyle = "#3a2d22";
		ctx.fillRect(x, y, w, 18);
		ctx.fillStyle = "#f3ead7";
		ctx.font = "12px sans-serif";
		const tLabel2 = `${ticket.item.emoji ?? ''} ${ticket.item.name}`.trim();
		ctx.fillText(tLabel2, x + 8, y + 14);
		ctx.fillStyle = "#c9b8a6";
		const step = ticket.recipe[ticket.stepIndex];
		let stepLabel = step?.station ?? "-";
		if (step?.station === "drink") {
			stepLabel = ticket?.item ? (ticket.item.name || "Drink") : "Drink";
		}
		ctx.fillText(`Step: ${stepLabel}`, x + 8, y + 32);
	}
	ctx.fillStyle = isReady ? "#2a211b" : "#c9b8a6";
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
		// subtle depth shadow
		ctx.save();
		ctx.shadowColor = "rgba(0,0,0,0.25)";
		ctx.shadowBlur = 6;
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 3;
		const rect = drawTicket(ctx, x, y, ticket);
		ctx.restore();
		layout.tickets.set(ticket.id, rect);
		y += rect.h + 10;
		if (y > canvas.height - 200) { y = 20; x += 160; }
	}
	const dragging = state.tickets.find(t => t.state === "dragging");
	if (dragging) {
		// tilt and shadow while dragging
		const dx = dragging._drag.x - dragging._drag.offX;
		const dy = dragging._drag.y - dragging._drag.offY;
		const angle = 0.06;
		ctx.save();
		ctx.translate(dx + 75, dy + 32);
		ctx.rotate(angle);
		ctx.translate(-(dx + 75), -(dy + 32));
		ctx.shadowColor = "rgba(0,0,0,0.35)";
		ctx.shadowBlur = 10;
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 6;
		drawTicket(ctx, dx, dy, dragging);
		ctx.restore();
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
			ctx.fillStyle = "#c9cdea";
			ctx.font = "12px sans-serif";
			ctx.textAlign = "center";
			ctx.fillText(fx.text || "+$", fx.x, y);
			ctx.restore();
			continue;
		}
		if (fx.type === 'decor') {
			// handled in background pulse
			continue;
		}
		if (fx.type === 'spark') {
			const t = fx.life / fx.lifeMax;
			const n = 10;
			ctx.save();
			for (let i = 0; i < n; i++) {
				const a = (i / n) * Math.PI * 2;
				const d = 6 + 24 * t;
				const x = fx.x + Math.cos(a) * d;
				const y = fx.y + Math.sin(a) * d;
				ctx.globalAlpha = Math.max(0, 1 - t);
				ctx.fillStyle = i % 2 ? "#7bd88f" : "#6aa3ff";
				ctx.fillRect(x - 1, y - 1, 2, 2);
			}
			ctx.restore();
			continue;
		}
		if (fx.type === 'poof') {
			const t = fx.life / fx.lifeMax;
			ctx.save();
			ctx.globalAlpha = Math.max(0, 1 - t);
			ctx.fillStyle = "rgba(200,200,220,0.6)";
			const rad = 8 + 26 * t;
			ctx.beginPath();
			ctx.arc(fx.x, fx.y, rad, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
			continue;
		}
		if (fx.type === 'speech') {
			const t = fx.life / fx.lifeMax;
			const y = fx.y - 8 * (1 - t);
			ctx.save();
			ctx.globalAlpha = Math.max(0.0, Math.min(1.0, 1 - t * 0.1));
			// bubble
			ctx.fillStyle = "#14182a";
			ctx.strokeStyle = "#2b2d45";
			ctx.lineWidth = 2;
			const w = Math.min(160, 40 + (fx.text ? fx.text.length * 6 : 0));
			ctx.beginPath();
			ctx.roundRect?.(fx.x - w/2, y - 32, w, 28, 6);
			if (!ctx.roundRect) { ctx.fillRect(fx.x - w/2, y - 32, w, 28); } else { ctx.fill(); }
			ctx.stroke();
			// tail
			ctx.beginPath();
			ctx.moveTo(fx.x, y - 4);
			ctx.lineTo(fx.x - 6, y + 6);
			ctx.lineTo(fx.x + 6, y + 6);
			ctx.closePath();
			ctx.fill();
			// text
			ctx.fillStyle = "#c9cdea";
			ctx.font = "12px sans-serif";
			ctx.textAlign = "center";
			ctx.fillText(fx.text || "", fx.x, y - 14);
			ctx.restore();
			continue;
		}
	}
}

function drawRushBanner(ctx, canvas, state) {
	if (!state.rushActive) return;
	const sec = Math.max(0, Math.ceil(state.rushTimer / 1000));
	const text = `RUSH ${sec}s`;
	const w = Math.min(canvas.width - 40, 220);
	const h = 32;
	const x = Math.floor((canvas.width - w) / 2);
	const y = 8;
	ctx.save();
	ctx.fillStyle = "#c93a3a";
	ctx.fillRect(x, y, w, h);
	ctx.fillStyle = "#2a0f0f";
	ctx.fillRect(x, y + h - 10, w, 10);
	ctx.fillStyle = "#ffeeee";
	ctx.font = "16px sans-serif";
	ctx.textAlign = "center";
	ctx.fillText(text, x + w / 2, y + 22);
	ctx.restore();
}

function drawPausedOverlay(ctx, canvas) {
	ctx.save();
	ctx.fillStyle = "rgba(0,0,0,0.5)";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = "#ffffff";
	ctx.font = "24px sans-serif";
	ctx.textAlign = "center";
	ctx.fillText("Paused", canvas.width / 2, canvas.height / 2);
	ctx.restore();
}

export function renderAll(ctx, canvas, state, layout, rng, empSkinReady, EMP_SKIN_IMG, custSkinReady, CUSTOMER_SKIN_IMG) {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	drawDiningLayout(ctx, canvas, state);
	drawRegister(ctx, canvas, state, layout);
	drawStations(ctx, canvas, state, layout);
	drawStationJobs(ctx, state, layout);
	drawCustomers(ctx, canvas, state, layout, rng, custSkinReady, CUSTOMER_SKIN_IMG);
	drawEmployees(ctx, state, empSkinReady, EMP_SKIN_IMG);
	drawTickets(ctx, canvas, state, layout);
	drawFx(ctx, state);
	drawRushBanner(ctx, canvas, state);
	// Foreground ambient overlay (vignette, scanlines)
	drawAmbientFrontLayer(ctx, canvas);
	if (state.paused && !state.gameOver && state.running) drawPausedOverlay(ctx, canvas);
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