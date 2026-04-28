import React, { useState, useCallback, useRef, useEffect, useMemo, useContext } from "react";
import {
  View,
  Text,
  Alert,
  Modal,
  Platform,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as ExpoLocation from "expo-location";
import MapView, { Circle, Polygon, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomTabBarHeightContext,
} from "@react-navigation/bottom-tabs";
import { useLocalSearchParams } from "expo-router";

import { useLocation } from "@/hooks/useLocation";
import {
  useParkingZones,
  useCurrentZone,
  useNearbyReports,
  useReportSpot,
  useSuggestParkingZone,
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
import { filterOverlappingZones, mergeDistinctZones } from "@/utils/zoneDeduplication";
import { PARKING_ALERT_RADIUS_METERS } from "@/constants/detectionRadius";
import { BRAND_PALETTE } from "@/theme/brandColors";
import { isLocationInsideZoneBoundary } from "@/utils/zoneGeometry";
import { getZoneCoverageModel, getZoneCoverageSummary } from "@/utils/zoneCoverage";

const normalizeCoordinate = (value) => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const MAX_SUGGESTED_ZONE_EVIDENCE_BASE64_LENGTH = 800000;

const normalizeMapHeading = (value) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return ((value % 360) + 360) % 360;
};

const buildTracePath = (coordinates, closePath = false) => {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return [];
  }

  if (!closePath || coordinates.length < 3) {
    return coordinates;
  }

  const [firstCoordinate] = coordinates;
  const lastCoordinate = coordinates[coordinates.length - 1];
  if (
    firstCoordinate?.latitude === lastCoordinate?.latitude &&
    firstCoordinate?.longitude === lastCoordinate?.longitude
  ) {
    return coordinates;
  }

  return [...coordinates, firstCoordinate];
};

const interpolateCoordinate = (start, end, ratio) => ({
  latitude: start.latitude + (end.latitude - start.latitude) * ratio,
  longitude: start.longitude + (end.longitude - start.longitude) * ratio,
});

const buildTraceCoordinates = (coordinates, progress, { closePath = false } = {}) => {
  const tracePath = buildTracePath(coordinates, closePath);
  if (tracePath.length < 2) {
    return tracePath;
  }

  const clampedProgress = Math.max(0, Math.min(progress, 1));
  if (clampedProgress === 0) {
    return [tracePath[0]];
  }

  if (clampedProgress === 1) {
    return tracePath;
  }

  const segmentLengths = [];
  let totalLength = 0;

  for (let index = 1; index < tracePath.length; index += 1) {
    const length = getDistanceMeters(tracePath[index - 1], tracePath[index]);
    segmentLengths.push(length);
    totalLength += length;
  }

  if (!Number.isFinite(totalLength) || totalLength <= 0) {
    return tracePath;
  }

  const targetLength = totalLength * clampedProgress;
  const tracedCoordinates = [tracePath[0]];
  let traversedLength = 0;

  for (let index = 1; index < tracePath.length; index += 1) {
    const segmentLength = segmentLengths[index - 1];
    const startCoordinate = tracePath[index - 1];
    const endCoordinate = tracePath[index];

    if (traversedLength + segmentLength <= targetLength) {
      tracedCoordinates.push(endCoordinate);
      traversedLength += segmentLength;
      continue;
    }

    const remainingLength = targetLength - traversedLength;
    const ratio =
      segmentLength > 0
        ? Math.max(0, Math.min(remainingLength / segmentLength, 1))
        : 0;
    tracedCoordinates.push(interpolateCoordinate(startCoordinate, endCoordinate, ratio));
    break;
  }

  return tracedCoordinates;
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
const SUGGESTED_ZONE_TYPE_OPTIONS = ["P1", "P2", "P3", "P4", "FH"];
const SUGGESTED_PARKING_CATEGORY_OPTIONS = [
  "On-street",
  "Open-air lot",
  "Multi-storey",
  "Underground",
  "Other",
];
const formatSuggestedZoneCoordinateLabel = (location) => {
  if (!location) return "";

  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return "";
  }

  return `${Math.abs(latitude).toFixed(5)}${latitude >= 0 ? "N" : "S"}, ${Math.abs(longitude).toFixed(5)}${longitude >= 0 ? "E" : "W"}`;
};

const getSuggestedZoneStreetLabel = (placemark, location) => {
  const nameParts = [
    placemark?.name,
    placemark?.street,
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  const uniqueNameParts = [...new Set(nameParts)];
  if (uniqueNameParts.length > 0) {
    return uniqueNameParts.join(", ");
  }

  const areaParts = [
    placemark?.district,
    placemark?.subregion,
    placemark?.city,
    placemark?.region,
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  if (areaParts.length > 0) {
    return areaParts.join(", ");
  }

  return formatSuggestedZoneCoordinateLabel(location);
};

const DEFAULT_MAP_DELTA = 0.005;
const FOLLOW_ANIMATION_DISTANCE_METERS = 3;
const FOLLOW_ANIMATION_INTERVAL_MS = 750;
const ACTIVE_NAVIGATION_REROUTE_DISTANCE_METERS = 8;
const ACTIVE_NAVIGATION_REROUTE_INTERVAL_MS = 3000;
const ACTIVE_NAVIGATION_ARRIVAL_METERS = 25;
const MAP_PROVIDER = Platform.OS === "android" ? PROVIDER_GOOGLE : undefined;
const MAP_GOOGLE_RENDERER = Platform.OS === "android" ? "LEGACY" : undefined;
const MAP_RADIUS_PIN_PADDING_METERS = 12;
const METERS_PER_DEGREE_LATITUDE = 111320;
const RADIUS_VIEW_PADDING_MULTIPLIER = 1.15;
const NAVIGATION_CARD_TO_ACTION_BUTTON_GAP = 12;
const NAVIGATION_CARD_WIDTH = 220;
const SELECTED_ZONE_TRACE_DURATION_MS = 2200;
const EMPTY_EXTERNAL_MAP_SELECTION_PARAMS = {
  navigate: "",
  navigationRequestId: "",
  alertEventId: "",
  spotId: "",
  spotLat: "",
  spotLng: "",
  spotName: "",
  spotType: "",
  zoneId: "",
  zoneName: "",
  zoneType: "",
  zoneLat: "",
  zoneLng: "",
  zoneCapacity: "",
  zoneRules: "",
};

const normalizeZoneIdentity = (name, type) => {
  const normalizedName = String(name || "").trim().toLowerCase();
  const normalizedType = String(type || "").trim().toLowerCase();
  return `${normalizedName}::${normalizedType}`;
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
    center_lat: latitude,
    center_lng: longitude,
    boundary_geojson: zone.boundary_geojson ?? null,
    sourceDataset: zone.sourceDataset ?? zone.source_dataset ?? null,
    sourceOwner: zone.sourceOwner ?? zone.source_owner ?? null,
    localityName: zone.localityName ?? zone.locality_name ?? null,
    coverage_geojson: zone.coverage_geojson ?? null,
    segment_geojson: zone.segment_geojson ?? null,
    street_segment_geojson: zone.street_segment_geojson ?? null,
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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
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
  const overlayRegionFrameRef = useRef(null);
  const pendingOverlayRegionRef = useRef(null);
  const lastNavigationRefreshRef = useRef({
    coordinate: null,
    timestamp: 0,
    targetKey: null,
  });
  const lastAutoFramedReportCountRef = useRef(null);
  const lastAutoNavigationRequestRef = useRef(null);
  const lastMapHeadingSyncRef = useRef(0);
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams(); // Get navigation params
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSuggestZoneModal, setShowSuggestZoneModal] = useState(false);
  const [suggestedZoneLocationSnapshot, setSuggestedZoneLocationSnapshot] = useState(null);
  const [suggestedZoneCapacity, setSuggestedZoneCapacity] = useState("");
  const [suggestedZoneType, setSuggestedZoneType] = useState("");
  const [suggestedZoneStreetName, setSuggestedZoneStreetName] = useState("");
  const [isResolvingSuggestedZoneStreetName, setIsResolvingSuggestedZoneStreetName] = useState(false);
  const [suggestedZoneEvidence, setSuggestedZoneEvidence] = useState(null);
  const [isUploadingSuggestZoneEvidence, setIsUploadingSuggestZoneEvidence] = useState(false);
  const [suggestedParkingCategory, setSuggestedParkingCategory] = useState("");
  const [suggestedZoneDescription, setSuggestedZoneDescription] = useState("");
  const [isPublicParkingConfirmed, setIsPublicParkingConfirmed] = useState(false);
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
  const [selectedZoneTraceProgress, setSelectedZoneTraceProgress] = useState(0);
  const [mapHeading, setMapHeading] = useState(0);
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
  const tabBarHeightContext = useContext(BottomTabBarHeightContext);
  const tabBarHeight = Number(tabBarHeightContext) || 0;
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

  const resetSuggestedZoneDraft = useCallback(() => {
    setSuggestedZoneLocationSnapshot(null);
    setSuggestedZoneStreetName("");
    setSuggestedZoneCapacity("");
    setSuggestedZoneType("");
    setSuggestedZoneEvidence(null);
    setSuggestedParkingCategory("");
    setSuggestedZoneDescription("");
    setIsPublicParkingConfirmed(false);
    setIsResolvingSuggestedZoneStreetName(false);
  }, []);

  const prepareSuggestedZoneEvidence = useCallback(async (asset, fallbackFileName) => {
    if (!asset?.uri) {
      throw new Error("Please choose a valid photo and try again.");
    }

    const manipulations = [
      { resize: { width: 1280 } },
    ];
    const firstPass = await ImageManipulator.manipulateAsync(
      asset.uri,
      manipulations,
      {
        compress: 0.55,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      },
    );

    let normalizedBase64 = firstPass?.base64 || "";
    let normalizedUri = firstPass?.uri || asset.uri;

    if (normalizedBase64.length > MAX_SUGGESTED_ZONE_EVIDENCE_BASE64_LENGTH) {
      const secondPass = await ImageManipulator.manipulateAsync(
        normalizedUri,
        [{ resize: { width: 960 } }],
        {
          compress: 0.42,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      );

      normalizedBase64 = secondPass?.base64 || normalizedBase64;
      normalizedUri = secondPass?.uri || normalizedUri;
    }

    if (
      !normalizedBase64 ||
      normalizedBase64.length > MAX_SUGGESTED_ZONE_EVIDENCE_BASE64_LENGTH
    ) {
      throw new Error(
        "This photo is too large to upload. Please choose a closer, smaller photo and try again.",
      );
    }

    return {
      uri: normalizedUri,
      base64: normalizedBase64,
      mimeType: "image/jpeg",
      fileName: fallbackFileName || asset.fileName || asset.uri.split("/").pop() || "parking-zone.jpg",
    };
  }, []);

  const scheduleOverlayRegionUpdate = useCallback((region) => {
    if (!region) {
      return;
    }

    const nextRegion = {
      latitude: region.latitude,
      longitude: region.longitude,
      latitudeDelta: region.latitudeDelta,
      longitudeDelta: region.longitudeDelta,
    };

    const currentRegion = pendingOverlayRegionRef.current || mapRegionRef.current;
    if (
      currentRegion &&
      currentRegion.latitude === nextRegion.latitude &&
      currentRegion.longitude === nextRegion.longitude &&
      currentRegion.latitudeDelta === nextRegion.latitudeDelta &&
      currentRegion.longitudeDelta === nextRegion.longitudeDelta
    ) {
      return;
    }

    pendingOverlayRegionRef.current = nextRegion;

    if (overlayRegionFrameRef.current != null) {
      return;
    }

    const scheduleFrame =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : (callback) => setTimeout(callback, 16);

    overlayRegionFrameRef.current = scheduleFrame(() => {
      overlayRegionFrameRef.current = null;

      const nextPendingRegion = pendingOverlayRegionRef.current;
      pendingOverlayRegionRef.current = null;

      if (!nextPendingRegion) {
        return;
      }

      setOverlayMapRegion(nextPendingRegion);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (overlayRegionFrameRef.current != null) {
        if (typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(overlayRegionFrameRef.current);
        } else {
          clearTimeout(overlayRegionFrameRef.current);
        }
      }
    };
  }, []);

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
      scheduleOverlayRegionUpdate(nextRegion);
      mapRef.current.animateToRegion(nextRegion, duration);
    } catch (e) {
      // Not supported on web preview — initialRegion handles it
    }
  }, [scheduleOverlayRegionUpdate]);

  const clearExternalMapSelectionParams = useCallback(() => {
    if (typeof navigation?.setParams !== "function") {
      return;
    }

    navigation.setParams(EMPTY_EXTERNAL_MAP_SELECTION_PARAMS);
  }, [navigation]);

  const updateFollowCamera = useCallback((coordinate, duration = 0) => {
    if (!mapRef.current || !coordinate) {
      return;
    }

    const nextRegion = {
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      latitudeDelta: mapRegionRef.current?.latitudeDelta || DEFAULT_MAP_DELTA,
      longitudeDelta: mapRegionRef.current?.longitudeDelta || DEFAULT_MAP_DELTA,
    };

    mapRegionRef.current = nextRegion;
    setMapRegion(nextRegion);
    scheduleOverlayRegionUpdate(nextRegion);

    try {
      if (typeof mapRef.current.animateCamera === "function") {
        mapRef.current.animateCamera(
          {
            center: {
              latitude: coordinate.latitude,
              longitude: coordinate.longitude,
            },
          },
          { duration },
        );
        return;
      }

      if (typeof mapRef.current.setCamera === "function") {
        mapRef.current.setCamera({
          center: {
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
          },
        });
        return;
      }

      mapRef.current.animateToRegion(nextRegion, duration);
    } catch (error) {
      try {
        mapRef.current.animateToRegion(nextRegion, duration);
      } catch (fallbackError) {
        // Not supported on web preview — initialRegion handles it
      }
    }
  }, [scheduleOverlayRegionUpdate]);

  const focusMapRegion = useCallback(
    (region, duration) => {
      setIsFollowingLiveLocation(false);
      safeAnimateToRegion(region, duration);
    },
    [safeAnimateToRegion],
  );

  const syncMapHeading = useCallback((force = false) => {
    if (!mapRef.current || typeof mapRef.current.getCamera !== "function") {
      return;
    }

    const now = Date.now();
    if (!force && now - lastMapHeadingSyncRef.current < 120) {
      return;
    }

    lastMapHeadingSyncRef.current = now;
    mapRef.current
      .getCamera()
      .then((camera) => {
        const nextHeading = normalizeMapHeading(Number(camera?.heading));
        setMapHeading((currentHeading) =>
          Math.abs(currentHeading - nextHeading) < 1 ? currentHeading : nextHeading,
        );
      })
      .catch(() => {});
  }, []);

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
    scheduleOverlayRegionUpdate(mapRegionRef.current);

    if (details?.isGesture) {
      setIsFollowingLiveLocation(false);
    }

    if (Platform.OS === "android") {
      scheduleOverlayRefresh(true);
    }
    syncMapHeading(true);
  }, [scheduleOverlayRefresh, scheduleOverlayRegionUpdate, syncMapHeading]);

  const handleRegionChange = useCallback((region) => {
    if (region) {
      if (Platform.OS === "android") {
        scheduleOverlayRegionUpdate(region);
      }
    }
  }, [scheduleOverlayRegionUpdate]);

  const handleMapReady = useCallback(() => {
    if (Platform.OS === "android") {
      scheduleOverlayRefresh(true);
    }
    syncMapHeading(true);
  }, [scheduleOverlayRefresh, syncMapHeading]);

  const nearbyZones = useParkingZones(location, detectionRadius, {
    includeGeometry: true,
    refetchIntervalMs: false,
  });
  const currentZone = useCurrentZone(location);
  const { reports, refetch: refetchReports } = useNearbyReports(
    location,
    detectionRadius,
    {
      currentTimeRefreshIntervalMs: 10000,
    },
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
      ),
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
    const currentZoneId =
      currentZone?.id != null ? String(currentZone.id) : null;
    const options = nearbyZones
      .map((zone) => {
        const parkingType = String(zone?.zone_type || "").trim();
        const zoneName = String(zone?.name || zone?.zone_name || "").trim();
        const zoneId = zone?.id;
        const latitude = normalizeCoordinate(zone?.center_lat ?? zone?.latitude);
        const longitude = normalizeCoordinate(zone?.center_lng ?? zone?.longitude);
        const zoneBoundary = zone?.boundary_geojson ?? null;
        const isInsideBoundary = isLocationInsideZoneBoundary(zoneBoundary, location);
        const matchesCurrentZone =
          currentZoneId != null && zoneId != null && String(zoneId) === currentZoneId;

        if (
          !parkingType ||
          !zoneName ||
          zoneId == null ||
          latitude === null ||
          longitude === null ||
          (!isInsideBoundary && !matchesCurrentZone)
        ) {
          return null;
        }

        return {
          zoneId: String(zoneId),
          zoneName,
          parkingType,
          distanceMeters: Number(zone?.distance_meters) || 0,
          latitude,
          longitude,
          boundary_geojson: zoneBoundary,
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
        boundary_geojson: currentZone.boundary_geojson ?? null,
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
  }, [
    currentZone?.boundary_geojson,
    currentZone?.center_lat,
    currentZone?.center_lng,
    currentZone?.id,
    currentZone?.name,
    currentZone?.zone_type,
    location?.latitude,
    location?.longitude,
    nearbyZones,
  ]);

  const areReportZoneOptionsEqual = useCallback((leftOptions, rightOptions) => {
    if (leftOptions === rightOptions) {
      return true;
    }

    if (!Array.isArray(leftOptions) || !Array.isArray(rightOptions)) {
      return false;
    }

    if (leftOptions.length !== rightOptions.length) {
      return false;
    }

    return leftOptions.every((leftOption, index) => {
      const rightOption = rightOptions[index];
      return (
        leftOption?.zoneId === rightOption?.zoneId &&
        leftOption?.zoneName === rightOption?.zoneName &&
        leftOption?.parkingType === rightOption?.parkingType &&
        Number(leftOption?.latitude) === Number(rightOption?.latitude) &&
        Number(leftOption?.longitude) === Number(rightOption?.longitude) &&
        String(leftOption?.boundary_geojson || "") ===
          String(rightOption?.boundary_geojson || "")
      );
    });
  }, []);

  useEffect(() => {
    if (!location || availableZoneOptions.length === 0) {
      return;
    }

    const nextLocation = {
      latitude: location.latitude,
      longitude: location.longitude,
    };

    setLastKnownReportZoneState((currentState) => {
      const currentLocation = currentState.location;
      const hasSameLocation =
        currentLocation &&
        Number(currentLocation.latitude) === Number(nextLocation.latitude) &&
        Number(currentLocation.longitude) === Number(nextLocation.longitude);

      if (
        hasSameLocation &&
        areReportZoneOptionsEqual(currentState.options, availableZoneOptions)
      ) {
        return currentState;
      }

      return {
        options: availableZoneOptions,
        location: nextLocation,
      };
    });
  }, [
    availableZoneOptions,
    areReportZoneOptionsEqual,
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

  const visibleCouncilParkings = useMemo(() => {
    let nextVisibleCouncilZones = detectedZonePins.councilZones;

    if (selectedZone && Platform.OS === "android") {
      const selectedLatitude = Number(selectedZone.center_lat ?? selectedZone.latitude);
      const selectedLongitude = Number(selectedZone.center_lng ?? selectedZone.longitude);
      if (Number.isFinite(selectedLatitude) && Number.isFinite(selectedLongitude)) {
        const selectedZoneId =
          selectedZone.id != null ? String(selectedZone.id) : null;
        const alreadyVisible = nextVisibleCouncilZones.some((zone) => {
          if (selectedZoneId && zone?.id != null) {
            return String(zone.id) === selectedZoneId;
          }

          return (
            Number(zone?.latitude) === selectedLatitude &&
            Number(zone?.longitude) === selectedLongitude
          );
        });

        if (!alreadyVisible) {
          nextVisibleCouncilZones = [
            selectedZone,
            ...nextVisibleCouncilZones.slice(
              0,
              Math.max(MAX_DETECTED_COUNCIL_ZONE_PINS - 1, 0),
            ),
          ];
        }
      }
    }

    return filterOverlappingZones(nextVisibleCouncilZones, visibleZoneMarkers);
  }, [detectedZonePins.councilZones, selectedZone, visibleZoneMarkers]);
  const zonePinZoomScale = useMemo(
    () => getZoomedOutZoneScale(mapRegion),
    [mapRegion?.latitudeDelta, mapRegion?.longitudeDelta],
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
  const selectedZoneCoverage = useMemo(
    () => getZoneCoverageModel(selectedZone),
    [selectedZone],
  );
  const selectedZoneCoverageSummary = useMemo(
    () => getZoneCoverageSummary(selectedZone),
    [selectedZone],
  );
  const selectedZonePolygons = selectedZoneCoverage.polygons;
  const selectedZoneLineCoverage = selectedZoneCoverage.polylines;
  const selectedZoneApproximateCircle = selectedZoneCoverage.approximateCircle;
  const selectedZoneFillOpacity = useMemo(() => {
    if (selectedZoneCoverage.kind !== "polygon") {
      return 0;
    }

    const fillProgress = Math.max(0, (selectedZoneTraceProgress - 0.72) / 0.28);
    return fillProgress * 0.18;
  }, [selectedZoneCoverage.kind, selectedZoneTraceProgress]);
  const selectedZoneOutlinePolylines = useMemo(
    () => [
      ...selectedZonePolygons.map((coordinates) => buildTracePath(coordinates, true)),
      ...selectedZoneLineCoverage.map((coordinates) => buildTracePath(coordinates)),
    ],
    [selectedZoneLineCoverage, selectedZonePolygons],
  );
  const selectedZoneTracePolylines = useMemo(
    () => [
      ...selectedZonePolygons
        .map((coordinates) =>
          buildTraceCoordinates(coordinates, selectedZoneTraceProgress, {
            closePath: true,
          }),
        )
        .filter((coordinates) => coordinates.length >= 2),
      ...selectedZoneLineCoverage
        .map((coordinates) => buildTraceCoordinates(coordinates, selectedZoneTraceProgress))
        .filter((coordinates) => coordinates.length >= 2),
    ],
    [selectedZoneLineCoverage, selectedZonePolygons, selectedZoneTraceProgress],
  );
  const selectedZoneApproximateRadius = useMemo(() => {
    if (!selectedZoneApproximateCircle?.radius) {
      return 0;
    }

    return selectedZoneApproximateCircle.radius * (0.88 + selectedZoneTraceProgress * 0.12);
  }, [selectedZoneApproximateCircle?.radius, selectedZoneTraceProgress]);
  const selectedZoneTraceCompleted = selectedZoneTraceProgress >= 0.999;

  useEffect(() => {
    if (
      selectedZoneCoverage.kind === "pin" ||
      (selectedZonePolygons.length === 0 &&
        selectedZoneLineCoverage.length === 0 &&
        !selectedZoneApproximateCircle)
    ) {
      setSelectedZoneTraceProgress(0);
      return undefined;
    }

    let animationFrameId;
    let animationStartTime;

    setSelectedZoneTraceProgress(0);

    const animateTrace = (timestamp) => {
      if (animationStartTime == null) {
        animationStartTime = timestamp;
      }

      const elapsed = timestamp - animationStartTime;
      const progress = Math.min(elapsed / SELECTED_ZONE_TRACE_DURATION_MS, 1);
      const easedProgress = 1 - (1 - progress) * (1 - progress);
      setSelectedZoneTraceProgress(easedProgress);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animateTrace);
      }
    };

    animationFrameId = requestAnimationFrame(animateTrace);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [
    selectedZone?.id,
    selectedZoneApproximateCircle,
    selectedZoneCoverage.kind,
    selectedZoneLineCoverage.length,
    selectedZonePolygons.length,
  ]);

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
  const suggestZoneMutation = useSuggestParkingZone(location, (data) => {
    setShowReportModal(false);
    setShowSuggestZoneModal(false);
    resetSuggestedZoneDraft();
    Alert.alert(
      "Zone suggestion received",
      data?.message ||
        "Thanks. Your parking zone suggestion has been sent for review.",
    );
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

    updateFollowCamera(nextCoordinate, 120);
  }, [
    isFollowingLiveLocation,
    location?.latitude,
    location?.longitude,
    updateFollowCamera,
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

      clearExternalMapSelectionParams();
    }
  }, [
    clearExternalMapSelectionParams,
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

      clearExternalMapSelectionParams();
    }
  }, [
    clearExternalMapSelectionParams,
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
    setSelectedZoneOption(preferredZoneOption || null);

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
        "Inside Parking Zone Required",
        "You can only report a spot when your current location is inside a mapped parking zone area.",
      );
      return;
    }

    const reportCoordinates = {
      latitude: location.latitude,
      longitude: location.longitude,
    };

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
      `Report ${spotQuantity} ${zoneOptionToReport.parkingType || "parking"} spot${spotQuantity > 1 ? "s" : ""} for ${zoneOptionToReport.zoneName || "this nearby zone"}? Your current location must be inside that mapped parking zone area.`,
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
    reportMutation,
    selectedZoneOption,
    spotQuantity,
  ]);

  const handleSuggestParkingZone = useCallback(() => {
    if (!location || suggestZoneMutation.isPending) {
      return;
    }
    resetSuggestedZoneDraft();
    setSuggestedZoneLocationSnapshot({
      latitude: location.latitude,
      longitude: location.longitude,
    });
    setShowSuggestZoneModal(true);
  }, [location, resetSuggestedZoneDraft, suggestZoneMutation]);

  const handleSuggestParkingZoneFromReport = useCallback(() => {
    setShowReportModal(false);
    handleSuggestParkingZone();
  }, [handleSuggestParkingZone]);

  const handleConfirmSuggestParkingZone = useCallback(() => {
    const suggestionCoords = suggestedZoneLocationSnapshot || location;

    if (!suggestionCoords || suggestZoneMutation.isPending || isUploadingSuggestZoneEvidence) {
      return;
    }

    const normalizedStreetName = suggestedZoneStreetName.trim();
    if (!normalizedStreetName) {
      Alert.alert(
        "Location required",
        "Wait for ParkMate to detect the street for this missing zone before sending it for review.",
      );
      return;
    }

    if (!SUGGESTED_ZONE_TYPE_OPTIONS.includes(suggestedZoneType)) {
      Alert.alert(
        "Select parking type",
        "Choose the parking type for this missing zone before sending it for review.",
      );
      return;
    }

    const normalizedCapacity = suggestedZoneCapacity.trim();
    const parsedCapacity = normalizedCapacity
      ? Number.parseInt(normalizedCapacity, 10)
      : null;

    if (normalizedCapacity && (!Number.isFinite(parsedCapacity) || parsedCapacity < 0)) {
      Alert.alert(
        "Invalid capacity",
        "Approximate capacity must be a non-negative number.",
      );
      return;
    }

    if (!suggestedZoneEvidence?.base64) {
      Alert.alert(
        "Photo evidence required",
        "Upload a photo of the parking area before sending this missing zone for review.",
      );
      return;
    }

    if (!suggestedParkingCategory) {
      Alert.alert(
        "Parking category required",
        "Choose the parking category for this missing parking zone before sending it for review.",
      );
      return;
    }

    if (!isPublicParkingConfirmed) {
      Alert.alert(
        "Public parking confirmation required",
        "Confirm that this location is public parking before submitting it for review.",
      );
      return;
    }

    setIsUploadingSuggestZoneEvidence(true);

    const evidencePhotoDataUrl = `data:${suggestedZoneEvidence.mimeType || "image/jpeg"};base64,${suggestedZoneEvidence.base64}`;

    suggestZoneMutation.mutate(
      {
        coords: {
          latitude: suggestionCoords.latitude,
          longitude: suggestionCoords.longitude,
        },
        streetName: normalizedStreetName,
        estimatedCapacitySpaces: parsedCapacity,
        suggestedZoneType,
        evidencePhotoUrl: evidencePhotoDataUrl,
        parkingCategory: suggestedParkingCategory,
        description: suggestedZoneDescription,
        publicParkingConfirmed: isPublicParkingConfirmed,
      },
      {
        onSettled: () => {
          setIsUploadingSuggestZoneEvidence(false);
        },
      },
    );
  }, [
    isUploadingSuggestZoneEvidence,
    location,
    suggestedZoneLocationSnapshot,
    suggestZoneMutation,
    suggestedZoneCapacity,
    suggestedParkingCategory,
    suggestedZoneDescription,
    suggestedZoneEvidence,
    suggestedZoneStreetName,
    suggestedZoneType,
    isPublicParkingConfirmed,
  ]);

  const handlePickSuggestZoneEvidence = useCallback(async () => {
    if (suggestZoneMutation.isPending || isUploadingSuggestZoneEvidence) {
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Photo access required",
          "Allow photo library access so you can attach evidence for the missing parking zone.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
        base64: false,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert("Photo unavailable", "Please choose a valid photo and try again.");
        return;
      }

      setIsUploadingSuggestZoneEvidence(true);
      const preparedEvidence = await prepareSuggestedZoneEvidence(asset, "parking-zone.jpg");
      setSuggestedZoneEvidence(preparedEvidence);
    } catch (error) {
      console.error("Error picking photo:", error);
      Alert.alert(
        "Could not prepare photo",
        error?.message || "Please try again.",
      );
    } finally {
      setIsUploadingSuggestZoneEvidence(false);
    }
  }, [
    isUploadingSuggestZoneEvidence,
    prepareSuggestedZoneEvidence,
    suggestZoneMutation.isPending,
  ]);

  const handleCaptureSuggestZoneEvidence = useCallback(async () => {
    if (suggestZoneMutation.isPending || isUploadingSuggestZoneEvidence) {
      return;
    }

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Camera access required",
          "Allow camera access so you can take evidence photos for the missing parking zone.",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
        base64: false,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert("Photo unavailable", "Please take a valid photo and try again.");
        return;
      }

      setIsUploadingSuggestZoneEvidence(true);
      const preparedEvidence = await prepareSuggestedZoneEvidence(asset, "parking-zone.jpg");
      setSuggestedZoneEvidence(preparedEvidence);
    } catch (error) {
      console.error("Error capturing photo:", error);
      Alert.alert(
        "Could not prepare photo",
        error?.message || "Please try again.",
      );
    } finally {
      setIsUploadingSuggestZoneEvidence(false);
    }
  }, [
    isUploadingSuggestZoneEvidence,
    prepareSuggestedZoneEvidence,
    suggestZoneMutation.isPending,
  ]);

  useEffect(() => {
    if (!showSuggestZoneModal || !suggestedZoneLocationSnapshot) {
      if (!showSuggestZoneModal) {
        setIsResolvingSuggestedZoneStreetName(false);
      }
      return;
    }

    let cancelled = false;
    const fallbackLabel = formatSuggestedZoneCoordinateLabel(
      suggestedZoneLocationSnapshot,
    );

    setSuggestedZoneStreetName(fallbackLabel);
    setIsResolvingSuggestedZoneStreetName(true);

    ExpoLocation.reverseGeocodeAsync({
      latitude: suggestedZoneLocationSnapshot.latitude,
      longitude: suggestedZoneLocationSnapshot.longitude,
    })
      .then((results) => {
        if (cancelled) {
          return;
        }

        const nextLabel = getSuggestedZoneStreetLabel(
          results?.[0],
          suggestedZoneLocationSnapshot,
        );
        setSuggestedZoneStreetName(nextLabel || fallbackLabel);
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestedZoneStreetName(fallbackLabel);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsResolvingSuggestedZoneStreetName(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showSuggestZoneModal, suggestedZoneLocationSnapshot]);

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
    clearExternalMapSelectionParams();
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
  }, [clearExternalMapSelectionParams, focusMapRegion]);

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
      "Are you at this parking spot? Your current location must be close enough to the reported spot coordinates before the claim will succeed. Claiming will remove it from the map for others.",
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

  const selectedZoneModalPayload = useMemo(() => {
    if (!selectedZone) {
      return null;
    }

    return {
      ...selectedZone,
      coverage_label: selectedZoneCoverageSummary.label,
      coverage_accuracy_label: selectedZoneCoverageSummary.accuracyLabel,
      coverage_kind: selectedZoneCoverageSummary.kind,
    };
  }, [selectedZone, selectedZoneCoverageSummary]);

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
          followsUserLocation={false}
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

          {selectedZoneCoverage.kind === "polygon" &&
            selectedZonePolygons.map((coordinates, index) => (
              <Polygon
                key={`selected-zone-boundary-${selectedZone?.id ?? "active"}-${index}`}
                coordinates={coordinates}
                strokeColor="rgba(16, 185, 129, 0.14)"
                fillColor={`rgba(16, 185, 129, ${selectedZoneFillOpacity})`}
                strokeWidth={0.75}
                zIndex={2}
              />
            ))}

          {selectedZoneCoverage.kind === "approximate" &&
            selectedZoneApproximateCircle?.center &&
            selectedZoneApproximateRadius > 0 && (
              <>
                <Circle
                  center={selectedZoneApproximateCircle.center}
                  radius={selectedZoneApproximateRadius * 1.22}
                  strokeColor="rgba(16, 185, 129, 0.08)"
                  strokeWidth={1}
                  fillColor={`rgba(16, 185, 129, ${0.03 + selectedZoneTraceProgress * 0.02})`}
                  zIndex={1}
                />
                <Circle
                  center={selectedZoneApproximateCircle.center}
                  radius={selectedZoneApproximateRadius}
                  strokeColor="rgba(52, 211, 153, 0.18)"
                  strokeWidth={1}
                  fillColor={`rgba(16, 185, 129, ${0.07 + selectedZoneTraceProgress * 0.04})`}
                  zIndex={2}
                />
                <Circle
                  center={selectedZoneApproximateCircle.center}
                  radius={selectedZoneApproximateRadius * 0.7}
                  strokeColor="rgba(52, 211, 153, 0.12)"
                  strokeWidth={0.5}
                  fillColor={`rgba(52, 211, 153, ${0.04 + selectedZoneTraceProgress * 0.03})`}
                  zIndex={2}
                />
              </>
            )}

          {selectedZoneTraceCompleted &&
            selectedZoneOutlinePolylines.map((coordinates, index) => (
              <Polyline
                key={`selected-zone-outline-${selectedZone?.id ?? "active"}-${index}`}
                coordinates={coordinates}
                strokeColor="rgba(52, 211, 153, 0.96)"
                strokeWidth={2}
                lineCap="round"
                lineJoin="round"
                zIndex={4}
              />
            ))}

          {selectedZoneTracePolylines.map((coordinates, index) => (
            <Polyline
              key={`selected-zone-trace-${selectedZone?.id ?? "active"}-${index}`}
              coordinates={coordinates}
              strokeColor="rgba(52, 211, 153, 0.98)"
              strokeWidth={2}
              lineCap="round"
              lineJoin="round"
              zIndex={4}
            />
          ))}

          <UserLocationMarker location={location} mapHeading={mapHeading} />
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
                selectedZone={Platform.OS === "ios" ? null : selectedZone}
                zoomScale={zonePinZoomScale}
              />
              <ZoneMarkers
                zones={visibleZoneMarkers}
                userLocation={location}
                radius={detectionRadius}
                onZonePress={handleZonePress}
                selectedZone={Platform.OS === "ios" ? null : selectedZone}
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
        onSuggestMissingZone={handleSuggestParkingZoneFromReport}
      />

      <Modal
        visible={showSuggestZoneModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!suggestZoneMutation.isPending && !isUploadingSuggestZoneEvidence) {
            setShowSuggestZoneModal(false);
            resetSuggestedZoneDraft();
          }
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            justifyContent: "center",
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              borderRadius: 20,
              backgroundColor: "#FFFFFF",
              paddingTop: 18,
              borderWidth: 1,
              borderColor: "#E2E8F0",
              maxHeight: "88%",
            }}
          >
            <ScrollView
              style={{ paddingHorizontal: 18 }}
              contentContainerStyle={{ paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={{ fontSize: 20, fontWeight: "800", color: "#0F172A" }}>
                Suggest Missing Parking Zone
              </Text>
              <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 21, color: "#475569" }}>
                Send this location for review using your current coordinates, auto-detected
                street details, parking type, photo evidence, and estimated capacity.
              </Text>

              <Text
                style={{
                  marginTop: 16,
                  marginBottom: 6,
                  fontSize: 14,
                  fontWeight: "700",
                  color: "#0F172A",
                }}
              >
                Detected location
              </Text>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: "#CBD5E1",
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  backgroundColor: "#F8FAFC",
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#0F172A" }}>
                  {suggestedZoneStreetName || "Locating current street..."}
                </Text>
                <Text style={{ marginTop: 6, fontSize: 12, color: "#64748B" }}>
                  {formatSuggestedZoneCoordinateLabel(
                    suggestedZoneLocationSnapshot || location,
                  )}
                </Text>
                {isResolvingSuggestedZoneStreetName ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
                    <ActivityIndicator size="small" color="#0F766E" />
                    <Text style={{ fontSize: 12, color: "#0F766E" }}>
                      Detecting street from your current coordinates
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ marginTop: 8, fontSize: 12, color: "#64748B" }}>
                Auto-filled from your current location and coordinates.
              </Text>
              <Text style={{ marginTop: 14, fontSize: 12, color: "#64748B" }}>
                ParkMate will use this detected location label during review.
              </Text>

              <Text
                style={{
                  marginTop: 16,
                  marginBottom: 8,
                  fontSize: 14,
                  fontWeight: "700",
                  color: "#0F172A",
                }}
              >
                Parking type
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {SUGGESTED_ZONE_TYPE_OPTIONS.map((option) => {
                  const isSelected = suggestedZoneType === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      onPress={() => setSuggestedZoneType(option)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: isSelected ? "#0F766E" : "#CBD5E1",
                        backgroundColor: isSelected ? "#CCFBF1" : "#F8FAFC",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: isSelected ? "#115E59" : "#334155",
                        }}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={{ marginTop: 8, fontSize: 12, color: "#64748B" }}>
                Required. This helps review the expected parking rule for the area.
              </Text>

              <Text
                style={{
                  marginTop: 16,
                  marginBottom: 8,
                  fontSize: 14,
                  fontWeight: "700",
                  color: "#0F172A",
                }}
              >
                Parking category
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {SUGGESTED_PARKING_CATEGORY_OPTIONS.map((option) => {
                  const isSelected = suggestedParkingCategory === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      onPress={() => setSuggestedParkingCategory(option)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: isSelected ? "#0F766E" : "#CBD5E1",
                        backgroundColor: isSelected ? "#CCFBF1" : "#F8FAFC",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: isSelected ? "#115E59" : "#334155",
                        }}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={{ marginTop: 8, fontSize: 12, color: "#64748B" }}>
                Required. This describes the physical parking setup at the location.
              </Text>

              <Text
                style={{
                  marginTop: 16,
                  marginBottom: 6,
                  fontSize: 14,
                  fontWeight: "700",
                  color: "#0F172A",
                }}
              >
                Photo evidence
              </Text>
              {suggestedZoneEvidence?.uri ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: "#CBD5E1",
                    borderRadius: 12,
                    overflow: "hidden",
                    backgroundColor: "#F8FAFC",
                  }}
                >
                  <Image
                    source={{ uri: suggestedZoneEvidence.uri }}
                    style={{ width: "100%", height: 180, backgroundColor: "#E2E8F0" }}
                    resizeMode="cover"
                  />
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      padding: 12,
                      gap: 10,
                    }}
                  >
                    <TouchableOpacity
                      onPress={handleCaptureSuggestZoneEvidence}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: "#DBEAFE",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#1D4ED8" }}>
                        Take Photo
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handlePickSuggestZoneEvidence}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: "#E2E8F0",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#0F172A" }}>
                        Upload Photo
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setSuggestedZoneEvidence(null)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: "#FEE2E2",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#B91C1C" }}>
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
<View
                style={{
                  flexDirection: "row",
                  gap: 10,
                }}
              >
                <TouchableOpacity
                  onPress={handleCaptureSuggestZoneEvidence}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: "#BFDBFE",
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 16,
                    alignItems: "center",
                    backgroundColor: "#EFF6FF",
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#1D4ED8" }}>
                    Take Photo
                  </Text>
                  <Text style={{ marginTop: 6, fontSize: 12, color: "#64748B", textAlign: "center" }}>
                    Use the camera now
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handlePickSuggestZoneEvidence}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: "#CBD5E1",
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 16,
                    alignItems: "center",
                    backgroundColor: "#F8FAFC",
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#0F766E" }}>
                    Upload Photo
                  </Text>
                  <Text style={{ marginTop: 6, fontSize: 12, color: "#64748B", textAlign: "center" }}>
                    Choose from library
                  </Text>
                </TouchableOpacity>
              </View>
            )}

              <Text
                style={{
                  marginTop: 16,
                  marginBottom: 6,
                  fontSize: 14,
                  fontWeight: "700",
                  color: "#0F172A",
                }}
              >
                Approximate spaces
              </Text>
              <TextInput
                value={suggestedZoneCapacity}
                onChangeText={setSuggestedZoneCapacity}
                placeholder="e.g. 20"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                style={{
                  borderWidth: 1,
                  borderColor: "#CBD5E1",
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 15,
                  color: "#0F172A",
                  backgroundColor: "#F8FAFC",
                }}
              />
              <Text style={{ marginTop: 8, fontSize: 12, color: "#64748B" }}>
                Optional, but helpful for review.
              </Text>

              <Text
                style={{
                  marginTop: 16,
                  marginBottom: 6,
                  fontSize: 14,
                  fontWeight: "700",
                  color: "#0F172A",
                }}
              >
                Description
              </Text>
              <TextInput
                value={suggestedZoneDescription}
                onChangeText={setSuggestedZoneDescription}
                placeholder="Add details like entry points, signage, restrictions, or anything reviewers should know."
                placeholderTextColor="#94A3B8"
                multiline
                textAlignVertical="top"
                style={{
                  minHeight: 108,
                  borderWidth: 1,
                  borderColor: "#CBD5E1",
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 15,
                  color: "#0F172A",
                  backgroundColor: "#F8FAFC",
                }}
              />
              <Text style={{ marginTop: 8, fontSize: 12, color: "#64748B" }}>
                Optional, but useful when the evidence photo does not show everything clearly.
              </Text>

              <TouchableOpacity
                onPress={() => setIsPublicParkingConfirmed((current) => !current)}
                style={{
                  marginTop: 18,
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 12,
                  borderWidth: 1,
                  borderColor: isPublicParkingConfirmed ? "#0F766E" : "#CBD5E1",
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                  backgroundColor: isPublicParkingConfirmed ? "#F0FDFA" : "#F8FAFC",
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: isPublicParkingConfirmed ? "#0F766E" : "#94A3B8",
                    backgroundColor: isPublicParkingConfirmed ? "#0F766E" : "#FFFFFF",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 1,
                  }}
                >
                  {isPublicParkingConfirmed ? (
                    <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>✓</Text>
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#0F172A" }}>
                    Public parking confirmation
                  </Text>
                  <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 18, color: "#64748B" }}>
                    Required. I confirm this is public parking and should be visible to ParkMate users.
                  </Text>
                </View>
              </TouchableOpacity>
            </ScrollView>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 4,
                paddingHorizontal: 18,
                paddingTop: 12,
                paddingBottom: 18,
                borderTopWidth: 1,
                borderTopColor: "#E2E8F0",
              }}
            >
              <TouchableOpacity
                onPress={() => {
                  if (!suggestZoneMutation.isPending) {
                    if (isUploadingSuggestZoneEvidence) {
                      return;
                    }
                    setShowSuggestZoneModal(false);
                    resetSuggestedZoneDraft();
                  }
                }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  borderRadius: 12,
                  backgroundColor: "#E2E8F0",
                }}
                disabled={suggestZoneMutation.isPending || isUploadingSuggestZoneEvidence}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#0F172A" }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmSuggestParkingZone}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  borderRadius: 12,
                  backgroundColor: "#0F766E",
                }}
                disabled={suggestZoneMutation.isPending || isUploadingSuggestZoneEvidence}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>
                  {isUploadingSuggestZoneEvidence
                    ? "Uploading Photo..."
                    : suggestZoneMutation.isPending
                      ? "Sending..."
                      : "Send"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SpotDetailsModal
        visible={!!selectedSpot}
        spot={selectedSpot}
        routeCoordinates={routeCoordinates}
        isClaiming={claimMutation.isPending}
        isReportingFalse={reportFalseMutation.isPending}
        insets={insets}
        onClose={() => {
          clearExternalMapSelectionParams();
          setSelectedSpot(null);
          stopInAppNavigation();
        }}
        onClaimSpot={handleClaimSpot}
        onReportFalse={handleReportFalseSpot}
        onDeleteSpot={handleDeleteSpotWithTarget}
      />

      <ZoneDetailsModal
        visible={!!selectedZoneModalPayload}
        zone={selectedZoneModalPayload}
        availableReports={selectedZoneReports}
        insets={insets}
        onClose={() => {
          clearExternalMapSelectionParams();
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
