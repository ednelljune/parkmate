import React from "react";
import { Image, View, Text } from "react-native";

const formatCoordinate = (value, positiveLabel, negativeLabel) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }

  const direction = value >= 0 ? positiveLabel : negativeLabel;
  return `${Math.abs(value).toFixed(5)}${direction}`;
};

export const MapBrandingBadge = ({ insets, topOffset = 0, location }) => {
  const latitude = formatCoordinate(location?.latitude, "N", "S");
  const longitude = formatCoordinate(location?.longitude, "E", "W");

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: insets.top + topOffset,
        left: 12,
        right: 12,
        backgroundColor: "rgba(241, 245, 249, 0.74)",
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 14,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.35)",
        shadowColor: "#04111d",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 5,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Image
          resizeMode="contain"
          source={require("../../../assets/images/parkmate-logo-current.png")}
          style={{
            width: 42,
            height: 42,
          }}
        />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text
            style={{
              color: "#0ea5e9",
              fontSize: 13,
              fontWeight: "900",
              letterSpacing: 1.6,
            }}
          >
            PARKMATE
          </Text>
          <Text
            style={{
              color: "#475569",
              fontSize: 12,
              fontWeight: "600",
              marginTop: 1,
            }}
          >
            Live map position
          </Text>
        </View>
        <View style={{ marginLeft: 12, alignItems: "flex-end" }}>
          <Text
            style={{
              color: "#64748b",
              fontSize: 9,
              fontWeight: "600",
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            User coordinates
          </Text>
          <Text
            style={{
              color: "#0f172a",
              fontSize: 12,
              fontWeight: "700",
              marginTop: 3,
            }}
          >
            {latitude}, {longitude}
          </Text>
        </View>
      </View>

      <Text
        style={{
          color: "#64748b",
          fontSize: 10,
          marginTop: 7,
        }}
      >
        Your live location on the ParkMate map
      </Text>
    </View>
  );
};

export default MapBrandingBadge;
