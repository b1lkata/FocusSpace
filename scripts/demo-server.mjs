import { preview } from 'vite';
const port=Number(process.env.TUNIKO_DEMO_PORT??4174);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid demo preview port');
const server=await preview({mode:'demo',preview:{host:'127.0.0.1',port,strictPort:true}});
server.printUrls();
console.log('Tuniko demo - original sample music, local browser storage.');
