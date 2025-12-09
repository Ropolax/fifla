// -----------------------------------------------
//  EAN13 – tablice kodowania
// -----------------------------------------------
const L = {
    "0": "0001101", "1": "0011001", "2": "0010011",
    "3": "0111101", "4": "0100011", "5": "0110001",
    "6": "0101111", "7": "0111011", "8": "0110111",
    "9": "0001011"
};
const G = {
    "0": "0100111", "1": "0110011", "2": "0011011",
    "3": "0100001", "4": "0011101", "5": "0111001",
    "6": "0000101", "7": "0010001", "8": "0001001",
    "9": "0010111"
};
const R = {
    "0": "1110010", "1": "1100110", "2": "1101100",
    "3": "1000010", "4": "1011100", "5": "1001110",
    "6": "1010000", "7": "1000100", "8": "1001000",
    "9": "1110100"
};

const PARITY = {
    "0": "LLLLLL", "1": "LLGLGG", "2": "LLGGLG", "3": "LLGGGL",
    "4": "LGLLGG", "5": "LGGLLG", "6": "LGGGLL",
    "7": "LGLGLG", "8": "LGLGGL", "9": "LGGLGL"
};

// -----------------------------------------------
//  cyfra kontrolna
// -----------------------------------------------
function checkDigit(num12) {
    const d = num12.split("").map(x => +x);
    let sum = 0;
    for (let i = 0; i < 12; i++)
        sum += d[i] * (i % 2 === 0 ? 1 : 3);
    return (10 - (sum % 10)) % 10;
}

// -----------------------------------------------
//  generuj bity EAN13 + pełny numer
// -----------------------------------------------
function generateEAN13(num12) {
    const d = num12.split("");
    const cd = checkDigit(num12);
    const first = d[0];
    const parity = PARITY[first];

    let bits = "101";

    for (let i = 1; i <= 6; i++) {
        const set = parity[i - 1];
        const digit = d[i];
        bits += (set === "L" ? L[digit] : G[digit]);
    }

    bits += "01010";

    for (let i = 7; i <= 12; i++) bits += R[d[i]];
    bits += R[cd];

    bits += "101";

    return { bits: bits, full: d.join("") + cd };
}

// -------------------------------------------------------
//  wczytanie obrazka
// -------------------------------------------------------
function loadImg(src) {
    return new Promise(res => {
        const img = new Image();
        img.onload = () => res(img);
        img.src = src;
    });
}

// -------------------------------------------------------
//  główna funkcja
// -------------------------------------------------------
async function buildImage() {
    const text = document.getElementById("txt").value;
    const input = document.getElementById("kod").value.trim();
    const addG = document.getElementById("gwarancja").checked;

    if (input.length !== 12) {
        alert("Kod EAN musi mieć 12 cyfr.");
        return;
    }

    const ean = generateEAN13(input);
    const bits = ean.bits;
    const fullNumber = ean.full;

    const barW = 2;
    const barH = 70;          // krótsze o ~1/3
    const textH = 24;
    const numberH = 20;

    let gwar = null;
    if (addG) gwar = await loadImg("assets/images/gwarancja.jpg");

    const eanWidth = bits.length * barW;
    const totalH = textH + barH + numberH;

    let gwarWidth = 0, gwarHeight = 0;

    if (addG) {
        const scale = totalH / gwar.height;
        gwarWidth = gwar.width * scale;
        gwarHeight = totalH;
    }

    const cv = document.createElement("canvas");
    cv.width = eanWidth + gwarWidth;
    cv.height = totalH;

    const ctx = cv.getContext("2d");

    // BIAŁE TŁO
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, cv.width, cv.height);

    // Tekst u góry
    ctx.fillStyle = "black";
    ctx.font = "20px Arial";
    const tw = ctx.measureText(text).width;
    ctx.fillText(text, (eanWidth - tw) / 2, 20);

    // Rysowanie pasków
    let x = 0;
    for (let b of bits) {
        ctx.fillStyle = b === "1" ? "black" : "white";
        ctx.fillRect(x, textH, barW, barH);
        x += barW;
    }

    // Cyfry pod kodem
    ctx.font = "18px Arial";
    const fw = ctx.measureText(fullNumber).width;
    ctx.fillText(fullNumber, (eanWidth - fw) / 2, textH + barH + 16);

    // Doklej gwarancję
    if (addG) ctx.drawImage(gwar, eanWidth, 0, gwarWidth, gwarHeight);

    // BMP normalny
    const bmpNormal = canvasToBMP1(cv);

    // lustro
    const bmpMirror = await mirrorBMP1(bmpNormal);

    document.getElementById("normal").src = URL.createObjectURL(bmpNormal);
    document.getElementById("lustro").src = URL.createObjectURL(bmpMirror);

    document.getElementById("dlNormal").href = URL.createObjectURL(bmpNormal);
    document.getElementById("dlLustro").href = URL.createObjectURL(bmpMirror);
}

// -------------------------------------------------------
//  Canvas → BMP 1-bit (CZARNY = 1, BIAŁY = 0)
// -------------------------------------------------------
function canvasToBMP1(canvas) {
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext("2d");
    const data = ctx.getImageData(0, 0, w, h).data;

    const rowBytes = Math.ceil(w / 32) * 4;
    const pixelArraySize = rowBytes * h;

    const headerSize = 14 + 40 + 8;
    const fileSize = headerSize + pixelArraySize;

    const buf = new ArrayBuffer(fileSize);
    const dv = new DataView(buf);

    let p = 0;

    // FILE HEADER
    dv.setUint8(p++, 0x42);
    dv.setUint8(p++, 0x4D);
    dv.setUint32(p, fileSize, true); p += 4;
    dv.setUint32(p, 0, true); p += 4;
    dv.setUint32(p, headerSize, true); p += 4;

    // DIB HEADER
    dv.setUint32(p, 40, true); p += 4;
    dv.setInt32(p, w, true); p += 4;
    dv.setInt32(p, -h, true); p += 4;
    dv.setUint16(p, 1, true); p += 2;
    dv.setUint16(p, 1, true); p += 2;

    dv.setUint32(p, 0, true); p += 4;
    dv.setUint32(p, pixelArraySize, true); p += 4;

    dv.setInt32(p, 2835, true); p += 4;
    dv.setInt32(p, 2835, true); p += 4;

    dv.setUint32(p, 2, true); p += 4;
    dv.setUint32(p, 2, true); p += 4;

    // PALETA – poprawiona:
    dv.setUint32(p, 0x00FFFFFF, true); p += 4; // kolor 0 = biały
    dv.setUint32(p, 0x00000000, true); p += 4; // kolor 1 = czarny

    let offset = p;

    for (let y = 0; y < h; y++) {
        let byte = 0, bitPos = 7;

        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const val = data[idx] < 128 ? 1 : 0; // czarny = 1
            byte |= val << bitPos;
            bitPos--;

            if (bitPos < 0) {
                dv.setUint8(offset++, byte);
                byte = 0;
                bitPos = 7;
            }
        }

        if (bitPos !== 7) dv.setUint8(offset++, byte);

        while ((offset - p) % rowBytes !== 0) dv.setUint8(offset++, 0);
    }

    return new Blob([buf], { type: "image/bmp" });
}

// -------------------------------------------------------
//  lustrzane odbicie 1-bit BMP
// -------------------------------------------------------
function mirrorBMP1(blob) {
    return new Promise(res => {
        const fr = new FileReader();
        fr.onload = () => {
            const buf = fr.result;
            const dv = new DataView(buf);

            const offset = dv.getUint32(10, true);
            const w = dv.getInt32(18, true);
            const h = Math.abs(dv.getInt32(22, true));

            const rowBytes = Math.ceil(w / 32) * 4;

            const src = new Uint8Array(buf, offset);
            const out = new Uint8Array(src.length);

            for (let y = 0; y < h; y++) {
                const base = y * rowBytes;
                for (let b = 0; b < rowBytes; b++) {
                    const val = src[base + b];
                    let rev = 0;
                    for (let i = 0; i < 8; i++)
                        rev |= ((val >> i) & 1) << (7 - i);
                    out[base + (rowBytes - 1 - b)] = rev;
                }
            }

            const full = new Uint8Array(buf);
            full.set(out, offset);

            res(new Blob([full], { type: "image/bmp" }));
        };
        fr.readAsArrayBuffer(blob);
    });
}

document.getElementById("genBtn").addEventListener("click", e => {
    e.preventDefault();
    buildImage();
});
