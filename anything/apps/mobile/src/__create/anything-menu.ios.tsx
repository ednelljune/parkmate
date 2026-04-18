import React, { useCallback, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";

import {
  isExpoGoRuntime,
  sendSentryVerificationEvent,
  triggerSentryNativeTestCrash,
} from "@/monitoring/sentry";

const isExpoGo = isExpoGoRuntime();

export default () => {
  const [status, setStatus] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const showExpoGoInfo = useCallback(() => {
    Alert.alert(
      "Expo Go runtime",
      "Native Sentry crash tests are not available in Expo Go. Build a development client or EAS iOS build, then long-press this badge to verify Sentry.",
    );
  }, []);

  const handleSendVerificationEvent = useCallback(async () => {
    setIsSending(true);
    setStatus("Sending Sentry test...");

    try {
      const eventId = await sendSentryVerificationEvent();
      setStatus("Sentry test sent");
      Alert.alert(
        "Sentry test sent",
        `Check Sentry for the message event.\n\nEvent ID: ${eventId || "pending"}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus("Sentry test failed");
      Alert.alert("Sentry test failed", message);
    } finally {
      setIsSending(false);
    }
  }, []);

  const confirmNativeCrash = useCallback(() => {
    Alert.alert(
      "Crash the app?",
      "This triggers Sentry.nativeCrash() and will immediately terminate the app. Use it only in a development build or internal test build.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Crash app now",
          style: "destructive",
          onPress: () => {
            triggerSentryNativeTestCrash();
          },
        },
      ],
    );
  }, []);

  const openVerificationMenu = useCallback(() => {
    if (isExpoGo) {
      showExpoGoInfo();
      return;
    }

    Alert.alert(
      "Sentry verification",
      "Choose a safe message test first. Use the native crash option only when you are ready for the app to close.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Send test event",
          onPress: () => {
            void handleSendVerificationEvent();
          },
        },
        {
          text: "Trigger native crash",
          style: "destructive",
          onPress: confirmNativeCrash,
        },
      ],
    );
  }, [confirmNativeCrash, handleSendVerificationEvent, showExpoGoInfo]);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable
        delayLongPress={450}
        disabled={isSending}
        onLongPress={openVerificationMenu}
        onPress={isExpoGo ? showExpoGoInfo : undefined}
        style={[
          styles.badge,
          isExpoGo && styles.badgeExpo,
          isSending && styles.badgeBusy,
        ]}
      >
        <Image source={require("../../assets/images/parkmate-logo-current.png")} style={styles.logo} />
        <View>
          <Text style={styles.eyebrow}>{isExpoGo ? "PARKMATE PREVIEW" : "PARKMATE"}</Text>
          <Text style={styles.title}>
            {isExpoGo ? "Running in Expo Go" : "Street-smart parking"}
          </Text>
          <Text style={styles.caption}>
            {isExpoGo
              ? "Use a dev build for native Sentry checks"
              : status || "Hold for Sentry verification"}
          </Text>
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 18,
    zIndex: 9999,
  },
  badge: {
    alignItems: "center",
    backgroundColor: "rgba(11, 31, 51, 0.94)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
  },
  badgeBusy: {
    opacity: 0.84,
  },
  badgeExpo: {
    backgroundColor: "rgba(8, 47, 73, 0.96)",
  },
  logo: {
    height: 28,
    width: 28,
  },
  eyebrow: {
    color: "#7dd3fc",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700",
  },
  caption: {
    color: "rgba(248, 250, 252, 0.7)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
});
