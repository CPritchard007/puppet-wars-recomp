#!/usr/bin/env python3
"""Extract the iOS 2.0 archive and independently decompile its managed code."""
import hashlib,json,plistlib,subprocess,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
 archive=ROOT/'Puppet War 2.0.ipa';target=ROOT/'recovered/ios-2.0';extracted=target/'ipa'
 with zipfile.ZipFile(archive) as z:
  for entry in z.infolist():
   if not (extracted/entry.filename).resolve().is_relative_to(extracted.resolve()):raise ValueError('Unsafe archive path')
  z.extractall(extracted);count=len(z.infolist())
 app=next((extracted/'Payload').glob('*.app'));info=plistlib.loads((app/'Info.plist').read_bytes());managed=app/'Data/Managed';results=[]
 for dll in sorted(managed.glob('Assembly-*.dll')):
  output=target/'source'/dll.stem;output.mkdir(parents=True,exist_ok=True)
  result=subprocess.run([str(ROOT/'.tools/bin/ilspycmd'),'--disable-updatecheck','-p','-r',str(managed),'-o',str(output),str(dll)],capture_output=True,text=True)
  (output/'decompile.log').write_text(result.stdout+result.stderr)
  results.append({'assembly':dll.name,'exit_code':result.returncode,'csharp_files':len(list(output.rglob('*.cs')))})
  print(results[-1],flush=True)
 report={'archive':archive.name,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'version':info.get('CFBundleShortVersionString'),'build':info.get('CFBundleVersion'),'archive_entries':count,'assemblies':results,'web_integration':False}
 (target/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
 if any(r['exit_code'] for r in results):raise SystemExit('Some assemblies failed; inspect decompile.log')
if __name__=='__main__':main()
