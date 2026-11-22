// The World Today — Sunday 22 November 2026.
// A deterministic renderer: draws the day's world news as one 1024x1024
// newspaper front page (masthead, three leads, numbered world map, 35-story
// grid) and writes it to /output/entry.png. Node 22 standard library only,
// no network, no randomness — two runs write identical bytes.

import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---------- palette ----------
const PAPER: RGB = [246, 241, 231];
const INK: RGB = [22, 24, 29];
const MUTED: RGB = [96, 101, 112];
const RED: RGB = [179, 38, 30];
const BLUE: RGB = [30, 79, 138];
const LAND: RGB = [51, 86, 110];
const SEA: RGB = [214, 226, 232];
const RULE: RGB = [180, 172, 156];

type RGB = [number, number, number];

// ---------- canvas ----------
const px = new Uint8Array(W * H * 3);
function fill(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0];
    px[i * 3 + 1] = c[1];
    px[i * 3 + 2] = c[2];
  }
}
function setPix(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPix(xx, yy, c);
  }
}
function hline(x: number, y: number, w: number, c: RGB): void {
  fillRect(x, y, w, 1, c);
}
function vline(x: number, y: number, h: number, c: RGB): void {
  fillRect(x, y, 1, h, c);
}
function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let yy = cy - r; yy <= cy + r; yy++) {
    for (let xx = cx - r; xx <= cx + r; xx++) {
      const dx = xx - cx;
      const dy = yy - cy;
      if (dx * dx + dy * dy <= r * r) setPix(xx, yy, c);
    }
  }
}

// ---------- PNG encoding ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w: number, h: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- 5x7 bitmap font (authored glyphs, one row per string) ----------
const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '+': ['00000', '00100', '00100', '01110', '00100', '00100', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '"': ['01010', '01010', '00000', '00000', '00000', '00000', '00000'],
  $: ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '•': ['00000', '00100', '01110', '01110', '01110', '00100', '00000'],
};
const FALLBACK = ['01110', '10001', '00001', '00110', '00100', '00000', '00100'];

function normChar(ch: string): string {
  if (ch === '–' || ch === '—') return '-';
  if (ch === '’' || ch === '‘') return "'";
  return ch.toUpperCase();
}
function drawChar(x: number, y: number, ch: string, s: number, c: RGB): void {
  const g = FONT[normChar(ch)] ?? FALLBACK;
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (g[r][col] === '1') fillRect(x + col * s, y + r * s, s, s, c);
    }
  }
}
function textWidth(s: string, sc: number): number {
  return s.length === 0 ? 0 : s.length * 6 * sc - sc;
}
function drawText(x: number, y: number, s: string, sc: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    drawChar(cx, y, ch, sc, c);
    cx += 6 * sc;
  }
}
function drawTextCentered(cx: number, y: number, s: string, sc: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(s, sc) / 2), y, s, sc, c);
}
// Greedy word wrap to at most maxChars per line.
function wrap(s: string, maxChars: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur === '') cur = w;
    else if (cur.length + 1 + w.length <= maxChars) cur += ' ' + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

// ---------- the day's news: 35 stories, 6 regions ----------
// Every story happened, or was first reported, on Sunday 22 November 2026.
// The first 12 carry numbered pins on the world map (pin = [latitude, longitude]).
type Story = { n: number; region: string; head: string; pin?: [number, number] };
const STORIES: Story[] = [
  { n: 1, region: 'MIDDLE EAST', head: 'COP31 NEARS DEAL IN ALL-NIGHT TALKS', pin: [36.9, 30.7] },
  { n: 2, region: 'MIDDLE EAST', head: 'IRAN HITS US BASES IN BAHRAIN', pin: [26.2, 50.6] },
  { n: 3, region: 'MIDDLE EAST', head: 'TWO TANKERS HIT IN STRAIT OF HORMUZ', pin: [26.5, 56.3] },
  { n: 4, region: 'EUROPE', head: 'SPARTA II BURNS AFTER DRONE STRIKE', pin: [59.8, 25.5] },
  { n: 5, region: 'EUROPE', head: 'MISSILE KILLS 2 IN KRYVYI RIH', pin: [47.9, 33.4] },
  { n: 6, region: 'AMERICAS', head: "QUAKE 6.7 SHAKES PERU'S JUNIN", pin: [-11.5, -75.0] },
  { n: 7, region: 'AMERICAS', head: 'SINALOA BURNS AFTER KINGPIN SEIZED', pin: [25.0, -107.9] },
  { n: 8, region: 'AMERICAS', head: 'FLORIDA RIVER BREAKS 73-YEAR RECORD', pin: [28.4, -80.7] },
  { n: 9, region: 'EUROPE', head: "FRANCE'S HOPEFULS CLASH IN TV DEBATE", pin: [48.9, 2.3] },
  { n: 10, region: 'EUROPE', head: 'NO TREATY TO BAN KILLER ROBOTS', pin: [46.2, 6.1] },
  { n: 11, region: 'ASIA', head: 'TOXIC DRINK KILLS 11 IN MANIPUR', pin: [24.7, 93.9] },
  { n: 12, region: 'AFRICA', head: 'LAST EBOLA PATIENT LEAVES IN KENYA', pin: [-1.3, 36.8] },
  { n: 13, region: 'MIDDLE EAST', head: 'IRAN CUTS HORMUZ REOPENING TO 2 DAYS' },
  { n: 14, region: 'MIDDLE EAST', head: 'RIYADH INTERCEPTS 3 HOUTHI MISSILES' },
  { n: 15, region: 'MIDDLE EAST', head: 'WINTER STORMS FLOOD GAZA SHELTERS' },
  { n: 16, region: 'MIDDLE EAST', head: 'IRAQ POWER PLANT FIRE KILLS 4' },
  { n: 17, region: 'EUROPE', head: 'US ENVOYS HEAD TO MOSCOW AFTER TALKS' },
  { n: 18, region: 'EUROPE', head: 'NORWAY COURT VOIDS OIL LICENCES' },
  { n: 19, region: 'EUROPE', head: 'PORTUGAL LOWERS STORM ALERTS' },
  { n: 20, region: 'EUROPE', head: 'ITALY PLANS FLAT TAX TO 100,000 EUROS' },
  { n: 21, region: 'EUROPE', head: 'SPAIN EXTENDS BANK LEVY TO 2027' },
  { n: 22, region: 'ASIA', head: 'QUAKE 4.1 RATTLES MYANMAR' },
  { n: 23, region: 'ASIA', head: 'SOFTBANK SHELVES $1TN HYNIX BID' },
  { n: 24, region: 'OCEANIA', head: 'SMITH OUT AS AUSTRALIA BOWLS FIRST' },
  { n: 25, region: 'ASIA', head: 'UAE HOSTS US HOMELAND SECURITY CHIEF' },
  { n: 26, region: 'AFRICA', head: 'GHANA UNVEILS HERITAGE BANKNOTES' },
  { n: 27, region: 'AFRICA', head: 'AL-SHABAAB CLAIMS SOMALI AMBUSH' },
  { n: 28, region: 'AFRICA', head: 'TIGRAY MAYOR VOWS VOTE IN 6 MONTHS' },
  { n: 29, region: 'AFRICA', head: 'SAHEL STATES RESUME WEST AFRICA TALKS' },
  { n: 30, region: 'AFRICA', head: 'SAO TOME PM REAPPOINTED' },
  { n: 31, region: 'AFRICA', head: 'NIGERIA STARTS BUILDING WARSHIPS' },
  { n: 32, region: 'AFRICA', head: "KENYA WINS 293,600 SAUDI JOBS" },
  { n: 33, region: 'AFRICA', head: 'DRC ENACTS CONSTITUTIONAL REFORM' },
  { n: 34, region: 'AMERICAS', head: 'FBI PROBES NATIONAL DATABASE BREACH' },
  { n: 35, region: 'AMERICAS', head: "S&P 500'S WORST WEEK SINCE APRIL" },
];

// The three lead stories, shown large above the map.
const LEADS = [
  { n: 1, kick: 'CLIMATE - ANTALYA, TURKEY', head: 'COP31 NEARS DEAL IN ALL-NIGHT TALKS', deck: 'NEW PACKAGE GOES TO A SUNDAY VOTE' },
  { n: 2, kick: 'GULF - BAHRAIN', head: 'IRAN HITS US BASES IN BAHRAIN', deck: 'TEHRAN CLAIMS TWO PATRIOT RADARS HIT' },
  { n: 3, kick: 'BALTIC - GULF OF FINLAND', head: 'SPARTA II BURNS AFTER DRONE STRIKE', deck: '16 CREW EVACUATED, SHIP ADRIFT' },
];

const REGION_COLOR: Record<string, RGB> = {
  'MIDDLE EAST': RED,
  EUROPE: BLUE,
  ASIA: [46, 125, 75],
  OCEANIA: [13, 122, 120],
  AFRICA: [176, 106, 26],
  AMERICAS: [106, 66, 150],
};

// ---------- world map ----------
// Coarse equirectangular land made of ellipse blobs on a 64x32 cell grid.
// cell (gx, gy): longitude -180 + gx*5.625, latitude 90 - gy*5.625.
const BLOBS: [number, number, number, number][] = [
  [5, 5, 3, 2], // Alaska
  [11, 7, 7.5, 3.5], // North America
  [16, 10, 4, 3], // eastern US, Mexico, Central America
  [25.5, 3, 3, 2], // Greenland
  [21, 17, 3.5, 3], // South America north
  [22, 22, 2.5, 3.5], // South America south
  [34, 13, 5.5, 3.5], // Africa north
  [35, 19, 3.5, 3], // Africa south
  [31.5, 6.5, 1, 1.2], // Britain
  [34, 6, 4, 2.5], // Europe
  [39, 6.5, 2.5, 2], // Urals bridge
  [50, 4, 7, 1.8], // Siberia
  [46, 7, 5, 3], // Central Asia
  [54, 8, 3.5, 3], // East Asia
  [46, 12, 2, 2.5], // India
  [50, 13, 2, 2], // South-East Asia
  [53, 16.5, 4, 1.2], // Indonesia
  [56, 9.5, 1, 1.8], // Japan
  [55.5, 20.5, 3.5, 2.2], // Australia
  [62.5, 23.5, 1, 1.5], // New Zealand
];
function isLand(gx: number, gy: number): boolean {
  for (const [bx, by, rx, ry] of BLOBS) {
    const dx = (gx - bx) / rx;
    const dy = (gy - by) / ry;
    if (dx * dx + dy * dy <= 1) return true;
  }
  return false;
}

const MAP_X = 24;
const MAP_Y = 278;
const MAP_W = 976;
const MAP_H = 250;

function drawMap(): void {
  fillRect(MAP_X, MAP_Y, MAP_W, MAP_H, SEA);
  const cw = MAP_W / 64;
  const ch = MAP_H / 32;
  for (let gy = 0; gy < 32; gy++) {
    for (let gx = 0; gx < 64; gx++) {
      if (isLand(gx + 0.5, gy + 0.5)) {
        fillRect(
          Math.round(MAP_X + gx * cw + cw / 2 - 2),
          Math.round(MAP_Y + gy * ch + ch / 2 - 2),
          5,
          5,
          LAND,
        );
      }
    }
  }
  // Numbered pins for the first 12 stories; a small repulsion pass keeps
  // clustered pins (Paris/Geneva, Bahrain/Hormuz) from overlapping.
  const pins: { x: number; y: number; n: number }[] = [];
  for (const s of STORIES) {
    if (!s.pin) continue;
    const [lat, lon] = s.pin;
    pins.push({
      x: MAP_X + ((lon + 180) / 360) * MAP_W,
      y: MAP_Y + ((90 - lat) / 180) * MAP_H,
      n: s.n,
    });
  }
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < pins.length; i++) {
      for (let j = i + 1; j < pins.length; j++) {
        const a = pins[i];
        const b = pins[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01 && d < 24) {
          const push = (24 - d) / 2;
          const ux = dx / d;
          const uy = dy / d;
          a.x -= ux * push;
          a.y -= uy * push;
          b.x += ux * push;
          b.y += uy * push;
        }
      }
    }
  }
  for (const p of pins) {
    const x = Math.round(Math.max(MAP_X + 11, Math.min(MAP_X + MAP_W - 11, p.x)));
    const y = Math.round(Math.max(MAP_Y + 11, Math.min(MAP_Y + MAP_H - 11, p.y)));
    disc(x, y, 10, RED);
    const num = String(p.n);
    drawText(x - Math.floor(textWidth(num, 1) / 2), y - 3, num, 1, [255, 255, 255]);
  }
}

// ---------- layout ----------
function drawMasthead(): void {
  drawTextCentered(512, 18, 'THE WORLD TODAY', 5, INK);
  drawTextCentered(512, 62, 'SUNDAY, 22 NOVEMBER 2026', 2, INK);
  drawTextCentered(512, 84, '35 STORIES - 6 REGIONS - ONE DAY IN WORLD NEWS', 2, MUTED);
  fillRect(24, 104, 976, 3, RED);
}

function drawLeads(): void {
  const y0 = 118;
  const bw = 317;
  for (let i = 0; i < LEADS.length; i++) {
    const lead = LEADS[i];
    const x0 = 24 + i * (bw + 12);
    fillRect(x0, y0, bw, 4, RED);
    vline(x0, y0, 120, RULE);
    vline(x0 + bw - 1, y0, 120, RULE);
    hline(x0, y0 + 119, bw, RULE);
    fillRect(x0 + 10, y0 + 12, 20, 20, RED);
    drawTextCentered(x0 + 20, y0 + 16, String(lead.n), 1, [255, 255, 255]);
    drawText(x0 + 38, y0 + 17, lead.kick, 1, RED);
    const headLines = wrap(lead.head, 23);
    let yy = y0 + 40;
    for (const ln of headLines) {
      drawText(x0 + 10, yy, ln, 2, INK);
      yy += 17;
    }
    const deckLines = wrap(lead.deck, 23);
    yy = y0 + 78;
    for (const ln of deckLines) {
      drawText(x0 + 10, yy, ln, 2, MUTED);
      yy += 17;
    }
  }
}

function drawGrid(): void {
  drawText(24, 568, 'THE DAY IN 35 STORIES', 2, INK);
  // Region colour key, right-aligned on the same row.
  const regions = ['MIDDLE EAST', 'EUROPE', 'ASIA', 'OCEANIA', 'AFRICA', 'AMERICAS'];
  let keyW = 0;
  for (const r of regions) keyW += 12 + textWidth(r, 1) + 10;
  let kx = 1000 - keyW;
  for (const r of regions) {
    fillRect(kx, 571, 8, 8, REGION_COLOR[r]);
    drawText(kx + 12, 571, r, 1, MUTED);
    kx += 12 + textWidth(r, 1) + 10;
  }
  hline(24, 592, 976, RULE);
  const rowH = 21;
  for (let r = 0; r < 18; r++) {
    const y = 606 + r * rowH;
    const left = STORIES[r];
    const right = STORIES[r + 18];
    drawStoryRow(24, y, left);
    if (right) drawStoryRow(524, y, right);
  }
}

function drawStoryRow(x: number, y: number, s: Story): void {
  const num = String(s.n).padStart(2, '0');
  drawText(x, y, num, 2, REGION_COLOR[s.region]);
  drawText(x + 30, y, s.head, 2, INK);
}

function drawFooter(): void {
  hline(24, 990, 976, RULE);
  drawTextCentered(
    512,
    998,
    'ALL EVENTS HAPPENED OR WERE FIRST REPORTED ON SUNDAY 22 NOVEMBER 2026 - COMPILED FROM WIRE REPORTS',
    1,
    MUTED,
  );
}

function build(): void {
  fill(PAPER);
  drawMasthead();
  drawLeads();
  drawText(24, 252, 'THE WORLD IN ONE MAP', 2, INK);
  drawText(1000 - textWidth('12 STORIES PINNED - NUMBERS MATCH THE LIST BELOW', 1), 256, '12 STORIES PINNED - NUMBERS MATCH THE LIST BELOW', 1, MUTED);
  drawMap();
  drawTextCentered(512, 534, 'NUMBERED PINS MATCH THE STORY NUMBERS BELOW', 1, MUTED);
  drawGrid();
  drawFooter();
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
build();
writeFileSync(outDir + '/entry.png', encodePNG(W, H, px));
