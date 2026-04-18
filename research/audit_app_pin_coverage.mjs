import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = path.join(
  process.env.HOME || "",
  "Downloads",
  "victoria_suburbs_public_parking_template.csv",
);
const researchedPath = path.join(
  rootDir,
  "anything",
  "apps",
  "mobile",
  "src",
  "constants",
  "researchedPublicParkingZones.js",
);
const localCouncilPath = path.join(
  rootDir,
  "anything",
  "apps",
  "mobile",
  "src",
  "constants",
  "localCouncilParkings.js",
);
const outputPath = path.join(
  rootDir,
  "research",
  "victoria-suburb-merged-app-pin-coverage-audit.csv",
);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...dataRows] = rows;
  return dataRows.map((cells) =>
    Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ""])),
  );
}

function parseResearchedPins() {
  const text = fs.readFileSync(researchedPath, "utf8");
  const start = text.indexOf("[");
  const end = text.lastIndexOf("];");
  return JSON.parse(text.slice(start, end + 1));
}

function parseBaseLocalCouncilPins() {
  const text = fs.readFileSync(localCouncilPath, "utf8");
  const marker = "const BASE_LOCAL_COUNCIL_PARKINGS = ";
  const start = text.indexOf(marker);
  const arrayStart = text.indexOf("[", start);
  const exportMarker = "export const LOCAL_COUNCIL_PARKINGS";
  const exportStart = text.indexOf(exportMarker, arrayStart);
  const arrayEnd = text.lastIndexOf("];", exportStart);
  const arraySource = text.slice(arrayStart, arrayEnd + 1);
  return Function(`"use strict"; return (${arraySource});`)();
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) {
    return text;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

const templateRows = parseCsv(fs.readFileSync(templatePath, "utf8"));
const researchedPins = parseResearchedPins();
const localCouncilPins = parseBaseLocalCouncilPins();
const allPins = [...localCouncilPins, ...researchedPins];

const byLocality = new Map();
for (const pin of allPins) {
  const localityName = normalize(pin.localityName);
  if (!localityName) {
    continue;
  }
  if (!byLocality.has(localityName)) {
    byLocality.set(localityName, []);
  }
  byLocality.get(localityName).push(pin);
}

const enrichedRows = templateRows.map((row) => {
  const locality = normalize(row.suburb_locality_name);
  const matches = byLocality.get(locality) || [];
  const sources = [...new Set(matches.map((pin) => pin.sourceDataset || "Base local council curation"))].sort();
  return {
    ...row,
    app_has_any_pin_data: matches.length > 0,
    app_pin_count: matches.length,
    app_source_dataset_count: sources.length,
    app_source_datasets: sources.join(" | "),
  };
});

const fieldnames = [
  ...Object.keys(templateRows[0] || {}),
  "app_has_any_pin_data",
  "app_pin_count",
  "app_source_dataset_count",
  "app_source_datasets",
];

const csvLines = [
  fieldnames.join(","),
  ...enrichedRows.map((row) => fieldnames.map((field) => csvEscape(row[field])).join(",")),
];
fs.writeFileSync(outputPath, `${csvLines.join("\n")}\n`, "utf8");

const covered = enrichedRows.filter((row) => String(row.app_has_any_pin_data).toLowerCase() === "true").length;
console.log(`Wrote ${outputPath}`);
console.log(`Template localities: ${enrichedRows.length}`);
console.log(`Localities with any merged app pin data: ${covered}`);
console.log(`Localities without merged app pin data: ${enrichedRows.length - covered}`);
console.log(`Merged app pins counted: ${allPins.length}`);
