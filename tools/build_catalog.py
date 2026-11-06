"""Locate the selected native model and its exact modeldb faction textures."""
from pathlib import Path
import json
import re
from prepare_assets import WORK

class Tokens:
    def __init__(self, text, offset): self.text, self.at = text, offset
    def number(self):
        found = re.match(r'\s*([-+\d.eE]+)', self.text[self.at:])
        if not found: raise ValueError(f'Expected number at {self.at}')
        self.at += found.end()
        return float(found[1])
    def string(self):
        size = int(self.number())
        if size < 0 or size > 4096: raise ValueError('Invalid modeldb string length')
        # Length strings are separated by one space; empty strings still have a delimiter.
        if self.text[self.at:self.at+1].isspace(): self.at += 1
        value = self.text[self.at:self.at+size]
        self.at += size
        return value

def entry(text, name):
    match = re.search(rf'(?<!\S){len(name)} {re.escape(name)}(?=\s)', text, re.IGNORECASE)
    if not match: raise ValueError(f'Missing modeldb entry {name}')
    tokens = Tokens(text, match.end())
    sets = int(tokens.number()); models = []
    for _ in range(sets):
        for _ in range(int(tokens.number())):
            model = tokens.string(); distance = tokens.number(); models.append((model, distance))
    textures = {}
    attachments = {}
    for table in (textures, attachments):
        for _ in range(int(tokens.number())):
            faction = tokens.string()
            table[faction] = [tokens.string(), tokens.string(), tokens.string()]
    return models, textures, attachments

def build(root=WORK / 'private-assets'):
    db = (root / 'data/unit_models/battle_models.modeldb').read_text(encoding='latin-1')
    models, textures, attachments = entry(db, 'spear_militia')
    required = [models[0][0], *[textures[f][0] for f in ('england','france')], *[attachments[f][0] for f in ('england','france')]]
    print('Required archive paths:')
    for name in required: print('data/' + name.lower())
    catalogue = []
    for faction in ('england', 'france'):
        paths = {'mesh': 'data/' + models[0][0].lower(), 'main': 'data/' + textures[faction][0].lower(), 'attachment': 'data/' + attachments[faction][0].lower()}
        if all((root / path).is_file() for path in paths.values()):
            catalogue.append({'id': f'spear-militia-{faction}', 'name': 'Spear Militia', 'faction': faction.title(), **{key:'/assets/'+path for key,path in paths.items()}})
    manifest = {'title': 'Locally extracted original assets', 'entries': catalogue, 'required': required}
    if (root/'native-animation/clips.json').is_file():manifest['animations']='/assets/native-animation/clips.json'
    (root / 'catalog.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(f'Catalogue contains {len(catalogue)} complete entries.')
    return manifest

if __name__ == '__main__': build()
