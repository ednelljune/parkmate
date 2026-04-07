import React, { useMemo } from "react";
import { View, Text, Platform } from "react-native";
import { ZONE_COLORS } from "@/constants/zoneColors";
import { getDistanceMeters } from "@/utils/geo";
import {
  AvailabilityBeaconPin,
  getAvailabilityBadgeLabel,
  getPinFrameSize,
  getZoneMarkerLabel,
  scalePinSize,
  StableMapMarker,
  AndroidZonePin,
} from "@/components/Map/markerVisuals";
import { AndroidMapMarkerOverlay } from "@/components/Map/AndroidMapMarkerOverlay";

const AVAILABLE_ZONE_HIGHLIGHT = "#10B981";

export const ZoneMarkers = ({
  zones,
  userLocation,
  radius = 300,
  onZonePress,
  selectedZone,
  getAvailabilityCount,
}) => {
  const supportsSelectedMarkerState = Platform.OS === "android";

  return (
    <>
      {zones.map((zone) => {
        const center = {
          latitude: Number(zone.center_lat),
          longitude: Number(zone.center_lng),
        };

        if (!Number.isFinite(center.latitude) || !Number.isFinite(center.longitude)) {
          return null;
        }

        const colors = ZONE_COLORS[zone.zone_type] || ZONE_COLORS["1P"];
        const isSelected =
          supportsSelectedMarkerState &&
          selectedZone?.id != null &&
          zone?.id != null &&
          String(selectedZone.id) === String(zone.id);
        const distance = getDistanceMeters(userLocation, center);
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

        return (
          <StableMapMarker
            key={`zone-marker-${zone.id}`}
            coordinate={{
              latitude: center.latitude,
              longitude: center.longitude,
            }}
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
              />
            ) : hasAvailability ? (
              <AvailabilityBeaconPin
                pinColor={pinColor}
                badgeLabel={getAvailabilityBadgeLabel(availableSpots)}
                footerLabel={markerLabel}
                centerLabel={markerLabel}
              />
            ) : (
              <View
                collapsable={false}
                style={{
                  width: getPinFrameSize(scalePinSize(32), "width"),
                  height: getPinFrameSize(scalePinSize(40)),
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
                    backgroundColor: isSelected ? pinColor : "#FFFFFF",
                    borderWidth: scalePinSize(1.75),
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
                      borderRadius: scalePinSize(12),
                      backgroundColor: isSelected ? pinColor : "#FFFFFF",
                      borderWidth: 0,
                      borderColor: pinColor,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: scalePinSize(7.5),
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
                    borderLeftWidth: scalePinSize(3.5),
                    borderRightWidth: scalePinSize(3.5),
                    borderTopWidth: scalePinSize(5),
                    borderLeftColor: "transparent",
                    borderRightColor: "transparent",
                    borderTopColor: isEmphasized ? pinColor : "#D1D5DB",
                    marginTop: -scalePinSize(1),
                  }}
                />

                <View
                  style={{
                    width: scalePinSize(8),
                    height: scalePinSize(2.5),
                    borderRadius: scalePinSize(4),
                    backgroundColor: isEmphasized
                      ? "rgba(0, 0, 0, 0.2)"
                      : "rgba(0, 0, 0, 0.1)",
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

export const AndroidZoneOverlay = ({
  mapRef,
  zones,
  userLocation,
  radius = 300,
  onZonePress,
  selectedZone,
  getAvailabilityCount,
  overlayRevision,
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
          const distance = getDistanceMeters(userLocation, center);
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
            frame: hasAvailability
              ? { width: 86, height: 88 }
              : { width: 74, height: 76 },
            render: () => (
              <AndroidZonePin
                label={markerLabel}
                color={pinColor}
                reportedCount={availableSpots}
                statusLabel={zoneStatusLabel}
                hasAvailability={hasAvailability}
                isSelected={isSelected}
                isMuted={!isEmphasized}
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
      zones,
    ],
  );

  return (
    <AndroidMapMarkerOverlay
      mapRef={mapRef}
      markers={markers}
      revision={overlayRevision}
    />
  );
};
