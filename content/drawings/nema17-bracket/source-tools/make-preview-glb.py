# Usage: python3 make-preview-glb.py /path/to/mesh.json /path/to/model.glb
import json,struct,sys
from pathlib import Path
import numpy as np
m=json.loads(Path(sys.argv[1]).read_text())['meshes'][0]
raw=np.array(m['attributes']['position']['array'],dtype=np.float64).reshape(-1,3)
pos=(raw[:,[0,2,1]]*np.array([1,1,-1])*.001).astype('<f4')
norm=np.array(m['attributes']['normal']['array'],dtype=np.float64).reshape(-1,3)
norm=(norm[:,[0,2,1]]*np.array([1,1,-1])).astype('<f4')
indices=np.array(m['index']['array'],dtype='<u4')
chunks=[pos.tobytes(),norm.tobytes(),indices.tobytes()];offset=0;views=[]
for i,c in enumerate(chunks):
 views.append({'buffer':0,'byteOffset':offset,'byteLength':len(c),'target':34962 if i<2 else 34963});offset+=len(c)
doc={'asset':{'version':'2.0','generator':'Annora STEP preview preparation; occt-import-js 0.0.23'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'nema17_bracket_body','mesh':0,'extras':{'stepEntity':'#15 MANIFOLD_SOLID_BREP','originalProductName':m['name'],'cadUnits':'millimeter','presentationUnits':'meter','coordinateConversion':'[x,y,z] mm -> [x,z,-y] / 1000 m'}}],'meshes':[{'name':'nema17_bracket_body','primitives':[{'attributes':{'POSITION':0,'NORMAL':1},'indices':2,'material':0}]}],'materials':[{'name':'Illustrative satin metal','pbrMetallicRoughness':{'baseColorFactor':[.64,.66,.68,1],'metallicFactor':.55,'roughnessFactor':.38}}],'buffers':[{'byteLength':offset}],'bufferViews':views,'accessors':[{'bufferView':0,'componentType':5126,'count':len(pos),'type':'VEC3','min':pos.min(axis=0).tolist(),'max':pos.max(axis=0).tolist()},{'bufferView':1,'componentType':5126,'count':len(norm),'type':'VEC3'},{'bufferView':2,'componentType':5125,'count':len(indices),'type':'SCALAR'}]}
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4);binary=b''.join(chunks);binary+=b'\0'*((-len(binary))%4)
out=struct.pack('<4sII',b'glTF',2,12+8+len(j)+8+len(binary))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(binary),b'BIN\0')+binary
Path(sys.argv[2]).write_bytes(out)
print('GLB bytes',len(out),'bounds',pos.min(axis=0).tolist(),pos.max(axis=0).tolist())
