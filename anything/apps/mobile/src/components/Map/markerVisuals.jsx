import React, { useEffect, useState } from "react";
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

  switch (type) {
    case "Full Hour":
      return "FH";
    case "Loading Zone":
      return "LZ";
    case "No Parking":
      return "NP";
    case "Permit":
      return "PM";
    default:
      if (/^\d+P$/i.test(normalizedType)) {
        return normalizedType.toUpperCase();
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

const ANDROID_MARKER_FREEZE_DELAY_MS = 180;
const AVAILABILITY_NAVY = "#0B1F33";
const AVAILABILITY_GOLD = "#F59E0B";
const AVAILABILITY_RING = "rgba(16, 185, 129, 0.26)";
const AVAILABILITY_HALO = "rgba(16, 185, 129, 0.14)";
const ANDROID_MUTED_STROKE = "#D1D5DB";
const ANDROID_MUTED_TEXT = "#6B7280";
const ANDROID_SHADOW = "rgba(11, 31, 51, 0.16)";
const ANDROID_SOFT_SURFACE = "#F3F4F6";
const ANDROID_ZONE_FRAME_WIDTH = 74;
const ANDROID_ZONE_FRAME_HEIGHT = 76;
const ANDROID_COMPACT_FRAME_WIDTH = 52;
const ANDROID_COMPACT_FRAME_HEIGHT = 62;
const ANDROID_AVAILABILITY_FRAME_WIDTH = 86;
const ANDROID_AVAILABILITY_FRAME_HEIGHT = 88;

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
      {...markerProps}
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

export const AndroidZonePin = ({
  label = "P",
  color = "#3B82F6",
  reportedCount = 0,
  statusLabel = "ZONE",
  hasAvailability = false,
  isSelected = false,
  isMuted = false,
}) => {
  if (hasAvailability) {
    return (
      <AndroidAvailabilityPin
        pinColor={color}
        badgeLabel={getAvailabilityBadgeLabel(reportedCount)}
        footerLabel={label}
        centerLabel={label}
        dimmed={isMuted}
      />
    );
  }

  const isEmphasized = isSelected || !isMuted;
  const strokeColor = isEmphasized ? color : ANDROID_MUTED_STROKE;
  const badgeFill = isSelected
    ? color
    : isEmphasized
      ? AVAILABILITY_NAVY
      : ANDROID_SOFT_SURFACE;
  const badgeTextColor = isSelected || isEmphasized ? "#FFFFFF" : ANDROID_MUTED_TEXT;
  const circleFill = isSelected ? color : "#FFFFFF";
  const centerTextColor = isSelected ? "#FFFFFF" : isEmphasized ? color : "#9CA3AF";
  const resolvedCenterLabel = String(label || "P").slice(0, 3);
  const resolvedStatusLabel = String(statusLabel || "ZONE").slice(0, 6);
  const shadowOpacity = isEmphasized ? 0.72 : 0.45;

  return (
    <View
      collapsable={false}
      renderToHardwareTextureAndroid={false}
      style={{
        width: ANDROID_ZONE_FRAME_WIDTH,
        minHeight: ANDROID_ZONE_FRAME_HEIGHT,
        alignItems: "center",
        justifyContent: "flex-start",
        opacity: 1,
      }}
    >
      <View
        style={{
          minWidth: 44,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 8,
          backgroundColor: badgeFill,
          borderWidth: 1.5,
          borderColor: "#FFFFFF",
          alignItems: "center",
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            color: badgeTextColor,
            fontSize: 7,
            fontWeight: "900",
            letterSpacing: 0.25,
          }}
        >
          {resolvedStatusLabel}
        </Text>
      </View>

      <View
        style={{
          width: 28,
          height: 28,
          marginTop: 4,
          borderRadius: 14,
          backgroundColor: circleFill,
          borderWidth: 2,
          borderColor: strokeColor,
          alignItems: "center",
          justifyContent: "center",
          opacity: isEmphasized ? 1 : 0.72,
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            color: centerTextColor,
            fontSize: 10,
            fontWeight: "900",
            letterSpacing: 0.15,
          }}
        >
          {resolvedCenterLabel}
        </Text>
      </View>

      <View
        style={{
          width: 0,
          height: 0,
          marginTop: -1,
          borderLeftWidth: 6,
          borderRightWidth: 6,
          borderTopWidth: 9,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: strokeColor,
        }}
      />

      <View
        style={{
          width: 14,
          height: 4,
          marginTop: 4,
          borderRadius: 7,
          opacity: shadowOpacity,
          backgroundColor: ANDROID_SHADOW,
        }}
      />
    </View>
  );
};

const AndroidCompactPin = ({
  pinColor = "#3B82F6",
  centerLabel = "P",
  badgeLabel = "ZONE",
  filled = false,
  dimmed = false,
  muted = false,
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

  return (
    <View
      collapsable={false}
      renderToHardwareTextureAndroid={false}
      style={{
        width: ANDROID_COMPACT_FRAME_WIDTH,
        height: ANDROID_COMPACT_FRAME_HEIGHT,
        alignItems: "center",
        justifyContent: "flex-start",
        opacity: dimmed ? 0.78 : 1,
      }}
    >
      <View
        style={{
          minWidth: 34,
          alignItems: "center",
          backgroundColor: badgeFill,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: "#FFFFFF",
        }}
      >
        <Text
          allowFontScaling={false}
          style={{ color: badgeTextColor, fontSize: 7, fontWeight: "900", letterSpacing: 0.35 }}
        >
          {resolvedBadgeLabel}
        </Text>
      </View>

      <View
        style={{
          width: 24,
          height: 24,
          marginTop: 4,
          borderRadius: 12,
          backgroundColor: circleFill,
          borderWidth: 2,
          borderColor: strokeColor,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          allowFontScaling={false}
          style={{ color: centerTextColor, fontSize: 10, fontWeight: "900" }}
        >
          {resolvedCenterLabel}
        </Text>
      </View>

      <View
        style={{
          width: 0,
          height: 0,
          marginTop: -1,
          borderLeftWidth: 5,
          borderRightWidth: 5,
          borderTopWidth: 8,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: strokeColor,
        }}
      />

      <View
        style={{
          width: 10,
          height: 3,
          marginTop: 4,
          borderRadius: 5,
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
}) => {
  const resolvedBadgeLabel = String(badgeLabel || "OPEN").slice(0, 8);
  const resolvedCenterLabel = String(centerLabel || "P").slice(0, 3);
  const resolvedFooterLabel = String(footerLabel || "P").slice(0, 3);

  return (
    <View
      collapsable={false}
      renderToHardwareTextureAndroid={false}
      style={{
        width: ANDROID_AVAILABILITY_FRAME_WIDTH,
        height: ANDROID_AVAILABILITY_FRAME_HEIGHT,
        alignItems: "center",
        justifyContent: "flex-start",
        opacity: dimmed ? 0.84 : 1,
      }}
    >
      <View
        style={{
          minWidth: 58,
          alignItems: "center",
          backgroundColor: AVAILABILITY_NAVY,
          paddingHorizontal: 9,
          paddingVertical: 3,
          borderRadius: 8,
          borderWidth: 1.5,
          borderColor: "#FFFFFF",
        }}
      >
        <Text
          allowFontScaling={false}
          style={{ color: "#FFFFFF", fontSize: 8, fontWeight: "900", letterSpacing: 0.5 }}
        >
          {resolvedBadgeLabel}
        </Text>
      </View>

      <View
        style={{
          width: 34,
          height: 34,
          marginTop: 5,
          borderRadius: 17,
          backgroundColor: pinColor,
          borderWidth: 2,
          borderColor: "#FFFFFF",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          allowFontScaling={false}
          style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}
        >
          {resolvedCenterLabel}
        </Text>
      </View>

      <View
        style={{
          minWidth: 34,
          marginTop: -5,
          alignItems: "center",
          backgroundColor: AVAILABILITY_GOLD,
          paddingHorizontal: 7,
          paddingVertical: 2,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: "#FFFFFF",
        }}
      >
        <Text
          allowFontScaling={false}
          style={{ color: AVAILABILITY_NAVY, fontSize: 8, fontWeight: "900" }}
        >
          {resolvedFooterLabel}
        </Text>
      </View>

      <View
        style={{
          width: 0,
          height: 0,
          marginTop: -1,
          borderLeftWidth: 6,
          borderRightWidth: 6,
          borderTopWidth: 10,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: pinColor,
        }}
      />

      <View
        style={{
          width: 14,
          height: 4,
          marginTop: 4,
          borderRadius: 7,
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
}) => {
  if (Platform.OS === "android") {
    return (
      <AndroidAvailabilityPin
        pinColor={pinColor}
        badgeLabel={badgeLabel}
        footerLabel={footerLabel}
        centerLabel={centerLabel}
        dimmed={dimmed}
      />
    );
  }

  return (
    <View
      collapsable={false}
      style={{
        width: getPinFrameSize(scalePinSize(56), "width"),
        height: getPinFrameSize(scalePinSize(66)),
        alignItems: "center",
        justifyContent: "flex-start",
        paddingBottom: getPinFrameSize(scalePinSize(6)),
        opacity: dimmed ? 0.84 : 1,
      }}
    >
      <View
        style={{
          position: "absolute",
          top: scalePinSize(10),
          width: scalePinSize(44),
          height: scalePinSize(44),
          borderRadius: scalePinSize(22),
          borderWidth: scalePinSize(1.4),
          borderColor: AVAILABILITY_RING,
          backgroundColor: "rgba(255, 255, 255, 0.18)",
        }}
      />

      <View
        style={{
          position: "absolute",
          top: scalePinSize(15),
          width: scalePinSize(34),
          height: scalePinSize(34),
          borderRadius: scalePinSize(17),
          backgroundColor: AVAILABILITY_HALO,
        }}
      />

      <View
        style={{
          paddingHorizontal: scalePinSize(7),
          paddingVertical: scalePinSize(2.8),
          borderRadius: scalePinSize(10),
          backgroundColor: AVAILABILITY_NAVY,
          borderWidth: scalePinSize(1.2),
          borderColor: "rgba(255, 255, 255, 0.92)",
          minWidth: scalePinSize(30),
          alignItems: "center",
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            fontSize: scalePinSize(5.9),
            fontWeight: "900",
            letterSpacing: 0.4,
            color: "#FFFFFF",
          }}
        >
          {badgeLabel}
        </Text>
      </View>

      <View
        style={{
          width: scalePinSize(30),
          height: scalePinSize(30),
          borderRadius: scalePinSize(15),
          marginTop: scalePinSize(7),
          backgroundColor: pinColor,
          borderWidth: scalePinSize(2),
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
            top: scalePinSize(4),
            left: scalePinSize(6),
            width: scalePinSize(9),
            height: scalePinSize(5),
            borderRadius: scalePinSize(4),
            backgroundColor: "rgba(255, 255, 255, 0.24)",
            transform: [{ rotate: "-18deg" }],
          }}
        />

        <Text
          allowFontScaling={false}
          style={{
            fontSize: scalePinSize(12.5),
            fontWeight: "900",
            color: "#FFFFFF",
          }}
        >
          {centerLabel}
        </Text>
      </View>

      <View
        style={{
          marginTop: -scalePinSize(4),
          paddingHorizontal: scalePinSize(6),
          paddingVertical: scalePinSize(2.8),
          borderRadius: scalePinSize(8),
          backgroundColor: AVAILABILITY_GOLD,
          borderWidth: scalePinSize(1.1),
          borderColor: "#FFFFFF",
          minWidth: scalePinSize(28),
          alignItems: "center",
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            fontSize: scalePinSize(6.4),
            fontWeight: "900",
            letterSpacing: 0.25,
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
          borderLeftWidth: scalePinSize(4.2),
          borderRightWidth: scalePinSize(4.2),
          borderTopWidth: scalePinSize(6.5),
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: pinColor,
          marginTop: -scalePinSize(1),
        }}
      />

      <View
        style={{
          width: scalePinSize(10),
          height: scalePinSize(2.8),
          borderRadius: scalePinSize(5),
          backgroundColor: "rgba(11, 31, 51, 0.18)",
          marginTop: scalePinSize(1),
        }}
      />
    </View>
  );
};
