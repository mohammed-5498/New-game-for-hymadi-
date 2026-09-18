/* ====== صوت اللعبة: كل المؤثرات مولَّدة بالكود (Web Audio) بلا أي ملفات ======
   الاستعمال:
     GameAudio.init();                       // مرة واحدة عند بدء اللعبة
     document.addEventListener('pointerdown', GameAudio.unlock, {once:true});
     GameAudio.play('hit_melee', {pan:-0.3});
     GameAudio.music.start(); GameAudio.music.setIntensity(0.8);
   ملاحظة الجوال: المتصفح يمنع الصوت قبل أول لمسة، لذلك unlock() إلزامية. */
const GameAudio = (function(){
  let ctx=null, master=null, sfxGain=null, musGain=null, ready=false;
  let vol={sfx:0.7, music:0.35}, muted=false;
  let noiseBuf=null;
  const lastPlay={}, VOICE_CAP=18; let voices=0;

  function init(){
    if(ctx)return true;
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return false;
    ctx=new AC();
    master=ctx.createGain(); master.gain.value=muted?0:1; master.connect(ctx.destination);
    sfxGain=ctx.createGain(); sfxGain.gain.value=vol.sfx; sfxGain.connect(master);
    musGain=ctx.createGain(); musGain.gain.value=vol.music; musGain.connect(master);
    const n=ctx.sampleRate*1.2; noiseBuf=ctx.createBuffer(1,n,ctx.sampleRate);
    const d=noiseBuf.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
    ready=true; return true;
  }
  function unlock(){ if(!ctx&&!init())return; if(ctx.state==='suspended')ctx.resume(); }
  function setVolume(s,m){ if(s!=null){vol.sfx=s; if(sfxGain)sfxGain.gain.value=s;}
                           if(m!=null){vol.music=m; if(musGain)musGain.gain.value=m;} }
  function setMuted(v){ muted=!!v; if(master)master.gain.value=muted?0:1; }

  /* ---- لبنات التوليد ---- */
  function out(pan){
    if(pan==null||!ctx.createStereoPanner)return sfxGain;
    const p=ctx.createStereoPanner(); p.pan.value=Math.max(-1,Math.min(1,pan)); p.connect(sfxGain); return p;
  }
  function env(node,t0,a,d,peak){
    const g=ctx.createGain();
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001,peak),t0+a);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+a+d);
    node.connect(g); return g;
  }
  function tone(type,f0,f1,t0,a,d,peak,dest){
    const o=ctx.createOscillator(); o.type=type;
    o.frequency.setValueAtTime(f0,t0);
    if(f1&&f1!==f0)o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t0+a+d);
    const g=env(o,t0,a,d,peak); g.connect(dest);
    o.start(t0); o.stop(t0+a+d+0.02); track(a+d);
    return o;
  }
  function noise(t0,dur,peak,dest,filter){
    const s=ctx.createBufferSource(); s.buffer=noiseBuf; s.loop=true;
    let node=s;
    if(filter){
      const f=ctx.createBiquadFilter(); f.type=filter.type||'bandpass';
      f.frequency.setValueAtTime(filter.f0||1200,t0);
      if(filter.f1)f.frequency.exponentialRampToValueAtTime(Math.max(40,filter.f1),t0+dur);
      f.Q.value=filter.q==null?1:filter.q;
      s.connect(f); node=f;
    }
    const g=env(node,t0,Math.min(0.012,dur*0.3),dur,peak); g.connect(dest);
    s.start(t0); s.stop(t0+dur+0.05); track(dur);
    return s;
  }
  function track(d){ voices++; setTimeout(()=>voices--, (d+0.1)*1000); }

  /* ---- قاموس المؤثرات ---- */
  const SFX={
    swing(t,o){ noise(t,0.13,0.25,o,{type:'bandpass',f0:2600,f1:700,q:0.8}); },
    hit_melee(t,o){ tone('sine',180,60,t,0.004,0.13,0.55,o);
                    noise(t,0.07,0.4,o,{type:'bandpass',f0:1800,f1:400,q:1.2}); },
    hit_heavy(t,o){ tone('sine',120,38,t,0.005,0.3,0.8,o);
                    noise(t,0.16,0.5,o,{type:'lowpass',f0:1400,f1:200,q:0.7}); },
    hit_shield(t,o){ tone('square',420,300,t,0.004,0.1,0.22,o);
                     noise(t,0.09,0.3,o,{type:'bandpass',f0:3200,f1:1600,q:3}); },
    arrow(t,o){ noise(t,0.16,0.22,o,{type:'highpass',f0:900,f1:3000,q:0.7}); },
    stone(t,o){ noise(t,0.1,0.18,o,{type:'bandpass',f0:1500,f1:900,q:2}); },
    fire(t,o){ noise(t,0.55,0.32,o,{type:'lowpass',f0:900,f1:260,q:0.6});
               tone('sawtooth',90,45,t,0.02,0.5,0.14,o); },
    death(t,o){ tone('triangle',300,70,t,0.01,0.42,0.3,o);
                noise(t,0.2,0.2,o,{type:'lowpass',f0:800,f1:200,q:0.5}); },
    ult_ready(t,o){ [523,659,784].forEach((f,i)=>tone('triangle',f,f,t+i*0.07,0.01,0.16,0.22,o)); },
    ult_cast(t,o){ tone('sine',300,50,t,0.01,0.5,0.85,o);
                   tone('sawtooth',150,40,t,0.02,0.4,0.3,o);
                   noise(t,0.35,0.55,o,{type:'lowpass',f0:2200,f1:180,q:0.7}); },
    heal(t,o){ [659,880,1175].forEach((f,i)=>tone('sine',f,f*1.02,t+i*0.06,0.02,0.22,0.16,o)); },
    capture_tick(t,o){ tone('sine',880,880,t,0.005,0.05,0.1,o); },
    capture_done(t,o){ [523,659,784,1046].forEach((f,i)=>tone('triangle',f,f,t+i*0.08,0.015,0.28,0.2,o)); },
    district_lost(t,o){ [784,659,523,392].forEach((f,i)=>tone('triangle',f,f,t+i*0.09,0.015,0.3,0.2,o)); },
    spawn(t,o){ tone('sine',300,620,t,0.02,0.12,0.16,o); },
    select(t,o){ tone('square',900,900,t,0.003,0.04,0.12,o); },
    command(t,o){ tone('square',620,760,t,0.004,0.06,0.12,o); },
    ui_tap(t,o){ tone('square',700,700,t,0.003,0.035,0.1,o); },
    alert(t,o){ tone('square',740,740,t,0.006,0.11,0.2,o);
                tone('square',560,560,t+0.14,0.006,0.13,0.2,o); },
    whistle(t,o){ const osc=tone('sine',2100,2400,t,0.02,0.4,0.16,o);
                  const lfo=ctx.createOscillator(), lg=ctx.createGain();
                  lfo.frequency.value=22; lg.gain.value=90; lfo.connect(lg);
                  lg.connect(osc.frequency); lfo.start(t); lfo.stop(t+0.45); },
    victory(t,o){ [523,659,784,1046,1318].forEach((f,i)=>tone('triangle',f,f,t+i*0.13,0.02,0.45,0.22,o)); },
    defeat(t,o){ [440,392,330,262].forEach((f,i)=>tone('triangle',f,f,t+i*0.2,0.03,0.6,0.22,o)); }
  };

  /* ---- التشغيل مع حد للأصوات المتزامنة ---- */
  function play(name,opt){
    if(!ready||muted||!SFX[name])return;
    if(ctx.state==='suspended')return;
    opt=opt||{};
    const now=ctx.currentTime, key=name;
    const gap=opt.minGap==null?0.045:opt.minGap;
    if(lastPlay[key]&&now-lastPlay[key]<gap)return;     // يمنع تكرار نفس الصوت عشرات المرات
    if(voices>VOICE_CAP)return;
    lastPlay[key]=now;
    try{ SFX[name](now+0.001, out(opt.pan)); }catch(e){}
  }
  /* pan حسب موقع الحدث على الشاشة: 0 = يسار الشاشة، 1 = يمينها */
  function playAt(name,screenX,screenWidth,opt){
    const p=screenWidth?((screenX/screenWidth)*2-1)*0.7:0;
    play(name,Object.assign({pan:p},opt||{}));
  }

  /* ---- موسيقى مولَّدة بالكود: حلقة قاتمة بإيقاع بطيء ---- */
  const music=(function(){
    let on=false, timer=null, next=0, step=0, intensity=0.3;
    const BPM=76, SPB=60/BPM/2;                     // نصف ضربة
    const ROOT=110;                                  // لا (A2)
    const SCALE=[0,3,5,7,10];                        // خماسي صغير
    const BASS=[0,0,3,0, 5,0,3,0, 0,0,7,0, 5,3,0,0];
    function n(semi){ return ROOT*Math.pow(2,semi/12); }
    function schedule(){
      while(next<ctx.currentTime+0.25){
        const t=next, s=step%16;
        // باص
        const bs=BASS[s];
        if(s%2===0){
          const o=ctx.createOscillator(); o.type='triangle';
          o.frequency.setValueAtTime(n(bs),t);
          const g=ctx.createGain();
          g.gain.setValueAtTime(0.0001,t);
          g.gain.exponentialRampToValueAtTime(0.16,t+0.02);
          g.gain.exponentialRampToValueAtTime(0.0001,t+SPB*1.6);
          o.connect(g); g.connect(musGain); o.start(t); o.stop(t+SPB*1.8);
        }
        // طبقة هادئة كل 8 خطوات
        if(s===0||s===8){
          [0,7,10].forEach((iv,i)=>{
            const o=ctx.createOscillator(); o.type='sine';
            o.frequency.setValueAtTime(n(iv)*2,t);
            const g=ctx.createGain();
            g.gain.setValueAtTime(0.0001,t);
            g.gain.exponentialRampToValueAtTime(0.05+intensity*0.03,t+0.4);
            g.gain.exponentialRampToValueAtTime(0.0001,t+SPB*7);
            o.connect(g); g.connect(musGain); o.start(t); o.stop(t+SPB*7.5);
          });
        }
        // إيقاع يزداد مع حرارة المعركة
        if(intensity>0.45&&(s%4===2)){
          const src=ctx.createBufferSource(); src.buffer=noiseBuf; src.loop=true;
          const f=ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=5000;
          const g=ctx.createGain();
          g.gain.setValueAtTime(0.0001,t);
          g.gain.exponentialRampToValueAtTime(0.03+intensity*0.05,t+0.005);
          g.gain.exponentialRampToValueAtTime(0.0001,t+0.08);
          src.connect(f); f.connect(g); g.connect(musGain); src.start(t); src.stop(t+0.12);
        }
        if(intensity>0.7&&s%8===4){
          const o=ctx.createOscillator(); o.type='sine';
          o.frequency.setValueAtTime(70,t); o.frequency.exponentialRampToValueAtTime(40,t+0.2);
          const g=ctx.createGain();
          g.gain.setValueAtTime(0.0001,t);
          g.gain.exponentialRampToValueAtTime(0.22,t+0.01);
          g.gain.exponentialRampToValueAtTime(0.0001,t+0.25);
          o.connect(g); g.connect(musGain); o.start(t); o.stop(t+0.3);
        }
        // لحن متفرق
        if(intensity>0.2&&(s===6||s===14)&&Math.random()<0.6){
          const iv=SCALE[Math.floor(Math.random()*SCALE.length)];
          const o=ctx.createOscillator(); o.type='triangle';
          o.frequency.setValueAtTime(n(iv)*4,t);
          const g=ctx.createGain();
          g.gain.setValueAtTime(0.0001,t);
          g.gain.exponentialRampToValueAtTime(0.06,t+0.03);
          g.gain.exponentialRampToValueAtTime(0.0001,t+SPB*2);
          o.connect(g); g.connect(musGain); o.start(t); o.stop(t+SPB*2.2);
        }
        next+=SPB; step++;
      }
    }
    return {
      start(){ if(!ready||on)return; on=true; next=ctx.currentTime+0.1; step=0;
               timer=setInterval(()=>{ if(ctx.state==='running')schedule(); },40); },
      stop(){ on=false; if(timer)clearInterval(timer); timer=null; },
      isOn(){ return on; },
      /* 0 = هدوء، 1 = معركة كبيرة. اربطها بعدد الوحدات المشتبكة */
      setIntensity(v){ intensity=Math.max(0,Math.min(1,v)); }
    };
  })();

  return {init,unlock,play,playAt,setVolume,setMuted,music,
          get context(){return ctx;}, names:Object.keys(SFX)};
})();
if(typeof module!=='undefined')module.exports={GameAudio};
