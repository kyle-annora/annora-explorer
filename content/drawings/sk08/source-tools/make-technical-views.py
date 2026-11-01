"""Extract additional SK08 technical views from the pinned source PDF.

Requires PyMuPDF. Only new technical-top/side/iso SVG and JSON assets and the
technical-footprint JSON binding are written. Existing front artwork is read,
never regenerated or edited. All geometry is original PDF vector geometry.
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
SOURCE_URL = 'https://github.com/pzfreo/dw-examples/blob/c4c72a71c6440f0c824678660b59d0474f105e71/drawings/sk08/sk08.pdf'
assert hashlib.sha256((BASE / 'source.pdf').read_bytes()).hexdigest() == SOURCE_HASH
assert hashlib.sha256((BASE / 'sk08.step').read_bytes()).hexdigest() == STEP_HASH
step = (BASE / 'sk08.step').read_text()
for entity in ["#212 = CYLINDRICAL_SURFACE('',#213,3.5);", "#1079 = CYLINDRICAL_SURFACE('',#1080,2.75);", "#1109 = CYLINDRICAL_SURFACE('',#1110,2.75);"]:
    assert entity in step
for placement in ["#214 = CARTESIAN_POINT('',(12.,-7.,27.8));",
                  "#1081 = CARTESIAN_POINT('',(5.,-7.,6.));",
                  "#1111 = CARTESIAN_POINT('',(37.,-7.,6.));"]:
    assert placement in step
page = fitz.open(BASE / 'source.pdf')[0]
paths = page.get_drawings()
source_text = page.get_text()
PT_PER_MM = 72 / 25.4
VIEWBOX = [0, 0, 1000, 720]
STYLES = {
    'hidden': {'stroke': '#9da3a9', 'stroke-width': '1', 'stroke-dasharray': '8 5'},
    'center': {'stroke': '#8b9299', 'stroke-width': '.9', 'stroke-dasharray': '14 5 2 5'},
    'contour': {'stroke': '#30363d', 'stroke-width': '1.8'},
}


def f(value):
    return f'{value:.6f}'.rstrip('0').rstrip('.') or '0'


def measure(actual, expected):
    assert abs(actual - expected) < 0.0001, (actual, expected)
    return actual


def geometry_bounds(indices):
    rect = fitz.Rect(paths[indices[0]]['rect'])
    # Inclusive extrema also retain horizontal/vertical paths with zero-area
    # bounding boxes; Rect.intersects would incorrectly omit these paths.
    for index in indices[1:]:
        other = paths[index]['rect']
        rect = fitz.Rect(min(rect.x0, other.x0), min(rect.y0, other.y0),
                         max(rect.x1, other.x1), max(rect.y1, other.y1))
    return [rect.x0, rect.y0, rect.width, rect.height]


def circular_source(index, diameter_mm):
    drawing = paths[index]
    assert len(drawing['items']) == 4 and all(item[0] == 'c' for item in drawing['items'])
    rect = drawing['rect']
    measure(rect.width / PT_PER_MM, diameter_mm)
    measure(rect.height / PT_PER_MM, diameter_mm)
    return ((rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2, diameter_mm * PT_PER_MM / 2)


class Presentation:
    def __init__(self, name, title, indices, scale, tx, ty):
        self.name, self.title, self.indices = name, title, indices
        self.scale, self.tx, self.ty = scale, tx, ty

    def point(self, x, y):
        return (x * self.scale + self.tx, y * self.scale + self.ty)

    def xy(self, point):
        return ' '.join(f(v) for v in self.point(point.x, point.y))

    def bounds(self, bounds):
        x, y = self.point(bounds[0], bounds[1])
        return [x, y, bounds[2] * self.scale, bounds[3] * self.scale]

    def path(self, index):
        drawing = paths[index]
        commands, current = [], None
        for item in drawing['items']:
            kind, a = item[0], item[1]
            if current != a:
                commands.append('M' + self.xy(a))
            if kind == 'l':
                commands.append('L' + self.xy(item[2]))
                current = item[2]
            elif kind == 'c':
                commands.append('C' + ' '.join(self.xy(p) for p in item[2:]))
                current = item[4]
            else:
                raise ValueError(f'Unsupported source vector operator {kind}')
        if drawing.get('closePath'):
            commands.append('Z')
        return ' '.join(commands)

    def artwork(self, annotations):
        groups = []
        for layer in ['hidden', 'center', 'contour']:
            selected = self.indices.get(layer, [])
            for i in selected:
                if layer == 'contour':
                    assert paths[i]['color'] == (0, 0, 0) and paths[i]['dashes'] == '[] 0'
                elif layer == 'hidden':
                    assert '[ 4.5 2.25 ]' in paths[i]['dashes']
                else:
                    assert '22.677166' in paths[i]['dashes']
            attrs = ' '.join(f'{key}="{value}"' for key, value in STYLES[layer].items())
            content = ''.join(f'<path id="source-path-{i}" data-source-path="{i}" d="{self.path(i)}" vector-effect="non-scaling-stroke"/>' for i in selected)
            if selected:
                groups.append(f'<g data-layer="{layer}" fill="none" {attrs} stroke-linecap="butt" stroke-linejoin="round">{content}</g>')
        description = 'Exact source PDF vector geometry. Derived reference, not a manufacturing release. No dimensions or tolerances have been invented.'
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 720" role="img" aria-labelledby="technical-title technical-description"><title id="technical-title">SK08 {html.escape(self.title)}</title><desc id="technical-description">{description}</desc>'
        svg += ''.join(groups) + '<g data-layer="dimensions" data-presentation="front">' + annotations + '</g></svg>\n'
        ET.fromstring(svg)
        assert not re.search(r'<(?:image|script|style)|\sstyle=', svg)
        assert svg.count('data-source-path=') == sum(len(v) for v in self.indices.values())
        return svg

    def profile(self, region_id, label, region_bounds, outline_ids, canonical, dimensions, checks, geometry_type='compound', circle=None):
        b = region_bounds
        geometry = {'type': geometry_type, 'bounds': b, 'cx': b[0] + b[2] / 2, 'cy': b[1] + b[3] / 2}
        if circle:
            cx, cy = self.point(circle[0], circle[1])
            geometry = {'type': 'circle', 'cx': cx, 'cy': cy, 'r': circle[2] * self.scale}
        ids = [f'source-path-{i}' for i in outline_ids]
        return {
            'id': f'sk08-technical-{self.name}-v1', 'title': self.title,
            'sheetId': canonical['sheetId'], 'viewBox': VIEWBOX,
            'artworkFile': f'technical-{self.name}.svg', 'annotationVariant': 'front',
            'regions': [{'id': region_id, 'label': label, 'partId': 'sk08-body', 'role': 'feature',
                         'bounds': b, 'geometry': geometry, 'featureOutlinePathIds': ids}],
            'featureOutlinePathIds': ids,
            'canonical': canonical,
            'sourceSha256': SOURCE_HASH, 'sourceStepSha256': STEP_HASH,
            'source': {'file': 'source.pdf', 'page': 1, 'revision': 'annora-reference-1',
                       'mappingRevision': 'annora-sk08-map-1', 'sourceURL': SOURCE_URL,
                       'units': 'mm', 'paperUnits': 'pt', 'sourceScale': '1:1 as printed',
                       'sourceViewBounds': geometry_bounds(self.indices['contour']),
                       'sourceToPresentation': [self.scale, 0, 0, self.scale, self.tx, self.ty],
                       'geometryPathIndices': self.indices},
            'displayedSourceDimensions': dimensions,
            'status': 'derived-reference-not-manufacturing-release',
            'validation': {'unitChecksMm': checks, 'sourcePathCount': sum(len(v) for v in self.indices.values()),
                           'geometryRegenerated': False, 'dimensionValuesAdded': False},
        }


def line(x1, y1, x2, y2):
    return f'<path d="M{f(x1)} {f(y1)}L{f(x2)} {f(y2)}" fill="none" stroke="#a0a6ad" stroke-width=".9" vector-effect="non-scaling-stroke"/>'


def arrow(x, y, dx, dy, size=11):
    length = math.hypot(dx, dy)
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    return f'<path d="M{f(x)} {f(y)}L{f(x+ux*size+px*3.4)} {f(y+uy*size+py*3.4)}L{f(x+ux*size-px*3.4)} {f(y+uy*size-py*3.4)}Z" fill="#777f88"/>'


def label(x, y, text, size=34, rotate=None, anchor='middle'):
    rotation = f' transform="rotate({rotate} {f(x)} {f(y)})"' if rotate else ''
    return f'<text x="{f(x)}" y="{f(y)}" font-size="{size}" text-anchor="{anchor}" fill="#606973" font-family="Arial, Helvetica, sans-serif" font-weight="400"{rotation}>{html.escape(text)}</text>'


def dimension(id, text, contents):
    return f'<g data-dimension="{id}" aria-label="{html.escape(text)} as printed">{contents}</g>'


def hdim(id, x1, x2, ref1, ref2, y, text, baseline):
    # Extend only 10 units beyond the dimension line, whichever side it lies on.
    end1, end2 = y + (10 if y > ref1 else -10), y + (10 if y > ref2 else -10)
    return dimension(id, text, line(x1, ref1, x1, end1) + line(x2, ref2, x2, end2) + line(x1, y, x2, y) + arrow(x1, y, 1, 0) + arrow(x2, y, -1, 0) + label((x1+x2)/2, baseline, text))


def vdim(id, y1, y2, ref1, ref2, x, text, label_x):
    end1, end2 = x + (10 if x > ref1 else -10), x + (10 if x > ref2 else -10)
    return dimension(id, text, line(ref1, y1, end1, y1) + line(ref2, y2, end2, y2) + line(x, y1, x, y2) + arrow(x, y1, 0, 1) + arrow(x, y2, 0, -1) + label(label_x, (y1+y2)/2, text, rotate=-90))


def write(presentation, profile, annotations):
    svg = presentation.artwork(annotations)
    (BASE / f'technical-{presentation.name}.svg').write_text(svg)
    (BASE / f'technical-{presentation.name}.json').write_text(json.dumps(profile, indent=2) + '\n')
    print(json.dumps({'view': presentation.name, 'paths': profile['validation']['sourcePathCount'], 'bytes': len(svg.encode()), 'bounds': profile['regions'][0]['bounds']}))


# Top projection: exact counterbore rims and cylindrical mounting-hole outlines.
for text in ['5', '37', '7', '2× ⌀5.5 THRU']:
    assert text in source_text
left, top = paths[41]['items'][0][1]
right, bottom = paths[42]['items'][0][2]
hole1, hole2 = circular_source(46, 5.5), circular_source(47, 5.5)
circular_source(40, 7.5)
circular_source(43, 7.5)
top_checks = {
    'overallWidthMm': measure((right-left)/PT_PER_MM, 42),
    'overallDepthMm': measure((bottom-top)/PT_PER_MM, 14),
    'firstHoleFromLeftMm': measure((hole1[0]-left)/PT_PER_MM, 5),
    'secondHoleFromLeftMm': measure((hole2[0]-left)/PT_PER_MM, 37),
    'holeCenterFromBottomMm': measure((bottom-hole1[1])/PT_PER_MM, 7),
    'mountingHoleDiameterMm': 5.5,
}
top_view = Presentation('top', 'Top view · mounting holes', {'contour': list(range(28,48)), 'hidden': list(range(121,133)), 'center': list(range(5,11))}, 5.5, 170-left*5.5, 265-top*5.5)
X0,Y0 = top_view.point(left,top)
X1,Y1 = top_view.point(right,bottom)
C1,CY = top_view.point(hole1[0],hole1[1])
C2,_ = top_view.point(hole2[0],hole2[1])
R = hole1[2]*top_view.scale
annotations = hdim('first-hole-location',X0,C1,Y0-12,CY-60,155,'5',135)
annotations += hdim('second-hole-location',X0,C2,Y0-12,CY-60,85,'37',65)
annotations += vdim('hole-row-location',CY,Y1,X0-12,X0-12,95,'7',65)
leader = ''
for center, end in [(C1,350),(C2,650)]:
    ax,ay = center + (R/math.sqrt(2) if center==C1 else -R/math.sqrt(2)), CY+R/math.sqrt(2)
    leader += line(ax,ay,end,570)+arrow(ax,ay,end-ax,570-ay)
leader += line(350,570,650,570)+label(500,617,'2× Ø5.5 THRU')
annotations += dimension('mounting-hole-diameter','2× Ø5.5 THRU',leader)
top_profile = top_view.profile('mounting-holes','Mounting holes',top_view.bounds(geometry_bounds([40,43])),[40,43,46,47],{'sheetId':'sheet-1','regionId':'mounting-holes','bounds':[116,155,125,46]},['5','37','7','2× Ø5.5 THRU'],top_checks)
top_profile['featureNote'] = 'Both existing mounting-hole outlines are selected together. The Ø5.5 printed requirement names the inner cylindrical hole; the larger original rim outlines remain unchanged and receive no new dimension.'
top_profile['sourceFeatureCircles'] = [{'sourcePathId':f'source-path-{i}','cx':top_view.point(c[0],c[1])[0],'cy':top_view.point(c[0],c[1])[1],'r':c[2]*top_view.scale} for i,c in [(46,hole1),(47,hole2)]]
write(top_view, top_profile, annotations)

# Side projection: original concentric cross-bore and chamfer/rim contours.
for text in ['14','7','27.8','⌀7 THRU']:
    assert text in source_text
left, top = paths[50]['items'][0][2]
right, bottom = paths[52]['items'][0][1]
cross = circular_source(56,7)
circular_source(54,8)
side_checks = {
    'overallDepthMm': measure((right-left)/PT_PER_MM,14),
    'overallHeightMm': measure((bottom-top)/PT_PER_MM,32.8),
    'crossBoreFromLeftMm': measure((cross[0]-left)/PT_PER_MM,7),
    'crossBoreFromBaseMm': measure((bottom-cross[1])/PT_PER_MM,27.8),
    'crossBoreDiameterMm': 7,
}
side_view = Presentation('side','Side view · cross-bore',{'contour':list(range(48,57)),'hidden':list(range(133,141)),'center':list(range(11,15))},5.4,350-left*5.4,100-top*5.4)
X0,Y0 = side_view.point(left,top)
X1,Y1 = side_view.point(right,bottom)
CX,CY = side_view.point(cross[0],cross[1]);R=cross[2]*side_view.scale
annotations = hdim('cross-bore-location-x',X0,CX,Y1+10,Y1+10,642,'7',669)
annotations += hdim('overall-depth',X0,X1,Y1+10,Y1+10,688,'14',710)
annotations += vdim('cross-bore-location-y',CY,Y1,X1+14,X1+14,670,'27.8',710)
ax,ay = CX+R/math.sqrt(2),CY-R/math.sqrt(2)
annotations += dimension('cross-bore-diameter','Ø7 THRU',line(ax,ay,650,80)+line(650,80,810,80)+arrow(ax,ay,650-ax,80-ay)+label(650,61,'Ø7 THRU',anchor='start'))
side_profile = side_view.profile('cross-bore','Cross-bore',side_view.bounds(geometry_bounds([54])),[54,56],{'sheetId':'sheet-1','regionId':'cross-bore','bounds':[376,362,43,35]},['7','14','27.8','Ø7 THRU'],side_checks,geometry_type='circle',circle=cross)
side_profile['canonicalAliases'] = [{'sheetId':'sheet-2','regionId':'cross-bore-detail','bounds':[580,224,43,43]}]
side_profile['featureNote'] = 'The Ø7 cylindrical bore is the inner source contour. The concentric original rim is preserved; no additional chamfer requirement is inferred.'
write(side_view, side_profile, annotations)

# Isometric drawing is already an authored source projection. Retain every
# contour and its exact occlusion. No dimensions, centerlines or hidden edges
# are synthesized, and no physical scale is claimed for this NTS view.
iso_bounds = geometry_bounds(list(range(57,95)))
iso_scale = 560/iso_bounds[3]
iso_tx = 500-(iso_bounds[0]+iso_bounds[2]/2)*iso_scale
iso_ty = 80-iso_bounds[1]*iso_scale
iso_view = Presentation('iso','Isometric overview',{'contour':list(range(57,95)),'hidden':[],'center':[]},iso_scale,iso_tx,iso_ty)
iso_profile = iso_view.profile('overview','SK08 shaft support',iso_view.bounds(iso_bounds),list(range(57,95)),{'sheetId':'sheet-1','regionId':'overview','bounds':[599,110,165,180]},[],{},geometry_type='path')
iso_profile['source']['sourceScale'] = 'ISO VIEW (NTS) as printed'
iso_profile['notToScale'] = True
iso_profile['featureNote'] = 'Exact source isometric contours, including the existing visible interior curves. This overview is not to scale and adds no dimension or geometry.'
assert 'ISO VIEW (NTS)' in source_text
write(iso_view,iso_profile,'')

# The mounting-footprint association on source sheet 2 resolves to the same
# exact front base geometry. Reuse the approved full front artwork instead of
# inventing a top edge across the neck or leaving a clipped section view.
front = json.loads((BASE/'technical-front.json').read_text())
front_bytes = (BASE/'technical-front.svg').read_bytes()
front_matrix = front['source']['sourceToPresentation']
foot_source_bounds = geometry_bounds([17,18,19,26,27])
sx,_,_,sy,tx,ty = front_matrix
foot_bounds = [foot_source_bounds[0]*sx+tx,foot_source_bounds[1]*sy+ty,foot_source_bounds[2]*sx,foot_source_bounds[3]*sy]
foot_ids = [f'source-path-{i}' for i in [17,18,19,26,27]]
foot = {
    **front, 'id':'sk08-technical-footprint-v1','title':'Front view · mounting footprint',
    'sheetId':'sheet-2','artworkFile':'technical-front.svg','annotationVariant':'front',
    'regions':[{'id':'mounting-footprint-detail','label':'Mounting footprint','partId':'sk08-body','role':'feature',
                'bounds':foot_bounds,'geometry':{'type':'compound','bounds':foot_bounds,'cx':foot_bounds[0]+foot_bounds[2]/2,'cy':foot_bounds[1]+foot_bounds[3]/2},'featureOutlinePathIds':foot_ids}],
    'canonical':{'sheetId':'sheet-2','regionId':'mounting-footprint-detail','bounds':[127,338,185,32]},
    'featureOutlinePathIds':foot_ids,
    'featureNote':'The full approved front view is retained. Only the exact original base contour is highlighted; no artificial top edge is added through the neck.',
    'artworkSha256':hashlib.sha256(front_bytes).hexdigest(),
}
foot.pop('detailViewBox',None)
(BASE/'technical-footprint.json').write_text(json.dumps(foot,indent=2)+'\n')
assert (BASE/'technical-front.svg').read_bytes() == front_bytes
print(json.dumps({'view':'footprint','artwork':'technical-front.svg','bounds':foot_bounds,'paths':foot_ids}))
