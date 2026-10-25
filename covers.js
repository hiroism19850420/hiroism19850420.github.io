/* ゲームの箱の表紙(200x300)。slug ごとに SVG の中身を返す。下の100pxは題名の帯が重なる */
(function(){
var K="#102337",CR="#f6ecd3",RD="#df4429",GN="#2f7a62",YL="#f2c14e",BL="#4a7fb5",PK="#e88aa0",OR="#ef8a3c";
function r(x,y,w,h,f,e){return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+f+'" '+(e||'')+'/>'}
function c(x,y,R,f,e){return '<circle cx="'+x+'" cy="'+y+'" r="'+R+'" fill="'+f+'" '+(e||'')+'/>'}
function e(x,y,rx,ry,f,x2){return '<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" fill="'+f+'" '+(x2||'')+'/>'}
function p(pts,f,x2){return '<polygon points="'+pts+'" fill="'+f+'" '+(x2||'')+'/>'}
function l(x1,y1,x2,y2,s,w,x3){return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+s+'" stroke-width="'+(w||3)+'" stroke-linecap="round" '+(x3||'')+'/>'}
function d(path,f,s,w,x2){return '<path d="'+path+'" fill="'+(f||'none')+'" '+(s?'stroke="'+s+'" stroke-width="'+(w||3)+'" stroke-linecap="round" stroke-linejoin="round" ':'')+(x2||'')+'/>'}
function t(x,y,s,f,txt,x2){return '<text x="'+x+'" y="'+y+'" font-size="'+s+'" fill="'+f+'" text-anchor="middle" font-family="DotGothic16,Noto Sans JP,sans-serif" font-weight="700" '+(x2||'')+'>'+txt+'</text>'}
function sky(a,b){return '<defs><linearGradient id="@" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+a+'"/><stop offset="1" stop-color="'+b+'"/></linearGradient></defs><rect width="200" height="300" fill="url(#@)"/>'}
var ST=[[18,24],[52,60],[88,18],[126,48],[160,22],[180,70],[30,96],[148,92],[70,120],[110,30],[14,150],[188,130]];
function stars(n,f){var s='';for(var i=0;i<(n||12);i++){s+=r(ST[i][0],ST[i][1],2.5,2.5,f||CR)}return s}
function hills(f,y,y2){return d('M0 '+y+' Q50 '+(y-26)+' 100 '+(y-6)+' T200 '+(y2||y-14)+' V300 H0Z',f)}
function ground(f,y){return r(0,y,200,300-y,f)}
/* 公共標識風のピクトグラム */
function man(x,y,k,f,pose){
  var s=4*k,H=c(x,y,6.2*k,f),B=l(x,y+8*k,x,y+28*k,f,s),a,g;
  var sh=y+12*k,hp=y+28*k;
  if(pose==="up"){a=l(x,sh,x-13*k,y-3*k,f,s)+l(x,sh,x+13*k,y-3*k,f,s);g=l(x,hp,x-8*k,y+46*k,f,s)+l(x,hp,x+8*k,y+46*k,f,s)}
  else if(pose==="wide"){a=l(x-17*k,sh,x+17*k,sh,f,s);g=l(x,hp,x-8*k,y+46*k,f,s)+l(x,hp,x+8*k,y+46*k,f,s)}
  else if(pose==="walk"){a=l(x,sh,x-10*k,y+25*k,f,s)+l(x,sh,x+11*k,y+22*k,f,s);g=l(x,hp,x-12*k,y+45*k,f,s)+l(x,hp,x+10*k,y+46*k,f,s)}
  else if(pose==="jump"){a=l(x,sh,x-13*k,y+2*k,f,s)+l(x,sh,x+12*k,y+3*k,f,s);g=l(x,hp,x-12*k,y+38*k,f,s)+l(x,hp,x+12*k,y+36*k,f,s)}
  else{a=l(x,sh,x-9*k,y+26*k,f,s)+l(x,sh,x+9*k,y+26*k,f,s);g=l(x,hp,x-7*k,y+46*k,f,s)+l(x,hp,x+7*k,y+46*k,f,s)}
  return H+B+a+g;
}
var A={};
A["jibun-de"]=function(){var s=sky("#f3d9c4","#e8a98f");
  [[40,0],[100,0],[160,0]].forEach(function(q){});
  s+=l(100,0,100,78,K,1.4)+l(86,0,64,128,K,1.2)+l(114,0,138,128,K,1.2);
  s+=man(100,82,1,K,"stand");
  s+=r(22,150,44,36,CR,'stroke="'+K+'" stroke-width="3"')+c(44,168,9,"none",'stroke="'+K+'" stroke-width="3.5"');
  s+=r(78,150,44,36,CR,'stroke="'+K+'" stroke-width="3"')+p("100,157 112,180 88,180","none",'stroke="'+K+'" stroke-width="3.5"');
  s+=r(134,150,44,36,RD,'stroke="'+K+'" stroke-width="3"')+d("M147 168 l6 6 l12 -12","none",CR,4);
  return s};
A["fly"]=function(){var s=sky("#0a1d44","#6fa8d8");s+=stars(9);
  s+=c(100,230,110,"#2f7a62")+d("M0 232 Q100 190 200 232","none","#9ed0a8",2);
  s+=p("40,205 62,172 84,205",YL)+p("150,208 164,184 178,208","#c9a35a");
  s+=man(100,70,1.1,CR,"wide");
  s+=d("M80 100 l-28 -12","none",CR,2)+d("M120 100 l28 -12","none",CR,2);
  return s};
A["fly-real"]=function(){var s=sky("#1b3a63","#e7b887");
  s+=ground("#6b5a3a",200)+p("0,200 40,164 80,200","#8a7448")+p("90,200 140,150 200,200","#9b8355")+p("0,230 200,215 200,300 0,300","#4d6b3c");
  s+=r(70,198,60,4,"#5a8bbd");
  s+=man(100,64,1.1,CR,"wide");
  s+=r(14,16,46,16,RD)+t(37,29,12,CR,"REAL");
  return s};
A["zenshin-grandprix"]=function(){var s=sky("#f7e08a","#ef8a3c");
  s+=ground("#3b3b44",196)+r(0,236,200,4,CR,'opacity=".7"')+r(0,200,200,4,CR,'opacity=".5"');
  s+=c(64,184,22,"none",'stroke="'+K+'" stroke-width="5"')+c(142,184,22,"none",'stroke="'+K+'" stroke-width="5"');
  s+=d("M64 184 L100 132 L142 184 M100 132 L90 118","none",K,5);
  s+=man(100,82,0.8,K,"walk");
  s+=l(10,90,40,90,CR,3)+l(4,110,34,110,CR,3)+l(14,130,44,130,CR,3);
  s+=p("160,40 196,52 160,64","none")+d("M160 30 V86","none",K,3)+p("160,32 192,42 160,52",RD);
  return s};
A["zenshin-dash"]=function(){var s=sky("#9ed0ee","#e9f2d8");
  s+=ground("#d96a3a",200)+l(0,222,200,222,CR,2)+l(0,250,200,250,CR,2);
  s+=r(112,170,8,30,K)+r(150,170,8,30,K)+r(108,164,54,8,RD);
  s+=man(78,92,1.3,K,"jump");
  s+=l(6,110,30,110,"#ffffffaa",3)+l(10,130,36,130,"#ffffffaa",3);
  return s};
A["zenshin-quest"]=function(){var s=sky("#2b3a67","#e0a066");s+=stars(8);
  s+=hills("#1f3a4a",190,176)+hills("#16283a",220,206);
  s+=man(70,110,1.2,CR,"stand")+l(90,128,118,90,YL,5)+l(113,98,125,106,YL,5);
  s+=e(144,196,28,18,GN)+c(136,190,3,K)+c(152,190,3,K)+d("M134 202 q10 6 20 0","none",K,2);
  s+=p("164,44 168,56 181,56 171,63 175,76 164,68 153,76 157,63 147,56 160,56",YL);
  return s};
A["hook-runner"]=function(){var s=sky("#12123a","#3a1d6b");s+=stars(7,"#8ff");
  [[10,170,30,120],[46,170,26,90],[142,170,26,110],[172,170,24,140]].forEach(function(b){s+=r(b[0],b[3]+50,b[2],220-b[3]-50+80,"#0b0b25",'stroke="#2ff" stroke-width="1"')});
  s+=c(100,28,4,"#2ff")+l(100,28,70,104,"#2ff",2)+man(70,104,0.9,CR,"jump");
  s+=d("M20 250 H180","none","#f4a",2);
  return s};
A["jinsei-shindan"]=function(){var s=sky("#1c1c1c","#2b2b3a");
  s+=r(30,26,140,150,"#d8e8c0",'stroke="#98b878" stroke-width="6"');
  for(var i=0;i<4;i++){s+=r(44,44+i*30,14,14,"none",'stroke="'+K+'" stroke-width="3"')+r(66,48+i*30,70,6,K)}
  s+=d("M46 52 l4 5 l7 -9","none",RD,3)+d("M46 82 l4 5 l7 -9","none",RD,3);
  s+=t(150,160,40,RD,"A");
  s+=c(100,230,12,"none",'stroke="#d8e8c0" stroke-width="4"')+r(94,244,12,8,"#d8e8c0");
  return s};
A["ashibumi-bouken"]=function(){var s=sky("#bfe3f2","#f4efc0");
  s+=hills("#7fb36a",190,170)+ground("#5f9a52",200);
  s+=man(100,92,1.3,K,"walk");
  [[40,230],[76,236],[112,230],[148,236]].forEach(function(q){s+=e(q[0],q[1],9,5,"#3d7a3a")});
  s+=d("M150 80 l22 14 l-22 14","none",RD,6);
  return s};
A["batter-mesen"]=function(){var s=sky("#0d1b3a","#2c5a46");s+=stars(8);
  s+=ground("#2c5a46",190)+p("0,190 100,150 200,190","#3a7a58");
  s+=c(138,70,12,CR)+d("M132 66 q6 6 12 0","none",RD,1.5);
  s+=man(60,110,1.2,CR,"stand")+l(72,118,100,88,"#c98d4a",6);
  s+=r(150,150,30,50,K)+t(165,185,18,CR,"BAT");
  return s};
A["last-brake"]=function(){var s=sky("#f7c9a3","#ee8a6a");
  s+=c(150,60,24,"#ffe9b8");
  s+=r(0,200,140,100,"#7a5a3a")+r(0,196,140,6,"#3d7a3a")+d("M0 200 H140","none",K,3);
  s+=l(10,196,10,210,K,3)+l(40,196,40,210,K,3)+l(70,196,70,210,K,3)+l(100,196,100,210,K,3)+l(132,196,132,210,K,3);
  s+=r(70,150,50,36,"#6a6a78",'stroke="'+K+'" stroke-width="3"')+c(82,190,7,K)+c(108,190,7,K);
  s+=e(94,150,15,13,OR)+p("82,142 80,128 90,138",OR)+p("106,142 108,128 98,138",OR)+c(89,150,2,K)+c(99,150,2,K);
  s+=t(160,150,22,RD,"!");
  return s};
A["note-kaiju"]=function(){var s=r(0,0,200,300,"#f3f0e2");
  for(var i=0;i<16;i++)s+=l(0,i*20,200,i*20,"#a9c5d8",1);
  s+=l(26,0,26,300,"#e08a8a",1.5);
  s+=d("M60 150 Q50 90 100 84 Q150 90 140 150 Q150 190 120 196 Q100 176 80 196 Q50 190 60 150Z","#cfe0a8",K,3);
  s+=c(86,128,10,CR,'stroke="'+K+'" stroke-width="3"')+c(116,126,7,CR,'stroke="'+K+'" stroke-width="3"')+c(88,130,3,K)+c(115,127,2.5,K);
  s+=d("M80 160 l8 8 l8 -8 l8 8 l8 -8 l8 8 l8 -8","none",K,3)+d("M84 90 l-8 -18 M112 84 l4 -20 M130 94 l14 -14","none",K,3);
  s+=man(168,176,0.55,K,"up");
  return s};
A["tsugi-tomarimasu"]=function(){var s=sky("#0b1530","#27406a");s+=stars(8);
  s+=ground("#1c2a3d",208)+r(0,206,200,4,"#8a8a8a");
  s+=r(20,110,160,86,"#e8b84a",'stroke="'+K+'" stroke-width="3"');
  for(var i=0;i<5;i++)s+=r(30+i*30,122,22,24,"#fff3c4",'stroke="'+K+'" stroke-width="2"');
  s+=r(30,160,140,6,K)+c(52,198,12,K)+c(52,198,5,"#bbb")+c(148,198,12,K)+c(148,198,5,"#bbb");
  s+=r(176,60,4,100,"#999")+c(178,56,13,RD)+t(178,62,14,CR,"止");
  return s};
A["anata-wa-saitei"]=function(){var s=sky("#8fd49a","#6bbf7a");
  s+=r(20,34,110,34,CR,'rx="14"')+r(70,84,110,34,"#a8e8a0",'rx="14"')+r(20,134,126,34,CR,'rx="14"')+r(60,184,120,30,RD,'rx="14"');
  s+=r(34,48,70,5,"#b9b9b9")+r(84,98,80,5,"#5e8e5a")+r(34,148,90,5,"#b9b9b9")+r(74,196,90,5,CR);
  return s};
A["karada-avatar"]=function(){var s=sky("#8bd0f0","#d9f0b8");
  s+=hills("#6fbf5a",210,196)+ground("#58a84a",224);
  s+=man(100,100,1.4,"#e86a4a","jump");
  [[36,60],[160,52],[150,150]].forEach(function(q){s+=p(q[0]+","+(q[1]-9)+" "+(q[0]+3)+","+(q[1]-3)+" "+(q[0]+9)+","+(q[1]-3)+" "+(q[0]+4)+","+(q[1]+2)+" "+(q[0]+6)+","+(q[1]+9)+" "+q[0]+","+(q[1]+5)+" "+(q[0]-6)+","+(q[1]+9)+" "+(q[0]-4)+","+(q[1]+2)+" "+(q[0]-9)+","+(q[1]-3)+" "+(q[0]-3)+","+(q[1]-3),YL)});
  return s};
A["katamuki-ball"]=function(){var s=sky("#2a2f4a","#4a5a7a");
  s+=p("20,130 180,100 190,150 30,190","#c98d4a",'stroke="'+K+'" stroke-width="3"');
  s+=e(60,160,8,5,K)+e(120,138,8,5,K)+c(150,112,10,"#e6e9f2")+c(148,110,3,"#fff");
  s+=d("M30 60 q-10 30 10 50","none",CR,3)+p("38,114 46,104 48,116",CR);
  return s};
A["pop-beat"]=function(){var s=sky("#1a0f3a","#3a1260");
  var cs=[RD,YL,BL,GN,PK,OR,"#9a7ae0","#4fd0c0",CR],i=0;
  for(var y=0;y<3;y++)for(var x=0;x<3;x++){s+=r(36+x*46,40+y*46,38,38,cs[i++],'rx="6"')}
  s+=d("M20 210 q20 -30 40 0 t40 0 t40 0 t40 0","none","#ff7ad9",3);
  return s};
A["burger-baito"]=function(){var s=sky("#f9d977","#f0a24a");
  s+=e(100,98,56,32,"#d8923a")+r(60,98,80,10,"#d8923a");
  s+=r(48,116,104,12,"#6bbf4a",'rx="6"')+r(52,128,96,14,"#7a3b1d",'rx="5"')+r(46,142,108,8,YL)+r(52,150,96,8,RD,'rx="4"')+e(100,172,56,14,"#d8923a");
  [[80,84],[100,78],[120,84],[92,90],[112,92]].forEach(function(q){s+=e(q[0],q[1],3,1.8,CR)});
  s+=e(100,200,60,8,"#c97a3a",'opacity=".5"');
  return s};
A["purumochi"]=function(){var s=sky("#ffdff0","#f5c0de");
  [[70,90,PK],[130,90,"#7ad0e8"],[70,150,"#f3e06a"],[130,150,"#8ee08a"]].forEach(function(q){s+=e(q[0],q[1],30,26,q[2])+c(q[0]-9,q[1]-2,3,K)+c(q[0]+9,q[1]-2,3,K)+d("M"+(q[0]-5)+" "+(q[1]+8)+" q5 4 10 0","none",K,2)});
  s+=t(100,214,24,RD,"×4");
  return s};
A["chikoku-gate"]=function(){var s=sky("#bfe7ff","#fff2c9");
  s+=c(150,50,20,"#ffd45a")+r(30,100,12,110,"#6a6a78")+r(158,100,12,110,"#6a6a78")+r(24,92,152,10,"#4a4a58")+ground("#9a8a6a",208);
  s+=man(100,110,1.1,"#2a3a6a","walk")+r(94,98,12,6,"#e8c070",'rx="2"');
  s+=l(10,150,60,150,"#fff",3)+l(18,168,64,168,"#fff",3);
  return s};
A["gladiola"]=function(){var s=sky("#0a0220","#2a0a52");s+=stars(9,"#f9f");
  for(var i=0;i<6;i++)s+=e(100+Math.cos(i*Math.PI/3)*26,86+Math.sin(i*Math.PI/3)*26,16,10,["#ff4fd8","#4fd8ff","#ffe04f"][i%3],'transform="rotate('+(i*60)+' '+(100+Math.cos(i*Math.PI/3)*26)+' '+(86+Math.sin(i*Math.PI/3)*26)+')"');
  s+=c(100,86,10,"#fff")+p("40,200 90,188 90,212","#4fd8ff")+l(96,200,160,200,"#ff4fd8",3);
  return s};
A["night-heron"]=function(){var s=sky("#06101e","#16324a");s+=stars(7);
  s+=c(40,50,16,CR)+ground("#0b1a28",210);
  s+=d("M110 190 q-6 -60 20 -90 q10 -12 24 -6 l16 4 l-14 6 q-4 30 -18 56 l-4 30 M126 190 l-4 24","none","#c8d4dc",4);
  s+=d("M154 98 l22 4","none",YL,3)+c(144,98,3,K);
  s+=p("20,140 100,120 100,170","#f2c14e30");
  return s};
A["boldaring"]=function(){var s=sky("#d9cfc0","#b8aa98");
  [[40,40,RD],[120,56,BL],[70,96,YL],[150,110,GN],[36,150,PK],[104,150,OR],[160,60,"#9a7ae0"]].forEach(function(q){s+=e(q[0],q[1],11,8,q[2])});
  s+=man(90,130,0.9,K,"up");
  return s};
A["nasubinta"]=function(){var s=sky("#fff1c9","#f7c97a");
  s+=d("M70 60 Q50 100 66 160 Q90 190 110 150 Q120 100 100 70Z","#6a3a8a")+d("M70 60 q15 -22 30 10 q-14 4 -30 -10","#3d7a3a");
  s+=c(150,170,26,RD)+d("M150 142 l-4 -12 M150 142 l8 -10","none","#3d7a3a",4);
  s+=d("M130 90 l30 -4 l4 22 l-30 4z","#f0c9a0",K,3)+t(172,70,22,RD,"ビンタ!");
  return s};
A["kaitou-nupan"]=function(){var s=sky("#0c0612","#26102e");
  for(var i=0;i<5;i++)s+=l(0,60+i*30,200,40+i*40,"#ff2a4a",2,'opacity=".8"');
  s+=r(130,150,50,50,"#8a8a96",'stroke="'+K+'" stroke-width="3"')+c(155,175,9,YL);
  s+=man(60,110,1,"#000","walk")+r(48,86,24,5,"#000")+r(54,76,12,12,"#000");
  return s};
A["donka-dojo"]=function(){var s=sky("#7a1d1d","#c24a3a");
  s+=e(100,150,64,56,"#e8c07a",'stroke="'+K+'" stroke-width="4"')+e(100,150,48,40,"#f6e3b8")+r(84,206,32,30,K);
  s+=l(40,50,90,120,"#f0d9a0",7)+l(160,50,110,120,"#f0d9a0",7);
  s+=c(100,150,10,RD);
  return s};
A["tsumiki"]=function(){var s=sky("#d6ecf7","#f3e6c8");
  [[RD,60],[BL,92],[YL,124],[GN,156]].forEach(function(q,i){s+=r(66,q[1]+30,68,32,q[0],'stroke="'+K+'" stroke-width="3"')});
  s+=ground("#b79e72",222);
  s+=e(160,176,14,12,CR,'stroke="'+K+'" stroke-width="3"')+c(156,170,3,PK)+c(166,170,3,PK)+c(161,178,3,PK);
  return s};
A["hikari"]=function(){var s=sky("#0a1a2a","#16403a");
  s+=ground("#0b1a14",206)+d("M100 206 V150","none",GN,5)+d("M100 160 q-26 -4 -30 -26 q26 0 30 26","#58b86a")+d("M100 150 q24 -6 28 -28 q-26 2 -28 28","#58b86a");
  s+=c(100,100,22,"#ffe99a",'opacity=".35"')+c(100,100,10,"#fff4b8");
  [[40,60],[160,76],[60,150],[150,150]].forEach(function(q){s+=c(q[0],q[1],3,"#ffe99a")});
  return s};
A["karada-yusha"]=function(){var s=sky("#2a1a4a","#7a3a5a");
  s+=man(66,100,1.2,CR,"stand")+l(84,118,112,86,YL,5);
  s+=e(148,150,28,34,"#7a3ab8")+c(138,142,5,CR)+c(158,142,5,CR)+c(138,142,2,K)+c(158,142,2,K)+d("M136 160 l6 6 l6 -6 l6 6 l6 -6","none",CR,2);
  s+=c(100,64,10,"#ff9a4a",'opacity=".7"');
  return s};
A["mimi-mystery"]=function(){var s=sky("#1e2a3a","#3a4a5a");
  s+=d("M80 160 Q60 90 100 70 Q150 62 150 110 Q150 140 124 150 Q120 176 100 180","#e8c9a0",K,4)+d("M100 100 q20 -10 30 10 q4 16 -14 24","none",K,3);
  s+=c(150,186,20,"none",'stroke="'+YL+'" stroke-width="6"')+l(164,200,184,220,YL,7);
  s+=t(48,76,34,YL,"?")+t(166,66,26,YL,"?");
  return s};
A["kiite-oboete"]=function(){var s=sky("#d4ecf2","#a8d4e0");
  s+=d("M70 170 Q52 100 90 80 Q136 72 136 118 Q136 146 112 156 Q108 180 90 184","#f0c9a0",K,4)+d("M92 108 q16 -8 26 8 q3 14 -12 20","none",K,3);
  s+=r(120,30,60,30,CR,'rx="10"')+r(30,40,50,28,"#fff7d6",'rx="10"');
  s+=t(150,52,18,K,"だれが")+t(55,59,15,K,"どこで");
  return s};
A["danna-no-shigoto"]=function(){var s=sky("#ffd9e0","#f5a3b8");
  s+=c(100,100,52,YL,'stroke="'+K+'" stroke-width="4"')+c(82,90,6,K)+c(118,90,6,K)+d("M72 112 Q100 146 128 112","none",K,5);
  s+=r(60,176,80,50,CR,'stroke="'+K+'" stroke-width="3"')+d("M60 176 L100 206 L140 176","none",K,3)+d("M100 192 c-8 -10 -18 0 0 14 c18 -14 8 -24 0 -14","#e11d48");
  return s};
A["zenshin-yusha"]=function(){var s=sky("#2a4a8a","#9ec8f0");
  s+=ground("#2f5a3a",212)+man(100,100,1.3,CR,"jump");
  s+=d("M26 60 q10 10 0 20 M38 54 q16 16 0 32","none",CR,3)+d("M174 60 q-10 10 0 20 M162 54 q-16 16 0 32","none",CR,3);
  s+=r(150,180,30,20,RD);
  return s};
A["seesaw"]=function(){var s=sky("#cfe8d8","#f6f0c4");
  s+=ground("#8fb870",210)+p("100,160 80,210 120,210","#7a5a3a");
  s+=r(20,150,160,10,"#c98d4a",'transform="rotate(-10 100 158)" stroke="'+K+'" stroke-width="3"');
  s+=c(40,125,14,RD)+c(168,166,10,BL);
  return s};
A["donarugo-quest"]=function(){var s=sky("#3a0a0a","#a8321a");
  s+=p("100,34 112,70 150,56 128,88 168,100 128,112 150,146 112,132 100,170 88,132 50,146 72,112 32,100 72,88 50,56 88,70",YL,'stroke="'+RD+'" stroke-width="3"');
  s+=t(100,118,52,RD,"!");
  s+=man(100,184,0.7,CR,"wide");
  return s};
A["kokon-todofuken"]=function(){var s=sky("#bfe3f2","#8fc4dc");
  s+=d("M120 40 L146 70 L136 110 L112 150 L92 176 L70 170 L84 148 L100 110 L96 76Z","#e8c070",K,3);
  [[120,64],[108,110],[88,160]].forEach(function(q){s+=c(q[0],q[1],6,RD)+r(q[0]-1,q[1],2,12,RD)});
  s+=t(40,210,22,K,"47");
  return s};
A["oboeru-shiritori"]=function(){var s=sky("#f7e3c4","#f0c89a");
  [["し",44,56],["り",100,98],["と",56,150],["り",108,198]].forEach(function(q){s+=c(q[1],q[2],26,CR,'stroke="'+K+'" stroke-width="4"')+t(q[1],q[2]+10,30,K,q[0])});
  s+=d("M60 76 L88 82 M96 124 L72 136 M64 172 L96 186","none",RD,3);
  return s};
A["menseki"]=function(){var s=sky("#e8f0f6","#cfdce8");
  s+=d("M40 50 H150 V110 H110 V190 H40Z","#ffe6a0",K,4)+t(76,130,40,RD,"?");
  s+=l(40,34,150,34,K,2)+t(95,28,14,K,"12")+l(168,50,168,110,K,2)+t(184,86,14,K,"5");
  return s};
A["make-load"]=function(){var s=sky("#0a0a1a","#2a2050");s+=stars(8);
  s+=d("M70 300 L96 150 H108 L134 300Z","#3a3a58")+r(98,186,4,14,CR)+r(98,224,4,18,CR);
  s+=d("M80 120 Q80 70 100 70 Q120 70 120 120 L112 112 L106 122 L100 112 L94 122 L88 112Z","#f6f6ff")+c(92,96,3,K)+c(108,96,3,K);
  return s};
/* ゲームの別名(ぜんしん版など)は元の絵を使う */
var ALIAS={"katamuki-ball-zenshin":"katamuki-ball","pop-beat-zenshin":"pop-beat","pop-beat-stage":"pop-beat","purumochi-zenshin":"purumochi","chikoku-gate-zenshin":"chikoku-gate","gladiola-zenshin":"gladiola","night-heron-zenshin":"night-heron","boldaring-zenshin":"boldaring","nasubinta-zenshin":"nasubinta","donka-dojo-zenshin":"donka-dojo","tsumiki-nekooroshi":"tsumiki","tsumiki-nekooroshi-zenshin":"tsumiki","hikari-zenshin":"hikari"};
var FALL=[["#12304a","#4a7fb5"],["#5a2a3a","#e08a8a"],["#1f4d3f","#8fc49a"],["#4a3a6b","#b49ae0"]];
window.coverSVG=function(slug){
  var key=ALIAS[slug]||slug, f=A[key], s;
  if(f){s=f()}else{var h=0;for(var i=0;i<slug.length;i++)h=(h*31+slug.charCodeAt(i))>>>0;var q=FALL[h%FALL.length];s=sky(q[0],q[1])+c(100,100,36,CR,'opacity=".8"')}
  s=s.replace(/@/g,"g-"+slug);
  return '<svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+s+'</svg>';
};
})();
