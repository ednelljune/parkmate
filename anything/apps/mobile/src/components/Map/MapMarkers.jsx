import React, { useMemo } from "react";
import { View, Text, Platform } from "react-native";
import { Circle } from "react-native-maps";
import Svg, { Path } from "react-native-svg";
import { PARKING_ALERT_RADIUS_METERS } from "@/constants/detectionRadius";
import { ZONE_COLORS } from "@/constants/zoneColors";
import { getDistanceMeters } from "@/utils/geo";
import {
  AvailabilityBeaconPin,
  CompactMapPin,
  getAndroidZoneMarkerFrame,
  getAvailabilityBadgeLabel,
  getZoomedOutZoneScale,
  getPinFrameSize,
  getZoneMarkerLabel,
  scalePinSize,
  StableMapMarker,
  AndroidZonePin,
} from "@/components/Map/markerVisuals";
import { AndroidMapMarkerOverlay } from "@/components/Map/AndroidMapMarkerOverlay";

const normalizeCoordinate = (value) => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getMarkerHeading = (location) => {
  if (!location || !Number.isFinite(location.heading) || location.heading < 0) {
    return null;
  }

  return location.heading;
};

const USER_MARKER_BLUE = "#1A73E8";
const USER_MARKER_CONE = "rgba(26, 115, 232, 0.22)";
const USER_MARKER_HALO = "rgba(26, 115, 232, 0.16)";
const AVAILABLE_ZONE_HIGHLIGHT = "#10B981";

const areCoordinatesEqual = (left, right) =>
  Number(left?.latitude) === Number(right?.latitude) &&
  Number(left?.longitude) === Number(right?.longitude);

const isCouncilZoneWithinUserRadius = (zone, userLocation, radius, isSelected) => {
  if (isSelected) {
    return true;
  }

  if (!userLocation || !Number.isFinite(radius)) {
    return false;
  }

  const latitude = normalizeCoordinate(zone?.latitude);
  const longitude = normalizeCoordinate(zone?.longitude);
  if (latitude === null || longitude === null) {
    return false;
  }

  const distance = getDistanceMeters(userLocation, { latitude, longitude });
  return distance !== null && distance <= radius;
};

const NativeCouncilZoneMarker = React.memo(
  ({
    zone,
    userLocation,
    radius,
    onZonePress,
    selectedZoneId,
    availabilityCount,
    zoomScale,
  }) => {
    const center = {
      latitude: zone.latitude,
      longitude: zone.longitude,
    };

    const distance = getDistanceMeters(userLocation, center);
    const isNearby = distance !== null && distance <= radius;
    const zoneColor =
      ZONE_COLORS[zone.type || zone.zone_type]?.stroke || "#3B82F6";
    const isSelected =
      selectedZoneId != null &&
      zone?.id != null &&
      String(zone.id) === selectedZoneId;
    const availableSpots = Math.max(0, availabilityCount || 0);
    const hasAvailability = availableSpots > 0;
    const isEmphasized = isSelected || isNearby || hasAvailability;
    const opacity = isEmphasized ? 1 : 0.45;
    const pinColor = hasAvailability ? AVAILABLE_ZONE_HIGHLIGHT : zoneColor;
    const markerLabel = getZoneMarkerLabel(zone.type || zone.zone_type);
    const zoneStatusLabel = isSelected ? "ACTIVE" : isNearby ? "NEAR" : "ZONE";
    const markerInstanceKey = [
      "council-zone",
      zone?.id ?? "unknown",
      markerLabel,
      hasAvailability ? "available" : "plain",
      availableSpots,
      isSelected ? "selected" : "idle",
      isNearby ? "near" : "far",
    ].join("-");

    return (
      <StableMapMarker
        key={markerInstanceKey}
        coordinate={center}
        title={zone.name}
        description={zone.rules}
        anchor={{ x: 0.5, y: 1 }}
        zIndex={hasAvailability ? 80 : isSelected ? 60 : isNearby ? 50 : 5}
        onPress={() => onZonePress?.(isSelected ? null : zone)}
        androidRefreshKey={`council-zone-${zone.id}-${markerLabel}-${hasAvailability}-${availableSpots}-${isNearby}-${isSelected}`}
      >
        {Platform.OS === "android" ? (
          <AndroidZonePin
            label={markerLabel}
            color={pinColor}
            reportedCount={availableSpots}
            statusLabel={zoneStatusLabel}
            hasAvailability={hasAvailability}
            isSelected={isSelected}
            isMuted={!isEmphasized}
            zoomScale={zoomScale}
          />
        ) : hasAvailability ? (
          <AvailabilityBeaconPin
            pinColor={pinColor}
            badgeLabel={getAvailabilityBadgeLabel(availableSpots)}
            footerLabel={markerLabel}
            dimmed={opacity < 1}
            zoomScale={zoomScale}
          />
        ) : (
          <View
            collapsable={false}
            style={{
              width: getPinFrameSize(scalePinSize(40 * zoomScale), "width"),
              height: getPinFrameSize(scalePinSize(40 * zoomScale)),
              alignItems: "center",
              justifyContent: "flex-start",
              paddingTop: scalePinSize(1 * zoomScale),
              paddingBottom: getPinFrameSize(scalePinSize(6 * zoomScale)),
              opacity,
            }}
          >
            <View
              style={{
                width: scalePinSize(24 * zoomScale),
                height: scalePinSize(24 * zoomScale),
                borderRadius: scalePinSize(12 * zoomScale),
                backgroundColor: isSelected ? pinColor : "#FFFFFF",
                borderWidth: scalePinSize(1.75 * zoomScale),
                borderColor: pinColor,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: hasAvailability ? scalePinSize(18 * zoomScale) : "100%",
                  height: hasAvailability ? scalePinSize(18 * zoomScale) : "100%",
                  borderRadius: hasAvailability
                    ? scalePinSize(9 * zoomScale)
                    : scalePinSize(12 * zoomScale),
                  backgroundColor: "#FFFFFF",
                  borderWidth: 0,
                  borderColor: pinColor,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: scalePinSize(7.5 * zoomScale),
                    fontWeight: "700",
                    color: isSelected ? "#FFFFFF" : pinColor,
                  }}
                >
                  {markerLabel}
                </Text>
              </View>
            </View>
            <View
              style={{
                width: 0,
                height: 0,
                borderStyle: "solid",
                borderLeftWidth: scalePinSize(3.5 * zoomScale),
                borderRightWidth: scalePinSize(3.5 * zoomScale),
                borderTopWidth: scalePinSize(5 * zoomScale),
                borderLeftColor: "transparent",
                borderRightColor: "transparent",
                borderTopColor: pinColor,
                marginTop: -scalePinSize(1 * zoomScale),
              }}
            />
            <View
              style={{
                width: scalePinSize(8 * zoomScale),
                height: scalePinSize(2.5 * zoomScale),
                borderRadius: scalePinSize(4 * zoomScale),
                backgroundColor: "rgba(0, 0, 0, 0.12)",
                marginTop: scalePinSize(1 * zoomScale),
              }}
            />
          </View>
        )}
      </StableMapMarker>
    );
  },
  (previousProps, nextProps) =>
    String(previousProps.zone?.id) === String(nextProps.zone?.id) &&
    Number(previousProps.zone?.latitude) === Number(nextProps.zone?.latitude) &&
    Number(previousProps.zone?.longitude) === Number(nextProps.zone?.longitude) &&
    previousProps.zone?.type === nextProps.zone?.type &&
    previousProps.selectedZoneId === nextProps.selectedZoneId &&
    previousProps.availabilityCount === nextProps.availabilityCount &&
    previousProps.zoomScale === nextProps.zoomScale &&
    previousProps.radius === nextProps.radius &&
    previousProps.onZonePress === nextProps.onZonePress &&
    areCoordinatesEqual(previousProps.userLocation, nextProps.userLocation),
);

export const UserLocationMarker = ({ location }) => {
  if (!location) return null;

  const heading = getMarkerHeading(location);
  const headingRotation = heading === null ? null : `${heading}deg`;

  return (
    <>
      <Circle
        center={{
          latitude: location.latitude,
          longitude: location.longitude,
        }}
        radius={50}
        fillColor="rgba(59, 130, 246, 0.15)"
        strokeColor="rgba(59, 130, 246, 0.5)"
        strokeWidth={1}
      />
      <StableMapMarker
        coordinate={{
          latitude: location.latitude,
          longitude: location.longitude,
        }}
        anchor={{ x: 0.5, y: 0.5 }}
        androidRefreshKey={
          heading === null
            ? "user-location-static"
            : `user-heading-${Math.round(heading / 8)}`
        }
      >
        <View
          collapsable={false}
          renderToHardwareTextureAndroid={false}
          style={{
            width: 56,
            height: 56,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {headingRotation && (
            <View
              style={{
                position: "absolute",
                width: 56,
                height: 56,
                alignItems: "center",
                justifyContent: "center",
                transform: [{ rotate: headingRotation }],
              }}
            >
              <Svg
                width={56}
                height={56}
                viewBox="0 0 56 56"
                style={{ position: "absolute" }}
              >
                <Path
                  d="M28 28 C20 22 15 14 14 4 C19 1 37 1 42 4 C41 14 36 22 28 28 Z"
                  fill={USER_MARKER_CONE}
                />
              </Svg>
            </View>
          )}

          <View
            style={{
              position: "absolute",
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: USER_MARKER_HALO,
            }}
          />

          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: USER_MARKER_BLUE,
              borderWidth: 2.5,
              borderColor: "#FFF",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.18,
              shadowRadius: 3,
              elevation: 4,
            }}
          />
        </View>
      </StableMapMarker>
    </>
  );
};

export const ParkingSpotMarkers = ({ reports, onMarkerPress }) => {
  const validReports = useMemo(
    () =>
      reports.filter((report) => {
        const latitude = normalizeCoordinate(report?.latitude);
        const longitude = normalizeCoordinate(report?.longitude);
        const hasValidId = report?.id != null && String(report.id).trim().length > 0;

        if (!hasValidId || latitude === null || longitude === null) {
          console.warn("Skipping parking marker with invalid report payload:", report);
          return false;
        }

        return true;
      }),
    [reports],
  );

  return (
    <>
      {validReports.map((report) => {
        const latitude = normalizeCoordinate(report.latitude);
        const longitude = normalizeCoordinate(report.longitude);

        const isAvailable = report.status === "available";
        const pinColor = isAvailable ? "#10B981" : "#EF4444";
        const spotCount = Math.max(
          1,
          Number.isFinite(Number(report?.quantity))
            ? Math.floor(Number(report.quantity))
            : 1,
        );
        const footerLabel = getZoneMarkerLabel(
          report?.zone_type || report?.parking_type,
        );

        return (
          <StableMapMarker
            key={report.id}
            coordinate={{
              latitude,
              longitude,
            }}
            onPress={() => onMarkerPress(report)}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={isAvailable ? 85 : 40}
            androidRefreshKey={`spot-${report.id}-${report.status}-${spotCount}-${footerLabel}`}
          >
            {isAvailable ? (
              <AvailabilityBeaconPin
                pinColor={pinColor}
                badgeLabel={getAvailabilityBadgeLabel(spotCount)}
                footerLabel={footerLabel}
              />
            ) : Platform.OS === "android" ? (
              <CompactMapPin
                pinColor={pinColor}
                centerLabel="P"
                badgeLabel={footerLabel}
                filled
              />
            ) : (
              <View
                collapsable={false}
                style={{
                  width: getPinFrameSize(scalePinSize(32), "width"),
                  height: getPinFrameSize(scalePinSize(44)),
                  alignItems: "center",
                  justifyContent: "flex-start",
                  paddingTop: scalePinSize(1),
                  paddingBottom: getPinFrameSize(scalePinSize(6)),
                }}
              >
                <View
                  style={{
                    width: scalePinSize(24),
                    height: scalePinSize(24),
                    borderRadius: scalePinSize(12),
                    backgroundColor: pinColor,
                    borderWidth: 0,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: scalePinSize(11),
                      fontWeight: "bold",
                      color: "#FFFFFF",
                    }}
                  >
                    P
                  </Text>
                </View>

                <View
                  style={{
                    width: 0,
                    height: 0,
                    backgroundColor: "transparent",
                    borderStyle: "solid",
                    borderLeftWidth: scalePinSize(3.5),
                    borderRightWidth: scalePinSize(3.5),
                    borderTopWidth: scalePinSize(5),
                    borderLeftColor: "transparent",
                    borderRightColor: "transparent",
                    borderTopColor: pinColor,
                    marginTop: -scalePinSize(1),
                  }}
                />

                <View
                  style={{
                    width: scalePinSize(8),
                    height: scalePinSize(2.5),
                    borderRadius: scalePinSize(4),
                    backgroundColor: "rgba(0, 0, 0, 0.2)",
                    marginTop: scalePinSize(1),
                  }}
                />
              </View>
            )}
          </StableMapMarker>
        );
      })}
    </>
  );
};

export const AndroidParkingSpotOverlay = ({
  mapRef,
  reports,
  onMarkerPress,
  overlayRevision,
  region,
}) => {
  const markers = useMemo(
    () =>
      reports
        .map((report) => {
          const latitude = normalizeCoordinate(report.latitude);
          const longitude = normalizeCoordinate(report.longitude);

          if (latitude === null || longitude === null) {
            return null;
          }

          const isAvailable = report.status === "available";
          const pinColor = isAvailable ? "#10B981" : "#EF4444";
          const spotCount = Math.max(
            1,
            Number.isFinite(Number(report?.quantity))
              ? Math.floor(Number(report.quantity))
              : 1,
          );
          const footerLabel = getZoneMarkerLabel(
            report?.zone_type || report?.parking_type,
          );

          return {
            key: `android-spot-${report.id}`,
            coordinate: { latitude, longitude },
            zIndex: isAvailable ? 85 : 40,
            frame: isAvailable
              ? { width: 86, height: 88 }
              : { width: 74, height: 76 },
            render: () =>
              isAvailable ? (
                <AvailabilityBeaconPin
                  pinColor={pinColor}
                  badgeLabel={getAvailabilityBadgeLabel(spotCount)}
                  footerLabel={footerLabel}
                />
              ) : (
                <CompactMapPin
                  pinColor={pinColor}
                  centerLabel="P"
                  badgeLabel={footerLabel}
                  filled
                />
              ),
            onPress: () => onMarkerPress(report),
          };
        })
        .filter(Boolean),
    [onMarkerPress, reports],
  );

  return (
    <AndroidMapMarkerOverlay
      mapRef={mapRef}
      markers={markers}
      revision={overlayRevision}
      region={region}
    />
  );
};

const areParkingZoneMarkerCollectionPropsEqual = (previousProps, nextProps) =>
  previousProps.zones === nextProps.zones &&
  previousProps.radius === nextProps.radius &&
  previousProps.onZonePress === nextProps.onZonePress &&
  previousProps.getAvailabilityCount === nextProps.getAvailabilityCount &&
  previousProps.zoomScale === nextProps.zoomScale &&
  String(previousProps.selectedZone?.id ?? "") ===
    String(nextProps.selectedZone?.id ?? "") &&
  areCoordinatesEqual(previousProps.userLocation, nextProps.userLocation);

export const ParkingZoneMarkers = React.memo(
  ({
    zones,
    userLocation,
    radius = PARKING_ALERT_RADIUS_METERS,
    getAvailabilityCount,
    onZonePress,
    selectedZone,
    zoomScale = 1,
  }) => {
    const validZones = useMemo(
      () =>
        (zones || []).filter((zone) => {
          const latitude = normalizeCoordinate(zone?.latitude);
          const longitude = normalizeCoordinate(zone?.longitude);
          const hasValidId = zone?.id != null && String(zone.id).trim().length > 0;
          const isSelected =
            selectedZone?.id != null &&
            zone?.id != null &&
            String(selectedZone.id) === String(zone.id);

          return (
            hasValidId &&
            latitude !== null &&
            longitude !== null &&
            isCouncilZoneWithinUserRadius(zone, userLocation, radius, isSelected)
          );
        }),
      [radius, selectedZone?.id, userLocation, zones],
    );

    if (validZones.length === 0) {
      return null;
    }

    const selectedZoneId =
      selectedZone?.id != null ? String(selectedZone.id) : null;

    return (
      <>
        {validZones.map((zone) => {
          return (
            <NativeCouncilZoneMarker
              key={`council-zone-${zone.id}`}
              zone={zone}
              userLocation={userLocation}
              radius={radius}
              onZonePress={onZonePress}
              selectedZoneId={selectedZoneId}
              availabilityCount={Math.max(0, getAvailabilityCount?.(zone) || 0)}
              zoomScale={zoomScale}
            />
          );
        })}
      </>
    );
  },
  areParkingZoneMarkerCollectionPropsEqual,
);

export const AndroidParkingZoneOverlay = ({
  mapRef,
  zones,
  userLocation,
  radius = PARKING_ALERT_RADIUS_METERS,
  getAvailabilityCount,
  onZonePress,
  selectedZone,
  overlayRevision,
  region,
  zoomScale = getZoomedOutZoneScale(region),
}) => {
  if (!zones || zones.length === 0) {
    return null;
  }

  const markers = useMemo(
    () =>
      zones
        .map((zone) => {
          const latitude = normalizeCoordinate(zone.latitude);
          const longitude = normalizeCoordinate(zone.longitude);

          if (latitude === null || longitude === null) {
            return null;
          }

          const center = { latitude, longitude };
          const distance = getDistanceMeters(userLocation, center);
          const isNearby = distance !== null && distance <= radius;
          const zoneColor =
            ZONE_COLORS[zone.type || zone.zone_type]?.stroke || "#3B82F6";
          const isSelected =
            selectedZone?.id != null &&
            zone?.id != null &&
            String(selectedZone.id) === String(zone.id);
          if (!isCouncilZoneWithinUserRadius(zone, userLocation, radius, isSelected)) {
            return null;
          }
          const availableSpots = Math.max(0, getAvailabilityCount?.(zone) || 0);
          const isEmphasized = isSelected || isNearby || availableSpots > 0;
          const hasAvailability = availableSpots > 0;
          const pinColor = hasAvailability ? AVAILABLE_ZONE_HIGHLIGHT : zoneColor;
          const markerLabel = getZoneMarkerLabel(zone.type || zone.zone_type);
          const zoneStatusLabel = isSelected ? "ACTIVE" : isNearby ? "NEAR" : "ZONE";

          return {
            key: `android-council-zone-${zone.id}`,
            coordinate: center,
            zIndex: hasAvailability ? 80 : isSelected ? 60 : isNearby ? 50 : 5,
            frame: getAndroidZoneMarkerFrame(hasAvailability, zoomScale),
            render: () => (
              <AndroidZonePin
                label={markerLabel}
                color={pinColor}
                reportedCount={availableSpots}
                statusLabel={zoneStatusLabel}
                hasAvailability={hasAvailability}
                isSelected={isSelected}
                isMuted={!isEmphasized}
                zoomScale={zoomScale}
              />
            ),
            onPress: () => onZonePress?.(isSelected ? null : zone),
          };
        })
        .filter(Boolean),
    [
      getAvailabilityCount,
      onZonePress,
      radius,
      selectedZone?.id,
      userLocation,
      zoomScale,
      zones,
    ],
  );

  return (
    <AndroidMapMarkerOverlay
      mapRef={mapRef}
      markers={markers}
      revision={overlayRevision}
      region={region}
    />
  );
};
