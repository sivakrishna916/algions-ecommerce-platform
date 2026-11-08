/**
 * Generates a local SVG illustration for every seeded product (no external image hosts, works offline).
 * Run: npm run art      (reads ../backend/src/scripts/seedData.js)
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { products } = require('../../backend/src/scripts/seedData.js');
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'products');
mkdirSync(out, { recursive: true });

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const W = '#ffffff';
// Each glyph is drawn in a 400x400 box on top of the gradient background.
const glyphs = {
  phone: () => `<rect x="140" y="70" width="120" height="240" rx="22" fill="#111827"/><rect x="150" y="90" width="100" height="196" rx="8" fill="${W}" opacity=".92"/><circle cx="200" cy="298" r="6" fill="${W}" opacity=".5"/>`,
  earbuds: () => `<circle cx="150" cy="170" r="40" fill="${W}"/><rect x="140" y="190" width="20" height="90" rx="10" fill="${W}"/><circle cx="250" cy="170" r="40" fill="${W}" opacity=".85"/><rect x="240" y="190" width="20" height="90" rx="10" fill="${W}" opacity=".85"/>`,
  watch: () => `<rect x="165" y="50" width="70" height="60" rx="10" fill="${W}" opacity=".6"/><rect x="165" y="290" width="70" height="60" rx="10" fill="${W}" opacity=".6"/><rect x="130" y="100" width="140" height="200" rx="38" fill="#111827"/><rect x="144" y="114" width="112" height="172" rx="28" fill="${W}" opacity=".92"/><path d="M200 150v52l30 18" stroke="#111827" stroke-width="10" fill="none" stroke-linecap="round"/>`,
  laptop: () => `<rect x="90" y="110" width="220" height="140" rx="12" fill="#111827"/><rect x="102" y="122" width="196" height="116" rx="4" fill="${W}" opacity=".92"/><path d="M60 262h280l-24 28H84z" fill="${W}" opacity=".85"/>`,
  speaker: () => `<rect x="120" y="100" width="160" height="200" rx="40" fill="#111827"/><circle cx="200" cy="170" r="38" fill="${W}" opacity=".9"/><circle cx="200" cy="250" r="22" fill="${W}" opacity=".7"/>`,
  shirt: () => `<path d="M140 80 90 120l36 44 22-16v152h104V148l22 16 36-44-50-40c-10 22-34 34-60 34s-50-12-60-34z" fill="${W}" opacity=".93"/>`,
  jeans: () => `<path d="M130 70h140l18 250h-62l-26-170-26 170h-62z" fill="${W}" opacity=".93"/><path d="M130 70h140v26H130z" fill="#111827" opacity=".25"/>`,
  shoe: () => `<path d="M70 250c0-40 20-70 50-80l40-12c14 22 40 30 70 24l50 60c20 4 30 14 30 30v10H70z" fill="${W}" opacity=".93"/><rect x="70" y="278" width="280" height="22" rx="10" fill="#111827" opacity=".35"/>`,
  bag: () => `<path d="M150 110c0-34 100-34 100 0" stroke="${W}" stroke-width="14" fill="none"/><rect x="110" y="110" width="180" height="220" rx="40" fill="${W}" opacity=".93"/><rect x="140" y="210" width="120" height="64" rx="14" fill="#111827" opacity=".25"/>`,
  glasses: () => `<circle cx="140" cy="200" r="52" fill="#111827"/><circle cx="260" cy="200" r="52" fill="#111827"/><path d="M192 196q8-10 16 0" stroke="${W}" stroke-width="8" fill="none"/><path d="M88 190 62 160M312 190l26-30" stroke="${W}" stroke-width="8"/>`,
  pan: () => `<circle cx="180" cy="210" r="90" fill="#111827"/><circle cx="180" cy="210" r="70" fill="${W}" opacity=".25"/><rect x="262" y="198" width="100" height="24" rx="12" fill="${W}" opacity=".9"/>`,
  kettle: () => `<path d="M130 300V170c0-40 30-70 70-70s70 30 70 70v130z" fill="${W}" opacity=".93"/><path d="M270 150c50-10 60 60 0 80" stroke="${W}" stroke-width="14" fill="none"/><rect x="170" y="80" width="60" height="22" rx="8" fill="#111827" opacity=".4"/>`,
  lamp: () => `<path d="M150 120h100l30 80H120z" fill="${W}" opacity=".95"/><rect x="194" y="200" width="12" height="100" fill="${W}" opacity=".85"/><rect x="150" y="300" width="100" height="16" rx="8" fill="${W}"/>`,
  bed: () => `<rect x="70" y="190" width="260" height="90" rx="14" fill="${W}" opacity=".93"/><rect x="70" y="140" width="40" height="150" rx="10" fill="#111827" opacity=".4"/><rect x="130" y="160" width="80" height="40" rx="12" fill="${W}"/><rect x="220" y="160" width="80" height="40" rx="12" fill="${W}"/>`,
  mug: () => `<rect x="110" y="120" width="150" height="170" rx="24" fill="${W}" opacity=".95"/><path d="M260 160c60-6 60 80 0 84" stroke="${W}" stroke-width="16" fill="none"/><path d="M150 90c-10-20 10-30 0-50M190 90c-10-20 10-30 0-50" stroke="${W}" stroke-width="8" fill="none" opacity=".6" stroke-linecap="round"/>`,
  book: () => `<rect x="120" y="70" width="170" height="250" rx="10" fill="${W}" opacity=".95"/><rect x="120" y="70" width="26" height="250" rx="6" fill="#111827" opacity=".4"/><rect x="170" y="120" width="96" height="14" rx="7" fill="#111827" opacity=".35"/><rect x="170" y="150" width="70" height="14" rx="7" fill="#111827" opacity=".25"/>`,
  mat: () => `<rect x="90" y="150" width="220" height="100" rx="14" fill="${W}" opacity=".93"/><circle cx="310" cy="200" r="50" fill="${W}" opacity=".75"/><circle cx="310" cy="200" r="20" fill="#111827" opacity=".3"/>`,
  dumbbell: () => `<rect x="150" y="190" width="100" height="20" fill="${W}"/><rect x="100" y="140" width="40" height="120" rx="10" fill="${W}" opacity=".95"/><rect x="260" y="140" width="40" height="120" rx="10" fill="${W}" opacity=".95"/><rect x="70" y="165" width="26" height="70" rx="8" fill="${W}" opacity=".8"/><rect x="304" y="165" width="26" height="70" rx="8" fill="${W}" opacity=".8"/>`,
  ball: () => `<circle cx="200" cy="200" r="100" fill="${W}" opacity=".95"/><path d="m200 150 40 30-15 46h-50l-15-46z" fill="#111827" opacity=".75"/><path d="M200 150v-48M240 180l46-16M225 226l28 40M175 226l-28 40M160 180l-46-16" stroke="#111827" stroke-width="6" opacity=".6"/>`,
  bottle: () => `<rect x="180" y="60" width="40" height="40" rx="8" fill="#111827" opacity=".5"/><rect x="150" y="100" width="100" height="220" rx="30" fill="${W}" opacity=".95"/><rect x="170" y="170" width="60" height="70" rx="8" fill="#111827" opacity=".25"/>`,
  band: () => `<circle cx="150" cy="210" r="60" fill="none" stroke="${W}" stroke-width="22"/><circle cx="250" cy="190" r="60" fill="none" stroke="${W}" stroke-width="22" opacity=".8"/><circle cx="210" cy="250" r="45" fill="none" stroke="${W}" stroke-width="16" opacity=".6"/>`,
};

for (const p of products) {
  const slug = slugify(p.name);
  const draw = glyphs[p.art.icon] || glyphs.book;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="${p.name.replace(/&/g, '&amp;')}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.art.color}"/><stop offset="1" stop-color="${p.art.color}" stop-opacity=".62"/></linearGradient></defs>
<rect width="400" height="400" fill="url(#g)"/><circle cx="330" cy="70" r="120" fill="#fff" opacity=".07"/><circle cx="60" cy="350" r="150" fill="#000" opacity=".08"/>
${draw()}
</svg>`;
  writeFileSync(join(out, `${slug}.svg`), svg);
}
console.log(`Generated ${products.length} product images in public/products`);
