const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const rooms = new Map();
app.use(express.static('public'));
function code() { let c; do { c = crypto.randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(c)); return c; }
function info(room) { return { code: room.code, host: room.host, started: room.started, players: [...room.players.values()].map(p => ({id:p.id,name:p.name,alive:p.alive,board:p.board})) }; }
function publish(room) { io.to(room.code).emit('room',info(room)); }
function finish(room) {
  if (!room.started) return;
  const alive = [...room.players.values()].filter(p => p.alive);
  if (alive.length <= 1) {
    room.started=false;
    io.to(room.code).emit('finished',alive.length ? alive[0].name : '勝者なし');
    publish(room);
  }
}
io.on('connection',socket => {
  function joinRoom(room,name) {
    if (socket.data.room) return socket.emit('errorMessage','すでに入室しています');
    if (room.started || room.players.size>=8) return socket.emit('errorMessage','対戦中か満員です');
    const player={id:socket.id,name:String(name||'Player').trim().slice(0,16)||'Player',alive:true,board:[],targetMode:'random',targetId:null,attackers:new Map()};
    room.players.set(socket.id,player); socket.join(room.code);socket.data.room=room.code;
    socket.emit('joined',room.code);publish(room);
  }
  socket.on('create',name => {const c=code();const room={code:c,host:socket.id,players:new Map(),started:false};rooms.set(c,room);joinRoom(room,name);});
  socket.on('join',({room:raw,name}={})=>{const c=String(raw||'').trim().toUpperCase();const r=rooms.get(c);if(!r)return socket.emit('errorMessage','部屋が見つかりません');joinRoom(r,name);});
  socket.on('start',()=>{
    const r=rooms.get(socket.data.room);if(!r||r.host!==socket.id||r.started)return;
    if(r.players.size<2)return socket.emit('errorMessage','対戦には2人以上必要です');
    r.started=true;
    for(const p of r.players.values()){p.alive=true;p.board=[];p.attackers=new Map();}
    io.to(r.code).emit('started');publish(r);
  });
  socket.on('board',board=>{
    const r=rooms.get(socket.data.room);const p=r?.players.get(socket.id);
    if(!r?.started||!p?.alive||!Array.isArray(board)||board.length!==20||!board.every(row=>Array.isArray(row)&&row.length===10&&row.every(n=>Number.isInteger(n)&&n>=0&&n<=8)))return;
    p.board=board;
    socket.to(r.code).emit('opponentBoard',{id:socket.id,board});
  });
  socket.on('targetMode',({mode,id}={})=>{
    const r=rooms.get(socket.data.room); const p=r?.players.get(socket.id);
    if(!r||!p) return;
    if(!['random','attackers','ko','manual'].includes(mode))return;
    p.targetMode=mode;
    p.targetId=mode==='manual' && r.players.has(id) && id!==socket.id ? id : null;
    socket.emit('targetSet',{mode:p.targetMode,id:p.targetId});
  });
  socket.on('attack',amount=>{
    const r=rooms.get(socket.data.room);const p=r?.players.get(socket.id);
    if(!r?.started||!p?.alive)return;
    const n=Math.floor(Number(amount));if(!Number.isFinite(n)||n<1||n>4)return;
    const targets=[...r.players.values()].filter(x=>x.alive&&x.id!==socket.id);
    if(!targets.length)return;
    let candidates=targets;
    if(p.targetMode==='manual'){
      const chosen=targets.find(x=>x.id===p.targetId);
      if(chosen)candidates=[chosen];
    }else if(p.targetMode==='attackers'){
      const recent=targets.filter(x=>p.attackers?.get(x.id)>Date.now());
      if(recent.length)candidates=recent;
    }else if(p.targetMode==='ko'){
      const lowest=Math.max(...targets.map(x=>x.board?.flat().filter(Boolean).length||0));
      candidates=targets.filter(x=>(x.board?.flat().filter(Boolean).length||0)===lowest);
    }
    const target=candidates[crypto.randomInt(candidates.length)];
    if(!target.attackers)target.attackers=new Map();
    target.attackers.set(socket.id,Date.now()+15000);
    io.to(target.id).emit('garbage',{amount:n,from:socket.id});
  });
  socket.on('dead',()=>{
    const r=rooms.get(socket.data.room);const p=r?.players.get(socket.id);
    if(!r?.started||!p?.alive)return;
    p.alive=false;publish(r);finish(r);
  });
  socket.on('disconnect',()=>{
    const r=rooms.get(socket.data.room);if(!r)return;
    r.players.delete(socket.id);
    if(!r.players.size){rooms.delete(r.code);return;}
    if(r.host===socket.id)r.host=r.players.keys().next().value;
    publish(r);finish(r);
  });
});
server.listen(process.env.PORT||3000,()=>console.log('Open http://localhost:'+(process.env.PORT||3000)));
