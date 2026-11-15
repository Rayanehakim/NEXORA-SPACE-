"""Auditable metre-grid descriptors compatible with Task C.

Input GeoTIFFs MUST have been independently cropped and reprojected to matching
metric square-pixel grids. No georeferencing is manufactured here.
"""
import hashlib
import math
import re
from pathlib import Path

import numpy as np

ALGORITHM = 'terrain-descriptors-v1-grid-1'


def _finite_float(x, name):
    if isinstance(x, bool) or not isinstance(x, (float, int)) or not math.isfinite(x):
        raise ValueError(f'{name} must be a finite number')
    return float(x)


def extract_descriptors(elevation, cell_size_m, roughness_window_m, nodata=None):
    """Central-difference angles, nearest-rank P90, local plane residual std, relief.

    Boundaries are excluded from gradients and from roughness-window centers;
    all contributing neighborhoods must be valid. ValidFraction is raster cell
    coverage (not descriptor-window coverage). Missing pixels block Task C READY.
    """
    z = np.asarray(elevation, dtype=np.float64)
    if z.ndim != 2 or min(z.shape) < 5:
        raise ValueError('DEM must be a 2D grid at least 5 by 5')
    cell = _finite_float(cell_size_m, 'cell_size_m')
    window = _finite_float(roughness_window_m, 'roughness_window_m')
    if cell <= 0 or window < 3 * cell:
        raise ValueError('Grid cell must be positive; roughness window >= 3 cells')
    count = round(window / cell)
    if not math.isclose(window / cell, count, rel_tol=0, abs_tol=1e-7) or count % 2 != 1:
        raise ValueError('Roughness window must equal an odd integer >= 3 times the grid scale')
    if count > min(z.shape):
        raise ValueError('Roughness window exceeds raster')
    valid = np.isfinite(z)
    if nodata is not None and math.isfinite(float(nodata)):
        valid &= z != nodata
    valid_fraction = float(np.count_nonzero(valid) / z.size)
    if not valid.any():
        raise ValueError('DEM contains no valid elevation samples')
    # Compute slope only with the 4 neighboring cells and center present.
    center_valid = valid[1:-1, 1:-1] & valid[:-2, 1:-1] & valid[2:, 1:-1] & valid[1:-1, :-2] & valid[1:-1, 2:]
    dx = (z[1:-1, 2:] - z[1:-1, :-2]) / (2 * cell)
    dy = (z[2:, 1:-1] - z[:-2, 1:-1]) / (2 * cell)
    slope = np.degrees(np.arctan(np.hypot(dx, dy)))[center_valid]
    if slope.size == 0:
        raise ValueError('No complete interior slope neighborhoods')
    slope = np.sort(slope)
    p90 = float(slope[max(0, math.ceil(.9 * slope.size) - 1)])
    # Same linear local detrending in both bodies, no wrapping/padded edges.
    radius = count // 2
    yy, xx = np.mgrid[-radius:radius + 1, -radius:radius + 1]
    design = np.stack((xx.ravel() * cell, yy.ravel() * cell, np.ones(count * count)), axis=1)
    residual_stds = []
    for row in range(radius, z.shape[0] - radius):
        for col in range(radius, z.shape[1] - radius):
            square = z[row - radius:row + radius + 1, col - radius:col + radius + 1]
            if not valid[row - radius:row + radius + 1, col - radius:col + radius + 1].all():
                continue
            heights = square.ravel()
            coefficients = np.linalg.lstsq(design, heights, rcond=None)[0]
            residual_stds.append(float(np.std(heights - design @ coefficients, ddof=0)))
    if not residual_stds:
        raise ValueError('No complete roughness windows')
    return dict(meanSlopeDeg=float(np.mean(slope)), p90SlopeDeg=p90,
                roughnessM=float(np.mean(residual_stds)),
                reliefM=float(np.ptp(z[valid])), validFraction=valid_fraction)


def read_metric_geotiff(path):
    """Read only north-up, non-rotated, metre projected GeoTIFFs."""
    import rasterio
    path = Path(path)
    with rasterio.open(path) as raster:
        if raster.count != 1 or raster.crs is None:
            raise ValueError('Single band and a defined CRS are required')
        units = raster.crs.linear_units.lower() if raster.crs.is_projected else ''
        if units not in ('metre', 'meter', 'metres', 'meters', 'm'):
            raise ValueError(f'Projected horizontal metre CRS required, got {raster.crs} units={units}')
        transform = raster.transform
        if not (math.isclose(transform.b, 0, abs_tol=1e-10) and math.isclose(transform.d, 0, abs_tol=1e-10)
                and transform.a > 0 and transform.e < 0 and math.isclose(transform.a, -transform.e, rel_tol=1e-7)):
            raise ValueError('Raster must be north-up with square metric pixels; reproject offline first')
        z = raster.read(1, masked=True)
        data = z.astype(np.float64).filled(np.nan)
        if not np.isfinite(data).any():
            raise ValueError('No valid terrain samples')
        if data.size > 262144:
            raise ValueError('Crop to <=262144 pixels (e.g. 512x512) before extraction')
        return data, float(transform.a), raster.crs, raster.bounds


def build_feature(region, manifest_dir):
    """Require factual input metadata; never infer a NASA origin from filename."""
    from rasterio.crs import CRS
    required = ['regionId', 'body', 'raster', 'crs', 'bounds', 'roughnessWindowM', 'source']
    if any(key not in region for key in required):
        raise ValueError('Region requires ' + ', '.join(required))
    if region['body'] not in ('earth', 'mars', 'moon'):
        raise ValueError('Invalid planetary body')
    if not isinstance(region['regionId'], str) or not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,63}', region['regionId']):
        raise ValueError('Region ID must be a safe lowercase slug')
    b = region['bounds']
    if (not isinstance(b, dict) or set(b) != {'west', 'east', 'south', 'north'}
            or any(not isinstance(b[k], (int, float)) or isinstance(b[k], bool) or not math.isfinite(b[k]) for k in b)
            or not (-180 <= b['west'] < b['east'] <= 180 and -90 <= b['south'] < b['north'] <= 90)):
        raise ValueError('Study longitude/latitude bounds must be finite with positive extent')
    src = region['source']
    for key in ('sourceId', 'name', 'url', 'version', 'nativeResolutionM', 'evidenceType'):
        if key not in src:
            raise ValueError('Missing source metadata: ' + key)
    if src['evidenceType'] not in ('MEASURED', 'SIMULATED'):
        raise ValueError('Source must declare MEASURED or SIMULATED')
    if src['evidenceType'] == 'MEASURED' and (not isinstance(src['url'], str) or not src['url'].startswith('https://')):
        raise ValueError('Measured source requires HTTPS catalog/product URL')
    native = _finite_float(src['nativeResolutionM'], 'nativeResolutionM')
    if native <= 0:
        raise ValueError('Positive native source resolution required')
    raster_path = (Path(manifest_dir) / region['raster']).resolve()
    z, cell, embedded_crs, tiff_bounds = read_metric_geotiff(raster_path)
    declared_crs = CRS.from_user_input(region['crs'])
    if embedded_crs != declared_crs:
        raise ValueError('Manifest CRS must match embedded GeoTIFF CRS')
    if native > cell + 1e-7:
        raise ValueError('Effective cell size cannot be finer than native source detail')
    if region['body'] == 'earth' and not (region['crs'].startswith('EPSG:') or region['crs'].startswith('+proj=')):
        raise ValueError('Earth region needs an explicit projected CRS')
    if region['body'] != 'earth' and not (region['crs'].startswith('IAU:') or
         (region['crs'].startswith('+proj=') and ('+R=' in region['crs'] or ('+a=' in region['crs'] and '+b=' in region['crs'])))):
        raise ValueError('Planetary region requires IAU or a custom planetary radius/axes CRS')
    metrics = extract_descriptors(z, cell, region['roughnessWindowM'])
    sha = hashlib.sha256(raster_path.read_bytes()).hexdigest()
    method = (f'{ALGORITHM}; central-difference interior gradients; nearest-rank P90; '
              f'{region["roughnessWindowM"]}m local least-squares plane detrending; complete windows; '
              f'GeoTIFF SHA256={sha}; raster bounds {tuple(round(v, 4) for v in tiff_bounds)}')
    status = 'READY' if math.isclose(metrics['validFraction'], 1, abs_tol=1e-12) else 'INCOMPLETE_DATA'
    features = dict(regionId=region['regionId'], body=region['body'], algorithmVersion=ALGORITHM,
                    scaleM=cell, **metrics, dataStatus=status,
                    provenance=[dict(sourceId=src['sourceId'], name=src['name'], url=src['url'],
                                     version=src['version'], nativeResolutionM=native,
                                     processingMethod=method, evidenceType=src['evidenceType'])])
    return features, dict(regionId=region['regionId'], body=region['body'], bounds=region['bounds'],
                          crs=region['crs'], horizontalUnit='m',
                          footprintWidthM=z.shape[1] * cell, footprintHeightM=z.shape[0] * cell,
                          roughnessWindowM=region['roughnessWindowM']), z, cell


def build_terrain_asset(feature, z, cell):
    """No NaN / no-data substitution. Output only fully valid Earth DEMs."""
    if feature['body'] != 'earth':
        raise ValueError('Drone terrain asset is Earth-only')
    if feature['provenance'][0]['evidenceType'] != 'MEASURED':
        raise ValueError('Do not label a synthetic test raster as DEM_DERIVED measured terrain')
    if feature['validFraction'] != 1.0 or not np.isfinite(z).all():
        raise ValueError('Cannot export drone asset with missing terrain pixels')
    if z.size > 65536:
        raise ValueError('Reduce Earth grid to <=65536 cells for browser terrain')
    return dict(earthSiteId=feature['regionId'], version=ALGORITHM, sourceType='DEM_DERIVED',
                width=int(z.shape[1]), height=int(z.shape[0]), cellSizeM=cell,
                elevationM=z.tolist(), provenanceSourceId=feature['provenance'][0]['sourceId'])
