// مدن الأمم الأوروبية (المرحلة 9ب، القسم 3.10): باريس (فرنسا)، برمنغهام (بريطانيا)، روتنبورغ (ألمانيا).
// منقولة كما هي من docs/nations/batch3-cities.js بأدوات cityThemes.js نفسها (stepGable وbellGable والطابع الأوروبي
// منه لا من النسخة المكررة في الملف المرجعي)، فيعمل عليها كل ما في القسم 3.9. الفروق: لوحة الرسم من getCtx()،
// والألوان المرسومة مباشرة على اللوحة تمر عبر paint() (صبغ المالك والطقس)، وماء برمنغهام على حافة الخريطة
// كالنرويجية (CITIES.water في config.js، لا يُمشى عليه) بدل isWater التجريبية.
import { getCtx, paint, THEMES, TAU, poly, circ, ln, rc, el, box, qL, qR, wL, wR, arch, ridgeRoof, hipRoof, damage, hsh, mixc } from './cityThemes.js';

const lpc=(A,B,t)=>[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t];

/* ---------- باريس الحقبة الجميلة: عمارات هوسمان الحجرية بشرفات حديدية وأسقف مانسارد ونوافذ علوية، مقاهٍ، مداخل المترو؛ والمعلم برج إيفل ---------- */
function mansard(x,y,w,d,h,rh,col,top){const i=2.2;const L=[x-w,y-h],F=[x,y+d-h],R=[x+w,y-h],B=[x,y-d-h];
  const L2=[x-w+i,y-h-rh],F2=[x,y+d-h-rh-i*0.5+0.6],R2=[x+w-i,y-h-rh],B2=[x,y-d-h-rh+i*0.5];
  poly([L,F,F2,L2],col);poly([F,R,R2,F2],mixc(col,'#ffffff',0.12));poly([L2,F2,R2,B2],top);return {L,F,R,L2,F2,R2};}
function haussmann(x,y,i,j,T){const w=14,d=7,h=34+Math.floor(hsh(i,j,900)*2)*4,S1='#d9ccb2',S2='#e9dfc9';box(x,y,w,d,h,S1,S2);const qb=qR(x,y,w,d);
  const shop=hsh(i,j,901)<0.6;if(shop){wR(x,y,w,d,0.08,0.4,0.84,6.2,'#2e3a40');const aw=hsh(i,j,902)<0.5?'#a3302a':'#2f5a46';
    for(let k=0;k<6;k++){const A=qb(0.08+k*0.14,7.4),B=qb(0.22+k*0.14,7.4);poly([A,B,[B[0]+1.8,B[1]+2.6],[A[0]+1.8,A[1]+2.6]],k%2?'#efe6d2':aw);}}
  else arch(qb,0.42,0.16,7,'#3a2e26');
  for(let f=0;f<4;f++){const v=10+f*6.2;for(let k=0;k<3;k++){wR(x,y,w,d,0.12+k*0.3,v,0.15,4.6,hsh(i,j,910+f*3+k)<0.1?'#e8c56a':'#3c4b55');wL(x,y,w,d,0.12+k*0.3,v,0.15,4.6,'#34424b');}
    if(f===0||f===3){const A=qb(0.04,v),B=qb(0.96,v);ln(A[0]+0.8,A[1]+0.6,B[0]+0.8,B[1]+0.6,'#1e1e22',0.9);for(let k=0;k<12;k++){const P=qb(0.04+k*0.08,v);ln(P[0]+0.8,P[1]+0.6,P[0]+0.8,P[1]-1.6,'#1e1e22',0.35);}}}
  const A=qb(0,h),B=qb(1,h);ln(A[0],A[1],B[0],B[1],'#f4efe2',1.1);damage(x,y,w,d,h,i,j,T);
  const m=mansard(x,y,w,d,h,7,'#6f7c86','#7f8c96');for(let k=0;k<2;k++){const P=lpc(m.F,m.R,0.3+k*0.4),Q=lpc(m.F2,m.R2,0.3+k*0.4),M=lpc(P,Q,0.45);rc(M[0]-1,M[1]-2.2,2,2.6,'#e6dccb');rc(M[0]-0.6,M[1]-1.8,1.2,1.8,'#3c4b55');}
  [0.3,0.7].forEach(t=>{const P=lpc(m.L2,m.R2,t);rc(P[0]-1.4,P[1]-4,2.8,4,'#b8a888');for(let k=0;k<3;k++)rc(P[0]-1.2+k*0.9,P[1]-5.4,0.6,1.6,'#b8643a');});}
/* مبانٍ محلية أقل ارتفاعاً (بطلب المستخدم، مع توسعة المدينة): مقهى بشرفة، وسوق مسقوف من الحديد والزجاج،
   ومتجر صغير بكشك زهور. أرقامها شكل فقط مثل بقية الطابع */
// مقهى باريسي: طابق أرضي زجاجي بمظلة حمراء أو خضراء ولوحة، وشرفة حديدية، وسقف مانسارد، وطاولات أمامه
function cafe(x,y,i,j,T){const w=13,d=6.5,h=16;box(x,y,w,d,h,'#d9ccb2','#e9dfc9');const qb=qR(x,y,w,d),qa=qL(x,y,w,d);
  const aw=hsh(i,j,950)<0.5?'#a3302a':'#2f5a46';
  wR(x,y,w,d,0.06,0.4,0.88,6,'#2e3a40');for(let k=1;k<5;k++){const A=qb(0.06+k*0.176,0.4),B=qb(0.06+k*0.176,6.4);ln(A[0],A[1],B[0],B[1],'#c9b88a',0.5);}
  wR(x,y,w,d,0.1,1,0.8,2.2,'#f2d58a');wL(x,y,w,d,0.1,0.4,0.8,6,'#2a343a');
  wR(x,y,w,d,0.3,6.6,0.4,0.9,'#1e2a24');
  for(let k=0;k<3;k++)wR(x,y,w,d,0.1+k*0.3,9.6,0.16,4.4,'#3c4b55');for(let k=0;k<2;k++)wL(x,y,w,d,0.2+k*0.45,9.6,0.16,4.4,'#34424b');
  {const A=qb(0.04,9.6),B=qb(0.96,9.6);ln(A[0]+0.8,A[1]+0.6,B[0]+0.8,B[1]+0.6,'#1e1e22',0.8);for(let k=0;k<10;k++){const P=qb(0.04+k*0.1,9.6);ln(P[0]+0.8,P[1]+0.6,P[0]+0.8,P[1]-1.2,'#1e1e22',0.3);}}
  damage(x,y,w,d,h,i,j,T);
  const a0=qb(0.04,7.6),a1=qb(0.96,7.6);poly([a0,a1,[a1[0]+1.8,a1[1]+2.6],[a0[0]+1.8,a0[1]+2.6]],aw);ln(a0[0]+1.8,a0[1]+2.6,a1[0]+1.8,a1[1]+2.6,'#efe6d2',0.7);
  const b0=qa(0.06,7.6),b1=qa(0.94,7.6);poly([b0,b1,[b1[0]-1.8,b1[1]+2.6],[b0[0]-1.8,b0[1]+2.6]],mixc(aw,'#000000',0.18));
  const m=mansard(x,y,w,d,h,6,'#6f7c86','#7f8c96');for(let k=0;k<2;k++){const P=lpc(m.F,m.R,0.3+k*0.4),Q=lpc(m.F2,m.R2,0.3+k*0.4),M=lpc(P,Q,0.45);rc(M[0]-1,M[1]-2.2,2,2.6,'#e6dccb');rc(M[0]-0.6,M[1]-1.8,1.2,1.8,'#3c4b55');}
  for(let k=0;k<3;k++){const P=qb(0.18+k*0.3,0),tx=P[0]+2.4,ty=P[1]+4.4;el(tx,ty+0.6,2.6,1.1,'rgba(0,0,0,0.18)');
    el(tx-2.2,ty-0.3,0.9,0.5,'#a8743a');ln(tx,ty,tx,ty-2.6,'#2b2825',0.5);el(tx,ty-2.8,1.9,0.9,'#3a3a3e');el(tx+2.2,ty+0.3,0.9,0.5,'#a8743a');}}
// سوق مسقوف بطراز بالتار: قاعدة طوب بأقواس، وحزام زجاج بأعمدة حديد خضراء، وسقف زنك بفانوس علوي، وصناديق خضار
function market(x,y,i,j,T){const w=14,d=7,h=7,gh=6;box(x,y,w,d,h,'#8a4a3a','#9e5a46');const qb=qR(x,y,w,d),qa=qL(x,y,w,d);
  for(let k=0;k<3;k++)arch(qb,0.06+k*0.32,0.24,5.6,'#2a1e18');for(let k=0;k<2;k++)arch(qa,0.12+k*0.45,0.3,5.6,'#241a14');
  box(x,y-h,w,d,gh,'#9fb0b4','#b8c8cc');const qg=qR(x,y-h,w,d),ql=qL(x,y-h,w,d);
  for(let k=0;k<=8;k++){let A=qg(k/8,0),B=qg(k/8,gh);ln(A[0],A[1],B[0],B[1],'#3f5a48',0.7);A=ql(k/8,0);B=ql(k/8,gh);ln(A[0],A[1],B[0],B[1],'#3f5a48',0.7);}
  {const A=qg(0,gh*0.5),B=qg(1,gh*0.5);ln(A[0],A[1],B[0],B[1],'#3f5a48',0.5);}
  damage(x,y,w,d,h,i,j,T);hipRoof(x,y,w+1,d+0.5,h+gh,4,'#6f7c86','#7f8c96');
  box(x,y-h-gh-2,6,3,3,'#9fb0b4','#b8c8cc');hipRoof(x,y-h-gh-2,7,3.5,3,2.6,'#6f7c86','#7f8c96');
  const fr=['#d9463b','#e8a33a','#6fa04a'];
  for(let k=0;k<3;k++){const P=qb(0.18+k*0.3,0),cx=P[0]+2,cy=P[1]+3.6;box(cx,cy,1.6,0.8,1.2,'#8a6440','#a07a52','#c9a86a');circ(cx-0.4,cy-1.5,0.5,fr[k]);circ(cx+0.5,cy-1.3,0.5,fr[(k+1)%3]);}}
// متجر صغير بواجهة خشبية ملونة وشريط ذهبي، وواجهة عرض، ومظلة مخططة، وكشك زهور أمامه
const SHOP_COL=['#2f4a3a','#6a1f2a','#24384f'],GOODS=['#d9463b','#e8c23a','#7a9ac8','#c86a9a','#6fa04a','#e88a3a'],FLOWERS=['#e85a7a','#f2d14a','#f4f1ea','#d9463b'];
function boutique(x,y,i,j,T){const w=12,d=6,h=22;box(x,y,w,d,h,'#d6c8ac','#e6dac0');const qb=qR(x,y,w,d);
  const fc=SHOP_COL[Math.floor(hsh(i,j,960)*SHOP_COL.length)];
  wR(x,y,w,d,0,0,1,7.6,fc);wL(x,y,w,d,0,0,1,7.6,mixc(fc,'#000000',0.15));wR(x,y,w,d,0.1,0.8,0.52,5.4,'#e8dcc0');
  for(let k=0;k<6;k++){const P=qb(0.14+k*0.08,1.8);circ(P[0],P[1]-0.6,0.5,GOODS[k]);}
  wR(x,y,w,d,0.7,0,0.2,6,'#3a2a22');wR(x,y,w,d,0.1,6.6,0.8,0.8,'#c9a04a');
  for(let f=0;f<2;f++){const v=10+f*6;for(let k=0;k<2;k++)wR(x,y,w,d,0.14+k*0.44,v,0.2,4.4,'#3c4b55');wL(x,y,w,d,0.35,v,0.25,4.4,'#34424b');
    const A=qb(0.08,v),B=qb(0.92,v);ln(A[0]+0.8,A[1]+0.6,B[0]+0.8,B[1]+0.6,'#1e1e22',0.7);}
  damage(x,y,w,d,h,i,j,T);
  for(let k=0;k<6;k++){const A=qb(0.04+k*0.15,7.8),B=qb(0.19+k*0.15,7.8);poly([A,B,[B[0]+1.6,B[1]+2.4],[A[0]+1.6,A[1]+2.4]],k%2?'#f2ede0':fc);}
  mansard(x,y,w,d,h,6,'#6f7c86','#7f8c96');
  const P=qb(0.5,0),fx=P[0]+3,fy=P[1]+4.2;for(let k=0;k<4;k++){const bx=fx-3+k*2,by=fy-k*0.9;rc(bx-0.7,by-1.4,1.4,1.4,'#5a6a72');circ(bx,by-2.1,1,FLOWERS[k]);circ(bx-0.5,by-2.7,0.6,'#5f8a44');}}
// قبة كشك الإعلانات (نصف شكل بيضاوي)
function c0dome(x,y){const ctx=getCtx();ctx.beginPath();ctx.ellipse(x,y,3,2.4,0,Math.PI,0);ctx.fillStyle=paint('#4f6a48');ctx.fill();}
export const paris={name:'باريس — فرنسا',ground:'#9a988c',road:'#86827a',road2:'#7c786f',plaza:'#b0a998',debris:'#958c7c',wallL:'#c9bca2',wallR:'#ddd1b8',car:['#2e3a40','#3e4a50','#22282c'],
  pool:[['haus',28],['cafe',12],['boutique',12],['market',6],['ptree',10],['ruin',10],['.',6]],
  draw:{haus:haussmann,cafe,boutique,market,
    ptree(x,y,i,j){const o=((i+j)%2)*2-1;rc(x-1+o,y-9,2,9,'#5b4636');circ(x+o,y-15,7,'#5f8a44');circ(x-3+o,y-17,5,'#6f9a52');circ(x+3+o,y-13,4,'#527a3a');el(x+o,y+1,4,2,'#3a3a3e');},
    landmark(x,y,i,j,T){ // برج إيفل: أربع أرجل منحنية، منصتان، قمة، وشبكة حديدية
      const ctx=getCtx(),Cb='#6b4e3a',Cf='#7a5a45',lv=(t)=>{const wv=16*(1-t)+3.4*t;return [wv,wv*0.5];};
      const P=(s,t,hgt)=>{const [w,d]=lv(t);return [[x-w,y-hgt],[x,y-d-hgt],[x+w,y-hgt],[x,y+d-hgt]][s];};
      const H1=24,H2=46,H3=72;
      const legs=(order)=>order.forEach(s=>{ctx.beginPath();for(let k=0;k<=10;k++){const t=k/10*0.42,h=H1*Math.pow(k/10,0.8);const p=P(s,t,h);k?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]);}
        ctx.strokeStyle=paint(s===1?Cb:Cf);ctx.lineWidth=2.4;ctx.stroke();});
      legs([1,0,2]);ctx.beginPath();ctx.moveTo(P(0,0.42,H1)[0],P(0,0.42,H1)[1]);ctx.quadraticCurveTo(x,y-10,P(2,0.42,H1)[0],P(2,0.42,H1)[1]);ctx.strokeStyle=paint(Cf);ctx.lineWidth=1;ctx.stroke();
      poly([P(0,0.42,H1),P(1,0.42,H1),P(2,0.42,H1),P(3,0.42,H1)],'#5a4232');poly([P(0,0.42,H1),P(3,0.42,H1),[P(3,0.42,H1)[0],P(3,0.42,H1)[1]+1.6],[P(0,0.42,H1)[0],P(0,0.42,H1)[1]+1.6]],Cf);
      poly([P(3,0.42,H1),P(2,0.42,H1),[P(2,0.42,H1)[0],P(2,0.42,H1)[1]+1.6],[P(3,0.42,H1)[0],P(3,0.42,H1)[1]+1.6]],'#8a6a52');
      for(let s of [0,2]){const a=P(s,0.42,H1),b=P(s,0.75,H2);ln(a[0],a[1],b[0],b[1],Cf,1.6);}const a3=P(3,0.42,H1),b3=P(3,0.75,H2);ln(a3[0],a3[1],b3[0],b3[1],Cf,1.6);
      for(let k=0;k<5;k++){const t=k/5,A=lpc(P(0,0.42,H1),P(0,0.75,H2),t),B=lpc(P(3,0.42,H1),P(3,0.75,H2),t+0.2),C=lpc(P(2,0.42,H1),P(2,0.75,H2),t);ln(A[0],A[1],B[0],B[1],'rgba(90,66,50,0.8)',0.4);ln(B[0],B[1],C[0],C[1],'rgba(90,66,50,0.8)',0.4);}
      poly([P(0,0.75,H2),P(1,0.75,H2),P(2,0.75,H2),P(3,0.75,H2)],'#5a4232');
      const top=[x,y-H3];[0,2,3].forEach(s=>{const a=P(s,0.75,H2);ln(a[0],a[1],top[0],top[1],Cf,1.2);});
      for(let k=1;k<6;k++){const t=k/6,A=lpc(P(0,0.75,H2),top,t),B=lpc(P(3,0.75,H2),top,t),C=lpc(P(2,0.75,H2),top,t);ln(A[0],A[1],B[0],B[1],'rgba(90,66,50,0.7)',0.4);ln(B[0],B[1],C[0],C[1],'rgba(90,66,50,0.7)',0.4);}
      rc(x-1.2,y-H3-2,2.4,2.4,'#5a4232');ln(x,y-H3-2,x,y-H3-9,'#5a4232',0.8);damage(x,y,8,4,10,i,j,T);},
    plazaProp(x,y){el(x,y+1,9,4.5,'#8f8a80');box(x,y,2.6,1.3,10,'#3f5a3a','#4f6a48');el(x,y-10,3.2,1.6,'#3f5a3a');c0dome(x,y-10);
      [[0.1,'#c4402e'],[0.55,'#e8c56a']].forEach(([u,cl])=>wR(x,y,2.6,1.3,u,2.5,0.35,5,cl));},
    roadProp(x,y,i,j){const ctx=getCtx();if((i*7+j*5)%9===0){ // مدخل مترو بطراز آرت نوفو
        [[-5,1],[5,-2.5]].forEach(([dx,dy])=>{ctx.beginPath();ctx.moveTo(x+dx,y+dy);ctx.quadraticCurveTo(x+dx-1,y+dy-8,x+dx+1.4,y+dy-12);ctx.strokeStyle=paint('#3f6a4a');ctx.lineWidth=1.1;ctx.stroke();el(x+dx+1.6,y+dy-12.6,1,1.4,'#f0a040');});
        ctx.beginPath();ctx.moveTo(x-5,y-9);ctx.quadraticCurveTo(x,y-13,x+5,y-12.5);ctx.strokeStyle=paint('#3f6a4a');ctx.lineWidth=0.9;ctx.stroke();}
      else if((i*5+j*3)%7===0){ln(x+10,y+2,x+10,y-15,'#1e1e22',1);poly([[x+8.4,y-15],[x+10,y-18.5],[x+11.6,y-15],[x+10,y-14]],'#1e1e22');rc(x+9,y-16.6,2,1.8,'#f2d58a');}},
    tile(x,y){for(let r=-2;r<=2;r++)ln(x-14+Math.abs(r)*3.5,y+r*1.8,x+14-Math.abs(r)*3.5,y+r*1.8,'rgba(0,0,0,0.08)',0.5);},tree:'ptree'}};

/* ---------- برمنغهام الصناعية: بيوت طوب متلاصقة بمداخن، مصانع بأسقف منشارية ومداخن شاهقة، قناة بقوارب ضيقة ملونة، حانة؛ والمعلم مصنع بمدخنة عملاقة ---------- */
function smoke(x,y,n){const ctx=getCtx();for(let k=0;k<n;k++){ctx.save();ctx.globalAlpha=0.32-k*0.05;el(x+k*2.2,y-k*3.6,2+k*0.9,1.6+k*0.7,'#5a5652');ctx.restore();}}
function terrace(x,y,i,j,T){const w=16,d=8,h=17,L='#7a3428',R='#934236';box(x,y,w,d,h,L,R);
  for(let k=0;k<3;k++){const u=0.06+k*0.32;wR(x,y,w,d,u,0,0.1,6,'#2a3a46');wR(x,y,w,d,u+0.14,2.4,0.12,3.6,'#e8e0cc');wR(x,y,w,d,u+0.15,2.8,0.1,2.8,'#34444e');
    wR(x,y,w,d,u+0.04,10,0.18,4,'#e8e0cc');wR(x,y,w,d,u+0.05,10.4,0.16,3.2,hsh(i,j,920+k)<0.2?'#e8c56a':'#34444e');}
  for(let k=0;k<3;k++)wL(x,y,w,d,0.1+k*0.3,9,0.14,3.6,'#2c3a44');damage(x,y,w,d,h,i,j,T);
  const r=ridgeRoof(x,y,w,d,h,7,{front:'#4a4f56',back:'#2e3238',k:0.92,tile:'rgba(0,0,0,0.22)'});
  [0.2,0.55,0.9].forEach(t=>{const P=lpc(r.P1,r.P2,t);box(P[0],P[1]+1,1.4,0.7,4,'#6e2e24','#843a2e','#5a2a22');for(let k=0;k<2;k++)rc(P[0]-0.8+k*1,P[1]-4.6,0.7,1.4,'#b8643a');if(hsh(i,j,925+t*10)<0.35)smoke(P[0],P[1]-6,3);});}
function factory(x,y,i,j,T){const w=16,d=8,h=13;box(x,y,w,d,h,'#6e3a2e','#874538');const qa=qL(x,y,w,d);
  for(let k=0;k<5;k++){wR(x,y,w,d,0.06+k*0.19,4,0.12,5,'#2c3a44');wL(x,y,w,d,0.06+k*0.19,4,0.12,5,'#26323a');}
  for(let k=0;k<4;k++){const u0=k/4,u1=(k+1)/4,A=qa(u0,h),B=qa(u1,h),Ap=[A[0]+w*0.5,A[1]-d*0.5],Bp=[B[0]+w*0.5,B[1]-d*0.5];
    poly([A,[A[0]+1,A[1]-5],[Ap[0]+1,Ap[1]-5],Ap],'#4a4f56');poly([[A[0]+1,A[1]-5],B,Bp,[Ap[0]+1,Ap[1]-5]],'#9ab0c0');}
  damage(x,y,w,d,h,i,j,T);const C=qa(0.85,h);box(C[0]+4,C[1]+1,1.8,0.9,22,'#6e2e24','#843a2e','#3a2a26');smoke(C[0]+4,C[1]-23,5);}
function pub(x,y,i,j,T){const w=14,d=7,h=14;box(x,y,w,d,h,'#2f4a3a','#3a5a46');wR(x,y,w,d,0.1,0,0.8,9,'#3a5a46');wR(x,y,w,d,0.12,2,0.3,5,'#e8c56a');wR(x,y,w,d,0.58,2,0.3,5,'#e8c56a');
  wR(x,y,w,d,0.1,9.4,0.8,2,'#c9a04a');const S=qR(x,y,w,d)(1,10);ln(S[0],S[1],S[0]+4,S[1]-2,'#1e1e22',0.7);rc(S[0]+2.4,S[1]-1.6,3,3.6,'#7a1f2a');damage(x,y,w,d,h,i,j,T);
  ridgeRoof(x,y,w,d,h,6,{front:'#4a4f56',back:'#2e3238',k:0.9,tile:'rgba(0,0,0,0.22)'});}
// مصباح غاز (شجرة المدينة: زينة الأحياء الصغيرة وحافة الشارع)
function lamp(x,y){ln(x,y+2,x,y-15,'#1e1e22',1);poly([[x-1.6,y-15],[x,y-18],[x+1.6,y-15],[x,y-14]],'#1e1e22');rc(x-1,y-16.4,2,1.6,'#f2d58a');}
export const birmingham={name:'برمنغهام — بريطانيا',ground:'#7a7a70',road:'#5e5b56',road2:'#56534e',plaza:'#8a867c',debris:'#7a5a4a',wallL:'#7a3428',wallR:'#934236',car:['#2a2a2c','#3a3a3e','#1e1e20'],
  waterCol:'#4a5e62',
  pool:[['terrace',44],['factory',14],['pub',8],['ruin',12],['.',4]],
  draw:{terrace,factory,pub,lamp,
    water(x,y,i,j){for(let k=0;k<3;k++)ln(x-8+k*5,y-2+k*1.5,x-3+k*5,y-0.5+k*1.5,'rgba(255,255,255,0.14)',0.6);
      if(hsh(i,j,930)<0.5){const cl=[['#2f5a3a','#c9302a'],['#7a1f2a','#e0b23a'],['#2a3e6a','#d9d4c8']][Math.floor(hsh(i,j,931)*3)];
        poly([[x-12,y+4],[x+8,y-6],[x+11,y-4.6],[x-9,y+5.4]],cl[0]);poly([[x-10,y+2.4],[x+5,y-5],[x+5,y-7.6],[x-10,y-0.2]],cl[1]);poly([[x-10,y-0.2],[x+5,y-7.6],[x+6.4,y-7],[x-8.6,y+0.4]],'#2a2a2e');}},
    landmark(x,y,i,j,T){const w=17,d=8.5,h=30;box(x,y,w,d,h,'#6e3a2e','#874538');const qb=qR(x,y,w,d);
      for(let r=0;r<5;r++)for(let k=0;k<6;k++){wR(x,y,w,d,0.05+k*0.16,3+r*5.6,0.1,3.6,hsh(i,j,940+r*6+k)<0.12?'#e8c56a':'#2c3a44');wL(x,y,w,d,0.05+k*0.16,3+r*5.6,0.1,3.6,'#26323a');}
      ln(...qb(0,h),...qb(1,h),'#c9b8a0',1.1);damage(x,y,w,d,h,i,j,T);ridgeRoof(x,y,w,d,h,5,{front:'#4a4f56',back:'#2e3238',k:0.95,tile:'rgba(0,0,0,0.2)'});
      const C=[x-10,y-2];const H=72;poly([[C[0]-3,C[1]],[C[0]+3,C[1]+1.5],[C[0]+2,C[1]+1-H],[C[0]-2,C[1]-H]],'#843a2e');poly([[C[0]-3,C[1]],[C[0]-2,C[1]-H],[C[0]-0.4,C[1]-H-0.4],[C[0],C[1]+0.6]],'#6e2e24');
      for(let k=0;k<6;k++)ln(C[0]-2.8+k*0.1,C[1]-k*12,C[0]+2.8-k*0.15,C[1]+1.4-k*12,'rgba(0,0,0,0.2)',0.5);el(C[0],C[1]-H,2.4,1,'#3a2a26');smoke(C[0],C[1]-H-3,6);},
    plazaProp(x,y){el(x,y+1,9,4.5,'#77736b');box(x,y,2,1,6,'#6a6660','#7a766e','#8a867c');for(let k=0;k<3;k++)ln(x-4+k*4,y+3-k*2,x-4+k*4,y-1-k*2,'#1e1e22',0.6);},
    roadProp(x,y,i,j){if((i*5+j*3)%7===0)lamp(x+10,y);},tree:'lamp'}};

/* مبانٍ محلية لروتنبورغ (بطلب المستخدم، مع توسعة المدينة): مخبز بلافتة الكعك المعلقة، ومقهى بحديقة وطاولات
   ومظلات، وقاعة سوق بأروقة حجرية وطابق بإطارات خشبية. timber: الإطار الخشبي على وجهي مكعب (كبيوت fach) */
function timber(x,y,w,d,h,B){const qa=qL(x,y,w,d),qb=qR(x,y,w,d);
  [0,0.25,0.5,0.75,1].forEach(u=>{let a=qa(u,0),b=qa(u,h);ln(a[0],a[1],b[0],b[1],B,0.9);a=qb(u,0);b=qb(u,h);ln(a[0],a[1],b[0],b[1],B,0.9);});
  let a=qa(0,h*0.5),b=qa(1,h*0.5);ln(a[0],a[1],b[0],b[1],B,0.8);a=qb(0,h*0.5);b=qb(1,h*0.5);ln(a[0],a[1],b[0],b[1],B,0.8);
  [[0,0.25],[0.75,1]].forEach(([u1,u2])=>{let p=qb(u1,0),q2=qb(u2,h*0.5);ln(p[0],p[1],q2[0],q2[1],B,0.6);p=qb(u2,0);q2=qb(u1,h*0.5);ln(p[0],p[1],q2[0],q2[1],B,0.6);});}
const ROOF_R={front:'#9a4434',back:'#5a2a22',gable:true,eave:'#4a3020',tile:'rgba(0,0,0,0.2)'};
// مخبز: طابق حجري بواجهة عرض مضيئة وخبز، وطابق بإطار خشبي وأحواض زهور، ولافتة حديد بكعكة بريتزل ذهبية
function bakery(x,y,i,j,T){const w=13,d=6.5,h=10,c=hsh(i,j,970)<0.5?'#efe6d2':'#e8d8b8',B='#4a3020';
  box(x,y,w,d,h,mixc(c,'#000000',0.12),c);const qb=qR(x,y,w,d);
  wR(x,y,w,d,0.08,0.6,0.5,5.4,'#3a2a22');wR(x,y,w,d,0.1,1,0.46,4.6,'#f2d58a');
  for(let k=0;k<3;k++){const P=qb(0.15+k*0.13,2);el(P[0],P[1]-0.5,0.9,0.6,'#b8743a');}
  arch(qb,0.66,0.2,7,'#4a3326');
  const W=w+0.8,D=d+0.4;box(x,y-h,W,D,9,mixc(c,'#000000',0.08),c);timber(x,y-h,W,D,9,B);
  wR(x,y-h,W,D,0.3,3,0.14,4,'#3a5466');wR(x,y-h,W,D,0.56,3,0.14,4,'#3a5466');wL(x,y-h,W,D,0.4,3,0.16,4,'#2e4552');
  wR(x,y-h,W,D,0.28,2.2,0.18,0.9,'#c8463a');wR(x,y-h,W,D,0.54,2.2,0.18,0.9,'#d86a8a');
  damage(x,y,w,d,h,i,j,T);ridgeRoof(x,y-h,W,D,9,13,Object.assign({wallEnd:c},ROOF_R));
  const S=qb(0.98,8.4);ln(S[0],S[1],S[0]+5,S[1]-2.4,'#1e1e22',0.7);ln(S[0]+1,S[1]-1.1,S[0]+3.2,S[1]+0.4,'#1e1e22',0.4);
  const ctx=getCtx(),px=S[0]+4,py=S[1]-0.2;ctx.beginPath();ctx.ellipse(px-0.9,py+1.2,1.1,1.3,0,0,TAU);ctx.moveTo(px+2,py+1.2);ctx.ellipse(px+0.9,py+1.2,1.1,1.3,0,0,TAU);
  ctx.strokeStyle=paint('#c9a04a');ctx.lineWidth=0.7;ctx.stroke();}
// مقهى بحديقة: بيت صغير بإطار خشبي، وأمامه طاولتان طويلتان بمظلتين ملونتين
const PARASOL=[['#c8322a','#f2ede0'],['#2f6e4e','#f2ede0']],PARASOL_ORDER=[3,4,5,0,1,2];
function rcafe(x,y,i,j,T){const w=11,d=5.5,h=9,c='#f2e6c8',B='#4a3020';box(x,y,w,d,h,mixc(c,'#000000',0.12),c);timber(x,y,w,d,h,B);
  const qb=qR(x,y,w,d);wR(x,y,w,d,0.1,0.8,0.3,4.8,'#3a5466');wR(x,y,w,d,0.1,1.4,0.3,1.4,'#f2d58a');wR(x,y,w,d,0.55,0,0.22,6.4,'#4a3326');
  damage(x,y,w,d,h,i,j,T);ridgeRoof(x,y,w,d,h,11,Object.assign({wallEnd:c},ROOF_R));
  for(let k=0;k<2;k++){const P=qb(0.25+k*0.5,0),tx=P[0]+3.4,ty=P[1]+5.4,pc=PARASOL[(k+Math.floor(hsh(i,j,971)*2))%2];
    el(tx,ty+0.8,4.4,1.6,'rgba(0,0,0,0.16)');
    poly([[tx-3.2,ty-1.6],[tx+1.6,ty-4],[tx+3.2,ty-3.2],[tx-1.6,ty-0.8]],'#8a6440');
    ln(tx-2.4,ty-1.2,tx-2.4,ty+0.6,'#5a4030',0.6);ln(tx+2.4,ty-3.6,tx+2.4,ty-1.8,'#5a4030',0.6);ln(tx,ty-2.4,tx,ty-10,'#5a4030',0.6);
    for(const s of PARASOL_ORDER){const a0=s/6*TAU,a1=(s+1)/6*TAU;poly([[tx,ty-12],[tx+Math.cos(a0)*5,ty-9.6+Math.sin(a0)*2.4],[tx+Math.cos(a1)*5,ty-9.6+Math.sin(a1)*2.4]],pc[s%2]);}}}
// قاعة السوق: أروقة حجرية مقوسة بمظلات البسطات في داخلها، وطابق بإطار خشبي، وبسطة فاكهة بمظلة مخططة أمامها
function markthalle(x,y,i,j,T){const w=14,d=7,h=8,c='#efe6d2',B='#4a3020';box(x,y,w,d,h,'#a8987c','#c0b194');const qb=qR(x,y,w,d),qa=qL(x,y,w,d);
  for(let k=0;k<3;k++)arch(qb,0.06+k*0.32,0.26,6.8,'#2a2420');for(let k=0;k<2;k++)arch(qa,0.1+k*0.46,0.34,6.8,'#241e1a');
  const can=['#c8322a','#e8c23a','#2f6e4e'];
  for(let k=0;k<3;k++){const P=qb(0.19+k*0.32,2.6);poly([[P[0]-1.6,P[1]],[P[0]+1.6,P[1]-0.8],[P[0]+1.6,P[1]+0.6],[P[0]-1.6,P[1]+1.4]],can[k]);}
  const W=w+0.8,D=d+0.4;box(x,y-h,W,D,10,mixc(c,'#000000',0.08),c);timber(x,y-h,W,D,10,B);
  for(let k=0;k<3;k++)wR(x,y-h,W,D,0.12+k*0.3,3.2,0.14,4,'#3a5466');for(let k=0;k<2;k++)wL(x,y-h,W,D,0.22+k*0.44,3.2,0.16,4,'#2e4552');
  damage(x,y,w,d,h,i,j,T);ridgeRoof(x,y-h,W,D,10,15,Object.assign({wallEnd:c},ROOF_R));
  const P=qb(0.5,0),sx=P[0]+3.6,sy=P[1]+4.6;box(sx,sy,3.2,1.6,2.4,'#7a5a3a','#8e6a46','#a07a52');
  for(let k=0;k<3;k++)circ(sx-1.4+k*1.4,sy-2.9+k*0.2,0.55,['#d9463b','#6fa04a','#e8a33a'][k]);
  ln(sx-3,sy-1,sx-3,sy-6.4,'#5a4030',0.5);ln(sx+3,sy-2.6,sx+3,sy-8,'#5a4030',0.5);
  for(let k=0;k<4;k++){const u0=k/4,u1=(k+1)/4;poly([[sx-3.6+7.2*u0,sy-6.6-3.2*u0],[sx-3.6+7.2*u1,sy-6.6-3.2*u1],[sx-3.6+7.2*u1,sy-5-3.2*u1],[sx-3.6+7.2*u0,sy-5-3.2*u0]],k%2?'#f2ede0':'#c8322a');}}

/* ---------- روتنبورغ: بيوت بإطارات خشبية وواجهات مثلثة ملونة بأسقف قرميد حادة، سور المدينة المسقوف، بئر؛ والمعلم برج البوابة والبيت الأصفر الشهير ----------
   مبانيها الأوروبية من الطابع الأوروبي نفسه (THEMES.europe: صف البيوت والإطارات الخشبية والواجهة المدرّجة والشجرة) */
export const rothenburg={name:'روتنبورغ — ألمانيا',ground:'#8d9277',road:'#7a766f',road2:'#6f6b65',plaza:'#a19b8e',debris:'#8a8378',wallL:'#a9967a',wallR:'#bfad90',
  pool:[['fach',20],['row',12],['rowStep',6],['bakery',10],['rcafe',10],['markthalle',6],['wallSeg',4],['rtree',10],['ruin',8],['.',6]],
  draw:{bakery,rcafe,markthalle,fach:(...a)=>THEMES.europe.draw.fach(...a),row:(...a)=>THEMES.europe.draw.row(...a),rowStep:(...a)=>THEMES.europe.draw.rowStep(...a),rtree:(...a)=>THEMES.europe.draw.tree(...a),
    wallSeg(x,y,i,j,T){box(x,y,16,8,12,'#a8987c','#bcad90');for(let r=0;r<3;r++)for(let k=0;k<6;k++)wR(x,y,16,8,k/6+(r%2)*0.08,1+r*3.6,0.14,2.6,r%2?'#b4a486':'#c4b598');
      for(let k=0;k<4;k++)wR(x,y,16,8,0.1+k*0.24,9,0.06,1.8,'#2a2420');ridgeRoof(x,y,16,8,12,6,{front:'#9a4434',back:'#5a2a22',k:0.95,tile:'rgba(0,0,0,0.2)'});damage(x,y,16,8,12,i,j,T);},
    landmark(x,y,i,j,T){ // برج البوابة الحجري بقمة حادة وممر مقوّس، وأمامه البيت الأصفر بإطاراته الخشبية
      const S1='#a8987c',S2='#c0b194';box(x-6,y-3,6,3,40,S1,S2);arch(qR(x-6,y-3,6,3),0.2,0.6,12,'#2a2420');for(let k=0;k<3;k++)wR(x-6,y-3,6,3,0.4,18+k*7,0.2,3.4,'#2a2420');
      hipRoof(x-6,y-3,6,3,40,14,'#8a3e2e','#a84a36');el(...qR(x-6,y-3,6,3)(0.5,34),1.8,2,'#f2ede0');
      const Y='#e8c25a',B='#4a3020',w=10,d=5,h=12;box(x+7,y+4,w,d,h,mixc(Y,'#000000',0.18),Y);const qa=qL(x+7,y+4,w,d),qb=qR(x+7,y+4,w,d);
      [0,0.33,0.66,1].forEach(u=>{let a=qb(u,0),b=qb(u,h);ln(a[0],a[1],b[0],b[1],B,0.8);a=qa(u,0);b=qa(u,h);ln(a[0],a[1],b[0],b[1],B,0.8);});
      ln(...qb(0,h/2),...qb(1,h/2),B,0.7);ln(...qa(0,h/2),...qa(1,h/2),B,0.7);wR(x+7,y+4,w,d,0.4,7,0.2,3,'#3f5868');
      ridgeRoof(x+7,y+4,w,d,h,13,{front:'#9a4434',back:'#5a2a22',gable:true,wallEnd:Y,eave:B,tile:'rgba(0,0,0,0.2)'});damage(x+7,y+4,w,d,h,i,j,T);},
    plazaProp(x,y){el(x,y+1,7,3.5,'#8f8a80');box(x,y,4,2,3,'#9a8e76','#b0a48a','#5f7f8c');ln(x-3,y-3,x-3,y-11,'#4a3020',0.8);ln(x+3,y-1,x+3,y-9,'#4a3020',0.8);
      ridgeRoof(x,y-9,4.4,2.2,0.1,3,{front:'#9a4434',back:'#5a2a22',k:0.9});},
    roadProp:(...a)=>THEMES.europe.draw.roadProp(...a),tile:(...a)=>THEMES.europe.draw.tile(...a),tree:'rtree'}};
