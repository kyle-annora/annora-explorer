"""Prepare exact-source Link rods technical artwork and presentation metadata.

Run from any directory with Python and PyMuPDF:
  python3 content/drawings/linkrods/source-tools/make-technical-svg.py

Only new technical assets are written. The pinned PDF, SVG, STEP and canonical
drawing package remain unchanged. No CAD geometry or dimensions are inferred.
"""
from pathlib import Path
import hashlib
import html
import json
import math
import xml.etree.ElementTree as ET
import fitz

BASE = Path(__file__).resolve().parents[1]
PDF_SHA = '20799c4c0107c3cc7998f7c56c014b91533b83b413e85954710801a6bc0e7c08'
STEP_SHA = '3674e4b01ee0e983c81ed170f0574cda201ad08e0f7b46e05e4f4613400fd5f7'
SVG_SHA = '836ff6ef0a8adf40d0b27790ea8d5f55c396754ac41bff376d6a7e9b17de6c2d'
for file, digest in [('sheet.pdf', PDF_SHA), ('linkrods.step', STEP_SHA), ('sheet.svg', SVG_SHA)]:
    assert hashlib.sha256((BASE / file).read_bytes()).hexdigest() == digest, f'Revalidate extraction: {file} changed.'
pkg = json.loads((BASE / 'package.json').read_text())
source_bytes = {name: (BASE / name).read_bytes() for name in ['sheet.pdf', 'sheet.svg', 'linkrods.step', 'package.json', 'drawing.json']}
doc = fitz.open(BASE / 'sheet.pdf')
page = doc[0]
paths = page.get_drawings()
text = page.get_text()
for label in ['3.875', '0.125', '\u23001.034 THRU', '\u23000.440 THRU', '\u00f81.5', '\u00f80.791', 'SCALE 10:1', 'ISO VIEW (NTS)']:
    assert label in text, f'Source dimension or projection note missing: {label}'
step_text = (BASE / 'linkrods.step').read_text()
assert '0.517234284238' in step_text and '0.219923711459' in step_text

# These pinned PDF operation ranges contain only the black source geometry of
# the top and isometric projections. Preserve every path, including the source
# freeform/tessellated edges. We do not simplify or replace them with primitives.
TOP = list(range(703, 1136))
ISO = list(range(2135, 3004))
CENTER = [2, 3, 4, 5]
for i in TOP + ISO:
    assert paths[i]['color'] == (0, 0, 0) and paths[i]['dashes'] == '[] 0'
    assert abs(paths[i]['width'] - 1.4173228740692139) < .00001
for i in CENTER:
    assert paths[i]['color'] == (0, 0, 0) and '22.677166' in paths[i]['dashes']

top_bounds = fitz.Rect()
iso_bounds = fitz.Rect()
for i in TOP: top_bounds |= paths[i]['rect']
for i in ISO: iso_bounds |= paths[i]['rect']
assert len(TOP) == 433 and len(ISO) == 869
assert abs(top_bounds.x0 - 103.41967010498047) < .00001
assert abs(top_bounds.x1 - 245.72694396972656) < .00001

large_center = (paths[3]['items'][0][1].x, paths[2]['items'][0][1].y)
small_center = (paths[5]['items'][0][1].x, paths[4]['items'][0][1].y)
large_radius = (paths[790]['rect'].width) / 2
small_radius = (paths[744]['rect'].width) / 2
pt_per_mm = 10 * 72 / 25.4  # Original drawing explicitly prints SCALE 10:1.
checks = {
    'horizontalCenterSpacingMm': (small_center[0] - large_center[0]) / pt_per_mm,
    'verticalCenterOffsetMm': (small_center[1] - large_center[1]) / pt_per_mm,
    'largeBoreDiameterMm': 2 * large_radius / pt_per_mm,
    'smallBoreDiameterMm': 2 * small_radius / pt_per_mm,
    'largeOutsideDiameterMm': paths[767]['rect'].width / pt_per_mm,
    'smallOutsideDiameterMm': paths[731]['rect'].width / pt_per_mm,
}
expected = {'horizontalCenterSpacingMm': 3.875, 'verticalCenterOffsetMm': .125,
            'largeBoreDiameterMm': 2 * .517234284238, 'smallBoreDiameterMm': 2 * .219923711459,
            'largeOutsideDiameterMm': 1.5}
for name, value in expected.items(): assert abs(checks[name] - value) < .00001, (name, checks[name])
assert abs(checks['smallOutsideDiameterMm'] - .791) < .0005  # Printed nominal is rounded.

TOP_MATRIX = [5, 0, 0, 5, 150 - top_bounds.x0 * 5, 320 - large_center[1] * 5]
ISO_MATRIX = [4.1, 0, 0, 4.1, 1470 - iso_bounds.x0 * 4.1, 80 - iso_bounds.y0 * 4.1]
def n(value): return f'{value:.6f}'.rstrip('0').rstrip('.') or '0'
def point(x, y, matrix=TOP_MATRIX):
    a, b, c, d, e, f = matrix
    return (a * x + c * y + e, b * x + d * y + f)
def xy(p, matrix): return ' '.join(n(x) for x in point(p.x, p.y, matrix))
def bounds(rect, matrix=TOP_MATRIX):
    x, y = point(rect[0], rect[1], matrix)
    return [x, y, rect[2] * matrix[0], rect[3] * matrix[3]]
def path_data(path, matrix):
    parts, current = [], None
    for item in path['items']:
        kind, start = item[:2]
        if current != start: parts.append('M' + xy(start, matrix))
        if kind == 'l': parts.append('L' + xy(item[2], matrix)); current = item[2]
        elif kind == 'c': parts.append('C' + ' '.join(xy(p, matrix) for p in item[2:])); current = item[-1]
        else: raise ValueError(f'Unexpected source PDF operator: {kind}')
    if path.get('closePath'): parts.append('Z')
    return ' '.join(parts)

def geometry(ids, matrix, group, color='#30363d', width='1.8', extra=''):
    children = ''.join(f'<path id="source-path-{i}" data-source-path="{i}" d="{path_data(paths[i], matrix)}" vector-effect="non-scaling-stroke"/>' for i in ids)
    return f'<g id="{group}" data-layer="{group}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="butt" {extra}>{children}</g>'
geometry_svg = geometry(CENTER, TOP_MATRIX, 'center', '#8b9299', '.9', 'stroke-dasharray="14 5 2 5"')
geometry_svg += geometry(TOP, TOP_MATRIX, 'contour')
geometry_svg += geometry(ISO, ISO_MATRIX, 'isometric-contour')
LC = point(*large_center); SC = point(*small_center)
LR, SR = large_radius * 5, small_radius * 5
LOR, SOR = paths[767]['rect'].width * 2.5, paths[731]['rect'].width * 2.5

def line(x1, y1, x2, y2):
    return f'<path d="M{n(x1)} {n(y1)}L{n(x2)} {n(y2)}" fill="none" stroke="#a0a6ad" stroke-width=".9" vector-effect="non-scaling-stroke"/>'
def arrow(x, y, dx, dy, size=10):
    length = math.hypot(dx, dy); ux, uy = dx / length, dy / length; px, py = -uy, ux
    return f'<path d="M{n(x)} {n(y)}L{n(x + ux * size + px * 3)} {n(y + uy * size + py * 3)}L{n(x + ux * size - px * 3)} {n(y + uy * size - py * 3)}Z" fill="#777f88"/>'
def label(x, y, text, size=32, anchor='middle', rotate=None, halo=None):
    transform = f' transform="rotate({rotate} {n(x)} {n(y)})"' if rotate else ''
    paint = f' stroke="#fff" stroke-width="{halo}" stroke-linejoin="round" paint-order="stroke fill"' if halo else ''
    return f'<text x="{n(x)}" y="{n(y)}" fill="#606973" font-family="Arial, Helvetica, sans-serif" font-size="{size}" font-weight="400" text-anchor="{anchor}"{transform}{paint}>{html.escape(text)}</text>'
def leader(name, center, radius, angle, elbow, end, text, size=30, label_y=None, anchor='end', halo=None):
    tip = [center[0] + radius * math.cos(angle), center[1] + radius * math.sin(angle)]
    return f'<g data-dimension="{name}" aria-label="{html.escape(text)} millimetres, as printed">' + line(*tip, *elbow) + line(*elbow, *end) + arrow(*tip, elbow[0] - tip[0], elbow[1] - tip[1], 7 if size < 30 else 10) + label(end[0], label_y or end[1] + size + 8, text, size, anchor, halo=halo) + '</g>'
top_dimensions = '<g data-dimension="bore-center-spacing" aria-label="3.875 millimetres horizontal center spacing, as printed">'
top_dimensions += line(LC[0], 200, LC[0], 120) + line(SC[0], 270, SC[0], 120) + line(LC[0], 130, SC[0], 130)
top_dimensions += arrow(LC[0], 130, 1, 0) + arrow(SC[0], 130, -1, 0) + label((LC[0] + SC[0]) / 2, 107, '3.875', 40) + '</g>'
top_dimensions += leader('large-bore', LC, LR, math.pi / 4, [380, 500], [500, 500], 'Ø1.034 THRU', 40, 538)
top_dimensions += leader('small-bore', SC, SR, -math.pi / 4, [860, 220], [955, 220], 'Ø0.440 THRU', 40, 195, halo=8)
# The narrow 0.125 source center offset is retained as a concise source note.
# It is not magnified or given a misleading separate geometric scale.
top_dimensions += '<g data-dimension="center-offset">' + label(500, 590, 'Center offset 0.125', 40) + '</g>'
large_dimensions = leader('large-bore', LC, LR, math.pi / 4, [380, 480], [505, 480], 'Ø1.034 THRU', 24)
large_dimensions += leader('large-outside', LC, LOR, 3 * math.pi / 4, [145, 535], [310, 535], 'Ø1.5', 24)
small_dimensions = leader('small-bore', SC, SR, math.pi / 4, [875, 420], [975, 420], 'Ø0.440 THRU', 22)
small_dimensions += leader('small-outside', SC, SOR, math.pi / 2, [760, 510], [935, 510], 'Ø0.791', 22)
annotations = ''.join(f'<g data-layer="dimensions" data-presentation="{variant}" display="{display}">{content}</g>' for variant, content, display in [
    ('top', top_dimensions, 'inline'), ('large-bore', large_dimensions, 'none'),
    ('small-bore', small_dimensions, 'none'), ('web', '', 'none'),
    ('isometric', label(1760, 710, 'ISOMETRIC / NOT TO SCALE', 22), 'none')])
svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2300 740" role="img" aria-labelledby="linkrods-technical-title linkrods-technical-description">\n'
svg += '<title id="linkrods-technical-title">Link rods: top projection, bore details and isometric reference</title>\n'
svg += '<desc id="linkrods-technical-description">Exact source vector geometry restyled for reading. Source dimensions are retained in millimetres, including rounded printed diameters. This is an unreviewed reference, not a manufacturing release.</desc>\n'
svg += geometry_svg + annotations + '</svg>\n'
ET.fromstring(svg)
assert all(mark not in svg for mark in ['<image', '<canvas', '<script', '<style', 'style='])
assert svg.count('data-source-path=') == len(TOP + ISO + CENTER)
(BASE / 'technical-main.svg').write_text(svg)

canonical = {region['id']: region for region in pkg['sheets'][0]['regions']}
def region(id, box, outline, shape='path', circle=None, role=None):
    geom = {'type': shape, 'bounds': box, 'cx': box[0] + box[2] / 2, 'cy': box[1] + box[3] / 2}
    if circle: geom = {'type': 'circle', 'cx': circle[0], 'cy': circle[1], 'r': circle[2]}
    result = {'id': id, 'label': canonical[id]['label'], 'partId': 'linkrod-body', 'bounds': box, 'geometry': geom,
              'mappingStatus': 'confirmed', 'outlinePathIds': [f'source-path-{i}' for i in outline],
              'canonical': {'sheetId': 'sheet-1', 'regionId': id, 'bounds': canonical[id]['bounds']}}
    if role: result['role'] = role
    return result
top_box = bounds([top_bounds.x0, top_bounds.y0, top_bounds.width, top_bounds.height])
top_overview = region('overview', top_box, [731, 732, 767, 768, 837, 850], role='overview')
large = region('large-bore', [LC[0] - LR, LC[1] - LR, LR * 2, LR * 2], [790, 791], circle=[*LC, LR])
small = region('small-bore', [SC[0] - SR, SC[1] - SR, SR * 2, SR * 2], [744, 745], circle=[*SC, SR])
web = region('connecting-web', bounds([137.35714721679688, 194.80453491210938, 86.70390319824219, 28.20916748046875]), [837, 850, 851, 852])
iso_box = bounds([iso_bounds.x0, iso_bounds.y0, iso_bounds.width, iso_bounds.height], ISO_MATRIX)
iso_overview = region('overview', iso_box, ISO, role='overview')
main_regions = [top_overview, large, small, web]
presentations = [
    {'id': 'top', 'title': 'Top view', 'annotationVariant': 'top', 'sheetId': 'sheet-1', 'regionId': 'overview', 'viewBox': [0, 40, 1000, 580], 'regions': main_regions},
    {'id': 'large-bore', 'title': 'Large bore', 'annotationVariant': 'large-bore', 'sheetId': 'sheet-1', 'regionId': 'large-bore', 'viewBox': [110, 170, 430, 430], 'regions': [large]},
    {'id': 'small-bore', 'title': 'Small bore', 'annotationVariant': 'small-bore', 'sheetId': 'sheet-1', 'regionId': 'small-bore', 'viewBox': [650, 190, 350, 390], 'regions': [small]},
    {'id': 'web', 'title': 'Connecting web', 'annotationVariant': 'web', 'sheetId': 'sheet-1', 'regionId': 'connecting-web', 'viewBox': [300, 220, 530, 250], 'regions': [web]},
    {'id': 'isometric', 'title': 'Isometric view', 'annotationVariant': 'isometric', 'sheetId': 'sheet-1', 'regionId': 'overview', 'viewBox': [1320, 20, 900, 720], 'regions': [iso_overview],
     'note': 'Alternate source isometric projection of the whole part. The canonical overview association remains the original top-view region.'},
]
profile = {
    'id': 'linkrods-technical-main-v1', 'title': 'Top view', 'sheetId': 'sheet-1', 'presentation': 'top', 'annotationVariant': 'top',
    'viewBox': presentations[0]['viewBox'], 'detailViewBox': presentations[1]['viewBox'], 'regions': main_regions, 'presentations': presentations,
    'artworkFile': 'technical-main.svg', 'sourceSha256': PDF_SHA, 'sourceStepSha256': STEP_SHA, 'sourceSvgSha256': SVG_SHA,
    'source': {'file': 'sheet.pdf', 'page': 1, 'revision': pkg['revision'], 'mappingRevision': pkg['mappingRevision'], 'sourceURL': pkg['sourceURL'],
               'units': 'mm', 'paperUnits': 'pt', 'sourceScale': '10:1 as printed; source isometric explicitly NTS',
               'sourceTopBounds': list(top_bounds), 'sourceIsometricBounds': list(iso_bounds),
               'topToPresentation': TOP_MATRIX, 'isometricToPresentation': ISO_MATRIX,
               'geometryPathIndices': {'contour': TOP, 'center': CENTER, 'isometric': ISO}},
    'displayedSourceDimensions': ['3.875', '0.125', 'Ø1.034 THRU', 'Ø0.440 THRU', 'Ø1.5', 'Ø0.791'],
    'status': 'derived-reference-not-manufacturing-release',
    'statusNote': 'Unreviewed source drawing. Rounded nominal dimensions, incomplete freeform dimensioning and no supplied tolerance or approval remain unchanged.',
    'validation': {'unitChecksMm': checks, 'sourcePathCount': len(TOP + ISO + CENTER), 'geometryRegenerated': False,
                   'sourcePathsSimplified': False, 'dimensionValuesAdded': False, 'manufacturerRevisionInferred': False},
}
(BASE / 'technical-main.json').write_text(json.dumps(profile, indent=2) + '\n')
for name, before in source_bytes.items(): assert (BASE / name).read_bytes() == before, f'Original asset changed: {name}'
print(json.dumps({'svg': 'technical-main.svg', 'bytes': len(svg.encode()), 'sourcePaths': profile['validation']['sourcePathCount'], 'presentations': [p['id'] for p in presentations], 'unitChecksMm': checks}, indent=2))
