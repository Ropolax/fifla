// =====================
//  EAN13 GENERATOR
// =====================

function calculateEAN13Checksum(code) {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        const n = parseInt(code[i]);
        sum += (i % 2 === 0) ? n : n * 3;
    }
    return (10 - (sum % 10)) % 10;
}

// FULL ENCODING TABLE
const L = {
    "0":"0001101","1":"0011001","2":"0010011","3":"0111101",
    "4":"0100011","5":"0110001","6":"0101111","7":"0111011",
    "8":"0110111","9":"0001011"
};

const G = {
    "0":"0100111","1":"0110011","2":"0011011","3":"0100001",
    "4":"0011101","5":"0111001","6":"0000101","7":"0010001",
    "8":"0001001","9":"0010111"
};

const R = {
    "0":"1110010","1":"1100110","2":"1101100","3":"1000010",
    "4":"1011100","5":"1001110","6":"1010000","7":"1000100",
    "8":"1001000","9":"1110100"
};

// PATTERNS FOR FIRST DIGIT
const PARITY = {
    "0":"LLLLLL",
    "1":"LLGLGG",
    "2":"LLGGLG",
    "3":"LLGGGL",
    "4":"LGLLGG",
    "5":"LGGLLG",
    "6":"LGGGLL",
    "7":"LGLGLG",
    "8":"LGLGGL",
    "9":"LGGLGL"
};


// =====================
//  EAN13 → BITS
// =====================

function encodeEAN13(code12) {
    const first = code12[0];
    const left = code12.slice(1,7);
    const right = code12.slice(7);

    const parity = PARITY[first];
    let bits = "";

    // LEFT GUARD
    bits += "101";

    // LEFT SIDE
    for (let i = 0; i < 6; i++) {
        const digit = left[i];
        bits += (parity[i] === "L") ? L[digit] : G[digit];
    }

    // CENTER GUARD
    bits += "01010";

    // RIGHT SIDE
    for (let i = 0; i < 6; i++) {
        bits += R[right[i]];
    }

    // RIGHT GUARD
    bits += "101";

    return bits;
}



// =====================
//  DRAW BARCODE ON CANVAS
// =====================

async function drawEAN13OnCanvas(code, warrantyImg, canvas) {
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    const barWidth = 2;
    const barHeight = 90;     // <-- krótsze paski o 1/3 jak chciałeś
    const textHeight = 30;

    const bits = encodeEAN13(code);

    const widthBars = bits.length * barWidth;
    const height = barHeight + textHeight;

    // load warranty image
    const gwar = await loadImage(warrantyImg);

    // scaling warranty to same height
    const gwarScale = height / gwar.height;
    const gwarW = gwar.width * gwarScale;
    const gwarH = height;

    canvas.width = widthBars + gwarW;
    canvas.height = height;

    // background white
    ctx.fillStyle = "white";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // barcode text (full number)
    ctx.fillStyle = "black";
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(code, widthBars/2, 22);

    // draw bars
    let x = 0;
    for (let i = 0; i < bits.length; i++) {
        ctx.fillStyle = bits[i] === "1" ? "black" : "white";
        ctx.fillRect(x, textHeight, barWidth, barHeight);
        x += barWidth;
    }

    // draw warranty image
    ctx.drawImage(gwar, widthBars, 0, gwarW, gwarH);
}

function loadImage(src) {
    return new Promise((resolve,reject)=>{
        const img = new Image();
        img.onload = ()=>resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}


// =====================
//  CANVAS → BMP 1-BIT
// =====================

function canvasToBMP1(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const w = canvas.width;
    const h = canvas.height;

    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;

    const rowSize = Math.ceil(w / 32) * 4; // pad to 32 bits
    const pixelArraySize = rowSize * h;
    const fileSize = 62 + pixelArraySize;

    const buf = new ArrayBuffer(fileSize);
    const dv = new DataView(buf);

    // BMP HEADER
    dv.setUint8(0, 0x42);
    dv.setUint8(1, 0x4D);
    dv.setUint32(2, fileSize, true);
    dv.setUint32(6, 0, true);
    dv.setUint32(10, 62, true); // pixel data offset

    // DIB HEADER
    dv.setUint32(14, 40, true);
    dv.setUint32(18, w, true);
    dv.setUint32(22, h, true);
    dv.setUint16(26, 1, true);
    dv.setUint16(28, 1, true);   // 1-bit
    dv.setUint32(30, 0, true);
    dv.setUint32(34, pixelArraySize, true);
    dv.setUint32(38, 2835, true);
    dv.setUint32(42, 2835, true);
    dv.setUint32(46, 0, true);
    dv.setUint32(50, 0, true);

    // COLOR TABLE (1-bit)
    dv.setUint32(54, 0x00FFFFFF, true); // index 0 = white
    dv.setUint32(58, 0x00000000, true); // index 1 = black

    // PIXELS
    let p = 62;

    for (let y = h - 1; y >= 0; y--) {
        let byte = 0;
        let bit = 7;

        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const avg = (r + g + b) / 3;

            const val = avg < 200 ? 1 : 0; // BLACK if <200, else WHITE
            byte |= (val << bit);

            bit--;
            if (bit < 0) {
                dv.setUint8(p++, byte);
                byte = 0;
                bit = 7;
            }
        }

        if (bit !== 7) dv.setUint8(p++, byte);

        const rowUsed = Math.ceil(w / 8);
        const pad = rowSize - rowUsed;
        for (let i = 0; i < pad; i++) dv.setUint8(p++, 0);
    }

    return new Blob([buf], { type: "image/bmp" });
}



// =====================
//  MIRROR
// =====================

function mirrorCanvas(canvas) {
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width;
    tmp.height = canvas.height;

    const ctx = tmp.getContext("2d");
    ctx.scale(-1, 1);
    ctx.drawImage(canvas, -canvas.width, 0);

    return tmp;
}



// =====================
//  MAIN
// =====================

async function generuj() {
    const txt = document.getElementById("txt").value;
    const kod = document.getElementById("kod").value;
    const chk = document.getElementById("gwarancja").checked;

    if (kod.length !== 12) {
        alert("Kod EAN musi mieć 12 cyfr.");
        return;
    }

    const checksum = calculateEAN13Checksum(kod);
    const full = kod + checksum;

    const canvas = document.createElement("canvas");

    await drawEAN13OnCanvas(full, chk ? "assets/images/gwarancja.jpg" : "assets/images/blank.png", canvas);

    // NORMAL BMP
    const bmpNormal = canvasToBMP1(canvas);
    document.getElementById("normal").src = URL.createObjectURL(bmpNormal);

    // MIRROR BMP
    const mirror = mirrorCanvas(canvas);
    const bmpMirror = canvasToBMP1(mirror);
    document.getElementById("lustro").src = URL.createObjectURL(bmpMirror);

    // DOWNLOADS
    const dlBtn = document.querySelector(".output button");
    dlBtn.onclick = () => {
        const a = document.createElement("a");
        a.download = "output-normal.bmp";
        a.href = URL.createObjectURL(bmpNormal);
        a.click();

        const a2 = document.createElement("a");
        a2.download = "output-lustro.bmp";
        a2.href = URL.createObjectURL(bmpMirror);
        a2.click();
    };
}
