import { spawn } from 'node:child_process';
import executable from 'electron';
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(executable, ['.'], { stdio: 'inherit', env, windowsHide: true });
child.on('exit', code => process.exit(code ?? 1));
child.on('error', error => { console.error(error.message); process.exit(1); });
