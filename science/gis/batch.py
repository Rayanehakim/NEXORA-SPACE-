"""Run reviewed local pair manifests; never publish a score to the frontend automatically."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from science.gis.cli import run
from science.gis.coverage_plan import SITE_IDS, TARGET_IDS

def validate_entry(entry: dict) -> tuple[str, str, Path]:
    earth, target = entry["earthSiteId"], entry["targetId"]
    if earth not in SITE_IDS or target not in TARGET_IDS:
        raise ValueError("Unknown catalog pair")
    manifest = Path(entry["manifest"]).expanduser().resolve()
    if not manifest.is_file():
        raise ValueError(f"Manifest missing: {manifest}")
    spec = json.loads(manifest.read_text(encoding="utf8"))
    if len(spec.get("regions", [])) != 2:
        raise ValueError("Manifest must contain Earth and target regions")
    regions = spec["regions"]
    if [(x.get("regionId"),x.get("body")) for x in regions] != [
        (earth,"earth"), (target,"mars" if target.startswith("mars-") else "moon")
    ]:
        raise ValueError("Manifest IDs/bodies do not match requested selection")
    if spec.get("exportEarthTerrain"):
        raise ValueError("Batch runner does not auto-export drone terrain; review sources first")
    return earth, target, manifest

def run_batch(config: dict, output: Path) -> dict:
    if not isinstance(config.get("jobs"),list):
        raise ValueError("Jobs must be a list")
    seen=set()
    results=[]
    for entry in config["jobs"]:
        pair = (entry["earthSiteId"],entry["targetId"])
        if pair in seen:
            raise ValueError("Duplicate pair")
        seen.add(pair)
        try:
            earth,target,manifest=validate_entry(entry)
            destination=output / f"{earth}--{target}"
            run(manifest,destination)
            results.append(dict(earthSiteId=earth,targetId=target,status="GENERATED_FOR_REVIEW",
                                output=str(destination.resolve()),scorePublished=False))
        except (ValueError,KeyError,TypeError,OSError) as exc:
            results.append(dict(earthSiteId=pair[0],targetId=pair[1],status="NOT_PROCESSED",
                                error=str(exc),scorePublished=False))
    return {"format":"nexora-batch-processing-v1","results":results,
            "disclosure":"Generated model artifacts require scientific review; no result was published to the frontend."}

def main():
    parser=argparse.ArgumentParser(description="Batch-process local reviewed DEM pair manifests.")
    parser.add_argument("--jobs",required=True,type=Path)
    parser.add_argument("--output-dir",required=True,type=Path)
    args=parser.parse_args()
    config=json.loads(args.jobs.read_text(encoding="utf8"))
    result=run_batch(config,args.output_dir)
    args.output_dir.mkdir(parents=True,exist_ok=True)
    (args.output_dir/"review-queue.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf8")
    print(json.dumps(result,indent=2))

if __name__=="__main__":
    main()
