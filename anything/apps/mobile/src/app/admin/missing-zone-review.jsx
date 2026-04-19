import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import fetch from "@/__create/fetch";
import { useAuth } from "@/utils/auth/useAuth";

const STATUS_OPTIONS = ["pending", "reviewing", "approved", "rejected"];
const DEFAULT_FORM = {
  zoneName: "",
  zoneType: "Public",
  capacitySpaces: "",
  rulesDescription: "",
  reviewNotes: "",
  latOffset: "0.00045",
  lngOffset: "0.00055",
};

const formatCoordinate = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(6) : "Unknown";
};

const formatDate = (value) => {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
};

export default function MissingZoneReviewScreen() {
  const insets = useSafeAreaInsets();
  const { user, session } = useAuth();
  const [status, setStatus] = useState("pending");
  const [activeSuggestionId, setActiveSuggestionId] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const userId = user?.id || null;
  const canUseProfileApi = Boolean(userId && session?.access_token);

  const profileQuery = useQuery({
    queryKey: ["user_profile", userId],
    queryFn: async () => {
      const response = await fetch("/api/users/profile");
      const result = await response.json();

      if (!response.ok || result?.success === false) {
        throw new Error(result?.message || result?.error || "Failed to load profile.");
      }

      return result.user || null;
    },
    enabled: canUseProfileApi,
  });

  const isAdminUser = Boolean(profileQuery.data?.is_admin);

  if (canUseProfileApi && profileQuery.isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "Missing Zone Review" }} />
        <View style={[styles.centeredScreen, styles.loadingCenteredScreen, { paddingTop: insets.top + 32 }]}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color="#0EA5E9" />
            <Text style={styles.loadingText}>Checking admin access...</Text>
          </View>
        </View>
      </>
    );
  }

  const suggestionsQuery = useQuery({
    queryKey: ["admin_zone_suggestions", status],
    queryFn: async () => {
      const response = await fetch(`/api/admin/zones/suggestions?status=${status}`);
      const result = await response.json();

      if (!response.ok || result?.success === false) {
        throw new Error(result?.message || result?.error || "Failed to load suggestions.");
      }

      return Array.isArray(result?.suggestions) ? result.suggestions : [];
    },
    enabled: canUseProfileApi && isAdminUser,
  });

  const suggestions = suggestionsQuery.data || [];
  const refetchSuggestions = suggestionsQuery.refetch;

  const activeSuggestion = useMemo(
    () => suggestions.find((item) => item.id === activeSuggestionId) || null,
    [activeSuggestionId, suggestions],
  );

  const resetSelection = useCallback(() => {
    setActiveSuggestionId(null);
    setForm(DEFAULT_FORM);
  }, []);

  useEffect(() => {
    if (activeSuggestionId && !activeSuggestion) {
      resetSelection();
    }
  }, [activeSuggestion, activeSuggestionId, resetSelection]);

  const selectSuggestion = useCallback((suggestion) => {
    setActiveSuggestionId(suggestion.id);
    setForm({
      ...DEFAULT_FORM,
      zoneName: suggestion.area_name || "",
      reviewNotes: suggestion.review_notes || "",
    });
  }, []);

  const runAction = useCallback(
    async (suggestionId, payload) => {
      setSubmitting(true);

      try {
        const response = await fetch(`/api/admin/zones/suggestions/${suggestionId}/action`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (!response.ok || result?.success === false) {
          throw new Error(result?.message || result?.error || "Action failed.");
        }

        resetSelection();
        await refetchSuggestions();
      } catch (error) {
        Alert.alert("Action failed", error?.message || "Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [refetchSuggestions, resetSelection],
  );

  const confirmAndRunAction = useCallback(
    (suggestionId, payload) => {
      const actionLabel =
        payload.action === "approve"
          ? "approve and publish"
          : payload.action === "reject"
            ? "reject"
            : payload.action;

      Alert.alert(
        `Confirm ${actionLabel}`,
        `Are you sure you want to ${actionLabel} this suggestion?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Confirm",
            style: payload.action === "reject" ? "destructive" : "default",
            onPress: () => {
              runAction(suggestionId, payload);
            },
          },
        ],
      );
    },
    [runAction],
  );

  const handleApprove = useCallback(() => {
    if (!activeSuggestion) {
      return;
    }

    const normalizedZoneName = form.zoneName.trim();
    if (!normalizedZoneName) {
      Alert.alert("Validation Error", "Zone name is required.");
      return;
    }

    const normalizedZoneType = form.zoneType.trim() || "Public";
    const normalizedCapacity = form.capacitySpaces.trim();
    const parsedCapacity = normalizedCapacity ? Number.parseInt(normalizedCapacity, 10) : null;

    if (normalizedCapacity && (!Number.isFinite(parsedCapacity) || parsedCapacity < 0)) {
      Alert.alert("Validation Error", "Capacity must be a valid positive number.");
      return;
    }

    const normalizedLatOffset = form.latOffset.trim();
    const parsedLatOffset = normalizedLatOffset ? Number.parseFloat(normalizedLatOffset) : null;
    if (normalizedLatOffset && !Number.isFinite(parsedLatOffset)) {
      Alert.alert("Validation Error", "Latitude offset must be a valid number.");
      return;
    }

    const normalizedLngOffset = form.lngOffset.trim();
    const parsedLngOffset = normalizedLngOffset ? Number.parseFloat(normalizedLngOffset) : null;
    if (normalizedLngOffset && !Number.isFinite(parsedLngOffset)) {
      Alert.alert("Validation Error", "Longitude offset must be a valid number.");
      return;
    }

    confirmAndRunAction(activeSuggestion.id, {
      action: "approve",
      zoneName: normalizedZoneName,
      zoneType: normalizedZoneType,
      capacitySpaces: parsedCapacity,
      rulesDescription: form.rulesDescription.trim(),
      reviewNotes: form.reviewNotes.trim(),
      latOffset: parsedLatOffset,
      lngOffset: parsedLngOffset,
    });
  }, [activeSuggestion, confirmAndRunAction, form]);

  if (!isAdminUser) {
    return (
      <>
        <Stack.Screen options={{ title: "Missing Zone Review" }} />
        <View style={[styles.centeredScreen, { paddingTop: insets.top + 32 }]}>
          <View style={styles.lockedCard}>
            <Text style={styles.lockedTitle}>Access restricted</Text>
            <Text style={styles.lockedBody}>
              This review tool is only available to the ParkMate admin account.
            </Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Missing Zone Review" }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{
          paddingTop: insets.top + 18,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pagePadding}>
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>Admin Review</Text>
            <Text style={styles.heroTitle}>Missing public zone suggestions</Text>
            <Text style={styles.heroBody}>
              Review coordinate-based zone suggestions from the app, approve them into live zones,
              or reject them with notes.
            </Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.chipRow}>
              {STATUS_OPTIONS.map((option) => {
                const active = option === status;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setStatus(option)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHeaderRow}>
              <Text style={styles.sectionTitle}>{status} suggestions</Text>
              <Pressable
                disabled={suggestionsQuery.isFetching}
                style={[
                  styles.refreshButton,
                  suggestionsQuery.isFetching && styles.disabledButton,
                ]}
                onPress={() => suggestionsQuery.refetch()}
              >
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </Pressable>
            </View>

            {suggestionsQuery.isLoading ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color="#0EA5E9" />
                <Text style={styles.loadingText}>Loading suggestions...</Text>
              </View>
            ) : null}

            {suggestionsQuery.error ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>
                  {suggestionsQuery.error?.message || "Failed to load suggestions."}
                </Text>
              </View>
            ) : null}

            {!suggestionsQuery.isLoading && suggestions.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No suggestions found for this status.</Text>
              </View>
            ) : null}

            <View style={styles.suggestionList}>
              {suggestions.map((suggestion) => {
                const isSelected = suggestion.id === activeSuggestionId;
                return (
                  <Pressable
                    key={suggestion.id}
                    onPress={() => selectSuggestion(suggestion)}
                    style={[styles.suggestionCard, isSelected && styles.suggestionCardSelected]}
                  >
                    <View style={styles.suggestionTopRow}>
                      <View style={styles.badgeRow}>
                        <View style={styles.idBadge}>
                          <Text style={styles.idBadgeText}>#{suggestion.id}</Text>
                        </View>
                        <View style={styles.statusBadge}>
                          <Text style={styles.statusBadgeText}>{suggestion.status}</Text>
                        </View>
                      </View>
                      <Text style={styles.coordinatesText}>
                        {formatCoordinate(suggestion.latitude)},{" "}
                        {formatCoordinate(suggestion.longitude)}
                      </Text>
                    </View>

                    <Text style={styles.suggestionTitle}>
                      {suggestion.area_name || "Unnamed suggestion"}
                    </Text>
                    <Text style={styles.suggestionMeta}>
                      Submitted by {suggestion.submitter_name || suggestion.submitter_email || "Unknown"} on{" "}
                      {formatDate(suggestion.created_at)}
                    </Text>

                    <View style={styles.metricRow}>
                      <Text style={styles.metricText}>
                        Confirmations: {Number(suggestion.confirmation_count) || 0}
                      </Text>
                      <Text style={styles.metricText}>
                        False flags: {Number(suggestion.false_flag_count) || 0}
                      </Text>
                    </View>

                    {suggestion.review_notes ? (
                      <Text style={styles.reviewNotesPreview}>{suggestion.review_notes}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Approval panel</Text>

            {!activeSuggestion ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Select a suggestion above to review it.</Text>
              </View>
            ) : (
              <View style={styles.formStack}>
                <View style={styles.selectionCard}>
                  <Text style={styles.selectionTitle}>
                    {activeSuggestion.area_name || `Suggestion #${activeSuggestion.id}`}
                  </Text>
                  <Text style={styles.selectionMeta}>
                    {formatCoordinate(activeSuggestion.latitude)},{" "}
                    {formatCoordinate(activeSuggestion.longitude)}
                  </Text>
                </View>

                <TextInput
                  value={form.zoneName}
                  onChangeText={(value) => setForm((current) => ({ ...current, zoneName: value }))}
                  placeholder="Zone name"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                />
                <TextInput
                  value={form.zoneType}
                  onChangeText={(value) => setForm((current) => ({ ...current, zoneType: value }))}
                  placeholder="Zone type"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                />
                <TextInput
                  value={form.capacitySpaces}
                  onChangeText={(value) =>
                    setForm((current) => ({ ...current, capacitySpaces: value }))
                  }
                  placeholder="Capacity spaces"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  style={styles.input}
                />

                <View style={styles.inlineRow}>
                  <TextInput
                    value={form.latOffset}
                    onChangeText={(value) => setForm((current) => ({ ...current, latOffset: value }))}
                    placeholder="Lat offset"
                    placeholderTextColor="#94A3B8"
                    style={[styles.input, styles.inlineInput]}
                  />
                  <TextInput
                    value={form.lngOffset}
                    onChangeText={(value) => setForm((current) => ({ ...current, lngOffset: value }))}
                    placeholder="Lng offset"
                    placeholderTextColor="#94A3B8"
                    style={[styles.input, styles.inlineInput]}
                  />
                </View>

                <TextInput
                  value={form.rulesDescription}
                  onChangeText={(value) =>
                    setForm((current) => ({ ...current, rulesDescription: value }))
                  }
                  placeholder="Rules description"
                  placeholderTextColor="#94A3B8"
                  multiline
                  textAlignVertical="top"
                  style={[styles.input, styles.textarea]}
                />
                <TextInput
                  value={form.reviewNotes}
                  onChangeText={(value) => setForm((current) => ({ ...current, reviewNotes: value }))}
                  placeholder="Review notes"
                  placeholderTextColor="#94A3B8"
                  multiline
                  textAlignVertical="top"
                  style={[styles.input, styles.textarea]}
                />

                <View style={styles.actionStack}>
                  <Pressable
                    disabled={submitting}
                    style={[styles.actionButton, styles.approveButton, submitting && styles.disabledButton]}
                    onPress={handleApprove}
                  >
                    <Text style={styles.approveButtonText}>
                      {submitting ? "Working..." : "Approve and publish"}
                    </Text>
                  </Pressable>

                  <View style={styles.inlineActions}>
                    <Pressable
                      disabled={submitting}
                      style={[styles.secondaryButton, submitting && styles.disabledButton]}
                      onPress={() =>
                        runAction(activeSuggestion.id, {
                          action: "review",
                          reviewNotes: form.reviewNotes,
                        })
                      }
                    >
                      <Text style={styles.secondaryButtonText}>Mark reviewing</Text>
                    </Pressable>

                    <Pressable
                      disabled={submitting}
                      style={[styles.secondaryButton, styles.rejectButton, submitting && styles.disabledButton]}
                      onPress={() =>
                        confirmAndRunAction(activeSuggestion.id, {
                          action: "reject",
                          reviewNotes: form.reviewNotes,
                        })
                      }
                    >
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </Pressable>
                  </View>

                  <Pressable style={styles.clearButton} onPress={resetSelection}>
                    <Text style={styles.clearButtonText}>Clear selection</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  pagePadding: {
    paddingHorizontal: 18,
    gap: 16,
  },
  centeredScreen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 18,
  },
  loadingCenteredScreen: {
    justifyContent: "center",
  },
  lockedCard: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  lockedTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  lockedBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    color: "#475569",
  },
  heroCard: {
    backgroundColor: "#0F172A",
    borderRadius: 28,
    padding: 20,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#67E8F9",
  },
  heroTitle: {
    marginTop: 10,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  heroBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    color: "#CBD5E1",
  },
  panel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: "#0EA5E9",
    borderColor: "#0EA5E9",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "capitalize",
    color: "#334155",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  panelHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  refreshButton: {
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refreshButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0369A1",
  },
  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    padding: 14,
  },
  loadingText: {
    fontSize: 14,
    color: "#475569",
  },
  errorCard: {
    borderRadius: 18,
    backgroundColor: "#FEF2F2",
    padding: 14,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#B91C1C",
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    backgroundColor: "#F8FAFC",
    padding: 16,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748B",
  },
  suggestionList: {
    gap: 12,
  },
  suggestionCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 8,
  },
  suggestionCardSelected: {
    borderColor: "#0EA5E9",
    backgroundColor: "#F0F9FF",
  },
  suggestionTopRow: {
    gap: 10,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  idBadge: {
    borderRadius: 999,
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  idBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0369A1",
  },
  statusBadge: {
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "capitalize",
    color: "#334155",
  },
  coordinatesText: {
    fontSize: 12,
    color: "#475569",
  },
  suggestionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  suggestionMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: "#64748B",
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  metricText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F766E",
  },
  reviewNotesPreview: {
    fontSize: 13,
    lineHeight: 19,
    color: "#475569",
  },
  formStack: {
    gap: 12,
  },
  selectionCard: {
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    padding: 14,
  },
  selectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  selectionMeta: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748B",
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
  },
  inlineRow: {
    flexDirection: "row",
    gap: 12,
  },
  inlineInput: {
    flex: 1,
  },
  textarea: {
    minHeight: 92,
  },
  actionStack: {
    gap: 10,
    marginTop: 6,
  },
  actionButton: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  approveButton: {
    backgroundColor: "#10B981",
  },
  approveButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#052E16",
  },
  inlineActions: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  rejectButton: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
  },
  rejectButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#B91C1C",
  },
  clearButton: {
    alignSelf: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  disabledButton: {
    opacity: 0.6,
  },
});
