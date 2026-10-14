import {readFile,writeFile} from 'node:fs/promises';

// Run after Vite so the published HTML and copied thumbnail are checked together.
const output=new URL('../dist/',import.meta.url);
const imagePath='social/puppet-war-preview.jpg';
const image=await readFile(new URL(imagePath,output));
if(image.readUInt16BE(0)!==0xffd8)throw new Error(`Sharing thumbnail is not a JPEG: ${imagePath}`);
let width=0,height=0;
for(let offset=2;offset+4<image.length;){
 if(image[offset++]!==0xff)throw new Error('Invalid JPEG marker');
 while(image[offset]===0xff)offset++;
 const marker=image[offset++];
 if(marker===0xda||marker===0xd9)break;
 const length=image.readUInt16BE(offset);
 if(length<2||offset+length>image.length)throw new Error('Invalid JPEG segment');
 if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
  height=image.readUInt16BE(offset+3);width=image.readUInt16BE(offset+5);break;
 }
 offset+=length;
}
if(!width||!height)throw new Error('Sharing thumbnail has invalid dimensions');
const repository=process.env.GITHUB_REPOSITORY||'CPritchard007/puppet-wars-recomp';
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
for(const [key,value] of Object.entries({'og:url':site.href,'og:image':new URL(imagePath,site).href,'og:image:type':'image/jpeg','og:image:width':width,'og:image:height':height,'twitter:image':new URL(imagePath,site).href})){
 replace(new RegExp(`(<meta (?:property|name)="${key}" content=")[^"]*(")`),value,key);
}
await writeFile(new URL('index.html',output),html);
console.log(`Sharing thumbnail included: ${width}×${height} — ${new URL(imagePath,site).href}`);
