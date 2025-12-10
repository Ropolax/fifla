<?php
// ===========================
// index.php
// ===========================
$error = "";
$normalSrc = "";
$mirrorSrc = "";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $txt = $_POST['txt'] ?? "";
    $kod12 = $_POST['kod'] ?? "";
    $addWarranty = isset($_POST['gwarancja']);

    if (strlen($kod12) != 12 || !ctype_digit($kod12)) {
        $error = "Kod EAN musi mieć 12 cyfr!";
    } else {

        // ---------------------------
        // EAN13 checksum
        // ---------------------------
        function checksum($code12)
        {
            $sum = 0;
            for ($i = 0; $i < 12; $i++) {
                $d = intval($code12[$i]);
                $sum += ($i % 2 === 0) ? $d : $d * 3;
            }
            return (10 - ($sum % 10)) % 10;
        }

        $chk = checksum($kod12);
        $full = $kod12 . $chk;

        // ---------------------------
        // EAN13 encoding tables
        // ---------------------------
        $L = ["0" => "0001101", "1" => "0011001", "2" => "0010011", "3" => "0111101", "4" => "0100011", "5" => "0110001", "6" => "0101111", "7" => "0111011", "8" => "0110111", "9" => "0001011"];
        $G = ["0" => "0100111", "1" => "0110011", "2" => "0011011", "3" => "0100001", "4" => "0011101", "5" => "0111001", "6" => "0000101", "7" => "0010001", "8" => "0001001", "9" => "0010111"];
        $R = ["0" => "1110010", "1" => "1100110", "2" => "1101100", "3" => "1000010", "4" => "1011100", "5" => "1001110", "6" => "1010000", "7" => "1000100", "8" => "1001000", "9" => "1110100"];
        $PARITY = ["0" => "LLLLLL", "1" => "LLGLGG", "2" => "LLGGLG", "3" => "LLGGGL", "4" => "LGLLGG", "5" => "LGGLLG", "6" => "LGGGLL", "7" => "LGLGLG", "8" => "LGLGGL", "9" => "LGGLGL"];

        // ---------------------------
        // encode bits
        // ---------------------------
        $f = $full[0];
        $left = substr($full, 1, 6);
        $right = substr($full, 7);
        $pat = $PARITY[$f];

        $bits = "101"; // left guard
        for ($i = 0; $i < 6; $i++) {
            $d = $left[$i];
            $bits .= ($pat[$i] == "L") ? $L[$d] : $G[$d];
        }
        $bits .= "01010"; // center
        for ($i = 0; $i < 6; $i++) {
            $bits .= $R[$right[$i]];
        }
        $bits .= "101"; // right guard

        // ---------------------------
        // IMAGE parameters
        // ---------------------------
        $barW = 2;
        $barH = 90;
        $textH = 30;
        $barsWidth = strlen($bits) * $barW;

        // warranty image
        if ($addWarranty && file_exists("assets/images/gwarancja.jpg")) {
            $gw = imagecreatefromjpeg("assets/images/gwarancja.jpg");
        } else {
            $gw = imagecreatetruecolor(1, 1);
            imagesetpixel($gw, 0, 0, 0xFFFFFF);
        }

        $gwW = imagesx($gw);
        $gwH = imagesy($gw);
        $scale = ($barH + $textH) / $gwH;
        $newGW = imagescale($gw, $gwW*$scale, $barH+$textH, 1);

        $imgW = $barsWidth + imagesx($newGW);
        $imgH = $barH + $textH;

        $img = imagecreate($imgW, $imgH);
        $white = imagecolorallocate($img, 255, 255, 255);
        $black = imagecolorallocate($img, 0, 0, 0);
        imagefilledrectangle($img, 0, 0, $imgW, $imgH, $white);

        // ---------------------------
        // TEXT
        // ---------------------------
        $fontPath = "assets/fonts/arial.ttf";
        if (!file_exists($fontPath)) $fontPath = null; // fallback
        $fontSize = 16;
        $textX = $barsWidth / 2;
        $textY = 22;
        if ($fontPath) {
            imagettftext($img, $fontSize, 0, $textX, $textY, $black, $fontPath, $full);
        } else {
            imagestring($img, 5, $textX - 30, $textY - 16, $full, $black);
        }

        // ---------------------------
        // BARS
        // ---------------------------
        $x = 0;
        for ($i = 0; $i < strlen($bits); $i++) {
            if ($bits[$i] == "1") {
                imagefilledrectangle($img, $x, $textH, $x + $barW - 1, $barH + $textH, $black);
            }
            $x += $barW;
        }

        // ---------------------------
        // WARRANTY
        // ---------------------------
        imagecopy($img, $newGW, $barsWidth, 0, 0, 0, imagesx($newGW), imagesy($newGW));

        // ---------------------------
        // SAVE NORMAL & MIRROR BMP
        // ---------------------------
        if (!file_exists("output")) mkdir("output");
        $normalFile = "output/output-normal.bmp";
        $mirrorFile = "output/output-lustro.bmp";

        // NORMAL
        imagebmp($img, $normalFile, false, 1);

        // MIRROR
        $mirrorImg = imagecreatetruecolor($imgW, $imgH);
        imagecopyresampled($mirrorImg, $img, 0, 0, $imgW - 1, 0, -$imgW, $imgH, $imgW, $imgH);
        imagebmp($mirrorImg, $mirrorFile, false, 1);

        imagedestroy($img);
        imagedestroy($mirrorImg);
        imagedestroy($gw);
        imagedestroy($newGW);

        $normalSrc = $normalFile . "?" . time();
        $mirrorSrc = $mirrorFile . "?" . time();
    }
}

?>
<!DOCTYPE html>
<html lang="pl-PL">

<head>
    <meta charset="UTF-8">
    <title>Generator kodów EAN13</title>
    <link rel="stylesheet" href="assets/css/style.css">
</head>

<body>
    <header>
        <h1>Generator kodów</h1>
    </header>
    <section class="input">
        <fieldset>
            <legend>Barcode Generator</legend>
            <form method="POST" action="">
                <label>Wprowadź tekst: <input type="text" name="txt" value="<?= htmlspecialchars($txt ?? "") ?>"></label><br>
                <label>Wprowadź kod EAN13 (12 cyfr): <input type="text" name="kod" value="<?= htmlspecialchars($kod12 ?? "") ?>"></label><br>
                <label><input type="checkbox" name="gwarancja" <?= $addWarranty ?? '' ? 'checked' : '' ?>> Dodaj gwarancję</label><br>
                <button type="submit">Generuj</button>
            </form>
            <?php if ($error) echo "<p style='color:red;'>$error</p>"; ?>
        </fieldset>
    </section>

    <?php if ($normalSrc && $mirrorSrc): ?>
        <section class="output">
            <img src="<?= $normalSrc ?>" alt="normal" id="normal">
            <img src="<?= $mirrorSrc ?>" alt="lustro" id="lustro"><br>
            <a href="<?= $normalSrc ?>" download="output-normal.bmp"><button>Pobierz Normal</button></a>
            <a href="<?= $mirrorSrc ?>" download="output-lustro.bmp"><button>Pobierz Lustro</button></a>
        </section>
    <?php endif; ?>
</body>

</html>