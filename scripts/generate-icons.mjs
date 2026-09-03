// Génère les icônes PWA/favicon de l'app depuis l'asset de charte Strat'Edge.
//
// SYMBOL_SOURCE (logo-icon.png, 291×294, cheval seul) — favicon, apple-icon, icônes manifest.
// Le SVG du même symbole (logo-seul.svg, aujourd'hui remplacé) contenait 12 images raster
// embarquées sous filtres/masques et n'était pas exploitable tel quel (cf. Dev Notes Story 1.3).
// Renommé depuis Strat'Edge.png (retour manuel Guillaume, en-tête recolorié) — même fichier
// que public/brand/logo-icon.png, utilisé directement par components/header.tsx.
//
// L'ancien HORIZONTAL_SOURCE (cheval + wordmark + slogan incrustés dans l'image, généré vers
// public/brand/logo-horizontal.png) est retiré : le Header compose désormais l'icône et le nom
// "Strat'Edge" séparément (vrai texte HTML, cf. components/header.tsx/.module.css) — il n'y a
// plus besoin d'un lockup horizontal pré-rendu.
//
// Regénérer avec ce script si Strat'Edge/Branding/Logos/logo-icon.png change.
// Usage : node scripts/generate-icons.mjs

import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const SYMBOL_SOURCE = "Strat'Edge/Branding/Logos/logo-icon.png";
// colors.header-bg — fond plein pour la zone de sécurité maskable. DOIT rester synchronisé
// avec --color-header-bg dans app/globals.css (pas de lien automatique, script Node autonome
// sans accès aux custom properties CSS) — si la couleur de marque change, mettre à jour les
// deux à la main.
const HEADER_BG = "#0F2A44";

async function ensureDir(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function writeResized(dest, size) {
  await ensureDir(dest);
  await sharp(SYMBOL_SOURCE)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(dest);
  console.log(`✓ ${dest} (${size}x${size})`);
}

async function writeMaskable(dest, size) {
  await ensureDir(dest);
  const symbolSize = Math.round(size * 0.65); // ~65% du canvas, zone de sécurité maskable
  const symbol = await sharp(SYMBOL_SOURCE)
    .resize(symbolSize, symbolSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: HEADER_BG,
    },
  })
    .composite([{ input: symbol, gravity: "center" }])
    .png()
    .toFile(dest);
  console.log(`✓ ${dest} (${size}x${size}, maskable, fond ${HEADER_BG})`);
}

async function writeFavicon() {
  const sizes = [16, 32, 48];
  const buffers = await Promise.all(
    sizes.map((size) =>
      sharp(SYMBOL_SOURCE)
        .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    )
  );
  const ico = await pngToIco(buffers);
  await ensureDir("app/favicon.ico");
  const { writeFile } = await import("node:fs/promises");
  await writeFile("app/favicon.ico", ico);
  console.log("✓ app/favicon.ico (16/32/48)");
}

async function main() {
  await writeFavicon();
  await writeResized("app/apple-icon.png", 180);
  await writeResized("public/icons/icon-192.png", 192);
  await writeResized("public/icons/icon-512.png", 512);
  await writeMaskable("public/icons/icon-512-maskable.png", 512);

  // Copie directe vers public/brand/ — source du Header (components/header.tsx).
  await ensureDir("public/brand/logo-icon.png");
  await sharp(SYMBOL_SOURCE).png().toFile("public/brand/logo-icon.png");
  console.log("✓ public/brand/logo-icon.png (source Header)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
