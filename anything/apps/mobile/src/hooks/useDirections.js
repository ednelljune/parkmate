import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { decodePolyline } from "@/utils/polylineDecoder";

export const useDirections = (location, safeAnimateToRegion) => {
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routeDistance, setRouteDistance] = useState(null);
  const [routeDuration, setRouteDuration] = useState(null);

  const getDirections = useCallback(
    async (target) => {
      if (!target || !location) {
        Alert.alert("Error", "Location not available");
        return;
      }

      try {
        const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          Alert.alert(
            "Navigation Unavailable",
            "In-app navigation is not configured yet on this build.",
          );
          return;
        }

        const origin = `${location.latitude},${location.longitude}`;
        const destination = `${target.latitude},${target.longitude}`;

        const response = await fetch(
          `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&key=${apiKey}`,
        );

        const data = await response.json();

        if (data.status === "OK" && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const polyline = route.overview_polyline.points;
          const decoded = decodePolyline(polyline);

          setRouteCoordinates(decoded);
          setRouteDistance(route.legs[0].distance.text);
          setRouteDuration(route.legs[0].duration.text);

          // Fit map to show entire route
          if (safeAnimateToRegion && decoded.length > 0) {
            const lats = decoded.map((coord) => coord.latitude);
            const lngs = decoded.map((coord) => coord.longitude);

            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);

            const centerLat = (minLat + maxLat) / 2;
            const centerLng = (minLng + maxLng) / 2;
            const latDelta = (maxLat - minLat) * 1.4;
            const lngDelta = (maxLng - minLng) * 1.4;

            safeAnimateToRegion(
              {
                latitude: centerLat,
                longitude: centerLng,
                latitudeDelta: Math.max(latDelta, 0.005),
                longitudeDelta: Math.max(lngDelta, 0.005),
              },
              1000,
            );
          }
        } else {
          Alert.alert(
            "Navigation Error",
            data?.error_message ||
              "Could not find a route to this location",
          );
        }
      } catch (error) {
        console.error("Error getting directions:", error);
        Alert.alert("Error", "Could not get directions. Please try again.");
      }
    },
    [location, safeAnimateToRegion],
  );

  const clearRoute = useCallback(() => {
    setRouteCoordinates([]);
    setRouteDistance(null);
    setRouteDuration(null);
  }, []);

  return {
    routeCoordinates,
    routeDistance,
    routeDuration,
    getDirections,
    clearRoute,
  };
};
