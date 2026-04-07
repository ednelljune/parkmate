import { getDistanceMeters } from "@/utils/geo";

const ZONE_MATCH_DISTANCE_METERS = 30;

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeZoneType = (value) => {
  const normalized = normalizeText(value);

  switch (normalized) {
    case "full hour":
    case "fh":
      return "full hour";
    case "loading zone":
    case "loading":
      return "loading zone";
    default:
      return normalized;
  }
};

const getZoneName = (zone) => normalizeText(zone?.name || zone?.zone_name);
const getZoneType = (zone) => normalizeZoneType(zone?.zone_type || zone?.type);

const getZoneCoordinate = (zone) => {
  const latitude = Number(zone?.center_lat ?? zone?.latitude);
  const longitude = Number(zone?.center_lng ?? zone?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
};

export const areSameZone = (leftZone, rightZone) => {
  if (!leftZone || !rightZone) return false;

  const leftType = getZoneType(leftZone);
  const rightType = getZoneType(rightZone);
  if (!leftType || !rightType || leftType !== rightType) {
    return false;
  }

  const leftCoordinate = getZoneCoordinate(leftZone);
  const rightCoordinate = getZoneCoordinate(rightZone);
  if (!leftCoordinate || !rightCoordinate) {
    return false;
  }

  const distance = getDistanceMeters(leftCoordinate, rightCoordinate);
  if (distance === null || distance > ZONE_MATCH_DISTANCE_METERS) {
    return false;
  }

  const leftName = getZoneName(leftZone);
  const rightName = getZoneName(rightZone);

  if (!leftName || !rightName) {
    return true;
  }

  return (
    leftName === rightName ||
    leftName.includes(rightName) ||
    rightName.includes(leftName)
  );
};

export const filterOverlappingZones = (zones, referenceZones) =>
  zones.filter(
    (zone) => !referenceZones.some((referenceZone) => areSameZone(zone, referenceZone)),
  );

export const mergeDistinctZones = (primaryZones, secondaryZones) => [
  ...primaryZones,
  ...filterOverlappingZones(secondaryZones, primaryZones),
];
