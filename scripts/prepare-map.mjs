#!/usr/bin/env node
/**
 * Prepares the world map for the heatmap view.
 * Takes world-atlas countries-110m TopoJSON (feature ids are ISO 3166-1
 * numeric) and tags every geometry with its ISO3 alpha code via
 * i18n-iso-countries, writing public/map/countries-110m.json.
 * Run once after npm install: npm run prepare-map
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const countriesLib = require('i18n-iso-countries');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const topoPath = require.resolve('world-atlas/countries-110m.json');
const topo = JSON.parse(fs.readFileSync(topoPath, 'utf8'));

let tagged = 0, missed = [];
for (const geom of topo.objects.countries.geometries) {
  const numeric = String(geom.id).padStart(3, '0');
  const alpha3 = countriesLib.numericToAlpha3(numeric);
  geom.properties = geom.properties ?? {};
  if (alpha3) {
    geom.properties.iso3 = alpha3;
    tagged++;
  } else {
    missed.push(`${geom.id}:${geom.properties?.name}`);
  }
}

// Kosovo (world-atlas id "-99"-style edge cases) - tag by name as a fallback.
for (const geom of topo.objects.countries.geometries) {
  if (!geom.properties.iso3 && geom.properties?.name === 'Kosovo') geom.properties.iso3 = 'UVK'; // IMF code for Kosovo
}

const outPath = path.join(ROOT, 'public', 'map', 'countries-110m.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(topo));
console.log(`Tagged ${tagged} geometries with ISO3 (${missed.length} unmatched: ${missed.join(', ') || 'none'}).`);
console.log(`Wrote ${outPath}`);
