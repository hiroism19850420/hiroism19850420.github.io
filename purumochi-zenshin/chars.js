// キャラクター描画(オリジナルデザイン)
(function(){
let U=0;
const lg=(id,a,b,h)=>`<linearGradient id="${id}" x1="0" y1="0" x2="${h?1:0}" y2="${h?0:1}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const rg=(id,a,b)=>`<radialGradient id="${id}" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
const SKIN='#ffe6d6',SKIN2='#f7c9b4',LASH='#2a1830';

function eye(x,y,c,exp,mode,side,p){
  if(exp==='happy')return `<path d="M${x-10} ${y+3} Q${x} ${y-10} ${x+10} ${y+3}" stroke="${LASH}" stroke-width="3.8" fill="none" stroke-linecap="round"/>`;
  const small=exp==='pinch';
  let s=`<ellipse cx="${x}" cy="${y}" rx="11" ry="14" fill="#fff"/>`;
  if(small){s+=`<ellipse cx="${x}" cy="${y+1}" rx="5" ry="6.5" fill="url(#${p}i)"/><ellipse cx="${x}" cy="${y+1}" rx="2.4" ry="3.2" fill="#1a1030"/><circle cx="${x-1.5}" cy="${y-2}" r="1.6" fill="#fff"/>`}
  else{s+=`<ellipse cx="${x}" cy="${y+2}" rx="9.2" ry="12" fill="url(#${p}i)"/><ellipse cx="${x}" cy="${y+3.5}" rx="4.3" ry="6.2" fill="#1a1030"/><circle cx="${x-3.6}" cy="${y-3.5}" r="3.6" fill="#fff"/><circle cx="${x+3.4}" cy="${y+6.5}" r="1.7" fill="#fff" opacity=".85"/>`}
  if(!small&&mode==='sleepy')s+=`<path d="M${x-13} ${y-16} L${x+13} ${y-16} L${x+13} ${y} Q${x} ${y+3} ${x-13} ${y} Z" fill="${SKIN}"/><path d="M${x-12} ${y} Q${x} ${y+4} ${x+12} ${y}" stroke="${LASH}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  else if(!small&&mode==='smug'){const a=side<0?-4:4;s+=`<path d="M${x-13} ${y-16} L${x+13} ${y-16} L${x+13} ${y-5+a} L${x-13} ${y-5-a} Z" fill="${SKIN}"/><path d="M${x-12} ${y-5-a*.9} L${x+12} ${y-5+a*.9}" stroke="${LASH}" stroke-width="3.2" stroke-linecap="round"/>`}
  else s+=`<path d="M${x-12} ${y-8} Q${x} ${y-17} ${x+12} ${y-8}" stroke="${LASH}" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M${x+side*11} ${y-9} l${side*4} -3" stroke="${LASH}" stroke-width="2.4" stroke-linecap="round"/>`;
  return s;
}
function face(o){
  const {p,exp,mode}=o,ex=o.ex||20,ey=o.ey||108,cx=100;
  let s=`<ellipse cx="${cx-ex-10}" cy="${ey+15}" rx="${o.bigBlush?11:8}" ry="${o.bigBlush?6.5:4.5}" fill="#ff8fb1" opacity="${exp==='pinch'?.25:.55}"/><ellipse cx="${cx+ex+10}" cy="${ey+15}" rx="${o.bigBlush?11:8}" ry="${o.bigBlush?6.5:4.5}" fill="#ff8fb1" opacity="${exp==='pinch'?.25:.55}"/>`;
  s+=eye(cx-ex,ey,o.eye,exp,mode,-1,p)+eye(cx+ex,ey,o.eye,exp,mode,1,p);
  const my=ey+20;
  if(exp==='happy')s+=`<path d="M${cx-11} ${my-3} Q${cx} ${my+14} ${cx+11} ${my-3} Z" fill="#c23a5c"/><path d="M${cx-6} ${my+4} Q${cx} ${my+9} ${cx+6} ${my+4} Q${cx} ${my+1} ${cx-6} ${my+4}Z" fill="#ff7f9c"/>`;
  else if(exp==='pinch')s+=`<path d="M${cx-9} ${my+2} q3 -4 6 0 t6 0 t6 0" stroke="${LASH}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M${cx+ex+30} ${ey-22} q-6 9 0 13 q6 -4 0 -13Z" fill="#8fd8ff" stroke="#4aa8e0" stroke-width="1.2"/>`;
  else if(mode==='smug')s+=`<path d="M${cx-8} ${my+1} Q${cx+3} ${my+6} ${cx+10} ${my-3}" stroke="${LASH}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  else if(mode==='grin')s+=`<path d="M${cx-10} ${my-2} Q${cx} ${my+9} ${cx+10} ${my-2} Z" fill="#c23a5c"/>`;
  else s+=`<path d="M${cx-6} ${my} Q${cx} ${my+5} ${cx+6} ${my}" stroke="${LASH}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  if(o.fang&&exp!=='pinch')s+=`<path d="M${cx+4} ${my+(mode==='smug'?2:0)} l2.5 5 l2.5 -5.5 Z" fill="#fff" stroke="${LASH}" stroke-width=".8"/>`;
  // まゆ
  const by=ey-25,bc=o.brow;
  if(exp==='pinch')s+=`<path d="M${cx-ex-9} ${by+1} L${cx-ex+7} ${by-5}" stroke="${bc}" stroke-width="2.6" stroke-linecap="round"/><path d="M${cx+ex+9} ${by+1} L${cx+ex-7} ${by-5}" stroke="${bc}" stroke-width="2.6" stroke-linecap="round"/>`;
  else if(mode==='smug'||mode==='grin')s+=`<path d="M${cx-ex-9} ${by-4} L${cx-ex+7} ${by+1}" stroke="${bc}" stroke-width="2.6" stroke-linecap="round"/><path d="M${cx+ex+9} ${by-4} L${cx+ex-7} ${by+1}" stroke="${bc}" stroke-width="2.6" stroke-linecap="round"/>`;
  else s+=`<path d="M${cx-ex-8} ${by} Q${cx-ex} ${by-4} ${cx-ex+8} ${by}" stroke="${bc}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M${cx+ex-8} ${by} Q${cx+ex} ${by-4} ${cx+ex+8} ${by}" stroke="${bc}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  return s;
}
const head=(rx,ry,cy)=>`<ellipse cx="100" cy="${cy||98}" rx="${rx||50}" ry="${ry||47}" fill="url(#P_sk)"/>`;
const skinDefs=p=>rg(p+'sk','#fff2e8',SKIN2).replace('P_sk',p+'sk');
const star=(x,y,r,f)=>{let d='';for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.45:r;d+=(i?'L':'M')+(x+Math.cos(a)*rr).toFixed(1)+' '+(y+Math.sin(a)*rr).toFixed(1)}return `<path d="${d}Z" fill="${f}" stroke="#e0a000" stroke-width="1" stroke-linejoin="round"/>`};

// ===== キャラクター =====
const CH=[
 {id:'luka',name:'ルカ',role:'主人公',rc:'#3d7bff',bg:['#e3eeff','#cfe0ff'],mode:'normal',
  desc:'金髪をワックスで立てた見習い魔法使いの男の子。青いマントと星の杖。元気で少し生意気。',
  spells:['えいっ!','スパーク!','スターダスト!','ミーティア!','ギャラクシア!','ルミナス・ノヴァ!!'],voice:'VOICEVOX:白上虎太郎',
  draw(p,exp){
   const defs=lg(p+'h','#ffe680','#e8a92a')+lg(p+'c','#4d8bff','#1f3f9e')+lg(p+'i','#57c3ff','#1d4fa8')+rg(p+'sk','#fff2e8',SKIN2);
   let s=`<path d="M58 238 Q64 178 80 152 Q100 143 120 152 Q136 178 142 238 Z" fill="url(#${p}c)"/>`+
   `<path d="M84 152 L100 198 L116 152 Q100 146 84 152Z" fill="#fff"/><path d="M80 152 L92 166 L100 152Z M120 152 L108 166 L100 152Z" fill="#dfe9ff"/>`+
   star(100,160,7,'#ffd84a')+
   `<rect x="92" y="134" width="16" height="16" rx="5" fill="${SKIN2}"/>`+
   `<path d="M146 222 L170 152" stroke="#8a5a2a" stroke-width="5" stroke-linecap="round"/><circle cx="146" cy="214" r="8" fill="${SKIN}"/>`+
   `<circle cx="171" cy="147" r="15" fill="#fff6b0" opacity=".55"/>`+star(171,147,12,'#ffe14a')+
   `<ellipse cx="50" cy="104" rx="7" ry="10" fill="${SKIN2}"/><ellipse cx="150" cy="104" rx="7" ry="10" fill="${SKIN2}"/>`+
   head()+
   `<path d="M50 108 C44 76 54 54 74 46 C92 38 120 40 134 50 C150 62 156 84 150 108 C146 94 140 86 132 80 L128 73 C114 66 92 66 76 74 C66 82 60 92 56 106 Z" fill="url(#${p}h)" stroke="#c98a1a" stroke-width="1.5" stroke-linejoin="round"/>`+
   `<path d="M68 66 C60 42 78 22 102 19 C118 17 132 23 142 35 C132 31 123 31 116 34 C130 38 138 47 142 60 C128 49 113 47 100 51 C90 55 80 62 74 74 Z" fill="url(#${p}h)" stroke="#c98a1a" stroke-width="1.5" stroke-linejoin="round"/>`+
   `<path d="M80 48 Q98 30 124 30 M84 58 Q104 44 128 46" stroke="#fff6c8" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".85"/>`+
   `<path d="M100 68 Q93 78 99 88" stroke="#e8b030" stroke-width="3" fill="none" stroke-linecap="round"/>`+
   face({p,exp,mode:'normal',eye:'',brow:'#c98a1a'});
   return [defs,s];}},
 {id:'mogu',name:'モグ丸',role:'1戦目',rc:'#ff9a3c',bg:['#fff1df','#ffe2c2'],mode:'normal',
  desc:'まんまる体型のパン屋の男の子。コック帽とエプロン。いつも何かをもぐもぐ。のんびり屋だけど力持ち。',
  spells:['もぐっ!','クリームパン!','メロンボム!','ジャンボプリン!','ドーナツストーム!','ごちそうフィーバー!!'],voice:'VOICEVOX:麒ヶ島宗麟',
  draw(p,exp){
   const defs=lg(p+'h','#a86a3a','#6a3a18')+lg(p+'c','#ffb05a','#f07a1a')+lg(p+'i','#c98a4a','#5a2e10')+rg(p+'sk','#fff2e8',SKIN2);
   let s=`<ellipse cx="22" cy="198" rx="17" ry="24" fill="url(#${p}c)"/><ellipse cx="178" cy="198" rx="17" ry="24" fill="url(#${p}c)"/>`+
   `<ellipse cx="100" cy="208" rx="86" ry="60" fill="url(#${p}c)"/><ellipse cx="80" cy="186" rx="34" ry="16" fill="#ffd09a" opacity=".45"/>`+
   `<path d="M54 178 Q100 160 146 178 Q156 214 142 240 L58 240 Q44 214 54 178 Z" fill="#fff" stroke="#f0d8c0" stroke-width="1.5"/><path d="M82 206 Q100 214 118 206 L116 226 Q100 230 84 226 Z" fill="#fff3e6" stroke="#f0d8c0" stroke-width="1.5"/><circle cx="100" cy="190" r="5" fill="#ff8a5a"/>`+
   `<ellipse cx="174" cy="206" rx="22" ry="13" fill="#e9a84a" stroke="#b56e1e" stroke-width="2"/><path d="M160 202 l6 8 M170 198 l6 8 M181 200 l5 7" stroke="#b56e1e" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="216" r="10" fill="${SKIN}"/><circle cx="160" cy="214" r="10" fill="${SKIN}"/>`+
   `<ellipse cx="100" cy="150" rx="46" ry="14" fill="${SKIN2}"/>`+
   `<ellipse cx="33" cy="110" rx="9" ry="12" fill="${SKIN2}"/><ellipse cx="167" cy="110" rx="9" ry="12" fill="${SKIN2}"/>`+
   head(67,55,104)+
   `<path d="M70 152 Q100 166 130 152" stroke="${SKIN2}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`+
   `<path d="M36 112 C34 88 42 72 56 66 L56 98 Z M164 112 C166 88 158 72 144 66 L144 98 Z" fill="url(#${p}h)"/>`+
   `<path d="M50 72 Q100 94 150 72 L150 62 L50 62 Z" fill="url(#${p}h)"/>`+
   `<rect x="46" y="50" width="108" height="22" rx="9" fill="#fff" stroke="#e4dcd6" stroke-width="2"/>`+
   `<circle cx="66" cy="38" r="20" fill="#fff" stroke="#e4dcd6" stroke-width="2"/><circle cx="134" cy="38" r="20" fill="#fff" stroke="#e4dcd6" stroke-width="2"/><circle cx="100" cy="27" r="25" fill="#fff" stroke="#e4dcd6" stroke-width="2"/><rect x="50" y="40" width="100" height="16" fill="#fff"/>`+
   face({p,exp,mode:'normal',ex:25,ey:114,brow:'#6a3a18',bigBlush:true});
   if(exp!=='pinch')s+=`<circle cx="116" cy="142" r="2" fill="#e9a84a"/><circle cx="121" cy="146" r="1.5" fill="#e9a84a"/>`;
   return [defs,s];}},
 {id:'miruru',name:'ミルル',role:'2戦目',rc:'#b07aff',bg:['#f6eeff','#ece0ff'],mode:'sleepy',
  desc:'いつも眠たそうな小さな天使。ずれた天使の輪っかと白い羽。ふわふわした口調でおっとり。',
  spells:['ふわっ…','エンジェルリング!','ハローレイ!','ホーリーベル!','セレスティア!','てんしのねむり!!'],voice:'VOICEVOX:四国めたん',
  draw(p,exp){
   const defs=lg(p+'h','#ffd3e8','#f08fbf')+lg(p+'c','#ffffff','#e4ecff')+lg(p+'i','#d4b0ff','#7a4fd0')+rg(p+'sk','#fff2e8',SKIN2)+rg(p+'w','#ffffff','#dfe8ff');
   let s=`<path d="M44 100 C40 50 70 34 100 34 C130 34 160 50 156 100 C162 150 160 190 150 214 C130 202 70 202 50 214 C40 190 38 150 44 100 Z" fill="url(#${p}h)"/>`+
   `<path d="M76 168 C40 140 18 156 22 178 C30 172 40 176 44 182 C34 186 34 198 44 200 C56 198 70 190 82 182 Z" fill="url(#${p}w)" stroke="#c9d6f2" stroke-width="1.5"/>`+
   `<path d="M124 168 C160 140 182 156 178 178 C170 172 160 176 156 182 C166 186 166 198 156 200 C144 198 130 190 118 182 Z" fill="url(#${p}w)" stroke="#c9d6f2" stroke-width="1.5"/>`+
   `<path d="M68 238 Q72 178 86 152 Q100 145 114 152 Q128 178 132 238 Z" fill="url(#${p}c)" stroke="#d6def5" stroke-width="1.5"/>`+
   `<path d="M100 160 L86 152 L86 170 Z M100 160 L114 152 L114 170 Z" fill="#7fc8ff"/><circle cx="100" cy="160" r="4" fill="#4fa8f0"/>`+
   `<rect x="92" y="134" width="16" height="16" rx="5" fill="${SKIN2}"/>`+
   head()+
   `<path d="M52 108 C46 66 70 44 100 44 C130 44 154 66 148 108 C140 88 132 80 124 86 C118 76 108 74 100 86 C92 74 82 76 76 86 C68 80 60 88 52 108 Z" fill="url(#${p}h)" stroke="#e57fb0" stroke-width="1.2"/>`+
   `<path d="M46 104 C40 130 44 160 52 176 C56 150 56 126 56 106Z M154 104 C160 130 156 160 148 176 C144 150 144 126 144 106Z" fill="url(#${p}h)"/>`+
   `<g transform="rotate(-14 104 30)"><ellipse cx="104" cy="30" rx="30" ry="8" fill="none" stroke="#fff3a0" stroke-width="9" opacity=".45"/><ellipse cx="104" cy="30" rx="30" ry="8" fill="none" stroke="#ffd23f" stroke-width="4.5"/></g>`+
   face({p,exp,mode:'sleepy',brow:'#d56a9e'});
   if(exp==='normal')s+=`<text x="150" y="58" font-size="16" font-weight="800" fill="#b07aff" font-family="sans-serif">z</text><text x="162" y="44" font-size="12" font-weight="800" fill="#c9a3ff" font-family="sans-serif">z</text>`;
   return [defs,s];}},
 {id:'devi',name:'デビィ',role:'3戦目',rc:'#9b5cff',bg:['#f1e8ff','#e2d2ff'],mode:'grin',
  desc:'いたずら大好きな小悪魔。小さな角とコウモリの羽、ハート形のしっぽ。ミニフォークで突っついてくる。',
  spells:['えへっ!','イタズラ!','シャドウボム!','トリックフォーク!','ナイトメア!','デビルパレード!!'],voice:'VOICEVOX:九州そら',
  draw(p,exp){
   const defs=lg(p+'h','#b98aff','#5a2fb0')+lg(p+'c','#3d2a58','#1e1230')+lg(p+'i','#ffe07a','#e07a00')+rg(p+'sk','#fff2e8',SKIN2)+lg(p+'n','#ff6a8a','#a01a3a');
   let s=`<path d="M78 164 L36 136 L40 152 L26 150 L36 164 L22 170 L44 178 L78 182Z" fill="#4a2a6a" stroke="#2a1640" stroke-width="1.5" stroke-linejoin="round"/>`+
   `<path d="M122 164 L164 136 L160 152 L174 150 L164 164 L178 170 L156 178 L122 182Z" fill="#4a2a6a" stroke="#2a1640" stroke-width="1.5" stroke-linejoin="round"/>`+
   `<path d="M118 224 C150 236 168 214 160 190" stroke="#3b1f55" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M160 190 C150 178 152 170 160 176 C166 168 174 176 166 186 Z" fill="#ff4f8a"/>`+
   `<path d="M62 238 Q66 178 82 152 Q100 144 118 152 Q134 178 138 238 Z" fill="url(#${p}c)"/><path d="M82 152 Q100 166 118 152" stroke="#b98aff" stroke-width="4" fill="none"/>`+
   `<rect x="92" y="134" width="16" height="16" rx="5" fill="${SKIN2}"/>`+
   `<path d="M54 222 L60 160" stroke="#ffcc4a" stroke-width="3.5" stroke-linecap="round"/><path d="M52 164 L60 148 L68 164 M60 148 L60 166 M52 164 Q60 170 68 164" stroke="#ffcc4a" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="56" cy="210" r="7" fill="${SKIN}"/>`+
   `<ellipse cx="50" cy="104" rx="7" ry="10" fill="${SKIN2}"/><ellipse cx="150" cy="104" rx="7" ry="10" fill="${SKIN2}"/><path d="M45 96 L36 88 L46 108Z M155 96 L164 88 L154 108Z" fill="${SKIN2}"/>`+
   head()+
   `<path d="M76 58 Q66 40 70 26 Q78 42 88 52Z M124 58 Q134 40 130 26 Q122 42 112 52Z" fill="url(#${p}n)"/>`+
   `<path d="M50 106 C42 64 66 40 100 40 C134 40 158 64 150 106 L143 92 L138 101 L130 80 L122 93 L112 76 L104 91 L94 76 L86 92 L76 80 L69 99 L61 89 Z" fill="url(#${p}h)" stroke="#4a2490" stroke-width="1.2" stroke-linejoin="round"/>`+
   face({p,exp,mode:'grin',eye:'',brow:'#4a2490',fang:true});
   return [defs,s];}},
 {id:'drana',name:'ドラーナ',role:'ラスボス',rc:'#d0245a',bg:['#ffe6ee','#f3d6ff'],mode:'smug',
  desc:'角と竜のしっぽを持つ魔界のお姫さま。小さな王冠と銀色の長い髪。わがままで自信満々、とっても強い。',
  spells:['がおっ!','フレアクロー!','ドラゴンブレス!','クリムゾンウイング!','ラグナフレイム!','りゅうおうのいかり!!'],voice:'VOICEVOX:波音リツ',
  draw(p,exp){
   const defs=lg(p+'h','#f6f2ff','#a99be0')+lg(p+'c','#4a1a66','#1e0a2e')+lg(p+'i','#ff7a8f','#8a0f2a')+rg(p+'sk','#fff2e8',SKIN2)+lg(p+'n','#8a2a3a','#2a0810')+lg(p+'t','#c0244e','#6a0c26');
   let s=`<path d="M40 100 C34 46 70 30 100 30 C130 30 166 46 160 100 C170 160 172 210 160 238 L40 238 C28 210 30 160 40 100 Z" fill="url(#${p}h)"/>`+
   `<path d="M80 160 C50 120 20 118 8 132 C22 134 26 142 22 150 C34 148 40 156 36 166 C50 160 62 168 80 176Z" fill="#6a0c26" stroke="#3a0612" stroke-width="1.5" stroke-linejoin="round"/>`+
   `<path d="M120 160 C150 120 180 118 192 132 C178 134 174 142 178 150 C166 148 160 156 164 166 C150 160 138 168 120 176Z" fill="#6a0c26" stroke="#3a0612" stroke-width="1.5" stroke-linejoin="round"/>`+
   `<path d="M120 222 C160 236 192 214 186 180 C184 170 176 168 178 178 C180 206 158 214 126 206Z" fill="url(#${p}t)"/><path d="M134 214 l4 -6 M150 216 l3 -7 M166 210 l2 -7" stroke="#ffb0c4" stroke-width="2" stroke-linecap="round"/>`+
   `<path d="M60 238 Q64 178 80 152 Q100 144 120 152 Q136 178 140 238 Z" fill="url(#${p}c)"/><path d="M80 152 Q100 168 120 152" stroke="#f0c040" stroke-width="3" fill="none"/><path d="M70 238 L80 200 M130 238 L120 200" stroke="#f0c040" stroke-width="2"/>`+
   `<rect x="92" y="134" width="16" height="16" rx="5" fill="${SKIN2}"/><circle cx="100" cy="158" r="5" fill="#ff3a5a" stroke="#f0c040" stroke-width="2"/>`+
   head()+
   `<path d="M72 60 C58 48 50 34 52 18 C60 30 70 38 84 48 Z" fill="url(#${p}n)"/><path d="M128 60 C142 48 150 34 148 18 C140 30 130 38 116 48 Z" fill="url(#${p}n)"/>`+
   `<path d="M48 106 C44 60 72 40 102 40 C132 40 156 60 152 106 C146 84 138 72 124 66 C114 80 96 82 84 70 C74 80 62 88 48 106 Z" fill="url(#${p}h)" stroke="#9a8cd0" stroke-width="1.2"/>`+
   `<path d="M48 100 C40 140 44 176 58 198 C60 168 58 136 58 110Z M152 100 C160 140 156 176 142 198 C140 168 142 136 142 110Z" fill="url(#${p}h)" stroke="#9a8cd0" stroke-width="1"/>`+
   `<path d="M80 50 L84 34 L92 44 L100 28 L108 44 L116 34 L120 50 Z" fill="#ffd23f" stroke="#c8901a" stroke-width="1.5" stroke-linejoin="round"/><circle cx="100" cy="44" r="3.4" fill="#ff3a5a"/>`+
   face({p,exp,mode:'smug',eye:'',brow:'#8a7cc0',fang:true});
   return [defs,s];}},
];
function portrait(c,exp){
  const p=c.id+(++U)+'_';const [defs,raw]=c.draw(p,exp);const body=raw.split('url(#P_sk)').join('url(#'+p+'sk)');
  return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs>${body}</svg>`;
}
window.CHARS=CH;window.portraitSVG=portrait;
})();
