<?php
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

        // ======================
        // EAN13 checksum
        // ======================
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

        // ======================
        // EAN13 tables
        // ======================
        $L = ["0" => "0001101", "1" => "0011001", "2" => "0010011", "3" => "0111101", "4" => "0100011", "5" => "0110001", "6" => "0101111", "7" => "0111011", "8" => "0110111", "9" => "0001011"];
        $G = ["0" => "0100111", "1" => "0110011", "2" => "0011011", "3" => "0100001", "4" => "0011101", "5" => "0111001", "6" => "0000101", "7" => "0010001", "8" => "0001001", "9" => "0010111"];
        $R = ["0" => "1110010", "1" => "1100110", "2" => "1101100", "3" => "1000010", "4" => "1011100", "5" => "1001110", "6" => "1010000", "7" => "1000100", "8" => "1001000", "9" => "1110100"];
        $PARITY = ["0" => "LLLLLL", "1" => "LLGLGG", "2" => "LLGGLG", "3" => "LLGGGL", "4" => "LGLLGG", "5" => "LGGLLG", "6" => "LGGGLL", "7" => "LGLGLG", "8" => "LGLGGL", "9" => "LGGLGL"];

        // ======================
        // Encode bits
        // ======================
        $f = $full[0];
        $left = substr($full, 1, 6);
        $right = substr($full, 7);
        $pat = $PARITY[$f];

        $bits = "101"; // left guard
        for ($i = 0; $i < 6; $i++) {
            $d = $left[$i];
            $bits .= ($pat[$i] == "L") ? $L[$d] : $G[$d];
        }
        $bits .= "01010"; // center guard
        for ($i = 0; $i < 6; $i++) {
            $bits .= $R[$right[$i]];
        }
        $bits .= "101"; // right guard

        // ======================
        // IMAGE parameters
        // ======================
        $barW = 2;
        $barH = 40; // standardowa wysokość pasków
        $digitH = 20; // miejsce dla cyfr
        $marginTop = 20; // miejsce dla tekstu nad paskami
        $barsWidth = strlen($bits) * $barW;
        $leftMargin = 15 * $barW; // miejsce na pierwszą cyfrę

        // Gwarancja
        if ($addWarranty && file_exists("assets/images/gwarancja.jpg")) {
            $gw = imagecreatefromjpeg("assets/images/gwarancja.jpg");
        } else {
            $gw = imagecreatetruecolor(1, 1);
            $white = imagecolorallocate($gw, 255, 255, 255);
            imagefilledrectangle($gw, 0, 0, 0, 0, $white);
        }
        $gwW = imagesx($gw);
        $gwH = imagesy($gw);
        $scale = ($barH + $digitH + $marginTop) / $gwH;
        $newGW = imagescale($gw, $gwW * $scale, $barH + $digitH + $marginTop);

        $imgW = $barsWidth + imagesx($newGW) + $leftMargin;
        $imgH = $barH + $digitH + $marginTop;

        $img = imagecreate($imgW, $imgH);
        $white = imagecolorallocate($img, 255, 255, 255);
        $black = imagecolorallocate($img, 0, 0, 0);
        imagefilledrectangle($img, 0, 0, $imgW, $imgH, $white);

        // ======================
        // TEXT above bars (centered)
        // ======================
        $fontPath = "assets/fonts/arial.ttf";
        $fontSize = 16;
        if ($txt) {
            if (file_exists($fontPath)) {
                $bbox = imagettfbbox($fontSize, 0, $fontPath, $txt);
                $textWidth = $bbox[2] - $bbox[0];
                $textX = ($barsWidth / 2) - ($textWidth / 2) + $leftMargin;
                $textY = 16; // od góry
                imagettftext($img, $fontSize, 0, $textX, $textY, $black, $fontPath, $txt);
            } else {
                imagestring($img, 5, 10, 2, $txt, $black);
            }
        }

        // ======================
        // DRAW BARS (guard bars higher)
        // ======================
        $guardH = $barH + $digitH;
        $x = $leftMargin;
        for ($i = 0; $i < strlen($bits); $i++) {
            if (($i < 3) || ($i >= 45 && $i < 50) || ($i >= 92 && $i < 95)) {
                $h = $guardH; // guard bars
            } else {
                $h = $barH;
            }
            if ($bits[$i] == "1") {
                imagefilledrectangle($img, $x, $marginTop, $x + $barW - 1, $marginTop + $h, $black);
            }
            $x += $barW;
        }

        // ======================
        // DRAW DIGITS
        // ======================
        $fontSize = 14;
        if (file_exists($fontPath)) {
            // first digit (po lewej, przed paskami)
            imagettftext($img, $fontSize, 0, 0, $marginTop + $barH + $digitH, $black, $fontPath, $full[0]);

            // left 6 digits
            $leftX = $leftMargin + 3 * $barW; // po guard bars
            for ($i = 0; $i < 6; $i++) {
                $dx = $leftX + $i * 7 * $barW; // szerokość cyfry ~7 pasków
                imagettftext($img, $fontSize, 0, $dx, $marginTop + $barH + $digitH, $black, $fontPath, $full[$i + 1]);
            }

            // right 6 digits
            $rightX = $leftMargin + 50 * $barW; // po center guard
            for ($i = 0; $i < 6; $i++) {
                $dx = $rightX + $i * 7 * $barW;
                imagettftext($img, $fontSize, 0, $dx, $marginTop + $barH + $digitH, $black, $fontPath, $full[$i + 7]);
            }
        }

        // ======================
        // WARRANTY
        // ======================
        imagecopy($img, $newGW, $barsWidth + $leftMargin, 0, 0, 0, imagesx($newGW), imagesy($newGW));

        // ======================
        // SAVE NORMAL & MIRROR BMP
        // ======================
        if (!file_exists("output")) mkdir("output");
        $normalFile = "output/output-normal.bmp";
        $mirrorFile = "output/output-lustro.bmp";

        imagebmp($img, $normalFile, false);

        $mirrorImg = imagescale($img, $imgW, $imgH);
        imageflip($mirrorImg, IMG_FLIP_HORIZONTAL);
        imagebmp($mirrorImg, $mirrorFile, false);

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
                <label>Wprowadź tekst: <input type="text" maxlength="16" name="txt" value="<?= htmlspecialchars($txt ?? "") ?>"></label><br>
                <label>Wprowadź kod EAN13 (12 cyfr): <input type="number" minlength="12" maxlength="12" name="kod" value="<?= htmlspecialchars($kod12 ?? "") ?>"></label><br>
                <label><input type="checkbox" name="gwarancja" <?= $addWarranty ?? '' ? 'checked' : '' ?>> Dodaj gwarancję</label><br>
                <button type="submit">Generuj</button>
            </form>
            <?php if ($error) echo "<p style='color:red;'>$error</p>"; ?>
        </fieldset>
    </section>

    <?php if ($normalSrc && $mirrorSrc): ?>
        <section class="output">
            <div class="preview">
                <img src="<?= $normalSrc ?>" alt="normal">
                <div class="buttons">
                    <a href="<?= $normalSrc ?>" download="output-normal.bmp"><button>Pobierz Normal</button></a>
                </div>
            </div>
            <div class="preview">
                <img src="<?= $mirrorSrc ?>" alt="lustro">
                <div class="buttons">
                    <a href="<?= $mirrorSrc ?>" download="output-lustro.bmp"><button>Pobierz Lustro</button></a>
                </div>
            </div>
        </section>
    <?php endif; ?>
</body>

</html>