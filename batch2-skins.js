/* ===================== الدفعة 2 — مظاهر الأمم الآسيوية: الصين، اليابان، كوريا ===================== */
const JADE='#3f8f6a',APRI='#e0b23a',CRIM='#b8283a',INK='#232328',PINK='#e07a9a',SKY='#6aa8d8';
const UNITS={};
/* --- أغطية الرأس --- */
function kerchief(c,col){ell(c,-0.2,-1.6,4.1,2.6,INK);ell(c,0.2,-4.2,1.4,1.2,INK);tri(c,[-3.4,-1],[-6,2.6],[-2.6,0.4],INK);tri(c,[-3,-0.2],[-5,3.6],[-2.2,0.6],'#3a3a40');}
function douli(c){tri(c,[-6.6,-0.6],[0.2,-6.2],[7,-0.6],'#c9a86a');limb(c,-6.6,-0.6,7,-0.6,0.6,'#8a6e3e');for(let k=-2;k<=2;k++)limb(c,0.2,-6,k*2.8,-0.8,0.3,'#a8884e');}
function headbandRibbon(c,col){ell(c,0,-2.2,4,0.9,col);tri(c,[-3.6,-2.2],[-7,1],[-3,-1.2],col);tri(c,[-3.2,-1.8],[-6.4,3.2],[-2.6,-0.8],col);}
function wildHair(c){for(let k=0;k<6;k++){const a=-2.6+k*0.42;tri(c,[Math.cos(a)*2.4-0.6,Math.sin(a)*2.4-0.4],[Math.cos(a)*5.6,Math.sin(a)*5.6-1],[Math.cos(a)*2.4+0.6,Math.sin(a)*2.4-0.4],INK);}
  ell(c,-0.4,-1.6,3.7,2.4,INK);rrect(c,-0.6,-6.4,1.4,2.6,0.4,INK);}
function topknotFlower(c,crownBig){ell(c,-0.2,-1.8,3.7,2.2,INK);ell(c,0,-4.4,1.2,1.2,INK);limb(c,-1,-4.6,1,-4.6,0.5,GOLD);
  const fl=crownBig?[[-2.6,-3.6],[-0.8,-5.6],[1.4,-5.4],[2.8,-3.4],[0,-6.6]]:[[1.6,-4.6]];
  fl.forEach(([x,y],k)=>{for(let p=0;p<5;p++){const a=p*1.2566;ell(c,x+Math.cos(a)*0.8,y+Math.sin(a)*0.8,0.55,0.55,k%2?'#f2a0b8':PINK);}ell(c,x,y,0.4,0.4,'#f2d46a');});}
/* --- أسلحة --- */
function dao(c,J,p,L){const d=wdir(p.wa),n=[-d[1],d[0]],h=J.handF,A=[h[0]+d[0]*1,h[1]+d[1]*1],B=[h[0]+d[0]*L,h[1]+d[1]*L];
  pg(c,[A,[B[0]+n[0]*0.4,B[1]+n[1]*0.4],[B[0]-n[0]*1.6,B[1]-n[1]*1.6],[A[0]-n[0]*1,A[1]-n[1]*1]],STEEL2);limb(c,h[0],h[1],A[0],A[1],1.2,'#5a3a22');
  limb(c,A[0]+n[0]*1.2,A[1]+n[1]*1.2,A[0]-n[0]*1.8,A[1]-n[1]*1.8,0.8,GOLD);}
function katana(c,from,a,L,w){const d=wdir(a),n=[-d[1],d[0]],h=from,B=[h[0]+d[0]*L,h[1]+d[1]*L],cp=[h[0]+d[0]*L*0.6-n[0]*0.8,h[1]+d[1]*L*0.6-n[1]*0.8];
  c.beginPath();c.moveTo(h[0]+d[0]*1.3,h[1]+d[1]*1.3);c.quadraticCurveTo(cp[0],cp[1],B[0],B[1]);c.strokeStyle='#e4e8ec';c.lineWidth=w||1.2;c.lineCap='round';c.stroke();
  limb(c,h[0]-d[0]*1.6,h[1]-d[1]*1.6,h[0]+d[0]*1,h[1]+d[1]*1,1.3,'#2a2026');ell(c,h[0]+d[0]*1.1,h[1]+d[1]*1.1,1,1,GOLD);}
function recurve(c,J,p,col){c.save();c.translate(J.handF[0],J.handF[1]);c.rotate(p.wa);c.beginPath();c.moveTo(1.2,-6.4);c.quadraticCurveTo(-0.6,-4.4,0.4,-2.2);
  c.quadraticCurveTo(2.2,0,0.4,2.2);c.quadraticCurveTo(-0.6,4.4,1.2,6.4);c.strokeStyle=col||'#3a2a22';c.lineWidth=1.2;c.stroke();limb(c,1.2,-6.4,-0.6,0,0.35,'#ece6d6');limb(c,-0.6,0,1.2,6.4,0.35,'#ece6d6');c.restore();}
/* --- ثياب --- */
const songRobe=(c,J,col,len)=>robe(c,J,len||0.66,mixHex(col,'#d9d2c0',0.35),dk(col,0.3),'chest',1.8);
function kimono(c,J,col,len,bold){const r=robe(c,J,len||0.72,col,dk(col,0.35),'chest',1.2);
  if(bold){[0.3,0.62].forEach((t,i)=>{const A=lp(r.w1,r.hemB,t),B=lp(r.w2,r.hemF,t),M=lp(A,B,0.5);ell(c,M[0],M[1],1.8,1.4,i?GOLD:CRIM);});
    const A=lp(r.w1,r.hemB,0.85),B=lp(r.w2,r.hemF,0.85);limb(c,A[0],A[1],B[0],B[1],0.9,INK);}return r;}
function obi(c,J,col){const a=J.pl,A=add(J.hip,rot(-2.6,-1.6,a)),B=add(J.hip,rot(2.8,-1.6,a));limb(c,A[0],A[1],B[0],B[1],2.4,col);ell(c,A[0]-0.6,A[1],1.2,1,col);}
const hanbok=(c,J,col,len)=>robe(c,J,len||0.42,lt(col,0.5),dk(col,0.25),'chest',1.4);
function sash(c,J,col){belt(c,J,col,1.4);const a=J.pl,o=add(J.hip,rot(-1.8,-1.3,a)),tl=lp(J.legB.h,J.legB.k,1.2);limb(c,o[0],o[1],tl[0]-0.6,tl[1],0.9,col);limb(c,o[0]+0.6,o[1],tl[0]+0.6,tl[1]+0.4,0.9,col);}
/* --- الصين --- */
UNITS.chn_common={name:'فتى الجبل',sx:0.98,sy:1.02,lw:2.9,headR:3.5,head:(c,p,col)=>kerchief(c,col),robe:(c,J,p,col)=>songRobe(c,J,col),
  over:(c,J)=>belt(c,J,CRIM,1.6),weapon:(c,J,p)=>dao(c,J,p,5.4)};
UNITS.chn_boss={name:'شيخ العصا',aura:true,twoH:true,sx:0.98,sy:1.04,lw:2.9,headR:3.5,head:(c,p,col)=>headbandRibbon(c,CRIM),robe:(c,J,p,col)=>songRobe(c,J,col,0.6),
  over:(c,J)=>belt(c,J,JADE,1.8),weapon(c,J,p){const s=staff(c,J,p,6,8,1.4,'#7a5a3a');circ2(c,s.B,0.8,'#5a4632');circ2(c,s.A,0.8,'#5a4632');}};
UNITS.chn_healer={name:'الطبيب الجوال',sx:0.98,sy:1.02,lw:2.8,headR:3.5,head:(c,p)=>douli(c),robe:(c,J,p,col)=>songRobe(c,J,col,0.8),
  back(c,J,p,col){const Q=add(J.mid,rot(-2.6,-0.6,J.pl));rrect(c,Q[0]-2.4,Q[1]-3,4.2,5,1,'#a8884e');for(let k=0;k<3;k++)limb(c,Q[0]-2.2,Q[1]-2+k*1.6,Q[0]+1.6,Q[1]-2+k*1.6,0.35,'#7a6234');},
  over(c,J,p,col){belt(c,J,JADE,1.4);const o=add(J.hip,rot(2.4,-0.6,J.pl));ell(c,o[0],o[1]+1.6,1.1,1.4,'#c98a3a');ell(c,o[0],o[1]-0.2,0.7,0.8,'#c98a3a');},
  weapon(c,J,p){const h=J.handF;ell(c,h[0]+0.4,h[1]-0.6,1.4,1.7,'#c98a3a');ell(c,h[0]+0.4,h[1]-2.6,0.9,1,'#c98a3a');limb(c,h[0]-0.6,h[1]-1.6,h[0]+1.4,h[1]-1.6,0.5,CRIM);}};
UNITS.chn_hero={name:'زعيم ليانغشان',hero:true,twoH:true,sx:1.0,sy:1.06,lw:3.0,headR:3.5,head(c,p,col){ell(c,0,-2,4,2.4,INK);rrect(c,-1.8,-6.6,3.6,3.2,0.6,INK);limb(c,-1.6,-5,-5,-2,0.6,CRIM);},
  back(c,J,p,col){const b=add(J.chest,rot(-1.6,-0.4,J.a2)),t=[b[0]-1.4,b[1]-15];limb(c,b[0],b[1]+3,t[0],t[1],0.9,'#5a4632');
    pg(c,[t,[t[0]-8,t[1]+1],[t[0]-8,t[1]+7.5],[t[0],t[1]+6.5]],APRI,CRIM,0.8);for(let k=0;k<3;k++)limb(c,t[0]-6.4+k*2.2,t[1]+2.4,t[0]-6.4+k*2.2,t[1]+5.6,0.5,CRIM);},
  robe:(c,J,p,col)=>songRobe(c,J,col,0.82),over:(c,J)=>belt(c,J,GOLD,2),
  weapon(c,J,p){const s=staff(c,J,p,4,9,1.3,'#5a3a22'),d=s.d,n=[-d[1],d[0]],B=s.B;pg(c,[B,[B[0]+d[0]*4.6+n[0]*0.6,B[1]+d[1]*4.6+n[1]*0.6],[B[0]+d[0]*2.4-n[0]*1.8,B[1]+d[1]*2.4-n[1]*1.8]],STEEL2);}};
/* --- اليابان --- */
UNITS.jpn_common={name:'كابوكيمونو',sx:0.96,sy:1.05,lw:2.8,headR:3.5,head:(c,p)=>wildHair(c),robe:(c,J,p,col)=>kimono(c,J,col,0.72,true),
  over:(c,J)=>obi(c,J,GOLD),weapon:(c,J,p)=>katana(c,J.handF,p.wa,7)};
UNITS.jpn_kiseru={name:'حامل الغليون',sx:0.97,sy:1.05,lw:2.8,headR:3.5,head:(c,p)=>wildHair(c),robe:(c,J,p,col)=>kimono(c,J,col,0.76,true),over:(c,J)=>obi(c,J,CRIM),
  weapon(c,J,p){const s=staff(c,J,p,3,11,1,'#3a2a26'),d=s.d,B=s.B;ell(c,B[0],B[1],1.3,0.9,GOLD);limb(c,s.A[0],s.A[1],s.A[0]+d[0]*1.4,s.A[1]+d[1]*1.4,1.2,GOLD);
    c.save();c.globalAlpha*=0.4;ell(c,B[0]+0.6,B[1]-2.6,1.2,1.2,'#d9d6cf');ell(c,B[0]+1.4,B[1]-4.8,1.6,1.6,'#d9d6cf');c.restore();}};
UNITS.jpn_dual={name:'مبارز السيفين',sx:0.95,sy:1.05,lw:2.7,headR:3.5,head(c,p){wildHair(c);ell(c,0,-2.1,4,0.8,CRIM);},robe:(c,J,p,col)=>kimono(c,J,col,0.68,true),over:(c,J)=>obi(c,J,INK),
  back(c,J,p){katana(c,J.handB,p.wa+0.9,5,1);},weapon:(c,J,p)=>katana(c,J.handF,p.wa,6.5)};
UNITS.jpn_hero={name:'زعيم الكابوكيمونو',hero:true,sx:1.0,sy:1.07,lw:3.0,headR:3.5,head(c,p){wildHair(c);rrect(c,-0.4,-8.2,0.8,2.4,0.3,GOLD);ell(c,0,-8.4,1,0.6,CRIM);},
  back(c,J,p,col){const hb=lp(J.legB.h,J.legB.k,0.9);pg(c,[add(J.chest,rot(-2.6,-0.6,J.a2)),add(J.chest,rot(1.2,-0.4,J.a2)),[hb[0]+1,hb[1]],[hb[0]-4.2,hb[1]]],INK,GOLD,0.8);
    for(let k=0;k<4;k++)ell(c,hb[0]-3.6+k*1.3,hb[1]+0.2,0.5,0.5,'#6a6a70');},
  robe:(c,J,p,col)=>kimono(c,J,col,0.82,true),over(c,J,p,col){obi(c,J,GOLD);const A=add(J.chest,rot(1.8,0,J.a2)),B=add(J.hip,rot(2.4,-1,J.pl));limb(c,A[0],A[1],B[0],B[1],1.2,INK);},
  weapon:(c,J,p)=>katana(c,J.handF,p.wa,8.6,1.4)};
/* --- كوريا --- */
UNITS.kor_common={name:'فتى الهوارانغ',sx:0.97,sy:1.04,lw:2.8,headR:3.5,head:(c,p)=>topknotFlower(c),robe:(c,J,p,col)=>hanbok(c,J,col),over:(c,J)=>sash(c,J,PINK),
  weapon(c,J,p){circ2(c,[J.handF[0]+0.6,J.handF[1]-0.6],1.3,'#8a857c');}};
UNITS.kor_archer={name:'الرامي الدقيق',sx:0.97,sy:1.05,lw:2.8,headR:3.5,head:(c,p)=>topknotFlower(c),robe:(c,J,p,col)=>hanbok(c,J,col,0.5),
  back(c,J,p,col){const A=add(J.chest,rot(-1.6,-1.2,J.a2)),B=add(J.mid,rot(-2.2,2,J.pl));limb(c,A[0],A[1],B[0],B[1],2,'#5a3a2a');for(let k=0;k<3;k++)tri(c,[A[0]-0.6+k*0.6,A[1]],[A[0]-0.2+k*0.6,A[1]-2],[A[0]+0.2+k*0.6,A[1]],'#f2f0e8');},
  over:(c,J)=>sash(c,J,SKY),weapon:(c,J,p)=>recurve(c,J,p)};
UNITS.kor_fire={name:'رامي السهام المشتعلة',sx:0.98,sy:1.04,lw:2.9,headR:3.5,head:(c,p)=>topknotFlower(c),robe:(c,J,p,col)=>hanbok(c,J,col,0.46),over:(c,J)=>sash(c,J,CRIM),
  weapon(c,J,p){recurve(c,J,p,'#5a2a22');const d=wdir(p.wa),h=J.handF,T=[h[0]+d[0]*5,h[1]+d[1]*5];limb(c,h[0]-d[0]*1,h[1]-d[1]*1,T[0],T[1],0.5,'#d8c8a8');flame(c,T[0],T[1]+0.8,0.75);}};
UNITS.kor_hero={name:'قائد الهوارانغ',hero:true,sx:1.0,sy:1.07,lw:3.0,headR:3.5,head:(c,p)=>topknotFlower(c,true),
  back(c,J,p,col){const hb=lp(J.legB.k,J.legB.f,0.6);pg(c,[add(J.chest,rot(-2.4,-0.6,J.a2)),add(J.chest,rot(1.2,-0.4,J.a2)),[hb[0]+1,hb[1]],[hb[0]-4.6,hb[1]]],'#f2f0e8',SKY,0.9);},
  robe:(c,J,p,col)=>hanbok(c,J,col,0.62),over:(c,J)=>sash(c,J,PINK),weapon:(c,J,p)=>recurve(c,J,p,GOLD)};
const NATIONS=[['chn','الصين','إخوة الجبل',['chn_common','chn_boss','chn_healer','chn_hero']],
  ['jpn','اليابان','الكابوكيمونو',['jpn_common','jpn_kiseru','jpn_dual','jpn_hero']],
  ['kor','كوريا','الهوارانغ',['kor_common','kor_archer','kor_fire','kor_hero']]];
