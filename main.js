const state = {
    ref: { img: null, color: null },
    tgt: { img: null, color: null, originalData: null, currentData: null }
};

const dom = {
    radius: document.getElementById('radius'),
    method: document.getElementById('method'),
    intensity: document.getElementById('intensity'),
    intensityVal: document.getElementById('intensity-val'),
    downloadBtn: document.getElementById('download-btn'),
    loader: document.getElementById('loader'),
};

['ref', 'tgt'].forEach(key => {
    dom[key] = {
        container: document.getElementById(`container-${key}`),
        fileInput: document.getElementById(`file-${key}`),
        uploadPrompt: document.getElementById(`upload-prompt-${key}`),
        canvas: document.getElementById(`canvas-${key}`),
        mag: document.getElementById(`mag-${key}`),
        magCanvas: document.getElementById(`mag-canvas-${key}`),
        swatch: document.getElementById(`swatch-${key}`),
        hex: document.getElementById(`color-hex-${key}`),
        footer: document.getElementById(`footer-${key}`),
        replaceBtn: document.getElementById(`replace-${key}`),
        replaceFile: document.getElementById(`replace-file-${key}`),
        ctx: document.getElementById(`canvas-${key}`).getContext('2d', { willReadFrequently: true }),
        magCtx: document.getElementById(`mag-canvas-${key}`).getContext('2d')
    };
});

// Setup drag and drop & inputs
['ref', 'tgt'].forEach(key => {
    const d = dom[key];
    
    // Initial file input
    d.fileInput.addEventListener('change', (e) => handleImageUpload(e.target.files[0], key));
    
    // Replace file input
    d.replaceBtn.addEventListener('click', () => d.replaceFile.click());
    d.replaceFile.addEventListener('change', (e) => handleImageUpload(e.target.files[0], key));

    // Drag and drop
    d.container.addEventListener('dragover', (e) => {
        e.preventDefault();
        d.container.classList.add('drag-over');
    });
    d.container.addEventListener('dragleave', (e) => {
        e.preventDefault();
        d.container.classList.remove('drag-over');
    });
    d.container.addEventListener('drop', (e) => {
        e.preventDefault();
        d.container.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleImageUpload(e.dataTransfer.files[0], key);
        }
    });

    // Magnifier and color picking
    d.canvas.addEventListener('mousemove', (e) => handleMouseMove(e, key));
    d.canvas.addEventListener('mouseleave', () => d.mag.classList.add('hidden'));
    d.canvas.addEventListener('click', (e) => handleColorPick(e, key));
});

function handleImageUpload(file, key) {
    if (!file || !file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            state[key].img = img;
            
            // Setup canvas size
            const canvas = dom[key].canvas;
            canvas.width = img.width;
            canvas.height = img.height;
            dom[key].ctx.drawImage(img, 0, 0);
            
            // UI updates
            dom[key].uploadPrompt.classList.add('hidden');
            canvas.classList.remove('hidden');
            dom[key].footer.classList.remove('hidden');
            
            if (key === 'tgt') {
                state.tgt.originalData = dom.tgt.ctx.getImageData(0, 0, canvas.width, canvas.height);
                state.tgt.currentData = new ImageData(
                    new Uint8ClampedArray(state.tgt.originalData.data),
                    canvas.width, canvas.height
                );
            }
            
            // Check if we need to re-process (e.g. replaced target image but both colors exist)
            checkAndProcess();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function getEventCoords(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
        clientX: e.clientX,
        clientY: e.clientY
    };
}

function handleMouseMove(e, key) {
    if (!state[key].img) return;
    
    const d = dom[key];
    const { x, y, clientX, clientY } = getEventCoords(e, d.canvas);
    
    // Position magnifier
    d.mag.style.left = `${clientX}px`;
    d.mag.style.top = `${clientY}px`;
    d.mag.classList.remove('hidden');
    
    // Draw magnifier content (zoom)
    const magSize = 80;
    const zoom = 5;
    const srcSize = magSize / zoom;
    
    d.magCtx.imageSmoothingEnabled = false;
    d.magCtx.clearRect(0, 0, magSize, magSize);
    d.magCtx.drawImage(
        d.canvas,
        Math.floor(x - srcSize/2), Math.floor(y - srcSize/2), srcSize, srcSize,
        0, 0, magSize, magSize
    );
}

function handleColorPick(e, key) {
    if (!state[key].img) return;
    
    const d = dom[key];
    const { x, y } = getEventCoords(e, d.canvas);
    
    const radiusStr = dom.radius.value;
    const r = Math.floor(parseInt(radiusStr) / 2);
    
    const startX = Math.max(0, Math.floor(x - r));
    const startY = Math.max(0, Math.floor(y - r));
    const width = Math.min(d.canvas.width - startX, parseInt(radiusStr));
    const height = Math.min(d.canvas.height - startY, parseInt(radiusStr));
    
    // Use the original image data for target, to avoid picking already modified colors
    let imageData;
    if (key === 'tgt' && state.tgt.originalData) {
        // Create a temporary canvas to get the precise pixel block from original data
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = d.canvas.width;
        tempCanvas.height = d.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(state.tgt.originalData, 0, 0);
        imageData = tempCtx.getImageData(startX, startY, width, height);
    } else {
        imageData = d.ctx.getImageData(startX, startY, width, height);
    }
    
    const data = imageData.data;
    
    let sumR = 0, sumG = 0, sumB = 0;
    const pixels = data.length / 4;
    
    for (let i = 0; i < data.length; i += 4) {
        sumR += data[i];
        sumG += data[i+1];
        sumB += data[i+2];
    }
    
    const avgR = Math.round(sumR / pixels);
    const avgG = Math.round(sumG / pixels);
    const avgB = Math.round(sumB / pixels);
    
    state[key].color = [avgR, avgG, avgB];
    
    // Update UI
    const hex = rgbToHex(avgR, avgG, avgB);
    d.swatch.style.backgroundColor = `rgb(${avgR}, ${avgG}, ${avgB})`;
    d.hex.textContent = hex;
    
    checkAndProcess();
}

function rgbToHex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
}

// Processing
dom.method.addEventListener('change', checkAndProcess);
dom.intensity.addEventListener('input', (e) => {
    dom.intensityVal.textContent = `${e.target.value}%`;
    checkAndProcess();
});

function checkAndProcess() {
    if (state.ref.color && state.tgt.color && state.tgt.originalData) {
        processImage();
    }
}

// Inline Web Worker setup for color processing
const workerScript = `
    // Inject ColorMath code directly
    const ColorMath = {
        rgbToXyz: function(r, g, b) {
            let r1 = r / 255; let g1 = g / 255; let b1 = b / 255;
            r1 = r1 > 0.04045 ? Math.pow((r1 + 0.055) / 1.055, 2.4) : r1 / 12.92;
            g1 = g1 > 0.04045 ? Math.pow((g1 + 0.055) / 1.055, 2.4) : g1 / 12.92;
            b1 = b1 > 0.04045 ? Math.pow((b1 + 0.055) / 1.055, 2.4) : b1 / 12.92;
            return [r1 * 41.24 + g1 * 35.76 + b1 * 18.05, r1 * 21.26 + g1 * 71.52 + b1 * 7.22, r1 * 1.93 + g1 * 11.92 + b1 * 95.05];
        },
        xyzToLab: function(x, y, z) {
            let x1 = x / 95.047; let y1 = y / 100.000; let z1 = z / 108.883;
            x1 = x1 > 0.008856 ? Math.pow(x1, 1 / 3) : (7.787 * x1) + (16 / 116);
            y1 = y1 > 0.008856 ? Math.pow(y1, 1 / 3) : (7.787 * y1) + (16 / 116);
            z1 = z1 > 0.008856 ? Math.pow(z1, 1 / 3) : (7.787 * z1) + (16 / 116);
            return [(116 * y1) - 16, 500 * (x1 - y1), 200 * (y1 - z1)];
        },
        rgbToLab: function(r, g, b) { const xyz = this.rgbToXyz(r, g, b); return this.xyzToLab(xyz[0], xyz[1], xyz[2]); },
        labToXyz: function(l, a, b) {
            let y = (l + 16) / 116; let x = a / 500 + y; let z = y - b / 200;
            let y3 = Math.pow(y, 3); let x3 = Math.pow(x, 3); let z3 = Math.pow(z, 3);
            y = y3 > 0.008856 ? y3 : (y - 16 / 116) / 7.787;
            x = x3 > 0.008856 ? x3 : (x - 16 / 116) / 7.787;
            z = z3 > 0.008856 ? z3 : (z - 16 / 116) / 7.787;
            return [x * 95.047, y * 100.000, z * 108.883];
        },
        xyzToRgb: function(x, y, z) {
            let x1 = x / 100; let y1 = y / 100; let z1 = z / 100;
            let r = x1 * 3.2406 + y1 * -1.5372 + z1 * -0.4986;
            let g = x1 * -0.9689 + y1 * 1.8758 + z1 * 0.0415;
            let b = x1 * 0.0557 + y1 * -0.2040 + z1 * 1.0570;
            r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
            g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
            b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;
            return [Math.max(0, Math.min(255, Math.round(r * 255))), Math.max(0, Math.min(255, Math.round(g * 255))), Math.max(0, Math.min(255, Math.round(b * 255)))];
        },
        labToRgb: function(l, a, b) { const xyz = this.labToXyz(l, a, b); return this.xyzToRgb(xyz[0], xyz[1], xyz[2]); }
    };

    self.onmessage = function(e) {
        const { originalData, refColor, tgtColor, method, intensity } = e.data;
        const width = originalData.width;
        const height = originalData.height;
        const sourceData = originalData.data;
        
        // We must create a NEW array to send back
        const newData = new Uint8ClampedArray(sourceData.length);
        
        const len = sourceData.length;
        const intens = intensity / 100;

        let deltaL = 0, deltaA = 0, deltaB = 0;
        let scaleR = 1, scaleG = 1, scaleB = 1;

        if (method === 'lab') {
            const refLab = ColorMath.rgbToLab(refColor[0], refColor[1], refColor[2]);
            const tgtLab = ColorMath.rgbToLab(tgtColor[0], tgtColor[1], tgtColor[2]);
            deltaL = refLab[0] - tgtLab[0];
            deltaA = refLab[1] - tgtLab[1];
            deltaB = refLab[2] - tgtLab[2];
        } else {
            scaleR = refColor[0] / Math.max(1, tgtColor[0]);
            scaleG = refColor[1] / Math.max(1, tgtColor[1]);
            scaleB = refColor[2] / Math.max(1, tgtColor[2]);
        }

        for (let i = 0; i < len; i += 4) {
            const r = sourceData[i];
            const g = sourceData[i+1];
            const b = sourceData[i+2];
            const a = sourceData[i+3];

            let newR, newG, newB;

            if (method === 'lab') {
                const lab = ColorMath.rgbToLab(r, g, b);
                lab[0] += deltaL;
                lab[1] += deltaA;
                lab[2] += deltaB;
                const rgb = ColorMath.labToRgb(lab[0], lab[1], lab[2]);
                newR = rgb[0];
                newG = rgb[1];
                newB = rgb[2];
            } else {
                newR = r * scaleR;
                newG = g * scaleG;
                newB = b * scaleB;
            }

            // Blending
            newData[i] = r + (Math.min(255, Math.max(0, newR)) - r) * intens;
            newData[i+1] = g + (Math.min(255, Math.max(0, newG)) - g) * intens;
            newData[i+2] = b + (Math.min(255, Math.max(0, newB)) - b) * intens;
            newData[i+3] = a; // keep original alpha
        }

        self.postMessage({ result: newData }, [newData.buffer]);
    };
`;

const blob = new Blob([workerScript], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(blob);
let worker = null;

function processImage() {
    dom.loader.classList.remove('hidden');
    
    if (worker) { worker.terminate(); }
    worker = new Worker(workerUrl);
    
    worker.onmessage = (e) => {
        const newDataArray = e.data.result;
        state.tgt.currentData = new ImageData(newDataArray, dom.tgt.canvas.width, dom.tgt.canvas.height);
        dom.tgt.ctx.putImageData(state.tgt.currentData, 0, 0);
        
        dom.loader.classList.add('hidden');
        dom.downloadBtn.disabled = false;
    };
    
    // We must pass a copy of the original data to not detach the original buffer if we want to process again
    const dataCopy = new ImageData(
        new Uint8ClampedArray(state.tgt.originalData.data),
        state.tgt.originalData.width,
        state.tgt.originalData.height
    );

    worker.postMessage({
        originalData: dataCopy,
        refColor: state.ref.color,
        tgtColor: state.tgt.color,
        method: dom.method.value,
        intensity: parseInt(dom.intensity.value)
    });
}

// Download functionality
dom.downloadBtn.addEventListener('click', () => {
    if (dom.downloadBtn.disabled) return;
    
    const canvas = dom.tgt.canvas;
    const link = document.createElement('a');
    link.download = 'color_matched.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
});
