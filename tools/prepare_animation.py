"""Read selected loose animation-pack records without modifying game files."""
from pathlib import Path
import json
import struct
from prepare_assets import DEFAULT_GAME, WORK

def read_index(path):
    raw=path.read_bytes(); magic=raw[:9]
    if magic not in (b'ANIM.PACK',b'SKEL.PACK') or len(raw)<20: raise ValueError('Invalid animation-pack index')
    count=struct.unpack_from('<I',raw,16)[0]; offset=20; entries=[]
    for _ in range(count):
        length,start,size=struct.unpack_from('<iii',raw,offset);offset+=12;end=offset+length
        if length<=0 or start<0 or size<0 or end>len(raw): raise ValueError('Invalid index range')
        name_start=offset+9 if magic==b'ANIM.PACK' else offset
        if raw[end-1]!=0: raise ValueError('Missing index-name terminator')
        name=raw[name_start:end-1].decode('latin-1')
        entries.append({'name':name,'offset':start,'size':size})
        offset=end
    if offset!=len(raw): raise ValueError('Unexpected index tail')
    return entries

def member(path, entry):
    if entry['offset']+entry['size']>path.stat().st_size: raise ValueError('Index extends beyond pack')
    with path.open('rb') as stream: stream.seek(entry['offset']);return stream.read(entry['size'])

def skeleton(raw):
    scale,count,ik=struct.unpack_from('<fHf',raw);at=10;bones=[]
    if count>256: raise ValueError('Too many skeleton bones')
    for i in range(count):
        x,y,z,parent=struct.unpack_from('<3fi',raw,at+4);end=raw.index(0,at+76)
        if parent>=i or parent < -1: raise ValueError('Invalid skeleton hierarchy')
        bones.append({'name':raw[at+76:end].decode('latin-1'),'parent':parent,'pivot':[x,y,z]});at=end+1
    slots=[]
    for slot in range(687):
        if raw[at]==0: at+=1;continue
        end=raw.index(0,at);name=raw[at:end].decode('latin-1');at=end+1+42
        events=struct.unpack_from('<I',raw,at)[0];at+=4
        if events>10000: raise ValueError('Invalid skeleton event count')
        for _ in range(events):
            at+=8
            while raw[at] not in (0,1):at+=1
            at+=3
        at+=6;slots.append({'slot':slot,'path':name})
    return {'scale':scale,'bones':bones,'slots':slots,'uninterpretedTailBytes':len(raw)-at}

def prepare():
    source=DEFAULT_GAME/'data/Animations';dest=WORK/'private-assets/native-animation';dest.mkdir(parents=True,exist_ok=True)
    skels=read_index(source/'skeletons.idx');anims=read_index(source/'pack.idx')
    rigs={}
    for wanted in ('MTW2_Spear','MTW2_Spear_primary','fs_test_shield'):
        entry=next((entry for entry in skels if entry['name'].casefold()==wanted.casefold()),None)
        if entry:
            rigs[wanted]=skeleton(member(source/'skeletons.dat',entry));print(wanted,len(rigs[wanted]['bones']),'bones',len(rigs[wanted]['slots']),'filled slots')
    primary=rigs['MTW2_Spear'];lookup={entry['name'].replace('\\','/').casefold():entry for entry in anims}
    clips=[]
    for slot in primary['slots']:
        entry=lookup.get(slot['path'].replace('\\','/').casefold())
        if entry and any(word in entry['name'].casefold() for word in ('idle','walk','run')):
            clips.append({**entry,'slot':slot['slot']})
    print('Candidate clips:',json.dumps([{'path':c['name'],'slot':c['slot']} for c in clips[:24]]))
    (dest/'skeletons.json').write_text(json.dumps(rigs,indent=2),encoding='utf-8')
    chosen=[]
    for kind in ('idle','walk','run'):
        candidate=next((clip for clip in clips if kind in clip['name'].casefold() and 'back' not in clip['name'].casefold()),None)
        if not candidate: continue
        raw=member(source/'pack.dat',candidate)
        frames,rotation_bones,position_bones=struct.unpack_from('<HHB',raw)
        expected=5+frames*(16*rotation_bones+12*position_bones+24)+40
        if len(raw)!=expected: raise ValueError('Animation size does not match its frame counts')
        target=dest/f'{kind}.anim';target.write_bytes(raw)
        chosen.append({'id':kind,'name':kind.title(),'path':'/assets/native-animation/'+target.name,'nativePath':candidate['name'],'slot':candidate['slot'],'frames':frames,'rotationBones':rotation_bones,'positionBones':position_bones})
    attachment_clips=[]
    for kind, rig_name in (('primary','MTW2_Spear_primary'),('shield','fs_test_shield')):
        rig=rigs.get(rig_name)
        if not rig: continue
        candidate=next((lookup.get(slot['path'].replace('\\','/').casefold()) for slot in rig['slots'] if lookup.get(slot['path'].replace('\\','/').casefold())),None)
        if candidate:
            target=dest/f'{kind}.anim';target.write_bytes(member(source/'pack.dat',candidate))
            attachment_clips.append({'id':kind,'rig':rig_name,'path':'/assets/native-animation/'+target.name,'nativePath':candidate['name']})
    (dest/'clips.json').write_text(json.dumps({'skeletons':'/assets/native-animation/skeletons.json','clips':chosen,'attachments':attachment_clips},indent=2),encoding='utf-8')
    print('Prepared clips:',json.dumps(chosen))
    return rigs,chosen

if __name__=='__main__':prepare()
