import React, { useMemo } from "react";
import { View, Text, Platform } from "react-native";
import { PARKING_ALERT_RADIUS_METERS } from "@/constants/detectionRadius";
import { ZONE_COLORS } from "@/constants/zoneColors";
import {
  AvailabilityBeaconPin,
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
import { getApiZoneEffectiveDistanceMeters } from "@/utils/zoneAlerts";

const AVAILABLE_ZONE_HIGHLIGHT = "#10B981";

const areCoordinatesEqual = (left, right) =>
  Number(left?.latitude) === Number(right?.latitude) &&
  Number(left?.longitude) === Number(right?.longitude);

const isZoneWithinUserRadius = (zone, userLocation, radius, isSelected) => {
  if (isSelected) {
    return true;
  }

  if (!userLocation || !Number.isFinite(radius)) {
    return false;
  }

  const distance = getApiZoneEffectiveDistanceMeters(zone, userLocation);
  return distance !== null && distance <= radius;
};

const NativeZoneMarker = React.memo(
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
      latitude: Number(zone.center_lat),
      longitude: Number(zone.center_lng),
    };

    if (!Number.isFinite(center.latitude) || !Number.isFinite(center.longitude)) {
      return null;
    }

    const colors = ZONE_COLORS[zone.zone_type] || ZONE_COLORS["1P"];
    const isSelected =
      Platform.OS === "android" &&
      selectedZoneId != null &&
      zone?.id != null &&
      String(zone.id) === selectedZoneId;
    const distance = getApiZoneEffectiveDistanceMeters(zone, userLocation);
    const isNearby = distance !== null && distance <= radius;
    const availableSpots = Math.max(0, availabilityCount || 0);
    const hasAvailability = availableSpots > 0;
    const isEmphasized = isSelected || isNearby || hasAvailability;
    const pinColor = hasAvailability ? AVAILABLE_ZONE_HIGHLIGHT : colors.stroke;
    const markerLabel = getZoneMarkerLabel(zone.zone_type);
    const zoneStatusLabel = isSelected
      ? "ACTIVE"
      : isNearby
        ? "NEAR"
        : "ZONE";
    const markerInstanceKey = [
      "zone",
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
        anchor={{ x: 0.5, y: 1 }}
        zIndex={hasAvailability ? 140 : isSelected ? 100 : 10}
        onPress={() => onZonePress(isSelected ? null : zone)}
        androidRefreshKey={`zone-${zone.id}-${markerLabel}-${hasAvailability}-${availableSpots}-${isSelected}-${isNearby}`}
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
            centerLabel={markerLabel}
            zoomScale={zoomScale}
          />
        ) : (
          <View
            collapsable={false}
            style={{
              width: getPinFrameSize(scalePinSize(32 * zoomScale), "width"),
              height: getPinFrameSize(scalePinSize(40 * zoomScale)),
              alignItems: "center",
              justifyContent: "flex-start",
              paddingTop: scalePinSize(1 * zoomScale),
              paddingBottom: getPinFrameSize(scalePinSize(6 * zoomScale)),
            }}
          >
            <View
              style={{
                width: scalePinSize(24 * zoomScale),
                height: scalePinSize(24 * zoomScale),
                borderRadius: scalePinSize(12 * zoomScale),
                backgroundColor: isSelected ? pinColor : "#FFFFFF",
                borderWidth: scalePinSize(1.75 * zoomScale),
                borderColor: isEmphasized ? pinColor : "#D1D5DB",
                justifyContent: "center",
                alignItems: "center",
                opacity: isEmphasized ? 1 : 0.6,
              }}
            >
              <View
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: scalePinSize(12 * zoomScale),
                  backgroundColor: isSelected ? pinColor : "#FFFFFF",
                  borderWidth: 0,
                  borderColor: pinColor,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: scalePinSize(7.5 * zoomScale),
                    fontWeight: "bold",
                    color: isSelected
                      ? "#FFFFFF"
                      : isEmphasized
                        ? pinColor
                        : "#9CA3AF",
                    letterSpacing: 0.2,
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
                backgroundColor: "transparent",
                borderStyle: "solid",
                borderLeftWidth: scalePinSize(3.5 * zoomScale),
                borderRightWidth: scalePinSize(3.5 * zoomScale),
                borderTopWidth: scalePinSize(5 * zoomScale),
                borderLeftColor: "transparent",
                borderRightColor: "transparent",
                borderTopColor: isEmphasized ? pinColor : "#D1D5DB",
                marginTop: -scalePinSize(1 * zoomScale),
              }}
            />

            <View
              style={{
                width: scalePinSize(8 * zoomScale),
                height: scalePinSize(2.5 * zoomScale),
                borderRadius: scalePinSize(4 * zoomScale),
                backgroundColor: isEmphasized
                  ? "rgba(0, 0, 0, 0.2)"
                  : "rgba(0, 0, 0, 0.1)",
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
    Number(previousProps.zone?.center_lat) === Number(nextProps.zone?.center_lat) &&
    Number(previousProps.zone?.center_lng) === Number(nextProps.zone?.center_lng) &&
    previousProps.zone?.zone_type === nextProps.zone?.zone_type &&
    previousProps.selectedZoneId === nextProps.selectedZoneId &&
    previousProps.availabilityCount === nextProps.availabilityCount &&
    previousProps.zoomScale === nextProps.zoomScale &&
    previousProps.radius === nextProps.radius &&
    previousProps.onZonePress === nextProps.onZonePress &&
    areCoordinatesEqual(previousProps.userLocation, nextProps.userLocation),
);

const areZoneMarkerCollectionPropsEqual = (previousProps, nextProps) =>
  previousProps.zones === nextProps.zones &&
  previousProps.radius === nextProps.radius &&
  previousProps.onZonePress === nextProps.onZonePress &&
  previousProps.getAvailabilityCount === nextProps.getAvailabilityCount &&
  previousProps.zoomScale === nextProps.zoomScale &&
  String(previousProps.selectedZone?.id ?? "") ===
    String(nextProps.selectedZone?.id ?? "") &&
  areCoordinatesEqual(previousProps.userLocation, nextProps.userLocation);

export const ZoneMarkers = React.memo(
  ({
    zones,
    userLocation,
    radius = PARKING_ALERT_RADIUS_METERS,
    onZonePress,
    selectedZone,
    getAvailabilityCount,
    zoomScale = 1,
  }) => {
    const validZones = useMemo(
      () =>
        (zones || []).filter((zone) => {
          const latitude = Number(zone?.center_lat);
          const longitude = Number(zone?.center_lng);
          const hasValidId = zone?.id != null && String(zone.id).trim().length > 0;
          const isSelected =
            selectedZone?.id != null &&
            zone?.id != null &&
            String(selectedZone.id) === String(zone.id);

          return (
            hasValidId &&
            Number.isFinite(latitude) &&
            Number.isFinite(longitude) &&
            isZoneWithinUserRadius(zone, userLocation, radius, isSelected)
          );
        }),
      [radius, selectedZone?.id, userLocation, zones],
    );
    const selectedZoneId =
      selectedZone?.id != null ? String(selectedZone.id) : null;

    if (validZones.length === 0) {
      return null;
    }

    return (
      <>
        {validZones.map((zone) => {
          return (
            <NativeZoneMarker
              key={`zone-marker-${zone.id}`}
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
  areZoneMarkerCollectionPropsEqual,
);

export const AndroidZoneOverlay = ({
  mapRef,
  zones,
  userLocation,
  radius = PARKING_ALERT_RADIUS_METERS,
  onZonePress,
  selectedZone,
  getAvailabilityCount,
  overlayRevision,
  region,
  zoomScale = getZoomedOutZoneScale(region),
}) => {
  const markers = useMemo(
    () =>
      zones
        .map((zone) => {
          const center = {
            latitude: Number(zone.center_lat),
            longitude: Number(zone.center_lng),
          };

          if (
            !Number.isFinite(center.latitude) ||
            !Number.isFinite(center.longitude)
          ) {
            return null;
          }

          const colors = ZONE_COLORS[zone.zone_type] || ZONE_COLORS["1P"];
          const isSelected =
            selectedZone?.id != null &&
            zone?.id != null &&
            String(selectedZone.id) === String(zone.id);
          if (!isZoneWithinUserRadius(zone, userLocation, radius, isSelected)) {
            return null;
          }
          const distance = getApiZoneEffectiveDistanceMeters(zone, userLocation);
          const isNearby = distance !== null && distance <= radius;
          const availableSpots = Math.max(0, getAvailabilityCount?.(zone) || 0);
          const hasAvailability = availableSpots > 0;
          const isEmphasized = isSelected || isNearby || hasAvailability;
          const pinColor = hasAvailability ? AVAILABLE_ZONE_HIGHLIGHT : colors.stroke;
          const markerLabel = getZoneMarkerLabel(zone.zone_type);
          const zoneStatusLabel = isSelected
            ? "ACTIVE"
            : isNearby
              ? "NEAR"
              : "ZONE";

          return {
            key: `android-zone-${zone.id}`,
            coordinate: center,
            zIndex: hasAvailability ? 140 : isSelected ? 100 : 10,
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
            onPress: () => onZonePress(isSelected ? null : zone),
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
