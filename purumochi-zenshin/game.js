// ぷるもち☆バトル — オリジナル落ち物対戦パズル
(()=>{
'use strict';
// ======================================================================
//  定数・ユーティリティ
// ======================================================================
const COLS=6,ROWS=13,CELL=34,TAU=Math.PI*2;
const OX=[0,1,0,-1],OY=[-1,0,1,0];
const Q=new URLSearchParams(location.search);
const DBG={cpuvs:Q.has('cpuvs'),stage:+(Q.get('stage')||0),fast:+(Q.get('ts')||1)};
const IS_TOUCH=matchMedia('(pointer:coarse)').matches||('ontouchstart' in window);
if(IS_TOUCH)document.getElementById('rot').classList.add('touch');
const FONT='"M PLUS Rounded 1c",system-ui,sans-serif';
const rand=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>1-Math.pow(1-clamp(t,0,1),3);
const easeBack=t=>{t=clamp(t,0,1);const c=1.7;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)};
const store={get(k,d){try{const v=localStorage.getItem('purumochi_'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('purumochi_'+k,JSON.stringify(v))}catch(e){}}};
const BLOB=[null,
  {c:'#ff6f86',d:'#c8284a',l:'#ffe0e6',g:[255,111,134]},
  {c:'#5fe08a',d:'#1c8f45',l:'#e0ffe9',g:[95,224,138]},
  {c:'#5aa0ff',d:'#1f52c0',l:'#e0ecff',g:[90,160,255]},
  {c:'#ffd84a',d:'#c99000',l:'#fff6cc',g:[255,216,74]},
  {c:'#ecebf6',d:'#9190b2',l:'#ffffff',g:[220,220,240]}];
const GARB=5;

// ======================================================================
//  キャラクター・ステージ
// ======================================================================
const CH={};CHARS.forEach(c=>CH[c.id]=c);
const VOICE_CREDIT=['VOICEVOX:白上虎太郎','VOICEVOX:麒ヶ島宗麟','VOICEVOX:四国めたん','VOICEVOX:九州そら','VOICEVOX:波音リツ'];
const STAGES=[
  {opp:'mogu',bgm:'mogu',bg:'bakery',title:'こねこねベーカリー',
   ai:{target:2,pot:0,depth:1,noise:70,mistake:.2,delay:14,think:30,soft:true,counterAt:99,beam:0,waste:1200}},
  {opp:'miruru',bgm:'miruru',bg:'sky',title:'くものうえのおひるね',
   ai:{target:3,pot:1,depth:1,noise:26,mistake:.07,delay:9,think:20,soft:true,counterAt:14,beam:0,waste:2400}},
  {opp:'devi',bgm:'devi',bg:'night',title:'いたずらムーンナイト',
   ai:{target:5,pot:1,depth:2,noise:9,mistake:.025,delay:6,think:12,soft:true,counterAt:9,beam:4,waste:3200}},
  {opp:'drana',bgm:'drana',bg:'crimson',title:'クリムゾン・キャッスル',
   ai:{target:8,pot:2,depth:2,noise:0,mistake:0,delay:3,think:6,soft:true,counterAt:6,beam:6,waste:4200,kill:true}},
];

// ======================================================================
//  キャンバス・レイアウト
// ======================================================================
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
let LW=960,LH=540,S=1,OY_=0,dpr=1;
const LAY={};
function resize(){
  dpr=Math.min(window.devicePixelRatio||1,2);
  cv.width=Math.round(innerWidth*dpr);cv.height=Math.round(innerHeight*dpr);
  if(innerWidth/innerHeight>=960/540){S=cv.height/540;LW=cv.width/S;OY_=0}
  else{S=cv.width/960;LW=960;OY_=(cv.height/S-540)/2}
  const cx=LW/2;
  LAY.cx=cx;LAY.by=60;
  LAY.p1x=cx-100-COLS*CELL;LAY.p2x=cx+100;
  LAY.solox=cx-COLS*CELL/2;
  LAY.lm=LAY.p1x/2;LAY.rm=(LAY.p2x+COLS*CELL+LW)/2;
  buildSprites();
}
addEventListener('resize',resize);

// ======================================================================
//  スプライト(ぷるもち)
// ======================================================================
let SPR=null,SPRpx=0;
function blobPath(g,s){
  const k=s/84;g.beginPath();g.moveTo(14*k,66*k);
  g.bezierCurveTo(2*k,50*k,6*k,18*k,40*k,13*k);g.bezierCurveTo(74*k,8*k,86*k,40*k,74*k,62*k);g.bezierCurveTo(68*k,74*k,22*k,76*k,14*k,66*k);g.closePath();
}
function makeBlob(col,eyes,s){
  const c=document.createElement('canvas');c.width=c.height=Math.ceil(s);const g=c.getContext('2d');const k=s/84,B=BLOB[col];
  g.save();g.translate(s*.02,s*.04);g.scale(.96,.96);
  const gr=g.createRadialGradient(30*k,26*k,4*k,42*k,42*k,46*k);gr.addColorStop(0,B.l);gr.addColorStop(.35,B.c);gr.addColorStop(1,B.d);
  blobPath(g,s);g.fillStyle=gr;g.fill();g.lineWidth=Math.max(1,2.2*k);g.strokeStyle=B.d;g.stroke();
  g.save();g.translate(30*k,24*k);g.rotate(-.35);g.beginPath();g.ellipse(0,0,12*k,6.5*k,0,0,TAU);g.fillStyle='rgba(255,255,255,.62)';g.fill();g.restore();
  g.beginPath();g.arc(58*k,22*k,3*k,0,TAU);g.fillStyle='rgba(255,255,255,.5)';g.fill();
  const ink=col===GARB?'#6a6a86':'#2a1830';g.lineCap='round';
  if(col===GARB){
    g.strokeStyle=ink;g.lineWidth=2.6*k;g.beginPath();g.moveTo(26*k,42*k);g.quadraticCurveTo(32*k,39*k,38*k,42*k);g.moveTo(46*k,42*k);g.quadraticCurveTo(52*k,39*k,58*k,42*k);g.stroke();
    g.lineWidth=2.2*k;g.beginPath();g.moveTo(37*k,54*k);g.quadraticCurveTo(42*k,57*k,47*k,54*k);g.stroke();
  }else if(eyes==='open'){
    for(const ex of [31,53]){g.beginPath();g.ellipse(ex*k,42*k,5*k,7*k,0,0,TAU);g.fillStyle=ink;g.fill();g.beginPath();g.arc((ex-1.6)*k,39*k,2.2*k,0,TAU);g.fillStyle='#fff';g.fill()}
    g.strokeStyle=ink;g.lineWidth=2.4*k;g.beginPath();g.moveTo(37*k,52*k);g.quadraticCurveTo(42*k,57*k,47*k,52*k);g.stroke();
    g.fillStyle='rgba(255,255,255,.35)';g.beginPath();g.ellipse(21*k,52*k,5*k,3*k,0,0,TAU);g.ellipse(63*k,52*k,5*k,3*k,0,0,TAU);g.fill();
  }else if(eyes==='blink'){
    g.strokeStyle=ink;g.lineWidth=2.6*k;g.beginPath();g.moveTo(26*k,43*k);g.lineTo(36*k,43*k);g.moveTo(48*k,43*k);g.lineTo(58*k,43*k);g.stroke();
    g.lineWidth=2.4*k;g.beginPath();g.moveTo(37*k,52*k);g.quadraticCurveTo(42*k,57*k,47*k,52*k);g.stroke();
  }else{ // pop: ><
    g.strokeStyle=ink;g.lineWidth=2.8*k;g.beginPath();g.moveTo(26*k,37*k);g.lineTo(35*k,42*k);g.lineTo(26*k,47*k);g.moveTo(58*k,37*k);g.lineTo(49*k,42*k);g.lineTo(58*k,47*k);g.stroke();
    g.beginPath();g.ellipse(42*k,54*k,5*k,4.5*k,0,0,TAU);g.fillStyle='#c23a5c';g.fill();
  }
  g.restore();return c;
}
function buildSprites(){
  const px=Math.ceil(CELL*S);if(SPR&&SPRpx===px)return;SPRpx=px;SPR=[];
  for(let c=1;c<=5;c++)SPR[c]={open:makeBlob(c,'open',px),blink:makeBlob(c,'blink',px),pop:makeBlob(c,'pop',px)};
}

// ======================================================================
//  ポートレート
// ======================================================================
const PORT={};
function svgImg(str){const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(str.replace('<svg ','<svg width="400" height="480" '));return img}
CHARS.forEach(c=>{PORT[c.id]={};['normal','happy','pinch'].forEach(e=>PORT[c.id][e]=svgImg(portraitSVG(c,e)))});

// ======================================================================
//  サウンド
// ======================================================================
const AU={ctx:null,buf:{},cur:null,curKey:null,man:{},voice:[null,null]};
let soundOn=store.get('snd',true);
function audioInit(){
  if(AU.ctx){if(AU.ctx.state==='suspended')AU.ctx.resume();return}
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  const a=AU.ctx=new C();
  const comp=a.createDynamicsCompressor();comp.threshold.value=-10;comp.ratio.value=3;comp.connect(a.destination);
  AU.master=a.createGain();AU.master.gain.value=soundOn?1:0;AU.master.connect(comp);
  AU.bgmG=a.createGain();AU.bgmG.gain.value=.62;AU.bgmG.connect(AU.master);
  AU.sfxG=a.createGain();AU.sfxG.gain.value=.5;AU.sfxG.connect(AU.master);
  AU.voiceG=a.createGain();AU.voiceG.gain.value=1.0;AU.voiceG.connect(AU.master);
  AU.noise=a.createBuffer(1,a.sampleRate,a.sampleRate);const d=AU.noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
}
function setSound(on){soundOn=on;store.set('snd',on);if(AU.master)AU.master.gain.value=on?1:0}
async function loadBuf(path){
  if(AU.buf[path])return AU.buf[path];
  if(!AU.ctx)return null;
  try{const r=await fetch('assets/'+path);const ab=await r.arrayBuffer();const b=await new Promise((res,rej)=>AU.ctx.decodeAudioData(ab,res,rej));AU.buf[path]=b;return b}catch(e){console.warn('load fail',path,e);return null}
}
function bgm(key,fade){
  if(!AU.ctx||AU.curKey===key)return;
  fade=fade==null?.6:fade;bgmStop(fade);
  const b=AU.buf['bgm/'+key+'.ogg'];if(!b)return;
  const a=AU.ctx,src=a.createBufferSource(),g=a.createGain(),now=a.currentTime;
  src.buffer=b;const L=AU.man[key]&&AU.man[key].loop;
  if(L){src.loop=true;src.loopStart=0;src.loopEnd=L}
  g.gain.setValueAtTime(0.0001,now);g.gain.exponentialRampToValueAtTime(1,now+Math.max(.05,fade));
  src.connect(g);g.connect(AU.bgmG);src.start(now);AU.cur={src,g};AU.curKey=key;
}
function bgmStop(fade){
  if(!AU.cur)return;const {src,g}=AU.cur,now=AU.ctx.currentTime;fade=fade||.3;
  g.gain.cancelScheduledValues(now);g.gain.setValueAtTime(g.gain.value,now);g.gain.linearRampToValueAtTime(0,now+fade);
  try{src.stop(now+fade+.05)}catch(e){}AU.cur=null;AU.curKey=null;
}
function jingle(key){bgmStop(.2);const b=AU.buf['bgm/'+key+'.ogg'];if(!b||!AU.ctx)return;const s=AU.ctx.createBufferSource();s.buffer=b;s.connect(AU.bgmG);s.start();AU.cur={src:s,g:{gain:{value:1,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){}}}};AU.curKey='j_'+key}
function voice(ch,key,slot){
  if(!AU.ctx||!soundOn)return;const b=AU.buf['voice/'+ch+'_'+key+'.ogg'];if(!b)return;
  if(slot!=null&&AU.voice[slot]){try{AU.voice[slot].stop()}catch(e){}}
  const s=AU.ctx.createBufferSource();s.buffer=b;s.connect(AU.voiceG);s.start();if(slot!=null)AU.voice[slot]=s;
}
const mtof=n=>440*Math.pow(2,(n-69)/12);
function tone(type,f,t,dur,vol,f2,att,dest){
  const a=AU.ctx,o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+(att||.004));g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g);g.connect(dest||AU.sfxG);o.start(t);o.stop(t+dur+.03);
}
function noise(t,dur,vol,ft,f,f2,q){
  const a=AU.ctx,s=a.createBufferSource();s.buffer=AU.noise;s.loop=true;const fl=a.createBiquadFilter();fl.type=ft;fl.frequency.setValueAtTime(f,t);if(f2)fl.frequency.exponentialRampToValueAtTime(f2,t+dur);fl.Q.value=q||1;
  const g=a.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.connect(fl);fl.connect(g);g.connect(AU.sfxG);s.start(t,Math.random()*.5);s.stop(t+dur+.03);
}
const sfxLast={};
function sfx(name,arg){
  if(!AU.ctx||!soundOn||AU.ctx.state!=='running')return;
  const now=AU.ctx.currentTime,lim={move:.03,land:.05,rot:.03,thud:.06}[name]||0;
  if(lim&&sfxLast[name]&&now-sfxLast[name]<lim)return;sfxLast[name]=now;
  switch(name){
    case 'move':tone('triangle',880,now,.04,.08,760);break;
    case 'rot':tone('square',1320,now,.05,.05,1760);tone('sine',660,now,.06,.06,990);break;
    case 'land':tone('sine',220,now,.09,.22,110);noise(now,.05,.06,'lowpass',900);break;
    case 'pop':{const base=[0,2,4,5,7,9,11,12,14,16,17,19][Math.min(11,(arg||1)-1)]+72;
      tone('sine',mtof(base),now,.16,.32,mtof(base+12));tone('triangle',mtof(base+7),now+.03,.14,.14,mtof(base+19));
      noise(now,.12,.1,'bandpass',4000,8000,2);break}
    case 'thud':noise(now,.25,.32,'lowpass',600,80);tone('sine',90,now,.22,.35,45);break;
    case 'bigthud':noise(now,.5,.5,'lowpass',800,50);tone('sine',70,now,.5,.5,30);break;
    case 'send':tone('sawtooth',300,now,.28,.06,1400,.02);noise(now,.25,.08,'bandpass',1500,5000,3);break;
    case 'offset':tone('sine',1200,now,.25,.12,300);noise(now,.2,.08,'highpass',3000);break;
    case 'allclear':[0,4,7,12,16,19,24].forEach((n,i)=>tone('triangle',mtof(76+n),now+i*.05,.25,.14));break;
    case 'select':tone('square',988,now,.06,.06,1318);tone('sine',1976,now+.04,.08,.05);break;
    case 'cursor':tone('triangle',1046,now,.05,.07);break;
    case 'ready':tone('square',660,now,.12,.07);break;
    case 'go':[0,7,12].forEach((n,i)=>tone('square',mtof(72+n),now+i*.05,.18,.08));break;
    case 'cutin':noise(now,.35,.12,'highpass',2000,8000);tone('sine',523,now,.3,.1,1046);break;
    case 'lose':tone('triangle',440,now,.6,.14,110);break;
  }
}

// ======================================================================
//  入力
// ======================================================================
const KB={l:0,r:0,d:0,rl:0,rr:0};
const KMAP={ArrowLeft:'l',KeyA:'l',ArrowRight:'r',KeyD:'r',ArrowDown:'d',KeyS:'d',KeyZ:'rl',KeyJ:'rl',KeyX:'rr',KeyK:'rr',ArrowUp:'rr',KeyW:'rr'};
let usingTouch=IS_TOUCH;
const TP={pad:null,a:null,b:null,dir:0};
addEventListener('keydown',e=>{
  if(KMAP[e.code]){KB[KMAP[e.code]]=1;e.preventDefault()}
  if(e.code==='Space')e.preventDefault();
  if(!e.repeat)onKey(e.code);
});
addEventListener('keyup',e=>{if(KMAP[e.code])KB[KMAP[e.code]]=0});
function toL(e){return[e.clientX*dpr/S,e.clientY*dpr/S-OY_]}
const pointers=new Map();
function padDir(x,y){
  const dx=x-LAY.lm,dy=y-LAY.padY;
  if(Math.hypot(dx,dy)<14)return 0;
  const a=Math.atan2(dy,dx);
  if(a>Math.PI*.25&&a<Math.PI*.75)return 3; // 下
  if(Math.abs(a)<=Math.PI*.4)return 2;      // 右
  if(Math.abs(a)>=Math.PI*.6)return 1;      // 左
  return 0;
}
function classify(x,y){
  if(Math.hypot(x-LAY.lm,y-LAY.padY)<LAY.padR+40)return 'pad';
  if(Math.hypot(x-LAY.bAx,y-LAY.bAy)<LAY.btnR+18)return 'a';
  if(Math.hypot(x-LAY.bBx,y-LAY.bBy)<LAY.btnR+18)return 'b';
  return null;
}
cv.addEventListener('pointerdown',e=>{
  e.preventDefault();audioInit();
  if(e.pointerType==='touch')usingTouch=true;
  const [x,y]=toL(e);
  if(G.scene==='match'||G.scene==='toko'){
    if(!G.paused&&Math.hypot(x-LAY.cx,y-22)<22){pause();return}
    if(!G.paused){const k=classify(x,y);if(k){pointers.set(e.pointerId,k);if(k==='pad')TP.dir=padDir(x,y);else TP[k]=1;try{cv.setPointerCapture(e.pointerId)}catch(_){}
      if(k==='a'||k==='b')G.btnFx[k]=1;return}}
  }
  for(let i=BTN.length-1;i>=0;i--){const b=BTN[i];if(x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h){sfx('select');b.fn();return}}
  if(G.tapAny)G.tapAny();
},{passive:false});
cv.addEventListener('pointermove',e=>{
  const k=pointers.get(e.pointerId);if(k!=='pad')return;const [x,y]=toL(e);TP.dir=padDir(x,y);
});
const pend=e=>{const k=pointers.get(e.pointerId);if(!k)return;pointers.delete(e.pointerId);if(k==='pad')TP.dir=0;else TP[k]=0};
cv.addEventListener('pointerup',pend);cv.addEventListener('pointercancel',pend);
addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
let BTN=[],sel=0;
function onKey(code){
  usingTouch=false;
  if((G.scene==='match'||G.scene==='toko')&&!G.paused){if(code==='Escape'||code==='KeyP')pause();return}
  if(G.paused&&(code==='Escape'||code==='KeyP')){resume();return}
  const nav=BTN.filter(b=>!b.noNav);
  if(code==='ArrowUp'||code==='ArrowLeft'||code==='KeyW'||code==='KeyA'){sel=(sel+nav.length-1)%Math.max(1,nav.length);sfx('cursor')}
  if(code==='ArrowDown'||code==='ArrowRight'||code==='KeyS'||code==='KeyD'){sel=(sel+1)%Math.max(1,nav.length);sfx('cursor')}
  if(code==='Enter'||code==='Space'||code==='KeyZ'||code==='KeyX'){
    audioInit();
    if(nav.length){const b=nav[clamp(sel,0,nav.length-1)];sfx('select');b.fn()}
    else if(G.tapAny)G.tapAny();
  }
}
function humanInput(p){
  p.in.l=!!(KB.l||TP.dir===1);p.in.r=!!(KB.r||TP.dir===2);p.in.d=!!(KB.d||TP.dir===3);
  p.in.rl=!!(KB.rl||TP.b);p.in.rr=!!(KB.rr||TP.a);
}

// ======================================================================
//  盤面ロジック
// ======================================================================
const idx=(x,y)=>y*COLS+x;
function freeAt(f,x,y){return x>=0&&x<COLS&&y<ROWS&&(y<0||f[idx(x,y)]===0)}
function findGroups(f,minSize){
  minSize=minSize||4;const seen=new Uint8Array(COLS*ROWS),groups=[],st=[];
  for(let y=1;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const i=idx(x,y),c=f[i];if(!c||c===GARB||seen[i])continue;
    const g=[];st.length=0;st.push(i);seen[i]=1;
    while(st.length){const j=st.pop();g.push(j);const jx=j%COLS,jy=(j/COLS)|0;
      if(jx>0){const k=j-1;if(!seen[k]&&f[k]===c){seen[k]=1;st.push(k)}}
      if(jx<COLS-1){const k=j+1;if(!seen[k]&&f[k]===c){seen[k]=1;st.push(k)}}
      if(jy>1){const k=j-COLS;if(!seen[k]&&f[k]===c){seen[k]=1;st.push(k)}}
      if(jy<ROWS-1){const k=j+COLS;if(!seen[k]&&f[k]===c){seen[k]=1;st.push(k)}}}
    if(g.length>=minSize)groups.push(g);
  }
  return groups;
}
const CPOW=[0,8,16,32,64,96,128,160,192,224,256,288,320,352,384,416,448,480,512];
const CBON=[0,3,6,12,24];
const GBON=n=>n<=4?0:n>=11?10:[0,0,0,0,0,2,3,4,5,6,7][n];
function linkScore(f,groups,chain){
  let n=0,b=0;const cols=new Set();
  for(const g of groups){n+=g.length;b+=GBON(g.length);cols.add(f[g[0]])}
  let bonus=CPOW[Math.min(chain,CPOW.length)-1]+CBON[cols.size-1]+b;if(bonus<1)bonus=1;if(bonus>999)bonus=999;
  return {pts:10*n*bonus,n,cols:cols.size};
}
function removeGroups(f,groups){
  const rm=[];
  for(const g of groups)for(const i of g){if(f[i]){rm.push([i,f[i]]);f[i]=0}}
  for(const g of groups)for(const i of g){const x=i%COLS,y=(i/COLS)|0;
    for(let d=0;d<4;d++){const nx=x+OX[d],ny=y+OY[d];if(nx<0||nx>=COLS||ny<1||ny>=ROWS)continue;const k=idx(nx,ny);if(f[k]===GARB){rm.push([k,GARB]);f[k]=0}}}
  return rm;
}
function gravity(f){
  for(let x=0;x<COLS;x++){let w=ROWS-1;for(let y=ROWS-1;y>=0;y--){const v=f[idx(x,y)];if(v){if(w!==y){f[idx(x,w)]=v;f[idx(x,y)]=0}w--}}}
}
function topEmpty(f,x){for(let y=ROWS-1;y>=0;y--)if(!f[idx(x,y)])return y;return -1}
function heights(f){const h=[];for(let x=0;x<COLS;x++){let y=0;while(y<ROWS&&!f[idx(x,y)])y++;h.push(ROWS-y)}return h}

// ======================================================================
//  CPU 思考
// ======================================================================
function aiReach(f,x){const a=Math.min(2,x),b=Math.max(2,x);for(let c=a;c<=b;c++)if(f[idx(c,1)])return false;return true}
function aiPlace(f,x,rot,ca,cb){
  const cx=x+OX[rot];if(cx<0||cx>=COLS)return null;
  if(!aiReach(f,x)||!aiReach(f,cx))return null;
  const g=f.slice();
  if(rot===0||rot===2){const y=topEmpty(g,x);if(y<1)return null;g[idx(x,y)]=rot===0?ca:cb;g[idx(x,y-1)]=rot===0?cb:ca}
  else{let y=topEmpty(g,x);if(y<1)return null;g[idx(x,y)]=ca;y=topEmpty(g,cx);if(y<0)return null;g[idx(cx,y)]=cb}
  return g;
}
function aiResolve(g){
  let chain=0,score=0;
  for(;;){const gr=findGroups(g);if(!gr.length)break;chain++;score+=linkScore(g,gr,chain).pts;removeGroups(g,gr);gravity(g)}
  return {chain,score};
}
function aiPotential(g,level){
  let best=0;
  for(let x=0;x<COLS;x++){const y=topEmpty(g,x);if(y<2)continue;
    for(let c=1;c<=4;c++){
      const h=g.slice();h[idx(x,y)]=c;if(level>=2&&y>=3)h[idx(x,y-1)]=c;
      const r=aiResolve(h);if(r.chain>best)best=r.chain;
    }}
  return best;
}
function aiEval(g,prm){
  let s=0;const h=heights(g);
  if(g[idx(2,1)])return -1e7;
  if(h[2]>=10)s-=20000;if(h[2]>=9)s-=4000;
  for(let x=0;x<COLS;x++){const v=Math.max(0,h[x]-8);s-=v*v*120;s-=h[x]*4}
  for(let x=1;x<COLS-1;x++){const well=Math.min(h[x-1],h[x+1])-h[x];if(well>=3)s-=well*25}
  // つながり
  const gs=findGroups(g,2);for(const gr of gs)s+=gr.length===2?10:gr.length===3?34:0;
  // 同色の縦横ペア
  for(let y=1;y<ROWS;y++)for(let x=0;x<COLS;x++){const c=g[idx(x,y)];if(!c||c===GARB)continue;if(x<COLS-1&&g[idx(x+1,y)]===c)s+=3;if(y<ROWS-1&&g[idx(x,y+1)]===c)s+=4}
  // 端を高く、中央を低く(連鎖の土台を作りやすく)
  s+=(h[0]+h[5])*2-(h[2]+h[3])*2;
  if(prm.pot){const pc=aiPotential(g,prm.pot);s+=pc*pc*90+pc*60}
  return s;
}
function aiFire(r,c){
  if(r.chain>=c.prm.target)return 1e7+r.score;
  if(c.danger&&r.chain>=1)return 6e6+r.score;
  if(c.incoming>=c.prm.counterAt&&r.chain>=2)return 5e6+r.score;
  if(c.prm.kill&&c.oppDanger&&r.chain>=2)return 4e6+r.score;
  if(c.prm.target<=2&&r.chain>=1&&Math.random()<.5)return 2e6+r.score;
  return null;
}
function* aiThink(p,opp){
  const prm=p.ai,f=p.f,seq=G.seq;
  const p1=seq[(p.nextIdx-1)%seq.length],p2=seq[p.nextIdx%seq.length];
  const h=heights(f),oh=opp?heights(opp.f):[0];
  const c={prm,danger:Math.max(...h)>=10||h[2]>=8,incoming:p.incoming+p.incomingWait,oppDanger:opp&&(Math.max(...oh)>=10||oh[2]>=9)};
  const moves=[];for(let rot=0;rot<4;rot++){if(p1[0]===p1[1]&&rot>=2)continue;for(let x=0;x<COLS;x++)moves.push([x,rot])}
  const res=[];let t0=performance.now();
  for(const [x,rot] of moves){
    const g=aiPlace(f,x,rot,p1[0],p1[1]);if(!g)continue;
    const g2=g.slice();const r=aiResolve(g2);
    let v,fire=false;
    if(r.chain>0){const fv=aiFire(r,c);if(fv!=null){v=fv;fire=true}else v=aiEval(g2,{pot:0})-prm.waste*r.chain}
    else v=aiEval(g2,{pot:prm.depth>=2?0:prm.pot});
    v+=Math.random()*prm.noise;
    res.push({x,rot,v,g:g2,fire});
    if(performance.now()-t0>5){yield;t0=performance.now()}
  }
  if(!res.length)return {x:2,rot:0};
  res.sort((a,b)=>b.v-a.v);
  if(prm.depth>=2&&!res[0].fire){
    const beam=res.filter(r=>!r.fire).slice(0,prm.beam);
    let best=null;
    for(const r1 of beam){
      let b2=-1e9;
      for(let rot=0;rot<4;rot++){if(p2[0]===p2[1]&&rot>=2)continue;for(let x=0;x<COLS;x++){
        const g=aiPlace(r1.g,x,rot,p2[0],p2[1]);if(!g)continue;const r=aiResolve(g);
        let v;if(r.chain>0){const fv=aiFire(r,c);v=fv!=null?fv*.9:aiEval(g,{pot:0})-prm.waste*r.chain}else v=aiEval(g,prm);
        if(v>b2)b2=v;
        if(performance.now()-t0>5){yield;t0=performance.now()}
      }}
      const tot=Math.max(r1.v,b2)+Math.random()*prm.noise;
      if(!best||tot>best.tot)best={x:r1.x,rot:r1.rot,tot};
    }
    if(best&&(res[0].v<best.tot||true))return best;
  }
  if(Math.random()<prm.mistake)return res[(Math.random()*Math.min(res.length,8))|0];
  return res[0];
}

// ======================================================================
//  プレイヤー
// ======================================================================
function makePlayer(o){
  return Object.assign({f:new Int8Array(COLS*ROWS),hide:new Uint8Array(COLS*ROWS),bounce:new Float32Array(COLS*ROWS),
    piece:null,nextIdx:0,state:'ready',t:0,chain:0,score:0,shownScore:0,incoming:0,incomingWait:0,carry:0,allClear:false,
    anims:[],pop:null,in:{l:0,r:0,d:0,rl:0,rr:0},prev:{l:0,r:0,d:0,rl:0,rr:0},das:{dir:0,t:0},qt:-99,qtDir:0,
    exprOv:null,exprT:0,maxChain:0,shake:0,noticeBounce:0,cut:null,spell:null,ai:null,aiS:null,dead:false,deathT:0,pieces:0,lastChainShown:0},o);
}
const DAS=9,ARR=2,LOCK=30,SOFT=.55;
function spawnPiece(p){
  const pr=G.seq[p.nextIdx%G.seq.length];p.nextIdx++;p.pieces++;
  p.piece={x:2,y:1,rot:0,ca:pr[0],cb:pr[1],acc:0,lock:0,resets:0,born:G.t};
  p.state='control';
  if(p.cpu){p.aiS={gen:aiThink(p,G.players[1-p.side]),done:false,target:null,wait:p.ai.think,cd:0,tries:0}}
}
function pcCells(pc){return[[pc.x,pc.y,pc.ca],[pc.x+OX[pc.rot],pc.y+OY[pc.rot],pc.cb]]}
function pieceFits(f,x,y,rot){return freeAt(f,x,y)&&freeAt(f,x+OX[rot],y+OY[rot])}
function canFall(p){const pc=p.piece;return pieceFits(p.f,pc.x,pc.y+1,pc.rot)}
function tryMove(p,dir){const pc=p.piece;if(pieceFits(p.f,pc.x+dir,pc.y,pc.rot)){pc.x+=dir;if(pc.resets<10){pc.lock=0;pc.resets++}if(!p.cpu)sfx('move');return true}return false}
function rotate(p,dir){
  const pc=p.piece,f=p.f;const nr=(pc.rot+dir+4)%4;let nx=pc.x,ny=pc.y;
  if(pieceFits(f,nx,ny,nr)){}
  else if(nr===1||nr===3){
    const kx=nx-OX[nr];
    if(pieceFits(f,kx,ny,nr))nx=kx;
    else{
      if(G.t-p.qt<22&&p.qtDir===dir){ // クイックターン
        const fr=(pc.rot+2)%4;
        if(pieceFits(f,nx,ny,fr)){pc.rot=fr}else if(pieceFits(f,nx,ny-1,fr)){pc.y=ny-1;pc.rot=fr}else return false;
        p.qt=-99;if(!p.cpu)sfx('rot');return true;
      }
      p.qt=G.t;p.qtDir=dir;return false;
    }
  }else if(nr===2){if(pieceFits(f,nx,ny-1,nr))ny=ny-1;else return false}
  else return false;
  pc.x=nx;pc.y=ny;pc.rot=nr;if(pc.resets<10){pc.lock=0;pc.resets++}
  if(!p.cpu)sfx('rot');return true;
}
function control(p){
  const pc=p.piece,inp=p.in,pv=p.prev;
  if(inp.rr&&!pv.rr)rotate(p,1);
  if(inp.rl&&!pv.rl)rotate(p,-1);
  const dir=inp.l&&!inp.r?-1:inp.r&&!inp.l?1:0;
  if(dir){if(p.das.dir!==dir){p.das.dir=dir;p.das.t=0;tryMove(p,dir)}else{p.das.t++;if(p.das.t>=DAS&&(p.das.t-DAS)%ARR===0)tryMove(p,dir)}}else p.das.dir=0;
  const g=inp.d?SOFT:(!p.cpu&&cam()?p.speed*BODY.SLOW:p.speed);
  if(canFall(p)){pc.acc+=g;while(pc.acc>=1){if(canFall(p)){pc.y++;if(inp.d)p.score+=1}else{pc.acc=0;break}pc.acc-=1}pc.lock=0}
  else{pc.acc=0;pc.lock++;if((inp.d&&pc.lock>2)||pc.lock>=LOCK)lockPiece(p)}
  p.prev={l:inp.l,r:inp.r,d:inp.d,rl:inp.rl,rr:inp.rr};
}
function lockPiece(p){
  const pc=p.piece;
  for(const [x,y,c] of pcCells(pc)){if(y>=0)p.f[idx(x,y)]=c}
  p.lastPiece=pc;p.piece=null;
  startFall(p,'chain',pcCells(pc).filter(c=>c[1]>=0).map(c=>({x:c[0],y:c[1]+pc.acc*0,c:c[2]})));
  if(!p.cpu)sfx('land');
}
function startFall(p,next,seeds){
  // 重力で落とす。field は最終状態にし、動く粒はアニメーションで描く
  const f=p.f,anims=[];
  for(let x=0;x<COLS;x++){
    let w=ROWS-1;
    for(let y=ROWS-1;y>=0;y--){const v=f[idx(x,y)];if(!v)continue;
      if(w!==y){f[idx(x,w)]=v;f[idx(x,y)]=0;anims.push({x,y,ty:w,c:v,v:.12})}
      w--;}
  }
  if(seeds){for(const s of seeds){if(!anims.find(a=>a.x===s.x&&a.y===s.y)){const ty=s.y;p.bounce[idx(s.x,ty)]=1}}}
  for(const a of anims)p.hide[idx(a.x,a.ty)]=1;
  p.anims=anims;p.state='fall';p.afterFall=next;
}
function stepFall(p){
  let alive=false,landed=0;
  for(const a of p.anims){
    if(a.done)continue;
    if(a.delay>0){a.delay--;alive=true;continue}
    a.v=Math.min(.95,a.v+.045);a.y+=a.v;
    if(a.y>=a.ty){a.y=a.ty;a.done=true;p.hide[idx(a.x,a.ty)]=0;p.bounce[idx(a.x,a.ty)]=1;landed++}else alive=true;
  }
  if(landed)sfx(p.afterFall==='garbage'?'thud':'land');
  if(!alive){
    p.anims=[];
    if(p.afterFall==='garbage'){if(p.garbN>=12){G.shake=Math.max(G.shake,6+p.garbN/6);sfx('bigthud')}afterGarbage(p)}
    else checkChain(p);
  }
}
function checkChain(p){
  const groups=findGroups(p.f);
  if(!groups.length){chainEnd(p);return}
  p.chain++;
  const ls=linkScore(p.f,groups,p.chain);p.score+=ls.pts;
  // 演出
  let sx=0,sy=0,n=0;for(const g of groups)for(const i of g){sx+=i%COLS;sy+=(i/COLS)|0;n++}
  const gx=p.bx+(sx/n+.5)*CELL,gy=LAY.by+(sy/n-.5)*CELL;
  p.pop={groups,t:0,gx,gy};p.state='pop';
  p.maxChain=Math.max(p.maxChain,p.chain);
  const sp=CH[p.ch].spells;
  p.spell={text:sp[Math.min(p.chain,6)-1],t:0,n:p.chain};
  voice(p.ch,String(Math.min(p.chain,6)),p.side);
  addText(gx,gy,p.chain+'れんさ!',p.chain);
  if(p.chain>=4){p.cut={t:0,n:p.chain};sfx('cutin')}
  p.exprOv='happy';p.exprT=90;
  // 攻撃(おじゃま計算)
  if(G.mode==='vs'){
    const opp=G.players[1-p.side];
    const tot=ls.pts+p.carry;let g=Math.floor(tot/G.tp);p.carry=tot-g*G.tp;
    if(p.allClear){g+=30;p.allClear=false}
    if(g>0){
      let o=Math.min(g,p.incoming);p.incoming-=o;g-=o;let o2=Math.min(g,p.incomingWait);p.incomingWait-=o2;g-=o2;
      if(o+o2>0){shoot(p,gx,gy,p,'offset');sfx('offset')}
      if(g>0){opp.incomingWait+=g;shoot(p,gx,gy,opp,'send');sfx('send')}
    }
  }
}
function stepPop(p){
  const pp=p.pop;pp.t++;
  if(pp.t===26){
    const rm=removeGroups(p.f,pp.groups);
    sfx('pop',p.chain);
    for(const [i,c] of rm){const x=p.bx+(i%COLS+.5)*CELL,y=LAY.by+(((i/COLS)|0)-.5)*CELL;burst(x,y,c)}
    if(p.chain>=5){G.flash=Math.min(.5,.1*p.chain);G.shake=Math.max(G.shake,p.chain)}
  }
  if(pp.t>=32){p.pop=null;startFall(p,'chain')}
}
function chainEnd(p){
  if(p.chain>0){
    if(G.mode==='vs'){const opp=G.players[1-p.side];opp.incoming+=opp.incomingWait;opp.incomingWait=0;opp.noticeBounce=1}
    let empty=true;for(let i=COLS;i<COLS*ROWS;i++)if(p.f[i]){empty=false;break}
    if(empty){p.allClear=true;sfx('allclear');addText(p.bx+COLS*CELL/2,LAY.by+CELL*5,'ALL CLEAR!',99);if(G.mode==='toko')p.score+=2100}
    p.chain=0;
  }
  if(G.mode==='vs'&&p.incoming>0){dropGarbage(p)}else afterGarbage(p);
}
function dropGarbage(p){
  let n=Math.min(30,p.incoming);p.incoming-=n;p.garbN=n;
  const per=new Array(COLS).fill(Math.floor(n/6));let rem=n%6;
  const order=[0,1,2,3,4,5].sort(()=>Math.random()-.5);for(let i=0;i<rem;i++)per[order[i]]++;
  const anims=[];
  for(let x=0;x<COLS;x++){
    let ty=topEmpty(p.f,x);
    for(let j=0;j<per[x];j++){if(ty<0)break;p.f[idx(x,ty)]=GARB;p.hide[idx(x,ty)]=1;anims.push({x,y:-1.3-j*1.02-(x%2)*.25,ty,c:GARB,v:.25,delay:(x*3)%5});ty--}
  }
  if(n>=6&&p.ch){voice(p.ch,'hit',p.side);p.exprOv='pinch';p.exprT=70}
  p.anims=anims;p.state='fall';p.afterFall='garbage';
  if(!anims.length)afterGarbage(p);
}
function afterGarbage(p){
  if(p.f[idx(2,1)]){lose(p);return}
  p.state='spawn';p.t=G.mode==='toko'?4:6;
}
function lose(p){
  p.dead=true;p.state='dead';p.deathT=0;p.piece=null;sfx('lose');
  p.crumble=[];for(let i=0;i<COLS*ROWS;i++){const c=p.f[i];if(c&&((i/COLS)|0)>=1)p.crumble.push({x:i%COLS,y:(i/COLS)|0,c,vx:rand(-.06,.06),vy:rand(-.08,0),r:0,vr:rand(-.1,.1)})}
  p.f.fill(0);
  if(G.mode==='vs'){
    const w=G.players[1-p.side];G.winner=w;G.over=true;G.overT=0;
    voice(w.ch,'win',w.side);setTimeout(()=>voice(p.ch,'lose',p.side),900);
    bgmStop(.5);setTimeout(()=>jingle(w.side===0?'win':'lose'),500);
  }else{G.over=true;G.overT=0;bgmStop(.5);setTimeout(()=>jingle('lose'),400);voice('luka','lose',0)}
}
function updatePlayer(p){
  if(p.exprT>0){p.exprT--;if(!p.exprT)p.exprOv=null}
  for(let i=0;i<p.bounce.length;i++)if(p.bounce[i]>0)p.bounce[i]=Math.max(0,p.bounce[i]-.08);
  if(p.noticeBounce>0)p.noticeBounce=Math.max(0,p.noticeBounce-.06);
  if(p.spell){p.spell.t++;if(p.spell.t>80)p.spell=null}
  if(p.cut){p.cut.t++;if(p.cut.t>70)p.cut=null}
  p.shownScore+=Math.ceil((p.score-p.shownScore)*.2);
  if(p.dead){p.deathT++;for(const c of p.crumble){c.vy+=.012;c.y+=c.vy;c.x+=c.vx;c.r+=c.vr}return}
  if(G.over)return;
  switch(p.state){
    case 'spawn':if(--p.t<=0)spawnPiece(p);break;
    case 'control':
      if(p.cpu)cpuInput(p);else (cam()?bodyInput:humanInput)(p);
      control(p);break;
    case 'fall':stepFall(p);break;
    case 'pop':stepPop(p);break;
  }
}
function cpuInput(p){
  const s=p.aiS,pc=p.piece,inp=p.in;inp.l=inp.r=inp.rl=inp.rr=0;inp.d=0;
  if(!s)return;
  if(!s.done){const t0=performance.now();while(performance.now()-t0<6){const r=s.gen.next();if(r.done){s.done=true;s.target=r.value||{x:2,rot:0};break}}return}
  if(s.wait>0){s.wait--;return}
  if(s.cd>0){s.cd--;if(s.dropping&&p.ai.soft)inp.d=1;return}
  s.cd=p.ai.delay;const t=s.target;
  if(pc.rot!==t.rot&&s.tries<8){const d=(t.rot-pc.rot+4)%4;if(d===3)inp.rl=1;else inp.rr=1;s.tries++;return}
  if(pc.x!==t.x&&s.tries<20){if(pc.x<t.x)inp.r=1;else inp.l=1;s.tries++;p.das.dir=0;return}
  s.dropping=true;if(p.ai.soft)inp.d=1;
}

// ======================================================================
//  演出:テキスト・パーティクル・攻撃弾
// ======================================================================
const FX=[],TXT=[],SHOTS=[];
function burst(x,y,c){
  const B=BLOB[c];
  for(let i=0;i<7;i++){const a=rand(0,TAU),v=rand(1.2,3.6);FX.push({k:0,x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-1.5,r:rand(3,6),c:B.c,life:0,max:rand(26,40)})}
  for(let i=0;i<3;i++){const a=rand(0,TAU),v=rand(.5,2);FX.push({k:1,x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,r:rand(4,8),c:'#fff',life:0,max:rand(18,30),rot:rand(0,TAU)})}
  FX.push({k:2,x,y,r:CELL*.4,c:B.c,life:0,max:16});
}
function addText(x,y,s,n){TXT.push({x,y,s,n,t:0})}
function noticeXY(p){return[p.bx+COLS*CELL/2,LAY.by-20]}
function shoot(from,x,y,to,kind){const [tx,ty]=noticeXY(to);SHOTS.push({x0:x,y0:y,tx,ty,t:0,dur:kind==='offset'?26:34,c:CH[from.ch].rc,to,kind})}
function updFX(){
  for(let i=FX.length-1;i>=0;i--){const p=FX[i];p.life++;if(p.k!==2){p.x+=p.vx;p.y+=p.vy;p.vy+=p.k===0?.18:.02;p.vx*=.97}if(p.k===1)p.rot+=.1;if(p.life>=p.max)FX.splice(i,1)}
  for(let i=TXT.length-1;i>=0;i--){const t=TXT[i];t.t++;t.y-=.35;if(t.t>70)TXT.splice(i,1)}
  for(let i=SHOTS.length-1;i>=0;i--){const s=SHOTS[i];s.t++;if(s.t>=s.dur){s.to.noticeBounce=1;for(let k=0;k<10;k++){const a=rand(0,TAU);FX.push({k:1,x:s.tx,y:s.ty,vx:Math.cos(a)*2.5,vy:Math.sin(a)*2.5,r:rand(3,6),c:'#fff',life:0,max:20,rot:0})}SHOTS.splice(i,1)}}
}

// ======================================================================
//  ゲーム全体
// ======================================================================
const G={scene:'splash',t:0,st:0,paused:false,players:[],seq:[],mode:'vs',stage:0,over:false,overT:0,winner:null,tp:70,shake:0,flash:0,
  progress:store.get('stage',0),best:store.get('toko',{score:0,chain:0}),btnFx:{a:0,b:0},tapAny:null,loaded:0,loadTotal:1,matchT:0,pinch:false,clearAll:store.get('cleared',false)};
function makeSeq(n){
  const s=[];for(let i=0;i<n;i++){const k=i<2?3:4;s.push([1+((Math.random()*k)|0),1+((Math.random()*k)|0)])}return s;
}
function startMatch(stage){
  G.mode='vs';G.stage=stage;G.scene='match';G.over=false;G.overT=0;G.winner=null;G.matchT=0;G.tp=70;G.pinch=false;
  G.seq=makeSeq(256);FX.length=0;TXT.length=0;SHOTS.length=0;
  const st=STAGES[stage];
  const me=makePlayer({side:0,ch:'luka',cpu:DBG.cpuvs,bx:LAY.p1x,speed:1/40});
  if(DBG.cpuvs)me.ai=STAGES[3].ai;
  const op=makePlayer({side:1,ch:st.opp,cpu:true,ai:st.ai,bx:LAY.p2x,speed:1/40});
  G.players=[me,op];G.readyT=0;
  bgm(st.bgm,.4);
  voice('luka','start',0);setTimeout(()=>voice(st.opp,'start',1),1100);
}
function startToko(){
  G.mode='toko';G.scene='toko';G.over=false;G.overT=0;G.matchT=0;G.pinch=false;
  G.seq=makeSeq(512);FX.length=0;TXT.length=0;SHOTS.length=0;
  const me=makePlayer({side:0,ch:'luka',cpu:false,bx:LAY.solox,speed:1/40});
  G.players=[me];G.readyT=0;bgm('tokoton',.4);voice('luka','start',0);
}
function updateMatch(){
  if(G.paused)return;
  G.matchT++;
  for(const p of G.players)p.bx=G.mode==='toko'?LAY.solox:(p.side?LAY.p2x:LAY.p1x);
  if(G.readyT<110){G.readyT++;if(G.readyT===20)sfx('ready');if(G.readyT===90)sfx('go');if(G.readyT===110)for(const p of G.players){p.state='spawn';p.t=1}}
  // マージンタイム(長期戦でおじゃまが増える)
  if(G.mode==='vs'){const s=G.matchT/60;if(s>96){const k=Math.floor((s-96)/16)+1;G.tp=Math.max(1,Math.floor(70*Math.pow(.75,k)))}
    const sp=1/26+Math.min(1/26,G.matchT/60/180*(1/26));for(const p of G.players)p.speed=sp}
  else{const me=G.players[0];const lv=1+Math.floor(me.pieces/24);me.level=lv;me.speed=Math.min(.32,1/26*(1+.3*(lv-1)))}
  for(const p of G.players)updatePlayer(p);
  updFX();
  // ピンチ BGM
  const me=G.players[0];
  if(!G.over&&!me.dead){const h=heights(me.f),mx=Math.max(...h);
    const danger=mx>=10||h[2]>=9;const safe=mx<=7&&h[2]<=6;
    if(danger&&!G.pinch){G.pinch=true;const k=(G.mode==='toko'?'tokoton':STAGES[G.stage].bgm)+'_pinch';bgm(k,.5)}
    else if(safe&&G.pinch){G.pinch=false;bgm(G.mode==='toko'?'tokoton':STAGES[G.stage].bgm,.8)}}
  if(G.over){G.overT++;
    if(G.overT===200){
      if(G.mode==='toko'){const me=G.players[0];if(me.score>G.best.score||me.maxChain>G.best.chain){G.best={score:Math.max(me.score,G.best.score),chain:Math.max(me.maxChain,G.best.chain)};store.set('toko',G.best)}G.scene='tokoResult';G.st=0;sel=0}
      else if(G.winner.side===0){
        if(G.stage>=3){G.clearAll=true;store.set('cleared',true);store.set('stage',0);G.progress=0;G.scene='ending';G.st=0;jingle('clear')}
        else{G.progress=Math.max(G.progress,G.stage+1);store.set('stage',G.progress);G.scene='result';G.st=0;sel=0}
      }else{G.scene='continue';G.st=0;sel=0}
    }}
  if(G.shake>0)G.shake*=.88;if(G.shake<.3)G.shake=0;
}
function pause(){if((G.scene==='match'||G.scene==='toko')&&!G.paused){G.paused=true;sel=0;KB.l=KB.r=KB.d=KB.rl=KB.rr=0;TP.dir=0;TP.a=TP.b=0;pointers.clear();if(AU.ctx&&AU.ctx.state==='running')AU.ctx.suspend()}}
function resume(){G.paused=false;if(AU.ctx)AU.ctx.resume()}
function toTitle(){G.paused=false;if(AU.ctx&&AU.ctx.state==='suspended')AU.ctx.resume();G.scene='title';G.st=0;sel=0;G.players=[];bgm('title',.6)}
async function goVS(stage){
  G.scene='vs';G.st=0;G.vsStage=stage;G.vsReady=false;bgmStop(.4);sfx('cutin');
  const st=STAGES[stage];
  await Promise.all([loadBuf('bgm/'+st.bgm+'.ogg'),loadBuf('bgm/'+st.bgm+'_pinch.ogg')]);
  G.vsReady=true;
}
async function goToko(){
  G.scene='vs';G.st=0;G.vsStage=-1;G.vsReady=false;bgmStop(.4);
  await Promise.all([loadBuf('bgm/tokoton.ogg'),loadBuf('bgm/tokoton_pinch.ogg')]);G.vsReady=true;
}
async function loadInitial(){
  G.scene='loading';
  try{const r=await fetch('assets/bgm/manifest.json');AU.man=await r.json()}catch(e){AU.man={}}
  const list=['bgm/title.ogg','bgm/win.ogg','bgm/lose.ogg','bgm/clear.ogg'];
  for(const c of ['luka','mogu','miruru','devi','drana'])for(const k of ['1','2','3','4','5','6','win','lose','hit','start'])list.push('voice/'+c+'_'+k+'.ogg');
  G.loadTotal=list.length;G.loaded=0;
  await Promise.all(list.map(p=>loadBuf(p).then(()=>G.loaded++)));
  // 1面のBGMも先読み
  loadBuf('bgm/mogu.ogg');loadBuf('bgm/mogu_pinch.ogg');
  if(DBG.cpuvs){goVS(DBG.stage);return}
  toTitle();
}
function fullscreen(){
  if(!IS_TOUCH)return;const de=document.documentElement;
  try{const p=de.requestFullscreen&&de.requestFullscreen({navigationUI:'hide'});if(p&&p.then)p.then(()=>{try{screen.orientation.lock('landscape').catch(()=>{})}catch(_){}}).catch(()=>{})}catch(_){}
}

// ======================================================================
//  背景
// ======================================================================
const BGP={stars:[],clouds:[],embers:[],bats:[],flour:[],blobs:[]};
for(let i=0;i<70;i++)BGP.stars.push({x:Math.random(),y:Math.random()*.7,s:rand(.6,2),p:rand(0,TAU)});
for(let i=0;i<9;i++)BGP.clouds.push({x:Math.random()*1.4,y:rand(.05,.9),s:rand(.6,1.4),v:rand(.06,.18)});
for(let i=0;i<50;i++)BGP.embers.push({x:Math.random(),y:Math.random(),v:rand(.4,1.4),s:rand(1,3),p:rand(0,TAU)});
for(let i=0;i<6;i++)BGP.bats.push({x:Math.random()*1.3,y:rand(.08,.5),v:rand(.3,.7),p:rand(0,TAU),s:rand(.7,1.2)});
for(let i=0;i<40;i++)BGP.flour.push({x:Math.random(),y:Math.random(),v:rand(.1,.4),s:rand(1,2.6),p:rand(0,TAU)});
for(let i=0;i<14;i++)BGP.blobs.push({x:Math.random(),y:Math.random(),c:1+(i%4),s:rand(.6,1.6),v:rand(.1,.35),p:rand(0,TAU)});
function cloud(x,y,s,a){ctx.globalAlpha=a;ctx.fillStyle='#fff';ctx.beginPath();for(const [dx,dy,r] of [[0,0,28],[26,-10,24],[52,0,26],[24,8,26],[-20,6,18],[72,8,18]])ctx.moveTo(x+dx*s+r*s,y+dy*s),ctx.arc(x+dx*s,y+dy*s,r*s,0,TAU);ctx.fill();ctx.globalAlpha=1}
function drawBG(kind){
  const t=G.t,W=LW,H=540;
  let g;
  if(kind==='bakery'){
    g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#ffe6c4');g.addColorStop(.6,'#ffcf98');g.addColorStop(1,'#f3a86a');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    // 棚
    for(let k=0;k<3;k++){const y=90+k*120;ctx.fillStyle='rgba(160,90,40,.18)';ctx.fillRect(0,y,W,10);
      for(let x=((k*53)%90)-40;x<W;x+=90){ctx.fillStyle='rgba(190,110,50,.16)';ctx.beginPath();ctx.ellipse(x,y-14,28,14,0,0,TAU);ctx.fill();
        ctx.strokeStyle='rgba(150,80,30,.15)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-12,y-20);ctx.lineTo(x-6,y-10);ctx.moveTo(x,y-22);ctx.lineTo(x+6,y-12);ctx.moveTo(x+12,y-20);ctx.lineTo(x+16,y-12);ctx.stroke()}}
    // 床のチェック
    for(let y=440;y<H;y+=25)for(let x=0;x<W;x+=50){if(((x/50+(y-440)/25)|0)%2)continue;ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect(x,y,50,25)}
    for(const f of BGP.flour){const x=f.x*W+Math.sin(t*.01+f.p)*14,y=((f.y*H-t*f.v)%H+H)%H;ctx.fillStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.arc(x,y,f.s,0,TAU);ctx.fill()}
  }else if(kind==='sky'){
    g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#9fd8ff');g.addColorStop(.55,'#d7ecff');g.addColorStop(1,'#ffd6ee');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.lineWidth=14;['rgba(255,120,150,.12)','rgba(255,210,100,.12)','rgba(120,230,160,.12)','rgba(120,170,255,.12)'].forEach((c,i)=>{ctx.strokeStyle=c;ctx.beginPath();ctx.arc(W*.5,H*1.1,H*.95-i*14,Math.PI*1.08,Math.PI*1.92);ctx.stroke()});
    for(const c of BGP.clouds){const x=((c.x*W*1.2+t*c.v)%(W*1.4))-W*.2;cloud(x,c.y*H,c.s,.75)}
    for(const s of BGP.stars){const a=.5+.5*Math.sin(t*.05+s.p);ctx.fillStyle=`rgba(255,255,255,${a*.8})`;ctx.fillRect(s.x*W,s.y*H*1.2,s.s,s.s)}
  }else if(kind==='night'){
    g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#150b30');g.addColorStop(.6,'#2e1650');g.addColorStop(1,'#45205e');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    for(const s of BGP.stars){const a=.4+.6*Math.sin(t*.04+s.p);ctx.fillStyle=`rgba(255,240,255,${a})`;ctx.fillRect(s.x*W,s.y*H,s.s,s.s)}
    const mx=W*.82,my=90;const mg=ctx.createRadialGradient(mx,my,10,mx,my,90);mg.addColorStop(0,'rgba(255,250,220,.5)');mg.addColorStop(1,'rgba(255,250,220,0)');ctx.fillStyle=mg;ctx.fillRect(mx-90,my-90,180,180);
    ctx.fillStyle='#fff6d8';ctx.beginPath();ctx.arc(mx,my,34,0,TAU);ctx.fill();ctx.fillStyle='#2e1650';ctx.beginPath();ctx.arc(mx+14,my-8,30,0,TAU);ctx.fill();
    ctx.fillStyle='#1a0d30';
    const base=H-70;ctx.fillRect(0,base,W,70);
    for(let x=20;x<W;x+=150){ctx.fillRect(x,base-80,40,80);ctx.beginPath();ctx.moveTo(x-6,base-80);ctx.lineTo(x+20,base-120);ctx.lineTo(x+46,base-80);ctx.fill();ctx.fillRect(x+40,base-40,70,40);ctx.fillStyle='rgba(255,210,100,.5)';ctx.fillRect(x+16,base-60,8,12);ctx.fillStyle='#1a0d30'}
    for(const b of BGP.bats){const x=((b.x*W+t*b.v)%(W*1.3))-W*.15,y=b.y*H+Math.sin(t*.05+b.p)*12,w=Math.sin(t*.3+b.p)*8*b.s;ctx.fillStyle='rgba(20,8,36,.85)';ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x-10*b.s,y-6-w,x-18*b.s,y+w*.3);ctx.quadraticCurveTo(x-8*b.s,y+2,x,y+4);ctx.quadraticCurveTo(x+8*b.s,y+2,x+18*b.s,y+w*.3);ctx.quadraticCurveTo(x+10*b.s,y-6-w,x,y);ctx.fill()}
  }else if(kind==='crimson'){
    g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#1a0208');g.addColorStop(.6,'#4a0a1c');g.addColorStop(1,'#8a1a1a');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    const lg=ctx.createLinearGradient(0,H-120,0,H);lg.addColorStop(0,'rgba(255,90,30,0)');lg.addColorStop(1,`rgba(255,120,40,${.45+.1*Math.sin(t*.05)})`);ctx.fillStyle=lg;ctx.fillRect(0,H-120,W,120);
    ctx.fillStyle='rgba(20,0,6,.55)';for(let x=40;x<W;x+=200){ctx.fillRect(x,40,34,H);ctx.fillRect(x-8,40,50,16)}
    ctx.save();ctx.globalAlpha=.12;ctx.translate(W/2,H*.42);ctx.fillStyle='#ff4060';ctx.beginPath();ctx.moveTo(0,-90);for(let i=0;i<8;i++){const a=-Math.PI/2+(i+.5)*TAU/8,r=i%2?50:95;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r)}ctx.closePath();ctx.fill();ctx.restore();
    for(const e of BGP.embers){const x=e.x*W+Math.sin(t*.02+e.p)*20,y=((e.y*H-t*e.v)%H+H)%H;ctx.fillStyle=`rgba(255,${140+((e.p*40)|0)},60,${.5+.4*Math.sin(t*.1+e.p)})`;ctx.beginPath();ctx.arc(x,y,e.s,0,TAU);ctx.fill()}
  }else if(kind==='title'||kind==='toko'){
    g=ctx.createLinearGradient(0,0,W,H);
    if(kind==='title'){g.addColorStop(0,'#ffd6ec');g.addColorStop(.5,'#e3dcff');g.addColorStop(1,'#cdeeff')}else{g.addColorStop(0,'#1c1640');g.addColorStop(1,'#3a1e5e')}
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=kind==='title'?.07:.05;ctx.fillStyle=kind==='title'?'#8a5ad0':'#fff';
    for(let y=0;y<H;y+=36)for(let x=((y/36)%2)*18;x<W;x+=36){ctx.beginPath();ctx.arc(x+((t*.3)%36),y,4,0,TAU);ctx.fill()}
    ctx.globalAlpha=1;
    for(const b of BGP.blobs){const x=b.x*W+Math.sin(t*.01+b.p)*30,y=((b.y*H-t*b.v)%(H+80)+H+80)%(H+80)-40,s=CELL*b.s*1.2;ctx.globalAlpha=kind==='title'?.28:.22;ctx.drawImage(SPR[b.c].open,x,y,s,s);ctx.globalAlpha=1}
  }
}

// ======================================================================
//  描画ヘルパ
// ======================================================================
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function txt(s,x,y,size,fill,o){
  o=o||{};ctx.font=`${o.w||800} ${size}px ${FONT}`;ctx.textAlign=o.al||'center';ctx.textBaseline='middle';
  if(o.stroke){ctx.lineJoin='round';ctx.lineWidth=o.sw||size*.22;ctx.strokeStyle=o.stroke;ctx.strokeText(s,x,y)}
  ctx.fillStyle=fill;ctx.fillText(s,x,y);
}
function drawBlob(c,x,y,size,eyes,sq){
  const img=SPR[c][eyes||'open'];
  if(sq){const sy=1-sq*.22,sx=1+sq*.14;ctx.drawImage(img,x-(sx-1)*size/2,y+(1-sy)*size,size*sx,size*sy)}
  else ctx.drawImage(img,x,y,size,size);
}
function bridges(p,ox,oy){
  const f=p.f,h=CELL*.5;
  for(let y=1;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const i=idx(x,y),c=f[i];if(!c||c===GARB||p.hide[i])continue;
    const B=BLOB[c];ctx.fillStyle=B.c;
    if(x<COLS-1&&f[i+1]===c&&!p.hide[i+1]){const gy=oy+(y-1)*CELL+CELL*.3;const gr=ctx.createLinearGradient(0,gy,0,gy+h);gr.addColorStop(0,B.l);gr.addColorStop(.4,B.c);gr.addColorStop(1,B.d);ctx.fillStyle=gr;ctx.fillRect(ox+x*CELL+CELL*.5,gy,CELL,h)}
    if(y<ROWS-1&&f[i+COLS]===c&&!p.hide[i+COLS]){const gx=ox+x*CELL+CELL*.25;const gr=ctx.createLinearGradient(gx,0,gx+h,0);gr.addColorStop(0,B.l);gr.addColorStop(.45,B.c);gr.addColorStop(1,B.d);ctx.fillStyle=gr;ctx.fillRect(gx,oy+(y-1)*CELL+CELL*.55,h,CELL)}
  }
}
function blinkOf(i,t){return ((t+i*53)%260)<7}
function drawBoard(p){
  const ox=p.bx+(p.shake?rand(-1,1)*p.shake:0),oy=LAY.by,W=COLS*CELL,H=(ROWS-1)*CELL;
  const col=CH[p.ch].rc;
  // 枠
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,.25)';ctx.shadowBlur=14;rr(ox-8,oy-8,W+16,H+16,16);ctx.fillStyle=col;ctx.fill();ctx.shadowBlur=0;
  rr(ox-4,oy-4,W+8,H+8,12);ctx.fillStyle='#fff';ctx.fill();
  rr(ox,oy,W,H,9);const bg=ctx.createLinearGradient(0,oy,0,oy+H);bg.addColorStop(0,'rgba(30,20,60,.86)');bg.addColorStop(1,'rgba(50,30,80,.92)');ctx.fillStyle=bg;ctx.fill();
  ctx.restore();
  ctx.save();rr(ox,oy,W,H,9);ctx.clip();
  ctx.fillStyle='rgba(255,255,255,.035)';for(let y=0;y<ROWS-1;y++)for(let x=0;x<COLS;x++)if((x+y)%2)ctx.fillRect(ox+x*CELL,oy+y*CELL,CELL,CELL);
  // ×マーク
  if(!p.f[idx(2,1)]){ctx.strokeStyle='rgba(255,90,120,.55)';ctx.lineWidth=3;ctx.lineCap='round';const mx=ox+2.5*CELL,my=oy+.5*CELL;ctx.beginPath();ctx.moveTo(mx-7,my-7);ctx.lineTo(mx+7,my+7);ctx.moveTo(mx+7,my-7);ctx.lineTo(mx-7,my+7);ctx.stroke()}
  if(p.dead){
    for(const c of p.crumble){ctx.save();ctx.translate(ox+(c.x+.5)*CELL,oy+(c.y-.5)*CELL);ctx.rotate(c.r);drawBlob(c.c,-CELL/2,-CELL/2,CELL,'pop');ctx.restore()}
    ctx.restore();drawFrameTop(p,ox,oy);return;
  }
  bridges(p,ox,oy);
  const popSet=p.pop?new Set(p.pop.groups.flat()):null;
  for(let y=1;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const i=idx(x,y),c=p.f[i];if(!c||p.hide[i])continue;
    const px=ox+x*CELL,py=oy+(y-1)*CELL;
    if(popSet&&popSet.has(i)){const pt=p.pop.t;if(pt<26){if((pt>>2)%2===0){drawBlob(c,px,py,CELL,'pop');ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.55;drawBlob(c,px,py,CELL,'pop');ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'}else drawBlob(c,px,py,CELL,'pop')}continue}
    drawBlob(c,px,py,CELL,blinkOf(i,G.t)?'blink':'open',p.bounce[i]?Math.sin(p.bounce[i]*Math.PI):0);
  }
  for(const a of p.anims){if(a.y<-.9&&a.c!==GARB)continue;drawBlob(a.c,ox+a.x*CELL,oy+(a.y-1)*CELL,CELL,'open')}
  // 操作中のペア+着地ガイド
  const pc=p.piece;
  if(pc&&p.state==='control'){
    const cells=pcCells(pc);
    // ガイド
    const gs=[];const tmp=p.f.slice();
    const order=cells.slice().sort((a,b)=>b[1]-a[1]);
    for(const [x,y,c] of order){const ty=topEmpty(tmp,x);if(ty>=1){tmp[idx(x,ty)]=c;gs.push([x,ty,c])}}
    for(const [x,y,c] of gs){ctx.globalAlpha=.35+.15*Math.sin(G.t*.2);ctx.fillStyle=BLOB[c].c;ctx.beginPath();ctx.arc(ox+(x+.5)*CELL,oy+(y-.5)*CELL,CELL*.16,0,TAU);ctx.fill();ctx.globalAlpha=1}
    const fy=canFall(p)?pc.acc:0;
    for(const [x,y,c] of cells){if(y<0)continue;const isAxis=x===pc.x&&y===pc.y;const px=ox+x*CELL,py=oy+(y-1+fy)*CELL;
      if(isAxis){ctx.globalAlpha=.35+.25*Math.sin(G.t*.25);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(px+CELL/2,py+CELL/2,CELL*.56,0,TAU);ctx.fill();ctx.globalAlpha=1}
      drawBlob(c,px,py,CELL,'open')}
  }
  ctx.restore();
  drawFrameTop(p,ox,oy);
}
function drawFrameTop(p,ox,oy){
  // 13段目に出ている操作ペア(枠の上)
  const pc=p.piece;
  if(pc&&p.state==='control'){ctx.save();ctx.beginPath();ctx.rect(ox,oy-CELL,COLS*CELL,CELL);ctx.clip();for(const [x,y,c] of pcCells(pc)){if(y===0)drawBlob(c,ox+x*CELL,oy-CELL+(canFall(p)?pc.acc:0)*CELL,CELL,'open')}ctx.restore()}
}
// 予告(おじゃまのお知らせ)
const NOTE_UNITS=[[720,'comet'],[360,'crown'],[180,'moon'],[30,'star'],[6,'big'],[1,'small']];
function drawNotice(p){
  let n=p.incoming+p.incomingWait;if(n<=0)return;
  const icons=[];for(const [u,k] of NOTE_UNITS){while(n>=u&&icons.length<6){icons.push(k);n-=u}}
  const x0=p.bx+4,y=LAY.by-22,b=p.noticeBounce;
  icons.forEach((k,i)=>{const x=x0+i*33+16,yy=y-Math.sin(b*Math.PI)*8;
    ctx.save();ctx.translate(x,yy);
    if(k==='small'){drawBlob(GARB,-9,-9,18,'open')}
    else if(k==='big'){drawBlob(GARB,-14,-14,28,'open')}
    else{
      const c={star:'#ffd84a',moon:'#ffe9a0',crown:'#ffb02e',comet:'#ff6ad5'}[k];
      ctx.fillStyle=c;ctx.strokeStyle='#8a5a00';ctx.lineWidth=1.5;ctx.beginPath();
      if(k==='star'){for(let j=0;j<10;j++){const a=-Math.PI/2+j*Math.PI/5,r=j%2?6:14;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r)}}
      else if(k==='moon'){ctx.arc(0,0,13,.6,TAU-.6);ctx.arc(6,-1,10,TAU-.8,.8,true)}
      else if(k==='crown'){ctx.moveTo(-14,8);ctx.lineTo(-14,-6);ctx.lineTo(-7,2);ctx.lineTo(0,-10);ctx.lineTo(7,2);ctx.lineTo(14,-6);ctx.lineTo(14,8)}
      else{ctx.arc(4,0,9,0,TAU);ctx.moveTo(-4,-6);ctx.lineTo(-16,-3);ctx.lineTo(-4,2)}
      ctx.closePath();ctx.fill();ctx.stroke();
    }
    ctx.restore();
  });
}
function drawNext(p,x,y,flip){
  const s=G.seq,a=s[p.nextIdx%s.length],b=s[(p.nextIdx+1)%s.length];
  rr(x,y,44,84,10);ctx.fillStyle='rgba(255,255,255,.9)';ctx.fill();ctx.strokeStyle=CH[p.ch].rc;ctx.lineWidth=3;ctx.stroke();
  drawBlob(a[1],x+5,y+8,CELL,'open');drawBlob(a[0],x+5,y+8+CELL,CELL,'open');
  const x2=x+(flip?-34:50),y2=y+40;
  rr(x2,y2,30,58,8);ctx.fillStyle='rgba(255,255,255,.75)';ctx.fill();
  drawBlob(b[1],x2+3,y2+5,24,'open');drawBlob(b[0],x2+3,y2+29,24,'open');
  txt('NEXT',x+22,y-10,11,'#fff',{stroke:'rgba(40,20,60,.6)',sw:3});
}
function exprOf(p){
  if(G.over&&G.winner===p)return 'happy';
  if(p.dead)return 'pinch';
  if(p.exprOv)return p.exprOv;
  const h=heights(p.f);if(Math.max(...h)>=10||p.incoming+p.incomingWait>=18)return 'pinch';
  return 'normal';
}
function drawPortrait(ch,expr,x,y,w,flip,bob){
  const img=PORT[ch][expr];if(!img.complete)return;
  const h=w*1.2;ctx.save();ctx.translate(x,y+(bob||0));if(flip)ctx.scale(-1,1);ctx.drawImage(img,-w/2,-h/2,w,h);ctx.restore();
}
function drawSpell(p){
  const s=p.spell;if(!s)return;
  const t=s.t,a=t<6?t/6:t>64?(80-t)/16:1,sc=t<8?easeBack(t/8):1;
  const x=p.bx+COLS*CELL/2,y=LAY.by+CELL*2.2;
  ctx.save();ctx.globalAlpha=clamp(a,0,1);ctx.translate(x,y);ctx.scale(sc,sc);
  const size=s.n>=5?26:s.n>=3?23:20;
  txt(s.text,0,0,size,'#fff',{stroke:CH[p.ch].rc,sw:7});
  ctx.restore();
}
function drawCut(p){
  const c=p.cut;if(!c)return;const t=c.t;
  const x=p.bx-10,w=COLS*CELL+20,y=LAY.by+CELL*5;
  const k=t<10?ease(t/10):t>58?1-ease((t-58)/12):1;
  ctx.save();ctx.beginPath();ctx.rect(x,y-60,w,120);ctx.clip();
  ctx.globalAlpha=.92*k;
  const g=ctx.createLinearGradient(x,0,x+w,0);g.addColorStop(0,CH[p.ch].rc);g.addColorStop(1,'#ffffff');ctx.fillStyle=g;
  ctx.beginPath();ctx.moveTo(x,y-46*k);ctx.lineTo(x+w,y-58*k);ctx.lineTo(x+w,y+46*k);ctx.lineTo(x,y+58*k);ctx.closePath();ctx.fill();
  ctx.globalAlpha=k*.6;ctx.strokeStyle='#fff';ctx.lineWidth=2;for(let i=0;i<6;i++){const ly=y-40+i*16,ox=((t*14+i*40)%(w+80))-40;ctx.beginPath();ctx.moveTo(x+ox,ly);ctx.lineTo(x+ox+50,ly);ctx.stroke()}
  ctx.globalAlpha=1;
  drawPortrait(p.ch,'happy',x+w*(p.side?0.72:0.28)+(1-k)*(p.side?80:-80),y+8,100,p.side===1);
  txt(c.n+'れんさ!!',x+w*(p.side?0.3:0.7),y-14,22,'#fff',{stroke:'#3a1850',sw:6});
  ctx.restore();
}
function drawFX(){
  for(const p of FX){const t=p.life/p.max;
    if(p.k===0){ctx.globalAlpha=1-t;ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,p.r*(1-t*.5),0,TAU);ctx.fill()}
    else if(p.k===1){ctx.globalAlpha=1-t;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.fillStyle=p.c;ctx.beginPath();for(let j=0;j<8;j++){const a=j*Math.PI/4,r=j%2?p.r*.3:p.r;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r)}ctx.fill();ctx.restore()}
    else{ctx.globalAlpha=(1-t)*.8;ctx.strokeStyle=p.c;ctx.lineWidth=4*(1-t)+1;ctx.beginPath();ctx.arc(p.x,p.y,p.r+t*24,0,TAU);ctx.stroke()}}
  ctx.globalAlpha=1;
  for(const s of SHOTS){const t=ease(s.t/s.dur),mx=(s.x0+s.tx)/2,my=Math.min(s.y0,s.ty)-120;
    const x=(1-t)*(1-t)*s.x0+2*(1-t)*t*mx+t*t*s.tx,y=(1-t)*(1-t)*s.y0+2*(1-t)*t*my+t*t*s.ty;
    for(let k=0;k<6;k++){const tt=Math.max(0,t-k*.03),xx=(1-tt)*(1-tt)*s.x0+2*(1-tt)*tt*mx+tt*tt*s.tx,yy=(1-tt)*(1-tt)*s.y0+2*(1-tt)*tt*my+tt*tt*s.ty;ctx.globalAlpha=.5-k*.08;ctx.fillStyle=s.c;ctx.beginPath();ctx.arc(xx,yy,10-k,0,TAU);ctx.fill()}
    ctx.globalAlpha=1;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,7,0,TAU);ctx.fill()}
  for(const t of TXT){const k=t.t<10?easeBack(t.t/10):1,a=t.t>55?(70-t.t)/15:1;ctx.save();ctx.globalAlpha=clamp(a,0,1);ctx.translate(t.x,t.y);ctx.scale(k,k);
    const big=t.n===99;const col=big?'#ffe14a':['#fff','#fff','#ffe86a','#ffb0e0','#a0f0ff','#ffd04a','#ff8ad8'][Math.min(6,t.n)];
    txt(t.s,0,0,big?24:18+Math.min(10,t.n*1.5),col,{stroke:'#2a1840',sw:6});ctx.restore()}
}
function drawTouch(){
  if(!usingTouch)return;
  const lm=LAY.lm,py=LAY.padY,R=LAY.padR;
  ctx.globalAlpha=.85;
  ctx.fillStyle='rgba(255,255,255,.22)';ctx.beginPath();ctx.arc(lm,py,R+16,0,TAU);ctx.fill();
  const arm=(ang,on)=>{ctx.save();ctx.translate(lm,py);ctx.rotate(ang);rr(R*.18,-R*.32,R*.86,R*.64,10);ctx.fillStyle=on?'#ff8fc8':'rgba(255,255,255,.9)';ctx.fill();ctx.strokeStyle='rgba(80,40,110,.5)';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle=on?'#fff':'#7a4fb0';ctx.beginPath();ctx.moveTo(R*.86,0);ctx.lineTo(R*.6,-R*.18);ctx.lineTo(R*.6,R*.18);ctx.closePath();ctx.fill();ctx.restore()};
  arm(Math.PI,TP.dir===1);arm(0,TP.dir===2);arm(Math.PI/2,TP.dir===3);
  ctx.save();ctx.translate(lm,py);ctx.rotate(-Math.PI/2);rr(R*.18,-R*.32,R*.86,R*.64,10);ctx.fillStyle='rgba(255,255,255,.35)';ctx.fill();ctx.restore();
  ctx.fillStyle='rgba(255,255,255,.95)';ctx.beginPath();ctx.arc(lm,py,R*.3,0,TAU);ctx.fill();
  for(const [k,x,y,label,c] of [['b',LAY.bBx,LAY.bBy,'↺','#5aa0ff'],['a',LAY.bAx,LAY.bAy,'↻','#ff6f86']]){
    const on=TP[k];const r=LAY.btnR*(on?.94:1);
    ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.arc(x,y+4,r,0,TAU);ctx.fill();
    const g=ctx.createRadialGradient(x-r*.3,y-r*.4,r*.1,x,y,r);g.addColorStop(0,'#fff');g.addColorStop(.35,c);g.addColorStop(1,on?'#7a2a5a':'#3a2a6a');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y+(on?3:0),r,0,TAU);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();
    txt(label,x,y+(on?3:0)+1,r*.95,'#fff',{stroke:'rgba(40,20,60,.5)',sw:4});
  }
  ctx.globalAlpha=1;
}
function layoutControls(){
  const lmW=LAY.p1x,rmW=LW-(LAY.p2x+COLS*CELL);
  LAY.padR=clamp(lmW*.36,52,82);LAY.lm=lmW/2;LAY.padY=540-LAY.padR-58;
  LAY.btnR=clamp(rmW*.2,30,44);
  const rc=LW-rmW/2;LAY.bAx=rc+LAY.btnR*.85;LAY.bAy=540-LAY.btnR-96;LAY.bBx=rc-LAY.btnR*.85;LAY.bBy=540-LAY.btnR-36;
  if(G.mode==='toko'&&(G.scene==='toko')){LAY.lm=LAY.solox/2;LAY.padR=clamp(LAY.solox*.3,52,86);LAY.padY=540-LAY.padR-58;const rx=LAY.solox+COLS*CELL,rm=LW-rx;const rc2=LW-rm*.32;LAY.bAx=rc2+LAY.btnR*.85;LAY.bBx=rc2-LAY.btnR*.85}
}
function drawMatch(){
  const st=G.mode==='vs'?STAGES[G.stage]:null;
  drawBG(st?st.bg:'toko');
  layoutControls();
  ctx.save();if(G.shake)ctx.translate(rand(-1,1)*G.shake,rand(-1,1)*G.shake);
  const cx=LAY.cx;
  if(G.mode==='vs'){
    const [a,b]=G.players;
    // 中央パネル
    rr(cx-92,LAY.by-8,184,420,18);ctx.fillStyle='rgba(255,255,255,.28)';ctx.fill();
    drawNext(a,cx-88,LAY.by+14,false);drawNext(b,cx+44,LAY.by+14,true);
    const bob=Math.sin(G.t*.06)*2;
    drawPortrait(a.ch,exprOf(a),cx-44,LAY.by+252,92,false,bob);drawPortrait(b.ch,exprOf(b),cx+44,LAY.by+252,92,true,-bob);
    txt(CH[a.ch].name,cx-44,LAY.by+322,14,'#fff',{stroke:CH[a.ch].rc,sw:5});txt(CH[b.ch].name,cx+44,LAY.by+322,14,'#fff',{stroke:CH[b.ch].rc,sw:5});
    txt('VS',cx,LAY.by+200,22,'#fff',{stroke:'#ff5fa2',sw:6});
    txt('STAGE '+(G.stage+1),cx,LAY.by+356,13,'#fff',{stroke:'rgba(40,20,60,.6)',sw:4});
    for(const p of G.players){drawBoard(p);drawHands(p);drawNotice(p);
      txt(String(p.shownScore).padStart(8,'0'),p.bx+COLS*CELL/2,LAY.by+(ROWS-1)*CELL+26,20,'#fff',{stroke:'rgba(40,20,60,.75)',sw:5});}
  }else{
    const p=G.players[0];
    drawBoard(p);drawHands(p);
    const rx=p.bx+COLS*CELL+22;
    drawNext(p,rx,LAY.by+14,false);
    drawPortrait('luka',exprOf(p),p.bx-84,LAY.by+96,108,false,Math.sin(G.t*.06)*2);
    const info=[['SCORE',String(p.shownScore).padStart(8,'0')],['れんさ最高',p.maxChain+'れんさ'],['レベル','Lv.'+(p.level||1)],['ベスト',String(G.best.score).padStart(8,'0')]];
    info.forEach(([k,v],i)=>{const y=LAY.by+132+i*58;txt(k,rx,y,12,'#ffd6f0',{al:'left',stroke:'rgba(40,20,60,.6)',sw:3});txt(v,rx,y+22,18,'#fff',{al:'left',stroke:'rgba(40,20,60,.75)',sw:5})});
  }
  for(const p of G.players){drawSpell(p);drawCut(p)}
  drawFX();
  ctx.restore();
  // READY GO
  if(G.readyT<110){const t=G.readyT;const s=t<90?'READY?':'GO!';const k=t<90?easeBack(Math.min(1,(t-10)/14)):easeBack((t-90)/10);
    if(t>10){ctx.save();ctx.translate(cx,270);ctx.scale(k,k);txt(s,0,0,44,'#fff',{stroke:'#ff5fa2',sw:10});ctx.restore()}}
  if(G.over&&G.overT>30){
    const k=easeBack(Math.min(1,(G.overT-30)/16));ctx.save();ctx.translate(cx,250);ctx.scale(k,k);
    const win=G.mode==='vs'&&G.winner.side===0;
    txt(G.mode==='toko'?'GAME OVER':win?'YOU WIN!':'YOU LOSE…',0,0,46,win?'#ffe14a':'#ffffff',{stroke:win?'#ff5fa2':'#5a3a8a',sw:11});ctx.restore()}
  // 一時停止ボタン
  ctx.globalAlpha=.85;ctx.fillStyle='rgba(255,255,255,.85)';ctx.beginPath();ctx.arc(cx,22,16,0,TAU);ctx.fill();ctx.fillStyle='#7a4fb0';ctx.fillRect(cx-6,14,4,16);ctx.fillRect(cx+2,14,4,16);ctx.globalAlpha=1;
  drawTouch();
  if(!usingTouch&&G.matchT<600){ctx.globalAlpha=Math.min(1,(600-G.matchT)/60)*.9;txt('← → 移動 / ↓ 落下 / Z・X 回転 / P 一時停止',cx,530,12,'#fff',{stroke:'rgba(40,20,60,.6)',sw:4});ctx.globalAlpha=1}
  if(G.flash>0){ctx.fillStyle=`rgba(255,255,255,${G.flash})`;ctx.fillRect(0,0,LW,540);G.flash*=.85;if(G.flash<.02)G.flash=0}
  if(G.paused)drawPause();
}
function button(x,y,w,h,label,fn,o){
  o=o||{};const nav=BTN.filter(b=>!b.noNav).length;const b={x,y,w,h,fn,noNav:o.noNav};BTN.push(b);
  const isSel=!o.noNav&&nav===sel;
  ctx.save();
  ctx.fillStyle='rgba(60,30,100,.25)';rr(x,y+5,w,h,h/2);ctx.fill();
  const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,isSel?'#ffffff':'#fff6fb');g.addColorStop(1,isSel?'#ffd6ec':'#f2e6ff');
  rr(x,y,w,h,h/2);ctx.fillStyle=g;ctx.fill();ctx.lineWidth=isSel?4:2.5;ctx.strokeStyle=isSel?'#ff5fa2':(o.col||'#b08ae0');ctx.stroke();
  if(isSel){ctx.fillStyle='#ff5fa2';ctx.beginPath();const ax=x+18+Math.sin(G.t*.2)*3;ctx.moveTo(ax,y+h/2-7);ctx.lineTo(ax+10,y+h/2);ctx.lineTo(ax,y+h/2+7);ctx.fill()}
  txt(label,x+w/2,y+h/2+1,o.size||18,'#4a2a70');
  if(o.sub)txt(o.sub,x+w/2,y+h+14,11,'#6a4a90',{w:500});
  ctx.restore();
}
function drawPause(){
  ctx.fillStyle='rgba(30,15,50,.6)';ctx.fillRect(0,0,LW,540);
  txt('ひとやすみ',LAY.cx,150,34,'#fff',{stroke:'#ff5fa2',sw:9});
  button(LAY.cx-120,200,240,50,'つづける',resume);
  button(LAY.cx-120,262,240,50,soundOn?'おと:ON':'おと:OFF',()=>setSound(!soundOn));
  button(LAY.cx-120,324,240,50,'タイトルへ',toTitle);
}
function drawLogo(x,y,s){
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);
  const t=G.t;const word='ぷるもち';
  ctx.font=`800 74px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';
  const cols=['#ff6f86','#5fe08a','#5aa0ff','#ffd84a'];
  let w=0;const ws=[];for(const ch of word){const m=ctx.measureText(ch).width;ws.push(m);w+=m}
  let cx=-w/2-46;
  [...word].forEach((ch,i)=>{const bx=cx+ws[i]/2,by=Math.sin(t*.07+i*.8)*5;
    ctx.lineJoin='round';ctx.lineWidth=18;ctx.strokeStyle='#4a2a70';ctx.strokeText(ch,bx,by);ctx.lineWidth=10;ctx.strokeStyle='#fff';ctx.strokeText(ch,bx,by);ctx.fillStyle=cols[i];ctx.fillText(ch,bx,by);cx+=ws[i]});
  ctx.font=`800 46px ${FONT}`;
  ctx.lineWidth=14;ctx.strokeStyle='#4a2a70';ctx.strokeText('☆',cx+28,-4);ctx.fillStyle='#ffe14a';ctx.fillText('☆',cx+28,-4);
  ctx.font=`800 56px ${FONT}`;const bx2=0,by2=64;
  ctx.lineWidth=16;ctx.strokeStyle='#4a2a70';ctx.strokeText('バトル',bx2,by2);ctx.lineWidth=8;ctx.strokeStyle='#fff';ctx.strokeText('バトル',bx2,by2);
  const g=ctx.createLinearGradient(0,by2-26,0,by2+26);g.addColorStop(0,'#ff8fc8');g.addColorStop(1,'#b05aff');ctx.fillStyle=g;ctx.fillText('バトル',bx2,by2);
  ctx.restore();
}
function drawTitle(){
  drawBG('title');
  const cx=LAY.cx;
  // キャラクター並び
  const side=Math.min(300,LW/2-150);
  drawPortrait('luka','happy',cx-side,350+Math.sin(G.t*.05)*4,200,false);
  [['mogu',-60,300],['miruru',60,290],['devi',-60,430],['drana',60,420]].forEach(([id,dx,y],i)=>drawPortrait(id,'normal',cx+side+dx,y+Math.sin(G.t*.05+i+1)*3,112,true));
  drawLogo(cx,120,1);
  const hasCont=G.progress>0;
  let y=230;
  button(cx-130,y,260,46,'ストーリー',()=>{store.set('stage',0);G.progress=0;goVS(0)});y+=56;
  if(hasCont){button(cx-130,y,260,46,'つづきから(STAGE '+(G.progress+1)+')',()=>goVS(G.progress),{size:16});y+=56}
  button(cx-130,y,260,46,'とことんモード',()=>goToko());y+=56;
  button(cx-130,y,124,38,'クレジット',()=>{G.scene='credits';G.st=0;sel=0},{size:14});
  button(cx+6,y,124,38,soundOn?'おと:ON':'おと:OFF',()=>{audioInit();setSound(!soundOn)},{size:14});
}
function drawVS(){
  const st=G.vsStage>=0?STAGES[G.vsStage]:null;
  drawBG(st?st.bg:'toko');
  const t=G.st,cx=LAY.cx;
  ctx.fillStyle='rgba(20,10,40,.35)';ctx.fillRect(0,0,LW,540);
  const k=ease(t/24);
  if(st){
    ctx.save();ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(cx+40,0);ctx.lineTo(cx-40,540);ctx.lineTo(0,540);ctx.closePath();ctx.fillStyle=CH.luka.rc;ctx.globalAlpha=.55;ctx.fill();ctx.restore();
    ctx.save();ctx.beginPath();ctx.moveTo(LW,0);ctx.lineTo(cx+40,0);ctx.lineTo(cx-40,540);ctx.lineTo(LW,540);ctx.closePath();ctx.fillStyle=CH[st.opp].rc;ctx.globalAlpha=.55;ctx.fill();ctx.restore();
    drawPortrait('luka','normal',lerp(-200,cx-200,k),290,260,false);
    drawPortrait(st.opp,'normal',lerp(LW+200,cx+200,k),290,260,true);
    const vk=easeBack(clamp((t-20)/14,0,1));ctx.save();ctx.translate(cx,260);ctx.scale(vk,vk);txt('VS',0,0,80,'#fff',{stroke:'#ff5fa2',sw:14});ctx.restore();
    txt('STAGE '+(G.vsStage+1),cx,60,26,'#fff',{stroke:'#4a2a70',sw:8});
    txt(st.title,cx,96,18,'#ffe14a',{stroke:'#4a2a70',sw:6});
    txt(CH.luka.name,cx-200,480,30,'#fff',{stroke:CH.luka.rc,sw:9});txt(CH[st.opp].name,cx+200,480,30,'#fff',{stroke:CH[st.opp].rc,sw:9});
  }else{
    drawPortrait('luka','happy',cx,300,240,false);
    txt('とことんモード',cx,90,40,'#fff',{stroke:'#ff5fa2',sw:10});
    txt('どこまで連鎖できるかな?',cx,140,18,'#ffe14a',{stroke:'#4a2a70',sw:6});
  }
  if(G.vsReady&&t>70){if(G.vsStage>=0)startMatch(G.vsStage);else startToko()}
  else if(t>70&&G.t%40<26)txt('よみこみちゅう…',cx,520,14,'#fff',{stroke:'#4a2a70',sw:4});
}
function drawResult(){
  drawBG(STAGES[G.stage].bg);ctx.fillStyle='rgba(20,10,40,.45)';ctx.fillRect(0,0,LW,540);
  const cx=LAY.cx,k=easeBack(Math.min(1,G.st/20));
  drawPortrait('luka','happy',cx-170,300,230,false,Math.sin(G.t*.08)*4);
  drawPortrait(STAGES[G.stage].opp,'pinch',cx+190,320,190,true);
  ctx.save();ctx.translate(cx,110);ctx.scale(k,k);txt('STAGE '+(G.stage+1)+' クリア!',0,0,42,'#ffe14a',{stroke:'#ff5fa2',sw:11});ctx.restore();
  const me=G.players[0];
  if(me){txt('スコア  '+me.score,cx,180,20,'#fff',{stroke:'#4a2a70',sw:6});txt('さいだい '+me.maxChain+' れんさ',cx,212,20,'#fff',{stroke:'#4a2a70',sw:6})}
  if(G.st>40){button(cx-120,300,240,50,'つぎのステージへ',()=>goVS(G.stage+1));button(cx-120,362,240,46,'タイトルへ',toTitle,{size:16})}
}
function drawContinue(){
  drawBG(STAGES[G.stage].bg);ctx.fillStyle='rgba(20,10,40,.6)';ctx.fillRect(0,0,LW,540);
  const cx=LAY.cx;
  drawPortrait('luka','pinch',cx-190,320,200,false);
  drawPortrait(STAGES[G.stage].opp,'happy',cx+190,310,220,true,Math.sin(G.t*.08)*4);
  txt('まけちゃった…',cx,110,40,'#fff',{stroke:'#5a3a8a',sw:10});
  txt('もういちど ちょうせんする?',cx,160,18,'#ffd6f0',{stroke:'#4a2a70',sw:5});
  if(G.st>30){button(cx-120,230,240,52,'もういちど!',()=>goVS(G.stage));button(cx-120,296,240,46,'タイトルへ',toTitle,{size:16})}
}
function drawTokoResult(){
  drawBG('toko');ctx.fillStyle='rgba(20,10,40,.4)';ctx.fillRect(0,0,LW,540);
  const cx=LAY.cx,me=G.players[0];
  txt('とことんモード けっか',cx,90,34,'#fff',{stroke:'#ff5fa2',sw:9});
  if(me){txt('スコア  '+me.score,cx,160,24,'#fff',{stroke:'#4a2a70',sw:6});txt('さいだい '+me.maxChain+' れんさ',cx,200,24,'#fff',{stroke:'#4a2a70',sw:6})}
  txt('ベスト  '+G.best.score+' / '+G.best.chain+'れんさ',cx,244,16,'#ffe14a',{stroke:'#4a2a70',sw:5});
  drawPortrait('luka',me&&me.maxChain>=4?'happy':'normal',cx-260,330,180,false);
  if(G.st>30){button(cx-120,290,240,50,'もういちど!',()=>goToko());button(cx-120,352,240,46,'タイトルへ',toTitle,{size:16})}
}
function drawEnding(){
  drawBG('title');
  const cx=LAY.cx,t=G.st;
  ['mogu','miruru','luka','devi','drana'].forEach((id,i)=>{const off=i-2;drawPortrait(id,'happy',cx+off*160,330+Math.abs(off)*12+Math.sin(G.t*.07+i)*5,off===0?190:140,off>0)});
  const k=easeBack(Math.min(1,t/24));ctx.save();ctx.translate(cx,90);ctx.scale(k,k);txt('ぜんステージ クリア!',0,0,44,'#ffe14a',{stroke:'#ff5fa2',sw:11});ctx.restore();
  txt('おめでとう! ルカは ぷるもちマスターになった!',cx,150,18,'#4a2a70',{stroke:'#fff',sw:6});
  if(t>120){if(G.t%60<42)txt(usingTouch?'タップでタイトルへ':'Enter でタイトルへ',cx,515,16,'#4a2a70',{stroke:'#fff',sw:5});G.tapAny=()=>{G.tapAny=null;toTitle()}}
}
function drawCredits(){
  drawBG('title');ctx.fillStyle='rgba(255,255,255,.5)';rr(LAY.cx-300,40,600,440,24);ctx.fill();
  const cx=LAY.cx;txt('クレジット',cx,80,30,'#4a2a70',{stroke:'#fff',sw:6});
  const lines=['ゲーム・キャラクター・音楽:オリジナル制作','','キャラクターボイス',...VOICE_CREDIT,'','音源:GeneralUser GS (S. Christian Collins)','レンダリング:FluidSynth','','© 2026 hiroism'];
  lines.forEach((l,i)=>txt(l,cx,124+i*24,l.startsWith('VOICEVOX')?15:16,'#4a2a70',{w:l.startsWith('VOICEVOX')?500:800}));
  button(cx-90,430,180,42,'もどる',toTitle,{size:16});
}
function drawLoading(){
  drawBG('title');const cx=LAY.cx;drawLogo(cx,170,.9);
  const k=G.loaded/G.loadTotal;rr(cx-160,330,320,18,9);ctx.fillStyle='rgba(255,255,255,.7)';ctx.fill();rr(cx-160,330,320*k,18,9);ctx.fillStyle='#ff8fc8';ctx.fill();
  txt('よみこみちゅう… '+Math.round(k*100)+'%',cx,372,16,'#4a2a70',{stroke:'#fff',sw:4});
}
function drawSplash(){
  drawBG('title');const cx=LAY.cx;drawLogo(cx,190,1);
  if(G.t%60<44)txt(IS_TOUCH?'タップしてスタート':'クリック または Enter でスタート',cx,380,22,'#4a2a70',{stroke:'#fff',sw:6});
  txt('音が出ます 🔊',cx,420,14,'#6a4a90',{w:500});
  G.tapAny=()=>{G.tapAny=null;audioInit();fullscreen();loadInitial()};
}

// ======================================================================
//  メインループ
// ======================================================================
const STEP=1000/60;let acc=0,last=performance.now();
function update(){
  G.t++;G.st++;
  if(IS_TOUCH&&innerHeight>innerWidth&&(G.scene==='match'||G.scene==='toko'))pause();
  if(G.scene==='match'||G.scene==='toko')updateMatch();
  else updFX();
  for(const k of ['a','b'])if(G.btnFx[k]>0)G.btnFx[k]-=.1;
}
function render(){
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#2a1840';ctx.fillRect(0,0,cv.width,cv.height);
  ctx.setTransform(S,0,0,S,0,OY_*S);
  BTN=[];if(G.scene!=='ending'&&G.scene!=='splash')G.tapAny=null;
  switch(G.scene){
    case 'splash':drawSplash();break;
    case 'loading':drawLoading();break;
    case 'title':drawTitle();break;
    case 'vs':drawVS();break;
    case 'match':case 'toko':drawMatch();break;
    case 'result':drawResult();break;
    case 'continue':drawContinue();break;
    case 'tokoResult':drawTokoResult();break;
    case 'ending':drawEnding();break;
    case 'credits':drawCredits();break;
  }
  const n=BTN.filter(b=>!b.noNav).length;if(n&&sel>=n)sel=n-1;
}
function frame(now){
  requestAnimationFrame(frame);
  let dt=now-last;last=now;if(dt>250)dt=250;acc+=dt*DBG.fast;
  let n=0;while(acc>=STEP&&n<8){update();acc-=STEP;n++}if(n>=8)acc=0;
  render();
}
resize();
const go=()=>requestAnimationFrame(t=>{last=t;frame(t)});
if(document.fonts&&document.fonts.load)Promise.race([document.fonts.load(`800 20px "M PLUS Rounded 1c"`),new Promise(r=>setTimeout(r,1500))]).then(go,go);else go();
// ======================================================================
//  ぜんしん版：りょう手で つかんで うごかす／ハンドルのように かたむけて まわす／りょう手を 大きく ひろげて おとす
// ======================================================================
const BODY={
  COL0:.3,COL1:.7,   // りょう手のまん中が 画面の ここ〜ここ にあるとき、左はし〜右はしの列
  ROT:30,            // りょう手を結んだ線が これ（度）より かたむいたら 1回まわす
  ROT_BACK:12,       // これより 水平にもどすと 次の回転を受けつける
  WIDE:2.8,          // りょう手の間が これより はなれたら（大きく ひろげたら）下に おとす。肩はば単位
  GAP_MIN:.5,        // りょう手の間が これより はなれていると「つかんでいる」
  SLOW:.5            // 落ちる速さの倍率（体は指より おそい）
};
const bz={col:2,armed:true,grab:false};
function cam(){return typeof Body!=='undefined'&&Body.mode==='cam'}
function bodyInput(p){
  const inp=p.in;inp.l=inp.r=inp.d=inp.rl=inp.rr=0;
  bz.grab=Body.ok&&Body.both&&Body.gap>BODY.GAP_MIN;
  if(!bz.grab||p.state!=='control'||!p.piece){bz.armed=true;return}
  const pc=p.piece,fc=clamp((Body.gx-BODY.COL0)/(BODY.COL1-BODY.COL0),0,1)*(COLS-1);
  if(Math.abs(fc-bz.col)>.65)bz.col=Math.round(fc);          // となりの列との さかい目で ふらつかないように
  if(G.t%4<2){if(pc.x<bz.col)inp.r=1;else if(pc.x>bz.col)inp.l=1}
  // 下に おとすのは りょう手を 大きく ひろげた ときだけ（手を下げる・しゃがむ では おちない）
  if(Body.gap>BODY.WIDE){inp.d=1;return}
  const deg=Body.angle*180/Math.PI;
  if(Math.abs(deg)<BODY.ROT_BACK)bz.armed=true;
  else if(bz.armed&&Math.abs(deg)>BODY.ROT){bz.armed=false;rotate(p,deg>0?1:-1)}
}
function drawHands(p){
  if(!cam()||p.cpu)return;
  const x=p.bx+bz.col*CELL+CELL/2,y=LAY.by-4;
  ctx.fillStyle=bz.grab?'#ffd84a':'rgba(255,255,255,.35)';
  ctx.beginPath();ctx.moveTo(x-12,y-16);ctx.lineTo(x+12,y-16);ctx.lineTo(x,y);ctx.closePath();ctx.fill();
  if(!bz.grab&&p.state==='control')txt('りょう手を 前に出して つかもう',p.bx+COLS*CELL/2,LAY.by+40,14,'#fff',{});
}
if(typeof Body!=='undefined'){
  Body.on('clap',()=>{if(cam()&&!((G.scene==='match'||G.scene==='toko')&&!G.paused))onKey('Enter')});
  Body.gate({title:'ぷるもち☆バトル',corner:'tr',lines:['🤲 <b>りょう手を 前に出す</b> … おちてくる ぷるもちを つかむ','↔ つかんだまま <b>左右に 動かす</b> … 置きたい列へ','🔄 りょう手を <b>ハンドルのように かたむける</b> … 1回 まわる（もどして もう一度で さらに まわる）','⬇ <b>りょう手を 大きく ひろげる</b> … 下に おとす','👏 手を たたく … けってい','はじめは「とことんモード」が おすすめ']});
}
window.__P={bz,bodyInput,G,STAGES,startMatch,startToko,goVS,goToko,step(n){for(let i=0;i<n;i++)update();render()},heights,AU};
})();
