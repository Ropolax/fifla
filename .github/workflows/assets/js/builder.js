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

// tablica pierwszej cyfry
const PARITY = {
    "0": "LLLLLL", "1": "LLGLGG", "2": "LLGGLG", "3": "LLGGGL",
    "4": "LGLLGG", "5": "LGGLLG", "6": "LGGGLL",
    "7": "LGLGLG", "8": "LGLGGL", "9": "LGGLGL"
};

// -----------------------------------------------
//  Obliczanie cyfry kontrolnej EAN13
// -----------------------------------------------
function checkDigit(num12) {
    const digits = num12.split("").map(x => +x);
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += digits[i] * (i % 2 === 0 ? 1 : 3);
    }
    return (10 - (sum % 10)) % 10;
}

// -----------------------------------------------
//  Generowanie bitów kodu EAN13
// -----------------------------------------------
function generateEAN13(num12) {
    const d = num12.split("");
    const cd = checkDigit(num12);
    const first = d[0];
    const parity = PARITY[first];

    let bits = "101"; // start

    // 6 cyfr lewa strona
    for (let i = 1; i <= 6; i++) {
        const set = parity[i - 1];
        const digit = d[i];
        bits += (set === "L" ? L[digit] : G[digit]);
    }

    bits += "01010"; // middle

    // prawa strona (R)
    for (let i = 7; i <= 12; i++) {
        bits += R[d[i]];
    }
    bits += R[cd];

    bits += "101"; // end
    return { bits: bits, fullNumber: num12 + cd };
}

// -----------------------------------------------
//  Tworzenie obrazu Canvas
// -----------------------------------------------
async function buildImage() {
    const text = document.getElementById("txt").value;
    const input = document.getElementById("kod").value.trim();
    const addG = document.getElementById("gwarancja").checked;

    if (input.length !== 12) {
        alert("Kod EAN musi mieć dokładnie 12 cyfr!");
        return;
    }

    // generacja bitów
    const ean = generateEAN13(input);
    const bits = ean.bits;

    // szerokość pojedynczej kreski
    const barW = 2;
    const barH = 100;

    // czcionka
    const fontSize = 22;

    // ładowanie obrazka gwarancji
    let gwar = null;
    if (addG) {
        gwar = await loadImg("assets/images/gwarancja.jpg");
    }

    // canvas szerokość
    const eanWidth = bits.length * barW;
    const textPad = 10;
    const textH = fontSize + textPad;

    let gwarWidth = addG ? gwar.width : 0;
    let gwarHeight = addG ? gwar.height : 0;

    // dopasowanie gwarancji do wysokości całości
    const totalH = textH + barH;
    if (addG) {
        const scale = totalH / gwar.height;
        gwarWidth = Math.floor(gwar.width * scale);
        gwarHeight = totalH;
    }

    const totalW = eanWidth + (addG ? gwarWidth : 0);

    const cv = document.createElement("canvas");
    cv.width = totalW;
    cv.height = totalH;
    const ctx = cv.getContext("2d");

    // białe tło
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, cv.width, cv.height);

    // tekst
    ctx.fillStyle = "black";
    ctx.font = fontSize + "px Arial";
    const tw = ctx.measureText(text).width;
    ctx.fillText(text, (eanWidth - tw) / 2, fontSize);

    // kod kreskowy
    let x = 0;
    for (let b of bits) {
        ctx.fillStyle = b === "1" ? "black" : "white";
        ctx.fillRect(x, textH, barW, barH);
        x += barW;
    }

    // doklejenie gwarancji
    if (addG) {
        ctx.drawImage(gwar, eanWidth, 0, gwarWidth, gwarHeight);
    }

    // konwersja do BMP 1-bit
    const bmpNormal = canvasToBMP1(cv);

    // lustrzane odbicie
    const bmpMirror = mirrorBMP1(bmpNormal);

    // podgląd
    document.getElementById("normal").src = URL.createObjectURL(bmpNormal);
    document.getElementById("lustro").src = URL.createObjectURL(bmpMirror);

    // linki
    document.getElementById("dlNormal").href = URL.createObjectURL(bmpNormal);
    document.getElementById("dlLustro").href = URL.createObjectURL(bmpMirror);
}

// -----------------------------------------------
//  Ładowanie obrazka
// -----------------------------------------------
function loadImg(src) {
    return new Promise(res => {
        const img = new Image();
        img.onload = () => res(img);
        img.src = src;
    });
}

// -----------------------------------------------
//  Canvas → BMP 1-bit (bit-packed)
// -----------------------------------------------
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

    // --- FILE HEADER ---
    dv.setUint8(p, 0x42); p++;
    dv.setUint8(p, 0x4D); p++;

    dv.setUint32(p, fileSize, true); p += 4;
    dv.setUint32(p, 0, true); p += 4;
    dv.setUint32(p, headerSize, true); p += 4;

    // --- INFO HEADER ---
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

    // paleta (czarny, biały)
    dv.setUint32(p, 0x00000000, true); p += 4;
    dv.setUint32(p, 0x00FFFFFF, true); p += 4;

    // --- PIXELS ---
    let offset = p;

    for (let y = 0; y < h; y++) {
        let bitPos = 7;
        let byte = 0;
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const r = data[idx];
            const v = r < 128 ? 1 : 0;
            byte |= v << bitPos;
            bitPos--;
            if (bitPos < 0) {
                dv.setUint8(offset++, byte);
                byte = 0;
                bitPos = 7;
            }
        }
        if (bitPos !== 7) {
            dv.setUint8(offset++, byte);
        }
        while ((offset - p) % rowBytes !== 0) {
            dv.setUint8(offset++, 0);
        }
    }

    return new Blob([buf], { type: "image/bmp" });
}

// -----------------------------------------------
//  Lustro w poziomie BMP 1-bit
// -----------------------------------------------
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

            const img = new Uint8Array(buf, offset);

            const out = new Uint8Array(img.length);

            for (let y = 0; y < h; y++) {
                const rowStart = y * rowBytes;
                for (let byte = 0; byte < rowBytes; byte++) {
                    const b = img[rowStart + byte];
                    let rb = 0;
                    for (let i = 0; i < 8; i++) {
                        rb |= ((b >> i) & 1) << (7 - i);
                    }
                    out[rowStart + (rowBytes - 1 - byte)] = rb;
                }
            }

            const full = new Uint8Array(buf);
            full.set(out, offset);

            res(new Blob([full], { type: "image/bmp" }));
        };
        fr.readAsArrayBuffer(blob);
    });
}

// -----------------------------------------------
document.getElementById("genBtn").addEventListener("click", e => {
    e.preventDefault();
    buildImage();
});
