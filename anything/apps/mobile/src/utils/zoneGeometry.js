const normalizeCoordinate = (value) => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseBoundaryGeometry = (boundary) => {
  if (!boundary) return null;

  const parsedBoundary =
    typeof boundary === "string"
      ? (() => {
          try {
            return JSON.parse(boundary);
          } catch {
            return null;
          }
        })()
      : boundary;

  if (!parsedBoundary || typeof parsedBoundary !== "object") {
    return null;
  }

  if (parsedBoundary.type === "Feature") {
    return parseBoundaryGeometry(parsedBoundary.geometry);
  }

  if (parsedBoundary.type === "FeatureCollection") {
    const polygonFeature = (parsedBoundary.features || []).find((feature) =>
      ["Polygon", "MultiPolygon"].includes(feature?.geometry?.type),
    );
    return polygonFeature?.geometry || null;
  }

  if (["Polygon", "MultiPolygon"].includes(parsedBoundary.type)) {
    return parsedBoundary;
  }

  return null;
};

export const buildMapPolygonsFromBoundary = (boundary) => {
  const geometry = parseBoundaryGeometry(boundary);
  if (!geometry) {
    return [];
  }

  const polygonSets =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [];

  return polygonSets
    .map((polygon) => {
      const outerRing = Array.isArray(polygon) ? polygon[0] : null;
      if (!Array.isArray(outerRing)) {
        return null;
      }

      const coordinates = outerRing
        .map((coordinate) => {
          const longitude = normalizeCoordinate(coordinate?.[0]);
          const latitude = normalizeCoordinate(coordinate?.[1]);

          if (latitude === null || longitude === null) {
            return null;
          }

          return { latitude, longitude };
        })
        .filter(Boolean);

      return coordinates.length >= 3 ? coordinates : null;
    })
    .filter(Boolean);
};

const getPolygonRings = (boundary) => {
  const geometry = parseBoundaryGeometry(boundary);
  if (!geometry) {
    return [];
  }

  if (geometry.type === "Polygon") {
    return [geometry.coordinates];
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates;
  }

  return [];
};

const isPointInRing = (point, ring) => {
  if (!Array.isArray(ring) || ring.length < 3) {
    return false;
  }

  const pointLongitude = normalizeCoordinate(point?.longitude);
  const pointLatitude = normalizeCoordinate(point?.latitude);

  if (pointLongitude === null || pointLatitude === null) {
    return false;
  }

  let isInside = false;

  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index++) {
    const currentLongitude = normalizeCoordinate(ring[index]?.[0]);
    const currentLatitude = normalizeCoordinate(ring[index]?.[1]);
    const previousLongitude = normalizeCoordinate(ring[previousIndex]?.[0]);
    const previousLatitude = normalizeCoordinate(ring[previousIndex]?.[1]);

    if (
      currentLongitude === null ||
      currentLatitude === null ||
      previousLongitude === null ||
      previousLatitude === null
    ) {
      continue;
    }

    const intersects =
      currentLatitude > pointLatitude !== previousLatitude > pointLatitude &&
      pointLongitude <
        ((previousLongitude - currentLongitude) * (pointLatitude - currentLatitude)) /
          (previousLatitude - currentLatitude) +
          currentLongitude;

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
};

export const isLocationInsideZoneBoundary = (boundary, location) => {
  if (!location) {
    return false;
  }

  const polygonSets = getPolygonRings(boundary);
  if (polygonSets.length === 0) {
    return false;
  }

  return polygonSets.some((polygon) => {
    const outerRing = Array.isArray(polygon) ? polygon[0] : null;
    const innerRings = Array.isArray(polygon) ? polygon.slice(1) : [];

    if (!isPointInRing(location, outerRing)) {
      return false;
    }

    return !innerRings.some((holeRing) => isPointInRing(location, holeRing));
  });
};
