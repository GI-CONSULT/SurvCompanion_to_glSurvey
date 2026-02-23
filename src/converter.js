const proj4 = require('proj4');
const Papa = require('papaparse');

/**
 * DB_REF / 3-degree Gauss-Krüger zone definitions (EPSG:5681–5685)
 */
const EPSG_DEFS = {
  5681: { zone: 1, cm: 3,  proj4: '+proj=tmerc +lat_0=0 +lon_0=3  +k=1 +x_0=1500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs' },
  5682: { zone: 2, cm: 6,  proj4: '+proj=tmerc +lat_0=0 +lon_0=6  +k=1 +x_0=2500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs' },
  5683: { zone: 3, cm: 9,  proj4: '+proj=tmerc +lat_0=0 +lon_0=9  +k=1 +x_0=3500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs' },
  5684: { zone: 4, cm: 12, proj4: '+proj=tmerc +lat_0=0 +lon_0=12 +k=1 +x_0=4500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs' },
  5685: { zone: 5, cm: 15, proj4: '+proj=tmerc +lat_0=0 +lon_0=15 +k=1 +x_0=5500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs' },
};

// Register definitions
for (const [code, def] of Object.entries(EPSG_DEFS)) {
  proj4.defs(`EPSG:${code}`, def.proj4);
}

/**
 * Detect the best GK zone based on average longitude of points.
 * @param {Array<{gps_longitude: string}>} rows
 * @returns {{ epsg: number, zone: number, avgLon: number } | null}
 */
function detectBestZone(rows) {
  let sumLon = 0, count = 0;
  for (const row of rows) {
    const lon = parseFloat(row.gps_longitude);
    if (!isNaN(lon)) { sumLon += lon; count++; }
  }
  if (count === 0) return null;
  const avgLon = sumLon / count;
  // Find zone whose central meridian is closest to avgLon
  let best = null, bestDist = Infinity;
  for (const [code, def] of Object.entries(EPSG_DEFS)) {
    const dist = Math.abs(avgLon - def.cm);
    if (dist < bestDist) { bestDist = dist; best = { epsg: Number(code), zone: def.zone, avgLon }; }
  }
  return best;
}

/**
 * Parse a SurvComp CSV string.
 * @param {string} csvText - Raw CSV content
 * @returns {{ data: object[], errors: string[] }}
 */
function parseCSV(csvText) {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
  });

  const errors = [];

  if (result.errors.length > 0 && result.data.length === 0) {
    errors.push(`CSV-Parsing-Fehler: ${result.errors[0].message}`);
    return { data: [], errors, hints: [] };
  }

  const critical = ['punkt_id', 'gps_latitude', 'gps_longitude'];
  const headers = result.meta.fields || [];
  const missing = critical.filter(h => !headers.includes(h));
  if (missing.length > 0) {
    errors.push(`Fehlende Pflichtspalten: ${missing.join(', ')}. Ist das eine SurvComp-Datei?`);
    return { data: [], errors, hints: [] };
  }

  const hints = [];
  const optional = ['hoehe', 'art', 'bemerkungen'];
  const missingOptional = optional.filter(h => !headers.includes(h));
  if (missingOptional.length > 0) {
    hints.push(`Optionale Spalten fehlen: ${missingOptional.join(', ')} — Standardwerte werden verwendet.`);
  }

  const data = result.data.filter(row => row.punkt_id && row.punkt_id.trim());
  return { data, errors, hints };
}

/**
 * Convert parsed SurvComp rows to gl-Survey output format.
 *
 * @param {object[]} rows - Parsed CSV rows
 * @param {number|string} epsgCode - Target EPSG code (5681–5685)
 * @returns {{ results: object[], warnings: number }}
 */
function convertPoints(rows, epsgCode) {
  const code = String(epsgCode);
  if (!EPSG_DEFS[code]) {
    throw new Error(`Ungültiger EPSG-Code: ${code}. Erlaubt: 5681–5685`);
  }

  const targetProj = `EPSG:${code}`;
  const results = [];
  let warnings = 0;

  for (const row of rows) {
    const lat = parseFloat(row.gps_latitude);
    const lon = parseFloat(row.gps_longitude);
    const hoehe = row.hoehe ? parseFloat(row.hoehe) : NaN;
    const artRaw = (row.art || '').trim();
    const bemerkung = (row.bemerkungen || '').trim().replace(/\r?\n/g, ' ');

    if (isNaN(lat) || isNaN(lon)) {
      warnings++;
      results.push({
        Punktnummer: row.punkt_id,
        Rechtswert: '',
        Hochwert: '',
        'Höhe': !isNaN(hoehe) ? hoehe.toFixed(3) : '',
        Art: artRaw,
        Bemerkung: bemerkung,
      });
      continue;
    }

    const [easting, northing] = proj4('EPSG:4326', targetProj, [lon, lat]);

    results.push({
      Punktnummer: row.punkt_id,
      Rechtswert: easting.toFixed(3),
      Hochwert: northing.toFixed(3),
      'Höhe': !isNaN(hoehe) ? hoehe.toFixed(3) : '',
      Art: artRaw,
      Bemerkung: bemerkung,
    });
  }

  return { results, warnings };
}

/**
 * Generate output CSV string from converted points.
 *
 * @param {object[]} results - Converted point objects
 * @param {string} separator - CSV separator (default: ';')
 * @returns {string} CSV content with UTF-8 BOM
 */
function generateCSV(results, separator = ';') {
  const columns = ['Punktnummer', 'Rechtswert', 'Hochwert', 'Höhe', 'Art', 'Bemerkung'];

  function escapeField(value) {
    const str = String(value ?? '');
    if (str.includes(separator) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  const header = columns.join(separator);
  const rows = results.map(r =>
    columns.map(col => escapeField(r[col])).join(separator)
  );

  return '\uFEFF' + header + '\r\n' + rows.join('\r\n') + '\r\n';
}

module.exports = {
  EPSG_DEFS,
  detectBestZone,
  parseCSV,
  convertPoints,
  generateCSV,
};
