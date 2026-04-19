import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ShieldCheck } from "lucide-react-native";

import {
  LEGAL_META,
  LEGAL_PLACEHOLDER_KEYS,
  PRIVACY_POLICY_SECTIONS,
} from "@/lib/legalContent";

function SectionCard({ section }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionBody}>{section.body}</Text>
      <View style={styles.bulletList}>
        {section.bullets.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  const hasPlaceholders = LEGAL_PLACEHOLDER_KEYS.length > 0;

  return (
    <>
      <Stack.Screen options={{ title: "Privacy Policy" }} />
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.heroCard}>
            <View style={styles.heroBadge}>
              <ShieldCheck size={15} color="#E0F2FE" />
              <Text style={styles.heroBadgeText}>Privacy</Text>
            </View>
            <Text style={styles.heroTitle}>How ParkMate handles personal information</Text>
            <Text style={styles.heroMeta}>
              Effective {LEGAL_META.effectiveDate}  Last updated {LEGAL_META.lastUpdated}
            </Text>
            <Text style={styles.heroCopy}>
              ParkMate uses account, location, activity, and device data to deliver parking
              discovery, alerts, community reporting, and account features.
            </Text>
          </View>

          {hasPlaceholders ? (
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>Publishing reminder</Text>
              <Text style={styles.warningText}>
                Replace placeholder company, contact, jurisdiction, and date values in public app
                config before shipping this screen.
              </Text>
            </View>
          ) : null}

          {PRIVACY_POLICY_SECTIONS.map((section) => (
            <SectionCard key={section.title} section={section} />
          ))}

          <View style={styles.footerCard}>
            <Text style={styles.footerTitle}>Contact</Text>
            <Text style={styles.footerText}>{LEGAL_META.companyName}</Text>
            <Text style={styles.footerText}>{LEGAL_META.contactEmail}</Text>
            <Text style={styles.footerText}>{LEGAL_META.address}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4FBFF",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 14,
  },
  heroCard: {
    backgroundColor: "#0B1F33",
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 10,
  },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroBadgeText: {
    color: "#F8FAFC",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#F8FAFC",
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 31,
  },
  heroMeta: {
    color: "rgba(226,232,240,0.8)",
    fontSize: 12,
    fontWeight: "700",
  },
  heroCopy: {
    color: "#DCEFFD",
    fontSize: 14,
    lineHeight: 20,
  },
  warningCard: {
    backgroundColor: "#FFF7ED",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#FED7AA",
    gap: 4,
  },
  warningTitle: {
    color: "#9A3412",
    fontSize: 14,
    fontWeight: "900",
  },
  warningText: {
    color: "#9A3412",
    fontSize: 13,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#D9F2FF",
    gap: 8,
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "900",
  },
  sectionBody: {
    color: "#334155",
    fontSize: 14,
    lineHeight: 20,
  },
  bulletList: {
    gap: 8,
    marginTop: 2,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bulletDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    marginTop: 6,
    backgroundColor: "#0EA5E9",
  },
  bulletText: {
    flex: 1,
    color: "#475569",
    fontSize: 13,
    lineHeight: 19,
  },
  footerCard: {
    backgroundColor: "#ECFDF5",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    gap: 5,
  },
  footerTitle: {
    color: "#166534",
    fontSize: 15,
    fontWeight: "900",
  },
  footerText: {
    color: "#166534",
    fontSize: 13,
    lineHeight: 18,
  },
});
