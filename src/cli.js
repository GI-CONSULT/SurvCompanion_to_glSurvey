#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { parseCSV, convertPoints, generateCSV, detectBestZone, EPSG_DEFS } = require('./converter');

const args = process.argv.slice(2);

function usage() {
  console.log(`
Verwendung: node src/cli.js <eingabe.csv> [optionen]

Optionen:
  --epsg <code>     Ziel-EPSG-Code (5681–5685, Standard: auto)
  --output <datei>  Ausgabedatei (Standard: <eingabe>_glsurvey.csv)
  --sep <zeichen>   CSV-Trennzeichen (Standard: ;)
  --help            Diese Hilfe anzeigen

Beispiel:
  node src/cli.js vermessungspunkte.csv --epsg 5682 --output output.csv
`);
  process.exit(0);
}

if (args.includes('--help') || args.length === 0) usage();

const inputFile = args[0];
let epsgCode = 'auto';
let outputFile = null;
let separator = ';';

for (let i = 1; i < args.length; i++) {
  if (args[i] === '--epsg' && args[i + 1]) { epsgCode = args[++i]; }
  else if (args[i] === '--output' && args[i + 1]) { outputFile = args[++i]; }
  else if (args[i] === '--sep' && args[i + 1]) { separator = args[++i]; }
}

if (!outputFile) {
  const ext = path.extname(inputFile);
  const base = path.basename(inputFile, ext);
  outputFile = path.join(path.dirname(inputFile), `${base}_glsurvey${ext}`);
}

// Read & parse
if (!fs.existsSync(inputFile)) {
  console.error(`Fehler: Datei nicht gefunden: ${inputFile}`);
  process.exit(1);
}

const csvText = fs.readFileSync(inputFile, 'utf-8');
const { data, errors } = parseCSV(csvText);

if (errors.length > 0) {
  console.error('Fehler:', errors.join('; '));
  process.exit(1);
}

console.log(`${data.length} Vermessungspunkte eingelesen.`);

// Auto-detect zone
if (epsgCode === 'auto') {
  const best = detectBestZone(data);
  if (!best) {
    console.error('Keine gültigen GPS-Koordinaten gefunden.');
    process.exit(1);
  }
  epsgCode = String(best.epsg);
  console.log(`Automatisch erkannte Zone: EPSG:${epsgCode} (Zone ${best.zone}, Ø Länge ${best.avgLon.toFixed(4)}°)`);
}

// Convert
const { results, warnings } = convertPoints(data, epsgCode);

if (warnings > 0) {
  console.warn(`Warnung: ${warnings} Punkt(e) ohne gültige GPS-Koordinaten.`);
}

// Write output
const csv = generateCSV(results, separator);
fs.writeFileSync(outputFile, csv, 'utf-8');
console.log(`Ausgabe: ${outputFile} (${results.length} Punkte, EPSG:${epsgCode})`);
