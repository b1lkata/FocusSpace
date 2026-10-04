import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {auditRelease,filesIn} from './release-audit.mjs';
const root=process.cwd(),out=path.resolve(root,'release/demo/first-stage'),source=path.join(out,'source');
if(!out.startsWith(root+path.sep))throw new Error('Release directory must stay inside the workspace');
if(!fs.existsSync('dist/demo/index.html'))throw new Error('Run npm run build:demo first');
fs.mkdirSync(out,{recursive:true});
if(!source.startsWith(out+path.sep))throw new Error('Invalid staging directory');
if(fs.existsSync(source))fs.rmSync(source,{recursive:true});fs.mkdirSync(source);
function copy(file){if(fs.lstatSync(file).isSymbolicLink())throw new Error('Symlinks are not allowed in the release');const target=path.join(source,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(file,target);}
for(const file of ['README.md','CHANGELOG.md','LICENSE.txt','THIRD_PARTY_NOTICES.md','SECURITY.md','CONTRIBUTING.md','package.json','package-lock.json','tsconfig.json','vite.config.ts','vitest.config.ts','eslint.config.mjs','index.html','.gitignore','build/icon.svg','build/icon.png','build/icon.ico','docs/demo.md','docs/privacy.md','scripts/demo-server.mjs','scripts/demo-release-smoke.mjs','scripts/prepare-demo.mjs','scripts/release-audit.mjs'])copy(file);
for(const directory of ['src','public-demo','tests'])for(const file of filesIn(directory)){
 if(['tests/artwork-identity.test.ts','tests/uploads-only.test.ts','src/renderer/music/collectionArtwork.json'].includes(file.replaceAll('\\','/')))continue;
 copy(file);
}
for(const file of ['public/artwork/fallback.svg','public/favicon.svg','public/licenses/Manrope-OFL.txt'])copy(file);
if(fs.existsSync('docs/release-notes.md'))copy('docs/release-notes.md');
if(fs.existsSync('docs/images'))for(const file of filesIn('docs/images'))copy(file);
// Development catalog snapshots are private; the public demo has its own samples.
fs.writeFileSync(path.join(source,'src/renderer/music/preloadedCollections.json'),JSON.stringify({version:1,savedAt:0,collections:[]}));
fs.writeFileSync(path.join(source,'src/renderer/music/verifiedArtwork.json'),JSON.stringify({artists:{},songs:{}}));
const testsFile=path.join(source,'tests/collection-cache.test.ts');fs.writeFileSync(testsFile,fs.readFileSync(testsFile,'utf8').replace("it('loads real checked bootstrap","it.skip('private catalog bootstrap"));
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));pkg.name='tuniko-demo';pkg.version='0.1.0-demo.1';pkg.scripts={typecheck:'tsc --noEmit',lint:'eslint src tests',test:'vitest run','build:demo':'tsc --noEmit && vite build --mode demo','preview:demo':'node scripts/demo-server.mjs',demo:'npm run build:demo && npm run preview:demo',web:'npm run demo',dev:'npm run demo',build:'npm run build:demo','test:demo':'node scripts/demo-release-smoke.mjs','demo:package':'node scripts/prepare-demo.mjs','demo:audit':'node scripts/release-audit.mjs'};delete pkg.main;delete pkg.build;
for(const name of ['electron-builder','@capacitor/cli'])delete pkg.devDependencies[name];
for(const name of ['@capacitor/android','@capacitor/ios'])delete pkg.dependencies[name];
fs.writeFileSync(path.join(source,'package.json'),JSON.stringify(pkg,null,2)+'\n');
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));lock.name=pkg.name;lock.version=pkg.version;lock.packages[''].name=pkg.name;lock.packages[''].version=pkg.version;fs.writeFileSync(path.join(source,'package-lock.json'),JSON.stringify(lock,null,2)+'\n');
const npmCli=process.env.npm_execpath??path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
if(!fs.existsSync(npmCli))throw new Error('Use npm run demo:package to prepare the source lockfile');
const locked=spawnSync(process.execPath,[npmCli,'install','--package-lock-only','--ignore-scripts','--offline','--cache',path.join(root,'.runtime/npm-cache')],{cwd:source,encoding:'utf8'});
if(locked.status!==0)throw new Error(locked.stderr||locked.stdout||'Source lockfile preparation failed');
const readme=path.join(source,'README.md');fs.writeFileSync(readme,fs.readFileSync(readme,'utf8').replace(/The development music app remains available separately[^\n]+/,'').replace('rather than copying your entire development folder','without including browser data or credentials'));
const audit=auditRelease(source);auditRelease('dist/demo');
const zipCode="import sys,zipfile,pathlib; root=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]); z=zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED); [z.write(p,p.relative_to(root).as_posix()) for p in root.rglob('*') if p.is_file()]; z.close(); z=zipfile.ZipFile(out); assert z.testzip() is None; z.close()";
for(const [directory,name] of [[source,'Tuniko-demo-source.zip'],[path.join(root,'dist/demo'),'Tuniko-demo-web.zip']]){
 let result;for(const python of ['python','python3']){result=spawnSync(python,['-c',zipCode,directory,path.join(out,name)],{encoding:'utf8'});if(!result.error)break;}if(result?.status!==0)throw new Error(result?.stderr??'Python3 is needed to prepare ZIP archives');
}
const hashes=Object.fromEntries(['Tuniko-demo-source.zip','Tuniko-demo-web.zip'].map(name=>{const file=fs.readFileSync(path.join(out,name));return [name,{bytes:file.length,sha256:createHash('sha256').update(file).digest('hex')}];}));
fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({preparedAt:new Date().toISOString(),audit,hashes},null,2));console.log(JSON.stringify({directory:out,audit,hashes},null,2));
