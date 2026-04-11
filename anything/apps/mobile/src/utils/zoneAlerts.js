import { getDistanceMeters } from "@/utils/geo";

const toFiniteNumber = (value) => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getApiZoneCenter = (zone) => {
  const latitude = toFiniteNumber(zone?.center_lat);
  const longitude = toFiniteNumber(zone?.center_lng);

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
};

export const getApiZoneEffectiveDistanceMeters = (zone, location) => {
  const backendDistance = toFiniteNumber(zone?.distance_meters);
  if (backendDistance !== null) {
    return backendDistance;
  }

  const center = getApiZoneCenter(zone);
  if (!center) {
    return null;
  }

  return getDistanceMeters(location, center);
};

export const isApiZoneWithinRadius = (zone, location, radiusMeters) => {
  const distance = getApiZoneEffectiveDistanceMeters(zone, location);
  return (
    distance !== null &&
    Number.isFinite(radiusMeters) &&
    distance <= radiusMeters
  );
};

export const normalizeApiZoneAlert = (zone, location) => {
  const center = getApiZoneCenter(zone);
  if (!center) {
    return null;
  }

  return {
    id: `zone-${zone.id}`,
    alertType: "zone",
    zoneId: zone.id,
    zone_name: zone.name || "Parking zone",
    zone_type: zone.zone_type || "Parking",
    capacity_spaces: zone.capacity_spaces ?? null,
    rules_description: zone.rules_description || "",
    distance_meters: getApiZoneEffectiveDistanceMeters(zone, location) ?? 0,
    center_lat: center.latitude,
    center_lng: center.longitude,
  };
};

export const normalizeCouncilZoneAlert = (
  zone,
  location,
  radiusMeters = null,
) => {
  if (!location) {
    return null;
  }

  const latitude = toFiniteNumber(zone?.latitude);
  const longitude = toFiniteNumber(zone?.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  const distance = getDistanceMeters(location, {
    latitude,
    longitude,
  });

  if (
    radiusMeters != null &&
    (distance === null || distance > radiusMeters)
  ) {
    return null;
  }

  return {
    id: `council-zone-${zone.id}`,
    alertType: "zone",
    zoneId: zone.id,
    zone_name: zone.name || "Parking zone",
    zone_type: zone.type || zone.zone_type || "Parking",
    capacity_spaces: zone.capacity_spaces ?? zone.capacitySpaces ?? null,
    rules_description: zone.rules || zone.rules_description || "",
    distance_meters: distance ?? 0,
    center_lat: latitude,
    center_lng: longitude,
  };
};
