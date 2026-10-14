/* ===================== الدفعة 5 — مظاهر الأمم اللاتينية: البرازيل، الأرجنتين، المكسيك ===================== */
const UNITS={};
const QUET='#2f8f5a',TURQ='#2fa8a0',JAG='#d9a23a',CREAM='#efe9dc',TANGO='#1e1e22',RED3='#b8322c';
function torso(c,J,fill,st,inset){const i=inset||0,a=J.a2,pl=J.pl;
  const P=[add(J.chest,rot(-2.2+i,-0.2,a)),add(J.chest,rot(2.4-i,-0.2,a)),add(J.hip,rot(2.6-i,-1,pl)),add(J.hip,rot(-2.4+i,-1,pl))];pg(c,P,fill,st,0.5);return P;}
/* سروال واسع فوق الساقين (أبيض الكابويرا، بومباتشا الغاوتشو) */
function pants(c,J,col,w,len){[J.legB,J.legF].forEach((L,n)=>{const A=L.h,K=L.k,F=legPt(L,len||0.92);c.beginPath();c.moveTo(A[0],A[1]);c.lineTo(K[0],K[1]);c.lineTo(F[0],F[1]);
  c.strokeStyle=n?col:dk(col,0.12);c.lineWidth=w||3.6;c.lineCap='round';c.lineJoin='round';c.stroke();});}
/* --- البرازيل: سروال أبيض، حبل الخصر الملون، شريط الرأس (لون الاتحاد)، صدر عارٍ، البيريمباو، المعلّم ببذلة بيضاء وقبعة قش --- */
function ribbonBand(c,col){ell(c,0,-2.2,4,0.8,col);tri(c,[-3.6,-2.2],[-6.4,1.4],[-3,-1.2],col);}
function corda(c,J,col){belt(c,J,col,1.2);const o=add(J.hip,rot(1.6,-1.3,J.pl)),e=lp(J.legF.h,J.legF.k,0.8);limb(c,o[0],o[1],e[0]+0.6,e[1],0.6,col);}
function berimbau(c,J,p){const s=staff(c,J,p,5,9,1,'#8a6a3e'),d=s.d,n=[-d[1],d[0]];c.beginPath();c.moveTo(s.A[0],s.A[1]);c.quadraticCurveTo((s.A[0]+s.B[0])/2+n[0]*2.4,(s.A[1]+s.B[1])/2+n[1]*2.4,s.B[0],s.B[1]);
  c.strokeStyle='#d9d4c8';c.lineWidth=0.35;c.stroke();const g=lp(s.A,s.B,0.18);circ2(c,[g[0]+n[0]*1.6,g[1]+n[1]*1.6],1.7,'#c9a25a');circ2(c,[g[0]+n[0]*1.6,g[1]+n[1]*1.6],0.8,'#7a5a2e');}
function club(c,J,p,L){const s=staff(c,J,p,1.2,L,1.3,'#6a4a2a');circ2(c,s.B,1.1,'#5a3a22');}
function knifeB(c,from,a,L){const d=wdir(a);limb(c,from[0]-d[0]*0.8,from[1]-d[1]*0.8,from[0]+d[0]*0.8,from[1]+d[1]*0.8,1.2,'#3a2a22');limb(c,from[0]+d[0]*0.8,from[1]+d[1]*0.8,from[0]+d[0]*L,from[1]+d[1]*L,0.9,STEEL2);}
const capoPants=(c,J,col)=>{pants(c,J,mixHex(col,'#f6f3ec',0.72),3.6);};
UNITS.bra_common={name:'كابويرا الشارع',sx:0.96,sy:1.04,lw:2.8,headR:3.4,head:(c,p)=>ribbonBand(c,'#f2efe6'),robe:(c,J,p,col)=>capoPants(c,J,col),over:(c,J)=>corda(c,J,'#e8c23a'),weapon:(c,J,p)=>club(c,J,p,5.4)};
UNITS.bra_berim={name:'عازف البيريمباو',sx:0.97,sy:1.05,lw:2.8,headR:3.4,head:(c,p)=>ribbonBand(c,RED3),robe:(c,J,p,col)=>capoPants(c,J,col),over:(c,J)=>corda(c,J,'#2f8f5a'),weapon:(c,J,p)=>berimbau(c,J,p)};
UNITS.bra_acro={name:'الأكروبات',sx:0.94,sy:1.05,lw:2.7,headR:3.4,head(c,p){ell(c,-0.4,-1.8,3.6,2,'#2a2220');},robe:(c,J,p,col)=>capoPants(c,J,col),over:(c,J)=>corda(c,J,'#3a7ac2'),
  back:(c,J,p)=>knifeB(c,J.handB,p.wa+0.8,3.8),weapon:(c,J,p)=>knifeB(c,J.handF,p.wa,4.2)};
UNITS.bra_hero={name:'المعلّم',hero:true,sx:1.0,sy:1.07,lw:2.9,headR:3.5,
  head(c,p){ell(c,0,-2.2,5.6,1.1,'#e8d8a8');c.beginPath();c.ellipse(0,-2.4,3.4,2.8,0,Math.PI,0);c.fillStyle='#efe2b8';c.fill();ell(c,0,-2.6,3.4,0.6,RED3);},
  chest(c,J,p,col){const P=torso(c,J,'#f4f1ea',dk(col,0.25));limb(c,...lp(P[0],P[1],0.5),...lp(P[3],P[2],0.5),0.5,'#d8d2c4');limb(c,...add(J.chest,rot(0.4,-1,J.a2)),...add(J.chest,rot(1.2,1.6,J.a2)),0.9,col);},
  robe(c,J,p,col){pants(c,J,'#f4f1ea',3.4);},over:(c,J)=>belt(c,J,'#c9a04a',0.8),weapon:(c,J,p)=>knifeB(c,J.handF,p.wa,4.6)};
/* --- الأرجنتين: قبعة "تشامبيرغو" مائلة، منديل حريري أبيض، سترة داكنة، سكين الفاكون، معطف ملفوف على الذراع، الغاوتشو بالبونشو والبولياداس --- */
function chambergo(c,col){c.save();c.rotate(0.16);ell(c,0,-2.2,5.4,1,col);c.beginPath();c.moveTo(-3,-2.2);c.lineTo(-2.6,-5.4);c.quadraticCurveTo(0,-6.4,2.6,-5.4);c.lineTo(3,-2.2);c.closePath();c.fillStyle=col;c.fill();
  ell(c,0,-2.8,3,0.5,dk(col,0.3));limb(c,-1,-5.8,1,-5.8,0.6,dk(col,0.25));c.restore();}
function silkScarf(c,J){const a=J.a2,A=add(J.chest,rot(-1.6,-1.2,a)),B=add(J.chest,rot(2,-1.2,a));limb(c,A[0],A[1],B[0],B[1],1.3,'#f4f1ea');limb(c,B[0],B[1],B[0]+0.6,B[1]+3,1,'#f4f1ea');}
function facon(c,J,p,L){const d=wdir(p.wa),n=[-d[1],d[0]],h=J.handF;limb(c,h[0]-d[0]*1,h[1]-d[1]*1,h[0]+d[0]*0.6,h[1]+d[1]*0.6,1.3,'#c9c4b8');
  limb(c,h[0]+d[0]*0.6+n[0]*1.2,h[1]+d[1]*0.6+n[1]*1.2,h[0]+d[0]*0.6-n[0]*1.2,h[1]+d[1]*0.6-n[1]*1.2,0.7,'#c9a04a');
  pg(c,[[h[0]+d[0]*0.8+n[0]*0.6,h[1]+d[1]*0.8+n[1]*0.6],[h[0]+d[0]*L,h[1]+d[1]*L],[h[0]+d[0]*0.8-n[0]*0.5,h[1]+d[1]*0.8-n[1]*0.5]],STEEL2);}
function wrappedCoat(c,J,col){const h=J.handB;circ2(c,h,2.3,col);for(let k=0;k<3;k++)limb(c,h[0]-2,h[1]-1+k,h[0]+2,h[1]-0.6+k,0.4,dk(col,0.25));tri(c,[h[0]-1,h[1]+1.6],[h[0]-2.4,h[1]+5],[h[0]+1,h[1]+2],col);}
function suitTorso(c,J,col){const P=torso(c,J,TANGO,dk(col,0.4));const Q=torso(c,J,mixHex(col,'#f4f1ea',0.5),null,1.3);limb(c,...lp(P[0],P[1],0.5),...lp(P[3],P[2],0.4),0.6,'#4a4a50');return P;}
function poncho(c,J,col,stripe){const a=J.a2,S1=add(J.chest,rot(-3.2,-0.6,a)),S2=add(J.chest,rot(3.4,-0.4,a)),F=lp(J.legF.h,J.legF.k,0.55),B=lp(J.legB.h,J.legB.k,0.55);
  pg(c,[S1,S2,[F[0]+2.6,F[1]],[(F[0]+B[0])/2,Math.max(F[1],B[1])+1.4],[B[0]-2.6,B[1]]],col,dk(col,0.3),0.5);
  for(let k=1;k<=2;k++){const A=lp(S1,[B[0]-2.6,B[1]],k*0.3),Bp=lp(S2,[F[0]+2.6,F[1]],k*0.3);limb(c,A[0],A[1],Bp[0],Bp[1],0.7,stripe);}}
function bolas(c,J,p,t){const h=J.handF,d=wdir(p.wa-0.6);for(let k=0;k<3;k++){const a=Math.atan2(d[1],d[0])+(k-1)*0.5,E=[h[0]+Math.cos(a)*5.4,h[1]+Math.sin(a)*5.4];limb(c,h[0],h[1],E[0],E[1],0.4,'#8a6a44');circ2(c,E,1,'#7a6a5a');}}
UNITS.arg_common={name:'كومبادريتو',sx:0.96,sy:1.05,lw:2.8,headR:3.4,head:(c,p)=>chambergo(c,TANGO),chest:(c,J,p,col)=>suitTorso(c,J,col),over:(c,J)=>silkScarf(c,J),
  robe:(c,J,p,col)=>pants(c,J,dk(col,0.15),3.2),back:(c,J,p,col)=>wrappedCoat(c,J,'#3a3a40'),weapon:(c,J,p)=>facon(c,J,p,5.2)};
UNITS.arg_gaucho={name:'الغاوتشو بالبولياداس',sx:0.98,sy:1.05,lw:2.9,headR:3.5,head(c,p){c.save();c.rotate(-0.1);ell(c,0,-2.6,4.2,1.6,'#2a2a2e');c.restore();},
  robe(c,J,p,col){pants(c,J,mixHex(col,'#f4f1ea',0.6),4.4,0.8);belt(c,J,RED3,1.8);},over:(c,J,p,col)=>poncho(c,J,mixHex(col,'#8a5a36',0.35),'#e8c23a'),weapon:(c,J,p)=>bolas(c,J,p)};
UNITS.arg_shawl={name:'المبارز بالشال',sx:0.95,sy:1.05,lw:2.7,headR:3.4,head:(c,p)=>chambergo(c,'#4a3a2e'),chest:(c,J,p,col)=>suitTorso(c,J,col),over:(c,J)=>silkScarf(c,J),
  robe:(c,J,p,col)=>pants(c,J,dk(col,0.15),3.2),back(c,J,p,col){const h=J.handB;pg(c,[h,[h[0]-4,h[1]+5],[h[0]+1,h[1]+6.4]],RED3);limb(c,h[0]-4,h[1]+5,h[0]+1,h[1]+6.4,0.5,'#e8c23a');},
  weapon:(c,J,p)=>facon(c,J,p,4.8)};
UNITS.arg_hero={name:'المالِفو',hero:true,sx:1.0,sy:1.08,lw:2.9,headR:3.5,head:(c,p)=>chambergo(c,TANGO),
  back(c,J,p,col){const hb=lp(J.legB.h,J.legB.k,0.85);pg(c,[add(J.chest,rot(-2.6,-0.6,J.a2)),add(J.chest,rot(1.2,-0.4,J.a2)),[hb[0]+1.4,hb[1]],[hb[0]-3.6,hb[1]]],TANGO,dk(col,0.2),0.8);wrappedCoat(c,J,'#2a2a2e');},
  chest:(c,J,p,col)=>suitTorso(c,J,col),robe:(c,J,p,col)=>pants(c,J,TANGO,3.2),
  over(c,J,p,col){silkScarf(c,J);const A=add(J.chest,rot(1.6,1.6,J.a2)),B=add(J.hip,rot(2.4,-2,J.pl));c.beginPath();c.moveTo(A[0],A[1]);c.quadraticCurveTo(A[0]+1.6,(A[1]+B[1])/2,B[0],B[1]);c.strokeStyle='#c9a04a';c.lineWidth=0.5;c.stroke();
    circ2(c,add(J.chest,rot(-1.2,0.4,J.a2)),0.9,RED3);},weapon:(c,J,p)=>facon(c,J,p,6.2)};
/* --- المكسيك: درع قطني محشو، إزار ملون، عصابة بريشة، خوذتا النسر والجاغوار، المقلاع، الأتلاتل، الدرع المريّش، راية الريش --- */
function ichca(c,J,col){const P=torso(c,J,CREAM,dk(col,0.3));for(let k=1;k<3;k++){const A=lp(P[0],P[3],k/3),B=lp(P[1],P[2],k/3);limb(c,A[0],A[1],B[0],B[1],0.4,'#c8bca4');}return P;}
function maxtlatl(c,J,col){const r=robe(c,J,0.4,col,dk(col,0.3),'waist',0.6);stripes(c,r,[0.7],[TURQ],0.8);const M=lp(r.hemB,r.hemF,0.6);pg(c,[lp(r.w1,r.w2,0.45),lp(r.w1,r.w2,0.75),[M[0]+1,M[1]+3.4],[M[0]-1,M[1]+3.4]],RED3);}
function featherHB(c){ell(c,0,-2,4,0.8,RED3);[[-1.6,QUET],[-0.4,TURQ]].forEach(([x,col])=>{c.beginPath();c.moveTo(x,-2.4);c.quadraticCurveTo(x-1.6,-6.4,x-0.4,-8.6);c.lineTo(x+0.4,-8.2);c.quadraticCurveTo(x-0.6,-6,x+0.6,-2.4);c.closePath();c.fillStyle=col;c.fill();});}
function jaguarHelm(c){c.beginPath();c.ellipse(-0.4,-1.2,4.4,4.2,0,Math.PI*0.95,Math.PI*2.05);c.fillStyle=JAG;c.fill();
  pg(c,[[-1,-4],[5.6,-3.4],[5.8,-1.6],[1.6,-1.8]],JAG);for(let k=0;k<3;k++)tri(c,[2+k*1.2,-1.8],[2.5+k*1.2,-0.8],[3+k*1.2,-1.8],'#f4f1ea');
  [[-2.6,-3.6],[0,-4.6],[-3.6,-1],[2.4,-3]].forEach(([x,y])=>{c.beginPath();c.arc(x,y,0.6,0,TAU);c.strokeStyle='#3a2a1a';c.lineWidth=0.4;c.stroke();});
  tri(c,[-2.6,-4.6],[-2,-6.6],[-0.8,-4.8],JAG);ell(c,4.4,-3.2,0.6,0.5,'#2a1a10');}
function eagleHelm(c){c.beginPath();c.ellipse(-0.4,-1.2,4.4,4.2,0,Math.PI*0.95,Math.PI*2.05);c.fillStyle='#7a5a3a';c.fill();
  for(let k=0;k<5;k++)tri(c,[-4+k*1.4,-3.6],[-4.6+k*1.4,-7.4],[-3+k*1.4,-4],k%2?'#f2efe6':'#a87a4a');
  c.beginPath();c.moveTo(0.4,-4.4);c.quadraticCurveTo(6.8,-4.6,6.4,-1.6);c.lineTo(4.8,-2.2);c.quadraticCurveTo(4.6,-3.4,0.8,-2.8);c.closePath();c.fillStyle='#e8b23a';c.fill();ell(c,2,-3.6,0.6,0.5,'#2a1a10');}
function chimalli(c,P,r){circ2(c,P,r,TURQ);circ2(c,P,r*0.8,'#f2efe6');for(let k=0;k<3;k++)limb(c,P[0]-r*0.7,P[1]-r*0.4+k*r*0.4,P[0]+r*0.7,P[1]-r*0.4+k*r*0.4,0.6,k%2?RED3:'#2a2a2e');
  for(let k=0;k<5;k++){const a=Math.PI*0.3+k*0.3;tri(c,[P[0]+Math.cos(a)*r,P[1]+Math.sin(a)*r],[P[0]+Math.cos(a)*(r+2.6),P[1]+Math.sin(a)*(r+2.6)],[P[0]+Math.cos(a+0.15)*r,P[1]+Math.sin(a+0.15)*r],k%2?QUET:RED3);}}
function slingM(c,J,p){const d=wdir(p.wa),n=[-d[1],d[0]],h=J.handF,Q=[h[0]+d[0]*3.4+n[0]*1.4,h[1]+d[1]*3.4+n[1]*1.4];limb(c,h[0],h[1],Q[0],Q[1],0.4,'#c8bca4');limb(c,h[0],h[1],Q[0]+n[0]*0.8,Q[1]+n[1]*0.8,0.4,'#c8bca4');circ2(c,Q,1,'#7a7a72');}
function bowM(c,J,p,col){c.save();c.translate(J.handF[0],J.handF[1]);c.rotate(p.wa);c.beginPath();c.moveTo(0,-7.4);c.quadraticCurveTo(3.2,0,0,7.4);c.strokeStyle=col||'#6a4a2a';c.lineWidth=1.2;c.stroke();limb(c,-0.6,-7.2,-0.6,7.2,0.35,'#ece6d6');c.restore();}
function atlatl(c,J,p){const d=wdir(p.wa),h=J.handF,A=[h[0]-d[0]*1,h[1]-d[1]*1],B=[h[0]+d[0]*3.6,h[1]+d[1]*3.6];limb(c,A[0],A[1],B[0],B[1],1.1,'#7a5a3a');
  const T=[h[0]+d[0]*8,h[1]+d[1]*8];limb(c,h[0]-d[0]*2.4,h[1]-d[1]*2.4,T[0],T[1],0.5,'#d8c8a8');
  c.save();const g=c.createRadialGradient(T[0],T[1],0,T[0],T[1],4);g.addColorStop(0,'rgba(255,170,60,0.6)');g.addColorStop(1,'rgba(255,170,60,0)');c.fillStyle=g;c.beginPath();c.arc(T[0],T[1],4,0,TAU);c.fill();c.restore();
  ell(c,T[0],T[1],1,1.3,'#f0902a');ell(c,T[0],T[1]-0.4,0.5,0.8,'#ffd45a');}
function featherFan(c,J,big){const b=add(J.chest,rot(-1.8,-0.4,J.a2)),n=big?7:4,cols=[QUET,RED3,TURQ,'#e8b23a',QUET,RED3,TURQ];
  for(let k=0;k<n;k++){const a=-Math.PI/2-0.9+k*(1.8/(n-1)),L=big?13:8,E=[b[0]+Math.cos(a)*L-2,b[1]+Math.sin(a)*L];c.beginPath();c.moveTo(b[0],b[1]);c.quadraticCurveTo((b[0]+E[0])/2-1,(b[1]+E[1])/2,E[0],E[1]);c.strokeStyle=cols[k];c.lineWidth=big?1.6:1.2;c.stroke();}}
function macuahuitl(c,J){const b=add(J.chest,rot(-2.4,0,J.a2)),E=add(J.mid,rot(-3.8,4,J.pl));limb(c,b[0],b[1]-3,E[0],E[1],1.2,'#6a4a2a');
  for(let k=0;k<5;k++){const P=lp([b[0],b[1]-3],E,0.15+k*0.17);tri(c,[P[0]-0.4,P[1]],[P[0]-1.6,P[1]+0.4],[P[0]-0.4,P[1]+0.9],'#1e1e24');}}
UNITS.mex_common={name:'محارب التشينامبا',sx:0.97,sy:1.04,lw:2.8,headR:3.5,head:(c,p)=>featherHB(c),chest:(c,J,p,col)=>ichca(c,J,col),robe:(c,J,p,col)=>maxtlatl(c,J,col),
  back(c,J,p){chimalli(c,J.handB,3);},weapon:(c,J,p)=>slingM(c,J,p)};
UNITS.mex_jaguar={name:'فارس الجاغوار الرامي',sx:0.98,sy:1.05,lw:2.9,headR:3.5,head:(c,p)=>jaguarHelm(c),
  chest(c,J,p,col){const P=ichca(c,J,col);for(let k=0;k<4;k++){const Q=lp(lp(P[0],P[1],0.3+k*0.15),lp(P[3],P[2],0.3+k*0.15),0.3+(k%2)*0.4);c.beginPath();c.arc(Q[0],Q[1],0.6,0,TAU);c.strokeStyle='#3a2a1a';c.lineWidth=0.4;c.stroke();}},
  robe:(c,J,p,col)=>maxtlatl(c,J,col),back(c,J,p){featherFan(c,J,false);},weapon:(c,J,p)=>bowM(c,J,p)};
UNITS.mex_atlatl={name:'رامي الأتلاتل',sx:0.99,sy:1.04,lw:2.9,headR:3.5,head:(c,p)=>featherHB(c),chest:(c,J,p,col)=>ichca(c,J,col),robe:(c,J,p,col)=>maxtlatl(c,J,col),
  back(c,J,p){for(let k=0;k<3;k++){const A=add(J.chest,rot(-2+k*0.6,-1.4,J.a2)),B=add(J.mid,rot(-2.6+k*0.6,2.6,J.pl));limb(c,A[0],A[1],B[0],B[1],0.5,'#d8c8a8');}},weapon:(c,J,p)=>atlatl(c,J,p)};
UNITS.mex_hero={name:'قائد النسور',hero:true,sx:1.02,sy:1.08,lw:3,headR:3.6,head:(c,p)=>eagleHelm(c),
  back(c,J,p){featherFan(c,J,true);macuahuitl(c,J);},
  chest(c,J,p,col){const P=torso(c,J,'#8a6a46',dk(col,0.3));for(let r=0;r<3;r++)for(let k=0;k<3;k++){const Q=lp(lp(P[0],P[1],0.2+k*0.3),lp(P[3],P[2],0.2+k*0.3),0.2+r*0.3);tri(c,[Q[0]-0.6,Q[1]],[Q[0],Q[1]+1],[Q[0]+0.6,Q[1]],r%2?'#f2efe6':'#a87a4a');}},
  robe:(c,J,p,col)=>maxtlatl(c,J,col),weapon:(c,J,p)=>bowM(c,J,p,'#c9a04a')};
const NATIONS=[['bra','البرازيل','المالتاس',['bra_common','bra_berim','bra_acro','bra_hero']],
  ['arg','الأرجنتين','الكومبادريتوس',['arg_common','arg_gaucho','arg_shawl','arg_hero']],
  ['mex','المكسيك','فرسان النسر والجاغوار',['mex_common','mex_jaguar','mex_atlatl','mex_hero']]];
