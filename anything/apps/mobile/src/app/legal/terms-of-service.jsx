import React, { useCallback } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const TERMS_OF_SERVICE_URL = "https://getparkmate.app/terms-of-service";

export default function TermsOfServiceScreen() {
  const handleOpenInBrowser = useCallback(() => {
    Linking.openURL(TERMS_OF_SERVICE_URL);
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Terms of Service",
          headerRight: () => (
            <TouchableOpacity onPress={handleOpenInBrowser} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Open</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <WebView
          source={{ uri: TERMS_OF_SERVICE_URL }}
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
