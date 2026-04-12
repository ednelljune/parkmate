import React, { memo, useEffect, useState } from "react";
import { View, Text, Platform } from "react-native";
import { Marker } from "react-native-maps";

export const MAP_PIN_SCALE = Platform.OS === "ios" ? 1.5 : 1.08;

export const scalePinSize = (value) =>
  Math.round(value * MAP_PIN_SCALE * 10) / 10;

export const getPinFrameSize = (baseValue, axis = "both") => {
  const androidMultiplier =
    Platform.OS !== "android" ? 1 : axis === "width" ? 1.3 : 1.15;

  return Math.round(baseValue * androidMultiplier * 10) / 10;
};

export const getZoneMarkerLabel = (type) => {
  const normalizedType = String(type || "").trim();
  const normalizedTypeLower = normalizedType.toLowerCase();

  switch (normalizedType) {
    case "Full Hour":
      return "FH";
    case "Loading Zone":
      return "LZ";
    case "No Parking":
      return "NP";
    case "Permit":
      return "PM";
    case "Zone 2":
      return "Z2";
    case "P5 Minute":
    case "5Min":
      return "5M";
    case "P10 Minute":
      return "10M";
    case "P2 Minute":
      return "2M";
    case "1/2P":
      return "30M";
    case "1/4P":
      return "15M";
    default:
      if (/^\d+P$/i.test(normalizedType)) {
        return normalizedType.toUpperCase();
      }
      if (normalizedTypeLower === "parking") {
        return "P";
      }
      return normalizedType.charAt(0) || "P";
  }
};

export const formatAvailabilityCount = (count) => {
  if (!Number.isFinite(count) || count <= 0) {
    return "1";
  }

  return count > 9 ? "9+" : String(Math.floor(count));
};

export const getAvailabilityBadgeLabel = (count) => {
  return `${formatAvailabilityCount(count)} OPEN`;
};

const DEFAULT_ZONE_PIN_BASE_DELTA = 0.005;
const MIN_ZOOMED_OUT_ZONE_SCALE = 0.58;
const ZOOMED_OUT_ZONE_SCALE_EXPONENT = 0.28;

const ANDROID_MARKER_FREEZE_DELAY_MS = 180;
const AVAILABILITY_NAVY = "#0B1F33";
const AVAILABILITY_GOLD = "#F59E0B";
const AVAILABILITY_RING = "rgba(16, 185, 129, 0.26)";
const AVAILABILITY_HALO = "rgba(16, 185, 129, 0.14)";
const ANDROID_MUTED_STROKE = "#D1D5DB";
const ANDROID_MUTED_TEXT = "#6B7280";
const ANDROID_SHADOW = "rgba(11, 31, 51, 0.16)";
const ANDROID_SOFT_SURFACE = "#F3F4F6";
const ANDROID_ZONE_FRAME_WIDTH = 82;
const ANDROID_ZONE_FRAME_HEIGHT = 84;
const ANDROID_AVAILABILITY_FRAME_WIDTH = 92;
const ANDROID_AVAILABILITY_FRAME_HEIGHT = 100;

export const scaleZoomedMarkerValue = (value, zoomScale = 1) =>
  Math.round(value * zoomScale * 10) / 10;

export const getZoomedOutZoneScale = (region) => {
  const latitudeDelta = Number(region?.latitudeDelta);
  const longitudeDelta = Number(region?.longitudeDelta);
  const maxDelta = Math.max(
    Number.isFinite(latitudeDelta) ? latitudeDelta : 0,
    Number.isFinite(longitudeDelta) ? longitudeDelta : 0,
  );

  if (!Number.isFinite(maxDelta) || maxDelta <= DEFAULT_ZONE_PIN_BASE_DELTA) {
    return 1;
  }

  return Math.max(
    MIN_ZOOMED_OUT_ZONE_SCALE,
    Math.min(
      1,
      Math.pow(
        DEFAULT_ZONE_PIN_BASE_DELTA / maxDelta,
        ZOOMED_OUT_ZONE_SCALE_EXPONENT,
      ),
    ),
  );
};

export const getAndroidZoneMarkerFrame = (
  hasAvailability = false,
  zoomScale = 1,
) => ({
  width: scaleZoomedMarkerValue(
    hasAvailability
      ? ANDROID_AVAILABILITY_FRAME_WIDTH
      : ANDROID_ZONE_FRAME_WIDTH,
    zoomScale,
  ),
  height: scaleZoomedMarkerValue(
    hasAvailability
      ? ANDROID_AVAILABILITY_FRAME_HEIGHT
      : ANDROID_ZONE_FRAME_HEIGHT,
    zoomScale,
  ),
});

export const StableMapMarker = ({
  androidRefreshKey = "static",
  tracksViewChanges,
  tracksInfoWindowChanges,
  children,
  ...markerProps
}) => {
  const [shouldTrackViewChanges, setShouldTrackViewChanges] = useState(
    Platform.OS === "android",
  );
  const coordinate = markerProps?.coordinate;
  const latitude = Number(coordinate?.latitude);
  const longitude = Number(coordinate?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const normalizedMarkerProps = {
    ...markerProps,
    coordinate: {
      latitude,
      longitude,
    },
  };

  if (markerProps?.title != null) {
    normalizedMarkerProps.title = String(markerProps.title);
  }

  if (markerProps?.description != null) {
    normalizedMarkerProps.description = String(markerProps.description);
  }

  useEffect(() => {
    if (Platform.OS !== "android") {
      return undefined;
    }

    setShouldTrackViewChanges(true);
    const timeoutId = setTimeout(() => {
      setShouldTrackViewChanges(false);
    }, ANDROID_MARKER_FREEZE_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [androidRefreshKey]);

  return (
    <Marker
      {...normalizedMarkerProps}
      tracksViewChanges={
        Platform.OS === "android"
          ? (tracksViewChanges ?? shouldTrackViewChanges)
          : tracksViewChanges
      }
      tracksInfoWindowChanges={
        Platform.OS === "android"
          ? (tracksInfoWindowChanges ?? false)
          : tracksInfoWindowChanges
      }
    >
      {children}
    </Marker>
  );
};

const AndroidZonePinComponent = ({
  label = "P",
  color = "#3B82F6",
  reportedCount = 0,
  statusLabel = "ZONE",
  hasAvailability = false,
  isSelected = false,
  isMuted = false,
  zoomScale = 1,
}) => {
  if (hasAvailability) {
    return (
      <AndroidAvailabilityPin
        pinColor={color}
        badgeLabel={getAvailabilityBadgeLabel(reportedCount)}
        footerLabel={label}
        centerLabel={label}
        dimmed={isMuted}
        zoomScale={zoomScale}
      />
    );
  }

  const isEmphasized = isSelected || !isMuted;
  const resolvedStatusLabel = String(statusLabel || "ZONE").slice(0, 6);

  return (
    <AndroidCompactPin
      pinColor={color}
      centerLabel={label}
      badgeLabel={resolvedStatusLabel}
      filled={isSelected}
      dimmed={!isEmphasized}
      muted={!isEmphasized}
      zoomScale={zoomScale}
    />
  );
};

const areAndroidZonePinPropsEqual = (previousProps, nextProps) =>
  previousProps.label === nextProps.label &&
  previousProps.color === nextProps.color &&
  previousProps.reportedCount === nextProps.reportedCount &&
  previousProps.statusLabel === nextProps.statusLabel &&
  previousProps.hasAvailability === nextProps.hasAvailability &&
  previousProps.isSelected === nextProps.isSelected &&
  previousProps.isMuted === nextProps.isMuted &&
  previousProps.zoomScale === nextProps.zoomScale;

export const AndroidZonePin = memo(
  AndroidZonePinComponent,
  areAndroidZonePinPropsEqual,
);

const AndroidCompactPin = ({
  pinColor = "#3B82F6",
  centerLabel = "P",
  badgeLabel = "ZONE",
  filled = false,
  dimmed = false,
  muted = false,
  zoomScale = 1,
}) => {
  const strokeColor = muted ? ANDROID_MUTED_STROKE : pinColor;
  const circleFill = filled ? pinColor : "#FFFFFF";
  const centerTextColor = filled
    ? "#FFFFFF"
    : muted
      ? "#9CA3AF"
      : pinColor;
  const badgeFill = muted
    ? ANDROID_SOFT_SURFACE
    : filled
      ? pinColor
      : AVAILABILITY_NAVY;
  const badgeTextColor = muted ? ANDROID_MUTED_TEXT : "#FFFFFF";
  const resolvedBadgeLabel = String(badgeLabel || "ZONE").slice(0, 6);
  const resolvedCenterLabel = String(centerLabel || "P").slice(0, 3);
  const scaledSize = (value) => scaleZoomedMarkerValue(value, zoomScale);

  return (
    <View
      collapsable={false}
      renderToHardwareTextureAndroid={false}
      style={{
        width: scaledSize(ANDROID_ZONE_FRAME_WIDTH),
        height: scaledSize(ANDROID_ZONE_FRAME_HEIGHT),
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: scaledSize(4),
        paddingBottom: scaledSize(4),
        paddingHorizontal: scaledSize(6),
        opacity: dimmed ? 0.78 : 1,
      }}
    >
      <View
        style={{
          minWidth: scaledSize(42),
          alignItems: "center",
          backgroundColor: badgeFill,
          paddingHorizontal: scaledSize(7),
          paddingVertical: scaledSize(2),
          borderRadius: scaledSize(6),
          borderWidth: scaledSize(1),
          borderColor: "#FFFFFF",
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            color: badgeTextColor,
            fontSize: scaledSize(7),
            fontWeight: "900",
            letterSpacing: scaledSize(0.35),
          }}
        >
          {resolvedBadgeLabel}
        </Text>
      </View>

      <View
        style={{
          width: scaledSize(28),
          height: scaledSize(28),
          marginTop: scaledSize(5),
          borderRadius: scaledSize(14),
          backgroundColor: circleFill,
          borderWidth: scaledSize(2),
          borderColor: strokeColor,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            color: centerTextColor,
            fontSize: scaledSize(10),
            fontWeight: "900",
          }}
        >
          {resolvedCenterLabel}
        </Text>
      </View>

      <View
        style={{
          width: 0,
          height: 0,
          marginTop: scaledSize(4),
          borderLeftWidth: scaledSize(6),
          borderRightWidth: scaledSize(6),
          borderTopWidth: scaledSize(8),
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: strokeColor,
        }}
      />

      <View
        style={{
          width: scaledSize(12),
          height: scaledSize(4),
          marginTop: scaledSize(4),
          borderRadius: scaledSize(6),
          backgroundColor: ANDROID_SHADOW,
          opacity: dimmed ? 0.5 : 0.72,
        }}
      />
    </View>
  );
};

export const CompactMapPin = (props) => {
  if (Platform.OS === "android") {
    return <AndroidCompactPin {...props} />;
  }

  return null;
};

const AndroidAvailabilityPin = ({
  pinColor,
  badgeLabel,
  footerLabel,
  centerLabel,
  dimmed,
  zoomScale = 1,
}) => {
  const resolvedBadgeLabel = String(badgeLabel || "OPEN").slice(0, 8);
  const resolvedCenterLabel = String(centerLabel || "P").slice(0, 3);
  const resolvedFooterLabel = String(footerLabel || "P").slice(0, 3);
  const scaledSize = (value) => scaleZoomedMarkerValue(value, zoomScale);

  return (
    <View
      collapsable={false}
      renderToHardwareTextureAndroid={false}
      style={{
        width: scaledSize(ANDROID_AVAILABILITY_FRAME_WIDTH),
        height: scaledSize(ANDROID_AVAILABILITY_FRAME_HEIGHT),
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: scaledSize(4),
        paddingBottom: scaledSize(4),
        opacity: dimmed ? 0.84 : 1,
      }}
    >
      <View
        style={{
          minWidth: scaledSize(62),
          alignItems: "center",
          backgroundColor: AVAILABILITY_NAVY,
          paddingHorizontal: scaledSize(9),
          paddingVertical: scaledSize(3),
          borderRadius: scaledSize(8),
          borderWidth: scaledSize(1.5),
          borderColor: "#FFFFFF",
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            color: "#FFFFFF",
            fontSize: scaledSize(8),
            fontWeight: "900",
            letterSpacing: scaledSize(0.5),
          }}
        >
          {resolvedBadgeLabel}
        </Text>
      </View>

      <View
        style={{
          width: scaledSize(34),
          height: scaledSize(34),
          marginTop: scaledSize(6),
          borderRadius: scaledSize(17),
          backgroundColor: pinColor,
          borderWidth: scaledSize(2),
          borderColor: "#FFFFFF",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            color: "#FFFFFF",
            fontSize: scaledSize(13),
            fontWeight: "900",
          }}
        >
          {resolvedCenterLabel}
        </Text>
      </View>

      <View
        style={{
          minWidth: scaledSize(34),
          marginTop: scaledSize(5),
          alignItems: "center",
          backgroundColor: AVAILABILITY_GOLD,
          paddingHorizontal: scaledSize(7),
          paddingVertical: scaledSize(2),
          borderRadius: scaledSize(6),
          borderWidth: scaledSize(1.5),
          borderColor: "#FFFFFF",
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            color: AVAILABILITY_NAVY,
            fontSize: scaledSize(8),
            fontWeight: "900",
          }}
        >
          {resolvedFooterLabel}
        </Text>
      </View>

      <View
        style={{
          width: 0,
          height: 0,
          marginTop: scaledSize(5),
          borderLeftWidth: scaledSize(6),
          borderRightWidth: scaledSize(6),
          borderTopWidth: scaledSize(10),
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: pinColor,
        }}
      />

      <View
        style={{
          width: scaledSize(14),
          height: scaledSize(4),
          marginTop: scaledSize(4),
          borderRadius: scaledSize(7),
          backgroundColor: ANDROID_SHADOW,
          opacity: 0.72,
        }}
      />
    </View>
  );
};

export const AvailabilityBeaconPin = ({
  pinColor = "#10B981",
  badgeLabel = "OPEN",
  footerLabel = "P",
  centerLabel = "P",
  dimmed = false,
  zoomScale = 1,
}) => {
  if (Platform.OS === "android") {
    return (
      <AndroidAvailabilityPin
        pinColor={pinColor}
        badgeLabel={badgeLabel}
        footerLabel={footerLabel}
        centerLabel={centerLabel}
        dimmed={dimmed}
        zoomScale={zoomScale}
      />
    );
  }

  const scaledPinSize = (value) => scalePinSize(value * zoomScale);

  return (
    <View
      collapsable={false}
      style={{
        width: getPinFrameSize(scaledPinSize(56), "width"),
        height: getPinFrameSize(scaledPinSize(66)),
        alignItems: "center",
        justifyContent: "flex-start",
        paddingBottom: getPinFrameSize(scaledPinSize(6)),
        opacity: dimmed ? 0.84 : 1,
      }}
    >
      <View
        style={{
          position: "absolute",
          top: scaledPinSize(10),
          width: scaledPinSize(44),
          height: scaledPinSize(44),
          borderRadius: scaledPinSize(22),
          borderWidth: scaledPinSize(1.4),
          borderColor: AVAILABILITY_RING,
          backgroundColor: "rgba(255, 255, 255, 0.18)",
        }}
      />

      <View
        style={{
          position: "absolute",
          top: scaledPinSize(15),
          width: scaledPinSize(34),
          height: scaledPinSize(34),
          borderRadius: scaledPinSize(17),
          backgroundColor: AVAILABILITY_HALO,
        }}
      />

      <View
        style={{
          paddingHorizontal: scaledPinSize(7),
          paddingVertical: scaledPinSize(2.8),
          borderRadius: scaledPinSize(10),
          backgroundColor: AVAILABILITY_NAVY,
          borderWidth: scaledPinSize(1.2),
          borderColor: "rgba(255, 255, 255, 0.92)",
          minWidth: scaledPinSize(30),
          alignItems: "center",
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            fontSize: scaledPinSize(5.9),
            fontWeight: "900",
            letterSpacing: scaledPinSize(0.4),
            color: "#FFFFFF",
          }}
        >
          {badgeLabel}
        </Text>
      </View>

      <View
        style={{
          width: scaledPinSize(30),
          height: scaledPinSize(30),
          borderRadius: scaledPinSize(15),
          marginTop: scaledPinSize(7),
          backgroundColor: pinColor,
          borderWidth: scaledPinSize(2),
          borderColor: "#FFFFFF",
          justifyContent: "center",
          alignItems: "center",
          shadowColor: pinColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.26,
          shadowRadius: 7,
          elevation: 7,
        }}
      >
        <View
          style={{
            position: "absolute",
            top: scaledPinSize(4),
            left: scaledPinSize(6),
            width: scaledPinSize(9),
            height: scaledPinSize(5),
            borderRadius: scaledPinSize(4),
            backgroundColor: "rgba(255, 255, 255, 0.24)",
            transform: [{ rotate: "-18deg" }],
          }}
        />

        <Text
          allowFontScaling={false}
          style={{
            fontSize: scaledPinSize(12.5),
            fontWeight: "900",
            color: "#FFFFFF",
          }}
        >
          {centerLabel}
        </Text>
      </View>

      <View
        style={{
          marginTop: -scaledPinSize(4),
          paddingHorizontal: scaledPinSize(6),
          paddingVertical: scaledPinSize(2.8),
          borderRadius: scaledPinSize(8),
          backgroundColor: AVAILABILITY_GOLD,
          borderWidth: scaledPinSize(1.1),
          borderColor: "#FFFFFF",
          minWidth: scaledPinSize(28),
          alignItems: "center",
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            fontSize: scaledPinSize(6.4),
            fontWeight: "900",
            letterSpacing: scaledPinSize(0.25),
            color: AVAILABILITY_NAVY,
          }}
        >
          {footerLabel}
        </Text>
      </View>

      <View
        style={{
          width: 0,
          height: 0,
          borderStyle: "solid",
          borderLeftWidth: scaledPinSize(4.2),
          borderRightWidth: scaledPinSize(4.2),
          borderTopWidth: scaledPinSize(6.5),
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: pinColor,
          marginTop: -scaledPinSize(1),
        }}
      />

      <View
        style={{
          width: scaledPinSize(10),
          height: scaledPinSize(2.8),
          borderRadius: scaledPinSize(5),
          backgroundColor: "rgba(11, 31, 51, 0.18)",
          marginTop: scaledPinSize(1),
        }}
      />
    </View>
  );
};
