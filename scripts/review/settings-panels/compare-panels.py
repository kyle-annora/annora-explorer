from pathlib import Path
from PIL import Image, ImageChops
import json, sys
root=Path('work/panel-review')
left=root/(sys.argv[1] if len(sys.argv)>1 else 'baseline')
right=root/(sys.argv[2] if len(sys.argv)>2 else 'candidate')
report={'baseline':str(left),'candidate':str(right),'snapshots':[],'images':[],'missing':[]}
for p in sorted(left.glob('*.json')):
    if p.name.endswith('report.json'): continue
    q=right/p.name
    if not q.exists(): report['missing'].append(p.name);continue
    a=json.loads(p.read_text());b=json.loads(q.read_text())
    differences=[]
    def walk(x,y,path=''):
        if type(x)!=type(y):differences.append({'path':path,'before':x,'after':y})
        elif isinstance(x,dict):
            for key in sorted(set(x)|set(y)):walk(x.get(key),y.get(key),path+'/'+key)
        elif isinstance(x,list):
            if len(x)!=len(y):differences.append({'path':path,'beforeLength':len(x),'afterLength':len(y)})
            for i,(xx,yy) in enumerate(zip(x,y)):walk(xx,yy,path+'/'+str(i))
        elif x!=y:differences.append({'path':path,'before':x,'after':y})
    walk(a,b)
    report['snapshots'].append({'name':p.name,'identical':not differences,'differences':differences})
for p in sorted(left.glob('*.png')):
    q=right/p.name
    if not q.exists():report['missing'].append(p.name);continue
    a=Image.open(p).convert('RGB');b=Image.open(q).convert('RGB')
    if a.size!=b.size:report['images'].append({'name':p.name,'sizeMismatch':True});continue
    diff=ImageChops.difference(a,b);pixels=list(diff.getdata());changed=sum(max(v)>2 for v in pixels)
    report['images'].append({'name':p.name,'identical':not diff.getbbox(),'changedPixelsOver2':changed,'changedPercent':round(changed/len(pixels)*100,5),'bbox':diff.getbbox()})
(root/'comparison.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'snapshots':len(report['snapshots']),'identicalSnapshots':sum(r['identical'] for r in report['snapshots']),'images':len(report['images']),'identicalImages':sum(r.get('identical',False) for r in report['images']),'missing':report['missing'],'differingSnapshots':[r['name'] for r in report['snapshots'] if not r['identical']]},indent=2))

if report['missing'] or any(not item['identical'] for item in report['snapshots']):
    sys.exit(1)
