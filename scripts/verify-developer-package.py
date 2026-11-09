#!/usr/bin/env python3
"""Verify the delivered files before editing or installing dependencies."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sys


def verify(root):
    manifest = json.loads((root / 'package-manifest.json').read_text(encoding='utf-8'))
    expected = set()
    for item in manifest['files']:
        name = item['path']
        relative = PurePosixPath(name)
        if '\\' in name or ':' in name or relative.is_absolute() or '..' in relative.parts or relative.as_posix() != name:
            raise ValueError('Unsafe manifest path: ' + str(relative))
        if name in expected:
            raise ValueError('Duplicate manifest path: ' + name)
        path = root / relative
        if not path.resolve().is_relative_to(root.resolve()) or path.is_symlink() or any(p.is_symlink() for p in path.parents if p != root.parent):
            raise ValueError('Unexpected symlink: ' + str(relative))
        data = path.read_bytes()
        if len(data) != item['bytes'] or hashlib.sha256(data).hexdigest() != item['sha256']:
            raise ValueError('File mismatch: ' + str(relative))
        expected.add(relative.as_posix())
    actual = {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()}
    extras = actual - expected - {'package-manifest.json', 'SHA256SUMS.txt'}
    if extras:
        raise ValueError('Unexpected files: ' + ', '.join(sorted(extras)[:10]))
    checked = set()
    for line in (root / 'SHA256SUMS.txt').read_text(encoding='utf-8').splitlines():
        digest, name = line.split('  ', 1)
        relative = PurePosixPath(name)
        if not re.fullmatch(r'[0-9a-f]{64}', digest) or '\\' in name or ':' in name or relative.is_absolute() or '..' in relative.parts or relative.as_posix() != name:
            raise ValueError('Unsafe checksum path')
        if name in checked or name not in expected | {'package-manifest.json'}:
            raise ValueError('Duplicate or unexpected checksum path: ' + name)
        checked.add(name)
        if hashlib.sha256((root / relative).read_bytes()).hexdigest() != digest:
            raise ValueError('Checksum mismatch: ' + name)
    if checked != expected | {'package-manifest.json'}:
        raise ValueError('Incomplete checksum coverage')
    print('PASS: %s files; version %s; application %s' %
          (len(expected), manifest['applicationVersion'], manifest['applicationCommit']))


if __name__ == '__main__':
    try:
        verify(Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent)
    except (OSError, ValueError, KeyError) as error:
        print('FAIL: ' + str(error), file=sys.stderr)
        sys.exit(1)
