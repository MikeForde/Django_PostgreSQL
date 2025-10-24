#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

const TEX_DIR = './tex_library';                    // adjust path
const API     = 'https://snowfusion-.../review/decisions';
const OUTFILE = './snowfusion_code_mix.csv';

// Helper: extract Read codes from TEX content
function extractCodes(texText) {
  const codeRegex = /\b([A-Z]{2,10}[0-9A-Z.]{1,8})\b/g;
  const lines = texText.split(/\r?\n/);
  const codes = new Set();
  for (const line of lines) {
    if (/Auto-Entered Text/i.test(line)) continue;
    const m = line.match(codeRegex);
    if (m) m.forEach(c => codes.add(c.replace(/^Last\s+Entry\s+for\s+/i, '').trim()));
  }
  return [...codes];
}

// Classify from SnowFusion decision text
function classFor(decision) {
  const d = (decision || '').toLowerCase();
  if (d.includes('dms')) return 'DMSCreate';
  if (d.includes('inactivate')) return 'Ignored';
  if (d.includes('manual')) return 'ManualMap';
  if (d.includes('api') || d.includes('exact') || d.includes('auto')) return 'APIMap';
  return 'Other';
}

async function main() {
  const texFiles = fs.readdirSync(TEX_DIR).filter(f => f.endsWith('.tex'));
  const allRows = [];

  for (const file of texFiles) {
    const text = fs.readFileSync(path.join(TEX_DIR, file), 'utf8');
    const codes = extractCodes(text).filter(c => !/^(NEGATION-|QUERY-)/i.test(c));
    if (!codes.length) {
      allRows.push({ file, code: '', decision: '', category: 'None' });
      continue;
    }

    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes })
    });
    const { results = {} } = await res.json();

    for (const code of codes) {
      const hit = results[code];
      const decision = hit?.decision || '';
      const category = classFor(decision);
      allRows.push({ file, code, decision, category });
    }

    console.log(`Processed ${file} (${codes.length} codes)`);
  }

  const csv = stringify(allRows, { header: true });
  fs.writeFileSync(OUTFILE, csv);
  console.log(`✅ CSV written to ${OUTFILE}`);
}

main().catch(err => console.error(err));
