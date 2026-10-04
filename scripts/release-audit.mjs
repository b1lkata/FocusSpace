import fs from 'node:fs';
import path from 'node:path';
export function filesIn(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?filesIn(path.join(directory,entry.name)):[path.join(directory,entry.name)]);}
export function auditRelease(directory){
 const failures=[];const files=filesIn(directory);
 for(const file of files){const name=path.relative(directory,file).replaceAll('\\','/');
  if(/(^|\/)(\.git|node_modules|\.runtime|\.local|AGENTS\.md)(\/|$)|\.(sqlite(-\w+)?|db|enc|jks|keystore|log)$|(^|\/)\.env(?!\.example$)/i.test(name))failures.push(`Private file: ${name}`);
  if(/\.jpe?g$/i.test(name))failures.push(`Unreviewed photograph: ${name}`);
  if(/\.(mp3|png|ico|ttf|woff2?|jar)$/i.test(name))continue;
  const text=fs.readFileSync(file,'utf8');
  if(/sk-(?:proj-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{20,}|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|AIza[\w-]{35}/.test(text))failures.push(`Possible credential: ${name}`);
  if(/C:\\Users\\[^\\]+\\/i.test(text))failures.push(`Personal filesystem path: ${name}`);
 }
 if(!fs.existsSync(path.join(directory,'LICENSE.txt')))failures.push('Missing demo license');
 if(failures.length)throw new Error(failures.join('\n'));
 return {files:files.length,credentialScan:'passed',privateFileScan:'passed',assetScan:'passed'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename)){console.log(JSON.stringify(auditRelease(process.argv[2]??'release/demo/first-stage/source'),null,2));}
