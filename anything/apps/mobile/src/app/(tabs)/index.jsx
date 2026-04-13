import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Alert,
  Platform,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import MapView, { Circle, Polygon, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
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
  useDeleteReportSpot,
} from "@/hooks/useParkingData";
import { useDirections } from "@/hooks/useDirections";

import {
  UserLocationMarker,
  ParkingSpotMarkers,
  ParkingZoneMarkers,
  AndroidParkingSpotOverlay,
  AndroidParkingZoneOverlay,
} from "@/components/Map/MapMarkers";
import { getZoomedOutZoneScale } from "@/components/Map/markerVisuals";
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
import { getDistanceMeters } from "@/utils/geo";
import {
  getDetectedZonePins,
  MAX_DETECTED_API_ZONE_PINS,
  MAX_DETECTED_COUNCIL_ZONE_PINS,
} from "@/utils/parkingZonePins";
import {
  getApiZoneCenter,
  getApiZoneEffectiveDistanceMeters,
} from "@/utils/zoneAlerts";
import { mergeDistinctZones } from "@/utils/zoneDeduplication";
import { PARKING_ALERT_RADIUS_METERS } from "@/constants/detectionRadius";
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
const FOLLOW_ANIMATION_DISTANCE_METERS = 12;
const FOLLOW_ANIMATION_INTERVAL_MS = 2500;
const ACTIVE_NAVIGATION_REROUTE_DISTANCE_METERS = 20;
const ACTIVE_NAVIGATION_REROUTE_INTERVAL_MS = 8000;
const ACTIVE_NAVIGATION_ARRIVAL_METERS = 25;
const MAP_PROVIDER = Platform.OS === "android" ? PROVIDER_GOOGLE : undefined;
const MAP_GOOGLE_RENDERER = Platform.OS === "android" ? "LEGACY" : undefined;
const MAP_RADIUS_PIN_PADDING_METERS = 12;
const METERS_PER_DEGREE_LATITUDE = 111320;
const RADIUS_VIEW_PADDING_MULTIPLIER = 1.15;
const NAVIGATION_CARD_TO_ACTION_BUTTON_GAP = 12;
const NAVIGATION_CARD_WIDTH = 220;

const normalizeZoneIdentity = (name, type) => {
  const normalizedName = String(name || "").trim().toLowerCase();
  const normalizedType = String(type || "").trim().toLowerCase();
  return `${normalizedName}::${normalizedType}`;
};

const normalizeBoundaryCoordinate = (coordinate) => {
  if (!Array.isArray(coordinate) || coordinate.length < 2) {
    return null;
  }

  const longitude = normalizeCoordinate(coordinate[0]);
  const latitude = normalizeCoordinate(coordinate[1]);

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
};

const buildMapPolygonsFromBoundary = (boundaryGeojson) => {
  if (!boundaryGeojson || typeof boundaryGeojson !== "object") {
    return [];
  }

  const normalizeRing = (ring) =>
    Array.isArray(ring)
      ? ring.map(normalizeBoundaryCoordinate).filter(Boolean)
      : [];

  if (boundaryGeojson.type === "Polygon") {
    const rings = Array.isArray(boundaryGeojson.coordinates)
      ? boundaryGeojson.coordinates.map(normalizeRing).filter((ring) => ring.length >= 3)
      : [];

    if (rings.length === 0) {
      return [];
    }

    return [
      {
        coordinates: rings[0],
        holes: rings.slice(1).filter((ring) => ring.length >= 3),
      },
    ];
  }

  if (boundaryGeojson.type === "MultiPolygon") {
    return (Array.isArray(boundaryGeojson.coordinates) ? boundaryGeojson.coordinates : [])
      .map((polygon) => {
        const rings = Array.isArray(polygon)
          ? polygon.map(normalizeRing).filter((ring) => ring.length >= 3)
          : [];

        if (rings.length === 0) {
          return null;
        }

        return {
          coordinates: rings[0],
          holes: rings.slice(1).filter((ring) => ring.length >= 3),
        };
      })
      .filter(Boolean);
  }

  return [];
};

const sanitizeZoneForSelection = (zone) => {
  if (!zone) return null;

  const latitude = normalizeCoordinate(zone.center_lat ?? zone.latitude);
  const longitude = normalizeCoordinate(zone.center_lng ?? zone.longitude);

  return {
    id: zone.id ?? null,
    name: String(zone.name || zone.zone_name || "Parking Zone").trim(),
    zone_type: String(zone.zone_type || zone.type || "Parking").trim(),
    capacity_spaces:
      zone.capacity_spaces ?? zone.capacitySpaces ?? zone.capacity ?? null,
    rules_description: String(zone.rules_description || zone.rules || "").trim(),
    boundary_geojson:
      zone.boundary_geojson && typeof zone.boundary_geojson === "object"
        ? zone.boundary_geojson
        : null,
    center_lat: latitude,
    center_lng: longitude,
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

const createNavigationTarget = (target) => {
  if (!target) return null;

  const latitude = normalizeCoordinate(target.latitude ?? target.center_lat);
  const longitude = normalizeCoordinate(target.longitude ?? target.center_lng);

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    ...target,
    latitude,
    longitude,
  };
};

const getRadiusViewRegion = (center, radiusMeters) => {
  if (!center || !Number.isFinite(Number(radiusMeters)) || Number(radiusMeters) <= 0) {
    return null;
  }

  const latitude = normalizeCoordinate(center.latitude);
  const longitude = normalizeCoordinate(center.longitude);
  if (latitude === null || longitude === null) {
    return null;
  }

  const paddedDiameterMeters =
    Number(radiusMeters) * 2 * RADIUS_VIEW_PADDING_MULTIPLIER;
  const longitudeMetersPerDegree = Math.max(
    METERS_PER_DEGREE_LATITUDE * Math.abs(Math.cos((latitude * Math.PI) / 180)),
    1,
  );

  return {
    latitude,
    longitude,
    latitudeDelta: Math.max(
      paddedDiameterMeters / METERS_PER_DEGREE_LATITUDE,
      DEFAULT_MAP_DELTA,
    ),
    longitudeDelta: Math.max(
      paddedDiameterMeters / longitudeMetersPerDegree,
      DEFAULT_MAP_DELTA,
    ),
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
  const lastNavigationRefreshRef = useRef({
    coordinate: null,
    timestamp: 0,
    targetKey: null,
  });
  const lastAutoFramedReportCountRef = useRef(null);
  const lastAutoNavigationRequestRef = useRef(null);
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams(); // Get navigation params
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedZoneOption, setSelectedZoneOption] = useState(null);
  const [spotQuantity, setSpotQuantity] = useState(1);
  const [selectedZone, setSelectedZone] = useState(null);
  const [activeNavigationTarget, setActiveNavigationTarget] = useState(null);
  const [pendingZoneReportSpot, setPendingZoneReportSpot] = useState(null);
  const [lastKnownReportZoneState, setLastKnownReportZoneState] = useState({
    options: [],
    location: null,
  });
  const [isFollowingLiveLocation, setIsFollowingLiveLocation] = useState(true);
  const [mapRegion, setMapRegion] = useState(mapRegionRef.current);
  const [overlayMapRegion, setOverlayMapRegion] = useState(mapRegionRef.current);
  const [mapOverlayRevision, setMapOverlayRevision] = useState(0);
  const scheduleOverlayRefresh = useCallback(
    (immediate = false) => {
      if (!immediate) {
        return;
      }

      setMapOverlayRevision((current) => current + 1);
    },
    [setMapOverlayRevision],
  );

  const detectionRadius = PARKING_ALERT_RADIUS_METERS;
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
      setOverlayMapRegion(nextRegion);
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
    setOverlayMapRegion(mapRegionRef.current);

    if (details?.isGesture) {
      setIsFollowingLiveLocation(false);
    }

    if (Platform.OS === "android") {
      scheduleOverlayRefresh(true);
    }
  }, [scheduleOverlayRefresh]);

  const handleRegionChange = useCallback((region) => {
    if (Platform.OS !== "android") {
      return;
    }

    if (region) {
      setOverlayMapRegion({
        latitude: region.latitude,
        longitude: region.longitude,
        latitudeDelta: region.latitudeDelta,
        longitudeDelta: region.longitudeDelta,
      });
    }
  }, []);

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
  const zoneAvailabilityAggregationEnabled = true;
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
      if (!zoneAvailabilityAggregationEnabled || !zone) {
        return 0;
      }

      const zoneIdKey = zone.id != null ? String(zone.id) : null;
      if (zoneIdKey && reportAvailabilityMaps.countsByZoneId.has(zoneIdKey)) {
        return reportAvailabilityMaps.countsByZoneId.get(zoneIdKey) || 0;
      }

      const zoneIdentity = normalizeZoneIdentity(
        zone.name || zone.zone_name,
        zone.zone_type || zone.type,
      );
      return reportAvailabilityMaps.countsByZoneIdentity.get(zoneIdentity) || 0;
    },
    [reportAvailabilityMaps, zoneAvailabilityAggregationEnabled],
  );

  const stopInAppNavigation = useCallback(() => {
    setActiveNavigationTarget(null);
    lastNavigationRefreshRef.current = {
      coordinate: null,
      timestamp: 0,
      targetKey: null,
    };
    clearRoute();
  }, [clearRoute]);

  const startInAppNavigation = useCallback(
    (target, errorMessage = "Destination not available for navigation.") => {
      const nextTarget = createNavigationTarget(target);

      if (!nextTarget) {
        Alert.alert("Navigation Error", errorMessage);
        return false;
      }

      if (!location) {
        Alert.alert("Location not found", "Wait for location to be detected.");
        return false;
      }

      const navigationTargetKey = String(
        nextTarget.id ||
          `${nextTarget.latitude.toFixed(6)},${nextTarget.longitude.toFixed(6)}`,
      );

      setIsFollowingLiveLocation(true);
      setActiveNavigationTarget(nextTarget);
      lastNavigationRefreshRef.current = {
        coordinate: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        timestamp: Date.now(),
        targetKey: navigationTargetKey,
      };
      clearRoute();
      getDirections(nextTarget, { fitToRoute: true });
      return true;
    },
    [clearRoute, getDirections, location],
  );

  const detectedZonePins = useMemo(() => {
    const baselineDetectedZonePins = getDetectedZonePins({
      apiZones: nearbyZones,
      location,
      radiusMeters: detectionRadius,
    });
    const prioritizedDetectedZonePins = getDetectedZonePins({
      apiZones: nearbyZones,
      location,
      radiusMeters: detectionRadius,
      focusCoordinate,
      prioritizeApiZone: getZoneAvailabilityCount,
      prioritizeCouncilZone: getZoneAvailabilityCount,
    });

    return {
      apiZones: mergeDistinctZones(
        baselineDetectedZonePins.apiZones,
        prioritizedDetectedZonePins.apiZones,
      ).slice(0, MAX_DETECTED_API_ZONE_PINS),
      councilZones: mergeDistinctZones(
        baselineDetectedZonePins.councilZones,
        prioritizedDetectedZonePins.councilZones,
      ).slice(0, MAX_DETECTED_COUNCIL_ZONE_PINS),
    };
  }, [
    detectionRadius,
    focusCoordinate,
    getZoneAvailabilityCount,
    location,
    nearbyZones,
  ]);
  const displayedDetectionRadius = useMemo(() => {
    if (!location) {
      return detectionRadius;
    }

    let expandedRadius = detectionRadius;

    detectedZonePins.apiZones.forEach((zone) => {
      const effectiveDistance = getApiZoneEffectiveDistanceMeters(zone, location);
      if (effectiveDistance === null || effectiveDistance > detectionRadius) {
        return;
      }

      const center = getApiZoneCenter(zone);
      if (!center) {
        return;
      }

      const centerDistance = getDistanceMeters(location, center);
      if (centerDistance === null) {
        return;
      }

      expandedRadius = Math.max(expandedRadius, centerDistance);
    });

    return Math.ceil(expandedRadius + MAP_RADIUS_PIN_PADDING_METERS);
  }, [detectedZonePins.apiZones, detectionRadius, location]);
  const focusUserRadiusView = useCallback(
    (duration = 600) => {
      if (!location) {
        return false;
      }

      const nextRegion = getRadiusViewRegion(location, displayedDetectionRadius);
      if (!nextRegion) {
        return false;
      }

      setIsFollowingLiveLocation(true);
      lastFollowAnimationRef.current = {
        coordinate: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        timestamp: Date.now(),
      };
      safeAnimateToRegion(nextRegion, duration);
      return true;
    },
    [
      displayedDetectionRadius,
      location,
      safeAnimateToRegion,
    ],
  );
  const visibleZoneMarkers = useMemo(() => {
    let nextVisibleZones = detectedZonePins.apiZones;

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
            ...nextVisibleZones.slice(
              0,
              Math.max(MAX_DETECTED_API_ZONE_PINS - 1, 0),
            ),
          ];
        }
      }
    }

    return nextVisibleZones;
  }, [detectedZonePins.apiZones, selectedZone]);
  const availableZoneOptions = useMemo(() => {
    const options = nearbyZones
      .map((zone) => {
        const parkingType = String(zone?.zone_type || "").trim();
        const zoneName = String(zone?.name || zone?.zone_name || "").trim();
        const zoneId = zone?.id;
        const latitude = normalizeCoordinate(zone?.center_lat ?? zone?.latitude);
        const longitude = normalizeCoordinate(zone?.center_lng ?? zone?.longitude);

        if (!parkingType || !zoneName || zoneId == null || latitude === null || longitude === null) {
          return null;
        }

        return {
          zoneId: String(zoneId),
          zoneName,
          parkingType,
          distanceMeters: Number(zone?.distance_meters) || 0,
          latitude,
          longitude,
        };
      })
      .filter(Boolean);

    const currentZoneLatitude = normalizeCoordinate(currentZone?.center_lat ?? currentZone?.latitude);
    const currentZoneLongitude = normalizeCoordinate(currentZone?.center_lng ?? currentZone?.longitude);

    if (
      options.length === 0 &&
      currentZone?.id != null &&
      currentZone?.zone_type &&
      currentZoneLatitude !== null &&
      currentZoneLongitude !== null
    ) {
      options.push({
        zoneId: String(currentZone.id),
        zoneName: String(currentZone.name || "Current parking zone").trim(),
        parkingType: String(currentZone.zone_type).trim(),
        distanceMeters: 0,
        latitude: currentZoneLatitude,
        longitude: currentZoneLongitude,
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
    () => detectedZonePins.councilZones,
    [detectedZonePins.councilZones],
  );
  const zonePinZoomScale = useMemo(
    () => getZoomedOutZoneScale(mapRegion),
    [mapRegion?.latitudeDelta, mapRegion?.longitudeDelta],
  );
  const selectedZonePolygons = useMemo(
    () => buildMapPolygonsFromBoundary(selectedZone?.boundary_geojson),
    [selectedZone?.boundary_geojson],
  );
  const overlayZonePinZoomScale = useMemo(
    () => getZoomedOutZoneScale(overlayMapRegion),
    [overlayMapRegion?.latitudeDelta, overlayMapRegion?.longitudeDelta],
  );
  const visibleZoneCoverage = useMemo(() => {
    if (!zoneAvailabilityAggregationEnabled) {
      return {
        zoneIds: new Set(),
        zoneIdentities: new Set(),
      };
    }

    const zoneIds = new Set();
    const zoneIdentities = new Set();

    [...visibleZoneMarkers, ...visibleCouncilParkings].forEach((zone) => {
      if (zone?.id != null) {
        zoneIds.add(String(zone.id));
      }

      const zoneIdentity = normalizeZoneIdentity(
        zone?.name || zone?.zone_name,
        zone?.zone_type || zone?.type,
      );
      if (zoneIdentity !== "::") {
        zoneIdentities.add(zoneIdentity);
      }
    });

    return { zoneIds, zoneIdentities };
  }, [visibleCouncilParkings, visibleZoneMarkers, zoneAvailabilityAggregationEnabled]);
  const reportsWithoutZoneAvailabilityMarker = useMemo(
    () =>
      reports.filter((report) => {
        const reportZoneId =
          report?.zone_id != null ? String(report.zone_id) : null;
        if (reportZoneId && visibleZoneCoverage.zoneIds.has(reportZoneId)) {
          return false;
        }

        const reportIdentity = normalizeZoneIdentity(
          report?.zone_name,
          report?.zone_type || report?.parking_type,
        );
        if (
          reportIdentity !== "::" &&
          visibleZoneCoverage.zoneIdentities.has(reportIdentity)
        ) {
          return false;
        }

        return true;
      }),
    [reports, visibleZoneCoverage],
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

    stopInAppNavigation();
    setPendingZoneReportSpot(null);
    setSelectedSpot(null);

    if (!focusUserRadiusView(600)) {
      focusMapRegion(
        {
          latitude: reportedSpot.latitude,
          longitude: reportedSpot.longitude,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        },
        600,
      );
    }
  });

  const claimMutation = useClaimSpot(
    location,
    (claimResult) => {
      setSelectedSpot(null);
      stopInAppNavigation();

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
    stopInAppNavigation();
  });

  const deleteReportMutation = useDeleteReportSpot(() => {
    setSelectedSpot(null);
    stopInAppNavigation();
    Alert.alert("Success", "Your parking spot report has been deleted");
  });

  const handleDeleteSpotWithTarget = useCallback((spotToDelete) => {
    if (!spotToDelete?.id) {
      Alert.alert("Error", "Report not found");
      return;
    }

    deleteReportMutation.mutate(spotToDelete.id);
  }, [deleteReportMutation]);

  useEffect(() => {
    if (!activeNavigationTarget || !location) {
      return;
    }

    const currentCoordinate = {
      latitude: location.latitude,
      longitude: location.longitude,
    };
    const distanceToTarget = getDistanceMeters(
      currentCoordinate,
      activeNavigationTarget,
    );

    if (
      distanceToTarget !== null &&
      distanceToTarget <= ACTIVE_NAVIGATION_ARRIVAL_METERS
    ) {
      stopInAppNavigation();
      Alert.alert("Arrived", "You have reached your destination.");
      return;
    }

    const targetKey = String(
      activeNavigationTarget.id ||
        `${activeNavigationTarget.latitude.toFixed(6)},${activeNavigationTarget.longitude.toFixed(6)}`,
    );
    const previousRefresh = lastNavigationRefreshRef.current;
    const movedDistance = previousRefresh.coordinate
      ? getDistanceMeters(previousRefresh.coordinate, currentCoordinate)
      : null;
    const now = Date.now();
    const targetChanged = previousRefresh.targetKey !== targetKey;
    const routeMissingLongEnough =
      routeCoordinates.length === 0 &&
      now - previousRefresh.timestamp >= 1500;
    const shouldReroute =
      targetChanged ||
      routeMissingLongEnough ||
      movedDistance === null ||
      movedDistance >= ACTIVE_NAVIGATION_REROUTE_DISTANCE_METERS ||
      now - previousRefresh.timestamp >= ACTIVE_NAVIGATION_REROUTE_INTERVAL_MS;

    if (!shouldReroute) {
      return;
    }

    lastNavigationRefreshRef.current = {
      coordinate: currentCoordinate,
      timestamp: now,
      targetKey,
    };

    getDirections(activeNavigationTarget, { fitToRoute: false });
  }, [
    activeNavigationTarget,
    getDirections,
    location,
    routeCoordinates.length,
    stopInAppNavigation,
  ]);

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

  // Keep passive report updates framed around the full user radius instead of zooming into pins.
  useEffect(() => {
    const currentReportCount = reports.length;

    if (!location) {
      lastAutoFramedReportCountRef.current = currentReportCount;
      return;
    }

    if (lastAutoFramedReportCountRef.current === null) {
      lastAutoFramedReportCountRef.current = currentReportCount;
      return;
    }

    if (lastAutoFramedReportCountRef.current === currentReportCount) {
      return;
    }

    lastAutoFramedReportCountRef.current = currentReportCount;

    if (
      !isFollowingLiveLocation ||
      selectedSpot ||
      selectedZone ||
      routeCoordinates.length > 0
    ) {
      return;
    }

    focusUserRadiusView(700);
  }, [
    focusUserRadiusView,
    isFollowingLiveLocation,
    location,
    reports.length,
    routeCoordinates.length,
    selectedSpot,
    selectedZone,
  ]);

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

      if (params.navigate === "true") {
        focusMapRegion(
          {
            latitude: spot.latitude,
            longitude: spot.longitude,
            latitudeDelta: 0.002,
            longitudeDelta: 0.002,
          },
          1000,
        );
      } else if (!focusUserRadiusView(1000)) {
        focusMapRegion(
          {
            latitude: spot.latitude,
            longitude: spot.longitude,
            latitudeDelta: 0.002,
            longitudeDelta: 0.002,
          },
          1000,
        );
      }

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
        "You can only report a spot when your current location is inside a mapped parking zone.",
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
        "You can only report a spot when your current location is inside a mapped parking zone.",
      );
      return;
    }

    const reportCoordinates =
      zoneOptionToReport.latitude != null && zoneOptionToReport.longitude != null
        ? {
            latitude: zoneOptionToReport.latitude,
            longitude: zoneOptionToReport.longitude,
          }
        : location;

    console.log("[report.ui] Confirm report tapped", {
      userLatitude: location.latitude,
      userLongitude: location.longitude,
      reportLatitude: reportCoordinates.latitude,
      reportLongitude: reportCoordinates.longitude,
      selectedZoneId: zoneOptionToReport.zoneId || null,
      selectedParkingType: zoneOptionToReport.parkingType || null,
      spotQuantity,
      zoneId: currentZone?.id || null,
    });

    Alert.alert(
      "Confirm Parking Spot Report",
      `Report ${spotQuantity} ${zoneOptionToReport.parkingType || "parking"} spot${spotQuantity > 1 ? "s" : ""} for ${zoneOptionToReport.zoneName || "this nearby zone"}? Your current location must be inside that mapped parking zone.`,
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
              userLatitude: location.latitude,
              userLongitude: location.longitude,
              reportLatitude: reportCoordinates.latitude,
              reportLongitude: reportCoordinates.longitude,
              selectedZoneId: zoneOptionToReport.zoneId || null,
              selectedParkingType: zoneOptionToReport.parkingType || null,
              spotQuantity,
            });
            reportMutation.mutate({
              coords: reportCoordinates,
              userCoords: location,
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
      stopInAppNavigation();
    },
    [logSpotSelection, stopInAppNavigation],
  );

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
      stopInAppNavigation();

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
    [focusMapRegion, logSpotSelection, selectedZone, stopInAppNavigation],
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
      "Are you at this parking spot? Your current location must be confirmed within 5m of the reported spot coordinates before the claim will succeed. Claiming will remove it from the map for others.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Claim",
          onPress: () => {
            setSelectedSpot(null);
            stopInAppNavigation();
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
  }, [selectedSpot, location, stopInAppNavigation, claimMutation]);

  const handleReportFalseSpot = useCallback((spotToReport) => {
    const targetSpot = spotToReport || selectedSpot;
    if (!targetSpot) return;

    Alert.alert(
      "Report False Spot?",
      "Is this spot report inaccurate or not in a parking zone? The reporter's trust score will only decrease once 3 different users flag the same spot as false.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report",
          style: "destructive",
          onPress: () => {
            setSelectedSpot(null);
            stopInAppNavigation();
            reportFalseMutation.mutate(targetSpot);
          },
        },
      ],
    );
  }, [selectedSpot, stopInAppNavigation, reportFalseMutation]);

  const handleRecenter = useCallback(() => {
    if (location) {
      focusUserRadiusView(500);
      stopInAppNavigation();
    }
  }, [focusUserRadiusView, location, stopInAppNavigation]);

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
              radius={displayedDetectionRadius}
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

          {selectedZonePolygons.map((polygon, index) => (
            <Polygon
              key={`selected-zone-polygon-${selectedZone?.id ?? "unknown"}-${index}`}
              coordinates={polygon.coordinates}
              holes={polygon.holes}
              strokeColor="rgba(59, 130, 246, 0.95)"
              fillColor="rgba(59, 130, 246, 0.16)"
              strokeWidth={3}
              tappable={false}
            />
          ))}

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
                onZonePress={handleZonePress}
                selectedZone={selectedZone}
                zoomScale={zonePinZoomScale}
              />
              <ZoneMarkers
                zones={visibleZoneMarkers}
                userLocation={location}
                radius={detectionRadius}
                onZonePress={handleZonePress}
                selectedZone={selectedZone}
                getAvailabilityCount={getZoneAvailabilityCount}
                zoomScale={zonePinZoomScale}
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
              region={overlayMapRegion}
            />
            <AndroidParkingZoneOverlay
              mapRef={mapRef}
              zones={visibleCouncilParkings}
              userLocation={location}
              radius={detectionRadius}
              getAvailabilityCount={getZoneAvailabilityCount}
              onZonePress={handleZonePress}
              selectedZone={selectedZone}
              overlayRevision={mapOverlayRevision}
              region={overlayMapRegion}
              zoomScale={overlayZonePinZoomScale}
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
              region={overlayMapRegion}
              zoomScale={overlayZonePinZoomScale}
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
            backgroundColor: "rgba(11, 31, 51, 0.78)",
            borderRadius: 16,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: "rgba(224, 242, 254, 0.14)",
            shadowColor: BRAND_PALETTE.deepNavy,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 8,
            overflow: "hidden",
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 14,
              right: 14,
              height: 1,
              backgroundColor: "rgba(125, 211, 252, 0.24)",
            }}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    backgroundColor: "rgba(125, 211, 252, 0.65)",
                  }}
                />
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "800",
                    color: "rgba(224, 242, 254, 0.74)",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                  }}
                >
                  In-app navigation
                </Text>
              </View>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: "rgba(255, 255, 255, 0.96)",
                }}
              >
                {[routeDuration, routeDistance].filter(Boolean).join(" | ") ||
                  "Route ready"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={stopInAppNavigation}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: "rgba(224, 242, 254, 0.08)",
                borderWidth: 1,
                borderColor: "rgba(224, 242, 254, 0.12)",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: "rgba(240, 249, 255, 0.88)",
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
          stopInAppNavigation();
        }}
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
          stopInAppNavigation();
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
