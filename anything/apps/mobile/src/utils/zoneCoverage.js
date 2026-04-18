import { getDistanceMeters } from "@/utils/geo";
import { buildMapPolygonsFromBoundary } from "@/utils/zoneGeometry";

const APPROXIMATE_RADIUS_MIN_METERS = 38;
const APPROXIMATE_RADIUS_MAX_METERS = 180;

const normalizeCoordinate = (value) => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getZoneCenter = (zone) => {
  const latitude = normalizeCoordinate(zone?.center_lat ?? zone?.latitude);
  const longitude = normalizeCoordinate(zone?.center_lng ?? zone?.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
};

const closeRing = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length < 3) {
    return [];
  }

  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];

  if (
    first?.latitude === last?.latitude &&
    first?.longitude === last?.longitude
  ) {
    return coordinates;
  }

  return [...coordinates, first];
};

const getBoundaryRadiusMeters = (coordinates, center) => {
  if (!Array.isArray(coordinates) || !center) {
    return null;
  }

  const distances = coordinates
    .map((coordinate) => getDistanceMeters(center, coordinate))
    .filter((distance) => Number.isFinite(distance));

  if (distances.length === 0) {
    return null;
  }

  return Math.max(...distances);
};

const parseGeoJson = (input) => {
  if (!input) {
    return null;
  }

  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  }

  return typeof input === "object" ? input : null;
};

const extractLineGeometry = (input) => {
  const parsed = parseGeoJson(input);
  if (!parsed) {
    return null;
  }

  if (parsed.type === "Feature") {
    return extractLineGeometry(parsed.geometry);
  }

  if (parsed.type === "FeatureCollection") {
    const feature = (parsed.features || []).find((candidate) =>
      ["LineString", "MultiLineString"].includes(candidate?.geometry?.type),
    );
    return feature?.geometry || null;
  }

  if (["LineString", "MultiLineString"].includes(parsed.type)) {
    return parsed;
  }

  return null;
};

const buildMapPolylinesFromGeometry = (input) => {
  const geometry = extractLineGeometry(input);
  if (!geometry) {
    return [];
  }

  const lineSets =
    geometry.type === "LineString"
      ? [geometry.coordinates]
      : geometry.type === "MultiLineString"
        ? geometry.coordinates
        : [];

  return lineSets
    .map((line) =>
      (line || [])
        .map((coordinate) => {
          const longitude = normalizeCoordinate(coordinate?.[0]);
          const latitude = normalizeCoordinate(coordinate?.[1]);

          if (latitude === null || longitude === null) {
            return null;
          }

          return { latitude, longitude };
        })
        .filter(Boolean),
    )
    .filter((line) => line.length >= 2);
};

const parseBetweenSegment = (text) => {
  const match = String(text || "")
    .trim()
    .match(/^(.+?)\s+between\s+(.+?)\s+and\s+(.+)$/i);

  if (!match) {
    return null;
  }

  return {
    streetName: match[1].trim(),
    fromStreet: match[2].trim(),
    toStreet: match[3].trim(),
  };
};

const parseIntersectionCue = (text) => {
  const match = String(text || "")
    .trim()
    .match(/^Intersection of\s+(.+?)\s+and\s+(.+)$/i);

  if (!match) {
    return null;
  }

  return {
    streetName: match[1].trim(),
    crossStreet: match[2].trim(),
  };
};

const getRuleSegments = (zone) =>
  String(zone?.rules_description || zone?.rules || "")
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);

const parseLengthMeters = (zone) => {
  const rulesText = String(zone?.rules_description || zone?.rules || "");
  const match = rulesText.match(/Length:\s*([0-9]+(?:\.[0-9]+)?)\s*m/i);
  const lengthMeters = match ? Number.parseFloat(match[1]) : null;
  return Number.isFinite(lengthMeters) ? lengthMeters : null;
};

const getSourceDataset = (zone) => String(zone?.sourceDataset || zone?.source_dataset || "").trim();

const getCoverageTextMetadata = (zone) => {
  const segments = getRuleSegments(zone);
  const betweenSegments = segments
    .map(parseBetweenSegment)
    .filter(Boolean);
  const intersectionCues = segments
    .map(parseIntersectionCue)
    .filter(Boolean);
  const carParkCue =
    segments
      .map((segment) => segment.match(/^Car park:\s*(.+)$/i)?.[1]?.trim())
      .find(Boolean) || null;
  const localityCue = String(zone?.localityName || zone?.locality_name || "").trim() || null;
  const lengthMeters = parseLengthMeters(zone);
  const sourceDataset = getSourceDataset(zone);

  const primaryBetweenSegment = betweenSegments[0] || null;
  const primaryCoverageLabel = primaryBetweenSegment
    ? `${primaryBetweenSegment.streetName} between ${primaryBetweenSegment.fromStreet} and ${primaryBetweenSegment.toStreet}`
    : carParkCue
      ? carParkCue
      : intersectionCues[0]
        ? `${intersectionCues[0].streetName} near ${intersectionCues[0].crossStreet}`
        : localityCue
          ? `${localityCue} parking area`
          : null;

  return {
    betweenSegments,
    intersectionCues,
    carParkCue,
    localityCue,
    sourceDataset,
    lengthMeters,
    coverageLabel: primaryCoverageLabel,
  };
};

const getCoverageGeometryCandidates = (zone) => [
  zone?.coverage_geojson,
  zone?.segment_geojson,
  zone?.street_segment_geojson,
  zone?.coverage_line_geojson,
  zone?.geometry_geojson,
  zone?.geometry,
  zone?.coverage,
];

const getApproximateRadiusMeters = (zone, center, polygons, textMetadata) => {
  const polygonRadius = polygons
    .map((coordinates) => getBoundaryRadiusMeters(coordinates, center))
    .filter((radius) => Number.isFinite(radius))
    .reduce((maxRadius, radius) => Math.max(maxRadius, radius), 0);

  if (polygonRadius > 0) {
    return Math.max(APPROXIMATE_RADIUS_MIN_METERS, Math.min(polygonRadius, 140));
  }

  if (Number.isFinite(textMetadata.lengthMeters)) {
    const corridorHalfLength = Math.max(textMetadata.lengthMeters * 0.45, 28);
    return Math.max(
      APPROXIMATE_RADIUS_MIN_METERS,
      Math.min(corridorHalfLength, APPROXIMATE_RADIUS_MAX_METERS),
    );
  }

  if (textMetadata.carParkCue) {
    return 72;
  }

  if (
    textMetadata.sourceDataset === "Vicmap Features of Interest (parking area subtype)" ||
    textMetadata.sourceDataset === "Car Parking Zones" ||
    textMetadata.sourceDataset === "City of Casey Parking Restriction Zones"
  ) {
    return 68;
  }

  if (textMetadata.localityCue) {
    return 54;
  }

  return 48;
};

const createApproximateCircle = (center, radius) => {
  if (!center || !Number.isFinite(radius) || radius <= 0) {
    return null;
  }

  return {
    center,
    radius,
  };
};

const getCoverageAccuracyLabel = (kind) => {
  if (kind === "polygon") {
    return "Exact zone area";
  }

  if (kind === "segment") {
    return "Exact street segment";
  }

  if (kind === "approximate") {
    return "Approximate coverage";
  }

  return "Pin only";
};

export const getZoneCoverageModel = (zone) => {
  if (!zone) {
    return {
      kind: "pin",
      accuracyLabel: getCoverageAccuracyLabel("pin"),
      coverageLabel: null,
      polygons: [],
      polylines: [],
      approximateCircle: null,
      usesApproximateHighlight: false,
    };
  }

  const center = getZoneCenter(zone);
  const polygons = buildMapPolygonsFromBoundary(zone?.boundary_geojson);
  const textMetadata = getCoverageTextMetadata(zone);
  const exactLineGeometry = getCoverageGeometryCandidates(zone)
    .map((candidate) => buildMapPolylinesFromGeometry(candidate))
    .find((candidate) => candidate.length > 0) || [];

  if (polygons.length > 0) {
    return {
      kind: "polygon",
      accuracyLabel: getCoverageAccuracyLabel("polygon"),
      coverageLabel:
        textMetadata.coverageLabel ||
        (textMetadata.localityCue ? `${textMetadata.localityCue} parking area` : null),
      polygons,
      polylines: [],
      approximateCircle: null,
      usesApproximateHighlight: false,
    };
  }

  if (exactLineGeometry.length > 0) {
    return {
      kind: "segment",
      accuracyLabel: getCoverageAccuracyLabel("segment"),
      coverageLabel: textMetadata.coverageLabel,
      polygons: [],
      polylines: exactLineGeometry,
      approximateCircle: null,
      usesApproximateHighlight: false,
    };
  }

  if (!center) {
    return {
      kind: "pin",
      accuracyLabel: getCoverageAccuracyLabel("pin"),
      coverageLabel: textMetadata.coverageLabel,
      polygons: [],
      polylines: [],
      approximateCircle: null,
      usesApproximateHighlight: false,
    };
  }

  const shouldUseApproximateSegment =
    textMetadata.betweenSegments.length > 0 && Number.isFinite(textMetadata.lengthMeters);
  const approximateRadiusMeters = getApproximateRadiusMeters(
    zone,
    center,
    polygons,
    textMetadata,
  );

  if (
    shouldUseApproximateSegment ||
    textMetadata.carParkCue ||
    textMetadata.localityCue ||
    textMetadata.sourceDataset
  ) {
    return {
      kind: "approximate",
      accuracyLabel: getCoverageAccuracyLabel("approximate"),
      coverageLabel: textMetadata.coverageLabel,
      polygons: [],
      polylines: [],
      approximateCircle: createApproximateCircle(center, approximateRadiusMeters),
      usesApproximateHighlight: true,
    };
  }

  return {
    kind: "pin",
    accuracyLabel: getCoverageAccuracyLabel("pin"),
    coverageLabel: textMetadata.coverageLabel,
    polygons: [],
    polylines: [],
    approximateCircle: null,
    usesApproximateHighlight: false,
  };
};

export const getZoneCoverageSummary = (zone) => {
  const model = getZoneCoverageModel(zone);
  return {
    label: model.coverageLabel,
    accuracyLabel: model.accuracyLabel,
    kind: model.kind,
  };
};
