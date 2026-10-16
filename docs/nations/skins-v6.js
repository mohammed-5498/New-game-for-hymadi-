/* ===================== تفاصيل v6 — مستلهمة من عينات صاحب اللعبة (14 صورة) =====================
   تُحمَّل بعد style-v5.js وكل ملفات الدفعات. تضيف تفاصيل فوق المظاهر الموجودة دون استبدالها:
   حواف مزخرفة للأثواب، ياقات، أشرطة ذراع، شرّابات، لفائف ساق، حلقات نحاسية على العصي، وغيرها.
   كل الإضافات تعمل فقط حين STYLE.on (مستوى التفصيل الكامل)، فلا تكلّف الوحدات البعيدة شيئاً.
   صُحّحت أخطاء أداة التوليد: لا بنادق ولا أعلام دول حديثة ولا رموز دينية، والأسماء كما في NATIONS.md. */
let LAST_ROBE=null,LAST_STAFF=null;
{const _robe=robe;robe=function(...a){const r=_robe(...a);LAST_ROBE=r;return r;};
 const _staff=staff;staff=function(...a){const s=_staff(...a);LAST_STAFF=s;return s;};
 const _ds=drawSkinned;drawSkinned=function(...a){LAST_ROBE=null;LAST_STAFF=null;return _ds(...a);};}
function after(key,hook,fn){const U=UNITS[key];if(!U)return;const o=U[hook];
  U[hook]=hook==='head'?function(c,p,col){o&&o(c,p,col);if(STYLE.on)fn(c,p,col);}:function(c,J,p,col){const r=o?o(c,J,p,col):undefined;if(STYLE.on)fn(c,J,p,col);return r;};}
const SKYB='#7ab8e0',BRG='#2f8f4e',BRY='#e8c23a';
/* --- أدوات الزخرفة --- */
function edge(r,t){return [lp(r.w1,r.hemB,t),lp(r.w2,r.hemF,t)];}
function hemBand(c,r,t0,t1,col){if(!r)return;const [A0,B0]=edge(r,t0),[A1,B1]=edge(r,t1);pg(c,[A0,B0,B1,A1],col);}
function hemZig(c,r,col,t,n,h){if(!r)return;const [A,B]=edge(r,t||0.88),N=n||7,H=h||1.3;for(let k=0;k<N;k++){const P=lp(A,B,(k+0.5)/N),w=Math.hypot(B[0]-A[0],B[1]-A[1])/N*0.42;
  tri(c,[P[0]-w,P[1]+H*0.4],[P[0],P[1]-H*0.6],[P[0]+w,P[1]+H*0.4],col);}}
function hemDiamonds(c,r,col,t,n){if(!r)return;const [A,B]=edge(r,t||0.6),N=n||4;for(let k=0;k<N;k++){const P=lp(A,B,(k+0.5)/N);pg(c,[[P[0],P[1]-0.9],[P[0]+0.6,P[1]],[P[0],P[1]+0.9],[P[0]-0.6,P[1]]],col);}}
function hemCloud(c,r,col,t){if(!r)return;const [A,B]=edge(r,t||0.82);for(let k=0;k<4;k++){const P=lp(A,B,(k+0.5)/4);c.beginPath();c.arc(P[0],P[1],0.9,Math.PI,0);c.arc(P[0]+1,P[1],0.6,Math.PI,0);c.strokeStyle=col;c.lineWidth=0.45;c.stroke();}}
function apron(c,r,col,trim){if(!r)return;const T=lp(r.w1,r.w2,0.58),Bm=lp(r.hemB,r.hemF,0.62);pg(c,[[T[0]-1.1,T[1]+0.6],[T[0]+1.1,T[1]+0.6],[Bm[0]+1.4,Bm[1]-0.4],[Bm[0]-1.4,Bm[1]-0.4]],col);
  if(trim){limb(c,T[0]-1.1,T[1]+0.6,Bm[0]-1.4,Bm[1]-0.4,0.45,trim);limb(c,T[0]+1.1,T[1]+0.6,Bm[0]+1.4,Bm[1]-0.4,0.45,trim);const M=lp(T,Bm,0.55);pg(c,[[M[0],M[1]-1],[M[0]+0.7,M[1]],[M[0],M[1]+1],[M[0]-0.7,M[1]]],trim);}}
function collarV(c,J,c1,c2){const a=J.a2,A=add(J.chest,rot(-1.5,-1.4,a)),B=add(J.chest,rot(1.7,-1.4,a)),M=add(J.chest,rot(0.7,2.4,a));
  c.beginPath();c.moveTo(A[0],A[1]);c.lineTo(M[0],M[1]);c.lineTo(B[0],B[1]);c.strokeStyle=c1;c.lineWidth=1.3;c.lineJoin='round';c.stroke();
  if(c2){c.beginPath();c.moveTo(A[0],A[1]+0.5);c.lineTo(M[0],M[1]+0.3);c.lineTo(B[0],B[1]+0.5);c.strokeStyle=c2;c.lineWidth=0.5;c.stroke();}}
function armband(c,J,col,trim,t){if(!J.elbowF)return;const S=J.Sf,E=J.elbowF,P=lp(S,E,t||0.55),d=[E[0]-S[0],E[1]-S[1]],L=Math.hypot(d[0],d[1])||1,n=[-d[1]/L,d[0]/L];
  limb(c,P[0]-n[0]*1.9,P[1]-n[1]*1.9,P[0]+n[0]*1.9,P[1]+n[1]*1.9,1.2,col);if(trim)circ2(c,P,0.45,trim);}
function cuff(c,J,col){if(!J.elbowF)return;const E=J.elbowF,H=J.handF,P=lp(E,H,0.62),d=[H[0]-E[0],H[1]-E[1]],L=Math.hypot(d[0],d[1])||1,n=[-d[1]/L,d[0]/L];
  limb(c,P[0]-n[0]*1.8,P[1]-n[1]*1.8,P[0]+n[0]*1.8,P[1]+n[1]*1.8,0.9,col);}
function tassel(c,P,col,len,knot){circ2(c,P,0.7,knot||GOLD);for(let k=-1;k<=1;k++)limb(c,P[0]+k*0.3,P[1]+0.5,P[0]+k*0.4,P[1]+(len||3),0.4,col);}
function legWraps(c,J,col){[J.legB,J.legF].forEach((L,n)=>{const A=lp(L.k,L.f,0.15),B=lp(L.k,L.f,0.95);for(let k=0;k<4;k++){const P=lp(A,B,k/4),Q=lp(A,B,(k+1)/4);
  limb(c,P[0]-1.3,P[1],Q[0]+1.3,Q[1],0.4,n?col:dk(col,0.2));limb(c,P[0]+1.3,P[1],Q[0]-1.3,Q[1],0.4,n?col:dk(col,0.2));}});}
function staffBands(c,ts,col){const s=LAST_STAFF;if(!s)return;const n=[-s.d[1],s.d[0]];ts.forEach(t=>{const P=lp(s.A,s.B,t);limb(c,P[0]-n[0]*1.1,P[1]-n[1]*1.1,P[0]+n[0]*1.1,P[1]+n[1]*1.1,0.8,col);});}
function pouchX(c,J,side,col){const P=add(J.hip,rot(side,-0.6,J.pl));rrect(c,P[0]-1.5,P[1]-0.3,3,2.6,0.5,col||'#7a5232');rrect(c,P[0]-1.5,P[1]-0.3,3,1.1,0.4,lt(col||'#7a5232',0.15));circ2(c,[P[0],P[1]+0.5],0.3,'#d9b45a');}
function smokeWisp(c,x,y){c.save();c.globalAlpha*=0.55;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+1.6,y-1.6,x-1.4,y-3,x+0.4,y-4.6);c.bezierCurveTo(x+1.8,y-5.8,x-0.6,y-7,x+0.8,y-8.4);c.strokeStyle='#c8c4bc';c.lineWidth=0.7;c.stroke();c.restore();}
/* --- اليمن: حواف ذهبية متعرجة، مريلة نيلية، حلية العمامة، مبخرة مخرّمة، أعشاب العطّار، صولجان بجوهرة --- */
['yem_common','yem_boss','yem_healer','yem_hero'].forEach(k=>after(k,'head',(c)=>{circ2(c,[2.9,-1.7],0.75,GOLD);limb(c,2.9,-1.1,3.1,1.6,0.4,GOLD);ell(c,3.1,2,0.45,0.7,GOLD);}));
after('yem_common','robe',(c)=>{hemBand(c,LAST_ROBE,0.86,0.98,IND);hemZig(c,LAST_ROBE,GOLD,0.92,6,1);});
after('yem_boss','robe',(c)=>{hemBand(c,LAST_ROBE,0.86,0.98,IND);hemZig(c,LAST_ROBE,GOLD,0.92,7,1.1);apron(c,LAST_ROBE,IND,GOLD);});
after('yem_boss','weapon',(c,J)=>{circ2(c,J.handF,0.55,'#b8322c');});
after('yem_healer','robe',(c)=>{hemBand(c,LAST_ROBE,0.9,0.99,IND);hemZig(c,LAST_ROBE,GOLD,0.94,7,1);});
UNITS.yem_healer.weapon=function(c,J,p){const h=J.handF,X=h[0]+0.4,Y=h[1]+4.2;limb(c,h[0],h[1],X-0.6,Y-2.2,0.35,'#b8913a');limb(c,h[0],h[1],X+0.6,Y-2.2,0.35,'#b8913a');
  if(!STYLE.on){ell(c,X,Y,1.6,1,'#b8913a');return;}
  rrect(c,X-1.3,Y-1.8,2.6,3.2,0.5,'#c9a04a');for(let k=0;k<3;k++)limb(c,X-0.8+k*0.8,Y-1.5,X-0.8+k*0.8,Y+1.1,0.35,'#6a4a1a');limb(c,X-1.3,Y-0.2,X+1.3,Y-0.2,0.35,'#6a4a1a');
  c.beginPath();c.arc(X,Y-1.8,1.3,Math.PI,0);c.fillStyle='#d9b45a';c.fill();circ2(c,[X,Y-3.2],0.4,'#d9b45a');ell(c,X,Y+1.6,1.5,0.5,'#a07a2e');
  c.save();const g=c.createRadialGradient(X,Y,0,X,Y,2.4);g.addColorStop(0,'rgba(255,190,90,0.6)');g.addColorStop(1,'rgba(255,190,90,0)');c.fillStyle=g;c.beginPath();c.arc(X,Y,2.4,0,TAU);c.fill();c.restore();
  smokeWisp(c,X,Y-3.4);};
after('yem_healer','over',(c,J)=>{const B=add(J.hip,rot(-2.2,0.4,J.pl));[[-0.8,-1.6,'#5f8a3a'],[0.2,-2.2,'#4d7a30'],[1,-1.4,'#6f9a44']].forEach(([dx,dy,cl])=>{ell(c,B[0]+dx,B[1]+dy,0.5,1.1,cl);});});
after('yem_hero','robe',(c)=>{apron(c,LAST_ROBE,IND,GOLD);hemZig(c,LAST_ROBE,GOLD,0.86,8,1.2);});
after('yem_hero','head',(c)=>{circ2(c,[0,-3.6],0.9,'#c8322c');circ2(c,[-0.25,-3.85],0.3,'#ff9a90');});
UNITS.yem_hero.weapon=function(c,J,p){const s=staff(c,J,p,6,6,1.1,GOLD);staffBands(c,[0.2,0.5],'#a07a2e');
  c.beginPath();c.arc(s.B[0],s.B[1],2.2,0,TAU);c.strokeStyle=GOLD;c.lineWidth=0.9;c.stroke();circ2(c,s.B,1.2,'#c8322c');circ2(c,[s.B[0]-0.35,s.B[1]-0.4],0.35,'#ff9a90');
  for(let k=0;k<4;k++){const a=k*Math.PI/2;circ2(c,[s.B[0]+Math.cos(a)*2.2,s.B[1]+Math.sin(a)*2.2],0.45,GOLD);}};
/* --- مصر: حلقات نحاسية على النبابيت، درع بإطار نحاسي ومسامير، صديري بحافة ذهبية --- */
after('egy_common','weapon',(c)=>staffBands(c,[0.12,0.86],'#c9a04a'));
after('egy_breaker','weapon',(c)=>staffBands(c,[0.08],'#c9a04a'));
after('egy_hero','weapon',(c)=>staffBands(c,[0.3,0.82],'#c9a04a'));
after('egy_shield','front',(c,J)=>{const h=J.handF,X=h[0]+1.2;c.beginPath();c.arc(X,h[1],5.1,0,TAU);c.strokeStyle='#c9a04a';c.lineWidth=0.8;c.stroke();
  for(let k=0;k<10;k++){const a=k*0.628;circ2(c,[X+Math.cos(a)*4.6,h[1]+Math.sin(a)*4.6],0.3,'#e0c070');}});
/* --- الصين: حافة بيضاء للثوب وشقّ جانبي --- */
['chn_common','chn_boss','chn_healer','chn_hero'].forEach(k=>after(k,'robe',(c,J)=>{const r=LAST_ROBE;if(!r)return;hemBand(c,r,0.93,1,'#f2efe6');
  const A=lp(r.w2,r.hemF,0.55),B=r.hemF;limb(c,A[0]-0.6,A[1],B[0]-1.2,B[1],0.5,'#f2efe6');}));
/* --- اليابان: ياقة بيضاء وسوداء، حافة سفلية سوداء بخط ذهبي، شرّابة الأوبي، موج "سيغايها" على هاوري الزعيم --- */
['jpn_common','jpn_kiseru','jpn_dual','jpn_hero'].forEach(k=>{after(k,'robe',(c,J)=>{hemBand(c,LAST_ROBE,0.9,1,INK);const r=LAST_ROBE;if(r){const [A,B]=edge(r,0.9);limb(c,A[0],A[1],B[0],B[1],0.45,GOLD);}collarV(c,J,'#f2efe6',INK);});
  after(k,'over',(c,J)=>{const P=add(J.hip,rot(1.6,-0.4,J.pl));tassel(c,P,CRIM,3.4,GOLD);});});
after('jpn_hero','back',(c,J)=>{const hb=lp(J.legB.h,J.legB.k,0.9),A=add(J.chest,rot(-2.6,-0.6,J.a2));for(let r=0;r<3;r++)for(let k=0;k<3;k++){const P=lp(lp(A,[hb[0]-4.2,hb[1]],0.3+r*0.25),lp(A,[hb[0]+1,hb[1]],0.3+r*0.25),0.15+k*0.3);
  c.beginPath();c.arc(P[0],P[1]+0.8,1,Math.PI,0);c.strokeStyle=GOLD;c.lineWidth=0.4;c.stroke();c.beginPath();c.arc(P[0],P[1]+0.8,0.5,Math.PI,0);c.stroke();}});
/* --- كوريا: سحب على الحافة، حافة بيضاء، حلية "نوريغاي" معلقة بالوشاح --- */
['kor_common','kor_archer','kor_fire','kor_hero'].forEach(k=>{after(k,'robe',(c,J)=>{hemBand(c,LAST_ROBE,0.9,1,'#f4f2ec');hemCloud(c,LAST_ROBE,'#8ab4d8',0.8);collarV(c,J,'#f4f2ec');});
  after(k,'over',(c,J)=>{const P=add(J.hip,rot(1.4,0.2,J.pl));tassel(c,P,k==='kor_fire'?CRIM:PINK,4,GOLD);});});
after('kor_hero','back',(c,J)=>{const hb=lp(J.legB.k,J.legB.f,0.6);for(let k=0;k<3;k++){const P=lp(add(J.chest,rot(-2.4,-0.6,J.a2)),[hb[0]-2,hb[1]],0.4+k*0.18);c.beginPath();c.arc(P[0],P[1],1.1,Math.PI,0);c.arc(P[0]+1.2,P[1],0.7,Math.PI,0);c.strokeStyle=GOLD;c.lineWidth=0.45;c.stroke();}});
/* --- فرنسا: أساور القميص المخطط وحزام بإبزيم --- */
['fra_common','fra_cane','fra_hero'].forEach(k=>after(k,'over',(c,J)=>belt(c,J,'#2b2b30',1.3)));
['fra_common','fra_cane','fra_dancer','fra_hero'].forEach(k=>after(k,'front',(c,J)=>{cuff(c,J,'#f2efe8');armband(c,J,'#f2efe8',null,0.35);}));
/* --- بريطانيا: ياقة قميص بيضاء، شريط نحاسي على القبعة، أكمام مطوية --- */
['gbr_common','gbr_shield','gbr_hero'].forEach(k=>{after(k,'head',(c)=>{c.save();c.rotate(0.18);ell(c,-0.3,-1.2,4,0.4,'#c9a04a');c.restore();});after(k,'over',(c,J)=>collarV(c,J,'#f2efe8'));});
['gbr_common','gbr_breaker','gbr_shield'].forEach(k=>after(k,'front',(c,J)=>cuff(c,J,'#e8e0cc')));
/* --- ألمانيا: صدرية بخطوط عمودية متعددة الألوان، أكمام وسراويل مشقوقة أوضح، حزام بحقيبة --- */
landsDoublet=function(c,J,col){const P=torso(c,J,col,dk(col,0.3));if(!STYLE.on){for(let k=1;k<4;k++){const A=lp(P[0],P[1],k/4),B=lp(P[3],P[2],k/4);limb(c,A[0],A[1],B[0],B[1],0.6,LGOLD);}return;}
  const cols=['#f2efe8',RED2,LGOLD,'#f2efe8'];for(let k=0;k<4;k++){const u0=0.12+k*0.21,u1=u0+0.09;pg(c,[lp(P[0],P[1],u0),lp(P[0],P[1],u1),lp(P[3],P[2],u1),lp(P[3],P[2],u0)],cols[k]);}};
['deu_common','deu_pike','deu_zwei','deu_hero'].forEach(k=>after(k,'over',(c,J)=>{belt(c,J,'#5a3a22',1.3);pouchX(c,J,-2,'#6a4428');}));
['deu_common','deu_pike','deu_zwei','deu_hero'].forEach(k=>after(k,'robe',(c,J,p,col)=>{[J.legB,J.legF].forEach((L,n)=>{const P=lp(L.h,L.k,0.45);limb(c,P[0]-0.9,P[1]-1.4,P[0]-0.6,P[1]+1.4,0.55,n?RED2:'#f2efe8');limb(c,P[0]+0.8,P[1]-1.4,P[0]+1,P[1]+1.4,0.55,LGOLD);});}));
/* --- إثيوبيا: حواف ذهبية متعرجة، لوح أزرق، عصابة ذهبية، أشعة ذهبية في عرف الراس --- */
['eth_common','eth_drum','eth_healer','eth_hero'].forEach(k=>after(k,'robe',(c)=>{hemZig(c,LAST_ROBE,'#d9b040',0.84,8,1.1);}));
['eth_drum','eth_healer','eth_hero'].forEach(k=>after(k,'robe',(c)=>apron(c,LAST_ROBE,'#2f4a8a','#d9b040')));
['eth_common','eth_drum','eth_healer'].forEach(k=>after(k,'head',(c)=>{c.beginPath();c.ellipse(0,-1.3,4.25,1.2,0,Math.PI*1.02,Math.PI*1.98);c.strokeStyle='#d9b040';c.lineWidth=0.6;c.stroke();}));
after('eth_hero','head',(c)=>{for(let k=0;k<9;k++){const a=Math.PI*0.62+k/8*Math.PI*1.1;limb(c,Math.cos(a)*4.2,Math.sin(a)*4.2-0.8,Math.cos(a)*7.4,Math.sin(a)*7.4-1,0.5,'#f0c850');}});
after('eth_drum','over',(c,J)=>{const D=add(J.hip,rot(3.2,-0.4,J.pl));c.beginPath();for(let k=0;k<=6;k++){const x=D[0]-3+k,y=D[1]+(k%2?2.3:0.1);k?c.lineTo(x,y):c.moveTo(x,y);}c.strokeStyle='#e8d8b0';c.lineWidth=0.4;c.stroke();});
/* --- نيجيريا: معينات ذهبية وحواف ذهبية على الإزار النيلي، شريط ذراع جلدي، عباءة البطل الحمراء --- */
['nga_common','nga_guard','nga_heavy'].forEach(k=>after(k,'robe',(c)=>{const r=LAST_ROBE;if(!r)return;const [A,B]=edge(r,0.95);limb(c,A[0],A[1],B[0],B[1],0.6,'#d9b040');hemDiamonds(c,r,'#d9b040',0.72,4);
  const [C,D]=edge(r,0.02);limb(c,C[0],C[1],D[0],D[1],0.9,'#d9b040');}));
['nga_common','nga_heavy','nga_hero'].forEach(k=>after(k,'front',(c,J)=>armband(c,J,'#5a3a22','#d9b040',0.4)));
after('nga_hero','robe',(c)=>hemZig(c,LAST_ROBE,'#d9b040',0.9,6,1.1));
after('nga_hero','back',(c,J)=>{const hb=lp(J.legB.h,J.legB.k,0.8);pg(c,[add(J.chest,rot(-2.6,-0.8,J.a2)),add(J.chest,rot(1.2,-0.6,J.a2)),[hb[0]+1,hb[1]],[hb[0]-4,hb[1]]],ETR,'#d9b040',0.7);});
/* --- السودان: لفائف الصنادل المتقاطعة على الساق، حافة مغرة متعرجة --- */
['sdn_common','sdn_archer','sdn_torch','sdn_hero'].forEach(k=>after(k,'robe',(c,J)=>{legWraps(c,J,'#8a5a32');hemZig(c,LAST_ROBE,OCHRE,0.94,6,0.9);}));
/* --- البرازيل: قميص أبيض بلا أكمام بحواف خضراء وصفراء، خطوط جانبية على السروال، قبعة المعلّم بشريط أخضر --- */
['bra_common','bra_berim','bra_acro'].forEach(k=>after(k,'chest',(c,J,p,col)=>{const P=torso(c,J,mixHex(col,'#f6f3ec',0.75),dk(col,0.2));limb(c,P[0][0],P[0][1],P[3][0],P[3][1],0.5,BRG);limb(c,P[1][0],P[1][1],P[2][0],P[2][1],0.5,BRY);}));
['bra_common','bra_berim','bra_acro','bra_hero'].forEach(k=>after(k,'robe',(c,J)=>{[J.legB,J.legF].forEach(L=>{const A=lp(L.h,L.k,0.1),K=L.k,F=legPt(L,0.9);c.beginPath();c.moveTo(A[0]+1.2,A[1]);c.lineTo(K[0]+1.2,K[1]);c.lineTo(F[0]+1.2,F[1]);c.strokeStyle=BRG;c.lineWidth=0.5;c.stroke();
  c.beginPath();c.moveTo(A[0]+1.8,A[1]);c.lineTo(K[0]+1.8,K[1]);c.lineTo(F[0]+1.8,F[1]);c.strokeStyle=BRY;c.lineWidth=0.4;c.stroke();});}));
after('bra_hero','head',(c)=>{ell(c,0,-2.6,3.45,0.65,BRG);ell(c,0,-2.6,3.45,0.25,BRY);});
/* --- الأرجنتين: حواف سماوية على السترات وشريط القبعة وخط السروال، وخطوط البونشو --- */
['arg_common','arg_shawl','arg_hero'].forEach(k=>{after(k,'head',(c)=>{c.save();c.rotate(0.16);ell(c,0,-2.8,3.05,0.42,SKYB);c.restore();});
  after(k,'chest',(c,J)=>{const a=J.a2;limb(c,...add(J.chest,rot(-2.1,-0.2,a)),...add(J.hip,rot(-2.3,-1,J.pl)),0.45,SKYB);limb(c,...add(J.chest,rot(1,-0.6,a)),...add(J.hip,rot(1.4,-1,J.pl)),0.45,SKYB);});
  after(k,'robe',(c,J)=>{const L=J.legF,A=lp(L.h,L.k,0.1),F=legPt(L,0.9);c.beginPath();c.moveTo(A[0]+1.4,A[1]);c.lineTo(L.k[0]+1.4,L.k[1]);c.lineTo(F[0]+1.4,F[1]);c.strokeStyle=SKYB;c.lineWidth=0.45;c.stroke();});});
after('arg_gaucho','over',(c,J)=>{const a=J.a2,S1=add(J.chest,rot(-3.2,-0.6,a)),S2=add(J.chest,rot(3.4,-0.4,a)),F=lp(J.legF.h,J.legF.k,0.55),B=lp(J.legB.h,J.legB.k,0.55);
  const A=lp(S1,[B[0]-2.6,B[1]],0.75),Bp=lp(S2,[F[0]+2.6,F[1]],0.75);limb(c,A[0],A[1],Bp[0],Bp[1],0.7,SKYB);});
/* --- المكسيك: حافة متعرجة حمراء وبيضاء على الدرع القطني والإزار، حزام ذهبي --- */
['mex_common','mex_jaguar','mex_atlatl','mex_hero'].forEach(k=>after(k,'robe',(c,J)=>{const r=LAST_ROBE;if(!r)return;hemBand(c,r,0.78,0.98,'#f2efe6');hemZig(c,r,RED3,0.9,6,1);
  const [A,B]=edge(r,0.05);limb(c,A[0],A[1],B[0],B[1],0.9,'#d9b040');}));
