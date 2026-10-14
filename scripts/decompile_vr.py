#!/usr/bin/env python3
"""Recover VR APK without changing the original archive or other recoveries."""
import hashlib,json,subprocess,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
 archive=ROOT/'Puppet_War_VR_2.0.1_Android_4.4.apk';target=ROOT/'recovered/vr-2.0.1';extracted=target/'apk'
 with zipfile.ZipFile(archive) as z:
  for i in z.infolist():
   if not (extracted/i.filename).resolve().is_relative_to(extracted.resolve()):raise ValueError('Unsafe archive entry')
  z.extractall(extracted);count=len(z.infolist())
 managed=extracted/'assets/bin/Data/Managed';results=[]
 for dll in sorted(managed.glob('Assembly-*.dll')):
  output=target/'source'/dll.stem;output.mkdir(parents=True,exist_ok=True)
  r=subprocess.run([str(ROOT/'.tools/bin/ilspycmd'),'--disable-updatecheck','-p','-r',str(managed),'-o',str(output),str(dll)],capture_output=True,text=True)
  (output/'decompile.log').write_text(r.stdout+r.stderr);results.append({'assembly':dll.name,'exit_code':r.returncode,'csharp_files':len(list(output.rglob('*.cs')))});print(results[-1],flush=True)
 (target/'manifest.json').write_text(json.dumps({'archive':archive.name,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'archive_entries':count,'assemblies':results},indent=2))
 if any(r['exit_code'] for r in results):raise SystemExit('Decompilation failures; see logs')
if __name__=='__main__':main()
