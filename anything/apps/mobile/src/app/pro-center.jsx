import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowUpRight,
  ChevronLeft,
  Mail,
  Radar,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TimerReset,
} from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";

import fetch from "@/__create/fetch";
import { useAuth } from "@/utils/auth/useAuth";
import useUser from "@/utils/auth/useUser";
import { resolveBackendUrl } from "@/utils/backend";
import {
  fetchLeaderboardQuery,
  LEADERBOARD_QUERY_KEY,
} from "@/hooks/useLeaderboardVersion";
import { useProAccess } from "@/hooks/useProAccess";
import { BRAND_PALETTE } from "@/theme/brandColors";

const SUPPORT_EMAIL = "support@parkmate.com";

const PRO_FEATURES = [
  {
    icon: Radar,
    title: "Pro radar controls",
    body: "Wider radius presets and a sharper local feed when you need to search farther out.",
  },
  {
    icon: Sparkles,
    title: "Best chance intelligence",
    body: "Prioritize fresher, stronger signals without hiding the base map or nearby reports.",
  },
  {
    icon: TimerReset,
    title: "Reminder patterns",
    body: "Use a reminder setup that matches the length of the stay instead of one generic timer flow.",
  },
  {
    icon: ShieldCheck,
    title: "Private profile insights",
    body: "See claim conversion, impact per report, and progress pacing in one focused view.",
  },
];

const RECOS = [
  {
    title: "Default radar",
    value: "500m",
    detail: "A wider view without making the feed feel noisy.",
  },
  {
    title: "Sort mode",
    value: "Best chance",
    detail: "Use the premium ranking whenever you want the strongest openings first.",
  },
  {
    title: "Reminder preset",
    value: "20/10",
    detail: "A practical setup for most parking sessions.",
  },
];

const ACTIONS = [
  {
    icon: RefreshCw,
    title: "Restore access",
    detail: "Resync your entitlement from the store if it does not appear on this device.",
  },
  {
    icon: Mail,
    title: "Contact support",
    detail: "Reach the team if you need help with activation or billing history.",
  },
];

const formatNumber = (value) => {
  const numeric = Number(value) || 0;
  return numeric.toLocaleString();
};

const getEmailDisplayName = (email) => {
  if (typeof email !== "string") {
    return null;
  }

  const [localPart] = email.trim().split("@");
  return localPart || null;
};

function StatPill({ label, value, note }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statNote}>{note}</Text>
    </View>
  );
}

function FeatureRow({ item }) {
  const Icon = item.icon;

  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIconWrap}>
        <Icon size={18} color={BRAND_PALETTE.accentBold} />
      </View>
      <View style={styles.featureCopy}>
        <Text style={styles.featureTitle}>{item.title}</Text>
        <Text style={styles.featureBody}>{item.body}</Text>
      </View>
    </View>
  );
}

function ActionCard({ item, onPress }) {
  const Icon = item.icon;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={styles.actionCard}>
      <View style={styles.actionIconWrap}>
        <Icon size={18} color={BRAND_PALETTE.accentBold} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{item.title}</Text>
        <Text style={styles.actionDetail}>{item.detail}</Text>
      </View>
      <View style={styles.actionArrowWrap}>
        <ArrowUpRight size={16} color={BRAND_PALETTE.accentBold} />
      </View>
    </TouchableOpacity>
  );
}

export default function ProCenterScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { data: authUser } = useUser();
  const heroDrift = useRef(new Animated.Value(0)).current;
  const {
    hasPro,
    isConfigured,
    isLoading,
    proPriceLabel,
    presentPaywall,
    restorePurchases,
    refreshServerAccess,
  } = useProAccess();

  const userId = authUser?.id || null;
  const canUseProfileApi = Boolean(userId && session?.access_token);
  const profileUrl = resolveBackendUrl("/api/users/profile");
  const leaderboardLimit = 100;

  useEffect(() => {
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(heroDrift, {
          toValue: 1,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(heroDrift, {
          toValue: 0,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    driftLoop.start();
    return () => driftLoop.stop();
  }, [heroDrift]);

  const { data: profileData } = useQuery({
    queryKey: ["pro_center_profile", userId],
    queryFn: async () => {
      if (!profileUrl) {
        throw new Error("Profile backend URL is not configured");
      }

      const response = await fetch(profileUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch profile");
      }

      const result = await response.json();
      return result.user;
    },
    enabled: canUseProfileApi && Boolean(profileUrl),
  });

  useEffect(() => {
    if (!canUseProfileApi || !profileData) {
      return;
    }

    refreshServerAccess().catch(() => null);
  }, [canUseProfileApi, profileData, refreshServerAccess]);

  const { data: leaderboardData } = useQuery({
    queryKey: [...LEADERBOARD_QUERY_KEY, leaderboardLimit, "pro-center-rank"],
    queryFn: () => fetchLeaderboardQuery(leaderboardLimit),
    enabled: canUseProfileApi,
    staleTime: Infinity,
    refetchInterval: false,
    refetchOnMount: false,
    retry: false,
  });

  const fallbackName = authUser?.name || getEmailDisplayName(authUser?.email) || "ParkMate User";
  const profile = profileData || {
    full_name: fallbackName,
    email: authUser?.email || "No email",
    contribution_score: 0,
    leaderboard_rank: null,
    ranked_count: 0,
    total_reports: 0,
    total_claims: 0,
  };

  const points = Number(profile?.contribution_score) || 0;
  const totalReports = Number(profile?.total_reports) || 0;
  const totalClaims = Number(profile?.total_claims) || 0;
  const claimConversionRate =
    totalReports > 0 ? Math.min(100, Math.round((totalClaims / totalReports) * 100)) : 0;
  const impactPerReport = totalReports > 0 ? (points / totalReports).toFixed(1) : "0.0";
  const rankedCount = Number(profile?.ranked_count) || (Array.isArray(leaderboardData) ? leaderboardData.length : 0);
  const leaderboardRankFromProfile = Number.isFinite(Number(profile?.leaderboard_rank))
    ? Number(profile.leaderboard_rank)
    : null;
  const leaderboardRankFromList =
    Array.isArray(leaderboardData) && userId
      ? leaderboardData.findIndex((entry) => entry?.id === userId) + 1 || null
      : null;
  const leaderboardRank = leaderboardRankFromProfile || leaderboardRankFromList || null;

  const proStateLabel = hasPro ? "Active" : "Available";
  const proHeadline = hasPro
    ? "Your premium mode is live."
    : "One payment unlocks a better parking experience for life.";
  const proCopy = hasPro
    ? "ParkMate Pro is active on this account. Use the center below to review your premium setup, restore access, or jump back to the paywall from a single place."
    : "Unlock premium radar controls, smarter signal sorting, reminder presets, and deeper profile insight without a subscription.";

  const handleSupportPress = async () => {
    try {
      const subject = encodeURIComponent("ParkMate Pro support");
      const body = encodeURIComponent("Hi ParkMate team,\n\nI need help with Pro access.");
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
    } catch (error) {
      // No-op: the card is informational even if the mail app is unavailable.
    }
  };

  const handleUnlockPress = () => {
    presentPaywall("profile_membership");
  };

  const handleRestorePress = () => {
    restorePurchases().catch(() => null);
  };

  const statusChipStyle = hasPro ? styles.statusChipActive : styles.statusChipInactive;

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={["#04111B", "#081A2B", "#0B3556"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroBackplate}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 28,
        }}
      >
        <View style={styles.pagePadding}>
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <ChevronLeft size={18} color={BRAND_PALETTE.surface} />
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <View style={[styles.statusChip, statusChipStyle]}>
              <Text style={styles.statusChipText}>{proStateLabel}</Text>
            </View>
          </View>

          <LinearGradient
            colors={["rgba(125,211,252,0.16)", "rgba(2,132,199,0.22)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.heroOrbLarge,
                {
                  transform: [
                    {
                      translateY: heroDrift.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -10],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.heroOrbSmall,
                {
                  transform: [
                    {
                      translateX: heroDrift.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 10],
                      }),
                    },
                  ],
                },
              ]}
            />

            <Text style={styles.heroEyebrow}>PRO CENTER</Text>
            <Text style={styles.heroTitle}>ParkMate Pro</Text>
            <Text style={styles.heroHeadline}>{proHeadline}</Text>
            <Text style={styles.heroCopy}>{proCopy}</Text>

            <View style={styles.heroActionRow}>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={hasPro ? handleRestorePress : handleUnlockPress}
                style={styles.primaryButton}
              >
                <LinearGradient
                  colors={hasPro ? ["#0F766E", "#0284C7"] : ["#0B3556", "#0284C7"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryButtonGradient}
                >
                  <Text style={styles.primaryButtonText}>
                    {hasPro ? "Restore access" : `Unlock for ${proPriceLabel || "A$19.99"}`}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.86}
                onPress={handleRestorePress}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Restore purchases</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEyebrow}>Snapshot</Text>
              <Text style={styles.sectionTitle}>Account and impact</Text>
            </View>

            <View style={styles.statGrid}>
              <StatPill label="Impact" value={formatNumber(points)} note="profile score" />
              <StatPill label="Claim rate" value={`${claimConversionRate}%`} note="reports claimed" />
              <StatPill
                label="Rank"
                value={leaderboardRank ? `#${leaderboardRank}` : "—"}
                note={rankedCount ? `${formatNumber(rankedCount)} ranked` : "not ranked yet"}
              />
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEyebrow}>Unlocked</Text>
              <Text style={styles.sectionTitle}>What Pro changes</Text>
            </View>

            <View style={styles.featureStack}>
              {PRO_FEATURES.map((item) => (
                <FeatureRow key={item.title} item={item} />
              ))}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEyebrow}>Recommended</Text>
              <Text style={styles.sectionTitle}>Best first setup</Text>
            </View>

            <View style={styles.recoStack}>
              {RECOS.map((item) => (
                <View key={item.title} style={styles.recoCard}>
                  <Text style={styles.recoTitle}>{item.title}</Text>
                  <Text style={styles.recoValue}>{item.value}</Text>
                  <Text style={styles.recoDetail}>{item.detail}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEyebrow}>Access</Text>
              <Text style={styles.sectionTitle}>Manage Pro</Text>
            </View>

            <View style={styles.actionStack}>
              <ActionCard
                item={ACTIONS[0]}
                onPress={handleRestorePress}
              />
              <ActionCard
                item={ACTIONS[1]}
                onPress={handleSupportPress}
              />
            </View>
          </View>

          <View style={styles.footerCard}>
            <Text style={styles.footerLabel}>Lifetime upgrade</Text>
            <Text style={styles.footerTitle}>
              {hasPro ? "Pro is active on this account." : "No subscription. One purchase. Permanent access."}
            </Text>
            <Text style={styles.footerCopy}>
              {hasPro
                ? "If you sign in on a new device, use Restore purchases and the account will re-sync."
                : "You can unlock from here, then the app will keep the Pro experience tied to your account."}
            </Text>
            <TouchableOpacity
              activeOpacity={0.88}
              disabled={!isConfigured && !hasPro}
              onPress={hasPro ? handleRestorePress : handleUnlockPress}
              style={[
                styles.footerButton,
                !isConfigured && !hasPro && styles.footerButtonDisabled,
              ]}
            >
              {isLoading && !hasPro ? (
                <ActivityIndicator color={BRAND_PALETTE.surface} />
              ) : (
                <Text style={styles.footerButtonText}>
                  {hasPro ? "Refresh access" : `Open paywall`}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#071421",
  },
  heroBackplate: {
    ...StyleSheet.absoluteFillObject,
    height: 260,
  },
  pagePadding: {
    paddingHorizontal: 16,
    gap: 14,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  backButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    paddingVertical: 6,
    paddingRight: 10,
  },
  backButtonText: {
    color: BRAND_PALETTE.surface,
    fontSize: 14,
    fontWeight: "700",
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusChipActive: {
    backgroundColor: "rgba(16, 185, 129, 0.18)",
    borderColor: "rgba(16, 185, 129, 0.42)",
    borderWidth: 1,
  },
  statusChipInactive: {
    backgroundColor: "rgba(125, 211, 252, 0.14)",
    borderColor: "rgba(125, 211, 252, 0.35)",
    borderWidth: 1,
  },
  statusChipText: {
    color: BRAND_PALETTE.surface,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  heroCard: {
    borderRadius: 28,
    overflow: "hidden",
    padding: 20,
    position: "relative",
  },
  heroOrbLarge: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    height: 220,
    position: "absolute",
    right: -100,
    top: -110,
    width: 220,
  },
  heroOrbSmall: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    bottom: -50,
    height: 110,
    left: -30,
    position: "absolute",
    width: 110,
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  heroTitle: {
    color: BRAND_PALETTE.surface,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  heroHeadline: {
    color: BRAND_PALETTE.surface,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
    marginTop: 8,
  },
  heroCopy: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  heroActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  primaryButton: {
    flex: 1,
  },
  primaryButtonGradient: {
    alignItems: "center",
    borderRadius: 16,
    minHeight: 50,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: BRAND_PALETTE.surface,
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: BRAND_PALETTE.surface,
    fontSize: 14,
    fontWeight: "800",
  },
  sectionCard: {
    backgroundColor: "rgba(6, 18, 30, 0.94)",
    borderColor: "rgba(125, 211, 252, 0.14)",
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 3,
    gap: 14,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionEyebrow: {
    color: "#7DD3FC",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  sectionTitle: {
    color: BRAND_PALETTE.surface,
    fontSize: 18,
    fontWeight: "900",
  },
  statGrid: {
    flexDirection: "row",
    gap: 10,
  },
  statPill: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    padding: 14,
    gap: 2,
  },
  statValue: {
    color: BRAND_PALETTE.surface,
    fontSize: 20,
    fontWeight: "900",
  },
  statLabel: {
    color: "#7DD3FC",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statNote: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  featureStack: {
    gap: 12,
  },
  featureRow: {
    alignItems: "flex-start",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  featureIconWrap: {
    alignItems: "center",
    backgroundColor: "rgba(125,211,252,0.12)",
    borderRadius: 14,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  featureCopy: {
    flex: 1,
    gap: 3,
  },
  featureTitle: {
    color: BRAND_PALETTE.surface,
    fontSize: 14,
    fontWeight: "800",
  },
  featureBody: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    lineHeight: 19,
  },
  recoStack: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  recoCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    flexBasis: "48%",
    flexGrow: 1,
    gap: 4,
    padding: 14,
    minWidth: 140,
  },
  recoTitle: {
    color: "rgba(255,255,255,0.66)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  recoValue: {
    color: BRAND_PALETTE.surface,
    fontSize: 20,
    fontWeight: "900",
  },
  recoDetail: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    lineHeight: 16,
  },
  actionStack: {
    gap: 10,
  },
  actionCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  actionIconWrap: {
    alignItems: "center",
    backgroundColor: "rgba(125,211,252,0.12)",
    borderRadius: 14,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  actionCopy: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    color: BRAND_PALETTE.surface,
    fontSize: 14,
    fontWeight: "800",
  },
  actionDetail: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    lineHeight: 17,
  },
  actionArrowWrap: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  footerCard: {
    backgroundColor: BRAND_PALETTE.deepNavy,
    borderRadius: 24,
    gap: 8,
    padding: 18,
  },
  footerLabel: {
    color: "rgba(255,255,255,0.66)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  footerTitle: {
    color: BRAND_PALETTE.surface,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24,
  },
  footerCopy: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    lineHeight: 19,
  },
  footerButton: {
    alignItems: "center",
    backgroundColor: "#0284C7",
    borderRadius: 16,
    justifyContent: "center",
    minHeight: 50,
    marginTop: 8,
    paddingHorizontal: 16,
  },
  footerButtonDisabled: {
    opacity: 0.7,
  },
  footerButtonText: {
    color: BRAND_PALETTE.surface,
    fontSize: 14,
    fontWeight: "800",
  },
});
