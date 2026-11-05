import {Chess} from './lib/chess.js';
const $=s=>document.querySelector(s),G={k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
const GL={brilliant:['!!','#1baca6'],great:['!','#5c8bb0'],best:['★','#81b64c'],excellent:['+','#96bc4b'],good:['✓','#97af8b'],book:['B','#a88865'],inaccuracy:['?!','#f7c631'],miss:['x','#ff7769'],mistake:['?','#ffa459'],blunder:['??','#fa412d']};
const wp=cp=>50+50*(2/(1+Math.exp(-.00368208*cp))-1),V={p:1,n:3,b:3,r:5,q:9};
const mat=(f,c)=>{let s=0;for(const x of f.split(' ')[0]){const l=x.toLowerCase();if(V[l])s+=(x==l?-1:1)*V[l]}return c=='w'?s:-s};
let S={fens:[],mv:[],ev:[],cls:[],cur:0,flip:false,names:['White','Black']},E,run=0;let T='review',lastK='';
const status=t=>$('#st').textContent=t;

class Eng{
 async init(){const n=(await(await fetch('engine/name.txt')).text()).trim();this.w=new Worker('engine/'+n);this.w.onmessage=e=>this.cb&&this.cb(String(e.data));
  await this.cmd('uci','uciok');this.w.postMessage('setoption name MultiPV value 2');await this.cmd('isready','readyok')}
 cmd(c,t){return new Promise(r=>{this.cb=l=>{if(l.startsWith(t)){this.cb=null;r()}};this.w.postMessage(c)})}
 run(fen,d){return this.p=new Promise(r=>{const L=[];this.cb=l=>{const m=l.match(/ depth (\d+).* multipv (\d+) score (cp|mate) (-?\d+).* pv (.+)/);
  if(m){const v=+m[4];L[m[2]-1]={cp:m[3]=='cp'?v:Math.sign(v)*(10000-Math.abs(v)),uci:m[5].split(' ')[0],pv:m[5]}}
  else if(l.startsWith('bestmove')){this.cb=null;r(L.filter(Boolean))}};
  this.w.postMessage('position fen '+fen);this.w.postMessage('go depth '+d)})}
}
async function evalPos(fen,d){const c=new Chess(fen),w=c.turn()=='w';
 if(c.isCheckmate())return{cp:w?-10000:10000,lines:[]};
 if(c.isGameOver())return{cp:0,lines:[]};
 const L=(await E.run(fen,d)).map(l=>({cp:w?l.cp:-l.cp,uci:l.uci,pv:l.pv}));return{cp:L[0]?L[0].cp:0,best:L[0]&&L[0].uci,lines:L}}

async function start(vm,names,res,meta){if(PZ.on)pzExit();
 if(!vm.length)return status('No moves found');
 const id=++run;
 try{if(!E){E=new Eng();await E.init()}else{E.w.postMessage('stop');await E.p}}catch(e){return status('Engine failed to load — did you run setup.mjs? '+e.message)}
 S={fens:[vm[0].before,...vm.map(m=>m.after)],mv:vm,ev:[],cls:[],cur:0,flip:S.flip,names,result:res||derive(vm),meta:meta||{}};render();
 const d=+$('#depth').value,N=S.fens.length;
 for(let i=0;i<N;i++){if(id!=run)return;status(`Analyzing ${i+1}/${N}…`);const e=await evalPos(S.fens[i],d);if(id!=run)return;S.ev[i]=e;graph();if(i==0)render()}
 classify();status('Done · Stockfish 19 · depth '+d);render();graph()}

function classify(){
 const{fens,mv,ev}=S,loss=[],w=[];
 mv.forEach((m,i)=>{const s=m.color=='w'?1:-1,wb=wp(s*ev[i].cp),wa=wp(s*ev[i+1].cp);loss[i]=Math.max(0,wb-wa);w[i]=[wb,wa,s]});
 const cand=mv.map((m,i)=>{const[wb,wa]=w[i],l=loss[i],prev=mv[i-1];
  if(i<8||l>1||!((m.from+m.to+(m.promotion||''))==ev[i].best||l<=.5)||wa<50||wb>80)return 0;
  if(prev&&/[ce]/.test(prev.flags)&&prev.to==m.to)return 0;
  const sac=sacAmt(i,m);return sac>=3?sac:0}),BR=new Set();
 for(const c of['w','b'])cand.map((v,i)=>[v,i]).filter(x=>x[0]&&mv[x[1]].color==c).sort((a,b)=>b[0]-a[0]).slice(0,2).forEach(x=>BR.add(x[1]));
 S.cls=mv.map((m,i)=>{const[wb,wa,s]=w[i],l=loss[i],uci=m.from+m.to+(m.promotion||''),best=uci==ev[i].best,L=ev[i].lines,nb=ev[i+1].best;
  if(BR.has(i))return'brilliant';
  if(best&&L[1]&&wp(s*L[0].cp)-wp(s*L[1].cp)>=12&&wb<85)return'great';
  if(i<8&&l<=2)return'book';
  if(best||l<.3)return'best';
  if(l<=2)return'excellent';if(l<=5)return'good';
  if(l<=10)return'inaccuracy';
  if(i>0&&loss[i-1]>=10&&wb>=60&&l<=20)return'miss';
  return l<=20?'mistake':'blunder'});
 const W=ev.map(e=>wp(e.cp)),n=W.length,ws=Math.max(2,Math.min(8,Math.floor(n/10))),win=[];
 for(let i=0;i<ws-2;i++)win.push(W.slice(0,ws));for(let i=0;i+ws<=n;i++)win.push(W.slice(i,i+ws));
 const sd=a=>{const u=a.reduce((x,y)=>x+y)/a.length;return Math.sqrt(a.reduce((x,y)=>x+(y-u)**2,0)/a.length)};
 const wt=mv.map((m,i)=>Math.max(.5,Math.min(12,sd(win[i]||[50,50])))),ac=loss.map(l=>Math.max(0,Math.min(100,103.1668*Math.exp(-.04354*l)-3.1669)));
 S.acc=['w','b'].map(c=>{const ix=mv.map((m,i)=>i).filter(i=>mv[i].color==c);if(!ix.length)return 0;
  const sw=ix.reduce((s,i)=>s+wt[i],0),wm=ix.reduce((s,i)=>s+ac[i]*wt[i],0)/sw,hm=ix.length/ix.reduce((s,i)=>s+1/Math.max(ac[i],.5),0);return(wm+hm)/2})}
function sacAmt(i,m){const pv=(S.ev[i+1].lines[0]||{}).pv;if(!pv)return 0;const t=new Chess(S.fens[i+1]);let end=mat(S.fens[i+1],m.color),k=0;
 try{for(const x of pv.split(' ').slice(0,6)){t.move({from:x.slice(0,2),to:x.slice(2,4),promotion:x[4]});if(++k%2==0)end=mat(t.fen(),m.color)}}catch{}
 return mat(S.fens[i],m.color)-end}

var FIG={p:['♟','♙'],n:['♞','♘'],b:['♝','♗'],r:['♜','♖'],q:['♛','♕'],k:['♚','♔']},
 TH='<svg viewBox="0 0 24 24" width="62%" height="62%" fill="#fff"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>',
 STR='<svg viewBox="0 0 24 24" width="66%" height="66%" fill="#fff"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>',
 BI={best:STR,excellent:TH,brilliant:'!!',great:'!',good:'✓',book:'B',inaccuracy:'?!',miss:'✕',mistake:'?',blunder:'??'},
 VAL2={p:1,n:3,b:3,r:5,q:9},INIT={p:8,n:2,b:2,r:2,q:1},
 CLK='<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const bdg=(k,c)=>`<span class="bd ${c||''}" style="background:${GL[k][1]}">${BI[k]}</span>`;
const fc=s=>{if(s==null||s==='')return'';const p=String(s).split(':').map(parseFloat),t=p.length==3?p[0]*3600+p[1]*60+p[2]:p.length==2?p[0]*60+p[1]:p[0],m=Math.floor(t/60),ss=Math.floor(t%60);
 return t<20?`${m}:${String(ss).padStart(2,'0')}.${Math.floor((t%1)*10)}`:`${m}:${String(ss).padStart(2,'0')}`};
const clkAt=(col,c)=>{const M=S.meta||{},par=col=='w'?0:1;let i=c-1;while(i>=0&&i%2!=par)i--;return i>=0&&M.clk&&M.clk[i]?fc(M.clk[i]):M.init?fc(M.init):''};
const clean=x=>String(x==null?'':x).replace(/[<>&]/g,'');
function barHtml(i,fen,c,cnt){const side='wb'[i],o=i?'w':'b',mat=k=>Object.keys(VAL2).reduce((s,l)=>s+VAL2[l]*(cnt[k][l]||0),0),
 cap=['q','r','b','n','p'].map(l=>FIG[l][0].repeat(Math.max(0,INIT[l]-(cnt[o][l]||0)))).join(''),d=mat(side)-mat(o),act=fen.split(' ')[1]==side,rt=(S.meta&&S.meta.ratings&&S.meta.ratings[i])||'';
 return`<span class="av ${i?'k':''}">♟</span><span class=nm>${clean(S.names[i])}</span>${rt?`<span class=rt>(${clean(rt)})</span>`:''}<span class=cap><span class=c${o}>${cap}</span>${d>0?`<i>+${d}</i>`:''}</span><span class="ck ${side}${act?'':' off'}">${act?CLK:''}${clkAt(side,c)}</span>`}
function sumText(){const r=S.result,un=(me||localStorage.u||'').toLowerCase(),mi=[0,1].find(i=>(S.names[i]||'').toLowerCase()==un),a=S.acc;if(!a)return'';
 const v=r&&r.w!=null?(mi==null?`${S.names[r.w=='w'?0:1]} won`:'wb'[mi]==r.w?'You won':'You lost')+(r.how?' by '+r.how:'')+'.':r?'The game ended in a draw.':'';
 const i=mi==null?0:mi;return`${v} ${mi==null?S.names[0]:'Your'} accuracy was ${a[i].toFixed(1)}% against ${a[1-i].toFixed(1)}%.`}
function sumHtml(){if(!S.acc)return'';const n=(k,col)=>S.mv.filter((x,i)=>x.color==col&&S.cls[i]==k).length;
 const rows=Object.keys(GL).map(k=>[k,n(k,'w'),n(k,'b')]).filter(r=>r[1]+r[2]||['great','best','excellent','mistake','miss','blunder'].includes(r[0])),mi=[0,1].find(i=>(S.names[i]||'').toLowerCase()==(me||localStorage.u||'').toLowerCase());
 return`<div class=prow><i></i><div class="pc two"><b>${clean(S.names[0])}</b><b>${clean(S.names[1])}</b></div></div><div class=prow><i>Players</i><div class="pc two"><span class="avb ${mi==0?'me':''}">♟</span><span class="avb ${mi==1?'me':''}">♟</span></div></div>
 <div class=prow><i>Accuracy</i><div class="pc two"><span class="acc lt">${S.acc[0].toFixed(1)}</span><span class="acc dk">${S.acc[1].toFixed(1)}</span></div></div><hr>`+
 rows.map(r=>`<div class=prow><i>${r[0][0].toUpperCase()+r[0].slice(1)}</i><div class="pc three"><span style="color:${GL[r[0]][1]};font-size:20px">${r[1]}</span>${bdg(r[0])}<span style="color:${GL[r[0]][1]};font-size:20px">${r[2]}</span></div></div>`).join('')}
function render(anim){
 const c=S.cur,V=S.v,a0=S.ev[c-1]&&S.ev[c-1].best,pz=PZ.on;
 let fen=S.fens[c],m=S.mv[c-1],cl=S.cls[c-1],evA=S.ev[c];
 if(pz){fen=PZ.fen;m=PZ.last;cl=PZ.bad?'miss':undefined;evA=null}
 else if(V){fen=V.fens[V.pos];m=V.moves[V.pos-1];cl=V.cls[V.pos-1];evA=V.ev[V.pos]}
 else if(S.alt&&m&&a0){try{const t=new Chess(S.fens[c-1]);m=t.move({from:a0.slice(0,2),to:a0.slice(2,4),promotion:a0[4]});fen=t.fen();cl='best';evA=S.ev[c-1]}catch{S.alt=0}}
 const ch=new Chess(fen||undefined),pm={};ch.board().flat().forEach(p=>p&&(pm[p.square]=p));fen=ch.fen();
 const bd=$('#board');bd.style.setProperty('--hl',cl?GL[cl][1]+'99':'#f6f66980');
 let h='';for(let r=0;r<8;r++)for(let f=0;f<8;f++){const file=S.flip?7-f:f,rk=S.flip?r:7-r,s=String.fromCharCode(97+file)+(rk+1),p=pm[s],
   lab=(f==0?`<em style="top:3%;left:5%">${rk+1}</em>`:'')+(r==7?`<em style="bottom:2%;right:5%">${String.fromCharCode(97+file)}</em>`:'');
  h+=`<div data-s=${s} class="sq ${(file+rk)%2?'l':'d'}${m&&(s==m.from||s==m.to)?' hl':''}${(S.rd||[]).includes(s)?' rd':''}">${lab}${p?(IMG!==false?`<i data-sq=${s} class="pc-${p.color}${p.type}"></i>`:`<i data-sq=${s} class="${p.color}">${G[p.type]}</i>`):''}${m&&cl&&s==m.to?bdg(cl,'lg'):''}</div>`}
 const a=V?(V.ev[V.pos-1]||{}).best:a0,fb=V?V.fens[V.pos-1]:S.fens[c-1];let sv='',bs='';
 if(!pz&&m&&['inaccuracy','mistake','miss','blunder'].includes(cl)&&a){sv=arrowSvg(a.slice(0,2),a.slice(2,4),'#81b64c');try{bs=new Chess(fb).move({from:a.slice(0,2),to:a.slice(2,4),promotion:a[4]}).san}catch{}}
 bd.innerHTML=`<svg id=arrow viewBox="0 0 8 8">${(ENG=sv)+uSvg()}</svg>`+h;bd.classList.toggle('var',!!V);$('#wrap').classList.toggle('pz',pz);sel=null;tg=[];
 if(anim)animate(anim.alt?{m,f:true}:anim);
 const cnt={w:{},b:{}};for(const x of fen.split(' ')[0]){const l=x.toLowerCase();if(VAL2[l]){const k=x==l?'b':'w';cnt[k][l]=(cnt[k][l]||0)+1}}
 const top=S.flip?0:1,bot=1-top;
 if(pz){$('#ptop').innerHTML=barHtml(top,fen,c,cnt).replace(/<span class="ck.*$/,'');$('#pbot').innerHTML=barHtml(bot,fen,c,cnt).replace(/<span class="ck.*$/,`<span class="ck w" id=pzck>${pzFmt(PZ.limit-PZ.used/1000)}</span>`);return}
 $('#ptop').innerHTML=barHtml(top,fen,V?S.cur:c,cnt);$('#pbot').innerHTML=barHtml(bot,fen,V?S.cur:c,cnt);
 if(evA){const p=wp(evA.cp),lead=evA.cp>=0,atTop=lead===!!S.flip;$('#barw').style.cssText=`height:${p}%;${S.flip?'top:0':'bottom:0'}`;
  $('#ev').style.cssText=(atTop?'top:6px':'bottom:6px')+`;color:${lead?'#262421':'#fff'}`;$('#ev').textContent=Math.abs(evA.cp)>9000?'M'+(10000-Math.abs(evA.cp)):(Math.abs(evA.cp)/100).toFixed(1)}
 const sm=!V&&c==0;$('#p-review').classList.toggle('sm',sm);
 let ih='';
 if(S.alt&&!V&&m)ih=`${bdg('best')}<b>Best move: ${m.san}</b> <button class=mini data-alt=1>↩ Back</button>`;
 else if(m&&cl)ih=`${bdg(cl)}<b>${cl[0].toUpperCase()+cl.slice(1)}</b>${evA?`<span class="chip${evA.cp<0?' dk':''}">${fmt(evA.cp)}</span>`:''}`;
 else if(m)ih=`<b>${m.san}</b> <span class=f>Evaluating…</span>`;
 else ih=sm?'<b>Game summary</b>':V?'<b>Play a move to analyse it</b>':'';
 if(V)ih+=` <button class=mini data-bg=1>↩ Back to game</button>`;
 $('#info').innerHTML=ih+(bs?`<div class=f style="flex-basis:100%;font-size:14px">Best was <b>${bs}</b></div>`:'');
 let mh='';S.mv.forEach((x,i)=>{if(i%2==0)mh+=`<span class=n>${i/2+1}.</span>`;const k=S.cls[i],sh=k&&!['best','good','book'].includes(k),
  fg=x.piece!='p'&&!x.san.startsWith('O')?`<span class=fg>${FIG[x.piece][x.color=='w'?0:1]}</span>`:'';
  mh+=`<a data-i=${i+1} class="${S.cur==i+1&&!V?'on':''}"><span class=gut>${sh?bdg(k):''}</span>${fg}<span${sh?` style="color:${GL[k][1]}"`:''}>${x.san.replace(/^[KQRBN]/,'')}</span></a>`});
 $('#moves').innerHTML=mh;$('#sumv').innerHTML=sumHtml();
 const on=document.querySelector('#moves a.on');if(on)on.scrollIntoView({block:'nearest'});
 requestAnimationFrame(()=>{graph();explain()})}
function graph(){const cv=$('#graph');if(!cv)return;const d=devicePixelRatio||1,W=cv.width=cv.clientWidth*d,H=cv.height=cv.clientHeight*d,g=cv.getContext('2d');
 g.fillStyle='#403d39';g.fillRect(0,0,W,H);const n=S.ev.filter(Boolean).length;if(n<2)return;
 const N=Math.max(S.fens.length-1,1),X=i=>i/N*W,Y=i=>H*(1-wp(S.ev[i].cp)/100);
 g.beginPath();g.moveTo(0,H);for(let i=0;i<n;i++)g.lineTo(X(i),Y(i));g.lineTo(X(n-1),H);g.closePath();g.fillStyle='#fff';g.fill();
 g.strokeStyle='#8b8987';g.lineWidth=d;g.beginPath();g.moveTo(0,H/2);g.lineTo(W,H/2);g.stroke();
 S.cls.forEach((k,i)=>{if(!k||['best','good','book'].includes(k)||!S.ev[i+1])return;g.fillStyle=GL[k][1];g.beginPath();g.arc(X(i+1),Y(i+1),3.4*d,0,7);g.fill()});
 if(S.cur>0){const k=S.cls[S.cur-1];g.strokeStyle=k?GL[k][1]:'#f7c631';g.lineWidth=2*d;g.beginPath();g.moveTo(X(S.cur),0);g.lineTo(X(S.cur),H);g.stroke()}}
const go=i=>{if(PZ.on)return;if(S.v){if(vnav(i))return;S.v=null}$('#over').classList.remove('on');S.alt=0;S.ar=[];S.rd=[];lastK='';speechSynthesis.cancel();const o=S.cur;S.cur=Math.max(0,Math.min(S.mv.length,i));
 const d=Math.abs(S.cur-o),pm=d==1?S.mv[Math.max(o,S.cur)-1]:S.cur?S.mv[S.cur-1]:0;
 render(d==1?{m:pm,f:S.cur>o}:0);if(d&&pm)snd(kind(pm));if(S.cur>o&&S.cur==S.mv.length)finale()};
$('#moves').onclick=e=>e.target.closest('a')&&go(+e.target.closest('a').dataset.i);
$('#graph').onclick=e=>go(Math.round(e.offsetX/e.target.clientWidth*(S.fens.length-1)));
$('#flip').onclick=()=>{S.flip=!S.flip;render()};
onkeydown=e=>{if(/TEXTAREA|INPUT/.test(e.target.tagName))return;({ArrowLeft:()=>go(S.cur-1),ArrowRight:()=>go(S.cur+1),Home:()=>go(0),End:()=>go(1e4)})[e.key]?.()};
$('#go').onclick=()=>{try{const c=new Chess();c.loadPgn($('#pgn').value);const h=c.header(),vm=c.history({verbose:true});start(vm,[h.White||'White',h.Black||'Black'],derive(vm,h.Result),{ratings:[h.WhiteElo,h.BlackElo],init:parseInt(h.TimeControl)||0,clk:($('#pgn').value.match(/\[%clk [\d:.]+\]/g)||[]).map(x=>x.slice(6,-1))})}catch(e){status('Bad PGN: '+e.message)}};

function scrape(){ // runs inside the chess.com tab
 const P={knight:'N',bishop:'B',rook:'R',queen:'Q',king:'K'};
 return[...document.querySelectorAll('.node')].filter(n=>/white-move|black-move/.test(n.className)&&!n.closest('.variation,.variations-container')).map(n=>{
  const c=(n.querySelector('.node-highlight-content')||n).cloneNode(true);
  c.querySelectorAll('[data-figurine],.icon-font-chess').forEach(f=>f.replaceWith(f.dataset.figurine||P[(f.className.match(/knight|bishop|rook|queen|king/)||[])[0]]||''));
  const m=c.textContent.match(/(O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?)/);return m?m[1]:null}).filter(Boolean)}
async function grab(){try{
 const t=+new URLSearchParams(location.search).get('tab');if(!t)throw Error('open this from the extension icon on a chess.com game');
 const[{result}]=await chrome.scripting.executeScript({target:{tabId:t},func:scrape});let a=result;
 if(a.length>1&&a.length%2==0){const h=a.length/2;if(a.slice(0,h).join()==a.slice(h).join())a=a.slice(0,h)}
 if(!a.length)throw Error('no moves found — open a game page with the move list visible, or paste a PGN');
 const c=new Chess();for(const s of a)c.move(s);start(c.history({verbose:true}),['White','Black'])}catch(e){status('Error: '+e.message);tab('games')}}
$('#grab').onclick=grab;grab();

// ---- game list from the public chess.com API ----
let arch=[],ai=0,GM=[],me='';$('#user').value=localStorage.u||'';
async function games(first){try{
 if(first){me=$('#user').value.trim().toLowerCase();if(!me)return;localStorage.u=me;
  const r=await fetch(`https://api.chess.com/pub/player/${me}/games/archives`);if(!r.ok)throw Error('user not found');
  arch=(await r.json()).archives;ai=arch.length;GM=[];$('#games').innerHTML=''}
 for(let k=0;k<2&&ai>0;k++){const j=await(await fetch(arch[--ai])).json();let h='';
  for(const g of j.games.reverse()){if(!g.pgn)continue;const w=g.white.username.toLowerCase()==me,mine=w?g.white:g.black,opp=w?g.black:g.white;
   const R=mine.result=='win'?'W':['agreed','repetition','stalemate','insufficient','50move','timevsinsufficient'].includes(mine.result)?'D':'L';
   h+=`<div class=g data-i=${GM.push(g)-1}><i class=${R}>${R}</i><span>${new Date(g.end_time*1e3).toLocaleDateString()}</span><span>${w?'⚪':'⚫'} vs ${opp.username} (${opp.rating})</span><span>${g.time_class}</span></div>`}
  $('#games').insertAdjacentHTML('beforeend',h)}
 $('#more').hidden=ai<=0;status(GM.length+' games loaded')}catch(e){status('Games: '+e.message)}}
$('#load').onclick=()=>games(true);$('#more').onclick=()=>games(false);
$('#user').onkeydown=e=>{if(e.key=='Enter')games(true)};
$('#games').onclick=e=>{const r=e.target.closest('.g');if(!r)return;const g=GM[+r.dataset.i];
 try{const c=new Chess();c.loadPgn(g.pgn);S.flip=g.black.username.toLowerCase()==me;start(c.history({verbose:true}),[g.white.username,g.black.username],fromApi(g),{ratings:[g.white.rating,g.black.rating],init:parseInt(g.time_control)||0,clk:(g.pgn.match(/\[%clk [\d:.]+\]/g)||[]).map(x=>x.slice(6,-1)),url:g.url});tab('review')}catch(x){status('Cannot load this game: '+x.message)}};
if(localStorage.u)games(true);

// ---- animation, nav buttons, tabs, AI explanation ----
const cr=sq=>[S.flip?7-(sq.charCodeAt(0)-97):sq.charCodeAt(0)-97,S.flip?+sq[1]-1:8-+sq[1]];
function animate({m,f}){const P=(x,y)=>f?[x,y]:[y,x],prs=[P(m.from,m.to)];
 if(/[kq]/.test(m.flags)){const r=m.color=='w'?'1':'8',k=m.flags.includes('k');prs.push(P((k?'h':'a')+r,(k?'f':'d')+r))}
 for(const[a,b]of prs){const el=document.querySelector(`#board i[data-sq=${b}]`);if(!el)continue;const[x1,y1]=cr(a),[x2,y2]=cr(b);el.style.zIndex=5;
  el.animate([{transform:`translate(${(x1-x2)*100}%,${(y1-y2)*100}%)`},{transform:'none'}],{duration:180,easing:'ease-out'}).onfinish=()=>{el.style.zIndex=''}}}
let tm=0;const stop=()=>{clearInterval(tm);tm=0;$('#play').classList.remove('on')};
$('#nav').onclick=e=>{const b=e.target.closest('button');if(!b)return;const k=b.dataset.n;
 if(k=='play'){if(tm)return stop();$('#play').classList.add('on');tm=setInterval(()=>{if(S.cur>=S.mv.length)stop();else go(S.cur+1)},1000);return}
 stop();go(k=='first'?0:k=='prev'?S.cur-1:k=='next'?S.cur+1:1e4)};
const tab=t=>{if(t=='explain')t='review';T=t;if(t!='review')speechSynthesis.cancel();
 document.querySelectorAll('.view').forEach(p=>p.classList.toggle('on',p.id=='p-'+t));$('#panel').dataset.view=t;if(t=='review')explain();if(t=='puz')pzUI()};
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-v],[data-hint],[data-sk],#share,#back');if(!t)return;
 if(t.id=='back')tab(T=='review'?'games':'review');else if(t.dataset.v)tab(t.dataset.v);else if(t.dataset.hint)explain(true);
 else if(t.dataset.sk){S.v=null;go(0);tab('review')}else if(t.id=='share'){navigator.clipboard.writeText((S.meta&&S.meta.url)||$('#pgn').value||'').then(()=>status('Copied to clipboard'))}});
const esc=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]).replace(/\n/g,'<br>');
const fmt=cp=>Math.abs(cp)>9000?(cp>0?'+':'-')+'M'+(10000-Math.abs(cp)):(cp>0?'+':'')+(cp/100).toFixed(2);
const sanOf=(fen,pv,n)=>{try{const c=new Chess(fen),o=[];for(const u of(pv||'').split(' ').slice(0,n))o.push(c.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]}).san);return o.join(' ')}catch{return''}};
const EC={},MODEL='claude-sonnet-5-5';let xid=0;
$('#key').value=localStorage.k||'';$('#key').onchange=e=>{localStorage.k=e.target.value.trim()};
$('#ex').onclick=e=>{if(e.target.id=='xb')explain(true)};
let curK='';const PEND={},ERR={};
function ctx(){
 if(S.v&&S.v.kind=='user'){const v=S.v,p=v.pos;if(p<1)return null;return{fb:v.fens[p-1],fa:v.fens[p],m:v.moves[p-1],b:v.ev[p-1],a:v.ev[p],cl:v.cls[p-1],base:v.base+p-1,var:1}}
 const c=S.cur,m=S.mv[c-1];if(!m||!S.cls[c-1])return null;
 return{fb:S.fens[c-1],fa:S.fens[c],m,b:S.ev[c-1],a:S.ev[c],cl:S.cls[c-1],base:c-1}}
function vcls(b,a,m){const s=m.color=='w'?1:-1,l=Math.max(0,wp(s*b.cp)-wp(s*a.cp)),best=(m.from+m.to+(m.promotion||''))==b.best;
 return best||l<.3?'best':l<=2?'excellent':l<=5?'good':l<=10?'inaccuracy':l<=20?'mistake':'blunder'}
async function vEval(v,i){const d=+$('#depth').value;
 try{for(const j of[i-1,i]){if(j<0||v.ev[j])continue;const f=v.fens[j],e=await evalPos(f,d);if(S.v!==v||v.fens[j]!==f)return;v.ev[j]=e}
  if(i>=1&&v.ev[i-1]&&v.ev[i])v.cls[i-1]=vcls(v.ev[i-1],v.ev[i],v.moves[i-1])}catch{return}
 if(S.v===v)render()}
async function explain(force){
 if(T!='review')return;const el=$('#ex');
 if(S.v&&S.v.kind=='pv'){const v=S.v;
  el.innerHTML=`<p><b>${v.line=='best'?"Engine's best line":'What follows the move played'}</b></p><p class=lnk>${v.moves.map((m,i)=>{const p=v.base+i+1,n=m.color=='w'?Math.ceil(p/2)+'. ':i==0?Math.ceil(p/2)+'... ':'';return`<a data-vi=${i+1} class="${v.pos==i+1?'on':''}">${n}${m.san}</a>`}).join(' ')}</p>
  <p><button data-vn=first>⏮</button> <button data-vn=prev>◀</button> <button data-vn=next>▶</button> <button data-vn=last>⏭</button> <button data-bg=1>↩ Back to game</button></p>
  <p class=f>Use the arrows (or the board arrows / keyboard) to step through the line.</p>`;return}
 const x=ctx();
 if(!x){el.innerHTML='<p>'+(S.v?'Make a move on the board to have it evaluated.':S.cur==0&&S.acc?sumText():S.cur==0?'Analysis in progress… step through the moves or play your own on the board.':'Evaluating…')+'</p>';return}
 if(!x.b||!x.a){el.innerHTML=`<p><b>${x.m.san}</b></p><p class=f>Evaluating with Stockfish…</p>`;return}
 const cl=x.cl||vcls(x.b,x.a,x.m),bl=x.b.lines[0]||{},al=x.a.lines[0]||{},line=sanOf(x.fb,bl.pv,5),bm=sanOf(x.fb,bl.pv,1),
  diff=bl.uci&&bl.uci!=x.m.from+x.m.to+(x.m.promotion||''),bad=['inaccuracy','mistake','miss','blunder'].includes(cl);
 el.innerHTML=`<p>${x.var?'<span class=f>Your line · </span>':''}<b>${x.m.san}</b> ${({best:'is the best move',excellent:'is an excellent move',good:'is a good move',brilliant:'is a brilliant move!',great:'is a great move!',book:'is a book move',inaccuracy:'is an inaccuracy',mistake:'is a mistake',miss:'misses a chance',blunder:'is a blunder'})[cl]||''}.</p>`+
  (diff?`<p>Best move: <b>${bm}</b> ${x.var?'':`<button data-alt=1>${S.alt?'↩ Played move':'Show on board'}</button>`}</p>`:`<p class=f>That was the engine's top choice.</p>`)+
  `<p class=f>Eval ${fmt(x.b.cp)} → ${fmt(x.a.cp)} (White's view)${line?` · Engine line: ${line}`:''}</p>
  <p><button data-pv=played>▶ Show what follows</button> ${diff?'<button data-pv=best>▶ Show best line</button>':''}</p><div id=ax></div>`;
 const ax=$('#ax'),k=x.fb+x.m.san+cl;curK=k;
 if(EC[k]){ax.innerHTML=esc(EC[k]);say(EC[k],k);return}
 if(ERR[k]&&!force){ax.innerHTML='<span class=f>AI error: '+esc(ERR[k])+'</span> <button id=xb>Retry</button>';return}
 if(!localStorage.k){ax.innerHTML='<span class=f>Add your Anthropic API key below to get an AI explanation.</span>';return}
 if(!bad&&!force&&!x.var){ax.innerHTML='<button id=xb>Explain this move</button>';return}
 ax.textContent='Thinking…';if(PEND[k])return;PEND[k]=1;delete ERR[k];if(!force){await new Promise(r=>setTimeout(r,700));if(curK!=k||T!='review'){delete PEND[k];return}}
 const who=x.var?(x.m.color=='w'?'White':'Black')+' (trying an alternative move in analysis)':x.m.color=='w'?S.names[0]+' (White)':S.names[1]+' (Black)';
 const prompt=`You are a friendly chess coach. In 3-5 short sentences of plain language, explain why ${who} move ${x.m.san} is rated "${cl}" — in other words why it works or why it doesn't. Base this ONLY on the engine data below; do not invent variations beyond it. Name concrete reasons (hanging piece, missed tactic, lost material, weakened king, missed mate...) only when the data supports them, and say what the better idea was.
Position before the move (FEN): ${x.fb}
${new Chess(x.fb).ascii()}
Engine eval in pawns from White's view: before ${fmt(x.b.cp)}, after ${fmt(x.a.cp)}.
Engine's preferred line from that position: ${line}
After the move played, the engine's best continuation: ${sanOf(x.fa,al.pv,6)}`;
 try{const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':localStorage.k,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:MODEL,max_tokens:1000,messages:[{role:'user',content:prompt}]})});
  const j=await r.json();if(!r.ok)throw Error(j.error&&j.error.message||r.status);
  EC[k]=j.content.map(y=>y.text||'').join('')+(j.stop_reason=='max_tokens'?' …':'')}
 catch(e){ERR[k]=String(e.message)}
 finally{delete PEND[k];if(curK==k)explain()}}

// ---- best-move toggle, sounds, voice ----
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('[data-alt]')){S.alt=!S.alt;speechSynthesis.cancel();render({alt:1});snd('move')}});
for(const k of['snd','vo']){const el=$('#'+k);el.checked=localStorage[k]!='0';el.onchange=()=>{localStorage[k]=el.checked?1:0}}
const kind=m=>/[+#]/.test(m.san)?'check':/[kq]/.test(m.flags)?'castle':/[ce]/.test(m.flags)?'capture':m.flags.includes('p')?'promote':'move';
let AC;
function synth(k){try{AC=AC||new AudioContext();AC.resume();const t=AC.currentTime;
 const nz=(d,fq,v,at=0)=>{const b=AC.createBuffer(1,AC.sampleRate*d,AC.sampleRate),x=b.getChannelData(0);for(let i=0;i<x.length;i++)x[i]=(Math.random()*2-1)*(1-i/x.length)**3;
  const s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();s.buffer=b;f.type='bandpass';f.frequency.value=fq;g.gain.value=v;s.connect(f);f.connect(g);g.connect(AC.destination);s.start(t+at)};
 const th=(f,d,v,at=0)=>{const o=AC.createOscillator(),g=AC.createGain();o.frequency.setValueAtTime(f,t+at);o.frequency.exponentialRampToValueAtTime(f/2,t+at+d);
  g.gain.setValueAtTime(v,t+at);g.gain.exponentialRampToValueAtTime(.001,t+at+d);o.connect(g);g.connect(AC.destination);o.start(t+at);o.stop(t+at+d)};
 if(k=='capture'){nz(.07,900,1.6,0);th(130,.14,.7,0);nz(.05,1600,.9,.07)}
 else if(k=='castle'){nz(.05,1400,1,0);th(170,.09,.5,0);nz(.05,1200,1,.15);th(150,.09,.5,.15)}
 else if(k=='check'){nz(.06,1100,1.3,0);th(170,.1,.6,0);th(880,.3,.12,.08)}
 else if(k=='ok'){th(660,.12,.25,0);th(880,.2,.25,.1)}else if(k=='bad'){th(220,.25,.35,0);th(150,.3,.35,.12)}
 else if(['end','win','lose','draw'].includes(k)){nz(.06,1100,1.3,0);th(170,.1,.6,0);[523,659,784].forEach((f,i)=>th(f,.6,.18,.15+i*.12))}
 else{nz(.05,1400,1.1,0);th(170,.09,.5,0)}}catch{}}
const spoken=s=>s.replace(/O-O-O/g,'queenside castles').replace(/O-O/g,'kingside castles')
 .replace(/\b([KQRBN])([a-h]?[1-8]?)(x?)([a-h][1-8])(\+|#)?(?![a-z0-9])/g,(_,p,d,x,sq,c)=>({K:'King',Q:'Queen',R:'Rook',B:'Bishop',N:'Knight'})[p]+' '+d+(x?' takes ':' ')+sq+(c=='+'?' check':c=='#'?' checkmate':''));
let said='';
const talk=t=>{speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(spoken(t)))};
function say(t,k){said=t;if(k===lastK)return;lastK=k;if($('#vo').checked&&t)talk(t)}
$('#sp').onclick=()=>{if(said)talk(said)};

// ---- real chess.com sounds (streamed from chess.com's CDN, synth fallback), game results ----
const SF='https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/',BAD={},
 SM={move:['move-self'],capture:['capture'],castle:['castle'],check:['move-check'],promote:['promote'],end:['game-end'],win:['game-win-long','game-end'],lose:['game-lose-long','game-end'],draw:['game-end']};
function play(k){const f=(SM[k]||[]).find(x=>!BAD[x]);if(!f)return synth(k);const a=new Audio(SF+f+'.mp3');a.volume=.6;
 a.play().catch(e=>{if(e.name!='NotAllowedError'){BAD[f]=1;play(k)}})}
function snd(k){if($('#snd').checked)play(k)}
const HOW={checkmated:'checkmate',resigned:'resignation',timeout:'timeout',abandoned:'abandonment',agreed:'agreement',repetition:'repetition',stalemate:'stalemate',insufficient:'insufficient material','50move':'the 50-move rule',timevsinsufficient:'timeout vs insufficient material'};
function fromApi(g){const w=g.white.result=='win'?'w':g.black.result=='win'?'b':null,o=w=='b'?g.white.result:w=='w'?g.black.result:g.white.result;return{w,how:HOW[o]||o}}
function derive(vm,hr){if(!vm.length)return null;const t=new Chess(vm[vm.length-1].after);
 if(t.isCheckmate())return{w:vm[vm.length-1].color,how:'checkmate'};
 if(t.isStalemate())return{w:null,how:'stalemate'};if(t.isInsufficientMaterial())return{w:null,how:'insufficient material'};if(t.isDraw())return{w:null,how:'draw'};
 if(hr=='1-0'||hr=='0-1')return{w:hr=='1-0'?'w':'b',how:'resignation or timeout'};if(hr=='1/2-1/2')return{w:null,how:'agreement'};return null}
function finale(){const r=S.result;if(!r||!S.mv.length||S.cur!=S.mv.length)return;
 const un=(me||localStorage.u||'').toLowerCase(),mi=[0,1].find(i=>(S.names[i]||'').toLowerCase()==un),side=un&&mi!=null?'wb'[mi]:null;let k,t,ic;
 if(r.w==null){k='draw';t='Draw';ic='🤝'}else if(side){k=side==r.w?'win':'lose';t=k=='win'?'You won!':'You lost';ic=k=='win'?'🏆':'💔'}else{k='end';t=S.names[r.w=='w'?0:1]+' won';ic='🏆'}
 const o=$('#over');o.innerHTML=`<div class="card ${k}"><div style="font-size:44px">${ic}</div><b>${t}</b><span class=f>${r.how?(r.w==null?'':'by ')+r.how:''}</span></div>`;
 if(k=='win'||k=='end')for(let i=0;i<40;i++){const c=document.createElement('i');c.className='conf';
  c.style.cssText=`left:${Math.random()*100}%;background:hsl(${Math.random()*360} 80% 60%);animation-delay:${Math.random()*.8}s;animation-duration:${1.6+Math.random()}s`;o.appendChild(c)}
 o.classList.add('on');setTimeout(()=>o.classList.remove('on'),4200);
 for(const row of new Chess(S.fens[S.cur]).board())for(const p of row)if(p&&p.type=='k'){const el=document.querySelector(`#board i[data-sq=${p.square}]`);if(!el)continue;
  if(r.w==null)el.parentElement.insertAdjacentHTML('beforeend','<b class=cw style="background:#888">½</b>');
  else if(p.color==r.w)el.parentElement.insertAdjacentHTML('beforeend','<b class=cw style="background:#81b64c">👑</b>');
  else el.classList.add('kfall')}
 setTimeout(()=>snd(k),500)}

// ---- chess.com wood pieces + walnut board (images streamed from chess.com's CDN; falls back to flat colours/glyphs) ----
var IMG,PS=localStorage.ps||'wood',BS=localStorage.bs||'walnut';
const CDN='https://images.chesscomfiles.com/chess-themes/',
 PCS=['wood','neo','neo_wood','classic','alpha','game_room','marble','modern','nature','ocean','space','tournament','vintage','club','condal','bases','book','cases','icy_sea','maya','lolz','8_bit'];
function applyTheme(){
 let css='';for(const c of'wb')for(const t of'pnbrqk')css+=`.pc-${c}${t}{background-image:url(${CDN}pieces/${PS}/150/${c}${t}.png)}`;
 let st=document.getElementById('pcs');if(!st){st=document.createElement('style');st.id='pcs';document.head.appendChild(st)}st.textContent=css;
 const p=new Image();p.onload=()=>{IMG=true;render()};p.onerror=()=>{IMG=false;render()};p.src=`${CDN}pieces/${PS}/150/wk.png`;
 const bd=$('#board'),u=`${CDN}boards/${BS}/150.${BS=='walnut'?'jpg':'png'}`,b=new Image();
 b.onload=()=>{bd.classList.remove('flat');bd.style.backgroundImage=`url(${u})`};b.onerror=()=>bd.classList.add('flat');b.src=u}
$('#ps').innerHTML=PCS.map(t=>`<option ${t==PS?'selected':''}>${t}</option>`).join('');
$('#bs').innerHTML=['walnut','green'].map(t=>`<option ${t==BS?'selected':''}>${t}</option>`).join('');
$('#ps').onchange=e=>{PS=e.target.value;localStorage.ps=PS;applyTheme()};
$('#bs').onchange=e=>{BS=e.target.value;localStorage.bs=BS;applyTheme()};
applyTheme();

// ---- your own lines, engine-line player, right-click arrows / red squares, drag & drop ----
var rc=null,ENG,sel=null,tg=[],drag=null;
function arrowSvg(a,b,col){if(a==b)return'';const P=s=>{const[x,y]=cr(s);return[x+.5,y+.5]},[x1,y1]=P(a),[x2,y2]=P(b),dx=x2-x1,dy=y2-y1,
 kn=(Math.abs(dx)==1&&Math.abs(dy)==2)||(Math.abs(dx)==2&&Math.abs(dy)==1),
 pts=kn?(Math.abs(dy)>Math.abs(dx)?[[x1,y1],[x1,y2],[x2,y2]]:[[x1,y1],[x2,y1],[x2,y2]]):[[x1,y1],[x2,y2]],n=pts.length,
 [px,py]=pts[n-2],[qx,qy]=pts[n-1],L=Math.hypot(qx-px,qy-py),ux=(qx-px)/L,uy=(qy-py)/L,hl=.36,hw=.24,bx=qx-ux*hl,by=qy-uy*hl,
 body=pts.slice(0,n-1).map(p=>p.join(',')).join(' ')+' '+bx+','+by;
 return`<g opacity=".82"><polyline points="${body}" fill="none" stroke="${col}" stroke-width=".17" stroke-linejoin="round"/><polygon fill="${col}" points="${qx},${qy} ${bx-uy*hw},${by+ux*hw} ${bx+uy*hw},${by-ux*hw}"/></g>`}
function uSvg(){return(S.ar||[]).map(x=>arrowSvg(x.f,x.t,x.c)).join('')}
function drawA(){const s=$('#arrow');if(s)s.innerHTML=(ENG||'')+uSvg()}
const sqAt=(x,y)=>{const e=document.elementFromPoint(x,y),s=e&&e.closest&&e.closest('.sq');return s?s.dataset.s:null};
const curFen=()=>PZ.on?PZ.fen:S.v?S.v.fens[S.v.pos]:S.fens[S.cur];
function clearSel(){sel=null;tg=[];document.querySelectorAll('.sq.sel,.sq.tg').forEach(x=>x.classList.remove('sel','tg'))}
function mark(){const q=s=>document.querySelector(`.sq[data-s=${s}]`);if(q(sel))q(sel).classList.add('sel');tg.forEach(s=>{const x=q(s);if(x)x.classList.add('tg')})}
function boardDown(e){
 if((S.ar&&S.ar.length)||(S.rd&&S.rd.length)){S.ar=[];S.rd=[];document.querySelectorAll('.sq.rd').forEach(x=>x.classList.remove('rd'));drawA()}
 if((!S.fens.length&&!PZ.on)||S.alt||(PZ.on&&(PZ.lock||PZ.over||PZ.loading)))return;const sq=sqAt(e.clientX,e.clientY);if(!sq)return;
 if(sel&&sel!=sq&&tg.includes(sq)){const f=sel;clearSel();tryMove(f,sq);return}
 const t=new Chess(curFen()),p=t.get(sq);clearSel();
 if(p&&p.color==t.turn()){sel=sq;tg=t.moves({square:sq,verbose:true}).map(m=>m.to);mark();
  const el=document.querySelector(`#board i[data-sq=${sq}]`);if(el)drag={from:sq,el,x:e.clientX,y:e.clientY,g:null}}}
function tryMove(from,to,noAnim){if(PZ.on)return pzMove(from,to,noAnim);let m;const fen=curFen();try{m=new Chess(fen).move({from,to,promotion:'q'})}catch{return}
 if(!m)return;
 if(!S.v){const g=S.mv[S.cur];if(g&&g.from==m.from&&g.to==m.to&&(g.promotion||'')==(m.promotion||'')){go(S.cur+1);return}
  S.v={kind:'user',base:S.cur,fens:[fen],moves:[],ev:[S.ev[S.cur]],cls:[],pos:0}}
 const v=S.v;v.kind='user';const p=v.pos;v.fens.length=p+1;v.moves.length=p;v.ev.length=p+1;v.cls.length=p;
 v.moves.push(m);v.fens.push(m.after);v.pos=p+1;S.ar=[];S.rd=[];S.alt=0;lastK='';speechSynthesis.cancel();
 render(noAnim?0:{m,f:true});snd(kind(m));vEval(v,v.pos);tab('review')}
function vgo(p){const v=S.v;if(!v)return;const o=v.pos;v.pos=Math.max(0,Math.min(v.moves.length,p));if(v.pos==o)return;S.ar=[];S.rd=[];
 const m=v.moves[Math.max(o,v.pos)-1];render(Math.abs(v.pos-o)==1?{m,f:v.pos>o}:0);if(m)snd(kind(m))}
function vnav(i){const v=S.v;if(v.kind!='pv')return false;
 if(i>=1e4)vgo(v.moves.length);else if(i==0&&S.cur>1)vgo(0);else if(i<S.cur){if(v.pos==0){S.v=null;render()}else vgo(v.pos-1)}else if(i>S.cur)vgo(v.pos+1);return true}
function startPV(which){const x=ctx();if(!x||!x.b||!x.a)return;const t=new Chess(x.fb),mv=[];
 try{if(which=='played')mv.push(t.move({from:x.m.from,to:x.m.to,promotion:x.m.promotion}));
  for(const u of(((which=='best'?x.b:x.a).lines[0]||{}).pv||'').split(' ').filter(Boolean).slice(0,10))mv.push(t.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]}))}catch{}
 if(!mv.length)return;S.alt=0;S.ar=[];S.rd=[];
 S.v={kind:'pv',line:which,base:x.base,fens:[x.fb,...mv.map(m=>m.after)],moves:mv,ev:[x.b,which=='best'?x.b:x.a],cls:which=='played'?[x.cl]:[],pos:1};
 render({m:mv[0],f:true});snd(kind(mv[0]))}
document.addEventListener('click',e=>{const el=e.target.closest&&e.target.closest('[data-alt],[data-pv],[data-vn],[data-vi],[data-bg],[data-pzs],[data-pzq],[data-pza],[data-pzm]'),d=el?el.dataset:{};
 if(d.bg){S.v=null;S.ar=[];S.rd=[];render()}
 else if(d.pv)startPV(d.pv);
 else if(d.vn){const v=S.v;if(!v)return;vgo(d.vn=='first'?0:d.vn=='last'?v.moves.length:d.vn=='prev'?v.pos-1:v.pos+1)}
 else if(d.vi&&S.v)vgo(+d.vi)});
const BD=$('#board');BD.oncontextmenu=e=>{e.preventDefault()};
BD.addEventListener('pointerdown',e=>{
 if(e.button==2){e.preventDefault();rc={f:sqAt(e.clientX,e.clientY),t:null,c:e.shiftKey?'#81b64c':e.ctrlKey?'#e5483c':e.altKey?'#3b8fdb':'#ff9f1a'};return}
 if(e.button==0)boardDown(e)});
document.addEventListener('pointermove',e=>{
 if(drag){if(!drag.g&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>5){const r=drag.el.getBoundingClientRect(),g=document.createElement('div');
   g.className=drag.el.className;g.textContent=drag.el.textContent;
   g.style.cssText=`position:fixed;width:${r.width}px;height:${r.height}px;font-size:${r.height*.8}px;display:flex;align-items:center;justify-content:center;z-index:99;pointer-events:none;background-size:94%;background-position:center;background-repeat:no-repeat`;
   document.body.appendChild(g);drag.g=g;drag.w=r.width;drag.h=r.height;drag.el.style.visibility='hidden'}
  if(drag.g){drag.g.style.left=e.clientX-drag.w/2+'px';drag.g.style.top=e.clientY-drag.h/2+'px'}}});
document.addEventListener('pointerup',e=>{
 if(e.button==2&&rc){const f=rc.f,t=sqAt(e.clientX,e.clientY);
  if(f&&t){S.ar=S.ar||[];S.rd=S.rd||[];
   if(f==t){const i=S.rd.indexOf(f);if(i>=0)S.rd.splice(i,1);else S.rd.push(f);const el=document.querySelector(`.sq[data-s=${f}]`);if(el)el.classList.toggle('rd')}
   else{const i=S.ar.findIndex(a=>a.f==f&&a.t==t);if(i>=0)S.ar.splice(i,1);else S.ar.push({f,t,c:rc.c})}}
  rc=null;drawA();return}
 if(e.button==0&&drag){const d=drag;drag=null;
  if(d.g){d.g.remove();d.el.style.visibility='';const t=sqAt(e.clientX,e.clientY);if(t&&t!=d.from&&tg.includes(t)){clearSel();tryMove(d.from,t,true)}}}});

// ---- puzzles (rated puzzles from Lichess's open puzzle database) ----
var PZ={on:false};
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),pzFmt=s=>{s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')},pzBest=()=>{try{return JSON.parse(localStorage.pzb||'{}')}catch{return{}}};
function pzSetup(j){try{const toks=j.game.pgn.split(/\s+/).filter(x=>x&&!/^\d+\.+$/.test(x)&&!/^(1-0|0-1|1\/2-1\/2|\*)$/.test(x)),ip=j.puzzle.initialPly,u=j.puzzle.solution[0];
 for(const n of[ip+1,ip,ip+2,ip-1]){if(n<1||n>toks.length)continue;const c=new Chess();let ok=1;try{for(let i=0;i<n-1;i++)c.move(toks[i])}catch{ok=0}if(!ok)continue;
  const before=c.fen();let lm;try{lm=c.move(toks[n-1])}catch{continue}
  try{new Chess(c.fen()).move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]})}catch{continue}
  return{before,fen:c.fen(),lastMove:lm,color:c.turn()}}}catch{}return null}
function pzStart(limit){if(PZ.iv)clearInterval(PZ.iv);const old=PZ.on?PZ.old:S.flip,id=Math.random();
 PZ={on:true,id,limit,score:0,fails:0,used:0,lvl:0,pool:[],seen:new Set(),lock:1,loading:true,over:false,old,hist:[],fen:new Chess().fen(),prev:performance.now()};
 S.v=null;S.alt=0;S.ar=[];S.rd=[];tab('puz');render();pzFeed(id);pzNext();
 PZ.iv=setInterval(()=>{const now=performance.now();if(!PZ.loading&&!PZ.over)PZ.used+=now-PZ.prev;PZ.prev=now;
  if(PZ.used>=PZ.limit*1000&&!PZ.over)pzEnd('time');const t=pzFmt(PZ.limit-PZ.used/1000);if($('#pzT'))$('#pzT').textContent=t;if($('#pzck'))$('#pzck').textContent=t},200)}
async function pzFeed(id){const D=['easiest','easier','normal','harder','hardest'];let k=0,err=0;
 while(PZ.on&&PZ.id==id&&!PZ.over){if(PZ.pool.filter(p=>p.rating>PZ.lvl&&!PZ.seen.has(p.id)).length>=10){await sleep(800);continue}
  try{const r=await fetch('https://lichess.org/api/puzzle/next?difficulty='+(PZ.pool.length<2?'easiest':D[k++%5]));if(r.status==429){await sleep(8000);continue}if(!r.ok)throw 0;
   const j=await r.json(),s=pzSetup(j);if(s&&!PZ.pool.some(p=>p.id==j.puzzle.id))PZ.pool.push({id:j.puzzle.id,rating:j.puzzle.rating,sol:j.puzzle.solution,...s});err=0}
  catch{if(++err>5&&!PZ.pool.length){PZ.msg='Could not reach Lichess for puzzles — check your connection.';pzExit(true);return}await sleep(1500)}
  await sleep(450)}}
function pzNext(){PZ.loading=true;const id=PZ.id,t=setInterval(()=>{if(!PZ.on||PZ.id!=id||PZ.over){clearInterval(t);return}
 const c=PZ.pool.filter(p=>p.rating>PZ.lvl&&!PZ.seen.has(p.id)).sort((a,b)=>a.rating-b.rating)[0];if(c){clearInterval(t);pzLoad(c)}},150);pzUI()}
function pzLoad(c){PZ.seen.add(c.id);PZ.puz=c;PZ.i=0;PZ.sol=c.sol;PZ.fen=c.before;PZ.last=null;PZ.bad=null;PZ.lock=1;S.flip=c.color=='b';render();
 setTimeout(()=>{if(!PZ.on||PZ.over)return;PZ.fen=c.fen;PZ.last=c.lastMove;render({m:c.lastMove,f:true});snd(kind(c.lastMove));PZ.lock=0;PZ.loading=false;PZ.prev=performance.now();pzUI()},350)}
function pzMove(from,to,noAnim){if(PZ.lock||PZ.over||PZ.loading)return;const e=PZ.sol[PZ.i]||'',t=new Chess(PZ.fen);let m;
 try{m=t.move({from,to,promotion:e.slice(0,4)==from+to&&e[4]?e[4]:'q'})}catch{return}if(!m)return;
 const uci=m.from+m.to+(m.promotion||'');
 if(uci==e||t.isCheckmate()){PZ.fen=m.after;PZ.last=m;PZ.i++;render(noAnim?0:{m,f:true});snd(kind(m));if(t.isCheckmate()||PZ.i>=PZ.sol.length)return pzSolved();
  PZ.lock=1;setTimeout(()=>{if(!PZ.on||PZ.over)return;const u=PZ.sol[PZ.i],r=new Chess(PZ.fen).move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});PZ.fen=r.after;PZ.last=r;PZ.i++;PZ.lock=0;render({m:r,f:true});snd(kind(r));if(PZ.i>=PZ.sol.length)pzSolved()},350);return}
 const before=PZ.fen;PZ.fails++;PZ.lock=1;PZ.fen=m.after;PZ.last=m;PZ.bad=1;render(noAnim?0:{m,f:true});snd('bad');pzUI();
 setTimeout(()=>{if(!PZ.on)return;if(PZ.fails>=3)return pzEnd('void');PZ.fen=before;PZ.last=null;PZ.bad=null;PZ.lock=0;render({m,f:false});pzUI()},800)}
function pzSolved(){PZ.score++;PZ.lvl=PZ.puz.rating;PZ.hist.push(PZ.puz.rating);PZ.lock=1;snd('ok');pzUI();setTimeout(()=>{if(PZ.on&&!PZ.over)pzNext()},450)}
function pzEnd(why){PZ.over=true;PZ.lock=1;clearInterval(PZ.iv);const b=pzBest(),k='s'+PZ.limit;
 if(why=='time'&&PZ.score>(b[k]||0)){b[k]=PZ.score;localStorage.pzb=JSON.stringify(b)}pzUI()}
function pzExit(menu){if(PZ.iv)clearInterval(PZ.iv);const o=PZ.old,msg=PZ.msg;PZ={on:false,msg};if(o!=null)S.flip=o;$('#wrap').classList.remove('pz');if(menu)tab('puz');else tab('review');render()}
function pzUI(){const el=$('#pz');if(!el)return;
 if(!PZ.on){const b=pzBest();el.innerHTML=`<h3 style="margin:10px 0">Puzzle rush</h3><p class=f2>Solve as many puzzles as you can before the clock runs out. Every puzzle you solve is harder than the last — puzzle ratings are the Elo players usually need to solve them. Three failed attempts void the round.</p>
  <div class=pzbtns><button data-pzs=180>3 min</button><button data-pzs=300>5 min</button></div><p class=f2>Best — 3 min: <b>${b.s180||0}</b> solved · 5 min: <b>${b.s300||0}</b> solved</p>${PZ.msg?`<p style="color:#fa412d">${PZ.msg}</p>`:''}`;return}
 const stk=[0,1,2].map(i=>`<span class="stk ${i<PZ.fails?'x':''}">${i<PZ.fails?'✕':''}</span>`).join('');
 if(PZ.over){const v=PZ.fails>=3,top=PZ.hist.length?Math.max(...PZ.hist):0;
  el.innerHTML=`<h3 style="margin:10px 0">${v?'Round voided':"Time's up!"}</h3><p>${v?'Three failed attempts — this round does not count.':`You solved <b>${PZ.score}</b> puzzle${PZ.score==1?'':'s'}${top?`, up to rating <b>${top}</b>`:''}.`}</p><div class=pzbtns><button data-pza=1>Play again</button><button data-pzm=1 style="background:#4a433d">Menu</button></div>`;return}
 el.innerHTML=`<div class=pzh><div id=pzT class=pzt>${pzFmt(PZ.limit-PZ.used/1000)}</div><div class=pzs><b>${PZ.score}</b>solved</div><div>${stk}</div></div>
  <p>${PZ.loading?'Loading next puzzle… (timer paused)':`Find the best move for ${PZ.puz&&PZ.puz.color=='b'?'Black':'White'}.`}</p><p class=f2>${PZ.score?`Last solved: rated ${PZ.lvl}`:''} ${PZ.fails&&!PZ.over?` · ${3-PZ.fails} attempt${3-PZ.fails==1?'':'s'} left`:''}</p><button data-pzq=1 style="background:#4a433d">Quit</button>`}
document.addEventListener('click',e=>{const el=e.target.closest&&e.target.closest('[data-pzs],[data-pzq],[data-pza],[data-pzm]');if(!el)return;const d=el.dataset;
 if(d.pzs)pzStart(+d.pzs);else if(d.pza)pzStart(PZ.limit);else if(d.pzq||d.pzm)pzExit(true)});
render();
