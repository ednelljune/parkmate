from __future__ import annotations

import csv
from collections import Counter, defaultdict
from pathlib import Path

from export_public_parking_pins import include_row, latest_research_csv


ROOT_DIR = Path(__file__).resolve().parents[1]
TEMPLATE_PATH = Path.home() / "Downloads" / "victoria_suburbs_public_parking_template.csv"
OUTPUT_PATH = ROOT_DIR / "research" / "victoria-suburb-app-pin-coverage-audit.csv"


def normalize_name(value: str) -> str:
    return " ".join(str(value or "").strip().upper().split())


def main() -> None:
    if not TEMPLATE_PATH.exists():
        raise FileNotFoundError(f"Template not found: {TEMPLATE_PATH}")

    source_path = latest_research_csv()
    with source_path.open(encoding="utf-8", newline="") as handle:
        detail_rows = list(csv.DictReader(handle))

    with TEMPLATE_PATH.open(encoding="utf-8", newline="") as handle:
        template_rows = list(csv.DictReader(handle))

    included_rows = [
        row for row in detail_rows if row.get("locality_name") and include_row(row)
    ]

    by_locality = defaultdict(list)
    for row in included_rows:
        by_locality[normalize_name(row["locality_name"])].append(row)

    audit_rows = []
    for row in template_rows:
        locality_name = normalize_name(row.get("suburb_locality_name"))
        matches = by_locality.get(locality_name, [])
        datasets = sorted({match["source_dataset"] for match in matches})
        audit_rows.append(
            {
                **row,
                "app_has_parking_pin_data": bool(matches),
                "app_parking_pin_count": len(matches),
                "app_source_dataset_count": len(datasets),
                "app_source_datasets": " | ".join(datasets),
            }
        )

    fieldnames = list(template_rows[0].keys()) + [
        "app_has_parking_pin_data",
        "app_parking_pin_count",
        "app_source_dataset_count",
        "app_source_datasets",
    ]
    with OUTPUT_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(audit_rows)

    total_localities = len(audit_rows)
    covered_localities = sum(1 for row in audit_rows if row["app_has_parking_pin_data"])
    uncovered_localities = total_localities - covered_localities
    dataset_counter = Counter()
    for rows in by_locality.values():
        for row in rows:
            dataset_counter[row["source_dataset"]] += 1

    print(f"Wrote {OUTPUT_PATH}")
    print(f"Template localities: {total_localities}")
    print(f"Localities with app parking pin data: {covered_localities}")
    print(f"Localities without app parking pin data: {uncovered_localities}")
    print(f"Included parking pin rows: {len(included_rows)}")
    print("Included datasets:")
    for dataset, count in sorted(dataset_counter.items()):
        print(f"- {dataset}: {count}")


if __name__ == "__main__":
    main()
