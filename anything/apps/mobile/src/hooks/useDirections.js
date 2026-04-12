import { useState, useCallback } from "react";
import { Alert, Linking, Platform } from "react-native";
import { decodePolyline } from "@/utils/polylineDecoder";

export const useDirections = (location, safeAnimateToRegion) => {
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routeDistance, setRouteDistance] = useState(null);
  const [routeDuration, setRouteDuration] = useState(null);

  const openExternalNavigation = useCallback(async (target) => {
    if (!target || !location) {
      Alert.alert("Error", "Location not available");
      return;
    }

    const origin = `${location.latitude},${location.longitude}`;
    const destination = `${target.latitude},${target.longitude}`;
    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?saddr=${origin}&daddr=${destination}&dirflg=d`
        : `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;

    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert("Navigation Error", "Could not open external navigation.");
      return;
    }

    await Linking.openURL(url);
  }, [location]);

  const getDirections = useCallback(
    async (target, options = {}) => {
      if (!target || !location) {
        Alert.alert("Error", "Location not available");
        return;
      }

      try {
        const shouldFitToRoute = options.fitToRoute !== false;
        const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          await openExternalNavigation(target);
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
          if (shouldFitToRoute && safeAnimateToRegion && decoded.length > 0) {
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
          if (data?.status === "REQUEST_DENIED") {
            await openExternalNavigation(target);
            return;
          }

          Alert.alert("Navigation Error", data?.error_message || "Could not find a route to this location");
        }
      } catch (error) {
        console.error("Error getting directions:", error);
        await openExternalNavigation(target).catch(() => {
          Alert.alert("Error", "Could not get directions. Please try again.");
        });
      }
    },
    [location, openExternalNavigation, safeAnimateToRegion],
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
