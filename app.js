/**
 * ============================================================================
 * PULSAR ACOUSTICS - MOTOR DE SONIFICACIÓN CÓSMICA CON TONE.JS
 * ============================================================================
 * 
 * Este script implementa:
 * 1. Carga y gestión de datos reales de pulsares (pulsarData.json).
 * 2. Cadena de audio modular con Tone.js (Filtros, Reverb, Sintetizadores y Analizador).
 * 3. Tres modos didácticos de sonificación para facilitar la decisión artística.
 * 4. Renderizado en Canvas del púlsar giratorio (Faro cósmico) y Osciloscopio en vivo.
 */

// --- 1. DATOS DE RESPALDO (Fallback por si se abre sin servidor web HTTP) ---
const FALLBACK_PULSARS = [
    {
        id: "psr-b0531-21",
        name: "PSR B0531+21",
        commonName: "Crab Pulsar (Púlsar del Cangrejo)",
        periodSeconds: 0.0331,
        frequencyHz: 30.21,
        distanceKpc: 2.0,
        constellation: "Taurus",
        musicalInterval: "32n"
    },
    {
        id: "psr-b0833-45",
        name: "PSR B0833-45",
        commonName: "Vela Pulsar (Púlsar de Vela)",
        periodSeconds: 0.0893,
        frequencyHz: 11.20,
        distanceKpc: 0.287,
        constellation: "Vela",
        musicalInterval: "16n"
    },
    {
        id: "psr-b1919-21",
        name: "PSR B1919+21",
        commonName: "El primer púlsar descubierto (LGM-1)",
        periodSeconds: 1.3373,
        frequencyHz: 0.747,
        distanceKpc: 0.7,
        constellation: "Vulpecula",
        musicalInterval: "4n"
    },
    {
        id: "psr-j1748-2446ad",
        name: "PSR J1748-2446ad",
        commonName: "Púlsar milisegundo ultrarrápido",
        periodSeconds: 0.001395,
        frequencyHz: 716.0,
        distanceKpc: 5.5,
        constellation: "Sagittarius"
    },
    {
        id: "psr-b1257-12",
        name: "PSR B1257+12",
        commonName: "Lich (Púlsar con el primer sistema exoplanetario)",
        periodSeconds: 0.0062185,
        frequencyHz: 160.82,
        distanceKpc: 0.710,
        constellation: "Virgo"
    },
    {
        id: "psr-j0737-3039a",
        name: "PSR J0737-3039A",
        commonName: "Sistema de doble púlsar (Pulsar A)",
        periodSeconds: 0.022699,
        frequencyHz: 44.05,
        distanceKpc: 1.15,
        constellation: "Puppis"
    }
];

// --- 2. ESTADO GLOBAL DE LA APLICACIÓN ---
const state = {
    pulsars: [],
    selectedPulsar: null,
    isPlaying: false,
    audioInitialized: false,
    mode: "radio", // 'radio' | 'drone' | 'musical'
    timeWarp: 1.0,
    isMuted: false,
    flashIntensity: 0,
    rotationAngle: 0
};

// --- 3. REFERENCIAS AL DOM ---
const dom = {
    btnInitAudio: document.getElementById('btnInitAudio'),
    audioStatusPill: document.getElementById('audioStatusPill'),
    statusIndicator: document.getElementById('statusIndicator'),
    audioStatusText: document.getElementById('audioStatusText'),
    pulsarCardsContainer: document.getElementById('pulsarCardsContainer'),
    currentPulsarDisplay: document.getElementById('currentPulsarDisplay'),
    btnPlayPause: document.getElementById('btnPlayPause'),
    playIcon: document.getElementById('playIcon'),
    pauseIcon: document.getElementById('pauseIcon'),
    playPauseText: document.getElementById('playPauseText'),
    btnMute: document.getElementById('btnMute'),
    muteIcon: document.getElementById('muteIcon'),
    speedSlider: document.getElementById('speedSlider'),
    speedValue: document.getElementById('speedValue'),
    reverbSlider: document.getElementById('reverbSlider'),
    reverbValue: document.getElementById('reverbValue'),
    filterSlider: document.getElementById('filterSlider'),
    filterValue: document.getElementById('filterValue'),
    resonanceSlider: document.getElementById('resonanceSlider'),
    resonanceValue: document.getElementById('resonanceValue'),
    hudPeriod: document.getElementById('hudPeriod'),
    hudFreq: document.getElementById('hudFreq'),
    hudRpm: document.getElementById('hudRpm'),
    currentModeTag: document.getElementById('currentModeTag'),
    toneCodePreview: document.getElementById('toneCodePreview'),
    waveformStatus: document.getElementById('waveformStatus'),
    pulsarCanvas: document.getElementById('pulsarCanvas'),
    pulsarCountBadge: document.getElementById('pulsarCountBadge'),
    waveformCanvas: document.getElementById('waveformCanvas'),
    modeRadios: document.querySelectorAll('input[name="sonificationMode"]')
};

// --- 4. MOTOR DE AUDIO CON TONE.JS ---
let audioNodes = {
    masterVol: null,
    analyser: null,
    filter: null,
    reverb: null,
    noiseSynth: null,
    droneSynth: null,
    lfo: null,
    polySynth: null,
    scheduledEventId: null
};

/**
 * Inicializa la cadena de efectos y sintetizadores Tone.js.
 * Nota: Los navegadores exigen que esto se llame tras un gesto del usuario (click).
 */
async function initAudioEngine() {
    if (state.audioInitialized) return;

    try {
        await Tone.start();
        console.log("AudioContext desbloqueado y Tone.js iniciado");

        // Master Volume
        audioNodes.masterVol = new Tone.Volume(-6);

        // Analizador de forma de onda para el osciloscopio en tiempo real
        audioNodes.analyser = new Tone.Analyser("waveform", 256);

        // Filtro pasa-bajos (Simula la dispersión de radio en el medio interestelar)
        audioNodes.filter = new Tone.Filter({
            frequency: 2500,
            type: "lowpass",
            rolloff: -24,
            Q: 3.0
        });

        // Reverberación espacial cósmica (Espacio interestelar)
        audioNodes.reverb = new Tone.Reverb({
            decay: 3.5,
            preDelay: 0.05,
            wet: 0.45
        });

        // Conexión de la cadena principal de master:
        // [Synths] ➔ [Filter] ➔ [Reverb] ➔ [MasterVol] ➔ [Analyser] ➔ [Tone.Destination]
        audioNodes.filter.connect(audioNodes.reverb);
        audioNodes.reverb.connect(audioNodes.masterVol);
        audioNodes.masterVol.connect(audioNodes.analyser);
        audioNodes.analyser.toDestination();

        // -------------------------------------------------------------
        // Sintetizador 1: Modo Radioastronomía (Clics & Pulsos)
        // -------------------------------------------------------------
        audioNodes.noiseSynth = new Tone.NoiseSynth({
            noise: { type: "white" },
            envelope: {
                attack: 0.002,
                decay: 0.035,
                sustain: 0
            }
        }).connect(audioNodes.filter);

        // Sintetizador percusivo complementario para el pulso de baja frecuencia
        audioNodes.clickSynth = new Tone.MembraneSynth({
            pitchDecay: 0.01,
            octaves: 2,
            oscillator: { type: "sine" },
            envelope: {
                attack: 0.001,
                decay: 0.04,
                sustain: 0.01,
                release: 0.04
            }
        }).connect(audioNodes.filter);

        // -------------------------------------------------------------
        // Sintetizador 2: Modo Tono Continuo / Drone
        // -------------------------------------------------------------
        audioNodes.droneSynth = new Tone.Synth({
            oscillator: { type: "sawtooth8" },
            envelope: {
                attack: 0.1,
                decay: 0.2,
                sustain: 0.9,
                release: 0.5
            }
        }).connect(audioNodes.filter);

        // LFO para modular la amplitud al compás del período
        audioNodes.lfo = new Tone.LFO({
            frequency: 1,
            min: -30,
            max: 0
        });
        audioNodes.lfo.connect(audioNodes.droneSynth.volume);
        audioNodes.lfo.start();

        // -------------------------------------------------------------
        // Sintetizador 3: Modo Musical (Polifónico para acordes/escalas)
        // -------------------------------------------------------------
        audioNodes.polySynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "triangle" },
            envelope: {
                attack: 0.02,
                decay: 0.2,
                sustain: 0.2,
                release: 0.8
            }
        }).connect(audioNodes.filter);

        state.audioInitialized = true;
        updateAudioStatusUI(true);

        dom.btnPlayPause.disabled = false;
        dom.btnMute.disabled = false;

        updateToneCodePreview();
    } catch (err) {
        console.error("Error al inicializar Tone.js:", err);
    }
}

/**
 * Actualiza la UI que indica si el motor de audio está listo.
 */
function updateAudioStatusUI(active) {
    if (active) {
        dom.statusIndicator.classList.add('active');
        dom.audioStatusText.textContent = `Tone.js Activo (${Tone.context.sampleRate || 44100} Hz)`;
        dom.waveformStatus.classList.add('active');
        dom.waveformStatus.textContent = 'Canal Abierto';
        dom.btnInitAudio.innerHTML = `
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Audio Listo</span>
        `;
        dom.btnInitAudio.disabled = true;
    }
}

// --- 5. LOGICA DE REPRODUCCIÓN Y SONIFICACIÓN ---

/**
 * Inicia la reproducción del púlsar actualmente seleccionado.
 */
async function startSonification() {
    if (!state.audioInitialized) {
        await initAudioEngine();
    }

    if (!state.selectedPulsar) return;

    // Detener cualquier evento o transporte previo
    stopSonification(false);

    state.isPlaying = true;
    dom.btnPlayPause.classList.add('playing');
    dom.playIcon.classList.add('hidden');
    dom.pauseIcon.classList.remove('hidden');
    dom.playPauseText.textContent = "Detener Sonificación";
    dom.waveformStatus.textContent = `Emisión Activa: ${state.selectedPulsar.name}`;

    const pulsar = state.selectedPulsar;

    // Calcular período efectivo ajustado por el factor de velocidad (Time Warp)
    const effectivePeriod = pulsar.periodSeconds / state.timeWarp;
    const effectiveFreq = pulsar.frequencyHz * state.timeWarp;

    // Aplicar dispersión y reverb según la distancia en Kpc
    adaptDspToPulsar(pulsar);

    // Ajustar tempo de Tone.Transport
    // Un período T segundos equivale a (60 / T) BPM
    const calculatedBpm = Math.min(Math.max((60 / effectivePeriod), 30), 400);
    Tone.Transport.bpm.value = calculatedBpm;

    if (state.mode === "radio") {
        playRadioMode(effectivePeriod);
    } else if (state.mode === "drone") {
        playDroneMode(effectiveFreq, effectivePeriod);
    } else if (state.mode === "musical") {
        playMusicalMode(pulsar);
    }

    updateToneCodePreview();
}

/**
 * Detiene la reproducción de audio.
 */
function stopSonification(updateUI = true) {
    state.isPlaying = false;

    // Cancelar repeticiones y loops
    if (audioNodes.scheduledEventId !== null) {
        Tone.Transport.clear(audioNodes.scheduledEventId);
        audioNodes.scheduledEventId = null;
    }

    Tone.Transport.stop();
    Tone.Transport.cancel();

    // Detener notas de sintes continuos
    if (audioNodes.droneSynth) {
        audioNodes.droneSynth.triggerRelease();
    }
    if (audioNodes.polySynth) {
        audioNodes.polySynth.releaseAll();
    }

    if (updateUI) {
        dom.btnPlayPause.classList.remove('playing');
        dom.playIcon.classList.remove('hidden');
        dom.pauseIcon.classList.add('hidden');
        dom.playPauseText.textContent = "Reproducir Sonificación";
        dom.waveformStatus.textContent = state.audioInitialized ? "Canal en Reposo" : "Señal Inactiva";
    }
}

/**
 * MODO 1: Radioastronomía Clásica (Pulsos y clics percusivos)
 */
function playRadioMode(periodSeconds) {
    // Si el período es muy rápido (< 25 ms, como el milisegundo J1748),
    // disparar un evento por segundo con scheduleRepeat satura JS;
    // Tone.js maneja intervalos hasta ciertos límites, usando notación de tiempo.
    Tone.Transport.start();

    // Disparar pulso rítmico
    audioNodes.scheduledEventId = Tone.Transport.scheduleRepeat((time) => {
        // Clic de ruido blanco simulando el barrido por el haz del radiotelescopio
        audioNodes.noiseSynth.triggerAttack(time);
        
        // Pulso grave complementario
        audioNodes.clickSynth.triggerAttackRelease("C1", "64n", time);

        // Flash visual sincronizado
        triggerPulseFlash();
    }, periodSeconds);
}

/**
 * MODO 2: Tono Continuo / Drone Cósmico (Frecuencia real)
 */
function playDroneMode(freqHz, periodSeconds) {
    // En el espectro audible humano (20 Hz - 20,000 Hz):
    // Si la frecuencia es < 20 Hz (p. ej. LGM-1 a 0.74 Hz o Vela a 11.2 Hz),
    // transponemos por octavas armónicas audibles (e.g. x16 o x32) y usamos el LFO
    // a la frecuencia exacta de rotación para modular el volumen (tremolo).
    let audiblePitch = freqHz;
    let multiplier = 1;

    while (audiblePitch < 40) {
        audiblePitch *= 2;
        multiplier *= 2;
    }

    // Configurar LFO a la velocidad real de giro
    audioNodes.lfo.frequency.value = freqHz;

    // Disparar nota sostenida
    audioNodes.droneSynth.triggerAttack(audiblePitch);

    // Activar loop para destello visual
    Tone.Transport.start();
    audioNodes.scheduledEventId = Tone.Transport.scheduleRepeat(() => {
        triggerPulseFlash();
    }, periodSeconds);
}

function getDerivedMusicalInterval(periodSeconds) {
    if (periodSeconds >= 1.0) return "4n";
    if (periodSeconds >= 0.08) return "8n";
    if (periodSeconds >= 0.02) return "16n";
    return "32n";
}

/**
 * MODO 3: Intervalos Musicales y Escala Armónica
 */
function playMusicalMode(pulsar) {
    Tone.Transport.start();

    // Escala modal interestelar (Re Dórico: D3, E3, F3, G3, A3, B3, C4, D4)
    const cosmicScale = ["D3", "F3", "G3", "A3", "C4", "D4", "F4", "A4"];
    let step = 0;

    const interval = pulsar.musicalInterval || getDerivedMusicalInterval(pulsar.periodSeconds);

    audioNodes.scheduledEventId = Tone.Transport.scheduleRepeat((time) => {
        const note = cosmicScale[step % cosmicScale.length];
        audioNodes.polySynth.triggerAttackRelease(note, "16n", time, 0.7);
        step++;

        triggerPulseFlash();
    }, interval);
}

/**
 * Ajusta los parámetros de reverberación y filtro según los datos físicos del púlsar.
 */
function adaptDspToPulsar(pulsar) {
    if (!audioNodes.reverb || !audioNodes.filter) return;

    // Distancia (Kpc): Mayor distancia = mayor mezcla húmeda (wet) y decaimiento
    // Rango típico: 0.28 Kpc (Vela) a 5.5 Kpc (J1748)
    const normDistance = Math.min(Math.max((pulsar.distanceKpc / 6.0), 0.15), 0.95);
    audioNodes.reverb.wet.value = normDistance;
    dom.reverbSlider.value = normDistance.toFixed(2);
    dom.reverbValue.textContent = `${pulsar.distanceKpc} Kpc (${Math.round(normDistance * 100)}%)`;

    // Filtro de corte según la frecuencia del púlsar
    // Pulsares rápidos conservan armónicos más altos
    const baseCutoff = Math.min(Math.max(pulsar.frequencyHz * 30, 800), 7500);
    audioNodes.filter.frequency.value = baseCutoff;
    dom.filterSlider.value = Math.round(baseCutoff);
    dom.filterValue.textContent = `${Math.round(baseCutoff)} Hz`;
}

/**
 * Disparo del destello lumínico en el observatorio
 */
function triggerPulseFlash() {
    state.flashIntensity = 1.0;
}

// --- 6. GESTIÓN DE DATOS Y RENDERIZADO DE LA UI ---

/**
 * Carga los datos de los pulsares desde pulsarData.json
 */
async function loadPulsarData() {
    try {
        const response = await fetch('pulsarData.json');
        if (!response.ok) throw new Error("Respuesta no OK");
        state.pulsars = await response.json();
    } catch (e) {
        console.warn("Cargando desde fallback integrado (compatible con modo local sin servidor)", e);
        state.pulsars = FALLBACK_PULSARS;
    }

    if (dom.pulsarCountBadge) {
        dom.pulsarCountBadge.textContent = `${state.pulsars.length} Púlsares`;
    }

    renderPulsarCards();

    // Seleccionar por defecto el primer púlsar (Crab)
    if (state.pulsars.length > 0) {
        selectPulsar(state.pulsars[0]);
    }
}

/**
 * Genera las tarjetas interactivas de cada púlsar en el panel izquierdo.
 */
function renderPulsarCards() {
    dom.pulsarCardsContainer.innerHTML = '';

    state.pulsars.forEach((pulsar) => {
        const card = document.createElement('div');
        card.className = 'pulsar-card';
        card.id = `card-${pulsar.id}`;
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');

        card.innerHTML = `
            <div class="card-header-line">
                <span class="pulsar-name">${pulsar.name}</span>
                <span class="card-constellation">${pulsar.constellation}</span>
            </div>
            <div class="pulsar-common-name">${pulsar.commonName}</div>
            <div class="pulsar-metrics-grid">
                <div class="metric-item">
                    <span class="metric-label">Período</span>
                    <span class="metric-value metric-highlight">${pulsar.periodSeconds} s</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Frecuencia</span>
                    <span class="metric-value">${pulsar.frequencyHz} Hz</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Distancia</span>
                    <span class="metric-value">${pulsar.distanceKpc} Kpc</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Velocidad</span>
                    <span class="metric-value">${Math.round((1 / pulsar.periodSeconds) * 60).toLocaleString()} RPM</span>
                </div>
            </div>
        `;

        card.addEventListener('click', () => selectPulsar(pulsar));
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectPulsar(pulsar);
            }
        });

        dom.pulsarCardsContainer.appendChild(card);
    });
}

/**
 * Selecciona un púlsar, actualiza el HUD y relanza el sonido si estaba reproduciéndose.
 */
function selectPulsar(pulsar) {
    state.selectedPulsar = pulsar;

    // Actualizar tarjetas activas
    document.querySelectorAll('.pulsar-card').forEach(c => c.classList.remove('selected'));
    const activeCard = document.getElementById(`card-${pulsar.id}`);
    if (activeCard) {
        activeCard.classList.add('selected');
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Actualizar HUD del observatorio
    dom.currentPulsarDisplay.textContent = `${pulsar.name} (${pulsar.constellation})`;
    dom.hudPeriod.textContent = `${pulsar.periodSeconds} s`;
    dom.hudFreq.textContent = `${pulsar.frequencyHz} Hz`;

    const rpm = Math.round((1 / pulsar.periodSeconds) * 60);
    dom.hudRpm.textContent = `${rpm.toLocaleString()} rpm`;

    adaptDspToPulsar(pulsar);
    updateToneCodePreview();

    // Si ya estaba en reproducción, reiniciar con el nuevo púlsar
    if (state.isPlaying) {
        startSonification();
    }
}

/**
 * Actualiza el bloque de código didáctico que muestra qué está haciendo Tone.js.
 */
function updateToneCodePreview() {
    if (!state.selectedPulsar) return;
    const p = state.selectedPulsar;

    let snippet = "";
    if (state.mode === "radio") {
        snippet = `// MODO 1: RADIOASTRONOMÍA CLÁSICA
const synth = new Tone.NoiseSynth().connect(filter);
const interval = ${p.periodSeconds} / ${state.timeWarp}; // ${ (p.periodSeconds / state.timeWarp).toFixed(4) }s

Tone.Transport.scheduleRepeat((time) => {
    synth.triggerAttack(time);
}, interval);`;
    } else if (state.mode === "drone") {
        snippet = `// MODO 2: TONO CONTINUO / FRECUENCIA DIRECTA
const drone = new Tone.Synth({ oscillator: "sawtooth" });
const lfo = new Tone.LFO(${p.frequencyHz * state.timeWarp}, -30, 0);

lfo.connect(drone.volume);
drone.triggerAttack(${p.frequencyHz} * octava);`;
    } else if (state.mode === "musical") {
        const interval = p.musicalInterval || getDerivedMusicalInterval(p.periodSeconds);
        snippet = `// MODO 3: INTERVALOS & ESCALA ARMÓNICA
Tone.Transport.bpm.value = ${(60 / (p.periodSeconds / state.timeWarp)).toFixed(1)};
Tone.Transport.scheduleRepeat((time) => {
    polySynth.triggerAttackRelease(note, "16n", time);
}, "${interval}");`;
    }

    dom.toneCodePreview.innerHTML = `<code>${snippet}</code>`;
}

// --- 7. OBSERVATORIO VISUAL EN CANVAS ---
const pulsarCtx = dom.pulsarCanvas.getContext('2d');
const waveCtx = dom.waveformCanvas.getContext('2d');

// Partículas de fondo estelar relativas (0 a 1)
const stars = Array.from({ length: 60 }, () => ({
    x: Math.random(),
    y: Math.random(),
    radius: Math.random() * 1.4 + 0.6,
    alpha: Math.random() * 0.8 + 0.2
}));

let lastTimestamp = performance.now();

/**
 * Sincroniza la resolución interna del canvas con su tamaño real renderizado en pantalla (DPR)
 */
function syncCanvasResolutions() {
    const pRect = dom.pulsarCanvas.getBoundingClientRect();
    if (pRect.width > 0 && pRect.height > 0) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.round(pRect.width * dpr);
        const h = Math.round(pRect.height * dpr);
        if (dom.pulsarCanvas.width !== w || dom.pulsarCanvas.height !== h) {
            dom.pulsarCanvas.width = w;
            dom.pulsarCanvas.height = h;
        }
    }
    const wRect = dom.waveformCanvas.getBoundingClientRect();
    if (wRect.width > 0 && wRect.height > 0) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.round(wRect.width * dpr);
        const h = Math.round(wRect.height * dpr);
        if (dom.waveformCanvas.width !== w || dom.waveformCanvas.height !== h) {
            dom.waveformCanvas.width = w;
            dom.waveformCanvas.height = h;
        }
    }
}

/**
 * Ciclo de renderizado de la estrella de neutrones y el osciloscopio
 */
function animationLoop(timestamp) {
    const dt = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    syncCanvasResolutions();
    renderObservatory(dt);
    renderWaveform();

    requestAnimationFrame(animationLoop);
}

/**
 * Dibuja la estrella de neutrones, sus conos de radiación y el destello de faro de forma escalada
 */
function renderObservatory(dt) {
    const width = dom.pulsarCanvas.width;
    const height = dom.pulsarCanvas.height;
    if (width === 0 || height === 0) return;

    const centerX = width / 2;
    const centerY = height / 2;
    const scale = Math.min(width, height) / 320;

    pulsarCtx.clearRect(0, 0, width, height);

    // 1. Estrellas de fondo relativas
    stars.forEach(star => {
        pulsarCtx.beginPath();
        pulsarCtx.arc(star.x * width, star.y * height, star.radius * Math.max(scale, 0.8), 0, Math.PI * 2);
        pulsarCtx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
        pulsarCtx.fill();
    });

    if (!state.selectedPulsar) return;

    // 2. Velocidad de rotación angular
    const angularSpeed = (2 * Math.PI / state.selectedPulsar.periodSeconds) * state.timeWarp;
    const visualSpeed = Math.min(angularSpeed, 25);
    state.rotationAngle += visualSpeed * dt;

    // 3. Destello de pulso (Flash cósmico)
    if (state.flashIntensity > 0.02) {
        state.flashIntensity -= dt * 3.5;
        const grad = pulsarCtx.createRadialGradient(centerX, centerY, 5 * scale, centerX, centerY, 220 * scale);
        grad.addColorStop(0, `rgba(0, 242, 254, ${state.flashIntensity * 0.55})`);
        grad.addColorStop(0.5, `rgba(79, 172, 254, ${state.flashIntensity * 0.22})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        pulsarCtx.fillStyle = grad;
        pulsarCtx.fillRect(0, 0, width, height);
    }

    // 4. Conos de Radiación (Relativistic Jets escalados)
    pulsarCtx.save();
    pulsarCtx.translate(centerX, centerY);

    const beamLength = 150 * scale;
    const beamSpread = 0.28;
    const angle = state.rotationAngle;

    [angle, angle + Math.PI].forEach(currentA => {
        pulsarCtx.save();
        pulsarCtx.rotate(currentA);

        const beamGrad = pulsarCtx.createLinearGradient(0, 0, beamLength, 0);
        beamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        beamGrad.addColorStop(0.3, 'rgba(0, 242, 254, 0.7)');
        beamGrad.addColorStop(0.7, 'rgba(138, 43, 226, 0.35)');
        beamGrad.addColorStop(1, 'rgba(0, 242, 254, 0)');

        pulsarCtx.beginPath();
        pulsarCtx.moveTo(0, 0);
        pulsarCtx.lineTo(beamLength, -Math.tan(beamSpread) * beamLength);
        pulsarCtx.lineTo(beamLength, Math.tan(beamSpread) * beamLength);
        pulsarCtx.closePath();
        pulsarCtx.fillStyle = beamGrad;
        pulsarCtx.fill();

        pulsarCtx.restore();
    });

    // 5. Líneas de Campo Magnético Dipolar
    pulsarCtx.strokeStyle = 'rgba(79, 172, 254, 0.28)';
    pulsarCtx.lineWidth = Math.max(1 * scale, 1);
    for (let r = 26 * scale; r <= 75 * scale; r += 16 * scale) {
        pulsarCtx.beginPath();
        pulsarCtx.ellipse(0, 0, r * 1.5, r * 0.6, angle + Math.PI / 2, 0, Math.PI * 2);
        pulsarCtx.stroke();
    }

    // 6. Núcleo de la Estrella de Neutrones (Hiperdensa)
    const coreRadius = Math.max(18 * scale, 12);
    const coreGrad = pulsarCtx.createRadialGradient(0, 0, 2, 0, 0, coreRadius);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.4, '#a6f0ff');
    coreGrad.addColorStop(0.8, '#00d4ff');
    coreGrad.addColorStop(1, '#052345');

    pulsarCtx.beginPath();
    pulsarCtx.arc(0, 0, coreRadius, 0, Math.PI * 2);
    pulsarCtx.fillStyle = coreGrad;
    pulsarCtx.shadowColor = '#00f2fe';
    pulsarCtx.shadowBlur = 20 * scale;
    pulsarCtx.fill();
    pulsarCtx.shadowBlur = 0;

    pulsarCtx.restore();
}

/**
 * Renderiza el osciloscopio en vivo a partir de Tone.Analyser
 */
function renderWaveform() {
    const width = dom.waveformCanvas.width;
    const height = dom.waveformCanvas.height;

    waveCtx.fillStyle = 'rgba(5, 7, 13, 0.4)';
    waveCtx.fillRect(0, 0, width, height);

    // Eje central de referencia
    waveCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    waveCtx.lineWidth = 1;
    waveCtx.beginPath();
    waveCtx.moveTo(0, height / 2);
    waveCtx.lineTo(width, height / 2);
    waveCtx.stroke();

    if (!audioNodes.analyser || !state.isPlaying) {
        // Línea plana en reposo con brillo tenue
        waveCtx.strokeStyle = 'rgba(0, 242, 254, 0.25)';
        waveCtx.beginPath();
        waveCtx.moveTo(0, height / 2);
        waveCtx.lineTo(width, height / 2);
        waveCtx.stroke();
        return;
    }

    const values = audioNodes.analyser.getValue();
    waveCtx.beginPath();
    waveCtx.lineWidth = 2;
    waveCtx.strokeStyle = '#00f2fe';
    waveCtx.shadowColor = 'rgba(0, 242, 254, 0.8)';
    waveCtx.shadowBlur = 8;

    const sliceWidth = width / values.length;
    let x = 0;

    for (let i = 0; i < values.length; i++) {
        // Los valores de waveform oscilan entre -1 y 1
        const v = values[i];
        const y = (v + 1) * (height / 2);

        if (i === 0) {
            waveCtx.moveTo(x, y);
        } else {
            waveCtx.lineTo(x, y);
        }

        x += sliceWidth;
    }

    waveCtx.stroke();
    waveCtx.shadowBlur = 0; // reset
}

// --- 8. CONFIGURACIÓN DE EVENT LISTENERS ---
function setupEventListeners() {
    // Botón Activar Audio Tone.js
    dom.btnInitAudio.addEventListener('click', async () => {
        await initAudioEngine();
    });

    // Play / Pause
    dom.btnPlayPause.addEventListener('click', async () => {
        if (!state.audioInitialized) {
            await initAudioEngine();
        }

        if (state.isPlaying) {
            stopSonification(true);
        } else {
            startSonification();
        }
    });

    // Mute
    dom.btnMute.addEventListener('click', () => {
        if (!audioNodes.masterVol) return;
        state.isMuted = !state.isMuted;
        audioNodes.masterVol.mute = state.isMuted;
        dom.muteIcon.textContent = state.isMuted ? '🔇' : '🔊';
        dom.btnMute.title = state.isMuted ? 'Reanudar Audio' : 'Silenciar';
    });

    // Time Warp Slider
    dom.speedSlider.addEventListener('input', (e) => {
        state.timeWarp = parseFloat(e.target.value);
        dom.speedValue.textContent = `${state.timeWarp.toFixed(1)}x`;

        if (state.isPlaying) {
            startSonification();
        }
    });

    // Selector de Modo de Sonificación
    dom.modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                state.mode = e.target.value;

                // Actualizar estilos activos
                document.querySelectorAll('.mode-option').forEach(opt => opt.classList.remove('active'));
                e.target.closest('.mode-option').classList.add('active');

                const modeLabels = {
                    radio: "Modo: Radioastronómico",
                    drone: "Modo: Tono Continuo",
                    musical: "Modo: Armónico / Escala"
                };
                dom.currentModeTag.textContent = modeLabels[state.mode] || "Modo Activo";

                if (state.isPlaying) {
                    startSonification();
                } else {
                    updateToneCodePreview();
                }
            }
        });
    });

    // Sliders de Modulación DSP
    dom.reverbSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (audioNodes.reverb) {
            audioNodes.reverb.wet.value = val;
        }
        dom.reverbValue.textContent = `${Math.round(val * 100)}% Wet`;
    });

    dom.filterSlider.addEventListener('input', (e) => {
        const freq = parseFloat(e.target.value);
        if (audioNodes.filter) {
            audioNodes.filter.frequency.value = freq;
        }
        dom.filterValue.textContent = `${Math.round(freq)} Hz`;
    });

    dom.resonanceSlider.addEventListener('input', (e) => {
        const q = parseFloat(e.target.value);
        if (audioNodes.filter) {
            audioNodes.filter.Q.value = q;
        }
        dom.resonanceValue.textContent = `${q.toFixed(1)} Q`;
    });

    // Permitir scroll suave con la rueda del ratón en cualquier punto del panel de catálogo
    const catalogPanel = document.querySelector('.catalog-panel');
    if (catalogPanel && dom.pulsarCardsContainer) {
        catalogPanel.addEventListener('wheel', (e) => {
            dom.pulsarCardsContainer.scrollTop += e.deltaY;
        }, { passive: true });
    }
}

// --- 9. INICIALIZACIÓN GLOBAL ---
document.addEventListener('DOMContentLoaded', () => {
    loadPulsarData();
    setupEventListeners();
    requestAnimationFrame(animationLoop);
    console.log("Laboratorio de Sonificación de Pulsares listo.");
});
