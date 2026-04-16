import { LOCAL_COUNCIL_PARKINGS } from "@/constants/localCouncilParkings";
import { getDistanceMeters } from "@/utils/geo";
import { filterOverlappingZones } from "@/utils/zoneDeduplication";
import { getApiZoneEffectiveDistanceMeters } from "@/utils/zoneAlerts";

export const MAX_DETECTED_API_ZONE_PINS = 12;
export const MAX_DETECTED_COUNCIL_ZONE_PINS = 12;

const getZoneCoordinate = (zone) => {
  const latitude = Number(zone?.center_lat ?? zone?.latitude);
  const longitude = Number(zone?.center_lng ?? zone?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
};

const hasValidZoneCoordinate = (zone) => getZoneCoordinate(zone) !== null;

export const limitZonesByDistance = (
  zones,
  focusCoordinate,
  maxCount,
  getZoneDistance = null,
  prioritizeZone = null,
) => {
  if (!Array.isArray(zones) || zones.length <= maxCount) {
    return zones;
  }

  if (!focusCoordinate && typeof prioritizeZone !== "function") {
    return zones.slice(0, maxCount);
  }

  return [...zones]
    .map((zone) => {
      const isPrioritized =
        typeof prioritizeZone === "function" && prioritizeZone(zone);
      const distance =
        typeof getZoneDistance === "function"
          ? getZoneDistance(zone, focusCoordinate)
          : (() => {
              const coordinate = getZoneCoordinate(zone);
              return coordinate
                ? getDistanceMeters(focusCoordinate, coordinate)
                : null;
            })();

      return {
        zone,
        distance: distance ?? Number.POSITIVE_INFINITY,
        isPrioritized,
      };
    })
    .sort((left, right) => {
      if (left.isPrioritized !== right.isPrioritized) {
        return left.isPrioritized ? -1 : 1;
      }

      if (left.distance !== right.distance) {
        return left.distance - right.distance;
      }

      return String(left.zone?.id || "").localeCompare(String(right.zone?.id || ""));
    })
    .slice(0, maxCount)
    .map((entry) => entry.zone);
};

export const getNearbyCouncilZones = (location, radiusMeters) => {
  if (!location) {
    return [];
  }

  return LOCAL_COUNCIL_PARKINGS.filter((zone) => {
    const distance = getDistanceMeters(location, {
      latitude: zone.latitude,
      longitude: zone.longitude,
    });

    return distance !== null && distance <= radiusMeters;
  });
};

export const getDetectedZonePins = ({
  apiZones = [],
  location,
  radiusMeters,
  focusCoordinate = location,
  prioritizeApiZone = null,
  prioritizeCouncilZone = null,
  maxApiZones = MAX_DETECTED_API_ZONE_PINS,
  maxCouncilZones = MAX_DETECTED_COUNCIL_ZONE_PINS,
}) => {
  const validApiZones = (apiZones || []).filter(hasValidZoneCoordinate);
  const nearbyApiZones =
    location && Number.isFinite(radiusMeters)
      ? validApiZones.filter((zone) => {
          const distance = getApiZoneEffectiveDistanceMeters(zone, location);
          return distance !== null && distance <= radiusMeters;
        })
      : validApiZones;
  const nearbyCouncilZones = getNearbyCouncilZones(location, radiusMeters).filter(
    hasValidZoneCoordinate,
  );
  const distinctCouncilZones = filterOverlappingZones(
    nearbyCouncilZones,
    nearbyApiZones,
  );

  return {
    apiZones: limitZonesByDistance(
      nearbyApiZones,
      focusCoordinate,
      maxApiZones,
      getApiZoneEffectiveDistanceMeters,
      prioritizeApiZone,
    ),
    councilZones: limitZonesByDistance(
      distinctCouncilZones,
      focusCoordinate,
      maxCouncilZones,
      null,
      prioritizeCouncilZone,
    ),
  };
};
