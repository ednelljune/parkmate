import React from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView } from "react-native";
import { X, Plus, Minus } from "lucide-react-native";

export const ReportModal = ({
  visible,
  selectedZoneOption,
  availableZoneOptions,
  detectionRadius,
  spotQuantity,
  isReporting,
  insets,
  onClose,
  onSelectType,
  onSetQuantity,
  onConfirm,
}) => {
  const hasAvailableParkingTypes = availableZoneOptions.length > 0;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: "#FFF",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: "78%",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 14,
              borderBottomWidth: 1,
              borderBottomColor: "#E5E7EB",
            }}
          >
            <Text
              style={{ fontSize: 17, fontWeight: "bold", color: "#111827" }}
            >
              Report Parking Spot
            </Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ paddingHorizontal: 14 }}
            contentContainerStyle={{ paddingTop: 14, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#111827",
                marginBottom: 4,
              }}
            >
              Parking Type
            </Text>
            <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
              {hasAvailableParkingTypes
                ? "Choose the mapped parking zone you are currently inside before reporting a spot."
                : `No parking zones were detected within ${detectionRadius}m of your location.`}
            </Text>

            <View style={{ gap: 6, marginBottom: 16 }}>
              {hasAvailableParkingTypes ? (
                availableZoneOptions.map((option) => (
                  <TouchableOpacity
                    key={`${option.zoneId}-${option.parkingType}`}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor:
                        selectedZoneOption?.zoneId === option.zoneId ? "#3B82F6" : "#E5E7EB",
                      backgroundColor:
                        selectedZoneOption?.zoneId === option.zoneId ? "#EFF6FF" : "#FFF",
                    }}
                    onPress={() => onSelectType(option)}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color:
                          selectedZoneOption?.zoneId === option.zoneId ? "#3B82F6" : "#111827",
                      }}
                    >
                      {option.parkingType}
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                        color:
                          selectedZoneOption?.zoneId === option.zoneId ? "#1D4ED8" : "#6B7280",
                      }}
                    >
                      {option.zoneName}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 14,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                    backgroundColor: "#F9FAFB",
                  }}
                >
                  <Text style={{ fontSize: 13, color: "#4B5563" }}>
                    Move into a mapped parking zone before reporting a spot. Your current location must be inside the zone boundary.
                  </Text>
                </View>
              )}
            </View>

            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#111827",
                marginBottom: 4,
              }}
            >
              Number of Spots
            </Text>
            <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
              How many spots are available?
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <TouchableOpacity
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: spotQuantity > 1 ? "#3B82F6" : "#E5E7EB",
                  justifyContent: "center",
                  alignItems: "center",
                }}
                onPress={() => onSetQuantity(Math.max(1, spotQuantity - 1))}
                disabled={spotQuantity <= 1}
              >
                <Minus
                  size={16}
                  color={spotQuantity > 1 ? "#FFF" : "#9CA3AF"}
                />
              </TouchableOpacity>

              <View
                style={{
                  minWidth: 50,
                  paddingVertical: 6,
                  paddingHorizontal: 14,
                  borderRadius: 8,
                  backgroundColor: "#F3F4F6",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 20, fontWeight: "bold", color: "#111827" }}
                >
                  {spotQuantity}
                </Text>
              </View>

              <TouchableOpacity
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "#3B82F6",
                  justifyContent: "center",
                  alignItems: "center",
                }}
                onPress={() => onSetQuantity(Math.min(99, spotQuantity + 1))}
              >
                <Plus size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View
            style={{
              paddingHorizontal: 14,
              paddingTop: 10,
              paddingBottom: Math.max(insets.bottom, 12),
              borderTopWidth: 1,
              borderTopColor: "#E5E7EB",
              backgroundColor: "#FFF",
            }}
          >
            <TouchableOpacity
              style={{
                backgroundColor:
                  isReporting || !hasAvailableParkingTypes ? "#93C5FD" : "#3B82F6",
                paddingVertical: 11,
                borderRadius: 10,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 6,
              }}
              onPress={onConfirm}
              disabled={isReporting || !hasAvailableParkingTypes}
            >
              <Text style={{ color: "#FFF", fontSize: 15, fontWeight: "600" }}>
                {isReporting ? "Reporting..." : "Confirm Report"}
              </Text>
            </TouchableOpacity>
          </View>
          
        </View>
      </View>
    </Modal>
  );
};
