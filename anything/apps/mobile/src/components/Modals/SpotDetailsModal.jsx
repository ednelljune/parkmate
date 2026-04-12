import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import {
  X,
  MapPin,
  AlertTriangle,
  Trash2,
} from "lucide-react-native";
import { formatDistance, formatTimeLeft } from "@/utils/formatters";
import useUser from "@/utils/auth/useUser";

export const SpotDetailsModal = ({
  visible,
  spot,
  routeCoordinates,
  isClaiming,
  isReportingFalse,
  insets,
  onClose,
  onClaimSpot,
  onReportFalse,
  onDeleteSpot,
}) => {
  const { data: user } = useUser();
  const isOwnReport = user?.id && spot?.user_id === user.id;

  const handleClaimSpot = () => {
    if (!spot) return;
    onClaimSpot(spot);
  };

  const handleReportFalse = () => {
    if (!spot) return;
    onReportFalse(spot);
  };

  const handleDeleteSpot = () => {
    if (!spot) return;
    Alert.alert(
      "Delete Your Report?",
      "Are you sure you want to remove this parking spot report?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => onDeleteSpot(spot),
        },
      ],
    );
  };

  useEffect(() => {
    if (!spot) {
      console.log("[spot.crash] modal.render missing spot");
      return;
    }
    console.log(
      "[spot.crash] modal.render",
      `id=${spot.id}`,
      `lat=${spot.latitude}`,
      `lng=${spot.longitude}`,
      `status=${spot.status}`,
      `expires_at=${spot.expires_at}`,
    );
  }, [spot]);

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
            maxHeight: "82%",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: "#E5E7EB",
            }}
          >
            <Text
              style={{ fontSize: 20, fontWeight: "bold", color: "#111827" }}
            >
              Parking Spot Details
            </Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 5 }}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {spot && (
            <ScrollView
              style={{ paddingHorizontal: 20 }}
              contentContainerStyle={{ paddingTop: 20, paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{ fontSize: 14, color: "#6B7280", marginBottom: 5 }}
                >
                  Zone
                </Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    color: "#111827",
                  }}
                >
                  {spot.zone_name || "Unknown"} ({spot.zone_type || "N/A"})
                </Text>
              </View>

              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{ fontSize: 14, color: "#6B7280", marginBottom: 5 }}
                >
                  Distance
                </Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    color: "#111827",
                  }}
                >
                  {formatDistance(spot.distance_meters)}
                </Text>
              </View>

              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{ fontSize: 14, color: "#6B7280", marginBottom: 5 }}
                >
                  Time Left
                </Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    color: "#111827",
                  }}
                >
                  {formatTimeLeft(spot.expires_at)}
                </Text>
              </View>

              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{ fontSize: 14, color: "#6B7280", marginBottom: 5 }}
                >
                  Status
                </Text>
                <View
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 12,
                    alignSelf: "flex-start",
                    backgroundColor:
                      spot.status === "available" ? "#DEF7EC" : "#FEE2E2",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color:
                        spot.status === "available" ? "#059669" : "#DC2626",
                    }}
                  >
                    {spot.status === "available" ? "Available" : "Claimed"}
                  </Text>
                </View>
              </View>
            </ScrollView>
          )}

          {spot && (
            <View
              style={{
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: Math.max(insets.bottom, 12),
                borderTopWidth: 1,
                borderTopColor: "#E5E7EB",
                backgroundColor: "#FFF",
                gap: 12,
              }}
            >
              {spot.status === "available" &&
                (isOwnReport ? (
                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      backgroundColor: "#FFF",
                      borderWidth: 2,
                      borderColor: "#EF4444",
                      paddingVertical: 14,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                    onPress={handleDeleteSpot}
                  >
                    <Trash2 size={20} color="#EF4444" />
                    <Text
                      style={{
                        color: "#EF4444",
                        fontSize: 16,
                        fontWeight: "600",
                      }}
                    >
                      Delete My Report
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <View
                      style={{
                        backgroundColor: "#F3F4F6",
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                      }}
                    >
                      <Text
                        style={{
                          color: "#374151",
                          fontSize: 13,
                          lineHeight: 19,
                        }}
                      >
                        Claiming is only allowed when your current location is confirmed within 5m of this reported spot's coordinates.
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={{
                        flexDirection: "row",
                        backgroundColor: "#10B981",
                        paddingVertical: 14,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                      onPress={handleClaimSpot}
                      disabled={isClaiming}
                    >
                      <MapPin size={20} color="#FFF" />
                      <Text
                        style={{
                          color: "#FFF",
                          fontSize: 16,
                          fontWeight: "600",
                        }}
                      >
                        {isClaiming ? "Claiming..." : "Claim Spot"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        flexDirection: "row",
                        backgroundColor: "#FFF",
                        borderWidth: 2,
                        borderColor: "#F59E0B",
                        paddingVertical: 14,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                      onPress={handleReportFalse}
                      disabled={isReportingFalse}
                    >
                      <AlertTriangle size={20} color="#F59E0B" />
                      <Text
                        style={{
                          color: "#F59E0B",
                          fontSize: 16,
                          fontWeight: "600",
                        }}
                      >
                        {isReportingFalse ? "Reporting..." : "Report False Spot"}
                      </Text>
                    </TouchableOpacity>
                  </>
                ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};
