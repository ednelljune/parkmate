import React, { useMemo } from "react";
import { View, Text, Platform } from "react-native";
import { Circle } from "react-native-maps";
import Svg, { Path } from "react-native-svg";
import { ZONE_COLORS } from "@/constants/zoneColors";
import { getDistanceMeters } from "@/utils/geo";
import {
  AvailabilityBeaconPin,
  CompactMapPin,
  getAvailabilityBadgeLabel,
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
  return (
    <>
      {reports.map((report) => {
        const latitude = normalizeCoordinate(report.latitude);
        const longitude = normalizeCoordinate(report.longitude);
        if (latitude === null || longitude === null) {
          console.warn("Skipping parking marker with invalid coordinates:", report);
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
              : { width: 52, height: 62 },
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
    />
  );
};

export const ParkingZoneMarkers = ({
  zones,
  userLocation,
  radius = 500,
  getAvailabilityCount,
}) => {
  if (!zones || zones.length === 0) {
    return null;
  }

  return (
    <>
      {zones.map((zone) => {
        const center = {
          latitude: zone.latitude,
          longitude: zone.longitude,
        };

        const distance = getDistanceMeters(userLocation, center);
        const isNearby = distance !== null && distance <= radius;
        const zoneColor =
          ZONE_COLORS[zone.type || zone.zone_type]?.stroke || "#3B82F6";
        const availableSpots = Math.max(0, getAvailabilityCount?.(zone) || 0);
        const hasAvailability = availableSpots > 0;
        const isEmphasized = isNearby || hasAvailability;
        const opacity = isEmphasized ? 1 : 0.45;
        const pinColor = hasAvailability ? AVAILABLE_ZONE_HIGHLIGHT : zoneColor;
        const markerLabel = getZoneMarkerLabel(zone.type || zone.zone_type);
        const zoneStatusLabel = isNearby ? "NEAR" : "ZONE";

        return (
          <StableMapMarker
            key={`council-zone-${zone.id}`}
            coordinate={center}
            title={zone.name}
            description={zone.rules}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={hasAvailability ? 80 : isNearby ? 50 : 5}
            androidRefreshKey={`council-zone-${zone.id}-${markerLabel}-${hasAvailability}-${availableSpots}-${isNearby}`}
          >
            {Platform.OS === "android" ? (
              <AndroidZonePin
                label={markerLabel}
                color={pinColor}
                reportedCount={availableSpots}
                statusLabel={zoneStatusLabel}
                hasAvailability={hasAvailability}
                isSelected={false}
                isMuted={!isEmphasized}
              />
            ) : hasAvailability ? (
              <AvailabilityBeaconPin
                pinColor={pinColor}
                badgeLabel={getAvailabilityBadgeLabel(availableSpots)}
                footerLabel={markerLabel}
                dimmed={opacity < 1}
              />
            ) : (
              <View
                collapsable={false}
                style={{
                  width: getPinFrameSize(scalePinSize(40), "width"),
                  height: getPinFrameSize(scalePinSize(40)),
                  alignItems: "center",
                  justifyContent: "flex-start",
                  paddingTop: scalePinSize(1),
                  paddingBottom: getPinFrameSize(scalePinSize(6)),
                  opacity,
                }}
              >
                <View
                  style={{
                    width: scalePinSize(24),
                    height: scalePinSize(24),
                    borderRadius: scalePinSize(12),
                    backgroundColor: "#FFFFFF",
                    borderWidth: scalePinSize(1.75),
                    borderColor: pinColor,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: hasAvailability ? scalePinSize(18) : "100%",
                      height: hasAvailability ? scalePinSize(18) : "100%",
                      borderRadius: hasAvailability
                        ? scalePinSize(9)
                        : scalePinSize(12),
                      backgroundColor: "#FFFFFF",
                      borderWidth: 0,
                      borderColor: pinColor,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: scalePinSize(7.5),
                        fontWeight: "700",
                        color: pinColor,
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
                    backgroundColor: "rgba(0, 0, 0, 0.12)",
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

export const AndroidParkingZoneOverlay = ({
  mapRef,
  zones,
  userLocation,
  radius = 500,
  getAvailabilityCount,
  overlayRevision,
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
          const availableSpots = Math.max(0, getAvailabilityCount?.(zone) || 0);
          const isEmphasized = isNearby || availableSpots > 0;
          const hasAvailability = availableSpots > 0;
          const pinColor = hasAvailability ? AVAILABLE_ZONE_HIGHLIGHT : zoneColor;
          const markerLabel = getZoneMarkerLabel(zone.type || zone.zone_type);
          const zoneStatusLabel = isNearby ? "NEAR" : "ZONE";

          return {
            key: `android-council-zone-${zone.id}`,
            coordinate: center,
            zIndex: hasAvailability ? 80 : isNearby ? 50 : 5,
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
                isSelected={false}
                isMuted={!isEmphasized}
              />
            ),
          };
        })
        .filter(Boolean),
    [getAvailabilityCount, radius, userLocation, zones],
  );

  return (
    <AndroidMapMarkerOverlay
      mapRef={mapRef}
      markers={markers}
      revision={overlayRevision}
    />
  );
};
