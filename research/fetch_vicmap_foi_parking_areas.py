from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen


ROOT_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT_DIR / ".research" / "parking"
OUTPUT_PATH = RAW_DIR / "vicmap_foi_index_centroid_parking_area_raw.json"
BASE_URL = (
    "https://services-ap1.arcgis.com/P744lA0wf4LlBZ84/ArcGIS/rest/services/"
    "Vicmap_Features_of_Interest/FeatureServer/4/query"
)
QUERY_PARAMS = {
    "where": "feature_subtype = 'parking area'",
    "outFields": ",".join(
        [
            "ufi",
            "pfi",
            "feature_type",
            "feature_subtype",
            "name",
            "parent_name",
            "theme1",
            "theme2",
            "x_coord",
            "y_coord",
        ]
    ),
    "returnGeometry": "false",
    "f": "json",
    "resultRecordCount": "2000",
}


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    url = f"{BASE_URL}?{urlencode(QUERY_PARAMS)}"
    with urlopen(url) as response:
        payload = json.load(response)

    if "error" in payload:
        raise RuntimeError(f"Vicmap API error: {payload['error']}")

    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    feature_count = len(payload.get("features", []))
    print(f"Wrote {OUTPUT_PATH}")
    print(f"Features: {feature_count}")


if __name__ == "__main__":
    main()
