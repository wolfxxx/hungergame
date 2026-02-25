#!/usr/bin/env node
/**
 * Convert readymade Pac-Man maze files (.lay or plain text) to Hungergame format.
 *
 * Usage:
 *   node scripts/convert-maze.js <input.lay> [options]
 *   node scripts/convert-maze.js <input.lay> -o mazes.json
 *   node scripts/convert-maze.js <input.lay> --name "My Maze"
 *
 * Input format (e.g. Berkeley .lay):
 *   % = wall, . = pellet, o = power pellet, P = Pac-Man, G = ghost
 *   We map: % # -> W, . -> ., o O -> o, P -> P, G -> G, space -> space
 *   Unknown chars become '.' (walkable). Gate '-' is added on ghost row if missing.
 *
 * Output: game-ready maze array + optional JSON file.
 */

const fs = require('fs');
const path = require('path');

// Map source characters to game format: W=wall, .=pellet, o=power, P=spawn, G=pen, -=gate, space=tunnel
const DEFAULT_MAP = {
  '%': 'W',
  '#': 'W',
  '.': '.',
  'o': 'o',
  'O': 'o',
  'P': 'P',
  'G': 'G',
  ' ': ' ',
  '-': '-',
};

function mapLine(line, charMap) {
  return line.split('').map(ch => charMap[ch] ?? '.').join('');
}

function ensureGateOnGhostRow(rows) {
  const out = rows.map(r => r.split(''));
  let gateRow = -1;
  for (let y = 0; y < out.length; y++) {
    if (out[y].some(ch => ch === 'G')) {
      gateRow = y;
      break;
    }
  }
  if (gateRow < 0) return rows;

  const row = out[gateRow];
  const hasGate = row.some(ch => ch === '-');
  if (hasGate) return rows;

  // Find a good place for gate: between G's and play area, or middle of G run
  let firstG = -1, lastG = -1;
  for (let x = 0; x < row.length; x++) {
    if (row[x] === 'G') {
      if (firstG < 0) firstG = x;
      lastG = x;
    }
  }
  // Put gate at middle of [firstG, lastG] or between pen and rest (e.g. left of first G if there's space)
  const mid = firstG >= 0 && lastG >= 0 ? Math.floor((firstG + lastG) / 2) : 0;
  const gateX = Math.max(0, Math.min(mid, row.length - 1));
  row[gateX] = '-';
  return out.map(r => r.join(''));
}

function normalizeRowLengths(rows) {
  const maxLen = Math.max(...rows.map(r => r.length));
  return rows.map(r => r.length < maxLen ? r.padEnd(maxLen, 'W') : r.slice(0, maxLen));
}

function validate(rows) {
  const errors = [];
  let pCount = 0, gCount = 0;
  const len = rows[0]?.length ?? 0;
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    if (row.length !== len) errors.push(`Row ${y + 1} length ${row.length} != ${len}`);
    for (const ch of row) {
      if (ch === 'P') pCount++;
      if (ch === 'G') gCount++;
    }
  }
  if (pCount !== 1) errors.push(`Expected exactly one 'P', found ${pCount}`);
  if (gCount < 1) errors.push("Expected at least one 'G' (ghost pen)");
  return errors;
}

function convert(inputText, charMap = DEFAULT_MAP) {
  const rawLines = inputText.split(/\r?\n/).map(s => s.trimEnd());
  const mapped = rawLines.map(line => mapLine(line, charMap));
  const withGate = ensureGateOnGhostRow(mapped);
  const normalized = normalizeRowLengths(withGate);
  const errors = validate(normalized);
  return { maze: normalized, errors };
}

function main() {
  const args = process.argv.slice(2);
  let inputPath = null;
  let outPath = null;
  let name = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-o' || args[i] === '--output') {
      outPath = args[++i];
    } else if (args[i] === '--name') {
      name = args[++i];
    } else if (!args[i].startsWith('-')) {
      inputPath = args[i];
    }
  }

  if (!inputPath) {
    console.error('Usage: node scripts/convert-maze.js <input.lay> [--name "Level Name"] [-o mazes.json]');
    process.exit(1);
  }

  let inputText;
  try {
    inputText = fs.readFileSync(inputPath, 'utf8');
  } catch (e) {
    console.error('Failed to read file:', inputPath, e.message);
    process.exit(1);
  }

  const levelName = name || path.basename(inputPath, path.extname(inputPath));
  const { maze, errors } = convert(inputText);

  if (errors.length) {
    console.error('Validation issues:');
    errors.forEach(e => console.error('  -', e));
  }

  const payload = {
    name: levelName.replace(/[.\-]/g, ' ').replace(/\s+/g, ' ').trim() || 'Imported',
    maze,
    ghostSpeed: 80,
    powerTime: 7000,
    gateCount: 1,
  };

  // JSON output
  const json = JSON.stringify([payload], null, 2);
  if (outPath) {
    try {
      fs.writeFileSync(outPath, json, 'utf8');
      console.log('Wrote', outPath);
    } catch (e) {
      console.error('Failed to write', outPath, e.message);
      process.exit(1);
    }
  }

  // JS snippet for pasting into LEVELS
  const jsSnippet = `
  {
    name: "${payload.name.replace(/"/g, '\\"')}",
    maze: [
${payload.maze.map(r => '      "' + r.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"').join(',\n')}
    ],
    ghostSpeed: 80,
    powerTime: 7000,
    gateCount: 1,
  }
`;
  console.log('\n--- JS snippet (paste into LEVELS in src/game.js) ---');
  console.log(jsSnippet.trim());
  console.log('\n--- End snippet ---');
}

main();
