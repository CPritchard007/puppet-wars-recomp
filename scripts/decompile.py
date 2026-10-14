#!/usr/bin/env python3
"""Extract both original APKs and decompile their game assemblies with ILSpy."""
import hashlib
import json
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ILSPY = ROOT / '.tools/bin/ilspycmd'


def main():
    if not ILSPY.exists():
        raise SystemExit('Install ilspycmd 8.2.0.7535 into .tools/bin first (see README.md).')
    reports = []
    for episode in (1, 2):
        matches = list(ROOT.glob(f'Puppet War FPS ep {episode}_*.apk'))
        if len(matches) != 1:
            raise SystemExit(f'Expected exactly one APK for episode {episode}, found {len(matches)}')
        apk = matches[0]
        target = ROOT / 'recovered' / f'episode-{episode}'
        extracted = target / 'apk'
        with zipfile.ZipFile(apk) as archive:
            for entry in archive.infolist():
                if not (extracted / entry.filename).resolve().is_relative_to(extracted.resolve()):
                    raise ValueError(f'Unsafe archive entry: {entry.filename}')
            archive.extractall(extracted)
            file_count = len(archive.infolist())
        managed = extracted / 'assets/bin/Data/Managed'
        assemblies = []
        for dll in sorted(managed.glob('Assembly-*.dll')):
            output = target / 'source' / dll.stem
            output.mkdir(parents=True, exist_ok=True)
            result = subprocess.run([
                str(ILSPY), '--disable-updatecheck', '-p', '-r', str(managed),
                '-o', str(output), str(dll)
            ], capture_output=True, text=True)
            (output / 'decompile.log').write_text(result.stdout + result.stderr)
            if result.returncode:
                raise SystemExit(f'Decompilation failed: {dll}; see {output}/decompile.log')
            assemblies.append(dll.name)
        report = {
            'episode': episode, 'apk': apk.name,
            'sha256': hashlib.sha256(apk.read_bytes()).hexdigest(),
            'archive_files': file_count, 'unity_version': '3.5.2f2',
            'decompiled_assemblies': assemblies,
            'csharp_files': len(list((target / 'source').rglob('*.cs'))),
            'web_build_verified': False,
        }
        reports.append(report)
        print(f'Episode {episode}: {report["csharp_files"]} C# files recovered', flush=True)
    (ROOT / 'recovered/manifest.json').write_text(json.dumps(reports, indent=2) + '\n')


if __name__ == '__main__':
    main()
