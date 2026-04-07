import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowUpRight,
  LogOut,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  User,
} from "lucide-react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import useUser from "@/utils/auth/useUser";
import { useAuth } from "@/utils/auth/useAuth";

const PROFILE_TIERS = [
  {
    threshold: 0,
    label: "Curb Scout",
    caption: "Starter",
    backgroundColor: "#E0F2FE",
    borderColor: "#7DD3FC",
    textColor: "#0F172A",
    iconColor: "#EAB308",
    shellColor: "#1D4ED8",
    glowColor: "rgba(59, 130, 246, 0.14)",
    accentColor: "#38BDF8",
    heroGradient: ["#082F49", "#0F4C81", "#0EA5E9"],
    iconSize: 16,
    shine: false,
  },
  {
    threshold: 25,
    label: "Street Spotter",
    caption: "Active",
    backgroundColor: "#FEF3C7",
    borderColor: "#FCD34D",
    textColor: "#0F172A",
    iconColor: "#F59E0B",
    shellColor: "#9A3412",
    glowColor: "rgba(245, 158, 11, 0.14)",
    accentColor: "#FBBF24",
    heroGradient: ["#4C0519", "#9A3412", "#FB923C"],
    iconSize: 17,
    shine: false,
  },
  {
    threshold: 75,
    label: "Block Ranger",
    caption: "Rising",
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC",
    textColor: "#0F172A",
    iconColor: "#F59E0B",
    shellColor: "#0F766E",
    glowColor: "rgba(16, 185, 129, 0.18)",
    accentColor: "#34D399",
    heroGradient: ["#052E2B", "#0F766E", "#2DD4BF"],
    iconSize: 18,
    shine: false,
  },
  {
    threshold: 200,
    label: "Flow Keeper",
    caption: "Elite",
    backgroundColor: "#DBEAFE",
    borderColor: "#93C5FD",
    textColor: "#0F172A",
    iconColor: "#F59E0B",
    shellColor: "#0B1F33",
    glowColor: "rgba(59, 130, 246, 0.22)",
    accentColor: "#10B981",
    heroGradient: ["#0B1020", "#1D4ED8", "#38BDF8"],
    iconSize: 20,
    shine: true,
  },
  {
    threshold: 500,
    label: "City Sentinel",
    caption: "Legendary",
    backgroundColor: "#ECFEFF",
    borderColor: "#7DD3FC",
    textColor: "#0F172A",
    iconColor: "#F59E0B",
    shellColor: "#082032",
    glowColor: "rgba(251, 191, 36, 0.28)",
    accentColor: "#38BDF8",
    heroGradient: ["#020617", "#0F766E", "#67E8F9"],
    iconSize: 22,
    shine: true,
  },
];

const PLAYBOOK_ITEMS = [
  {
    points: "+5",
    title: "Report a spot",
    detail: "Add clean parking intel for the next driver.",
    accent: "#0EA5E9",
  },
  {
    points: "+10",
    title: "Get your report claimed",
    detail: "Useful reports earn the biggest reputation jump.",
    accent: "#14B8A6",
  },
  {
    points: "+2",
    title: "Claim an opening",
    detail: "Confirm availability and keep the map moving.",
    accent: "#F59E0B",
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

const getInitials = (name) => {
  const safeName = String(name || "ParkMate User").trim();

  return safeName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "PM";
};

const getProfileBadgeMeta = (points) => {
  const numericPoints = Number(points) || 0;

  for (let index = PROFILE_TIERS.length - 1; index >= 0; index -= 1) {
    if (numericPoints >= PROFILE_TIERS[index].threshold) {
      return PROFILE_TIERS[index];
    }
  }

  return PROFILE_TIERS[0];
};

const getNextTierMeta = (points) => {
  const numericPoints = Number(points) || 0;
  return PROFILE_TIERS.find((tier) => numericPoints < tier.threshold) || null;
};

const getTierProgress = (points) => {
  const numericPoints = Math.max(0, Number(points) || 0);
  const currentTier = getProfileBadgeMeta(numericPoints);
  const nextTier = getNextTierMeta(numericPoints);

  if (!nextTier) {
    return {
      progress: 1,
      currentFloor: currentTier.threshold,
      nextThreshold: currentTier.threshold,
      pointsRemaining: 0,
    };
  }

  const currentFloor = currentTier.threshold;
  const nextThreshold = nextTier.threshold;
  const span = Math.max(1, nextThreshold - currentFloor);
  const progress = Math.min(1, Math.max(0, (numericPoints - currentFloor) / span));

  return {
    progress,
    currentFloor,
    nextThreshold,
    pointsRemaining: Math.max(0, nextThreshold - numericPoints),
  };
};

function MetricCard({
  label,
  value,
  note,
  accent,
  icon: Icon,
  dark = false,
  compact = false,
  mini = false,
}) {
  return (
    <View
      style={[
        styles.metricCard,
        dark && styles.metricCardDark,
        compact && styles.metricCardCompact,
        mini && styles.metricCardMini,
      ]}
    >
      <View style={[styles.metricHeaderRow, mini && styles.metricHeaderRowMini]}>
        <View
          style={[
            styles.metricIconWrap,
            compact && styles.metricIconWrapCompact,
            mini && styles.metricIconWrapMini,
            { backgroundColor: dark ? "rgba(255,255,255,0.14)" : "#E0F2FE" },
          ]}
        >
          <Icon size={mini ? 15 : compact ? 16 : 18} color={accent} />
        </View>
        <Text
          style={[
            styles.metricValue,
            dark && styles.metricValueDark,
            compact && styles.metricValueCompact,
            mini && styles.metricValueMini,
          ]}
        >
          {value}
        </Text>
      </View>
      <Text
        style={[
          styles.metricLabel,
          dark && styles.metricLabelDark,
          compact && styles.metricLabelCompact,
          mini && styles.metricLabelMini,
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.metricNote,
          dark && styles.metricNoteDark,
          compact && styles.metricNoteCompact,
          mini && styles.metricNoteMini,
        ]}
      >
        {note}
      </Text>
    </View>
  );
}

function PlaybookCard({ item }) {
  return (
    <View style={styles.playbookCard}>
      <View style={[styles.playbookPointsBubble, { backgroundColor: `${item.accent}1A` }]}>
        <Text style={[styles.playbookPointsText, { color: item.accent }]}>{item.points}</Text>
      </View>

      <View style={styles.playbookCopy}>
        <Text style={styles.playbookTitle}>{item.title}</Text>
        <Text style={styles.playbookDetail}>{item.detail}</Text>
      </View>

      <View style={[styles.playbookArrowWrap, { borderColor: `${item.accent}33` }]}>
        <ArrowUpRight size={16} color={item.accent} />
      </View>
    </View>
  );
}

function ProfileRankBadge({ badge }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const floatY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!badge?.shine) {
      pulse.stopAnimation();
      drift.stopAnimation();
      pulse.setValue(0);
      drift.setValue(0);
      return;
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    pulseLoop.start();
    driftLoop.start();

    return () => {
      pulseLoop.stop();
      driftLoop.stop();
    };
  }, [badge, drift, pulse]);

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -3,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    floatLoop.start();
    return () => floatLoop.stop();
  }, [floatY]);

  const glowStyle = badge?.shine
    ? {
        opacity: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.35, 0.85],
        }),
        transform: [
          {
            scale: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.94, 1.16],
            }),
          },
        ],
      }
    : null;

  const sparkleStyle = badge?.shine
    ? {
        transform: [
          {
            translateY: drift.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -3],
            }),
          },
        ],
      }
    : null;

  return (
    <Animated.View
      style={[
        styles.profileBadge,
        {
          backgroundColor: badge.backgroundColor,
          borderColor: badge.borderColor,
          transform: [{ translateY: floatY }],
        },
      ]}
    >
      <View
        style={[
          styles.profileBadgeIconWrap,
          { backgroundColor: badge.shellColor },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.profileBadgeGlow,
            { backgroundColor: badge.glowColor },
            glowStyle,
          ]}
        />
        <Trophy size={badge.iconSize} color={badge.iconColor} />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.profileBadgeSparkle,
            {
              backgroundColor: badge.accentColor,
              opacity: badge.shine ? 1 : 0.82,
            },
            sparkleStyle,
          ]}
        />
      </View>

      <View style={styles.profileBadgeContent}>
        <Text style={[styles.profileBadgeCaption, { color: badge.textColor }]}>
          {badge.caption}
        </Text>
        <Text style={[styles.profileBadgeText, { color: badge.textColor }]}>
          {badge.label}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data: authUser } = useUser();
  const { session, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const heroDrift = useRef(new Animated.Value(0)).current;
  const userId = authUser?.id || null;
  const canUseProfileApi = Boolean(userId && session?.access_token);

  useEffect(() => {
    const orbitLoop = Animated.loop(
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

    orbitLoop.start();
    return () => orbitLoop.stop();
  }, [heroDrift]);

  const { data: profileData, isLoading } = useQuery({
    queryKey: ["user_profile", userId],
    queryFn: async () => {
      const response = await fetch("/api/users/profile");
      if (!response.ok) throw new Error("Failed to fetch profile");
      const result = await response.json();
      return result.user;
    },
    enabled: canUseProfileApi,
  });

  const fallbackName = authUser?.name || getEmailDisplayName(authUser?.email) || "ParkMate User";

  const profile = profileData || {
    full_name: fallbackName,
    email: authUser?.email || "No email",
    contribution_score: 0,
    total_reports: 0,
    total_claims: 0,
  };

  const points = Number(profile?.contribution_score) || 0;
  const totalReports = Number(profile?.total_reports) || 0;
  const totalClaims = Number(profile?.total_claims) || 0;
  const profileBadge = getProfileBadgeMeta(points);
  const nextTier = getNextTierMeta(points);
  const tierProgress = getTierProgress(points);
  const progressWidth = `${Math.max(6, Math.round(tierProgress.progress * 100))}%`;

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    try {
      await signOut();
      qc.clear();
    } catch (error) {
      Alert.alert("Error", error?.message || "Failed to sign out");
      setIsSigningOut(false);
    }
  };

  if (!profileData && !authUser && isLoading && canUseProfileApi) {
    return (
      <View style={[styles.loadingScreen, { paddingTop: insets.top + 24 }]}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="small" color="#38BDF8" />
          <Text style={styles.loadingTitle}>Building your street profile</Text>
          <Text style={styles.loadingText}>Pulling the latest activity and rank data.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: insets.top + 14,
        paddingBottom: insets.bottom + 104,
      }}
    >
      <View style={styles.pagePadding}>
        <LinearGradient
          colors={profileBadge.heroGradient}
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
                      outputRange: [0, -14],
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
                      outputRange: [0, 8],
                    }),
                  },
                ],
              },
            ]}
          />

          <View style={styles.heroTopRow}>
            <View style={styles.heroEyebrow}>
              <Sparkles size={14} color="#E0F2FE" />
              <Text style={styles.heroEyebrowText}>Street Profile</Text>
            </View>
            <View style={styles.heroPointsPill}>
              <Text style={styles.heroPointsLabel}>Impact</Text>
              <Text style={styles.heroPointsValue}>{formatNumber(points)}</Text>
            </View>
          </View>

          <View style={styles.heroIdentityRow}>
            <LinearGradient
              colors={["rgba(255,255,255,0.9)", "rgba(255,255,255,0.18)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarRing}
            >
              <View style={styles.avatarCore}>
                <Text style={styles.avatarInitials}>{getInitials(profile?.full_name)}</Text>
              </View>
            </LinearGradient>

            <View style={styles.identityCopy}>
              <Text style={styles.heroName}>{profile?.full_name || fallbackName || "Anonymous User"}</Text>
              <Text style={styles.heroEmail}>{profile?.email || "No email"}</Text>
              <View style={styles.heroBadgeRow}>
                <ProfileRankBadge badge={profileBadge} />
              </View>
            </View>
          </View>

          <Text style={styles.heroSubhead}>
            ParkMate reads your contribution style as{" "}
            <Text style={styles.heroSubheadStrong}>{profileBadge.label}</Text>.
          </Text>

          <View style={styles.heroMetricsRow}>
            <MetricCard
              dark
              compact
              label="Reports"
              value={formatNumber(totalReports)}
              note="signals dropped"
              icon={MapPin}
              accent="#7DD3FC"
            />
            <MetricCard
              dark
              compact
              label="Claims"
              value={formatNumber(totalClaims)}
              note="openings captured"
              icon={Star}
              accent="#FCD34D"
            />
          </View>
        </LinearGradient>

        <View style={[styles.panel, styles.progressionPanelCard]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionEyebrow}>Progression</Text>
              <Text style={[styles.sectionTitle, styles.progressionSectionTitle]}>
                Next reputation unlock
              </Text>
            </View>
            <View style={[styles.sectionChip, styles.progressionSectionChip]}>
              <ShieldCheck size={14} color="#0F766E" />
              <Text style={[styles.sectionChipText, styles.progressionSectionChipText]}>
                {nextTier ? `${tierProgress.pointsRemaining} to go` : "Top tier"}
              </Text>
            </View>
          </View>

          <View style={[styles.progressPanel, styles.progressPanelCompact]}>
          <View style={styles.progressLabels}>
            <View>
                <Text style={styles.progressCurrentLabel}>{profileBadge.caption}</Text>
                <Text style={[styles.progressCurrentValue, styles.progressCurrentValueCompact]}>
                  {profileBadge.label}
                </Text>
              </View>
              <View style={styles.progressTargetWrap}>
                <Text style={styles.progressTargetLabel}>Next</Text>
                <Text style={[styles.progressTargetValue, styles.progressTargetValueCompact]}>
                  {nextTier ? nextTier.label : "All unlocked"}
                </Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <LinearGradient
                colors={["#0EA5E9", "#14B8A6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: progressWidth }]}
              />
            </View>

            <View style={[styles.progressFootRow, styles.progressFootRowCompact]}>
              <Text style={[styles.progressFootText, styles.progressFootTextCompact]}>
                {formatNumber(points)} pts
              </Text>
              <Text style={[styles.progressFootText, styles.progressFootTextCompact]}>
                {formatNumber(tierProgress.nextThreshold)} pts
              </Text>
            </View>
          </View>

          <View style={[styles.summaryGrid, styles.summaryGridCompact]}>
            <MetricCard
              mini
              label="Current rank"
              value={profileBadge.caption}
              note="your live tier"
              icon={Trophy}
              accent="#0EA5E9"
            />
            <MetricCard
              mini
              label="Impact score"
              value={formatNumber(points)}
              note="community reputation"
              icon={Sparkles}
              accent="#14B8A6"
            />
            <MetricCard
              mini
              label="Report mix"
              value={totalReports >= totalClaims ? "Scout-led" : "Claim-led"}
              note="how you usually contribute"
              icon={User}
              accent="#F59E0B"
            />
          </View>
        </View>

        <View style={[styles.panel, styles.playbookPanelCard]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionEyebrow}>Playbook</Text>
              <Text style={[styles.sectionTitle, styles.playbookSectionTitle]}>
                Fastest ways to climb
              </Text>
            </View>
          </View>

          <View style={[styles.playbookStack, styles.playbookStackCompact]}>
            {PLAYBOOK_ITEMS.map((item) => (
              <PlaybookCard key={item.title} item={item} />
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.signOutButton, isSigningOut && styles.signOutButtonDisabled]}
          onPress={handleSignOut}
          disabled={isSigningOut}
        >
          <LinearGradient
            colors={["#0F172A", "#1E293B"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.signOutGradient}
          >
            <LogOut size={17} color="#E2E8F0" />
            <Text style={styles.signOutButtonText}>
              {isSigningOut ? "Signing out..." : "Sign out"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F4FBFF",
  },
  pagePadding: {
    paddingHorizontal: 16,
    gap: 16,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: "#F4FBFF",
    paddingHorizontal: 16,
  },
  loadingCard: {
    backgroundColor: "#0F172A",
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    gap: 10,
  },
  loadingTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "800",
  },
  loadingText: {
    color: "#CBD5E1",
    fontSize: 14,
    textAlign: "center",
  },
  heroCard: {
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  heroOrbLarge: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    top: -70,
    right: -60,
  },
  heroOrbSmall: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    bottom: 52,
    left: -22,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  heroEyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  heroEyebrowText: {
    color: "#F8FAFC",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  heroPointsPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "rgba(2,6,23,0.24)",
    alignItems: "center",
  },
  heroPointsLabel: {
    color: "rgba(226,232,240,0.72)",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  heroPointsValue: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },
  heroIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarRing: {
    width: 80,
    height: 80,
    borderRadius: 999,
    padding: 2,
  },
  avatarCore: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    color: "#0F172A",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroName: {
    color: "#F8FAFC",
    fontSize: 21,
    fontWeight: "900",
  },
  heroEmail: {
    color: "rgba(226,232,240,0.78)",
    fontSize: 13,
    marginTop: 3,
  },
  heroBadgeRow: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
  profileBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    shadowColor: "#020617",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  profileBadgeIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  profileBadgeGlow: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  profileBadgeSparkle: {
    position: "absolute",
    top: -1,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  profileBadgeContent: {
    justifyContent: "center",
    flexShrink: 1,
  },
  profileBadgeCaption: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    opacity: 0.84,
    marginBottom: 1,
  },
  profileBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  heroSubhead: {
    marginTop: 12,
    color: "rgba(226,232,240,0.8)",
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 280,
  },
  heroSubheadStrong: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  heroMetricsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  panel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: "#D9F2FF",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },
  progressionPanelCard: {
    borderRadius: 21,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  playbookPanelCard: {
    borderRadius: 22,
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  sectionEyebrow: {
    color: "#0EA5E9",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 26,
  },
  progressionSectionTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  playbookSectionTitle: {
    fontSize: 18,
    lineHeight: 23,
  },
  sectionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#ECFDF5",
  },
  progressionSectionChip: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  sectionChipText: {
    color: "#0F766E",
    fontSize: 12,
    fontWeight: "800",
  },
  progressionSectionChipText: {
    fontSize: 10,
  },
  progressPanel: {
    marginTop: 18,
    backgroundColor: "#F8FCFF",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#D9F2FF",
  },
  progressPanelCompact: {
    marginTop: 12,
    borderRadius: 17,
    paddingHorizontal: 11,
    paddingVertical: 11,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  progressCurrentLabel: {
    color: "#0EA5E9",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  progressCurrentValue: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  progressCurrentValueCompact: {
    fontSize: 15,
  },
  progressTargetWrap: {
    alignItems: "flex-end",
  },
  progressTargetLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  progressTargetValue: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
    textAlign: "right",
  },
  progressTargetValueCompact: {
    fontSize: 13,
  },
  progressTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: "#DCEFFD",
    overflow: "hidden",
    marginTop: 16,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    minWidth: 14,
  },
  progressFootRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  progressFootRowCompact: {
    marginTop: 7,
  },
  progressFootText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
  },
  progressFootTextCompact: {
    fontSize: 10,
  },
  summaryGrid: {
    marginTop: 14,
    gap: 10,
  },
  summaryGridCompact: {
    marginTop: 10,
    gap: 7,
  },
  metricCard: {
    backgroundColor: "#F8FCFF",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#D9F2FF",
  },
  metricCardDark: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.14)",
  },
  metricCardCompact: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  metricCardMini: {
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  metricHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  metricHeaderRowMini: {
    gap: 6,
    marginBottom: 5,
  },
  metricIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  metricIconWrapCompact: {
    width: 26,
    height: 26,
    borderRadius: 9,
    marginBottom: 0,
  },
  metricIconWrapMini: {
    width: 24,
    height: 24,
    borderRadius: 8,
    marginBottom: 0,
  },
  metricValue: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "900",
  },
  metricValueMini: {
    fontSize: 16,
  },
  metricValueCompact: {
    fontSize: 19,
  },
  metricValueDark: {
    color: "#FFFFFF",
  },
  metricLabel: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 3,
  },
  metricLabelMini: {
    fontSize: 10,
    marginTop: 1,
  },
  metricLabelDark: {
    color: "#F8FAFC",
  },
  metricNote: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
  metricNoteMini: {
    fontSize: 10,
    marginTop: 3,
    lineHeight: 13,
  },
  metricLabelCompact: {
    fontSize: 11,
    marginTop: 2,
  },
  metricNoteCompact: {
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15,
  },
  metricNoteDark: {
    color: "rgba(226,232,240,0.74)",
  },
  playbookStack: {
    marginTop: 18,
    gap: 12,
  },
  playbookStackCompact: {
    marginTop: 14,
    gap: 10,
  },
  playbookCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F8FCFF",
    borderRadius: 17,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#D9F2FF",
  },
  playbookPointsBubble: {
    minWidth: 52,
    paddingHorizontal: 9,
    paddingVertical: 10,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  playbookPointsText: {
    fontSize: 16,
    fontWeight: "900",
  },
  playbookCopy: {
    flex: 1,
  },
  playbookTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
  },
  playbookDetail: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  playbookArrowWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  signOutButton: {
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 5,
  },
  signOutButtonDisabled: {
    opacity: 0.78,
  },
  signOutGradient: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  signOutButtonText: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "800",
  },
});
