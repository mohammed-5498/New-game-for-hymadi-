// مدن الأمم الآسيوية (المرحلة 9ب، القسم 3.10): كايفنغ (الصين) وغيونغجو (كوريا). وإيدو (اليابان) هي المدينة
// اليابانية نفسها بمعلم جديد (في cityThemes.js) بدل نسخة ثانية منها.
// منقولة كما هي من docs/nations/batch2-cities.js بأدوات cityThemes.js نفسها، فيعمل عليها كل ما في القسم 3.9
// (التخزين المؤقت، وصبغ المالك والطقس، والمباني الحاسمة بعلاماتها). الفروق: لوحة الرسم من getCtx()،
// وماء كايفنغ على حافة الخريطة كالنرويجية (CITIES.water في config.js، لا يُمشى عليه) بدل isWater التجريبية،
// وألوان سطح جسر قوس قزح وطبقات مرصد تشومسونغدي عبر poly وel (فيصبغها المالك والطقس كبقية المبنى).
import { getCtx, TAU, poly, circ, ln, rc, el, box, qL, qR, wL, wR, arch, ridgeRoof, damage, hsh } from './cityThemes.js';

/* ---------- كايفنغ في عهد سونغ: محلات بلافتات قماشية عمودية، بيوت شاي بشرفات، قنوات، صفصاف؛ والمعلم جسر قوس قزح ---------- */
const roofG={front:'#4a5260',front2:'#5a6372',end:'#5a6372',end2:'#6a7382',back:'#2e333c',tile:'rgba(0,0,0,0.25)',ridge:'#2e333c',ridgeW:1.6};
function shopBanner(P,col,dark){ln(P[0],P[1],P[0],P[1]-16,'#5a4632',0.9);poly([[P[0]+0.4,P[1]-15],[P[0]+3.4,P[1]-14],[P[0]+3.4,P[1]-5],[P[0]+0.4,P[1]-6]],col);
  for(let k=0;k<3;k++)rc(P[0]+1.4,P[1]-13+k*2.4,1,1.4,dark);}
export const kaifeng={name:'كايفنغ — الصين',ground:'#a39c88',road:'#958e84',road2:'#88827a',plaza:'#b8af9e',debris:'#8a847a',wallL:'#8e8778',wallR:'#a49d8e',
  waterCol:'#5f8a96',
  pool:[['shop',30],['tea',16],['court',16],['willow',12],['ruin',10],['.',6]],
  draw:{
    shop(x,y,i,j,T){const w=13,d=6.5,h=11;box(x,y,w,d,h,'#8a6a4a','#a07a56');wR(x,y,w,d,0.1,0,0.8,7,'#2e2620');
      for(let k=0;k<4;k++){rc(x+2+k*2.6,y+2-k*1.3,1.8,1.2,['#c98a3a','#a8322a','#e8d8b0','#4a7a5a'][k]);}
      ridgeRoof(x,y,w,d,h,7,Object.assign({ov:3.4,sag:1.4,flare:2},roofG));
      shopBanner(qR(x,y,w,d)(0.95,0),hsh(i,j,800)<0.5?'#e8dcc0':'#d9b04a','#3a2a22');damage(x,y,w,d,h,i,j,T);},
    tea(x,y,i,j,T){const w=13,d=6.5;box(x,y,w,d,10,'#8e2a26','#a8332d');ridgeRoof(x,y,w,d,10,2.4,Object.assign({ov:3.2,flare:1.6,k:0.85},roofG));
      box(x,y-12,w-1.5,d-0.75,9,'#a07a56','#b88c62');const qb=qR(x,y-12,w-1.5,d-0.75);for(let k=0;k<5;k++){const A=qb(0.05+k*0.22,0),B=qb(0.05+k*0.22,3);ln(A[0]+1.4,A[1]+1,B[0]+1.4,B[1]+1,'#5a3a22',0.6);}
      const A=qb(0,3),B=qb(1,3);ln(A[0]+1.4,A[1]+1,B[0]+1.4,B[1]+1,'#5a3a22',0.8);
      ridgeRoof(x,y-12,w-1.5,d-0.75,9,7,Object.assign({ov:3,sag:1.4,flare:2.2},roofG));
      [[0.2,7],[0.8,7]].forEach(([u,v])=>{const P=qb(u,v);el(P[0]+1.4,P[1]+3,1.4,1.8,'#d33a2c');});damage(x,y,w,d,10,i,j,T);},
    court(x,y,i,j,T){const w=14,d=7,h=9;box(x,y,w,d,h,'#d9d4ca','#ebe6dc');wR(x,y,w,d,0,7.4,1,1.6,'#5a6372');
      arch(qR(x,y,w,d),0.36,0.3,8,'#3a342e');wL(x,y,w,d,0.3,3,0.3,3.2,'#a3282a');damage(x,y,w,d,h,i,j,T);
      box(x-2,y-9,8,4,6,'#c8c2b8','#dad4ca');ridgeRoof(x-2,y-9,8,4,6,5,Object.assign({ov:2.6,sag:1,flare:1.8},roofG));},
    willow(x,y){const ctx=getCtx();rc(x-1,y-11,2,11,'#5b4636');circ(x,y-15,6.5,'#7e9a4a');
      for(let k=0;k<7;k++){const ox=-6+k*2;ctx.beginPath();ctx.moveTo(x+ox,y-17);ctx.quadraticCurveTo(x+ox+1,y-9,x+ox-0.5,y-4);ctx.strokeStyle=k%2?'#8fae58':'#6f8c3e';ctx.lineWidth=1;ctx.stroke();}},
    water(x,y,i,j){for(let k=0;k<3;k++)ln(x-8+k*5,y-2+k*1.5,x-3+k*5,y-0.5+k*1.5,'rgba(255,255,255,0.2)',0.6);
      if(hsh(i,j,810)<0.35){poly([[x-7,y+1],[x+5,y-5],[x+7,y-4],[x-5,y+2.4]],'#7a5a3a');poly([[x-3,y-0.6],[x+2,y-3],[x+2,y-6],[x-3,y-3.6]],'#c9a86a');}},
    landmark(x,y,i,j,T){ // جسر قوس قزح: جسر خشبي مقوّس فوق قناة
      const ctx=getCtx();
      poly([[x-18,y],[x,y-9],[x+18,y],[x,y+9]],'#5f8a96');for(let k=0;k<4;k++)ln(x-10+k*5,y-1+k*1.4,x-5+k*5,y+0.6+k*1.4,'rgba(255,255,255,0.25)',0.6);
      const P=t=>[x-16+32*t,y+8-16*t-Math.sin(Math.PI*t)*15];
      for(let s=0;s<2;s++){const off=s?3.2:0,pts=[];for(let k=0;k<=20;k++){const q=P(k/20);pts.push([q[0]-off,q[1]-off*0.5]);}
        for(let k=20;k>=0;k--){const q=P(k/20);pts.push([q[0]-off,q[1]-off*0.5+2.6]);}poly(pts,s?'#8a6440':'#a07a52');}   // عبر poly: صبغ المالك والطقس
      for(let k=0;k<=10;k++){const q=P(k/10);ln(q[0],q[1],q[0],q[1]-4,'#5a3e26',0.8);}
      ctx.beginPath();for(let k=0;k<=20;k++){const q=P(k/20);k?ctx.lineTo(q[0],q[1]-4):ctx.moveTo(q[0],q[1]-4);}ctx.strokeStyle='#5a3e26';ctx.lineWidth=0.9;ctx.stroke();
      for(let k=1;k<6;k++){const q=P(k/6);ln(q[0],q[1]+2.6,q[0]-1,q[1]+9,'#5a3e26',0.9);}},
    plazaProp(x,y){box(x,y+1,4,2,6,'#a7a19a','#bdb7b0','#c9c3bc');el(x,y-6.5,5,2.5,'#9a958c');circ(x,y-8,1.6,'#d9a63a');},
    roadProp(x,y,i,j){if((i*5+j*7)%7===0){ln(x+9,y+2,x+9,y-12,'#4a3a32',0.9);el(x+9,y-11,1.9,2.4,'#d33a2c');}},tree:'willow'}};

/* ---------- غيونغجو: بيوت هانوك بجدران بيضاء وإطارات خشبية وأسقف قرميد منحنية برقة، أسوار حجرية، صنوبر أحمر؛ والمعلم مرصد تشومسونغدي ---------- */
const roofK={front:'#4c535c',front2:'#5b636c',end:'#5b636c',end2:'#6b737c',back:'#30353c',tile:'rgba(0,0,0,0.22)',ridge:'#e8e4da',ridgeW:1.4};
function hanok(x,y,i,j,T,big){const w=big?15:13,d=big?7.5:6.5,h=big?10:8;box(x,y+1,w+1,d+0.5,2,'#a49e94','#bdb6ab','#cbc4b8');
  box(x,y,w,d,h,'#e6e1d6','#f2eee5');const qa=qL(x,y,w,d),qb=qR(x,y,w,d);
  [0,0.33,0.66,1].forEach(u=>{let a=qa(u,0),b=qa(u,h);ln(a[0],a[1],b[0],b[1],'#7a5638',1);a=qb(u,0);b=qb(u,h);ln(a[0],a[1],b[0],b[1],'#7a5638',1);});
  let a=qb(0,h-1.2),b=qb(1,h-1.2);ln(a[0],a[1],b[0],b[1],'#7a5638',0.8);a=qa(0,h-1.2);b=qa(1,h-1.2);ln(a[0],a[1],b[0],b[1],'#7a5638',0.8);
  wR(x,y,w,d,0.38,0.5,0.26,5.6,'#d8cfbc');for(let k=1;k<3;k++)wR(x,y,w,d,0.38+k*0.087,0.5,0.01,5.6,'#8a6a4c');
  damage(x,y,w,d,h,i,j,T);ridgeRoof(x,y,w,d,h,8,Object.assign({ov:4,sag:2.2,flare:1.2,k:0.6},roofK));}
export const gyeongju={name:'غيونغجو — كوريا',ground:'#93a07c',road:'#b0a894',road2:'#a39b88',plaza:'#c2b9a4',debris:'#8e877a',wallL:'#d8d2c6',wallR:'#e6e1d6',
  pool:[['hanok',32],['hanokBig',14],['wall',8],['pine',18],['ruin',10],['.',8]],
  draw:{hanok:(x,y,i,j,T)=>hanok(x,y,i,j,T,false),hanokBig:(x,y,i,j,T)=>hanok(x,y,i,j,T,true),
    wall(x,y,i,j,T){box(x,y,15,7.5,5,'#8f897f','#a49e94');for(let r=0;r<2;r++)for(let k=0;k<6;k++)wR(x,y,15,7.5,k/6+(r%2)*0.08,r*2.4,0.15,2,r%2?'#9a948a':'#b0aaa0');
      ridgeRoof(x,y,15,7.5,5,2.4,Object.assign({ov:1.2,sag:0.6,k:0.9},roofK));},
    pine(x,y,i,j){const ctx=getCtx(),o=((i+j)%3)-1;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+o*4,y-6,x-o*3,y-12,x+o*2,y-20);ctx.strokeStyle='#8a4a32';ctx.lineWidth=2;ctx.stroke();
      [[o*2,-20,6,2.6],[o*2-4,-15,4.4,2],[o*2+4,-16,4.6,2]].forEach(([dx,dy,rx,ry])=>{el(x+dx,y+dy,rx,ry,'#3f6a3e');el(x+dx-0.6,y+dy-0.6,rx*0.7,ry*0.6,'#4f7a4a');});},
    landmark(x,y,i,j,T){ // مرصد تشومسونغدي: برج حجري على شكل قارورة بقاعدة مربعة ونافذة وسطى وإطار مربع في القمة
      const ctx=getCtx();
      box(x,y+1,8,4,2.4,'#9a948a','#b0aaa0','#c0bab0');
      const prof=k=>{const t=k/24;return 6.6-3.4*Math.pow(t,0.9)+0.4*Math.sin(t*3.1);};
      for(let k=24;k>=0;k--){const yy=y-1.4-k*1.75,r=prof(k);el(x,yy,r,r*0.42,k%2?'#b8b1a5':'#cbc4b8');
        ctx.beginPath();ctx.ellipse(x,yy,r,r*0.42,0,0,Math.PI);ctx.strokeStyle='rgba(0,0,0,0.12)';ctx.lineWidth=0.4;ctx.stroke();}
      const wy=y-1.4-12*1.75;poly([[x+1,wy-1],[x+4,wy-2.2],[x+4,wy+1.4],[x+1,wy+2.6]],'#3a342e');
      const ty=y-1.4-24*1.75-1;[[-3.6,0],[3.6,0]].forEach(([dx])=>box(x+dx*0.5,ty,3.8,1.9,1.4,'#a8a196','#bdb6ab','#cbc4b8'));
      box(x,ty-1.4,3.8,1.9,1.4,'#a8a196','#bdb6ab','#cbc4b8');damage(x,y,6,3,14,i,j,T);},
    plazaProp(x,y){el(x,y+1,9,4.5,'#a49e94');[[-4,1],[3,2],[0,-2]].forEach(([dx,dy])=>{box(x+dx,y+dy,1.6,0.8,4,'#9a948a','#b0aaa0','#c0bab0');});},
    roadProp(x,y,i,j){if((i*7+j*3)%8===0){box(x+9,y+2,1.4,0.7,7,'#9a948a','#b0aaa0','#c0bab0');poly([[x+6.6,y-5],[x+9,y-7],[x+11.4,y-5],[x+9,y-3.6]],'#7a756c');rc(x+8.4,y-4.6,1.2,1,'#f2d58a');}},
    tree:'pine'}};
