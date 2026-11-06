"""Use the game's shipped extractor in a private folder, never in the Steam tree."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

DEFAULT_GAME = Path(r'C:\Program Files (x86)\Steam\steamapps\common\Medieval II Total War')
WORK = Path(__file__).resolve().parents[3] / 'work' / 'medieval2'

def digest(path: Path) -> str:
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def prepare(game: Path, destination: Path, patterns: list[str], inventory: bool = False):
    game, destination = game.resolve(), destination.resolve()
    if destination.is_relative_to(game) or game.is_relative_to(destination):
        raise ValueError('Extraction must use a separate private folder outside the game installation.')
    extractor = game / 'tools/unpacker/unpacker.exe'
    if not extractor.is_file():
        raise FileNotFoundError('The installed game must contain tools/unpacker/unpacker.exe.')
    destination.mkdir(parents=True, exist_ok=True)
    bin_dir = destination.parent / 'bin'
    bin_dir.mkdir(exist_ok=True)
    for source in (extractor, game / 'msvcr71.dll', game / 'msvcp71.dll'):
        shutil.copy2(source, bin_dir / source.name)
    source_files = [game / 'medieval2.exe', *sorted((game / 'packs').glob('*.pack'))]
    before = {str(p.relative_to(game)): {'size': p.stat().st_size, 'mtime_ns': p.stat().st_mtime_ns} for p in source_files}
    for pattern in patterns:
        target = destination.parent / 'pack-index.txt' if inventory else destination
        args = [str(bin_dir / extractor.name), f'--source={game / "packs/*.pack"}',
                f'--destination={target}', f'--filter={pattern}',
                f'--mode={1 if inventory else 0}', '--verbosity=0']
        result = subprocess.run(args, input='Y\nY\nY\n', text=True, capture_output=True, cwd=bin_dir, timeout=600)
        (destination.parent / 'extractor-last.log').write_text(result.stdout + result.stderr, encoding='utf-8')
        if result.returncode or 'FAILED:' in result.stdout:
            raise RuntimeError(f'Extractor failed for {pattern}: {result.stdout[-1200:]}')
        print(f'Prepared {pattern}', flush=True)
    after = {str(p.relative_to(game)): {'size': p.stat().st_size, 'mtime_ns': p.stat().st_mtime_ns} for p in source_files}
    if before != after:
        raise RuntimeError('Source file metadata changed during extraction; inspect before proceeding.')
    evidence = {'game_root': str(game), 'game_exe_sha256': digest(game / 'medieval2.exe'),
                'unpacker_sha256': digest(extractor), 'source_metadata_unchanged': before == after,
                'source_files': before, 'filters': patterns, 'inventory_only': inventory}
    (destination.parent / 'extraction-evidence.json').write_text(json.dumps(evidence, indent=2), encoding='utf-8')
    return destination

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--game', type=Path, default=DEFAULT_GAME)
    parser.add_argument('--output', type=Path, default=WORK / 'private-assets')
    parser.add_argument('--filter', action='append', default=[])
    parser.add_argument('--inventory', action='store_true')
    args = parser.parse_args()
    prepare(args.game, args.output, args.filter or (['*.*'] if args.inventory else ['*spear_militia*lod0.mesh', '*battle_models.modeldb', '*export_descr_unit.txt']), args.inventory)
