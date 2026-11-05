// Downloads the newest Stockfish.js (npm "stockfish") + chess.js and copies them into the extension.
import {execSync} from 'child_process';import fs from 'fs';import path from 'path';
execSync('npm install --no-save --no-package-lock stockfish@latest chess.js@latest',{stdio:'inherit'});
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name]);
const js=walk('node_modules/stockfish').find(f=>/lite-single[^/]*\.js$/.test(f)); // change to /-single\.js$/ for the ~94MB full-strength engine
if(!js)throw Error('lite-single engine not found in node_modules/stockfish');
const wasm=js.replace(/\.js$/,'.wasm');
fs.mkdirSync('engine',{recursive:true});fs.mkdirSync('lib',{recursive:true});
fs.copyFileSync(js,'engine/'+path.basename(js));fs.copyFileSync(wasm,'engine/'+path.basename(wasm));
fs.writeFileSync('engine/name.txt',path.basename(js));
fs.copyFileSync('node_modules/chess.js/dist/esm/chess.js','lib/chess.js');
console.log('\nDone: '+path.basename(js)+'. Now load this folder at chrome://extensions (Developer mode > Load unpacked).');
