"""Assemble the developer kit from the published Demo and two pinned source archives."""
import argparse
import hashlib
import json
import shutil
import tempfile
from pathlib import Path, PurePosixPath
from urllib.request import urlopen
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

HERE = Path(__file__).resolve().parent
COMMIT = "0909faed1ca96d930dff9804fe3260013c28b5ac"
EXAMPLES = "aea5ede332670e483870af98efb362d50e3f3252"
PROJECT = "https://codeload.github.com/NotDesign/allinpay-merchant-demo/zip/"
SITE = "https://notdesign.github.io/allinpay-merchant-demo"
NAME = "MeePay-Developer-Handoff-v1.13-20261120"
LIVE_HASH = "90beac57809cac1a33a4f6374302d9c56f12e6709b1dc2cf4658e90a6cdb3028"

def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def unpack(archive, target, commit=None):
    with ZipFile(archive) as zipped:
        if commit and zipped.comment.decode() != commit:
            raise ValueError(f"Commit mismatch for {archive}")
        seen = set()
        for entry in zipped.infolist():
            if entry.is_dir():
                continue
            path = PurePosixPath(entry.filename)
            if path.is_absolute() or ".." in path.parts or path in seen or "\\" in entry.filename:
                raise ValueError(entry.filename)
            seen.add(path)
            if commit:
                if path.parts[0] != f"allinpay-merchant-demo-{commit}":
                    raise ValueError(path)
                path = PurePosixPath(*path.parts[1:])
            item = target / path
            item.parent.mkdir(parents=True, exist_ok=True)
            with zipped.open(entry) as source, item.open("wb") as dest:
                shutil.copyfileobj(source, dest)

def assemble(cache, work, output):
    files = {"source":PROJECT+COMMIT, "examples":PROJECT+EXAMPLES,
             "live":SITE+"/downloads/allinpay-merchant-demo-20261120-v113.zip"}
    for name, url in files.items():
        local = cache / (name+".zip")
        if not local.exists():
            with urlopen(url, timeout=90) as source, local.open("wb") as target:
                shutil.copyfileobj(source, target)
    if sha256(cache / "live.zip") != LIVE_HASH:
        raise ValueError("Published Demo checksum has changed")
    kit = work / NAME
    src, demo = kit / "source", kit / "demo"
    unpack(cache / "source.zip", src, COMMIT)
    unpack(cache / "examples.zip", kit / "examples/two-merchants-v1.12", EXAMPLES)
    unpack(cache / "live.zip", demo)
    if json.loads((demo/"version.json").read_text())["commit"] != COMMIT:
        raise ValueError("Demo version mismatch")
    receipt = json.loads((HERE/"evidence/source-receipt.json").read_text())
    original = {p.relative_to(src).as_posix():p for p in src.rglob("*") if p.is_file()}
    if original.keys() != receipt["sourceFiles"].keys():
        raise ValueError("Source inventory mismatch")
    for name, path in original.items():
        data = path.read_bytes()
        if hashlib.sha1(f"blob {len(data)}\0".encode()+data).hexdigest() != receipt["sourceFiles"][name]:
            raise ValueError("Source mismatch: "+name)
    for name in ("app.js","backoffice.html","external.html","ui-components.css","ui-components.js"):
        if sha256(src/name) != sha256(demo/name):
            raise ValueError("Source/Demo mismatch: "+name)
    for name in ("start-demo.py","START_HERE.md"):
        shutil.copyfile(HERE/name,kit/name)
    assets = kit/"assets"
    assets.mkdir()
    for name in ("mee-pay-logo.png","mee-pay-logo-white.png","mee-pay-favicon.png"):
        shutil.copyfile(src/name,assets/name)
    shutil.copyfile(HERE/"mee-pay-notification-icon.svg",assets/"mee-pay-notification-icon.svg")
    shutil.copytree(HERE/"evidence",kit/"verification")
    paths = sorted(p for p in kit.rglob("*") if p.is_file())
    checks = "".join(f"{sha256(p)}  {p.relative_to(kit).as_posix()}\n" for p in paths)
    (kit/"SHA256SUMS.txt").write_text(checks,encoding="utf-8",newline="\n")
    output.mkdir(parents=True, exist_ok=True)
    archive = output/(NAME+".zip")
    with ZipFile(archive,"w",ZIP_DEFLATED) as zipped:
        for path in sorted(paths+[kit/"SHA256SUMS.txt"]):
            entry = ZipInfo(path.relative_to(work).as_posix(),(2026,11,20,12,0,0))
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            zipped.writestr(entry,path.read_bytes(),compress_type=ZIP_DEFLATED,compresslevel=6)
    with ZipFile(archive) as zipped:
        if zipped.testzip() or len(zipped.namelist()) != len(paths)+1:
            raise ValueError("ZIP integrity failure")
    (output/(archive.name+".sha256")).write_text(f"{sha256(archive)}  {archive.name}\n",encoding="ascii")
    print(f"{archive.name}: {len(paths)+1} files, {archive.stat().st_size:,} bytes; manifest SHA-256 {hashlib.sha256(checks.encode()).hexdigest()}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache",type=Path)
    parser.add_argument("--output",type=Path,required=True)
    options=parser.parse_args()
    with tempfile.TemporaryDirectory() as tmp:
        work=Path(tmp)
        cache=options.cache or work
        cache.mkdir(parents=True,exist_ok=True)
        assemble(cache,work,options.output)
