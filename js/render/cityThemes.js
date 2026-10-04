// طوابع المدن (القسم 3.9): منقول من docs/city-themes.js كما هو، مع فرقين فقط:
// 1) كل لون يمر عبر paint() قبل الرسم، فيعمل صبغ المالك (القسم 8) والطقس على كل المدن
// 2) لا يحوي buildMap/drawMap التجريبيتين: مولّد الخريطة الحقيقي في js/map/generator.js
/* ===================== طوابع المدن — 9 مدن مخربة (مرجع للمرحلة 7ب، القسم 3.9) =====================
   المدن: arab, japan, china, europe, norway, hk, jaipur, mexico, chicago
   كيف يُقرأ هذا الملف:
   - أدوات رسم مشتركة: box, wL/wR (عناصر على الواجهتين)، arch، ridgeRoof (سقف بسنام: مثلث أوروبي/نرويجي أو مقعّر بأطراف مرفوعة صيني/ياباني)،
     hipRoof، dome، stepGable/bellGable، snowCap، glow، neonSign.
   - طبقة الخراب المشتركة: damage() على كل مبنى، ruinTile() للمباني المنهارة، streetDebris() للشوارع.
   - THEMES[key]: ألوان الأرض والشوارع والساحات (ground, road, road2, plaza)، ألوان الركام والأطلال (debris, wallL, wallR)، ألوان السيارات (car)،
     pool (أنواع المباني وأوزانها)، draw (دالة رسم لكل نوع + landmark + plazaProp + roadProp + tree)،
     واختيارياً: isWater/waterCol/hook/groundAt (النرويجية: ماء على حافة الخريطة وثلج).
   - كل دالة رسم تأخذ (x, y, i, j, T): مركز المربع على الشاشة بنظام 36×18، وإحداثيات المربع، والطابع.
   - العشوائية حتمية عبر hsh(i,j,k) وبذرة الخريطة SEED: نفس الخريطة تُرسم دائماً بنفس الشكل، وهذا شرط للتخزين المؤقت.
   - drawMap() و buildMap() في آخر الملف للعرض التجريبي فقط (شبكة 11×11)، لا تُنقل كما هي. */
let ctx=null,SEED=0;
// تلوين كل لون قبل استعماله: صبغ المالك (القسم 8) والطقس. roofMode: الأسطح تُصبغ أكثر من الجدران
let tone=null,roofMode=false;
const paint=c=>tone?tone(c,roofMode):c;
export function setThemeContext(context,seed){ctx=context;SEED=seed%10007;}
export function setTone(fn){tone=fn;roofMode=false;}
export const getCtx=()=>ctx;
const TAU=6.2831853;
function poly(a,c){ctx.beginPath();ctx.moveTo(a[0][0],a[0][1]);for(let k=1;k<a.length;k++)ctx.lineTo(a[k][0],a[k][1]);ctx.closePath();ctx.fillStyle=paint(c);ctx.fill();}
function circ(x,y,r,c,al){ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fillStyle=paint(c);if(al!==undefined)ctx.globalAlpha=al;ctx.fill();ctx.globalAlpha=1;}
function ln(a,b,c,d,col,w){ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(c,d);ctx.strokeStyle=paint(col);ctx.lineWidth=w;ctx.lineCap='round';ctx.stroke();}
function rc(x,y,w,h,c){ctx.fillStyle=paint(c);ctx.fillRect(x,y,w,h);}
function el(x,y,rx,ry,c){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fillStyle=paint(c);ctx.fill();}
const hsh=(i,j,k)=>{const s=Math.sin(i*127.1+j*311.7+k*74.7+SEED*0.013)*43758.5453;return s-Math.floor(s);};
const mixc=(a,b,t)=>{const p=s=>[1,3,5].map(i=>parseInt(s.substr(i,2),16)),A=p(a),B=p(b);
  return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');};
function box(x,y,w,d,h,L,R,T){poly([[x-w,y],[x,y+d],[x,y+d-h],[x-w,y-h]],L);poly([[x,y+d],[x+w,y],[x+w,y-h],[x,y+d-h]],R);
  if(T){roofMode=true;poly([[x-w,y-h],[x,y-d-h],[x+w,y-h],[x,y+d-h]],T);roofMode=false;}}
const qL=(x,y,w,d)=>(a,b)=>[x-w+a*w,y+a*d-b], qR=(x,y,w,d)=>(a,b)=>[x+a*w,y+d-a*d-b];
function wL(x,y,w,d,u,v,du,dv,c){const q=qL(x,y,w,d);poly([q(u,v),q(u+du,v),q(u+du,v+dv),q(u,v+dv)],c);}
function wR(x,y,w,d,u,v,du,dv,c){const q=qR(x,y,w,d);poly([q(u,v),q(u+du,v),q(u+du,v+dv),q(u,v+dv)],c);}
function arch(q,u,du,dv,c){const pts=[q(u,0),q(u+du,0),q(u+du,dv*0.62)];
  for(let i=1;i<8;i++){const t=i/8;pts.push(q(u+du*(1-t),dv*0.62+Math.sin(Math.PI*t)*dv*0.38));}pts.push(q(u,dv*0.62));poly(pts,c);}
/* سقف بسنام: السنام موازٍ للواجهة اليسرى. gable=جدار مثلث على الواجهة اليمنى (أوروبي/نرويجي)،
   وإلا سقف بأطراف مائلة (صيني/ياباني) مع تقعّر sag وأطراف مرفوعة flare وخطوط قرميد tile */
function ridgeRoof(x,y,w,d,h,rh,o){roofMode=true;try{return ridgeRoof0(x,y,w,d,h,rh,o);}finally{roofMode=false;}}
function ridgeRoof0(x,y,w,d,h,rh,o){const ov=o.ov||0,W=w+ov,D=d+ov/2,cy=y-h;
  const L=[x-W,cy],F=[x,cy+D],R=[x+W,cy],B=[x,cy-D],k=o.gable?1:(o.k||0.55);
  const P1=[x-W/2*k,cy-D/2*k-rh],P2=[x+W/2*k,cy+D/2*k-rh];
  poly([B,R,P2,P1],o.back||'#2a2622');poly([L,B,P1],o.back||'#2a2622');
  const sag=o.sag||0,mix=(A,Bp,t,s)=>[A[0]+(Bp[0]-A[0])*t,A[1]+(Bp[1]-A[1])*t+s];
  if(sag){const ML=mix(L,P1,0.42,sag),MF=mix(F,P2,0.42,sag);poly([L,F,MF,ML],o.front2||o.front);poly([ML,MF,P2,P1],o.front);}
  else poly([L,F,P2,P1],o.front);
  if(o.tile)for(let t=1;t<7;t++){const u=t/7,e=[L[0]+(F[0]-L[0])*u,L[1]+(F[1]-L[1])*u],r=[P1[0]+(P2[0]-P1[0])*u,P1[1]+(P2[1]-P1[1])*u];
    const m=sag?mix(e,r,0.42,sag):null;if(m){ln(e[0],e[1],m[0],m[1],o.tile,0.5);ln(m[0],m[1],r[0],r[1],o.tile,0.5);}else ln(e[0],e[1],r[0],r[1],o.tile,0.5);}
  if(o.gable){poly([[x,y+d-h],[x+w,y-h],P2],o.wallEnd);if(o.eave){ln(F[0],F[1],P2[0],P2[1],o.eave,1.1);ln(P2[0],P2[1],R[0],R[1],o.eave,1.1);}}
  else{if(sag){const MF=mix(F,P2,0.42,sag),MR=mix(R,P2,0.42,sag);poly([F,R,MR,MF],o.end2||o.end);poly([MF,MR,P2],o.end);}else poly([F,R,P2],o.end);}
  ln(P1[0],P1[1],P2[0],P2[1],o.ridge||'rgba(0,0,0,0.35)',o.ridgeW||1);
  if(o.flare){const f=o.flare,fl=(p,s,c)=>poly([p,[p[0]+s*f*0.9,p[1]-f*1.4],[p[0]+s*f*0.15,p[1]+0.7]],c);
    fl(L,-1,o.front2||o.front);fl(R,1,o.end2||o.end||o.front);
    poly([[F[0]-f*0.8,F[1]],[F[0],F[1]+f*0.3],[F[0]+f*0.8,F[1]],[F[0],F[1]-0.8]],o.front2||o.front);
    [[P1,-1],[P2,1]].forEach(([p,s])=>poly([[p[0],p[1]],[p[0]+s*f*0.7,p[1]-f*1.1],[p[0]+s*f*0.2,p[1]+0.4]],o.ridge||'#2a2622'));}
  return {P1,P2,L,F,R};}
function hipRoof(x,y,w,d,h,rh,L,R){roofMode=true;const a=[x,y-h-rh];poly([[x-w,y-h],a,[x+w,y-h]],'#2a2622');poly([[x-w,y-h],[x,y+d-h],a],L);poly([[x,y+d-h],[x+w,y-h],a],R);roofMode=false;}
function dome(x,y,r,col,shade,tip){roofMode=true;ctx.beginPath();ctx.ellipse(x,y,r,r*1.15,0,Math.PI,0);ctx.fillStyle=paint(col);ctx.fill();
  ctx.beginPath();ctx.ellipse(x+r*0.25,y,r*0.75,r*1.1,0,-Math.PI/2,0);ctx.lineTo(x+r*0.25,y);ctx.closePath();ctx.fillStyle=paint(shade);ctx.fill();roofMode=false;
  el(x,y,r,r*0.32,shade);if(tip){ln(x,y-r*1.15,x,y-r*1.15-4,tip,0.9);circ(x,y-r*1.15-4.4,0.9,tip);}}
function flag(x,y,col){ln(x,y,x,y-22,'#2b2825',1.2);poly([[x,y-22],[x+10,y-19],[x,y-16]],col);}
function glow(x,y,r,col){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}

/* ================= طبقة الخراب المشتركة ================= */
/* أضرار على أي مبنى: شقوق، سخام، نوافذ مسدودة بألواح، كتابات جدران، ركام عند القاعدة */
function damage(x,y,w,d,h,i,j,T){const qa=qL(x,y,w,d),qb=qR(x,y,w,d);
  if(hsh(i,j,1)<0.5){const u0=0.2+hsh(i,j,2)*0.5;let p=qa(u0,h-1);ctx.beginPath();ctx.moveTo(p[0],p[1]);
    for(let s=1;s<=4;s++){p=qa(u0+(hsh(i,j,10+s)-0.5)*0.12,h-1-s*h*0.14);ctx.lineTo(p[0],p[1]);}ctx.strokeStyle='rgba(30,22,18,0.55)';ctx.lineWidth=0.6;ctx.stroke();}
  if(hsh(i,j,3)<0.35){const p=qb(0.55,h-3);ctx.save();ctx.globalAlpha=0.32;el(p[0],p[1],w*0.35,h*0.22,'#1d1a17');ctx.restore();}
  if(hsh(i,j,4)<0.3){const u=0.55+hsh(i,j,5)*0.2;wR(x,y,w,d,u,h*0.45,0.2,h*0.22,'#2a2420');
    const a=qb(u,h*0.45),b=qb(u+0.2,h*0.67),c2=qb(u,h*0.67),e=qb(u+0.2,h*0.45);ln(a[0],a[1],b[0],b[1],'#8a6a45',1.1);ln(c2[0],c2[1],e[0],e[1],'#7a5c3c',1.1);}
  if(hsh(i,j,6)<0.22){const cols=['#d8463a','#3fa3d8','#f2c14e','#8fd06a'],c3=cols[Math.floor(hsh(i,j,7)*4)];
    ctx.beginPath();const s=qa(0.15,1.5);ctx.moveTo(s[0],s[1]);for(let k=1;k<6;k++){const p=qa(0.15+k*0.06,1.5+(k%2?2.8:0.4));ctx.lineTo(p[0],p[1]);}
    ctx.strokeStyle=c3;ctx.lineWidth=0.9;ctx.stroke();}
  if(hsh(i,j,8)<0.45){const dc=T.debris||'#8a8074';poly([[x+3,y+d-1],[x+7,y+d-3.6],[x+11,y+d-2.6],[x+8,y+d+0.4]],dc);
    poly([[x-10,y+2],[x-7,y],[x-4,y+2.4],[x-7,y+3.6]],mixc(dc,'#000000',0.15));}}
/* مبنى منهار: جداران مكسوران وأرضية محترقة وركام وعارضة متفحمة */
function ruinTile(x,y,i,j,T){const L=T.wallL||'#8a8074',R=T.wallR||'#a39888',w=13,d=6.5;
  poly([[x-w,y-11],[x,y-d-11],[x+w,y-5],[x,y+d-8]],'#3e3832');
  poly([[x-w,y],[x,y+d],[x,y+d-8],[x-w*0.5,y+d*0.5-15],[x-w,y-11]],L);
  poly([[x,y+d],[x+w,y],[x+w,y-4],[x+w*0.55,y+d*0.45-12],[x,y+d-8]],R);
  wL(x,y,w,d,0.3,3,0.22,4,'#2a2420');
  ln(x-6,y-1,x+5,y+4,'#2b2420',1.6);
  const dc=T.debris||'#8a8074';poly([[x+3,y+6],[x+8,y+3],[x+14,y+6],[x+8,y+8.5]],dc);poly([[x-12,y+4],[x-7,y+1.5],[x-3,y+5],[x-8,y+7]],mixc(dc,'#000000',0.18));
  circ(x+6,y+3,0.9,'#5a524a');circ(x-9,y+3,0.8,'#5a524a');}
/* حطام الشوارع: سيارات محطمة، براميل نار، حفر، ركام، أكياس رمل */
function streetDebris(x,y,i,j,T){const r=hsh(i,j,20);
  if(r<0.07){const car=T.car||['#6b4f3a','#85624a','#57402f'];box(x,y+2,8,4,4,car[0],car[1],car[2]);box(x+1,y-2,4,2,3,'#2f2c29','#3d3936','#34302c');
    ctx.save();ctx.globalAlpha=0.3;el(x+2,y-6,4,2.5,'#2a2724');ctx.restore();}
  else if(r<0.12){glow(x,y-6,14,'rgba(255,150,60,0.38)');rc(x-2.5,y-5,5,6,'#4f4337');
    poly([[x-3,y-5],[x,y-13],[x+3,y-5]],'#e8893a');poly([[x-1.5,y-5],[x,y-9],[x+1.5,y-5]],'#f2c14e');}
  else if(r<0.24){el(x+(hsh(i,j,21)-0.5)*8,y+1,3.4,1.5,'rgba(28,24,20,0.45)');}
  else if(r<0.3){const dc=T.debris||'#8a8074';poly([[x-4,y+2],[x,y-1],[x+5,y+2],[x,y+4]],dc);circ(x+3,y,0.9,'#5a524a');}
  else if(r<0.33){for(let k=0;k<3;k++)el(x-5+k*3.6,y+1-k*1.8,2.2,1.3,'#9c8a62');for(let k=0;k<2;k++)el(x-3.2+k*3.6,y-1.6-k*1.8,2.2,1.3,'#b09c72');}}

/* ================= الطوابع ================= */
const THEMES={};
/* ---------- عربي ---------- */
THEMES.arab={name:'مدينة عربية',ground:'#d4bd92',road:'#b99f74',road2:'#ad946b',plaza:'#e2d0ab',debris:'#bba47c',wallL:'#c7b591',wallR:'#ddcdab',
  pool:[['house',28],['tall',16],['domeHouse',10],['souk',10],['palm',14],['ruin',12],['.',8]],
  draw:{
    house(x,y,i,j,T){const h=13+((i+j)%3)*3;box(x,y,14,7,h,'#d8c7a6','#ecdfc4','#e3d4b4');
      poly([[x-14,y-h],[x,y-7-h],[x+14,y-h],[x+14,y-h-1.6],[x,y-7-h-1.6],[x-14,y-h-1.6]],'#cbb994');
      arch(qR(x,y,14,7),0.35,0.24,9,'#5a4334');wL(x,y,14,7,0.25,h-8,0.3,4,'#8a5d3b');
      for(let k=0;k<3;k++){const p=qL(x,y,14,7)(0.28+k*0.09,h-8),q2=qL(x,y,14,7)(0.28+k*0.09,h-4);ln(p[0],p[1],q2[0],q2[1],'#c9a578',0.4);}
      damage(x,y,14,7,h,i,j,T);},
    tall(x,y,i,j,T){const h=26;box(x,y,14,7,h,'#d4c2a0','#e9dbbe','#dfcfae');
      box(x+5,y-h+2,3,1.5,11,'#cdb995','#e1d2b2','#d6c6a4');for(let k=0;k<3;k++)wR(x+5,y-h+2,3,1.5,0.15+k*0.28,3,0.14,6,'#5a4334');
      arch(qR(x,y,14,7),0.4,0.2,10,'#5a4334');wL(x,y,14,7,0.2,h-9,0.25,5,'#8a5d3b');wL(x,y,14,7,0.6,h-9,0.25,5,'#8a5d3b');wR(x,y,14,7,0.65,h-9,0.22,4,'#5a4334');
      damage(x,y,14,7,h,i,j,T);},
    domeHouse(x,y,i,j,T){box(x,y,14,7,12,'#dccbaa','#efe3c9','#e5d7b8');dome(x,y-12,7,'#efe7d6','#d4c9b5','#b08a4a');arch(qR(x,y,14,7),0.3,0.3,9,'#5a4334');damage(x,y,14,7,12,i,j,T);},
    souk(x,y){[[x-7,y,'#b5452f'],[x+6,y+3,'#2f6e6a']].forEach(([sx,sy,cl],n)=>{box(sx,sy,6,3,5,'#9a7a54','#b08e66');
      poly([[sx-8,sy-5],[sx,sy-2],[sx,sy-8+n*2],[sx-8,sy-11]],cl);poly([[sx,sy-2],[sx+8,sy-5],[sx+8,sy-11],[sx,sy-8+n*2]],'#e9dcc2');});
      rc(x-2,y+3,4,3,'#7b3b2e');rc(x-1.4,y+3.4,2.8,0.6,'#d9a24a');},
    palm(x,y,i,j){const o=((i*3+j)%3)-1;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+o*3,y-12,x+o*2,y-22);ctx.strokeStyle='#8a6a45';ctx.lineWidth=1.8;ctx.stroke();
      const tx=x+o*2,ty=y-22,dead=hsh(i,j,30)<0.3;for(let k=0;k<7;k++){const a=k*0.9+0.2,dx=Math.cos(a)*9,dy=Math.sin(a)*3.5+2+(dead?2:0);
        poly([[tx,ty],[tx+dx,ty+dy],[tx+dx*0.55,ty+dy-1.6]],dead?(k%2?'#9a8a52':'#8a7a46'):(k%2?'#5f8a3a':'#4d7a30'));}},
    landmark(x,y,i,j,T){box(x,y,17,8.5,20,'#d1bd96','#e8d8b6','#ddcca8');
      for(let k=0;k<6;k++){const u=k/6;if(k!==3)box(x-17+u*17+1.4,y+u*8.5-20,1.2,0.6,2,'#c4ae86','#d9c8a2','#e0d1b0');box(x+u*17+1.4,y+8.5-u*8.5-20,1.2,0.6,2,'#c4ae86','#d9c8a2','#e0d1b0');}
      box(x-15,y-1,3,1.5,28,'#cbb68e','#e2d2b0','#d7c6a2');box(x+15,y-1,3,1.5,22,'#cbb68e','#e2d2b0');poly([[x+12,y-23],[x+15,y-26],[x+18,y-21],[x+15,y-20]],'#bfa982');
      dome(x-15,y-29,3.2,'#3f8f8a','#2f6e6a','#c9a25a');box(x,y-20,7,3.5,4,'#cbb68e','#e2d2b0','#d7c6a2');dome(x,y-24,7.5,'#3f8f8a','#2f6e6a','#c9a25a');
      poly([[x+2,y-28],[x+5.5,y-25],[x+3.5,y-24]],'#2a2420');
      arch(qR(x,y,17,8.5),0.35,0.3,13,'#4a3528');arch(qL(x,y,17,8.5),0.4,0.2,9,'#4a3528');damage(x,y,17,8.5,20,i,j,T);},
    plazaProp(x,y){el(x,y+1,10,5,'#c8b48c');el(x,y+1,7.5,3.6,'#7a8f86');box(x,y,2,1,6,'#cbb68e','#e2d2b0','#d7c6a2');},
    tree:'palm'}};
/* ---------- ياباني ---------- */
THEMES.japan={name:'مدينة يابانية',ground:'#9aa585',road:'#b2aa9a',road2:'#a39b8b',plaza:'#c6bdab',debris:'#8f8778',wallL:'#d8d0bf',wallR:'#e6dfcf',
  pool:[['house',28],['two',16],['shop',12],['cherry',14],['lantern',6],['ruin',14],['.',8]],
  draw:{
    house(x,y,i,j,T){box(x,y,13,6.5,11,'#e6dfcf','#f3eee2');const qa=qL(x,y,13,6.5),qb=qR(x,y,13,6.5);
      [0,0.5,1].forEach(u=>{const a=qa(u,0),b=qa(u,11),c=qb(u,0),e=qb(u,11);ln(a[0],a[1],b[0],b[1],'#4a3a2e',0.8);ln(c[0],c[1],e[0],e[1],'#4a3a2e',0.8);});
      wR(x,y,13,6.5,0.1,1,0.35,7,'#f8f3e6');for(let k=1;k<3;k++)wR(x,y,13,6.5,0.1+k*0.117,1,0.01,7,'#8a7a66');wL(x,y,13,6.5,0.15,4,0.3,4.5,'#f8f3e6');
      damage(x,y,13,6.5,11,i,j,T);
      ridgeRoof(x,y,13,6.5,11,8,{front:'#3d4450',front2:'#4a525e',end:'#4f5866',end2:'#5a6370',back:'#2a2e36',ov:3,sag:1.2,flare:1.8,tile:'rgba(0,0,0,0.22)',ridge:'#2a2e36',ridgeW:1.4});},
    two(x,y,i,j,T){box(x,y,14,7,9,'#e3dccb','#f1ebdf');wR(x,y,14,7,0.12,1,0.5,6,'#f8f3e6');
      ridgeRoof(x,y,14,7,9,2.5,{front:'#3d4450',end:'#4f5866',back:'#2a2e36',ov:2.6,flare:1.4,k:0.85});
      box(x,y-11,10,5,8,'#e6dfcf','#f3eee2');wR(x,y-11,10,5,0.2,1.5,0.5,4.5,'#f8f3e6');damage(x,y-11,10,5,8,i,j,T);
      ridgeRoof(x,y-11,10,5,8,7,{front:'#3d4450',front2:'#4a525e',end:'#4f5866',end2:'#5a6370',back:'#2a2e36',ov:2.6,sag:1,flare:1.8,tile:'rgba(0,0,0,0.22)',ridgeW:1.4});},
    shop(x,y,i,j,T){box(x,y,13,6.5,10,'#d9cdb4','#ebe1cb');wR(x,y,13,6.5,0.15,5,0.6,5,'#2f4a6e');for(let k=1;k<4;k++)wR(x,y,13,6.5,0.15+k*0.15,5,0.01,5,'#e8e2d4');
      damage(x,y,13,6.5,10,i,j,T);ridgeRoof(x,y,13,6.5,10,7,{front:'#3d4450',front2:'#4a525e',end:'#4f5866',end2:'#5a6370',back:'#2a2e36',ov:3,sag:1.2,flare:1.8,tile:'rgba(0,0,0,0.22)',ridgeW:1.4});
      ln(x+11,y-6,x+11,y-1,'#3a2e26',0.6);el(x+11,y+0.6,1.8,2.3,'#c8402e');},
    cherry(x,y,i,j){const o=((i+j)%2)*3-1.5;rc(x-1+o,y-9,2,9,'#5b4636');circ(x+o,y-14,7.5,'#e89ab0');circ(x-3.5+o,y-16,5.5,'#f2b8c6');circ(x+3.5+o,y-12,4.5,'#f5c9d3');
      for(let k=0;k<4;k++)circ(x-6+hsh(i,j,40+k)*14,y+1+hsh(i,j,50+k)*3,0.8,'#f2b8c6');},
    lantern(x,y){box(x,y+2,2.2,1.1,1.6,'#9c978e','#b2ada3','#c2bdb3');rc(x-0.6,y-6,1.2,7,'#a8a398');box(x,y-6,2.4,1.2,3,'#8f8a82','#a8a398');
      poly([[x-3.4,y-9],[x,y-11.2],[x+3.4,y-9],[x,y-7.8]],'#7f7a72');rc(x-0.9,y-8.6,1.8,1.6,'#f2d58a');},
    landmark(x,y,i,j,T){poly([[x-18,y],[x,y+9],[x,y-3],[x-15,y-10]],'#8f8b84');poly([[x,y+9],[x+18,y],[x+15,y-10],[x,y-3]],'#a6a29a');poly([[x-15,y-10],[x,y-17.5],[x+15,y-10],[x,y-3]],'#b5b1a8');
      for(let k=0;k<5;k++)ln(x-18+k*0.6,y-k*2.4,x-k*0.1,y+9-k*2.4,'rgba(0,0,0,0.12)',0.5);
      const R={front:'#3d4450',front2:'#4a525e',end:'#4f5866',end2:'#5a6370',back:'#2a2e36',sag:1,tile:'rgba(0,0,0,0.2)',ridgeW:1.4};
      box(x,y-10,12,6,9,'#efeae0','#faf6ee');damage(x,y-10,12,6,9,i,j,T);ridgeRoof(x,y-10,12,6,9,4,Object.assign({ov:3.4,flare:2,k:0.7},R));
      box(x,y-23,9,4.5,8,'#efeae0','#faf6ee');ridgeRoof(x,y-23,9,4.5,8,4,Object.assign({ov:3,flare:2,k:0.7},R));
      box(x,y-35,6,3,7,'#efeae0','#faf6ee');ridgeRoof(x,y-35,6,3,7,6,Object.assign({ov:2.6,flare:2.2},R));},
    plazaProp(x,y){el(x,y+1,9,4.5,'#9a9a8c');el(x,y+1,6.5,3.2,'#6f8f9c');circ(x-2,y+1,1,'#e86a3a');},
    tree:'cherry'}};
/* ---------- صيني (أُعيد تصميمه: أسقف بسنام طويل مقعّر وأطراف مرفوعة، أعمدة حمراء، جدران بيضاء بأغطية رمادية، بوابات تذكارية) ---------- */
THEMES.china={name:'مدينة صينية',ground:'#a39c88',road:'#958e84',road2:'#88827a',plaza:'#b8af9e',debris:'#8a847a',wallL:'#9c968e',wallR:'#b3ada5',
  pool:[['hall',24],['hutong',20],['tower2',12],['willow',12],['lanterns',8],['ruin',14],['.',10]],
  draw:{
    hall(x,y,i,j,T){box(x,y+1,15,7.5,2,'#a49e94','#bdb6ab','#cbc4b8');
      box(x,y,13,6.5,10,'#8e2a26','#a8332d');const qa=qL(x,y,13,6.5),qb=qR(x,y,13,6.5);
      [0.08,0.36,0.64,0.92].forEach(u=>{const a=qa(u,0),b=qa(u,10),c=qb(u,0),e=qb(u,10);ln(a[0],a[1],b[0],b[1],'#c23a32',1.3);ln(c[0],c[1],e[0],e[1],'#c23a32',1.3);});
      wR(x,y,13,6.5,0.2,8,0.6,1.6,'#2f6e6a');wL(x,y,13,6.5,0.2,8,0.6,1.6,'#2f6e6a');wR(x,y,13,6.5,0.4,0,0.2,7,'#5a1a18');
      damage(x,y,13,6.5,10,i,j,T);
      ridgeRoof(x,y,13,6.5,10,8,{front:'#4a5260',front2:'#5a6372',end:'#5a6372',end2:'#6a7382',back:'#2e333c',ov:4,sag:1.8,flare:2.6,k:0.62,tile:'rgba(0,0,0,0.25)',ridge:'#2e333c',ridgeW:1.8});},
    hutong(x,y,i,j,T){box(x,y,14,7,9,'#d9d4ca','#ebe6dc');wR(x,y,14,7,0,7.4,1,1.6,'#5a6372');wL(x,y,14,7,0,7.4,1,1.6,'#4a5260');
      arch(qR(x,y,14,7),0.36,0.3,8,'#3a342e');const c=qR(x,y,14,7)(0.51,5.6);circ(c[0],c[1],0.7,'#d9a63a');
      wL(x,y,14,7,0.3,3,0.3,3.2,'#a3282a');damage(x,y,14,7,9,i,j,T);
      box(x-2,y-9,8,4,6,'#c8c2b8','#dad4ca');ridgeRoof(x-2,y-9,8,4,6,5,{front:'#4a5260',front2:'#5a6372',end:'#5a6372',back:'#2e333c',ov:2.6,sag:1,flare:1.8,tile:'rgba(0,0,0,0.22)',ridgeW:1.4});},
    tower2(x,y,i,j,T){box(x,y,11,5.5,10,'#8e2a26','#a8332d');wR(x,y,11,5.5,0.3,2,0.4,6,'#3a1a16');damage(x,y,11,5.5,10,i,j,T);
      ridgeRoof(x,y,11,5.5,10,3,{front:'#c9962e',end:'#d9a63a',back:'#7a5a1a',ov:3.4,flare:2.2,k:0.85,tile:'rgba(90,60,10,0.35)'});
      box(x,y-13,8,4,8,'#8e2a26','#a8332d');
      ridgeRoof(x,y-13,8,4,8,6,{front:'#c9962e',front2:'#d9a63a',end:'#d9a63a',end2:'#e8bb4f',back:'#7a5a1a',ov:3,sag:1.2,flare:2.6,k:0.6,tile:'rgba(90,60,10,0.35)',ridge:'#7a5a1a',ridgeW:1.6});},
    willow(x,y,i,j){rc(x-1,y-11,2,11,'#5b4636');circ(x,y-15,6.5,'#7e9a4a');
      for(let k=0;k<7;k++){const ox=-6+k*2;ctx.beginPath();ctx.moveTo(x+ox,y-17);ctx.quadraticCurveTo(x+ox+1,y-9,x+ox-0.5,y-4);ctx.strokeStyle=k%2?'#8fae58':'#6f8c3e';ctx.lineWidth=1;ctx.stroke();}},
    lanterns(x,y){ln(x-10,y+3,x-10,y-14,'#5a3a2a',1);ln(x+10,y-1,x+10,y-18,'#5a3a2a',1);
      ctx.beginPath();ctx.moveTo(x-10,y-13);ctx.quadraticCurveTo(x,y-10,x+10,y-17);ctx.strokeStyle='#4a3a32';ctx.lineWidth=0.5;ctx.stroke();
      [[-5.5,-12.6],[0,-12.6],[5.5,-14.6]].forEach(([dx,dy])=>{el(x+dx,y+dy+1.5,1.9,2.3,'#d33a2c');rc(x+dx-0.9,y+dy-0.8,1.8,0.6,'#d9a63a');});},
    landmark(x,y,i,j,T){ // برج الطبل: قاعدة طوب بممر مقوّس وجناح أحمر بسقفين مقعّرين ذهبيين
      box(x,y,18,9,14,'#7a756e','#928c85','#a09a93');for(let k=0;k<4;k++)ln(x,y+9-k*3.2,x+18,y-k*3.2,'rgba(0,0,0,0.14)',0.5);
      arch(qR(x,y,18,9),0.34,0.32,11,'#26221e');damage(x,y,18,9,14,i,j,T);
      const G={front:'#c9962e',front2:'#d9a63a',end:'#d9a63a',end2:'#e8bb4f',back:'#7a5a1a',sag:1.6,tile:'rgba(90,60,10,0.35)',ridge:'#7a5a1a',ridgeW:1.8};
      box(x,y-14,13,6.5,7,'#8e2a26','#a8332d');[0.1,0.5,0.9].forEach(u=>{const c=qR(x,y-14,13,6.5)(u,0),e=qR(x,y-14,13,6.5)(u,7);ln(c[0],c[1],e[0],e[1],'#c23a32',1.3);});
      ridgeRoof(x,y-14,13,6.5,7,3,Object.assign({ov:4,flare:2.4,k:0.8},G));
      box(x,y-24,10,5,6,'#8e2a26','#a8332d');ridgeRoof(x,y-24,10,5,6,8,Object.assign({ov:3.6,flare:3,k:0.55},G));},
    plazaProp(x,y){ln(x-8,y+4,x-8,y-12,'#a3282a',1.6);ln(x+8,y-4,x+8,y-20,'#a3282a',1.6);
      poly([[x-11,y-11],[x+11,y-22],[x+11,y-19.4],[x-11,y-8.4]],'#4a5260');poly([[x-12.5,y-11.6],[x-11,y-11],[x-11,y-13.2]],'#4a5260');poly([[x+12.5,y-22.6],[x+11,y-22],[x+11,y-24.2]],'#4a5260');
      poly([[x-8,y-8],[x+8,y-16],[x+8,y-14.6],[x-8,y-6.6]],'#2f6e6a');},
    tree:'willow'}};
/* ---------- أدوات إضافية للواجهات ---------- */
function snowCap(r,amt,col){const lp=(A,B,t)=>[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t];
  poly([lp(r.L,r.P1,amt),lp(r.F,r.P2,amt),r.P2,r.P1],col||'#eef3f6');}
/* واجهة مدرّجة (هولندية/بلجيكية) فوق الجدار الأيمن */
function stepGable(x,y,w,d,h,t,col,trim){const q=qR(x,y,w,d),s=[0.2*t,0.44*t,0.68*t,0.88*t];
  const P=[[0,0],[0,s[0]],[0.12,s[0]],[0.12,s[1]],[0.24,s[1]],[0.24,s[2]],[0.36,s[2]],[0.36,s[3]],[0.43,s[3]],[0.43,t],[0.57,t],[0.57,s[3]],[0.64,s[3]],[0.64,s[2]],[0.76,s[2]],[0.76,s[1]],[0.88,s[1]],[0.88,s[0]],[1,s[0]],[1,0]];
  poly(P.map(([u,v])=>q(u,h+v)),col);for(let k=1;k<P.length-1;k+=2){const A=q(P[k][0],h+P[k][1]),B=q(P[k+1][0],h+P[k+1][1]);ln(A[0],A[1],B[0],B[1],trim,0.9);}}
/* واجهة جرسية منحنية */
function bellGable(x,y,w,d,h,t,col,trim){const q=qR(x,y,w,d),pts=[q(0,h)];
  for(let k=0;k<=16;k++){const u=k/16,v=t*(u<0.18?u/0.18*0.35:u>0.82?(1-u)/0.18*0.35:0.35+0.65*Math.pow(Math.sin(Math.PI*(u-0.18)/0.64),0.7));pts.push(q(u,h+v));}
  pts.push(q(1,h));poly(pts,col);for(let k=1;k<pts.length-2;k++)ln(pts[k][0],pts[k][1],pts[k+1][0],pts[k+1][1],trim,0.8);
  const tp=q(0.5,h+t);circ(tp[0],tp[1]-1.2,1,trim);}

/* ---------- أوروبي v3: صفوف متلاصقة كأحياء أمستردام وبروج القديمة ---------- */
const EU2=['#e0bd62','#d27a60','#7ea7c8','#e6a8ad','#9dbd87','#efe2c6','#c3a9d2','#e39a54'];
THEMES.europe={name:'مدينة أوروبية',ground:'#8d9277',road:'#7a766f',road2:'#6f6b65',plaza:'#a19b8e',debris:'#8a8378',wallL:'#a9967a',wallR:'#bfad90',cobble:true,
  pool:[['row',40],['rowStep',20],['rowBell',12],['fach',10],['ruin',10],['.',3]],
  draw:{
    row(x,y,i,j,T,kind){const c=EU2[Math.floor(hsh(i,j,60)*EU2.length)],L=mixc(c,'#000000',0.2),fl=3+Math.floor(hsh(i,j,61)*2),h=8+fl*7.2,w=17,d=8.5;
      box(x,y,w,d,h,L,c);const shop=hsh(i,j,63)<0.55,qb=qR(x,y,w,d);
      if(shop){wR(x,y,w,d,0.08,0.6,0.84,6.4,'#2c3a44');for(let k=1;k<4;k++){const A=qb(0.08+k*0.21,0.6),B=qb(0.08+k*0.21,7);ln(A[0],A[1],B[0],B[1],'#d9d2c2',0.6);}
        const a0=qb(0.06,8.6),a1=qb(0.94,8.6),sc=hsh(i,j,64)<0.5?['#2f6e4e','#efe6d2']:['#a3342c','#efe6d2'];
        for(let k=0;k<8;k++){const u0=0.06+k*0.11,u1=u0+0.11,A=qb(u0,8.6),B=qb(u1,8.6);poly([A,B,[B[0]+2,B[1]+3.2],[A[0]+2,A[1]+3.2]],sc[k%2]);}}
      else{arch(qb,0.42,0.16,7.5,'#4a3326');wR(x,y,w,d,0.12,2.5,0.16,4.4,'#f2ede2');wR(x,y,w,d,0.14,2.9,0.12,3.6,'#3a5466');wR(x,y,w,d,0.72,2.5,0.16,4.4,'#f2ede2');wR(x,y,w,d,0.74,2.9,0.12,3.6,'#3a5466');}
      for(let f=0;f<fl;f++){const v=10+f*7.2;for(let k=0;k<3;k++){wR(x,y,w,d,0.12+k*0.3,v,0.17,4.8,'#f4efe4');wR(x,y,w,d,0.14+k*0.3,v+0.5,0.13,3.9,hsh(i,j,70+f*3+k)<0.12?'#e8c56a':'#34505f');}
        const A=qb(0,v-1),B=qb(1,v-1);ln(A[0],A[1],B[0],B[1],'rgba(255,255,255,0.35)',0.6);
        for(let k=0;k<2;k++)wL(x,y,w,d,0.2+k*0.45,v,0.16,4.6,'#2e4552');}
      const A=qb(0,h),B=qb(1,h);ln(A[0],A[1],B[0],B[1],'#f4efe4',1.1);damage(x,y,w,d,h,i,j,T);
      const rf=hsh(i,j,65)<0.6?['#8a3e2e','#5a2a22']:['#4f5a64','#2e353c'];
      ridgeRoof(x,y,w,d,h,13,{front:rf[0],back:rf[1],gable:true,wallEnd:c,eave:'#f4efe4',tile:'rgba(0,0,0,0.2)'});
      if(kind==='step')stepGable(x,y,w,d,h,16,c,'#f4efe4');else if(kind==='bell')bellGable(x,y,w,d,h,15,c,'#f4efe4');
      wR(x,y,w,d,0.44,h+3.4,0.12,4,'#f4efe4');wR(x,y,w,d,0.455,h+3.9,0.09,3,'#34505f');
      if(hsh(i,j,66)<0.55){const p=qL(x,y,w,d)(0.55,h);box(p[0]+2,p[1]-4,1.6,0.8,7,'#7a4a3a','#8e5a48','#5a3a2e');}},
    rowStep(x,y,i,j,T){THEMES.europe.draw.row(x,y,i,j,T,'step');},
    rowBell(x,y,i,j,T){THEMES.europe.draw.row(x,y,i,j,T,'bell');},
    fach(x,y,i,j,T){const w=16,d=8,h=11,c='#efe6d2';box(x,y,w,d,h,'#ddd2bb',c);box(x,y-h,w+1,d+0.5,10,'#e4d9c2',c);const B='#4a3020';
      const frame=(X,Y,W,D,hh)=>{const qa=qL(X,Y,W,D),qb=qR(X,Y,W,D);
        [0,0.25,0.5,0.75,1].forEach(u=>{let a=qa(u,0),b=qa(u,hh);ln(a[0],a[1],b[0],b[1],B,0.9);a=qb(u,0);b=qb(u,hh);ln(a[0],a[1],b[0],b[1],B,0.9);});
        let a=qa(0,hh*0.5),b=qa(1,hh*0.5);ln(a[0],a[1],b[0],b[1],B,0.8);a=qb(0,hh*0.5);b=qb(1,hh*0.5);ln(a[0],a[1],b[0],b[1],B,0.8);
        [[0,0.25],[0.75,1]].forEach(([u1,u2])=>{let p=qb(u1,0),q2=qb(u2,hh*0.5);ln(p[0],p[1],q2[0],q2[1],B,0.6);p=qb(u2,0);q2=qb(u1,hh*0.5);ln(p[0],p[1],q2[0],q2[1],B,0.6);});};
      frame(x,y,w,d,h);frame(x,y-h,w+1,d+0.5,10);
      wR(x,y-h,w+1,d+0.5,0.3,3,0.14,4,'#3a5466');wR(x,y-h,w+1,d+0.5,0.56,3,0.14,4,'#3a5466');wL(x,y-h,w+1,d+0.5,0.4,3,0.16,4,'#2e4552');
      arch(qR(x,y,w,d),0.42,0.16,8,'#4a3326');damage(x,y,w,d,h,i,j,T);
      ridgeRoof(x,y-h,w+1,d+0.5,10,14,{front:'#9a4434',back:'#5a2a22',gable:true,wallEnd:c,eave:B,tile:'rgba(0,0,0,0.2)'});
      box(x+4,y-h-10-5,1.6,0.8,9,'#7a4a3a','#8e5a48','#5a3a2e');},
    tree(x,y,i,j){const o=((i+j)%2)*2-1;rc(x-1+o,y-8,2,8,'#5b4636');circ(x+o,y-14,7,'#5f8a44');circ(x-3+o,y-16,5,'#6f9a52');circ(x+3+o,y-12,4,'#527a3a');},
    landmark(x,y,i,j,T){ // دار بلدية قوطية: أروقة مقوّسة، نوافذ مدببة، واجهة مدرّجة، برج ساعة بقمة مدببة وأبراج زاوية
      const w=17,d=8.5,h=24,q=qR(x,y+1,w,d);box(x,y+1,w,d,h,'#ab9c82','#c6b89c');
      for(let k=0;k<4;k++)arch(q,0.06+k*0.235,0.17,8,'#3a3028');
      for(let k=0;k<4;k++){const u=0.07+k*0.235;poly([q(u,11),q(u+0.15,11),q(u+0.15,18),q(u+0.075,21),q(u,18)],'#34505f');}
      const A=q(0,10),B=q(1,10);ln(A[0],A[1],B[0],B[1],'#e8e0cc',1);damage(x,y+1,w,d,h,i,j,T);
      ridgeRoof(x,y+1,w,d,h,14,{front:'#4f5a64',back:'#2e353c',gable:true,wallEnd:'#c6b89c',tile:'rgba(0,0,0,0.2)'});stepGable(x,y+1,w,d,h,17,'#c6b89c','#e8e0cc');
      box(x-8,y-5,4.5,2.25,50,'#a8997f','#c1b398');for(let k=0;k<4;k++)wR(x-8,y-5,4.5,2.25,0.3,14+k*8,0.4,4,'#2e3a42');
      hipRoof(x-8,y-5,4.5,2.25,50,20,'#4f5a64','#5f6a74');
      [[-12.5,-55],[-3.5,-55],[-8,-52.7]].forEach(([dx,dy])=>{ln(x+dx,y+dy,x+dx,y+dy-7,'#4f5a64',1.2);circ(x+dx,y+dy-7,0.7,'#d9b44a');});
      const ck=qR(x-8,y-5,4.5,2.25)(0.5,42);el(ck[0],ck[1],2.3,2.6,'#f4efe2');ln(ck[0],ck[1],ck[0],ck[1]-1.8,'#2b2825',0.6);ln(ck[0],ck[1],ck[0]+1.2,ck[1]+0.3,'#2b2825',0.6);
      flag(x-8,y-75,'#c4604a');},
    plazaProp(x,y){el(x,y+1,10,5,'#8f8a80');el(x,y+1,7.5,3.6,'#6f8f9c');box(x,y,1.6,0.8,8,'#b5ad9f','#c9c2b6','#d5cec2');el(x,y-8.5,3.4,1.4,'#b5ad9f');circ(x,y-10,1,'#b5ad9f');},
    roadProp(x,y,i,j){if((i*7+j*5)%7===0){ln(x+10,y+2,x+10,y-15,'#2b2825',1);poly([[x+8.4,y-15],[x+10,y-18.5],[x+11.6,y-15],[x+10,y-14]],'#2b2825');rc(x+9,y-16.6,2,1.8,'#f2d58a');}},
    tile(x,y){for(let r=-2;r<=2;r++)ln(x-14+Math.abs(r)*3.5,y+r*1.8,x+14-Math.abs(r)*3.5,y+r*1.8,'rgba(0,0,0,0.09)',0.5);}}};

/* ---------- نرويجي v2: قرية صيد على مضيق ثلجي، أكواخ على الماء، قوارب، قاعة فايكنغ ---------- */
const NO2=['#9c2f2a','#9c2f2a','#b8382f','#d9a43a','#ece8de','#2f4a5e'];
THEMES.norway={name:'قرية صيد نرويجية',ground:'#66745d',road:'#8b9095',road2:'#80858a',plaza:'#c2c8cc',debris:'#7a7e82',wallL:'#7a2420',wallR:'#922d28',car:['#3e4a56','#4e5a66','#2e3640'],
  waterCol:'#34566e',isWater:(i,j)=>i===10,
  groundAt(i,j,base){return hsh(i,j,300)<0.5?'#dfe6eb':base;},
  hook(M){for(let j=0;j<11;j++){if(M[j][9]!=='='&&M[j][9]!=='flagTile'&&hsh(9,j,301)<0.55)M[j][9]='rorbu';}},
  pool:[['wood',26],['turf',14],['long',12],['pine',22],['rack',6],['ruin',10],['.',8]],
  draw:{
    wood(x,y,i,j,T){const c=NO2[Math.floor(hsh(i,j,80)*NO2.length)],L=mixc(c,'#000000',0.24),h=12+Math.floor(hsh(i,j,81)*2)*5,w=13,d=6.5;box(x,y,w,d,h,L,c);
      const qb=qR(x,y,w,d),qa=qL(x,y,w,d);for(let k=1;k<8;k++){let a=qb(k/8,0),b=qb(k/8,h);ln(a[0],a[1],b[0],b[1],'rgba(0,0,0,0.14)',0.4);a=qa(k/8,0);b=qa(k/8,h);ln(a[0],a[1],b[0],b[1],'rgba(0,0,0,0.14)',0.4);}
      [qb(0,0),qb(1,0)].forEach((p,n)=>{const t=qb(n,h);ln(p[0],p[1],t[0],t[1],'#f4f0e6',1.2);});
      [0.22,0.6].forEach(u=>{wR(x,y,w,d,u,h*0.42,0.2,4.4,'#f4f0e6');wR(x,y,w,d,u+0.025,h*0.42+0.6,0.15,3.2,hsh(i,j,u*100)<0.25?'#f2d58a':'#33495a');});
      wL(x,y,w,d,0.42,0,0.16,6.4,'#f4f0e6');wL(x,y,w,d,0.44,0,0.12,6,'#4a3326');damage(x,y,w,d,h,i,j,T);
      const r=ridgeRoof(x,y,w,d,h,11,{front:'#34393e',back:'#202428',gable:true,wallEnd:c,eave:'#f4f0e6',tile:'rgba(0,0,0,0.25)'});snowCap(r,0.25+hsh(i,j,82)*0.4);
      const ch=qL(x,y,w,d)(0.62,h);box(ch[0]+2,ch[1]-4,1.5,0.75,7,'#5a5a5a','#6e6e6e','#e8eef0');if(hsh(i,j,83)<0.6)for(let k=0;k<3;k++)circ(ch[0]+2+k*1.4,ch[1]-13-k*3,1.3+k*0.5,'#cfd5d9',0.45);},
    turf(x,y,i,j,T){const c='#6e4429',w=13,d=6.5;box(x,y,w,d,10,'#54331f',c);for(let k=0;k<4;k++){const a=qR(x,y,w,d)(0,1.6+k*2.4),b=qR(x,y,w,d)(1,1.6+k*2.4);ln(a[0],a[1],b[0],b[1],'rgba(0,0,0,0.28)',0.7);}
      wR(x,y,w,d,0.4,0,0.2,6.2,'#3a2418');damage(x,y,w,d,10,i,j,T);
      const r=ridgeRoof(x,y,w,d,10,9,{front:'#6a8a46',back:'#47652f',gable:true,wallEnd:c,eave:'#8a6a45'});
      for(let k=0;k<10;k++){const t=hsh(i,j,90+k),u=hsh(i,j,100+k)*0.9,p=[r.L[0]+(r.F[0]-r.L[0])*t+(r.P1[0]-r.L[0])*u,r.L[1]+(r.F[1]-r.L[1])*t+(r.P1[1]-r.L[1])*u];
        poly([[p[0]-0.9,p[1]],[p[0],p[1]-2.2],[p[0]+0.9,p[1]]],k%2?'#88a85a':'#5a7a3a');}
      snowCap(r,0.55);},
    long(x,y,i,j,T){const c=hsh(i,j,84)<0.5?'#ece8de':'#d9a43a',L=mixc(c,'#000000',0.22),w=16,d=8,h=20;box(x,y,w,d,h,L,c);
      const qb=qR(x,y,w,d);for(let k=1;k<10;k++){const a=qb(k/10,0),b=qb(k/10,h);ln(a[0],a[1],b[0],b[1],'rgba(0,0,0,0.12)',0.4);}
      for(let f=0;f<2;f++)for(let k=0;k<3;k++){wR(x,y,w,d,0.12+k*0.3,3+f*9,0.16,4.4,'#f4f0e6');wR(x,y,w,d,0.135+k*0.3,3.6+f*9,0.13,3.2,'#33495a');}
      damage(x,y,w,d,h,i,j,T);const r=ridgeRoof(x,y,w,d,h,12,{front:'#34393e',back:'#202428',gable:true,wallEnd:c,eave:'#f4f0e6',tile:'rgba(0,0,0,0.25)'});snowCap(r,0.4);},
    rorbu(x,y,i,j,T){const c='#a3302a',w=11,d=5.5;for(let k=0;k<4;k++){const p=[[x-w,y],[x,y+d],[x+w,y],[x,y-d]][k];ln(p[0],p[1]+5,p[0],p[1],'#4a3a2e',1);}
      box(x,y,w,d,9,'#7a2420',c);for(let k=1;k<7;k++){const a=qR(x,y,w,d)(k/7,0),b=qR(x,y,w,d)(k/7,9);ln(a[0],a[1],b[0],b[1],'rgba(0,0,0,0.14)',0.4);}
      wR(x,y,w,d,0.35,0,0.3,6,'#f4f0e6');wR(x,y,w,d,0.38,0,0.24,5.4,'#3a2418');damage(x,y,w,d,9,i,j,T);
      const r=ridgeRoof(x,y,w,d,9,8,{front:'#34393e',back:'#202428',gable:true,wallEnd:c,eave:'#f4f0e6'});snowCap(r,0.5);},
    pine(x,y,i,j){const s=0.85+hsh(i,j,110)*0.35;rc(x-0.8,y-4*s,1.6,4*s,'#4a3626');
      for(let k=0;k<4;k++){const w=(7-k*1.4)*s,yy=y-3*s-k*5*s;poly([[x-w,yy],[x,yy-8*s],[x+w,yy]],k%2?'#28503a':'#336046');poly([[x-w*0.5,yy-4*s],[x,yy-8*s],[x+w*0.4,yy-4.5*s]],'#e8eef2');}},
    rack(x,y){[[-8,2],[0,-2],[8,-6]].forEach(([dx,dy])=>{ln(x+dx-2,y+dy+4,x+dx,y+dy-10,'#7a5a3a',0.9);ln(x+dx+2,y+dy+4,x+dx,y+dy-10,'#7a5a3a',0.9);});
      ln(x-8,y-8,x+8,y-16,'#7a5a3a',0.9);for(let k=0;k<7;k++){const t=k/6,px=x-8+16*t,py=y-8-8*t;el(px,py+2.2,0.7,2.2,'#a8a296');}},
    water(x,y,i,j){const r=hsh(i,j,320);for(let k=0;k<3;k++)ln(x-8+k*5,y-2+k*1.5,x-3+k*5,y-0.5+k*1.5,'rgba(255,255,255,0.18)',0.6);
      if(r<0.3){poly([[x-8,y+1],[x+2,y-4],[x+6,y-2],[x-4,y+3]],'#6a5040');for(let k=0;k<4;k++)ln(x-7+k*3.2,y+0.6-k*1.5,x-3.6+k*3.2,y+2.4-k*1.5,'#4a3828',0.4);}
      else if(r<0.55){poly([[x-6,y],[x+5,y-4],[x+7,y-3],[x+6,y-1.6],[x-4,y+2.2]],'#e8e2d6');poly([[x-4,y+2.2],[x+6,y-1.6],[x+5.4,y-0.6],[x-3.6,y+3]],'#8a3a2a');
        ln(x+1,y-2,x+1,y-12,'#4a3a2e',0.7);poly([[x+1.3,y-11.5],[x+5,y-5],[x+1.3,y-4.4]],'#efe8da');}
      else if(r<0.7){poly([[x-4,y+1],[x,y-1.4],[x+4.5,y],[x+1,y+2]],'#e8eef2');}},
    landmark(x,y,i,j,T){ // قاعة فايكنغ: بيت طويل منخفض بسقف عشبي ثلجي وعوارض متقاطعة برؤوس تنانين ودخان
      const w=18,d=6,h=7,c='#4e3826';box(x,y,w,d,h,'#3e2c1e',c);const qb=qR(x,y,w,d),qa=qL(x,y,w,d);
      for(let k=1;k<12;k++){const a=qa(k/12,0),b=qa(k/12,h);ln(a[0],a[1],b[0],b[1],'rgba(0,0,0,0.25)',0.5);}
      for(let k=1;k<6;k++){const a=qb(k/6,0),b=qb(k/6,h);ln(a[0],a[1],b[0],b[1],'rgba(0,0,0,0.25)',0.5);}damage(x,y,w,d,h,i,j,T);
      const r=ridgeRoof(x,y,w,d,h,14,{front:'#5f7f3e',back:'#3f5a2a',gable:true,wallEnd:c,eave:'#8a6a45'});snowCap(r,0.45);
      arch(qb,0.38,0.24,7+6,'#22180f');const ap=r.P2;
      ln(ap[0]-5,ap[1]+6,ap[0]+3,ap[1]-5,'#3a2a1c',1.4);ln(ap[0]+5,ap[1]+2,ap[0]-3,ap[1]-5,'#3a2a1c',1.4);
      poly([[ap[0]+3,ap[1]-5],[ap[0]+5.6,ap[1]-6.4],[ap[0]+4.2,ap[1]-4.4]],'#3a2a1c');poly([[ap[0]-3,ap[1]-5],[ap[0]-5.6,ap[1]-6.4],[ap[0]-4.2,ap[1]-4.4]],'#3a2a1c');
      for(let k=0;k<4;k++)circ(x-2+k*1.6,y-h-16-k*4,1.6+k*0.6,'#c9cfd3',0.45-k*0.08);},
    plazaProp(x,y){[[-4,1,4],[3,3,3],[5,-1,2.4]].forEach(([dx,dy,r])=>el(x+dx,y+dy,r*1.4,r*0.8,'#8a8e92'));glow(x,y-4,12,'rgba(255,150,60,0.4)');poly([[x-2,y],[x,y-6],[x+2,y]],'#e8893a');},
    tree:'pine'}};

/* ---------- هونغ كونغ النيون (اختياري): أبراج سكنية مكتظة، مكيفات وغسيل، لافتات نيون، أسواق ليلية، حي مسوّر ---------- */
const HKC=['#8a9a8e','#a39484','#9aa3ad','#b09a8a','#8e8a9e','#a0a890'];
const NEON=['#ff4fa3','#3fe0ff','#ffd23f','#7cff6b','#ff7a3f','#b07cff'];
function neonSign(px,py,w,h,col){glow(px+w/2,py+h/2,Math.max(w,h)*1.4,col.replace(')',',0.35)').replace('rgb','rgba'));poly([[px,py],[px+w,py],[px+w,py+h],[px,py+h]],col);
  poly([[px+0.6,py+0.6],[px+w-0.6,py+0.6],[px+w-0.6,py+h-0.6],[px+0.6,py+h-0.6]],'#fff7fb');poly([[px+1,py+1],[px+w-1,py+1],[px+w-1,py+h-1],[px+1,py+h-1]],col);}
const hexRgb=h=>'rgb('+[1,3,5].map(i=>parseInt(h.substr(i,2),16)).join(',')+')';
function hkWindows(x,y,w,d,h,i,j,n0){for(let r=0;r<Math.floor((h-3)/4);r++)for(let k=0;k<4;k++){const v=hsh(i,j,n0+r*4+k);
  wR(x,y,w,d,0.08+k*0.23,3+r*4,0.13,2.4,v<0.12?'#f2d58a':v<0.2?'#bfe6ff':'#2a2b30');wL(x,y,w,d,0.08+k*0.23,3+r*4,0.13,2.4,v>0.9?'#e8c56a':'#24252a');}}
THEMES.hk={name:'هونغ كونغ النيون',ground:'#4f5056',road:'#2f3036',road2:'#34353b',plaza:'#626269',debris:'#5a5a62',wallL:'#5c5f66',wallR:'#70737a',car:['#b8322c','#d0443a','#e8e2d6'],
  pool:[['tower',36],['tower',14],['shop',16],['market',12],['ruin',10],['.',2]],
  draw:{
    tower(x,y,i,j,T){const c=HKC[Math.floor(hsh(i,j,400)*HKC.length)],h=38+Math.floor(hsh(i,j,401)*4)*6,w=14,d=7;box(x,y,w,d,h,mixc(c,'#000000',0.25),c,mixc(c,'#000000',0.1));
      hkWindows(x,y,w,d,h,i,j,410);const qb=qR(x,y,w,d),qa=qL(x,y,w,d);
      for(let k=0;k<7;k++){const u=hsh(i,j,460+k)*0.85,v=4+hsh(i,j,470+k)*(h-8),p=qb(u,v);box(p[0]+1.2,p[1]+0.6,1.4,0.7,1.6,'#9a9ca0','#b8babe','#cfd1d4');}
      for(let k=0;k<3;k++){const v=6+hsh(i,j,480+k)*(h-12),a=qa(0.1,v),b=qa(0.9,v);ln(a[0]-1.5,a[1]+0.8,b[0]-1.5,b[1]+0.8,'#3a3a3e',0.4);
        for(let m=0;m<4;m++){const t=0.15+m*0.2,px=a[0]+(b[0]-a[0])*t-1.5,py=a[1]+(b[1]-a[1])*t+0.8;rc(px-0.6,py,1.2,2,NEON[(k+m)%6]);}}
      if(hsh(i,j,490)<0.75){const col=NEON[Math.floor(hsh(i,j,491)*6)],p=qb(0.92,h*0.25);neonSign(p[0]+0.5,p[1]-h*0.35,3.4,h*0.32,hexRgb(col));}
      damage(x,y,w,d,h,i,j,T);const tp=qa(0.5,h);ln(tp[0]+6,tp[1]-3,tp[0]+6,tp[1]-11,'#2a2a2e',0.7);ln(tp[0]+3,tp[1]-1,tp[0]+3,tp[1]-7,'#2a2a2e',0.6);
      box(tp[0]+9,tp[1]-1,2.6,1.3,3,'#6a6c70','#808286','#909296');},
    shop(x,y,i,j,T){const c=HKC[Math.floor(hsh(i,j,420)*HKC.length)],w=15,d=7.5,h=13;box(x,y,w,d,h,mixc(c,'#000000',0.25),c,mixc(c,'#000000',0.1));
      wR(x,y,w,d,0.1,0,0.8,6.5,'#5a5c62');for(let k=1;k<7;k++){const a=qR(x,y,w,d)(0.1,k*0.9),b=qR(x,y,w,d)(0.9,k*0.9);ln(a[0],a[1],b[0],b[1],'rgba(0,0,0,0.3)',0.4);}
      const col=hexRgb(NEON[Math.floor(hsh(i,j,421)*6)]),a=qR(x,y,w,d)(0.1,8.4),b=qR(x,y,w,d)(0.9,8.4);
      glow((a[0]+b[0])/2,(a[1]+b[1])/2-1.6,14,col.replace(')',',0.32)').replace('rgb','rgba'));poly([[a[0],a[1]],[b[0],b[1]],[b[0],b[1]-3.4],[a[0],a[1]-3.4]],col);
      poly([[a[0]+1,a[1]-0.7],[b[0]-1,b[1]+0.4],[b[0]-1,b[1]-2.6],[a[0]+1,a[1]-2.6+1.2*0]],'#fff7fb');poly([[a[0]+1.6,a[1]-1],[b[0]-1.6,b[1]+0.2],[b[0]-1.6,b[1]-2.2],[a[0]+1.6,a[1]-2.2]],col);
      damage(x,y,w,d,h,i,j,T);},
    market(x,y,i,j){[[-7,1,'#2f5aa8'],[5,4,'#c4402e'],[2,-5,'#e8b23a']].forEach(([dx,dy,cl])=>{const X=x+dx,Y=y+dy;box(X,Y,5,2.5,4,'#5a4a3a','#6e5a48');
      poly([[X-6.5,Y-4],[X,Y-1],[X+6.5,Y-4],[X,Y-7.4]],cl);ln(X-6.5,Y-4,X-6.5,Y+1,'#3a3028',0.6);ln(X+6.5,Y-4,X+6.5,Y+1,'#3a3028',0.6);});
      for(let k=0;k<6;k++){const px=x-10+k*4,py=y-11+k*-0.8+Math.sin(k)*1.2;glow(px,py,4,'rgba(255,210,120,0.45)');circ(px,py,0.8,'#ffe9a8');}},
    banyan(x,y,i,j){rc(x-1.6,y-10,3.2,10,'#4a3a2e');for(let k=0;k<5;k++)ln(x-7+k*3.4,y-12,x-7+k*3.4+(k%2?0.6:-0.6),y-1,'#5a4a3a',0.45);
      circ(x,y-16,9,'#2f5a3a');circ(x-5,y-14,6,'#3a6a44');circ(x+5,y-15,6,'#28503a');},
    landmark(x,y,i,j,T){ // حي مسوّر: كتلة من الأبنية غير المتساوية ملتصقة ومكدسة
      const parts=[[-8,-4,7,3.5,40],[8,-4,7,3.5,34],[0,-8,8,4,46],[-6,3,8,4,28],[7,4,7,3.5,24],[0,6,9,4.5,18]];
      parts.sort((a,b)=>(a[1]+a[0]*0)-(b[1]+b[0]*0)).forEach(([dx,dy,w,d,h],n)=>{const X=x+dx,Y=y+dy,c=HKC[(n+2)%HKC.length];box(X,Y,w,d,h,mixc(c,'#000000',0.28),c,mixc(c,'#000000',0.1));
        hkWindows(X,Y,w,d,h,i+n,j+n,500+n*40);const tp=qL(X,Y,w,d)(0.4,h);ln(tp[0]+3,tp[1]-1,tp[0]+3,tp[1]-8,'#2a2a2e',0.6);damage(X,Y,w,d,h,i+n,j,T);
        if(n%2===0){const p=qR(X,Y,w,d)(0.85,h*0.3);neonSign(p[0]+0.5,p[1]-h*0.3,2.6,h*0.26,hexRgb(NEON[n%6]));}});},
    plazaProp(x,y){el(x,y+1,9,4.5,'#55565c');box(x,y,4,2,6,'#3a3b40','#4a4b50','#5a5b60');neonSign(x-3,y-14,6,3.4,hexRgb('#3fe0ff'));},
    roadProp(x,y,i,j){if(hsh(i,j,430)<0.35){const col=NEON[Math.floor(hsh(i,j,431)*6)],c=hexRgb(col).replace(')',',0.28)').replace('rgb','rgba');el(x+(hsh(i,j,432)-0.5)*10,y+1,6,2.4,c);}},
    tree:'banyan'}};

/* ---------- جايبور الوردية (اختياري): قصور "هافيلي" وردية بشرفات "جاروكا" بقباب صغيرة، أكشاك "شاتري"، أسواق ملونة، أكاليل قطيفة، قصر الرياح ---------- */
const JP=['#d98466','#e3957a','#cf7a5c','#e8a07e'];
function jharokha(p,col,shade){box(p[0]+2.2,p[1]+1.2,2.6,1.3,5,shade,col,mixc(col,'#ffffff',0.1));dome(p[0]+2.2,p[1]-4.4,2.4,mixc(col,'#ffffff',0.15),shade,'#d9b44a');
  const q=qR(p[0]+2.2,p[1]+1.2,2.6,1.3);arch(q,0.2,0.6,4,'#4a2a20');}
function chhatri(x,y,col,shade){[[-3,0],[3,0],[0,1.5],[0,-1.5]].forEach(([dx,dy])=>ln(x+dx,y+dy,x+dx,y+dy-5,shade,0.8));
  el(x,y-5,4,1.8,shade);dome(x,y-5.4,3.4,col,shade,'#d9b44a');}
THEMES.jaipur={name:'جايبور الوردية',ground:'#d3ab84',road:'#c19468',road2:'#b68a60',plaza:'#dfc09a',debris:'#b3866a',wallL:'#c47458',wallR:'#d9886a',car:['#e8c23a','#2f6e4e','#2a2a2a'],
  pool:[['haveli',30],['haveli2',16],['bazaar',12],['neem',12],['ruin',12],['.',6]],
  draw:{
    haveli(x,y,i,j,T,tall){const c=JP[Math.floor(hsh(i,j,600)*JP.length)],L=mixc(c,'#000000',0.18),sh=mixc(c,'#000000',0.3),w=14,d=7,h=tall?26:17;box(x,y,w,d,h,L,c,mixc(c,'#ffffff',0.08));
      const qb=qR(x,y,w,d),qa=qL(x,y,w,d);for(let k=0;k<7;k++){const p=qb(k/6,h);box(p[0],p[1]+0.2,0.9,0.45,1.6,sh,c);}
      [[0,h-2],[0,h-3.2]].forEach(([u,v],n)=>{const A=qb(0,v),B=qb(1,v);ln(A[0],A[1],B[0],B[1],n?'#f6efe6':'rgba(255,255,255,0.5)',0.5);});
      arch(qb,0.12,0.2,8,'#4a2a20');for(let k=0;k<12;k++){const p=qb(0.1+k*0.02,8+Math.sin(k/11*Math.PI)*1.2);circ(p[0],p[1],0.25,'#f6efe6');}
      arch(qa,0.3,0.16,5,'#4a2a20');arch(qa,0.62,0.16,5,'#4a2a20');
      jharokha(qb(0.6,h*0.55),c,sh);if(tall)jharokha(qb(0.25,h*0.6),c,sh);
      damage(x,y,w,d,h,i,j,T);if(hsh(i,j,601)<0.65){const p=qL(x,y,w,d)(0.6,h);chhatri(p[0]+4,p[1]-1,mixc(c,'#ffffff',0.1),sh);}},
    haveli2(x,y,i,j,T){THEMES.jaipur.draw.haveli(x,y,i,j,T,true);},
    bazaar(x,y,i,j){[[-7,1,'#e8892a'],[5,4,'#c23a7a'],[2,-5,'#2aa8a0']].forEach(([dx,dy,cl])=>{const X=x+dx,Y=y+dy;box(X,Y,5,2.5,4,'#8a6a4a','#a07a56');
      poly([[X-6.5,Y-4],[X,Y-1],[X+6.5,Y-4],[X,Y-7.4]],cl);for(let k=0;k<3;k++){const px=X-4+k*3;rc(px,Y-4+k*0.6,1.2,4,['#d9b44a','#c23a7a','#3a7ac2'][k]);}});},
    neem(x,y,i,j){rc(x-1.4,y-10,2.8,10,'#5a4636');circ(x,y-15,8.5,'#4f7a3a');circ(x-5,y-13,5.5,'#5f8a44');circ(x+5,y-14,5,'#45703a');
      if(hsh(i,j,610)<0.5){circ(x-6,y-11,2,'#c23a7a');circ(x+6,y-12,1.6,'#d9468a');}},
    landmark(x,y,i,j,T){ // قصر الرياح: طبقات متدرجة مغطاة بمئات النوافذ البارزة بقباب صغيرة
      const tiers=[[17,8.5,12],[14.5,7.25,9],[12,6,8],[9,4.5,7],[6,3,6]];let yy=y;const c='#e08a6a',L='#c4724f',sh='#a85a3c';
      tiers.forEach(([w,d,h],n)=>{box(x,yy,w,d,h,L,c,'#e89c7e');const qb=qR(x,yy,w,d),qa=qL(x,yy,w,d),cnt=Math.max(3,Math.floor(w/2.6));
        for(let k=0;k<cnt;k++){const u=(k+0.5)/cnt-0.06;arch(qb,u,0.12,h*0.62,'#5a2a20');arch(qa,u,0.12,h*0.62,'#4a2018');
          const t=qb(u+0.06,h*0.78);circ(t[0],t[1],0.9,'#f2c7a8');const t2=qa(u+0.06,h*0.78);circ(t2[0],t2[1],0.9,'#e8b494');}
        const A=qb(0,h),B=qb(1,h);ln(A[0],A[1],B[0],B[1],'#f6efe6',0.7);damage(x,yy,w,d,h,i+n,j,T);yy-=h;});
      [[-3,0],[3,0]].forEach(([dx])=>dome(x+dx,yy,2.2,'#f0b496',sh,'#d9b44a'));dome(x,yy-1,2.8,'#f0b496',sh,'#d9b44a');},
    plazaProp(x,y){box(x,y+1,11,5.5,1,'#b89068','#cfa47c','#d8b088');box(x,y+1,8,4,-1.5,'#9a7656','#b08860','#5f8f9c');box(x,y+1,5,2.5,-3,'#8a6a4a','#9e7a56','#4f7f8c');},
    roadProp(x,y,i,j){if((i*5+j*3)%7===0){ln(x-14,y-17,x-14,y+1,'#5a4a3a',0.8);ln(x+14,y-17,x+14,y+1,'#5a4a3a',0.8);
      for(let k=0;k<14;k++){const t=(k+0.5)/14,px=x-14+28*t,py=y-16+Math.sin(Math.PI*t)*5;circ(px,py,1.1,k%2?'#f0a020':'#e86a1a');}}},
    tree:'neem'}};
/* ---------- مكسيكي: طين ملوّن بأسطح مستوية وعوارض بارزة، أروقة مقوّسة، شرفات حديدية، صبار، أعلام ورقية ملونة، الكشك ---------- */
const MX=['#e3708c','#3fb5a8','#f0b84a','#e07b39','#6a8fd8','#9fcf6a'];
THEMES.mexico={name:'مدينة مكسيكية',ground:'#d3b07e',road:'#c39e72',road2:'#b8936a',plaza:'#dcc39a',debris:'#b39672',wallL:'#c99a6e',wallR:'#ddb083',
  pool:[['adobe',30],['balcony',16],['portal',12],['cactus',14],['ruin',12],['.',8]],
  draw:{
    adobe(x,y,i,j,T){const c=MX[Math.floor(hsh(i,j,70)*MX.length)],h=12+Math.floor(hsh(i,j,71)*3)*3,L=mixc(c,'#000000',0.2),Tp=mixc(c,'#ffffff',0.15);
      box(x,y,14,7,h,L,c,Tp);poly([[x-14,y-h],[x,y-7-h],[x+14,y-h],[x+14,y-h-1.8],[x,y-7-h-1.8],[x-14,y-h-1.8]],mixc(c,'#000000',0.1));
      for(let k=0;k<4;k++){const p=qL(x,y,14,7)(0.15+k*0.22,h-2.2);ln(p[0],p[1],p[0]-2.4,p[1]+1.2,'#6a4a2e',1.2);}
      arch(qR(x,y,14,7),0.15,0.22,9,'#4a3020');arch(qR(x,y,14,7),0.6,0.2,6,'#2f3a46');wL(x,y,14,7,0.4,h-8,0.22,4,'#2f3a46');
      damage(x,y,14,7,h,i,j,T);const pp=qR(x,y,14,7)(0.7,h-3);el(pp[0],pp[1]+3.4,1.6,0.9,'#b05a34');circ(pp[0],pp[1]+1.6,1.4,'#5f8a3a');},
    balcony(x,y,i,j,T){const c=MX[Math.floor(hsh(i,j,72)*MX.length)],L=mixc(c,'#000000',0.2);box(x,y,13,6.5,22,L,c,mixc(c,'#ffffff',0.15));
      arch(qR(x,y,13,6.5),0.35,0.28,9,'#4a3020');wR(x,y,13,6.5,0.3,12,0.36,6,'#2f3a46');
      const a=qR(x,y,13,6.5)(0.22,11),b=qR(x,y,13,6.5)(0.74,11);poly([[a[0],a[1]],[b[0],b[1]],[b[0]+1.4,b[1]+1.4],[a[0]+1.4,a[1]+1.4]],'#3a3632');
      for(let k=0;k<7;k++){const p=qR(x,y,13,6.5)(0.22+k*0.087,11);ln(p[0]+1.2,p[1]+1.2,p[0]+1.2,p[1]-3,'#2b2825',0.5);}ln(a[0]+1.2,a[1]-3,b[0]+1.2,b[1]-3,'#2b2825',0.6);
      damage(x,y,13,6.5,22,i,j,T);ridgeRoof(x,y,13,6.5,22,5,{front:'#b5523a',end:'#c9654a',back:'#7a3428',ov:1.5,k:0.75,tile:'rgba(80,20,10,0.3)'});},
    portal(x,y,i,j,T){box(x,y,14,7,14,'#c9a07a','#e2bc93','#d8b28a');for(let k=0;k<3;k++)arch(qR(x,y,14,7),0.07+k*0.32,0.24,10,'#3a2a20');
      for(let k=0;k<3;k++)arch(qL(x,y,14,7),0.07+k*0.32,0.24,10,'#4a3628');damage(x,y,14,7,14,i,j,T);
      ridgeRoof(x,y,14,7,14,4,{front:'#b5523a',end:'#c9654a',back:'#7a3428',ov:2,k:0.8,tile:'rgba(80,20,10,0.3)'});},
    cactus(x,y,i,j){if(hsh(i,j,73)<0.5){rc(x-1.6,y-18,3.2,18,'#4f8a46');circ(x,y-18,1.6,'#4f8a46');rc(x+1.6,y-11,4,2.4,'#4f8a46');rc(x+3.6,y-15,2.4,5,'#4f8a46');circ(x+4.8,y-15,1.2,'#4f8a46');
        rc(x-5.6,y-9,4,2.4,'#5f9a52');rc(x-5.6,y-13,2.4,5,'#5f9a52');circ(x-4.4,y-13,1.2,'#5f9a52');ln(x,y-17,x,y-1,'#3f7a3a',0.4);}
      else{[[0,-3,4,3],[-3.5,-8,3.4,2.6],[3.6,-8.5,3.2,2.5],[0,-12,3,2.3]].forEach(([dx,dy,rx,ry],k)=>el(x+dx,y+dy,rx,ry,k%2?'#6aa25a':'#5a9450'));
        circ(x+1,y-14,0.9,'#e85a7a');circ(x-3,y-10.4,0.8,'#e85a7a');}},
    landmark(x,y,i,j,T){ // كشك الساحة: منصة ودرجات وأعمدة رفيعة وقبة حديدية خضراء
      box(x,y,15,7.5,3,'#c9b89a','#ddd0b4','#e8ddc6');box(x,y,12,6,1.2,'#b8a688','#cdbc9e','#d9caad');
      for(let k=0;k<8;k++){const a=k/8*TAU,px=x+Math.cos(a)*10,py=y-4+Math.sin(a)*5;if(Math.sin(a)<-0.2)ln(px,py,px,py-14,'#e8e2d4',1);}
      ctx.beginPath();ctx.ellipse(x,y-18,12,6,0,0,TAU);ctx.fillStyle='#3f7a5a';ctx.fill();
      ctx.beginPath();ctx.moveTo(x-12,y-18);ctx.quadraticCurveTo(x,y-36,x+12,y-18);ctx.closePath();ctx.fillStyle='#4f8a6a';ctx.fill();
      ctx.beginPath();ctx.moveTo(x+2,y-30);ctx.quadraticCurveTo(x+9,y-24,x+12,y-18);ctx.lineTo(x+4,y-18);ctx.closePath();ctx.fillStyle='#3a6a50';ctx.fill();
      ln(x,y-32,x,y-37,'#d9b44a',1);circ(x,y-37.5,1.1,'#d9b44a');
      for(let k=0;k<8;k++){const a=k/8*TAU,px=x+Math.cos(a)*10,py=y-4+Math.sin(a)*5;if(Math.sin(a)>=-0.2)ln(px,py,px,py-14,'#f2ede2',1.1);}
      for(let k=0;k<12;k++){const a=k/12*TAU;if(Math.sin(a)>0)ln(x+Math.cos(a)*11,y-6+Math.sin(a)*5.5,x+Math.cos(a)*11,y-9+Math.sin(a)*5.5,'#2b2825',0.4);}
      poly([[x+3,y-22],[x+7,y-19],[x+5,y-18]],'#2a2420');},
    plazaProp(x,y){el(x,y+1,9,4.5,'#b39a78');el(x,y+1,6.5,3.2,'#6f8f9c');circ(x,y-2,1.6,'#d9b44a');},
    roadProp(x,y,i,j){if((i*5+j*3)%7===0){const P=['#e3708c','#3fb5a8','#f0b84a','#9fcf6a','#6a8fd8'];ln(x-14,y-17,x-14,y+1,'#5a4a3a',0.8);ln(x+14,y-17,x+14,y+1,'#5a4a3a',0.8);
      ctx.beginPath();ctx.moveTo(x-14,y-16);ctx.quadraticCurveTo(x,y-11,x+14,y-16);ctx.strokeStyle='#4a3a32';ctx.lineWidth=0.4;ctx.stroke();
      for(let k=0;k<8;k++){const t=(k+0.5)/8,px=x-14+28*t,py=y-16+Math.sin(Math.PI*t)*5*0.5*2;poly([[px-1.4,py],[px+1.4,py],[px+1.4,py+2.6],[px,py+3.6],[px-1.4,py+2.6]],P[k%5]);}}},
    tree:'cactus'}};
/* ---------- شيكاغو الثلاثينيات (اختياري: عالم العصابات الأصلي): عمارات طوب بسلالم حريق، خزانات ماء، لوحات إعلانات، ناطحة "آرت ديكو" ---------- */
THEMES.chicago={name:'شيكاغو الثلاثينيات',ground:'#7d7a72',road:'#4f4c48',road2:'#57534e',plaza:'#8f8b82',debris:'#7a5a4a',wallL:'#7a3428',wallR:'#934236',car:['#2a2a2c','#3a3a3e','#1e1e20'],
  pool:[['brick',30],['warehouse',14],['tank',10],['billboard',8],['ruin',14],['.',6]],
  draw:{
    brick(x,y,i,j,T){const h=30+Math.floor(hsh(i,j,120)*3)*5,c=hsh(i,j,121)<0.5?['#7a3428','#934236']:['#6a4a3a','#7e5a48'];box(x,y,14,7,h,c[0],c[1],'#5a4a40');
      poly([[x-14,y-h],[x,y+7-h],[x+14,y-h],[x+14,y-h+1.6],[x,y+7-h+1.6],[x-14,y-h+1.6]],'#b8aa98');
      for(let r=0;r<Math.floor((h-6)/6.5);r++)for(let k=0;k<3;k++){const lit=hsh(i,j,130+r*3+k)<0.15;
        wR(x,y,14,7,0.1+k*0.3,4+r*6.5,0.16,4,lit?'#e8c56a':'#2a2826');wL(x,y,14,7,0.1+k*0.3,4+r*6.5,0.16,4,'#262422');}
      for(let r=0;r<Math.floor((h-10)/6.5);r++){const a=qR(x,y,14,7)(0.4,9+r*6.5),b=qR(x,y,14,7)(0.72,9+r*6.5);
        poly([[a[0],a[1]],[b[0],b[1]],[b[0]+1.6,b[1]+1],[a[0]+1.6,a[1]+1]],'#1e1d1c');
        const s1=qR(x,y,14,7)(r%2?0.45:0.67,9+r*6.5),s2=qR(x,y,14,7)(r%2?0.67:0.45,9+(r+1)*6.5);if(r<Math.floor((h-10)/6.5)-1)ln(s1[0]+0.8,s1[1]+0.5,s2[0]+0.8,s2[1]+0.5,'#1e1d1c',0.8);}
      damage(x,y,14,7,h,i,j,T);},
    warehouse(x,y,i,j,T){box(x,y,16,8,13,'#6e3a2e','#874538','#4a4440');wR(x,y,16,8,0.3,0,0.4,9,'#2e2a26');
      wL(x,y,16,8,0.1,7,0.8,4.5,'#c9b38a');for(let k=0;k<4;k++)wL(x,y,16,8,0.15+k*0.18,8,0.12,2.6,k%2?'#a3473a':'#3a5a7a');damage(x,y,16,8,13,i,j,T);},
    tank(x,y,i,j,T){box(x,y,14,7,24,'#6a4a3a','#7e5a48','#4a4038');for(let r=0;r<3;r++)for(let k=0;k<3;k++)wR(x,y,14,7,0.1+k*0.3,4+r*6.5,0.16,4,'#2a2826');
      damage(x,y,14,7,24,i,j,T);const tx=x+2,ty=y-24;ln(tx-5,ty+1,tx-4,ty-8,'#3a2e26',1);ln(tx+5,ty+1,tx+4,ty-8,'#3a2e26',1);ln(tx,ty+3,tx,ty-8,'#3a2e26',1);
      el(tx,ty-8,6,2.2,'#6e5644');rc(tx-6,ty-17,12,9,'#7e6450');el(tx,ty-17,6,2.2,'#937a64');poly([[tx-6,ty-17],[tx,ty-22],[tx+6,ty-17]],'#5a4636');
      for(let k=0;k<3;k++)ln(tx-6,ty-10-k*2.6,tx+6,ty-10-k*2.6,'rgba(0,0,0,0.2)',0.5);},
    billboard(x,y,i,j){ln(x-6,y+3,x-6,y-12,'#3a2e26',1);ln(x+6,y-3,x+6,y-18,'#3a2e26',1);
      poly([[x-11,y-10],[x+11,y-21],[x+11,y-31],[x-11,y-20]],'#e8dcc0');poly([[x-9.6,y-11.4],[x+9.6,y-21],[x+9.6,y-25],[x-9.6,y-15.4]],'#c4402e');
      poly([[x-9.6,y-16.6],[x+2,y-22.4],[x+2,y-28],[x-9.6,y-22.2]],'#2f5a7a');if(hsh(i,j,140)<0.6)poly([[x+2,y-27],[x+11,y-31],[x+11,y-24],[x+5,y-23]],'#4a4440');},
    landmark(x,y,i,j,T){ // ناطحة سحاب "آرت ديكو" بارتدادات وخطوط عمودية وهوائي
      const lv=[[16,8,26],[12,6,18],[8.5,4.25,14],[5,2.5,10]];let yy=y;
      lv.forEach(([w,d,h],n)=>{box(x,yy,w,d,h,'#a39a88','#bdb4a0','#8f8776');
        for(let k=1;k<6;k++){const a=qR(x,yy,w,d)(k/6,0),b=qR(x,yy,w,d)(k/6,h);ln(a[0],a[1],b[0],b[1],'rgba(40,36,30,0.35)',0.6);const c2=qL(x,yy,w,d)(k/6,0),e=qL(x,yy,w,d)(k/6,h);ln(c2[0],c2[1],e[0],e[1],'rgba(40,36,30,0.35)',0.6);}
        for(let r=0;r<Math.floor(h/5);r++)for(let k=0;k<5;k++)if(hsh(i+n,j,150+r*5+k)<0.18)wR(x,yy,w,d,0.05+k*0.19,2+r*5,0.08,2.6,'#e8c56a');
        damage(x,yy,w,d,h,i+n,j+n,T);yy-=h;});
      ln(x,yy,x,yy-14,'#4a4440',1.2);circ(x,yy-14,1.2,'#e8584a');},
    plazaProp(x,y){el(x,y+1,9,4.5,'#77736b');rc(x-0.6,y-9,1.2,10,'#2b2825');poly([[x-3.2,y-9],[x,y-11.6],[x+3.2,y-9],[x,y-7.8]],'#2b2825');rc(x-1,y-11,2,1.8,'#f2d58a');},
    roadProp(x,y,i,j){if((i+j)%2===0){ln(x-4,y-2,x+4,y+2,'rgba(230,210,140,0.55)',0.8);}},
    tree:'tank'}};


export { THEMES, TAU, poly, circ, ln, rc, el, box, qL, qR, wL, wR, arch, ridgeRoof, hipRoof, dome, flag, glow,
  damage, ruinTile, streetDebris, hsh, mixc, snowCap, stepGable, bellGable, neonSign, hexRgb };
