import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Circle, Minus, Plus } from "lucide-react-native";

export const RadiusControl = ({ radius, onRadiusChange, insets }) => {
  const presetRadii = [200, 500, 1000, 1500, 2000];

  const increaseRadius = () => {
    if (radius < 2000) {
      const nextPreset = presetRadii.find((r) => r > radius);
      onRadiusChange(nextPreset || 2000);
    }
  };

  const decreaseRadius = () => {
    if (radius > 200) {
      const prevPreset = [...presetRadii].reverse().find((r) => r < radius);
      onRadiusChange(prevPreset || 200);
    }
  };

  return (
    <View
      style={{
        position: "absolute",
        right: 20,
        top: insets.top + 80,
        backgroundColor: "#FFF",
        borderRadius: 12,
        padding: 12,
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        minWidth: 140,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <Circle size={16} color="#3B82F6" />
        <Text style={{ fontSize: 12, fontWeight: "600", color: "#111827" }}>
          Detection Radius
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <TouchableOpacity
          onPress={decreaseRadius}
          disabled={radius <= 200}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: radius <= 200 ? "#F3F4F6" : "#3B82F6",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Minus size={18} color={radius <= 200 ? "#9CA3AF" : "#FFF"} />
        </TouchableOpacity>

        <Text
          style={{
            fontSize: 16,
            fontWeight: "bold",
            color: "#111827",
            flex: 1,
            textAlign: "center",
          }}
        >
          {radius}m
        </Text>

        <TouchableOpacity
          onPress={increaseRadius}
          disabled={radius >= 2000}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: radius >= 2000 ? "#F3F4F6" : "#3B82F6",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Plus size={18} color={radius >= 2000 ? "#9CA3AF" : "#FFF"} />
        </TouchableOpacity>
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 6,
          marginTop: 10,
        }}
      >
        {presetRadii.map((r) => (
          <TouchableOpacity
            key={r}
            onPress={() => onRadiusChange(r)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: radius === r ? "#3B82F6" : "#F3F4F6",
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "600",
                color: radius === r ? "#FFF" : "#6B7280",
              }}
            >
              {r >= 1000 ? `${r / 1000}km` : `${r}m`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};
