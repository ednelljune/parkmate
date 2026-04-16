from __future__ import annotations

import csv
import json
import re
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
RESEARCH_DIR = ROOT_DIR / "research"
OUTPUT_PATH = (
    ROOT_DIR
    / "anything"
    / "apps"
    / "mobile"
    / "src"
    / "constants"
    / "researchedPublicParkingZones.js"
)

ALLOWED_CASEY_TYPES = {
    "1/4P",
    "1/2P",
    "1P",
    "2P",
    "3P",
    "4P",
    "P5 Minute",
    "P10 Minute",
    "P2 Minute",
    "Parking",
}


def latest_research_csv() -> Path:
    matches = sorted(RESEARCH_DIR.glob("victoria-public-parking-zones-by-suburb-*.csv"))
    if not matches:
        raise FileNotFoundError("No suburb parking research export found.")
    return matches[-1]


def to_float(value: str) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed == parsed else None


def clean_rules(value: str) -> str:
    parts = []
    for part in (value or "").split("|"):
        cleaned = " ".join(part.split())
        lowered = cleaned.lower()
        if not cleaned:
            continue
        if "source:" in lowered or "http://" in lowered or "https://" in lowered:
            continue
        parts.append(cleaned)
    return " | ".join(parts)


def derive_type(row: dict[str, str]) -> str:
    dataset = row["source_dataset"]
    zone_type = row["zone_type"].strip()
    rules = clean_rules(row["rules_description"])

    if dataset in {
        "Car Parking Zones",
        "City of Casey Parking Restriction Zones",
        "Parking Lots",
        "Vicmap Features of Interest (parking area subtype)",
    }:
        return zone_type

    if dataset == "Parking zones linked to street segments":
        match = re.search(r"(^|\W)([1-9]\d*P)(\W|$)", rules, re.IGNORECASE)
        if match:
            return match.group(2).upper()
        if "full hour" in rules.lower():
            return "Full Hour"
        return "Parking"

    return zone_type or "Parking"


def include_row(row: dict[str, str]) -> bool:
    dataset = row["source_dataset"]
    entity_kind = row["entity_kind"]
    zone_type = row["zone_type"].strip()
    rules = row["rules_description"] or ""
    rules_lower = rules.lower()
    paid = (row["paid"] or "").lower()

    if dataset == "Parking Meters" or entity_kind in {"meter", "sensor", "bay"}:
        return False

    if dataset == "Car Parking Zones":
        return (
            zone_type == "Zone 2"
            and (
                "no fees" in rules_lower
                or "free all day" in rules_lower
                or "two hours free" in rules_lower
            )
            and "$" not in rules
        )

    if dataset == "City of Casey Parking Restriction Zones":
        return (
            zone_type in ALLOWED_CASEY_TYPES
            and "staff only" not in rules_lower
            and "permit" not in rules_lower
        )

    if dataset == "Parking Lots":
        return (
            zone_type in {"3P", "5Min"}
            and paid != "true"
            and "paid" not in rules_lower
            and "ticket" not in zone_type.lower()
            and zone_type not in {"LZ", "Disabled"}
        )

    if dataset == "Parking zones linked to street segments":
        if re.search(r"(^|\W)(mtr|meter|mp\d+p)(\W|$)", rules_lower):
            return False
        return bool(
            re.search(r"(^|\W)[1-9]\d*p(\W|$)", rules_lower)
            or "full hour" in rules_lower
        )

    if dataset == "Vicmap Features of Interest (parking area subtype)":
        return True

    return False


def build_pin_entry(row: dict[str, str]) -> dict[str, object] | None:
    latitude = to_float(row["center_lat"])
    longitude = to_float(row["center_lng"])
    if latitude is None or longitude is None:
        return None
    if not row["locality_name"]:
        return None

    pin_type = derive_type(row)
    rules = clean_rules(row["rules_description"])
    capacity_spaces = row.get("capacity_spaces") or None

    entry: dict[str, object] = {
        "id": f"researched-{row['external_id']}",
        "name": row["name"] or row["street"] or "Public Parking Zone",
        "type": pin_type,
        "latitude": round(latitude, 7),
        "longitude": round(longitude, 7),
        "rules": rules,
        "sourceOwner": row["source_owner"],
        "sourceDataset": row["source_dataset"],
        "localityName": row["locality_name"],
    }

    if capacity_spaces:
        try:
            entry["capacitySpaces"] = int(float(capacity_spaces))
        except ValueError:
            pass

    return entry


def dedupe(entries: list[dict[str, object]]) -> list[dict[str, object]]:
    seen = set()
    deduped = []
    for entry in entries:
        key = (
            str(entry["name"]).strip().lower(),
            str(entry["type"]).strip().lower(),
            round(float(entry["latitude"]), 5),
            round(float(entry["longitude"]), 5),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(entry)
    return deduped


def main() -> None:
    source_path = latest_research_csv()
    with source_path.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))

    entries = []
    for row in rows:
        if not include_row(row):
            continue
        entry = build_pin_entry(row)
        if entry is not None:
            entries.append(entry)

    entries = dedupe(entries)
    entries.sort(
        key=lambda item: (
            str(item["localityName"]),
            str(item["type"]),
            str(item["name"]),
        )
    )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(entries, ensure_ascii=False, indent=2)
    OUTPUT_PATH.write_text(
        "// Generated from Victoria public parking research. Do not edit manually.\n"
        f"// Source: {source_path.name}\n"
        "export const RESEARCHED_PUBLIC_PARKING_ZONES = "
        f"{payload};\n",
        encoding="utf-8",
    )

    print(f"Wrote {OUTPUT_PATH}")
    print(f"Entries: {len(entries)}")


if __name__ == "__main__":
    main()
