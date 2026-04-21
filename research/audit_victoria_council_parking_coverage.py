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


def main() -> None:
    source_path = latest_research_csv()
    with source_path.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))

    owners_to_datasets: dict[str, set[str]] = defaultdict(set)
    owners_to_entities: dict[str, int] = defaultdict(int)

    for row in council_rows(rows):
        owner = row["source_owner"]
        owners_to_entities[owner] += 1
        dataset = row.get("source_dataset") or ""
        if dataset:
            owners_to_datasets[owner].add(dataset)

    owners_by_normalized_key: dict[str, set[str]] = defaultdict(set)
    for owner in owners_to_entities:
        owners_by_normalized_key[normalize_owner(owner)].add(owner)

    coverage_rows: list[dict[str, object]] = []
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
        entity_count = sum(owners_to_entities.get(owner, 0) for owner in matched_owners)
        coverage_rows.append(
            {
                "council_name": council_name,
                "normalized_key": normalized_key,
                "has_official_public_parking_data": bool(matched_owners),
                "matched_source_owner_count": len(matched_owners),
                "matched_source_owners": " | ".join(matched_owners),
                "matched_source_dataset_count": len(matched_datasets),
                "matched_source_datasets": " | ".join(matched_datasets),
                "matched_entity_count": entity_count,
            }
        )

    covered = [row for row in coverage_rows if row["has_official_public_parking_data"]]
    missing = [row for row in coverage_rows if not row["has_official_public_parking_data"]]

    csv_path = RESEARCH_DIR / f"victoria-council-parking-coverage-{RUN_DATE}.csv"
    md_path = RESEARCH_DIR / f"victoria-council-parking-coverage-{RUN_DATE}.md"

    write_csv(
        csv_path,
        coverage_rows,
        [
            "council_name",
            "normalized_key",
            "has_official_public_parking_data",
            "matched_source_owner_count",
            "matched_source_owners",
            "matched_source_dataset_count",
            "matched_source_datasets",
            "matched_entity_count",
        ],
    )

    lines = [
        f"# Victoria Council Parking Coverage ({RUN_DATE})",
        "",
        "## Scope",
        "",
        (
            "This audit compares the latest Victoria parking research export against the "
            "79 official Victorian councils. It measures whether the workspace currently "
            "contains at least one official council-owned public parking dataset for each council."
        ),
        "",
        f"- Source export: `{source_path.name}`",
        f"- Official Victorian councils tracked: {len(VICTORIA_COUNCILS)}",
        f"- Councils with official parking data in workspace: {len(covered)}",
        f"- Councils without official parking data in workspace: {len(missing)}",
        "",
        "## Covered councils",
        "",
    ]

    for row in covered:
        lines.append(
            f"- {row['council_name']}: {row['matched_source_datasets'] or 'dataset match'}"
        )

    lines.extend(["", "## Missing councils", ""])

    for row in missing:
        lines.append(f"- {row['council_name']}")

    lines.extend(
        [
            "",
            "## Notes",
            "",
            (
                "- This audit excludes the Department of Transport and Planning Vicmap parking "
                "layer because it is not a council-owned source."
            ),
            (
                "- A council is only marked covered when a source owner in the research export "
                "matches that council after normalization."
            ),
        ]
    )

    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"Wrote {csv_path}")
    print(f"Wrote {md_path}")
    print(f"Covered councils: {len(covered)} / {len(VICTORIA_COUNCILS)}")


if __name__ == "__main__":
    main()
