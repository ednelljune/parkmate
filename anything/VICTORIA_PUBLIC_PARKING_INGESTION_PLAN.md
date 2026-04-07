# Victoria Public Parking Ingestion Plan

## Current position

Victoria does not appear to publish a single statewide authoritative dataset for all parking zones and all parking bays. The practical path is a council-by-council ingestion pipeline, starting with councils that publish stable geometry and restriction data.

## Recommended rollout

1. City of Melbourne
2. City of Ballarat
3. City of Casey
4. City of Greater Geelong

## Priority source list

### City of Melbourne

- On-street Parking Bays
  - URL: https://discover.data.vic.gov.au/dataset/on-street-parking-bays
  - Use: base geometry for individual bays
  - Shape: bay polygons
- On-street Car Park Bay Restrictions
  - URL: https://discover.data.vic.gov.au/dataset/on-street-car-park-bay-restrictions
  - Use: bay rule text, time windows, restrictions
  - Shape: tabular join data
- On-street Parking Bay Sensors
  - URL: https://discover.data.vic.gov.au/dataset/on-street-parking-bay-sensors
  - Use: optional live occupancy enrichment
  - Shape: sensor points or bay-linked sensor geometry
- Parking zones linked to street segments
  - URL: https://discover.data.vic.gov.au/dataset/parking-zones-linked-to-street-segments
  - Use: zone identity and street linkage
  - Shape: tabular join data
- Sign plates located in each Parking zone
  - URL: https://discover.data.vic.gov.au/dataset/sign-plates-located-in-each-parking-zone
  - Use: sign-derived restriction text enrichment
  - Shape: tabular join data

### City of Ballarat

- Car Parking Zones
  - URL: https://discover.data.vic.gov.au/dataset/car-parking-zones
  - Use: direct zone import
  - Shape: zone polygons

### City of Casey

- City of Casey Parking Restriction Zones
  - URL: https://discover.data.vic.gov.au/dataset/city-of-casey-parking-restriction-zones
  - Use: direct zone import
  - Shape: zone polygons

### City of Greater Geelong

- Parking Lots
  - URL: https://discover.data.vic.gov.au/dataset/parking-lots
  - Use: off-street lot reference dataset
  - Shape: lot polygons or facility geometry
- Parking Sensor - Occupancy
  - URL: https://discover.data.vic.gov.au/dataset/parking-sensor-occupancy
  - Use: optional live occupancy enrichment
  - Shape: sensor-linked occupancy data

## Normalized schema

Use one normalized staging model before writing into app tables.

### Source metadata

- `source_id`
- `owner`
- `dataset_name`
- `source_url`
- `license`
- `fetched_at`
- `source_record_id`

### Parking entity fields

- `entity_kind`
  - `zone`
  - `bay`
  - `lot`
  - `sensor`
- `external_id`
- `name`
- `zone_type`
- `restriction_code`
- `rules_description`
- `capacity_spaces`
- `paid`
- `time_limit_minutes`
- `permit_required`
- `active_from`
- `active_to`

### Geometry

- `boundary_geojson`
- `center_lat`
- `center_lng`

### Linkage keys

- `zone_external_id`
- `bay_external_id`
- `sensor_external_id`
- `street_segment_id`
- `kerbside_id`
- `marker_id`
- `bay_id`

### Telemetry

- `occupancy_status`
- `occupancy_updated_at`
- `availability_count`

## Mapping into current app tables

### `parking_zones`

Use for:
- Ballarat zone polygons
- Casey restriction zone polygons
- Melbourne reconstructed zones or bay-derived grouped zones
- Geelong lots if they are better treated as reference facilities than individual spaces

Current minimum fields:
- `name`
- `zone_type`
- `boundary`
- `capacity_spaces`
- `rules_description`

### Future tables worth adding

- `parking_bays`
  - for Melbourne bay-level geometry
- `parking_sources`
  - source metadata and refresh status
- `parking_occupancy`
  - live sensor state separate from static geometry

## Recommended import pipeline

1. Fetch raw source payloads by council and dataset.
2. Write raw snapshots to disk or a raw table for repeatable debugging.
3. Normalize each dataset into the common schema.
4. Deduplicate by stable external ids before app-table writes.
5. Map normalized entities into `parking_zones` and later `parking_bays`.
6. Keep occupancy ingestion separate from static zone imports.
7. Record source freshness and last successful import per dataset.

## First implementation pass

### Phase 1

- Ballarat direct zone importer
- Casey direct zone importer
- Geelong lot importer

These are the lowest-complexity wins because they look like direct geometry imports.

### Phase 2

- Melbourne bay importer
- Melbourne restrictions joiner
- Melbourne zone reconstruction or grouped bay projection

Melbourne has the richest data, but it is not a simple single-dataset import.

### Phase 3

- Melbourne and Geelong live occupancy enrichment

Keep this separate so failures in live feeds do not break the static parking reference layer.

## Risks

- Councils publish different geometry types and identifiers.
- Restriction strings are not normalized across councils.
- Some datasets are reference-only and not suitable as direct app geometry.
- Live occupancy feeds should not be treated as authoritative zone geometry.

## Next repo steps

1. Add council-specific import adapters under `apps/web/src/app/api/zones/import-*`.
2. Add a normalized staging module that maps raw records into one shared shape.
3. Add source freshness reporting so the app can show which councils are current.
