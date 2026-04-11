# Victoria Suburbs and Localities Research

Research date: 2026-04-08

## What I used

Primary source:
- Victoria `Locality Boundary` ArcGIS layer from the state planning GIS service.
- Layer endpoint: `https://spatial.planning.vic.gov.au/gis/rest/services/boundary/MapServer/2`
- Query used for count: `.../2/query?where=1%3D1&returnCountOnly=true&f=json`

Supporting state metadata:
- `Vicmap Reference - Adminstrative Locality Table`
- Data.Vic dataset metadata updated: 2026-04-08
- Source data created: 2026-01-13
- Dataset page: `https://discover.data.vic.gov.au/dataset/vicmap-reference-adminstrative-locality-table`

Cross-check source:
- ABS `Suburbs and Localities - 2021` allocation file
- ABS page: `https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/allocation-files`

## Key findings

- The official Victoria `Locality Boundary` layer returned `2,973` records on 2026-04-08.
- In Victoria, the official bounded-place concept is generally `locality`; in urban areas these are the suburbs people usually mean.
- The official layer has `2,973` unique `LOCALITY_NAME` values and no duplicate display names.
- `2,957` gazetted names are unique without disambiguators, which means `15` base names are reused and disambiguated by area, for example `ASCOT`, `BELLFIELD`, `BIG HILL`, `MYALL`, and `NEWTOWN`.

## ABS comparison

- The ABS 2021 `Suburbs and Localities` file produced `2,946` Victoria entries before removing special-purpose statistical codes.
- Two of those ABS entries are not real localities:
  - `No usual address (Vic.)`
  - `Migratory - Offshore - Shipping (Vic.)`
- After removing those two statistical-only entries, the ABS file yields `2,944` Victoria suburb/locality names.
- That means the current official Victoria locality layer has `29` more records than the ABS statistical file after special-purpose codes are excluded.
- After normalising name formatting, I found `28` official Victoria localities that are present in the state layer but not represented in the ABS suburb/locality file. Examples include:
  - `BANKSIA PENINSULA`
  - `FIELDSTONE`
  - `TIDAL RIVER`
  - `WOODSIDE NORTH`
  - `BAYNTON EAST`
  - `QUEENSFERRY`
  - `WARANGA`
  - `COOPERS CREEK`

## Output files

- `research/victoria-official-localities-2026-04-08.csv`
- `research/victoria-official-localities-2026-04-08.txt`

The CSV fields are:
- `locality_name`
- `gazetted_locality_name`
- `vicnames_id`
- `ufi`
- `pfi`
- `source`
