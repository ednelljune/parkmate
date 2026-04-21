from __future__ import annotations

import csv
import datetime as dt
import re
from collections import defaultdict
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
RESEARCH_DIR = ROOT_DIR / "research"
RUN_DATE = dt.date.today().isoformat()

VICTORIA_COUNCILS = [
    "Alpine Shire Council",
    "Ararat Rural City Council",
    "Ballarat City Council",
    "Banyule City Council",
    "Bass Coast Shire Council",
    "Baw Baw Shire Council",
    "Bayside City Council",
    "Benalla Rural City Council",
    "Boroondara City Council",
    "Borough of Queenscliffe Council",
    "Brimbank City Council",
    "Buloke Shire Council",
    "Campaspe Shire Council",
    "Cardinia Shire Council",
    "Casey City Council",
    "Central Goldfields Shire Council",
    "Colac Otway Shire Council",
    "Corangamite Shire Council",
    "Darebin City Council",
    "East Gippsland Shire Council",
    "Frankston City Council",
    "Gannawarra Shire Council",
    "Glen Eira City Council",
    "Glenelg Shire Council",
    "Golden Plains Shire Council",
    "Greater Bendigo City Council",
    "Greater Dandenong City Council",
    "Greater Geelong City Council",
    "Greater Shepparton City Council",
    "Hepburn Shire Council",
    "Hindmarsh Shire Council",
    "Hobsons Bay City Council",
    "Horsham Rural City Council",
    "Hume City Council",
    "Indigo Shire Council",
    "Kingston City Council",
    "Knox City Council",
    "Latrobe City Council",
    "Loddon Shire Council",
    "Macedon Ranges Shire Council",
    "Manningham City Council",
    "Mansfield Shire Council",
    "Maribyrnong City Council",
    "Maroondah City Council",
    "Melbourne City Council",
    "Melton City Council",
    "Merri-bek City Council",
    "Mildura Rural City Council",
    "Mitchell Shire Council",
    "Moira Shire Council",
    "Monash City Council",
    "Moonee Valley City Council",
    "Moorabool Shire Council",
    "Mornington Peninsula Shire Council",
    "Mount Alexander Shire Council",
    "Moyne Shire Council",
    "Murrindindi Shire Council",
    "Nillumbik Shire Council",
    "Northern Grampians Shire Council",
    "Port Phillip City Council",
    "Pyrenees Shire Council",
    "South Gippsland Shire Council",
    "Southern Grampians Shire Council",
    "Stonnington City Council",
    "Strathbogie Shire Council",
    "Surf Coast Shire Council",
    "Swan Hill Rural City Council",
    "Towong Shire Council",
    "Wangaratta Rural City Council",
    "Warrnambool City Council",
    "Wellington Shire Council",
    "West Wimmera Shire Council",
    "Whitehorse City Council",
    "Whittlesea City Council",
    "Wodonga City Council",
    "Wyndham City Council",
    "Yarra City Council",
    "Yarra Ranges Shire Council",
    "Yarriambiack Shire Council",
]

SEED_SOURCE_URLS = {
    "Ballarat City Council": [
        "https://discover.data.vic.gov.au/dataset/car-parking-zones",
        "https://discover.data.vic.gov.au/dataset/parking-meters",
    ],
    "Casey City Council": [
        "https://discover.data.vic.gov.au/dataset/city-of-casey-parking-restriction-zones",
    ],
    "Greater Geelong City Council": [
        "https://discover.data.vic.gov.au/dataset/parking-lots",
        "https://discover.data.vic.gov.au/dataset/parking-sensor-occupancy",
    ],
    "Melbourne City Council": [
        "https://discover.data.vic.gov.au/dataset/on-street-parking-bays",
        "https://discover.data.vic.gov.au/dataset/on-street-parking-bay-sensors",
        "https://discover.data.vic.gov.au/dataset/on-street-car-park-bay-restrictions",
        "https://discover.data.vic.gov.au/dataset/parking-zones-linked-to-street-segments",
        "https://discover.data.vic.gov.au/dataset/sign-plates-located-in-each-parking-zone",
    ],
}

SEED_DISCOVERY_REFERENCES = {
    "Bayside City Council": [
        "https://yoursay.bayside.vic.gov.au/Parking",
    ],
    "Kingston City Council": [
        "https://www.kingston.vic.gov.au/services/roads-traffic-and-parking/parking",
    ],
    "Monash City Council": [
        "https://www.monash.vic.gov.au/Parking-Streets-Footpaths/Parking",
    ],
    "Port Phillip City Council": [
        "https://www.portphillip.vic.gov.au/parking",
        "https://www.portphillip.vic.gov.au/council-services/parking-in-port-phillip/parking-sensors-in-port-phillip/",
        "https://www.portphillip.vic.gov.au/council-services/parking-in-port-phillip/paid-parking",
        "https://www.portphillip.vic.gov.au/council-services/parking-in-port-phillip/parking-permits/where-can-i-park-with-my-permit-and-permit-areas/",
        "https://www.portphillip.vic.gov.au/media/fkcpq3lg/copp_residential-parking-permit-area-1.pdf",
    ],
    "Stonnington City Council": [
        "https://www.stonnington.vic.gov.au/Services/Parking",
        "https://www.stonnington.vic.gov.au/Services/Parking/Parking-sensors",
        "https://www.stonnington.vic.gov.au/Services/Transforming-Stonnington/Smarter-parking",
    ],
    "Whitehorse City Council": [
        "https://www.whitehorse.vic.gov.au/residents/parking",
        "https://www.whitehorse.vic.gov.au/residents/parking/how-parking-monitored",
    ],
    "Yarra City Council": [
        "https://www.yarracity.vic.gov.au/residents/transport/parking",
        "https://www.yarracity.vic.gov.au/residents/transport/parking/parking-sensors-yarra",
        "https://www.yarracity.vic.gov.au/sites/default/files/2024-05/www.yarracity.vic.gov.au/-/media/files/ycc/services/parking/30042018-yarra-sensors.pdf",
    ],
}

SEED_DISCOVERY_METADATA = {
    "Bayside City Council": {
        "evidence_type": "strategy_only",
        "machine_readable_status": "not_found_yet",
        "next_action": "Search for ArcGIS, CKAN, or downloadable parking layers; current lead is only policy/strategy content.",
        "evidence_note": "Official parking strategy and policy references found, but no machine-readable parking dataset identified in this pass.",
    },
    "Kingston City Council": {
        "evidence_type": "parking_page_only",
        "machine_readable_status": "not_found_yet",
        "next_action": "Search Kingston site and broader web for map exports, ArcGIS services, accessible bays, foreshore parking, or permit-area spatial layers.",
        "evidence_note": "Official parking information page found, but no exportable public parking dataset identified in this pass.",
    },
    "Monash City Council": {
        "evidence_type": "parking_page_with_sensors",
        "machine_readable_status": "not_found_yet",
        "next_action": "Search for smart-city or ArcGIS endpoints behind Monash parking and in-ground sensor pages.",
        "evidence_note": "Official parking page confirms in-ground sensors are used, but no machine-readable dataset was found in this pass.",
    },
    "Port Phillip City Council": {
        "evidence_type": "parking_page_with_sensors_and_pdf_maps",
        "machine_readable_status": "pdf_map_only",
        "next_action": "Inspect Port Phillip permit-area PDFs and related assets for source GIS layers or downloadable map services; escalate to data request if no machine-readable source exists.",
        "evidence_note": "Official parking and parking-sensor pages found. Council confirms in-ground sensors and exposes downloadable permit-area PDF maps, but no machine-readable dataset was found in this pass.",
    },
    "Stonnington City Council": {
        "evidence_type": "parking_page_with_sensors_and_program_page",
        "machine_readable_status": "not_found_yet",
        "next_action": "Inspect smart-city and parking program pages for sensor map layers, Prahran Square availability feeds, ArcGIS endpoints, or downloadable parking datasets.",
        "evidence_note": "Official parking, parking-sensor, and smarter-parking program pages found. Council confirms on-street and off-street sensor coverage, but no exportable dataset was found in this pass.",
    },
    "Whitehorse City Council": {
        "evidence_type": "parking_page_with_sensors",
        "machine_readable_status": "not_found_yet",
        "next_action": "Inspect Whitehorse assets for Box Hill parking maps, sensor-area spatial data, or permit-zone layers.",
        "evidence_note": "Official parking pages found. Council states it has over 3,000 in-ground sensors, but no machine-readable parking dataset was found in this pass.",
    },
    "Yarra City Council": {
        "evidence_type": "parking_page_with_sensor_pdf_map",
        "machine_readable_status": "pdf_map_only",
        "next_action": "Inspect the Yarra sensor PDF and related site assets for source GIS layers; if none exist, treat the PDF as a fallback manual extraction input.",
        "evidence_note": "Official parking and parking-sensor pages found, including a downloadable PDF sensor locations map, but no machine-readable dataset was found in this pass.",
    },
}

SEED_COLLECTION_CLASSIFICATION = {
    "Ballarat City Council": {
        "collection_target_type": "direct_public_parking_zones",
        "launch_usefulness": "high",
    },
    "Casey City Council": {
        "collection_target_type": "direct_public_parking_zones",
        "launch_usefulness": "high",
    },
    "Greater Geelong City Council": {
        "collection_target_type": "public_parking_lots",
        "launch_usefulness": "high",
    },
    "Melbourne City Council": {
        "collection_target_type": "public_parking_bays_and_zones",
        "launch_usefulness": "high",
    },
    "Bayside City Council": {
        "collection_target_type": "unknown_policy_only",
        "launch_usefulness": "low",
    },
    "Kingston City Council": {
        "collection_target_type": "unknown_parking_program_only",
        "launch_usefulness": "low",
    },
    "Monash City Council": {
        "collection_target_type": "parking_sensors_not_zones_yet",
        "launch_usefulness": "medium",
    },
    "Port Phillip City Council": {
        "collection_target_type": "permit_area_maps_not_public_zones_yet",
        "launch_usefulness": "medium",
    },
    "Stonnington City Council": {
        "collection_target_type": "parking_sensors_not_zones_yet",
        "launch_usefulness": "medium",
    },
    "Whitehorse City Council": {
        "collection_target_type": "parking_sensors_not_zones_yet",
        "launch_usefulness": "medium",
    },
    "Yarra City Council": {
        "collection_target_type": "sensor_map_pdf_not_public_zones_yet",
        "launch_usefulness": "medium",
    },
}


def latest_research_csv() -> Path:
    matches = sorted(RESEARCH_DIR.glob("victoria-public-parking-zones-by-suburb-*.csv"))
    if not matches:
        raise FileNotFoundError("No Victoria parking research CSV found.")
    return matches[-1]


def normalize_owner(value: str) -> str:
    text = re.sub(r"[^a-z0-9 ]+", " ", str(value or "").lower())
    tokens = [
        token
        for token in text.split()
        if token not in {"council", "city", "of"}
    ]
    return " ".join(tokens)


def council_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    return [
        row
        for row in rows
        if row.get("source_owner")
        and row["source_owner"] != "Department of Transport and Planning"
    ]


def write_csv(path: Path, rows: list[dict[str, object]], fieldnames: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def build_priority(council_name: str) -> str:
    metro_councils = {
        "Banyule City Council",
        "Bayside City Council",
        "Boroondara City Council",
        "Brimbank City Council",
        "Darebin City Council",
        "Frankston City Council",
        "Glen Eira City Council",
        "Greater Dandenong City Council",
        "Hobsons Bay City Council",
        "Hume City Council",
        "Kingston City Council",
        "Knox City Council",
        "Manningham City Council",
        "Maribyrnong City Council",
        "Maroondah City Council",
        "Melton City Council",
        "Merri-bek City Council",
        "Monash City Council",
        "Moonee Valley City Council",
        "Mornington Peninsula Shire Council",
        "Nillumbik Shire Council",
        "Port Phillip City Council",
        "Stonnington City Council",
        "Whitehorse City Council",
        "Whittlesea City Council",
        "Wyndham City Council",
        "Yarra City Council",
        "Yarra Ranges Shire Council",
    }
    return "metro" if council_name in metro_councils else "regional"


def main() -> None:
    source_path = latest_research_csv()
    with source_path.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))

    owners_to_datasets: dict[str, set[str]] = defaultdict(set)
    owners_to_entities: dict[str, int] = defaultdict(int)
    owners_to_urls: dict[str, set[str]] = defaultdict(set)

    for row in council_rows(rows):
        owner = row["source_owner"]
        owners_to_entities[owner] += 1
        if row.get("source_dataset"):
            owners_to_datasets[owner].add(row["source_dataset"])
        if row.get("source_url"):
            owners_to_urls[owner].add(row["source_url"])

    owners_by_normalized_key: dict[str, set[str]] = defaultdict(set)
    for owner in owners_to_entities:
        owners_by_normalized_key[normalize_owner(owner)].add(owner)

    inventory_rows: list[dict[str, object]] = []
    for council_name in VICTORIA_COUNCILS:
        normalized_key = normalize_owner(council_name)
        matched_owners = sorted(owners_by_normalized_key.get(normalized_key, set()))
        matched_datasets = sorted(
            {
                dataset
                for owner in matched_owners
                for dataset in owners_to_datasets.get(owner, set())
            }
        )
        matched_urls = sorted(
            {
                url
                for owner in matched_owners
                for url in owners_to_urls.get(owner, set())
            }
        )
        if not matched_urls:
            matched_urls = SEED_SOURCE_URLS.get(council_name, [])
        discovery_refs = SEED_DISCOVERY_REFERENCES.get(council_name, [])
        discovery_meta = SEED_DISCOVERY_METADATA.get(
            council_name,
            {
                "evidence_type": "",
                "machine_readable_status": "unknown",
                "next_action": "Search for official open-data, ArcGIS, CKAN, or documented API sources.",
                "evidence_note": "",
            },
        )
        classification = SEED_COLLECTION_CLASSIFICATION.get(
            council_name,
            {
                "collection_target_type": "unknown",
                "launch_usefulness": "unknown",
            },
        )

        covered = bool(matched_owners)
        inventory_rows.append(
            {
                "council_name": council_name,
                "launch_priority": build_priority(council_name),
                "workspace_status": "covered" if covered else "missing",
                "source_discovery_status": "seeded" if covered else (
                    "evidence_found_no_dataset" if discovery_refs else "needs_discovery"
                ),
                "collection_target_type": classification["collection_target_type"],
                "launch_usefulness": classification["launch_usefulness"],
                "evidence_type": "dataset_in_workspace" if covered else discovery_meta["evidence_type"],
                "machine_readable_status": "in_workspace" if covered else discovery_meta["machine_readable_status"],
                "matched_source_owners": " | ".join(matched_owners),
                "matched_source_datasets": " | ".join(matched_datasets),
                "matched_source_urls": " | ".join(matched_urls),
                "discovery_reference_urls": " | ".join(discovery_refs),
                "next_action": "" if covered else discovery_meta["next_action"],
                "matched_entity_count": sum(owners_to_entities.get(owner, 0) for owner in matched_owners),
                "notes": (
                    "Official council-owned parking source is already represented in the latest research export."
                    if covered
                    else (
                        "No official council-owned parking dataset has been captured in the workspace yet. "
                        + (
                            discovery_meta["evidence_note"]
                            if discovery_meta["evidence_note"]
                            else "No official parking source lead has been recorded yet."
                        )
                    )
                ),
            }
        )

    covered = [row for row in inventory_rows if row["workspace_status"] == "covered"]
    missing = [row for row in inventory_rows if row["workspace_status"] == "missing"]

    csv_path = RESEARCH_DIR / f"victoria-council-parking-source-inventory-{RUN_DATE}.csv"
    md_path = RESEARCH_DIR / f"victoria-council-parking-source-inventory-{RUN_DATE}.md"

    write_csv(
        csv_path,
        inventory_rows,
        [
            "council_name",
            "launch_priority",
            "workspace_status",
            "source_discovery_status",
            "collection_target_type",
            "launch_usefulness",
            "evidence_type",
            "machine_readable_status",
            "matched_source_owners",
            "matched_source_datasets",
            "matched_source_urls",
            "discovery_reference_urls",
            "next_action",
            "matched_entity_count",
            "notes",
        ],
    )

    lines = [
        f"# Victoria Council Parking Source Inventory ({RUN_DATE})",
        "",
        "## Scope",
        "",
        (
            "This inventory is the statewide working list for official Victorian council parking "
            "datasets. It starts from the latest workspace research export, carries forward the "
            "known source URLs for already covered councils, and marks missing councils for source discovery."
        ),
        "",
        f"- Source export: `{source_path.name}`",
        f"- Covered councils with official parking data in workspace: {len(covered)}",
        f"- Councils still missing official parking datasets in workspace: {len(missing)}",
        "",
        "## Covered councils",
        "",
    ]

    for row in covered:
        lines.append(
            f"- {row['council_name']}: {row['matched_source_datasets']} "
            f"[{row['collection_target_type']}] "
            f"({row['matched_entity_count']} entities)"
        )

    lines.extend(["", "## Councils needing discovery", ""])

    for row in missing:
        lines.append(
            f"- {row['council_name']} ({row['launch_priority']}): "
            f"{row['source_discovery_status']}, {row['machine_readable_status']}, "
            f"{row['collection_target_type']}"
        )

    lines.extend(
        [
            "",
            "## Notes",
            "",
            "- `workspace_status=covered` means the latest research export already contains a council-owned parking dataset for that council.",
            "- `collection_target_type` distinguishes direct public parking zone/bay/lot sources from indirect evidence such as sensors or permit-area maps.",
            "- `source_discovery_status=evidence_found_no_dataset` means official council parking pages were found, but no machine-readable dataset endpoint was identified in this pass.",
            "- `source_discovery_status=needs_discovery` means the repo still needs an official source search and an ingestion adapter for that council.",
            "- `launch_priority=metro` is a heuristic to front-load Greater Melbourne councils for launch coverage.",
        ]
    )

    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"Wrote {csv_path}")
    print(f"Wrote {md_path}")
    print(f"Covered councils: {len(covered)} / {len(VICTORIA_COUNCILS)}")


if __name__ == "__main__":
    main()
