import { useState, useCallback } from "react";
import { Alert } from "react-native";

export const useLocationSearch = (safeAnimateToRegion) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const fetchSuggestions = useCallback(async (input) => {
    if (!input || input.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const response = await fetch(
        `/api/places/autocomplete?input=${encodeURIComponent(input)}`,
      );

      const data = await response.json();

      if (data.predictions && data.predictions.length > 0) {
        setSuggestions(data.predictions);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  const searchLocation = useCallback(
    async (placeId, description) => {
      try {
        const detailsResponse = await fetch(
          `/api/places/details?place_id=${placeId}`,
        );

        const detailsData = await detailsResponse.json();

        if (detailsData.result && detailsData.result.geometry) {
          const location = detailsData.result.geometry.location;

          // Fetch parking spots at this location with 500m radius
          const spotsResponse = await fetch("/api/reports/nearby", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: location.lat,
              longitude: location.lng,
              radiusMeters: 500, // Updated to 500m
            }),
          });

          const spotsData = await spotsResponse.json();

          // Zoom to location
          safeAnimateToRegion(
            {
              latitude: location.lat,
              longitude: location.lng,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            1000,
          );

          setSearchQuery("");
          setSuggestions([]);

          return {
            success: true,
            spots: spotsData.spots || [],
            location: { lat: location.lat, lng: location.lng },
            count: spotsData.spots?.length || 0,
            address: description,
          };
        } else {
          Alert.alert("Not Found", "Could not find that location");
          return { success: false };
        }
      } catch (error) {
        console.error("Error searching location:", error);
        Alert.alert("Error", "Could not search location");
        return { success: false };
      }
    },
    [safeAnimateToRegion],
  );

  return {
    searchQuery,
    setSearchQuery,
    suggestions,
    loadingSuggestions,
    fetchSuggestions,
    searchLocation,
  };
};
