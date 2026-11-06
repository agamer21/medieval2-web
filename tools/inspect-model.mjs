import fs from 'node:fs';
import {parseMesh} from '../src/mesh.js';
const model=parseMesh(fs.readFileSync(process.argv[2]));
console.log(JSON.stringify({vertices:model.vertexCount,groups:model.groups.map(g=>({category:g.category,name:g.name,triangles:g.indices.length/3,optional:g.optional})),bones:model.bones.length,bounds:model.bounds,streams:model.streamTypes,trailingBytes:model.trailingBytes},null,2));
