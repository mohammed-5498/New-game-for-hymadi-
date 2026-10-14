/* ===================== الدفعة 4 — مظاهر الأمم الأفريقية: إثيوبيا، نيجيريا، السودان ===================== */
const ETG='#2e8b57',ETY='#e8c23a',ETR='#c8322a',MANE='#c9923a',MANE2='#a8742a',INDG='#24325e',CREAM='#efe9dc',OCHRE='#c98a3a';
const UNITS={};
function torso(c,J,fill,st,inset){const i=inset||0,a=J.a2,pl=J.pl;
  const P=[add(J.chest,rot(-2.2+i,-0.2,a)),add(J.chest,rot(2.4-i,-0.2,a)),add(J.hip,rot(2.6-i,-1,pl)),add(J.hip,rot(-2.4+i,-1,pl))];pg(c,P,fill,st,0.5);return P;}
/* --- إثيوبيا: الشمّا البيضاء بحواف "تيبب" ملونة، الشوتيل المعقوف، الدرع الجلدي، عرف الأسد --- */
function shamma(c,J,col,len){const r=robe(c,J,len||0.86,mixHex(col,'#f4f1ea',0.62),dk(col,0.25),'chest',1.6);stripes(c,r,[0.9,0.95],[ETG,ETR],0.7);
  const a=J.a2,A=add(J.chest,rot(-2.4,-0.4,a)),B=add(J.hip,rot(2.8,0,J.pl));limb(c,A[0],A[1],B[0],B[1],1.4,mixHex(col,'#ffffff',0.75));limb(c,A[0]+0.4,A[1]+0.9,B[0]+0.4,B[1]+0.9,0.5,ETY);return r;}
function netela(c,col){c.beginPath();c.ellipse(0,-1,4.3,3.9,0,Math.PI,0);c.fillStyle=mixHex(col,'#f4f1ea',0.75);c.fill();pg(c,[[-4.3,-1],[-5.2,4.6],[-2.2,4],[-2.4,-0.4]],mixHex(col,'#f4f1ea',0.75));limb(c,-5,4.4,-2.3,3.9,0.6,ETG);}
function maneHead(c,big){const n=big?16:11,R=big?6.8:5.4;for(let k=0;k<n;k++){const a=Math.PI*0.55+k/(n-1)*Math.PI*1.25;tri(c,[Math.cos(a)*2.6,Math.sin(a)*2.6-0.6],[Math.cos(a)*R,Math.sin(a)*R-0.8],[Math.cos(a+0.25)*2.6,Math.sin(a+0.25)*2.6-0.6],k%2?MANE:MANE2);}
  ell(c,0,-2.4,3.9,1,'#d9b06a');ell(c,0,-2.4,3.9,0.4,'#b8c0c8');}
function shotel(c,J,p,L){const d=wdir(p.wa),n=[-d[1],d[0]],h=J.handF,T=[h[0]+d[0]*L*0.55-n[0]*L*0.45,h[1]+d[1]*L*0.55-n[1]*L*0.45],cp=[h[0]+d[0]*L*1.05+n[0]*L*0.25,h[1]+d[1]*L*1.05+n[1]*L*0.25];
  limb(c,h[0]-d[0]*1.2,h[1]-d[1]*1.2,h[0]+d[0]*0.6,h[1]+d[1]*0.6,1.2,'#4a3424');c.beginPath();c.moveTo(h[0]+d[0]*0.6,h[1]+d[1]*0.6);c.quadraticCurveTo(cp[0],cp[1],T[0],T[1]);c.strokeStyle=STEEL2;c.lineWidth=1.2;c.lineCap='round';c.stroke();}
function gasha(c,P,r,deco){circ2(c,P,r,'#7a4a2a');circ2(c,P,r*0.82,'#9a6236');circ2(c,P,r*0.3,deco?'#c9ced4':'#5a3a22');if(deco)for(let k=0;k<6;k++){const a=k*1.047;circ2(c,[P[0]+Math.cos(a)*r*0.6,P[1]+Math.sin(a)*r*0.6],0.45,'#c9ced4');}}
UNITS.eth_common={name:'محارب عدوة',sx:0.98,sy:1.03,lw:2.9,headR:3.5,head:(c,p,col)=>netela(c,col),robe:(c,J,p,col)=>shamma(c,J,col,0.78),
  back(c,J,p){gasha(c,J.handB,3.4);},weapon:(c,J,p)=>shotel(c,J,p,6)};
UNITS.eth_drum={name:'قارع النقارة',aura:true,sx:1.05,sy:1.03,lw:3.1,headR:3.6,head:(c,p,col)=>netela(c,col),robe:(c,J,p,col)=>shamma(c,J,col,0.8),
  over(c,J,p,col){const D=add(J.hip,rot(3.2,-0.4,J.pl));ell(c,D[0],D[1]+2.4,3.2,1.2,'#7a4a2a');rrect(c,D[0]-3.2,D[1]-0.2,6.4,2.6,0.4,'#9a5a2e');ell(c,D[0],D[1]-0.2,3.2,1.2,'#e6d6b4');
    for(let k=0;k<4;k++)limb(c,D[0]-2.6+k*1.7,D[1]+0.4,D[0]-2.2+k*1.7,D[1]+2.2,0.4,'#5a3a22');limb(c,D[0]-3,D[1]-0.2,J.chest[0]-1,J.chest[1],0.5,'#5a3a22');},
  weapon(c,J,p){const d=wdir(p.wa),h=J.handF;limb(c,h[0],h[1],h[0]+d[0]*4,h[1]+d[1]*4,0.9,'#5a3a22');circ2(c,[h[0]+d[0]*4.2,h[1]+d[1]*4.2],0.9,'#e6d6b4');}};
UNITS.eth_healer={name:'المعالج',sx:0.98,sy:1.02,lw:2.8,headR:3.5,head(c,p,col){ell(c,0,-1.8,4,2.2,mixHex(col,'#f4f1ea',0.75));limb(c,-3.4,-1.6,3.6,-1.6,0.6,ETY);},robe:(c,J,p,col)=>shamma(c,J,col,0.9),
  over(c,J,p,col){const o=add(J.hip,rot(-2.2,-0.8,J.pl));rrect(c,o[0]-1.6,o[1]-0.4,3,3,0.6,'#8a5a36');limb(c,o[0]-1.2,o[1]+0.6,o[0]+1.2,o[1]+0.6,0.4,ETR);},
  weapon(c,J,p){const h=J.handF;c.beginPath();c.moveTo(h[0]-1,h[1]+1);c.quadraticCurveTo(h[0]+2.6,h[1]-0.4,h[0]+1.6,h[1]-3.6);c.strokeStyle='#d9c8a0';c.lineWidth=1.6;c.stroke();ell(c,h[0]+1.6,h[1]-3.8,0.8,0.5,'#5a4a32');}};
UNITS.eth_hero={name:'الراس',hero:true,sx:1.04,sy:1.08,lw:3.1,headR:3.6,head:(c,p)=>maneHead(c,true),
  back(c,J,p,col){const a=J.a2,S=[add(J.chest,rot(-3,-0.8,a)),add(J.chest,rot(1.8,-0.6,a))],hb=lp(J.legB.h,J.legB.k,0.7);
    pg(c,[S[0],S[1],[hb[0]+1.8,hb[1]],[hb[0]-4.6,hb[1]]],MANE2);for(let k=0;k<7;k++){const t=k/6,P=lp([hb[0]-4.6,hb[1]],[hb[0]+1.8,hb[1]],t);tri(c,[P[0]-0.7,P[1]],[P[0],P[1]+2.4],[P[0]+0.7,P[1]],k%2?MANE:MANE2);}
    gasha(c,J.handB,4.4,true);},
  robe:(c,J,p,col)=>shamma(c,J,col,0.84),
  weapon(c,J,p){const s=staff(c,J,p,4,9,1,'#5a3a22'),d=s.d,B=s.B;tri(c,[B[0]-d[1]*0.9,B[1]+d[0]*0.9],[B[0]+d[0]*3,B[1]+d[1]*3],[B[0]+d[1]*0.9,B[1]-d[0]*0.9],STEEL2);}};
/* --- نيجيريا: إزار مصبوغ بنيلي كانو، قبعة "هولا" مطرزة، اليد الضاربة ملفوفة، تمائم، درع قطني محشو --- */
function hula(c){c.beginPath();c.ellipse(0,-1.4,3.9,3.4,0,Math.PI,0);c.fillStyle=CREAM;c.fill();for(let k=0;k<3;k++){c.beginPath();c.ellipse(0,-1.4,3.9-k*1.1,3.4-k*1,0,Math.PI,0);c.strokeStyle=k%2?ETR:INDG;c.lineWidth=0.4;c.stroke();}}
function veilTurban(c){ell(c,0,-1.9,4.3,2.5,INDG);pg(c,[[0.4,0.2],[3.8,-0.4],[3.6,2.6],[0.4,2.9]],INDG);limb(c,-3.6,-1.6,3.8,-2.2,0.4,'#3a4a7e');}
function indigoWrap(c,J,col,len){const r=robe(c,J,len||0.45,INDG,'#1a2448','waist',1);for(let k=0;k<5;k++){const t=0.2+k*0.16,A=lp(r.w1,r.hemB,t),B=lp(r.w2,r.hemF,t);
  for(let m=0;m<4;m++){const P=lp(A,B,0.15+m*0.24);circ2(c,P,0.35,'#5a6ea8');}}belt(c,J,col,1.2);return r;}
function wrappedFist(c,P,big){const s=big?1.25:1;circ2(c,P,1.7*s,CREAM);for(let k=0;k<3;k++)limb(c,P[0]-1.4*s,P[1]-1+k*1,P[0]+1.4*s,P[1]-0.6+k*1,0.35,'#b8a888');limb(c,P[0]-1,P[1]+1.4*s,P[0]-1.6,P[1]+3.6*s,0.5,ETR);}
function amulets(c,J,n){for(let k=0;k<n;k++){const P=lp(J.Sf,J.elbowF||J.Sf,0.4+k*0.25);rrect(c,P[0]-0.7,P[1]-0.6,1.4,1.2,0.2,'#6a4428');}}
function quilted(c,J,col){const P=torso(c,J,mixHex(col,'#efe2c6',0.55),dk(col,0.3));for(let k=1;k<4;k++){const A=lp(P[0],P[3],k/4),B=lp(P[1],P[2],k/4);limb(c,A[0],A[1],B[0],B[1],0.4,'#8a7a5a');
  const C=lp(P[0],P[1],k/4),D=lp(P[3],P[2],k/4);limb(c,C[0],C[1],D[0],D[1],0.4,'#8a7a5a');}return P;}
UNITS.nga_common={name:'مقاتل الدمبي',sx:1.02,sy:1.0,lw:3.1,headR:3.6,head:(c,p)=>hula(c),robe:(c,J,p,col)=>indigoWrap(c,J,col),
  front(c,J,p){wrappedFist(c,J.handF);},back(c,J,p){limb(c,J.handB[0],J.handB[1],J.handB[0]+0.8,J.handB[1]-1.4,0.9,'#d9c8a0');}};
UNITS.nga_guard={name:'حارس السور',sx:1.1,sy:0.98,lw:3.4,headR:3.7,head:(c,p)=>veilTurban(c),chest:(c,J,p,col)=>quilted(c,J,col),robe:(c,J,p,col)=>indigoWrap(c,J,col,0.7),
  front(c,J,p){const h=J.handF;circ2(c,[h[0]+1.2,h[1]],5.2,'#6a4428');circ2(c,[h[0]+1.2,h[1]],4.4,'#8a5a36');limb(c,h[0]+1.2,h[1]-4.2,h[0]+1.2,h[1]+4.2,0.6,CREAM);limb(c,h[0]-3,h[1],h[0]+5.4,h[1],0.6,CREAM);circ2(c,[h[0]+1.2,h[1]],1.1,'#c9a04a');}};
UNITS.nga_heavy={name:'الملاكم الثقيل',sx:1.14,sy:1.0,lw:3.7,headR:3.8,head(c,p){ell(c,-0.4,-2.6,3.4,1.2,INDG);},robe:(c,J,p,col)=>indigoWrap(c,J,col,0.5),
  front(c,J,p){amulets(c,J,2);wrappedFist(c,J.handF,true);},back(c,J,p){wrappedFist(c,J.handB);}};
UNITS.nga_hero={name:'بطل الدمبي',hero:true,sx:1.08,sy:1.06,lw:3.4,headR:3.7,head(c,p){hula(c);ell(c,0,-4.6,1,0.8,ETR);},
  chest(c,J,p,col){const a=J.a2;for(let k=0;k<3;k++){const A=add(J.chest,rot(-1.6+k*0.4,-1+k*0.6,a)),B=add(J.chest,rot(1.8+k*0.2,0.4+k*1.2,a));c.beginPath();c.moveTo(A[0],A[1]);c.quadraticCurveTo((A[0]+B[0])/2,(A[1]+B[1])/2+1.4,B[0],B[1]);c.strokeStyle=k%2?ETR:'#c9a04a';c.lineWidth=0.6;c.stroke();}},
  robe(c,J,p,col){const r=robe(c,J,0.55,ETR,'#6a1a16','waist',1.2);stripes(c,r,[0.4,0.75],[CREAM,'#c9a04a'],0.6);belt(c,J,'#c9a04a',1.8);},
  front(c,J,p){amulets(c,J,3);wrappedFist(c,J.handF,true);}};
/* --- السودان: ثياب بيضاء ومغرة، عصابة رأس بريشة (كما يصوّر رماة النوبة)، قوس طويل، مشاعل، تاج الكنداكة --- */
function featherBand(c,n){ell(c,0,-1.8,4,0.8,OCHRE);for(let k=0;k<(n||1);k++){c.beginPath();c.moveTo(-1.4-k*1.2,-2.2);c.quadraticCurveTo(-2.4-k*1.6,-6,-0.8-k*1.4,-8.4);c.lineTo(-0.2-k*1.2,-7.8);c.quadraticCurveTo(-1.6-k*1.4,-5.6,-0.6-k*1.2,-2.2);c.closePath();c.fillStyle=k%2?'#2a2a2a':'#f2efe6';c.fill();}}
const kilt=(c,J,col,len)=>{const r=robe(c,J,len||0.5,mixHex(col,'#f4f1ea',0.62),dk(col,0.25),'waist',1.2);stripes(c,r,[0.85],[OCHRE],0.8);belt(c,J,OCHRE,1.4);return r;};
function longbow(c,J,p,col){c.save();c.translate(J.handF[0],J.handF[1]);c.rotate(p.wa);c.beginPath();c.moveTo(0,-9);c.quadraticCurveTo(3.2,0,0,9);c.strokeStyle=col||'#6a4a2a';c.lineWidth=1.3;c.stroke();
  limb(c,-0.6,-8.8,-0.6,8.8,0.35,'#ece6d6');c.restore();}
UNITS.sdn_common={name:'فتى النوبة',sx:0.97,sy:1.04,lw:2.8,headR:3.5,head:(c,p)=>featherBand(c),robe:(c,J,p,col)=>kilt(c,J,col),
  weapon(c,J,p){circ2(c,[J.handF[0]+0.6,J.handF[1]-0.6],1.3,'#8a857c');}};
UNITS.sdn_archer={name:'الرامي الطويل',sx:0.97,sy:1.06,lw:2.8,headR:3.5,head:(c,p)=>featherBand(c,2),robe:(c,J,p,col)=>kilt(c,J,col,0.56),
  back(c,J,p,col){const A=add(J.chest,rot(-1.6,-1.2,J.a2)),B=add(J.mid,rot(-2.2,2,J.pl));limb(c,A[0],A[1],B[0],B[1],2,'#7a4a2a');for(let k=0;k<3;k++)tri(c,[A[0]-0.6+k*0.6,A[1]],[A[0]-0.2+k*0.6,A[1]-2],[A[0]+0.2+k*0.6,A[1]],'#f2efe6');},
  weapon:(c,J,p)=>longbow(c,J,p)};
UNITS.sdn_torch={name:'رامي المشاعل',sx:0.99,sy:1.03,lw:2.9,headR:3.5,head:(c,p)=>featherBand(c),robe:(c,J,p,col)=>kilt(c,J,col,0.52),
  back(c,J,p){for(let k=0;k<2;k++){const A=add(J.chest,rot(-2+k*0.8,-1,J.a2)),B=add(J.mid,rot(-2.6+k*0.8,2.4,J.pl));limb(c,A[0],A[1],B[0],B[1],0.9,'#6a4a2a');}},
  weapon(c,J,p){const d=wdir(p.wa),h=J.handF,T=[h[0]+d[0]*4.6,h[1]+d[1]*4.6];limb(c,h[0]-d[0]*1,h[1]-d[1]*1,T[0],T[1],1.1,'#6a4a2a');
    c.save();const g=c.createRadialGradient(T[0],T[1]-1.6,0,T[0],T[1]-1.6,5);g.addColorStop(0,'rgba(255,170,60,0.6)');g.addColorStop(1,'rgba(255,170,60,0)');c.fillStyle=g;c.beginPath();c.arc(T[0],T[1]-1.6,5,0,TAU);c.fill();c.restore();
    tri(c,[T[0]-1.3,T[1]],[T[0],T[1]-4.2],[T[0]+1.3,T[1]],'#f0902a');tri(c,[T[0]-0.7,T[1]],[T[0],T[1]-2.6],[T[0]+0.7,T[1]],'#ffd45a');}};
UNITS.sdn_hero={name:'الكنداكة',hero:true,sx:1.0,sy:1.08,lw:2.9,headR:3.5,
  head(c,p){c.beginPath();c.ellipse(0,-1.2,4.1,3.8,0,Math.PI,0);c.fillStyle='#c9a04a';c.fill();ell(c,0,-1.4,4.2,0.8,'#e0b84a');
    for(let k=0;k<2;k++){c.beginPath();c.moveTo(-0.6+k*1.2,-4.6);c.quadraticCurveTo(-1.4+k*1.6,-9,-0.2+k*1.2,-11);c.lineTo(0.4+k*1.2,-10.4);c.quadraticCurveTo(-0.4+k*1.4,-8,0.4+k*1.2,-4.6);c.closePath();c.fillStyle='#f2efe6';c.fill();}
    circ2(c,[2.6,-3.2],0.7,'#2f8f8a');},
  back(c,J,p,col){const q=lp(J.legB.k,J.legB.f,0.85);pg(c,[add(J.chest,rot(-2.2,-0.4,J.a2)),add(J.chest,rot(1,0,J.a2)),q,[q[0]-4.6,q[1]]],OCHRE,'#c9a04a',0.8);},
  robe(c,J,p,col){const r=robe(c,J,0.94,mixHex(col,'#f4f1ea',0.55),dk(col,0.25),'chest',2);stripes(c,r,[0.55,0.9],['#c9a04a',OCHRE],0.9);
    for(let k=0;k<6;k++){const P=lp(r.hemB,r.hemF,k/5);limb(c,P[0],P[1],P[0],P[1]+1.4,0.4,'#c9a04a');}},
  over(c,J,p,col){belt(c,J,'#c9a04a',1.6);},weapon:(c,J,p)=>longbow(c,J,p,'#c9a04a')};
const NATIONS=[['eth','إثيوبيا','أبطال عدوة',['eth_common','eth_drum','eth_healer','eth_hero']],
  ['nga','نيجيريا','مقاتلو الدمبي',['nga_common','nga_guard','nga_heavy','nga_hero']],
  ['sdn','السودان','رماة النوبة',['sdn_common','sdn_archer','sdn_torch','sdn_hero']]];
