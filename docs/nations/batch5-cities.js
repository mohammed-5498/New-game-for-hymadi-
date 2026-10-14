/* ===================== مدن الدفعة 5: ريو (البرازيل)، لا بوكا (الأرجنتين)، تينوتشتيتلان (المكسيك) ===================== */
const THEMES={};
const lpc=(A,B,t)=>[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t];
/* ---------- ريو الاستعمارية: بيوت ملونة بشبابيك طويلة ومصاريع، بلاط أزرق، أسقف قرميد، رصيف برتغالي متموّج، نخيل ملكي؛ والمعلم أقواس لابا وعليها الترام الأصفر ---------- */
const RIO=['#e8c25a','#e88a6a','#7ab8c8','#f0e6d2','#9cc48a','#e6a8b8'];
function colonial(x,y,i,j,T){const c=RIO[Math.floor(hsh(i,j,1100)*RIO.length)],w=14,d=7,h=18+Math.floor(hsh(i,j,1101)*2)*6;box(x,y,w,d,h,mixc(c,'#000000',0.18),c);
  const qb=qR(x,y,w,d),qa=qL(x,y,w,d),az=hsh(i,j,1102)<0.3;if(az){for(let r=0;r<Math.floor(h/3);r++)for(let k=0;k<7;k++)if((r+k)%2===0)wR(x,y,w,d,k/7,r*3,0.1,1.4,'#3a6aa8');}
  for(let f=0;f<Math.floor(h/7);f++){for(let k=0;k<3;k++){const u=0.1+k*0.3,v=1.4+f*7;wR(x,y,w,d,u,v,0.18,5.2,'#f4f1ea');wR(x,y,w,d,u+0.02,v+0.3,0.14,4.6,hsh(i,j,1110+f*3+k)<0.5?'#2f6e8e':'#2e3a40');
    if(f>0){const A=qb(u-0.02,v),B=qb(u+0.2,v);ln(A[0]+0.6,A[1]+0.6,B[0]+0.6,B[1]+0.6,'#1e1e22',0.7);}}
    for(let k=0;k<2;k++)wL(x,y,w,d,0.2+k*0.45,1.4+f*7,0.16,5,'#24323a');}
  ln(...qb(0,h),...qb(1,h),'#f4f1ea',1);damage(x,y,w,d,h,i,j,T);ridgeRoof(x,y,w,d,h,5,{front:'#b5523a',end:'#c9654a',back:'#7a3428',ov:1.6,k:0.8,tile:'rgba(80,20,10,0.3)'});}
function imperialPalm(x,y,i,j){ln(x,y,x,y-26,'#b8ae9c',2);ln(x,y-22,x,y-27,'#5f8a3a',1.6);const tx=x,ty=y-27;
  for(let k=0;k<8;k++){const a=k*0.8+0.2,dx=Math.cos(a)*9,dy=Math.sin(a)*3.2+2.4;c2poly([[tx,ty],[tx+dx,ty+dy],[tx+dx*0.5,ty+dy-1.4]],k%2?'#5f8a3a':'#4d7a30');}}
function c2poly(a,c){poly(a,c);}
THEMES.rio={name:'ريو — البرازيل',ground:'#a8a07c',road:'#d8d2c4',road2:'#cfc8b8',plaza:'#e2dccd',debris:'#a89a82',wallL:'#c9a87a',wallR:'#e0c094',
  pool:[['colonial',48],['palm',14],['ruin',12],['.',4]],
  draw:{colonial,palm:imperialPalm,
    landmark(x,y,i,j,T){ // أقواس لابا: قناة مائية بطابقين من الأقواس البيضاء، وعليها الترام الأصفر
      const A=[x-18,y-9],B=[x+18,y+9],L=(t,v)=>[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t-v],th=2.4;
      poly([L(0,0),L(1,0),L(1,26),L(0,26)],'#e8e2d4');poly([L(0,26),L(1,26),[L(1,26)[0]-th*2,L(1,26)[1]-th],[L(0,26)[0]-th*2,L(0,26)[1]-th]],'#d4ccbc');
      for(let k=0;k<8;k++){const t0=0.03+k*0.12;const pts=[L(t0,0),L(t0+0.09,0),L(t0+0.09,7)];for(let s=1;s<8;s++){const q=s/8;pts.push(L(t0+0.09*(1-q),7+Math.sin(Math.PI*q)*4));}pts.push(L(t0,7));poly(pts,'#4a4438');}
      for(let k=0;k<8;k++){const t0=0.03+k*0.12;const pts=[L(t0,13.5),L(t0+0.09,13.5),L(t0+0.09,19)];for(let s=1;s<8;s++){const q=s/8;pts.push(L(t0+0.09*(1-q),19+Math.sin(Math.PI*q)*3.4));}pts.push(L(t0,19));poly(pts,'#4a4438');}
      ln(...L(0,13),...L(1,13),'#d4ccbc',1);damage(x,y,8,4,20,i,j,T);
      const t0=0.35,P0=L(t0,26),P1=L(t0+0.3,26);poly([[P0[0]-1,P0[1]-0.5],[P1[0]-1,P1[1]-0.5],[P1[0]-1,P1[1]-6.5],[P0[0]-1,P0[1]-6.5]],'#e8b82a');
      for(let k=0;k<4;k++){const Q=lpc(P0,P1,0.1+k*0.22);rc(Q[0]-0.4,Q[1]-5.6,1.8,2.2,'#3a4a52');}ln(P0[0],P0[1]-6.5,P1[0],P1[1]-6.5,'#8a6a2a',0.7);ln(...lpc(P0,P1,0.5),...[lpc(P0,P1,0.5)[0],lpc(P0,P1,0.5)[1]-10],'#3a3a3e',0.4);},
    plazaProp(x,y){el(x,y+1,10,5,'#c9c2b0');el(x,y+1,7.5,3.6,'#5f9bb0');box(x,y,1.4,0.7,6,'#e8e2d4','#f4f1ea','#d4ccbc');},
    tile(x,y,i,j){for(let r=-2;r<=2;r++){ctx.beginPath();for(let k=0;k<=8;k++){const px=x-13+Math.abs(r)*3+k*(26-Math.abs(r)*6)/8,py=y+r*2+Math.sin(k*1.2+r)*0.8;k?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.strokeStyle='rgba(20,20,20,0.35)';ctx.lineWidth=0.6;ctx.stroke();}},
    roadProp(x,y,i,j){if((i*7+j*5)%8===0){ln(x+10,y+2,x+10,y-14,'#1e1e22',0.9);rc(x+9,y-15.6,2,1.6,'#f2d58a');}},tree:'palm'}};
/* ---------- لا بوكا: بيوت "كونفينتييو" من صفيح مموّج بألوان صارخة متداخلة، شرفات وسلالم خارجية، رافعات الميناء، النهر على الحافة؛ والمعلم الجسر الناقل ---------- */
const BOCA=['#e2463a','#f0c23a','#3a8ad0','#5aaa5a','#e88a2a','#2fa8a0','#c84a8a'];
function corrugated(x,y,w,d,u0,u1,v0,v1,col,side){const q=side?qR(x,y,w,d):qL(x,y,w,d);poly([q(u0,v0),q(u1,v0),q(u1,v1),q(u0,v1)],col);
  for(let k=1;k<10;k++){const u=u0+(u1-u0)*k/10,A=q(u,v0),B=q(u,v1);ln(A[0],A[1],B[0],B[1],'rgba(0,0,0,0.16)',0.4);}}
function conventillo(x,y,i,j,T){const w=14,d=7,h=20,cs=[0,1,2,3].map(k=>BOCA[Math.floor(hsh(i,j,1200+k)*BOCA.length)]);box(x,y,w,d,h,'#5a5a5e','#6e6e72');
  corrugated(x,y,w,d,0,0.5,0,10,cs[0],true);corrugated(x,y,w,d,0.5,1,0,10,cs[1],true);corrugated(x,y,w,d,0,0.6,10,h,cs[2],true);corrugated(x,y,w,d,0.6,1,10,h,cs[3],true);
  corrugated(x,y,w,d,0,1,0,10,mixc(cs[1],'#000000',0.2),false);corrugated(x,y,w,d,0,1,10,h,mixc(cs[0],'#000000',0.2),false);
  const qb=qR(x,y,w,d);for(let k=0;k<2;k++){wR(x,y,w,d,0.15+k*0.45,2,0.18,5.4,'#2a3a46');wR(x,y,w,d,0.15+k*0.45,12,0.18,5,'#2a3a46');}
  const A=qb(0.05,10),B=qb(0.95,10);ln(A[0]+1,A[1]+0.8,B[0]+1,B[1]+0.8,'#1e1e22',0.8);for(let k=0;k<10;k++){const P=qb(0.05+k*0.1,10);ln(P[0]+1,P[1]+0.8,P[0]+1,P[1]-1.4,'#1e1e22',0.35);}
  const S0=qb(0.98,0),S1=qb(0.7,10);ln(S0[0]+1.2,S0[1],S1[0]+1.2,S1[1]+0.8,'#2a2a2e',0.8);for(let k=1;k<6;k++){const P=lpc([S0[0]+1.2,S0[1]],[S1[0]+1.2,S1[1]+0.8],k/6);ln(P[0]-0.8,P[1],P[0]+0.8,P[1]+0.3,'#2a2a2e',0.5);}
  damage(x,y,w,d,h,i,j,T);ridgeRoof(x,y,w,d,h,4,{front:'#8a8e92',end:'#9a9ea2',back:'#5a5e62',k:0.9,tile:'rgba(0,0,0,0.25)'});}
function crane(x,y,i,j){const C='#b8462a';[[-4,0],[4,0],[0,-2],[0,2]].forEach(([dx,dy])=>ln(x+dx,y+dy,x+dx*0.5,y+dy*0.5-24,C,1));for(let k=0;k<4;k++)ln(x-4+k*0.5,y-k*6,x+4-k*0.5,y-(k+1)*6,C,0.5);
  box(x,y-24,3,1.5,4,'#9a3a22',C,'#c8562e');ln(x,y-26,x+16,y-34,C,1.2);ln(x,y-26,x-6,y-30,C,1);ln(x+16,y-34,x+16,y-22,'#2a2a2e',0.4);rc(x+15,y-22,2,1.6,'#4a4a4e');}
THEMES.laboca={name:'لا بوكا — الأرجنتين',ground:'#7f7a70',road:'#6a665e',road2:'#625e57',plaza:'#8f8a80',debris:'#7a6a5a',wallL:'#c84a3a',wallR:'#e0c23a',car:['#2a2a2c','#3a3a3e','#1e1e20'],
  waterCol:'#4a5a52',isWater:(i,j)=>i===10,
  pool:[['conv',48],['crane',6],['ruin',12],['.',4]],
  draw:{conv:conventillo,crane,
    water(x,y,i,j){for(let k=0;k<3;k++)ln(x-8+k*5,y-2+k*1.5,x-3+k*5,y-0.5+k*1.5,'rgba(255,255,255,0.12)',0.6);
      if(hsh(i,j,1210)<0.45){poly([[x-12,y+3],[x+8,y-7],[x+12,y-5],[x-8,y+5.2]],'#5a3a2a');poly([[x-12,y+3],[x+8,y-7],[x+8,y-9],[x-12,y+1]],'#8a4a32');rc(x-2,y-6,4,3,'#c8c2b4');}},
    lamp(x,y){ln(x,y+2,x,y-15,'#1e1e22',1);rc(x-1,y-16.4,2,1.6,'#f2d58a');},
    landmark(x,y,i,j,T){ // الجسر الناقل: برجان فولاذيان شبكيان وعارضة علوية وعربة معلقة فوق الماء
      poly([[x-18,y],[x,y-9],[x+18,y],[x,y+9]],'#4a5a52');for(let k=0;k<4;k++)ln(x-10+k*5,y-1+k*1.4,x-5+k*5,y+0.6+k*1.4,'rgba(255,255,255,0.15)',0.6);
      const C='#3a3e44',H=56,tw=(X,Y)=>{[[-2.4,0],[2.4,0]].forEach(([dx])=>ln(X+dx,Y,X+dx*0.6,Y-H,C,1.4));for(let k=0;k<9;k++){const t=k/9,a=X-2.4+0.96*t,b=X+2.4-0.96*t,yy=Y-H*t;ln(a,yy,b,yy-H/9,C,0.5);ln(b,yy,a,yy-H/9,C,0.5);}};
      tw(x-14,y-5);tw(x+14,y+5);const T0=[x-16,y-5-H],T1=[x+16,y+5-H];poly([[T0[0],T0[1]],[T1[0],T1[1]],[T1[0],T1[1]+5],[T0[0],T0[1]+5]],'#4a4e54');
      for(let k=0;k<10;k++){const P=lpc(T0,T1,k/10),Q=lpc(T0,T1,(k+1)/10);ln(P[0],P[1],Q[0],Q[1]+5,'#2a2e34',0.5);ln(P[0],P[1]+5,Q[0],Q[1],'#2a2e34',0.5);}
      const G=lpc(T0,T1,0.45);ln(G[0]-2,G[1]+5,G[0]-2,G[1]+44,'#2a2e34',0.4);ln(G[0]+2,G[1]+5,G[0]+2,G[1]+46,'#2a2e34',0.4);
      box(G[0],G[1]+50,6,3,4,'#7a1f22','#9a2a2a','#4a4e54');damage(x,y,6,3,10,i,j,T);},
    plazaProp(x,y){el(x,y+1,8,4,'#77736b');for(let k=0;k<3;k++){box(x-5+k*5,y+2-k*2.5,1.4,0.7,4,BOCA[k],BOCA[k+2],'#d8d2c4');}},
    roadProp(x,y,i,j){if((i*5+j*3)%7===0)THEMES.laboca.draw.lamp(x+10,y);},tree:'crane'}};
/* ---------- تينوتشتيتلان: بيوت بيضاء مسطحة على منصات بحواف حمراء، حدائق التشينامبا العائمة بين القنوات، أشجار الأويخوتي، البحيرة على الحافة بزوارق؛ والمعلم ملعب الكرة ---------- */
function aztecHouse(x,y,i,j,T){const w=13,d=6.5;box(x,y+1,w+2,d+1,3,'#b8aa8e','#cfc2a4','#c4b698');const h=10+Math.floor(hsh(i,j,1300)*2)*4;box(x,y-3,w,d,h,'#e6e0d2','#f4f0e6','#ece6d8');
  const qb=qR(x,y-3,w,d),qa=qL(x,y-3,w,d);wR(x,y-3,w,d,0,h-2,1,2,'#b8322c');wL(x,y-3,w,d,0,h-2,1,2,'#9a2a24');wR(x,y-3,w,d,0.4,0,0.22,6.4,'#3a2a1c');
  for(let k=0;k<5;k++){const P=qb(0.08+k*0.2,h-1);rc(P[0]-0.4,P[1]-1.4,0.8,1.4,'#2fa8a0');}damage(x,y-3,w,d,h,i,j,T);}
function chinampa(x,y,i,j){poly([[x-18,y],[x,y-9],[x+18,y],[x,y+9]],'#4f8a9a');poly([[x-12,y],[x,y-6],[x+12,y],[x,y+6]],'#6a8a3e');
  for(let r=0;r<3;r++)for(let k=0;k<4;k++){const px=x-6+k*4-r*2,py=y-2+r*2+k*-0.6;el(px,py,1.4,0.8,r%2?'#8aaa4a':'#5f7a34');ln(px,py,px,py-1.8,'#4a6a2a',0.5);}
  ln(x-11,y,x-11,y-14,'#6a5a3a',1);el(x-11,y-16,2.2,4,'#4f7a3a');ln(x+11,y,x+11,y-12,'#6a5a3a',1);el(x+11,y-14,2,3.6,'#4f7a3a');}
function ahuejote(x,y,i,j){ln(x,y,x,y-14,'#6a5a3a',1.4);el(x,y-17,2.6,6,'#4f7a3a');el(x-0.6,y-19,1.8,4,'#5f8a44');}
THEMES.tenoch={name:'تينوتشتيتلان — المكسيك',ground:'#9aa070',road:'#c8bca0',road2:'#bfb296',plaza:'#d8ccb0',debris:'#b8aa8e',wallL:'#d6d0c2',wallR:'#ece6d8',
  waterCol:'#4f8a9a',isWater:(i,j)=>j===10,
  pool:[['house',36],['chinampa',18],['ahuejote',10],['ruin',10],['.',6]],
  draw:{house:aztecHouse,chinampa,ahuejote,
    water(x,y,i,j){for(let k=0;k<3;k++)ln(x-8+k*5,y-2+k*1.5,x-3+k*5,y-0.5+k*1.5,'rgba(255,255,255,0.2)',0.6);
      if(hsh(i,j,1310)<0.4){poly([[x-8,y+1],[x+6,y-5],[x+8,y-4],[x-6,y+2.4]],'#7a5a3a');ln(x+2,y-3,x+8,y-12,'#5a4a32',0.6);}},
    landmark(x,y,i,j,T){ // ملعب الكرة: جداران متوازيان بوجهين مائلين، وحلقة حجرية في وسط كل جدار، وممر اللعب بينهما
      poly([[x-18,y],[x,y-9],[x+18,y],[x,y+9]],'#d8ccb0');poly([[x-12,y],[x,y-6],[x+12,y],[x,y+6]],'#c9b890');
      const wall=(o,side)=>{const A=[x-17+o[0],y-8.5+o[1]],B=[x+1+o[0],y+0.5+o[1]];poly([A,B,[B[0],B[1]-8],[A[0],A[1]-8]],side?'#b8aa8e':'#cfc2a4');
        poly([[A[0],A[1]-8],[B[0],B[1]-8],[B[0]+3*(side?1:-1),B[1]-8+1.5*(side?1:-1)],[A[0]+3*(side?1:-1),A[1]-8+1.5*(side?1:-1)]],'#e6dcc4');
        ln(A[0],A[1]-8,B[0],B[1]-8,'#b8322c',1);const M=lpc(A,B,0.5);ctx.beginPath();ctx.ellipse(M[0]+(side?1.6:-1.6),M[1]-5,1.6,2.2,0,0,TAU);ctx.strokeStyle='#8a7a5e';ctx.lineWidth=1.2;ctx.stroke();};
      wall([0,0],false);wall([16,8],true);poly([[x-9,y-4.5],[x-6,y-3],[x+3,y+1.5],[x,y]],'#b8aa8e');circ(x-1,y-1,1.2,'#3a2a1a');damage(x,y,8,4,8,i,j,T);},
    plazaProp(x,y){box(x,y+1,6,3,2,'#b8aa8e','#cfc2a4','#c4b698');box(x,y-1,4,2,2,'#c4b698','#dccfb0','#e6dcc4');el(x,y-3.6,2,1,'#2fa8a0');},
    roadProp(x,y,i,j){if((i*7+j*3)%9===0){ln(x+9,y+2,x+9,y-10,'#6a5a3a',0.9);poly([[x+9,y-10],[x+14,y-12],[x+9,y-7]],'#b8322c');}},tree:'ahuejote'}};
