const ColorMath = {
    // RGB [0..255] to XYZ
    rgbToXyz(r, g, b) {
        let r1 = r / 255;
        let g1 = g / 255;
        let b1 = b / 255;

        r1 = r1 > 0.04045 ? Math.pow((r1 + 0.055) / 1.055, 2.4) : r1 / 12.92;
        g1 = g1 > 0.04045 ? Math.pow((g1 + 0.055) / 1.055, 2.4) : g1 / 12.92;
        b1 = b1 > 0.04045 ? Math.pow((b1 + 0.055) / 1.055, 2.4) : b1 / 12.92;

        r1 *= 100;
        g1 *= 100;
        b1 *= 100;

        const x = r1 * 0.4124 + g1 * 0.3576 + b1 * 0.1805;
        const y = r1 * 0.2126 + g1 * 0.7152 + b1 * 0.0722;
        const z = r1 * 0.0193 + g1 * 0.1192 + b1 * 0.9505;

        return [x, y, z];
    },

    // XYZ to LAB (D65 illuminant)
    xyzToLab(x, y, z) {
        let x1 = x / 95.047;
        let y1 = y / 100.000;
        let z1 = z / 108.883;

        x1 = x1 > 0.008856 ? Math.pow(x1, 1 / 3) : (7.787 * x1) + (16 / 116);
        y1 = y1 > 0.008856 ? Math.pow(y1, 1 / 3) : (7.787 * y1) + (16 / 116);
        z1 = z1 > 0.008856 ? Math.pow(z1, 1 / 3) : (7.787 * z1) + (16 / 116);

        const l = (116 * y1) - 16;
        const a = 500 * (x1 - y1);
        const b = 200 * (y1 - z1);

        return [l, a, b];
    },

    rgbToLab(r, g, b) {
        const [x, y, z] = this.rgbToXyz(r, g, b);
        return this.xyzToLab(x, y, z);
    },

    // LAB to XYZ
    labToXyz(l, a, b) {
        let y = (l + 16) / 116;
        let x = a / 500 + y;
        let z = y - b / 200;

        let y3 = Math.pow(y, 3);
        let x3 = Math.pow(x, 3);
        let z3 = Math.pow(z, 3);

        y = y3 > 0.008856 ? y3 : (y - 16 / 116) / 7.787;
        x = x3 > 0.008856 ? x3 : (x - 16 / 116) / 7.787;
        z = z3 > 0.008856 ? z3 : (z - 16 / 116) / 7.787;

        x *= 95.047;
        y *= 100.000;
        z *= 108.883;

        return [x, y, z];
    },

    // XYZ to RGB
    xyzToRgb(x, y, z) {
        let x1 = x / 100;
        let y1 = y / 100;
        let z1 = z / 100;

        let r = x1 * 3.2406 + y1 * -1.5372 + z1 * -0.4986;
        let g = x1 * -0.9689 + y1 * 1.8758 + z1 * 0.0415;
        let b = x1 * 0.0557 + y1 * -0.2040 + z1 * 1.0570;

        r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
        g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
        b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;

        return [
            Math.max(0, Math.min(255, Math.round(r * 255))),
            Math.max(0, Math.min(255, Math.round(g * 255))),
            Math.max(0, Math.min(255, Math.round(b * 255)))
        ];
    },

    labToRgb(l, a, b) {
        const [x, y, z] = this.labToXyz(l, a, b);
        return this.xyzToRgb(x, y, z);
    }
};

// Export as a string for Web Worker if needed
const ColorMathString = `const ColorMath = ${JSON.stringify(ColorMath, function(key, val) {
    if (typeof val === 'function') return val.toString();
    return val;
})};
// Hack to parse functions back
Object.keys(ColorMath).forEach(key => {
    if (typeof ColorMath[key] === 'string' && ColorMath[key].includes('(')) {
        ColorMath[key] = new Function('return ' + ColorMath[key])();
    }
});
`;
