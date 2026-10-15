// مدن الأمم العربية (المرحلة 9أ، القسم 3.10): شبام (اليمن)، الدرعية (السعودية)، القاهرة القديمة (مصر).
// منقولة كما هي من docs/nations/batch1-cities.js بأدوات cityThemes.js نفسها، فيعمل عليها كل ما في القسم 3.9:
// التخزين المؤقت في قطع، وصبغ المالك والطقس (كل لون يمر عبر paint() داخل الأدوات)، والمباني الحاسمة
// بعلاماتها (CITY_SPECIALS في config.js). الفرق الوحيد: لوحة الرسم من getCtx() بدل المتغير ctx.
import { getCtx, poly, circ, ln, rc, el, box, qL, qR, wL, wR, arch, dome, damage, hsh, mixc } from './cityThemes.js';

/* ---------- شبام: أبراج طين متلاصقة، أعلاها مطلي بالجير الأبيض، الطوابق السفلى بلا نوافذ ---------- */
function shibamTower(x,y,i,j,T,hMin,hVar){const h=hMin+Math.floor(hsh(i,j,700)*4)*hVar,w=12,d=6,cl=hsh(i,j,701)<0.5?['#a57f55','#b98f62','#ad8659']:['#9c774f','#b0885c','#a47e53'];
  box(x,y,w,d,h,cl[0],cl[1]);const wb=h*(0.62+hsh(i,j,702)*0.12);
  wL(x,y,w,d,0,wb,1,h-wb,'#e2dbcd');wR(x,y,w,d,0,wb,1,h-wb,'#f1ebdf');poly([[x-w,y-h],[x,y-d-h],[x+w,y-h],[x,y+d-h]],'#ebe4d6');
  for(let r=0;r<Math.floor((h-h*0.38)/5);r++){const v=h*0.36+r*5;
    for(let k=0;k<2;k++){const u=0.2+k*0.42,inW=v+3>wb;wR(x,y,w,d,u-0.03,v-0.5,0.2,3.6,inW?'#d8d0c0':'#e6dccb');wR(x,y,w,d,u,v,0.14,2.6,'#3a2c20');
      wL(x,y,w,d,u-0.03,v-0.5,0.2,3.6,inW?'#cfc6b4':'#ddd2bf');wL(x,y,w,d,u,v,0.14,2.6,'#33261b');}}
  [[x-w,y],[x,y-d],[x+w,y],[x,y+d]].forEach(([cx,cy],k)=>{if(k===1)return;poly([[cx-1,cy-h],[cx,cy-h-3.2],[cx+1,cy-h]],'#f4eee2');});
  wR(x,y,w,d,0.42,0,0.16,5.4,'#4a3424');damage(x,y,w,d,h,i,j,T);}
export const shibam={name:'شبام — اليمن',ground:'#c9a979',road:'#b8976a',road2:'#ad8d61',plaza:'#d6ba8e',debris:'#b08a5e',wallL:'#a57f55',wallR:'#b98f62',
  pool:[['tower',52],['towerLow',16],['palm',6],['ruin',10],['.',4]],
  draw:{tower:(x,y,i,j,T)=>shibamTower(x,y,i,j,T,34,6),towerLow:(x,y,i,j,T)=>shibamTower(x,y,i,j,T,24,4),
    palm(x,y,i,j){const ctx=getCtx(),o=((i*3+j)%3)-1;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+o*3,y-12,x+o*2,y-22);ctx.strokeStyle='#8a6a45';ctx.lineWidth=1.8;ctx.stroke();
      const tx=x+o*2,ty=y-22;for(let k=0;k<7;k++){const a=k*0.9+0.2,dx=Math.cos(a)*9,dy=Math.sin(a)*3.5+2;poly([[tx,ty],[tx+dx,ty+dy],[tx+dx*0.55,ty+dy-1.6]],k%2?'#5f8a3a':'#4d7a30');}},
    landmark(x,y,i,j,T){const w=17,d=8.5,h=30;box(x,y,w,d,h,'#a37d53','#b78d60');wL(x,y,w,d,0,h*0.7,1,h*0.3,'#e2dbcd');wR(x,y,w,d,0,h*0.7,1,h*0.3,'#f1ebdf');
      poly([[x-w,y-h],[x,y-d-h],[x+w,y-h],[x,y+d-h]],'#ebe4d6');
      for(let r=0;r<3;r++)for(let k=0;k<4;k++){wR(x,y,w,d,0.1+k*0.22,12+r*5.5,0.1,2.8,'#3a2c20');wL(x,y,w,d,0.1+k*0.22,12+r*5.5,0.1,2.8,'#33261b');}
      [[-w+3,-1.5],[w-3,-1.5],[0,d-1.5]].forEach(([dx,dy])=>{const X=x+dx,Y=y+dy;box(X,Y,3,1.5,h+9,'#a37d53','#b78d60');wL(X,Y,3,1.5,0,h+2,1,7,'#e2dbcd');wR(X,Y,3,1.5,0,h+2,1,7,'#f1ebdf');
        poly([[X-3,Y-h-9],[X,Y-1.5-h-9],[X+3,Y-h-9],[X,Y+1.5-h-9]],'#ebe4d6');poly([[X-1,Y-h-9],[X,Y-h-12],[X+1,Y-h-9]],'#f4eee2');});
      arch(qR(x,y,w,d),0.36,0.2,9,'#3a2a1c');damage(x,y,w,d,h,i,j,T);},
    plazaProp(x,y){el(x,y+1,8,4,'#b39668');box(x,y,3,1.5,4,'#a37d53','#b78d60','#c49a6c');el(x,y-4,2.2,1,'#5f8f9c');},
    roadProp(x,y,i,j){if(hsh(i,j,710)<0.12){ln(x-14,y-26,x+14,y-38,'rgba(70,50,30,0.6)',0.4);}},tree:'palm'}};

/* ---------- الدرعية: طين نجدي، شرفات مثلثة متدرجة، فتحات تهوية مثلثة، أبواب خشبية ملونة، أبراج مراقبة مخروطية، نخيل؛ والمعلم واجهة نبطية صخرية ---------- */
function najdiTop(x,y,w,d,h,col){const qa=qL(x,y,w,d),qb=qR(x,y,w,d);
  for(let k=0;k<6;k++){const u=(k+0.5)/6;let P=qa(u,h),Q=qa(u-0.07,h),R=qa(u+0.07,h);poly([Q,[P[0],P[1]-2.8],R],col);P=qb(u,h);Q=qb(u-0.07,h);R=qb(u+0.07,h);poly([Q,[P[0],P[1]-2.8],R],col);}}
function triVents(f,u0,v,n,col){for(let k=0;k<n;k++){const u=u0+k*0.12;const A=f(u,v),B=f(u+0.07,v),C=f(u+0.035,v+1.8);poly([A,B,C],col);}}
function najdi(x,y,i,j,T,tall){const h=tall?22:13+Math.floor(hsh(i,j,720)*2)*4,w=14,d=7,L='#b98c5e',R='#cfa274';box(x,y,w,d,h,L,R,'#c49868');
  const qb=qR(x,y,w,d),qa=qL(x,y,w,d);triVents(qb,0.12,h-4.5,6,'#5a3e26');triVents(qa,0.12,h-4.5,6,'#4e3620');if(tall){triVents(qb,0.2,h-11,5,'#5a3e26');}
  for(let k=0;k<4;k++){const P=qa(0.15+k*0.24,h-1.2);ln(P[0],P[1],P[0]-2.4,P[1]+1.2,'#6a4a2e',1.1);}
  wR(x,y,w,d,0.38,0,0.22,7,'#6a4a2a');const dc=['#b8322c','#2f6e4e','#d9a43a','#2f4a7a'];for(let k=0;k<4;k++)poly([qb(0.4+k*0.045,5.2),qb(0.43+k*0.045,5.2),qb(0.415+k*0.045,6.4)],dc[(k+i+j)%4]);
  najdiTop(x,y,w,d,h,'#c99d6e');damage(x,y,w,d,h,i,j,T);}
function najdiTower(x,y,i,j,T){const h=32,b0=6,b1=4,d0=3,d1=2;poly([[x-b0,y],[x,y+d0],[x,y+d1-h],[x-b1,y-h]],'#b3875a');poly([[x,y+d0],[x+b0,y],[x+b1,y-h],[x,y+d1-h]],'#c99b6d');
  poly([[x-b1,y-h],[x,y-d1-h],[x+b1,y-h],[x,y+d1-h]],'#c09264');for(let k=0;k<4;k++){const yy=y-6-k*6.5;poly([[x+1,yy+0.6],[x+2.4,yy-0.1],[x+1.7,yy-1.9]],'#5a3e26');}
  [[x-b1,y-h],[x,y-d1-h],[x+b1,y-h],[x,y+d1-h]].forEach(([cx,cy])=>poly([[cx-1,cy],[cx,cy-2.8],[cx+1,cy]],'#c99d6e'));damage(x,y,b0,d0,h*0.6,i,j,T);}
export const diriyah={name:'الدرعية — السعودية',ground:'#d4b48c',road:'#c2a079',road2:'#b8966f',plaza:'#dcc29c',debris:'#b8935f',wallL:'#b98c5e',wallR:'#cfa274',
  pool:[['najdi',36],['najdiTall',18],['tower',8],['palm',18],['ruin',10],['.',6]],
  draw:{najdi:(x,y,i,j,T)=>najdi(x,y,i,j,T,false),najdiTall:(x,y,i,j,T)=>najdi(x,y,i,j,T,true),tower:najdiTower,
    palm(x,y,i,j){const ctx=getCtx();for(let n=0;n<2;n++){const ox=n?5:-4,oy=n?2:-1,o=((i*3+j+n)%3)-1;ctx.beginPath();ctx.moveTo(x+ox,y+oy);ctx.quadraticCurveTo(x+ox+o*3,y+oy-12,x+ox+o*2,y+oy-21+n*3);
      ctx.strokeStyle='#8a6a45';ctx.lineWidth=1.7;ctx.stroke();const tx=x+ox+o*2,ty=y+oy-21+n*3;for(let k=0;k<7;k++){const a=k*0.9+0.2,dx=Math.cos(a)*8,dy=Math.sin(a)*3.2+2;poly([[tx,ty],[tx+dx,ty+dy],[tx+dx*0.55,ty+dy-1.5]],k%2?'#5f8a3a':'#4d7a30');}
      circ(tx,ty+1.5,1.2,'#a8622e');}},
    landmark(x,y,i,j,T){ // واجهة نبطية منحوتة في جرف رملي
      poly([[x-19,y+1],[x-21,y-18],[x-16,y-34],[x-6,y-42],[x+2,y-38],[x+4,y+10]],'#b37a48');
      poly([[x+4,y+10],[x+2,y-38],[x+10,y-44],[x+19,y-30],[x+21,y-12],[x+19,y+1]],'#d29a64');
      poly([[x-6,y-42],[x+2,y-38],[x+10,y-44],[x+1,y-47]],'#c08452');
      const q=(u,v)=>[x+3+u*15,y+7-u*8-v];poly([q(0.08,0),q(0.92,0),q(0.92,26),q(0.08,26)],'#c48956');
      [0.12,0.84].forEach(u=>poly([q(u,0),q(u+0.06,0),q(u+0.06,24),q(u,24)],'#dcab78'));
      poly([q(0.36,0),q(0.64,0),q(0.64,10),q(0.36,10)],'#4a2e1c');poly([q(0.32,10.6),q(0.68,10.6),q(0.5,14)],'#dcab78');
      [[0.1,0.3],[0.7,0.9]].forEach(([u0,u1])=>{for(let s=0;s<4;s++){const a=u0+(u1-u0)*s/8,b=u1-(u1-u0)*s/8;poly([q(a,26+s*2),q(b,26+s*2),q(b,28+s*2),q(a,28+s*2)],'#dcab78');}});
      poly([q(0.08,25.4),q(0.92,25.4),q(0.92,26.4),q(0.08,26.4)],'#a86f40');damage(x,y,8,4,22,i,j,T);},
    plazaProp(x,y){el(x,y+1,9,4.5,'#c2a079');box(x,y,2.4,1.2,7,'#b98c5e','#cfa274','#c49868');poly([[x-3.6,y-7],[x,y-9],[x+3.6,y-7],[x,y-5.2]],'#8a6a45');},
    roadProp(x,y,i,j){if(hsh(i,j,730)<0.15){ln(x+9,y+2,x+9,y-13,'#5a4632',1);el(x+9,y-14,1.6,2,'#e8b24a');}},tree:'palm'}};

/* ---------- القاهرة القديمة: حارات، قاعدة حجرية وجدران ملونة بالجص، مشربيات بارزة، أبراج حمام على الأسطح، قهوة شعبية، وكالة بأقواس؛ والمعلم بوابة الفتوح ---------- */
const CAI=['#d9b98a','#e3c79c','#cfae86','#c9a27a','#dcc4a2'];
const lpx=(A,B,t)=>[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t];
function mashrabiya(P){const X=P[0]+2,Y=P[1]+1.2;box(X,Y,3.6,1.8,7,'#4e3220','#654128','#3e2818');
  for(let r=0;r<4;r++)for(let k=0;k<3;k++){const u=0.15+k*0.28,v=1+r*1.5;wR(X,Y,3.6,1.8,u,v,0.12,0.7,'#8a6a44');}}
function cairoHouse(x,y,i,j,T){const c=CAI[Math.floor(hsh(i,j,740)*CAI.length)],h=22+Math.floor(hsh(i,j,741)*3)*5,w=13,d=6.5;box(x,y,w,d,h,mixc(c,'#000000',0.18),c,mixc(c,'#000000',0.08));
  wL(x,y,w,d,0,0,1,5,'#b3a07c');wR(x,y,w,d,0,0,1,5,'#c9b590');const qb=qR(x,y,w,d),qa=qL(x,y,w,d);
  arch(qb,0.12,0.2,5,'#3e2a1a');for(let r=0;r<Math.floor((h-8)/6);r++){const v=8+r*6;wR(x,y,w,d,0.68,v,0.16,3.4,'#2f5a4a');wL(x,y,w,d,0.3,v,0.16,3.4,'#294f42');wL(x,y,w,d,0.7,v,0.16,3.4,'#294f42');}
  mashrabiya(qb(0.36,h*0.55));poly([[x-w,y-h],[x,y-d-h],[x+w,y-h],[x+w,y-h-1.4],[x,y-d-h-1.4],[x-w,y-h-1.4]],mixc(c,'#000000',0.12));
  if(hsh(i,j,742)<0.35){const P=qa(0.5,h);box(P[0]+3,P[1]-2,3,1.5,7,'#7a5a3a','#8e6a46');for(let k=0;k<3;k++)ln(P[0]+3-3+k*2,P[1]-2-1-k*0.9,P[0]+3-3+k*2,P[1]-2-7-k*0.9,'#d8c8a8',0.4);}
  if(hsh(i,j,743)<0.4){const A=qb(0.05,h-3),B=qb(0.95,h-6);ln(A[0],A[1],B[0],B[1],'#5a4a3a',0.3);for(let k=0;k<4;k++){const P=lpx(A,B,0.2+k*0.2);rc(P[0]-0.8,P[1],1.6,2.2,['#c4402e','#2f6e8e','#e8d8b0','#4a8a4e'][k]);}}
  damage(x,y,w,d,h,i,j,T);}
export const cairo={name:'القاهرة القديمة — مصر',ground:'#c4ad86',road:'#ad9672',road2:'#a38c69',plaza:'#cfba94',debris:'#a89070',wallL:'#b89a74',wallR:'#ceb08a',
  pool:[['house',44],['wikala',12],['ahwa',10],['ruin',12],['.',4]],
  draw:{house:cairoHouse,
    wikala(x,y,i,j,T){const w=15,d=7.5,h=16;box(x,y,w,d,h,'#bfa47c','#d6bb92','#c9ae86');const qb=qR(x,y,w,d),qa=qL(x,y,w,d);
      for(let k=0;k<4;k++){arch(qb,0.05+k*0.235,0.17,7,'#3a2a1c');arch(qa,0.05+k*0.235,0.17,7,'#33251a');}mashrabiya(qb(0.4,10));damage(x,y,w,d,h,i,j,T);},
    ahwa(x,y,i,j,T){box(x-3,y-2,11,5.5,10,'#c9a27a','#dcb88e','#cba882');poly([[x-3,y+3.5-8],[x+8,y-2-8],[x+10.5,y-2-5.5],[x-0.5,y+3.5-5.5]],'#2f5a4a');
      [[6,5],[10,2],[2,6]].forEach(([dx,dy])=>{el(x+dx,y+dy,1.6,0.8,'#6a4a2e');ln(x+dx,y+dy,x+dx,y+dy+2.4,'#4a3422',0.5);rc(x+dx+2,y+dy-0.4,1,1.8,'#7a5a3a');});damage(x-3,y-2,11,5.5,10,i,j,T);},
    tree(x,y,i,j){rc(x-1,y-9,2,9,'#5b4636');circ(x,y-14,7,'#5f7f3e');circ(x-3,y-16,5,'#6f8f4a');circ(x+3,y-12,4,'#4f6f34');},
    landmark(x,y,i,j,T){ // بوابة الفتوح: برجان ضخمان وممر مقوّس وشرفات
      const S1='#bfa77e',S2='#d6bf96',S3='#cbb48b';box(x+1,y+0.5,8,4,18,S1,S2,S3);arch(qR(x+1,y+0.5,8,4),0.25,0.5,13,'#2e2218');
      [[-10,-5],[11,5.5]].forEach(([dx,dy])=>{const X=x+dx,Y=y+dy;box(X,Y,6,3,26,S1,S2,S3);
        for(let r=0;r<5;r++)ln(X,Y+3-r*5,X+6,Y-r*5,'rgba(0,0,0,0.12)',0.5);
        for(let k=0;k<4;k++){const u=k/4;box(X-6+u*6+0.8,Y+u*3-26,0.7,0.35,1.8,S1,S2,S3);box(X+u*6+0.8,Y+3-u*3-26,0.7,0.35,1.8,S1,S2,S3);}
        wR(X,Y,6,3,0.4,16,0.2,3,'#2e2218');});
      for(let k=0;k<5;k++){const u=k/5;box(x+1+u*8+0.8,y+4.5-u*4-18,0.7,0.35,1.8,S1,S2,S3);}damage(x+1,y+0.5,8,4,18,i,j,T);},
    plazaProp(x,y){el(x,y+1,9,4.5,'#b39c78');box(x,y,4,2,6,'#bfa77e','#d6bf96','#cbb48b');dome(x,y-6,3.4,'#d6bf96','#bfa77e','#c9a04a');},
    // (في المرجع مفتاح tree:'tree' بعد الدالة يلغيها فتُرسم الشجرة بيتاً؛ الدالة وحدها تكفي كالأوروبية)
    roadProp(x,y,i,j){if((i*5+j*3)%7===0){ln(x+9,y+2,x+9,y-15,'#2b2825',1);poly([[x+7.6,y-15],[x+9,y-19],[x+10.4,y-15],[x+9,y-14]],'#3a3028');rc(x+8.2,y-17.2,1.6,2,'#f2c86a');}}}};
