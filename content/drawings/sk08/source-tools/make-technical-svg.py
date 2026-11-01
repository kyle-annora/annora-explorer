"""Prepare a source-faithful, editable SK08 technical presentation.

Run from any directory: python3 source-tools/make-technical-svg.py
Requires PyMuPDF. Geometry comes from the pinned source PDF vector paths;
short dimension labels are recomposed from that same source, not inferred.
The source PDF, STEP, existing reference package and model are never changed.
"""
from pathlib import Path
import hashlib
import html
import json
import math
import re
import xml.etree.ElementTree as ET
import fitz

BASE = Path(__file__).resolve().parents[1]
SOURCE_HASH = 'db5468501a8a7c61b840db481786161313b0befbcbd31fe1c910054033a73ca2'
STEP_HASH = 'bb89218f5cd90ce713b08359d4d719f4297483039ef55d2abb33eb5af65d9cd5'
source = BASE / 'source.pdf'
assert hashlib.sha256(source.read_bytes()).hexdigest() == SOURCE_HASH, 'Revalidate extraction when the source PDF changes.'
assert hashlib.sha256((BASE / 'sk08.step').read_bytes()).hexdigest() == STEP_HASH
step_text = (BASE / 'sk08.step').read_text()
assert "#427 = CYLINDRICAL_SURFACE('',#428,4.);" in step_text
assert "#429 = CARTESIAN_POINT('',(21.,-14.,20.));" in step_text
page = fitz.open(source)[0]
paths = page.get_drawings()
# Exact front-view source extents, read from PDF path endpoints. PDF units are
# points at source scale 1:1: 72 / 25.4 points per millimetre.
left, right = paths[17]['items'][0][1].x, paths[17]['items'][0][2].x
bottom = paths[17]['items'][0][1].y
top = paths[15]['items'][0][1].y
neck_left, neck_right = paths[15]['items'][0][1].x, paths[25]['items'][0][1].x
base_top = paths[18]['items'][0][1].y
cx = paths[2]['items'][0][1].x
cy = paths[1]['items'][0][1].y
pt_per_mm = 72 / 25.4
r = 4 * pt_per_mm
checks = {
    'overallWidthMm': (right - left) / pt_per_mm,
    'overallHeightMm': (bottom - top) / pt_per_mm,
    'neckWidthMm': (neck_right - neck_left) / pt_per_mm,
    'baseHeightMm': (bottom - base_top) / pt_per_mm,
    'boreCenterFromLeftMm': (cx - left) / pt_per_mm,
    'boreCenterFromBaseMm': (bottom - cy) / pt_per_mm,
    'slotWidthMm': (paths[23]['items'][0][1].x - paths[20]['items'][0][1].x) / pt_per_mm,
}
expected = {'overallWidthMm': 42, 'overallHeightMm': 32.8, 'neckWidthMm': 18,
            'baseHeightMm': 6, 'boreCenterFromLeftMm': 21, 'boreCenterFromBaseMm': 20, 'slotWidthMm': 1}
for key, value in checks.items():
    assert abs(value - expected[key]) < 0.0001, (key, value)
source_text = page.get_text()
for value in ['42', '32.8', '18', '6', '21', '20', '\u23008 THRU']:
    assert value in source_text, f'Printed dimension missing: {value}'

SCALE = 5
TX, TY = 190 - left * SCALE, 590 - bottom * SCALE
front_viewbox = [0, 0, 1000, 720]
detail_viewbox = [330, 90, 315, 340]
def f(value):
    return f'{value:.6f}'.rstrip('0').rstrip('.') or '0'
def xy(point):
    return f'{f(point.x * SCALE + TX)} {f(point.y * SCALE + TY)}'
def transformed(x, y):
    return x * SCALE + TX, y * SCALE + TY

def path_data(drawing):
    commands, current = [], None
    for item in drawing['items']:
        kind = item[0]
        if kind == 'l':
            a, b = item[1:]
            if current != a: commands.append('M' + xy(a))
            commands.append('L' + xy(b)); current = b
        elif kind == 'c':
            a, b, c, d = item[1:]
            if current != a: commands.append('M' + xy(a))
            commands.append('C' + ' '.join(xy(point) for point in [b, c, d])); current = d
        else:
            raise ValueError(f'Unexpected source path operator {kind}')
    if drawing.get('closePath'): commands.append('Z')
    return ' '.join(commands)

# Source path indices are deliberately pinned and validated instead of using a
# heuristic "all black strokes" selection that might include sheet furniture.
indices = {'contour': list(range(15, 28)), 'hidden': list(range(101, 121)), 'center': list(range(0, 5))}
for i in indices['contour']:
    assert paths[i]['color'] == (0, 0, 0) and paths[i]['dashes'] == '[] 0'
for i in indices['hidden']:
    assert '[ 4.5 2.25 ]' in paths[i]['dashes']
for i in indices['center']:
    assert '22.677166' in paths[i]['dashes']

geometry = []
styles = {
    'hidden': {'stroke': '#9da3a9', 'stroke-width': '1', 'stroke-dasharray': '8 5'},
    'center': {'stroke': '#8b9299', 'stroke-width': '.9', 'stroke-dasharray': '14 5 2 5'},
    'contour': {'stroke': '#30363d', 'stroke-width': '1.8'},
}
for name in ['hidden', 'center', 'contour']:
    attrs = ' '.join(f'{key}="{value}"' for key, value in styles[name].items())
    children = []
    for index in indices[name]:
        # Non-scaling strokes keep the authored hierarchy crisp during zoom.
        children.append(f'<path id="source-path-{index}" data-source-path="{index}" d="{path_data(paths[index])}" vector-effect="non-scaling-stroke"/>')
    geometry.append(f'<g id="technical-{name}" data-layer="{name}" fill="none" {attrs} stroke-linecap="butt" stroke-linejoin="round">' + ''.join(children) + '</g>')

X0,Y0=transformed(left,bottom); X1,Y1=transformed(right,top)
NX0,_=transformed(neck_left,top);NX1,_=transformed(neck_right,top)
CX,CY=transformed(cx,cy); R=r*SCALE
_,BASE_TOP=transformed(left,base_top)

def line(x1,y1,x2,y2):
    return f'<path d="M{f(x1)} {f(y1)}L{f(x2)} {f(y2)}" fill="none" stroke="#a0a6ad" stroke-width=".9" vector-effect="non-scaling-stroke"/>'
def arrow(x,y,dx,dy,size=11):
    length=math.hypot(dx,dy); ux,uy=dx/length,dy/length; px,py=-uy,ux
    return f'<path d="M{f(x)} {f(y)}L{f(x+ux*size+px*3.4)} {f(y+uy*size+py*3.4)}L{f(x+ux*size-px*3.4)} {f(y+uy*size-py*3.4)}Z" fill="#777f88"/>'
def label(x,y,text,size=34,rotate=None,anchor='middle'):
    rotation=f' transform="rotate({rotate} {f(x)} {f(y)})"' if rotate else ''
    return f'<text x="{f(x)}" y="{f(y)}" font-size="{size}" text-anchor="{anchor}" fill="#606973" font-family="Arial, Helvetica, sans-serif" font-weight="400"{rotation}>{html.escape(text)}</text>'
def hdim(id,x1,x2,reference1,reference2,y,text,baseline):
    return f'<g data-dimension="{id}" aria-label="{html.escape(text)} millimetres as printed">' + line(x1,reference1,x1,y+10)+line(x2,reference2,x2,y+10)+line(x1,y,x2,y)+arrow(x1,y,1,0)+arrow(x2,y,-1,0)+label((x1+x2)/2,baseline,text)+'</g>'
def vdim(id,y1,y2,reference1,reference2,x,text,label_x):
    return f'<g data-dimension="{id}" aria-label="{html.escape(text)} millimetres as printed">'+line(reference1,y1,x+10,y1)+line(reference2,y2,x+10,y2)+line(x,y1,x,y2)+arrow(x,y1,0,1)+arrow(x,y2,0,-1)+label(label_x,(y1+y2)/2,text,rotate=-90)+'</g>'
front_dimensions = [
    hdim('neck-width',NX0,NX1,Y1-12,Y1-12,65,'18',44),
    hdim('bore-location-x',X0,CX,Y0+10,Y0+10,628,'21',657),
    hdim('overall-width',X0,X1,Y0+10,Y0+10,682,'42',713),
    vdim('overall-height',Y1,Y0,X1+14,X1+14,910,'32.8',950),
    vdim('bore-location-y',CY,Y0,CX+R+14,X1+14,840,'20',877),
    vdim('base-height',BASE_TOP,Y0,X0-12,X0-12,115,'6',88),
]
# Reposition the existing diameter leader; preserve the printed requirement.
angle=-math.pi/4; ax,ay=CX+R*math.cos(angle),CY+R*math.sin(angle)
front_dimensions.append('<g data-dimension="shaft-bore" aria-label="Diameter 8 millimetres through, as printed">'+line(ax,ay,680,172)+line(680,172,805,172)+arrow(ax,ay,680-ax,172-ay)+label(680,153,'Ø8 THRU',32,anchor='start')+'</g>')
# A dedicated, compact leader is shown only in the detail presentation. It never
# inherits clipped full-view dimensions at the edge of the detail viewport.
ax,ay=CX+R*math.cos(math.pi/4),CY+R*math.sin(math.pi/4)
detail_dimensions='<g data-dimension="shaft-bore" aria-label="Diameter 8 millimetres through, as printed">'+line(ax,ay,566,384)+line(566,384,600,384)+arrow(ax,ay,566-ax,384-ay,size=6)+label(600,408,'Ø8 THRU',16,anchor='end')+'</g>'
svg='''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 720" role="img" aria-labelledby="technical-title technical-description">
<title id="technical-title">SK08 front projection and shaft bore</title>
<desc id="technical-description">Source-derived technical reference. Exact source contour, slot, hidden and center geometry. Dimensions shown are existing source values in millimetres; no tolerances or manufacturing approval are added.</desc>
'''+''.join(geometry)+'<g id="technical-front-dimensions" data-layer="dimensions" data-presentation="front">'+''.join(front_dimensions)+'</g><g id="technical-detail-dimensions" data-layer="dimensions" data-presentation="detail" display="none">'+detail_dimensions+'</g></svg>\n'
ET.fromstring(svg)
assert '<image' not in svg and '<script' not in svg and '<style' not in svg
assert len(re.findall(r'data-source-path=', svg)) == 38
(BASE/'technical-front.svg').write_text(svg)
profile = {
    'id':'sk08-technical-front-v1','title':'Front view','sheetId':'sheet-1',
    'viewBox':front_viewbox,'detailViewBox':detail_viewbox,
    'regions':[{'id':'shaft-bore','label':'Shaft bore','partId':'sk08-body','bounds':[CX-R,CY-R,R*2,R*2],
                'geometry':{'type':'circle','cx':CX,'cy':CY,'r':R}}],
    'sourceSha256':SOURCE_HASH,'sourceStepSha256':STEP_HASH,
    'canonical':{'sheetId':'sheet-1','regionId':'shaft-bore','bounds':[162,386,32,30]},
    'source':{'file':'source.pdf','page':1,'revision':'annora-reference-1','mappingRevision':'annora-sk08-map-1',
              'sourceURL':'https://github.com/pzfreo/dw-examples/blob/c4c72a71c6440f0c824678660b59d0474f105e71/drawings/sk08/sk08.pdf',
              'units':'mm','paperUnits':'pt','sourceScale':'1:1 as printed',
              'sourceFrontBounds':[left,top,right-left,bottom-top],
              'sourceToPresentation':[SCALE,0,0,SCALE,TX,TY],
              'geometryPathIndices':indices},
    'displayedSourceDimensions':['18','21','42','32.8','20','6','Ø8 THRU'],
    'status':'derived-reference-not-manufacturing-release',
    'featureOutlinePathIds':['source-path-21','source-path-22'],
    'featureNote':'The Ø8 cylindrical feature meets the original 1 mm clamp slot. The complete circle describes the source cylinder; contour paths retain its slot opening.',
    'validation':{'unitChecksMm':checks,'sourcePathCount':38,'geometryRegenerated':False,'dimensionValuesAdded':False},
}
(BASE/'technical-front.json').write_text(json.dumps(profile,indent=2)+'\n')
print(json.dumps({'svg':'technical-front.svg','bytes':len(svg.encode()),'viewBox':front_viewbox,'detailViewBox':detail_viewbox,'bore':profile['regions'][0]['geometry'],'unitChecksMm':checks},indent=2))
