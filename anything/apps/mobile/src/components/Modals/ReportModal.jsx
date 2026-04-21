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
  onSuggestMissingZone = () => {},
}) => {
  const nearbyZoneOptions = availableZoneOptions.filter(
    (option) => option.distanceMeters <= detectionRadius,
  );
  const hasAvailableParkingTypes = nearbyZoneOptions.length > 0;

  return (
    <Modal
      visible={visible}
      transparent
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
            <Text style={{ fontSize: 17, fontWeight: "bold", color: "#111827" }}>
              {hasAvailableParkingTypes ? "Report Parking Spot" : "No Mapped Parking Zone"}
            </Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {hasAvailableParkingTypes ? (
            <>
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
                  Choose the mapped parking zone area you are currently inside before
                  reporting a spot.
                </Text>

                <View style={{ gap: 6, marginBottom: 16 }}>
                  {nearbyZoneOptions.map((option) => (
                    <TouchableOpacity
                      key={`${option.zoneId}-${option.parkingType}`}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor:
                          selectedZoneOption?.zoneId === option.zoneId && selectedZoneOption?.parkingType === option.parkingType ? "#3B82F6" : "#E5E7EB",
                        backgroundColor:
                          selectedZoneOption?.zoneId === option.zoneId && selectedZoneOption?.parkingType === option.parkingType ? "#EFF6FF" : "#FFF",
                      }}
                      onPress={() => onSelectType(option)}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color:
                            selectedZoneOption?.zoneId === option.zoneId && selectedZoneOption?.parkingType === option.parkingType
                              ? "#3B82F6"
                              : "#111827",
                        }}
                      >
                        {option.parkingType}
                      </Text>
                      <Text
                        style={{
                          marginTop: 2,
                          fontSize: 12,
                          color:
                            selectedZoneOption?.zoneId === option.zoneId && selectedZoneOption?.parkingType === option.parkingType
                              ? "#1D4ED8"
                              : "#6B7280",
                        }}
                      >
                        {option.zoneName}
                      </Text>
                    </TouchableOpacity>
                  ))}
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
                    <Text style={{ fontSize: 20, fontWeight: "bold", color: "#111827" }}>
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
                    backgroundColor: isReporting || !selectedZoneOption ? "#93C5FD" : "#3B82F6",
                    paddingVertical: 11,
                    borderRadius: 10,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 6,
                  }}
                  onPress={onConfirm}
                  disabled={isReporting || !selectedZoneOption}
                >
                  <Text style={{ color: "#FFF", fontSize: 15, fontWeight: "600" }}>
                    {isReporting ? "Reporting..." : "Confirm Report"}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View
              style={{
                paddingHorizontal: 14,
                paddingTop: 18,
                paddingBottom: Math.max(insets.bottom, 18),
              }}
            >
              <View
                style={{
                  paddingVertical: 18,
                  paddingHorizontal: 16,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "#D1FAE5",
                  backgroundColor: "#F0FDFA",
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#0F172A" }}>
                  You are outside a mapped parking zone
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    lineHeight: 20,
                    color: "#475569",
                    marginTop: 10,
                  }}
                >
                  Spot reports only work inside mapped parking zones. If this parking area
                  is missing from the map, send it for review instead.
                </Text>
                <TouchableOpacity
                  style={{
                    marginTop: 18,
                    borderRadius: 10,
                    backgroundColor: "#0F766E",
                    paddingVertical: 12,
                    alignItems: "center",
                  }}
                  onPress={onSuggestMissingZone}
                >
                  <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>
                    Suggest Missing Parking Zone
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    marginTop: 10,
                    paddingVertical: 10,
                    alignItems: "center",
                  }}
                  onPress={onClose}
                >
                  <Text style={{ color: "#64748B", fontSize: 14, fontWeight: "600" }}>
                    Close
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};
