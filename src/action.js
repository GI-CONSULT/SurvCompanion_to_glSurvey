const core = require('@actions/core');
const fs = require('fs');
const path = require('path');
const { parseCSV, convertPoints, generateCSV, detectBestZone } = require('./converter');

async function run() {
  try {
    // Read inputs
    const inputFile = core.getInput('input-file', { required: true });
    const outputFile = core.getInput('output-file', { required: true });
    let epsgCode = core.getInput('epsg-code');
    const separator = core.getInput('separator') || ';';

    // Resolve paths relative to workspace
    const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
    const inputPath = path.resolve(workspace, inputFile);
    const outputPath = path.resolve(workspace, outputFile);

    // Guard against path traversal
    if (!inputPath.startsWith(workspace + path.sep) && inputPath !== workspace) {
      core.setFailed(`Sicherheitsfehler: Die Eingabedatei muss sich innerhalb des Workspace befinden.`);
      return;
    }
    if (!outputPath.startsWith(workspace + path.sep) && outputPath !== workspace) {
      core.setFailed(`Sicherheitsfehler: Die Ausgabedatei muss sich innerhalb des Workspace befinden.`);
      return;
    }

    // Validate EPSG input
    const validEpsg = ['auto', '5681', '5682', '5683', '5684', '5685'];
    if (!validEpsg.includes(epsgCode)) {
      core.setFailed(`Ungültiger EPSG-Code: "${epsgCode}". Erlaubt: auto, 5681–5685`);
      return;
    }

    // Validate separator
    const validSeparators = [';', ',', '\t'];
    if (!validSeparators.includes(separator)) {
      core.setFailed(`Ungültiges Trennzeichen: "${separator}". Erlaubt: ; , \\t`);
      return;
    }

    // Validate input file
    if (!fs.existsSync(inputPath)) {
      core.setFailed(`Eingabedatei nicht gefunden: ${inputPath}`);
      return;
    }

    core.info(`Lese Eingabedatei: ${inputPath}`);
    const csvText = fs.readFileSync(inputPath, 'utf-8');

    // Parse CSV
    const { data, errors, hints } = parseCSV(csvText);
    if (errors.length > 0) {
      core.setFailed(errors.join('; '));
      return;
    }

    if (hints.length > 0) {
      hints.forEach(h => core.warning(`Hinweis: ${h}`));
    }

    core.info(`${data.length} Vermessungspunkte eingelesen.`);

    // Auto-detect zone if set to 'auto'
    if (!epsgCode || epsgCode === 'auto') {
      const best = detectBestZone(data);
      if (!best) {
        core.setFailed('Keine gültigen GPS-Koordinaten gefunden. Automatische Zonenerkennung nicht möglich.');
        return;
      }
      epsgCode = String(best.epsg);
      core.info(`Automatisch erkannte Zone: EPSG:${epsgCode} (Zone ${best.zone}, Durchschnittslänge ${best.avgLon.toFixed(4)}°)`);
    }

    // Convert
    core.info(`Konvertiere nach EPSG:${epsgCode}...`);
    const { results, warnings } = convertPoints(data, epsgCode);

    if (warnings > 0) {
      core.warning(`${warnings} Punkt(e) hatten keine gültigen GPS-Koordinaten.`);
    }

    // Generate output CSV
    const csv = generateCSV(results, separator);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, csv, 'utf-8');
    core.info(`Ausgabe geschrieben: ${outputPath} (${results.length} Punkte)`);

    // Set outputs
    core.setOutput('output-file', outputPath);
    core.setOutput('point-count', results.length);
    core.setOutput('epsg-code', epsgCode);
    core.setOutput('warnings', warnings);

  } catch (error) {
    core.setFailed(`Fehler: ${error.message}`);
  }
}

run();
