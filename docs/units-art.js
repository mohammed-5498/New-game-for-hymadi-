/* ====== رسم الوحدات بأسلوب Stickman + أنميشن ======
   drawUnit(ctx, key, {x,y,t,state,color,dir,scale,rate})
   state: 'idle' | 'walk' (جري) | 'attack' | 'hurt' | 'death'
   كل شيء بالكود بلا صور. نظام محلي: القدمان عند (0,0)، الطول ~26.
   الهيكل عظمي حقيقي: ورك وركبة وكاحل وكتف ومرفق، والأطراف خطوط بلون اللاعب. */
const TAU=6.2831853,WOOD='#8a6a45',STEEL='#b9bec5',DARKW='#5f646b';
const P=(c,f)=>{c.fillStyle=f;c.fill();};
const ease=x=>x<0?0:x>1?1:x*x*(3-2*x), easeOut=x=>1-(1-Math.min(1,Math.max(0,x)))**3;
function dk(h,a){const n=parseInt(h.slice(1),16);
  const r=Math.round(((n>>16)&255)*(1-a)),g=Math.round(((n>>8)&255)*(1-a)),b=Math.round((n&255)*(1-a));
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);}
function lt(h,a){const n=parseInt(h.slice(1),16);
  const r=Math.round(((n>>16)&255)+(255-((n>>16)&255))*a),g=Math.round(((n>>8)&255)+(255-((n>>8)&255))*a),b=Math.round((n&255)+(255-(n&255))*a);
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);}
function limb(c,x1,y1,x2,y2,w,col){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=col;c.lineWidth=w;c.lineCap='round';c.stroke();}
function bone(c,x1,y1,x2,y2,x3,y3,w,col){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.lineTo(x3,y3);c.strokeStyle=col;c.lineWidth=w;c.lineCap='round';c.lineJoin='round';c.stroke();}
function ell(c,x,y,rx,ry,f){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);P(c,f);}
function rrect(c,x,y,w,h,r,f){c.beginPath();c.roundRect?c.roundRect(x,y,w,h,r):c.rect(x,y,w,h);P(c,f);}
function tri(c,a,b,d,f){c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.lineTo(d[0],d[1]);c.closePath();P(c,f);}
function seg(c,x,y,a1,L1,a2,L2,w,col){const x1=x+Math.sin(a1)*L1,y1=y+Math.cos(a1)*L1,x2=x1+Math.sin(a2)*L2,y2=y1+Math.cos(a2)*L2;
  bone(c,x,y,x1,y1,x2,y2,w,col);return {x:x2,y:y2,kx:x1,ky:y1};}
/* ====== الهيكل الحركي ====== */
function rig(o){
  const t=o.t||0,S=o.spd||1,rate=o.rate||1;
  let st=o.state||'idle';const isU=st==='ult';if(isU)st='attack';
  const R={st,t,S};if(isU)R.ult=1;
  if(st==='walk'){const f=2.55*S,p=t*f*TAU;R.p=p;
    R.bounce=-Math.cos(p*2)*1.5-0.6;R.lean=0.30;R.air=Math.max(0,Math.sin(p*2))*0.55;
    R.thigh=q=>0.95*Math.sin(p+q);R.flex=q=>1.55*Math.pow(0.5+0.5*Math.cos(p+q-4.12),2.2)+0.18;R.armPh=p;}
  else if(st==='attack'){const a=(t/rate)%1;R.a=a;R.p=t*1.1*TAU;let s,lunge;
    if(a<0.34){const k=easeOut(a/0.34);s=-k;lunge=-1.1*k;}
    else if(a<0.44){const k=ease((a-0.34)/0.10);s=-1+2*k;lunge=-1.1+4.4*k;}
    else if(a<0.53){s=1;lunge=3.3;}
    else{const k=ease((a-0.53)/0.47);s=1-1.28*k;lunge=3.3-3.3*k;}
    R.s=s;R.lunge=lunge;R.hit=a>=0.44&&a<0.53;R.fx=a>=0.42&&a<0.60?1-(a-0.42)/0.18:0;
    R.bounce=-Math.abs(s)*0.5+(R.hit?0.7:0);R.lean=0.14+s*0.30;
    R.thigh=q=>(q<1?0.62:-0.70)+s*(q<1?0.42:-0.30);R.flex=q=>(q<1?0.42:0.78)-s*0.12;R.air=0;R.armPh=0;}
  else if(st==='hurt'){const a=Math.min(1,t/(o.hurtDur||0.35));R.a=a;R.p=0;const f=Math.sin(a*3.1416);
    R.flinch=f;R.bounce=-f*0.5;R.lean=0.05-f*0.55;R.thigh=q=>(q<1?0.2:-0.3)-f*0.25;R.flex=()=>0.3+f*0.25;
    R.air=0;R.armPh=0;R.s=-f*0.4;R.lunge=-f*1.8;R.hit=false;R.fx=0;}
  else if(st==='death'){const a=Math.min(1,t/(o.deathDur||1));R.a=a;R.p=0;R.death=a;
    R.bounce=-Math.sin(Math.min(1,a*1.6)*3.1416)*1.2;R.lean=0.1;
    R.thigh=q=>(q<1?0.5:-0.55)+a*0.5;R.flex=()=>0.55+a*0.5;R.air=0;R.armPh=0;R.s=-0.5+a*0.3;R.lunge=0;R.hit=false;R.fx=0;}
  else{const p=t*1.25*S;R.p=p;R.bounce=Math.sin(p*TAU/2)*0.32;R.lean=0.05;R.air=0;
    R.thigh=q=>(q<1?0.13:-0.13);R.flex=()=>0.16;R.armPh=p*2.2;R.s=0;R.lunge=0;R.hit=false;R.fx=0;}
  R.hipY=-11+R.bounce;R.hipX=(R.lunge||0)*0.55;return R;}
/* ====== لبنات الـ stickman ====== */
function body(c,r,fn){c.save();c.translate(r.hipX,r.hipY);c.rotate(-r.lean);fn();c.restore();}
function shadow(c,r,w){const s=1-(r.air||0)*0.35;ell(c,0,0.6,(w||3.8)*s,1.6*s,'rgba(0,0,0,'+(0.3*s)+')');}
function dust(c,r){
  if(r.st==='attack'&&r.a>0.34&&r.a<0.62){const g=(r.a-0.34)/0.28;c.globalAlpha=(1-g)*0.45;
    ell(c,-4-g*5,0.2,2.2+g*3,1+g*0.7,'#b9b0a2');c.globalAlpha=1;}
  if(r.st==='walk'&&Math.sin(r.p*2)<-0.85){c.globalAlpha=0.3;ell(c,-5,0.4,2.4,0.9,'#b9b0a2');c.globalAlpha=1;}}
function trail(c,r,cb){if(!(r.st==='attack'&&r.a>=0.34&&r.a<0.53))return;
  for(let i=1;i<=3;i++){const b=r.s-i*0.32;if(b<-1.05)continue;c.globalAlpha=0.2*(4-i)/3;cb(b);c.globalAlpha=1;}}
function spark(c,x,y,r){if(!r.fx)return;const g=r.fx;c.globalAlpha=g*0.9;
  for(let i=0;i<5;i++){const a=i*1.256+0.4;limb(c,x,y,x+Math.cos(a)*(2+g*3.6),y+Math.sin(a)*(2+g*3.6),0.9,'#ffe08a');}
  ell(c,x,y,1.2+g*2,1.2+g*2,'rgba(255,236,170,'+(g*0.7)+')');c.globalAlpha=1;}
function speedLines(c,r){if(r.st!=='walk')return;c.globalAlpha=0.28;
  for(let i=0;i<3;i++){const y=-6-i*4.5,l=4+((r.p*4+i)%3)*2.4;limb(c,-7-l,y,-7,y,0.8,'#b9b0a2');}c.globalAlpha=1;}
/* أرجل عصوية: ورك ← ركبة ← كاحل ← قدم */
function legs(c,r,col,w){const W=w||2;
  for(const q of [Math.PI,0]){const th=r.thigh(q),fl=r.flex(q),cc=q?dk(col,0.32):col;
    const e=seg(c,r.hipX+(q?-1.2:1.2),r.hipY,th,5.8,th-fl,6,W,cc);
    limb(c,e.x,e.y,e.x+Math.sin(th-fl+1.1)*2,e.y+Math.cos(th-fl+1.1)*0.9,W,cc);}}
/* ذراع خلفية تتأرجح */
function backArm(c,r,col,W){
  const k=r.st==='walk'?Math.sin(r.armPh+Math.PI):(r.st==='idle'?Math.sin(r.armPh)*0.25:-0.15);
  const a1=-k*0.95,a2=a1-(r.st==='walk'?1.45:0.35);
  return seg(c,-0.8,-8,a1,3.6,a2,3.4,W||1.9,dk(col,0.32));}
/* ذراع أمامية تمسك السلاح: تعيد موضع اليد */
function armTo(c,r,col,hx,hy,W){
  const sh={x:0.8,y:-8.2};
  const mx=(sh.x+hx)/2+0.8,my=(sh.y+hy)/2+0.6;
  bone(c,sh.x,sh.y,mx,my,hx,hy,W||2,col);return {x:hx,y:hy};}
function headBall(c,col,R){c.beginPath();c.arc(0.5,-12.6,R||3,0,TAU);P(c,col);
  c.lineWidth=0.7;c.strokeStyle=dk(col,0.4);c.stroke();}
function spine(c,col,W){limb(c,0,0.4,0.4,-8.4,(W||2)+0.5,col);limb(c,0.4,-8.4,0.5,-9.8,(W||2)*0.8,col);}
/* هيكل جاهز: أرجل + ذراع خلفية + عمود + رأس، ثم إضافات الوحدة */
function stick(c,r,col,o){
  o=o||{};const W=o.lw||2;
  legs(c,r,col,W);
  body(c,r,()=>{
    backArm(c,r,col,W-0.1);
    o.back&&o.back(c,r,col);
    spine(c,col,W);
    o.chest&&o.chest(c,r,col);
    headBall(c,col,o.headR);
    o.head&&o.head(c,r,col);
    o.arm&&o.arm(c,r,col,W);
  });
  dust(c,r);}
/* مساعد السلاح: زاوية من قيمة الضربة الرئيسية */
function wAng(r,base,range){return base+(r.s||0)*range;}
function hand(base,range,r,reach,off){const A=wAng(r,base,range);
  return {A,x:0.8+Math.sin(A+(off||1.2))*reach,y:-8.2+Math.cos(A+(off||1.2))*(reach*0.86)};}

const U={};
/* ================= الغربان: نحيفة وطويلة، قلنسوة وعباءة ================= */
function hood(c,col){c.beginPath();c.moveTo(-2.7,-11.9);c.quadraticCurveTo(0.5,-17.4,3.7,-11.9);c.closePath();P(c,dk(col,0.45));}
U.crow_common={sx:0.9,sy:1.08,draw(c,r,col){stick(c,r,col,{lw:1.9,headR:2.9,
  back(cc,rr,cl){tri(cc,[-1.4,-8.6],[-6.6-(rr.st==='walk'?Math.sin(rr.p)*2.4:0),-1.6-(rr.air||0)*3],[-1.4,-0.6],dk(cl,0.25));},
  head:(cc,rr,cl)=>hood(cc,cl),
  arm(cc,rr,cl,W){const h=hand(-0.35,1.5,rr,6,1.2);
    trail(cc,rr,s=>{const A=-0.35+s*1.5,x=0.8+Math.sin(A+1.2)*6,y=-8.2+Math.cos(A+1.2)*5.2;
      limb(cc,x,y,x+Math.sin(A+1.9)*3.4,y+Math.cos(A+1.9)*3,1.3,'#e6e2d6');});
    armTo(cc,rr,cl,h.x,h.y,W);
    const tx=h.x+Math.sin(h.A+1.9)*3.4,ty=h.y+Math.cos(h.A+1.9)*3;
    limb(cc,h.x,h.y,tx,ty,1.4,STEEL);if(rr.fx)spark(cc,tx,ty,rr);}});}};
function ik2(ox,oy,tx,ty,L1,L2,flip){let dx=tx-ox,dy=ty-oy,d=Math.hypot(dx,dy)||0.001;
  const cl=Math.max(Math.abs(L1-L2)+0.01,Math.min(d,L1+L2-0.01));
  const ex=ox+dx/d*cl,ey=oy+dy/d*cl,a=Math.atan2(ey-oy,ex-ox);
  const A=Math.acos(Math.max(-1,Math.min(1,(L1*L1+cl*cl-L2*L2)/(2*L1*cl))));
  const ang=a+(flip?A:-A);return {jx:ox+Math.cos(ang)*L1,jy:oy+Math.sin(ang)*L1,ex,ey};}
/* ================= المطارق: عريضة وقصيرة، خوذة ودرع كتف ================= */
function helm(c,col){c.beginPath();c.arc(0.5,-12.9,3.4,Math.PI,0);P(c,dk(col,0.5));
  rrect(c,-2.9,-13.3,6.8,1.2,0.3,dk(col,0.5));}
U.hammer_common={sx:1.2,sy:0.93,draw(c,r,col){stick(c,r,col,{lw:2.6,headR:3.1,
  chest(cc,rr,cl){limb(cc,-4.2,-9.4,4.6,-9.4,2.4,dk(cl,0.2));},
  head:(cc,rr,cl)=>helm(cc,cl),
  arm(cc,rr,cl,W){const h=hand(-0.55,1.6,rr,5.4,1.15);
    trail(cc,rr,s=>{const A=-0.55+s*1.6,x=0.8+Math.sin(A+1.15)*5.4,y=-8.2+Math.cos(A+1.15)*4.6;
      limb(cc,x,y,x+Math.sin(A+1.7)*4.2,y+Math.cos(A+1.7)*3.8,1.6,'#c8b49a');});
    armTo(cc,rr,cl,h.x,h.y,W);
    const ex=h.x+Math.sin(h.A+1.7)*4.2,ey=h.y+Math.cos(h.A+1.7)*3.8;
    limb(cc,h.x,h.y,ex,ey,1.5,WOOD);
    cc.save();cc.translate(ex,ey);cc.rotate(-(h.A+1.7));rrect(cc,-1.5,-2,3,4,0.7,STEEL);cc.restore();
    if(rr.fx)spark(cc,ex,ey,rr);}});}};
U.hammer_shield={sx:1.26,sy:0.92,spd:0.72,draw(c,r,col){stick(c,r,col,{lw:3,headR:3.2,
  chest(cc,rr,cl){limb(cc,-4.8,-9.6,5,-9.6,2.8,dk(cl,0.2));},
  head:(cc,rr,cl)=>helm(cc,cl),
  arm(cc,rr,cl,W){const push=rr.st==='attack'?Math.max(0,(rr.s||0))*3.2:0;
    limb(cc,0.8,-8.2,4.8+(rr.hit?1.2:0),-5.2,2.6,cl);
    cc.save();cc.translate(-5.8-push*0.9,-6.2+(rr.st==='walk'?Math.sin(rr.p)*0.6:0));cc.rotate(-push*0.16);
    rrect(cc,-2.6,-7.6,5.6,15.2,1.8,lt(cl,0.25));rrect(cc,-1.4,-6,3.2,12,1,dk(cl,0.15));
    ell(cc,0.4,0,1.4,1.4,lt(cl,0.55));cc.restore();
    if(rr.fx)spark(cc,-9,-6.2,rr);}});}};
U.hammer_breaker={sx:1.24,sy:0.93,spd:0.62,draw(c,r,col){stick(c,r,col,{lw:3,headR:3.2,
  chest(cc,rr,cl){limb(cc,-4.8,-9.6,5,-9.6,2.8,dk(cl,0.2));},
  head:(cc,rr,cl)=>{rrect(cc,-2.9,-14.6,6.8,2,0.5,dk(cl,0.5));},
  arm(cc,rr,cl,W){const base=-2.5,A=base+(rr.s||0)*2.9,L=13;
    function sledge(a2,wc,hc){const ex=0.6+Math.sin(a2+1.5)*L,ey=-8.6+Math.cos(a2+1.5)*L;
      limb(cc,0.6,-8.6,ex,ey,1.8,wc);
      cc.save();cc.translate(ex,ey);cc.rotate(-(a2+1.5));rrect(cc,-2.6,-3.4,5.6,6.8,1.1,hc);
      rrect(cc,-2.6,-3.4,2,6.8,0.9,lt(hc,0.3));cc.restore();
      limb(cc,-0.8,-8.2,0.6*0.4+ex*0.3,-8.6*0.4+ey*0.3,2.6,dk(cl,0.32));
      limb(cc,0.8,-8.4,0.6*0.6+ex*0.2,-8.6*0.6+ey*0.2,2.6,cl);return [ex,ey];}
    trail(cc,rr,s=>sledge(base+s*2.9,'#c8b49a','#cdd2d8'));
    const e=sledge(A,WOOD,DARKW);
    if(rr.fx){spark(cc,e[0],e[1],rr);cc.globalAlpha=rr.fx*0.5;
      cc.beginPath();cc.ellipse(e[0],e[1]+1,7+(1-rr.fx)*7,3+(1-rr.fx)*3,0,0,TAU);
      cc.strokeStyle='#ffe08a';cc.lineWidth=1.4;cc.stroke();cc.globalAlpha=1;}}});}};
/* ================= الأفاعي: منحنية ونحيفة، قناع وجعبة ================= */
function mask(c,col){rrect(c,-2.7,-13.4,6.4,1.8,0.4,dk(col,0.55));}
U.viper_common={sx:0.93,sy:0.96,draw(c,r,col){stick(c,r,col,{lw:1.9,headR:2.9,
  head:(cc,rr,cl)=>mask(cc,cl),
  arm(cc,rr,cl,W){const h=hand(-0.15,1.7,rr,5.6,1.25);armTo(cc,rr,cl,h.x,h.y,W);
    const thrown=rr.st==='attack'&&rr.a>=0.44;
    if(!thrown)ell(cc,h.x+0.8,h.y-0.4,1.5,1.4,'#9a948c');
    else{const g=(rr.a-0.44)/0.56;ell(cc,h.x+3+g*22,h.y-3-Math.sin(g*3.14)*6,1.5,1.4,'#9a948c');}}});}};
U.viper_sniper={sx:0.9,sy:1,spd:0.8,draw(c,r,col){stick(c,r,col,{lw:1.9,headR:2.9,
  back(cc,rr,cl){limb(cc,-2.6,-9.2,-4.2,-3,2.2,dk(cl,0.45));
    [0,1.2,2.4].forEach(d=>limb(cc,-2.9-d*0.2,-9.6-d,-3.5-d*0.2,-12.2-d,0.6,'#d9d3c6'));},
  head:(cc,rr,cl)=>mask(cc,cl),
  arm(cc,rr,cl,W){const a=rr.st==='attack'?rr.a:0;
    const pull=rr.st!=='attack'?0:(a<0.4?3.8*easeOut(a/0.4):(a<0.47?3.8:0));
    const bx=5.4,by=-8.2,fired=rr.st==='attack'&&a>=0.47,bend=1+(pull/3.8)*0.55;
    cc.beginPath();cc.moveTo(bx,by-7.6);cc.quadraticCurveTo(bx+4.6*bend,by,bx,by+7.6);
    cc.strokeStyle=WOOD;cc.lineWidth=1.4;cc.stroke();
    cc.beginPath();cc.moveTo(bx,by-7.6);cc.lineTo(bx-pull,by);cc.lineTo(bx,by+7.6);
    cc.strokeStyle='#d9d3c6';cc.lineWidth=0.6;cc.stroke();
    if(!fired&&pull>0.5)limb(cc,bx-pull,by,bx+3.6,by,0.9,'#d9d3c6');
    limb(cc,0.8,-8.2,bx-0.8,by,2,cl);limb(cc,-0.8,-8,bx-pull-1,by+0.4,1.9,dk(cl,0.32));
    if(fired){const g=(a-0.47)/0.53;cc.globalAlpha=Math.max(0,1-g*1.4);
      limb(cc,bx+4+g*30,by,bx+10+g*30,by,0.9,'#d9d3c6');cc.globalAlpha=1;}}});}};
U.viper_firebomber={sx:0.94,sy:0.96,draw(c,r,col){stick(c,r,col,{lw:1.9,headR:2.9,
  chest(cc,rr,cl){rrect(cc,-2.6,-5,2,3.4,0.6,'#5a8a6a');rrect(cc,0,-5,2,3.4,0.6,'#5a8a6a');},
  head:(cc,rr,cl)=>mask(cc,cl),
  arm(cc,rr,cl,W){const h=hand(-1.35,2.3,rr,6,1.2);armTo(cc,rr,cl,h.x,h.y,W);
    function bottle(x,y){rrect(cc,x-1.1,y-2.4,2.2,4,0.8,'#5a8a6a');
      tri(cc,[x-1.1,y-2.4],[x,y-5.2],[x+1.1,y-2.4],'#e8893a');
      tri(cc,[x-0.5,y-2.6],[x,y-4],[x+0.5,y-2.6],'#f2c14e');}
    const thrown=rr.st==='attack'&&rr.a>=0.44;
    if(!thrown)bottle(h.x,h.y);
    else{const g=(rr.a-0.44)/0.56;cc.save();cc.translate(h.x+4+g*24,h.y-4-Math.sin(g*3.14)*7);cc.rotate(g*9);bottle(0,0);cc.restore();}}});}};
/* ================= العقارب: متوسطة، عصابة رأس وقبعة الزعيم ================= */
function band(c,col){rrect(c,-2.8,-14.4,6.6,1.8,0.5,dk(col,0.5));
  limb(c,-2.6,-13.6,-5,-11.2,0.9,dk(col,0.5));}
U.scorp_common={sx:1.03,sy:0.99,draw(c,r,col){stick(c,r,col,{lw:2.1,headR:3,
  head:(cc,rr,cl)=>band(cc,cl),
  arm(cc,rr,cl,W){const h=hand(-0.45,1.65,rr,5.4,1.2);
    trail(cc,rr,s=>{const A=-0.45+s*1.65,x=0.8+Math.sin(A+1.2)*5.4,y=-8.2+Math.cos(A+1.2)*4.6;
      limb(cc,x,y,x+Math.sin(A+1.75)*4.4,y+Math.cos(A+1.75)*4,1.4,'#b0aaa2');});
    armTo(cc,rr,cl,h.x,h.y,W);
    const tx=h.x+Math.sin(h.A+1.75)*4.4,ty=h.y+Math.cos(h.A+1.75)*4;
    limb(cc,h.x,h.y,tx,ty,1.5,'#8e8880');if(rr.fx)spark(cc,tx,ty,rr);}});}};
U.scorp_boss={sx:1.1,sy:1.05,spd:0.85,draw(c,r,col){
  const pulse=1+Math.sin(r.t*2.4)*0.05;
  c.beginPath();c.ellipse(0,0.5,10.5*pulse,4.2*pulse,0,0,TAU);
  c.strokeStyle='rgba(240,182,74,0.9)';c.lineWidth=1;c.setLineDash([3,2.4]);c.stroke();c.setLineDash([]);
  stick(c,r,col,{lw:2.3,headR:3.1,
  back(cc,rr,cl){const fl=(rr.st==='walk'?Math.sin(rr.p)*1.4:0)+(rr.lunge||0)*0.4;
    tri(cc,[-2.2,-9.4],[-5.4-fl,2.4],[1.6,-9.4],dk(cl,0.28));
    tri(cc,[1.6,-9.4],[4.6-fl,2.4],[-2.2,-9.4],dk(cl,0.12));},
  head(cc,rr,cl){ell(cc,0.5,-15.1,5.6,1.3,dk(cl,0.55));
    rrect(cc,-2.4,-18.6,6,3.8,1.2,dk(cl,0.55));rrect(cc,-2.4,-16.1,6,1,0.3,cl);},
  arm(cc,rr,cl,W){const h=hand(-0.4,1.6,rr,5.4,1.2);
    trail(cc,rr,s=>{const A=-0.4+s*1.6,x=0.8+Math.sin(A+1.2)*5.4,y=-8.2+Math.cos(A+1.2)*4.6;
      limb(cc,x,y,x+Math.sin(A+1.8)*3.4,y+Math.cos(A+1.8)*3,1.3,'#dcd7cd');});
    armTo(cc,rr,cl,h.x,h.y,W);
    const tx=h.x+Math.sin(h.A+1.8)*3.4,ty=h.y+Math.cos(h.A+1.8)*3;
    limb(cc,h.x,h.y,tx,ty,1.3,STEEL);if(rr.fx)spark(cc,tx,ty,rr);}});}};
U.scorp_medic={sx:1.01,sy:0.99,draw(c,r,col){stick(c,r,col,{lw:2,headR:3,
  back(cc,rr,cl){limb(cc,-2.8,-9.4,2.8,-4,0.9,'#8a6a4a');
    rrect(cc,-5.6,-4.6,3.2,2.8,0.6,'#efe6d2');rrect(cc,-4.4,-4.4,0.8,2.4,0,'#c0392b');rrect(cc,-5.2,-3.5,2.4,0.7,0,'#c0392b');},
  head(cc,rr,cl){rrect(cc,-2.8,-15,6.6,1.8,0.4,'#efe6d2');rrect(cc,-0.1,-15,1.1,1.8,0,'#c0392b');},
  arm(cc,rr,cl,W){const a=rr.st==='attack'?rr.a:0;
    const lift=rr.st==='attack'?(a<0.4?-4.2*easeOut(a/0.4):(a<0.6?-4.2:-4.2+4.2*ease((a-0.6)/0.4))):0;
    armTo(cc,rr,cl,4.4,-5.8+lift,W);
    rrect(cc,3.2,-7.4+lift,3,2.2,0.5,'#efe6d2');rrect(cc,4.2,-7.2+lift,0.9,1.8,0,'#c0392b');
    rrect(cc,3.4,-6.5+lift,2.6,0.7,0,'#c0392b');
    if(rr.st==='attack'&&a>0.35&&a<0.9){const g=(a-0.35)/0.55;cc.globalAlpha=Math.sin(g*3.14)*0.95;
      for(let i=0;i<3;i++){const o=(g+i*0.33)%1;
        tri(cc,[3+i*1.6,-9-o*11],[4.6+i*1.6,-11-o*11],[1.4+i*1.6,-11-o*11],'#7fd48a');}
      cc.globalAlpha=1;}}});}};
/* ===== إضافات: شخصيتا الغربان الجديدتان + أبطال العصابات الأربع ===== */
function crown(c,col){ // علامة البطل فوق الرأس
  tri(c,[-2.2,-16.3],[0.6,-19.8],[3.4,-16.3],'#f0c04a');
  rrect(c,-2.4,-16.5,5.8,1.1,0.3,'#f0c04a');}
function heroRing(c,col){c.beginPath();c.ellipse(0,0.6,6.4,2.6,0,0,TAU);
  c.strokeStyle='rgba(240,192,74,0.8)';c.lineWidth=0.9;c.stroke();}
/* --- الغربان: حامل الرمح — عصا طويلة، مدى بسيط، دم أعلى، طعنة للأمام --- */
U.crow_spear={sx:0.94,sy:1.08,spd:0.9,draw(c,r,col){stick(c,r,col,{lw:2.1,headR:3,
  head:(cc,rr,cl)=>hood(cc,cl),
  arm(cc,rr,cl,W){
    const ext=(rr.s||0)*4.2, hx=2+ext*0.55, hy=-8.4;
    function pole(x,alpha){
      if(alpha!==undefined)cc.globalAlpha=alpha;
      limb(cc,x-7.6,hy+2.4,x+13.4,hy-1.2,1.5,WOOD);
      const tx=x+13.4,ty=hy-1.2;
      tri(cc,[tx-1.8,ty+2],[tx+4.8,ty-0.4],[tx-1.8,ty-2.6],STEEL);
      limb(cc,tx-2.6,ty+0.5,tx-1.4,ty+0.3,1.8,'#cdd2d8');
      if(alpha!==undefined)cc.globalAlpha=1;return [tx+4,ty];}
    if(rr.st==='attack'&&rr.a>=0.34&&rr.a<0.53)
      for(let i=1;i<=2;i++){const back=(rr.s||0)-i*0.4;if(back<-1)continue;pole(2+back*4.2*0.55,0.2*(3-i)/2);}
    const tip=pole(hx);
    armTo(cc,rr,cl,hx,hy,W);
    limb(cc,hx-4.4,hy+1.4,hx-2,hy+0.8,1.8,dk(cl,0.32));
    if(rr.fx)spark(cc,tip[0],tip[1],rr);}});}};
/* --- الغربان: المزدوج — عصوان، ضربات متتابعة سريعة --- */
U.crow_dual={sx:0.9,sy:1.06,spd:1.15,draw(c,r,col){stick(c,r,col,{lw:1.9,headR:2.9,
  back(cc,rr,cl){ // الذراع الثانية معاكسة الطور
    const s2=-(rr.s||0),A=-0.45+s2*1.55;
    const x=-0.4+Math.sin(A+1.2)*5,y=-8+Math.cos(A+1.2)*4.3;
    limb(cc,-0.8,-8,x,y,1.8,dk(cl,0.32));
    const bx=x+Math.sin(A+1.75)*5.2,by=y+Math.cos(A+1.75)*4.6;
    limb(cc,x,y,bx,by,2,'#a8845a');
    limb(cc,bx-(bx-x)*0.22,by-(by-y)*0.22,bx,by,2.2,'#8e949c');},
  head:(cc,rr,cl)=>hood(cc,cl),
  arm(cc,rr,cl,W){const h=hand(-0.45,1.55,rr,5.2,1.2);
    trail(cc,rr,s=>{const A=-0.45+s*1.55,x=0.8+Math.sin(A+1.2)*5.2,y=-8.2+Math.cos(A+1.2)*4.5;
      limb(cc,x,y,x+Math.sin(A+1.75)*5.4,y+Math.cos(A+1.75)*4.8,1.8,'#e6e2d6');});
    armTo(cc,rr,cl,h.x,h.y,W);
    const tx=h.x+Math.sin(h.A+1.75)*5.4,ty=h.y+Math.cos(h.A+1.75)*4.8;
    limb(cc,h.x,h.y,tx,ty,2.1,'#c8a06a');
    limb(cc,tx-(tx-h.x)*0.22,ty-(ty-h.y)*0.22,tx,ty,2.3,'#b9bec5');
    if(rr.fx)spark(cc,tx,ty,rr);}});}};
/* --- بطل الغربان: عصا طويلة بنصل، تتسارع ضرباته --- */
U.crow_hero={sx:1,sy:1.14,spd:0.95,hero:1,draw(c,r,col){heroRing(c,col);stick(c,r,col,{lw:2.3,headR:3.1,
  back(cc,rr,cl){tri(cc,[-1.6,-9.6],[-7.4-(rr.st==='walk'?Math.sin(rr.p)*2.6:0),-1.4-(rr.air||0)*3],[-1.6,0.4],dk(cl,0.22));},
  head(cc,rr,cl){hood(cc,cl);crown(cc,cl);},
  arm(cc,rr,cl,W){const A=-2.2+(rr.s||0)*2.7,L=12.5;
    function staff(a2,alpha){const ex=0.8+Math.sin(a2+1.5)*L,ey=-8.6+Math.cos(a2+1.5)*L;
      const bx=0.8-Math.sin(a2+1.5)*5,by=-8.6-Math.cos(a2+1.5)*5;
      if(alpha!==undefined)cc.globalAlpha=alpha;
      limb(cc,bx,by,ex,ey,1.4,WOOD);
      cc.save();cc.translate(ex,ey);cc.rotate(-(a2+1.5));
      tri(cc,[-1.3,1.4],[3.8,0],[-1.3,-1.4],STEEL);cc.restore();
      if(alpha!==undefined)cc.globalAlpha=1;return [ex,ey];}
    if(rr.st==='attack'&&rr.a>=0.34&&rr.a<0.53)
      for(let i=1;i<=3;i++){const b=(rr.s||0)-i*0.34;if(b<-1.05)continue;staff(-2.2+b*2.7,0.2*(4-i)/3);}
    const e=staff(A);
    limb(cc,0.8,-8.2,0.8+Math.sin(A+1.5)*3.4,-8.6+Math.cos(A+1.5)*3.4,2.1,cl);
    limb(cc,-0.8,-8,0.8-Math.sin(A+1.5)*2.4,-8.6-Math.cos(A+1.5)*2.4,2,dk(cl,0.32));
    if(rr.fx)spark(cc,e[0],e[1],rr);}});}};
/* --- بطل المطارق: أضخم الجميع، درع كبير + مطرقة --- */
U.hammer_hero={sx:1.42,sy:1.12,spd:0.7,hero:1,shadowW:5,draw(c,r,col){heroRing(c,col);stick(c,r,col,{lw:3.2,headR:3.3,
  chest(cc,rr,cl){limb(cc,-5.2,-9.8,5.4,-9.8,3,dk(cl,0.2));},
  head(cc,rr,cl){cc.beginPath();cc.arc(0.5,-12.9,3.6,Math.PI,0);P(cc,dk(cl,0.5));
    rrect(cc,-3.1,-13.3,7.2,1.3,0.3,dk(cl,0.5));
    tri(cc,[-0.4,-16],[0.6,-19.4],[1.6,-16],'#f0c04a');crown(cc,cl);},
  arm(cc,rr,cl,W){
    const push=rr.st==='attack'?Math.max(0,(rr.s||0))*1.6:0;
    cc.save();cc.translate(-6.4-push*0.7,-6.4+(rr.st==='walk'?Math.sin(rr.p)*0.6:0));cc.rotate(-push*0.12);
    rrect(cc,-3,-8.8,6.4,17.6,2,lt(cl,0.25));rrect(cc,-1.6,-7,3.6,14,1,dk(cl,0.15));
    ell(cc,0.4,0,1.6,1.6,'#f0c04a');cc.restore();
    const h=hand(-0.6,1.7,rr,5.8,1.15);
    trail(cc,rr,s=>{const A=-0.6+s*1.7,x=0.8+Math.sin(A+1.15)*5.8,y=-8.2+Math.cos(A+1.15)*5;
      limb(cc,x,y,x+Math.sin(A+1.7)*4.6,y+Math.cos(A+1.7)*4.2,1.7,'#c8b49a');});
    armTo(cc,rr,cl,h.x,h.y,W);
    const ex=h.x+Math.sin(h.A+1.7)*4.6,ey=h.y+Math.cos(h.A+1.7)*4.2;
    limb(cc,h.x,h.y,ex,ey,1.7,WOOD);
    cc.save();cc.translate(ex,ey);cc.rotate(-(h.A+1.7));
    rrect(cc,-2,-2.8,4.2,5.6,0.9,DARKW);rrect(cc,-2,-2.8,1.5,5.6,0.7,STEEL);cc.restore();
    if(rr.fx){spark(cc,ex,ey,rr);cc.globalAlpha=rr.fx*0.5;
      cc.beginPath();cc.ellipse(ex,ey+1,6+(1-rr.fx)*6,2.6+(1-rr.fx)*2.6,0,0,TAU);
      cc.strokeStyle='#ffe08a';cc.lineWidth=1.3;cc.stroke();cc.globalAlpha=1;}}});}};
/* --- بطل الأفاعي: أكبر، قوس يطلق ثلاثة سهام معاً --- */
U.viper_hero={sx:1.06,sy:1.12,spd:0.85,hero:1,draw(c,r,col){heroRing(c,col);stick(c,r,col,{lw:2.3,headR:3.1,
  back(cc,rr,cl){limb(cc,-2.8,-9.6,-4.6,-3,2.6,dk(cl,0.45));
    [0,1.2,2.4,3.6].forEach(d=>limb(cc,-3.1-d*0.2,-10-d,-3.7-d*0.2,-12.8-d,0.6,'#d9d3c6'));},
  head(cc,rr,cl){mask(cc,cl);crown(cc,cl);},
  arm(cc,rr,cl,W){const a=rr.st==='attack'?rr.a:0;
    const pull=rr.st!=='attack'?0:(a<0.4?4.2*easeOut(a/0.4):(a<0.47?4.2:0));
    const bx=5.8,by=-8.4,fired=rr.st==='attack'&&a>=0.47,bend=1+(pull/4.2)*0.6;
    cc.beginPath();cc.moveTo(bx,by-9);cc.quadraticCurveTo(bx+5.4*bend,by,bx,by+9);
    cc.strokeStyle=WOOD;cc.lineWidth=1.6;cc.stroke();
    cc.beginPath();cc.moveTo(bx,by-9);cc.lineTo(bx-pull,by);cc.lineTo(bx,by+9);
    cc.strokeStyle='#d9d3c6';cc.lineWidth=0.7;cc.stroke();
    if(!fired&&pull>0.5)[-1.8,0,1.8].forEach(o=>limb(cc,bx-pull,by+o*0.5,bx+3.8,by+o,0.8,'#d9d3c6'));
    limb(cc,0.8,-8.4,bx-0.8,by,2.2,cl);limb(cc,-0.8,-8.2,bx-pull-1.2,by+0.4,2.1,dk(cl,0.32));
    if(fired){const g=(a-0.47)/0.53;cc.globalAlpha=Math.max(0,1-g*1.4);
      [-3.2,0,3.2].forEach(o=>limb(cc,bx+4+g*30,by+o*(0.4+g),bx+10+g*30,by+o*(0.55+g*1.2),0.9,'#d9d3c6'));
      cc.globalAlpha=1;}}});}};
/* --- بطل العقارب: قائد وطبيب معاً — هالة مزدوجة وعلبة إسعاف --- */
U.scorp_hero={sx:1.14,sy:1.1,spd:0.88,hero:1,draw(c,r,col){
  const pulse=1+Math.sin(r.t*2.4)*0.06;
  c.beginPath();c.ellipse(0,0.5,11.5*pulse,4.6*pulse,0,0,TAU);
  c.strokeStyle='rgba(240,182,74,0.9)';c.lineWidth=1;c.setLineDash([3,2.4]);c.stroke();
  c.beginPath();c.ellipse(0,0.5,8.4*pulse,3.4*pulse,0,0,TAU);
  c.strokeStyle='rgba(127,212,138,0.8)';c.stroke();c.setLineDash([]);
  stick(c,r,col,{lw:2.4,headR:3.2,
  back(cc,rr,cl){const fl=(rr.st==='walk'?Math.sin(rr.p)*1.4:0)+(rr.lunge||0)*0.4;
    tri(cc,[-2.4,-9.6],[-5.8-fl,2.6],[1.8,-9.6],dk(cl,0.28));
    tri(cc,[1.8,-9.6],[4.8-fl,2.6],[-2.4,-9.6],dk(cl,0.12));
    rrect(cc,-6,-4.8,3.4,3,0.6,'#efe6d2');rrect(cc,-4.7,-4.6,0.9,2.6,0,'#c0392b');rrect(cc,-5.6,-3.6,2.6,0.8,0,'#c0392b');},
  head(cc,rr,cl){ell(cc,0.5,-15.3,5.8,1.4,dk(cl,0.55));
    rrect(cc,-2.5,-18.9,6.2,3.9,1.2,dk(cl,0.55));rrect(cc,-2.5,-16.3,6.2,1,0.3,'#efe6d2');
    rrect(cc,0,-16.3,1,1,0,'#c0392b');crown(cc,cl);},
  arm(cc,rr,cl,W){const h=hand(-0.45,1.65,rr,5.6,1.2);
    trail(cc,rr,s=>{const A=-0.45+s*1.65,x=0.8+Math.sin(A+1.2)*5.6,y=-8.2+Math.cos(A+1.2)*4.8;
      limb(cc,x,y,x+Math.sin(A+1.8)*3.8,y+Math.cos(A+1.8)*3.4,1.3,'#dcd7cd');});
    armTo(cc,rr,cl,h.x,h.y,W);
    const tx=h.x+Math.sin(h.A+1.8)*3.8,ty=h.y+Math.cos(h.A+1.8)*3.4;
    limb(cc,h.x,h.y,tx,ty,1.4,STEEL);
    if(rr.fx)spark(cc,tx,ty,rr);
    const g=(rr.t*0.6)%1;cc.globalAlpha=Math.sin(g*3.14)*0.7;
    tri(cc,[-4.6,-11-g*6],[-3,-13-g*6],[-6.2,-13-g*6],'#7fd48a');cc.globalAlpha=1;}});}};



/* ================= الشرطة (محايدة — لون ثابت لا يتبع أي لاعب) ================= */
const POLICE='#3a5a86';
function cap(c,col){ // قبعة شرطة بحافة
  rrect(c,-2.8,-16.2,6.6,2.6,0.8,dk(col,0.35));
  rrect(c,-2.9,-14,7.6,1.2,0.3,dk(col,0.55));
  rrect(c,-1,-15.9,2.2,1.4,0.3,'#e8d47a');}
U.police_common={sx:1.05,sy:1,spd:1,neutral:1,draw(c,r,col){stick(c,r,col,{lw:2.2,headR:3,
  chest(cc,rr,cl){limb(cc,-3.6,-6.4,4,-5.8,1.2,dk(cl,0.3));},
  head:(cc,rr,cl)=>cap(cc,cl),
  arm(cc,rr,cl,W){
    cc.save();cc.translate(-5.2,-6.4+(rr.st==='walk'?Math.sin(rr.p)*0.5:0));
    rrect(cc,-2,-5.2,4.4,10.4,1.2,lt(cl,0.3));rrect(cc,-1.1,-4,2.4,8,0.8,dk(cl,0.1));cc.restore();
    const h=hand(-0.5,1.6,rr,5.2,1.2);
    trail(cc,rr,s=>{const A=-0.5+s*1.6,x=0.8+Math.sin(A+1.2)*5.2,y=-8.2+Math.cos(A+1.2)*4.5;
      limb(cc,x,y,x+Math.sin(A+1.75)*4,y+Math.cos(A+1.75)*3.6,1.5,'#dcd7cd');});
    armTo(cc,rr,cl,h.x,h.y,W);
    const tx=h.x+Math.sin(h.A+1.75)*4,ty=h.y+Math.cos(h.A+1.75)*3.6;
    limb(cc,h.x,h.y,tx,ty,1.7,'#2b2825');
    if(rr.fx)spark(cc,tx,ty,rr);}});}};
U.police_captain={sx:1.14,sy:1.04,spd:0.92,neutral:1,draw(c,r,col){
  c.beginPath();c.ellipse(0,0.5,8.6,3.4,0,0,TAU);
  c.strokeStyle='rgba(120,170,230,0.75)';c.lineWidth=0.9;c.setLineDash([3,2.4]);c.stroke();c.setLineDash([]);
  stick(c,r,col,{lw:2.6,headR:3.1,
  chest(cc,rr,cl){rrect(cc,-3.6,-8.2,7.4,5.4,1,dk(cl,0.25));
    limb(cc,-3.8,-9.2,4.2,-9.2,2.4,dk(cl,0.15));
    rrect(cc,2,-8.6,1.6,1.6,0.3,'#e8d47a');},
  head(cc,rr,cl){cap(cc,cl);rrect(cc,-2.9,-19,6.8,1,0.3,'#e8d47a');},
  arm(cc,rr,cl,W){
    cc.save();cc.translate(-5.6,-6.6+(rr.st==='walk'?Math.sin(rr.p)*0.5:0));
    rrect(cc,-2.2,-6,4.8,12,1.4,lt(cl,0.3));rrect(cc,-1.2,-4.6,2.6,9.2,0.8,dk(cl,0.1));
    ell(cc,0.2,0,1.3,1.3,'#e8d47a');cc.restore();
    const h=hand(-0.55,1.65,rr,5.6,1.2);
    trail(cc,rr,s=>{const A=-0.55+s*1.65,x=0.8+Math.sin(A+1.2)*5.6,y=-8.2+Math.cos(A+1.2)*4.8;
      limb(cc,x,y,x+Math.sin(A+1.78)*4.4,y+Math.cos(A+1.78)*4,1.6,'#dcd7cd');});
    armTo(cc,rr,cl,h.x,h.y,W);
    const tx=h.x+Math.sin(h.A+1.78)*4.4,ty=h.y+Math.cos(h.A+1.78)*4;
    limb(cc,h.x,h.y,tx,ty,1.8,'#2b2825');
    limb(cc,tx-(tx-h.x)*0.2,ty-(ty-h.y)*0.2,tx,ty,2,'#9aa0a8');
    if(rr.fx)spark(cc,tx,ty,rr);}});}};
U.police_common.ult=function(c,r,col){body(c,r,()=>{
  if(r.a>=0.44){const g=(r.a-0.44)/0.4;c.globalAlpha=Math.max(0,1-g)*0.8;
    c.beginPath();c.arc(6,-8.6,3+g*5,-0.9,0.9);c.strokeStyle='#bfe2ff';c.lineWidth=1.4;c.stroke();c.globalAlpha=1;}});};
U.police_captain.ult=function(c,r,col){auraBurst(c,r,12,'#7fb0e6');
  body(c,r,()=>{if(r.a>=0.4){const g=(r.a-0.4)/0.6;c.globalAlpha=(1-g)*0.6;
    ell(c,0.5,-12.6,4.4,4.6,'#7fb0e6');c.globalAlpha=1;}});};

/* ====== الضربة المميزة (ult) ====== */
function ultGlow(c,r){ // وهج ذهبي يكبر أثناء الاستعداد ثم ينفجر
  const a=r.a||0,g=a<0.44?a/0.44:Math.max(0,1-(a-0.44)/0.3);
  c.globalAlpha=0.35*g;
  ell(c,0,-11,9+g*4,13+g*5,'rgba(255,214,110,0.55)');
  c.globalAlpha=0.8*g;
  c.beginPath();c.ellipse(0,0.6,7+g*4,2.8+g*1.6,0,0,TAU);
  c.strokeStyle='rgba(255,214,110,0.95)';c.lineWidth=1.1;c.stroke();
  c.globalAlpha=1;}
function shockRing(c,r,x,y,R,col){ // موجة أرضية عند الارتطام
  if(!(r.a>=0.44))return;const g=Math.min(1,(r.a-0.44)/0.34);
  c.globalAlpha=(1-g)*0.9;
  c.beginPath();c.ellipse(x,y,R*g,R*g*0.42,0,0,TAU);
  c.strokeStyle=col||'#ffd66e';c.lineWidth=2.2-g;c.stroke();
  c.beginPath();c.ellipse(x,y,R*g*0.6,R*g*0.26,0,0,TAU);c.lineWidth=1.2;c.stroke();
  c.globalAlpha=1;}
function barrier(c,col){ // درع تصلّب حول الجسم
  c.globalAlpha=0.28;ell(c,0,-11,8.5,12.5,'#bfe2ff');c.globalAlpha=0.9;
  c.beginPath();c.ellipse(0,-11,8.5,12.5,0,0,TAU);
  c.strokeStyle='#8fd0ff';c.lineWidth=1;c.stroke();c.globalAlpha=1;}
function auraBurst(c,r,R,col){ // هالة تتمدد (توحش أو علاج)
  if(!(r.a>=0.4))return;const g=Math.min(1,(r.a-0.4)/0.4);
  c.globalAlpha=(1-g)*0.85;
  c.beginPath();c.ellipse(0,0.5,R*g,R*g*0.4,0,0,TAU);
  c.strokeStyle=col;c.lineWidth=1.8;c.stroke();c.globalAlpha=1;}
function readyMark(c){ // نجمة تدل أن الشحنة جاهزة (تُرسم خارج القتال)
  tri(c,[-1.6,-21],[0.6,-24.4],[2.8,-21],'#ffd66e');}

/* ====== تفاصيل الضربة المميزة لكل وحدة ====== */
U.hammer_breaker.ult=function(c,r,col){shockRing(c,r,7,0.4,15,'#ffd66e');
  if(r.a>=0.44&&r.a<0.6){c.globalAlpha=0.5;
    [[5,1],[9,-0.4],[12,1.4]].forEach(p=>limb(c,p[0],p[1],p[0]+2.4,p[1]-1.6,0.9,'#7a6a52'));c.globalAlpha=1;}};
U.hammer_shield.ult=function(c,r,col){body(c,r,()=>barrier(c,col));};
U.viper_sniper.ult=function(c,r,col){body(c,r,()=>{
  if(r.a>=0.47){const g=(r.a-0.47)/0.53;c.globalAlpha=Math.max(0,1-g*1.1);
    limb(c,9.8+g*46,-8.2,20+g*46,-8.2,1.6,'#ffd66e');
    limb(c,9.8+g*46,-8.2,26+g*46,-8.2,0.7,'#fff3c9');c.globalAlpha=1;}});};
U.viper_firebomber.ult=function(c,r,col){body(c,r,()=>{
  if(r.a>=0.44){const g=(r.a-0.44)/0.56,x=6+4+g*24,y=-12.4-Math.sin(g*3.14)*7;
    c.globalAlpha=0.85;ell(c,x,y,2.6+g*2,2.6+g*2,'#e8893a');
    ell(c,x,y,1.4+g*1.2,1.4+g*1.2,'#f7d354');c.globalAlpha=1;}});
  if(r.a>=0.62){const g=(r.a-0.62)/0.38;c.globalAlpha=(1-g)*0.8;
    ell(c,26,0.6,6+g*10,2.4+g*4,'rgba(232,137,58,0.65)');
    for(let i=0;i<5;i++){const o=(i/5+g)%1;
      tri(c,[20+i*3,0.4-o*7],[22+i*3,-3-o*7],[18+i*3,-3-o*7],'#f7d354');}c.globalAlpha=1;}};
U.scorp_boss.ult=function(c,r,col){auraBurst(c,r,13,'#e0553f');
  body(c,r,()=>{if(r.a>=0.4){const g=(r.a-0.4)/0.6;c.globalAlpha=(1-g)*0.6;
    ell(c,0.5,-12.6,4.4,4.6,'#e0553f');c.globalAlpha=1;}});};
U.scorp_medic.ult=function(c,r,col){auraBurst(c,r,11,'#7fd48a');
  if(r.a>=0.4){const g=(r.a-0.4)/0.6;c.globalAlpha=(1-g)*0.9;
    for(let i=0;i<5;i++){const a=i*1.256+0.3,d=3+g*9;
      const x=Math.cos(a)*d,y=-6+Math.sin(a)*d*0.5-g*5;
      rrect(c,x-1.4,y-0.5,2.8,1,0,'#7fd48a');rrect(c,x-0.5,y-1.4,1,2.8,0,'#7fd48a');}
    c.globalAlpha=1;}};
U.crow_spear.ult=function(c,r,col){body(c,r,()=>{
  if(r.a>=0.4&&r.a<0.62){const g=(r.a-0.4)/0.22;c.globalAlpha=(1-g)*0.85;
    limb(c,8,-9.6,20+g*6,-9.6,2.4,'#ffd66e');
    tri(c,[20+g*6,-7.4],[26+g*6,-9.6],[20+g*6,-11.8],'#fff3c9');c.globalAlpha=1;}});};
U.crow_dual.ult=function(c,r,col){body(c,r,()=>{
  if(r.a>=0.38&&r.a<0.68){const g=(r.a-0.38)/0.3;c.globalAlpha=(1-g)*0.75;
    [-2.4,-0.6,1.2,3].forEach((o,i)=>{const d=6+i*1.4+g*4;
      limb(c,3,-9+o,3+d,-9+o-1.6,1.5,i%2?'#ffd66e':'#fff3c9');});c.globalAlpha=1;}});};
U.crow_hero.ult=function(c,r,col){body(c,r,()=>{
  if(r.a>=0.38&&r.a<0.72){const g=(r.a-0.38)/0.34;c.globalAlpha=(1-g)*0.8;
    for(let i=0;i<4;i++){const a=-1.1+i*0.55;
      const x1=2+Math.sin(a)*5,y1=-9+Math.cos(a)*5,x2=2+Math.sin(a)*(13+g*4),y2=-9+Math.cos(a)*(13+g*4);
      limb(c,x1,y1,x2,y2,1.7,i%2?'#ffd66e':'#fff3c9');}c.globalAlpha=1;}});
  shockRing(c,r,8,0.4,12,'rgba(255,214,110,0.8)');};
U.hammer_hero.ult=function(c,r,col){body(c,r,()=>barrier(c,col));
  shockRing(c,r,7,0.4,19,'#ffd66e');
  if(r.a>=0.44&&r.a<0.62){c.globalAlpha=0.55;
    [[5,1],[10,-0.6],[14,1.6],[17,-0.2]].forEach(p=>limb(c,p[0],p[1],p[0]+3,p[1]-2,1,'#7a6a52'));c.globalAlpha=1;}};
U.viper_hero.ult=function(c,r,col){body(c,r,()=>{
  if(r.a>=0.47){const g=(r.a-0.47)/0.53;c.globalAlpha=Math.max(0,1-g*1.1);
    [-3.6,0,3.6].forEach(o=>{const y=-8.4+o*(0.5+g*1.4);
      limb(c,9.8+g*40,y,20+g*40,y,1.5,'#e8893a');
      limb(c,9.8+g*40,y,24+g*40,y,0.7,'#f7d354');
      ell(c,20+g*40,y,1.8,1.6,'rgba(247,211,84,0.8)');});c.globalAlpha=1;}});};
U.scorp_hero.ult=function(c,r,col){auraBurst(c,r,14,'#e0553f');
  if(r.a>=0.45){const g=Math.min(1,(r.a-0.45)/0.4);c.globalAlpha=(1-g)*0.85;
    c.beginPath();c.ellipse(0,0.5,11*g,11*g*0.4,0,0,TAU);
    c.strokeStyle='#7fd48a';c.lineWidth=1.8;c.stroke();
    for(let i=0;i<4;i++){const a=i*1.57+0.4,d=3+g*8;
      const x=Math.cos(a)*d,y=-6+Math.sin(a)*d*0.5-g*5;
      rrect(c,x-1.3,y-0.45,2.6,0.9,0,'#7fd48a');rrect(c,x-0.45,y-1.3,0.9,2.6,0,'#7fd48a');}
    c.globalAlpha=1;}};

function drawUnit(c,key,o){
  const u=U[key];if(!u)return;
  const sc=o.scale||1,dir=o.dir||1,state=o.state||'idle',color=o.color||'#8a5cc7';
  const r=rig({t:o.t||0,state,spd:u.spd||1,rate:o.rate||1,hurtDur:o.hurtDur,deathDur:o.deathDur});
  c.save();c.translate(o.x||0,o.y||0);c.scale(sc*dir*(u.sx||1),sc*(u.sy||1));
  if(r.ult)ultGlow(c,r);
  if(r.death!==undefined){const k=ease(Math.min(1,r.death*1.25));
    c.globalAlpha=r.death>0.72?Math.max(0,1-(r.death-0.72)/0.28):1;
    shadow(c,r,(u.shadowW||3.8)*(1+k*0.5));c.translate(-k*3.4,0);c.rotate(-k*1.5708);}
  else shadow(c,r,u.shadowW);
  u.draw(c,r,color);
  if(r.ult&&u.ult)u.ult(c,r,color);
  if(r.flinch){c.globalAlpha=r.flinch*0.6;
    for(let i=0;i<4;i++){const a=i*1.57+0.6;limb(c,2,-12,2+Math.cos(a)*(3+r.flinch*4),-12+Math.sin(a)*(3+r.flinch*4),1,'#e05a4a');}}
  c.globalAlpha=1;c.restore();}
if(typeof module!=='undefined')module.exports={drawUnit,U};
