// scripts/build-icons.mjs — génère toutes les icônes de l'app depuis une image maître.
//
//   npm run build:icons
//
// Source : assets/tpg-go-icon.png (squircle orange sur fond blanc, non détouré).
// Le script :
//   1. repère le squircle et ajuste son contour (superellipse) ;
//   2. modélise le dégradé de fond (polynôme de degré 3 par canal), ce qui permet de
//      prolonger le fond au-delà du squircle pour les variantes pleine surface ;
//   3. rend chaque taille par sur-échantillonnage en lumière linéaire (réduction propre).
//
// Sorties :
//   public/icons/icon-{192,512}.png           détourées (transparence), manifest « any »
//   public/icons/icon-maskable-{192,512}.png  pleine surface, pictogramme dans la zone sûre
//   app/apple-icon.png (180)                  pleine surface opaque (iOS applique son masque)
//   app/icon.png (192) + app/favicon.ico      favicons détourés

import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const SRC = "assets/tpg-go-icon.png";

const { data: src, info } = await sharp(SRC)
  .removeAlpha()
  .toColorspace("srgb")
  .raw()
  .toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const at = (x, y) => (y * W + x) * 3;
const isOrange = (i) => src[i] - src[i + 2] > 80;
const isCream = (i) => src[i] > 200 && src[i + 2] > 140 && src[i] - src[i + 2] < 80;

// --- 1. Contour du squircle -------------------------------------------------
let left = W, right = -1, top = H, bottom = -1;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!isOrange(at(x, y))) continue;
    if (x < left) left = x;
    if (x > right) right = x;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }
}
if (right < 0) throw new Error("Squircle orange introuvable dans " + SRC);
const cx = (left + right + 1) / 2;
const cy = (top + bottom + 1) / 2;
const ax = (right - left + 1) / 2;
const ay = (bottom - top + 1) / 2;

// Exposant de superellipse |u|^n + |v|^n = 1 ajusté sur le bord gauche, dans l'arrondi haut.
const exps = [];
for (let y = Math.round(top + ay * 0.05); y < top + ay * 0.4; y += 2) {
  let x = left;
  while (x < cx && !isOrange(at(x, y))) x++;
  const u = (cx - x) / ax;
  const v = (cy - y) / ay;
  let lo = 1.5, hi = 12;
  for (let k = 0; k < 50; k++) {
    const n = (lo + hi) / 2;
    if (u ** n + v ** n > 1) lo = n; else hi = n;
  }
  exps.push((lo + hi) / 2);
}
exps.sort((a, b) => a - b);
const N_EXP = exps[exps.length >> 1];

/** Distance approximative (px source) au bord du squircle d'origine, positive à l'intérieur. */
const insideDist = (x, y) => {
  const s = (Math.abs((x - cx) / ax) ** N_EXP + Math.abs((y - cy) / ay) ** N_EXP) ** (1 / N_EXP);
  return (1 - s) * Math.min(ax, ay);
};

// --- 2. Modèle du dégradé de fond --------------------------------------------
const INSET = 16; // px source : on ignore le liseré du bord (anti-aliasing + léger assombrissement)
const FEATHER = 24; // px source : fondu progressif entre image d'origine et modèle
// Coordonnées normalisées par le demi-côté du carré utile (A) pour garder un repère isotrope.
const A = Math.min(ax, ay);
const feats = (u, v) => [1, u, v, u * u, u * v, v * v, u * u * u, u * u * v, u * v * v, v * v * v];
const NF = 10;

// Zone du pictogramme (crème) dilatée : exclue de l'ajustement, fenêtre comprise.
let gx0 = W, gx1 = -1, gy0 = H, gy1 = -1, glyphR = 0;
for (let y = top; y <= bottom; y++) {
  for (let x = left; x <= right; x++) {
    if (insideDist(x, y) < 12 || !isCream(at(x, y))) continue;
    if (x < gx0) gx0 = x;
    if (x > gx1) gx1 = x;
    if (y < gy0) gy0 = y;
    if (y > gy1) gy1 = y;
    glyphR = Math.max(glyphR, Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / A);
  }
}
const PAD = 14;

const ata = Array.from({ length: NF }, () => new Float64Array(NF));
const atb = [0, 1, 2].map(() => new Float64Array(NF));
for (let y = top; y <= bottom; y += 2) {
  for (let x = left; x <= right; x += 2) {
    if (insideDist(x, y) < INSET) continue;
    if (x > gx0 - PAD && x < gx1 + PAD && y > gy0 - PAD && y < gy1 + PAD) continue;
    const i = at(x, y);
    if (!isOrange(i)) continue;
    const f = feats((x + 0.5 - cx) / A, (y + 0.5 - cy) / A);
    for (let r = 0; r < NF; r++) {
      for (let c = 0; c < NF; c++) ata[r][c] += f[r] * f[c];
      for (let ch = 0; ch < 3; ch++) atb[ch][r] += f[r] * src[i + ch];
    }
  }
}
const coef = atb.map((b) => solve(ata.map((row) => Array.from(row)), Array.from(b)));
const model = (u, v) => {
  const f = feats(u, v);
  return coef.map((k) => k.reduce((s, kk, j) => s + kk * f[j], 0));
};

// --- 3. Échantillonnage et rendu ---------------------------------------------
const FIT_LIMIT = 1 - (INSET + FEATHER) / A; // norme max où le modèle reste fiable

const toLin = new Float64Array(256).map((_, c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
});
const lin = (v) => {
  const s = Math.min(1, Math.max(0, v / 255));
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const toSrgb = (l) => {
  const s = l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, s)) * 255);
};

/** Couleur linéaire au point source (sx, sy) : image d'origine au centre, dégradé modélisé au bord. */
function sample(sx, sy, out) {
  const w = Math.min(1, Math.max(0, (insideDist(sx, sy) - INSET) / FEATHER));
  let r = 0, g = 0, b = 0;
  if (w < 1) {
    // Hors de la zone d'ajustement, un polynôme extrapolé dérive (coins jaune-vert) :
    // on ramène le point sur le bord fiable, le long du rayon depuis le centre.
    const u = (sx - cx) / ax, v = (sy - cy) / ay;
    const s = (Math.abs(u) ** N_EXP + Math.abs(v) ** N_EXP) ** (1 / N_EXP);
    const k = s > FIT_LIMIT ? FIT_LIMIT / s : 1;
    const m = model((u * k * ax) / A, (v * k * ay) / A);
    r = lin(m[0]) * (1 - w);
    g = lin(m[1]) * (1 - w);
    b = lin(m[2]) * (1 - w);
  }
  if (w > 0) {
    // Bilinéaire en lumière linéaire.
    const fx = Math.min(W - 1.001, Math.max(0, sx - 0.5));
    const fy = Math.min(H - 1.001, Math.max(0, sy - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const i00 = at(x0, y0), i10 = at(x0 + 1, y0), i01 = at(x0, y0 + 1), i11 = at(x0 + 1, y0 + 1);
    for (let ch = 0; ch < 3; ch++) {
      const v =
        (toLin[src[i00 + ch]] * (1 - tx) + toLin[src[i10 + ch]] * tx) * (1 - ty) +
        (toLin[src[i01 + ch]] * (1 - tx) + toLin[src[i11 + ch]] * tx) * ty;
      if (ch === 0) r += v * w;
      else if (ch === 1) g += v * w;
      else b += v * w;
    }
  }
  out[0] = r; out[1] = g; out[2] = b;
}

/**
 * Rend une icône carrée de `size` px.
 * - `scale` : fraction du canevas occupée par le carré utile (côté 2A de la source).
 * - `mask`  : true → squircle détouré (alpha), false → pleine surface opaque.
 */
function render(size, { scale = 1, mask = false } = {}) {
  const ratio = (2 * A) / scale / size; // px source par px de sortie
  const ss = Math.max(4, Math.ceil(ratio * 1.5));
  const out = Buffer.alloc(size * size * 4);
  const c = [0, 0, 0];
  for (let Y = 0; Y < size; Y++) {
    for (let X = 0; X < size; X++) {
      let r = 0, g = 0, b = 0, cov = 0;
      for (let j = 0; j < ss; j++) {
        for (let i = 0; i < ss; i++) {
          const nx = (X + (i + 0.5) / ss) / size - 0.5; // [-0.5, 0.5]
          const ny = (Y + (j + 0.5) / ss) / size - 0.5;
          sample(cx + (nx * 2 * A) / scale, cy + (ny * 2 * A) / scale, c);
          r += c[0]; g += c[1]; b += c[2];
          if (!mask || Math.abs(2 * nx) ** N_EXP + Math.abs(2 * ny) ** N_EXP <= 1) cov++;
        }
      }
      const n = ss * ss;
      const o = (Y * size + X) * 4;
      out[o] = toSrgb(r / n);
      out[o + 1] = toSrgb(g / n);
      out[o + 2] = toSrgb(b / n);
      out[o + 3] = Math.round((cov / n) * 255);
    }
  }
  return out;
}

const png = (size, opts) => {
  const img = sharp(render(size, opts), { raw: { width: size, height: size, channels: 4 } });
  // Variantes pleine surface : opaques (iOS affiche du noir sous une transparence).
  return (opts?.mask ? img : img.removeAlpha()).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
};

// Maskable : la zone sûre est un cercle de rayon 40 % du côté (0,8 en demi-côté) ;
// on garde une petite marge sous cette limite.
const maskScale = Math.min(1, 0.76 / glyphR);

const outputs = [
  ["public/icons/icon-192.png", 192, { mask: true }],
  ["public/icons/icon-512.png", 512, { mask: true }],
  ["public/icons/icon-maskable-192.png", 192, { scale: maskScale }],
  ["public/icons/icon-maskable-512.png", 512, { scale: maskScale }],
  ["app/apple-icon.png", 180, {}],
  ["app/icon.png", 192, { mask: true }],
];
for (const [file, size, opts] of outputs) {
  await writeFile(file, await png(size, opts));
  console.log(`✓ ${file} (${size}×${size})`);
}

// favicon.ico : conteneur ICO avec des PNG 16/32/48 embarqués.
const icoSizes = [16, 32, 48];
const icoPngs = await Promise.all(icoSizes.map((s) => png(s, { mask: true })));
const header = Buffer.alloc(6 + 16 * icoSizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoSizes.length, 4);
let offset = header.length;
icoSizes.forEach((s, k) => {
  const e = 6 + 16 * k;
  header.writeUInt8(s, e);
  header.writeUInt8(s, e + 1);
  header.writeUInt16LE(1, e + 4); // plans
  header.writeUInt16LE(32, e + 6); // bits par pixel
  header.writeUInt32LE(icoPngs[k].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += icoPngs[k].length;
});
await writeFile("app/favicon.ico", Buffer.concat([header, ...icoPngs]));
console.log(`✓ app/favicon.ico (${icoSizes.join(", ")})`);

console.log(
  `\nsquircle ${ax * 2}×${ay * 2} px, exposant ${N_EXP.toFixed(2)}, ` +
    `pictogramme ${(glyphR * 100).toFixed(0)} % du demi-côté, échelle maskable ${maskScale.toFixed(3)}`,
);

/** Élimination de Gauss avec pivot partiel (système NF×NF). */
function solve(m, b) {
  const n = b.length;
  for (let col = 0; col < n; col++) {
    let p = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[p][col])) p = r;
    [m[col], m[p]] = [m[p], m[col]];
    [b[col], b[p]] = [b[p], b[col]];
    for (let r = col + 1; r < n; r++) {
      const f = m[r][col] / m[col][col];
      for (let c = col; c < n; c++) m[r][c] -= f * m[col][c];
      b[r] -= f * b[col];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let c = r + 1; c < n; c++) s -= m[r][c] * x[c];
    x[r] = s / m[r][r];
  }
  return x;
}
