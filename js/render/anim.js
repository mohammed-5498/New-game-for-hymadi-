/* منقول كما هو من docs/combat-reference.html (v3: أسلوب رسوم Stickman — الوضعيات المفتاحية،
   اللكمات والركلات، السقوط والنهوض، وردود الفعل المبالغ فيها).
   لا تُعدَّل أرقام الوضعيات هنا؛ عدّل المرجع ثم أعد النسخ.
   الإضافات الوحيدة: مفاتيح القوس (ATK.shoot) والرمي (ATK.throw) للرماة في آخر الملف، وتصدير ES،
   واستيراد CR من config.js (poseDown و downAngle تقرآن CR.downTime كما في المرجع).
   (المرحلة 8) تسريعات لا تغيّر بكسلاً واحداً: حفظ الألوان المحسوبة، وضبط الأطراف المستديرة مرة واحدة
   في drawBody، ونسخ G المحسوبة مرة بدل P({}) في كل إطار. */
import { COMBAT_REALISM as CR } from '../config.js';
/* ===================== نظام الأنميشن v2: وضعيات مفتاحية (Keyframe Poses) =====================
   بدل ذراع واحدة تتأرجح، كل حركة تُعرَّف بوضعيات مفتاحية للجسم كله:
   الحوض، أسفل العمود وأعلاه، الرأس وميله، اليدان (بحل عكسي IK للمرفق)، زاوية السلاح، والساقان.
   تُمزج الوضعيات بسلاسة، فيصبح لكل ضربة وتفادٍ وصدّ شكل مختلف فعلاً. */
const TAU=6.2831853,WOOD='#8a6a45',STEEL='#b9bec5',DARKW='#5f646b',SKIN='#d9a77a';
const Pf=(c,f)=>{c.fillStyle=f;c.fill();};
const ease=x=>x<0?0:x>1?1:x*x*(3-2*x);
function dk0(h,a){const n=parseInt(h.slice(1),16);
  return '#'+((1<<24)+(Math.round(((n>>16)&255)*(1-a))<<16)+(Math.round(((n>>8)&255)*(1-a))<<8)+Math.round((n&255)*(1-a))).toString(16).slice(1);}
function lt0(h,a){const n=parseInt(h.slice(1),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  return '#'+((1<<24)+(Math.round(r+(255-r)*a)<<16)+(Math.round(g+(255-g)*a)<<8)+Math.round(b+(255-b)*a)).toString(16).slice(1);}
// (المرحلة 8) نفس اللون محفوظاً بعد أول حساب: الألوان قليلة وتتكرر لكل وحدة في كل إطار،
// وحسابها كل مرة ينشئ نصوصاً جديدة يجمعها جامع القمامة. النتيجة نفسها تماماً.
const DK=new Map(),LT=new Map();
function memo2(M,f,h,a){let m=M.get(h);if(!m)M.set(h,m=new Map());let v=m.get(a);if(v===undefined)m.set(a,v=f(h,a));return v;}
function dk(h,a){return memo2(DK,dk0,h,a);}
function lt(h,a){return memo2(LT,lt0,h,a);}
// (المرحلة 8) داخل drawBody كل الخطوط بأطراف ووصلات مستديرة: تُضبطان مرة واحدة في أوله بدل كل خط
// (نفس الحالة عند كل رسم بالضبط، فالصورة نفسها تماماً، بأوامر أقل للوحة)
let roundSet=false;
function limb(c,x1,y1,x2,y2,w,col){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=col;c.lineWidth=w;if(!roundSet)c.lineCap='round';c.stroke();}
function bone3(c,a,b,d,w,col){c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.lineTo(d[0],d[1]);
  c.strokeStyle=col;c.lineWidth=w;if(!roundSet){c.lineCap='round';c.lineJoin='round';}c.stroke();}
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
const GUARD={px:0,py:-9.8,pl:0.18,cb:0.1,ht:0.08,fh:[4.6,-15],bh:[3,-13.4],wa:-1.35,tf:0.58,kf:0.75,tb:-0.72,kb:0.48};
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
    [0.44,P({px:2.6,pl:0.3,cb:0.5,ht:0.22,fh:[9.5,-10],bh:[-4.5,-9],wa:0.2,tf:0.85,kf:0.45,tb:-0.95,kb:0.25})],
    [0.53,P({px:2.6,pl:0.3,cb:0.52,ht:0.24,fh:[9.8,-9.2],bh:[-4.5,-9],wa:0.4,tf:0.85,kf:0.45,tb:-0.95,kb:0.25})],[1,G]],
  heavy:[[0,G],
    [0.34,P({py:-11.8,pl:-0.14,cb:-0.4,ht:-0.35,fh:[-1,-26],bh:[-3,-21.5],wa:-2.05,tf:0.2,kf:0.3,tb:-0.4,kb:0.3})],
    [0.40,P({py:-11,pl:0.05,cb:0.1,ht:-0.1,fh:[5,-23.5],bh:[1,-19],wa:-1.0,tf:0.45,kf:0.45,tb:-0.6,kb:0.3})],
    [0.44,P({px:3.4,py:-8.2,pl:0.4,cb:0.78,ht:0.45,fh:[10.5,-4],bh:[5.5,-5.5],wa:1.15,tf:1.0,kf:0.85,tb:-1.0,kb:0.3})],
    [0.53,P({px:3.4,py:-8.2,pl:0.4,cb:0.8,ht:0.46,fh:[10.7,-3.6],bh:[5.5,-5],wa:1.25,tf:1.0,kf:0.85,tb:-1.0,kb:0.3})],[1,G]],
  thrust:[[0,G],
    [0.34,P({px:-1.2,pl:-0.02,cb:-0.12,ht:-0.05,fh:[-3.5,-10.5],bh:[2,-11],wa:0,tf:0.28,kf:0.62,tb:-0.3,kb:0.52})],
    [0.44,P({px:4.6,pl:0.42,cb:0.3,ht:0.14,fh:[14,-11.5],bh:[-7,-9.5],wa:0,tf:1.1,kf:0.4,tb:-1.15,kb:0.2})],
    [0.53,P({px:4.6,pl:0.42,cb:0.32,ht:0.14,fh:[14.5,-11.5],bh:[-7,-9.5],wa:0.02,tf:1.1,kf:0.4,tb:-1.15,kb:0.2})],[1,G]],
  punch:[[0,G],     // لكمة باليد الحرة، والسلاح يُسحب للصدر
    [0.34,P({pl:0.06,cb:-0.12,fh:[2.5,-15.5],bh:[-1.5,-11.5],wa:-1.7,tf:0.5,kf:0.8,tb:-0.78,kb:0.45})],
    [0.44,P({px:3.2,pl:0.38,cb:0.4,ht:0.16,fh:[2,-12.5],bh:[12.5,-14.6],wa:-1.7,tf:0.85,kf:0.5,tb:-1.05,kb:0.22})],
    [0.53,P({px:3.2,pl:0.38,cb:0.42,ht:0.16,fh:[2,-12.5],bh:[13,-14.6],wa:-1.7,tf:0.85,kf:0.5,tb:-1.05,kb:0.22})],[1,G]],
  kick_front:[[0,G],  // ركلة أمامية: الركبة تُرفع ثم تمتد الرجل
    [0.34,P({py:-10.6,pl:-0.2,cb:-0.2,ht:-0.1,fh:[4,-15.8],bh:[1,-13.6],tf:1.35,kf:1.95,tb:-0.1,kb:0.15})],
    [0.44,P({px:0.6,py:-10.9,pl:-0.4,cb:-0.26,ht:-0.14,fh:[3,-16.2],bh:[-2.4,-12],tf:1.52,kf:0.1,tb:-0.26,kb:0.1})],
    [0.53,P({px:0.6,py:-10.9,pl:-0.4,cb:-0.26,ht:-0.14,fh:[3,-16.2],bh:[-2.4,-12],tf:1.55,kf:0.08,tb:-0.26,kb:0.1})],[1,G]],
  kick_high:[[0,G],   // ركلة جانبية عالية: الجسد يميل بعيداً والرجل بارتفاع الرأس
    [0.34,P({py:-10.8,pl:-0.26,cb:-0.3,fh:[3,-15.6],bh:[-1,-12],tf:1.62,kf:2.2,tb:-0.1,kb:0.1})],
    [0.44,P({px:-0.6,py:-11.1,pl:-0.64,cb:-0.36,ht:-0.22,fh:[1.4,-12],bh:[-7.4,-9],tf:2.18,kf:0.05,tb:-0.05,kb:0.05})],
    [0.53,P({px:-0.6,py:-11.1,pl:-0.64,cb:-0.36,ht:-0.22,fh:[1.4,-12],bh:[-7.4,-9],tf:2.24,kf:0.04,tb:-0.05,kb:0.05})],[1,G]],
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
    return Object.assign({},G,{py:-10.3+b*0.3,cb:0.06+b*0.03,fh:[5,-11+b*0.4],bh:[1.5,-9.5+b*0.3],ht:0.05-b*0.03});}
  const b=Math.sin(t*2.6);return Object.assign({},BASE,{py:-11+b*0.3,cb:b*0.03,ht:-b*0.04,fh:[3.5,-6.5+b*0.3],bh:[-2.5,-6.5+b*0.3]});}
function poseWalk(t,spd,combat){const p=t*2.55*spd*TAU,s=Math.sin(p),c2=Math.cos(p*2);
  const r=Object.assign({},combat?G:BASE);
  r.py=-11.6-c2*1.4;r.pl=0.28;r.cb=0.1+c2*0.04;r.ht=-0.12-c2*0.05;r.air=Math.max(0,Math.sin(p*2))*0.55;
  r.tf=0.95*s;r.kf=1.55*Math.pow(0.5+0.5*Math.cos(p-4.12),2.2)+0.18;
  r.tb=0.95*Math.sin(p+Math.PI);r.kb=1.55*Math.pow(0.5+0.5*Math.cos(p+Math.PI-4.12),2.2)+0.18;
  if(combat){r.fh=[5.5+s*-1.2,-11.5+c2*0.6];r.bh=[-1+s*3,-8.5];r.wa=-1.0+s*0.15;}
  else{r.fh=[1.5-s*4.5,-7+Math.abs(s)*1.2];r.bh=[-1.5+s*4.5,-7+Math.abs(s)*1.2];r.wa=0.9-s*0.5;}
  return r;}
function poseStagger(t,d){return P({px:-2.6*d,py:-10.2,pl:-0.26-0.22*Math.sin(t*20)*d,cb:-0.7*d,ht:-0.85*d+Math.sin(t*14)*0.3*d,
  fh:[6.5+Math.sin(t*11)*3,-16.5+Math.cos(t*9)*2.6],bh:[-7.5,-15+Math.sin(t*13)*2.6],wa:-2.3+Math.sin(t*10)*0.5,
  tf:0.35+Math.max(0,Math.sin(t*9))*0.6*d,kf:0.7,tb:-0.6,kb:0.45});}
/* السقوط على الأرض ثم النهوض: الوضعية + زاوية دوران الجسد كله */
function poseDown(e){const T=CR.downTime;
  if(e<T-0.36)return P({py:-9,pl:0.1,cb:0.22,ht:0.35,fh:[5.5,-6],bh:[-4.5,-12.5],wa:0.8,tf:0.65,kf:0.85,tb:-0.3,kb:0.6});
  const g=ease((e-(T-0.36))/0.36);
  return mixPose(P({py:-7,pl:0.48,cb:0.34,ht:0.22,fh:[4,-8],bh:[1,-7],tf:1.25,kf:1.95,tb:-0.3,kb:1.85}),P({}),g);}
function downAngle(e){const T=CR.downTime;
  if(e<0.26)return -1.5*ease(e/0.26);
  if(e<T-0.36)return -1.5+Math.sin((e-0.26)*14)*0.06*Math.max(0,1-(e-0.26)*3);
  return -1.5*(1-ease((e-(T-0.36))/0.36));}
function addFlinch(p,f,fromBack){const s=fromBack?-1:1;p=Object.assign({},p);
  p.cb-=0.72*f*s;p.pl-=0.2*f*s;p.ht-=0.95*f*s;p.px-=2.2*f*s;p.py+=0.4*f;
  p.fh=[p.fh[0]-2.4*f,p.fh[1]-3*f];p.bh=[p.bh[0]-3.2*f,p.bh[1]-4*f];
  p.tf+=0.75*f;p.kf+=0.95*f;return p;}
function poseDeath(){return P({py:-9,pl:0.3,cb:0.55,ht:0.65,fh:[4,-3],bh:[-2,-3],wa:1.3,tf:0.55,kf:1.0,tb:-0.45,kb:1.0});}

/* ---------- رسم الجسد من الوضعية ---------- */
function leg(c,hx,hy,th,fl,W,col){const kx=hx+Math.sin(th)*5.8,ky=hy+Math.cos(th)*5.8;
  const fx=kx+Math.sin(th-fl)*6,fy=ky+Math.cos(th-fl)*6;
  c.beginPath();c.moveTo(hx,hy);c.lineTo(kx,ky);c.lineTo(fx,fy);c.strokeStyle=col;c.lineWidth=W;
  if(!roundSet){c.lineCap='round';c.lineJoin='round';}c.stroke();
  limb(c,fx,fy,fx+Math.sin(th-fl+1.1)*2,fy+Math.cos(th-fl+1.1)*0.9,W,col);}
function drawBody(c,p,col,o){
  c.lineCap='round';c.lineJoin='round';roundSet=true;
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
  roundSet=false;
  return J;}

/* ===================== إضافات اللعبة (ليست في المرجع) =====================
   الرماة: مفاتيح على نفس الخط الزمني القياسي (0 حراسة، 0.34 قمة الاستعداد، 0.44 الإطلاق،
   0.53 نهاية التجمّد، 1 حراسة). الإطلاق الفعلي في اللعبة عند 0.47 (COMBAT.hitMoment). */
// القوس (بأسلوب v3 المبالغ): رفعه بذراع ممدودة على ارتفاع الكتف ووقفة عريضة، وشد الوتر باليد
// الخلفية حتى الخد مع انحناء واضح للخلف، ثم ارتداد بعد الإطلاق
ATK.shoot=[[0,G],
  [0.2,P({pl:-0.05,cb:-0.1,ht:0,fh:[7,-18.2],bh:[4.8,-17.6],wa:0,tf:0.62,kf:0.7,tb:-0.8,kb:0.45})],
  [0.34,P({px:-0.8,pl:-0.22,cb:-0.34,ht:-0.1,fh:[7.4,-19.2],bh:[-0.4,-21],wa:-0.04,tf:0.68,kf:0.72,tb:-0.86,kb:0.45})],
  [0.44,P({px:-0.9,pl:-0.24,cb:-0.36,ht:-0.1,fh:[7.5,-19.3],bh:[-0.7,-21.1],wa:-0.04,tf:0.68,kf:0.72,tb:-0.86,kb:0.45})],
  [0.53,P({px:-1.8,pl:-0.3,cb:-0.46,ht:-0.2,fh:[6,-20.4],bh:[-5,-19.5],wa:-0.2,tf:0.6,kf:0.7,tb:-0.9,kb:0.5})],[1,G]];
// الرمي: من فوق الكتف باندفاع كامل للجسد (مثل الضربة القوية بيد واحدة)
ATK.throw=[[0,G],
  [0.34,P({py:-11.6,pl:-0.3,cb:-0.55,ht:-0.3,fh:[-7,-23.5],bh:[6,-16],wa:-2.6,tf:0.45,kf:0.5,tb:-0.75,kb:0.35})],
  [0.44,P({px:3.4,py:-9.6,pl:0.42,cb:0.62,ht:0.26,fh:[10.5,-17],bh:[-5.5,-10],wa:-0.2,tf:1.05,kf:0.6,tb:-1.05,kb:0.25})],
  [0.53,P({px:3.8,py:-9.2,pl:0.48,cb:0.72,ht:0.3,fh:[10,-8.5],bh:[-6,-9],wa:0.8,tf:1.1,kf:0.65,tb:-1.05,kb:0.25})],[1,G]];

// من المرجع (قسم الوحدات): اتجاه السلاح
const wdir=a=>[Math.cos(a),Math.sin(a)];

export {
  TAU, WOOD, STEEL, DARKW, SKIN, Pf, ease, dk, lt, limb, bone3, ell, rrect, tri, rot, add, ik2,
  BASE, GUARD, P, mixPose, keyPose, G, ATK, DODGE, BLOCK,
  poseIdle, poseWalk, poseStagger, addFlinch, poseDeath, poseDown, downAngle, leg, drawBody, wdir
};
