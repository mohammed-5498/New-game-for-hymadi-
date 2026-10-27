/* ===================== الدفعة 3 — مظاهر الأمم الأوروبية: فرنسا، بريطانيا، ألمانيا ===================== */
const NAVY='#26324a',RED2='#c22f2f',COAL='#3a3a3e',BRASS='#c9a04a',LGOLD='#d9a83a',CUIR='#b8bec6';
const UNITS={};
/* لوح على الجذع (قميص، صديري، درع صدر): من الكتفين إلى الحوض */
function torso(c,J,fill,st,inset){const i=inset||0,a=J.a2,pl=J.pl;
  const P=[add(J.chest,rot(-2.2+i,-0.2,a)),add(J.chest,rot(2.4-i,-0.2,a)),add(J.hip,rot(2.6-i,-1,pl)),add(J.hip,rot(-2.4+i,-1,pl))];pg(c,P,fill,st,0.5);return P;}
function hStripes(c,P,n,col,w){for(let k=1;k<=n;k++){const t=k/(n+1),A=lp(P[0],P[3],t),B=lp(P[1],P[2],t);limb(c,A[0],A[1],B[0],B[1],w||0.7,col);}}
function neckerchief(c,J,col){const a=J.a2,A=add(J.chest,rot(-1.6,-1.2,a)),B=add(J.chest,rot(2,-1.2,a));limb(c,A[0],A[1],B[0],B[1],1.4,col);
  tri(c,add(J.chest,rot(1.4,-1.4,a)),add(J.chest,rot(3.4,1.2,a)),add(J.chest,rot(2.2,-0.6,a)),col);}
/* --- أغطية الرأس --- */
function flatCap(c,col,tilt){c.save();c.rotate(tilt||0.12);ell(c,-0.3,-2.2,4,2.2,col);pg(c,[[1.6,-1.6],[5.6,-0.8],[5.2,0],[1.4,-0.4]],dk(col,0.25));c.restore();}
function apacheCap(c){flatCap(c,'#2b2b30',0.18);ell(c,-0.4,-1.5,3.9,0.5,RED2);}
function bowler(c){ell(c,0,-1.4,5,1,'#1e1e22');c.beginPath();c.ellipse(0,-1.6,3.2,3.4,0,Math.PI,0);c.fillStyle='#26262b';c.fill();ell(c,0,-1.9,3.2,0.5,'#5a3a2a');}
function landsHat(c,col,big){const s=big?1.25:1;c.save();c.rotate(-0.25);ell(c,0,-2.6,5.6*s,1.5*s,col);ell(c,0.4,-3.4,3*s,1.4*s,dk(col,0.2));
  for(let k=0;k<(big?4:3);k++){c.beginPath();c.moveTo(-1+k*0.6,-3.6);c.quadraticCurveTo(-4-k*1.2,-8-k*1.4,-7.6-k*0.8,-4.2-k*0.6);c.strokeStyle=k%2?'#f2efe8':RED2;c.lineWidth=0.9;c.stroke();}c.restore();}
/* --- أسلحة --- */
function knife(c,J,p,L){const d=wdir(p.wa),h=J.handF,A=[h[0]+d[0]*0.8,h[1]+d[1]*0.8],B=[h[0]+d[0]*L,h[1]+d[1]*L];limb(c,h[0]-d[0]*0.8,h[1]-d[1]*0.8,A[0],A[1],1.3,'#3a2a22');limb(c,A[0],A[1],B[0],B[1],1,STEEL2);}
function apachePistol(c,J,p){const d=wdir(p.wa),n=[-d[1],d[0]],h=J.handF;
  pg(c,[[h[0]-n[0]*1.2,h[1]-n[1]*1.2],[h[0]+d[0]*2.2-n[0]*1.2,h[1]+d[1]*2.2-n[1]*1.2],[h[0]+d[0]*2.2+n[0]*1,h[1]+d[1]*2.2+n[1]*1],[h[0]+n[0]*1,h[1]+n[1]*1]],'#4a4a50');
  for(let k=0;k<4;k++)circ2(c,[h[0]+d[0]*0.4+n[0]*(-1+k*0.66),h[1]+d[1]*0.4+n[1]*(-1+k*0.66)],0.45,BRASS);
  limb(c,h[0]+d[0]*2.2,h[1]+d[1]*2.2,h[0]+d[0]*5.6,h[1]+d[1]*5.6,0.9,STEEL2);}
function cane(c,J,p,L){const s=staff(c,J,p,2.4,L,1,'#3a2a22');circ2(c,s.A,0.9,'#d9d4c8');}
function buckleBelt(c,J,p){const d=wdir(p.wa),n=[-d[1],d[0]],h=J.handF,M=[h[0]+d[0]*3+n[0]*1.6,h[1]+d[1]*3+n[1]*1.6],E=[h[0]+d[0]*6,h[1]+d[1]*6];
  c.beginPath();c.moveTo(h[0],h[1]);c.quadraticCurveTo(M[0],M[1],E[0],E[1]);c.strokeStyle='#4a3424';c.lineWidth=1;c.stroke();rrect(c,E[0]-1.2,E[1]-1,2.4,2,0.3,BRASS);}
function knuckles(c,P){for(let k=0;k<4;k++)circ2(c,[P[0]+0.3,P[1]-1+k*0.66],0.5,BRASS);}
function katzbalger(c,J,p){const d=wdir(p.wa),n=[-d[1],d[0]],h=J.handF,A=[h[0]+d[0]*1,h[1]+d[1]*1];
  pg(c,[A,[h[0]+d[0]*6+n[0]*0.6,h[1]+d[1]*6+n[1]*0.6],[h[0]+d[0]*6.8,h[1]+d[1]*6.8],[h[0]+d[0]*6-n[0]*0.6,h[1]+d[1]*6-n[1]*0.6]],STEEL2);
  c.beginPath();c.moveTo(A[0]+n[0]*1.8,A[1]+n[1]*1.8);c.quadraticCurveTo(A[0]+n[0]*0.6-d[0]*1,A[1]+n[1]*0.6-d[1]*1,A[0],A[1]);c.quadraticCurveTo(A[0]-n[0]*0.6+d[0]*1,A[1]-n[1]*0.6+d[1]*1,A[0]-n[0]*1.8,A[1]-n[1]*1.8);
  c.strokeStyle=BRASS;c.lineWidth=0.7;c.stroke();limb(c,h[0]-d[0]*1,h[1]-d[1]*1,A[0],A[1],1.3,'#3a2a22');}
function zweihander(c,J,p){const d=wdir(p.wa),n=[-d[1],d[0]],h=J.handF,G=[h[0]+d[0]*1.6,h[1]+d[1]*1.6],T=[h[0]+d[0]*13,h[1]+d[1]*13];
  limb(c,h[0]-d[0]*3,h[1]-d[1]*3,G[0],G[1],1.4,'#3a2a22');limb(c,G[0],G[1],T[0],T[1],1.5,STEEL2);limb(c,G[0]+n[0]*2.6,G[1]+n[1]*2.6,G[0]-n[0]*2.6,G[1]-n[1]*2.6,0.9,DARKW);
  const R=[G[0]+d[0]*2.6,G[1]+d[1]*2.6];limb(c,R[0]+n[0]*1.4,R[1]+n[1]*1.4,R[0]-n[0]*1.4,R[1]-n[1]*1.4,0.6,DARKW);}
/* --- ثياب اللاندسكنخت المشقوقة المنفوخة --- */
function puff(c,P,r,col,alt){circ2(c,P,r,col);for(let k=0;k<3;k++){const a=-1+k*0.9;limb(c,P[0]+Math.cos(a)*r*0.2,P[1]+Math.sin(a)*r*0.2-r*0.6,P[0]+Math.cos(a)*r*0.3,P[1]+Math.sin(a)*r*0.2+r*0.6,0.5,alt);}}
function landsLegs(c,J,col){puff(c,lp(J.legB.h,J.legB.k,0.45),1.7,dk(col,0.2),LGOLD);puff(c,lp(J.legF.h,J.legF.k,0.45),1.8,col,'#f2efe8');}
function landsSleeve(c,J,col){if(J.elbowF)puff(c,lp(J.Sf,J.elbowF,0.5),1.5,LGOLD,col);}
function landsDoublet(c,J,col){const P=torso(c,J,col,dk(col,0.3));for(let k=1;k<4;k++){const A=lp(P[0],P[1],k/4),B=lp(P[3],P[2],k/4);limb(c,A[0],A[1],B[0],B[1],0.6,LGOLD);}}
/* --- فرنسا --- */
UNITS.fra_common={name:'أباتشي',sx:0.96,sy:1.04,lw:2.8,headR:3.5,head:(c,p)=>apacheCap(c),
  chest(c,J,p,col){const P=torso(c,J,'#f2efe8',dk(col,0.3));hStripes(c,P,4,col,0.8);},over:(c,J)=>neckerchief(c,J,RED2),weapon:(c,J,p)=>knife(c,J,p,4.6)};
UNITS.fra_cane={name:'مقاتل العصا',sx:0.97,sy:1.05,lw:2.8,headR:3.5,head:(c,p)=>apacheCap(c),
  chest(c,J,p,col){const P=torso(c,J,'#f2efe8',dk(col,0.3));hStripes(c,P,4,col,0.8);},over:(c,J)=>neckerchief(c,J,RED2),weapon:(c,J,p)=>cane(c,J,p,9)};
UNITS.fra_dancer={name:'الراقص المقاتل',sx:0.94,sy:1.05,lw:2.7,headR:3.5,head(c,p){ell(c,-0.4,-1.6,3.7,2.3,'#2b2b30');},
  chest(c,J,p,col){torso(c,J,col,dk(col,0.3));const a=J.a2;limb(c,...add(J.chest,rot(-1.8,0,a)),...add(J.hip,rot(-1.8,-1,J.pl)),0.6,'#f2efe8');},
  over(c,J,p,col){neckerchief(c,J,RED2);belt(c,J,RED2,1.6);},back(c,J,p){const d=wdir(p.wa+0.8),h=J.handB;limb(c,h[0],h[1],h[0]+d[0]*4,h[1]+d[1]*4,1,STEEL2);},weapon:(c,J,p)=>knife(c,J,p,4.4)};
UNITS.fra_hero={name:'ملك الأباتشي',hero:true,sx:1.0,sy:1.07,lw:3.0,headR:3.5,head:(c,p)=>bowler(c),
  back(c,J,p,col){const hb=lp(J.legB.k,J.legB.f,0.5);pg(c,[add(J.chest,rot(-2.6,-0.6,J.a2)),add(J.chest,rot(1.2,-0.4,J.a2)),[hb[0]+1.4,hb[1]],[hb[0]-3.6,hb[1]]],'#2b2b30',dk(col,0.2),0.8);},
  chest(c,J,p,col){const P=torso(c,J,'#f2efe8',dk(col,0.3));hStripes(c,P,4,col,0.8);},
  over(c,J,p,col){neckerchief(c,J,RED2);const a=J.a2;[[-2.4,-2.4],[2.6,2.8]].forEach(([s,e])=>{});limb(c,...add(J.chest,rot(1.9,0.4,a)),...add(J.hip,rot(2.4,-1,J.pl)),1.2,'#2b2b30');},
  weapon:(c,J,p)=>apachePistol(c,J,p)};
/* --- بريطانيا --- */
const waistcoat=(c,J,col)=>{const P=torso(c,J,lt(col,0.55),dk(col,0.3));const Q=torso(c,J,COAL,null,0.9);for(let k=0;k<3;k++){const B=lp(lp(Q[0],Q[1],0.5),lp(Q[3],Q[2],0.5),0.2+k*0.28);circ2(c,B,0.35,BRASS);}return P;};
UNITS.gbr_common={name:'فتى سمول هيث',sx:0.98,sy:1.04,lw:2.9,headR:3.5,head:(c,p)=>flatCap(c,'#4a4640',0.2),chest:(c,J,p,col)=>waistcoat(c,J,col),
  over:(c,J,p,col)=>neckerchief(c,J,dk(col,0.1)),weapon:(c,J,p)=>buckleBelt(c,J,p)};
UNITS.gbr_shield={name:'حامل غطاء البرميل',sx:0.98,sy:1.04,lw:2.9,headR:3.5,head:(c,p)=>flatCap(c,'#3e3a36',0.15),chest:(c,J,p,col)=>waistcoat(c,J,col),
  front(c,J,p,col){const h=J.handF;circ2(c,[h[0]+1.2,h[1]],5.2,'#6e737a');circ2(c,[h[0]+1.2,h[1]],4.4,'#8a9098');for(let k=0;k<3;k++){c.beginPath();c.arc(h[0]+1.2,h[1],1.4+k*1,0,TAU);c.strokeStyle='#6e737a';c.lineWidth=0.4;c.stroke();}
    rrect(c,h[0]+0.2,h[1]-0.6,2,1.2,0.4,'#4a4e54');}};
UNITS.gbr_breaker={name:'صاحب القبضة',sx:0.98,sy:1.04,lw:2.9,headR:3.5,head(c,p){ell(c,-0.6,-2.4,3.2,1.4,'#3a2e26');},
  chest(c,J,p,col){const P=torso(c,J,lt(col,0.6),dk(col,0.3));limb(c,...lp(P[0],P[1],0.25),...lp(P[3],P[2],0.25),0.8,'#3a2e26');limb(c,...lp(P[0],P[1],0.75),...lp(P[3],P[2],0.75),0.8,'#3a2e26');},
  front(c,J,p){knuckles(c,J.handF);},back(c,J,p){knuckles(c,J.handB);}};
UNITS.gbr_hero={name:'زعيم الحي',hero:true,sx:1.0,sy:1.06,lw:3.0,headR:3.5,head:(c,p)=>flatCap(c,'#2e2c2a',0.22),
  back(c,J,p,col){const hb=lp(J.legB.k,J.legB.f,0.55);pg(c,[add(J.chest,rot(-2.8,-0.6,J.a2)),add(J.chest,rot(1.2,-0.4,J.a2)),[hb[0]+1.4,hb[1]],[hb[0]-4,hb[1]]],'#3a3632',dk(col,0.2),0.8);},
  chest(c,J,p,col){const P=waistcoat(c,J,col);const A=lp(lp(P[0],P[1],0.5),lp(P[3],P[2],0.5),0.55),B=lp(P[1],P[2],0.6);c.beginPath();c.moveTo(A[0],A[1]);c.quadraticCurveTo((A[0]+B[0])/2,(A[1]+B[1])/2+1.2,B[0],B[1]);c.strokeStyle=BRASS;c.lineWidth=0.5;c.stroke();},
  over:(c,J,p,col)=>neckerchief(c,J,'#7a1f2a'),weapon(c,J,p){const s=staff(c,J,p,1.6,8,0.9,'#2a2220');circ2(c,s.A,1.1,'#d9dde2');}};
/* --- ألمانيا --- */
UNITS.deu_common={name:'لاندسكنخت',sx:0.98,sy:1.04,lw:2.9,headR:3.5,head:(c,p,col)=>landsHat(c,dk(col,0.15)),chest:(c,J,p,col)=>landsDoublet(c,J,col),
  robe:(c,J,p,col)=>landsLegs(c,J,col),weapon:(c,J,p)=>katzbalger(c,J,p),front:(c,J,p,col)=>landsSleeve(c,J,col)};
UNITS.deu_pike={name:'حامل الرمح الطويل',sx:0.98,sy:1.04,lw:2.9,headR:3.5,head(c,p){c.beginPath();c.ellipse(0,-1.4,4.2,3.6,0,Math.PI,0);c.fillStyle=CUIR;c.fill();ell(c,0,-1.4,5.2,0.8,'#9aa0a8');},
  chest(c,J,p,col){landsDoublet(c,J,col);const P=torso(c,J,CUIR,'#7a8088',0.4);limb(c,...lp(P[0],P[1],0.5),...lp(P[3],P[2],0.5),0.6,'#e6eaee');},
  robe:(c,J,p,col)=>landsLegs(c,J,col),front:(c,J,p,col)=>landsSleeve(c,J,col),
  weapon(c,J,p){const s=staff(c,J,p,5,14,1.1,'#7a5a3a'),d=s.d,B=s.B;tri(c,[B[0]-d[1]*0.8,B[1]+d[0]*0.8],[B[0]+d[0]*2.6,B[1]+d[1]*2.6],[B[0]+d[1]*0.8,B[1]-d[0]*0.8],STEEL2);}};
UNITS.deu_zwei={name:'حامل السيف ذي اليدين',twoH:true,sx:0.98,sy:1.04,lw:2.9,headR:3.5,head:(c,p,col)=>landsHat(c,dk(col,0.2)),
  chest:(c,J,p,col)=>landsDoublet(c,J,col),robe:(c,J,p,col)=>landsLegs(c,J,col),front:(c,J,p,col)=>landsSleeve(c,J,col),weapon:(c,J,p)=>zweihander(c,J,p)};
UNITS.deu_hero={name:'حامل الراية',hero:true,twoH:true,sx:1.0,sy:1.06,lw:3.0,headR:3.5,head:(c,p,col)=>landsHat(c,dk(col,0.1),true),
  chest:(c,J,p,col)=>landsDoublet(c,J,col),robe:(c,J,p,col)=>landsLegs(c,J,col),front:(c,J,p,col)=>landsSleeve(c,J,col),
  weapon(c,J,p,col){const h=J.handF,T=[h[0]+1.4,h[1]-20],Bt=[h[0]-0.6,h[1]+6];limb(c,Bt[0],Bt[1],T[0],T[1],1,'#5a4632');circ2(c,T,0.9,BRASS);
    const t=(p.cb||0)*2;for(let k=0;k<5;k++){const y0=T[1]+1+k*2,wv=Math.sin(k*0.9+t)*0.8;pg(c,[[T[0]-0.2,y0],[T[0]-11,y0+wv],[T[0]-11,y0+2+wv],[T[0]-0.2,y0+2]],k%2?LGOLD:col);}
    pg(c,[[T[0]-11,T[1]+1],[T[0]-14,T[1]+3.5],[T[0]-11,T[1]+6]],LGOLD);}};
const NATIONS=[['fra','فرنسا','الأباتشي',['fra_common','fra_cane','fra_dancer','fra_hero']],
  ['gbr','بريطانيا','فتيان سمول هيث',['gbr_common','gbr_shield','gbr_breaker','gbr_hero']],
  ['deu','ألمانيا','اللاندسكنخت',['deu_common','deu_pike','deu_zwei','deu_hero']]];
