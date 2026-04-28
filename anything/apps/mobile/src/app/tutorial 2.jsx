import { Redirect, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Clock3,
  History,
  MapPin,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react-native";

import { useAuthStore } from "@/utils/auth/store";
import { useFirstLoginTutorial } from "@/utils/firstLoginTutorial";

const TUTORIAL_STEPS = [
  {
    icon: MapPin,
    eyebrow: "Map",
    title: "Start on the live parking map",
    description:
      "Use the Map tab to see nearby parking zones, reported openings, and your location in one place.",
    accentColor: "#0284C7",
    points: [
      "Tap a zone or reported spot to open details.",
      "Use the live map first when you want the fastest view of what is nearby.",
    ],
  },
  {
    icon: Bell,
    eyebrow: "Alerts",
    title: "Watch nearby parking activity",
    description:
      "The Alerts tab surfaces nearby parking spots and zone changes so you do not need to keep scanning the map manually.",
    accentColor: "#0F766E",
    points: [
      "Badge counts show when something new is happening around you.",
      "Open alerts when you want a quicker list view before driving over.",
    ],
  },
  {
    icon: Clock3,
    eyebrow: "Timer",
    title: "Start a timer after you park",
    description:
      "Use the Timer tab to track your session and avoid overstaying in time-limited parking.",
    accentColor: "#CA8A04",
    points: [
      "Set your timer as soon as you park.",
      "Keep the timer running while you shop, work, or meet up.",
    ],
  },
  {
    icon: History,
    eyebrow: "Activity",
    title: "Follow your reports and updates",
    description:
      "The Activity tab shows claims, review outcomes, and system updates tied to your parking contributions.",
    accentColor: "#7C3AED",
    points: [
      "Check activity to see whether your shared parking intel helped another driver.",
      "Use it as your running feed for contribution outcomes.",
    ],
  },
  {
    icon: Trophy,
    eyebrow: "Profile",
    title: "Build trust as you use ParkMate",
    description:
      "Your profile tracks progress, points, and reputation as you report good parking intel and use the app consistently.",
    accentColor: "#DC2626",
    points: [
      "Reliable reports and claims improve your standing.",
      "Visit Profile any time to review your progress and account details.",
    ],
  },
];

const getFirstName = (name, email) => {
  if (typeof name === "string" && name.trim()) {
    return name.trim().split(/\s+/)[0];
  }

  if (typeof email === "string" && email.includes("@")) {
    return email.split("@")[0];
  }

  return "there";
};

export default function TutorialScreen() {
  const insets = useSafeAreaInsets();
  const { isReady, session, user } = useAuthStore();
  const userId = user?.id || session?.user?.id || null;
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const { isLoading, hasCompleted, shouldShowTutorial, completeTutorial } =
    useFirstLoginTutorial(userId);
  const firstName = useMemo(
    () => getFirstName(user?.name, user?.email || session?.user?.email),
    [session?.user?.email, user?.email, user?.name],
  );
  const activeStep = TUTORIAL_STEPS[activeStepIndex];
  const ActiveIcon = activeStep.icon;
  const isLastStep = activeStepIndex === TUTORIAL_STEPS.length - 1;

  const handleFinish = async () => {
    if (!userId || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      await completeTutorial();
      router.replace("/");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isReady || (session && userId && isLoading)) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#0284C7" size="large" />
        <Text style={styles.loadingText}>Loading tutorial...</Text>
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/accounts/login" />;
  }

  if (!userId || hasCompleted || !shouldShowTutorial) {
    return <Redirect href="/" />;
  }

  return (
    <LinearGradient
      colors={["#031525", "#0B1F33", "#114B72"]}
      locations={[0, 0.55, 1]}
      style={styles.screen}
    >
      <View pointerEvents="none" style={styles.backdropOrbTop} />
      <View pointerEvents="none" style={styles.backdropOrbBottom} />

      <ScrollView
        bounces={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 16, 34),
            paddingBottom: Math.max(insets.bottom + 20, 28),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Sparkles color="#FACC15" size={16} />
            <Text style={styles.heroBadgeText}>First-time walkthrough</Text>
          </View>
          <Text style={styles.heroTitle}>Welcome to ParkMate, {firstName}.</Text>
          <Text style={styles.heroDescription}>
            This quick tutorial shows how to read the app, track parking, and
            get value from the main tabs before your first trip.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconShell,
                { backgroundColor: `${activeStep.accentColor}18` },
              ]}
            >
              <ActiveIcon color={activeStep.accentColor} size={24} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardEyebrow}>
                Step {activeStepIndex + 1} of {TUTORIAL_STEPS.length} · {activeStep.eyebrow}
              </Text>
              <Text style={styles.cardTitle}>{activeStep.title}</Text>
            </View>
          </View>

          <Text style={styles.cardDescription}>{activeStep.description}</Text>

          <View style={styles.pointList}>
            {activeStep.points.map((point) => (
              <View key={point} style={styles.pointRow}>
                <ShieldCheck color={activeStep.accentColor} size={18} />
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}
          </View>

          <View style={styles.progressRow}>
            {TUTORIAL_STEPS.map((step, index) => (
              <Pressable
                accessibilityLabel={`Go to tutorial step ${index + 1}`}
                key={step.title}
                onPress={() => setActiveStepIndex(index)}
                style={[
                  styles.progressPill,
                  index === activeStepIndex
                    ? { backgroundColor: step.accentColor, width: 32 }
                    : styles.progressPillInactive,
                ]}
              />
            ))}
          </View>

          <View style={styles.footer}>
            <Pressable
              disabled={activeStepIndex === 0}
              onPress={() =>
                setActiveStepIndex((currentIndex) =>
                  Math.max(0, currentIndex - 1),
                )
              }
              style={[
                styles.secondaryButton,
                activeStepIndex === 0 && styles.secondaryButtonDisabled,
              ]}
            >
              <ChevronLeft color="#0B1F33" size={18} />
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>

            {isLastStep ? (
              <Pressable
                disabled={isSaving}
                onPress={handleFinish}
                style={styles.primaryButton}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Start using ParkMate</Text>
                    <ChevronRight color="#FFFFFF" size={18} />
                  </>
                )}
              </Pressable>
            ) : (
              <Pressable
                onPress={() =>
                  setActiveStepIndex((currentIndex) =>
                    Math.min(TUTORIAL_STEPS.length - 1, currentIndex + 1),
                  )
                }
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Next</Text>
                <ChevronRight color="#FFFFFF" size={18} />
              </Pressable>
            )}
          </View>

          <Pressable disabled={isSaving} onPress={handleFinish} style={styles.skipButton}>
            <Text style={styles.skipButtonText}>Skip tutorial</Text>
          </Pressable>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#082032",
    gap: 14,
  },
  loadingText: {
    color: "#E2E8F0",
    fontSize: 15,
    fontWeight: "600",
  },
  backdropOrbTop: {
    position: "absolute",
    top: -90,
    right: -10,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(56, 189, 248, 0.18)",
  },
  backdropOrbBottom: {
    position: "absolute",
    bottom: -70,
    left: -20,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(16, 185, 129, 0.16)",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  hero: {
    marginBottom: 20,
  },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    marginBottom: 16,
  },
  heroBadgeText: {
    color: "#F8FAFC",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    marginBottom: 10,
    maxWidth: 340,
  },
  heroDescription: {
    color: "#D7E7F4",
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 380,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 28,
    padding: 22,
    shadowColor: "#04111D",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  iconShell: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderText: {
    flex: 1,
  },
  cardEyebrow: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  cardTitle: {
    color: "#0B1F33",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
  },
  cardDescription: {
    color: "#334155",
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 18,
  },
  pointList: {
    gap: 12,
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pointText: {
    flex: 1,
    color: "#0F172A",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 22,
    marginBottom: 20,
  },
  progressPill: {
    height: 8,
    borderRadius: 999,
  },
  progressPillInactive: {
    width: 10,
    backgroundColor: "#CBD5E1",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryButtonDisabled: {
    opacity: 0.45,
  },
  secondaryButtonText: {
    color: "#0B1F33",
    fontSize: 15,
    fontWeight: "700",
  },
  primaryButton: {
    flex: 1.35,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#0284C7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  skipButton: {
    alignSelf: "center",
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  skipButtonText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "700",
  },
});
