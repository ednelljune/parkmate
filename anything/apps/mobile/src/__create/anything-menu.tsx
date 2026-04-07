import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

export default function ParkMateMenu() {
  return (
    <View pointerEvents="box-none" style={styles.container}>
      <Pressable style={styles.badge}>
        <Image source={require("../../assets/images/parkmate-logo.png")} style={styles.logo} />
        <View>
          <Text style={styles.eyebrow}>PARKMATE</Text>
          <Text style={styles.title}>Street-smart parking</Text>
        </View>
      </Pressable>
    </View>
  );
}

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
});
