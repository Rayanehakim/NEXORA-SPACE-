"""Reproduce a provisional Askja/LOLA trial from five supplied rasters. Never publish scores."""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.merge import merge
from rasterio.transform import array_bounds, from_origin
from rasterio.warp import reproject, transform, transform_bounds
from rasterio.windows import from_bounds, Window

from science.gis.pipeline import build_feature
from science.scoring.engine import compare

FILES = {
    'earthSouth': 'Copernicus_DSM_COG_10_N64_00_W017_00_DEM.tif',
    'earthNorth': 'Copernicus_DSM_COG_10_N65_00_W017_00_DEM.tif',
    'moonElevation': 'LDEM_80S_80MPP_ADJ.tiff',
    'moonCounts': 'LDEC_80S_80MPP_ADJ.tiff',
    'moonEffectiveResolution': 'LDEM_80S_80MPP_ADJ_EFFRES.tiff',
}
MOON_GEOGRAPHIC = '+proj=longlat +R=1737400 +no_defs'
MOON_PROJECTED = '+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +R=1737400 +units=m +no_defs'
MOON_URL = 'https://pgda.gsfc.nasa.gov/products/90'
EARTH_URL = 'https://doi.org/10.5270/ESA-c5d3d65'
EARTH_CREDIT = ('produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 '
                'provided under COPERNICUS by the European Union and ESA; all rights reserved')

def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024*1024), b''): digest.update(block)
    return digest.hexdigest()

def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, allow_nan=False, ensure_ascii=False)+'\n', encoding='utf-8')

def inventory(paths):
    records = []
    for role, path in paths.items():
        with rasterio.open(path) as source:
            if source.count != 1 or source.crs is None:
                raise ValueError(f'{role}: one band and embedded CRS required')
            records.append(dict(role=role, filename=Path(path).name, sha256=sha256(path), sizeBytes=Path(path).stat().st_size,
                                width=source.width, height=source.height, dtype=source.dtypes[0], crs=source.crs.to_wkt(),
                                bounds=list(source.bounds), transform=list(source.transform)[:6],
                                nodata='NaN' if source.nodata is not None and math.isnan(source.nodata) else source.nodata,
                                embeddedUnits=source.units[0], sourceUrl=EARTH_URL if role.startswith('earth') else MOON_URL,
                                releaseVersionVerified=False))
    return records

def is_lunar_polar(crs):
    if crs is None or not crs.is_projected: return False
    params=crs.to_dict()
    radius=params.get('R',params.get('a',0))
    return (params.get('proj')=='stere' and math.isclose(float(radius),1737400,abs_tol=1e-6) and
            math.isclose(float(params.get('b',radius)),1737400,abs_tol=1e-6) and
            params.get('lat_0')==-90 and params.get('lon_0',0)==0 and params.get('x_0',0)==0 and params.get('y_0',0)==0 and
            (params.get('lat_ts')==-90 if 'lat_ts' in params else params.get('k',params.get('k_0'))==1) and params.get('units')=='m')

def validate_source_grids(paths):
    with rasterio.open(paths['earthSouth']) as south, rasterio.open(paths['earthNorth']) as north:
        if south.crs != CRS.from_epsg(4326) or north.crs != south.crs:
            raise ValueError('Copernicus source grids must use embedded terrestrial WGS84')
        if not np.allclose(south.res, north.res) or south.transform.a <= 0 or south.transform.e >= 0:
            raise ValueError('Earth tiles need compatible north-up geographic grids')
        if not math.isclose(south.bounds.top, north.bounds.bottom, abs_tol=1e-7) or not np.allclose([south.bounds.left,south.bounds.right], [north.bounds.left,north.bounds.right]):
            raise ValueError('Earth tiles must be adjacent at the latitude boundary')
    with rasterio.open(paths['moonElevation']) as elevation:
        if not is_lunar_polar(elevation.crs) or not np.allclose(elevation.res, [80,80]):
            raise ValueError('LOLA elevation must use the 1737400m lunar south polar grid at 80m spacing')
        for role in ('moonCounts', 'moonEffectiveResolution'):
            with rasterio.open(paths[role]) as auxiliary:
                if auxiliary.crs != elevation.crs or auxiliary.shape != elevation.shape or auxiliary.transform != elevation.transform:
                    raise ValueError(f'{role}: auxiliary grid must align exactly with lunar elevation')

def mosaic_earth(paths, output):
    with rasterio.open(paths[0]) as south, rasterio.open(paths[1]) as north:
        values, affine = merge([south,north], nodata=np.nan, dtype='float32')
        profile = south.profile.copy()
        profile.update(driver='GTiff',width=values.shape[2],height=values.shape[1],transform=affine,nodata=np.nan,compress='deflate')
        output.parent.mkdir(parents=True, exist_ok=True)
        with rasterio.open(output,'w',**profile) as destination: destination.write(values)
    return output

def prepare_window(source_path, output_path, body, center, cell, pixels, kernel, earth_crs='EPSG:32628', offset=(0,0)):
    if body not in ('earth','moon'): raise ValueError('Only Earth and Moon are supported by this trial')
    if type(pixels) is not int or not 5 <= pixels <= 256 or not math.isfinite(cell) or cell <= 0:
        raise ValueError('Use a finite positive cell size and 5–256 pixels per side')
    latitude, longitude = center['latitude'], center['longitude']
    if not all(type(value) in (int,float) and math.isfinite(value) for value in (latitude,longitude)) or not -90 < latitude < 90 or not -180 <= longitude <= 180:
        raise ValueError('Explicit finite latitude/longitude center required')
    geographic = 'EPSG:4326' if body == 'earth' else MOON_GEOGRAPHIC
    target = CRS.from_user_input(earth_crs if body == 'earth' else MOON_PROJECTED)
    if not target.is_projected or target.linear_units.lower() not in ('metre','meter','metres','meters','m'):
        raise ValueError('Target grids must use projected horizontal metres')
    x,y = transform(geographic,target,[longitude],[latitude])
    width = pixels*cell
    affine = from_origin(x[0]+offset[0]-width/2,y[0]+offset[1]+width/2,cell,cell)
    values = np.full((pixels,pixels),np.nan,dtype='float32')
    with rasterio.open(source_path) as source:
        if source.crs is None or source.count != 1: raise ValueError('Georeferenced single-band elevation required')
        if body == 'moon' and not is_lunar_polar(source.crs): raise ValueError('Moon input cannot use an Earth or unrelated CRS')
        reproject(source=rasterio.band(source,1),destination=values,src_crs=source.crs,src_transform=source.transform,
                  src_nodata=source.nodata,dst_crs=target,dst_transform=affine,dst_nodata=np.nan,resampling=kernel)
    output_path.parent.mkdir(parents=True,exist_ok=True)
    with rasterio.open(output_path,'w',driver='GTiff',width=pixels,height=pixels,count=1,dtype='float32',
                       crs=target,transform=affine,nodata=np.nan,compress='deflate') as destination: destination.write(values,1)
    bounds = array_bounds(pixels,pixels,affine)
    west,south,east,north = transform_bounds(target,geographic,*bounds,densify_pts=21)
    if west >= east or south >= north: raise ValueError('Split antimeridian or pole-enclosing study windows before analysis')
    return dict(crs=earth_crs if body=='earth' else MOON_PROJECTED,bounds=dict(west=west,south=south,east=east,north=north),
                projectedBounds=list(bounds), validFraction=float(np.isfinite(values).mean()), sha256=sha256(output_path))

def native_quality(paths, bounds):
    """Use native 80m bin centers, not resampled masks or fabricated independent-shot claims."""
    left,bottom,right,top = bounds
    with rasterio.open(paths['moonCounts']) as source:
        requested = from_bounds(left,bottom,right,top,source.transform)
        c0,r0 = math.floor(requested.col_off),math.floor(requested.row_off)
        c1,r1 = math.ceil(requested.col_off+requested.width),math.ceil(requested.row_off+requested.height)
        if c0<0 or r0<0 or c1>source.width or r1>source.height: raise ValueError('Lunar quality window outside source coverage')
        window = Window(c0,r0,c1-c0,r1-r0)
        counts = source.read(1,window=window,masked=True).astype('float64').filled(np.nan)
        rows,cols = np.indices(counts.shape)
        xs = source.transform.c+(cols+c0+.5)*source.transform.a
        ys = source.transform.f+(rows+r0+.5)*source.transform.e
        inside = (xs>=left)&(xs<right)&(ys>=bottom)&(ys<top)
    with rasterio.open(paths['moonEffectiveResolution']) as source:
        effective = source.read(1,window=window,masked=True).astype('float64').filled(np.nan)
    counts, effective = counts[inside], effective[inside]
    if not counts.size or np.any(counts[np.isfinite(counts)]<0) or np.any(effective[np.isfinite(effective)]<=0):
        raise ValueError('Counts must be nonnegative and effective resolution positive')
    valid_counts = np.isfinite(counts)
    valid_effective = np.isfinite(effective)
    if not valid_counts.any() or not valid_effective.any(): raise ValueError('No usable lunar quality samples')
    return dict(nativeBinCount=int(counts.size),validCountFraction=float(valid_counts.mean()),
                positiveCountBins=int(np.count_nonzero((counts>0)&valid_counts)),
                positiveCountFraction=float(np.count_nonzero((counts>0)&valid_counts)/counts.size),
                countWeightSum=float(np.sum(counts[valid_counts])),
                effectiveResolutionValidFraction=float(valid_effective.mean()),
                effectiveResolutionM=dict(min=float(effective[valid_effective].min()),max=float(effective[valid_effective].max()),
                                         p90=float(np.percentile(effective[valid_effective],90)),p99=float(np.percentile(effective[valid_effective],99))))

def supports_common_scale(quality, cell):
    maximum=quality['effectiveResolutionM']['max']
    return (quality['validCountFraction']==1 and quality['effectiveResolutionValidFraction']==1 and
            quality['positiveCountBins']>0 and math.isfinite(maximum) and 0<maximum<=cell)

def run(input_dir, output_dir, config):
    paths = {role: Path(input_dir)/filename for role,filename in FILES.items()}
    if any(not path.is_file() for path in paths.values()): raise ValueError('All five named source rasters are required')
    validate_source_grids(paths)
    records = inventory(paths)
    output = Path(output_dir);output.mkdir(parents=True,exist_ok=True)
    write_json(output/'sources.json',records)
    earth_mosaic = mosaic_earth([paths['earthSouth'],paths['earthNorth']],output/'askja-mosaic.tif')
    cell,pixels = config['cellSizeM'],config['pixels']
    if config['version']!='askja-moon-study-v1' or type(config['roughnessCells']) is not int or config['roughnessCells']<3 or config['roughnessCells']%2!=1 or config['roughnessCells']>pixels:
        raise ValueError('Unsupported study version or roughness window')
    # Derive native grid spacing in local Earth metres; nominal angular steps are not square metres.
    with rasterio.open(paths['earthNorth']) as earth:
        lon,lat=config['earthCenter']['longitude'],config['earthCenter']['latitude']
        xs,ys=transform(earth.crs,config['earthCrs'],[lon,lon+earth.res[0],lon],[lat,lat,lat+earth.res[1]])
        earth_spacing=max(math.hypot(xs[1]-xs[0],ys[1]-ys[0]),math.hypot(xs[2]-xs[0],ys[2]-ys[0]))
    if cell<earth_spacing or cell<80: raise ValueError('Common grid cannot be finer than native source sampling')
    scenarios=[];baseline=None
    specifications=[('average',Resampling.average,(0,0)),('bilinear',Resampling.bilinear,(0,0)),('nearest',Resampling.nearest,(0,0)),
                    ('shift-northeast',Resampling.average,(cell/2,cell/2)),('shift-southwest',Resampling.average,(-cell/2,-cell/2))]
    for name,kernel,offset in specifications:
        directory=output/name;regions=[];prepared={};features={}
        for body,source,center,region_id in [('earth',earth_mosaic,config['earthCenter'],'earth-askja'),('moon',paths['moonElevation'],config['moonCenter'],'moon-south-pole')]:
            info=prepare_window(source,directory/f'{body}-metric.tif',body,center,cell,pixels,kernel,config['earthCrs'],offset)
            prepared[body]=info
            selected_records=[record for record in records if record['role'].startswith('earth')] if body=='earth' else [next(record for record in records if record['role']=='moonElevation')]
            source_id='COPERNICUS-ASKJA-N64-N65' if body=='earth' else 'LDEM_80S_80MPP_ADJ'
            region=dict(regionId=region_id,body=body,raster=f'{body}-metric.tif',crs=info['crs'],bounds=info['bounds'],roughnessWindowM=cell*config['roughnessCells'],
                        source=dict(sourceId=source_id,name='Copernicus GLO-30 surface model' if body=='earth' else 'LOLA adjusted south polar elevation',url=EARTH_URL if body=='earth' else MOON_URL,
                                    version='user-provided GeoTIFF; original release version unverified',nativeResolutionM=earth_spacing if body=='earth' else 80,evidenceType='MEASURED'))
            feature,plan_region,_,_=build_feature(region,directory)
            feature['provenance'][0]['processingMethod']+='; resampling='+kernel.name+'; raw source SHA256='+','.join(record['sha256'] for record in selected_records)
            features[body]=feature;regions.append(plan_region)
            write_json(directory/f'{body}-features.json',feature)
        quality=native_quality(paths,prepared['moon']['projectedBounds'])
        quality['commonScaleCoversEffectiveResolution']=supports_common_scale(quality,cell)
        plan=dict(version='analysis-plan-v1',definitionsVersion='terrain-descriptors-v1',regions=regions)
        write_json(directory/'analysis-plan.json',plan)
        # Computable experimental indices remain in ignored local review output only.
        for profile in ('terrain_mobility','geological_survey'):
            result=compare(features['earth'],features['moon'],profile,plan)
            if not quality['commonScaleCoversEffectiveResolution'] or quality['validCountFraction']<1:
                result['status']='INCOMPLETE_DATA';result['score']=None
                result['evidenceGaps'].append('Lunar quality layer coverage or effective-resolution support is insufficient for this scale.')
                for row in result['featureContributions']:row['distance']=row['contribution']=None
            write_json(directory/f'comparison-review-{profile}.json',result)
        scenarios.append(dict(name=name,kernel=kernel.name,offsetM=list(offset),earth=features['earth'],moon=features['moon'],quality=quality,prepared=prepared))
        if name=='average':baseline=scenarios[-1]
    fields=('meanSlopeDeg','p90SlopeDeg','roughnessM','reliefM')
    metrics=[dict(id=field,label={'meanSlopeDeg':'Mean slope','p90SlopeDeg':'P90 slope','roughnessM':'Residual roughness','reliefM':'Relief'}[field],unit='deg' if field.endswith('Deg') else 'm',
                  earthBaseline=baseline['earth'][field],moonBaseline=baseline['moon'][field],
                  earthRange=[min(item['earth'][field] for item in scenarios),max(item['earth'][field] for item in scenarios)],
                  moonRange=[min(item['moon'][field] for item in scenarios),max(item['moon'][field] for item in scenarios)]) for field in fields]
    snapshot=dict(version='imported-terrain-qa-v1',status='PROVISIONAL_QA',scorePublicationApproved=False,
                  selection=dict(earthSiteId='earth-askja',targetId='moon-south-pole'),study=config,
                  studyBounds=dict(earth=baseline['prepared']['earth']['bounds'],moon=baseline['prepared']['moon']['bounds']),
                  processingVersions=dict(rasterio=rasterio.__version__,gdal=rasterio.__gdal_version__,numpy=np.__version__),
                  codeHashes={name:sha256(Path(__file__).with_name(name)) for name in ('askja_moon.py','pipeline.py')},
                  footprintWidthM=cell*pixels,metrics=metrics,lunarQuality=baseline['quality'],
                  earthValidFraction=baseline['earth']['validFraction'],moonValidFraction=baseline['moon']['validFraction'],
                  allScenariosSupported=all(item['quality']['commonScaleCoversEffectiveResolution'] and item['earth']['validFraction']==1 and item['moon']['validFraction']==1 for item in scenarios),
                  sources=records,earthAttribution=EARTH_CREDIT,
                  limitations=['Original source release versions and independent product/label review remain unverified.',
                               'Copernicus is a surface model, not guaranteed bare-earth terrain.',
                               'Lunar counts may be fractional because of tile blending; their sum is not a unique raw-shot total.',
                               'Effective resolution describes sampling support, not elevation accuracy or a flight-safety threshold.',
                               'Study centers are explicit proposed reference windows, not validated analog or landing sites.',
                               'Scenario ranges describe processing sensitivity, not statistical confidence intervals.',
                               'No lunar rotorcraft simulation or automatic compatibility ranking is provided.'])
    write_json(output/'scenarios.json',scenarios)
    write_json(output/'provisional-qa.json',snapshot)
    return snapshot

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input-dir',type=Path,default=Path('.'))
    parser.add_argument('--output-dir',type=Path,default=Path('data/processed/askja-moon'))
    parser.add_argument('--config',type=Path,default=Path(__file__).with_name('examples')/'askja-moon-study.json')
    parser.add_argument('--snapshot',type=Path,help='Optionally write the provisional QA snapshot for frontend display; never a ComparisonResult')
    args=parser.parse_args()
    try:
        snapshot=run(args.input_dir,args.output_dir,json.loads(args.config.read_text(encoding='utf-8-sig')))
        if args.snapshot:write_json(args.snapshot,snapshot)
        print(json.dumps({'status':snapshot['status'],'allScenariosSupported':snapshot['allScenariosSupported'],'scorePublished':False,'output':str(args.output_dir)},indent=2))
    except (ValueError,OSError,KeyError,TypeError,rasterio.errors.RasterioError) as error:
        parser.exit(2,f'Cannot prepare imported terrain: {error}\n')

if __name__=='__main__':main()
