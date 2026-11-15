"""Reproduce all ten catalog pairs from supplied local sources. No public scores."""
import argparse
import json
import math
import shutil
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import from_origin, array_bounds
from rasterio.warp import reproject, transform, transform_bounds

from science.gis.askja_moon import (FILES, EARTH_CREDIT, inventory, mosaic_earth,
    native_quality, supports_common_scale, validate_source_grids, sha256, write_json)
from science.gis.evidence_checks import label_value, _float_label, analyze_counts
from science.gis.polar_moon import JOBS, extract_product, polar_quality
from science.gis.pipeline import build_feature
from science.scoring.engine import compare

NASA_URL='https://doi.org/10.5067/MEASURES/NASADEM/NASADEM_HGT.001'
MARS_URL='https://pds-geosciences.wustl.edu/missions/mgs/megdr.html'
CELL=500
PIXELS=10
SITES=[('earth-erfoud','Erfoud',31.43,-4.23,'EPSG:32630'),
       ('earth-atacama','Atacama',-24.5,-69.25,'EPSG:32719'),
       ('earth-askja','Askja',65.03,-16.75,'EPSG:32628'),
       ('earth-haughton','Haughton',75.38,-89.67,'EPSG:3413'),
       ('earth-mcmurdo','McMurdo',-77.5,162,'EPSG:3031')]
TARGETS=[('mars-jezero','Mars / Jezero','mars',18.38,77.58,
          '+proj=eqc +lat_ts=18.38 +lon_0=77.58 +R=3396000 +units=m +no_defs'),
         ('moon-south-pole','Moon / south pole','moon',-88.5,0,
          '+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +R=1737400 +units=m +no_defs')]
SCENARIOS=[('average',Resampling.average,(0,0)),('bilinear',Resampling.bilinear,(0,0)),
           ('nearest',Resampling.nearest,(0,0)),('shift-northeast',Resampling.average,(250,250)),
           ('shift-southwest',Resampling.average,(-250,-250))]


def raw_vrt(path, raw, width, height, dtype, transform_values, crs, pixel_bytes):
    path.parent.mkdir(parents=True,exist_ok=True)
    if raw.parent.resolve()!=path.parent.resolve():
        local=path.parent/raw.name
        shutil.copyfile(raw,local)
        raw=local
    path.write_text(f'''<VRTDataset rasterXSize="{width}" rasterYSize="{height}">
<SRS>{escape(CRS.from_user_input(crs).to_wkt())}</SRS>
<GeoTransform>{','.join(str(v) for v in transform_values)}</GeoTransform>
<VRTRasterBand dataType="{dtype}" band="1" subClass="VRTRawRasterBand">
<SourceFilename relativeToVRT="1">{escape(raw.name)}</SourceFilename>
<ImageOffset>0</ImageOffset><PixelOffset>{pixel_bytes}</PixelOffset>
<LineOffset>{width*pixel_bytes}</LineOffset><ByteOrder>MSB</ByteOrder>
</VRTRasterBand></VRTDataset>''',encoding='utf-8')
    return path


def validate_mola(image, label, counts=False):
    text=label.read_text()
    expected='MEGC44N000HB.IMG' if counts else 'MEGT44N000HB.IMG'
    fields={'PDS_VERSION_ID':'PDS3','TARGET_NAME':'MARS','PRODUCT_ID':expected,'^IMAGE':expected,
            'DATA_SET_ID':'MGS-M-MOLA-5-MEGDR-L3-V1.0','NAME':'COUNTS_PER_BIN' if counts else 'MEDIAN_TOPOGRAPHY',
            'SAMPLE_TYPE':'UNSIGNED_INTEGER' if counts else 'MSB_INTEGER','POSITIVE_LONGITUDE_DIRECTION':'EAST',
            'COORDINATE_SYSTEM_NAME':'PLANETOCENTRIC','MAP_PROJECTION_TYPE':'SIMPLE CYLINDRICAL'}
    for key,value in fields.items():
        if label_value(text,key).upper()!=value:raise ValueError('Unexpected MOLA label '+key)
    numeric={'LINES':5632,'LINE_SAMPLES':11520,'SAMPLE_BITS':8 if counts else 16,
             'MAXIMUM_LATITUDE':44,'MINIMUM_LATITUDE':0,'WESTERNMOST_LONGITUDE':0,
             'EASTERNMOST_LONGITUDE':90,'MAP_RESOLUTION':128,'A_AXIS_RADIUS':3396,
             'B_AXIS_RADIUS':3396,'C_AXIS_RADIUS':3396,'MAP_PROJECTION_ROTATION':0}
    for key,value in numeric.items():
        if not math.isclose(_float_label(text,key),value):raise ValueError('Unexpected MOLA label '+key)
    if image.name.upper()!=expected or image.stat().st_size!=5632*11520*(1 if counts else 2):
        raise ValueError('MOLA image/label dimensions or identity mismatch')
    if not counts and label_value(text,'UNIT')!='METER':raise ValueError('MOLA topography must use metres')
    return dict(filename=label.name,sha256=sha256(label),reportedVersion=label_value(text,'PRODUCT_VERSION_ID'),
                sourceUrl=MARS_URL,independentlyVerified=False)


def extract_nasadem(root, output, tile):
    archive=root/('NASADEM_HGT_'+tile+'.zip');output.mkdir(parents=True,exist_ok=True)
    paths={}
    with zipfile.ZipFile(archive) as source:
        for suffix in ('hgt','num','swb'):
            name=tile+'.'+suffix
            member=source.getinfo(name)
            expected=3601*3601*(2 if suffix=='hgt' else 1)
            if member.is_dir() or member.file_size!=expected:raise ValueError('Invalid NASADEM member '+name)
            target=output/name
            with source.open(member) as stream,target.open('wb') as dest:shutil.copyfileobj(stream,dest)
            paths[suffix]=target
    with rasterio.open(paths['hgt']) as elevation:
        if elevation.crs!=CRS.from_epsg(4326) or elevation.shape!=(3601,3601):raise ValueError('Invalid NASADEM grid')
        for role in ('num','swb'):
            paths[role+'Vrt']=raw_vrt(output/(tile+'-'+role+'.vrt'),paths[role],3601,3601,'Byte',
                                      elevation.transform.to_gdal(),elevation.crs,1)
    return paths,dict(filename=archive.name,sha256=sha256(archive),sourceUrl=NASA_URL,independentlyVerified=False)


def prepare(source, output, body, latitude, longitude, crs, kernel, offset):
    radius=3396000 if body=='mars' else 1737400
    geographic=CRS.from_epsg(4326) if body=='earth' else CRS.from_proj4(f'+proj=longlat +R={radius} +no_defs')
    target=CRS.from_user_input(crs)
    x,y=transform(geographic,target,[longitude],[latitude])
    affine=from_origin(x[0]+offset[0]-CELL*PIXELS/2,y[0]+offset[1]+CELL*PIXELS/2,CELL,CELL)
    values=np.full((PIXELS,PIXELS),np.nan,dtype='float32')
    with rasterio.open(source) as src:
        if src.count!=1 or src.crs is None:raise ValueError('Georeferenced single-band elevation required')
        if body!='earth':
            params=src.crs.to_dict()
            if not math.isclose(float(params.get('R',params.get('a',0))),radius,abs_tol=1e-6):
                raise ValueError('Source uses the wrong planetary radius')
        reproject(source=rasterio.band(src,1),destination=values,src_crs=src.crs,src_transform=src.transform,
                  src_nodata=src.nodata,dst_crs=target,dst_transform=affine,dst_nodata=np.nan,resampling=kernel)
    output.parent.mkdir(parents=True,exist_ok=True)
    with rasterio.open(output,'w',driver='GTiff',width=PIXELS,height=PIXELS,count=1,dtype='float32',
                       crs=target,transform=affine,nodata=np.nan,compress='deflate') as dest:dest.write(values,1)
    bounds=array_bounds(PIXELS,PIXELS,affine)
    west,south,east,north=transform_bounds(target,geographic,*bounds,densify_pts=21)
    return dict(crs=crs,bounds=dict(west=west,south=south,east=east,north=north),projectedBounds=list(bounds),
                sha256=sha256(output),validFraction=float(np.isfinite(values).mean()))


def nasadem_quality(paths, prepared):
    result={}
    with rasterio.open(prepared) as dest:
        for role in ('num','swb'):
            values=np.zeros((PIXELS,PIXELS),dtype='uint8')
            with rasterio.open(paths[role+'Vrt']) as src:
                reproject(source=rasterio.band(src,1),destination=values,src_crs=src.crs,src_transform=src.transform,
                          dst_crs=dest.crs,dst_transform=dest.transform,resampling=Resampling.nearest)
            result[role+'ClassesAtPreparedCenters']={str(int(k)):int(v) for k,v in zip(*np.unique(values,return_counts=True))}
    result['interpretation']='Nearest source classification samples at prepared-cell centers; not counts of independent ground observations. Class decoding/independent source audit remains pending.'
    return result


def inputs(root,output):
    sources={};identities={};aux={};archives=[]
    for site,tile in [('earth-erfoud','n31w005'),('earth-atacama','s25w070')]:
        paths,archive=extract_nasadem(root,output/'inputs'/site,tile)
        sources[site]=paths['hgt'];aux[site]=paths;archives.append(archive)
        records=inventory({'earthElevation':paths['hgt']})
        for record in records:record['sourceUrl']=NASA_URL
        for role in ('num','swb'):
            record=inventory({'earth'+role:paths[role+'Vrt']})[0]
            record.update(filename=paths[role].name,sha256=sha256(paths[role]),sizeBytes=paths[role].stat().st_size,sourceUrl=NASA_URL)
            records.append(record)
        identities[site]=dict(records=records,native=31,name='NASADEM HGT V001',url=NASA_URL,
                              version='V001 supplied archive; independent verification pending',credit='NASADEM HGT V001, NASA/USGS, NASA LP DAAC. '+NASA_URL)
    raw={role:root/name for role,name in FILES.items()}
    validate_source_grids(raw)
    sources['earth-askja']=mosaic_earth([raw['earthSouth'],raw['earthNorth']],output/'inputs'/'askja-mosaic.tif')
    identities['earth-askja']=dict(records=inventory({key:value for key,value in raw.items() if key.startswith('earth')}),native=32,
            name='Copernicus GLO-30 surface model',url='https://doi.org/10.5270/ESA-c5d3d65',version='Supplied tiles; original release unverified',credit=EARTH_CREDIT)
    for job in JOBS:
        paths,archive=extract_product(root,output/'inputs'/job['site'],job)
        records=inventory(paths);url='https://www.pgc.umn.edu/data/'+job['collection'].lower()+'/'
        for record in records:record['sourceUrl']=url
        sources[job['site']]=paths['earthElevation'];aux[job['site']]=paths;archives.append(archive)
        identities[job['site']]=dict(records=records,native=32,name=job['collection']+' surface mosaic',url=url,
            version='Metadata-reported '+job['version']+'; original archive unverified',
            credit=job['collection']+' DEMs, Polar Geospatial Center, University of Minnesota, NGA/NSF; CC BY 4.0. Modified by reprojection, resampling and terrain-descriptor extraction. '+url)
    labels=[validate_mola(root/'megt44n000hb.img',root/'megt44n000hb.txt'),validate_mola(root/'megc44n000hb.img',root/'megc44n000hb.txt',True)]
    mars=raw_vrt(output/'inputs'/'mars-topography.vrt',root/'megt44n000hb.img',11520,5632,'Int16',
                 (0,1/128,0,44,0,-1/128),'+proj=longlat +R=3396000 +no_defs',2)
    sources['mars-jezero']=mars
    mars_record=inventory({'targetElevation':mars})[0]
    mars_record.update(filename='megt44n000hb.img',sha256=sha256(root/'megt44n000hb.img'),sizeBytes=(root/'megt44n000hb.img').stat().st_size,sourceUrl=MARS_URL)
    counts_record={**mars_record,'role':'targetCounts','filename':'megc44n000hb.img','sha256':sha256(root/'megc44n000hb.img'),
                   'sizeBytes':(root/'megc44n000hb.img').stat().st_size,'dtype':'uint8'}
    identities['mars-jezero']=dict(records=[mars_record,counts_record],native=math.pi*3396000/(180*128),
            name='MOLA MEGDR topography',url=MARS_URL,version='PDS3 label-reported 2.0; independent verification pending',credit='NASA MGS MOLA / PDS Geosciences Node. '+MARS_URL)
    sources['moon-south-pole']=raw['moonElevation']
    identities['moon-south-pole']=dict(records=inventory({key:value for key,value in raw.items() if key.startswith('moon')}),native=80,
            name='LOLA adjusted polar elevation',url='https://pgda.gsfc.nasa.gov/products/90',version='Supplied files; original release unverified',
            credit='NASA GSFC PGDA, Barker et al. (2023), https://doi.org/10.3847/psj/acf3e1')
    write_json(output/'input-manifest.json',dict(archives=archives,labels=labels,sources=identities))
    return sources,identities,aux,raw


def run(root,output):
    sources,identities,aux,raw=inputs(root,output)
    pairs=[]
    for site,name,lat,lon,earth_crs in SITES:
        for target,target_name,body,target_lat,target_lon,target_crs in TARGETS:
            directory=output/(site+'--'+target);scenarios=[]
            for scenario,kernel,offset in SCENARIOS:
                folder=directory/scenario;features={};prepared={};regions=[]
                for key,region_id,current_body,current_lat,current_lon,crs in [('earth',site,'earth',lat,lon,earth_crs),('target',target,body,target_lat,target_lon,target_crs)]:
                    identity=identities[region_id]
                    info=prepare(sources[region_id],folder/(key+'-metric.tif'),current_body,current_lat,current_lon,crs,kernel,offset)
                    prepared[key]=info
                    region=dict(regionId=region_id,body=current_body,raster=key+'-metric.tif',crs=crs,bounds=info['bounds'],roughnessWindowM=1500,
                        source=dict(sourceId=identity['records'][0]['filename'],name=identity['name'],url=identity['url'],version=identity['version'],nativeResolutionM=identity['native'],evidenceType='MEASURED'))
                    feature,plan_region,_,_=build_feature(region,folder)
                    feature['provenance'][0]['processingMethod']+='; resampling='+kernel.name+'; input SHA256='+','.join(record['sha256'] for record in identity['records'])
                    features[key]=feature;regions.append(plan_region);write_json(folder/(key+'-features.json'),feature)
                if body=='moon':
                    quality=native_quality(raw,prepared['target']['projectedBounds'])
                    supported=supports_common_scale(quality,CELL)
                    quality=dict(kind='LOLA',supported=supported,**quality)
                else:
                    quality=analyze_counts(root/'megc44n000hb.img',root/'megc44n000hb.txt',folder/'target-metric.tif')
                    quality.update(kind='MOLA',supported=quality['nativeCellsWithAtLeastOneShot']>0)
                earth_quality=nasadem_quality(aux[site],folder/'earth-metric.tif') if site in ('earth-erfoud','earth-atacama') else polar_quality(aux[site],prepared['earth']['projectedBounds']) if site in aux else None
                plan=dict(version='analysis-plan-v1',definitionsVersion='terrain-descriptors-v1',regions=regions)
                write_json(folder/'analysis-plan.json',plan)
                for profile in ('terrain_mobility','geological_survey'):
                    result=compare(features['earth'],features['target'],profile,plan)
                    if not quality['supported']:
                        result['status']='INCOMPLETE_DATA';result['score']=None
                        result['evidenceGaps'].append('Target observation support is insufficient.')
                        for row in result['featureContributions']:row['distance']=row['contribution']=None
                    write_json(folder/('comparison-review-'+profile+'.json'),result)
                scenarios.append(dict(name=scenario,kernel=kernel.name,offsetM=list(offset),features=features,prepared=prepared,targetQuality=quality,earthQuality=earth_quality))
            baseline=scenarios[0]
            metrics=[dict(id=field,label=label,unit=unit,earthBaseline=baseline['features']['earth'][field],targetBaseline=baseline['features']['target'][field],
                earthRange=[min(s['features']['earth'][field] for s in scenarios),max(s['features']['earth'][field] for s in scenarios)],
                targetRange=[min(s['features']['target'][field] for s in scenarios),max(s['features']['target'][field] for s in scenarios)])
                for field,label,unit in [('meanSlopeDeg','Mean slope','deg'),('p90SlopeDeg','P90 slope','deg'),('roughnessM','Residual roughness','m'),('reliefM','Relief','m')]]
            snapshot=dict(version='local-catalog-qa-v1',status='PROVISIONAL_QA',scorePublicationApproved=False,
                selection=dict(earthSiteId=site,targetId=target),earthName=name,targetName=target_name,targetBody=body,
                study=dict(cellSizeM=CELL,pixels=PIXELS,footprintWidthM=CELL*PIXELS,roughnessWindowM=1500,
                    earthCenter=dict(latitude=lat,longitude=lon),targetCenter=dict(latitude=target_lat,longitude=target_lon),earthCrs=earth_crs,targetCrs=target_crs),
                bounds={key:baseline['prepared'][key]['bounds'] for key in ('earth','target')},metrics=metrics,
                targetQuality=baseline['targetQuality'],earthQuality=baseline['earthQuality'],
                earthValidFraction=baseline['features']['earth']['validFraction'],targetValidFraction=baseline['features']['target']['validFraction'],
                allScenariosSupported=all(s['targetQuality']['supported'] and all(f['validFraction']==1 for f in s['features'].values()) for s in scenarios),
                sources=identities[site]['records']+identities[target]['records'],earthAttribution=identities[site]['credit'],targetAttribution=identities[target]['credit'],
                limitations=['Locally reproduced from supplied files; original archive authenticity and independent scientific review remain pending.',
                    'All trials use fixed catalog-centered 5 km squares, 500 m cells and 1500 m roughness windows; these are proposed settings, not validated analog or landing sites.',
                    'MOLA elevation interpolates unobserved bins; a complete DEM is not complete direct-shot coverage. LOLA counts can be fractional tile-blending weights.',
                    'Native count coverage is not measurement accuracy. Lunar effective resolution describes sampling support, not an error bar.',
                    'Surface models may include snow, ice, vegetation or processing artifacts. NASADEM companion classes remain classification evidence, not independent shot counts.',
                    'Only within-window slope, roughness and relief are compared; absolute elevations use different vertical datums.',
                    'Five processing-scenario ranges are sensitivity summaries, not statistical confidence intervals.',
                    'A 10 by 10 grid captures broad terrain only; no drone-scale obstacles, operational suitability or automatic best candidate are established.',
                    'No compatibility score is published before review; ECHO remains an Earth-based procedural demonstration.'])
            write_json(directory/'scenarios.json',scenarios);write_json(directory/'provisional-qa.json',snapshot)
            pairs.append(snapshot)
            print(site,target,'complete:',snapshot['allScenariosSupported'],flush=True)
    result=dict(version='local-catalog-evidence-v1',scorePublicationApproved=False,
        processingVersions=dict(rasterio=rasterio.__version__,gdal=rasterio.__gdal_version__,numpy=np.__version__),
        codeHashes={name:sha256(Path(__file__).with_name(name)) for name in ('local_catalog.py','pipeline.py','askja_moon.py','polar_moon.py','evidence_checks.py')},pairs=pairs)
    write_json(output/'catalog-evidence.json',result)
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input-dir',type=Path,default=Path('.'))
    parser.add_argument('--output-dir',type=Path,default=Path('data/processed/local-catalog'))
    parser.add_argument('--snapshot',type=Path,default=Path('frontend/src/data/localCatalogEvidence.json'))
    args=parser.parse_args()
    result=run(args.input_dir,args.output_dir)
    write_json(args.snapshot,result)


if __name__=='__main__':main()
