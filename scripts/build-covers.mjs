#!/usr/bin/env node
// Generates the abstract cover artworks used on office name tags (public/covers/*.svg).
// Deterministic (seeded), so re-running produces the same files.
//
//   node scripts/build-covers.mjs

import { mkdirSync, writeFileSync } from "node:fs";

const W = 480, H = 200;
const OUT = new URL("../public/covers/", import.meta.url);
mkdirSync(OUT, { recursive: true });

// Dark base + three accents per palette, tuned to sit behind white text on the dark theme.
const palettes = [
  ["#06231f", "#10b981", "#2dd4bf", "#a7f3d0"], // emerald
  ["#140f2e", "#7c3aed", "#6366f1", "#c4b5fd"], // violet
  ["#2a1206", "#f59e0b", "#f43f5e", "#fde68a"], // amber / rose
  ["#04192b", "#0ea5e9", "#22d3ee", "#bae6fd"], // ocean
  ["#2b0a1f", "#db2777", "#f97316", "#fbcfe8"], // sunset
  ["#0d2008", "#65a30d", "#14b8a6", "#d9f99d"], // forest
  ["#1f0b2b", "#c026d3", "#8b5cf6", "#f5d0fe"], // berry
  ["#0b1a2b", "#38bdf8", "#a78bfa", "#e0f2fe"], // ice
  ["#2a1a08", "#d97706", "#b45309", "#fef3c7"], // desert
  ["#071c24", "#06b6d4", "#10b981", "#cffafe"], // lagoon
  ["#24070d", "#e11d48", "#a855f7", "#fecdd3"], // ruby
  ["#121826", "#64748b", "#38bdf8", "#e2e8f0"], // slate
  ["#1a1405", "#eab308", "#22c55e", "#fef9c3"], // citrus
  ["#0a1030", "#3b82f6", "#ec4899", "#dbeafe"], // neon
  ["#1b0f05", "#ea580c", "#facc15", "#ffedd5"], // ember
  ["#081a14", "#34d399", "#60a5fa", "#d1fae5"], // mint
];

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const r1 = (n) => Math.round(n * 10) / 10;

function aurora([base, a, b, c], rand) {
  const blobs = [a, b, c, a].map((color, i) => {
    const cx = r1(rand() * W), cy = r1(rand() * H * 0.9), rx = r1(90 + rand() * 140), ry = r1(40 + rand() * 70);
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${color}" opacity="${i === 3 ? 0.35 : 0.7}" transform="rotate(${r1(rand() * 60 - 30)} ${cx} ${cy})"/>`;
  });
  return `<rect width="${W}" height="${H}" fill="${base}"/><g filter="url(#blur)">${blobs.join("")}</g>`;
}

function waves([base, a, b, c], rand) {
  const layers = [c, a, b].map((color, i) => {
    const y = 60 + i * 45, amp = 14 + rand() * 22, freq = 1 + rand() * 1.5, phase = rand() * Math.PI * 2;
    let d = `M0 ${r1(y)}`;
    for (let x = 0; x <= W; x += 20) d += ` L${x} ${r1(y + Math.sin((x / W) * Math.PI * 2 * freq + phase) * amp)}`;
    d += ` L${W} ${H} L0 ${H} Z`;
    return `<path d="${d}" fill="${color}" opacity="${[0.35, 0.6, 0.8][i]}"/>`;
  });
  return `<rect width="${W}" height="${H}" fill="${base}"/><g filter="url(#soft)">${layers.join("")}</g>`;
}

function contours([base, a, b, c], rand) {
  const cx = 80 + rand() * 320, cy = 40 + rand() * 120;
  const rings = Array.from({ length: 14 }, (_, i) => {
    const r = 18 + i * 22, wobble = 4 + rand() * 8;
    let d = "";
    for (let k = 0; k <= 48; k++) {
      const t = (k / 48) * Math.PI * 2;
      const rr = r + Math.sin(t * 3 + i) * wobble + Math.cos(t * 5 + i * 0.7) * wobble * 0.5;
      d += `${k ? "L" : "M"}${r1(cx + Math.cos(t) * rr * 1.4)} ${r1(cy + Math.sin(t) * rr)} `;
    }
    return `<path d="${d}Z" fill="none" stroke="${[a, b, c][i % 3]}" stroke-width="1.4" opacity="${r1(0.85 - i * 0.045)}"/>`;
  });
  return `<rect width="${W}" height="${H}" fill="${base}"/><radialGradient id="g" cx="${r1(cx / W)}" cy="${r1(cy / H)}" r="0.7"><stop offset="0" stop-color="${a}" stop-opacity="0.45"/><stop offset="1" stop-color="${base}" stop-opacity="0"/></radialGradient><rect width="${W}" height="${H}" fill="url(#g)"/>${rings.join("")}`;
}

function dunes([base, a, b, c], rand) {
  const sun = `<circle cx="${r1(100 + rand() * 280)}" cy="${r1(50 + rand() * 30)}" r="${r1(26 + rand() * 18)}" fill="${c}" opacity="0.85"/>`;
  const hills = [b, a, base].map((color, i) => {
    const y = 105 + i * 30, peak = rand() * W;
    return `<path d="M0 ${y + 30} Q ${r1(peak)} ${r1(y - 50 + i * 10)} ${W} ${r1(y + 10 - rand() * 30)} L${W} ${H} L0 ${H} Z" fill="${color}" opacity="${[0.65, 0.85, 1][i]}"/>`;
  });
  return `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${base}"/><stop offset="1" stop-color="${a}" stop-opacity="0.55"/></linearGradient><rect width="${W}" height="${H}" fill="url(#sky)"/>${sun}${hills.join("")}`;
}

const styles = [aurora, waves, contours, dunes];
const defs = `<defs><filter id="blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="28"/></filter><filter id="soft"><feGaussianBlur stdDeviation="1.2"/></filter></defs>`;

palettes.forEach((palette, i) => {
  const rand = rng(1000 + i * 7919);
  const body = styles[i % styles.length](palette, rand);
  // A soft shade at the bottom keeps the overlapping avatar and the card text readable.
  const shade = `<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></linearGradient><rect width="${W}" height="${H}" fill="url(#shade)"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${defs}${body}${shade}</svg>\n`;
  writeFileSync(new URL(`cover-${String(i + 1).padStart(2, "0")}.svg`, OUT), svg);
});
console.log(`wrote ${palettes.length} covers to public/covers/`);
