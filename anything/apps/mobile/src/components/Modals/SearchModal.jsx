import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { X, Search, MapPin } from "lucide-react-native";

export const SearchModal = ({
  visible,
  searchQuery,
  suggestions,
  loadingSuggestions,
  insets,
  onClose,
  onChangeText,
  onSelectSuggestion,
}) => {
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
            paddingBottom: insets.bottom + 20,
            maxHeight: "80%",
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
              Search Location
            </Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 5 }}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 14, color: "#6B7280", marginBottom: 15 }}>
              Start typing an address to see suggestions
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#E5E7EB",
                borderRadius: 12,
                paddingHorizontal: 16,
                marginBottom: 16,
              }}
            >
              <Search size={20} color="#9CA3AF" />
              <TextInput
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  fontSize: 16,
                }}
                placeholder="e.g., Collins St, Melbourne"
                value={searchQuery}
                onChangeText={onChangeText}
                autoFocus
              />
              {loadingSuggestions && (
                <ActivityIndicator size="small" color="#3B82F6" />
              )}
            </View>

            {/* Suggestions List */}
            {suggestions && suggestions.length > 0 && (
              <ScrollView
                style={{ maxHeight: 400 }}
                contentContainerStyle={{ gap: 8 }}
              >
                {suggestions.map((suggestion) => (
                  <TouchableOpacity
                    key={suggestion.place_id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 12,
                      backgroundColor: "#F9FAFB",
                      borderRadius: 10,
                      gap: 12,
                    }}
                    onPress={() => onSelectSuggestion(suggestion)}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: "#EFF6FF",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <MapPin size={20} color="#3B82F6" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "500",
                          color: "#111827",
                        }}
                      >
                        {suggestion.structured_formatting?.main_text ||
                          suggestion.description}
                      </Text>
                      {suggestion.structured_formatting?.secondary_text && (
                        <Text
                          style={{
                            fontSize: 13,
                            color: "#6B7280",
                            marginTop: 2,
                          }}
                        >
                          {suggestion.structured_formatting.secondary_text}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {searchQuery.length >= 3 &&
              !loadingSuggestions &&
              suggestions.length === 0 && (
                <View
                  style={{
                    padding: 20,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 14, color: "#6B7280" }}>
                    No suggestions found
                  </Text>
                </View>
              )}
          </View>
        </View>
      </View>
    </Modal>
  );
};
