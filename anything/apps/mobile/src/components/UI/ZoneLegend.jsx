import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { X } from "lucide-react-native";
import { ZONE_COLORS } from "@/constants/zoneColors";

export const ZoneLegend = ({ visible, onClose, insets }) => {
  if (!visible) return null;

  return (
    <View
      style={{
        position: "absolute",
        bottom: insets.bottom + 160,
        left: 20,
        maxWidth: 200,
        backgroundColor: "#FFF",
        borderRadius: 12,
        padding: 12,
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: "bold", color: "#111827" }}>
          Parking Zones
        </Text>
        <TouchableOpacity onPress={onClose}>
          <X size={16} color="#6B7280" />
        </TouchableOpacity>
      </View>
      {Object.entries(ZONE_COLORS).map(([type, colors]) => (
        <View
          key={type}
          style={{
            flexDirection: "row",
            gap: 8,
            alignItems: "center",
            marginVertical: 4,
          }}
        >
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: colors.stroke,
            }}
          />
          <Text style={{ fontSize: 12, color: "#374151", fontWeight: "500" }}>
            {type}
          </Text>
        </View>
      ))}
    </View>
  );
};
