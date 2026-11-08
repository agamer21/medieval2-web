"""Prepare an optional browser copy of the installed intro in private storage."""
import shutil
import subprocess
import tempfile
from pathlib import Path

from server import DEFAULT_ASSETS, detect_game_root


def main():
    game = detect_game_root()
    ffmpeg = shutil.which('ffmpeg')
    if game is None or ffmpeg is None:
        return
    source = game / 'data/fmv/faction/prologue_intro.bik'
    target = DEFAULT_ASSETS / 'prologue/intro.mp4'
    if not source.is_file():
        return
    if target.is_file() and target.stat().st_size and target.stat().st_mtime >= source.stat().st_mtime:
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=target.parent) as scratch:
        output = Path(scratch) / 'intro.mp4'
        try:
            subprocess.run([
                ffmpeg, '-hide_banner', '-loglevel', 'error', '-i', str(source),
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
                '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
                '-movflags', '+faststart', str(output)
            ], check=True, timeout=120)
            output.replace(target)
        except (OSError, subprocess.SubprocessError):
            print('The optional intro could not be prepared. The tutorial is available from the menu.')


if __name__ == '__main__':
    main()
