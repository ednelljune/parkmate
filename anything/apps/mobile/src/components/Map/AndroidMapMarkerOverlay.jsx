import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

const DEFAULT_FRAME = { width: 52, height: 62 };
const DEFAULT_ANCHOR = { x: 0.5, y: 1 };
const MARKER_PROJECTION_BATCH_SIZE = 48;

const normalizePoint = (point) => {
  if (!point) return null;

  const x = Number(point.x);
  const y = Number(point.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { x, y };
};

const projectMarkers = async (map, markers) => {
  const projectedMarkers = [];

  for (
    let markerIndex = 0;
    markerIndex < markers.length;
    markerIndex += MARKER_PROJECTION_BATCH_SIZE
  ) {
    const markerBatch = markers.slice(
      markerIndex,
      markerIndex + MARKER_PROJECTION_BATCH_SIZE,
    );
    const projectedBatch = await Promise.all(
      markerBatch.map(async (marker) => {
        try {
          const point = normalizePoint(
            await map.pointForCoordinate(marker.coordinate),
          );

          if (!point) {
            return null;
          }

          return {
            ...marker,
            point,
          };
        } catch (error) {
          return null;
        }
      }),
    );

    projectedMarkers.push(...projectedBatch.filter(Boolean));

    if (markerIndex + MARKER_PROJECTION_BATCH_SIZE < markers.length) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return projectedMarkers;
};

export const AndroidMapMarkerOverlay = ({
  mapRef,
  markers,
  revision,
}) => {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [resolvedMarkers, setResolvedMarkers] = useState([]);
  const latestInputsRef = useRef({
    markers,
    width: 0,
    height: 0,
  });
  const resolutionStateRef = useRef({
    mounted: true,
    inFlight: false,
    pending: false,
  });

  useEffect(() => {
    latestInputsRef.current = {
      markers,
      width: layout.width,
      height: layout.height,
    };
  }, [layout.height, layout.width, markers, revision]);

  useEffect(() => {
    return () => {
      resolutionStateRef.current.mounted = false;
    };
  }, []);

  useEffect(() => {
    const resolveMarkers = async () => {
      const resolutionState = resolutionStateRef.current;

      if (resolutionState.inFlight) {
        resolutionState.pending = true;
        return;
      }

      resolutionState.inFlight = true;

      try {
        do {
          resolutionState.pending = false;

          const latestInputs = latestInputsRef.current;
          if (
            !mapRef?.current ||
            latestInputs.width <= 0 ||
            latestInputs.height <= 0 ||
            !latestInputs.markers ||
            latestInputs.markers.length === 0
          ) {
            if (resolutionState.mounted && !resolutionState.pending) {
              setResolvedMarkers([]);
            }
            continue;
          }

          const projectedMarkers = await projectMarkers(
            mapRef.current,
            latestInputs.markers,
          );

          if (resolutionState.mounted && !resolutionState.pending) {
            setResolvedMarkers(projectedMarkers);
          }
        } while (resolutionState.pending && resolutionState.mounted);
      } finally {
        resolutionState.inFlight = false;
      }
    };

    resolveMarkers();
  }, [layout.height, layout.width, mapRef, markers, revision]);

  return (
    <View
      pointerEvents="box-none"
      style={styles.overlay}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setLayout((current) => {
          if (current.width === width && current.height === height) {
            return current;
          }

          return { width, height };
        });
      }}
    >
      {resolvedMarkers.map((marker) => {
        const frame = marker.frame || DEFAULT_FRAME;
        const anchor = marker.anchor || DEFAULT_ANCHOR;
        const left = marker.point.x - frame.width * anchor.x;
        const top = marker.point.y - frame.height * anchor.y;
        const right = left + frame.width;
        const bottom = top + frame.height;
        const isVisible =
          right >= -24 &&
          left <= layout.width + 24 &&
          bottom >= -24 &&
          top <= layout.height + 24;

        if (!isVisible) {
          return null;
        }

        return (
          <Pressable
            key={marker.key}
            onPress={marker.onPress}
            hitSlop={marker.hitSlop || 8}
            style={{
              position: "absolute",
              left,
              top,
              width: frame.width,
              height: frame.height,
              alignItems: "center",
              justifyContent: "flex-start",
              zIndex: marker.zIndex || 0,
            }}
            pointerEvents="auto"
          >
            {marker.render()}
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
});
