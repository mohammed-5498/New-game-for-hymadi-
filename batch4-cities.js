/* ===================== مدن الدفعة 4: غوندر (إثيوبيا)، كانو (نيجيريا)، مروي والنوبة (السودان) ===================== */
const THEMES={};
const lpc=(A,B,t)=>[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t];
/* أسطوانة مائلة (أبراج دائرية، أكواخ) ومخروط (أسقف القش) */
function cyl(x,y,r,h,L,R,T){const ry=r*0.5;ctx.beginPath();ctx.moveTo(x-r,y);ctx.lineTo(x-r,y-h);ctx.ellipse(x,y-h,r,ry,0,Math.PI,0,true);ctx.lineTo(x+r,y);ctx.ellipse(x,y,r,ry,0,0,Math.PI);ctx.closePath();
  const g=ctx.createLinearGradient(x-r,0,x+r,0);g.addColorStop(0,L);g.addColorStop(1,R);ctx.fillStyle=g;ctx.fill();if(T)el(x,y-h,r,ry,T);}
function cone(x,y,r,h,L,R){const ry=r*0.5;poly([[x-r,y],[x,y-h],[x,y+ry]],L);poly([[x,y+ry],[x,y-h],[x+r,y]],R);}
function crenelRing(x,y,r,col){for(let k=0;k<8;k++){const a=Math.PI*(k/7);const px=x-Math.cos(a)*r,py=y+Math.sin(a)*r*0.5;rc(px-0.7,py-2,1.4,2,col);}}
/* ---------- غوندر: قلاع حجرية بأبراج دائرية وقباب، أكواخ "توكول" بأسقف قش، أسوار حجرية، أشجار الأكاسيا؛ والمعلم قلعة فاسيليدس ---------- */
function tukul(x,y,i,j,T){const r=7+hsh(i,j,1000)*2;cyl(x,y,r,7,'#9a7450','#c49a6c');wR(x,y,r,r*0.5,0.35,0,0.2,5,'#3a2a1c');
  cone(x,y-7,r+2.4,10,'#a8843e','#c9a25a');for(let k=0;k<4;k++)ln(x-r-2+k*1.2,y-7-k*0.4,x-k*0.3,y-16+k*0.6,'rgba(90,60,20,0.35)',0.5);
  ln(x,y-17,x,y-20,'#5a3a22',0.8);damage(x,y,r*0.7,r*0.35,6,i,j,T);}
function gondarHouse(x,y,i,j,T){const w=13,d=6.5,h=13,S1='#6e5e52',S2='#857266';box(x,y,w,d,h,S1,S2,'#7a6a5c');const qb=qR(x,y,w,d),qa=qL(x,y,w,d);
  arch(qb,0.38,0.2,8,'#2a2018');arch(qa,0.3,0.16,5,'#2a2018');for(let k=0;k<5;k++){const u=k/5+0.06;box(x+u*w+0.6,y+d-u*d-h,0.7,0.35,1.6,S1,S2,'#7a6a5c');}
  wR(x,y,w,d,0,h-1.2,1,1.2,'#8a3a2a');damage(x,y,w,d,h,i,j,T);}
function acacia(x,y,i,j){const o=((i+j)%3)-1;ln(x,y,x+o*2,y-12,'#5a4232',1.6);ln(x+o*2,y-12,x+o*2-5,y-16,'#5a4232',1);ln(x+o*2,y-12,x+o*2+5,y-15,'#5a4232',1);
  el(x+o*2,y-17,11,3,'#5f7a3a');el(x+o*2-1,y-18,8,2,'#6f8a44');}
THEMES.gondar={name:'غوندر — إثيوبيا',ground:'#8f8a5e',road:'#a08a68',road2:'#958060',plaza:'#b09c78',debris:'#7a6a5c',wallL:'#6e5e52',wallR:'#857266',
  pool:[['tukul',30],['stone',22],['acacia',14],['ruin',12],['.',8]],
  draw:{tukul,stone:gondarHouse,acacia,
    landmark(x,y,i,j,T){ // قلعة فاسيليدس: جسم حجري مستطيل بشرفات، برجان دائريان بقباب، نوافذ مقوّسة بإطار أحمر
      const w=15,d=7.5,h=24,S1='#6a5a4e',S2='#827064';box(x,y,w,d,h,S1,S2,'#766658');const qb=qR(x,y,w,d),qa=qL(x,y,w,d);
      for(let r=0;r<2;r++)for(let k=0;k<3;k++){arch(qb,0.12+k*0.3,0.14,5,'#8a3a2a');arch(qb,0.135+k*0.3,0.11,4.2,'#2a2018');arch(qa,0.12+k*0.3,0.14,5,'#7a3424');}
      for(let k=0;k<6;k++){const u=k/6+0.04;box(x+u*w+0.6,y+d-u*d-h,0.8,0.4,2,S1,S2,'#766658');box(x-w+u*w+0.6,y+u*d-h,0.8,0.4,2,S1,S2,'#766658');}
      [[-w+2,-1],[w-2,-1]].forEach(([dx,dy],n)=>{const X=x+dx,Y=y+dy;cyl(X,Y,4.4,h+10,'#5e5046','#8a776a','#766658');crenelRing(X,Y-h-10,4.2,'#6a5a4e');
        dome(X,Y-h-10,3.6,'#7a6a5c','#5e5046');arch((a,b)=>[X+a*3,Y+2-a*1.5-b],0.2,0.5,5,'#2a2018');});
      cyl(x+4,y+3,3,h+16,'#5e5046','#8a776a','#766658');dome(x+4,y+3-h-16,2.6,'#7a6a5c','#5e5046');damage(x,y,w,d,h,i,j,T);},
    plazaProp(x,y){el(x,y+1,9,4.5,'#9a8a6a');[[-4,1],[3,2],[0,-2]].forEach(([dx,dy],k)=>{ln(x+dx,y+dy,x+dx,y+dy-7,'#5a3a22',0.8);tri2(x+dx,y+dy-7,['#2e8b57','#e8c23a','#c8322a'][k]);});},
    roadProp(x,y,i,j){if(hsh(i,j,1010)<0.12){el(x+6,y+1,3,1.4,'#7a6a5c');el(x+6,y-0.4,2.2,1,'#8a7a6c');}},tree:'acacia'}};
function tri2(x,y,col){ctx.beginPath();ctx.ellipse(x,y,4,1.6,0,Math.PI,0);ctx.fillStyle=col;ctx.fill();}
/* ---------- كانو: بيوت طين بطراز الهوسا، نقوش بارزة، زوايا مرفوعة كالقرون (زانكو)، أحواض صباغة نيلية وأقمشة منشورة، أسوار طينية؛ والمعلم بوابة السور ---------- */
function zanko(x,y,w,d,h,col){[[x-w,y],[x+w,y],[x,y+d]].forEach(([cx,cy])=>{poly([[cx-1.4,cy-h],[cx-0.6,cy-h-4.6],[cx+0.4,cy-h-3.2],[cx+1.4,cy-h]],col);});}
function relief(q,u0,v0,col){const P=(u,v)=>q(u0+u,v0+v);ctx.beginPath();const A=P(0,0);ctx.moveTo(A[0],A[1]);for(let k=1;k<=6;k++){const B=P(k*0.05,k%2?2.2:0);ctx.lineTo(B[0],B[1]);}ctx.strokeStyle=col;ctx.lineWidth=0.7;ctx.stroke();
  const C=P(0.15,4.4);ctx.beginPath();ctx.arc(C[0],C[1],1.4,0,TAU);ctx.stroke();}
function hausa(x,y,i,j,T,tall){const w=13,d=6.5,h=tall?20:14,L='#b77a4e',R='#cc8c5c';box(x,y,w,d,h,L,R,'#c08452');const qb=qR(x,y,w,d),qa=qL(x,y,w,d);
  poly([[x-w,y-h],[x,y-d-h],[x+w,y-h],[x+w,y-h-1.6],[x,y-d-h-1.6],[x-w,y-h-1.6]],'#b47a4c');
  relief(qb,0.12,h-8,'#e0a476');relief(qa,0.5,h-8,'#a86e44');arch(qb,0.6,0.2,8,'#3a2418');wL(x,y,w,d,0.2,h*0.55,0.14,3,'#3a2418');
  zanko(x,y,w,d,h,'#c08452');for(let k=0;k<3;k++){const P=qa(0.25+k*0.25,h-1.4);ln(P[0],P[1],P[0]-2,P[1]+1,'#7a5236',0.9);}damage(x,y,w,d,h,i,j,T);}
function dyePits(x,y,i,j){[[-6,0],[2,-3],[6,2],[-1,4]].forEach(([dx,dy],k)=>{el(x+dx,y+dy,3.4,1.7,'#7a5a3e');el(x+dx,y+dy,2.6,1.2,k%2?'#1e2a5e':'#24325e');el(x+dx-0.6,y+dy-0.3,0.8,0.3,'rgba(255,255,255,0.25)');});
  ln(x-12,y-9,x+12,y-15,'#5a4a3a',0.5);ln(x-12,y-9,x-12,y+1,'#5a4a3a',0.7);ln(x+12,y-15,x+12,y-5,'#5a4a3a',0.7);
  for(let k=0;k<4;k++){const t=0.15+k*0.22,px=x-12+24*t,py=y-9-6*t;poly([[px-1.6,py],[px+1.6,py-0.4],[px+1.6,py+4.6],[px-1.6,py+5]],k%2?'#24325e':'#3a4e8e');}}
function baobab(x,y,i,j){poly([[x-3.4,y],[x+3.4,y],[x+2.4,y-12],[x-2.4,y-12]],'#8a7462');for(let k=0;k<5;k++){const a=-2.6+k*0.55;ln(x,y-12,x+Math.cos(a)*7,y-12+Math.sin(a)*5,'#7a6452',1.1);}
  [[-5,-15],[0,-18],[5,-15]].forEach(([dx,dy])=>el(x+dx,y+dy,3.6,1.6,'#6f8a44'));}
THEMES.kano={name:'كانو — نيجيريا',ground:'#c4925e',road:'#b07e52',road2:'#a6764c',plaza:'#cfa070',debris:'#a8744a',wallL:'#b77a4e',wallR:'#cc8c5c',
  pool:[['hausa',32],['hausaTall',14],['dye',8],['baobab',10],['wallK',6],['ruin',12],['.',6]],
  draw:{hausa:(x,y,i,j,T)=>hausa(x,y,i,j,T,false),hausaTall:(x,y,i,j,T)=>hausa(x,y,i,j,T,true),dye:dyePits,baobab,
    wallK(x,y,i,j,T){box(x,y,16,8,10,'#a86e44','#be8256','#b47a4c');for(let k=0;k<6;k++){const u=k/6+0.04;poly([[x+u*16+0.4,y+8-u*8-10],[x+u*16+1.2,y+8-u*8-13],[x+u*16+2,y+8-u*8-10]],'#be8256');}damage(x,y,16,8,10,i,j,T);},
    landmark(x,y,i,j,T){ // بوابة السور (كوفا) بزانكو ونقوش، وأحواض الصباغة أمامها
      const w=15,d=7.5,h=22,L='#a86e44',R='#c08454';box(x,y,w,d,h,L,R,'#b47a4c');const qb=qR(x,y,w,d);arch(qb,0.3,0.4,15,'#2a1a10');
      relief(qb,0.06,h-6,'#e0a476');relief(qb,0.76,h-6,'#e0a476');for(let k=0;k<3;k++)relief(qL(x,y,w,d),0.1+k*0.3,h-7,'#94603a');
      [[x-w,y],[x+w,y],[x,y+d],[x-w*0.5,y+d*0.5],[x+w*0.5,y+d*0.5]].forEach(([cx,cy])=>poly([[cx-1.6,cy-h],[cx-0.6,cy-h-6],[cx+0.6,cy-h-4],[cx+1.6,cy-h]],'#c08454'));
      damage(x,y,w,d,h,i,j,T);},
    plazaProp(x,y,i,j){dyePits(x,y,i,j);},
    roadProp(x,y,i,j){if((i*5+j*3)%8===0){ln(x-14,y-15,x+14,y-15,'#5a4a3a',0.4);for(let k=0;k<6;k++){const px=x-12+k*4.6;poly([[px,y-15],[px+3,y-15],[px+3,y-10],[px,y-10.6]],['#24325e','#c8322a','#e8c23a','#3a4e8e','#2e8b57','#efe9dc'][k]);}}},
    tree:'baobab'}};
/* ---------- مروي والنوبة: بيوت نوبية بيضاء ببوابات مرسومة ملونة، أسقف مقبّبة، نخيل، النيل على الحافة بمراكب شراعية؛ والمعلم أهرامات مروي ---------- */
const NUB=['#2f7fb5','#e8b23a','#2f9a8a','#c8463a'];
function nubian(x,y,i,j,T){const w=13,d=6.5,h=11,c=hsh(i,j,1020)<0.5?'#efe9dc':'#e6d6b8';box(x,y,w,d,h,mixc(c,'#000000',0.14),c,mixc(c,'#000000',0.05));
  const qb=qR(x,y,w,d),ac=NUB[Math.floor(hsh(i,j,1021)*NUB.length)],ac2=NUB[(Math.floor(hsh(i,j,1021)*NUB.length)+1)%NUB.length];
  wR(x,y,w,d,0.28,0,0.44,9.6,ac);arch(qb,0.38,0.24,7.6,'#4a3020');for(let k=0;k<5;k++){const P=qb(0.3+k*0.1,8.8);ctx.beginPath();ctx.arc(P[0],P[1],0.7,0,TAU);ctx.fillStyle=ac2;ctx.fill();}
  for(let k=0;k<3;k++){const A=qb(0.29,1+k*2.4),B=qb(0.36,2.2+k*2.4);poly([A,B,qb(0.29,3.4+k*2.4)],ac2);const C=qb(0.71,1+k*2.4),D=qb(0.64,2.2+k*2.4);poly([C,D,qb(0.71,3.4+k*2.4)],ac2);}
  wL(x,y,w,d,0.3,6,0.14,2.6,'#3a2a20');wL(x,y,w,d,0.62,6,0.14,2.6,'#3a2a20');
  [[-w*0.5,-d*0.5+1],[w*0.5,-d*0.5+1]].forEach(([dx,dy])=>{const X=x+dx*0.6,Y=y+dy;ctx.beginPath();ctx.ellipse(X,Y-h,4.6,4.4,0,Math.PI,0);ctx.fillStyle=mixc(c,'#000000',0.06);ctx.fill();});
  damage(x,y,w,d,h,i,j,T);}
function datePalm(x,y,i,j){const o=((i*3+j)%3)-1;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+o*3,y-12,x+o*2,y-22);ctx.strokeStyle='#8a6a45';ctx.lineWidth=1.8;ctx.stroke();
  const tx=x+o*2,ty=y-22;for(let k=0;k<7;k++){const a=k*0.9+0.2,dx=Math.cos(a)*9,dy=Math.sin(a)*3.5+2;poly([[tx,ty],[tx+dx,ty+dy],[tx+dx*0.55,ty+dy-1.6]],k%2?'#5f8a3a':'#4d7a30');}
  circ(tx-1,ty+2,1.2,'#b8642e');circ(tx+1.2,ty+2.4,1,'#a8582a');}
function pyramid(x,y,b,h,L,R){poly([[x-b,y],[x,y+b*0.5],[x,y-h]],L);poly([[x,y+b*0.5],[x+b,y],[x,y-h]],R);for(let k=1;k<6;k++){const t=k/6;ln(x-b*(1-t),y-h*t,x,y+b*0.5*(1-t)-h*t,'rgba(0,0,0,0.12)',0.4);ln(x,y+b*0.5*(1-t)-h*t,x+b*(1-t),y-h*t,'rgba(0,0,0,0.08)',0.4);}}
THEMES.meroe={name:'مروي والنوبة — السودان',ground:'#d4b47e',road:'#c4a26e',road2:'#ba9866',plaza:'#dcc092',debris:'#b8986a',wallL:'#d6c8aa',wallR:'#e8dcc4',
  waterCol:'#4f8a9a',isWater:(i,j)=>i===10,
  pool:[['nubian',40],['palm',18],['ruin',12],['.',8]],
  draw:{nubian,palm:datePalm,
    water(x,y,i,j){for(let k=0;k<3;k++)ln(x-8+k*5,y-2+k*1.5,x-3+k*5,y-0.5+k*1.5,'rgba(255,255,255,0.2)',0.6);
      if(hsh(i,j,1030)<0.4){poly([[x-7,y+1],[x+6,y-4],[x+7,y-2.6],[x-5,y+2.6]],'#7a5a3a');ln(x,y-1.4,x,y-16,'#4a3a2e',0.7);poly([[x+0.4,y-15.4],[x+7,y-3.6],[x+0.4,y-2.4]],'#f2efe6');}},
    landmark(x,y,i,j,T){ // أهرامات مروي: أهرامات حادة صغيرة بمعابد مدخل أمامها
      [[-9,-5,8,22],[8,-3,7,19],[0,5,9,26]].forEach(([dx,dy,b,h])=>{const X=x+dx,Y=y+dy;pyramid(X,Y,b,h,'#a8703e','#c4884e');
        box(X+b*0.45,Y+b*0.25+1,2.6,1.3,5,'#a06a3a','#b87e48','#c08852');poly([[X+b*0.45-0.6+2.6*0.2,Y+b*0.25+1-2.2],[X+b*0.45+1.4,Y+b*0.25+1-1.2],[X+b*0.45+1.4,Y+b*0.25+1+0.6],[X+b*0.45-0.6+2.6*0.2,Y+b*0.25+1-0.4]],'#3a2414');});
      damage(x,y,6,3,10,i,j,T);},
    plazaProp(x,y){el(x,y+1,9,4.5,'#c4a26e');[[-4,0],[0,2],[4,-1]].forEach(([dx,dy],k)=>{el(x+dx,y+dy,2,2.4,'#a8643a');el(x+dx,y+dy-2.2,0.9,0.5,'#7a4a2a');});},
    roadProp(x,y,i,j){if(hsh(i,j,1040)<0.1){ln(x+8,y+2,x+8,y-10,'#6a4a2a',0.8);el(x+8,y-11,2.4,1,'#e8b23a');}},tree:'palm'}};
