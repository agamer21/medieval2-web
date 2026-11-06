import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseUnitDefinitions,findSpearMilitia} from '../src/units.js';
test('unit records preserve raw source values and ignore comments',()=>{
 const units=parseUnitDefinitions('; heading\r\ntype Sample Unit\r\nsoldier sample_mesh, 7, 0, 1 ; note\r\nstat_health 2, 0\r\n\r\ntype Spear Militia\nsoldier spear_militia, 60, 0, 1\nstat_mental 3, normal, trained');
 assert.equal(units.length,2);assert.equal(units[0].fields.get('soldier'),'sample_mesh, 7, 0, 1');assert.equal(findSpearMilitia(units).fields.get('stat_mental'),'3, normal, trained');
});
test('missing sample unit is an explicit absent result',()=>assert.equal(findSpearMilitia(parseUnitDefinitions('type Other Unit\nsoldier other_mesh, 3, 0, 1')),null));
const original=new URL('../../../work/medieval2/private-assets/data/export_descr_unit.txt',import.meta.url);
if(fs.existsSync(original))test('installed spear militia definition has matching model and source stat fields',()=>{
 const unit=findSpearMilitia(parseUnitDefinitions(fs.readFileSync(original,'latin1')));assert(unit);assert.match(unit.fields.get('soldier'),/^spear_militia,/i);for(const key of ['stat_health','stat_pri','stat_pri_armour','stat_mental'])assert(unit.fields.has(key),key);
});
