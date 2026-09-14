/* ====== رسم الوحدات + أنميشن (نسخة 2: جري حقيقي وقتال بوزن وارتطام) ======
   drawUnit(ctx, key, {x,y,t,state,color,dir,scale,rate})
   state: 'idle' | 'walk' (جري) | 'attack'
   كل شيء بالكود. نظام محلي: القدمان عند (0,0)، الطول ~26.
   مبادئ الأنميشن: استعداد (anticipation) ثم ضربة سريعة ثم تجمّد لحظي عند الارتطام
   (hit-stop) ثم ارتداد ورجوع، مع اندفاع الجسم للأمام وأثر للسلاح وغبار عند القدمين. */
const SKIN='#d9a77a',DARK='#2f2b27',STEEL='#8f949c',WOOD='#7a5a38',TAU=6.2831853;
const P=(c,f)=>{c.fillStyle=f;c.fill();};
const ease=(x)=>x<0?0:x>1?1:x*x*(3-2*x);
const easeOut=(x)=>1-(1-Math.min(1,Math.max(0,x)))**3;
function limb(c,x1,y1,x2,y2,w,col){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=col;c.lineWidth=w;c.lineCap='round';c.stroke();}
function bone(c,x1,y1,x2,y2,x3,y3,w,col){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.lineTo(x3,y3);c.strokeStyle=col;c.lineWidth=w;c.lineCap='round';c.lineJoin='round';c.stroke();}
function ell(c,x,y,rx,ry,f){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);P(c,f);}
function rrect(c,x,y,w,h,r,f){c.beginPath();c.roundRect?c.roundRect(x,y,w,h,r):c.rect(x,y,w,h);P(c,f);}
function tri(c,a,b,d,f){c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.lineTo(d[0],d[1]);c.closePath();P(c,f);}
/* طرف من قطعتين: الزوايا من العمودي لأسفل، الموجب للأمام */
function seg(c,x,y,a1,L1,a2,L2,w,col){
  const x1=x+Math.sin(a1)*L1,y1=y+Math.cos(a1)*L1,x2=x1+Math.sin(a2)*L2,y2=y1+Math.cos(a2)*L2;
  bone(c,x,y,x1,y1,x2,y2,w,col);return {x:x2,y:y2,kx:x1,ky:y1};
}
/* ====== الهيكل الحركي ====== */
function rig(o){
  const t=o.t||0,st=o.state||'idle',S=o.spd||1,rate=o.rate||1;
  const R={st,t,S};
  if(st==='walk'){
    const f=2.55*S,p=t*f*TAU;R.p=p;
    R.bounce=-Math.cos(p*2)*1.5-0.6;          // ارتفاع الجسم: أعلى في منتصف الخطوة
    R.lean=0.30;                               // ميلان للأمام
    R.air=Math.max(0,Math.sin(p*2))*0.55;      // لحظة الطيران
    R.thigh=q=>0.95*Math.sin(p+q);
    R.flex=q=>1.55*Math.pow(0.5+0.5*Math.cos(p+q-4.12),2.2)+0.18;
    R.arm=0.95;R.armPh=p;
  }else if(st==='attack'){
    const a=(t/rate)%1;R.a=a;R.p=t*1.1*TAU;
    let s,lunge;
    if(a<0.34){const k=easeOut(a/0.34);s=-k;lunge=-1.1*k;}
    else if(a<0.44){const k=ease((a-0.34)/0.10);s=-1+2*k;lunge=-1.1+4.4*k;}
    else if(a<0.53){s=1;lunge=3.3;}                       // تجمّد الارتطام
    else{const k=ease((a-0.53)/0.47);s=1-1.28*k;lunge=3.3-3.3*k;}
    R.s=s;R.lunge=lunge;
    R.hit=a>=0.44&&a<0.53;R.fx=a>=0.42&&a<0.60?1-(a-0.42)/0.18:0;
    R.bounce=-Math.abs(s)*0.5+(R.hit?0.7:0);
    R.lean=0.14+s*0.30;
    R.thigh=q=>(q<1?0.62:-0.70)+s*(q<1?0.42:-0.30);
    R.flex=q=>(q<1?0.42:0.78)-s*0.12;
    R.air=0;R.arm=0;R.armPh=0;
  }else{
    const p=t*1.25*S;R.p=p;R.bounce=Math.sin(p*TAU/2)*0.32;R.lean=0.05;R.air=0;
    R.thigh=q=>(q<1?0.13:-0.13);R.flex=()=>0.16;R.arm=0.1;R.armPh=p*2.2;R.s=0;R.lunge=0;R.hit=false;R.fx=0;
  }
  R.hipY=-11+R.bounce;R.hipX=(R.lunge||0)*0.55;
  return R;
}
function drawLegs(c,r,col,w){
  const W=w||2.7;
  for(const q of [Math.PI,0]){                  // الخلفية أولاً
    const th=r.thigh(q),fl=r.flex(q);
    const e=seg(c,r.hipX+(q?-1.5:1.5),r.hipY,th,5.6,th-fl,5.9,W,q?shade(col):col);
    limb(c,e.x,e.y,e.x+Math.sin(th-fl+0.9)*2.1,e.y+Math.cos(th-fl+0.9)*1.1,W*0.8,q?shade(col):col);
  }
}
function shade(c){return c==='#2f2b27'?'#242120':c;}
/* الجسم في فضاء الورك: (0,0)=الورك، الكتف y=-8.2، الرأس y=-12.6 */
function body(c,r,fn){c.save();c.translate(r.hipX,r.hipY);c.rotate(-r.lean);fn();c.restore();}
function torso(c,col,w,h){rrect(c,-(w||3.9),-(h||9.4),(w||3.9)*2,(h||9.4)+1.4,2,col);}
function head(c,col){ell(c,0.5,-12.6,3.1,3.4,col||SKIN);}
function armSwing(c,r,col,reach){
  const k=r.st==='walk'?Math.sin(r.armPh+Math.PI):(r.st==='idle'?Math.sin(r.armPh)*0.25:0);
  const a1=-k*0.95,a2=a1-(r.st==='walk'?1.45:0.35);
  return seg(c,-1.2,-8.2,a1,3.6,a2,3.4,2.2,col||SKIN);
}
function shadow(c,r,wide){const s=1-(r.air||0)*0.35;ell(c,0,0.6,(wide||4.7)*s,1.9*s,'rgba(0,0,0,'+(0.3*s)+')');}
function dust(c,r){ // غبار عند الاندفاع أو الجري
  if(r.st==='attack'&&r.a>0.34&&r.a<0.62){const g=(r.a-0.34)/0.28;c.globalAlpha=(1-g)*0.5;
    ell(c,-4-g*5,0.2,2.4+g*3,1.1+g*0.7,'#b9b0a2');c.globalAlpha=1;}
  if(r.st==='walk'&&Math.sin(r.p*2)<-0.85){c.globalAlpha=0.35;ell(c,-5,0.4,2.6,1,'#b9b0a2');c.globalAlpha=1;}
}
function trail(c,r,cb){ // أثر السلاح أثناء الضربة
  if(!(r.st==='attack'&&r.a>=0.34&&r.a<0.53))return;
  for(let i=1;i<=3;i++){const back=r.s-i*0.34;if(back<-1.05)continue;
    c.globalAlpha=0.17*(4-i)/3;cb(back);c.globalAlpha=1;}
}
function spark(c,x,y,r){ if(!r.fx)return;const g=r.fx;
  c.globalAlpha=g*0.9;
  for(let i=0;i<5;i++){const a=i*1.256+0.4;limb(c,x,y,x+Math.cos(a)*(2.5+g*4),y+Math.sin(a)*(2.5+g*4),1,'#ffe9a8');}
  ell(c,x,y,1.6+g*2.4,1.6+g*2.4,'rgba(255,241,200,'+(g*0.75)+')');c.globalAlpha=1;}
function speedLines(c,r){ if(r.st!=='walk')return;c.globalAlpha=0.3;
  for(let i=0;i<3;i++){const y=-6-i*4.5,l=4+((r.p*4+i)%3)*2.4;limb(c,-7-l,y,-7,y,0.9,'#cfc9bd');}c.globalAlpha=1;}

const U={};
/* ================= الغربان ================= */
U.crow_common={draw(c,r,col){
  drawLegs(c,r,DARK);
  body(c,r,()=>{
    tri(c,[-3.2,-8.6],[-8.6-(r.st==='walk'?Math.sin(r.p)*2.5:0),-2.6-(r.air||0)*3],[-3.2,-1.6],shade2(col));
    armSwing(c,r,SKIN,0);torso(c,col,3.6,9.2);head(c);
    c.beginPath();c.moveTo(-3.1,-12.2);c.quadraticCurveTo(0.5,-17.6,4.1,-12.2);c.lineTo(2.6,-11.8);c.quadraticCurveTo(0.5,-15,-1.6,-11.8);c.closePath();P(c,col);
    const ang=-0.35+(r.s||0)*1.5;
    trail(c,r,s=>knife(c,-0.35+s*1.5,'rgba(230,226,214,1)'));
    knife(c,ang,'#cfc9bd');
    function knife(cc,A,kc){const sx=1.2,sy=-8.4,ex=sx+Math.sin(A+1.2)*6.4,ey=sy+Math.cos(A+1.2)*5.4;
      limb(cc,sx,sy,ex,ey,2.2,SKIN);limb(cc,ex,ey,ex+Math.sin(A+1.9)*3.4,ey+Math.cos(A+1.9)*3,1.5,kc);}
    if(r.fx){const A=-0.35+1.5;spark(c,1.2+Math.sin(A+1.2)*6.4+Math.sin(A+1.9)*3.4,-8.4+Math.cos(A+1.2)*5.4+Math.cos(A+1.9)*3,r);}
  });
  dust(c,r);
}};
function shade2(h){return h;}
U.crow_sprinter={spd:1.45,draw(c,r,col){
  speedLines(c,r);drawLegs(c,r,DARK,2.5);
  body(c,r,()=>{
    limb(c,1.4,-2,2.6,-13.6,1.1,WOOD);
    tri(c,[2.6,-13.6],[8.4-(r.st==='walk'?Math.sin(r.p)*1.6:0),-11.6],[2.6,-10],col);
    armSwing(c,r,SKIN);torso(c,col,3.3,8.8);head(c);
    c.beginPath();c.moveTo(-3.1,-12.4);c.quadraticCurveTo(0.5,-17.8,4.1,-12.4);c.closePath();P(c,col);
    const ang=-0.3+(r.s||0)*1.45;
    const sx=1.2,sy=-8.2,ex=sx+Math.sin(ang+1.2)*6,ey=sy+Math.cos(ang+1.2)*5;
    limb(c,sx,sy,ex,ey,2,SKIN);
    trail(c,r,s=>{const A=-0.3+s*1.45;limb(c,1.2+Math.sin(A+1.2)*6,-8.2+Math.cos(A+1.2)*5,1.2+Math.sin(A+1.2)*6+Math.sin(A+2)*2.6,-8.2+Math.cos(A+1.2)*5+Math.cos(A+2)*2.4,1.4,'#e6e2d6');});
    limb(c,ex,ey,ex+Math.sin(ang+2)*2.6,ey+Math.cos(ang+2)*2.4,1.4,'#8e8880');
    if(r.fx)spark(c,ex+Math.sin(ang+2)*2.6,ey+Math.cos(ang+2)*2.4,r);
  });
  dust(c,r);
}};
function ik2(ox,oy,tx,ty,L1,L2,flip){
  let dx=tx-ox,dy=ty-oy,d=Math.hypot(dx,dy)||0.001;
  const cl=Math.max(Math.abs(L1-L2)+0.01,Math.min(d,L1+L2-0.01));
  const ex=ox+dx/d*cl,ey=oy+dy/d*cl;
  const a=Math.atan2(ey-oy,ex-ox);
  const A=Math.acos(Math.max(-1,Math.min(1,(L1*L1+cl*cl-L2*L2)/(2*L1*cl))));
  const ang=a+(flip?A:-A);
  return {jx:ox+Math.cos(ang)*L1,jy:oy+Math.sin(ang)*L1,ex,ey};
}
U.crow_biker={shadowW:9.5,draw(c,r,col){
  const run=r.st==='walk',atk=r.st==='attack';
  const speed=run?1:(atk?0.45:0);
  const wh=r.t*11*speed;                       // دوران العجلات
  const crank=r.t*9*speed+0.6;                 // دوران الدواسات
  const bob=run?Math.sin(r.t*18)*0.45:(atk?-Math.abs(r.s||0)*0.4:Math.sin(r.t*2)*0.2);
  if(run)speedLines(c,r);
  c.save();c.translate((r.lunge||0)*0.8,bob);
  const WR=4.2,WX=7,WY=-WR;
  // إطار الدراجة
  const crk=[0,-5.2],seat=[-3,-11.2],bar=[6.2,-13.2];
  c.lineCap='round';c.lineJoin='round';
  [[-WX,WY],[WX,WY]].forEach(([x,y])=>{
    c.beginPath();c.arc(x,y,WR,0,TAU);c.strokeStyle='#2f2b27';c.lineWidth=1.5;c.stroke();
    for(let k=0;k<5;k++){const a=wh+k*1.2566;limb(c,x,y,x+Math.cos(a)*(WR-0.5),y+Math.sin(a)*(WR-0.5),0.5,'#6b665e');}
    ell(c,x,y,1,1,'#57524b');});
  const FR='#7d766c';
  bone(c,-WX,WY,crk[0],crk[1],WX,WY,1.4,FR);      // المثلث السفلي
  limb(c,crk[0],crk[1],seat[0],seat[1],1.4,FR);
  limb(c,seat[0],seat[1],bar[0],bar[1],1.4,FR);
  limb(c,-WX,WY,seat[0],seat[1],1.4,FR);
  limb(c,WX,WY,bar[0],bar[1]+0.6,1.4,FR);
  rrect(c,seat[0]-2.6,seat[1]-1.4,5.4,1.9,0.8,'#3c3a38');   // المقعد
  limb(c,bar[0]-1.6,bar[1],bar[0]+2.2,bar[1]-0.6,1.6,'#3c3a38'); // المقود
  // الدواسات
  const pR=2.2;
  const pA=[crank,crank+Math.PI].map(a=>[crk[0]+Math.cos(a)*pR,crk[1]+Math.sin(a)*pR]);
  limb(c,crk[0],crk[1],pA[1][0],pA[1][1],1,'#57524b');
  // الراكب: الورك على المقعد
  const hip=[seat[0]+0.8,seat[1]-1.6],sh=[2.2,-17.4],hd=[3.4,-20.6];
  // الرجل البعيدة
  let k=ik2(hip[0],hip[1],pA[1][0],pA[1][1],4.6,5,false);
  bone(c,hip[0],hip[1],k.jx,k.jy,k.ex,k.ey,2.4,'#242120');
  // الجذع مائل للأمام
  const tAng=Math.atan2(sh[1]-hip[1],sh[0]-hip[0]);
  c.save();c.translate(hip[0],hip[1]);c.rotate(tAng+Math.PI/2);
  rrect(c,-3.4,-1.2,6.8,7.6,2.4,col);c.restore();
  // الرجل القريبة
  k=ik2(hip[0]+0.8,hip[1],pA[0][0],pA[0][1],4.6,5,false);
  bone(c,hip[0]+0.8,hip[1],k.jx,k.jy,k.ex,k.ey,2.6,'#2f2b27');
  limb(c,k.ex,k.ey,k.ex+1.8,k.ey+0.2,2,'#2f2b27');
  // الرأس والخوذة
  ell(c,hd[0],hd[1],3.1,3.3,SKIN);
  c.beginPath();c.moveTo(hd[0]-3.2,hd[1]-0.2);c.quadraticCurveTo(hd[0],hd[1]-5.6,hd[0]+3.2,hd[1]-0.2);c.closePath();P(c,col);
  rrect(c,hd[0]-0.4,hd[1]-1.2,4,1.5,0.5,'#3c3a38');
  // ذراع المقود
  k=ik2(sh[0],sh[1],bar[0]+0.4,bar[1]-0.4,3.4,3.4,true);
  bone(c,sh[0],sh[1],k.jx,k.jy,k.ex,k.ey,2.1,SKIN);
  // ذراع السلاح (سلسلة حديد) — للخلف في الاستعداد ثم تنطلق للأمام
  const ang=-1.1+(r.s||0)*2.2;
  const chain=(A,alpha,col2)=>{
    const ex=sh[0]+Math.sin(A+1.25)*5.4,ey=sh[1]+Math.cos(A+1.25)*4.6;
    const tx=ex+Math.sin(A+1.75)*5.2,ty=ey+Math.cos(A+1.75)*4.6;
    if(alpha!==undefined)c.globalAlpha=alpha;
    limb(c,sh[0],sh[1],ex,ey,2.1,SKIN);
    for(let i=0;i<4;i++){const u=i/4,v=(i+1)/4;
      limb(c,ex+(tx-ex)*u,ey+(ty-ey)*u,ex+(tx-ex)*v,ey+(ty-ey)*v,i%2?1.5:1.1,col2||'#8f949c');}
    ell(c,tx,ty,1.5,1.5,col2||'#6f747c');
    if(alpha!==undefined)c.globalAlpha=1;
    return [tx,ty];};
  trail(c,r,s=>chain(-1.1+s*2.2,0.18,'#d8d2c4'));
  const tip=chain(ang);
  if(r.fx)spark(c,tip[0],tip[1],r);
  c.restore();
  if(atk&&r.a>0.34&&r.a<0.62){const g=(r.a-0.34)/0.28;c.globalAlpha=(1-g)*0.45;
    ell(c,-8-g*6,0.2,3+g*3.5,1.2+g*0.8,'#b9b0a2');c.globalAlpha=1;}
  if(run&&Math.sin(r.t*18)<-0.9){c.globalAlpha=0.28;ell(c,-9,0.4,3,1.1,'#b9b0a2');c.globalAlpha=1;}
}};
/* ================= المطارق ================= */
U.hammer_common={draw(c,r,col){
  drawLegs(c,r,DARK,3);
  body(c,r,()=>{
    armSwing(c,r,SKIN);torso(c,col,4.2,9.6);
    rrect(c,-4.8,-9.8,9.6,2.8,1,STEEL);
    head(c);rrect(c,-2.8,-15.4,6.6,2.8,1,STEEL);
    const ang=-0.55+(r.s||0)*1.6;
    trail(c,r,s=>club(c,-0.55+s*1.6,'rgba(190,150,110,1)','rgba(190,196,204,1)'));
    club(c,ang,WOOD,STEEL);
    function club(cc,A,wc,hc){const sx=1.2,sy=-8.4,mx=sx+Math.sin(A+1.15)*5.6,my=sy+Math.cos(A+1.15)*4.8;
      limb(cc,sx,sy,mx,my,2.5,SKIN);
      const ex=mx+Math.sin(A+1.7)*4.4,ey=my+Math.cos(A+1.7)*4;
      limb(cc,mx,my,ex,ey,1.7,wc);
      cc.save();cc.translate(ex,ey);cc.rotate(-(A+1.7));rrect(cc,-1.6,-2.2,3.2,4.4,0.8,hc);cc.restore();}
    if(r.fx){const A=-0.55+1.6,mx=1.2+Math.sin(A+1.15)*5.6,my=-8.4+Math.cos(A+1.15)*4.8;
      spark(c,mx+Math.sin(A+1.7)*4.4,my+Math.cos(A+1.7)*4,r);}
  });
  dust(c,r);
}};
U.hammer_shield={spd:0.72,draw(c,r,col){
  drawLegs(c,r,DARK,3.4);
  body(c,r,()=>{
    torso(c,col,4.9,10);rrect(c,-5.4,-10.4,10.8,3.2,1,STEEL);
    head(c);c.beginPath();c.arc(0.5,-13,3.5,Math.PI,0);P(c,STEEL);rrect(c,-3,-13.6,7,1.5,0.4,'#5d6169');
    limb(c,1.2,-8.4,5.2+(r.hit?1.4:0),-5.4,2.7,SKIN);
    const push=r.st==='attack'?(r.s||0)*3.4:0;
    c.save();c.translate(-6.2-Math.max(0,push)*0.9,-6.4+(r.st==='walk'?Math.sin(r.p)*0.6:0));c.rotate(-Math.max(0,push)*0.16);
    rrect(c,-2.8,-8,6,16,1.8,'#9aa0a8');rrect(c,-1.5,-6.5,3.4,13,1,'#7f858d');ell(c,0.4,0,1.6,1.6,'#b9bec5');
    rrect(c,-2.8,-8,6,1.6,0.6,'#b9bec5');c.restore();
    if(r.fx)spark(c,-9.5,-6.4,r);
  });
  dust(c,r);
}};
U.hammer_breaker={spd:0.62,draw(c,r,col){
  drawLegs(c,r,DARK,3.4);
  body(c,r,()=>{
    torso(c,col,4.9,10);rrect(c,-5.4,-10.4,10.8,3,1,STEEL);
    head(c);rrect(c,-3,-14.6,7,2.2,0.5,DARK);
    const base=-2.5,ang=base+(r.s||0)*2.9;
    trail(c,r,s=>sledge(c,base+s*2.9,'rgba(150,120,86,1)','rgba(150,156,164,1)'));
    sledge(c,ang,WOOD,'#6f747c');
    function sledge(cc,A,wc,hc){const sx=0.8,sy=-8.6,L=13.5;
      const ex=sx+Math.sin(A+1.5)*L,ey=sy+Math.cos(A+1.5)*L;
      limb(cc,sx,sy,ex,ey,2,wc);
      cc.save();cc.translate(ex,ey);cc.rotate(-(A+1.5));
      rrect(cc,-3,-3.8,6.2,7.6,1.2,hc);rrect(cc,-3,-3.8,2.4,7.6,1,'#9aa0a8');cc.restore();
      limb(cc,-1.2,-8.2,sx*0.35+ex*0.3,sy*0.35+ey*0.3,2.7,SKIN);
      limb(cc,1.2,-8.4,sx*0.6+ex*0.18,sy*0.6+ey*0.18,2.7,SKIN);}
    if(r.fx){const A=base+2.9,ex=0.8+Math.sin(A+1.5)*13.5,ey=-8.6+Math.cos(A+1.5)*13.5;
      spark(c,ex,ey,r);
      c.globalAlpha=r.fx*0.55;c.beginPath();c.ellipse(ex,ey+1,7+(1-r.fx)*7,3+(1-r.fx)*3,0,0,TAU);c.strokeStyle='#ffe9a8';c.lineWidth=1.5;c.stroke();c.globalAlpha=1;}
  });
  dust(c,r);
}};
/* ================= الأفاعي ================= */
U.viper_common={draw(c,r,col){
  drawLegs(c,r,DARK,2.6);
  body(c,r,()=>{
    armSwing(c,r,SKIN);torso(c,col,3.8,9.2);head(c);
    c.beginPath();c.arc(0.5,-13,3.3,Math.PI,0);P(c,'#2f4424');rrect(c,-2.8,-13.2,6.6,1.7,0.4,'#2f4424');
    const ang=-0.15+(r.s||0)*1.7;
    const sx=1.2,sy=-8.4,ex=sx+Math.sin(ang+1.25)*6,ey=sy+Math.cos(ang+1.25)*5.2;
    trail(c,r,s=>{const A=-0.15+s*1.7;limb(c,1.2,-8.4,1.2+Math.sin(A+1.25)*6,-8.4+Math.cos(A+1.25)*5.2,2,'rgba(217,167,122,1)');});
    limb(c,sx,sy,ex,ey,2.2,SKIN);
    const thrown=r.st==='attack'&&r.a>=0.44;
    if(!thrown)ell(c,ex+0.8,ey-0.4,1.7,1.5,'#8e8880');
    else{const g=(r.a-0.44)/0.56;ell(c,ex+3+g*22,ey-3-Math.sin(g*3.14)*6,1.7,1.5,'#8e8880');}
  });
  dust(c,r);
}};
U.viper_sniper={spd:0.8,draw(c,r,col){
  drawLegs(c,r,DARK,2.5);
  body(c,r,()=>{
    limb(c,-3.4,-9.4,-5.2,-2.6,2.6,'#5d4a35');
    [0,1.3,2.6].forEach(d=>limb(c,-3.7-d*0.2,-9.8-d,-4.4-d*0.2,-12.6-d,0.7,'#cfc9bd'));
    torso(c,col,3.7,9.4);head(c);
    c.beginPath();c.arc(0.5,-13,3.4,Math.PI,0);P(c,col);rrect(c,-2.9,-13.8,6.8,1.9,0.4,'#24331b');
    const a=r.st==='attack'?r.a:0;
    const pull=r.st!=='attack'?0:(a<0.4?4*easeOut(a/0.4):(a<0.47?4:(a<0.53?0:0)));
    const bx=5.8,by=-8.2,fired=r.st==='attack'&&a>=0.47;
    const bend=1+(pull/4)*0.55;
    c.beginPath();c.moveTo(bx,by-8);c.quadraticCurveTo(bx+4.8*bend,by,bx,by+8);c.strokeStyle=WOOD;c.lineWidth=1.6;c.stroke();
    c.beginPath();c.moveTo(bx,by-8);c.lineTo(bx-pull,by);c.lineTo(bx,by+8);c.strokeStyle='#cfc9bd';c.lineWidth=0.7;c.stroke();
    if(!fired&&pull>0.5)limb(c,bx-pull,by,bx+4,by,1,'#d9d3c6');
    limb(c,1.2,-8.4,bx-0.8,by,2.1,SKIN);limb(c,-1.2,-8.2,bx-pull-1.2,by+0.4,2.1,SKIN);
    if(fired){const g=(a-0.47)/0.53;c.globalAlpha=Math.max(0,1-g*1.4);
      limb(c,bx+4+g*30,by,bx+10+g*30,by,1,'#d9d3c6');c.globalAlpha=1;}
  });
  dust(c,r);
}};
U.viper_firebomber={draw(c,r,col){
  drawLegs(c,r,DARK,2.6);
  body(c,r,()=>{
    armSwing(c,r,SKIN);torso(c,col,3.8,9.2);
    rrect(c,-3.2,-5,2.5,3.8,0.7,'#5a8a6a');rrect(c,-0.2,-5,2.5,3.8,0.7,'#5a8a6a');
    head(c);c.beginPath();c.arc(0.5,-13,3.3,Math.PI,0);P(c,col);rrect(c,-2.8,-13.2,6.6,1.7,0.4,'#2f4424');
    const ang=-1.35+(r.s||0)*2.3;
    const sx=1.2,sy=-8.8,ex=sx+Math.sin(ang+1.2)*6.4,ey=sy+Math.cos(ang+1.2)*5.6;
    limb(c,sx,sy,ex,ey,2.1,SKIN);
    const thrown=r.st==='attack'&&r.a>=0.44;
    if(!thrown)bottle(c,ex,ey,0);
    else{const g=(r.a-0.44)/0.56;c.save();c.translate(ex+4+g*24,ey-4-Math.sin(g*3.14)*7);c.rotate(g*9);bottle(c,0,0,1);c.restore();}
    function bottle(cc,x,y,sp){rrect(cc,x-1.3,y-2.8,2.6,4.6,0.9,'#5a8a6a');
      tri(cc,[x-1.3,y-2.8],[x,y-6],[x+1.3,y-2.8],'#e8893a');tri(cc,[x-0.6,y-3],[x,y-4.6],[x+0.6,y-3],'#f2c14e');}
  });
  dust(c,r);
}};
/* ================= العقارب ================= */
U.scorp_common={draw(c,r,col){
  drawLegs(c,r,DARK,2.7);
  body(c,r,()=>{
    armSwing(c,r,SKIN);torso(c,col,3.9,9.2);head(c);
    rrect(c,-2.9,-14.6,6.8,2,0.5,col);limb(c,-2.6,-13.8,-5.2,-11.2,1,col);
    const ang=-0.45+(r.s||0)*1.65;
    trail(c,r,s=>pipe(c,-0.45+s*1.65,'rgba(150,145,138,1)'));
    pipe(c,ang,'#6b6259');
    function pipe(cc,A,pc){const sx=1.2,sy=-8.4,mx=sx+Math.sin(A+1.2)*5.8,my=sy+Math.cos(A+1.2)*5;
      limb(cc,sx,sy,mx,my,2.3,SKIN);limb(cc,mx,my,mx+Math.sin(A+1.75)*4.6,my+Math.cos(A+1.75)*4.2,1.6,pc);}
    if(r.fx){const A=-0.45+1.65,mx=1.2+Math.sin(A+1.2)*5.8,my=-8.4+Math.cos(A+1.2)*5;
      spark(c,mx+Math.sin(A+1.75)*4.6,my+Math.cos(A+1.75)*4.2,r);}
  });
  dust(c,r);
}};
U.scorp_boss={spd:0.85,draw(c,r,col){
  const pulse=1+Math.sin(r.t*2.4)*0.05;
  c.beginPath();c.ellipse(0,0.5,11*pulse,4.4*pulse,0,0,TAU);
  c.strokeStyle='rgba(240,182,74,0.85)';c.lineWidth=1;c.setLineDash([3,2.4]);c.stroke();c.setLineDash([]);
  drawLegs(c,r,DARK,2.8);
  body(c,r,()=>{
    const fl=(r.st==='walk'?Math.sin(r.p)*1.4:0)+(r.lunge||0)*0.4;
    c.beginPath();c.moveTo(-4.5,-10);c.lineTo(4.5,-10);c.lineTo(5.8-fl,2.6);c.lineTo(-5.8-fl,2.6);c.closePath();P(c,col);
    limb(c,0,-9.6,0,0.4,0.9,'#efe6d2');
    armSwing(c,r,SKIN);
    head(c);ell(c,0.5,-15.2,5.8,1.4,DARK);rrect(c,-2.6,-18.8,6.4,4,1.2,DARK);rrect(c,-2.6,-16.2,6.4,1.1,0.3,col);
    const ang=-0.4+(r.s||0)*1.6;
    trail(c,r,s=>{const A=-0.4+s*1.6;const mx=1.2+Math.sin(A+1.2)*5.8,my=-8.8+Math.cos(A+1.2)*5;
      limb(c,mx,my,mx+Math.sin(A+1.8)*3.6,my+Math.cos(A+1.8)*3.2,1.5,'rgba(220,215,205,1)');});
    const mx=1.2+Math.sin(ang+1.2)*5.8,my=-8.8+Math.cos(ang+1.2)*5;
    limb(c,1.2,-8.8,mx,my,2.4,SKIN);
    limb(c,mx,my,mx+Math.sin(ang+1.8)*3.6,my+Math.cos(ang+1.8)*3.2,1.5,'#cfc9bd');
    if(r.fx)spark(c,mx+Math.sin(ang+1.8)*3.6,my+Math.cos(ang+1.8)*3.2,r);
  });
  dust(c,r);
}};
U.scorp_medic={draw(c,r,col){
  drawLegs(c,r,DARK,2.6);
  body(c,r,()=>{
    armSwing(c,r,SKIN);torso(c,col,3.8,9.2);
    limb(c,-3.5,-9.4,3.5,-4,1,'#8a6a4a');
    rrect(c,-6.4,-4.6,3.6,3,0.6,'#efe6d2');rrect(c,-5,-4.4,0.9,2.6,0,'#c0392b');rrect(c,-6,-3.4,2.8,0.8,0,'#c0392b');
    head(c);rrect(c,-2.9,-15.2,6.8,1.9,0.4,'#efe6d2');rrect(c,-0.1,-15.2,1.2,1.9,0,'#c0392b');
    const a=r.st==='attack'?r.a:0;
    const lift=r.st==='attack'?(a<0.4?-4.4*easeOut(a/0.4):(a<0.6?-4.4:-4.4+4.4*ease((a-0.6)/0.4))):0;
    limb(c,1.2,-8.4,4.6,-6+lift,2.2,SKIN);
    rrect(c,3.4,-7.6+lift,3.2,2.4,0.5,'#efe6d2');rrect(c,4.5,-7.4+lift,1,2,0,'#c0392b');rrect(c,3.6,-6.7+lift,2.8,0.8,0,'#c0392b');
    if(r.st==='attack'&&a>0.35&&a<0.9){const g=(a-0.35)/0.55;c.globalAlpha=Math.sin(g*3.14)*0.95;
      for(let i=0;i<3;i++){const o=(g+i*0.33)%1;
        tri(c,[5+i*1.6-2,-9-o*11],[6.6+i*1.6-2,-11-o*11],[3.4+i*1.6-2,-11-o*11],'#7fd48a');}
      c.globalAlpha=1;}
  });
  dust(c,r);
}};
function drawUnit(c,key,o){
  const u=U[key];if(!u)return;
  const r=rig({t:o.t||0,state:o.state||'idle',spd:u.spd||1,rate:o.rate||1});
  const sc=o.scale||1,dir=o.dir||1;
  c.save();c.translate(o.x||0,o.y||0);c.scale(sc*dir,sc);
  shadow(c,r,u.shadowW);u.draw(c,r,o.color||'#8a5cc7');
  c.restore();
}
if(typeof module!=='undefined')module.exports={drawUnit,U};
