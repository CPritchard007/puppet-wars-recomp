import {readFile,writeFile} from 'node:fs/promises';

// Run after Vite so the published HTML and copied thumbnail are checked together.
const output=new URL('../dist/',import.meta.url);
const imagePath='social/puppet-war-preview.png';
const image=await readFile(new URL(imagePath,output));
if(image.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error(`Sharing thumbnail is not a PNG: ${imagePath}`);
const width=image.readUInt32BE(16),height=image.readUInt32BE(20);
if(!width||!height)throw new Error('Sharing thumbnail has invalid dimensions');
const repository=process.env.GITHUB_REPOSITORY||'CPritchard007/puppet_wars_recomp';
const [owner,name]=repository.split('/');
const defaultUrl=`https://${owner.toLowerCase()}.github.io/${name.toLowerCase()===`${owner.toLowerCase()}.github.io`?'':`${name}/`}`;
const site=new URL(process.env.SITE_URL||defaultUrl);
if(!['https:','http:'].includes(site.protocol))throw new Error('SITE_URL must be an absolute HTTP(S) URL');
site.search='';site.hash='';if(!site.pathname.endsWith('/'))site.pathname+='/';
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
let html=await readFile(new URL('index.html',output),'utf8');
function replace(pattern,value,label){
 if(!pattern.test(html))throw new Error(`Missing metadata tag: ${label}`);
 html=html.replace(pattern,(_,before,after)=>before+escape(value)+after);
}
replace(/(<link rel="canonical" href=")[^"]*(")/,site.href,'canonical');
for(const [key,value] of Object.entries({'og:url':site.href,'og:image':new URL(imagePath,site).href,'og:image:width':width,'og:image:height':height,'twitter:image':new URL(imagePath,site).href})){
 replace(new RegExp(`(<meta (?:property|name)="${key}" content=")[^"]*(")`),value,key);
}
await writeFile(new URL('index.html',output),html);
console.log(`Sharing thumbnail included: ${width}×${height} — ${new URL(imagePath,site).href}`);
