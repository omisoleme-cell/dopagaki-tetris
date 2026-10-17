/* DOPAGAKI TURBO: procedural synth. 196–224 BPM, original notes and drums. */
(()=>{
const $=id=>document.getElementById(id),AC=window.AudioContext||window.webkitAudioContext;
let ac,compressor,master,music,fx,clock,step=0,mutedMusic=false,mutedSE=false,started=false, danger=0, intense=false;
const mode=()=>$('effectsMode')?.value||'full';
// Keep fixed overlays outside transformed stage and any clipping ancestors.
for(const id of ['effectOverlay','screenFlash','dangerVignette','particleLayer','dangerLabel','comboPop','jackpotFX','stageLights','comboFever']){const el=$(id);if(el)document.body.appendChild(el);}

function init(){if(!AC)return false;if(!ac){ac=new AC();compressor=ac.createDynamicsCompressor();compressor.threshold.value=-16;compressor.knee.value=12;compressor.ratio.value=8;compressor.attack.value=.003;compressor.release.value=.2;master=ac.createGain();master.gain.value=.8;master.connect(compressor);compressor.connect(ac.destination);music=ac.createGain();music.gain.value=.34;music.connect(master);fx=ac.createGain();fx.gain.value=1.18;fx.connect(master)}if(ac.state==='suspended')ac.resume().catch(()=>{});return true}
function tone(freq,dur=.1,type='sawtooth',vol=.1,delay=0,bus=fx,end=0){if(!ac)return;let at=ac.currentTime+delay,o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(Math.max(30,freq),at);if(end)o.frequency.exponentialRampToValueAtTime(Math.max(30,end),at+dur);g.gain.setValueAtTime(Math.max(.0001,vol),at);g.gain.exponentialRampToValueAtTime(.0001,at+dur);o.connect(g);g.connect(bus);o.start(at);o.stop(at+dur+.01)}
function noise(dur=.1,vol=.1,delay=0,bus=fx){if(!ac)return;let n=Math.floor(ac.sampleRate*dur),b=ac.createBuffer(1,n,ac.sampleRate),a=b.getChannelData(0);for(let i=0;i<n;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/n,1.5);let s=ac.createBufferSource(),g=ac.createGain();s.buffer=b;g.gain.value=vol;s.connect(g);g.connect(bus);s.start(ac.currentTime+delay)}
function play(kind){if(mutedSE||!init())return;switch(kind){
case 'move':tone(300,.03,'triangle',.03);break;
case 'rotate':tone(600,.075,'sine',.12);tone(950,.06,'triangle',.05,.04);break;
case 'hold':for(let i=0;i<3;i++)tone([380,580,880][i],.1,'square',.09,i*.055);break;
case 'drop':tone(150,.15,'sawtooth',.2,0,fx,37);noise(.1,.1);break;
case 'clear':for(let i=0;i<4;i++)tone([659,880,1046,1318][i],.12,'square',.10,i*.043);break;
case 'tetris':for(let i=0;i<12;i++)tone(380*Math.pow(2,i/13),.24,'sawtooth',.105,i*.048);noise(.4,.16);break;
case 'attack':tone(760,.24,'sawtooth',.18,0,fx,100);tone(1140,.17,'square',.13,.08);noise(.18,.12);break;
case 'warn':for(let i=0;i<3;i++)tone(i%2?360:240,.13,'square',.15,i*.13);break;
case 'hit':noise(.4,.23);tone(120,.35,'sawtooth',.25,0,fx,32);break;
case 'cancel':for(let i=0;i<5;i++)tone(600+i*170,.095,'sine',.12,i*.05);break;
case 'ko':for(let i=0;i<12;i++)tone(270*Math.pow(2,i/12),.17,'sawtooth',.12,i*.08);noise(.65,.15);break;
case 'treasure':for(let i=0;i<12;i++){tone(392*Math.pow(2,([0,3,7,12,15,19,24,19,15,24,27,31][i])/12),.28,'sawtooth',.12,i*.075);if(i%2===0)noise(.065,.1,i*.075)}break;
case 'ren':for(let i=0;i<7;i++)tone((460+Math.min(12,danger*8)*40)*Math.pow(2,i/11),.16,'square',.1,i*.042);break;
case 'start':for(let i=0;i<6;i++)tone([392,523,659,784,1047,1568][i],.2,'square',.1,i*.10);break;
case 'lose':for(let i=0;i<4;i++)tone(400-i*90,.35,'sawtooth',.16,i*.15);break;
case 'win':for(let i=0;i<12;i++)tone(523*Math.pow(2,[0,4,7,12,7,12,16,19,12,16,19,24][i]/12),.23,'square',.11,i*.1);break;
}}
const lead=[76,79,83,86,88,86,83,79,74,77,81,84,86,84,81,77,72,76,79,83,84,83,79,76,74,77,81,86,88,91,88,86];
const bass=[40,40,43,43,36,36,38,38];
function bpm(){return 196+(danger>.65?28:danger>.25?14:0)}
function sequence(){if(!started||!ac)return;let t=step++,dt=60/bpm()/4;if(!mutedMusic){let n=lead[t%lead.length],root=bass[Math.floor(t/16)%bass.length];if(t%2===0)tone(440*2**((n-69)/12),dt*1.7,'sawtooth',.055,0,music);if(t%4===0){tone(440*2**((root-69)/12),dt*3.8,'sawtooth',.18,0,music);tone(65,.13,'sine',.21,0,music,32)}if(t%2===0)noise(.065,.055,0,music);else noise(.025,.022,0,music);if(t%8===6)tone(440*2**((n+12-69)/12),dt*.9,'square',.025,0,music);if(danger>.3&&t%4===2)tone(440*2**((root+24-69)/12),dt*1.2,'square',.042,0,music)}clock=setTimeout(sequence,dt*1000)}
function startMusic(){if(!init())return;if(!started){started=true;step=0;sequence()}}
let particles=[],particleTick=false,feverTimeout=null,comboTimeout=null,comboRankTimeout=null,impactTimers=[];
const canvas=$('particleLayer'),g=canvas.getContext('2d');
function resize(){canvas.width=innerWidth*devicePixelRatio;canvas.height=innerHeight*devicePixelRatio;g.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)}addEventListener('resize',resize);resize();
function shower(strong=true){if(mode()!=='full'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;let count=strong?Math.min(260,125+Math.round(danger*110)):65;for(let i=0;i<count;i++){let a=Math.random()*Math.PI*2,v=3+Math.random()*13;particles.push({x:innerWidth*(.35+Math.random()*.3),y:innerHeight*(.28+Math.random()*.42),vx:Math.cos(a)*v,vy:Math.sin(a)*v-3,life:35+Math.random()*35,color:['#fff000','#ff289e','#00f7ff','#fff','#a76bff'][i%5],size:2+Math.random()*7})}if(!particleTick)requestAnimationFrame(particleFrame)}
function particleFrame(){particleTick=true;g.clearRect(0,0,innerWidth,innerHeight);for(let i=particles.length-1;i>=0;i--){let p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=.25;p.life--;g.globalAlpha=Math.min(1,p.life/25);g.fillStyle=p.color;g.fillRect(p.x,p.y,p.size,p.size);if(p.life<=0)particles.splice(i,1)}g.globalAlpha=1;if(particles.length)requestAnimationFrame(particleFrame);else particleTick=false}
function burst(title,subtitle='',strength='strong'){if(mode()==='off')return;let o=$('effectOverlay'),f=$('screenFlash');$('effectCaption').textContent=title;$('effectSubtitle').textContent=subtitle;o.classList.remove('burst');void o.offsetWidth;o.classList.add('burst');if(mode()==='full'&&strength==='strong'){f.classList.remove('flash');void f.offsetWidth;f.classList.add('flash');document.body.classList.remove('shake','fever-surge');void document.body.offsetWidth;document.body.classList.add('shake','fever-surge');shower(true);setTimeout(()=>document.body.classList.remove('shake','fever-surge'),650)}}
function pop(t){if(mode()==='off')return;let p=$('comboPop');p.textContent=t;p.classList.remove('pop');void p.offsetWidth;p.classList.add('pop');if(mode()==='full')shower(false)}
function lineTreasure(lines,ren,gained,comboCount,damage=0){
  if(lines<1||lines>4)return;
  // Only one clear banner is allowed. Never stack lower-tier clear effects on 4-line clears.
  play(lines===4?'tetris':'treasure');
  if(ren>0)play('ren');
  if(mode()==='off')return;
  const names=['','SINGLE IMPACT','DOUBLE RUSH','TRIPLE FEVER','TETRIS JACKPOT'];
  const titles=['','1 LINE','2 LINES','3 LINES','TETRIS!'];
  const jackpot=$('jackpotFX');
  jackpot.dataset.tier=String(lines);
  $('jackpotStamp').textContent=titles[lines];
  $('jackpotRen').textContent=ren>0?`${ren} REN`:'LINE CLEAR';
  $('jackpotSub').textContent=`${names[lines]}  +${gained.toLocaleString()} PTS`+(damage>0?`   ⚡ ${damage} 攻撃`:'');
  // 1–2 line clears stay snappy even with REN bonuses. Only high-power 3–4 line clears linger.
  const duration = lines>=3 && damage>=3
    ? Math.min(2500, lines===4 ? 1600+Math.min(900,(damage-3)*130) : 1350+Math.min(650,(damage-3)*110))
    : lines===4 ? 1500 : lines===3 ? 1150 : lines===2 ? 830 : 680;
  // Escalate visuals only when the clear actually lasts longer.
  const intensity=Math.max(0,Math.min(1,(duration-680)/(2500-680)));
  jackpot.style.setProperty('--clear-duration',duration+'ms');
  jackpot.style.setProperty('--fx-intensity',intensity.toFixed(3));
  jackpot.style.setProperty('--beam-speed',(1.8-intensity*1.15).toFixed(2)+'s');
  jackpot.style.setProperty('--halo-strength',(0.55+intensity*0.45).toFixed(2));
  $('stageLights').style.setProperty('--light-duration',Math.min(duration,2200)+'ms');
  for(const id of impactTimers)clearTimeout(id);
  impactTimers=[];
  if(mode()==='full'&&intensity>=.45){
    const pulses=intensity>=.85?3:2;
    for(let i=1;i<=pulses;i++){
      impactTimers.push(setTimeout(()=>{
        if(!jackpot.classList.contains('jackpot-live'))return;
        shower(true);
        const flash=$('screenFlash');
        flash.classList.remove('flash');void flash.offsetWidth;flash.classList.add('flash');
        play('ren');
      },Math.round(duration*(.28+i*.13))));
    }
  }
  jackpot.classList.remove('jackpot-live');void jackpot.offsetWidth;jackpot.classList.add('jackpot-live');
  clearTimeout(feverTimeout);feverTimeout=setTimeout(()=>jackpot.classList.remove('jackpot-live'),duration);
  const lights=$('stageLights');lights.classList.remove('lights-live');void lights.offsetWidth;if(mode()==='full')lights.classList.add('lights-live');
  const arena=$('arena');arena.classList.remove('camera-1','camera-2','camera-3','camera-4tetris');void arena.offsetWidth;
  if(mode()==='full'){
    if(lines===4)tetrisCamera();
    else{arena.classList.add(lines===3?'camera-3':lines===2?'camera-2':'camera-1');
      setTimeout(()=>arena.classList.remove('camera-1','camera-2','camera-3'),820);}
  }
  shower(lines>=3);
  // A single chosen tier's banner replaces the older overlapping generic burst.
  // Combo number is displayed in a persistent HUD, not as another full-screen banner.
  if((comboCount||0)>=2)comboBlast(comboCount,lines,ren);
}

function comboBlast(count,lines,ren){
  if(count<2)return;
  const arena=$('arena');
  const tier=Math.min(4,Math.floor((count-2)/2)+1);
  arena.classList.remove('combo-rank-1','combo-rank-2','combo-rank-3','combo-rank-4');
  arena.classList.add('combo-rank-'+tier);
  clearTimeout(comboRankTimeout);
  comboRankTimeout=setTimeout(()=>arena.classList.remove('combo-rank-1','combo-rank-2','combo-rank-3','combo-rank-4'),900);
  // No duplicate full-screen COMBO caption over the clear-specific animation.
  for(let i=0;i<Math.min(14,count+3);i++)tone((390+count*26)*Math.pow(2,i/18),.1,'square',Math.min(.16,.055+count*.008),i*.028,fx);
}
function comboReset(){ for(const id of impactTimers)clearTimeout(id);impactTimers=[]; const box=$('comboFever'); if(box) box.classList.remove('combo-live'); $('jackpotFX')?.classList.remove('jackpot-live'); const arena=$('arena'); arena?.classList.remove('combo-rank-1','combo-rank-2','combo-rank-3','combo-rank-4','camera-4tetris'); }
function tetrisCamera(){ if(mode()==='off') return; const arena=$('arena'); if(!arena) return; arena.classList.remove('camera-4tetris'); void arena.offsetWidth; arena.classList.add('camera-4tetris'); setTimeout(()=>arena.classList.remove('camera-4tetris'),1200); }

function renBreak(n){if(n>=3&&mode()!=='off')pop(`${n} REN END`);}
function setDanger(height,pending){let incoming=Math.min(1,pending/8),tower=Math.max(0,Math.min(1,(height-9)/10));danger=Math.max(tower,incoming*.9);let el=$('dangerVignette'),label=$('dangerLabel');if(!el)return;el.style.setProperty('--heat',Math.min(.92,danger*1.16));el.classList.toggle('on',danger>.1&&mode()!=='off');el.classList.toggle('incoming',pending>0);label.classList.toggle('on',danger>.42&&mode()!=='off');label.textContent=pending>0?'⚠ お邪魔接近 '+pending+'段 ⚠':'⚠ 積みすぎ注意！ ⚠';if(!intense&&danger>.72){intense=true;play('warn')}if(danger<.42)intense=false}
$('musicToggle').onclick=()=>{startMusic();mutedMusic=!mutedMusic;$('musicToggle').textContent=mutedMusic?'♫ BGM OFF':'♫ BGM ON'};
$('soundToggle').onclick=()=>{init();mutedSE=!mutedSE;$('soundToggle').textContent=mutedSE?'♪ SE OFF':'♪ SE ON'};
$('volumeControl').oninput=e=>{if(init())master.gain.value=Number(e.target.value)/100};
$('effectsMode').onchange=()=>{if(mode()==='off'){particles.length=0;g.clearRect(0,0,innerWidth,innerHeight);$('dangerVignette').classList.remove('on');$('dangerLabel').classList.remove('on')}};
document.addEventListener('pointerdown',startMusic,{once:true});document.addEventListener('keydown',startMusic,{once:true});document.addEventListener('visibilitychange',()=>{if(ac){if(document.hidden)ac.suspend();else ac.resume().catch(()=>{})}});
window.DopaFX={play,burst,pop,startMusic,setDanger,lineTreasure,renBreak,comboBlast,comboReset,tetrisCamera};
})();
