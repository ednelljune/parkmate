from __future__ import annotations

import csv
import datetime as dt
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterable


ROOT_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT_DIR / ".research" / "parking"
OUT_DIR = ROOT_DIR / "research"
RUN_DATE = dt.date.today().isoformat()
GRID_SIZE = 0.1


BALLARAT_SOURCE_URL = "https://discover.data.vic.gov.au/dataset/car-parking-zones"
BALLARAT_METERS_SOURCE_URL = "https://discover.data.vic.gov.au/dataset/parking-meters"
CASEY_SOURCE_URL = (
    "https://discover.data.vic.gov.au/dataset/city-of-casey-parking-restriction-zones"
)
GEELONG_SOURCE_URL = "https://discover.data.vic.gov.au/dataset/parking-lots"
MELBOURNE_BAYS_URL = "https://discover.data.vic.gov.au/dataset/on-street-parking-bays"
MELBOURNE_BAY_SENSORS_URL = (
    "https://discover.data.vic.gov.au/dataset/on-street-parking-bay-sensors"
)
MELBOURNE_BAY_RESTRICTIONS_URL = (
    "https://discover.data.vic.gov.au/dataset/on-street-car-park-bay-restrictions"
)
MELBOURNE_PAY_STAY_URL = (
    "https://discover.data.vic.gov.au/dataset/pay-stay-parking-restrictions"
)
MELBOURNE_ZONE_LINKS_URL = (
    "https://discover.data.vic.gov.au/dataset/parking-zones-linked-to-street-segments"
)
MELBOURNE_SIGN_PLATES_URL = (
    "https://discover.data.vic.gov.au/dataset/sign-plates-located-in-each-parking-zone"
)
MELBOURNE_ROAD_CORRIDORS_URL = (
    "https://discover.data.vic.gov.au/dataset/road-corridors"
)
VICMAP_FOI_PARKING_AREA_URL = (
    "https://services-ap1.arcgis.com/P744lA0wf4LlBZ84/ArcGIS/rest/services/"
    "Vicmap_Features_of_Interest/FeatureServer/4/query"
)
LOCALITY_SOURCE_URL = (
    "https://spatial.planning.vic.gov.au/gis/rest/services/boundary/MapServer/2"
)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def parse_geo_point(value) -> tuple[float | None, float | None]:
    if isinstance(value, dict):
        lat = safe_float(value.get("lat"))
        lon = safe_float(value.get("lon"))
        return lat, lon
    if isinstance(value, str) and "," in value:
        parts = [part.strip() for part in value.split(",", 1)]
        if len(parts) == 2:
            return safe_float(parts[0]), safe_float(parts[1])
    return None, None


def safe_float(value) -> float | None:
    if value in (None, "", "None"):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def safe_int(value) -> int | None:
    if value in (None, "", "None"):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def truthy_flag(value) -> bool | None:
    if value in (None, "", "None"):
        return None
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "y"}:
        return True
    if text in {"0", "false", "no", "n"}:
        return False
    return None


def compact_text(parts: Iterable[str | None]) -> str:
    items = []
    seen = set()
    for part in parts:
        if not part:
            continue
        text = " ".join(str(part).split())
        if not text:
            continue
        lowered = text.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        items.append(text)
    return " | ".join(items)


def compute_bbox(rings: list[list[list[float]]]) -> tuple[float, float, float, float]:
    min_x = math.inf
    min_y = math.inf
    max_x = -math.inf
    max_y = -math.inf
    for ring in rings:
        for lon, lat in ring:
            min_x = min(min_x, lon)
            min_y = min(min_y, lat)
            max_x = max(max_x, lon)
            max_y = max(max_y, lat)
    return min_x, min_y, max_x, max_y


def point_on_segment(
    px: float,
    py: float,
    ax: float,
    ay: float,
    bx: float,
    by: float,
    eps: float = 1e-9,
) -> bool:
    cross = (py - ay) * (bx - ax) - (px - ax) * (by - ay)
    if abs(cross) > eps:
        return False
    dot = (px - ax) * (px - bx) + (py - ay) * (py - by)
    return dot <= eps


def point_in_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    inside = False
    point_count = len(ring)
    if point_count < 3:
        return False
    for idx in range(point_count):
        x1, y1 = ring[idx]
        x2, y2 = ring[(idx + 1) % point_count]
        if point_on_segment(lon, lat, x1, y1, x2, y2):
            return True
        intersects = ((y1 > lat) != (y2 > lat)) and (
            lon < (x2 - x1) * (lat - y1) / ((y2 - y1) or 1e-12) + x1
        )
        if intersects:
            inside = not inside
    return inside


def point_in_rings(lon: float, lat: float, rings: list[list[list[float]]]) -> bool:
    inside = False
    for ring in rings:
        if point_in_ring(lon, lat, ring):
            inside = not inside
    return inside


class LocalityIndex:
    def __init__(self, localities: list[dict]):
        self.localities = localities
        self.grid = defaultdict(list)
        for idx, locality in enumerate(localities):
            min_x, min_y, max_x, max_y = locality["bbox"]
            min_cell_x = math.floor(min_x / GRID_SIZE)
            max_cell_x = math.floor(max_x / GRID_SIZE)
            min_cell_y = math.floor(min_y / GRID_SIZE)
            max_cell_y = math.floor(max_y / GRID_SIZE)
            for cell_x in range(min_cell_x, max_cell_x + 1):
                for cell_y in range(min_cell_y, max_cell_y + 1):
                    self.grid[(cell_x, cell_y)].append(idx)

    def match(self, lat: float | None, lon: float | None) -> dict | None:
        if lat is None or lon is None:
            return None
        cell = (math.floor(lon / GRID_SIZE), math.floor(lat / GRID_SIZE))
        candidate_ids = self.grid.get(cell, [])
        for idx in candidate_ids:
            locality = self.localities[idx]
            min_x, min_y, max_x, max_y = locality["bbox"]
            if lon < min_x or lon > max_x or lat < min_y or lat > max_y:
                continue
            if point_in_rings(lon, lat, locality["rings"]):
                return locality
        return None


def load_localities() -> list[dict]:
    paths = sorted(RAW_DIR.glob("vic_locality_geometry_wgs84_page*.json"))
    localities = []
    for path in paths:
        data = load_json(path)
        for feature in data["features"]:
            attrs = feature["attributes"]
            rings = feature["geometry"]["rings"]
            localities.append(
                {
                    "locality_name": attrs["LOCALITY_NAME"],
                    "gazetted_locality_name": attrs.get("GAZETTED_LOCALITY_NAME"),
                    "vicnames_id": attrs.get("VICNAMES_ID"),
                    "ufi": attrs.get("UFI"),
                    "pfi": attrs.get("PFI"),
                    "rings": rings,
                    "bbox": compute_bbox(rings),
                }
            )
    return localities


def match_locality(index: LocalityIndex, lat: float | None, lon: float | None) -> dict:
    locality = index.match(lat, lon)
    if locality:
        return locality
    return {
        "locality_name": "",
        "gazetted_locality_name": "",
        "vicnames_id": "",
        "ufi": "",
        "pfi": "",
    }


def load_ballarat_entities(index: LocalityIndex) -> list[dict]:
    records = load_json(RAW_DIR / "ballarat_raw.json")["result"]["records"]
    entities = []
    for record in records:
        lat, lon = parse_geo_point(record.get("geo_point_2d"))
        locality = match_locality(index, lat, lon)
        zone = str(record.get("zone") or "").strip()
        road = record.get("road")
        entities.append(
            {
                "source_owner": "City of Ballarat",
                "source_dataset": "Car Parking Zones",
                "source_url": BALLARAT_SOURCE_URL,
                "entity_kind": "zone",
                "external_id": f"ballarat-{record.get('id') or record.get('_id')}",
                "zone_external_id": str(record.get("id") or record.get("_id") or ""),
                "name": compact_text([f"Zone {zone}" if zone else None, road]),
                "zone_type": f"Zone {zone}" if zone else "",
                "rules_description": compact_text([record.get("comment")]),
                "street": road or "",
                "geometry_kind": "polygon",
                "center_lat": lat,
                "center_lng": lon,
                "capacity_spaces": "",
                "paid": "",
                "time_limit_minutes": "",
                "permit_required": "",
                "bay_external_id": "",
                "sensor_external_id": "",
                "street_segment_id": "",
                "occupancy_status": "",
                "occupancy_updated_at": "",
                "raw_feature_count": 1,
                "locality_name": locality["locality_name"],
                "gazetted_locality_name": locality["gazetted_locality_name"],
                "vicnames_id": locality["vicnames_id"],
                "ufi": locality["ufi"],
                "pfi": locality["pfi"],
            }
        )
    return entities


def load_ballarat_meter_entities(index: LocalityIndex) -> list[dict]:
    records = load_json(RAW_DIR / "ballarat_parking_meters_raw.json")
    entities = []
    for record in records:
        lat, lon = parse_geo_point(record.get("geo_point_2d"))
        locality = match_locality(index, lat, lon)
        entities.append(
            {
                "source_owner": "City of Ballarat",
                "source_dataset": "Parking Meters",
                "source_url": BALLARAT_METERS_SOURCE_URL,
                "entity_kind": "meter",
                "external_id": f"ballarat-meter-{record.get('id')}",
                "zone_external_id": "",
                "name": compact_text([record.get("name"), "Parking Meter"]),
                "zone_type": "Parking Meter",
                "rules_description": compact_text(
                    [
                        f"Payment: {record.get('payment')}" if record.get("payment") else None,
                    ]
                ),
                "street": "",
                "geometry_kind": (
                    record.get("geo_shape", {})
                    .get("geometry", {})
                    .get("type", "Point")
                ),
                "center_lat": lat,
                "center_lng": lon,
                "capacity_spaces": "",
                "paid": True if record.get("payment") else "",
                "time_limit_minutes": "",
                "permit_required": "",
                "bay_external_id": "",
                "sensor_external_id": str(record.get("id") or ""),
                "street_segment_id": "",
                "occupancy_status": "",
                "occupancy_updated_at": "",
                "raw_feature_count": 1,
                "locality_name": locality["locality_name"],
                "gazetted_locality_name": locality["gazetted_locality_name"],
                "vicnames_id": locality["vicnames_id"],
                "ufi": locality["ufi"],
                "pfi": locality["pfi"],
            }
        )
    return entities


def load_casey_entities(index: LocalityIndex) -> list[dict]:
    records = load_json(RAW_DIR / "casey_raw.json")["results"]
    entities = []
    for idx, record in enumerate(records, start=1):
        lat, lon = parse_geo_point(record.get("geo_point_2d"))
        locality = match_locality(index, lat, lon)
        rules = compact_text(
            [
                record.get("restrtype"),
                " ".join(
                    part
                    for part in [record.get("timesop1"), record.get("daysop1")]
                    if part
                ),
                " ".join(
                    part
                    for part in [record.get("timesop2"), record.get("daysop2")]
                    if part
                ),
                f"Exceptions: {record.get('exceptions')}" if record.get("exceptions") else None,
                f"Side: {record.get('sideroad')}" if record.get("sideroad") else None,
                f"Area parking: {record.get('areapark')}" if record.get("areapark") else None,
                f"Car park: {record.get('carpark')}" if record.get("carpark") else None,
                f"Length: {record.get('length')}m" if record.get("length") else None,
            ]
        )
        entities.append(
            {
                "source_owner": "City of Casey",
                "source_dataset": "City of Casey Parking Restriction Zones",
                "source_url": CASEY_SOURCE_URL,
                "entity_kind": "zone_segment",
                "external_id": f"casey-{idx}",
                "zone_external_id": f"casey-{idx}",
                "name": compact_text([record.get("street"), record.get("restrtype")]),
                "zone_type": record.get("restrtype") or "",
                "rules_description": rules,
                "street": record.get("street") or "",
                "geometry_kind": (
                    record.get("geo_shape", {})
                    .get("geometry", {})
                    .get("type", "unknown")
                ),
                "center_lat": lat,
                "center_lng": lon,
                "capacity_spaces": "",
                "paid": "",
                "time_limit_minutes": "",
                "permit_required": "",
                "bay_external_id": "",
                "sensor_external_id": "",
                "street_segment_id": "",
                "occupancy_status": "",
                "occupancy_updated_at": "",
                "raw_feature_count": 1,
                "locality_name": locality["locality_name"],
                "gazetted_locality_name": locality["gazetted_locality_name"],
                "vicnames_id": locality["vicnames_id"],
                "ufi": locality["ufi"],
                "pfi": locality["pfi"],
            }
        )
    return entities


def parse_time_limit_minutes(value: str | None) -> int | None:
    if not value:
        return None
    text = str(value).strip()
    if not text.isdigit():
        return None
    return int(text)


def load_geelong_entities(index: LocalityIndex) -> list[dict]:
    records = load_json(RAW_DIR / "geelong_raw.json")["result"]["records"]
    entities = []
    for idx, record in enumerate(records, start=1):
        lat = safe_float(record.get("latitude"))
        lon = safe_float(record.get("longitude"))
        locality = match_locality(index, lat, lon)
        tariff = record.get("tariffcode")
        entities.append(
            {
                "source_owner": "City of Greater Geelong",
                "source_dataset": "Parking Lots",
                "source_url": GEELONG_SOURCE_URL,
                "entity_kind": "lot",
                "external_id": f"geelong-{record.get('lotcode') or idx}",
                "zone_external_id": str(record.get("lotcode") or idx),
                "name": compact_text([record.get("street"), f"Lot {record.get('lotcode')}"]),
                "zone_type": record.get("baytype") or "",
                "rules_description": compact_text(
                    [
                        f"Bay type: {record.get('baytype')}" if record.get("baytype") else None,
                        (
                            f"Max stay: {record.get('maxstayperiod')} minutes"
                            if record.get("maxstayperiod")
                            else None
                        ),
                        f"Tariff: {tariff}" if tariff else None,
                        (
                            f"Operating hours: {record.get('operatinghourcode')}"
                            if record.get("operatinghourcode")
                            else None
                        ),
                        f"Zone: {record.get('zone')}" if record.get("zone") else None,
                        f"Subzone: {record.get('subzone')}" if record.get("subzone") else None,
                    ]
                ),
                "street": record.get("street") or "",
                "geometry_kind": "point",
                "center_lat": lat,
                "center_lng": lon,
                "capacity_spaces": safe_int(record.get("baycount")) or "",
                "paid": (
                    ""
                    if tariff in (None, "")
                    else str(tariff).strip().lower() != "free"
                ),
                "time_limit_minutes": parse_time_limit_minutes(record.get("maxstayperiod")) or "",
                "permit_required": "",
                "bay_external_id": str(record.get("lotcode") or idx),
                "sensor_external_id": "",
                "street_segment_id": "",
                "occupancy_status": "",
                "occupancy_updated_at": "",
                "raw_feature_count": 1,
                "locality_name": locality["locality_name"],
                "gazetted_locality_name": locality["gazetted_locality_name"],
                "vicnames_id": locality["vicnames_id"],
                "ufi": locality["ufi"],
                "pfi": locality["pfi"],
            }
        )
    return entities


def load_vicmap_parking_area_entities(index: LocalityIndex) -> list[dict]:
    raw_path = RAW_DIR / "vicmap_foi_index_centroid_parking_area_raw.json"
    records = load_json(raw_path).get("features", [])
    entities = []
    for record in records:
        attrs = record.get("attributes", {})
        lat = safe_float(attrs.get("y_coord"))
        lon = safe_float(attrs.get("x_coord"))
        locality = match_locality(index, lat, lon)
        name = str(attrs.get("name") or "").strip()
        parent_name = str(attrs.get("parent_name") or "").strip()
        entities.append(
            {
                "source_owner": "Department of Transport and Planning",
                "source_dataset": "Vicmap Features of Interest (parking area subtype)",
                "source_url": VICMAP_FOI_PARKING_AREA_URL,
                "entity_kind": "parking_area",
                "external_id": f"vicmap-foi-parking-{attrs.get('ufi') or attrs.get('pfi')}",
                "zone_external_id": str(attrs.get("ufi") or attrs.get("pfi") or ""),
                "name": name or parent_name or "Public Parking Area",
                "zone_type": "Parking",
                "rules_description": compact_text(
                    [
                        "Official Vicmap parking area feature.",
                        (
                            f"Parent feature: {parent_name}"
                            if parent_name and parent_name.lower() != name.lower()
                            else None
                        ),
                        "Time limits and fees are not published in this source layer.",
                    ]
                ),
                "street": "",
                "geometry_kind": "centroid",
                "center_lat": lat,
                "center_lng": lon,
                "capacity_spaces": "",
                "paid": "",
                "time_limit_minutes": "",
                "permit_required": "",
                "bay_external_id": "",
                "sensor_external_id": "",
                "street_segment_id": "",
                "occupancy_status": "",
                "occupancy_updated_at": "",
                "raw_feature_count": 1,
                "locality_name": locality["locality_name"],
                "gazetted_locality_name": locality["gazetted_locality_name"],
                "vicnames_id": locality["vicnames_id"],
                "ufi": locality["ufi"],
                "pfi": locality["pfi"],
            }
        )
    return entities


def build_melbourne_signplate_rules() -> dict[str, list[str]]:
    signplates = load_json(RAW_DIR / "melbourne_signplates_raw.json")["result"]["records"]
    grouped = defaultdict(list)
    for record in signplates:
        zone = str(record.get("parkingzone") or "").strip()
        if not zone:
            continue
        display = record.get("restriction_display")
        if not display:
            display = compact_text(
                [
                    record.get("restriction_days"),
                    record.get("time_restrictions_start"),
                    record.get("time_restrictions_finish"),
                ]
            )
        if display:
            grouped[zone].append(display)
    deduped = {}
    for zone, values in grouped.items():
        deduped[zone] = list(dict.fromkeys(values))
    return deduped


def build_melbourne_sensor_lookup() -> dict[str, list[dict]]:
    records = load_json(RAW_DIR / "melbourne_on_street_parking_bay_sensors_raw.json")
    grouped = defaultdict(list)
    for record in records:
        kerbsideid = str(record.get("kerbsideid") or "").strip()
        if not kerbsideid:
            continue
        grouped[kerbsideid].append(record)
    return grouped


def build_melbourne_segment_lookup() -> dict[str, dict]:
    roads = load_json(RAW_DIR / "melbourne_road_corridors_raw.json")["result"]["records"]
    lookup = {}
    for record in roads:
        lat, lon = parse_geo_point(record.get("geo_point_2d"))
        seg_id = str(record.get("seg_id") or "").strip()
        if not seg_id:
            continue
        lookup[seg_id] = {
            "lat": lat,
            "lon": lon,
            "segment_description": record.get("seg_descr"),
            "street_type": record.get("str_type"),
        }
    return lookup


def load_melbourne_bay_entities(index: LocalityIndex) -> list[dict]:
    records = load_json(RAW_DIR / "melbourne_on_street_parking_bays_raw.json")
    sensor_lookup = build_melbourne_sensor_lookup()
    entities = []
    for record in records:
        lat = safe_float(record.get("latitude"))
        lon = safe_float(record.get("longitude"))
        locality = match_locality(index, lat, lon)
        kerbsideid = str(record.get("kerbsideid") or "").strip()
        sensors = sensor_lookup.get(kerbsideid, [])
        zone_numbers = list(
            dict.fromkeys(
                str(sensor.get("zone_number"))
                for sensor in sensors
                if sensor.get("zone_number") not in (None, "")
            )
        )
        statuses = list(
            dict.fromkeys(
                sensor.get("status_description")
                for sensor in sensors
                if sensor.get("status_description")
            )
        )
        latest_status = ""
        latest_timestamp = ""
        if sensors:
            sorted_sensors = sorted(
                sensors,
                key=lambda item: str(item.get("status_timestamp") or ""),
                reverse=True,
            )
            latest_status = sorted_sensors[0].get("status_description") or ""
            latest_timestamp = sorted_sensors[0].get("status_timestamp") or ""

        entities.append(
            {
                "source_owner": "City of Melbourne",
                "source_dataset": "On-street Parking Bays",
                "source_url": MELBOURNE_BAYS_URL,
                "entity_kind": "bay",
                "external_id": (
                    f"melbourne-bay-{kerbsideid}"
                    if kerbsideid
                    else f"melbourne-roadsegment-{record.get('roadsegmentid')}"
                ),
                "zone_external_id": zone_numbers[0] if zone_numbers else "",
                "name": compact_text(
                    [
                        record.get("roadsegmentdescription"),
                        f"Kerbside {kerbsideid}" if kerbsideid else None,
                    ]
                ),
                "zone_type": "On-street Parking Bay",
                "rules_description": compact_text(
                    [
                        (
                            f"Road segment: {record.get('roadsegmentdescription')}"
                            if record.get("roadsegmentdescription")
                            else None
                        ),
                        (
                            f"Linked zone numbers: {', '.join(zone_numbers[:5])}"
                            if zone_numbers
                            else None
                        ),
                        (
                            f"Observed occupancy states: {', '.join(statuses[:5])}"
                            if statuses
                            else None
                        ),
                        (
                            "Restriction export exists but could not be joined reliably from the "
                            "published bay export keys."
                            if not zone_numbers
                            else None
                        ),
                    ]
                ),
                "street": record.get("roadsegmentdescription") or "",
                "geometry_kind": "point",
                "center_lat": lat,
                "center_lng": lon,
                "capacity_spaces": 1,
                "paid": "",
                "time_limit_minutes": "",
                "permit_required": "",
                "bay_external_id": kerbsideid,
                "sensor_external_id": "",
                "street_segment_id": str(record.get("roadsegmentid") or ""),
                "occupancy_status": latest_status,
                "occupancy_updated_at": latest_timestamp,
                "raw_feature_count": 1,
                "locality_name": locality["locality_name"],
                "gazetted_locality_name": locality["gazetted_locality_name"],
                "vicnames_id": locality["vicnames_id"],
                "ufi": locality["ufi"],
                "pfi": locality["pfi"],
            }
        )
    return entities


def load_melbourne_bay_sensor_entities(index: LocalityIndex) -> list[dict]:
    records = load_json(RAW_DIR / "melbourne_on_street_parking_bay_sensors_raw.json")
    entities = []
    for record in records:
        lat, lon = parse_geo_point(record.get("location"))
        locality = match_locality(index, lat, lon)
        kerbsideid = str(record.get("kerbsideid") or "").strip()
        zone_number = (
            str(record.get("zone_number")).strip()
            if record.get("zone_number") not in (None, "")
            else ""
        )
        entities.append(
            {
                "source_owner": "City of Melbourne",
                "source_dataset": "On-street Parking Bay Sensors",
                "source_url": MELBOURNE_BAY_SENSORS_URL,
                "entity_kind": "sensor",
                "external_id": compact_text(
                    [
                        f"melbourne-sensor-zone-{zone_number}" if zone_number else None,
                        f"kerbside-{kerbsideid}" if kerbsideid else None,
                    ]
                ).replace(" | ", "-"),
                "zone_external_id": zone_number,
                "name": compact_text(
                    [
                        f"Zone {zone_number}" if zone_number else None,
                        f"Kerbside {kerbsideid}" if kerbsideid else None,
                        "Bay Sensor",
                    ]
                ),
                "zone_type": "Bay Sensor",
                "rules_description": compact_text(
                    [
                        (
                            f"Live status: {record.get('status_description')}"
                            if record.get("status_description")
                            else None
                        ),
                        (
                            f"Status timestamp: {record.get('status_timestamp')}"
                            if record.get("status_timestamp")
                            else None
                        ),
                    ]
                ),
                "street": "",
                "geometry_kind": "point",
                "center_lat": lat,
                "center_lng": lon,
                "capacity_spaces": 1,
                "paid": "",
                "time_limit_minutes": "",
                "permit_required": "",
                "bay_external_id": kerbsideid,
                "sensor_external_id": kerbsideid,
                "street_segment_id": "",
                "occupancy_status": record.get("status_description") or "",
                "occupancy_updated_at": record.get("status_timestamp") or "",
                "raw_feature_count": 1,
                "locality_name": locality["locality_name"],
                "gazetted_locality_name": locality["gazetted_locality_name"],
                "vicnames_id": locality["vicnames_id"],
                "ufi": locality["ufi"],
                "pfi": locality["pfi"],
            }
        )
    return entities


def load_melbourne_entities(index: LocalityIndex) -> list[dict]:
    zone_links = load_json(RAW_DIR / "melbourne_zone_links_raw.json")["result"]["records"]
    segment_lookup = build_melbourne_segment_lookup()
    signplate_rules = build_melbourne_signplate_rules()

    grouped = defaultdict(
        lambda: {
            "points": [],
            "streets": [],
            "segment_ids": [],
            "descriptions": [],
            "raw_count": 0,
        }
    )

    for record in zone_links:
        parking_zone = str(record.get("parkingzone") or "").strip()
        segment_id = str(record.get("segment_id") or "").strip()
        segment = segment_lookup.get(segment_id)
        if not parking_zone or not segment:
            continue
        locality = match_locality(index, segment["lat"], segment["lon"])
        locality_name = locality["locality_name"]
        grouped[(parking_zone, locality_name)]["points"].append(
            (segment["lat"], segment["lon"])
        )
        grouped[(parking_zone, locality_name)]["streets"].append(record.get("onstreet"))
        grouped[(parking_zone, locality_name)]["segment_ids"].append(segment_id)
        grouped[(parking_zone, locality_name)]["descriptions"].append(
            segment.get("segment_description")
        )
        grouped[(parking_zone, locality_name)]["raw_count"] += 1

    entities = []
    for (parking_zone, locality_name), bucket in grouped.items():
        point_count = len(bucket["points"])
        if point_count == 0:
            continue
        avg_lat = sum(lat for lat, _ in bucket["points"]) / point_count
        avg_lon = sum(lon for _, lon in bucket["points"]) / point_count
        locality = match_locality(index, avg_lat, avg_lon)
        streets = list(dict.fromkeys(street for street in bucket["streets"] if street))
        descriptions = list(
            dict.fromkeys(
                desc for desc in bucket["descriptions"] if desc and desc not in streets
            )
        )
        entities.append(
            {
                "source_owner": "City of Melbourne",
                "source_dataset": "Parking zones linked to street segments",
                "source_url": MELBOURNE_ZONE_LINKS_URL,
                "entity_kind": "zone",
                "external_id": f"melbourne-zone-{parking_zone}-{locality.get('locality_name') or 'UNKNOWN'}",
                "zone_external_id": parking_zone,
                "name": compact_text(
                    [
                        f"Parking Zone {parking_zone}",
                        ", ".join(streets[:3]) if streets else None,
                    ]
                ),
                "zone_type": parking_zone,
                "rules_description": compact_text(
                    signplate_rules.get(parking_zone, [])
                    + descriptions[:3]
                    + [
                        (
                            f"Road corridor source: {MELBOURNE_ROAD_CORRIDORS_URL}"
                            if bucket["segment_ids"]
                            else None
                        ),
                        (
                            f"Sign plate source: {MELBOURNE_SIGN_PLATES_URL}"
                            if signplate_rules.get(parking_zone)
                            else None
                        ),
                    ]
                ),
                "street": ", ".join(streets[:5]),
                "geometry_kind": "street_segment_group",
                "center_lat": round(avg_lat, 8),
                "center_lng": round(avg_lon, 8),
                "capacity_spaces": "",
                "paid": "",
                "time_limit_minutes": "",
                "permit_required": "",
                "bay_external_id": "",
                "sensor_external_id": "",
                "street_segment_id": ",".join(bucket["segment_ids"][:20]),
                "occupancy_status": "",
                "occupancy_updated_at": "",
                "raw_feature_count": bucket["raw_count"],
                "locality_name": locality["locality_name"],
                "gazetted_locality_name": locality["gazetted_locality_name"],
                "vicnames_id": locality["vicnames_id"],
                "ufi": locality["ufi"],
                "pfi": locality["pfi"],
            }
        )
    return entities


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def build_coverage_rows(localities: list[dict], entities: list[dict]) -> list[dict]:
    by_locality = defaultdict(list)
    for entity in entities:
        by_locality[entity["locality_name"]].append(entity)

    rows = []
    for locality in sorted(localities, key=lambda item: item["locality_name"]):
        matched = by_locality.get(locality["locality_name"], [])
        owners = sorted({row["source_owner"] for row in matched})
        datasets = sorted({row["source_dataset"] for row in matched})
        rows.append(
            {
                "locality_name": locality["locality_name"],
                "gazetted_locality_name": locality["gazetted_locality_name"],
                "vicnames_id": locality["vicnames_id"],
                "ufi": locality["ufi"],
                "pfi": locality["pfi"],
                "has_public_parking_data": bool(matched),
                "parking_entity_count": len(matched),
                "source_owner_count": len(owners),
                "source_dataset_count": len(datasets),
                "source_owners": " | ".join(owners),
                "source_datasets": " | ".join(datasets),
            }
        )
    return rows


def write_summary(path: Path, localities: list[dict], entities: list[dict]) -> None:
    matched_entities = [row for row in entities if row["locality_name"]]
    unmatched_entities = [row for row in entities if not row["locality_name"]]
    localities_with_data = len({row["locality_name"] for row in matched_entities})
    entity_counter = Counter(row["source_owner"] for row in entities)
    locality_counter = defaultdict(set)
    for row in matched_entities:
        locality_counter[row["source_owner"]].add(row["locality_name"])

    lines = [
        f"# Victoria Public Parking By Suburb Research ({RUN_DATE})",
        "",
        "## Scope",
        "",
        (
            "This dataset maps the currently gathered official public parking datasets to the "
            "official Victoria locality boundary layer. Victoria still does not publish a single "
            "statewide authoritative parking-zone dataset, so this output reflects the council "
            "datasets available in the workspace on the run date."
        ),
        "",
        "## Sources used",
        "",
        f"- Victoria locality boundaries: {LOCALITY_SOURCE_URL}",
        f"- City of Ballarat Car Parking Zones: {BALLARAT_SOURCE_URL}",
        f"- City of Ballarat Parking Meters: {BALLARAT_METERS_SOURCE_URL}",
        f"- City of Casey Parking Restriction Zones: {CASEY_SOURCE_URL}",
        f"- City of Greater Geelong Parking Lots: {GEELONG_SOURCE_URL}",
        f"- City of Melbourne On-street Parking Bays: {MELBOURNE_BAYS_URL}",
        f"- City of Melbourne On-street Parking Bay Sensors: {MELBOURNE_BAY_SENSORS_URL}",
        f"- City of Melbourne On-street Car Park Bay Restrictions: {MELBOURNE_BAY_RESTRICTIONS_URL}",
        f"- City of Melbourne Pay Stay parking restrictions: {MELBOURNE_PAY_STAY_URL}",
        f"- City of Melbourne Parking zones linked to street segments: {MELBOURNE_ZONE_LINKS_URL}",
        f"- City of Melbourne Sign plates located in each Parking zone: {MELBOURNE_SIGN_PLATES_URL}",
        f"- City of Melbourne Road corridors: {MELBOURNE_ROAD_CORRIDORS_URL}",
        f"- Vicmap Features of Interest parking areas: {VICMAP_FOI_PARKING_AREA_URL}",
        "",
        "## Results",
        "",
        f"- Official Victoria localities processed: {len(localities):,}",
        f"- Parking entities exported: {len(entities):,}",
        f"- Entities matched to an official locality: {len(matched_entities):,}",
        f"- Entities not matched to a locality: {len(unmatched_entities):,}",
        f"- Localities with at least one gathered public parking entity: {localities_with_data:,}",
        "",
        "## Source coverage",
        "",
    ]

    for owner, count in sorted(entity_counter.items()):
        locality_count = len(locality_counter.get(owner, set()))
        lines.append(
            f"- {owner}: {count:,} entities across {locality_count:,} matched localities"
        )

    lines.extend(
        [
            "",
            "## Notes",
            "",
            (
                "- `victoria-public-parking-zones-by-suburb-<date>.csv` is the detailed export. "
                "Ballarat rows include zone polygons and meter points, Casey rows are restriction "
                "segments, Geelong rows are lot references, Melbourne rows include both parking "
                "zones reconstructed from zone-to-segment links and live bay or sensor reference "
                "points, and Vicmap rows add statewide parking-area centroid features."
            ),
            (
                "- `victoria-public-parking-suburb-coverage-<date>.csv` includes all 2,973 "
                "official localities and shows whether the gathered datasets contain at least one "
                "public parking entity in each locality."
            ),
            (
                "- Melbourne bay restrictions and pay-stay datasets were reviewed, but the "
                "published exported keys were not sufficient to attach those restriction rows "
                "reliably to the exported bay geometry in this pass."
            ),
            (
                "- A blank locality on a detailed row means the entity could not be matched from "
                "its centroid to the official locality polygons."
            ),
        ]
    )

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    localities = load_localities()
    locality_index = LocalityIndex(localities)

    entities = []
    entities.extend(load_ballarat_entities(locality_index))
    entities.extend(load_ballarat_meter_entities(locality_index))
    entities.extend(load_casey_entities(locality_index))
    entities.extend(load_geelong_entities(locality_index))
    entities.extend(load_vicmap_parking_area_entities(locality_index))
    entities.extend(load_melbourne_bay_entities(locality_index))
    entities.extend(load_melbourne_bay_sensor_entities(locality_index))
    entities.extend(load_melbourne_entities(locality_index))

    entities.sort(
        key=lambda row: (
            row["locality_name"] or "ZZZZZZ",
            row["source_owner"],
            row["name"],
            row["external_id"],
        )
    )

    coverage_rows = build_coverage_rows(localities, entities)

    detail_path = OUT_DIR / f"victoria-public-parking-zones-by-suburb-{RUN_DATE}.csv"
    coverage_path = OUT_DIR / f"victoria-public-parking-suburb-coverage-{RUN_DATE}.csv"
    summary_path = OUT_DIR / f"victoria-public-parking-research-{RUN_DATE}.md"

    detail_fields = [
        "source_owner",
        "source_dataset",
        "source_url",
        "entity_kind",
        "external_id",
        "zone_external_id",
        "name",
        "zone_type",
        "rules_description",
        "street",
        "geometry_kind",
        "center_lat",
        "center_lng",
        "capacity_spaces",
        "paid",
        "time_limit_minutes",
        "permit_required",
        "bay_external_id",
        "sensor_external_id",
        "street_segment_id",
        "occupancy_status",
        "occupancy_updated_at",
        "raw_feature_count",
        "locality_name",
        "gazetted_locality_name",
        "vicnames_id",
        "ufi",
        "pfi",
    ]
    coverage_fields = [
        "locality_name",
        "gazetted_locality_name",
        "vicnames_id",
        "ufi",
        "pfi",
        "has_public_parking_data",
        "parking_entity_count",
        "source_owner_count",
        "source_dataset_count",
        "source_owners",
        "source_datasets",
    ]

    write_csv(detail_path, entities, detail_fields)
    write_csv(coverage_path, coverage_rows, coverage_fields)
    write_summary(summary_path, localities, entities)

    print(f"Wrote {detail_path}")
    print(f"Wrote {coverage_path}")
    print(f"Wrote {summary_path}")
    print(f"Localities: {len(localities)}")
    print(f"Entities: {len(entities)}")
    print(
        "Matched entities: "
        f"{sum(1 for row in entities if row['locality_name'])}"
    )


if __name__ == "__main__":
    main()
