import React from "react";
import { Polygon } from "react-native-maps";
import { ZONE_COLORS } from "@/constants/zoneColors";

export const ZonePolygons = ({ zones, nearbyZones = [], selectedZone }) => {
  return (
    <>
      {zones.map((zone) => {
        if (!zone.boundary_geojson?.coordinates) return null;

        const coordinates = zone.boundary_geojson.coordinates[0].map(
          (coord) => ({
            latitude: coord[1],
            longitude: coord[0],
          }),
        );

        const colors = ZONE_COLORS[zone.zone_type] || ZONE_COLORS["1P"];
        const isSelected = selectedZone?.id === zone.id;
        const isNearby = nearbyZones.some((nz) => nz.id === zone.id);

        // Selected: highest opacity and thick stroke
        // Nearby: medium opacity
        // Far away: low opacity (ghosted)
        const fillOpacity = isSelected ? "0.3" : isNearby ? "0.2" : "0.08";
        const strokeWidth = isSelected ? 4 : 1.5;

        return (
          <Polygon
            key={zone.id}
            coordinates={coordinates}
            fillColor={colors.fill.replace(/0\.\d+/, fillOpacity)}
            strokeColor={colors.stroke}
            strokeWidth={strokeWidth}
            zIndex={isSelected ? 5 : isNearby ? 2 : 1}
          />
        );
      })}
    </>
  );
};
