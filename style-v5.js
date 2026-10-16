/* ===================== نمط الرسم المظلَّل v5 =====================
   يرفع مستوى كل الشخصيات تلقائياً دون تعديل كل مظهر على حدة:
   - أطراف وجذع كبسولية: حافة داكنة + لون أساسي + لمعة من أعلى اليسار
   - رأس بتدرج دائري، وأطراف أسمك قليلاً
   - الأقمشة والدروع والعمائم الكبيرة تُملأ بتدرج تلقائي وحافة داكنة خفيفة
   - أحزمة جلدية بإبزيم نحاسي، وطيّات في الأثواب، وظل أرضي ناعم، وحلقة بطل متوهجة
   STYLE.on=false يعيد الرسم القديم حرفياً (للمقارنة، ولمستويات التفصيل البعيدة). */
const STYLE={on:true,thick:1.16,head:1.06};
const isHex=f=>typeof f==='string'&&f[0]==='#'&&f.length===7;
function path(c,pts){c.beginPath();c.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);}
/* جزء من الجسم: كبسولة مظللة */
function capsule(c,pts,w,col){c.lineCap='round';c.lineJoin='round';
  if(!STYLE.on){path(c,pts);c.strokeStyle=col;c.lineWidth=w;c.stroke();return;}
  path(c,pts);c.strokeStyle=dk(col,0.38);c.lineWidth=w+0.75;c.stroke();
  path(c,pts);c.strokeStyle=col;c.lineWidth=w;c.stroke();
  const o=-w*0.15;path(c,pts.map(p=>[p[0]+o,p[1]+o]));c.strokeStyle=lt(col,0.3);c.lineWidth=w*0.4;c.globalAlpha=0.9;c.stroke();
  const o2=-w*0.22;path(c,pts.map(p=>[p[0]+o2,p[1]+o2]));c.strokeStyle=lt(col,0.6);c.lineWidth=w*0.13;c.globalAlpha=0.55;c.stroke();c.globalAlpha=1;}
/* تعبئة متدرجة تلقائية للأشكال الكبيرة (أقمشة، عباءات، دروع) */
function bbox(pts){let a=1e9,b=1e9,c2=-1e9,d=-1e9;for(const p of pts){if(p[0]<a)a=p[0];if(p[1]<b)b=p[1];if(p[0]>c2)c2=p[0];if(p[1]>d)d=p[1];}return [a,b,c2,d];}
function pg(c,pts,f,st,w){path(c,pts);c.closePath();const B=bbox(pts),big=(B[2]-B[0])*(B[3]-B[1])>10;
  if(STYLE.on&&isHex(f)&&big){const g=c.createLinearGradient(B[0],B[1],B[2],B[3]);g.addColorStop(0,lt(f,0.2));g.addColorStop(0.55,f);g.addColorStop(1,dk(f,0.2));c.fillStyle=g;}else c.fillStyle=f;
  c.fill();if(st){c.strokeStyle=st;c.lineWidth=w||0.5;c.stroke();}else if(STYLE.on&&isHex(f)&&big){c.strokeStyle=dk(f,0.35);c.lineWidth=0.45;c.stroke();}}
function ell(c,x,y,rx,ry,f){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);
  if(STYLE.on&&isHex(f)&&rx*ry>2.5){const g=c.createRadialGradient(x-rx*0.35,y-ry*0.45,0,x,y,Math.max(rx,ry)*1.05);g.addColorStop(0,lt(f,0.32));g.addColorStop(0.6,f);g.addColorStop(1,dk(f,0.22));c.fillStyle=g;c.fill();
    c.strokeStyle=dk(f,0.32);c.lineWidth=0.4;c.stroke();}else{c.fillStyle=f;c.fill();}}
function circ2(c,P,r,f){ell(c,P[0],P[1],r,r,f);}
/* حزام جلدي بإبزيم نحاسي */
function belt(c,J,col,w){const a=J.pl,A=add(J.hip,rot(-2.5,-1.3,a)),B=add(J.hip,rot(2.7,-1.3,a));w=w||1.5;
  if(!STYLE.on){limb(c,A[0],A[1],B[0],B[1],w,col);return;}
  limb(c,A[0],A[1],B[0],B[1],w+0.5,dk(col,0.45));limb(c,A[0],A[1],B[0],B[1],w,col);limb(c,A[0],A[1]-w*0.25,B[0],B[1]-w*0.25,w*0.25,lt(col,0.3));
  if(w>=1.1){const K=lp(A,B,0.72);rrect(c,K[0]-w*0.6,K[1]-w*0.75,w*1.2,w*1.5,0.25,'#d9b45a');rrect(c,K[0]-w*0.3,K[1]-w*0.4,w*0.6,w*0.8,0.15,dk(col,0.2));}}
/* ثوب: تدرج + طيّات */
function robe(c,J,len,fill,edge,top,flare){const a=J.pl,fl=flare==null?1.6:flare,hf=legPt(J.legF,len),hb=legPt(J.legB,len);
  const hemF=[hf[0]+fl,hf[1]],hemB=[hb[0]-fl,hb[1]];let pts,w1,w2;w1=add(J.hip,rot(-2.4,-1.1,a));w2=add(J.hip,rot(2.6,-1.1,a));
  if(top==='chest'){const s1=add(J.chest,rot(-2.1,0.5,J.a2)),s2=add(J.chest,rot(2.3,0.5,J.a2));pts=[s1,s2,w2,hemF,hemB,w1];}else pts=[w1,w2,hemF,hemB];
  pg(c,pts,fill,edge,0.5);
  if(STYLE.on&&isHex(fill)){[0.3,0.62].forEach(t=>{const A=lp(w1,w2,t),Bm=lp(hemB,hemF,t+(t-0.5)*0.3);c.beginPath();c.moveTo(A[0],A[1]+0.6);c.quadraticCurveTo((A[0]+Bm[0])/2+0.5,(A[1]+Bm[1])/2,Bm[0],Bm[1]-0.3);
      c.strokeStyle=dk(fill,0.16);c.lineWidth=0.5;c.globalAlpha=0.8;c.stroke();c.globalAlpha=1;});
    limb(c,hemB[0],hemB[1],hemF[0],hemF[1],0.6,dk(fill,0.22));}
  return {w1,w2,hemF,hemB};}
function leg(c,hx,hy,th,fl,W,col){const k=[hx+Math.sin(th)*5.8,hy+Math.cos(th)*5.8];const f=[k[0]+Math.sin(th-fl)*6,k[1]+Math.cos(th-fl)*6];
  const toe=[f[0]+Math.sin(th-fl+1.1)*2,f[1]+Math.cos(th-fl+1.1)*0.9];capsule(c,[[hx,hy],k,f],W,col);capsule(c,[f,toe],W,dk(col,STYLE.on?0.1:0));return {h:[hx,hy],k,f};}
function drawBody(c,p,col,o){const T=STYLE.on?STYLE.thick:1,W=(o.lw||2)*T,dc=dk(col,0.32),hp=[p.px,p.py];
  const M=add(hp,rot(0,-4.6,p.pl)),a2=p.pl+p.cb,C=add(M,rot(0,-4.6,a2)),N=add(C,rot(0,-1.3,a2));const ha=a2+p.ht,H=add(add(N,rot(0,-3.1,ha)),[p.hdx,p.hdy]);
  const Sb=add(C,rot(-0.9,0.7,a2)),Sf=add(C,rot(0.9,0.5,a2));const J={hip:hp,mid:M,chest:C,neck:N,head:H,ha,Sf,Sb,a2,pl:p.pl};
  J.legB=leg(c,p.px-1.2,p.py,p.tb,p.kb,W,dc);const b=ik2(Sb,p.bh,3.7,3.7,true);capsule(c,[Sb,b.j,b.e],W-0.1,dc);J.handB=b.e;
  o.back&&o.back(c,J,p,col);capsule(c,[hp,M,C],W+0.5,col);capsule(c,[C,N],W*0.8,col);o.chest&&o.chest(c,J,p,col);
  J.legF=leg(c,p.px+1.2,p.py,p.tf,p.kf,W,col);o.robe&&o.robe(c,J,p,col);o.over&&o.over(c,J,p,col);
  const hr=(o.headR||3)*(STYLE.on?STYLE.head:1);c.save();c.translate(H[0],H[1]);c.rotate(ha);c.beginPath();c.arc(0,0,hr,0,TAU);
  if(STYLE.on){const g=c.createRadialGradient(-hr*0.35,-hr*0.4,hr*0.1,0,0,hr*1.05);g.addColorStop(0,lt(col,0.38));g.addColorStop(0.6,col);g.addColorStop(1,dk(col,0.28));c.fillStyle=g;}else c.fillStyle=col;
  c.fill();c.lineWidth=0.7;c.strokeStyle=dk(col,0.4);c.stroke();
  c.beginPath();c.arc(1.5,-0.3,0.6,0,TAU);c.fillStyle=dk(col,0.65);c.fill();if(STYLE.on){c.beginPath();c.arc(1.3,-0.5,0.2,0,TAU);c.fillStyle='rgba(255,255,255,0.7)';c.fill();}
  o.head&&o.head(c,p,col);c.restore();
  const f=ik2(Sf,p.fh,3.7,3.7,true);J.handF=f.e;J.elbowF=f.j;o.weapon&&o.weapon(c,J,p,col);capsule(c,[Sf,f.j,f.e],W,col);o.front&&o.front(c,J,p,col);return J;}
/* ظل أرضي ناعم وحلقة بطل متوهجة */
function groundFX(c,U,p){const s=1-(p.air||0)*0.35;
  if(STYLE.on){const g=c.createRadialGradient(0,0.6,0,0,0.6,5*s);g.addColorStop(0,'rgba(0,0,0,0.42)');g.addColorStop(1,'rgba(0,0,0,0)');c.save();c.scale(1,0.42);c.fillStyle=g;c.beginPath();c.arc(0,1.4,5*s,0,TAU);c.fill();c.restore();}
  else{c.beginPath();c.ellipse(0,0.6,4.2*s,1.7*s,0,0,TAU);c.fillStyle='rgba(0,0,0,0.28)';c.fill();}
  if(U.aura){c.beginPath();c.ellipse(0,0.5,9,3.6,0,0,TAU);c.strokeStyle='rgba(255,214,110,0.8)';c.lineWidth=0.9;c.setLineDash([3,2.4]);c.stroke();c.setLineDash([]);}
  if(U.hero){if(STYLE.on){c.save();c.shadowColor='rgba(255,200,80,0.9)';c.shadowBlur=6;c.beginPath();c.ellipse(0,0.5,7.4,3,0,0,TAU);c.strokeStyle='#f0c860';c.lineWidth=1.2;c.stroke();c.restore();
      c.beginPath();c.ellipse(0,0.5,7.4,3,0,0,TAU);c.strokeStyle='#fff0b8';c.lineWidth=0.4;c.stroke();}
    else{c.beginPath();c.ellipse(0,0.5,7,2.8,0,0,TAU);c.strokeStyle='#e6c25a';c.lineWidth=1.1;c.stroke();}}}
function drawSkinned(c,key,x,y,sc,col,p,dir){const U=UNITS[key];if(U.twoH){const d=wdir(p.wa);p=Object.assign({},p);p.bh=[p.fh[0]-d[0]*3.2,p.fh[1]-d[1]*3.2];}
  c.save();c.translate(x,y);c.scale(sc*(dir||1)*U.sx,sc*U.sy);groundFX(c,U,p);drawBody(c,p,col,U);c.restore();}
/* لهب متدرج بطبقات وجمرات (يستعمله النفّاط، ويصلح لكل النيران) */
function flame(c,x,y,s){if(!STYLE.on){tri(c,[x-1.2*s,y],[x,y-3.6*s],[x+1.2*s,y],'#f0902a');tri(c,[x-0.6*s,y],[x,y-2.2*s],[x+0.6*s,y],'#ffd45a');return;}
  const g=c.createRadialGradient(x,y-1.6*s,0,x,y-1.6*s,5.5*s);g.addColorStop(0,'rgba(255,180,70,0.55)');g.addColorStop(1,'rgba(255,140,40,0)');c.fillStyle=g;c.beginPath();c.arc(x,y-1.6*s,5.5*s,0,TAU);c.fill();
  const drop=(h,w,col)=>{c.beginPath();c.moveTo(x-w*s,y);c.bezierCurveTo(x-w*s,y-h*0.5*s,x-w*0.2*s,y-h*0.7*s,x,y-h*s);c.bezierCurveTo(x+w*0.3*s,y-h*0.6*s,x+w*s,y-h*0.45*s,x+w*s,y);c.closePath();c.fillStyle=col;c.fill();};
  drop(4.4,1.5,'#e8641e');drop(3.4,1.1,'#f8a030');drop(2.2,0.65,'#ffe27a');drop(1.1,0.3,'#fffbe8');
  [[0.9,-4.6],[-0.8,-5.4],[0.3,-6.2]].forEach(([dx,dy],k)=>{c.beginPath();c.arc(x+dx*s,y+dy*s,0.28*s,0,TAU);c.fillStyle=k%2?'#ffd060':'#ff9a40';c.fill();});}
