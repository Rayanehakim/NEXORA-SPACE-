"""Offline MOLA count coverage and Earth/Mars resampling sensitivity.

All outputs are QA/provisional, never a scientific validation certificate.
The MOLA count reader uses the companion PDS3 label (not assumed byte width).
"""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import transform as transform_coords

from science.gis.pipeline import extract_descriptors
from science.gis.prepare_pair import prepare_one


def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def label_value(text, name):
    match = re.search(r'^\s*' + re.escape(name) + r'\s*=\s*([^\r\n]+)', text, re.M | re.I)
    if not match:
        raise ValueError(f'MOLA counts label missing {name}')
    return match.group(1).strip().split('/*')[0].strip().strip('"')


def _float_label(text, name):
    value = label_value(text, name)
    return float(re.sub(r'<.*', '', value).strip())


def read_counts_window(img_path, lbl_path, west, east, south, north):
    """Read a small PDS3 counts window, using the label as the sole shape/type authority.

    Returns (array, (first_row,first_col), metadata) with rows north->south.
    The header's extent and axis direction must match Jezero convention.
    """
    text = Path(lbl_path).read_text(errors='replace')
    target = label_value(text, 'TARGET_NAME').upper()
    if target != 'MARS':
        raise ValueError('Counts label is not for Mars')
    # PDS3 may have NAME within IMAGE only; require counts product by PRODUCT_ID.
    prod = label_value(text, 'PRODUCT_ID').upper()
    if not prod.startswith('MEGC44N000HB') or Path(img_path).stem.upper() != Path(prod).stem.upper():
        raise ValueError('Counts file/label mismatch; expected MEGC44N000HB IMG')
    lines, cols = int(label_value(text, 'LINES')), int(label_value(text, 'LINE_SAMPLES'))
    bits = int(label_value(text, 'SAMPLE_BITS'))
    kind = label_value(text, 'SAMPLE_TYPE').upper()
    if bits not in (8, 16) or kind not in ('MSB_UNSIGNED_INTEGER', 'MSB_INTEGER', 'UNSIGNED_INTEGER'):
        raise ValueError(f'Unsupported PDS counts packing: {kind}/{bits}; inspect label')
    signed = kind == 'MSB_INTEGER'
    dtype = np.dtype(('>i2' if signed else '>u2') if bits == 16 else ('i1' if signed else 'u1'))
    if Path(img_path).stat().st_size != lines * cols * dtype.itemsize:
        raise ValueError('Counts IMG size does not match detached label; no guessed byte order')
    # The MEGC44N000HB tile spans 44N..0N, 0E..90E; validate fields.
    max_lat = _float_label(text, 'MAXIMUM_LATITUDE')
    min_lat = _float_label(text, 'MINIMUM_LATITUDE')
    lon_w = _float_label(text, 'WESTERNMOST_LONGITUDE')
    lon_e = _float_label(text, 'EASTERNMOST_LONGITUDE')
    ppd = _float_label(text, 'MAP_RESOLUTION')
    if not (math.isclose(max_lat, 44) and math.isclose(min_lat, 0) and math.isclose(lon_w, 0) and math.isclose(lon_e, 90)
            and math.isclose(ppd, 128) and cols == 11520 and lines == 5632):
        raise ValueError('Counts tile dimensions/bounds differ from the matched Jezero topography tile')
    if not (lon_w <= west < east <= lon_e and min_lat <= south < north <= max_lat):
        raise ValueError('Study bbox lies outside the MOLA counts tile')
    row0 = max(0, math.floor((max_lat - north) * ppd))
    row1 = min(lines, math.ceil((max_lat - south) * ppd))
    col0 = max(0, math.floor((west - lon_w) * ppd))
    col1 = min(cols, math.ceil((east - lon_w) * ppd))
    arr = np.memmap(img_path, mode='r', dtype=dtype, shape=(lines, cols))[row0:row1, col0:col1]
    return np.asarray(arr), (row0, col0), {'sourceSha256': digest(img_path), 'labelSha256': digest(lbl_path),
      'productId': prod, 'sourceSampleBits': bits, 'sourceSampleType': kind, 'sourceGridPixelsPerDegree': ppd}


def analyze_counts(img_path, lbl_path, mars_metric_tif):
    """Count native observed vs zero-count cells whose centers lie in metric footprint.

    This is native-pixel observation coverage, NOT the 1 km output cell fraction.
    """
    with rasterio.open(mars_metric_tif) as out:
        if not out.crs or not out.crs.is_projected:
            raise ValueError('Prepared Mars grid must have a projected planetary CRS')
        # Transform four target corners to body-specific lon/lat (never EPSG:4326).
        mars_geographic = rasterio.crs.CRS.from_proj4('+proj=longlat +R=3396000 +no_defs')
        xs = [out.bounds.left, out.bounds.right, out.bounds.left, out.bounds.right]
        ys = [out.bounds.bottom, out.bounds.bottom, out.bounds.top, out.bounds.top]
        lons, lats = transform_coords(out.crs, mars_geographic, xs, ys)
        west,east,south,north = min(lons),max(lons),min(lats),max(lats)
        counts,(row0,col0),meta=read_counts_window(img_path,lbl_path,west,east,south,north)
        ppd = meta['sourceGridPixelsPerDegree']
        rr,cc=np.indices(counts.shape)
        lat=44-(row0+rr+.5)/ppd
        lon=(col0+cc+.5)/ppd
        xc,yc=transform_coords(mars_geographic,out.crs,lon.ravel(),lat.ravel())
        inside=((np.asarray(xc)>=out.bounds.left)&(np.asarray(xc)<out.bounds.right)&
                (np.asarray(yc)>=out.bounds.bottom)&(np.asarray(yc)<out.bounds.top)).reshape(counts.shape)
        selected = counts[inside]
        if selected.size == 0:
            raise ValueError('No MOLA count pixels fall within the prepared Mars grid')
        if np.any(selected < 0):
            raise ValueError('Unexpected negative observation counts; inspect special constants')
        observed=int(np.count_nonzero(selected > 0))
        return {'status':'COUNTS_EVIDENCE_AVAILABLE','interpretation':'Fraction of native MOLA count-grid cell centers inside the prepared analysis footprint with >=1 recorded shot; not direct 1 km cell coverage',
          'nativeCellCentersInsideWindow':int(selected.size),'nativeCellsWithAtLeastOneShot':observed,
          'nativeCellsWithZeroShots':int(np.count_nonzero(selected==0)),
          'nativeObservedCellFraction':float(observed/selected.size),
          'sumShotCounts':int(np.sum(selected.astype(np.int64))),
          'minShotsPerCell':int(selected.min()),'maxShotsPerCell':int(selected.max()),
          'countsSource':meta,'disclosure':'Nonzero MOLA bins do not eliminate along-track gaps or ensure drone-scale terrain; DEM interpolates empty bins'}


def descriptors_for_grid(path, cell_m, roughness_window_m):
    with rasterio.open(path) as ds:
        z = ds.read(1,masked=True).filled(np.nan)
    return extract_descriptors(z, cell_m, roughness_window_m)


def analyze_sensitivity(earth_dem, mars_dem, target_dir, cell_m=1000, pixels=32, roughness_cells=3):
    """Reproject raw inputs at common scale using alternate kernels and footprint shifts."""
    target_dir = Path(target_dir)
    target_dir.mkdir(parents=True, exist_ok=True)
    scenarios = [
        ('baseline-bilinear', Resampling.bilinear, 0., 0.),
        ('average', Resampling.average, 0., 0.),
        ('nearest', Resampling.nearest, 0., 0.),
        ('shift-northeast', Resampling.bilinear, 500., 500.),
        ('shift-southwest', Resampling.bilinear, -500., -500.),
    ]
    metrics={}
    for name,kernel,north_m,east_m in scenarios:
        record={'kernel':kernel.name, 'centerOffsetMetres':[east_m,north_m]}
        for body,path,lat,lon in [('earth',earth_dem,31.42,-4.24),('mars',mars_dem,18.38,77.58)]:
            radius_m = 3396000. if body == 'mars' else 6371000.
            metres_per_degree = math.pi * radius_m / 180.
            dlat = north_m / metres_per_degree
            dlon = east_m / (metres_per_degree * math.cos(math.radians(lat)))
            out=target_dir / f'{name}-{body}.tif'
            info=prepare_one(path,out,body,lat+dlat,lon+dlon,cell_m,pixels,interpolation=kernel)
            values=descriptors_for_grid(out,cell_m,cell_m*roughness_cells)
            record[body]={'validFraction':values['validFraction'], 'metrics':{k:v for k,v in values.items() if k!='validFraction'},
                          'preparedSha256':info['outputSha256']}
        metrics[name]=record
    fields=('meanSlopeDeg','p90SlopeDeg','roughnessM','reliefM')
    spread={}
    for body in ('earth','mars'):
        spread[body]={}
        for field in fields:
            vals=[v[body]['metrics'][field] for v in metrics.values()]
            spread[body][field]={'min':min(vals),'max':max(vals),'absoluteRange':max(vals)-min(vals),
                                  'baseline':metrics['baseline-bilinear'][body]['metrics'][field]}
    return {'status':'PROVISIONAL_SENSITIVITY_ONLY','method':'Five 32km windows: bilinear, average, nearest; bilinear shifted ±500m north/east on both bodies using approximate local spherical angle conversion. Native source resolution not increased.',
      'inputHashes':{'earth':digest(earth_dem),'mars':digest(mars_dem)},'cellMetres':cell_m,'pixels':pixels,
      'scenarios':metrics,'metricSpread':spread,
      'warning':'Descriptor changes under these scenarios do not certify a planetary analog score. Source observation coverage and geological context must be reviewed separately.'}


def main():
    p=argparse.ArgumentParser(description='MOLA observation coverage / terrain-kernel sensitivity QA')
    sub=p.add_subparsers(dest='mode',required=True)
    a=sub.add_parser('counts');a.add_argument('--counts-img',required=True);a.add_argument('--counts-lbl',required=True);a.add_argument('--mars-metric',required=True)
    s=sub.add_parser('sensitivity');s.add_argument('--earth-dem',required=True);s.add_argument('--mars-dem',required=True);s.add_argument('--output-grids-dir',required=True)
    for q in (a,s):q.add_argument('--output',required=True)
    args=p.parse_args()
    if args.mode=='counts':result=analyze_counts(args.counts_img,args.counts_lbl,args.mars_metric)
    else:result=analyze_sensitivity(args.earth_dem,args.mars_dem,args.output_grids_dir)
    Path(args.output).parent.mkdir(parents=True,exist_ok=True)
    Path(args.output).write_text(json.dumps(result,indent=2)+'\n')
    print('Wrote QA report:',args.output,'status:',result['status'])


if __name__=='__main__':main()
