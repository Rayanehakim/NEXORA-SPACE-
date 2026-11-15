"""Reproduce supplied ArcticDEM/REMA lunar trials; never publish model scores."""
import argparse
import json
import shutil
import tarfile
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.windows import from_bounds

from science.gis.askja_moon import (FILES, inventory, is_lunar_polar, native_quality, prepare_window,
    sha256, supports_common_scale, write_json)
from science.gis.pipeline import build_feature
from science.scoring.engine import compare

JOBS = [
    dict(site='earth-haughton', name='Haughton Crater', product='29_29_32m_v4.1',
         collection='ArcticDEM', version='4.1', latitude=75.38, longitude=-89.67, crs='EPSG:3413'),
    dict(site='earth-mcmurdo', name='McMurdo Dry Valleys', product='18_35_32m_v2.0',
         collection='REMA', version='2.0', latitude=-77.5, longitude=162, crs='EPSG:3031'),
]


def extract_product(root, destination, job):
    """Copy only named regular files; never extract archive paths or links."""
    archive_path = root / (job['product']+'.tar.gz')
    destination.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive_path) as archive:
        for suffix in ('dem.tif', 'count.tif', 'mad.tif', 'meta.txt'):
            name = job['product']+'_'+suffix
            member = archive.getmember(name)
            if not member.isfile():
                raise ValueError('Expected regular archive member: '+name)
            with archive.extractfile(member) as source, (destination/name).open('wb') as output:
                shutil.copyfileobj(source, output)
    metadata = (destination/(job['product']+'_meta.txt')).read_text()
    if job['collection']+' Mosaic Tile Metadata' not in metadata or 'Version: '+job['version'] not in metadata:
        raise ValueError('Product metadata does not match configured collection/version')
    paths = {key: destination/(job['product']+'_'+suffix) for key, suffix in
             [('earthElevation','dem.tif'), ('earthCount','count.tif'), ('earthMad','mad.tif')]}
    with rasterio.open(paths['earthElevation']) as elevation:
        if elevation.crs != rasterio.crs.CRS.from_string(job['crs']) or elevation.res != (32,32):
            raise ValueError('Expected documented 32m polar Earth grid')
        for key in ('earthCount', 'earthMad'):
            with rasterio.open(paths[key]) as auxiliary:
                if (auxiliary.crs, auxiliary.shape, auxiliary.transform) != (elevation.crs,elevation.shape,elevation.transform):
                    raise ValueError('Polar auxiliary grid is misaligned')
    return paths, dict(filename=archive_path.name,sha256=sha256(archive_path),
                       metadataSha256=sha256(destination/(job['product']+'_meta.txt')),
                       versionFromMetadata=job['version'], independentlyVerified=False)


def polar_quality(paths, bounds):
    """Native mosaic contribution/MAD diagnostics; not laser counts or accuracy."""
    result={}
    for role in ('earthCount','earthMad'):
        with rasterio.open(paths[role]) as source:
            if bounds[0]<source.bounds.left or bounds[1]<source.bounds.bottom or bounds[2]>source.bounds.right or bounds[3]>source.bounds.top:
                raise ValueError('Polar quality window is outside the supplied tile')
            window=from_bounds(*bounds,transform=source.transform).round_offsets().round_lengths()
            values=source.read(1,window=window,masked=True).astype('float64').filled(np.nan)
        valid=np.isfinite(values)
        if not valid.any() or np.any(values[valid]<0):
            raise ValueError('Missing or negative polar quality values')
        result[role]=dict(validFraction=float(valid.mean()),min=float(values[valid].min()),
                          median=float(np.median(values[valid])),max=float(values[valid].max()))
    return result


def run(root, output, job):
    paths, archive = extract_product(root,output/'sources',job)
    lunar={role:root/name for role,name in FILES.items() if role.startswith('moon')}
    with rasterio.open(lunar['moonElevation']) as elevation:
        if not is_lunar_polar(elevation.crs) or elevation.res != (80,80) or elevation.count != 1:
            raise ValueError('Expected documented single-band 80m lunar polar elevation')
        for role in ('moonCounts','moonEffectiveResolution'):
            with rasterio.open(lunar[role]) as auxiliary:
                if (auxiliary.crs,auxiliary.shape,auxiliary.transform,auxiliary.count) != (elevation.crs,elevation.shape,elevation.transform,1):
                    raise ValueError('Lunar auxiliary grid is misaligned')
    paths.update(lunar)
    records=inventory(paths)
    url='https://www.pgc.umn.edu/data/'+job['collection'].lower()+'/'
    for record in records:
        if record['role'].startswith('earth'):
            record['sourceUrl']=url
            record['reportedVersion']=job['version']
    cell,pixels=320,16
    study=dict(version='polar-moon-study-v1',earthCenter=dict(latitude=job['latitude'],longitude=job['longitude']),
               moonCenter=dict(latitude=-88.5,longitude=0),earthCrs=job['crs'],cellSizeM=cell,pixels=pixels,
               roughnessCells=3,purpose='Explicit catalog-centered 5.12 km trial; not an optimized or validated analog site.')
    scenarios=[]
    for name,kernel,offset in [('average',Resampling.average,(0,0)),('bilinear',Resampling.bilinear,(0,0)),
                               ('nearest',Resampling.nearest,(0,0)),('shift-northeast',Resampling.average,(160,160)),
                               ('shift-southwest',Resampling.average,(-160,-160))]:
        directory=output/name; features={};prepared={};regions=[]
        for body,source,center,region_id in [('earth',paths['earthElevation'],study['earthCenter'],job['site']),
                                           ('moon',paths['moonElevation'],study['moonCenter'],'moon-south-pole')]:
            info=prepare_window(source,directory/(body+'-metric.tif'),body,center,cell,pixels,kernel,job['crs'],offset)
            prepared[body]=info
            record=next(record for record in records if record['role']==body+'Elevation')
            region=dict(regionId=region_id,body=body,raster=body+'-metric.tif',crs=info['crs'],bounds=info['bounds'],
                        roughnessWindowM=960,source=dict(sourceId=record['filename'],name=job['collection']+' surface mosaic' if body=='earth' else 'LOLA adjusted polar elevation',
                        url=record['sourceUrl'],version='metadata-reported '+job['version']+'; archive verification pending' if body=='earth' else 'supplied file; original release unverified',
                        nativeResolutionM=32 if body=='earth' else 80,evidenceType='MEASURED'))
            feature,plan_region,_,_=build_feature(region,directory)
            feature['provenance'][0]['processingMethod']+='; resampling='+kernel.name+'; raw source SHA256='+record['sha256']
            features[body]=feature;regions.append(plan_region)
            write_json(directory/(body+'-features.json'),feature)
        quality=native_quality(lunar,prepared['moon']['projectedBounds'])
        quality['commonScaleCoversEffectiveResolution']=supports_common_scale(quality,cell)
        earth_quality=polar_quality(paths,prepared['earth']['projectedBounds'])
        plan=dict(version='analysis-plan-v1',definitionsVersion='terrain-descriptors-v1',regions=regions)
        write_json(directory/'analysis-plan.json',plan)
        for profile in ('terrain_mobility','geological_survey'):
            result=compare(features['earth'],features['moon'],profile,plan)
            if not quality['commonScaleCoversEffectiveResolution']:
                result['status']='INCOMPLETE_DATA';result['score']=None
                result['evidenceGaps'].append('Lunar sampling support is insufficient.')
                for row in result['featureContributions']:row['distance']=row['contribution']=None
            write_json(directory/('comparison-review-'+profile+'.json'),result)
        scenarios.append(dict(name=name,kernel=kernel.name,offsetM=list(offset),earth=features['earth'],moon=features['moon'],quality=quality,earthQuality=earth_quality,prepared=prepared))
    baseline=scenarios[0]
    metrics=[dict(id=field,label=label,unit=unit,earthBaseline=baseline['earth'][field],moonBaseline=baseline['moon'][field],
                  earthRange=[min(s['earth'][field] for s in scenarios),max(s['earth'][field] for s in scenarios)],
                  moonRange=[min(s['moon'][field] for s in scenarios),max(s['moon'][field] for s in scenarios)])
             for field,label,unit in [('meanSlopeDeg','Mean slope','deg'),('p90SlopeDeg','P90 slope','deg'),('roughnessM','Residual roughness','m'),('reliefM','Relief','m')]]
    snapshot=dict(version='imported-terrain-qa-v1',status='PROVISIONAL_QA',scorePublicationApproved=False,
        selection=dict(earthSiteId=job['site'],targetId='moon-south-pole'),study=study,
        studyBounds={body:baseline['prepared'][body]['bounds'] for body in ('earth','moon')},
        processingVersions=dict(rasterio=rasterio.__version__,gdal=rasterio.__gdal_version__,numpy=np.__version__),
        codeHashes={name:sha256(Path(__file__).with_name(name)) for name in ('polar_moon.py','askja_moon.py','pipeline.py')},
        footprintWidthM=cell*pixels,metrics=metrics,lunarQuality=baseline['quality'],earthQuality=baseline['earthQuality'],
        earthValidFraction=baseline['earth']['validFraction'],moonValidFraction=baseline['moon']['validFraction'],
        allScenariosSupported=all(s['quality']['commonScaleCoversEffectiveResolution'] and s['earth']['validFraction']==1 and s['moon']['validFraction']==1 for s in scenarios),
        sources=records,archive=archive,earthAttribution=job['collection']+' DEMs provided by the Polar Geospatial Center, University of Minnesota; NGA/NSF. CC BY 4.0. Modified by reprojection, resampling and terrain-descriptor extraction. '+url,
        limitations=['Original archive authenticity and independent scientific review remain pending; version is reported by bundled metadata.',
            'Stereo-derived surface heights can include snow, ice and processing artifacts; these are not guaranteed bare-earth models.',
            'Polar mosaic contribution counts and median absolute deviations are not lunar laser counts or absolute height accuracy.',
            'Earth source vertical datums differ between products; no absolute Earth–Moon elevation comparison is made.',
            'The 5.12 km footprint keeps the McMurdo trial inside its supplied tile. It differs from the older 10.24 km Askja trial; do not rank across unequal footprints.',
            'Lunar counts may be fractional because of tile blending; their sum is not a unique raw-shot total.',
            'Effective resolution describes sampling support, not elevation accuracy or a flight-safety threshold.',
            'Study centers are proposed reference windows, not validated analog or landing sites.',
            'Scenario ranges describe processing sensitivity, not statistical confidence intervals.',
            'No lunar rotorcraft simulation or automatic compatibility ranking is provided.'])
    for name,value in [('sources.json',records),('study.json',study),('scenarios.json',scenarios),('provisional-qa.json',snapshot)]:write_json(output/name,value)
    return snapshot


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input-dir',type=Path,default=Path('.'))
    parser.add_argument('--output-dir',type=Path,default=Path('data/processed/polar-moon'))
    parser.add_argument('--snapshot-dir',type=Path,default=Path('frontend/src/data'))
    args=parser.parse_args()
    for job in JOBS:
        snapshot=run(args.input_dir,args.output_dir/job['site'],job)
        write_json(args.snapshot_dir/(job['site']+'-moon-evidence.json'),snapshot)
        print(job['site'],snapshot['status'],'all scenarios supported:',snapshot['allScenariosSupported'])


if __name__=='__main__':main()
