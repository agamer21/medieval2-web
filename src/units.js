// Read source unit-definition fields without inventing combat rules for them.
export function parseUnitDefinitions(text) {
  if(text.length>8*1024*1024)throw new Error('Unit definition file is too large');
  const units=[];let current=null;
  for(const source of text.replace(/^\uFEFF/,'').split(/\r?\n/)){
    const line=source.split(';',1)[0].trim();if(!line)continue;
    const match=/^(\S+)\s+(.+)$/.exec(line);if(!match)continue;
    const key=match[1].toLowerCase(),value=match[2].trim();
    if(key==='type'){current={name:value,fields:new Map()};units.push(current);if(units.length>10000)throw new Error('Too many unit definitions');}
    else if(current)current.fields.set(key,value);
  }
  return units;
}
export function findSpearMilitia(units){
  return units.find(unit=>/^spear[ _]militia$/i.test(unit.name))??units.find(unit=>/^spear_militia$/i.test((unit.fields.get('soldier')??'').split(',')[0].trim()))??null;
}
