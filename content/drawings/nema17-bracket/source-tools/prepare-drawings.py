"""Prepare source-derived NEMA 17 reading assets, retaining the original PDF.

Requires PyMuPDF. Geometry is copied from the pinned source PDF vector paths;
only composition, line styling and existing annotation placement are changed.
All dimensions below already occur in that source. No manufacturing release.
"""
from pathlib import Path
import hashlib, html, json, math, re, subprocess
import xml.etree.ElementTree as ET
import fitz

BASE = Path(__file__).resolve().parents[1]
MODEL = BASE.parents[1] / 'models' / 'nema17-bracket'
# Preparation must never silently replace an operator-reviewed release.
if (BASE/'package.json').exists():
    existing = json.loads((BASE/'package.json').read_text())
    if any(r.get('mappingStatus') == 'confirmed' for sheet in existing.get('sheets', []) for r in sheet.get('regions', [])):
        raise SystemExit('A reviewed package exists. Reproduce in an isolated copy; do not replace the release.')
SOURCE_COMMIT = '1678998387693c9a96c7033123f849411e061c93'
URL = f'https://github.com/pzfreo/dw-examples/blob/{SOURCE_COMMIT}/drawings/nema17-bracket/nema17-bracket.pdf'
STEP_HASH = 'bc7b546d7062b56d93ad3a82fc90f25aa44e3930a9e98bdc93c5d409e4a84c2d'
sha = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
assert sha(BASE/'nema17-bracket.step') == STEP_HASH
PDF_HASH = sha(BASE/'source.pdf')
MODEL_HASH = sha(MODEL/'model.glb')
# Business references use loadProject's manifest-and-assets revision, never the
# GLB source checksum. The model must be registered before preparing its drawing.
MODEL_REVISION = subprocess.check_output([
    'node', '--input-type=module', '-e',
    "import {loadProject} from './scripts/lib/project-config.mjs'; const {models}=await loadProject(process.cwd()); const model=models.find(m=>m.manifest.id==='nema17-bracket'); if(!model)throw new Error('Register the prepared model before preparing drawings.'); process.stdout.write(model.revision);"
], cwd=BASE.parents[2], text=True).strip()
assert MODEL_REVISION.startswith('sha256:')
page = fitz.open(BASE/'source.pdf')[0]
paths = page.get_drawings()
text = page.get_text()
assert all(value in text for value in ['35', '41', '51', '31', '4× ⌀3.3 THRU', '⌀32 THRU', '6× SLOT 4.5 × 7.5'])
source_step = (BASE/'nema17-bracket.step').read_text()
for entity in ["#306 = CYLINDRICAL_SURFACE('',#307,16.);", "#308 = CARTESIAN_POINT('',(0.,0.,30.));", "#213 = CYLINDRICAL_SURFACE('',#214,1.65);", "#1217 = CYLINDRICAL_SURFACE('',#1218,2.25);"]:
    assert entity in source_step
PT_PER_MM = 72 / 25.4 * 2  # Source drawing scale is 2:1.
f = lambda value: f'{value:.6f}'.rstrip('0').rstrip('.') or '0'


def box(indices):
    rs = [paths[i]['rect'] for i in indices]
    x, y = min(r.x0 for r in rs), min(r.y0 for r in rs)
    return [x, y, max(r.x1 for r in rs)-x, max(r.y1 for r in rs)-y]


def measure(actual, expected):
    assert abs(actual-expected) < .0001, (actual,expected)
    return actual


front_box = box(range(68,88))
base_box = box(range(29,68))
checks = {
    'motorApertureDiameterMm': measure(paths[78]['rect'].width/PT_PER_MM,32),
    'motorHoleDiameterMm': measure(paths[79]['rect'].width/PT_PER_MM,3.3),
    'motorHolePitchMm': measure((paths[76]['rect'].x0-paths[79]['rect'].x0)/PT_PER_MM,31),
    'overallWidthMm': measure(front_box[2]/PT_PER_MM,41),
    'overallHeightMm': measure(front_box[3]/PT_PER_MM,51),
    'baseDepthMm': measure(base_box[2]/PT_PER_MM,35),
    'baseSlotWidthMm': measure(box(range(44,48))[2]/PT_PER_MM,4.5),
    'baseSlotLengthMm': measure(box(range(44,48))[3]/PT_PER_MM,7.5),
}


def path_data(index, scale, tx, ty):
    def xy(p): return f'{f(p.x*scale+tx)} {f(p.y*scale+ty)}'
    commands, current = [], None
    for item in paths[index]['items']:
        kind, start = item[:2]
        if current != start: commands.append('M'+xy(start))
        if kind == 'l': commands.append('L'+xy(item[2]));current=item[2]
        elif kind == 'c': commands.append('C'+' '.join(xy(p) for p in item[2:]));current=item[4]
        else: raise ValueError(f'Unsupported vector operator: {kind}')
    if paths[index].get('closePath'): commands.append('Z')
    return ' '.join(commands)


def vectors(indices, scale, tx, ty):
    styles={'contour':'stroke="#30363d" stroke-width="1.8"','hidden':'stroke="#a3a8ad" stroke-width=".9" stroke-dasharray="8 5"','center':'stroke="#949a9f" stroke-width=".8" stroke-dasharray="14 5 2 5"'}
    out=[]
    for layer in ['hidden','center','contour']:
        content=''.join(f'<path id="source-path-{i}" data-source-path="{i}" d="{path_data(i,scale,tx,ty)}" vector-effect="non-scaling-stroke"/>' for i in indices.get(layer,[]))
        if content:out.append(f'<g data-layer="{layer}" fill="none" {styles[layer]} stroke-linecap="butt" stroke-linejoin="round">{content}</g>')
    return ''.join(out)


def line(x1,y1,x2,y2):
    return f'<path d="M{f(x1)} {f(y1)}L{f(x2)} {f(y2)}" fill="none" stroke="#a0a6ad" stroke-width=".9" vector-effect="non-scaling-stroke"/>'


def arrow(x,y,dx,dy):
    length=math.hypot(dx,dy);ux,uy=dx/length,dy/length
    return f'<path d="M{f(x)} {f(y)}L{f(x+ux*10-uy*3)} {f(y+uy*10+ux*3)}L{f(x+ux*10+uy*3)} {f(y+uy*10-ux*3)}Z" fill="#777f88"/>'


def label(x,y,value,size=28,rotate=None,anchor='middle'):
    t=f' transform="rotate({rotate} {x} {y})"' if rotate else ''
    return f'<text x="{f(x)}" y="{f(y)}" font-size="{size}" text-anchor="{anchor}" fill="#606973" font-family="Arial, Helvetica, sans-serif"{t}>{html.escape(value)}</text>'


def hdim(x1,x2,ref1,ref2,y,value):
    end=y+(10 if y>ref1 else -10)
    return line(x1,ref1,x1,end)+line(x2,ref2,x2,end)+line(x1,y,x2,y)+arrow(x1,y,1,0)+arrow(x2,y,-1,0)+label((x1+x2)/2,y-12,value)


def vdim(y1,y2,ref1,ref2,x,value):
    end=x+(10 if x>ref1 else -10)
    return line(ref1,y1,end,y1)+line(ref2,y2,end,y2)+line(x,y1,x,y2)+arrow(x,y1,0,1)+arrow(x,y2,0,-1)+label(x-14,(y1+y2)/2,value,rotate=-90)


def write_json(name,data): (BASE/name).write_text(json.dumps(data,indent=2)+'\n')


region_sources=[
 {'id':'motor-aperture','label':'Motor aperture','bounds':box([78]),'focusPoint':[.0015,.03,0],'direction':[1,0,0],'halfSize':[.003,.018,.018],'dimension':'Diameter 32 mm THRU, as printed','note':'Source cylinder #306, radius 16 mm, axis through (0, 0, 30) mm. One feature of the original bracket body.'},
 {'id':'motor-mounting-holes','label':'Motor mounting holes','bounds':box([75,76,77,79]),'focusPoint':[.0015,.03,0],'direction':[1,0,0],'halfSize':[.003,.02,.02],'dimension':'4 x diameter 3.3 mm THRU; 31 mm pitch, as printed','note':'Four source cylinders #213, #244, #275 and #337, radius 1.65 mm, centers at y +/-15.5 and z 14.5 / 45.5 mm. All belong to the same solid.'},
 {'id':'base-slots','label':'Base mounting slots','bounds':box(range(44,68)),'focusPoint':[.02,.0015,0],'direction':[0,1,0],'halfSize':[.015,.003,.02],'dimension':'6 x SLOT 4.5 x 7.5 mm, as printed','note':'Six source base slots use radius 2.25 mm end surfaces #1217 through #1896, on the same body. The original PDF identifies their 4.5 x 7.5 dimensions.'}
]
regions=[]
for r in region_sources:
    region={k:v for k,v in r.items() if k not in ['direction','halfSize']}
    region.update(partId='nema17-bracket-body',mappingStatus='needs-review',role='feature',camera={'target':r['focusPoint'],'direction':r['direction'],'halfSize':r['halfSize']})
    regions.append(region)
package={'schemaVersion':2,'id':'build123d-nema17-bracket-drawing','modelId':'nema17-bracket','title':'NEMA 17 motor bracket - source reference','number':'B123D-NEMA17-BRACKET','revision':'annora-reference-1','revisionLabel':'Source 16789983 / reference edition 1','manufacturerRevision':None,'assetRevision':PDF_HASH,'sourceURL':URL,'units':'mm','status':'unreviewed-reference','statusLabel':'Reference drawing - unreviewed','statusNote':'Automatic draftwright source drawing. No manufacturer revision or approval is supplied. General tolerance and full through-step dimensions are missing; some extension lines cross features. Prepared technical views rearrange source vectors and existing annotations only.','stepFile':'nema17-bracket.step','stepSha256':STEP_HASH,'pdfFile':'source.pdf','originalPdfFile':'source.pdf','reviewFile':'source-review.json','modelRevision':MODEL_REVISION,'mappingRevision':'annora-nema17-map-1','pairing':{'status':'source-derived','evidence':f'dw-examples commit {SOURCE_COMMIT} publishes this STEP and its generated PDF together. The STEP matches the build123d original at 742a3dccb372a39d50cb231de481f3add34efcd9 byte for byte. The display mesh is tessellated from that STEP; prepared views preserve the PDF vector geometry.'},'assets':[{'id':'source-pdf','kind':'pdf','file':'source.pdf','sha256':PDF_HASH},{'id':'source-step','kind':'step','file':'nema17-bracket.step','sha256':STEP_HASH}],'sheets':[{'id':'sheet-1','title':'Original source drawing','svgFile':'sheet-1.svg','assetId':'source-pdf','format':'pdf','pdfPage':1,'coordinateFrame':'page-top-left','rotation':0,'viewBox':[0,0,page.rect.width,page.rect.height],'regions':regions}]}
write_json('package.json',package)
# Preserve the immutable onboarding input; release preparation writes package.json only.
if not (BASE/'intake-source.json').exists(): write_json('intake-source.json',package)
(BASE/'sheet-1.svg').write_text(page.get_svg_image(text_as_path=True))


def prepare(name,title,source_box,indices,scale,left,top,definitions,dimensions,annotations):
    tx,ty=left-source_box[0]*scale,top-source_box[1]*scale
    def bound(b):return [b[0]*scale+tx,b[1]*scale+ty,b[2]*scale,b[3]*scale]
    technical=[]
    for rid,outlines,shape in definitions:
        original=next(r for r in region_sources if r['id']==rid);b=bound(original['bounds'])
        geometry={'type':'compound','bounds':b,'cx':b[0]+b[2]/2,'cy':b[1]+b[3]/2}
        if shape=='circle':geometry={'type':'circle','cx':b[0]+b[2]/2,'cy':b[1]+b[3]/2,'r':b[2]/2}
        technical.append({'id':rid,'label':original['label'],'partId':'nema17-bracket-body','role':'feature','bounds':b,'geometry':geometry,'featureOutlinePathIds':[f'source-path-{i}' for i in outlines]})
    profile={'id':f'nema17-technical-{name}-v1','title':title,'sheetId':'sheet-1','viewBox':[0,0,1000,720],'artworkFile':f'technical-{name}.svg','annotationVariant':'front','regions':technical,'sourceSha256':PDF_HASH,'sourceStepSha256':STEP_HASH,'canonical':{'sheetId':'sheet-1','regionId':definitions[0][0],'bounds':next(r['bounds'] for r in region_sources if r['id']==definitions[0][0])},'source':{'file':'source.pdf','page':1,'revision':'annora-reference-1','mappingRevision':'annora-nema17-map-1','sourceURL':URL,'units':'mm','paperUnits':'pt','sourceScale':'2:1 as printed','sourceViewBounds':source_box,'sourceToPresentation':[scale,0,0,scale,tx,ty],'geometryPathIndices':indices},'displayedSourceDimensions':dimensions,'status':'derived-reference-not-manufacturing-release','validation':{'unitChecksMm':checks,'sourcePathCount':sum(len(x) for x in indices.values()),'geometryRegenerated':False,'dimensionValuesAdded':False}}
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 720" role="img"><title>NEMA 17 bracket - {html.escape(title)}</title><desc>Exact source PDF vectors. Existing dimensions only. Reference, not a manufacturing release.</desc>'+vectors(indices,scale,tx,ty)+'<g data-layer="dimensions" data-presentation="front">'+annotations(scale,tx,ty)+'</g></svg>\n'
    ET.fromstring(svg);assert not re.search(r'<(?:image|script|style)|\sstyle=',svg)
    (BASE/f'technical-{name}.svg').write_text(svg);write_json(f'technical-{name}.json',profile)
    return profile


def front_annotations(s,tx,ty):
    x=lambda v:v*s+tx;y=lambda v:v*s+ty
    a=hdim(x(473.3858),x(649.1339),y(467.7165),y(467.7165),78,'31')
    a+=hdim(x(front_box[0]),x(front_box[0]+front_box[2]),y(725.6693),y(725.6693),656,'41')
    a+=vdim(y(front_box[1]),y(front_box[1]+front_box[3]),300,300,228,'51')
    # The source diameter is retained; leader placement only is adjusted.
    a+=line(x(625),y(491),757,185)+line(757,185,810,185)+label(812,171,'⌀32 THRU',size=27)
    a+=line(x(649.1339),y(643.4646),754,550)+line(754,550,820,550)+label(815,587,'4× ⌀3.3 THRU',size=25)
    return a


def base_annotations(s,tx,ty):
    x=lambda v:v*s+tx;y=lambda v:v*s+ty
    a=hdim(x(base_box[0]),x(base_box[0]+base_box[2]),y(332.0236),y(332.0236),662,'35')
    a+=vdim(y(base_box[1]),y(base_box[1]+base_box[3]),300,300,230,'41')
    a+=line(x(276.3779),y(286.6654),786,380)+line(786,380,850,380)+label(812,331,'6× SLOT',size=26)+label(812,363,'4.5 × 7.5',size=26)
    return a

front=prepare('front','Motor face',front_box,{'contour':list(range(68,88)),'hidden':list(range(193,203)),'center':list(range(6,16))},1.65,300,130,[('motor-aperture',[78],'circle'),('motor-mounting-holes',[75,76,77,79],'compound')],['41','51','31','⌀32 THRU','4× ⌀3.3 THRU'],front_annotations)
# Separate reading variants remove ambiguous overlapping hit rectangles while
# retaining the same source geometry and immutable source-region coordinates.
front['presentations'] = [
    {'id':'front','title':'Motor aperture','viewBox':front['viewBox'],'annotationVariant':'front','regionId':'motor-aperture','regions':[front['regions'][0]]},
    {'id':'mounting','title':'Motor mounting pattern','viewBox':front['viewBox'],'annotationVariant':'front','regionId':'motor-mounting-holes','regions':[front['regions'][1]]},
]
write_json('technical-front.json',front)
base=prepare('base','Base mounting slots',base_box,{'contour':list(range(29,68)),'hidden':list(range(187,193)),'center':list(range(3,6))},2,300,140,[('base-slots',list(range(44,68)),'compound')],['35','41','6× SLOT 4.5 × 7.5'],base_annotations)
write_json('overview-views.json',{'schemaVersion':1,'sheets':{'sheet-1':[front['id']+':front:sheet-1',front['id']+':mounting:sheet-1',base['id']+':base:sheet-1']}})
iso=box(range(88,167));s=3.7;tx=400-(iso[0]+iso[2]/2)*s;ty=325-(iso[1]+iso[3]/2)*s
poster='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 650" role="img"><title>NEMA 17 motor bracket</title><desc>Isometric source drawing vector view, not to scale.</desc><rect width="800" height="650" fill="#f1f1ee"/>'+vectors({'contour':list(range(88,167))},s,tx,ty)+'</svg>\n'
(BASE/'poster.svg').write_text(poster)
print(json.dumps({'modelRevision':package['modelRevision'],'pdfSha256':PDF_HASH,'stepSha256':STEP_HASH,'unitChecksMm':checks,'regions':[r['id'] for r in regions],'preparedViews':[front['id'],base['id']]},indent=2))
