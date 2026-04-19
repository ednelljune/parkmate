import React, { useCallback } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const PRIVACY_POLICY_URL = "https://getparkmate.app/privacy-policy";

export default function PrivacyPolicyScreen() {
  const handleOpenInBrowser = useCallback(() => {
    Linking.openURL(PRIVACY_POLICY_URL);
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Privacy Policy",
          headerRight: () => (
            <TouchableOpacity onPress={handleOpenInBrowser} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Open</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <WebView
          source={{ uri: PRIVACY_POLICY_URL }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#0F766E" />
            </View>
          )}
          style={styles.webView}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  webView: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  headerButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerButtonText: {
    color: "#0F766E",
    fontSize: 14,
    fontWeight: "700",
  },
});
