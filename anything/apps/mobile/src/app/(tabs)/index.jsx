import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Alert,
  Platform,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import MapView, { Circle, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useLocalSearchParams } from "expo-router";

import { useLocation } from "@/hooks/useLocation";
import {
  useParkingZones,
  useCurrentZone,
  useNearbyReports,
  useReportSpot,
  useClaimSpot,
  useReportFalseSpot,
  useVisibleParkingZones,
} from "@/hooks/useParkingData";
import { useDirections } from "@/hooks/useDirections";

import {
  UserLocationMarker,
  ParkingSpotMarkers,
  ParkingZoneMarkers,
  AndroidParkingSpotOverlay,
  AndroidParkingZoneOverlay,
} from "@/components/Map/MapMarkers";
import {
  ActionButtons,
  FLOATING_ACTION_BUTTON_SIDE_OFFSET,
  FLOATING_ACTION_BUTTON_SIZE,
  FLOATING_ACTION_BUTTON_BOTTOM_MARGIN,
} from "@/components/UI/ActionButtons";
import { MapBrandingBadge } from "@/components/UI/MapBrandingBadge";
import { ReportModal } from "@/components/Modals/ReportModal";
import { SpotDetailsModal } from "@/components/Modals/SpotDetailsModal";
import { ZoneMarkers, AndroidZoneOverlay } from "@/components/Map/ZoneMarkers";
import { ZoneDetailsModal } from "@/components/Modals/ZoneDetailsModal";
import useUser from "@/utils/auth/useUser";
import { LOCAL_COUNCIL_PARKINGS } from "@/constants/localCouncilParkings";
import { getDistanceMeters } from "@/utils/geo";
import { filterOverlappingZones } from "@/utils/zoneDeduplication";
import { BRAND_PALETTE } from "@/theme/brandColors";

const normalizeCoordinate = (value) => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const PARKING_TYPE_ORDER = [
  "1P",
  "2P",
  "3P",
  "4P",
  "Full Hour",
  "Loading Zone",
  "Permit",
  "No Parking",
];

const DEFAULT_MAP_DELTA = 0.005;
const COUNCIL_MARKERS_MAX_DELTA = 0.08;
const ZONE_MARKERS_MAX_DELTA = 0.04;
const VIEWPORT_PADDING_FACTOR = 0.2;
const FOLLOW_ANIMATION_DISTANCE_METERS = 12;
const FOLLOW_ANIMATION_INTERVAL_MS = 2500;
const MAP_PROVIDER = Platform.OS === "android" ? PROVIDER_GOOGLE : undefined;
const MAP_GOOGLE_RENDERER = Platform.OS === "android" ? "LEGACY" : undefined;
const OVERLAY_REFRESH_DEBOUNCE_MS = 180;
const MAX_ANDROID_ZONE_MARKERS = 140;
const MAX_ANDROID_COUNCIL_MARKERS = 48;
const MAX_VISIBLE_ZONE_MARKERS = 12;
const NEAREST_COUNCIL_MARKERS = 6;
const NAVIGATION_CARD_TO_ACTION_BUTTON_GAP = 12;
const NAVIGATION_CARD_WIDTH = 220;

const isCoordinateWithinRegion = (
  coordinate,
  region,
  paddingFactor = VIEWPORT_PADDING_FACTOR,
) => {
  if (!coordinate || !region) return false;

  const latitudePadding = (region.latitudeDelta || DEFAULT_MAP_DELTA) * paddingFactor;
  const longitudePadding =
    (region.longitudeDelta || DEFAULT_MAP_DELTA) * paddingFactor;

  const minLatitude =
    region.latitude - region.latitudeDelta / 2 - latitudePadding;
  const maxLatitude =
    region.latitude + region.latitudeDelta / 2 + latitudePadding;
  const minLongitude =
    region.longitude - region.longitudeDelta / 2 - longitudePadding;
  const maxLongitude =
    region.longitude + region.longitudeDelta / 2 + longitudePadding;

  return (
    coordinate.latitude >= minLatitude &&
    coordinate.latitude <= maxLatitude &&
    coordinate.longitude >= minLongitude &&
    coordinate.longitude <= maxLongitude
  );
};

const normalizeZoneIdentity = (name, type) => {
  const normalizedName = String(name || "").trim().toLowerCase();
  const normalizedType = String(type || "").trim().toLowerCase();
  return `${normalizedName}::${normalizedType}`;
};

const isMeteredZoneType = (zoneType) =>
  typeof zoneType === "string" && zoneType.toLowerCase().includes("meter");

const withoutMeteredZones = (zones) =>
  (zones || []).filter(
    (zone) => !isMeteredZoneType(zone.zone_type || zone.type),
  );

const limitZonesByDistance = (zones, focusCoord, maxCount) => {
  if (!Array.isArray(zones) || zones.length <= maxCount) {
    return zones;
  }

  if (!focusCoord) {
    return zones.slice(0, maxCount);
  }

  return [...zones]
    .map((zone) => {
      const latitude = Number(zone?.center_lat ?? zone?.latitude);
      const longitude = Number(zone?.center_lng ?? zone?.longitude);
      const distance =
        Number.isFinite(latitude) && Number.isFinite(longitude)
          ? getDistanceMeters(focusCoord, { latitude, longitude })
          : null;

      return { zone, distance: distance ?? Number.POSITIVE_INFINITY };
    })
    .sort((left, right) => {
      if (left.distance !== right.distance) {
        return left.distance - right.distance;
      }

      return String(left.zone?.id || "").localeCompare(String(right.zone?.id || ""));
    })
    .slice(0, maxCount)
    .map((entry) => entry.zone);
};

const getCoordinateDistanceFromRegionCenter = (
  coordinate,
  region,
) => {
  if (!coordinate || !region) {
    return Number.POSITIVE_INFINITY;
  }

  return (
    getDistanceMeters(coordinate, {
      latitude: region.latitude,
      longitude: region.longitude,
    }) ?? Number.POSITIVE_INFINITY
  );
};

const prioritizeMarkersForAndroid = ({
  markers,
  mapRegion,
  maxCount,
  selectedMarkerId = null,
  getCoordinate,
}) => {
  if (!Array.isArray(markers) || markers.length <= maxCount) {
    return markers;
  }

  return [...markers]
    .sort((left, right) => {
      const leftSelected =
        selectedMarkerId != null &&
        left?.id != null &&
        String(left.id) === String(selectedMarkerId);
      const rightSelected =
        selectedMarkerId != null &&
        right?.id != null &&
        String(right.id) === String(selectedMarkerId);

      if (leftSelected !== rightSelected) {
        return leftSelected ? -1 : 1;
      }

      const leftDistance = getCoordinateDistanceFromRegionCenter(
        getCoordinate(left),
        mapRegion,
      );
      const rightDistance = getCoordinateDistanceFromRegionCenter(
        getCoordinate(right),
        mapRegion,
      );

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      return String(left?.id || "").localeCompare(String(right?.id || ""));
    })
    .slice(0, maxCount);
};

const sanitizeZoneForSelection = (zone) => {
  if (!zone) return null;

  const latitude = Number(zone.center_lat);
  const longitude = Number(zone.center_lng);

  return {
    id: zone.id ?? null,
    name: String(zone.name || zone.zone_name || "Parking Zone").trim(),
    zone_type: String(zone.zone_type || zone.type || "Parking").trim(),
    capacity_spaces:
      zone.capacity_spaces ?? zone.capacitySpaces ?? zone.capacity ?? null,
    rules_description: String(zone.rules_description || zone.rules || "").trim(),
    center_lat: Number.isFinite(latitude) ? latitude : zone.center_lat,
    center_lng: Number.isFinite(longitude) ? longitude : zone.center_lng,
  };
};

const sanitizeSpotForSelection = (spot) => {
  if (!spot) return null;

  const latitude = normalizeCoordinate(spot.latitude);
  const longitude = normalizeCoordinate(spot.longitude);
  if (latitude === null || longitude === null) {
    return null;
  }

  const normalizedId =
    spot.id != null && spot.id !== ""
      ? Number.isFinite(Number(spot.id))
        ? Number(spot.id)
        : String(spot.id)
      : null;

  return {
    id: normalizedId,
    latitude,
    longitude,
    zone_name: String(spot.zone_name || spot.zoneName || "Parking Spot").trim(),
    zone_type: String(spot.zone_type || spot.parking_type || spot.zoneType || "Parking").trim(),
    parking_type: String(spot.parking_type || spot.zone_type || spot.zoneType || "Parking").trim(),
    status: String(spot.status || "available").trim(),
    distance_meters: Number.isFinite(Number(spot.distance_meters))
      ? Number(spot.distance_meters)
      : 0,
    expires_at: spot.expires_at || null,
    quantity: Number.isFinite(Number(spot.quantity))
      ? Math.max(1, Math.floor(Number(spot.quantity)))
      : 1,
    user_id: spot.user_id ?? null,
    zone_id: spot.zone_id ?? null,
  };
};

function ParkMateContent() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const mapRef = useRef(null);
  const mapRegionRef = useRef({
    latitude: -37.8136,
    longitude: 144.9631,
    latitudeDelta: DEFAULT_MAP_DELTA,
    longitudeDelta: DEFAULT_MAP_DELTA,
  });
  const lastFollowAnimationRef = useRef({
    coordinate: null,
    timestamp: 0,
  });
  const overlayRefreshTimeoutRef = useRef(null);
  const lastAutoNavigationRequestRef = useRef(null);
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams(); // Get navigation params
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedZoneOption, setSelectedZoneOption] = useState(null);
  const [spotQuantity, setSpotQuantity] = useState(1);
  const [selectedZone, setSelectedZone] = useState(null);
  const [pendingZoneReportSpot, setPendingZoneReportSpot] = useState(null);
  const [lastKnownReportZoneState, setLastKnownReportZoneState] = useState({
    options: [],
    location: null,
  });
  const [isFollowingLiveLocation, setIsFollowingLiveLocation] = useState(true);
  const [mapRegion, setMapRegion] = useState(mapRegionRef.current);
  const [mapOverlayRevision, setMapOverlayRevision] = useState(0);
  const scheduleOverlayRefresh = useCallback(
    (immediate = false) => {
      if (overlayRefreshTimeoutRef.current) {
        clearTimeout(overlayRefreshTimeoutRef.current);
        overlayRefreshTimeoutRef.current = null;
      }

      if (immediate) {
        setMapOverlayRevision((current) => current + 1);
        return;
      }

      overlayRefreshTimeoutRef.current = setTimeout(() => {
        setMapOverlayRevision((current) => current + 1);
        overlayRefreshTimeoutRef.current = null;
      }, OVERLAY_REFRESH_DEBOUNCE_MS);
    },
    [setMapOverlayRevision],
  );

  useEffect(() => {
    return () => {
      if (overlayRefreshTimeoutRef.current) {
        clearTimeout(overlayRefreshTimeoutRef.current);
        overlayRefreshTimeoutRef.current = null;
      }
    };
  }, []);

  const detectionRadius = 300; // 300m radius
  const { data: user } = useUser();
  const { location } = useLocation();
  const tabBarHeight = useBottomTabBarHeight();
  const focusCoordinate = useMemo(() => {
    if (location?.latitude != null && location?.longitude != null) {
      return {
        latitude: location.latitude,
        longitude: location.longitude,
      };
    }

    if (
      mapRegion?.latitude != null &&
      mapRegion?.longitude != null
    ) {
      return {
        latitude: mapRegion.latitude,
        longitude: mapRegion.longitude,
      };
    }

    return null;
  }, [
    location?.latitude,
    location?.longitude,
    mapRegion?.latitude,
    mapRegion?.longitude,
  ]);
  const isZoneWithinDetectionRadius = useCallback(
    (zone) => {
      if (!focusCoordinate || !zone) {
        return false;
      }

      const latitude = Number(zone.center_lat ?? zone.latitude);
      const longitude = Number(zone.center_lng ?? zone.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return false;
      }

      const distance = getDistanceMeters(focusCoordinate, {
        latitude,
        longitude,
      });
      return distance !== null && distance <= detectionRadius;
    },
    [detectionRadius, focusCoordinate],
  );

  // Safe wrapper — animateToRegion crashes on web (google.maps.LatLngBounds)
  const safeAnimateToRegion = useCallback((region, duration) => {
    if (!mapRef.current) return;
    try {
      const nextRegion = {
        latitude: region.latitude,
        longitude: region.longitude,
        latitudeDelta: region.latitudeDelta,
        longitudeDelta: region.longitudeDelta,
      };
      mapRegionRef.current = nextRegion;
      setMapRegion(nextRegion);
      mapRef.current.animateToRegion(nextRegion, duration);
    } catch (e) {
      // Not supported on web preview — initialRegion handles it
    }
  }, []);

  const focusMapRegion = useCallback(
    (region, duration) => {
      setIsFollowingLiveLocation(false);
      safeAnimateToRegion(region, duration);
    },
    [safeAnimateToRegion],
  );

  const handleRegionChangeComplete = useCallback((region, details) => {
    if (!region) return;

    mapRegionRef.current = {
      latitude: region.latitude,
      longitude: region.longitude,
      latitudeDelta:
        region.latitudeDelta || mapRegionRef.current.latitudeDelta,
      longitudeDelta:
        region.longitudeDelta || mapRegionRef.current.longitudeDelta,
    };
    setMapRegion(mapRegionRef.current);

    if (details?.isGesture) {
      setIsFollowingLiveLocation(false);
    }

    if (Platform.OS === "android") {
      scheduleOverlayRefresh(true);
    }
  }, [scheduleOverlayRefresh]);

  const handleRegionChange = useCallback(() => {
    if (Platform.OS !== "android") {
      return;
    }

    scheduleOverlayRefresh();
  }, [scheduleOverlayRefresh]);

  const handleMapReady = useCallback(() => {
    if (Platform.OS === "android") {
      scheduleOverlayRefresh(true);
    }
  }, [scheduleOverlayRefresh]);

  const nearbyZones = useParkingZones(location, detectionRadius);
  const currentZone = useCurrentZone(location);
  const { reports, refetch: refetchReports } = useNearbyReports(
    location,
    detectionRadius,
  );
  const {
    routeCoordinates,
    routeDistance,
    routeDuration,
    getDirections,
    clearRoute,
  } = useDirections(location, focusMapRegion);

  const startInAppNavigation = useCallback(
    (target, errorMessage = "Destination not available for navigation.") => {
      const latitude = normalizeCoordinate(
        target?.latitude ?? target?.center_lat,
      );
      const longitude = normalizeCoordinate(
        target?.longitude ?? target?.center_lng,
      );

      if (latitude === null || longitude === null) {
        Alert.alert("Navigation Error", errorMessage);
        return false;
      }

      if (!location) {
        Alert.alert("Location not found", "Wait for location to be detected.");
        return false;
      }

      setIsFollowingLiveLocation(false);
      clearRoute();
      getDirections({
        ...target,
        latitude,
        longitude,
      });
      return true;
    },
    [clearRoute, getDirections, location],
  );

  const currentMapDelta = Math.max(
    mapRegion?.latitudeDelta || DEFAULT_MAP_DELTA,
    mapRegion?.longitudeDelta || DEFAULT_MAP_DELTA,
  );
  const shouldRenderCouncilMarkers =
    currentMapDelta <= COUNCIL_MARKERS_MAX_DELTA;
  const shouldRenderZoneMarkers = currentMapDelta <= ZONE_MARKERS_MAX_DELTA;

  const apiVisibleZones = useVisibleParkingZones(mapRegion, shouldRenderZoneMarkers);
  const visibleZones = useMemo(
    () => withoutMeteredZones(apiVisibleZones),
    [apiVisibleZones],
  );
  const visibleZonesWithinRadius = useMemo(() => {
    if (!Array.isArray(visibleZones) || visibleZones.length === 0) {
      return [];
    }

    return visibleZones.filter((zone) => {
      if (
        selectedZone?.id != null &&
        zone?.id != null &&
        String(zone.id) === String(selectedZone.id)
      ) {
        return true;
      }

      return isZoneWithinDetectionRadius(zone);
    });
  }, [isZoneWithinDetectionRadius, selectedZone?.id, visibleZones]);
  const visibleZoneMarkers = useMemo(() => {
    let nextVisibleZones = limitZonesByDistance(
      visibleZonesWithinRadius,
      focusCoordinate,
      MAX_VISIBLE_ZONE_MARKERS,
    );

    if (selectedZone && Platform.OS === "android") {
      const selectedLatitude = Number(selectedZone.center_lat);
      const selectedLongitude = Number(selectedZone.center_lng);
      if (Number.isFinite(selectedLatitude) && Number.isFinite(selectedLongitude)) {
        const selectedZoneId =
          selectedZone.id != null ? String(selectedZone.id) : null;
        const alreadyVisible = nextVisibleZones.some((zone) => {
          if (selectedZoneId && zone?.id != null) {
            return String(zone.id) === selectedZoneId;
          }

          return (
            Number(zone?.center_lat) === selectedLatitude &&
            Number(zone?.center_lng) === selectedLongitude
          );
        });

        if (!alreadyVisible) {
          nextVisibleZones = [
            selectedZone,
            ...nextVisibleZones.slice(0, MAX_VISIBLE_ZONE_MARKERS - 1),
          ];
        }
      }
    }

    if (Platform.OS !== "android") {
      return nextVisibleZones;
    }

    return prioritizeMarkersForAndroid({
      markers: nextVisibleZones,
      mapRegion,
      maxCount: MAX_ANDROID_ZONE_MARKERS,
      selectedMarkerId: selectedZone?.id ?? null,
      getCoordinate: (zone) => ({
        latitude: Number(zone?.center_lat),
        longitude: Number(zone?.center_lng),
      }),
    });
  }, [mapRegion, selectedZone, visibleZonesWithinRadius]);
  const availableZoneOptions = useMemo(() => {
    const options = nearbyZones
      .map((zone) => {
        const parkingType = String(zone?.zone_type || "").trim();
        const zoneName = String(zone?.name || zone?.zone_name || "").trim();
        const zoneId = zone?.id;

        if (!parkingType || !zoneName || zoneId == null) {
          return null;
        }

        return {
          zoneId: String(zoneId),
          zoneName,
          parkingType,
          distanceMeters: Number(zone?.distance_meters) || 0,
        };
      })
      .filter(Boolean);

    if (options.length === 0 && currentZone?.id != null && currentZone?.zone_type) {
      options.push({
        zoneId: String(currentZone.id),
        zoneName: String(currentZone.name || "Current parking zone").trim(),
        parkingType: String(currentZone.zone_type).trim(),
        distanceMeters: 0,
      });
    }

    return options.sort((left, right) => {
      const leftIndex = PARKING_TYPE_ORDER.indexOf(left.parkingType);
      const rightIndex = PARKING_TYPE_ORDER.indexOf(right.parkingType);

      if (leftIndex === -1 && rightIndex === -1) {
        if (left.distanceMeters !== right.distanceMeters) {
          return left.distanceMeters - right.distanceMeters;
        }
        return left.zoneName.localeCompare(right.zoneName);
      }

      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }
      if (left.distanceMeters !== right.distanceMeters) {
        return left.distanceMeters - right.distanceMeters;
      }
      return left.zoneName.localeCompare(right.zoneName);
    });
  }, [currentZone?.id, currentZone?.name, currentZone?.zone_type, nearbyZones]);

  useEffect(() => {
    if (!location || availableZoneOptions.length === 0) {
      return;
    }

    setLastKnownReportZoneState({
      options: availableZoneOptions,
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
      },
    });
  }, [
    availableZoneOptions,
    location?.latitude,
    location?.longitude,
  ]);

  const effectiveReportZoneOptions = useMemo(() => {
    if (availableZoneOptions.length > 0) {
      return availableZoneOptions;
    }

    if (
      !location ||
      !lastKnownReportZoneState.location ||
      lastKnownReportZoneState.options.length === 0
    ) {
      return [];
    }

    const distanceFromCachedZones = getDistanceMeters(
      location,
      lastKnownReportZoneState.location,
    );

    return distanceFromCachedZones !== null &&
      distanceFromCachedZones <= detectionRadius
      ? lastKnownReportZoneState.options
      : [];
  }, [
    availableZoneOptions,
    detectionRadius,
    lastKnownReportZoneState,
    location,
  ]);

  useEffect(() => {
    if (effectiveReportZoneOptions.length === 0) {
      return;
    }

    const selectedZoneId = selectedZoneOption?.zoneId;
    const matchingOption = effectiveReportZoneOptions.find(
      (option) => option.zoneId === selectedZoneId,
    );

    if (!matchingOption) {
      setSelectedZoneOption(effectiveReportZoneOptions[0]);
    }
  }, [effectiveReportZoneOptions, selectedZoneOption?.zoneId]);

  const getPreferredReportZoneOption = useCallback(() => {
    if (effectiveReportZoneOptions.length === 0) {
      return null;
    }

    const selectedZoneId =
      selectedZone?.id != null ? String(selectedZone.id) : null;
    if (selectedZoneId) {
      const selectedZoneMatch = effectiveReportZoneOptions.find(
        (option) => option.zoneId === selectedZoneId,
      );
      if (selectedZoneMatch) {
        return selectedZoneMatch;
      }
    }

    const currentZoneId =
      currentZone?.id != null ? String(currentZone.id) : null;
    if (currentZoneId) {
      const currentZoneMatch = effectiveReportZoneOptions.find(
        (option) => option.zoneId === currentZoneId,
      );
      if (currentZoneMatch) {
        return currentZoneMatch;
      }
    }

    return effectiveReportZoneOptions[0] || null;
  }, [currentZone?.id, effectiveReportZoneOptions, selectedZone?.id]);

  const visibleCouncilParkings = useMemo(
    () => {
      if (!shouldRenderCouncilMarkers) {
        return [];
      }

      const filteredCouncilZones = filterOverlappingZones(
        LOCAL_COUNCIL_PARKINGS.filter(
          (zone) =>
            !isMeteredZoneType(zone.type || zone.zone_type) &&
            isCoordinateWithinRegion(
              {
                latitude: zone.latitude,
                longitude: zone.longitude,
              },
              mapRegion,
            ),
        ),
        visibleZones,
      );

      const nearbyCouncilZones = filteredCouncilZones.filter((zone) =>
        isZoneWithinDetectionRadius({
          latitude: zone.latitude,
          longitude: zone.longitude,
        }),
      );
      const limitedCouncilZones = limitZonesByDistance(
        nearbyCouncilZones,
        focusCoordinate,
        NEAREST_COUNCIL_MARKERS,
      );

      if (Platform.OS !== "android") {
        return limitedCouncilZones;
      }

      return prioritizeMarkersForAndroid({
        markers: limitedCouncilZones,
        mapRegion,
        maxCount: MAX_ANDROID_COUNCIL_MARKERS,
        getCoordinate: (zone) => ({
          latitude: Number(zone?.latitude),
          longitude: Number(zone?.longitude),
        }),
      });
    },
    [
      mapRegion,
      shouldRenderCouncilMarkers,
      visibleZones,
      isZoneWithinDetectionRadius,
    ],
  );
  const reportAvailabilityMaps = useMemo(() => {
    const countsByZoneId = new Map();
    const countsByZoneIdentity = new Map();

    reports.forEach((report) => {
      const quantity = Math.max(
        1,
        Number.isFinite(Number(report?.quantity))
          ? Math.floor(Number(report.quantity))
          : 1,
      );

      if (report?.zone_id != null) {
        const zoneIdKey = String(report.zone_id);
        countsByZoneId.set(
          zoneIdKey,
          (countsByZoneId.get(zoneIdKey) || 0) + quantity,
        );
      }

      const zoneIdentity = normalizeZoneIdentity(
        report?.zone_name,
        report?.zone_type || report?.parking_type,
      );
      if (zoneIdentity !== "::") {
        countsByZoneIdentity.set(
          zoneIdentity,
          (countsByZoneIdentity.get(zoneIdentity) || 0) + quantity,
        );
      }
    });

    return { countsByZoneId, countsByZoneIdentity };
  }, [reports]);
  const getZoneAvailabilityCount = useCallback(
    (zone) => {
      if (!zone) return 0;

      const zoneIdKey =
        zone.id != null ? String(zone.id) : null;
      if (zoneIdKey && reportAvailabilityMaps.countsByZoneId.has(zoneIdKey)) {
        return reportAvailabilityMaps.countsByZoneId.get(zoneIdKey) || 0;
      }

      const zoneIdentity = normalizeZoneIdentity(
        zone.name || zone.zone_name,
        zone.zone_type || zone.type,
      );
      return reportAvailabilityMaps.countsByZoneIdentity.get(zoneIdentity) || 0;
    },
    [reportAvailabilityMaps],
  );
  const reportsWithoutZoneAvailabilityMarker = useMemo(
    () => reports.filter((report) => report?.zone_id == null),
    [reports],
  );
  const selectedZoneReports = useMemo(() => {
    if (!selectedZone) return [];

    const selectedZoneId =
      selectedZone?.id != null ? String(selectedZone.id) : null;
    const selectedZoneIdentity = normalizeZoneIdentity(
      selectedZone.name || selectedZone.zone_name,
      selectedZone.zone_type || selectedZone.type,
    );

    return reports
      .filter((report) => report?.status === "available")
      .filter((report) => {
        if (selectedZoneId && report?.zone_id != null) {
          if (String(report.zone_id) === selectedZoneId) {
            return true;
          }
        }

        const reportIdentity = normalizeZoneIdentity(
          report?.zone_name,
          report?.zone_type || report?.parking_type,
        );

        return reportIdentity === selectedZoneIdentity;
      })
      .sort((left, right) => {
        const leftExpiry = left?.expires_at
          ? new Date(left.expires_at).getTime()
          : Number.POSITIVE_INFINITY;
        const rightExpiry = right?.expires_at
          ? new Date(right.expires_at).getTime()
          : Number.POSITIVE_INFINITY;

        if (leftExpiry !== rightExpiry) {
          return leftExpiry - rightExpiry;
        }

        const leftDistance = Number(left?.distance_meters) || 0;
        const rightDistance = Number(right?.distance_meters) || 0;
        return leftDistance - rightDistance;
      });
  }, [reports, selectedZone]);

  useEffect(() => {
    if (!selectedSpot?.id) {
      return;
    }

    const matchingReport = reports.find(
      (report) => String(report?.id) === String(selectedSpot.id),
    );

    if (!matchingReport) {
      return;
    }

    const hydratedSpot = sanitizeSpotForSelection(matchingReport);
    if (!hydratedSpot) {
      return;
    }

    const hasMeaningfulUpdate =
      hydratedSpot.expires_at !== selectedSpot.expires_at ||
      hydratedSpot.distance_meters !== selectedSpot.distance_meters ||
      hydratedSpot.quantity !== selectedSpot.quantity ||
      hydratedSpot.status !== selectedSpot.status ||
      hydratedSpot.zone_name !== selectedSpot.zone_name ||
      hydratedSpot.zone_type !== selectedSpot.zone_type;

    if (hasMeaningfulUpdate) {
      setSelectedSpot((currentSpot) =>
        currentSpot && String(currentSpot.id) === String(hydratedSpot.id)
          ? { ...currentSpot, ...hydratedSpot }
          : currentSpot,
      );
    }
  }, [reports, selectedSpot]);

  const reportMutation = useReportSpot(location, (data) => {
    setShowReportModal(false);
    if (!data?.report) return;

    const latitude = normalizeCoordinate(data.report.latitude);
    const longitude = normalizeCoordinate(data.report.longitude);
    if (latitude === null || longitude === null) {
      console.warn("Reported spot missing valid coordinates:", data.report);
      return;
    }

    const reportedSpot = {
      ...data.report,
      latitude,
      longitude,
      status: data.report.status || "available",
      zone_name: data.report.zone_name || data.zone?.name || "Reported spot",
      zone_type:
        data.report.zone_type || data.zone?.zone_type || data.report.parking_type,
    };

    focusMapRegion(
      {
        latitude: reportedSpot.latitude,
        longitude: reportedSpot.longitude,
        latitudeDelta: 0.003,
        longitudeDelta: 0.003,
      },
      600,
    );
  });

  const claimMutation = useClaimSpot(
    location,
    (claimResult) => {
      setSelectedSpot(null);
      clearRoute();

      if (!isFocused) {
        return;
      }

      const claimedParkingType = String(claimResult?.parkingType || "parking").trim();
      const isFullHourClaim = claimedParkingType.toLowerCase() === "full hour";

      if (isFullHourClaim) {
        Alert.alert("Claimed!", "You've successfully claimed this parking spot.");
        return;
      }

      Alert.alert(
        "Spot Claimed!",
        `You've successfully claimed this ${claimedParkingType} parking spot. Would you like to start the parking timer?`,
        [
          { text: "Not Now", style: "cancel" },
          {
            text: "Start Timer",
            onPress: () => {
              if (claimResult?.onTimerStart) {
                claimResult.onTimerStart(claimedParkingType);
              }
            },
          },
        ],
      );
    },
    (parkingType) => {
      navigation.navigate("timer", {
        autoStart: "true",
        zoneType: parkingType,
      });
    },
  );

  const reportFalseMutation = useReportFalseSpot(() => {
    setSelectedSpot(null);
    clearRoute();
  });

  const handleDeleteSpotWithTarget = useCallback(async (spotToDelete) => {
    if (!spotToDelete || !user?.id) {
      Alert.alert("Error", "You must be logged in to delete reports");
      return;
    }

    setSelectedSpot(null);
    clearRoute();

    try {
      const response = await fetch("/api/reports/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: spotToDelete.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert("Success", "Your parking spot report has been deleted");
        refetchReports();
      } else {
        Alert.alert("Error", data.error || "Failed to delete report");
      }
    } catch (error) {
      console.error("Error deleting spot:", error);
      Alert.alert("Error", "Could not delete report. Please try again.");
    }
  }, [user?.id, clearRoute, refetchReports]);

  // Follow the user's live location while preserving the current zoom level.
  useEffect(() => {
    if (!location || !isFollowingLiveLocation) return;

    const nextCoordinate = {
      latitude: location.latitude,
      longitude: location.longitude,
    };
    const now = Date.now();
    const previousAnimation = lastFollowAnimationRef.current;
    const movedDistance = previousAnimation.coordinate
      ? getDistanceMeters(previousAnimation.coordinate, nextCoordinate)
      : null;
    const hasMovedEnough =
      movedDistance === null ||
      movedDistance >= FOLLOW_ANIMATION_DISTANCE_METERS;
    const hasWaitedLongEnough =
      now - previousAnimation.timestamp >= FOLLOW_ANIMATION_INTERVAL_MS;

    if (!hasMovedEnough && !hasWaitedLongEnough) {
      return;
    }

    lastFollowAnimationRef.current = {
      coordinate: nextCoordinate,
      timestamp: now,
    };

    safeAnimateToRegion(
      {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta:
          mapRegionRef.current?.latitudeDelta || DEFAULT_MAP_DELTA,
        longitudeDelta:
          mapRegionRef.current?.longitudeDelta || DEFAULT_MAP_DELTA,
      },
      500,
    );
  }, [
    isFollowingLiveLocation,
    location?.latitude,
    location?.longitude,
    safeAnimateToRegion,
  ]);

  // Smart zoom: fit ONLY parking spots (focus on detections)
  useEffect(() => {
    if (reports.length === 0) return;

    const spotPoints = reports.map((r) => ({
      latitude: r.latitude,
      longitude: r.longitude,
    }));

    let minLat = spotPoints[0].latitude;
    let maxLat = spotPoints[0].latitude;
    let minLng = spotPoints[0].longitude;
    let maxLng = spotPoints[0].longitude;

    for (const p of spotPoints) {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude < minLng) minLng = p.longitude;
      if (p.longitude > maxLng) maxLng = p.longitude;
    }

    const latDelta = Math.max((maxLat - minLat) * 1.6, 0.003);
    const lngDelta = Math.max((maxLng - minLng) * 1.6, 0.003);

    focusMapRegion(
      {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta,
      },
      1000,
    );
  }, [focusMapRegion, reports.length]);

  // Handle navigation from spots tab or notifications
  useEffect(() => {
    if (params.spotId && params.spotLat && params.spotLng) {
      const navigationRequestKey = [
        "spot",
        params.navigationRequestId || params.alertEventId || "",
        params.spotId,
        params.spotLat,
        params.spotLng,
        params.navigate === "true" ? "navigate" : "select",
      ].join(":");

      console.log("[spot.crash] params.spot", {
        alertEventId: params.alertEventId,
        navigationRequestId: params.navigationRequestId,
        spotId: params.spotId,
        spotLat: params.spotLat,
        spotLng: params.spotLng,
        autoNavigate: params.navigate === "true",
      });
      const spot = sanitizeSpotForSelection({
        id: params.spotId,
        latitude: params.spotLat,
        longitude: params.spotLng,
        zone_name: params.spotName,
        zone_type: params.spotType,
        parking_type: params.spotType,
        status: "available",
      });

      if (!spot) {
        return;
      }

      setSelectedZone(null);
      setSelectedSpot(spot);
      refetchReports().catch(() => {});

      focusMapRegion(
        {
          latitude: spot.latitude,
          longitude: spot.longitude,
          latitudeDelta: 0.002,
          longitudeDelta: 0.002,
        },
        1000,
      );

      if (
        params.navigate === "true" &&
        lastAutoNavigationRequestRef.current !== navigationRequestKey
      ) {
        const navigationStarted = startInAppNavigation(
          spot,
          "Spot location not available for navigation.",
        );

        if (navigationStarted) {
          lastAutoNavigationRequestRef.current = navigationRequestKey;
        }
      }
    }
  }, [
    focusMapRegion,
    params.navigate,
    params.navigationRequestId,
    params.alertEventId,
    params.spotId,
    params.spotLat,
    params.spotLng,
    params.spotName,
    params.spotType,
    refetchReports,
    startInAppNavigation,
  ]);

  useEffect(() => {
    if (params.zoneLat && params.zoneLng) {
      const navigationRequestKey = [
        "zone",
        params.navigationRequestId || params.alertEventId || "",
        params.zoneId || "",
        params.zoneLat,
        params.zoneLng,
        params.navigate === "true" ? "navigate" : "select",
      ].join(":");

      console.log("[spot.crash] params.zone", {
        alertEventId: params.alertEventId,
        navigationRequestId: params.navigationRequestId,
        zoneId: params.zoneId,
        zoneLat: params.zoneLat,
        zoneLng: params.zoneLng,
        zoneName: params.zoneName,
        zoneType: params.zoneType,
      });
      setSelectedSpot(null);

      const zone = {
        id: params.zoneId || `zone-${params.zoneLat}-${params.zoneLng}`,
        name: params.zoneName || "Parking Zone",
        zone_type: params.zoneType || "Parking",
        capacity_spaces: normalizeCoordinate(params.zoneCapacity),
        rules_description: params.zoneRules || "",
        center_lat: parseFloat(params.zoneLat),
        center_lng: parseFloat(params.zoneLng),
      };

      setSelectedZone(zone);
      refetchReports().catch(() => {});
      focusMapRegion(
        {
          latitude: zone.center_lat,
          longitude: zone.center_lng,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        },
        800,
      );

      if (
        params.navigate === "true" &&
        lastAutoNavigationRequestRef.current !== navigationRequestKey
      ) {
        const navigationStarted = startInAppNavigation(
          zone,
          "Zone location not available for navigation.",
        );

        if (navigationStarted) {
          lastAutoNavigationRequestRef.current = navigationRequestKey;
        }
      }
    }
  }, [
    focusMapRegion,
    params.navigate,
    params.navigationRequestId,
    params.alertEventId,
    params.zoneId,
    params.zoneLat,
    params.zoneLng,
    params.zoneName,
    params.zoneRules,
    params.zoneType,
    refetchReports,
    startInAppNavigation,
  ]);

  const handleReport = useCallback(() => {
    if (!location) {
      Alert.alert("Location not found", "Wait for location to be detected.");
      return;
    }

    const preferredZoneOption = getPreferredReportZoneOption();

    if (!preferredZoneOption) {
      Alert.alert(
        "No Parking Zone Nearby",
        `You can only report a spot when a mapped parking zone is detected within ${detectionRadius}m of your location.`,
      );
      return;
    }

    setSelectedZoneOption(preferredZoneOption);

    console.log("[report.ui] Opening report modal", {
      latitude: location.latitude,
      longitude: location.longitude,
      zoneId: currentZone?.id || null,
      zoneType: currentZone?.zone_type || null,
      selectedZoneId: selectedZone?.id || null,
      selectedZoneType: selectedZone?.zone_type || null,
      selectedZoneOption: preferredZoneOption,
    });
    setShowReportModal(true);
  }, [
    currentZone?.id,
    currentZone?.zone_type,
    detectionRadius,
    getPreferredReportZoneOption,
    location,
    selectedZone?.id,
    selectedZone?.zone_type,
  ]);

  const handleConfirmReport = useCallback(() => {
    if (!location || reportMutation.isPending) return;

    const zoneOptionToReport =
      selectedZoneOption || effectiveReportZoneOptions[0] || null;

    if (!zoneOptionToReport) {
      Alert.alert(
        "No Parking Zone Nearby",
        `You can only report a spot when a mapped parking zone is detected within ${detectionRadius}m of your location.`,
      );
      return;
    }

    console.log("[report.ui] Confirm report tapped", {
      latitude: location.latitude,
      longitude: location.longitude,
      selectedZoneId: zoneOptionToReport.zoneId || null,
      selectedParkingType: zoneOptionToReport.parkingType || null,
      spotQuantity,
      zoneId: currentZone?.id || null,
    });

    Alert.alert(
      "Confirm Parking Spot Report",
      `Report ${spotQuantity} ${zoneOptionToReport.parkingType || "parking"} spot${spotQuantity > 1 ? "s" : ""} for ${zoneOptionToReport.zoneName || "this nearby zone"}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Confirm",
          onPress: () => {
            setShowReportModal(false);
            console.log("[report.ui] Sending report mutation", {
              latitude: location.latitude,
              longitude: location.longitude,
              selectedZoneId: zoneOptionToReport.zoneId || null,
              selectedParkingType: zoneOptionToReport.parkingType || null,
              spotQuantity,
            });
            reportMutation.mutate({
              coords: location,
              parkingType: zoneOptionToReport.parkingType,
              quantity: spotQuantity,
              zoneId: zoneOptionToReport.zoneId,
            });
          },
        },
      ],
    );
  }, [
    currentZone?.id,
    detectionRadius,
    effectiveReportZoneOptions,
    location,
    selectedZoneOption,
    spotQuantity,
    reportMutation,
  ]);

  const logSpotSelection = useCallback((label, payload) => {
    if (!payload) {
      console.log("[spot.crash]", label, "missing payload");
      return;
    }
    console.log(
      "[spot.crash]",
      label,
      `id=${payload.id ?? "unknown"}`,
      `lat=${payload.latitude ?? "n/a"}`,
      `lng=${payload.longitude ?? "n/a"}`,
      `zone=${payload.zone_type || payload.parking_type || "unknown"}`,
      `status=${payload.status}`,
    );
  }, []);

  const handleMarkerPress = useCallback(
    (spot) => {
      logSpotSelection("marker.press", spot);
      setIsFollowingLiveLocation(false);
      setSelectedSpot(spot);
      clearRoute();
    },
    [clearRoute, logSpotSelection],
  );

  const handleGetDirections = useCallback(() => {
    if (!selectedSpot) {
      return;
    }

    startInAppNavigation(
      selectedSpot,
      "Spot location not available for navigation.",
    );
  }, [selectedSpot, startInAppNavigation]);

  const handleZoneDirections = useCallback(
    (zoneToNavigate) => {
      const targetZone = zoneToNavigate || selectedZone;
      if (!targetZone) {
        return;
      }

      startInAppNavigation(
        targetZone,
        "Zone location not available for navigation.",
      );
    },
    [selectedZone, startInAppNavigation],
  );

  const handleZonePress = useCallback((zone) => {
    if (zone) {
      console.log(
        "[spot.crash] zone.press",
        `id=${zone.id}`,
        `lat=${zone.center_lat}`,
        `lng=${zone.center_lng}`,
        `type=${zone.zone_type}`,
        `name=${zone.name}`,
      );
    } else {
      console.log("[spot.crash] zone.press null");
    }
    const nextSelectedZone = sanitizeZoneForSelection(zone);
    setSelectedZone(nextSelectedZone);

    if (!nextSelectedZone) {
      return;
    }

    if (Platform.OS === "ios") {
      setIsFollowingLiveLocation(false);
      return;
    }

    try {
      const latitude = Number(nextSelectedZone.center_lat);
      const longitude = Number(nextSelectedZone.center_lng);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("Zone center not available");
      }

      focusMapRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        500,
      );
    } catch (e) {
      // Safe to ignore on web
    }
  }, [focusMapRegion]);

  const handleZoneReportPress = useCallback(
    (spot) => {
      logSpotSelection("zone.report.press", spot);
      const sanitizedSpot = sanitizeSpotForSelection(spot);
      if (!sanitizedSpot) return;

      const latitude = normalizeCoordinate(sanitizedSpot.latitude);
      const longitude = normalizeCoordinate(sanitizedSpot.longitude);

      setIsFollowingLiveLocation(false);
      clearRoute();

      if (Platform.OS === "ios" && selectedZone) {
        console.log(
          "[spot.crash] zone.report.defer",
          `id=${sanitizedSpot.id ?? "unknown"}`,
        );
        setPendingZoneReportSpot(sanitizedSpot);
        setSelectedZone(null);
        return;
      }

      setSelectedZone(null);
      setSelectedSpot(sanitizedSpot);

      if (latitude !== null && longitude !== null) {
        focusMapRegion(
          {
            latitude,
            longitude,
            latitudeDelta: 0.002,
            longitudeDelta: 0.002,
          },
          500,
        );
      }
    },
    [clearRoute, focusMapRegion, logSpotSelection, selectedZone],
  );

  useEffect(() => {
    if (Platform.OS !== "ios" || selectedZone || !pendingZoneReportSpot) {
      return;
    }

    let cancelled = false;
    const deferredSpot = pendingZoneReportSpot;
    const openDeferredSpotTimeoutId = setTimeout(() => {
      if (cancelled) {
        return;
      }

      console.log(
        "[spot.crash] zone.report.open",
        `id=${deferredSpot.id ?? "unknown"}`,
      );
      setSelectedSpot(deferredSpot);
      setPendingZoneReportSpot(null);

      const latitude = normalizeCoordinate(deferredSpot.latitude);
      const longitude = normalizeCoordinate(deferredSpot.longitude);

      if (latitude !== null && longitude !== null) {
        focusMapRegion(
          {
            latitude,
            longitude,
            latitudeDelta: 0.002,
            longitudeDelta: 0.002,
          },
          500,
        );
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(openDeferredSpotTimeoutId);
    };
  }, [focusMapRegion, pendingZoneReportSpot, selectedZone]);

  const handleClaimSpot = useCallback((spotToClaim) => {
    const targetSpot = spotToClaim || selectedSpot;
    if (!targetSpot) return;
    if (!location) {
      Alert.alert("Location not found", "Wait for location to be detected.");
      return;
    }

    Alert.alert(
      "Claim This Spot?",
      "Are you at this parking spot? Claiming will remove it from the map for others.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Claim",
          onPress: () => {
            setSelectedSpot(null);
            clearRoute();
            claimMutation.mutate({
              reportId: targetSpot.id,
              parkingType: targetSpot.parking_type || targetSpot.zone_type,
              currentLocation: location,
              spot: targetSpot,
            });
          },
        },
      ],
    );
  }, [selectedSpot, location, clearRoute, claimMutation]);

  const handleReportFalseSpot = useCallback((spotToReport) => {
    const targetSpot = spotToReport || selectedSpot;
    if (!targetSpot) return;

    Alert.alert(
      "Report False Spot?",
      "Is this spot report inaccurate or not in a parking zone? This will decrease the reporter's trust score.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report",
          style: "destructive",
          onPress: () => {
            setSelectedSpot(null);
            clearRoute();
            reportFalseMutation.mutate(targetSpot.id);
          },
        },
      ],
    );
  }, [selectedSpot, clearRoute, reportFalseMutation]);

  const handleRecenter = useCallback(() => {
    if (location) {
      setIsFollowingLiveLocation(true);
      lastFollowAnimationRef.current = {
        coordinate: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        timestamp: Date.now(),
      };
      safeAnimateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: DEFAULT_MAP_DELTA,
          longitudeDelta: DEFAULT_MAP_DELTA,
        },
        500,
      );
      clearRoute();
    }
  }, [location, safeAnimateToRegion, clearRoute]);

  const brandingHeaderOffset = 0;
  const brandingHeaderHeight = 88;
  const currentZoneTopOffset = brandingHeaderHeight;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: BRAND_PALETTE.background,
        paddingTop: insets.top + 16,
      }}
    >
      <View style={{ flex: 1, position: "relative" }}>
        <MapView
          ref={mapRef}
          provider={MAP_PROVIDER}
          googleRenderer={MAP_GOOGLE_RENDERER}
          style={{ width: "100%", height: "100%" }}
          initialRegion={{
            latitude: location?.latitude || -37.8136,
            longitude: location?.longitude || 144.9631,
            latitudeDelta: DEFAULT_MAP_DELTA,
            longitudeDelta: DEFAULT_MAP_DELTA,
          }}
          onMapReady={handleMapReady}
          onRegionChange={handleRegionChange}
          onRegionChangeComplete={handleRegionChangeComplete}
          onPanDrag={() => setIsFollowingLiveLocation(false)}
          showsUserLocation={false}
          showsMyLocationButton={false}
          followsUserLocation={isFollowingLiveLocation}
        >
          {location && (
            <Circle
              center={{
                latitude: location.latitude,
                longitude: location.longitude,
              }}
              radius={detectionRadius}
              strokeColor="rgba(59, 130, 246, 0.5)"
              strokeWidth={2}
              fillColor="rgba(59, 130, 246, 0.08)"
            />
          )}

          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#3B82F6"
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
          )}

          <UserLocationMarker location={location} />
          {Platform.OS !== "android" && (
            <>
              <ParkingSpotMarkers
                reports={reportsWithoutZoneAvailabilityMarker}
                onMarkerPress={handleMarkerPress}
              />
              <ParkingZoneMarkers
                zones={visibleCouncilParkings}
                userLocation={location}
                radius={detectionRadius}
                getAvailabilityCount={getZoneAvailabilityCount}
              />
              <ZoneMarkers
                zones={visibleZoneMarkers}
                userLocation={location}
                radius={detectionRadius}
                onZonePress={handleZonePress}
                selectedZone={selectedZone}
                getAvailabilityCount={getZoneAvailabilityCount}
              />
            </>
          )}
        </MapView>

        {Platform.OS === "android" && (
          <>
            <AndroidParkingSpotOverlay
              mapRef={mapRef}
              reports={reportsWithoutZoneAvailabilityMarker}
              onMarkerPress={handleMarkerPress}
              overlayRevision={mapOverlayRevision}
            />
            <AndroidParkingZoneOverlay
              mapRef={mapRef}
              zones={visibleCouncilParkings}
              userLocation={location}
              radius={detectionRadius}
              getAvailabilityCount={getZoneAvailabilityCount}
              overlayRevision={mapOverlayRevision}
            />
            <AndroidZoneOverlay
              mapRef={mapRef}
              zones={visibleZoneMarkers}
              userLocation={location}
              radius={detectionRadius}
              onZonePress={handleZonePress}
              selectedZone={selectedZone}
              getAvailabilityCount={getZoneAvailabilityCount}
              overlayRevision={mapOverlayRevision}
            />
          </>
        )}
      </View>

      <MapBrandingBadge
        insets={insets}
        location={location}
        topOffset={brandingHeaderOffset}
      />

      {routeCoordinates.length > 0 ? (
        <View
          style={{
            position: "absolute",
            left: FLOATING_ACTION_BUTTON_SIDE_OFFSET,
            bottom:
              Math.max(insets.bottom, 0) +
              FLOATING_ACTION_BUTTON_BOTTOM_MARGIN,
            width: NAVIGATION_CARD_WIDTH,
            backgroundColor: "rgba(8, 26, 43, 0.94)",
            borderRadius: 16,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: "rgba(125, 211, 252, 0.24)",
            shadowColor: "#03111D",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.18,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "800",
                  color: "rgba(125, 211, 252, 0.82)",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                }}
              >
                In-app navigation
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: "#FFFFFF",
                }}
              >
                {[routeDuration, routeDistance].filter(Boolean).join(" | ") ||
                  "Route ready"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={clearRoute}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: "rgba(255, 255, 255, 0.12)",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: "#D7F0FF",
                }}
              >
                End
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <ActionButtons
        insets={insets}
        location={location}
        isReporting={reportMutation.isPending}
        onReportPress={handleReport}
        onRecenterPress={handleRecenter}
        tabBarHeight={tabBarHeight}
      />

      <ReportModal
        visible={showReportModal}
        selectedZoneOption={selectedZoneOption}
        availableZoneOptions={effectiveReportZoneOptions}
        detectionRadius={detectionRadius}
        spotQuantity={spotQuantity}
        isReporting={reportMutation.isPending}
        insets={insets}
        onClose={() => setShowReportModal(false)}
        onSelectType={setSelectedZoneOption}
        onSetQuantity={setSpotQuantity}
        onConfirm={handleConfirmReport}
      />

      <SpotDetailsModal
        visible={!!selectedSpot}
        spot={selectedSpot}
        routeCoordinates={routeCoordinates}
        isClaiming={claimMutation.isPending}
        isReportingFalse={reportFalseMutation.isPending}
        insets={insets}
        onClose={() => {
          setSelectedSpot(null);
          clearRoute();
        }}
        onGetDirections={handleGetDirections}
        onClaimSpot={handleClaimSpot}
        onReportFalse={handleReportFalseSpot}
        onDeleteSpot={handleDeleteSpotWithTarget}
      />

      <ZoneDetailsModal
        visible={!!selectedZone}
        zone={selectedZone}
        availableReports={selectedZoneReports}
        insets={insets}
        onClose={() => {
          setPendingZoneReportSpot(null);
          setSelectedZone(null);
          clearRoute();
        }}
        onGetDirections={handleZoneDirections}
        onSelectReport={handleZoneReportPress}
      />
    </View>
  );
}

export default function ParkMateApp() {
  return <ParkMateContent />;
}
