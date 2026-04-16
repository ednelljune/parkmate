import React from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import {
  BellRing,
  Circle,
  CheckCircle2,
  Clock3,
  Eye,
  Flag,
  MapPin,
  Trash2,
  X,
} from "lucide-react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useActivityNotifications } from "@/hooks/useActivityNotifications";
import { useActivityMailbox } from "@/hooks/useActivityMailbox";
import { formatTimeAgo } from "@/utils/formatters";
import { BRAND_PALETTE } from "@/theme/brandColors";
import { useAuthStore } from "@/utils/auth/store";
import useUser from "@/utils/auth/useUser";
import { deriveSystemUpdateItems } from "@/utils/systemUpdates";
import {
  deleteActivityNotificationsRemote,
  deleteMailboxNotificationsRemote,
} from "@/utils/notificationDeletion";
import {
  deleteSystemUpdateItems,
  hydrateDeletedSystemUpdateIds,
} from "@/utils/systemUpdateNotificationState";
import {
  getActivityLastViewedAt,
  getActivityReadStateVersion,
  hydrateActivityReadState,
  isActivityNotificationUnread,
  markAllActivityNotificationsRead,
  deleteAllActivityNotifications,
  deleteActivityNotification,
  markActivityNotificationRead,
  markActivityNotificationUnread,
  subscribeToActivityReadState,
} from "@/utils/activityReadState";

const ACTIVITY_META = {
  reported: {
    label: "Reported",
    icon: MapPin,
    accent: BRAND_PALETTE.accentBold,
    soft: "#DFF5FF",
    chipBackground: "#E0F2FE",
    chipText: "#075985",
  },
  claimed: {
    label: "Claimed",
    icon: CheckCircle2,
    accent: BRAND_PALETTE.success,
    soft: "#E7FFF5",
    chipBackground: "#DDF8EC",
    chipText: "#047857",
  },
  report_claimed: {
    label: "System Update",
    icon: BellRing,
    accent: BRAND_PALETTE.gold,
    soft: "#FFF7D6",
    chipBackground: "#FFF0C2",
    chipText: "#B45309",
  },
  expired: {
    label: "Expired",
    icon: Clock3,
    accent: BRAND_PALETTE.accentBold,
    soft: "#DFF5FF",
    chipBackground: "#E0F2FE",
    chipText: "#075985",
  },
  false_reported: {
    label: "False Report",
    icon: Flag,
    accent: BRAND_PALETTE.gold,
    soft: "#FFF4DB",
    chipBackground: "#FFF0C2",
    chipText: "#B45309",
  },
};

const MAILBOX_META = {
  claimed: {
    label: "Claimed",
    icon: CheckCircle2,
    accent: BRAND_PALETTE.success,
    chipBackground: "#DDF8EC",
    chipText: "#047857",
    panel: "#F5FFFA",
    border: "rgba(16, 185, 129, 0.18)",
  },
  expired: {
    label: "Expired",
    icon: Clock3,
    accent: BRAND_PALETTE.accentBold,
    chipBackground: "#E0F2FE",
    chipText: "#075985",
    panel: "#F7FBFF",
    border: "rgba(2, 132, 199, 0.16)",
  },
  false_reported: {
    label: "False Reported",
    icon: Flag,
    accent: BRAND_PALETTE.gold,
    chipBackground: "#FFF0C2",
    chipText: "#B45309",
    panel: "#FFFBF2",
    border: "rgba(245, 158, 11, 0.18)",
  },
};

const getDeleteErrorMessage = (error, fallbackMessage) => {
  const message =
    typeof error?.message === "string" && error.message.trim()
      ? error.message.trim()
      : "";

  if (!message) {
    return fallbackMessage;
  }

  return message;
};

const INITIAL_ACTIVITY_LOAD_TIMEOUT_MS = 20000;

const getEmptyStateMessage = () => {
  return "Your parking activity will appear here as you use the app.";
};

const getParkingLabel = (item) => item.parking_type || item.zone_type || "Parking";

const getQuantityLabel = (item) => {
  const quantity = Math.max(1, Number(item?.quantity) || 1);
  const parkingType = getParkingLabel(item);
  return `${quantity} ${parkingType} spot${quantity === 1 ? "" : "s"}`;
};

const getActivitySummary = (item) => {
  const activityLabel =
    ACTIVITY_META[item.activity_type]?.label || ACTIVITY_META.reported.label;
  const zoneName = item.zone_name || "Unknown location";

  if (item.activity_type === "report_claimed") {
    return `Your reported ${getQuantityLabel(item)} at ${zoneName} was claimed`;
  }

  if (item.activity_type === "expired") {
    return `Your reported ${getQuantityLabel(item)} at ${zoneName} expired`;
  }

  if (item.activity_type === "false_reported" && item?.is_system_update) {
    return `Your reported ${getQuantityLabel(item)} at ${zoneName} was flagged as false`;
  }

  return `${activityLabel} ${getQuantityLabel(item)} at ${zoneName}`;
};

const getActivityDetail = (item) => {
  if (item.activity_type === "claimed") {
    return "Claim completed";
  }

  if (item.activity_type === "report_claimed") {
    return "System update: you earned +10 contribution points";
  }

  if (item.activity_type === "expired") {
    return "System update: this report expired before anyone claimed it";
  }

  if (item.activity_type === "false_reported") {
    if (item?.is_system_update) {
      return item?.trust_score_affected
        ? "System update: multiple drivers flagged this report and trust impact was applied"
        : "System update: drivers flagged this report as false";
    }

    return "Marked as false report";
  }

  return "Spot reported";
};

const getMailboxSummary = (item) => {
  const zoneName = item?.zone_name || "Reported spot";
  const quantityLabel = getQuantityLabel(item);

  if (item?.mailbox_type === "claimed") {
    return `${quantityLabel} at ${zoneName} was claimed`;
  }

  if (item?.mailbox_type === "expired") {
    return `${quantityLabel} at ${zoneName} expired unclaimed`;
  }

  return `${quantityLabel} at ${zoneName} was flagged as false`;
};

const getMailboxDetail = (item) => {
  if (item?.mailbox_type === "claimed") {
    const points = Math.max(0, Number(item?.claim_points_awarded) || 0);
    return points > 0
      ? `Your reported spot was claimed. You earned +${points} contribution points.`
      : "Your reported spot was claimed.";
  }

  if (item?.mailbox_type === "expired") {
    return "This report expired before another driver claimed it.";
  }

  const falseReportCount = Math.max(1, Number(item?.false_report_count) || 1);
  const threshold = Math.max(1, Number(item?.trust_score_threshold) || 3);

  if (item?.trust_score_affected) {
    return `Flagged ${falseReportCount} times. Trust score impact was triggered after the ${threshold}rd report.`;
  }

  return `Flagged ${falseReportCount} times. Trust score changes start once ${threshold} users flag the same spot.`;
};

const getHeaderStats = (notifications, viewedAt) => {
  const unreadCount = notifications.filter((item) =>
    isActivityNotificationUnread(item, viewedAt),
  ).length;

  const reportedCount = notifications.filter(
    (item) => item?.activity_type === "reported",
  ).length;

  const claimedCount = notifications.filter(
    (item) => item?.activity_type === "claimed",
  ).length;

  const falseCount = notifications.filter(
    (item) => item?.activity_type === "false_reported",
  ).length;
  const systemUpdateCount = notifications.filter(
    (item) => Boolean(item?.is_system_update),
  ).length;

  return {
    unreadCount,
    reportedCount,
    claimedCount,
    falseCount,
    systemUpdateCount,
  };
};

const getMailboxStats = (items, summary) => {
  if (summary && typeof summary === "object") {
    return {
      total: Number(summary.total) || 0,
      claimed: Number(summary.claimed) || 0,
      expired: Number(summary.expired) || 0,
      falseReported: Number(summary.falseReported) || 0,
    };
  }

  return (items || []).reduce(
    (accumulator, item) => {
      accumulator.total += 1;

      if (item?.mailbox_type === "claimed") {
        accumulator.claimed += 1;
      } else if (item?.mailbox_type === "expired") {
        accumulator.expired += 1;
      } else if (item?.mailbox_type === "false_reported") {
        accumulator.falseReported += 1;
      }

      return accumulator;
    },
    { total: 0, claimed: 0, expired: 0, falseReported: 0 },
  );
};

function StatChip({ label, value, accent, tone = "light" }) {
  const backgroundColor = tone === "dark" ? "rgba(255,255,255,0.14)" : "#FFFFFF";
  const textColor = tone === "dark" ? "#FFFFFF" : BRAND_PALETTE.navy;
  const labelColor = tone === "dark" ? "rgba(255,255,255,0.72)" : BRAND_PALETTE.muted;

  return (
    <View style={[styles.statChip, { backgroundColor }]}>
      <View style={[styles.statChipAccent, { backgroundColor: accent }]} />
      <Text style={[styles.statChipValue, { color: textColor }]}>{value}</Text>
      <Text style={[styles.statChipLabel, { color: labelColor }]}>{label}</Text>
    </View>
  );
}

function SwipeAction({ title, detail, accent, destructive = false }) {
  return (
    <View
      style={[
        styles.swipeAction,
        {
          backgroundColor: destructive ? "#FEE2E2" : "#E0F2FE",
          borderColor: destructive ? "#FCA5A5" : "#93C5FD",
        },
      ]}
    >
      <Text style={[styles.swipeActionTitle, { color: accent }]}>{title}</Text>
      <Text style={styles.swipeActionDetail}>{detail}</Text>
    </View>
  );
}

function HeaderIconButton({
  icon: Icon,
  onPress,
  disabled = false,
  destructive = false,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.headerIconButton,
        destructive ? styles.headerIconButtonDestructive : styles.headerIconButtonPrimary,
        disabled && styles.headerIconButtonDisabled,
        pressed && !disabled && styles.headerIconButtonPressed,
      ]}
    >
      <Icon
        size={16}
        color={destructive ? "#BE123C" : BRAND_PALETTE.accentBold}
      />
    </Pressable>
  );
}

function HeaderTextButton({ label, onPress, disabled = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.headerTextButton,
        disabled && styles.headerTextButtonDisabled,
        pressed && !disabled && styles.headerTextButtonPressed,
      ]}
    >
      <Text style={styles.headerTextButtonText}>{label}</Text>
    </Pressable>
  );
}

function MailboxCard({ summary, lastItem, loading, onPress }) {
  const hasItems = (summary?.total || 0) > 0;
  const isInitialLoading = loading && !hasItems;
  const helperText = loading
    ? "Syncing"
    : hasItems
      ? getMailboxSummary(lastItem || {})
      : "Tap to view";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.mailboxCard,
        pressed && styles.mailboxCardPressed,
      ]}
    >
      <View style={styles.mailboxStatAccent} />
      <View style={styles.mailboxCompactHeader}>
        <BellRing size={14} color={BRAND_PALETTE.gold} />
        <Text style={styles.mailboxCompactEyebrow}>Updates</Text>
      </View>

      <Text style={styles.mailboxCompactValue}>
        {isInitialLoading ? "..." : summary?.total || 0}
      </Text>
      <Text style={styles.mailboxCompactLabel}>
        {hasItems ? "System updates" : "Updates"}
      </Text>
      <View style={styles.mailboxCompactFooter}>
        <Text style={styles.mailboxCompactHelper} numberOfLines={2}>
          {helperText}
        </Text>
      </View>
    </Pressable>
  );
}

const ActivityRow = React.memo(function ActivityRow({
  item,
  viewedAt,
  isEditing = false,
  isSelected = false,
  onToggleSelect,
  onDeleteItem,
}) {
  const meta = ACTIVITY_META[item.activity_type] || ACTIVITY_META.reported;
  const Icon = meta.icon;
  const unread = isActivityNotificationUnread(item, viewedAt);
  const swipeableRef = React.useRef(null);

  const handleToggleReadState = React.useCallback(async () => {
    if (unread) {
      await markActivityNotificationRead(item).catch(() => {});
    } else {
      await markActivityNotificationUnread(item).catch(() => {});
    }
    swipeableRef.current?.close();
  }, [item, unread]);

  const handleDelete = React.useCallback(async () => {
    Alert.alert(
      "Delete activity?",
      "This will remove the activity item from your list.",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => swipeableRef.current?.close(),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await onDeleteItem?.(item);
              swipeableRef.current?.close();
            } catch (error) {
              console.warn("[activity.delete] Failed to delete single activity item", {
                itemId: item?.id || null,
                message: error?.message || String(error),
              });
              Alert.alert(
                "Unable to delete activity",
                getDeleteErrorMessage(error, "Please try again."),
              );
            }
          },
        },
      ],
    );
  }, [item, onDeleteItem]);

  const card = (
    <Pressable
      accessibilityRole={isEditing ? "checkbox" : "button"}
      accessibilityState={isEditing ? { checked: isSelected } : undefined}
      disabled={!isEditing}
      onPress={() => {
        if (isEditing) {
          onToggleSelect?.(item);
        }
      }}
      style={({ pressed }) => [
        styles.feedCard,
        isEditing && styles.feedCardEditing,
        isSelected && styles.feedCardSelected,
        {
          backgroundColor: unread ? "#FFFFFF" : "rgba(255,255,255,0.84)",
          borderColor: isSelected
            ? meta.accent
            : unread
              ? meta.soft
              : "rgba(148, 163, 184, 0.2)",
          opacity: pressed && isEditing ? 0.96 : 1,
        },
      ]}
    >
      <View style={styles.feedCardRail}>
        <View style={[styles.feedCardLine, { backgroundColor: meta.accent }]} />
        <View
          style={[
            styles.feedCardIconWrap,
            { backgroundColor: unread ? meta.accent : meta.soft },
          ]}
        >
          <Icon size={18} color={unread ? "#FFFFFF" : meta.accent} />
        </View>
      </View>

      <View style={styles.feedCardBody}>
        <View style={styles.feedCardTopRow}>
          <View
            style={[
              styles.activityChip,
              { backgroundColor: meta.chipBackground },
            ]}
          >
            <Text style={[styles.activityChipText, { color: meta.chipText }]}>
              {meta.label}
            </Text>
          </View>

          <View style={styles.feedCardTopActions}>
            <View style={styles.activityTimeWrap}>
              <Clock3 size={13} color={BRAND_PALETTE.muted} />
              <Text style={styles.activityTime}>{formatTimeAgo(item.sent_at)}</Text>
            </View>
            {isEditing ? (
              <View
                style={[
                  styles.selectionCheckbox,
                  isSelected && styles.selectionCheckboxSelected,
                ]}
              >
                {isSelected ? (
                  <CheckCircle2 size={16} color="#FFFFFF" />
                ) : (
                  <Circle size={16} color={BRAND_PALETTE.muted} />
                )}
              </View>
            ) : null}
          </View>
        </View>

        <Text style={styles.feedCardTitle} numberOfLines={2}>
          {getActivitySummary(item)}
        </Text>
        <Text style={styles.feedCardDetail} numberOfLines={1}>
          {getActivityDetail(item)}
        </Text>

        <View style={styles.feedCardMetaRow}>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>{getQuantityLabel(item)}</Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>{item.zone_name || "Reported spot"}</Text>
          </View>
        </View>

        <View style={styles.feedCardFooter}>
          {unread ? (
            <View style={[styles.statusPill, styles.statusPillUnread]}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: meta.accent },
                ]}
              />
              <Text style={styles.statusPillUnreadText}>New activity</Text>
            </View>
          ) : (
            <View style={[styles.statusPill, styles.statusPillRead]}>
              <Text style={styles.statusPillReadText}>Reviewed</Text>
            </View>
          )}

          {!isEditing ? (
            <Text style={styles.swipeHint}>
              {Platform.OS === "ios" ? "Activity item" : "Swipe to manage"}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );

  if (isEditing) {
    return card;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      overshootLeft={false}
      overshootRight={false}
      leftThreshold={56}
      rightThreshold={56}
      renderLeftActions={() => (
        <SwipeAction
          title={unread ? "Mark Read" : "Mark Unread"}
          detail={
            unread
              ? "Slide right to clear this item"
              : "Slide right to bring this item back"
          }
          accent={BRAND_PALETTE.accentBold}
        />
      )}
      renderRightActions={() => (
        <SwipeAction
          title="Delete"
          detail="Slide left to remove this activity item"
          accent="#B91C1C"
          destructive
        />
      )}
      onSwipeableOpen={(direction) => {
        if (direction === "left") {
          handleToggleReadState();
          return;
        }

        if (direction === "right") {
          handleDelete();
        }
      }}
    >
      {card}
    </Swipeable>
  );
});

const MailboxItemRow = React.memo(function MailboxItemRow({
  item,
  isEditing = false,
  isSelected = false,
  onToggleSelect,
}) {
  const resolvedItem = item || {};
  const meta = MAILBOX_META[resolvedItem.mailbox_type] || MAILBOX_META.false_reported;
  const Icon = meta.icon;
  const quantityLabel = getQuantityLabel(resolvedItem);
  const falseReportCount = Math.max(0, Number(resolvedItem?.false_report_count) || 0);
  const claimPoints = Math.max(0, Number(resolvedItem?.claim_points_awarded) || 0);

  return (
    <Pressable
      accessibilityRole={isEditing ? "checkbox" : "button"}
      accessibilityState={isEditing ? { checked: isSelected } : undefined}
      disabled={!isEditing}
      onPress={() => {
        if (isEditing) {
          onToggleSelect?.(resolvedItem);
        }
      }}
      style={[
        styles.mailboxItemCard,
        isEditing && styles.feedCardEditing,
        isSelected && styles.feedCardSelected,
        {
          backgroundColor: meta.panel,
          borderColor: isSelected ? meta.accent : meta.border,
        },
      ]}
    >
      <View style={styles.mailboxItemHeader}>
        <View style={styles.mailboxItemLead}>
          <View
            style={[
              styles.mailboxItemIconWrap,
              { backgroundColor: meta.accent },
            ]}
          >
            <Icon size={16} color="#FFFFFF" />
          </View>
          <View style={styles.mailboxItemHeaderText}>
            <View
              style={[
                styles.activityChip,
                { backgroundColor: meta.chipBackground },
              ]}
            >
              <Text style={[styles.activityChipText, { color: meta.chipText }]}>
                {meta.label}
              </Text>
            </View>
            <Text style={styles.mailboxItemTitle}>{getMailboxSummary(resolvedItem)}</Text>
          </View>
        </View>

        <View style={styles.mailboxItemTimeWrap}>
          <Clock3 size={13} color={BRAND_PALETTE.muted} />
          <Text style={styles.activityTime}>{formatTimeAgo(resolvedItem.sent_at)}</Text>
          {isEditing ? (
            <View
              style={[
                styles.selectionCheckbox,
                isSelected && styles.selectionCheckboxSelected,
              ]}
            >
              {isSelected ? (
                <CheckCircle2 size={16} color="#FFFFFF" />
              ) : (
                <Circle size={16} color={BRAND_PALETTE.muted} />
              )}
            </View>
          ) : null}
        </View>
      </View>

      <Text style={styles.mailboxItemDetail}>{getMailboxDetail(resolvedItem)}</Text>

      <View style={styles.mailboxPillRow}>
        <View style={styles.metaPill}>
          <Text style={styles.metaPillText}>{quantityLabel}</Text>
        </View>
        <View style={styles.metaPill}>
          <Text style={styles.metaPillText}>{resolvedItem.zone_name || "Reported spot"}</Text>
        </View>
        {resolvedItem.mailbox_type === "claimed" && claimPoints > 0 ? (
          <View style={[styles.metaPill, styles.mailboxAccentPill]}>
            <Text style={styles.mailboxAccentPillText}>+{claimPoints} pts</Text>
          </View>
        ) : null}
        {resolvedItem.mailbox_type === "expired" ? (
          <View style={[styles.metaPill, styles.mailboxNeutralPill]}>
            <Text style={styles.mailboxNeutralPillText}>No claim landed</Text>
          </View>
        ) : null}
        {resolvedItem.mailbox_type === "false_reported" ? (
          <View style={[styles.metaPill, styles.mailboxWarningPill]}>
            <Text style={styles.mailboxWarningPillText}>
              {falseReportCount} false {falseReportCount === 1 ? "report" : "reports"}
            </Text>
          </View>
        ) : null}
        {resolvedItem.mailbox_type === "false_reported" && resolvedItem.trust_score_affected ? (
          <View style={[styles.metaPill, styles.mailboxWarningPillStrong]}>
            <Text style={styles.mailboxWarningPillStrongText}>Trust impacted</Text>
          </View>
        ) : null}
      </View>

    </Pressable>
  );
});

function MailboxModal({
  visible,
  onClose,
  items = [],
  summary = null,
  loading,
  onRefresh,
  insets,
  isEditing = false,
  onStartEditing,
  onCancelEditing,
  onDeleteSelected,
  onToggleSelect,
  selectedIdSet = new Set(),
  deleteDisabled = false,
}) {
  const resolvedItems = Array.isArray(items) ? items : [];
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.mailboxModalBackdrop}>
        <Pressable style={styles.mailboxModalBackdropPressable} onPress={onClose} />

        <View
          style={[
            styles.mailboxModalSheet,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={styles.mailboxModalHandle} />

          <View style={styles.mailboxModalHeader}>
            <View style={styles.mailboxModalHeaderCopy}>
              <Text style={styles.mailboxModalEyebrow}>System updates</Text>
              <Text style={styles.mailboxModalTitle}>Reported spot updates</Text>
              <Text style={styles.mailboxModalSubtitle}>
                Claims, expiries, and false reports for your spots are grouped here.
              </Text>
            </View>
            <View style={styles.mailboxModalHeaderActions}>
              {isEditing ? (
                <HeaderIconButton
                  icon={Trash2}
                  onPress={onDeleteSelected}
                  disabled={deleteDisabled}
                  destructive
                />
              ) : (
                <HeaderTextButton
                  label="Edit"
                  onPress={onStartEditing}
                  disabled={resolvedItems.length === 0}
                />
              )}
              {isEditing ? (
                <HeaderTextButton
                  label="Cancel"
                  onPress={onCancelEditing}
                  disabled={false}
                />
              ) : (
                <Pressable onPress={onClose} style={styles.mailboxCloseButton}>
                  <X size={18} color={BRAND_PALETTE.deepNavy} />
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.mailboxSummaryRow}>
            <View style={styles.mailboxSummaryChip}>
              <Text style={styles.mailboxSummaryValue}>{summary?.claimed || 0}</Text>
              <Text style={styles.mailboxSummaryLabel}>Claimed</Text>
            </View>
            <View style={styles.mailboxSummaryChip}>
              <Text style={styles.mailboxSummaryValue}>{summary?.expired || 0}</Text>
              <Text style={styles.mailboxSummaryLabel}>Expired</Text>
            </View>
            <View style={styles.mailboxSummaryChip}>
              <Text style={styles.mailboxSummaryValue}>{summary?.falseReported || 0}</Text>
              <Text style={styles.mailboxSummaryLabel}>False</Text>
            </View>
          </View>

          {loading && resolvedItems.length === 0 ? (
            <View style={styles.mailboxStateWrap}>
              <ActivityIndicator size="large" color={BRAND_PALETTE.accentBold} />
              <Text style={styles.mailboxStateTitle}>Loading updates</Text>
              <Text style={styles.mailboxStateText}>
                Pulling the latest status changes from your reported spots.
              </Text>
            </View>
          ) : resolvedItems.length === 0 ? (
            <View style={styles.mailboxStateWrap}>
              <BellRing size={28} color={BRAND_PALETTE.accentBold} />
              <Text style={styles.mailboxStateTitle}>No system updates yet</Text>
              <Text style={styles.mailboxStateText}>
                When one of your reports changes status, it
                will appear here.
              </Text>
            </View>
          ) : (
            <FlatList
              data={resolvedItems}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <MailboxItemRow
                  item={item}
                  isEditing={isEditing}
                  isSelected={selectedIdSet?.has?.(String(item.id)) || false}
                  onToggleSelect={onToggleSelect}
                />
              )}
              contentContainerStyle={styles.mailboxListContent}
              ItemSeparatorComponent={() => <View style={styles.mailboxListSeparator} />}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={loading}
                  onRefresh={onRefresh}
                  tintColor={BRAND_PALETTE.accentBold}
                />
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const ListHeader = React.memo(function ListHeader({
  notifications,
  viewedAt,
  mailboxItems,
  mailboxSummary,
  mailboxLoading,
  isEditing,
  onStartEditing,
  onCancelEditing,
  onMarkSelectedRead,
  onDeleteSelected,
  onOpenMailbox,
  readDisabled,
  deleteDisabled,
  actionBusy,
}) {
  const stats = React.useMemo(
    () => getHeaderStats(notifications, viewedAt),
    [notifications, viewedAt],
  );

  const lastActivity = notifications[0];
  const mailboxStats = React.useMemo(
    () => getMailboxStats(mailboxItems, mailboxSummary),
    [mailboxItems, mailboxSummary],
  );
  const latestMailboxItem = mailboxItems[0] || null;

  return (
    <View style={styles.listHeaderWrap}>
      <LinearGradient
        colors={["#082032", "#0F3B56", "#0284C7"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroGlowLarge} />
        <View style={styles.heroGlowSmall} />

        <View style={styles.heroTopRow}>
          <View style={styles.heroBadge}>
            <BellRing size={16} color="#FFFFFF" />
            <Text style={styles.heroBadgeText}>Live Activity</Text>
          </View>
          <Text style={styles.heroCaption}>
            {stats.unreadCount > 0 ? `${stats.unreadCount} unread` : "All caught up"}
          </Text>
        </View>

        <Text style={styles.heroTitle}>Your parking moves, in one feed.</Text>
        <Text style={styles.heroSubtitle}>
          Reports, claims, and false-report actions in one cleaner timeline.
        </Text>

        <View style={styles.heroStatsRow}>
          <StatChip
            label="Unread"
            value={stats.unreadCount}
            accent="#7DD3FC"
            tone="dark"
          />
          <StatChip
            label="Reports"
            value={stats.reportedCount}
            accent={BRAND_PALETTE.accent}
            tone="dark"
          />
          <StatChip
            label="Claims"
            value={stats.claimedCount}
            accent="#6EE7B7"
            tone="dark"
          />
        </View>
      </LinearGradient>

      <View style={styles.insightRow}>
        <MailboxCard
          summary={mailboxStats}
          lastItem={latestMailboxItem}
          loading={mailboxLoading}
          onPress={onOpenMailbox}
        />
        <View style={styles.insightCard}>
          <Text style={styles.insightEyebrow}>Latest activity</Text>
          <Text style={styles.insightHeadline}>
            {lastActivity ? getActivitySummary(lastActivity) : "No recent events yet"}
          </Text>
          <Text style={styles.insightSubline}>
            {lastActivity
              ? `${formatTimeAgo(lastActivity.sent_at)} | ${lastActivity.zone_name || "Reported spot"}`
              : "Start reporting or claiming spots to build your timeline."}
          </Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.headerActionsRow}>
            {isEditing ? (
              <HeaderIconButton
                icon={Trash2}
                onPress={onDeleteSelected}
                disabled={deleteDisabled || actionBusy}
                destructive
              />
            ) : (
              <HeaderTextButton
                label="Edit"
                onPress={onStartEditing}
                disabled={actionBusy}
              />
            )}
            {isEditing ? (
              <HeaderTextButton
                label="Cancel"
                onPress={onCancelEditing}
                disabled={actionBusy}
              />
            ) : null}
          </View>
        </View>
        <Text style={styles.sectionSubtitle}>
          {isEditing
            ? "Select activity items, then use delete on the left or cancel on the right."
            : "Newest activity first. Swipe any item to manage it."}
        </Text>
      </View>
    </View>
  );
});

function LoadingState() {
  return (
    <View style={styles.stateScreen}>
      <LinearGradient
        colors={["#DBF1FF", "#F0F9FF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.statePanel}
      >
        <View style={styles.stateIconShell}>
          <ActivityIndicator size="large" color={BRAND_PALETTE.accentBold} />
        </View>
        <Text style={styles.stateTitle}>Loading your activity</Text>
        <Text style={styles.stateMessage}>
          Building the latest timeline from your parking actions.
        </Text>
      </LinearGradient>
    </View>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <View style={styles.stateScreen}>
      <LinearGradient
        colors={["#FFF4E8", "#FFF9F1"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.statePanel}
      >
        <View style={[styles.stateIconShell, { backgroundColor: "#FFF1E0" }]}>
          <Flag size={28} color={BRAND_PALETTE.gold} />
        </View>
        <Text style={styles.stateTitle}>Unable to load activity</Text>
        <Text style={styles.stateMessage}>
          {error?.message || "The activity feed request failed."}
        </Text>
        <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <LinearGradient
        colors={["#FFFFFF", "#EAF7FF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.emptyPanel}
      >
        <View style={styles.emptyIconWrap}>
          <BellRing size={28} color={BRAND_PALETTE.accentBold} />
        </View>
        <Text style={styles.emptyTitle}>No Activity Yet</Text>
        <Text style={styles.emptyMessage}>{getEmptyStateMessage()}</Text>
      </LinearGradient>
    </View>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();
  const { data: user } = useUser();
  const [isEditing, setIsEditing] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState([]);
  const [actionBusy, setActionBusy] = React.useState(false);
  const [isMailboxVisible, setIsMailboxVisible] = React.useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = React.useState(false);
  const [deletedSystemUpdateIds, setDeletedSystemUpdateIds] = React.useState(new Set());
  const [isMailboxEditing, setIsMailboxEditing] = React.useState(false);
  const [selectedMailboxIds, setSelectedMailboxIds] = React.useState([]);
  const lastLifecycleRefreshAtRef = React.useRef(0);
  const lifecycleRefreshInFlightRef = React.useRef(false);
  const activityReadStateVersion = React.useSyncExternalStore(
    subscribeToActivityReadState,
    getActivityReadStateVersion,
    getActivityReadStateVersion,
  );
  const {
    data: notifications = [],
    allNotifications = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    refetchActivityVersion,
  } = useActivityNotifications(100, Boolean(session?.access_token), {
    refetchIntervalMs: false,
    refetchOnMount: false,
    staleTimeMs: Infinity,
    watchActivityVersion: false,
  });
  const {
    data: mailboxItems = [],
    summary: mailboxSummary,
    refetch: refetchMailbox,
    isLoading: isMailboxLoading,
    isRefetching: isMailboxRefetching,
  } = useActivityMailbox(50, Boolean(session?.access_token), {
    refetchIntervalMs: false,
    refetchOnMount: false,
    staleTimeMs: Infinity,
  });
  const [initialLoadTimedOut, setInitialLoadTimedOut] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading) {
      setInitialLoadTimedOut(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      setInitialLoadTimedOut(true);
    }, INITIAL_ACTIVITY_LOAD_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [isLoading]);

  React.useEffect(() => {
    hydrateActivityReadState().catch(() => {});
  }, []);

  const refreshActivityFeeds = React.useCallback(
    async ({ showSpinner = false, source = "manual" } = {}) => {
      const now = Date.now();
      const isLifecycleRefresh = source !== "manual";

      if (isLifecycleRefresh) {
        if (lifecycleRefreshInFlightRef.current) {
          return;
        }

        if (now - lastLifecycleRefreshAtRef.current < 5000) {
          return;
        }

        lifecycleRefreshInFlightRef.current = true;
        lastLifecycleRefreshAtRef.current = now;
      }

      if (showSpinner) {
        setIsManualRefreshing(true);
      }

      try {
        await Promise.allSettled([
          refetch(),
          refetchActivityVersion?.(),
          refetchMailbox?.(),
        ]);
      } finally {
        if (showSpinner) {
          setIsManualRefreshing(false);
        }

        if (isLifecycleRefresh) {
          lifecycleRefreshInFlightRef.current = false;
        }
      }
    },
    [refetch, refetchActivityVersion, refetchMailbox],
  );

  useFocusEffect(
    React.useCallback(() => {
      refreshActivityFeeds({ source: "focus" }).catch(() => {});
    }, [refreshActivityFeeds]),
  );

  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        refreshActivityFeeds({ source: "app-active" }).catch(() => {});
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshActivityFeeds]);

  React.useEffect(() => {
    let cancelled = false;

    hydrateDeletedSystemUpdateIds(user?.id).then((ids) => {
      if (!cancelled) {
        setDeletedSystemUpdateIds(ids);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleRefresh = React.useCallback(
    async () => refreshActivityFeeds({ showSpinner: true, source: "manual" }),
    [refreshActivityFeeds],
  );

  const viewedAt = React.useMemo(
    () => getActivityLastViewedAt(),
    [activityReadStateVersion],
  );
  const selectedNotifications = React.useMemo(() => {
    if (selectedIds.length === 0) {
      return [];
    }

    const selectedIdSet = new Set(selectedIds);
    return notifications.filter((item) => selectedIdSet.has(String(item.id)));
  }, [notifications, selectedIds]);
  const selectedIdSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedUnreadNotifications = React.useMemo(
    () =>
      selectedNotifications.filter((item) => isActivityNotificationUnread(item, viewedAt)),
    [selectedNotifications, viewedAt],
  );
  const selectedReadNotifications = React.useMemo(
    () =>
      selectedNotifications.filter((item) => !isActivityNotificationUnread(item, viewedAt)),
    [selectedNotifications, viewedAt],
  );
  const unreadNotifications = React.useMemo(
    () => notifications.filter((item) => isActivityNotificationUnread(item, viewedAt)),
    [notifications, viewedAt],
  );
  const hasSelection = selectedIds.length > 0;
  const readActionMode = hasSelection
    ? selectedUnreadNotifications.length > 0
      ? "read"
      : selectedReadNotifications.length > 0
        ? "unread"
        : null
    : unreadNotifications.length > 0
      ? "read"
      : null;
  const readTargets =
    readActionMode === "read"
      ? hasSelection
        ? selectedUnreadNotifications
        : unreadNotifications
      : readActionMode === "unread"
        ? selectedReadNotifications
        : [];
  const deleteTargets = hasSelection ? selectedNotifications : notifications;
  const readDisabled = readTargets.length === 0;
  const deleteDisabled = deleteTargets.length === 0;
  const readTargetIds = React.useMemo(
    () => readTargets.map((item) => String(item?.id || "")).filter(Boolean),
    [readTargets],
  );
  const derivedSystemUpdateItems = React.useMemo(
    () => deriveSystemUpdateItems(allNotifications),
    [allNotifications],
  );
  const rawSystemUpdateItems = mailboxItems.length > 0 ? mailboxItems : derivedSystemUpdateItems;
  const systemUpdateItems = React.useMemo(
    () =>
      rawSystemUpdateItems.filter(
        (item) => !deletedSystemUpdateIds.has(String(item?.id || "")),
      ),
    [deletedSystemUpdateIds, rawSystemUpdateItems],
  );
  const systemUpdateSummary = React.useMemo(
    () => getMailboxStats(systemUpdateItems, null),
    [systemUpdateItems],
  );
  const systemUpdatesLoading =
    ((isMailboxLoading || isMailboxRefetching) && systemUpdateItems.length === 0) ||
    ((!mailboxItems.length && !mailboxSummary) &&
      (isLoading || isRefetching) &&
      systemUpdateItems.length === 0);

  React.useEffect(() => {
    const visibleIds = new Set(notifications.map((item) => String(item.id)));
    setSelectedIds((current) => current.filter((id) => visibleIds.has(id)));

    if (notifications.length === 0) {
      setIsEditing(false);
    }
  }, [notifications]);

  React.useEffect(() => {
    const visibleMailboxIds = new Set(systemUpdateItems.map((item) => String(item.id)));
    setSelectedMailboxIds((current) => current.filter((id) => visibleMailboxIds.has(id)));

    if (systemUpdateItems.length === 0) {
      setIsMailboxEditing(false);
    }
  }, [systemUpdateItems]);

  const handleStartEditing = React.useCallback(() => {
    if (notifications.length === 0) {
      return;
    }

    setSelectedIds(unreadNotifications.map((item) => String(item?.id || "")).filter(Boolean));
    setIsEditing(true);
  }, [notifications.length, unreadNotifications]);

  const handleCancelEditing = React.useCallback(() => {
    setSelectedIds([]);
    setIsEditing(false);
  }, []);

  const handleToggleSelect = React.useCallback((notification) => {
    const notificationId = String(notification?.id || "");
    if (!notificationId) {
      return;
    }

    setSelectedIds((current) =>
      current.includes(notificationId)
        ? current.filter((id) => id !== notificationId)
        : [...current, notificationId],
    );
  }, []);

  const handleMarkSelectedRead = React.useCallback(async () => {
    if (readTargets.length === 0) {
      return;
    }

    setActionBusy(true);

    try {
      if (!hasSelection) {
        setSelectedIds(readTargetIds);
      }

      if (readActionMode === "unread") {
        await Promise.all(readTargets.map((item) => markActivityNotificationUnread(item)));
      } else {
        await markAllActivityNotificationsRead(readTargets);
      }

      if (hasSelection) {
        setSelectedIds([]);
        setIsEditing(false);
      }
    } catch {
      Alert.alert("Unable to update activity state", "Please try again.");
    } finally {
      setActionBusy(false);
    }
  }, [hasSelection, readActionMode, readTargetIds, readTargets]);

  const handleDeleteSelectedConfirmed = React.useCallback(async () => {
    setActionBusy(true);

    try {
      await deleteActivityNotificationsRemote(
        deleteTargets.map((item) => String(item?.id || "")).filter(Boolean),
      );
      await deleteAllActivityNotifications(deleteTargets);
      setSelectedIds([]);
      setIsEditing(false);
    } catch (error) {
      console.warn("[activity.delete] Failed to delete selected activity items", {
        itemIds: deleteTargets.map((item) => String(item?.id || "")).filter(Boolean),
        message: error?.message || String(error),
      });
      Alert.alert(
        "Unable to delete activity",
        getDeleteErrorMessage(error, "Please try again."),
      );
    } finally {
      setActionBusy(false);
    }
  }, [deleteTargets]);

  const handleDeleteSelected = React.useCallback(() => {
    if (deleteTargets.length === 0) {
      return;
    }

    Alert.alert(
      hasSelection ? "Delete selected activity?" : "Delete all activity?",
      hasSelection
        ? "This will remove the selected activity items from your list."
        : "This will remove all activity items from your list.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: hasSelection ? "Delete" : "Delete All",
          style: "destructive",
          onPress: () => {
            handleDeleteSelectedConfirmed().catch(() => {});
          },
        },
      ],
    );
  }, [deleteTargets.length, handleDeleteSelectedConfirmed, hasSelection]);

  const selectedMailboxItems = React.useMemo(() => {
    if (selectedMailboxIds.length === 0) {
      return [];
    }

    const selectedMailboxIdSet = new Set(selectedMailboxIds);
    return systemUpdateItems.filter((item) => selectedMailboxIdSet.has(String(item.id)));
  }, [selectedMailboxIds, systemUpdateItems]);
  const selectedMailboxIdSet = React.useMemo(
    () => new Set(selectedMailboxIds),
    [selectedMailboxIds],
  );
  const mailboxDeleteTargets = selectedMailboxItems;
  const mailboxDeleteDisabled = mailboxDeleteTargets.length === 0;

  const handleStartMailboxEditing = React.useCallback(() => {
    if (systemUpdateItems.length === 0) {
      return;
    }

    setSelectedMailboxIds(systemUpdateItems.map((item) => String(item?.id || "")).filter(Boolean));
    setIsMailboxEditing(true);
  }, [systemUpdateItems]);

  const handleCancelMailboxEditing = React.useCallback(() => {
    setSelectedMailboxIds([]);
    setIsMailboxEditing(false);
  }, []);

  const handleToggleMailboxSelect = React.useCallback((item) => {
    const itemId = String(item?.id || "");
    if (!itemId) {
      return;
    }

    setSelectedMailboxIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    );
  }, []);

  const handleDeleteMailboxSelectedConfirmed = React.useCallback(async () => {
    try {
      await deleteMailboxNotificationsRemote(mailboxDeleteTargets);
      const nextIds = await deleteSystemUpdateItems(user?.id, mailboxDeleteTargets);
      setDeletedSystemUpdateIds(nextIds);
      setSelectedMailboxIds([]);
      setIsMailboxEditing(false);
    } catch (error) {
      console.warn("[mailbox.delete] Failed to delete system update items", {
        itemIds: mailboxDeleteTargets.map((item) => String(item?.id || "")).filter(Boolean),
        message: error?.message || String(error),
      });
      Alert.alert(
        "Unable to delete system updates",
        getDeleteErrorMessage(error, "Please try again."),
      );
    }
  }, [mailboxDeleteTargets, user?.id]);

  const handleDeleteActivityItem = React.useCallback(async (item) => {
    const itemId = String(item?.id || "");
    if (!itemId) {
      throw new Error("Activity notification id is required");
    }

    await deleteActivityNotificationsRemote([itemId]);
    await deleteActivityNotification(item);
  }, []);

  const handleDeleteMailboxSelected = React.useCallback(() => {
    if (mailboxDeleteTargets.length === 0) {
      return;
    }

    Alert.alert(
      "Delete selected updates?",
      "This will remove the selected system updates from your list.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            handleDeleteMailboxSelectedConfirmed().catch(() => {});
          },
        },
      ],
    );
  }, [handleDeleteMailboxSelectedConfirmed, mailboxDeleteTargets.length]);

  const renderActivityRow = React.useCallback(
    ({ item }) => (
      <ActivityRow
        item={item}
        viewedAt={viewedAt}
        isEditing={isEditing}
        isSelected={selectedIdSet.has(String(item.id))}
        onToggleSelect={handleToggleSelect}
        onDeleteItem={handleDeleteActivityItem}
      />
    ),
    [handleDeleteActivityItem, handleToggleSelect, isEditing, selectedIdSet, viewedAt],
  );

  if (isLoading && notifications.length === 0 && !initialLoadTimedOut) {
    return <LoadingState />;
  }

  if (initialLoadTimedOut && notifications.length === 0) {
    return (
      <ErrorState
        error={{
          message:
            "The activity feed is taking too long to respond. Check the preview backend and app base URL, then try again.",
        }}
        onRetry={() => handleRefresh()}
      />
    );
  }

  if (isError && notifications.length === 0) {
    return <ErrorState error={error} onRetry={() => handleRefresh()} />;
  }

  return (
    <View style={styles.screen}>
      <MailboxModal
        visible={isMailboxVisible}
        onClose={() => setIsMailboxVisible(false)}
        items={systemUpdateItems}
        summary={systemUpdateSummary}
        loading={systemUpdatesLoading}
        onRefresh={handleRefresh}
        insets={insets}
        isEditing={isMailboxEditing}
        onStartEditing={handleStartMailboxEditing}
        onCancelEditing={handleCancelMailboxEditing}
        onDeleteSelected={handleDeleteMailboxSelected}
        onToggleSelect={handleToggleMailboxSelect}
        selectedIdSet={selectedMailboxIdSet}
        deleteDisabled={mailboxDeleteDisabled}
      />
      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        style={styles.list}
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingBottom: insets.bottom + 110,
        }}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        refreshControl={
          <RefreshControl
            refreshing={isManualRefreshing}
            onRefresh={handleRefresh}
            tintColor={BRAND_PALETTE.accentBold}
          />
        }
        ListHeaderComponent={
          <ListHeader
            notifications={notifications}
            viewedAt={viewedAt}
            mailboxItems={systemUpdateItems}
            mailboxSummary={systemUpdateSummary}
            mailboxLoading={systemUpdatesLoading}
            isEditing={isEditing}
            onStartEditing={handleStartEditing}
            onCancelEditing={handleCancelEditing}
            onMarkSelectedRead={handleMarkSelectedRead}
            onDeleteSelected={handleDeleteSelected}
            onOpenMailbox={() => setIsMailboxVisible(true)}
            readDisabled={readDisabled}
            deleteDisabled={deleteDisabled}
            actionBusy={actionBusy}
          />
        }
        ListEmptyComponent={<EmptyState />}
        renderItem={renderActivityRow}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#EAF6FF",
  },
  list: {
    flex: 1,
  },
  listHeaderWrap: {
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  heroCard: {
    overflow: "hidden",
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    marginBottom: 12,
  },
  heroGlowLarge: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(125,211,252,0.18)",
    top: -32,
    right: -28,
  },
  heroGlowSmall: {
    position: "absolute",
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "rgba(255,255,255,0.1)",
    bottom: -22,
    left: -18,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  heroBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  heroCaption: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    fontWeight: "700",
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900",
    color: "#FFFFFF",
    maxWidth: "92%",
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.8)",
    maxWidth: "94%",
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  statChip: {
    flex: 1,
    minHeight: 68,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: "space-between",
  },
  statChipAccent: {
    width: 24,
    height: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  statChipValue: {
    fontSize: 20,
    fontWeight: "900",
  },
  statChipLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "700",
  },
  insightRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch",
  },
  mailboxCard: {
    flex: 0.9,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.22)",
    justifyContent: "space-between",
  },
  mailboxCardPressed: {
    transform: [{ scale: 0.985 }],
  },
  mailboxStatAccent: {
    width: 20,
    height: 3,
    borderRadius: 999,
    backgroundColor: BRAND_PALETTE.gold,
    marginBottom: 5,
  },
  mailboxCompactHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  mailboxCompactEyebrow: {
    fontSize: 9,
    fontWeight: "800",
    color: BRAND_PALETTE.gold,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  mailboxCompactValue: {
    marginTop: 3,
    fontSize: 19,
    lineHeight: 22,
    fontWeight: "900",
    color: BRAND_PALETTE.deepNavy,
  },
  mailboxCompactLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    color: BRAND_PALETTE.muted,
  },
  mailboxCompactFooter: {
    marginTop: 5,
  },
  mailboxCompactHelper: {
    fontSize: 9,
    lineHeight: 12,
    color: BRAND_PALETTE.accentBold,
    fontWeight: "800",
  },
  insightCard: {
    flex: 1.45,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "rgba(203, 213, 225, 0.7)",
  },
  insightEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: BRAND_PALETTE.muted,
  },
  insightHeadline: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
    color: BRAND_PALETTE.navy,
  },
  insightSubline: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 14,
    color: BRAND_PALETTE.muted,
  },
  sectionHeader: {
    marginTop: 18,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: BRAND_PALETTE.deepNavy,
  },
  headerActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  headerIconButtonPrimary: {
    backgroundColor: "#FFFFFF",
    borderColor: "#BFDBFE",
  },
  headerIconButtonDestructive: {
    backgroundColor: "#FFF1F2",
    borderColor: "#FBCFE8",
  },
  headerIconButtonDisabled: {
    opacity: 0.45,
  },
  headerIconButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  headerTextButton: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  headerTextButtonDisabled: {
    opacity: 0.45,
  },
  headerTextButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  headerTextButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: BRAND_PALETTE.accentBold,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: BRAND_PALETTE.muted,
  },
  itemSeparator: {
    height: 6,
  },
  feedCard: {
    marginHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 11,
    flexDirection: "row",
    shadowColor: "#082032",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  feedCardEditing: {
    borderWidth: 1.5,
  },
  feedCardSelected: {
    shadowOpacity: 0.12,
    elevation: 4,
  },
  feedCardRail: {
    width: 32,
    alignItems: "center",
    marginRight: 8,
  },
  feedCardLine: {
    position: "absolute",
    top: 2,
    bottom: 2,
    width: 2,
    borderRadius: 999,
    opacity: 0.9,
  },
  feedCardIconWrap: {
    marginTop: 3,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  feedCardBody: {
    flex: 1,
  },
  feedCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  feedCardTopActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginLeft: 8,
  },
  activityChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  activityChipText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  activityTimeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  activityTime: {
    fontSize: 10,
    fontWeight: "700",
    color: BRAND_PALETTE.muted,
  },
  selectionCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  selectionCheckboxSelected: {
    backgroundColor: BRAND_PALETTE.accentBold,
    borderColor: BRAND_PALETTE.accentBold,
  },
  feedCardTitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900",
    color: BRAND_PALETTE.deepNavy,
  },
  feedCardDetail: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 15,
    color: BRAND_PALETTE.muted,
  },
  feedCardMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 8,
  },
  metaPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#F4F8FC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  metaPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: BRAND_PALETTE.navy,
  },
  feedCardFooter: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusPillUnread: {
    backgroundColor: "#ECFDF5",
  },
  statusPillRead: {
    backgroundColor: "#F1F5F9",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  statusPillUnreadText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#047857",
  },
  statusPillReadText: {
    fontSize: 10,
    fontWeight: "800",
    color: BRAND_PALETTE.muted,
  },
  swipeHint: {
    flex: 1,
    textAlign: "right",
    fontSize: 9,
    lineHeight: 12,
    color: BRAND_PALETTE.muted,
  },
  swipeAction: {
    width: 176,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  swipeActionTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  swipeActionDetail: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: BRAND_PALETTE.muted,
  },
  mailboxModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(8, 32, 50, 0.48)",
    justifyContent: "flex-end",
  },
  mailboxModalBackdropPressable: {
    flex: 1,
  },
  mailboxModalSheet: {
    maxHeight: "84%",
    backgroundColor: "#F8FBFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  mailboxModalHandle: {
    alignSelf: "center",
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#C7D7E6",
    marginBottom: 12,
  },
  mailboxModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  mailboxModalHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  mailboxModalHeaderCopy: {
    flex: 1,
  },
  mailboxModalEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: BRAND_PALETTE.gold,
  },
  mailboxModalTitle: {
    marginTop: 6,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
    color: BRAND_PALETTE.deepNavy,
  },
  mailboxModalSubtitle: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: BRAND_PALETTE.muted,
    maxWidth: "92%",
  },
  mailboxCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D9E6F2",
  },
  mailboxItemActions: {
    marginTop: 12,
    alignItems: "flex-end",
  },
  mailboxSummaryRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    marginBottom: 14,
  },
  mailboxSummaryChip: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCEAF5",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  mailboxSummaryValue: {
    fontSize: 20,
    lineHeight: 23,
    fontWeight: "900",
    color: BRAND_PALETTE.deepNavy,
  },
  mailboxSummaryLabel: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "800",
    color: BRAND_PALETTE.muted,
    textTransform: "uppercase",
    letterSpacing: 0.45,
  },
  mailboxListContent: {
    paddingBottom: 12,
  },
  mailboxListSeparator: {
    height: 10,
  },
  mailboxStateWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 42,
    gap: 10,
  },
  mailboxStateTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: BRAND_PALETTE.deepNavy,
    textAlign: "center",
  },
  mailboxStateText: {
    fontSize: 13,
    lineHeight: 19,
    color: BRAND_PALETTE.muted,
    textAlign: "center",
    maxWidth: 280,
  },
  mailboxItemCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 11,
  },
  mailboxItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  mailboxItemLead: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  mailboxItemIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  mailboxItemHeaderText: {
    flex: 1,
    gap: 4,
  },
  mailboxItemTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: BRAND_PALETTE.deepNavy,
  },
  mailboxItemTimeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  mailboxItemDetail: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: BRAND_PALETTE.muted,
  },
  mailboxPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  mailboxAccentPill: {
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC",
  },
  mailboxAccentPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#047857",
  },
  mailboxNeutralPill: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  mailboxNeutralPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#1D4ED8",
  },
  mailboxWarningPill: {
    backgroundColor: "#FFF7D6",
    borderColor: "#FCD34D",
  },
  mailboxWarningPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#B45309",
  },
  mailboxWarningPillStrong: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },
  mailboxWarningPillStrongText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#B91C1C",
  },
  stateScreen: {
    flex: 1,
    backgroundColor: "#EAF6FF",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  statePanel: {
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
  },
  stateIconShell: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  stateTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    color: BRAND_PALETTE.deepNavy,
    textAlign: "center",
  },
  stateMessage: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: BRAND_PALETTE.muted,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 18,
    backgroundColor: BRAND_PALETTE.accentBold,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  emptyState: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  emptyPanel: {
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 36,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D7E9F5",
  },
  emptyIconWrap: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
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
    maxWidth: 280,
  },
});
