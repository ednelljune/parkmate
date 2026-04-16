import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import {
  X,
  MapPin,
  Clock,
  AlertCircle,
  Map,
} from "lucide-react-native";
import { ZONE_COLORS } from "@/constants/zoneColors";
import { formatDistance, formatTimeLeft } from "@/utils/formatters";

export const ZoneDetailsModal = ({
  visible,
  zone,
  availableReports = [],
  insets,
  onClose,
  onDismiss,
  onGetDirections,
  onSelectReport,
}) => {
  useEffect(() => {
    if (!zone) {
      return;
    }

    console.log(
      "[spot.crash] zone.modal",
      `id=${zone.id}`,
      `lat=${zone.center_lat}`,
      `lng=${zone.center_lng}`,
      `type=${zone.zone_type}`,
      `name=${zone.name}`,
    );
  }, [zone]);

  if (!zone) return null;

  const colors = ZONE_COLORS[zone.zone_type] || ZONE_COLORS["1P"];
  const capacitySpaces = Number(zone?.capacity_spaces ?? zone?.capacitySpaces);
  const hasCapacitySpaces =
    Number.isFinite(capacitySpaces) && capacitySpaces >= 0;
  const totalAvailableSpots = availableReports.reduce((total, report) => {
    const quantity = Number(report?.quantity);
    return total + (Number.isFinite(quantity) && quantity > 0 ? quantity : 1);
  }, 0);

  const handleGetDirections = () => {
    onClose();
    onGetDirections?.(zone);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onDismiss={onDismiss}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.18)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: "#FFF",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 12,
            paddingBottom: insets.bottom + 12,
            maxHeight: "44%",
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 4,
              borderRadius: 999,
              backgroundColor: "#D1D5DB",
              marginBottom: 10,
            }}
          />
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 16,
              marginBottom: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 0,
                }}
              >
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 8,
                    backgroundColor: colors.fill,
                    borderWidth: 2,
                    borderColor: colors.stroke,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "bold",
                      color: colors.stroke,
                      letterSpacing: 0.2,
                    }}
                  >
                    {zone.zone_type}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "bold",
                    color: "#111827",
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {zone.name}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: "#F3F4F6",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ paddingHorizontal: 16 }}
            contentContainerStyle={{ paddingBottom: 4 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Zone Information */}
            <View
              style={{
                backgroundColor: "#F9FAFB",
                borderRadius: 12,
                padding: 13,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <MapPin size={18} color={colors.stroke} />
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#111827",
                  }}
                >
                  Parking Zone Details
                </Text>
              </View>

              {zone.rules_description && (
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <Clock size={16} color="#6B7280" style={{ marginTop: 1 }} />
                  <Text
                    style={{
                      fontSize: 14,
                      color: "#374151",
                      flex: 1,
                      lineHeight: 18,
                    }}
                  >
                    {zone.rules_description}
                  </Text>
                </View>
              )}

              {hasCapacitySpaces && (
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <Map size={16} color="#6B7280" style={{ marginTop: 1 }} />
                  <Text
                    style={{
                      fontSize: 14,
                      color: "#374151",
                      flex: 1,
                      lineHeight: 18,
                    }}
                  >
                    Capacity: {capacitySpaces} parking space
                    {capacitySpaces === 1 ? "" : "s"}
                  </Text>
                </View>
              )}

              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: "#E5E7EB",
                }}
              >
                <AlertCircle
                  size={16}
                  color="#3B82F6"
                  style={{ marginTop: 1 }}
                />
                <Text
                  style={{
                    fontSize: 13,
                    color: "#6B7280",
                    flex: 1,
                    lineHeight: 16,
                  }}
                >
                  Tap the zone badge on the map to highlight the parking area
                  boundaries
                </Text>
              </View>
            </View>

            <View
              style={{
                backgroundColor: "#F9FAFB",
                borderRadius: 12,
                padding: 13,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#111827",
                    }}
                  >
                    Available Reported Spots
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: "#6B7280",
                      marginTop: 1,
                    }}
                  >
                    {totalAvailableSpots > 0
                      ? `${totalAvailableSpots} reported spot${totalAvailableSpots === 1 ? "" : "s"} currently available`
                      : "No available spot reports in this zone right now"}
                  </Text>
                </View>
                {totalAvailableSpots > 0 && (
                  <View
                    style={{
                      minWidth: 32,
                      height: 32,
                      paddingHorizontal: 8,
                      borderRadius: 16,
                      backgroundColor: "#DEF7EC",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: "#059669",
                      }}
                    >
                      {totalAvailableSpots}
                    </Text>
                  </View>
                )}
              </View>

              {availableReports.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {availableReports.map((report) => {
                    const quantity = Math.max(
                      1,
                      Number.isFinite(Number(report?.quantity))
                        ? Math.floor(Number(report.quantity))
                        : 1,
                    );
                    const distanceMeters = Number(report?.distance_meters);
                    const hasDistance = Number.isFinite(distanceMeters);

                    return (
                      <TouchableOpacity
                        key={`zone-report-${report.id}`}
                        onPress={() => onSelectReport?.(report)}
                        activeOpacity={0.85}
                        style={{
                          backgroundColor: "#FFFFFF",
                          borderRadius: 12,
                          padding: 12,
                          borderWidth: 1,
                          borderColor: "#E5E7EB",
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            marginBottom: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: "600",
                              color: "#111827",
                              flex: 1,
                            }}
                          >
                            {quantity} spot{quantity === 1 ? "" : "s"} reported
                          </Text>
                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 999,
                              backgroundColor: "#DEF7EC",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "700",
                                color: "#059669",
                              }}
                            >
                              Available
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={{
                            fontSize: 13,
                            color: "#4B5563",
                            lineHeight: 16,
                          }}
                        >
                          {hasDistance
                            ? `${formatDistance(distanceMeters)} - `
                            : ""}
                          {report?.expires_at
                            ? formatTimeLeft(report.expires_at)
                            : "Reported recently"}
                        </Text>

                        <Text
                          style={{
                            fontSize: 12,
                            color: "#6B7280",
                            marginTop: 6,
                          }}
                        >
                          Tap to view this report
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: "#6B7280",
                      lineHeight: 16,
                    }}
                  >
                    No users have reported an available parking spot in this zone
                    yet.
                  </Text>
                </View>
              )}
            </View>

            {/* In-app navigation button */}
            <TouchableOpacity
              onPress={handleGetDirections}
              style={{
                backgroundColor: "#3B82F6",
                borderRadius: 12,
                padding: 13,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <Map size={18} color="#FFF" />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: "#FFF",
                }}
              >
                Start In-App Navigation
              </Text>
            </TouchableOpacity>

            {/* Additional Info */}
            <View
              style={{
                backgroundColor: "#FEF3C7",
                borderRadius: 12,
                padding: 12,
                flexDirection: "row",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <AlertCircle size={16} color="#D97706" style={{ marginTop: 1 }} />
              <Text
                style={{
                  fontSize: 13,
                  color: "#92400E",
                  flex: 1,
                  lineHeight: 16,
                }}
              >
                Always check street signs for current parking restrictions and
                time limits
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

};
