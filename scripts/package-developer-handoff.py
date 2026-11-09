#!/usr/bin/env python3
"""Package pinned GitHub source and the verified hosted Demo without private files."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import tempfile
import zipfile

VERSION = '2026.11.09-hong-kong-bank-default-v1.12'
APP_COMMIT = '3c6eb82f933b0e7885bf2a0ab71a17ddb081f4f0'
PACKAGE = 'MeePay-Developer-Handoff-20261109-v1.12'


def extract(archive_path, destination, prefix=''):
    with zipfile.ZipFile(archive_path) as archive:
        if archive.testzip() is not None:
            raise ValueError('Corrupt archive: ' + str(archive_path))
        seen = set()
        for entry in archive.infolist():
            if entry.is_dir():
                continue
            if prefix and not entry.filename.startswith(prefix):
                raise ValueError('Unexpected source prefix')
            name = entry.filename[len(prefix):]
            relative = PurePosixPath(name)
            forbidden = {'.git', '.env', '.DS_Store', '__MACOSX', 'node_modules', 'assets', 'downloads'}
            if '\\' in name or ':' in name or relative.as_posix() != name or relative.is_absolute() or '..' in relative.parts or any(p.casefold() in forbidden or p.casefold().startswith('.env.') for p in relative.parts):
                raise ValueError('Unexpected archive path: ' + str(relative))
            if relative.as_posix() in seen or (entry.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError('Duplicate path or symlink: ' + str(relative))
            seen.add(relative.as_posix())
            target = destination / relative
            if not target.resolve().is_relative_to(destination.resolve()):
                raise ValueError('Archive path escapes destination: ' + name)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(entry))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['source-zip', 'demo-zip', 'source-commit', 'output-dir']:
        parser.add_argument('--' + name, required=True)
    parser.add_argument('--verification-dir', help='Optional directory containing pinned release verification receipts')
    args = parser.parse_args()
    if not re.fullmatch(r'[0-9a-f]{40}', args.source_commit):
        raise ValueError('source-commit must be a full Git commit SHA')
    output = Path(args.output_dir).resolve()
    output.mkdir(parents=True, exist_ok=True)
    result = output / (PACKAGE + '.zip')
    if result.exists():
        raise ValueError('Refusing to overwrite existing package: ' + str(result))
    with tempfile.TemporaryDirectory(prefix='meepay-handoff-build-') as temp:
        root = Path(temp) / PACKAGE
        root.mkdir()
        with zipfile.ZipFile(args.source_zip) as source_zip:
            prefix = source_zip.namelist()[0]
            if not prefix.endswith('/'):
                raise ValueError('Expected a GitHub source archive')
        extract(args.source_zip, root / 'source', prefix)
        extract(args.demo_zip, root / 'demo')
        required_shared = ['app.js', 'backoffice.html', 'external.html', 'index.html', 'data.js', 'onboarding-v2.css', 'merchant-templates.css', 'demo-releases.json', 'mee-pay-favicon.png', 'br-engine/engine.mjs', 'br-engine/parser.mjs']
        for name in required_shared:
            if not (root / 'source' / name).is_file() or not (root / 'demo' / name).is_file():
                raise ValueError('Missing required shared file: ' + name)
        for name in ['package.json', 'package-lock.json', 'core.js', 'external.template.html', 'external.js', 'build-admin.cjs', 'build-external.cjs', 'DEVELOPMENT.md', 'scripts/package-developer-handoff.py', 'scripts/verify-developer-package.py']:
            if not (root / 'source' / name).is_file():
                raise ValueError('Missing required source file: ' + name)
        version = json.loads((root / 'demo/version.json').read_text())
        if version['version'] != VERSION or version['commit'] != APP_COMMIT:
            raise ValueError('Demo version/commit is not the pinned application release')
        shared = []
        for path in (root / 'demo').rglob('*'):
            if not path.is_file():
                continue
            relative = path.relative_to(root / 'demo')
            source = root / 'source' / relative
            if source.is_file() and relative.as_posix() not in {'README.md'}:
                if source.read_bytes() != path.read_bytes():
                    raise ValueError('Source/Demo mismatch: ' + str(relative))
                shared.append(relative.as_posix())
        guide = root / 'source/DEVELOPMENT.md'
        if not guide.is_file():
            raise ValueError('Source archive has no developer handoff guide')
        (root / 'verify-package.py').write_bytes((root / 'source/scripts/verify-developer-package.py').read_bytes())
        (root / 'START_HERE.md').write_text(
            '# Mee Pay 開發交付包 — v1.12 / 2026-11-09\n\n'
            '先執行 `python3 verify-package.py`，再閱讀 [完整開發指南](source/DEVELOPMENT.md)。\n\n'
            '- `source/`：GitHub 原始碼、測試及建置工具。\n'
            '- `demo/`：可執行 Demo，含 OCR／PDF／Excel 本機資源。\n'
            '- `release/`：線上發布的版本資料及來源說明。\n'
            '- `package-manifest.json`、`SHA256SUMS.txt`：逐檔版本與校驗紀錄。\n\n'
            '快速啟動：`node demo/scripts/serve.mjs`，再開啟 '
            '<http://127.0.0.1:4321/backoffice.html#/login> 或 '
            '<http://127.0.0.1:4321/external.html#/login>。\n\n'
            '修改程式請進入 `source/`。Demo 使用本機模擬業務資料，正式服務接入位置與界線見開發指南。\n', encoding='utf-8')
        release = root / 'release'
        release.mkdir()
        (release / 'version.json').write_bytes((root / 'demo/version.json').read_bytes())
        evidence = []
        if args.verification_dir:
            for name in ['ci-verification.json', 'live-release-receipt.json', 'live-browser-receipt.json']:
                receipt = Path(args.verification_dir) / name
                data = receipt.read_bytes()
                record = json.loads(data)
                if record.get('commit', APP_COMMIT) != APP_COMMIT:
                    raise ValueError('Verification receipt is for another application commit: ' + name)
                (release / name).write_bytes(data)
                evidence.append(name)
        provenance = {
            'applicationCommit': APP_COMMIT, 'applicationVersion': VERSION,
            'sourceCommit': args.source_commit,
            'sourceCommitSuppliedByCaller': True,
            'sourceArchiveExpectedUrl': 'https://codeload.github.com/NotDesign/allinpay-merchant-demo/zip/' + args.source_commit,
            'github': 'https://github.com/NotDesign/allinpay-merchant-demo/tree/' + args.source_commit,
            'sourceArchiveSha256': hashlib.sha256(Path(args.source_zip).read_bytes()).hexdigest(),
            'demoArchiveSha256': hashlib.sha256(Path(args.demo_zip).read_bytes()).hexdigest(),
            'sourceDemoIdenticalFiles': shared,
            'verificationReceipts': evidence,
            'applicationCI': 'https://github.com/NotDesign/allinpay-merchant-demo/actions/runs/42557832880',
            'scope': 'Frontend Demo and source handoff; not production API or security acceptance',
        }
        (release / 'provenance.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        files = []
        for path in sorted(p for p in root.rglob('*') if p.is_file()):
            data = path.read_bytes()
            files.append({'path': path.relative_to(root).as_posix(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
        manifest = {**provenance, 'files': files}
        (root / 'package-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        checksums = [(f['sha256'], f['path']) for f in files]
        checksums.append((hashlib.sha256((root / 'package-manifest.json').read_bytes()).hexdigest(), 'package-manifest.json'))
        (root / 'SHA256SUMS.txt').write_text(''.join(h + '  ' + n + '\n' for h, n in checksums), encoding='utf-8')
        with zipfile.ZipFile(result, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for path in sorted(p for p in root.rglob('*') if p.is_file()):
                archive.write(path, PACKAGE + '/' + path.relative_to(root).as_posix())
        with zipfile.ZipFile(result) as archive:
            if archive.testzip() is not None:
                raise ValueError('Produced archive failed CRC verification')
        print(json.dumps({'path': str(result), 'bytes': result.stat().st_size, 'sha256': hashlib.sha256(result.read_bytes()).hexdigest(), 'files': len(files) + 2}, indent=2))


if __name__ == '__main__':
    main()
