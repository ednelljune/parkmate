import React, { useCallback, useEffect, useRef } from "react";
import { View, Text, Animated, PanResponder } from "react-native";
import { MapPinOff } from "lucide-react-native";

export const EmptyStatePanel = ({ insets, onDismiss, topOffset = 0 }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const dismissedRef = useRef(false);

  const dismissPanel = useCallback(() => {
    if (dismissedRef.current) {
      return;
    }

    dismissedRef.current = true;

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -200,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onDismiss) onDismiss();
    });
  }, [onDismiss, opacity, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
          opacity.setValue(1 + gestureState.dy / 100);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -50) {
          dismissPanel();
        } else {
          // Reset position
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
            }),
            Animated.spring(opacity, {
              toValue: 1,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      dismissPanel();
    }, 10000);

    return () => clearTimeout(timer);
  }, [dismissPanel]);

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        top: insets.top + topOffset + 4,
        zIndex: 20,
        elevation: 20,
        backgroundColor: "#FEF3C7",
        borderRadius: 12,
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        transform: [{ translateY }],
        opacity,
      }}
    >
      {/* Swipe indicator */}
      <View
        style={{
          width: 40,
          height: 4,
          backgroundColor: "#D97706",
          borderRadius: 2,
          alignSelf: "center",
          marginBottom: 12,
        }}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <MapPinOff size={24} color="#D97706" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: "#78350F", marginTop: 4 }}>
            Tap "Report Spot" to share a free space.
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};
