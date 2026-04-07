import React from "react";
import { View, Text } from "react-native";
import { Info } from "lucide-react-native";

export const CurrentZonePanel = ({ currentZone, insets, topOffset = 0 }) => {
  if (!currentZone) {
    return null;
  }

  const capacitySpaces = Number(
    currentZone?.capacity_spaces ?? currentZone?.capacitySpaces,
  );
  const capacityLabel =
    Number.isFinite(capacitySpaces) && capacitySpaces >= 0
      ? ` | ${capacitySpaces} space${capacitySpaces === 1 ? "" : "s"}`
      : "";

  return (
    <View
      style={{
        position: "absolute",
        left: 20,
        right: 20,
        top: insets.top + topOffset + 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: "#FFF",
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 15,
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      }}
    >
      <Info size={18} color="#3B82F6" />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "bold", color: "#111827" }}>
          {currentZone.name}
        </Text>
        <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
          {currentZone.zone_type}
          {capacityLabel}
          {currentZone.rules_description
            ? ` | ${currentZone.rules_description}`
            : ""}
        </Text>
      </View>
    </View>
  );
};
