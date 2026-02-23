# SurvComp → gl-Survey Konverter

Konvertiert Vermessungspunkte aus **SurveyCompanion (SurvComp)**-CSV-Exporten von WGS 84 (EPSG:4326) in **Gauß-Krüger DB_REF-Koordinaten** (EPSG:5681–5685) für den Import in **gl-Survey**.

## Features

- **Koordinatentransformation** – WGS 84 → Gauß-Krüger (DB_REF / 3°-Streifen, EPSG:5681–5685) via [proj4js](https://github.com/proj4js/proj4js)
- **Automatische Zonenerkennung** – Bestimmt anhand der durchschnittlichen Länge automatisch die passende GK-Zone
- **Drei Nutzungswege:**
  - **Web-Oberfläche** – Einzelne HTML-Datei mit Drag & Drop, Vorschau-Tabelle und Leaflet-Kartenansicht
  - **GitHub Action** – Automatische Konvertierung in CI/CD-Pipelines
  - **CLI** – Kommandozeilen-Tool für lokale Nutzung
- **gl-Survey-kompatible Ausgabe** – CSV mit Semikolon-Trennung, UTF-8 BOM und den Spalten `Punktnummer`, `Rechtswert`, `Hochwert`, `Höhe`, `Art`, `Bemerkung`

## Unterstützte EPSG-Codes

| EPSG | GK-Zone | Mittelmeridian | Abdeckung (ca.) |
|------|---------|----------------|-----------------|
| 5681 | 1       | 3°             | Westliches Deutschland |
| 5682 | 2       | 6°             | Westdeutschland |
| 5683 | 3       | 9°             | Mitteldeutschland |
| 5684 | 4       | 12°            | Ostdeutschland |
| 5685 | 5       | 15°            | Östliches Deutschland |

## Eingabeformat (SurvComp CSV)

Die CSV-Datei muss mindestens folgende Spalten enthalten:

| Spalte | Beschreibung |
|--------|-------------|
| `punkt_id` | Eindeutige Punktkennung |
| `gps_latitude` | Breitengrad (WGS 84, Dezimalgrad) |
| `gps_longitude` | Längengrad (WGS 84, Dezimalgrad) |
| `hoehe` | Höhe in Metern |
| `art` | Punktart (z. B. PS4, LHP, TP) |

Optional: `bemerkungen` – wird als Freitext übernommen.

## Ausgabeformat (gl-Survey CSV)

```csv
Punktnummer;Rechtswert;Hochwert;Höhe;Art;Bemerkung
81-29T;3588021.123;5480123.456;415.600;PS4;
```

---

## Nutzung

### 1. Web-Oberfläche

Einfach `index.html` im Browser öffnen – keine Installation nötig.

1. CSV-Datei per Drag & Drop oder Dateiauswahl laden
2. EPSG-Code wählen oder auf **Auto** belassen
3. Punkte werden in Tabelle und Karte angezeigt
4. Mit **Download** die konvertierte CSV-Datei herunterladen

> Die Web-Oberfläche läuft komplett lokal im Browser. Es werden keine Daten an einen Server gesendet.

### 2. GitHub Action

Kann als GitHub Action in eigenen Workflows verwendet werden:

```yaml
name: Vermessungspunkte konvertieren

on:
  push:
    paths:
      - '**.csv'

jobs:
  convert:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: SurvComp → gl-Survey
        uses: GI-CONSULT/SurvCompanion_to_glSurvey@main
        with:
          input-file: 'vermessungspunkte.csv'
          output-file: 'output_glsurvey.csv'
          epsg-code: 'auto'     # oder 5681–5685
          separator: ';'        # oder , oder Tab

      - name: Ergebnis hochladen
        uses: actions/upload-artifact@v4
        with:
          name: gl-survey-export
          path: output_glsurvey.csv
```

#### Inputs

| Parameter | Pflicht | Standard | Beschreibung |
|-----------|---------|----------|-------------|
| `input-file` | ✅ | – | Pfad zur SurvComp-CSV-Datei |
| `output-file` | ✅ | `output_glsurvey.csv` | Pfad für die Ausgabedatei |
| `epsg-code` | ❌ | `auto` | Ziel-EPSG-Code (`5681`–`5685`) oder `auto` |
| `separator` | ❌ | `;` | CSV-Trennzeichen (`;`, `,` oder Tab) |

#### Outputs

| Output | Beschreibung |
|--------|-------------|
| `output-file` | Pfad zur erzeugten CSV-Datei |
| `point-count` | Anzahl konvertierter Punkte |
| `epsg-code` | Verwendeter EPSG-Code |
| `warnings` | Anzahl Punkte ohne gültige Koordinaten |

### 3. CLI (Kommandozeile)

```bash
# Installation der Abhängigkeiten
npm install

# Konvertierung starten
npm run convert -- vermessungspunkte.csv

# Mit Optionen
node src/cli.js vermessungspunkte.csv --epsg 5683 --output ergebnis.csv --sep ";"
```

#### CLI-Optionen

| Option | Beschreibung | Standard |
|--------|-------------|----------|
| `--epsg <code>` | Ziel-EPSG-Code (5681–5685) | `auto` |
| `--output <datei>` | Ausgabedatei | `<eingabe>_glsurvey.csv` |
| `--sep <zeichen>` | CSV-Trennzeichen | `;` |
| `--help` | Hilfe anzeigen | – |

---

## Entwicklung

```bash
# Abhängigkeiten installieren
npm install

# GitHub Action für Distribution bauen
npm run build
```

Die Action wird mit [@vercel/ncc](https://github.com/vercel/ncc) in `dist/index.js` kompiliert.

## Technologie

- **[proj4js](https://github.com/proj4js/proj4js)** – Koordinatentransformation
- **[PapaParse](https://www.papaparse.com/)** – CSV-Parsing
- **[Leaflet](https://leafletjs.com/)** – Kartenansicht in der Web-Oberfläche
- **[@actions/core](https://github.com/actions/toolkit)** – GitHub Actions Integration

## Lizenz

MIT
