import React, { useState, useEffect, useRef } from "react";
import { View, TouchableOpacity, Animated } from "react-native";
import { MapPinPlus, LocateFixed } from "lucide-react-native";

export const FLOATING_ACTION_BUTTON_SIZE = 56;
export const FLOATING_ACTION_BUTTON_SIDE_OFFSET = 20;
export const FLOATING_ACTION_BUTTON_BOTTOM_MARGIN = 6;

export const ActionButtons = ({
  insets,
  location,
  isReporting,
  onReportPress,
  onRecenterPress,
  tabBarHeight = 0,
}) => {
  const [isIdle, setIsIdle] = useState(true);
  const idleTimerRef = useRef(null);
  const opacityAnim = useRef(new Animated.Value(0.5)).current;

  // Reset idle timer when activity happens
  const resetIdleTimer = () => {
    setIsIdle(false);

    // Animate to full opacity
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Clear existing timer
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    // Set new timer for 10 seconds
    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true);
      // Animate to low opacity
      Animated.timing(opacityAnim, {
        toValue: 0.5,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 10000);
  };

  // Start idle timer on mount
  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, []);

  // Reset timer when reporting state changes
  useEffect(() => {
    if (!isReporting) {
      resetIdleTimer();
    }
  }, [isReporting]);

  const handleReportPress = () => {
    resetIdleTimer();
    onReportPress();
  };

  const handleRecenterPress = () => {
    resetIdleTimer();
    onRecenterPress();
  };

  return (
    <View
      style={{
        position: "absolute",
        bottom: Math.max(insets.bottom, 0) + FLOATING_ACTION_BUTTON_BOTTOM_MARGIN,
        right: FLOATING_ACTION_BUTTON_SIDE_OFFSET,
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 10,
      }}
    >
      {location && (
        <TouchableOpacity
          style={{
            width: FLOATING_ACTION_BUTTON_SIZE,
            height: FLOATING_ACTION_BUTTON_SIZE,
            borderRadius: FLOATING_ACTION_BUTTON_SIZE / 2,
            backgroundColor: "#fff",
            justifyContent: "center",
            alignItems: "center",
            elevation: 6,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
          }}
          onPress={handleRecenterPress}
        >
          <LocateFixed size={22} color="#0f172a" />
        </TouchableOpacity>
      )}

      <Animated.View style={{ opacity: opacityAnim }}>
        <TouchableOpacity
          style={{
            width: FLOATING_ACTION_BUTTON_SIZE,
            height: FLOATING_ACTION_BUTTON_SIZE,
            borderRadius: FLOATING_ACTION_BUTTON_SIZE / 2,
            backgroundColor: isReporting ? "#2563EB" : "#3B82F6",
            justifyContent: "center",
            alignItems: "center",
            elevation: 8,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 6,
          }}
          onPress={handleReportPress}
          disabled={isReporting}
        >
          <MapPinPlus size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};
