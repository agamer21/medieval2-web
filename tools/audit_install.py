"""Execution-free PE/import and installation audit. Never writes to the game folder."""
from pathlib import Path
import hashlib
import json
import struct
from prepare_assets import DEFAULT_GAME, WORK

def pe_info(path):
    data=path.read_bytes()
    if data[:2]!=b'MZ':raise ValueError('Not a PE executable')
    pe=struct.unpack_from('<I',data,0x3c)[0]
    if data[pe:pe+4]!=b'PE\0\0':raise ValueError('Invalid PE signature')
    machine,sections,stamp,_,_,optional_size,characteristics=struct.unpack_from('<HHIIIHH',data,pe+4)
    optional=pe+24;magic=struct.unpack_from('<H',data,optional)[0]
    if magic not in (0x10b,0x20b):raise ValueError('Unsupported optional header')
    table=optional+optional_size;ranges=[]
    for i in range(sections):
        at=table+i*40;vsize,virtual,size,raw=struct.unpack_from('<IIII',data,at+8)
        ranges.append((virtual,max(vsize,size),raw,size))
    def offset(rva):
        for virtual,span,raw,size in ranges:
            if virtual<=rva<virtual+span:
                delta=rva-virtual
                if delta>=size or raw+delta>=len(data):raise ValueError('RVA has no file bytes')
                return raw+delta
        raise ValueError(f'Unmapped RVA {rva:x}')
    def cstring(at):
        end=data.index(b'\0',at,min(len(data),at+4096));return data[at:end].decode('ascii',errors='replace')
    directory=optional+(96 if magic==0x10b else 112)
    import_rva,import_size=struct.unpack_from('<II',data,directory+8)
    imports=[]
    if import_rva:
        at=offset(import_rva)
        for _ in range(512):
            original,time,forward,name,thunk=struct.unpack_from('<IIIII',data,at);at+=20
            if not any((original,time,forward,name,thunk)):break
            functions=[];entry=offset(original or thunk);width=4 if magic==0x10b else 8
            while True:
                value=int.from_bytes(data[entry:entry+width],'little');entry+=width
                if value==0:break
                if value>>(width*8-1):functions.append(f'ordinal:{value&0xffff}')
                else:functions.append(cstring(offset(value)+2))
                if len(functions)>10000:raise ValueError('Import list too long')
            imports.append({'dll':cstring(offset(name)),'functions':functions})
    return {'architecture':{0x14c:'x86',0x8664:'x86-64'}.get(machine,hex(machine)),
            'format':'PE32' if magic==0x10b else 'PE32+', 'file_bytes':len(data),
            'sha256':hashlib.sha256(data).hexdigest(),'sections':sections,'imports':imports}

def audit():
    exe=DEFAULT_GAME/'medieval2.exe';result=pe_info(exe)
    result['packs']=[{'name':p.name,'bytes':p.stat().st_size} for p in sorted((DEFAULT_GAME/'packs').glob('*.pack'))]
    result['preferences_present']=(DEFAULT_GAME/'medieval2.preference.cfg').is_file()
    result['evidence_scope']='Static PE headers/imports and filesystem metadata only; no native game execution or behavior comparison.'
    WORK.mkdir(parents=True,exist_ok=True);(WORK/'binary-audit.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps({'architecture':result['architecture'],'sha256':result['sha256'],'imports':[i['dll'] for i in result['imports']],'pack_count':len(result['packs'])},indent=2))
    return result

if __name__=='__main__':audit()
