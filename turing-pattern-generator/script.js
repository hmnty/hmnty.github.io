/**
 * Turing Pattern Generator
 * Based on FitzHugh-Nagumo Reaction-Diffusion Equations
 * Reference: https://github.com/ijmbarr/turing-patterns
 */

const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

// Simulation Parameters
let width = 400; // Increased resolution
let height = 400;
let Da = 1.0;
let Db = 100.0;
let alpha = -0.005;
let beta = 10.0;
let dt = 0.001;
let dx = 1.0; // Spatial step
let stepsPerFrame = 5; // Speed
let maxSteps = 5000;
let currentStep = 0;
let bias = -0.05; // Thickness control (-0.5 to 0.5)

// State Arrays
let gridA = new Float32Array(width * height);
let gridB = new Float32Array(width * height);
let nextA = new Float32Array(width * height);
let nextB = new Float32Array(width * height);

// Animation Control
let isRunning = false;
let animationId;
let uploadedImage = null; // Store uploaded image to re-use on run

// UI Elements
const ui = {
    da: document.getElementById('da'),
    db: document.getElementById('db'),
    alpha: document.getElementById('alpha'),
    beta: document.getElementById('beta'),
    speed: document.getElementById('speed'),
    maxSteps: document.getElementById('maxSteps'),
    thickness: document.getElementById('thickness'),
    daVal: document.getElementById('da-val'),
    dbVal: document.getElementById('db-val'),
    alphaVal: document.getElementById('alpha-val'),
    betaVal: document.getElementById('beta-val'),
    speedVal: document.getElementById('speed-val'),
    maxStepsVal: document.getElementById('maxSteps-val'),
    thicknessVal: document.getElementById('thickness-val'),
    progressBar: document.getElementById('progressBar'),
    playPauseBtn: document.getElementById('playPauseBtn'),
    resetBtn: document.getElementById('resetBtn'),
    runBtn: document.getElementById('runBtn'),
    downloadSvgBtn: document.getElementById('downloadSvgBtn'),
    imageUpload: document.getElementById('imageUpload'),
    toast: document.getElementById('toast')
};

function showToast(message, duration = 0) {
    ui.toast.textContent = message;
    ui.toast.classList.remove('hidden');
    ui.toast.classList.add('visible');

    if (duration > 0) {
        setTimeout(() => {
            ui.toast.classList.remove('visible');
            ui.toast.classList.add('hidden');
        }, duration);
    }
}

function init() {
    // Set canvas size
    const container = canvas.parentElement;
    canvas.width = width;
    canvas.height = height;

    // Scale canvas for display but keep internal resolution low for performance
    // We handle visual scaling via CSS

    resetGrid();
    setupEventListeners();
    loop();

    showToast('Ready');
}

function resetGrid() {
    if (uploadedImage) {
        // Re-seed from image
        seedFromImage(uploadedImage);
    } else {
        for (let i = 0; i < width * height; i++) {
            // Random initialization around 0
            gridA[i] = (Math.random() - 0.5) * 0.1;
            gridB[i] = (Math.random() - 0.5) * 0.1;
        }
    }
    currentStep = 0;
    ui.progressBar.style.width = '0%';
    // isRunning is controlled by startSimulation, don't auto-start here
}

function startSimulation() {
    resetGrid();
    isRunning = true;
    showToast('Running...');
    ui.playPauseBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;

    // Disable downloads
    ui.downloadSvgBtn.disabled = true;
}

function onSimulationComplete() {
    isRunning = false;
    showToast('Generated', 3000);
    ui.playPauseBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;

    // Enable downloads
    ui.downloadSvgBtn.disabled = false;
}

function getIndex(x, y) {
    // Periodic boundary conditions (wrap around)
    if (x < 0) x = width - 1;
    if (x >= width) x = 0;
    if (y < 0) y = height - 1;
    if (y >= height) y = 0;
    return y * width + x;
}

function laplacian(grid, x, y) {
    const idx = y * width + x;
    const center = grid[idx];

    const left = grid[getIndex(x - 1, y)];
    const right = grid[getIndex(x + 1, y)];
    const up = grid[getIndex(x, y - 1)];
    const down = grid[getIndex(x, y + 1)];

    return (left + right + up + down - 4 * center) / (dx * dx);
}

// Optimized Laplacian for entire grid
function updateGrid() {
    let maxChange = 0;
    for (let s = 0; s < stepsPerFrame; s++) {
        // Only track change for the last step in the frame to save perf
        const trackChange = (s === stepsPerFrame - 1);
        if (trackChange) maxChange = 0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = y * width + x;

                const a = gridA[i];
                const b = gridB[i];

                // Laplacian with periodic boundaries
                // Inline getIndex for performance
                const left = gridA[y * width + ((x - 1 + width) % width)];
                const right = gridA[y * width + ((x + 1) % width)];
                const up = gridA[((y - 1 + height) % height) * width + x];
                const down = gridA[((y + 1) % height) * width + x];
                const la = (left + right + up + down - 4 * a); // dx=1, so /1 is ignored

                const leftB = gridB[y * width + ((x - 1 + width) % width)];
                const rightB = gridB[y * width + ((x + 1) % width)];
                const upB = gridB[((y - 1 + height) % height) * width + x];
                const downB = gridB[((y + 1) % height) * width + x];
                const lb = (leftB + rightB + upB + downB - 4 * b);

                // Reaction functions
                // Ra = a - a^3 - b + alpha
                const ra = a - a * a * a - b + alpha;
                // Rb = (a - b) * beta
                const rb = (a - b) * beta;

                // Update
                const deltaA = dt * (Da * la + ra);
                const deltaB = dt * (Db * lb + rb);

                nextA[i] = a + deltaA;
                nextB[i] = b + deltaB;

                if (trackChange) {
                    const absA = deltaA < 0 ? -deltaA : deltaA;
                    const absB = deltaB < 0 ? -deltaB : deltaB;
                    if (absA > maxChange) maxChange = absA;
                    if (absB > maxChange) maxChange = absB;
                }
            }
        }

        // Swap buffers
        let tempA = gridA;
        gridA = nextA;
        nextA = tempA;

        let tempB = gridB;
        gridB = nextB;
        nextB = tempB;
    }
    return maxChange;
}

function draw() {
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    // Pre-calculate sigmoid factor
    // Higher factor = sharper transition = less gray area
    const k = 20;

    for (let i = 0; i < width * height; i++) {
        const val = gridA[i];

        // Sigmoid mapping to sharpen the gradient
        // 1 / (1 + e^(-k * (x - bias)))
        // Maps -1..1 to approx 0..1, but very steep at the bias point

        const normalized = 1 / (1 + Math.exp(-k * (val - bias)));

        // Map to 0..255
        let c = normalized * 255;

        // Simple Grayscale
        data[i * 4] = c;
        data[i * 4 + 1] = c;
        data[i * 4 + 2] = c;
        data[i * 4 + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
}

function loop() {
    if (isRunning) {
        const maxChange = updateGrid();
        currentStep += stepsPerFrame;

        // Update progress
        const progress = Math.min(100, (currentStep / maxSteps) * 100);
        ui.progressBar.style.width = `${progress}%`;

        draw();

        // Check for convergence or max steps
        if (maxChange < 1e-5 || currentStep >= maxSteps) {
            onSimulationComplete();
        }
    }
    animationId = requestAnimationFrame(loop);
}

function setupEventListeners() {
    // Sliders
    const updateParam = (el, valEl, targetVar, isFloat = true) => {
        el.addEventListener('input', (e) => {
            const val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value);
            valEl.textContent = val;

            if (targetVar === 'Da') Da = val;
            if (targetVar === 'Db') Db = val;
            if (targetVar === 'alpha') alpha = val;
            if (targetVar === 'beta') beta = val;
            if (targetVar === 'speed') stepsPerFrame = val;
            if (targetVar === 'maxSteps') maxSteps = val;
            if (targetVar === 'thickness') bias = val;

            // If parameters change, we might want to restart if it was auto-stopped?
            // For now, let's just let the user manually restart if they want.
            // Or better: if they change params, the system is likely unstable again, so we could auto-resume.
            // But let's stick to manual control to avoid jarring behavior.

            // If thickness changes, redraw immediately if paused
            if (targetVar === 'thickness' && !isRunning) {
                draw();
            }
        });
    };

    updateParam(ui.da, ui.daVal, 'Da');
    updateParam(ui.db, ui.dbVal, 'Db');
    updateParam(ui.alpha, ui.alphaVal, 'alpha');
    updateParam(ui.beta, ui.betaVal, 'beta');
    updateParam(ui.speed, ui.speedVal, 'speed', false);
    updateParam(ui.maxSteps, ui.maxStepsVal, 'maxSteps', false);
    updateParam(ui.thickness, ui.thicknessVal, 'thickness');

    // Buttons
    ui.playPauseBtn.addEventListener('click', () => {
        isRunning = !isRunning;
        showToast(isRunning ? 'Running' : 'Paused');
        // Toggle icon
        if (isRunning) {
            ui.playPauseBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
        } else {
            ui.playPauseBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
        }
    });

    ui.resetBtn.addEventListener('click', () => {
        resetGrid();
        if (!isRunning) {
            draw(); // Draw initial state if paused
        }
    });

    ui.runBtn.addEventListener('click', startSimulation);
    ui.downloadSvgBtn.addEventListener('click', downloadSVG);
    ui.imageUpload.addEventListener('change', handleImageUpload);
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        const img = new Image();
        img.onload = function () {
            uploadedImage = img; // Store for later use
            // Optional: Preview it immediately? 
            // For now, let's just reset and show it as the initial state
            resetGrid();
            draw();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function seedFromImage(img) {
    // Create a temp canvas to draw the image and get pixel data
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw image scaled to fit
    tempCtx.drawImage(img, 0, 0, width, height);

    const imageData = tempCtx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Map pixel brightness to gridA
    for (let i = 0; i < width * height; i++) {
        // Grayscale brightness
        const brightness = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
        // Map 0..255 to -1..1 (roughly)
        gridA[i] = (brightness / 255.0) * 2.0 - 1.0;

        // Initialize B with some noise
        gridB[i] = (Math.random() - 0.5) * 0.1;
    }
}

function downloadSVG() {
    // Use d3-contour to generate vector paths
    // We need to convert gridA to a standard array for d3
    const values = Array.from(gridA);

    // Generate contours
    // We want a single threshold at 'bias' to separate "black" and "white" regions
    const contours = d3.contours()
        .size([width, height])
        .thresholds([bias]) // Single threshold at bias
        (values);

    // Create SVG string
    const svgWidth = width * 5;
    const svgHeight = height * 5;

    // Solid Black Background, White Shapes

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="black" />`;

    const pathGenerator = d3.geoPath();

    contours.forEach(contour => {
        // Standard sharp path
        const pathData = pathGenerator(contour);
        if (pathData) {
            svgContent += `<path d="${pathData}" fill="white" stroke="none" />`;
        }
    });

    svgContent += `</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'turing-pattern.svg';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
}

// Start
init();
