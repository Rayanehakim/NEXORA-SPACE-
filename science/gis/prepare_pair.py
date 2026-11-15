"""Prepare *user-provided*, georeferenced elevation DEMs for the existing Task F CLI.

Does not download, infer source identity, or turn imagery into elevation. NASADEM HGT
may be opened directly after extraction from the NASA ZIP. MOLA PDS4 topography IMG
must retain its companion labels/header; inspect CRS, datum and product type first.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject, transform as transform_points, transform_bounds

EARTH_OUTPUT_CRS = 'EPSG:32630'  # Erfoud UTM zone 30N; never apply to Mars
MARS_RADIUS_M = 3396000  # PDS3 MEGT44N000HB.LBL map-projection sphere, 3396.0 km
MARS_OUTPUT_CRS = (
    f'+proj=eqc +lat_ts=0 +lon_0=77.6 +R={MARS_RADIUS_M} +units=m +no_defs'
)


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def _source_identity(prefix, args):
    values = {k: getattr(args, f'{prefix}_{k}') for k in ('source_id', 'source_url', 'version', 'native_resolution_m')}
    if not values['source_id'].strip() or not values['version'].strip():
        raise ValueError(f'{prefix}: exact product ID and version required')
    if not values['source_url'].startswith('https://'):
        raise ValueError(f'{prefix}: HTTPS archive/product URL required')
    if not math.isfinite(values['native_resolution_m']) or values['native_resolution_m'] <= 0:
        raise ValueError(f'{prefix}: positive native resolution required')
    return values


def prepare_one(path, output, body, latitude, longitude, cell_m, pixels,
                source_crs_override=None, interpolation=Resampling.bilinear, earth_output_crs=EARTH_OUTPUT_CRS):
    """Warp to independent metre CRSs and preserve missing pixels as nodata.

    PDS IMG with no embedded CRS must be converted/georeferenced independently;
    do not silently presume terrestrial WGS84, Mars datum, longitude convention,
    or the meaning of an unlabelled elevation band's units.
    """
    path = Path(path)
    with rasterio.open(path) as src:
        if src.count != 1:
            raise ValueError(f'{body}: DEM must have exactly one elevation band')
        if src.crs is None:
            raise ValueError(f'{body}: DEM has no geographic CRS. Georeference the IMG using PDS label/header first')
        if source_crs_override:
            raise ValueError('CRS overrides are disabled: convert/verify source georeferencing explicitly')
        if src.units and src.units[0] not in (None, 'm', 'metre', 'meter', 'meters', 'metres'):
            raise ValueError(f'{body}: verify elevation band units are metres; got {src.units[0]}')
        if body == 'earth':
            target = CRS.from_user_input(earth_output_crs)
            if not target.is_projected or target.linear_units.lower() not in ("metre", "meter", "meters", "metres", "m"):
                raise ValueError("Earth output CRS must be projected in metres")
            # Both EPSG geographic CRS and UTM are accepted for Earth.
            if src.crs.is_geographic and 'mars' in str(src.crs).lower():
                raise ValueError('Earth source CRS incorrectly references Mars')
            src_point = CRS.from_epsg(4326)
        else:
            target = CRS.from_user_input(MARS_OUTPUT_CRS)
            # Guard against accidental WGS84 Earth georeferencing of the Mars IMG.
            if '4326' in str(src.crs) or 'WGS 84' in str(src.crs).upper():
                raise ValueError('Mars input uses Earth WGS84 CRS; re-georeference using PDS Mars datum')
            if src.crs.is_geographic:
                semi_major = src.crs.to_dict().get('a') or src.crs.to_dict().get('R')
                if semi_major is None or not math.isclose(float(semi_major), MARS_RADIUS_M, abs_tol=1):
                    raise ValueError('Mars source geographic CRS must match the selected MOLA label sphere radius (3396000m)')
            src_point = CRS.from_proj4(f'+proj=longlat +R={MARS_RADIUS_M} +no_defs')
        xc, yc = transform_points(src_point, target, [longitude], [latitude])
        width = pixels * cell_m
        dst_transform = from_origin(xc[0] - width / 2, yc[0] + width / 2, cell_m, cell_m)
        # Float sentinel is retained as a proper nodata mask for the Task F read path.
        nodata = -999999.0
        dest = np.full((pixels, pixels), nodata, dtype=np.float32)
        reproject(source=rasterio.band(src, 1), destination=dest,
                  src_transform=src.transform, src_crs=src.crs,
                  src_nodata=src.nodata, dst_transform=dst_transform,
                  dst_crs=target, dst_nodata=nodata, resampling=interpolation,
                  init_dest_nodata=True)
        output.parent.mkdir(parents=True, exist_ok=True)
        with rasterio.open(output, 'w', driver='GTiff', width=pixels, height=pixels,
                           count=1, dtype='float32', crs=target,
                           transform=dst_transform, nodata=nodata,
                           compress='deflate') as dst:
            dst.write(dest, 1)
        valid = np.isfinite(dest) & (dest != nodata)
        # Derive geographic bounds from the actual projected footprint on each body.
        # Earth metres-per-degree approximations are not valid on Mars.
        left, bottom, right, top = rasterio.transform.array_bounds(pixels, pixels, dst_transform)
        west, south, east, north = transform_bounds(target, src_point, left, bottom, right, top, densify_pts=21)
        if not all(math.isfinite(value) for value in (west, south, east, north)) or west >= east or south >= north:
            raise ValueError('Output footprint crosses the antimeridian or has invalid geographic bounds; split the window first')
        return dict(input=str(path.resolve()), sha256=sha256(path), output=str(output.resolve()),
                    outputSha256=sha256(output), sourceCrs=str(src.crs),
                    outputCrs=target.to_string(), sourceNodata=src.nodata,
                    sourceUnits=src.units, validFraction=float(valid.mean()),
                    outputGridCellM=cell_m, centerLonLat=[longitude, latitude],
                    widthM=width, gridPixels=pixels,
                    boundsLonLat=dict(west=west, east=east, south=south, north=north))


def run(args):
    if any(not math.isfinite(x) for x in (args.cell_m, args.earth_lat, args.earth_lon, args.mars_lat, args.mars_lon)):
        raise ValueError('Coordinates and cell scale must be finite')
    if not (-90 < args.earth_lat < 90 and -180 <= args.earth_lon <= 180 and -90 < args.mars_lat < 90 and 0 <= args.mars_lon <= 360):
        raise ValueError('Invalid latitude or longitude bounds')
    if args.pixels < 9 or args.pixels > 256 or args.cell_m < 500:
        raise ValueError('Use 9–256 cells per side and >=500 metre spacing for MOLA-scale comparison')
    if args.roughness_cells < 3 or args.roughness_cells % 2 != 1 or args.roughness_cells > args.pixels:
        raise ValueError('roughness-cells must be odd, >=3, <= grid size')
    for prefix in ('earth', 'mars'):
        identity = _source_identity(prefix, args)
        if identity['native_resolution_m'] > args.cell_m:
            raise ValueError(f'{prefix}: cannot claim resolution finer than native source')
    earth_crs = getattr(args, "earth_crs", EARTH_OUTPUT_CRS)
    earth_region_id = getattr(args, "earth_region_id", "earth-erfoud")
    if earth_region_id not in ("earth-erfoud", "earth-atacama", "earth-askja", "earth-haughton", "earth-mcmurdo"):
        raise ValueError("Unknown Earth site ID")
    if earth_region_id == "earth-atacama" and earth_crs != "EPSG:32719":
        raise ValueError("Atacama study requires EPSG:32719 (southern UTM zone 19)")
    out = Path(args.output_dir).resolve()
    regions = []
    audit = {'warnings': [
        'Verify source metadata, vertical datums, and footprint centers manually before publishing.',
        'Earth and Mars windows have matched metric dimensions, not identical geographic coordinates.',
        'Interpolated pixels and MOLA product gridding do not prove independent measured samples.',
        'Resampling cannot restore fine-scale details absent from MOLA.'
    ], 'inputs': {}}
    for prefix, body, lat, lon, crs in (
        ('earth', 'earth', args.earth_lat, args.earth_lon, earth_crs),
        ('mars', 'mars', args.mars_lat, args.mars_lon, MARS_OUTPUT_CRS)):
        src = Path(getattr(args, f'{prefix}_dem')).resolve()
        if not src.is_file():
            raise ValueError(f'{prefix} DEM missing: {src}')
        dst = out / f'{prefix}-metric.tif'
        report = prepare_one(src, dst, body, lat, lon, args.cell_m, args.pixels, earth_output_crs=earth_crs)
        identity = _source_identity(prefix, args)
        audit['inputs'][prefix] = report
        if report['validFraction'] == 0:
            raise ValueError(f'{prefix}: zero DEM coverage at selected center/scale; inspect input projection and geographic extent')
        source = dict(sourceId=identity['source_id'],
                      name=('NASADEM Earth elevation DEM' if body == 'earth' else 'MOLA MEGDR topography'),
                      url=identity['source_url'], version=identity['version'],
                      nativeResolutionM=identity['native_resolution_m'], evidenceType='MEASURED')
        regions.append(dict(regionId=earth_region_id if body == 'earth' else 'mars-jezero',
                            body=body, raster=dst.name, crs=crs,
                            bounds=report['boundsLonLat'],
                            roughnessWindowM=args.roughness_cells * args.cell_m, source=source))
    manifest = dict(regions=regions, profiles=['terrain_mobility', 'geological_survey'],
                    exportEarthTerrain=False)
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (out / 'preparation-audit.json').write_text(json.dumps(audit, indent=2) + '\n')
    return out, audit


def main():
    p = argparse.ArgumentParser(description='Prepare explicit NASADEM and MOLA DEMs into matched Task F GeoTIFFs')
    p.add_argument('--earth-dem', required=True, type=Path, help='Extracted NASADEM .hgt / georeferenced GeoTIFF')
    p.add_argument('--mars-dem', required=True, type=Path, help='Georeferenced MOLA TOPGRAPHY .img with companion labels or GeoTIFF')
    p.add_argument('--output-dir', required=True, type=Path)
    p.add_argument('--earth-lat', type=float, default=31.42, help='Earth window center latitude; review')
    p.add_argument('--earth-crs', default=EARTH_OUTPUT_CRS, help='Explicit projected Earth CRS, e.g. EPSG:32719 for Atacama')
    p.add_argument('--earth-region-id', default='earth-erfoud', help='Existing catalog Earth region ID')
    p.add_argument('--earth-lon', type=float, default=-4.24)
    p.add_argument('--mars-lat', type=float, default=18.38, help='Proposed Jezero center; review')
    p.add_argument('--mars-lon', type=float, default=77.58)
    p.add_argument('--cell-m', type=float, default=1000, help='Common cell scale, >= 500m')
    p.add_argument('--pixels', type=int, default=64)
    p.add_argument('--roughness-cells', type=int, default=3)
    for prefix in ('earth', 'mars'):
        p.add_argument(f'--{prefix}-source-id', required=True)
        p.add_argument(f'--{prefix}-source-url', required=True)
        p.add_argument(f'--{prefix}-version', required=True)
        p.add_argument(f'--{prefix}-native-resolution-m', required=True, type=float)
    options = p.parse_args()
    try:
        output, audit = run(options)
        print('Prepared:', output)
        print('Valid coverage:', {k: v['validFraction'] for k, v in audit['inputs'].items()})
        print('Inspect preparation-audit.json and manifest.json before processing.')
        print('Then: python3 -m science.gis.cli --manifest', output / 'manifest.json', '--output-dir', output / 'results')
    except (OSError, ValueError, rasterio.errors.RasterioError) as exc:
        p.exit(2, f'DEM preparation failed: {exc}\n')


if __name__ == '__main__':
    main()
