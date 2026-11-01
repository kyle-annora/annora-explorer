// Usage: node tessellate-step.cjs /absolute/path/to/occt-import-js /path/to/linkrods.step /path/to/mesh.json
const fs=require('fs');
require(process.argv[2])().then(occt=>{
 const result=occt.ReadStepFile(fs.readFileSync(process.argv[3]),{linearUnit:'millimeter',linearDeflectionType:'absolute_value',linearDeflection:.006,angularDeflection:.2});
 fs.writeFileSync(process.argv[4],JSON.stringify(result));
 console.log(JSON.stringify({success:result.success,root:result.root,meshes:result.meshes.map(m=>({name:m.name,positions:m.attributes.position.array.length/3,triangles:m.index.array.length/3,faces:m.brep_faces.length}))},null,2));
});
