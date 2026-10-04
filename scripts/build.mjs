import { build } from 'esbuild';
import { copyFileSync } from 'node:fs';
await build({ entryPoints: ['src/main/main.ts'], outfile: 'dist/main/main.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['electron', 'node:sqlite'], sourcemap: true });
await build({ entryPoints: ['src/preload/preload.ts'], outfile: 'dist/main/preload.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['electron'] });
copyFileSync('build/icon.png', 'dist/main/icon.png');
