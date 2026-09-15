import './style.css';
import * as T from 'three';
import { Stadium } from './stadium.js';
import { Environment, Effects, StadiumAudio } from './environment.js';
import { Input } from './input.js';
import { Match } from './match.js';
import { GameCamera } from './game-camera.js';
import { MultiplayerManager } from './multiplayer.js';
import { auth } from './supabase.js';
import { TEAMS, VENUES, DEFAULT_SETTINGS, clamp } from './config.js';
import { controls, CONTROL_LABELS, resetControls, resetControl, saveControls, keyLabel, actionForCode } from './controls.js';

const $=s=>document.querySelector(s);let settings={...DEFAULT_SETTINGS};try{const saved=JSON.parse(localStorage.getItem('estadio-settings')||'{}');for(const key of ['quality','time','weather','stadium','camera']){const valid={quality:['low','medium','high'],time:['day','dusk','night','cycle'],weather:['clear','rain'],stadium:['sol','marina'],camera:['broadcast','first']}[key];if(valid.includes(saved[key]))settings[key]=saved[key];}if([180,360,600].includes(saved.duration))settings.duration=saved.duration;if(Number.isInteger(saved.team)&&saved.team>=0&&saved.team<TEAMS.length)settings.team=saved.team;}catch{}
let renderer;
try{renderer=new T.WebGLRenderer({canvas:$('#scene'),antialias:true,powerPreference:'high-performance'});}catch(error){$('#loading').innerHTML='<p>No se pudo iniciar WebGL 2. Activa la aceleración gráfica del navegador y vuelve a cargar.</p>';throw error;}
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.outputColorSpace=T.SRGBColorSpace;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(46,innerWidth/innerHeight,.04,1400);let stadium=new Stadium(scene,settings.stadium);const stadiumCache=new Map([[settings.stadium,stadium]]),environment=new Environment(scene,stadium),effects=new Effects(scene),audio=new StadiumAudio(),input=new Input(),match=new Match(scene,input,effects,audio),gameCamera=new GameCamera(camera,input),multiplayer=new MultiplayerManager();
let inGame=false,menuTime=0,accumulator=0,last=performance.now(),announcementTime=0,practice=false;const target=new T.Vector3(),look=new T.Vector3();const radar=$('#radar').getContext('2d');
let currentUser=null,hostConfig=null,pendingRoom=null;
const save=()=>{try{localStorage.setItem('estadio-settings',JSON.stringify(settings));}catch{}};
function announce(message,seconds=2){$('#announcement').textContent=message;announcementTime=seconds;}
match.onMessage=announce;
function panel(name){document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!==name);document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.panel===name));}
document.querySelectorAll('[data-panel]').forEach(b=>b.addEventListener('click',()=>panel(b.dataset.panel)));
$('.brand').addEventListener('click',e=>{e.preventDefault();panel('home');});
function refreshVenues(){const venue=VENUES[settings.stadium];document.querySelectorAll('[data-venue-name]').forEach(el=>el.textContent=venue.name);$('#venue-preview-name').textContent=venue.name;$('#venue-preview-description').textContent=venue.description;document.body.dataset.venue=settings.stadium;$('#stadium-options').innerHTML='';Object.entries(VENUES).forEach(([id,v],i)=>{const b=document.createElement('button');b.className=`stadium-option ${id===settings.stadium?'selected':''}`;b.dataset.venue=id;b.setAttribute('aria-pressed',String(id===settings.stadium));b.innerHTML=`<span class="stadium-drawing"><i></i><b>${String(i+1).padStart(2,'0')}</b></span><span class="stadium-copy"><strong>${v.name}</strong><small>${v.tag}</small></span><span class="stadium-check">${id===settings.stadium?'✓':'↗'}</span>`;b.onclick=()=>{stadium.setVisible(false);settings.stadium=id;if(!stadiumCache.has(id))stadiumCache.set(id,new Stadium(scene,id));stadium=stadiumCache.get(id);stadium.setVisible(true);environment.stadium=stadium;applySettings();refreshVenues();};$('#stadium-options').append(b);});}
function cameraMode(mode){document.body.classList.toggle('first-person',mode==='first');settings.camera=mode;gameCamera.setMode(mode,match.active);$('#camera-mode').value=mode;$('#camera-toggle strong').textContent=mode==='first'?'PRIMERA PERSONA':'TELEVISIÓN';if(mode==='broadcast'&&inGame){camera.position.copy(match.active.position).add(new T.Vector3(-2,32,36));look.copy(match.active.position);}save();}
$('#camera-mode').value=settings.camera;$('#camera-mode').onchange=e=>{settings.camera=e.target.value;save();};
$('#camera-toggle').onclick=()=>cameraMode(gameCamera.mode==='first'?'broadcast':'first');
$('#scene').addEventListener('click',async()=>{if(inGame&&match.running&&gameCamera.mode==='first'){try{await $('#scene').requestPointerLock();}catch{announce('Usa ← → para girar la cámara',2);}}});
document.addEventListener('pointerlockchange',()=>{if(inGame&&gameCamera.mode==='first'&&!document.pointerLockElement&&match.running)pause();});
function refreshTeams(){const home=TEAMS[settings.team],away=TEAMS[(settings.team+1)%3];$('#home-team-name').textContent=home.name;$('#away-team-name').textContent=away.name;$('.home-crest').textContent=home.code;$('.home-crest').style.background=home.hex;$('.away-crest').textContent=away.code;$('.away-crest').style.background=away.hex;$('#team-options').innerHTML='';TEAMS.forEach((t,i)=>{const b=document.createElement('button');b.className=`team-option ${i===settings.team?'selected':''}`;b.setAttribute('aria-pressed',i===settings.team);b.innerHTML=`<span class="crest" style="background:${t.hex}">${t.code}</span><div><strong>${t.name}</strong><small>${t.desc}</small></div><span>${i===settings.team?'✓':'+'}</span>`;b.onclick=()=>{settings.team=i;save();refreshTeams();match.setup(settings.team);};$('#team-options').append(b);});}
function applySettings(){environment.mode=settings.time;environment.weather=settings.weather;match.ball.wet=settings.weather==='rain';const high=settings.quality==='high',low=settings.quality==='low';renderer.setPixelRatio(Math.min(devicePixelRatio,high?2:low?1:1.5));renderer.shadowMap.enabled=!low;stadium.lamps.forEach((l,i)=>{l.castShadow=high||(!low&&i%2===0);});$('#venue-weather').textContent=settings.weather==='rain'?'19:40 · LLUVIA · 18 °C':settings.time==='day'?'15:00 · DESPEJADO · 28 °C':settings.time==='night'?'22:00 · NOCHE · 19 °C':settings.time==='cycle'?'CICLO DINÁMICO · 24 °C':'19:40 · ATARDECER · 24 °C';save();}
for(const id of ['quality','time','weather','duration']){$('#'+id).value=settings[id];$('#'+id).onchange=e=>{settings[id]=id==='duration'?Number(e.target.value):e.target.value;applySettings();};}
$('#sound-toggle').onclick=()=>{settings.sound=!settings.sound;audio.setEnabled(settings.sound);settings.sound=audio.enabled;$('#sound-toggle').textContent=settings.sound?'ACTIVADO':'DESACTIVADO';$('#sound-toggle').setAttribute('aria-pressed',String(settings.sound));};
function showControls(){$('#controls-dialog').showModal();}$('#help').onclick=showControls;$('#all-controls').onclick=showControls;document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>{const d=b.closest('dialog');(d||$('#controls-dialog')).close();});
function start(isPractice=false){practice=isPractice;match.isMultiplayer=false;match.setup(settings.team,practice,settings.duration);match.ball.wet=settings.weather==='rain';match.running=true;input.enabled=true;inGame=true;cameraMode(settings.camera);document.body.classList.add('playing');$('#hud').hidden=false;const pingEl=$('#hud-ping');if(pingEl)pingEl.hidden=true;$('#pause-dialog').close();$('#score-home').textContent=match.teams[0].code;$('#score-away').textContent=match.teams[1].code;camera.position.set(-2,34,37);look.set(0,0,0);camera.lookAt(look);accumulator=0;announce(practice?'CAMPO DE PRÁCTICA':settings.camera==='first'?'VIVE EL PARTIDO DESDE DENTRO':'COMIENZA TU MOMENTO',2);audio.tone(1200,.3);}
$('#play').onclick=()=>start();$('#practice').onclick=()=>start(true);
function startMultiplayer(isHost,config,roster){
  practice=false;
  if(config.stadium&&config.stadium!==settings.stadium){
    stadium.setVisible(false);settings.stadium=config.stadium;
    if(!stadiumCache.has(config.stadium))stadiumCache.set(config.stadium,new Stadium(scene,config.stadium));
    stadium=stadiumCache.get(config.stadium);stadium.setVisible(true);environment.stadium=stadium;
  }
  if(config.weather)settings.weather=config.weather;applySettings();
  match.setupMultiplayer(multiplayer,isHost,roster,currentUser.id,config);
  match.ball.wet=settings.weather==='rain';match.running=true;input.enabled=true;inGame=true;cameraMode(settings.camera);document.body.classList.add('playing');$('#hud').hidden=false;const pingEl=$('#hud-ping');if(pingEl)pingEl.hidden=true;$('#pause-dialog').close();$('#score-home').textContent=match.teams[0].code;$('#score-away').textContent=match.teams[1].code;camera.position.set(-2,34,37);look.set(0,0,0);camera.lookAt(look);accumulator=0;
  const name=(currentUser?.username||'').toUpperCase();
  announce(isHost?'PARTIDO ONLINE · ANFITRIÓN':`PARTIDO ONLINE · ${name}`,2.5);audio.tone(1200,.3);
}
function pause(){if(!inGame||!match.running)return;if(document.pointerLockElement)document.exitPointerLock();match.running=false;input.enabled=false;input.clear();$('#pause-eyebrow').textContent='TOMA UN RESPIRO';$('#pause-title').textContent='EN PAUSA.';$('#pause-description').textContent='El campo te espera.';$('#resume').hidden=false;$('#pause-dialog').showModal();}
function resume(){if(!inGame)return;$('#pause-dialog').close();match.running=true;input.enabled=true;input.clear();accumulator=0;}
$('#pause').onclick=pause;$('#resume').onclick=resume;$('#restart').onclick=()=>start(practice);
function quitGame(){
  $('#pause-dialog').close();match.running=false;input.enabled=false;input.clear();inGame=false;document.body.classList.remove('playing');$('#hud').hidden=true;const pingEl=$('#hud-ping');if(pingEl)pingEl.hidden=true;$('#announcement').textContent='';announcementTime=0;
  if(match.isMultiplayer){multiplayer.disconnect();match.isMultiplayer=false;const net=$('#net-status-text');if(net)net.textContent='LOCAL PLAY';const b=$('#mp-status-banner');if(b)b.hidden=true;resetMultiplayerUI();}
  match.setup(settings.team);panel('home');
}
$('#quit').onclick=quitGame;
$('#pause-dialog').addEventListener('cancel',e=>{e.preventDefault();if(!$('#resume').hidden)resume();});
addEventListener('keydown',e=>{const action=actionForCode(e.code);if(action==='camera'&&inGame&&match.running&&!e.repeat&&!input.keys.has('KeyA'))cameraMode(gameCamera.mode==='first'?'broadcast':'first');if(action==='pause'&&inGame&&!$('#pause-dialog').open)pause();if(action==='start'&&currentUser&&!inGame&&!document.querySelector('dialog[open]')&&!['BUTTON','SELECT'].includes(document.activeElement.tagName))start();});
addEventListener('blur',()=>{if(inGame)pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&inGame)pause();});
match.onHalf=()=>{pause();$('#pause-eyebrow').textContent='45 MINUTOS';$('#pause-title').textContent='DESCANSO.';$('#pause-description').textContent='Segunda parte: sigues atacando a la misma portería. Saque del rival.';};
match.onEnd=()=>{input.enabled=false;input.clear();$('#pause-eyebrow').textContent='90 MINUTOS · FINAL';$('#pause-title').textContent=`${match.score[0]} — ${match.score[1]}`;$('#pause-description').textContent=match.score[0]===match.score[1]?'Todo queda en tablas.':match.score[0]>match.score[1]?'La victoria lleva tus colores.':'Cada partido es una nueva oportunidad.';$('#resume').hidden=true;$('#pause-dialog').showModal();audio.tone(1300,.5);};
function updateHUD(){const p=match.active;if(!p)return;$('#score').textContent=match.score.join(' — ');const mins=practice?match.elapsed/60:Math.min(90,match.elapsed/match.duration*90);$('#clock').textContent=`${String(Math.floor(mins)).padStart(2,'0')}:${String(Math.floor((mins%1)*60)).padStart(2,'0')}`;$('#half').textContent=practice?'LIBRE':match.halfDone?'2T':'1T';$('#player-name').textContent=p.name;$('#player-number').textContent=p.number;$('#player-team').textContent=match.teams[0].name;$('#stamina').style.width=`${p.stamina*100}%`;$('#power').style.width=`${(input.charge?.time||0)/1.2*100}%`;$('#action-label').textContent=input.charge?({shot:'TIRO A PORTERÍA',pass:'PASE CORTO',through:'PASE FILTRADO',cross:'CENTRO AL ÁREA'}[input.charge.type]):'POTENCIA DE GOLPEO';
    const owner=match.control.owner;$('#possession-status').textContent=owner===p?'● BALÓN CONTROLADO':owner?.team===0?'● POSESIÓN DEL EQUIPO':owner?'○ PRESIONA Y RECUPERA':'○ BALÓN LIBRE';$('#skill-hud').classList.toggle('controlled',owner===p);$('#skill-ready').style.width=`${Math.max(0,1-p.skillCooldown/1.5)*100}%`;$('#skill-status').textContent=p.skillCooldown>.05?`RECARGA · ${p.skillCooldown.toFixed(1)} s`:owner!==p?'REGATES CON POSESIÓN':p.stamina<.16?'RECUPERA ESTAMINA':'REGATES LISTOS';
    const v=new T.Vector3();for(const a of match.players){v.copy(a.position);v.y=2.2;v.project(camera);a.label.style.display=(gameCamera.mode==='first'&&a===p)||v.z>1||Math.abs(v.x)>1||Math.abs(v.y)>1?'none':'block';a.label.style.left=`${(v.x*.5+.5)*innerWidth}px`;a.label.style.top=`${(-v.y*.5+.5)*innerHeight}px`;a.label.classList.toggle('active',a===p);}
    radar.clearRect(0,0,210,136);radar.strokeStyle='#cfdfc65a';radar.lineWidth=1;radar.strokeRect(8,8,194,120);radar.beginPath();radar.moveTo(105,8);radar.lineTo(105,128);radar.arc(105,68,17,0,Math.PI*2);radar.stroke();radar.strokeRect(8,40,25,56);radar.strokeRect(177,40,25,56);for(const a of match.players){radar.fillStyle=a===p?'#ffffff':match.teams[a.team].hex;radar.beginPath();radar.arc(105+a.position.x/60*194,68+a.position.z/38*120,a===p?4:3,0,Math.PI*2);radar.fill();}radar.fillStyle='#ffffff';radar.fillRect(103+match.ball.position.x/60*194,66+match.ball.position.z/38*120,4,4);
}
function updateOnlinePlayers(roster=[]){const box=$('#online-players'),list=$('#online-players-list');if(!box||!list)return;box.hidden=!match.isMultiplayer;list.innerHTML='';for(const p of roster){const row=document.createElement('div');row.className=`online-player ${p.side===0?'':'rival'}`;row.innerHTML=`<i></i><span>${escapeHtml(p.username)}</span>${p.id===currentUser?.id?'<b>TÚ</b>':''}`;list.append(row);}}
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;menuTime+=dt;$('#skill-hud').hidden=!inGame;environment.update(inGame&&!match.running?0:dt);effects.update(inGame&&!match.running?0:dt,environment.mode==='night'||environment.mode==='dusk');
  $('#camera-toggle').hidden=!inGame;$('#crosshair').hidden=!inGame||gameCamera.mode!=='first';$('#first-person-hint').hidden=!inGame||gameCamera.mode!=='first'||!!document.pointerLockElement;
  if(inGame){if(match.running){accumulator+=dt;while(accumulator>=1/120){match.step(1/120);accumulator-=1/120;}}else accumulator=0;match.syncVisuals(match.running?dt:0);target.copy(match.ball.position).lerp(match.active.position,.4);target.x=clamp(target.x,-21,21);target.z=clamp(target.z,-10,10);target.y=0;const desired=new T.Vector3(target.x-2,32, target.z+36);camera.position.lerp(desired,1-Math.exp(-dt*2.8));look.lerp(target,1-Math.exp(-dt*3));camera.lookAt(look);gameCamera.update(match,match.running?dt:0);updateHUD();}
  else{camera.fov=46;camera.updateProjectionMatrix();camera.position.set(54+Math.sin(menuTime*.025)*5,36+Math.sin(menuTime*.06)*1.5,54+Math.cos(menuTime*.025)*5);camera.lookAt(-10,1,-2);match.syncVisuals(0);}
  if(announcementTime>0){announcementTime-=dt;if(announcementTime<=0)$('#announcement').textContent='';}renderer.render(scene,camera);
}
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
multiplayer.onStatus=(text,type)=>{
  const banner=$('#mp-status-banner');if(banner){banner.hidden=false;banner.className=`mp-status ${type||''}`;$('#mp-status-text').textContent=text;const s=$('#mp-spinner');if(s)s.style.display=(type==='ready'||type==='error')?'none':'inline-block';}
  const net=$('#net-status-text');if(net)net.textContent=text;
};
multiplayer.onConnected=({isHost,roomCode})=>{
  const net=$('#net-status-text');if(net)net.textContent=`ONLINE · #${roomCode}`;
  $('#mp-create-view').hidden=true;$('#mp-join-view').hidden=true;$('#mp-lobby').hidden=false;
  const code=$('#lobby-room-code');if(code)code.textContent=roomCode;
  if(!isHost)announce('CONECTADO A LA SALA',2);
};
multiplayer.onRoster=roster=>{renderRoster(roster);if(inGame)updateOnlinePlayers(roster);};
multiplayer.onMatchStart=(config,roster)=>{startMultiplayer(multiplayer.isHost,config,roster);updateOnlinePlayers(roster);};
multiplayer.onSnapshot=snap=>match.applySnapshot(snap);
multiplayer.onEvent=evt=>{if(evt.type==='goal'){match.audio.tone(700,.55);announce(`¡GOOOL!\n${match.teams[evt.team].name}`,2.4);}};
multiplayer.onOpponentDisconnect=id=>{multiplayer.roster=multiplayer.roster.filter(p=>p.id!==id);announce('CONEXIÓN PERDIDA · EL PARTIDO SIGUE',3);renderRoster(multiplayer.roster);if(inGame)updateOnlinePlayers(multiplayer.roster);};

$('#tab-create').onclick=()=>{
  $('#tab-create').classList.add('active');$('#tab-join').classList.remove('active');
  $('#mp-create-view').hidden=false;$('#mp-join-view').hidden=true;
};
$('#tab-join').onclick=()=>{
  $('#tab-join').classList.add('active');$('#tab-create').classList.remove('active');
  $('#mp-join-view').hidden=false;$('#mp-create-view').hidden=true;
};
$('#btn-start-host').onclick=async()=>{
  hostConfig={team:settings.team,stadium:settings.stadium,duration:settings.duration,weather:settings.weather};
  const code=await multiplayer.createRoom(hostConfig);
  if(code){$('#created-room-code').textContent=code;$('#lobby-room-code').textContent=code;}
};
$('#btn-start-match').onclick=()=>{if(hostConfig)multiplayer.startMatch(hostConfig);};
$('#btn-copy-code').onclick=()=>{
  const code=multiplayer.roomCode||$('#created-room-code').textContent;
  if(code&&code!=='----'){navigator.clipboard.writeText(code).then(()=>{const b=$('#btn-copy-code');b.textContent='¡COPIADO!';setTimeout(()=>b.textContent='COPIAR',1500);});}
};
$('#btn-copy-link').onclick=()=>{
  const code=multiplayer.roomCode||$('#created-room-code').textContent;
  if(code&&code!=='----'){
    const link=`${location.origin}${location.pathname}?room=${code}`;
    navigator.clipboard.writeText(link).then(()=>{const b=$('#btn-copy-link');b.textContent='¡COPIADO!';setTimeout(()=>b.textContent='ENLACE ↗',1500);});
  }
};
$('#btn-join-room').onclick=()=>{
  const code=$('#join-room-input').value.trim().toUpperCase();
  const side=Number($('#join-team-select').value);
  if(code)multiplayer.joinRoom(code,side);else $('#join-room-input').focus();
};

function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function resetMultiplayerUI(){
  $('#mp-create-view').hidden=false;$('#mp-join-view').hidden=true;$('#mp-lobby').hidden=true;
  $('#mp-roster').innerHTML='';$('#lobby-count').textContent='0 / 4';$('#btn-start-match').hidden=true;
  $('#created-room-code').textContent='----';$('#lobby-room-code').textContent='----';
  hostConfig=null;
}
function renderRoster(roster){
  const list=roster||multiplayer.roster||[];
  const el=$('#mp-roster');if(!el)return;
  el.innerHTML='';
  for(const p of list){
    const row=document.createElement('div');row.className='roster-row';
    const side=p.side===0?'LOCAL':'RIVAL';
    const me=p.id===currentUser?.id;
    row.innerHTML=`<span class="roster-dot ${p.side===0?'':'rival'}"></span><span class="roster-name">${escapeHtml(p.username)}${me?'<b class="roster-you">TÚ</b>':''}</span><span class="roster-side">${side}</span>`;
    el.appendChild(row);
  }
  const count=$('#lobby-count');if(count)count.textContent=`${list.length} / 4`;
  const start=$('#btn-start-match');if(start)start.hidden=!(multiplayer.isHost&&list.length>=2);
  const hint=$('#mp-lobby-hint');
  if(hint)hint.textContent=multiplayer.isHost?(list.length>=2?'Listo para iniciar.':'Esperando jugadores… (comparte el código)'):'Esperando al anfitrión para iniciar…';
}

const urlParams=new URLSearchParams(location.search);
if(urlParams.has('room'))pendingRoom=urlParams.get('room').trim().toUpperCase();

function controlLabel(action){return (controls[action]||[]).map(keyLabel).join(' / ');}
function moveLabel(){return ['moveUp','moveLeft','moveDown','moveRight'].map(a=>{const code=(controls[a]||[]).find(c=>!c.startsWith('Arrow'))||(controls[a]||[])[0];return code?keyLabel(code):'—';}).join(' ');}
function refreshControlLabels(){
  const set=(id,html)=>{const el=document.getElementById(id);if(el)el.innerHTML=html;};
  set('power-hint',`Mantén ${controlLabel('pass')} / ${controlLabel('through')} / ${controlLabel('cross')} / ${controlLabel('shot')} · ${controlLabel('curveLeft')} / ${controlLabel('curveRight')} curva`);
  set('game-help',`${moveLabel()} mover <b>·</b> ${controlLabel('sprint')} sprint <b>·</b> ${controlLabel('pass')} pase <b>·</b> ${controlLabel('through')} filtrado <b>·</b> ${controlLabel('cross')} centro <b>·</b> ${controlLabel('shot')} tiro <b>·</b> ${controlLabel('switchPlayer')} cambiar <b>·</b> ${controlLabel('tackle')} robar <b>·</b> ${controlLabel('slideTackle')} barrida <b>·</b> ${controlLabel('skillSombrero')} sombrerito <b>·</b> ${controlLabel('skillElastica')} elástica <b>·</b> ${controlLabel('skillBicicleta')} bicicleta`);
  set('skill-sombrero-label',`<kbd>${controlLabel('skillSombrero')}</kbd> SOMBRERITO`);
  set('skill-elastica-label',`<kbd>${controlLabel('skillElastica')}</kbd> ELÁSTICA`);
  set('skill-bicicleta-label',`<kbd>${controlLabel('skillBicicleta')}</kbd> BICICLETA`);
  set('tackle-note',`<kbd>${controlLabel('tackle')}</kbd> ROBAR <span>·</span> <kbd>${controlLabel('slideTackle')}</kbd> BARRIDA`);
  set('camera-key',controlLabel('camera'));
  const menuKeys=document.getElementById('menu-move-keys');if(menuKeys)menuKeys.innerHTML=`<kbd>${moveLabel()}</kbd>`;
  const grid=document.querySelector('#controls-dialog .control-grid');
  if(grid){
    const items=[['Movimiento 360°',moveLabel()],['Sprint',controlLabel('sprint')],['Pase corto',controlLabel('pass')],['Pase filtrado',controlLabel('through')],['Centro elevado',controlLabel('cross')],['Tiro a portería',controlLabel('shot')],['Curva al golpear',`${controlLabel('curveLeft')} / ${controlLabel('curveRight')}`],['Cambiar jugador',controlLabel('switchPlayer')],['Entrada de pie / robar',controlLabel('tackle')],['Barrida',controlLabel('slideTackle')],['Sombrerito',controlLabel('skillSombrero')],['Elástica',controlLabel('skillElastica')],['Bicicleta',controlLabel('skillBicicleta')],['Cambiar cámara',controlLabel('camera')],['Pausa',controlLabel('pause')]];
    grid.innerHTML='';
    for(const [label,keys] of items){const s=document.createElement('span');s.innerHTML=`<kbd>${keys}</kbd> ${label}`;grid.append(s);}
  }
}

const configDialog=document.getElementById('controls-config-dialog'),configList=document.getElementById('controls-config-list'),configHint=document.getElementById('controls-config-hint');
let capture=null;
function renderControlsConfig(){
  configList.innerHTML='';
  for(const action of Object.keys(CONTROL_LABELS)){
    const row=document.createElement('div');row.className='control-config-row';
    const label=document.createElement('span');label.className='control-config-label';label.textContent=CONTROL_LABELS[action];
    const chips=document.createElement('div');chips.className='key-chips';
    (controls[action]||[]).forEach((code,slot)=>{const chip=document.createElement('button');chip.type='button';chip.className='key-chip';chip.textContent=keyLabel(code);chip.onclick=()=>startCapture(action,slot,chip);chips.append(chip);});
    if((controls[action]||[]).length<2){const add=document.createElement('button');add.type='button';add.className='key-chip add';add.textContent='＋';add.title='Añadir segunda tecla';add.onclick=()=>startCapture(action,(controls[action]||[]).length,null);chips.append(add);}
    const reset=document.createElement('button');reset.type='button';reset.className='key-reset';reset.textContent='↺';reset.title='Restaurar teclas por defecto';reset.onclick=()=>{resetControl(action);renderControlsConfig();refreshControlLabels();};
    row.append(label,chips,reset);configList.append(row);
  }
}
function startCapture(action,slot,chipEl){capture={action,slot};document.querySelectorAll('.key-chip.listening').forEach(c=>c.classList.remove('listening'));if(chipEl)chipEl.classList.add('listening');configHint.textContent=`Pulsa la tecla para: ${CONTROL_LABELS[action]} · ESC cancela`;}
function cancelCapture(){capture=null;document.querySelectorAll('.key-chip.listening').forEach(c=>c.classList.remove('listening'));configHint.textContent='';}
document.getElementById('open-controls-config').onclick=()=>{renderControlsConfig();configDialog.showModal();};
document.getElementById('controls-config-restore').onclick=()=>{resetControls();renderControlsConfig();refreshControlLabels();};
document.getElementById('controls-config-done').onclick=()=>{cancelCapture();configDialog.close();};
configDialog.addEventListener('cancel',e=>e.preventDefault());
configDialog.addEventListener('close',cancelCapture);
addEventListener('keydown',e=>{
  if(capture){
    e.preventDefault();
    if(e.code==='Escape'){cancelCapture();return;}
    const {action,slot}=capture;
    for(const a of Object.keys(controls))controls[a]=(controls[a]||[]).filter(c=>c!==e.code);
    const codes=controls[action]||[];
    if(slot<codes.length)codes[slot]=e.code;else codes.push(e.code);
    controls[action]=codes;saveControls();cancelCapture();renderControlsConfig();refreshControlLabels();
  }else if(configDialog.open&&e.code==='Escape'){e.preventDefault();configDialog.close();}
});

/* ----------------- Autenticación (nombre + contraseña) ----------------- */
let authMode='login';
function showAuthError(msg){const el=$('#auth-error');if(el){el.textContent=msg;el.hidden=false;}}
function hideAuthError(){const el=$('#auth-error');if(el)el.hidden=true;}
function setAuthMode(mode){
  authMode=mode;
  $('#auth-tab-login').classList.toggle('active',mode==='login');
  $('#auth-tab-register').classList.toggle('active',mode==='register');
  $('#auth-title').innerHTML=mode==='login'?'ENTRA CON TU<br><em>NOMBRE.</em>':'CREA TU<br><em>CUENTA.</em>';
  $('#auth-submit').innerHTML=mode==='login'?'ENTRAR <span>↗</span>':'CREAR CUENTA <span>+</span>';
  hideAuthError();
}
$('#auth-tab-login').onclick=()=>setAuthMode('login');
$('#auth-tab-register').onclick=()=>setAuthMode('register');
$('#auth-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const username=$('#auth-username').value.trim();
  const password=$('#auth-password').value;
  if(!username||!password){showAuthError('Escribe un nombre y una contraseña');return;}
  if(username.length<2){showAuthError('El nombre debe tener al menos 2 caracteres');return;}
  if(password.length<3){showAuthError('La contraseña debe tener al menos 3 caracteres');return;}
  const btn=$('#auth-submit');btn.disabled=true;hideAuthError();
  try{
    const res=authMode==='login'?await auth.login(username,password):await auth.register(username,password);
    if(!res){showAuthError('No se pudo completar. Revisa la configuración de Supabase.');return;}
    auth.save({id:res.id,username:res.username,token:res.token});
    setAuthed(res);
  }catch(err){
    showAuthError(err.message||'Error al entrar');
  }finally{
    btn.disabled=false;
  }
});
$('#btn-logout').onclick=()=>{
  auth.clear();
  multiplayer.disconnect();
  if(inGame)quitGame();
  panel('home');
  currentUser=null;
  const u=$('#current-user');if(u)u.textContent='—';
  $('#auth-username').value='';$('#auth-password').value='';hideAuthError();
  showAuth();
};
function setAuthed(me){
  currentUser={id:me.id,username:me.username,token:me.token||auth.session()?.token};
  $('#auth-screen').hidden=true;
  const u=$('#current-user');if(u)u.textContent=me.username.toUpperCase();
  if(pendingRoom){
    const room=pendingRoom;pendingRoom=null;
    panel('multiplayer');$('#tab-join').click();$('#join-room-input').value=room;
    setTimeout(()=>multiplayer.joinRoom(room,1),400);
  }
}
function showAuth(){
  $('#auth-screen').hidden=false;
  setTimeout(()=>{$('#auth-username').focus();},80);
}
async function initAuth(){
  const s=auth.session();
  if(s&&s.token){
    try{
      const me=await auth.whoami(s.token);
      if(me){setAuthed({id:me.id,username:me.username,token:s.token});return;}
    }catch{}
  }
  showAuth();
}

refreshTeams();refreshVenues();match.setup(settings.team);applySettings();refreshControlLabels();requestAnimationFrame(frame);$('#loading').hidden=true;initAuth();
// Explicit opt-in only: a narrow inspection surface for local browser integration tests.
if(new URLSearchParams(location.search).has('debug'))window.__ESTADIO__={match,environment,renderer,start,pause,resume,settings};
