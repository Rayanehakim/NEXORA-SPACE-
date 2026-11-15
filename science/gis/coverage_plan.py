"""Offline evidence acquisition plan. Never generate fabricated measurements or scores."""
from __future__ import annotations
import argparse
import json
from pathlib import Path

PLAN_PATH = Path(__file__).resolve().parents[2] / "frontend" / "src" / "data" / "coveragePlan.json"
CATALOG_PATH = Path(__file__).resolve().parents[2] / "frontend" / "src" / "data" / "fixtures" / "catalog.ts"
SITE_IDS = ("earth-atacama", "earth-erfoud", "earth-askja", "earth-haughton", "earth-mcmurdo")
TARGET_IDS = ("mars-jezero", "moon-south-pole")

def load_plan(path: Path = PLAN_PATH) -> dict:
    data = json.loads(path.read_text(encoding="utf8"))
    if set(data["earthSources"]) != set(SITE_IDS):
        raise ValueError("Coverage plan must describe the exact Earth site catalog")
    if set(data["targetSources"]) != set(TARGET_IDS):
        raise ValueError("Coverage plan must describe the exact planetary target catalog")
    seen = set()
    for record in data["processedPairs"]:
        pair = (record["earthSiteId"], record["targetId"])
        if pair in seen or pair[0] not in SITE_IDS or pair[1] not in TARGET_IDS:
            raise ValueError("Invalid or duplicate processed pair")
        if record["status"] != "PROVISIONAL_QA" or record.get("scorePublished") is not False:
            raise ValueError("Do not treat QA results as a published model score")
        seen.add(pair)
    return data

def pairs(plan: dict) -> list[dict]:
    processed = {(r["earthSiteId"],r["targetId"]):r for r in plan["processedPairs"]}
    rows = []
    for site in SITE_IDS:
        for target in TARGET_IDS:
            record = processed.get((site,target))
            rows.append({
                "earthSiteId": site, "targetId": target,
                "status": record["status"] if record else "NOT_ACQUIRED",
                "earthDataset": plan["earthSources"][site]["dataset"],
                "earthCollectionUrl": plan["earthSources"][site]["collectionUrl"],
                "earthSearchHint": plan["earthSources"][site]["searchHint"],
                "planetaryDataset": plan["targetSources"][target]["dataset"],
                "planetaryCollectionUrl": plan["targetSources"][target]["collectionUrl"],
                "planetarySearchHint": plan["targetSources"][target]["searchHint"],
                "evidenceFile": record.get("evidenceFile") if record else None,
                "score": None,
            })
    return rows

def main() -> int:
    parser = argparse.ArgumentParser(description="Show a traceable acquisition checklist for all NEXORA Earth–planet pairs.")
    parser.add_argument("--output", type=Path, help="Write acquisition checklist JSON to a path")
    args = parser.parse_args()
    data = load_plan()
    result = {"version": data["version"], "disclaimer": data["disclaimer"], "pairs": pairs(data)}
    output = json.dumps(result, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output, encoding="utf8")
        print(f"Wrote {len(result['pairs'])} pair acquisition entries to {args.output}")
    else:
        print(output, end="")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
