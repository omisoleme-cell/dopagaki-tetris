const socket=io();
const $=id=>document.getElementById(id);
const colors=['#0e1524','#22d3ee','#eab308','#a855f7','#22c55e','#ef4444','#3b82f6','#f97316','#8a8f99'];
const shapes=[[[1,1,1,1]],[[2,2],[2,2]],[[0,3,0],[3,3,3]],[[0,4,4],[4,4,0]],[[5,5,0],[0,5,5]],[[6,0,0],[6,6,6]],[[0,0,7],[7,7,7]]];
let myId='',room=null,active=false,board=[],piece=null,timer=null,sendCount=0,bag=[],nextQueue=[],heldType=null,holdUsed=false;
let score=0,totalLines=0,level=1,combo=-1,dropInterval=700;
let pendingGarbage=[]; // {amount,readyAt}: 予告後、ブロックを固定したときにせり上がる
const GARBAGE_DELAY=1200;
function showScore(message){
  $('score').textContent=String(score).padStart(7,'0');
  $('lines').textContent=String(totalLines);
  $('level').textContent=String(level);
  $('combo').textContent=combo>=0?String(combo+1):'0';$('ren').textContent=combo>0?String(combo):'0';$('combo').classList.toggle('combo-hot',combo>=2);
  if(message!==undefined)$('scoreEvent').textContent=message;
}
function awardClear(lines,damage=0){
  if(!lines){if(combo>0){DopaFX.renBreak(combo);}combo=-1;showScore('CHAIN RESET');DopaFX.comboReset?.();return;}
  combo++;
  const base=[0,100,300,500,800][lines]||0;
  const bonus=combo>0?50*combo*level:0;
  const gained=base*level+bonus;
  score+=gained;
  totalLines+=lines;
  const newLevel=1+Math.floor(totalLines/10);
  if(newLevel!==level){level=newLevel;dropInterval=Math.max(110,700*Math.pow(.86,level-1));clearInterval(timer);timer=setInterval(tick,dropInterval);}
  const comboCount=combo+1;
  showScore((lines===4?'TETRIS!':lines+' LINE CLEAR')+'  +'+gained.toLocaleString()+(comboCount>1?' / '+comboCount+' COMBO':''));
  DopaFX.lineTreasure(lines,combo,gained,comboCount,damage);
}
function pendingTotal(){return pendingGarbage.reduce((sum,g)=>sum+g.amount,0);}
function showGarbage(){const n=pendingTotal();DopaFX.setDanger(board.length?board.reduce((h,r,i)=>r.some(Boolean)?Math.max(h,20-i):h,0):0,n);$('incoming').textContent='お邪魔予告: '+n+'段';$('incoming').classList.toggle('danger',n>0);$('garbageMeter').style.width=Math.min(100,n/12*100)+'%';}
function cancelGarbage(power){while(power>0&&pendingGarbage.length){const first=pendingGarbage[0];const cancelled=Math.min(power,first.amount);first.amount-=cancelled;power-=cancelled;if(!first.amount)pendingGarbage.shift();}showGarbage();return power;}
function addGarbage(amount){DopaFX.play('warn');DopaFX.burst('襲来！','お邪魔 '+amount+'段','light');pendingGarbage.push({amount,readyAt:Date.now()+GARBAGE_DELAY});showGarbage();}
function applyGarbage(){const now=Date.now();let count=0;pendingGarbage=pendingGarbage.filter(g=>{if(g.readyAt<=now){count+=g.amount;return false;}return true;});count=Math.min(count,12);if(count){DopaFX.play('hit');DopaFX.burst('どぱがき直撃！',count+'段せり上がり');const hole=Math.floor(Math.random()*10);for(let i=0;i<count;i++){const top=board.shift();if(top.some(Boolean)){die();return;}board.push(Array.from({length:10},(_,x)=>x===hole?0:8));}}showGarbage();}
const empty=()=>Array.from({length:20},()=>Array(10).fill(0));
const clone=m=>m.map(r=>[...r]);
function refillBag(){if(!bag.length){bag=[0,1,2,3,4,5,6];for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}}
function ensureQueue(){while(nextQueue.length<6){refillBag();nextQueue.push(bag.pop());}}
function randomPiece(){ensureQueue();const type=nextQueue.shift();ensureQueue();renderNext();return fromType(type);}
function drawPreview(c,type,dim=22){const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#0e1524';ctx.fillRect(0,0,c.width,c.height);if(type===null||type===undefined)return;const m=shapes[type],ox=(c.width-m[0].length*dim)/2,oy=(c.height-m.length*dim)/2;m.forEach((r,y)=>r.forEach((v,x)=>{if(!v)return;ctx.fillStyle=colors[v];ctx.shadowColor=colors[v];ctx.shadowBlur=8;ctx.fillRect(ox+x*dim+1,oy+y*dim+1,dim-2,dim-2);}));ctx.shadowBlur=0;}
function renderNext(){document.querySelectorAll('.next-piece').forEach((c,i)=>drawPreview(c,nextQueue[i],i===0?20:16));}
function fromType(type){const m=clone(shapes[type]);return {type,m,x:Math.floor((10-m[0].length)/2),y:0};}
function fits(p){return p.m.every((row,y)=>row.every((v,x)=>!v||(p.x+x>=0&&p.x+x<10&&p.y+y<20&&(p.y+y<0||!board[p.y+y][p.x+x]))));}
function draw(canvas,m,cell){let ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);for(let y=0;y<20;y++)for(let x=0;x<10;x++){ctx.fillStyle=colors[m[y]?.[x]||0];ctx.fillRect(x*cell+1,y*cell+1,cell-2,cell-2);}}
function displayed(){const m=clone(board);if(piece)piece.m.forEach((r,y)=>r.forEach((v,x)=>{if(v&&piece.y+y>=0&&m[piece.y+y]?.[piece.x+x]!==undefined)m[piece.y+y][piece.x+x]=v;}));return m;}
function render(){if(active)draw($('board'),displayed(),24);}
function update(){if(!active)return;DopaFX.setDanger(board.reduce((h,r,i)=>r.some(Boolean)?Math.max(h,20-i):h,0),pendingTotal());render();socket.emit('board',displayed());}
function spawn(){piece=randomPiece();holdUsed=false;if(!fits(piece))die();renderHold();}
function renderHold(){drawPreview($('holdCanvas'),heldType,21);}
function hold(){if(!active||!piece||holdUsed)return;const prev=piece.type;if(heldType===null){piece=randomPiece();}else{piece=fromType(heldType);}heldType=prev;holdUsed=true;renderHold();DopaFX.play('hold');DopaFX.pop('HOLD!');if(!fits(piece)){die();return;}update();}
function move(dx,dy){if(!active)return false;piece.x+=dx;piece.y+=dy;if(!fits(piece)){piece.x-=dx;piece.y-=dy;return false;}update();return true;}
function rotate(){if(!active)return;let original=piece.m,ox=piece.x;piece.m=original[0].map((_,i)=>original.map(r=>r[i]).reverse());for(const n of [0,-1,1,-2,2]){piece.x=ox+n;if(fits(piece)){DopaFX.play('rotate');update();return;}}piece.x=ox;piece.m=original;}
function lock(){
  if(!active)return;
  piece.m.forEach((r,y)=>r.forEach((v,x)=>{if(v&&piece.y+y>=0)board[piece.y+y][piece.x+x]=v;}));
  const remaining=board.filter(r=>r.some(v=>!v));
  const lines=20-remaining.length;
  board=[...Array.from({length:lines},()=>Array(10).fill(0)),...remaining];
  // REN is the number of successive piece locks with at least one line clear beyond the first.
  // Escalating, capped combo attack power, inspired by versus block puzzlers.
  const nextRen=lines>0?combo+1:-1;
  const renAttack=nextRen>=1?[0,0,1,1,2,2,3,3,4,4,5][Math.min(nextRen,10)]:0;
  const power=([0,0,1,2,4][lines]||0)+renAttack;
  const beforeCancel=pendingTotal();const outgoing=cancelGarbage(power);
  awardClear(lines,outgoing);if(beforeCancel>pendingTotal()){DopaFX.play('cancel');DopaFX.pop('相殺!!');}
  if(outgoing>0){DopaFX.play('attack');DopaFX.pop('攻撃 '+outgoing+'段!');for(let left=outgoing;left>0;left-=4)socket.emit('attack',Math.min(4,left));sendCount+=outgoing;$('attack').textContent='送信ライン: '+sendCount;}
  // 攻撃を受けたら予告しておき、次回以降の固定時に下からせり上がる
  applyGarbage();
  if(!active)return;
  spawn();update();
}
function tick(){if(!active)return;if(!move(0,1))lock();}
function die(){if(!active)return;DopaFX.setDanger(0,0);DopaFX.play('lose');DopaFX.burst('終了…','NEXT CHALLENGE');active=false;clearInterval(timer);piece=null;$('status').textContent='脱落';socket.emit('dead');}
function begin(){DopaFX.startMusic();DopaFX.play('start');DopaFX.burst('開幕!!','どぱがき BATTLE START');clearInterval(timer);board=empty();bag=[];nextQueue=[];piece=null;sendCount=0;score=0;totalLines=0;level=1;combo=-1;dropInterval=700;showScore('READY');DopaFX.comboReset?.();pendingGarbage=[];heldType=null;holdUsed=false;renderHold();showGarbage();$('attack').textContent='送信ライン: 0';active=true;setTarget();$('lobby').hidden=true;$('arena').hidden=false;$('status').textContent='対戦中';spawn();update();timer=setInterval(tick,dropInterval);}
window.addEventListener('keydown',e=>{if(!active)return;if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Space','KeyC','ShiftLeft','ShiftRight'].includes(e.code))e.preventDefault();if(e.code==='KeyC'||e.code==='ShiftLeft'||e.code==='ShiftRight'){if(!e.repeat)hold();return;}if(e.code==='ArrowLeft')move(-1,0);if(e.code==='ArrowRight')move(1,0);if(e.code==='ArrowDown'){if(move(0,1)){score+=1;showScore();}else lock();}if(e.code==='ArrowUp')rotate();if(e.code==='Space'){DopaFX.play('drop');let distance=0;while(move(0,1))distance++;score+=distance*2;showScore();lock();}});
function safeName(n){return String(n||'Player').slice(0,16);}
function opponents(players){
  const left=$('leftOpponents'),right=$('rightOpponents');
  const others=players.filter(p=>p.id!==myId);
  const ids=new Set(others.map(p=>p.id));
  for(const node of [...document.querySelectorAll('.opponentColumn .enemy')])if(!ids.has(node.dataset.id))node.remove();
  others.forEach((p,i)=>{
    let node=[...document.querySelectorAll('.opponentColumn .enemy')].find(e=>e.dataset.id===p.id);
    if(!node){node=document.createElement('div');node.className='enemy';node.dataset.id=p.id;let title=document.createElement('p');let canvas=document.createElement('canvas');canvas.width=100;canvas.height=200;node.append(title,canvas);}
    const target=i<4?left:right;target.append(node);
    node.firstChild.textContent=safeName(p.name)+(p.alive?'':'（脱落）');
    node.classList.toggle('knocked',!p.alive);
    draw(node.lastChild,p.board?.length===20?p.board:empty(),10);
  });
}
$('create').onclick=()=>socket.emit('create',$('name').value);
$('join').onclick=()=>socket.emit('join',{room:$('codeInput').value,name:$('name').value});
$('start').onclick=()=>socket.emit('start');
$('targetMode').addEventListener('change',()=>setTarget());
$('targetPlayer').addEventListener('change',()=>setTarget());
function setTarget(){socket.emit('targetMode',{mode:$('targetMode').value,id:$('targetPlayer').value});}
function updateTargetChoices(players){const s=$('targetPlayer'),old=s.value;s.replaceChildren();players.filter(p=>p.id!==myId&&p.alive).forEach(p=>{const op=document.createElement('option');op.value=p.id;op.textContent=safeName(p.name);s.append(op);});if([...s.options].some(o=>o.value===old))s.value=old;s.disabled=$('targetMode').value!=='manual';}
$('targetMode').addEventListener('change',()=>{$('targetPlayer').disabled=$('targetMode').value!=='manual';});
socket.on('connect',()=>{myId=socket.id;});
socket.on('joined',code=>{$('roomText').textContent='部屋コード: '+code+'（友達に伝えてね）';$('message').textContent='';});
socket.on('room',data=>{room=data;$('roomText').textContent='部屋コード: '+data.code;$('members').textContent='参加者: '+data.players.map(p=>safeName(p.name)).join(' / ');$('start').hidden=(data.host!==socket.id||data.started);$('start').disabled=data.players.length<2;opponents(data.players);updateTargetChoices(data.players);});
socket.on('started',begin);
socket.on('opponentBoard',({id,board})=>{let p=room?.players.find(p=>p.id===id);if(p)p.board=board;opponents(room?.players||[]);});
socket.on('garbage',data=>{if(!active)return;const n=typeof data==='number'?data:data?.amount;if(Number.isInteger(n)&&n>0&&n<=4){addGarbage(n);const attacker=room?.players.find(p=>p.id===data?.from);$('attacker').textContent='攻撃元: '+(attacker?safeName(attacker.name):'不明');}});
socket.on('targetSet',data=>{$('targetStatus').textContent='攻撃設定: '+({'random':'ランダム','attackers':'カウンター','ko':'ピンチの相手','manual':'指定した相手'}[data.mode]||'ランダム');});
socket.on('finished',winner=>{DopaFX.setDanger(0,0);DopaFX.play(winner===($('name').value||'Player')?'win':'ko');DopaFX.burst('決着!!','WINNER: '+winner);active=false;clearInterval(timer);$('status').textContent='終了！ 勝者: '+winner;$('message').textContent='対戦終了！ 次の試合はホストが開始できます。';$('lobby').hidden=false;});
socket.on('errorMessage',message=>{$('message').textContent=message;});
socket.on('disconnect',()=>{active=false;clearInterval(timer);$('status').textContent='通信が切断されました';$('message').textContent='接続が切れました。ページを再読み込みして参加し直してください。';});
