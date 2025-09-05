// Simple bleep SFX (singleton AudioContext with throttle)
let _audio = null;
let _lastBleepAt = 0;

export function bleep(freq = 440, duration = 0.07, type = "square") {
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

export function resumeAudio() {
	try {
		if (!_audio) {
			_audio = new (window.AudioContext || window.webkitAudioContext)();
		}
		if (_audio && _audio.state === 'suspended') {
			_audio.resume?.();
		}
	} catch {}
} 