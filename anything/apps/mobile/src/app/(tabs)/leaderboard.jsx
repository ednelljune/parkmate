import React from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Award,
  Medal,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";

import {
  fetchLeaderboardQuery,
  LEADERBOARD_QUERY_KEY,
  useLeaderboardVersion,
} from "@/hooks/useLeaderboardVersion";
import { BRAND_PALETTE } from "@/theme/brandColors";
import {
  getTrustBadgeMeta,
  normalizeTrustScore,
} from "@/utils/trustBadges";
import { resolveBackendUrl } from "@/utils/backend";

const PODIUM_META = {
  1: {
    label: "1st",
    title: "Champion",
    colors: ["#FBBF24", "#F59E0B"],
    glow: "rgba(245, 158, 11, 0.22)",
    icon: Trophy,
  },
  2: {
    label: "2nd",
    title: "Pacesetter",
    colors: ["#BFDBFE", "#60A5FA"],
    glow: "rgba(59, 130, 246, 0.18)",
    icon: Medal,
  },
  3: {
    label: "3rd",
    title: "Contender",
    colors: ["#C4B5FD", "#8B5CF6"],
    glow: "rgba(139, 92, 246, 0.18)",
    icon: Award,
  },
};

const INITIAL_LOAD_TIMEOUT_MS = 20000;

const formatNumber = (value) => {
  const numeric = Number(value) || 0;
  return numeric.toLocaleString();
};

const getInitials = (name) => {
  const safeName = String(name || "Anonymous").trim();
  if (!safeName) return "AN";

  return safeName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
};

const getSummaryStats = (users) => {
  if (!users.length) {
    return {
      rankedCount: 0,
      averageTrust: 0,
      totalReports: 0,
    };
  }

  const totals = users.reduce(
    (accumulator, user) => {
      accumulator.trust += normalizeTrustScore(user?.trust_score);
      accumulator.reports += Number(user?.total_reports) || 0;
      return accumulator;
    },
    { trust: 0, reports: 0 },
  );

  return {
    rankedCount: users.length,
    averageTrust: Math.round(totals.trust / users.length),
    totalReports: totals.reports,
  };
};

function SummaryChip({ label, value, accent }) {
  return (
    <View style={styles.summaryChip}>
      <View style={[styles.summaryChipAccent, { backgroundColor: accent }]} />
      <Text style={styles.summaryChipValue}>{value}</Text>
      <Text style={styles.summaryChipLabel}>{label}</Text>
    </View>
  );
}

function PodiumCard({ item, rank }) {
  const trustScore = normalizeTrustScore(item?.trust_score);
  const contributionScore = Number(item?.contribution_score) || 0;
  const badge = getTrustBadgeMeta(trustScore);
  const meta = PODIUM_META[rank];
  const Icon = meta.icon;
  const isChampion = rank === 1;

  return (
    <View
      style={[
        styles.podiumCardWrap,
        isChampion ? styles.podiumCardWrapChampion : styles.podiumCardWrapSide,
      ]}
    >
      <View
        style={[
          styles.podiumGlow,
          { backgroundColor: meta.glow },
          isChampion && styles.podiumGlowChampion,
        ]}
      />

      <LinearGradient
        colors={meta.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.podiumRankPill,
          isChampion && styles.podiumRankPillChampion,
        ]}
      >
        <Icon size={isChampion ? 16 : 14} color="#FFFFFF" />
        <Text style={styles.podiumRankPillText}>{meta.label}</Text>
      </LinearGradient>

      <View
        style={[
          styles.podiumCard,
          isChampion ? styles.podiumCardChampion : styles.podiumCardSide,
        ]}
      >
        <View
          style={[
            styles.avatarShell,
            isChampion && styles.avatarShellChampion,
            { borderColor: meta.colors[1] },
          ]}
        >
          <LinearGradient
            colors={["#FFFFFF", "#E2E8F0"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarCore}
          >
            <Text
              style={[
                styles.avatarText,
                isChampion && styles.avatarTextChampion,
              ]}
            >
              {getInitials(item?.full_name)}
            </Text>
          </LinearGradient>
        </View>

        <Text
          style={styles.podiumOverline}
          numberOfLines={1}
        >
          {meta.title}
        </Text>
        <Text
          style={styles.podiumName}
          numberOfLines={2}
        >
          {item?.full_name || "Anonymous"}
        </Text>

          <View
            style={[
              styles.badgeChip,
              isChampion ? styles.badgeChipChampion : styles.badgeChipCompact,
              {
                backgroundColor: badge.backgroundColor,
                borderColor: badge.borderColor,
              },
            ]}
          >
            <ShieldCheck size={isChampion ? 11 : 10} color={badge.iconColor} />
            <Text
              style={[
                styles.badgeChipText,
                isChampion ? styles.badgeChipTextChampion : styles.badgeChipTextCompact,
                { color: badge.textColor },
              ]}
            >
              {badge.label}
            </Text>
          </View>

          <View style={styles.podiumScoreRow}>
          <View
            style={[
              styles.podiumScoreBlock,
              isChampion ? styles.podiumScoreBlockChampion : styles.podiumScoreBlockCompact,
            ]}
          >
            <Text
              style={[
                styles.podiumScoreValue,
                isChampion ? styles.podiumScoreValueChampion : styles.podiumScoreValueCompact,
              ]}
            >
              {trustScore}
            </Text>
            <Text
              style={[
                styles.podiumScoreLabel,
                isChampion ? styles.podiumScoreLabelChampion : styles.podiumScoreLabelCompact,
              ]}
            >
              trust
            </Text>
          </View>
          <View style={styles.podiumDivider} />
          <View
            style={[
              styles.podiumScoreBlock,
              isChampion ? styles.podiumScoreBlockChampion : styles.podiumScoreBlockCompact,
            ]}
          >
            <Text
              style={[
                styles.podiumScoreValue,
                isChampion ? styles.podiumScoreValueChampion : styles.podiumScoreValueCompact,
              ]}
            >
              {contributionScore}
            </Text>
            <Text
              style={[
                styles.podiumScoreLabel,
                isChampion ? styles.podiumScoreLabelChampion : styles.podiumScoreLabelCompact,
              ]}
            >
              impact
            </Text>
          </View>
        </View>

        <Text style={styles.podiumFootnote}>
          {formatNumber(item?.total_reports)} reports | {formatNumber(item?.total_claims)}{" "}
          claimed
        </Text>
      </View>
    </View>
  );
}

function RankedRow({ item, rank }) {
  const trustScore = normalizeTrustScore(item?.trust_score);
  const contributionScore = Number(item?.contribution_score) || 0;
  const badge = getTrustBadgeMeta(trustScore);

  return (
    <View style={styles.rowCard}>
      <View style={styles.rowTop}>
        <View style={styles.rowIdentity}>
          <View style={styles.rankBadge}>
            <Text style={styles.rankBadgeText}>#{rank}</Text>
          </View>

          <View style={styles.rowNameWrap}>
            <Text style={styles.rowName} numberOfLines={1}>
              {item?.full_name || "Anonymous"}
            </Text>
            <View
              style={[
                styles.inlineBadge,
                {
                  backgroundColor: badge.backgroundColor,
                  borderColor: badge.borderColor,
                },
              ]}
            >
              <ShieldCheck size={11} color={badge.iconColor} />
              <Text style={[styles.inlineBadgeText, { color: badge.textColor }]}>
                {badge.caption}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.scoreOrb}>
          <Text style={styles.scoreOrbValue}>{trustScore}</Text>
          <Text style={styles.scoreOrbLabel}>trust</Text>
        </View>
      </View>

      <View style={styles.rowMetrics}>
        <View style={styles.metricPill}>
          <Text style={styles.metricValue}>{formatNumber(item?.total_reports)}</Text>
          <Text style={styles.metricLabel}>reports</Text>
        </View>
        <View style={styles.metricPill}>
          <Text style={styles.metricValue}>{formatNumber(item?.total_claims)}</Text>
          <Text style={styles.metricLabel}>claimed</Text>
        </View>
        <View style={[styles.metricPill, styles.metricPillAccent]}>
          <Text style={[styles.metricValue, styles.metricValueAccent]}>
            {formatNumber(contributionScore)}
          </Text>
          <Text style={[styles.metricLabel, styles.metricLabelAccent]}>impact</Text>
        </View>
      </View>
    </View>
  );
}

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const leaderboardLimit = 50;
  const leaderboardUrl = resolveBackendUrl(`/api/users/leaderboard?limit=${leaderboardLimit}`);
  const { refetch: refetchLeaderboardVersion } = useLeaderboardVersion(
    leaderboardLimit,
    Boolean(leaderboardUrl),
  );

  const { data, error, isError, isPending, refetch, isRefetching } = useQuery({
    queryKey: [...LEADERBOARD_QUERY_KEY, leaderboardLimit],
    queryFn: () => fetchLeaderboardQuery(leaderboardLimit),
    staleTime: Infinity,
    refetchInterval: false,
    refetchOnMount: false,
    retry: false,
  });

  const [initialLoadTimedOut, setInitialLoadTimedOut] = React.useState(false);

  React.useEffect(() => {
    if (!isPending) {
      setInitialLoadTimedOut(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      setInitialLoadTimedOut(true);
    }, INITIAL_LOAD_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [isPending]);

  const handleRefresh = React.useCallback(async () => {
    await Promise.allSettled([refetch(), refetchLeaderboardVersion?.()]);
  }, [refetch, refetchLeaderboardVersion]);

  const leaderboard = Array.isArray(data) ? data : [];
  const podium = leaderboard.slice(0, 3);
  const remaining = leaderboard.slice(3);
  const summary = getSummaryStats(leaderboard);

  const renderLeaderboardItem = ({ item, index }) => (
    <RankedRow item={item} rank={index + 4} />
  );

  const renderHeader = () => (
    <View
      style={[
        styles.headerBlock,
        { paddingTop: insets.top + 16 },
      ]}
    >
      <LinearGradient
        colors={["#082032", "#0B1F33", "#0D4F78"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroHaloOne} />
        <View style={styles.heroHaloTwo} />

        <View style={styles.heroBadge}>
          <Sparkles size={14} color="#FFFFFF" />
          <Text style={styles.heroBadgeText}>Live community ranking</Text>
        </View>

        <View style={styles.heroTitleRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>City Champions</Text>
            <Text style={styles.heroSubtitle}>
              Trust goes to drivers who keep the map sharp, fast, and accurate.
            </Text>
          </View>

          <View style={styles.heroIconShell}>
            <Trophy size={28} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryChip
            label="Ranked"
            value={formatNumber(summary.rankedCount)}
            accent={BRAND_PALETTE.accent}
          />
          <SummaryChip
            label="Avg trust"
            value={formatNumber(summary.averageTrust)}
            accent={BRAND_PALETTE.gold}
          />
          <SummaryChip
            label="Reports"
            value={formatNumber(summary.totalReports)}
            accent={BRAND_PALETTE.success}
          />
        </View>
      </LinearGradient>

      {podium.length > 0 ? (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeadingRow}>
            <View>
              <Text style={styles.sectionEyebrow}>Top Three</Text>
              <Text style={styles.sectionTitle}>The podium</Text>
            </View>
            <Text style={styles.sectionHint}>Refreshes on change</Text>
          </View>

          <View style={styles.podiumRow}>
            {podium[1] ? <PodiumCard item={podium[1]} rank={2} /> : <View style={styles.podiumSpacer} />}
            {podium[0] ? <PodiumCard item={podium[0]} rank={1} /> : null}
            {podium[2] ? <PodiumCard item={podium[2]} rank={3} /> : <View style={styles.podiumSpacer} />}
          </View>
        </View>
      ) : null}

      {remaining.length > 0 ? (
        <View style={styles.sectionHeadingRow}>
          <View>
            <Text style={styles.sectionEyebrow}>Leaderboard</Text>
            <Text style={styles.sectionTitle}>Climbing fast</Text>
          </View>
          <View style={styles.listMetaPill}>
            <Sparkles size={12} color={BRAND_PALETTE.accentBold} />
            <Text style={styles.listMetaPillText}>{remaining.length} contenders</Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  if (isPending && !initialLoadTimedOut) {
    return (
      <View style={[styles.stateScreen, { paddingTop: insets.top + 18 }]}>
        <LinearGradient
          colors={["#082032", "#0D4F78"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.stateCard}
        >
          <View style={styles.stateIconWrap}>
            <Trophy size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.stateTitle}>Building the leaderboard</Text>
          <Text style={styles.stateMessage}>
            Pulling the latest trust scores from the community.
          </Text>
        </LinearGradient>
      </View>
    );
  }

  if (initialLoadTimedOut && !leaderboard.length) {
    return (
      <View style={[styles.stateScreen, { paddingTop: insets.top + 18 }]}>
        <LinearGradient
          colors={["#FFF1F2", "#FFF9FB"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emptyCard}
        >
          <View style={styles.emptyIconWrap}>
            <Medal size={30} color={BRAND_PALETTE.error || "#D64545"} />
          </View>
          <Text style={styles.emptyTitle}>Leaderboard unavailable</Text>
          <Text style={styles.emptyMessage}>
            The leaderboard request is taking too long. Check the preview backend and app base URL, then try again.
          </Text>
        </LinearGradient>
      </View>
    );
  }

  if (!leaderboard.length) {
    if (isError) {
      return (
        <View style={[styles.stateScreen, { paddingTop: insets.top + 18 }]}>
          <LinearGradient
            colors={["#FFF1F2", "#FFF9FB"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.emptyCard}
          >
            <View style={styles.emptyIconWrap}>
              <Medal size={30} color={BRAND_PALETTE.error || "#D64545"} />
            </View>
            <Text style={styles.emptyTitle}>Leaderboard unavailable</Text>
            <Text style={styles.emptyMessage}>
              {error?.message || "We couldn't load the latest rankings right now."}
            </Text>
          </LinearGradient>
        </View>
      );
    }

    return (
      <View style={[styles.stateScreen, { paddingTop: insets.top + 18 }]}>
        <LinearGradient
          colors={["#DBEEFF", "#F8FCFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emptyCard}
        >
          <View style={styles.emptyIconWrap}>
            <Medal size={30} color={BRAND_PALETTE.accentBold} />
          </View>
          <Text style={styles.emptyTitle}>No rankings yet</Text>
          <Text style={styles.emptyMessage}>
            Accurate reports and claims will start shaping the board as soon as people contribute.
          </Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={remaining}
        renderItem={renderLeaderboardItem}
        keyExtractor={(item, index) => String(item?.id ?? `leaderboard-${index}`)}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{
          paddingTop: 0,
          paddingBottom: insets.bottom + 96,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={BRAND_PALETTE.accentBold}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EAF6FF",
  },
  headerBlock: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  heroCard: {
    overflow: "hidden",
    borderRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 22,
    shadowColor: "#082032",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 8,
  },
  heroHaloOne: {
    position: "absolute",
    right: -32,
    top: -24,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(125, 211, 252, 0.18)",
  },
  heroHaloTwo: {
    position: "absolute",
    left: -18,
    bottom: -26,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
    color: "#FFFFFF",
    textTransform: "uppercase",
  },
  heroTitleRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  heroSubtitle: {
    marginTop: 9,
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.76)",
    maxWidth: 280,
  },
  heroIconShell: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  summaryRow: {
    marginTop: 22,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  summaryChip: {
    minWidth: 94,
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  summaryChipAccent: {
    width: 26,
    height: 4,
    borderRadius: 999,
    marginBottom: 10,
  },
  summaryChipValue: {
    fontSize: 21,
    fontWeight: "900",
    color: BRAND_PALETTE.deepNavy,
  },
  summaryChipLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: BRAND_PALETTE.muted,
  },
  sectionBlock: {
    marginTop: 18,
  },
  sectionHeadingRow: {
    marginTop: 20,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: BRAND_PALETTE.accentBold,
  },
  sectionTitle: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: "900",
    color: BRAND_PALETTE.deepNavy,
  },
  sectionHint: {
    fontSize: 12,
    fontWeight: "700",
    color: BRAND_PALETTE.muted,
  },
  podiumRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  podiumSpacer: {
    flex: 1,
  },
  podiumCardWrap: {
    flex: 1,
    position: "relative",
  },
  podiumCardWrapChampion: {
    marginBottom: 0,
  },
  podiumCardWrapSide: {
    marginBottom: 10,
  },
  podiumGlow: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 28,
    height: 108,
    borderRadius: 26,
  },
  podiumGlowChampion: {
    top: 16,
    height: 124,
  },
  podiumRankPill: {
    position: "absolute",
    alignSelf: "center",
    top: 0,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  podiumRankPillChampion: {
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  podiumRankPillText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  podiumCard: {
    marginTop: 14,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    paddingHorizontal: 10,
    shadowColor: "#0B1F33",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  podiumCardChampion: {
    paddingTop: 26,
    paddingBottom: 14,
    minHeight: 214,
  },
  podiumCardSide: {
    paddingTop: 21,
    paddingBottom: 12,
    minHeight: 188,
  },
  avatarShell: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3,
    padding: 2.5,
  },
  avatarShellChampion: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  avatarCore: {
    flex: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 13,
    fontWeight: "900",
    color: BRAND_PALETTE.deepNavy,
  },
  avatarTextChampion: {
    fontSize: 14,
  },
  podiumOverline: {
    marginTop: 8,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: BRAND_PALETTE.muted,
  },
  podiumName: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: "900",
    color: BRAND_PALETTE.deepNavy,
    textAlign: "center",
    minHeight: 34,
  },
  badgeChip: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeChipChampion: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  badgeChipCompact: {
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  badgeChipText: {
    fontSize: 10,
    fontWeight: "800",
  },
  badgeChipTextChampion: {
    fontSize: 9,
  },
  badgeChipTextCompact: {
    fontSize: 8,
  },
  podiumScoreRow: {
    marginTop: 10,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  podiumScoreBlock: {
    flex: 1,
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  podiumScoreBlockChampion: {
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  podiumScoreBlockCompact: {
    paddingVertical: 7,
    paddingHorizontal: 3,
  },
  podiumDivider: {
    width: 8,
  },
  podiumScoreValue: {
    fontSize: 19,
    fontWeight: "900",
    color: BRAND_PALETTE.deepNavy,
  },
  podiumScoreValueChampion: {
    fontSize: 17,
  },
  podiumScoreValueCompact: {
    fontSize: 15,
  },
  podiumScoreLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    color: BRAND_PALETTE.muted,
    textTransform: "uppercase",
  },
  podiumScoreLabelChampion: {
    fontSize: 9,
  },
  podiumScoreLabelCompact: {
    fontSize: 8,
    marginTop: 1,
  },
  podiumFootnote: {
    marginTop: 10,
    fontSize: 9,
    lineHeight: 13,
    color: BRAND_PALETTE.muted,
    textAlign: "center",
  },
  listMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE5F5",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  listMetaPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: BRAND_PALETTE.navy,
  },
  rowCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "#D9EAF6",
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: "#0B1F33",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  rowIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E0F2FE",
  },
  rankBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: BRAND_PALETTE.accentBold,
  },
  rowNameWrap: {
    flex: 1,
    gap: 5,
  },
  rowName: {
    fontSize: 14,
    fontWeight: "800",
    color: BRAND_PALETTE.deepNavy,
  },
  inlineBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  inlineBadgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  scoreOrb: {
    minWidth: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: BRAND_PALETTE.deepNavy,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  scoreOrbValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  scoreOrbLabel: {
    marginTop: 1,
    fontSize: 8,
    fontWeight: "800",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
  },
  rowMetrics: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  metricPill: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#F7FBFF",
    borderWidth: 1,
    borderColor: "#D7E9F5",
  },
  metricPillAccent: {
    backgroundColor: "#E0F2FE",
    borderColor: "#BAE6FD",
  },
  metricValue: {
    fontSize: 12,
    fontWeight: "900",
    color: BRAND_PALETTE.navy,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: BRAND_PALETTE.muted,
  },
  metricValueAccent: {
    color: BRAND_PALETTE.accentBold,
  },
  metricLabelAccent: {
    color: BRAND_PALETTE.accentBold,
  },
  stateScreen: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: "#EAF6FF",
    justifyContent: "center",
  },
  stateCard: {
    borderRadius: 32,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 34,
  },
  stateIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  stateTitle: {
    marginTop: 18,
    fontSize: 24,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
  },
  stateMessage: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
    maxWidth: 280,
  },
  emptyCard: {
    borderRadius: 32,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 34,
    borderWidth: 1,
    borderColor: "#D3E8F6",
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 18,
    fontSize: 24,
    fontWeight: "900",
    color: BRAND_PALETTE.deepNavy,
    textAlign: "center",
  },
  emptyMessage: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: BRAND_PALETTE.muted,
    textAlign: "center",
    maxWidth: 290,
  },
});
