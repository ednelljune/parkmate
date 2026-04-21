# Victoria Council Parking Source Inventory (2026-04-21)

## Scope

This inventory is the statewide working list for official Victorian council parking datasets. It starts from the latest workspace research export, carries forward the known source URLs for already covered councils, and marks missing councils for source discovery.

- Source export: `victoria-public-parking-zones-by-suburb-2026-04-17.csv`
- Covered councils with official parking data in workspace: 4
- Councils still missing official parking datasets in workspace: 75

## Covered councils

- Ballarat City Council: Car Parking Zones | Parking Meters [direct_public_parking_zones] (906 entities)
- Casey City Council: City of Casey Parking Restriction Zones [direct_public_parking_zones] (4286 entities)
- Greater Geelong City Council: Parking Lots [public_parking_lots] (24 entities)
- Melbourne City Council: On-street Parking Bay Sensors | On-street Parking Bays | Parking zones linked to street segments [public_parking_bays_and_zones] (27895 entities)

## Councils needing discovery

- Alpine Shire Council (regional): needs_discovery, unknown, unknown
- Ararat Rural City Council (regional): needs_discovery, unknown, unknown
- Banyule City Council (metro): needs_discovery, unknown, unknown
- Bass Coast Shire Council (regional): needs_discovery, unknown, unknown
- Baw Baw Shire Council (regional): needs_discovery, unknown, unknown
- Bayside City Council (metro): evidence_found_no_dataset, not_found_yet, unknown_policy_only
- Benalla Rural City Council (regional): needs_discovery, unknown, unknown
- Boroondara City Council (metro): needs_discovery, unknown, unknown
- Borough of Queenscliffe Council (regional): needs_discovery, unknown, unknown
- Brimbank City Council (metro): needs_discovery, unknown, unknown
- Buloke Shire Council (regional): needs_discovery, unknown, unknown
- Campaspe Shire Council (regional): needs_discovery, unknown, unknown
- Cardinia Shire Council (regional): needs_discovery, unknown, unknown
- Central Goldfields Shire Council (regional): needs_discovery, unknown, unknown
- Colac Otway Shire Council (regional): needs_discovery, unknown, unknown
- Corangamite Shire Council (regional): needs_discovery, unknown, unknown
- Darebin City Council (metro): needs_discovery, unknown, unknown
- East Gippsland Shire Council (regional): needs_discovery, unknown, unknown
- Frankston City Council (metro): needs_discovery, unknown, unknown
- Gannawarra Shire Council (regional): needs_discovery, unknown, unknown
- Glen Eira City Council (metro): needs_discovery, unknown, unknown
- Glenelg Shire Council (regional): needs_discovery, unknown, unknown
- Golden Plains Shire Council (regional): needs_discovery, unknown, unknown
- Greater Bendigo City Council (regional): needs_discovery, unknown, unknown
- Greater Dandenong City Council (metro): needs_discovery, unknown, unknown
- Greater Shepparton City Council (regional): needs_discovery, unknown, unknown
- Hepburn Shire Council (regional): needs_discovery, unknown, unknown
- Hindmarsh Shire Council (regional): needs_discovery, unknown, unknown
- Hobsons Bay City Council (metro): needs_discovery, unknown, unknown
- Horsham Rural City Council (regional): needs_discovery, unknown, unknown
- Hume City Council (metro): needs_discovery, unknown, unknown
- Indigo Shire Council (regional): needs_discovery, unknown, unknown
- Kingston City Council (metro): evidence_found_no_dataset, not_found_yet, unknown_parking_program_only
- Knox City Council (metro): needs_discovery, unknown, unknown
- Latrobe City Council (regional): needs_discovery, unknown, unknown
- Loddon Shire Council (regional): needs_discovery, unknown, unknown
- Macedon Ranges Shire Council (regional): needs_discovery, unknown, unknown
- Manningham City Council (metro): needs_discovery, unknown, unknown
- Mansfield Shire Council (regional): needs_discovery, unknown, unknown
- Maribyrnong City Council (metro): needs_discovery, unknown, unknown
- Maroondah City Council (metro): needs_discovery, unknown, unknown
- Melton City Council (metro): needs_discovery, unknown, unknown
- Merri-bek City Council (metro): needs_discovery, unknown, unknown
- Mildura Rural City Council (regional): needs_discovery, unknown, unknown
- Mitchell Shire Council (regional): needs_discovery, unknown, unknown
- Moira Shire Council (regional): needs_discovery, unknown, unknown
- Monash City Council (metro): evidence_found_no_dataset, not_found_yet, parking_sensors_not_zones_yet
- Moonee Valley City Council (metro): needs_discovery, unknown, unknown
- Moorabool Shire Council (regional): needs_discovery, unknown, unknown
- Mornington Peninsula Shire Council (metro): needs_discovery, unknown, unknown
- Mount Alexander Shire Council (regional): needs_discovery, unknown, unknown
- Moyne Shire Council (regional): needs_discovery, unknown, unknown
- Murrindindi Shire Council (regional): needs_discovery, unknown, unknown
- Nillumbik Shire Council (metro): needs_discovery, unknown, unknown
- Northern Grampians Shire Council (regional): needs_discovery, unknown, unknown
- Port Phillip City Council (metro): evidence_found_no_dataset, pdf_map_only, permit_area_maps_not_public_zones_yet
- Pyrenees Shire Council (regional): needs_discovery, unknown, unknown
- South Gippsland Shire Council (regional): needs_discovery, unknown, unknown
- Southern Grampians Shire Council (regional): needs_discovery, unknown, unknown
- Stonnington City Council (metro): evidence_found_no_dataset, not_found_yet, parking_sensors_not_zones_yet
- Strathbogie Shire Council (regional): needs_discovery, unknown, unknown
- Surf Coast Shire Council (regional): needs_discovery, unknown, unknown
- Swan Hill Rural City Council (regional): needs_discovery, unknown, unknown
- Towong Shire Council (regional): needs_discovery, unknown, unknown
- Wangaratta Rural City Council (regional): needs_discovery, unknown, unknown
- Warrnambool City Council (regional): needs_discovery, unknown, unknown
- Wellington Shire Council (regional): needs_discovery, unknown, unknown
- West Wimmera Shire Council (regional): needs_discovery, unknown, unknown
- Whitehorse City Council (metro): evidence_found_no_dataset, not_found_yet, parking_sensors_not_zones_yet
- Whittlesea City Council (metro): needs_discovery, unknown, unknown
- Wodonga City Council (regional): needs_discovery, unknown, unknown
- Wyndham City Council (metro): needs_discovery, unknown, unknown
- Yarra City Council (metro): evidence_found_no_dataset, pdf_map_only, sensor_map_pdf_not_public_zones_yet
- Yarra Ranges Shire Council (metro): needs_discovery, unknown, unknown
- Yarriambiack Shire Council (regional): needs_discovery, unknown, unknown

## Notes

- `workspace_status=covered` means the latest research export already contains a council-owned parking dataset for that council.
- `collection_target_type` distinguishes direct public parking zone/bay/lot sources from indirect evidence such as sensors or permit-area maps.
- `source_discovery_status=evidence_found_no_dataset` means official council parking pages were found, but no machine-readable dataset endpoint was identified in this pass.
- `source_discovery_status=needs_discovery` means the repo still needs an official source search and an ingestion adapter for that council.
- `launch_priority=metro` is a heuristic to front-load Greater Melbourne councils for launch coverage.

### CSV Format for Council Lines

Each council line follows this three-field CSV-style format: `source_discovery_status, evidence_type, policy_or_feature_notes`

**Field 1 - source_discovery_status:**
- `needs_discovery`: No official parking data source has been identified yet; discovery research is needed.
- `evidence_found_no_dataset`: Official council parking or parking-related pages were found, but no machine-readable zone/bay/lot dataset is available yet.
- `evidence_found_with_dataset`: Official parking data source identified (would typically transition to Covered councils section).

**Field 2 - evidence_type:**
- `unknown`: No evidence gathered yet for this council.
- `not_found_yet`: Discovery search completed but no official parking data source URL found.
- `pdf_map_only`: Official parking data exists only as PDF maps or static documents, not as machine-readable datasets.
- Other findings: Brief description of what was found (e.g., `parking_sensors_only`, `permit_zones_only`).

**Field 3 - policy_or_feature_notes:**
- `unknown`: No policy or feature information available.
- Specific findings: Clarifies limitations or what type of parking data is available, e.g.:
  - `unknown_policy_only`: Only permit/policy information found, no public zone dataset.
  - `parking_sensors_not_zones_yet`: Sensor data exists but zones/bays data not found.
  - `permit_area_maps_not_public_zones_yet`: Permit area maps found but public parking zones data not available.

Examples:
- `Alpine Shire Council (regional): needs_discovery, unknown, unknown` → No discovery yet.
- `Bayside City Council (metro): evidence_found_no_dataset, not_found_yet, unknown_policy_only` → Parking pages found, no dataset, only policy info available.
- `Monash City Council (metro): evidence_found_no_dataset, not_found_yet, parking_sensors_not_zones_yet` → Evidence found (parking pages), but zones data missing; sensors may exist.
