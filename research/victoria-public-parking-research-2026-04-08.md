# Victoria Public Parking By Suburb Research (2026-04-08)

## Scope

This dataset maps the currently gathered official public parking datasets to the official Victoria locality boundary layer. Victoria still does not publish a single statewide authoritative parking-zone dataset, so this output reflects the council datasets available in the workspace on the run date.

## Sources used

- Victoria locality boundaries: https://spatial.planning.vic.gov.au/gis/rest/services/boundary/MapServer/2
- City of Ballarat Car Parking Zones: https://discover.data.vic.gov.au/dataset/car-parking-zones
- City of Ballarat Parking Meters: https://discover.data.vic.gov.au/dataset/parking-meters
- City of Casey Parking Restriction Zones: https://discover.data.vic.gov.au/dataset/city-of-casey-parking-restriction-zones
- City of Greater Geelong Parking Lots: https://discover.data.vic.gov.au/dataset/parking-lots
- City of Melbourne On-street Parking Bays: https://discover.data.vic.gov.au/dataset/on-street-parking-bays
- City of Melbourne On-street Parking Bay Sensors: https://discover.data.vic.gov.au/dataset/on-street-parking-bay-sensors
- City of Melbourne On-street Car Park Bay Restrictions: https://discover.data.vic.gov.au/dataset/on-street-car-park-bay-restrictions
- City of Melbourne Pay Stay parking restrictions: https://discover.data.vic.gov.au/dataset/pay-stay-parking-restrictions
- City of Melbourne Parking zones linked to street segments: https://discover.data.vic.gov.au/dataset/parking-zones-linked-to-street-segments
- City of Melbourne Sign plates located in each Parking zone: https://discover.data.vic.gov.au/dataset/sign-plates-located-in-each-parking-zone
- City of Melbourne Road corridors: https://discover.data.vic.gov.au/dataset/road-corridors

## Results

- Official Victoria localities processed: 2,973
- Parking entities exported: 33,111
- Entities matched to an official locality: 33,097
- Entities not matched to a locality: 14
- Localities with at least one gathered public parking entity: 51

## Source coverage

- City of Ballarat: 906 entities across 5 matched localities
- City of Casey: 4,286 entities across 30 matched localities
- City of Greater Geelong: 24 entities across 1 matched localities
- City of Melbourne: 27,895 entities across 15 matched localities

## Notes

- `victoria-public-parking-zones-by-suburb-<date>.csv` is the detailed export. Ballarat rows include zone polygons and meter points, Casey rows are restriction segments, Geelong rows are lot references, and Melbourne rows include both parking zones reconstructed from zone-to-segment links and live bay or sensor reference points.
- `victoria-public-parking-suburb-coverage-<date>.csv` includes all 2,973 official localities and shows whether the gathered datasets contain at least one public parking entity in each locality.
- Melbourne bay restrictions and pay-stay datasets were reviewed, but the published exported keys were not sufficient to attach those restriction rows reliably to the exported bay geometry in this pass.
- A blank locality on a detailed row means the entity could not be matched from its centroid to the official locality polygons.
