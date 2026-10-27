/* ===================== الدفعة 1 — مظاهر الأمم العربية: اليمن، السعودية، مصر =====================
   كل وحدة = نمطها القتالي + إكسسوارات فوق drawBody. لون اللاعب يبقى لون الجسد والثياب (مخففاً)،
   والهوية من غطاء الرأس وشكل الثوب والسلاح ولون ثانوي ثابت لكل أمة. */
const hx2=h=>[1,3,5].map(i=>parseInt(h.substr(i,2),16));
function mixHex(a,b,t){const A=hx2(a),B=hx2(b);return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');}
const lp=(A,B,t)=>[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t];
function pg(c,pts,f,st,w){c.beginPath();c.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);c.closePath();
  c.fillStyle=f;c.fill();if(st){c.strokeStyle=st;c.lineWidth=w||0.5;c.stroke();}}
function legPt(L,t){return t<=0.5?lp(L.h,L.k,t/0.5):lp(L.k,L.f,(t-0.5)/0.5);}
/* ثوب يتمايل مع الساقين: top='chest' ثوب كامل، top='waist' إزار */
function robe(c,J,len,fill,edge,top,flare){const a=J.pl,fl=flare==null?1.6:flare,hf=legPt(J.legF,len),hb=legPt(J.legB,len);
  const hemF=[hf[0]+fl,hf[1]],hemB=[hb[0]-fl,hb[1]];let pts,w1,w2;
  w1=add(J.hip,rot(-2.4,-1.1,a));w2=add(J.hip,rot(2.6,-1.1,a));
  if(top==='chest'){const s1=add(J.chest,rot(-2.1,0.5,J.a2)),s2=add(J.chest,rot(2.3,0.5,J.a2));pts=[s1,s2,w2,hemF,hemB,w1];}
  else pts=[w1,w2,hemF,hemB];
  pg(c,pts,fill,edge,0.5);return {w1,w2,hemF,hemB};}
function stripes(c,r,ts,cols,w){ts.forEach((t,i)=>{const A=lp(r.w1,r.hemB,t),B=lp(r.w2,r.hemF,t);limb(c,A[0],A[1],B[0],B[1],w||0.9,cols[i%cols.length]);});}
function belt(c,J,col,w){const a=J.pl,A=add(J.hip,rot(-2.5,-1.3,a)),B=add(J.hip,rot(2.7,-1.3,a));limb(c,A[0],A[1],B[0],B[1],w||1.5,col);}
const GOLD='#c9a04a',IND='#2f3f7a',HORN='#e3d6b0',STEEL2='#cfd3d8',WOODD='#6e4f33',WHT='#f2efe8',SHM='#c0392b',AGAL='#1c1c1c';
/* --- أغطية الرأس (إحداثيات الرأس: المركز 0,0 والوجه نحو +x) --- */
function imama(c,col,big){const w=lt(col,0.72);ell(c,0,-1.7,big?4.8:4.2,big?2.9:2.4,w);ell(c,0,-0.9,big?4.8:4.3,1,IND);
  limb(c,-3,-2.7,3,-2.3,0.5,dk(w,0.15));limb(c,-2.6,-1.6,3.2,-1.9,0.5,dk(w,0.15));
  tri(c,[-3.8,-0.8],[big?-6.2:-5.4,big?5:3],[-2.8,0.6],w);if(big)ell(c,2.6,-2,0.9,0.9,GOLD);}
function turbanEg(c){ell(c,0,-1.9,4.2,2.1,'#efe6d2');limb(c,-3.2,-2.2,3.3,-1.6,0.5,'#d6cbb3');limb(c,-3,-1.3,3.4,-2.4,0.5,'#d6cbb3');}
function fez(c){pg(c,[[-2.9,-2.4],[2.9,-2.4],[2.3,-7.2],[-2.3,-7.2]],'#a8322a');ell(c,0,-7.2,2.3,0.7,'#8e2a24');
  limb(c,0,-7.2,-3,-4.6,0.6,'#1c1c1c');ell(c,-3,-4.4,0.6,0.9,'#1c1c1c');}
function crown(c){ell(c,0,-2.6,3.9,1.2,GOLD);for(let k=0;k<5;k++){const x=-3+k*1.5;tri(c,[x-0.6,-3.2],[x,-6.2+(k===2?-1:0)],[x+0.6,-3.2],GOLD);}
  ell(c,0,-3.4,0.7,0.7,'#b8322c');}
/* --- أسلحة --- */
const wdir=a=>[Math.cos(a),Math.sin(a)];
function jambiya(c,J,p,L){const d=wdir(p.wa),n=[-d[1],d[0]],h=J.handF,tip=[h[0]+d[0]*L,h[1]+d[1]*L],cp=[h[0]+d[0]*L*0.6+n[0]*1.6,h[1]+d[1]*L*0.6+n[1]*1.6];
  c.beginPath();c.moveTo(h[0],h[1]);c.quadraticCurveTo(cp[0],cp[1],tip[0],tip[1]);c.strokeStyle=STEEL2;c.lineWidth=1.4;c.lineCap='round';c.stroke();
  ell(c,h[0]-d[0]*0.6,h[1]-d[1]*0.6,0.9,0.9,HORN);}
function wornJambiya(c,J,big){const a=J.pl,o=add(J.hip,rot(0.6,-1.3,a)),s=big?1.3:1;
  c.beginPath();c.moveTo(o[0],o[1]-1.4*s);c.quadraticCurveTo(o[0]+0.4*s,o[1]+1.8*s,o[0]+2.2*s,o[1]+1.4*s);c.strokeStyle=GOLD;c.lineWidth=1.6*s;c.lineCap='round';c.stroke();
  ell(c,o[0],o[1]-1.8*s,0.8*s,0.8*s,HORN);}
function staff(c,J,p,back,fwd,w,col){const d=wdir(p.wa),h=J.handF,A=[h[0]-d[0]*back,h[1]-d[1]*back],B=[h[0]+d[0]*fwd,h[1]+d[1]*fwd];
  limb(c,A[0],A[1],B[0],B[1],w,col);return {A,B,d};}
function bow(c,J,p){c.save();c.translate(J.handF[0],J.handF[1]);c.rotate(p.wa);c.beginPath();c.moveTo(0,-6.5);c.quadraticCurveTo(3.4,0,0,6.5);
  c.strokeStyle='#6a4a2a';c.lineWidth=1.2;c.stroke();limb(c,-0.8,-6.3,-0.8,6.3,0.35,'#ece6d6');c.restore();}
/* --- اليمن --- */
const UNITS={};
UNITS.yem_common={name:'مقاتل الجنبية',sx:0.98,sy:1.02,lw:2.9,headR:3.5,head:(c,p,col)=>imama(c,col),
  robe(c,J,p,col){const r=robe(c,J,0.5,mixHex(col,'#d8c8a8',0.25),dk(col,0.3),'waist',1.2);stripes(c,r,[0.55,0.8],[IND,GOLD],0.8);},
  over(c,J,p,col){belt(c,J,'#7a5a36',1.6);wornJambiya(c,J);},weapon:(c,J,p)=>jambiya(c,J,p,4.4)};
UNITS.yem_boss={name:'شيخ الجنبية',aura:true,sx:0.98,sy:1.04,lw:2.9,headR:3.5,head:(c,p,col)=>imama(c,col,true),
  back(c,J,p,col){pg(c,[add(J.chest,rot(-2.2,0,J.a2)),add(J.chest,rot(1.6,0,J.a2)),add(J.mid,rot(-1,1.6,J.pl)),add(J.mid,rot(-4.6,2.4,J.pl))],IND);},
  robe(c,J,p,col){const r=robe(c,J,0.62,mixHex(col,'#d8c8a8',0.25),dk(col,0.3),'waist',1.4);stripes(c,r,[0.5,0.72,0.9],[IND,GOLD,IND],0.8);},
  over(c,J,p,col){belt(c,J,GOLD,2.2);wornJambiya(c,J,true);},weapon:(c,J,p)=>jambiya(c,J,p,5.2)};
UNITS.yem_healer={name:'العطّار',sx:0.98,sy:1.02,lw:2.8,headR:3.5,head:(c,p,col)=>imama(c,col),
  robe(c,J,p,col){robe(c,J,0.86,lt(col,0.55),dk(col,0.3),'chest',1.4);},
  over(c,J,p,col){const A=add(J.chest,rot(1.8,0.4,J.a2)),B=add(J.hip,rot(-2.2,0.4,J.pl));limb(c,A[0],A[1],B[0],B[1],0.8,'#6a4a30');rrect(c,B[0]-1.6,B[1]-0.6,3,2.6,0.6,'#8a6a44');},
  weapon(c,J,p){const h=J.handF;limb(c,h[0],h[1],h[0]+0.4,h[1]+3.2,0.4,'#8a7a5a');ell(c,h[0]+0.4,h[1]+4,1.6,1,'#b8913a');
    c.beginPath();c.arc(h[0]+0.4,h[1]+3.4,1.2,Math.PI,0);c.fillStyle='#a07a2e';c.fill();
    for(let k=0;k<3;k++){c.save();c.globalAlpha*=0.4-k*0.1;ell(c,h[0]+0.6+k*0.8,h[1]+1.6-k*2.2,1.1+k*0.5,1.1+k*0.5,'#d9d6cf');c.restore();}}};
UNITS.yem_hero={name:'ملكة سبأ',hero:true,sx:1.0,sy:1.08,lw:3.0,headR:3.5,head:(c,p,col)=>crown(c),
  back(c,J,p,col){pg(c,[add(J.chest,rot(-2.2,-0.4,J.a2)),add(J.chest,rot(1,0,J.a2)),lp(J.legB.k,J.legB.f,0.9),[lp(J.legB.k,J.legB.f,0.9)[0]-5,lp(J.legB.k,J.legB.f,0.9)[1]]],IND,GOLD,0.8);},
  robe(c,J,p,col){const r=robe(c,J,0.96,lt(col,0.45),dk(col,0.3),'chest',2.2);stripes(c,r,[0.93],[GOLD],1.1);},
  over(c,J,p,col){belt(c,J,GOLD,1.6);},
  weapon(c,J,p){const s=staff(c,J,p,6,6,1.1,GOLD);circ2(c,s.B,2,GOLD);circ2(c,s.B,1.2,'#f2d46a');}};
function circ2(c,P,r,f){c.beginPath();c.arc(P[0],P[1],r,0,TAU);c.fillStyle=f;c.fill();}
/* ===================== السعودية v2 — تفاصيل مستلهمة من العينة المصممة =====================
   ثُبِّتت الأسلحة على التصميم التاريخي: مقلاع حبلي (لا نِبلة مطاطية)، والنفّاط بقِدر النار (لا مشعل، حتى لا يشبه رامي المشاعل السوداني).
   وأُخذ من العينة: الحقيبة الجلدية، وحزام الكتف المائل، وريش الأسهم، ورأسا القوس الذهبيان، وقفاز الصقّار بشرّابته الذهبية، وصقر مفصّل. */
function shemagh(c,veil){c.save();c.beginPath();c.ellipse(0,-0.8,4.5,4.2,0,Math.PI,0);c.lineTo(-4.5,-0.8);c.closePath();
  const g=c.createLinearGradient(-4,-5,4,0);g.addColorStop(0,'#ffffff');g.addColorStop(1,STYLE.on?'#dcd7cc':WHT);c.fillStyle=STYLE.on?g:WHT;c.fill();
  c.clip();c.strokeStyle=SHM;c.lineWidth=0.32;for(let k=-6;k<=6;k+=1.3){c.beginPath();c.moveTo(k,-6);c.lineTo(k+3,0);c.stroke();c.beginPath();c.moveTo(k,-6);c.lineTo(k-3,0);c.stroke();}c.restore();
  c.save();const D=[[-4.5,-0.8],[-5.8,5.8],[-1.8,5.2],[-2.1,0]];path(c,D);c.closePath();c.fillStyle=STYLE.on?'#ece8e0':WHT;c.fill();c.clip();c.strokeStyle=SHM;c.lineWidth=0.32;
  for(let k=-8;k<=2;k+=1.3){c.beginPath();c.moveTo(k,-1);c.lineTo(k+5,7);c.stroke();}c.restore();
  if(STYLE.on){path(c,D);c.closePath();c.strokeStyle='#b8b2a6';c.lineWidth=0.4;c.stroke();limb(c,-3.6,0.4,-4.4,5,0.4,'rgba(0,0,0,0.12)');}
  if(veil)pg(c,[[0.6,0.4],[3.8,0],[3.6,2.6],[0.6,2.9]],'#f2efe8');else pg(c,[[3.4,-0.8],[4.4,3.2],[2.6,2.8]],'#f2efe8');
  [[-2.4,4.05,1.15],[-3.25,3.8,1.05]].forEach(([y,rx,ry])=>{c.beginPath();c.ellipse(0,y,rx,ry,0,0,TAU);c.strokeStyle=AGAL;c.lineWidth=0.95;c.stroke();
    if(STYLE.on){c.beginPath();c.ellipse(0,y,rx,ry,0,Math.PI*1.1,Math.PI*1.6);c.strokeStyle='#6a6a70';c.lineWidth=0.35;c.stroke();}});}
function pouch(c,J,side){const P=add(J.hip,rot(side||-1.6,-0.6,J.pl));rrect(c,P[0]-1.6,P[1]-0.4,3.2,2.8,0.5,'#7a5232');rrect(c,P[0]-1.6,P[1]-0.4,3.2,1.2,0.4,'#8e6240');circ2(c,[P[0],P[1]+0.6],0.35,'#d9b45a');}
function shoulderStrap(c,J){const A=add(J.chest,rot(1.8,-0.6,J.a2)),B=add(J.hip,rot(-2.4,-0.6,J.pl));limb(c,A[0],A[1],B[0],B[1],1.2,'#5a3a22');limb(c,A[0],A[1],B[0],B[1],0.8,'#7a5232');
  const K=lp(A,B,0.35);rrect(c,K[0]-0.6,K[1]-0.6,1.2,1.2,0.2,'#d9b45a');}
const thobe=(c,J,col,len)=>robe(c,J,len||0.9,lt(col,0.62),dk(col,0.25),'chest',1.3);
UNITS.sau_common={name:'رامي المقلاع',sx:0.97,sy:1.03,lw:2.8,headR:3.5,head:(c,p)=>shemagh(c),robe:(c,J,p,col)=>thobe(c,J,col),
  over(c,J){belt(c,J,'#7a5232',1.3);pouch(c,J,2.2);},
  weapon(c,J,p){const d=wdir(p.wa),n=[-d[1],d[0]],h=J.handF,Q=[h[0]+d[0]*1.2+n[0]*4.6,h[1]+d[1]*1.2+n[1]*4.6];
    [[0,'#a88a5a'],[0.7,'#8a6c44']].forEach(([o,cl])=>{c.beginPath();c.moveTo(h[0],h[1]);c.quadraticCurveTo(h[0]+n[0]*2.4+d[0]*(1.8+o),h[1]+n[1]*2.4+d[1]*(1.8+o),Q[0]+d[0]*o,Q[1]+d[1]*o);c.strokeStyle=cl;c.lineWidth=0.45;c.stroke();});
    ell(c,Q[0]+d[0]*0.35,Q[1]+d[1]*0.35,1.5,1,'#6a4a2c');circ2(c,[Q[0]+d[0]*0.35-n[0]*0.3,Q[1]+d[1]*0.35-n[1]*0.3],0.95,'#8a857c');}};
function bow2(c,J,p){c.save();c.translate(J.handF[0],J.handF[1]);c.rotate(p.wa);
  c.beginPath();c.moveTo(0.2,-7);c.quadraticCurveTo(3.6,-3,1.4,0);c.quadraticCurveTo(3.6,3,0.2,7);c.strokeStyle='#4a2e1c';c.lineWidth=1.7;c.stroke();
  c.beginPath();c.moveTo(0.2,-7);c.quadraticCurveTo(3.6,-3,1.4,0);c.quadraticCurveTo(3.6,3,0.2,7);c.strokeStyle='#7a5232';c.lineWidth=1.1;c.stroke();
  rrect(c,0.6,-1.2,1.6,2.4,0.4,'#3a2418');[-7,7].forEach(y=>{c.beginPath();c.arc(0.2,y,0.6,0,TAU);c.fillStyle='#d9b45a';c.fill();});
  limb(c,-0.7,-6.8,-0.7,6.8,0.3,'#f2efe6');c.restore();}
UNITS.sau_archer={name:'القوّاس',sx:0.97,sy:1.04,lw:2.8,headR:3.5,head:(c,p)=>shemagh(c),robe:(c,J,p,col)=>thobe(c,J,col,0.82),
  back(c,J,p,col){const A=add(J.chest,rot(-1.4,-2.6,J.a2)),B=add(J.mid,rot(-2.4,1.8,J.pl));limb(c,A[0],A[1],B[0],B[1],2.6,'#4a2e1c');limb(c,A[0],A[1],B[0],B[1],2.1,'#7a5232');
    limb(c,lp(A,B,0.15)[0],lp(A,B,0.15)[1],lp(A,B,0.15)[0]+0.8,lp(A,B,0.15)[1]-0.4,1.2,'#d9b45a');
    for(let k=0;k<4;k++){const S=[A[0]-1+k*0.65,A[1]-0.2];limb(c,S[0],S[1],S[0]+0.3,S[1]-1.2,0.35,'#6a4a2c');tri(c,[S[0]-0.5,S[1]-1.2],[S[0]+0.35,S[1]-3.4],[S[0]+0.9,S[1]-1.2],k%2?'#f2efe6':'#e0dacb');}},
  over(c,J){belt(c,J,'#7a5232',1.3);shoulderStrap(c,J);},weapon:(c,J,p)=>bow2(c,J,p)};
UNITS.sau_naft={name:'النفّاط',sx:0.98,sy:1.02,lw:2.9,headR:3.5,head:(c,p)=>shemagh(c,true),robe:(c,J,p,col)=>thobe(c,J,col,0.78),
  over(c,J,p,col){const a=J.pl,A=add(J.hip,rot(-1.6,-1.4,a)),B=add(J.hip,rot(2.8,-1.4,a)),hf=legPt(J.legF,0.62);pg(c,[A,B,[hf[0]+1.2,hf[1]],[hf[0]-2.4,hf[1]+0.4]],'#6a4a30');
    belt(c,J,'#7a5232',1.3);pouch(c,J,-1.8);},
  weapon(c,J,p){const d=wdir(p.wa),h=J.handF,Q=[h[0]+d[0]*1.4,h[1]+d[1]*1.4];
    ell(c,Q[0],Q[1]+0.2,2.2,2.5,'#b0683a');limb(c,Q[0]-1.9,Q[1]-0.4,Q[0]+1.9,Q[1]-0.4,0.5,'#7a4426');limb(c,Q[0]-1.6,Q[1]+1.2,Q[0]+1.6,Q[1]+1.2,0.35,'#d08a5a');
    rrect(c,Q[0]-1,Q[1]-3.2,2,1.4,0.3,'#8e5230');ell(c,Q[0],Q[1]-3.2,1.1,0.45,'#2a1810');
    c.beginPath();c.moveTo(Q[0]-1.9,Q[1]-0.6);c.quadraticCurveTo(Q[0],Q[1]-5,Q[0]+1.9,Q[1]-0.6);c.strokeStyle='#8a6c44';c.lineWidth=0.4;c.stroke();flame(c,Q[0],Q[1]-3.4,1);}};
function falcon(c,P){c.save();c.translate(P[0],P[1]);
  pg(c,[[-0.6,2],[-2.8,5.6],[-1.4,5.8],[0.6,2.4]],'#5a3e28');for(let k=0;k<3;k++)limb(c,-1.2-k*0.5,3.2+k*0.8,-0.2-k*0.4,3.4+k*0.8,0.3,'#d8c8a8');
  ell(c,0,0,1.9,2.7,'#7a5a3e');ell(c,0.5,0.4,1.1,1.8,'#efe6d2');for(let k=0;k<6;k++){c.beginPath();c.arc(0.2+(k%2)*0.7,-0.4+k*0.45,0.18,0,TAU);c.fillStyle='#6a4a2e';c.fill();}
  pg(c,[[-1.6,-1.4],[0.4,-1],[-0.2,2.6],[-2.2,2.2]],'#5e4430');for(let k=0;k<3;k++)limb(c,-1.8+k*0.5,-0.6+k*0.9,-0.4+k*0.4,-0.2+k*0.9,0.3,'#3e2a1a');
  circ2(c,[0.7,-3],1.45,'#6a4a2e');ell(c,1.1,-2.5,0.9,0.7,'#efe6d2');limb(c,1,-2.9,1.2,-2,0.35,'#2a1a10');
  c.beginPath();c.arc(1.2,-3.2,0.42,0,TAU);c.fillStyle='#f0c040';c.fill();c.beginPath();c.arc(1.25,-3.2,0.22,0,TAU);c.fillStyle='#1a1008';c.fill();
  c.beginPath();c.moveTo(1.9,-3.2);c.quadraticCurveTo(3.1,-3.1,2.6,-2.2);c.lineTo(2,-2.6);c.closePath();c.fillStyle='#e8c040';c.fill();c.beginPath();c.arc(2.5,-2.4,0.18,0,TAU);c.fillStyle='#3a3a3a';c.fill();
  [[-0.4,2.4],[0.6,2.5]].forEach(([x,y])=>limb(c,x,y,x+0.2,y+0.8,0.4,'#e8c040'));c.restore();}
UNITS.sau_hero={name:'الصقّار',hero:true,sx:1.0,sy:1.06,lw:3.0,headR:3.5,head:(c,p)=>shemagh(c),
  back(c,J,p,col){const hb=lp(J.legB.k,J.legB.f,0.75);pg(c,[add(J.chest,rot(-2.8,-0.6,J.a2)),add(J.chest,rot(1.4,-0.4,J.a2)),[hb[0]+1,hb[1]],[hb[0]-4.8,hb[1]]],'#5a3e28',GOLD,0.9);},
  robe:(c,J,p,col)=>thobe(c,J,col,0.92),
  over(c,J,p,col){const A=add(J.chest,rot(1.9,0.2,J.a2)),B=add(J.hip,rot(2.6,-1,J.pl));limb(c,A[0],A[1],B[0],B[1],1.2,'#5a3e28');limb(c,A[0],A[1],B[0],B[1],0.5,GOLD);belt(c,J,'#7a5232',1.4);},
  front(c,J,p,col){const E=J.elbowF,H=J.handF;limb(c,E[0],E[1],H[0],H[1],3.4,'#4a2e1c');limb(c,E[0],E[1],H[0],H[1],2.8,'#7a5232');
    limb(c,lp(E,H,0.2)[0],lp(E,H,0.2)[1],lp(E,H,0.2)[0]+0.4,lp(E,H,0.2)[1]+1.2,0.5,'#d9b45a');
    const T=lp(E,H,0.55);limb(c,T[0],T[1]+1,T[0]-0.2,T[1]+3.6,0.4,'#d9b45a');ell(c,T[0]-0.2,T[1]+4.4,0.6,1,'#d9b45a');
    falcon(c,[H[0]+0.2,H[1]-2.6]);}};

/* --- مصر --- */
const galab=(c,J,col,len)=>robe(c,J,len||0.88,mixHex(col,'#e6d7bc',0.55),dk(col,0.25),'chest',1.5);
UNITS.egy_common={name:'الفتوة',sx:0.98,sy:1.0,lw:2.9,headR:3.5,head:(c,p)=>turbanEg(c),robe:(c,J,p,col)=>galab(c,J,col),
  over(c,J,p,col){const A=add(J.chest,rot(-2,0.2,J.a2)),B=add(J.hip,rot(2.4,-1.4,J.pl));limb(c,A[0],A[1],B[0],B[1],1.6,'#d9c9a8');},
  weapon(c,J,p){const s=staff(c,J,p,3.5,8,1.6,WOODD);circ2(c,s.B,1,'#4a3422');}};
UNITS.egy_shield={name:'حامل الدرع',sx:0.98,sy:0.98,lw:2.9,headR:3.5,head:(c,p)=>turbanEg(c),robe:(c,J,p,col)=>galab(c,J,col,0.6),
  over:(c,J)=>belt(c,J,'#5a3a22',1.8),
  front(c,J,p,col){const h=J.handF;circ2(c,[h[0]+1.2,h[1]],5.4,'#5a3a22');circ2(c,[h[0]+1.2,h[1]],4.6,'#8a5a36');
    for(let k=0;k<8;k++){const a=k*0.785;limb(c,h[0]+1.2+Math.cos(a)*1.6,h[1]+Math.sin(a)*1.6,h[0]+1.2+Math.cos(a)*4.2,h[1]+Math.sin(a)*4.2,0.4,'#6e4428');}
    circ2(c,[h[0]+1.2,h[1]],1.3,GOLD);}};
UNITS.egy_breaker={name:'صاحب النبّوت الكبير',twoH:true,sx:0.98,sy:1.0,lw:2.9,headR:3.5,
  head(c,p){c.beginPath();c.arc(0,-0.6,3.6,Math.PI,0);c.fillStyle='#efe6d2';c.fill();},robe:(c,J,p,col)=>galab(c,J,col,0.56),
  over:(c,J)=>belt(c,J,'#5a3a22',2),
  weapon(c,J,p){const s=staff(c,J,p,4.5,9.5,2.4,'#5e432b');const r=lp(s.A,s.B,0.85),n=[-s.d[1],s.d[0]];limb(c,r[0]-n[0]*1.3,r[1]-n[1]*1.3,r[0]+n[0]*1.3,r[1]+n[1]*1.3,0.9,'#5a5f66');
    const r2=lp(s.A,s.B,0.75);limb(c,r2[0]-n[0]*1.3,r2[1]-n[1]*1.3,r2[0]+n[0]*1.3,r2[1]+n[1]*1.3,0.9,'#5a5f66');}};
UNITS.egy_hero={name:'كبير الفتوات',hero:true,sx:1.0,sy:1.04,lw:3.0,headR:3.5,head:(c,p)=>fez(c),robe:(c,J,p,col)=>galab(c,J,col,0.9),
  over(c,J,p,col){const a=J.pl;pg(c,[add(J.chest,rot(-2,0.4,J.a2)),add(J.chest,rot(2.2,0.4,J.a2)),add(J.hip,rot(2.6,-1.6,a)),add(J.hip,rot(-2.2,-1.6,a))],'#2f3a2e');
    for(let k=0;k<3;k++){const P=lp(add(J.chest,rot(1.8,1.2,J.a2)),add(J.hip,rot(2.2,-2.2,a)),k/2.2);circ2(c,P,0.4,GOLD);}
    const A=add(J.chest,rot(-2.2,0,J.a2)),B=lp(J.legB.h,J.legB.k,0.9);limb(c,A[0],A[1],B[0]-1,B[1],1.4,'#d9c9a8');},
  weapon(c,J,p){const s=staff(c,J,p,5,6.5,1.5,'#4a3422');circ2(c,s.B,1.5,GOLD);}};
const NATIONS=[['yem','اليمن','أبناء سبأ',['yem_common','yem_boss','yem_healer','yem_hero']],
  ['sau','السعودية','حراس القوافل',['sau_common','sau_archer','sau_naft','sau_hero']],
  ['egy','مصر','فتوات الحارة',['egy_common','egy_shield','egy_breaker','egy_hero']]];
function drawSkinned(c,key,x,y,sc,col,p,dir){const U=UNITS[key];if(U.twoH){const d=wdir(p.wa);p=Object.assign({},p);p.bh=[p.fh[0]-d[0]*3.2,p.fh[1]-d[1]*3.2];}
  c.save();c.translate(x,y);c.scale(sc*(dir||1)*U.sx,sc*U.sy);const s=1-(p.air||0)*0.35;ell(c,0,0.6,4.2*s,1.7*s,'rgba(0,0,0,0.28)');
  if(U.aura){c.beginPath();c.ellipse(0,0.5,9,3.6,0,0,TAU);c.strokeStyle='rgba(255,214,110,0.8)';c.lineWidth=0.9;c.setLineDash([3,2.4]);c.stroke();c.setLineDash([]);}
  if(U.hero){c.beginPath();c.ellipse(0,0.5,7,2.8,0,0,TAU);c.strokeStyle='#e6c25a';c.lineWidth=1.1;c.stroke();}
  drawBody(c,p,col,U);c.restore();}
