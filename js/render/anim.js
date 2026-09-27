/* منقول كما هو من docs/combat-reference.html (نظام الأنميشن v2: الوضعيات المفتاحية).
   لا تُعدَّل أرقام الوضعيات هنا؛ عدّل المرجع ثم أعد النسخ.
   الإضافات الوحيدة في آخر الملف: مفاتيح القوس (ATK.shoot) والرمي (ATK.throw) التي طلبها
   المستخدم للرماة، وتصدير ES. */
/* ===================== نظام الأنميشن v2: وضعيات مفتاحية (Keyframe Poses) =====================
   بدل ذراع واحدة تتأرجح، كل حركة تُعرَّف بوضعيات مفتاحية للجسم كله:
   الحوض، أسفل العمود وأعلاه، الرأس وميله، اليدان (بحل عكسي IK للمرفق)، زاوية السلاح، والساقان.
   تُمزج الوضعيات بسلاسة، فيصبح لكل ضربة وتفادٍ وصدّ شكل مختلف فعلاً. */
const TAU=6.2831853,WOOD='#8a6a45',STEEL='#b9bec5',DARKW='#5f646b',SKIN='#d9a77a';
const Pf=(c,f)=>{c.fillStyle=f;c.fill();};
const ease=x=>x<0?0:x>1?1:x*x*(3-2*x);
function dk(h,a){const n=parseInt(h.slice(1),16);
  return '#'+((1<<24)+(Math.round(((n>>16)&255)*(1-a))<<16)+(Math.round(((n>>8)&255)*(1-a))<<8)+Math.round((n&255)*(1-a))).toString(16).slice(1);}
function lt(h,a){const n=parseInt(h.slice(1),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  return '#'+((1<<24)+(Math.round(r+(255-r)*a)<<16)+(Math.round(g+(255-g)*a)<<8)+Math.round(b+(255-b)*a)).toString(16).slice(1);}
function limb(c,x1,y1,x2,y2,w,col){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=col;c.lineWidth=w;c.lineCap='round';c.stroke();}
function bone3(c,a,b,d,w,col){c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.lineTo(d[0],d[1]);
  c.strokeStyle=col;c.lineWidth=w;c.lineCap='round';c.lineJoin='round';c.stroke();}
function ell(c,x,y,rx,ry,f){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);Pf(c,f);}
function rrect(c,x,y,w,h,r,f){c.beginPath();c.roundRect?c.roundRect(x,y,w,h,r):c.rect(x,y,w,h);Pf(c,f);}
function tri(c,a,b,d,f){c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.lineTo(d[0],d[1]);c.closePath();Pf(c,f);}
const rot=(x,y,a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]];
function ik2(o,t,L1,L2,flip){let dx=t[0]-o[0],dy=t[1]-o[1],d=Math.hypot(dx,dy)||0.001;
  const cl=Math.max(Math.abs(L1-L2)+0.05,Math.min(d,L1+L2-0.05)),ex=o[0]+dx/d*cl,ey=o[1]+dy/d*cl,a=Math.atan2(ey-o[1],ex-o[0]);
  const A=Math.acos(Math.max(-1,Math.min(1,(L1*L1+cl*cl-L2*L2)/(2*L1*cl)))),g=a+(flip?A:-A);
  return {j:[o[0]+Math.cos(g)*L1,o[1]+Math.sin(g)*L1],e:[ex,ey]};}

/* ---------- الوضعيات ----------
   px,py الحوض | pl ميل أسفل العمود | cb انحناء أعلى العمود | ht ميل الرأس | hdx,hdy إزاحة الرأس
   fh,bh اليد الأمامية والخلفية | wa زاوية السلاح (0 للأمام، سالب للأعلى) | tf,kf / tb,kb فخذ وركبة الساق الأمامية/الخلفية */
const BASE={px:0,py:-11,pl:0.05,cb:0,ht:0,hdx:0,hdy:0,fh:[3.5,-6.5],bh:[-2.5,-6.5],wa:0.9,tf:0.13,kf:0.16,tb:-0.13,kb:0.16,air:0};
const GUARD={px:0,py:-10.3,pl:0.12,cb:0.06,ht:0.05,fh:[5,-11],bh:[1.5,-9.5],wa:-1.05,tf:0.38,kf:0.5,tb:-0.5,kb:0.38};
function P(o){return Object.assign({},BASE,GUARD,o);}
function mixPose(a,b,t){const r={};for(const k in a){const va=a[k],vb=b[k]===undefined?va:b[k];
  r[k]=Array.isArray(va)?[va[0]+(vb[0]-va[0])*t,va[1]+(vb[1]-va[1])*t]:va+(vb-va)*t;}return r;}
function keyPose(keys,t){if(t<=keys[0][0])return keys[0][1];
  for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){const [t0,p0]=keys[i-1],[t1,p1]=keys[i];return mixPose(p0,p1,ease((t-t0)/(t1-t0)));}
  return keys[keys.length-1][1];}

/* الضربات: مفاتيح على الخط الزمني القياسي (0 حراسة، 0.34 قمة الاستعداد، 0.44 الارتطام، 0.53 نهاية التجمّد، 1 حراسة) */
const G=P({});
const ATK={
  quick:[[0,G],
    [0.34,P({pl:0.02,cb:-0.28,ht:-0.12,fh:[-2,-13.5],bh:[3,-10],wa:-2.6,tf:0.3,kf:0.5,tb:-0.5,kb:0.3})],
    [0.44,P({px:1.6,pl:0.22,cb:0.38,ht:0.18,fh:[9,-10],bh:[-3.5,-8],wa:0.15,tf:0.62,kf:0.4,tb:-0.72,kb:0.25})],
    [0.53,P({px:1.6,pl:0.22,cb:0.4,ht:0.2,fh:[9.4,-9.2],bh:[-3.5,-8],wa:0.35,tf:0.62,kf:0.4,tb:-0.72,kb:0.25})],[1,G]],
  heavy:[[0,G],
    [0.34,P({py:-11.8,pl:-0.14,cb:-0.4,ht:-0.35,fh:[-1,-26],bh:[-3,-21.5],wa:-2.05,tf:0.2,kf:0.3,tb:-0.4,kb:0.3})],
    [0.40,P({py:-11,pl:0.05,cb:0.1,ht:-0.1,fh:[5,-23.5],bh:[1,-19],wa:-1.0,tf:0.45,kf:0.45,tb:-0.6,kb:0.3})],
    [0.44,P({px:2.4,py:-8.8,pl:0.32,cb:0.62,ht:0.38,fh:[10,-4.5],bh:[5,-6],wa:1.1,tf:0.85,kf:0.75,tb:-0.85,kb:0.3})],
    [0.53,P({px:2.4,py:-8.8,pl:0.32,cb:0.64,ht:0.4,fh:[10.2,-4],bh:[5,-5.5],wa:1.2,tf:0.85,kf:0.75,tb:-0.85,kb:0.3})],[1,G]],
  thrust:[[0,G],
    [0.34,P({px:-1.2,pl:-0.02,cb:-0.12,ht:-0.05,fh:[-3.5,-10.5],bh:[2,-11],wa:0,tf:0.28,kf:0.62,tb:-0.3,kb:0.52})],
    [0.44,P({px:3.4,pl:0.36,cb:0.26,ht:0.12,fh:[13,-11],bh:[-6.5,-8.5],wa:0,tf:0.9,kf:0.35,tb:-0.95,kb:0.2})],
    [0.53,P({px:3.4,pl:0.36,cb:0.28,ht:0.12,fh:[13.6,-11],bh:[-6.5,-8.5],wa:0.02,tf:0.9,kf:0.35,tb:-0.95,kb:0.2})],[1,G]],
  spin:[[0,G],
    [0.34,P({py:-9.4,pl:-0.06,cb:-0.22,ht:-0.1,fh:[-8,-12],bh:[-5,-11],wa:3.0,tf:0.5,kf:0.85,tb:-0.5,kb:0.85})],
    [0.39,P({py:-9.6,pl:0.05,cb:0,fh:[0,-14],bh:[-2,-13],wa:-1.6,tf:0.5,kf:0.85,tb:-0.5,kb:0.85})],
    [0.44,P({px:1.2,py:-9.4,pl:0.26,cb:0.3,ht:0.1,fh:[10.5,-11],bh:[7,-10.5],wa:0.2,tf:0.6,kf:0.8,tb:-0.6,kb:0.8})],
    [0.53,P({px:1.2,py:-9.4,pl:0.26,cb:0.32,fh:[11,-9],bh:[7.5,-9],wa:0.6,tf:0.6,kf:0.8,tb:-0.6,kb:0.8})],[1,G]]
};
/* التفادي بنوعين: قفزة للخلف، أو انحناء تحت الضربة */
const DODGE={
  leap:[[0,P({py:-9.3,pl:0.26,cb:0.12,fh:[5,-9],bh:[2,-9],tf:0.6,kf:1.05,tb:-0.4,kb:1.05})],
    [0.38,P({px:-2.2,py:-14.8,pl:-0.36,cb:-0.48,ht:-0.5,hdx:-0.6,fh:[1,-18.5],bh:[-6.5,-15],wa:-2.2,tf:0.95,kf:1.45,tb:0.1,kb:1.35,air:1})],
    [0.78,P({px:-1,py:-9.8,pl:-0.08,cb:0,ht:0.12,fh:[4,-12],bh:[-3,-11],tf:0.5,kf:0.95,tb:-0.5,kb:0.95})],[1,G]],
  duck:[[0,G],
    [0.32,P({py:-6.4,pl:0.52,cb:0.58,ht:0.4,hdy:1,fh:[3,-6],bh:[-4.5,-5],wa:-0.2,tf:1.0,kf:1.95,tb:-0.62,kb:1.85})],
    [0.7,P({py:-6.8,pl:0.46,cb:0.5,ht:0.3,hdy:0.8,fh:[3.5,-6.5],bh:[-4,-5.5],wa:-0.3,tf:0.95,kf:1.85,tb:-0.6,kb:1.75})],[1,G]]
};
/* الصدّ بالدرع: الدرع للأمام والرأس مختبئ خلفه */
const BLOCK=[[0,G],[0.22,P({py:-10,pl:0.2,cb:0.26,ht:0.34,hdx:-0.9,fh:[7.5,-12.5],bh:[3,-9],tf:0.55,kf:0.72,tb:-0.82,kb:0.3})],
  [1,P({py:-10,pl:0.18,cb:0.22,ht:0.3,hdx:-0.8,fh:[7,-12],bh:[3,-9],tf:0.5,kf:0.7,tb:-0.8,kb:0.3})]];

function poseIdle(t,combat){if(combat){const b=Math.sin(t*4.2);
    return Object.assign(P({}),{py:-10.3+b*0.3,cb:0.06+b*0.03,fh:[5,-11+b*0.4],bh:[1.5,-9.5+b*0.3],ht:0.05-b*0.03});}
  const b=Math.sin(t*2.6);return Object.assign({},BASE,{py:-11+b*0.3,cb:b*0.03,ht:-b*0.04,fh:[3.5,-6.5+b*0.3],bh:[-2.5,-6.5+b*0.3]});}
function poseWalk(t,spd,combat){const p=t*2.55*spd*TAU,s=Math.sin(p),c2=Math.cos(p*2);
  const r=Object.assign({},combat?P({}):BASE);
  r.py=-11.6-c2*1.4;r.pl=0.28;r.cb=0.1+c2*0.04;r.ht=-0.12-c2*0.05;r.air=Math.max(0,Math.sin(p*2))*0.55;
  r.tf=0.95*s;r.kf=1.55*Math.pow(0.5+0.5*Math.cos(p-4.12),2.2)+0.18;
  r.tb=0.95*Math.sin(p+Math.PI);r.kb=1.55*Math.pow(0.5+0.5*Math.cos(p+Math.PI-4.12),2.2)+0.18;
  if(combat){r.fh=[5.5+s*-1.2,-11.5+c2*0.6];r.bh=[-1+s*3,-8.5];r.wa=-1.0+s*0.15;}
  else{r.fh=[1.5-s*4.5,-7+Math.abs(s)*1.2];r.bh=[-1.5+s*4.5,-7+Math.abs(s)*1.2];r.wa=0.9-s*0.5;}
  return r;}
function poseStagger(t,d){return P({px:-1.8*d,py:-10.4,pl:-0.18-0.16*Math.sin(t*20)*d,cb:-0.48*d,ht:-0.58*d+Math.sin(t*14)*0.22*d,
  fh:[6+Math.sin(t*11)*2.2,-15.5+Math.cos(t*9)*2],bh:[-6.5,-14+Math.sin(t*13)*2],wa:-2.2+Math.sin(t*10)*0.4,tf:0.1,kf:0.42,tb:-0.55,kb:0.42});}
function addFlinch(p,f,fromBack){const s=fromBack?-1:1;p=Object.assign({},p);
  p.cb-=0.38*f*s;p.ht-=0.55*f*s;p.px-=1.3*f*s;p.fh=[p.fh[0]-1.6*f,p.fh[1]-1.4*f];p.bh=[p.bh[0]-1.2*f,p.bh[1]-1.6*f];return p;}
function poseDeath(){return P({py:-9,pl:0.3,cb:0.55,ht:0.65,fh:[4,-3],bh:[-2,-3],wa:1.3,tf:0.55,kf:1.0,tb:-0.45,kb:1.0});}

/* ---------- رسم الجسد من الوضعية ---------- */
function leg(c,hx,hy,th,fl,W,col){const k=[hx+Math.sin(th)*5.8,hy+Math.cos(th)*5.8];
  const f=[k[0]+Math.sin(th-fl)*6,k[1]+Math.cos(th-fl)*6];bone3(c,[hx,hy],k,f,W,col);
  limb(c,f[0],f[1],f[0]+Math.sin(th-fl+1.1)*2,f[1]+Math.cos(th-fl+1.1)*0.9,W,col);}
function drawBody(c,p,col,o){
  const W=o.lw||2,dc=dk(col,0.32),hp=[p.px,p.py];
  const M=add(hp,rot(0,-4.6,p.pl)),a2=p.pl+p.cb,C=add(M,rot(0,-4.6,a2)),N=add(C,rot(0,-1.3,a2));
  const ha=a2+p.ht,H=add(add(N,rot(0,-3.1,ha)),[p.hdx,p.hdy]);
  const Sb=add(C,rot(-0.9,0.7,a2)),Sf=add(C,rot(0.9,0.5,a2));
  const J={hip:hp,mid:M,chest:C,neck:N,head:H,ha,Sf,Sb,a2};
  leg(c,p.px-1.2,p.py,p.tb,p.kb,W,dc);
  o.backWeapon&&o.backWeapon(c,J,p,col);
  const b=ik2(Sb,p.bh,3.7,3.7,true);bone3(c,Sb,b.j,b.e,W-0.1,dc);J.handB=b.e;
  o.back&&o.back(c,J,p,col);
  bone3(c,hp,M,C,W+0.5,col);limb(c,C[0],C[1],N[0],N[1],W*0.8,col);
  o.chest&&o.chest(c,J,p,col);
  leg(c,p.px+1.2,p.py,p.tf,p.kf,W,col);
  c.save();c.translate(H[0],H[1]);c.rotate(ha);
  c.beginPath();c.arc(0,0,o.headR||3,0,TAU);Pf(c,col);c.lineWidth=0.7;c.strokeStyle=dk(col,0.4);c.stroke();
  ell(c,1.5,-0.3,0.55,0.55,dk(col,0.6));                      // العين تُظهر اتجاه الرأس
  o.head&&o.head(c,p,col);c.restore();
  const f=ik2(Sf,p.fh,3.7,3.7,true);J.handF=f.e;J.elbowF=f.j;
  o.weapon&&o.weapon(c,J,p,col);
  bone3(c,Sf,f.j,f.e,W,col);
  o.front&&o.front(c,J,p,col);
  return J;}


/* ===================== إضافات اللعبة (ليست في المرجع) =====================
   الرماة: مفاتيح على نفس الخط الزمني القياسي (0 حراسة، 0.34 قمة الاستعداد، 0.44 الإطلاق،
   0.53 نهاية التجمّد، 1 حراسة). الإطلاق الفعلي في اللعبة عند 0.47 (COMBAT.hitMoment). */
// القوس: رفعه بالذراع الأمامية ممدودة على ارتفاع الكتف، وشد الوتر باليد الخلفية حتى الخد،
// وانحناء خفيف للخلف، ثم ارتداد صغير بعد الإطلاق
ATK.shoot=[[0,G],
  [0.2,P({pl:-0.02,cb:-0.06,ht:0,fh:[6.8,-18.4],bh:[4.4,-18],wa:0,tf:0.45,kf:0.4,tb:-0.55,kb:0.35})],
  [0.34,P({px:-0.3,pl:-0.1,cb:-0.16,ht:-0.04,fh:[7.2,-18.8],bh:[0.4,-20.6],wa:0,tf:0.48,kf:0.4,tb:-0.6,kb:0.35})],
  [0.44,P({px:-0.3,pl:-0.1,cb:-0.16,ht:-0.04,fh:[7.3,-18.8],bh:[0.2,-20.8],wa:0,tf:0.48,kf:0.4,tb:-0.6,kb:0.35})],
  [0.53,P({px:-0.9,pl:-0.18,cb:-0.26,ht:-0.1,fh:[6.2,-19.6],bh:[-3.4,-19],wa:-0.12,tf:0.44,kf:0.4,tb:-0.62,kb:0.35})],[1,G]];
// الرمي: مثل الضربة القوية لكن بيد واحدة من فوق الكتف
ATK.throw=[[0,G],
  [0.34,P({py:-11.2,pl:-0.12,cb:-0.34,ht:-0.2,fh:[-5,-22.5],bh:[5,-15],wa:-2.4,tf:0.35,kf:0.35,tb:-0.55,kb:0.3})],
  [0.44,P({px:1.8,py:-10.2,pl:0.24,cb:0.36,ht:0.16,fh:[9,-18.5],bh:[-4,-11],wa:-0.3,tf:0.75,kf:0.55,tb:-0.8,kb:0.3})],
  [0.53,P({px:2.2,py:-9.8,pl:0.3,cb:0.46,ht:0.22,fh:[9.4,-11],bh:[-4.5,-10],wa:0.6,tf:0.8,kf:0.6,tb:-0.82,kb:0.3})],[1,G]];

// من المرجع (قسم الوحدات): اتجاه السلاح
const wdir=a=>[Math.cos(a),Math.sin(a)];

export {
  TAU, WOOD, STEEL, DARKW, SKIN, Pf, ease, dk, lt, limb, bone3, ell, rrect, tri, rot, add, ik2,
  BASE, GUARD, P, mixPose, keyPose, G, ATK, DODGE, BLOCK,
  poseIdle, poseWalk, poseStagger, addFlinch, poseDeath, leg, drawBody, wdir
};
