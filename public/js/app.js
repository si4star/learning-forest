const ORDER=[10,2,5,11,3,4,9,6,8,12,7];         // unlock order: anchors first, 7s last
const HINT_ORDER=[10,2,5,11,4,3,9,8,6,12,7];    // which factor gives the easiest strategy
const ROUND=20, SLOW=6000, QUICK=3000;
const ASSESS_MIN=5, PASS=0.8;                    // starting check: at least 5 facts per table, 80% to pass
const INTERVAL_DAYS={2:1,3:3,4:7,5:21};
const STAGES=['Not planted','Seed','Sprout','Sapling','Tree','Great tree'];
const ALL=[];for(let a=2;a<=12;a++)for(let b=a;b<=12;b++)ALL.push(a+'x'+b);
const parse=k=>k.split('x').map(Number);
const key=(a,b)=>Math.min(a,b)+'x'+Math.max(a,b);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tree=(s,cls='')=>`<svg class="${cls}" aria-hidden="true"><use href="#t${s}"/></svg>`;
const list=xs=>xs.length<2?xs.join(''):xs.slice(0,-1).join(', ')+' and '+xs[xs.length-1];

/* server */
async function api(path,body,method){
  const opt={method:method||(body?'POST':'GET'),headers:{},credentials:'same-origin'};
  if(body){opt.headers['content-type']='application/json';opt.body=JSON.stringify(body)}
  let res;
  try{res=await fetch('/api'+path,opt)}catch(e){throw Object.assign(new Error("Can't reach the forest. Check the internet connection."),{status:0})}
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Object.assign(new Error(data.error||'Something went wrong. Try again.'),{status:res.status});
  return data;
}

/* progress sync: changes queue on the device and are sent in the background,
   so a dropped connection mid-round loses nothing */
let pending=null, flushing=null, syncTimer=null, unsaved=false;
const emptyPending=()=>({facts:{},answers:[],meta:null});
const pkey=()=>'ttf-pending-'+kid.id;
function loadPending(){try{pending=JSON.parse(localStorage.getItem(pkey()))||emptyPending()}catch(e){pending=emptyPending()}}
function storePending(){try{localStorage.setItem(pkey(),JSON.stringify(pending))}catch(e){}}
const hasPending=()=>pending&&(pending.meta||pending.answers.length||Object.keys(pending.facts).length);
function queue(){storePending();clearTimeout(syncTimer);syncTimer=setTimeout(flush,400)}
function saveFact(k){pending.facts[k]=kid.facts[k];queue()}
function logAnswer(a){pending.answers.push(a);queue()}
function saveMeta(){pending.meta={tables:kid.tables,streak:kid.streak,lastDay:kid.lastDay,assessedAt:kid.assessedAt,theme:kid.theme||'auto'};queue()}
async function flush(){
  if(flushing)await flushing;
  if(!kid||!hasPending())return true;
  const sending=pending;pending=emptyPending();
  const body={facts:sending.facts,answers:sending.answers.slice(0,200)};
  if(sending.meta)body.meta=sending.meta;
  pending.answers=sending.answers.slice(200);
  flushing=api('/child/sync',body).then(()=>{unsaved=false;storePending();if(pending.answers.length)queue();return true},e=>{
    pending={facts:{...sending.facts,...pending.facts},answers:sending.answers.concat(pending.answers),meta:pending.meta||sending.meta};
    storePending();unsaved=true;return false;
  }).finally(()=>{flushing=null});
  return flushing;
}
window.addEventListener('online',()=>flush());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush()});

/* learning model */
function today(){const d=new Date();d.setHours(0,0,0,0);return d.getTime()}
function addDays(t,n){const d=new Date(t);d.setDate(d.getDate()+n);return d.getTime()}
function dueFor(box){return box<=1?Date.now():addDays(today(),INTERVAL_DAYS[box])}
const fact=(p,k)=>p.facts[k]||{box:0,due:0};
const tablesOn=p=>p.tables;
const nextTable=p=>ORDER.find(t=>!p.tables.includes(t));
function isUnlocked(p,k){const [a,b]=parse(k),t=tablesOn(p);return t.includes(a)||t.includes(b)}
function priority(k){const [a,b]=parse(k),ia=ORDER.indexOf(a),ib=ORDER.indexOf(b);return Math.min(ia,ib)*100+Math.max(ia,ib)}
function shuffle(x){for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x}
const planted=p=>ALL.filter(k=>fact(p,k).box>0).length;

function hint(a,b){
  const s=HINT_ORDER.indexOf(a)<=HINT_ORDER.indexOf(b)?a:b, n=s===a?b:a, p=a*b;
  switch(s){
    case 10:return `${n} tens make ${p}.`;
    case 2:return `Double ${n}: ${p}.`;
    case 5:return `10 × ${n} = ${10*n}. Half of that is ${p}.`;
    case 11:return n<=9?`Write ${n} twice: ${p}.`:`10 × ${n} = ${10*n}, add one more ${n}: ${p}.`;
    case 4:return `Double ${n}, then double again: ${n} → ${2*n} → ${p}.`;
    case 3:return `Double ${n} is ${2*n}, add one more ${n}: ${p}.`;
    case 9:return `10 × ${n} = ${10*n}, take away one ${n}: ${p}.`;
    case 8:return `Double three times: ${n} → ${2*n} → ${4*n} → ${p}.`;
    case 6:return `5 × ${n} = ${5*n}, add one more ${n}: ${p}.`;
    case 12:return `10 × ${n} = ${10*n}, add 2 × ${n} = ${2*n}: ${p}.`;
    case 7:return `5 × ${n} = ${5*n}, add 2 × ${n} = ${2*n}: ${p}.`;
  }
}

function buildRound(p){
  const now=Date.now(), un=ALL.filter(k=>isUnlocked(p,k));
  const due=shuffle(un.filter(k=>{const f=fact(p,k);return f.box>0&&f.due<=now})).sort((x,y)=>fact(p,x).box-fact(p,y).box);
  const fresh=un.filter(k=>fact(p,k).box===0).sort((x,y)=>priority(x)-priority(y));
  let newN=due.length<6?6:due.length<=14?4:due.length<ROUND?1:0;
  newN=Math.min(newN,fresh.length);
  let items=due.slice(0,ROUND-newN*2).map(k=>({k}));
  const target=ROUND-newN*2;
  if(items.length<target){
    const pool=shuffle(un.filter(k=>fact(p,k).box>=1&&!items.some(i=>i.k===k)));
    while(items.length<target&&pool.length)items.push({k:pool.pop(),practice:true});
  }
  shuffle(items);
  fresh.slice(0,newN).forEach((k,i)=>items.splice(Math.min(items.length,i*4),0,{k,isNew:true}));
  return items;
}

function checkUnlock(p){
  const nt=nextTable(p);if(nt===undefined)return null;
  const un=ALL.filter(k=>isUnlocked(p,k));
  if(un.some(k=>fact(p,k).box===0))return null;
  if(un.filter(k=>fact(p,k).box>=2).length/un.length>=PASS){p.tables=[...p.tables,nt];return nt}
  return null;
}

/* starting check: the child picks the tables they think they know, each is tested,
   and only the ones they pass are planted */
function buildAssessment(tables){
  const items=[];
  for(const t of tables){
    // a fact counts towards both its tables, so 3 × 7 tests the 3s and the 7s
    let n=items.filter(x=>parse(x.k).includes(t)).length;
    for(const m of shuffle([2,3,4,5,6,7,8,9,11,12])){        // ×10 is too easy to tell us much
      if(n>=ASSESS_MIN)break;
      const k=key(t,m);if(items.some(x=>x.k===k))continue;
      items.push({k,assess:true});n++;
    }
  }
  return shuffle(items);
}
function gradeAssessment(picked,results){
  return ORDER.filter(t=>picked.includes(t)).map(t=>{
    const rs=Object.keys(results).filter(k=>parse(k).includes(t)).map(k=>results[k]);
    const right=rs.filter(r=>r.correct).length;
    return {t,right,asked:rs.length,pass:rs.length>0&&right/rs.length>=PASS};
  });
}
function applyAssessment(p,picked,results){
  const graded=gradeAssessment(picked,results), passed=graded.filter(g=>g.pass).map(g=>g.t);
  p.tables=passed.length?passed:ORDER.slice(0,2);
  p.facts={};
  const t0=today();let spread=0;
  for(const k of ALL){
    if(!isUnlocked(p,k))continue;
    const r=results[k],[a,b]=parse(k);
    if(r)p.facts[k]=!r.correct?{box:1,due:Date.now()}:r.ms<=SLOW?{box:3,due:addDays(t0,3)}:{box:2,due:addDays(t0,1)};
    else if(passed.includes(a)||passed.includes(b))p.facts[k]={box:2,due:addDays(t0,1+(spread++%3))};  // untested facts from passed tables, spread over 3 days
  }
  p.assessedAt=Date.now();
  const unlocked=passed.length?checkUnlock(p):null;
  pending.facts={...p.facts};saveMeta();
  return {graded,passed,unlocked,tables:p.tables.slice()};
}

/* seasons: by date (UK meteorological seasons) unless the child picks one */
const SEASONS=[['auto','Auto'],['spring','🌸 Spring'],['summer','☀️ Summer'],['autumn','🍂 Autumn'],['winter','❄️ Winter']];
function seasonByDate(d=new Date()){const m=d.getMonth();return m===11||m<2?'winter':m<5?'spring':m<8?'summer':'autumn'}
function applySeason(){
  const s=kid&&kid.theme&&kid.theme!=='auto'?kid.theme:seasonByDate();
  if(document.documentElement.dataset.season===s)return;
  document.documentElement.dataset.season=s;
  document.querySelector('meta[name=theme-color]').content=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
}

/* install as an app */
let installEvt=null;
const LS={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const isMobile=()=>isIOS()||/android|mobile/i.test(navigator.userAgent);
const canInstall=()=>!standalone()&&(!!installEvt||isIOS());
const bannerHidden=()=>Date.now()<Number(LS.get('ttf-install-hide')||0);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;if(view==='home'||view==='welcome')render();autoInstallSheet()});
window.addEventListener('appinstalled',()=>{installEvt=null;document.querySelector('.sheet-bg')?.remove();if(view==='home'||view==='welcome')render()});
const installBanner=()=>canInstall()&&!bannerHidden()?`<div class="install"><p><b>This works best as an app.</b> Install it and it opens full screen from your home screen.</p>
  <button class="go" data-act="install">Install</button><button class="x" data-act="install-hide" aria-label="Not now">×</button></div>`:'';
function autoInstallSheet(){
  // pops up once per device on phones and tablets
  if(!isMobile()||!canInstall()||LS.get('ttf-install-seen')||!['home','welcome'].includes(view)||document.querySelector('.sheet-bg'))return;
  LS.set('ttf-install-seen','1');installSheet();
}
const shareIcon='<svg class="share" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
function installSheet(){
  if(installEvt)return sheet(`<h2>Install Times Table Forest</h2>
    <p>It works best as an app: it opens full screen from your home screen, and updates itself.</p>
    <button class="cta" data-act="install-go">Install</button>`);
  sheet(`<h2>Install Times Table Forest</h2>
    <p>It works best as an app. In Safari:</p>
    <ol class="steps"><li>Tap the Share button ${shareIcon} (bottom of the screen on iPhone, top on iPad).</li>
      <li>Scroll down and tap <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>.</li></ol>
    <p class="hint">Then open it from your home screen. You'll log in once more inside the app, so keep your Forest Pass handy.</p>`);
}
async function doInstall(){
  if(!installEvt)return;
  const e=installEvt;installEvt=null;
  document.querySelector('.sheet-bg')?.remove();
  e.prompt();await e.userChoice.catch(()=>{});render();
}

/* updates: each deploy ships a new service worker. It takes over (and the page reloads)
   only on screens where nothing is lost, never mid-round or while a Forest Pass is showing. */
const VERSION=(document.currentScript&&new URL(document.currentScript.src).searchParams.get('v'))||'dev';
let swReg=null, updateReady=false, applyingUpdate=false;
const SAFE_TO_UPDATE=new Set(['loading','welcome','home','parent','assessPick']);
if('serviceWorker' in navigator&&VERSION!=='__V__'){
  navigator.serviceWorker.register('/sw.js').then(reg=>{
    swReg=reg;
    const ready=()=>{if(navigator.serviceWorker.controller){updateReady=true;maybeUpdate()}};
    const track=w=>w&&w.addEventListener('statechange',()=>{if(w.state==='installed')ready()});
    if(reg.waiting)ready();
    track(reg.installing);
    reg.addEventListener('updatefound',()=>track(reg.installing));
  }).catch(()=>{});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(applyingUpdate)location.reload()});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')swReg?.update().catch(()=>{})});
  setInterval(()=>swReg?.update().catch(()=>{}),60*60e3);
}
function maybeUpdate(){
  if(!updateReady||applyingUpdate||!SAFE_TO_UPDATE.has(view)||document.querySelector('.sheet-bg')||!swReg?.waiting)return;
  applyingUpdate=true;
  const t=document.createElement('div');t.className='update';t.textContent='Updating the forest…';document.body.appendChild(t);
  (kid?flush():Promise.resolve()).finally(()=>swReg.waiting?swReg.waiting.postMessage('skip-waiting'):location.reload());
}

/* keep the screen on during a round or the starting check, so it doesn't dim mid-question.
   The browser drops the lock when the app is hidden; it's taken again on return. */
let wakeLock=null, wakeBusy=false;
async function syncWakeLock(){
  const want=view==='play'&&document.visibilityState==='visible';
  if(want&&!wakeLock&&!wakeBusy&&'wakeLock' in navigator){
    wakeBusy=true;
    try{
      const l=await navigator.wakeLock.request('screen');
      l.addEventListener('release',()=>{if(wakeLock===l)wakeLock=null});
      wakeLock=l;
    }catch(e){}   // refused (low battery, unsupported): carry on without it
    wakeBusy=false;
    if(view!=='play')syncWakeLock();   // the round ended while the request was pending
  }else if(!want&&wakeLock){const l=wakeLock;wakeLock=null;l.release().catch(()=>{})}
}
document.addEventListener('visibilitychange',syncWakeLock);

/* views */
const app=document.getElementById('app');
let view='loading', me={role:null}, kid=null, kids=[], card=null, cardFor='parent';
let round=null, summary=null, assessResult=null, picked=[], plan=[], armed=null, flash='', busy=false;

function render(){
  applySeason();
  ({loading:renderLoading,welcome:renderWelcome,childLogin:renderChildLogin,recover:renderRecover,
    grownup:renderGrownup,parent:renderParent,card:renderCard,
    assessPick:renderAssessPick,assessResult:renderAssessResult,
    home:renderHome,play:renderPlay,summary:renderSummary})[view]();
  syncWakeLock();
}
function go(v){view=v;flash='';armed=null;render();maybeUpdate();autoInstallSheet()}
const err=()=>flash?`<p class="err" role="alert">${esc(flash)}</p>`:'';
const back=(to,label='Back')=>`<button class="icon" data-act="go" data-to="${to}" aria-label="${label}">‹</button>`;

function renderLoading(){app.innerHTML=`<main class="screen"><div class="done">${tree(5,'big')}</div></main>`}

function renderWelcome(){
  app.innerHTML=`<main class="screen scroll">
    <header class="brand">${tree(5)}<h1>Times Table Forest</h1></header>
    <p class="lead">Every times table fact is a tree. Get it right on the right day and it grows.</p>
    ${installBanner()}
    ${err()}
    <div class="stack">
      <button class="cta" data-act="go" data-to="childLogin">I'm playing</button>
      <button class="cta quiet" data-act="go" data-to="grownup">I'm a grown-up</button>
    </div>
    <button class="link" data-act="how">How the method works</button>
  </main>`;
}

function renderChildLogin(){
  app.innerHTML=`<main class="screen scroll">
    <header class="bar">${back('welcome')}<h1>Log in</h1><span class="icon-gap"></span></header>
    <p class="lead">Your username and password are on your Forest Pass card.</p>
    <form class="form" data-form="childLogin" novalidate>
      <label>Username<input name="username" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" required></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" required>
        <span class="field-hint">Three words. Spaces or dashes both work.</span></label>
      ${err()}
      <button class="cta" ${busy?'disabled':''}>Log in</button>
    </form>
    <button class="link" data-act="go" data-to="recover">Lost your password? Use your recovery code</button>
  </main>`;
}

function renderRecover(){
  app.innerHTML=`<main class="screen scroll">
    <header class="bar">${back('childLogin')}<h1>Recovery code</h1><span class="icon-gap"></span></header>
    <p class="lead">The recovery code is on your Forest Pass, under your password. You'll get a new password and a new card.</p>
    <form class="form" data-form="recover" novalidate>
      <label>Username<input name="username" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" required></label>
      <label>Recovery code<input name="code" inputmode="numeric" autocomplete="off" placeholder="1234-5678" required></label>
      ${err()}
      <button class="cta" ${busy?'disabled':''}>Get a new password</button>
    </form>
    <p class="hint">No card and no code? Ask your grown-up to make you a new Forest Pass.</p>
  </main>`;
}

let grownupMode='login';
function renderGrownup(){
  const up=grownupMode==='signup';
  app.innerHTML=`<main class="screen scroll">
    <header class="bar">${back('welcome')}<h1>Grown-ups</h1><span class="icon-gap"></span></header>
    <div class="tabs" role="tablist">
      <button role="tab" aria-selected="${!up}" data-act="mode" data-mode="login">Log in</button>
      <button role="tab" aria-selected="${up}" data-act="mode" data-mode="signup">Create account</button>
    </div>
    <form class="form" data-form="${up?'signup':'parentLogin'}" novalidate>
      <label>Email<input name="email" type="email" autocomplete="email" required></label>
      <label>Password<input name="password" type="password" autocomplete="${up?'new-password':'current-password'}" minlength="10" required>
        ${up?'<span class="field-hint">At least 10 characters.</span>':''}</label>
      ${up?`<label class="check"><input type="checkbox" name="consent"> I'm the parent or carer of the children I'll add.</label>
      <p class="hint small">We store your email, each child's first name or nickname, and their times table answers. Failed logins are kept for a day to stop guessing. No ads, no tracking.</p>`:''}
      ${err()}
      <button class="cta" ${busy?'disabled':''}>${up?'Create account':'Log in'}</button>
    </form>
  </main>`;
}

function renderParent(){
  const rows=kids.map(c=>{
    const a=armed&&armed.id===c.id?armed.act:null;
    return `<li class="kid">
      <div class="kid-hd"><span class="pname">${esc(c.name)}</span><span class="pmeta">${esc(c.username)}</span></div>
      <p class="pmeta">${c.assessedAt?`${c.planted} of 66 planted`:'Starting check not done yet'}${c.lastPlayed?` · last played ${ago(c.lastPlayed)}`:''}</p>
      <div class="kid-acts">
        <button class="link" data-act="kid-reset" data-id="${c.id}">${a==='kid-reset'?'Tap again: new password and card':'New Forest Pass'}</button>
        <button class="link" data-act="kid-reassess" data-id="${c.id}">${a==='kid-reassess'?'Tap again: wipe progress and redo the check':'Redo starting check'}</button>
        <button class="link danger ${a==='kid-remove'?'armed':''}" data-act="kid-remove" data-id="${c.id}">${a==='kid-remove'?`Tap again to remove ${esc(c.name)} and their forest`:'Remove'}</button>
      </div></li>`;
  }).join('');
  app.innerHTML=`<main class="screen scroll">
    <header class="bar"><span class="pill-gap"></span><h1>Your children</h1><button class="pill" data-act="logout">Log out</button></header>
    <p class="hint">Children log in at <b>${esc(location.host)}</b> with the username and password on their Forest Pass.</p>
    ${err()}
    ${kids.length?`<ul class="kids">${rows}</ul>`:'<p class="lead">Add a child to make their Forest Pass.</p>'}
    <form class="add" data-form="addChild" novalidate><label for="nm" class="vh">Child's first name or nickname</label>
      <input id="nm" name="name" maxlength="20" placeholder="First name or nickname" autocomplete="off" enterkeyhint="done">
      <button ${busy?'disabled':''}>Add</button></form>
    <p class="hint small">Signed in as ${esc(me.email||'')}</p>
    <p class="ver">Version ${esc(VERSION)}</p>
  </main>`;
}
function ago(t){const d=Math.round((today()-new Date(t).setHours(0,0,0,0))/864e5);return d<=0?'today':d===1?'yesterday':`${d} days ago`}

/* Forest Pass as an image. window.print() does nothing in iPhone/iPad home-screen apps and is
   unreliable in Android installed apps, so phones get the share sheet (Print, Save Image, AirDrop...).
   The image is drawn as soon as the card shows, because iOS only allows sharing straight after a tap. */
let cardFile=null;
const loadImg=src=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=src});
async function drawCard(c){
  await Promise.all(['400 30px Fredoka','600 30px Fredoka'].map(f=>document.fonts.load(f).catch(()=>{})));
  const W=1000,H=1300,cv=document.createElement('canvas');cv.width=W;cv.height=H;
  const g=cv.getContext('2d'),F='Fredoka, ui-rounded, sans-serif',GREEN='#3F8F3A',INK='#1E2B1A',MUTED='#5B6B54';
  const text=(t,x,y,size,weight,colour,maxW)=>{let s=size;do g.font=`${weight} ${s}px ${F}`;while(maxW&&g.measureText(t).width>maxW&&--s>20);g.fillStyle=colour;g.fillText(t,x,y)};
  g.fillStyle='#fff';g.fillRect(0,0,W,H);
  g.beginPath();const x=40,y=40,w=W-80,h=H-80,rr=48;
  g.moveTo(x+rr,y);g.arcTo(x+w,y,x+w,y+h,rr);g.arcTo(x+w,y+h,x,y+h,rr);g.arcTo(x,y+h,x,y,rr);g.arcTo(x,y,x+w,y,rr);g.closePath();
  g.setLineDash([24,14]);g.lineWidth=8;g.strokeStyle=GREEN;g.stroke();g.setLineDash([]);
  try{g.drawImage(await loadImg('icons/icon-192.png'),95,95,150,150)}catch(e){}
  text('FOREST PASS',275,150,34,600,GREEN);
  text(c.name,275,222,64,600,INK,640);
  const rows=[['Website',location.host,44],['Username',c.username,60],['Password',c.password,60],['Recovery code',c.recovery,60]];
  rows.forEach(([label,value,size],i)=>{const top=350+i*170;text(label,110,top,34,400,MUTED);text(value,110,top+70,size,600,INK,780)});
  ['Keep this card safe at home.','Never tell a friend your password.','Lost your password? Use the recovery code.']
    .forEach((t,i)=>text('•  '+t,110,1060+i*56,32,400,MUTED,780));
  const blob=await new Promise(ok=>cv.toBlob(ok,'image/png'));
  return new File([blob],`Forest Pass - ${c.name.replace(/[^\w -]/g,'')}.png`,{type:'image/png'});
}
function printCard(){
  const f=cardFile;
  if(f&&navigator.canShare&&navigator.canShare({files:[f]}))
    return navigator.share({files:[f],title:'Forest Pass'}).catch(()=>{});   // cancelled is fine
  if(!standalone())return window.print();
  if(!f)return;
  const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
}

function renderCard(){
  const c=card;
  app.innerHTML=`<main class="screen scroll">
    <h1 class="card-title">${cardFor==='parent'?`${esc(c.name)}'s Forest Pass`:'Your new Forest Pass'}</h1>
    <p class="lead">Write this down or print it now. The password can't be shown again.</p>
    <section class="pass" id="pass">
      <div class="pass-hd">${tree(5)}<div><p class="pass-label">Forest Pass</p><p class="pass-name">${esc(c.name)}</p></div></div>
      <dl>
        <dt>Website</dt><dd>${esc(location.host)}</dd>
        <dt>Username</dt><dd class="cred">${esc(c.username)}</dd>
        <dt>Password</dt><dd class="cred">${esc(c.password)}</dd>
        <dt>Recovery code</dt><dd class="cred">${esc(c.recovery)}</dd>
      </dl>
      <ul class="pass-rules">
        <li>Keep this card safe at home.</li>
        <li>Never tell a friend your password.</li>
        <li>Lost your password? Use the recovery code.</li>
      </ul>
    </section>
    <div class="stack">
      <button class="cta quiet" data-act="print">Print or save card</button>
      <label class="check"><input type="checkbox" id="wrote"> ${cardFor==='parent'?"We've written it down or printed it.":"I've written it down."}</label>
      <button class="cta" data-act="card-done" id="cardDone" disabled>${cardFor==='parent'?'Done':'Go to my forest'}</button>
    </div>
  </main>`;
  document.getElementById('wrote').addEventListener('change',e=>{document.getElementById('cardDone').disabled=!e.target.checked});
  cardFile=null;const forCard=c;drawCard(c).then(f=>{if(card===forCard)cardFile=f}).catch(()=>{});
}

function renderAssessPick(){
  app.innerHTML=`<main class="screen scroll">
    <header class="bar"><button class="pill" data-act="logout">Log out</button><h1>Hello ${esc(kid.name)}</h1><span class="pill-gap"></span></header>
    <p class="status">Which times tables do you already know?</p>
    <p class="hint">Tap the ones you know. Then we'll check with a few questions, so your forest starts in the right place.</p>
    <div class="tgrid">${[2,3,4,5,6,7,8,9,10,11,12].map(t=>`<button class="tbtn" data-act="pick-t" data-t="${t}" aria-pressed="${picked.includes(t)}">${t}</button>`).join('')}</div>
    <div class="stack">
      <button class="cta" data-act="assess-start" ${picked.length?'':'disabled'}>${picked.length?`Check these (${plan.length} questions)`:'Tap the tables you know'}</button>
      <button class="cta quiet" data-act="assess-skip">I don't know any yet</button>
    </div>
  </main>`;
}

function renderAssessResult(){
  const s=assessResult;
  const rows=s.graded.map(g=>`<li class="${g.pass?'pass-yes':'pass-no'}"><span class="tname">${g.t}s</span>
    <span>${g.right} of ${g.asked}</span><span>${g.pass?'You know these':"We'll grow these"}</span></li>`).join('');
  const lead=!s.graded.length?"No problem. We'll start with the 10s and 2s."
    :s.passed.length===s.graded.length?'You really know all of those!'
    :s.passed.length?`You know the ${list(s.passed.slice().sort((a,b)=>a-b))} times tables. We'll grow the rest together.`
    :"Let's grow those together, starting with the 10s and 2s.";
  app.innerHTML=`<main class="screen scroll"><div class="done">${tree(s.passed.length?4:1,'big')}<h1>Starting check done</h1>
    <p class="lead center">${lead}</p>
    ${rows?`<ul class="results">${rows}</ul>`:''}
    <p class="hint center">Your forest starts with the ${list(s.tables.slice().sort((a,b)=>a-b))} times tables.</p>
    <button class="cta" data-act="home">Go to my forest</button></div></main>`;
}

function renderHome(){
  const p=kid,now=Date.now(),un=ALL.filter(k=>isUnlocked(p,k));
  const due=un.filter(k=>{const f=fact(p,k);return f.box>0&&f.due<=now}).length;
  const fresh=un.filter(k=>fact(p,k).box===0).length;
  const status=due?`${due} ${due===1?'tree is':'trees are'} ready to check today.`:fresh?'New seeds are ready to plant.':'Everything is checked for today. Come back tomorrow to grow more.';
  const label=(due||fresh)?"Play today's round":'Extra practice';
  const on=tablesOn(p);
  let g='<div class="hd">×</div>'+[...Array(11)].map((_,i)=>`<div class="hd ${on.includes(i+2)?'on':''}">${i+2}</div>`).join('');
  for(let a=2;a<=12;a++){
    g+=`<div class="hd ${on.includes(a)?'on':''}">${a}</div>`;
    for(let b=2;b<=12;b++){
      const k=key(a,b),s=fact(p,k).box,lk=!isUnlocked(p,k);
      g+=lk?`<span class="cell locked">${tree(0)}</span>`
           :`<button class="cell" data-act="cell" data-a="${a}" data-b="${b}" aria-label="${a} times ${b}: ${STAGES[s]}">${tree(s)}</button>`;
    }
  }
  const next=nextTable(p);
  app.innerHTML=`<main class="screen scroll">
    <header class="bar"><button class="pill" data-act="logout">Log out</button>
      <h1>${esc(p.name)}'s forest</h1><button class="icon" data-act="how" aria-label="How it works">?</button></header>
    ${installBanner()}
    ${unsaved?'<p class="warn">Some answers haven\'t saved yet. They\'ll save when the internet is back.</p>':''}
    <section class="today"><p class="status">${status}</p>
      <p class="streak">${p.streak>1?`${p.streak} days in a row`:'Play a little every day to keep the forest growing.'}</p>
      <button class="cta" data-act="play">${label}</button></section>
    <section class="forest" aria-label="Times table forest">${g}</section>
    <div class="legend">${[1,2,3,4,5].map(s=>`<span>${tree(s)}${STAGES[s]}</span>`).join('')}</div>
    <p class="tables">Planted: the ${on.slice().sort((x,y)=>x-y).join(', ')} times tables.${next?` Next up: the ${next} times table.`:' Every table is planted.'}</p>
    <div class="seasons" role="group" aria-label="Forest season"><p>Forest season</p>${SEASONS.map(([k,l])=>
      `<button data-act="season" data-s="${k}" aria-pressed="${(p.theme||'auto')===k}">${l}</button>`).join('')}</div>
  </main>`;
}

function startRound(){
  round={items:buildRound(kid),i:0,input:'',mode:'ask',lock:false,res:{asked:0,right:0,quick:0,grown:0}};
  view='play';nextItem();
}
function startAssessment(){
  round={items:plan.map(x=>({...x})),i:0,input:'',mode:'ask',lock:false,assess:true,results:{}};
  view='play';nextItem();
}
function nextItem(){
  const r=round;
  if(r.i>=r.items.length)return r.assess?finishAssessment():finishRound();
  const it=r.items[r.i];
  const [x,y]=parse(it.k);[it.a,it.b]=Math.random()<.5?[x,y]:[y,x];
  r.input='';r.lock=false;r.mode=(it.isNew&&!it.seen)?'intro':'ask';
  renderPlay();
  if(r.mode==='ask')r.start=performance.now();
}
function renderPlay(){
  syncWakeLock();
  const r=round,it=r.items[r.i],pct=Math.round(r.i/r.items.length*100);
  let stage;
  if(r.mode==='intro'){
    stage=`<div class="intro">${tree(1)}<p class="tag">New seed</p><p class="eq">${it.a} × ${it.b} = ${it.a*it.b}</p>
      <p class="hint">${hint(it.a,it.b)}</p><button class="cta" data-act="gotit">Got it</button></div>`;
  }else{
    stage=`${r.assess?'<p class="tag">Starting check</p>':''}<p class="q">${it.a} × ${it.b}</p><div class="ans" id="ans" aria-live="polite">${r.input}</div>
      <div id="msg">${r.mode==='fix'?fixHtml(it):'<p class="msg"></p>'}</div>`;
  }
  const keys=[1,2,3,4,5,6,7,8,9].map(n=>`<button class="key" data-key="${n}">${n}</button>`).join('')+
    `<button class="key" data-key="del" aria-label="Delete">⌫</button><button class="key" data-key="0">0</button><button class="key go" data-key="go">Go</button>`;
  app.innerHTML=`<main class="screen play">
    <header class="pbar"><button class="icon" data-act="quit" aria-label="Stop">×</button>
      <div class="track"><div class="fill" style="width:${pct}%"></div></div><span class="count">${r.i+1}/${r.items.length}</span></header>
    <section class="stage">${stage}</section>
    <section class="pad ${r.mode==='intro'?'off':''}">${keys}</section></main>`;
}
const fixHtml=it=>`<div class="fix"><p class="eq-s">${it.a} × ${it.b} = ${it.a*it.b}</p><p class="hint">${hint(it.a,it.b)}</p><p>Type ${it.a*it.b} to carry on.</p></div>`;

function press(k){
  const r=round;if(!r||r.lock||r.mode==='intro')return;
  if(k==='del')r.input=r.input.slice(0,-1);
  else if(k==='go')return submit();
  else if(r.input.length<3)r.input+=k;
  const a=document.getElementById('ans');if(a){a.textContent=r.input;a.classList.remove('wrong','shake')}
}
function requeue(item,gap){
  const r=round,later=r.items.slice(r.i+1);
  if(later.some(x=>x.k===item.k))return;
  r.items.splice(Math.min(r.items.length,r.i+1+gap),0,item);
}
const kindOf=it=>it.assess?'assess':it.practice?'practice':it.reask?'reask':it.retry?'retry':it.isNew?'new':'review';
function submit(){
  const r=round,it=r.items[r.i];if(!r.input)return;
  const ansEl=document.getElementById('ans'),msg=document.getElementById('msg');
  const correct=Number(r.input)===it.a*it.b;
  if(r.mode==='fix'){
    if(correct){r.i++;nextItem()}
    else{r.input='';ansEl.textContent='';ansEl.classList.remove('shake');void ansEl.offsetWidth;ansEl.classList.add('wrong','shake')}
    return;
  }
  const ms=performance.now()-r.start;
  logAnswer({fact:it.k,a:it.a,b:it.b,given:Number(r.input),correct,ms:Math.min(Math.round(ms),36e5),kind:kindOf(it),at:Date.now()});
  if(r.assess){
    // no right/wrong shown during the check, so it measures what they know rather than teaching
    r.results[it.k]={correct,ms};r.lock=true;ansEl.classList.add('given');
    setTimeout(()=>{r.i++;nextItem()},350);
    return;
  }
  const p=kid,f={...fact(p,it.k)},before=f.box;
  r.res.asked++;
  if(correct){
    r.res.right++;if(ms<=QUICK)r.res.quick++;
    if(!it.practice){
      let nb=Math.min(5,f.box+1);
      if(ms>SLOW)nb=Math.min(nb,Math.max(f.box,2));   // slow answers stop at sprout
      f.box=nb;f.due=dueFor(nb);
      if(it.isNew&&!it.reask)requeue({k:it.k,reask:true},4);
    }
    if(f.box>before)r.res.grown++;
    p.facts[it.k]=f;saveFact(it.k);
    r.lock=true;ansEl.classList.add('right');
    msg.innerHTML=`<p class="msg">${ms<=QUICK?'<span class="quick">Quick!</span>':f.box>before?'Growing':'Right'}</p>`;
    setTimeout(()=>{r.i++;nextItem()},ms<=QUICK?550:750);
  }else{
    f.box=1;f.due=Date.now();p.facts[it.k]=f;saveFact(it.k);
    requeue({k:it.k,retry:true},3);
    r.mode='fix';r.input='';ansEl.textContent='';ansEl.classList.add('wrong','shake');
    msg.innerHTML=fixHtml(it);
  }
}
function finishRound(){
  const p=kid,t=today();
  if(p.lastDay!==t){p.streak=Math.round((t-p.lastDay)/864e5)===1?p.streak+1:1;p.lastDay=t}
  summary={...round.res,unlocked:checkUnlock(p)};saveMeta();round=null;view='summary';render();
  flush().then(ok=>{if(!ok&&view==='summary')render()});
}
function finishAssessment(){
  assessResult=applyAssessment(kid,picked,round.results);round=null;picked=[];go('assessResult');flush();
}
function renderSummary(){
  const s=summary;
  app.innerHTML=`<main class="screen"><div class="done">${tree(s.grown?4:2,'big')}<h1>Round done</h1>
    <div class="stats"><span><b>${s.right}</b> of ${s.asked} right</span><span><b>${s.quick}</b> quick answers</span>
      <span><b>${s.grown}</b> ${s.grown===1?'tree':'trees'} grew</span></div>
    ${s.unlocked?`<p class="unlock">The ${s.unlocked} times table is now planted.</p>`:''}
    ${unsaved?'<p class="warn center">Not saved yet. It will save when the internet is back.</p>':''}
    <button class="cta" data-act="home">Back to the forest</button>
    <button class="cta quiet" data-act="play">Play again</button></div></main>`;
}

/* sheets */
function sheet(html){
  const bg=document.createElement('div');bg.className='sheet-bg';
  bg.innerHTML=`<div class="sheet" role="dialog" aria-modal="true">${html}<button class="cta quiet" data-act="close">Close</button></div>`;
  bg.addEventListener('click',e=>{
    const act=e.target.closest('[data-act]')?.dataset.act;
    if(act==='install-go')return doInstall();
    if(e.target===bg||act==='close'){bg.remove();maybeUpdate()}
  });
  document.body.appendChild(bg);bg.querySelector('[data-act=close]').focus();
}
function cellSheet(a,b){
  const s=fact(kid,key(a,b)).box;
  sheet(`<p class="eq">${a} × ${b} = ${a*b}</p><p>${b} × ${a} is the same tree.</p><p class="hint">${hint(a,b)}</p><p>Stage: ${STAGES[s]}.</p>`);
}
function howSheet(){
  sheet(`<h2>How the method works</h2><ol>
  <li>A starting check. Children pick the tables they think they know and answer a few questions on each. Only the tables they really know are planted.</li>
  <li>Recall, not reading. Every question is answered from memory. Pulling a fact out of memory is what makes it stick.</li>
  <li>Spaced repetition. A right answer sends the fact away for longer each time: same round, 1 day, 3 days, 7 days, then 21 days. Each check grows the tree a stage. A wrong answer sends it back to a seed.</li>
  <li>Easy facts first, hard facts built from them. Tables unlock in this order: 10, 2, 5, 11, 3, 4, 9, 6, 8, 12, 7. New seeds come with a strategy, like "×9 is ×10 take away one".</li>
  <li>6 × 7 and 7 × 6 are one tree. That turns 121 facts into 66.</li>
  <li>Mistakes are fixed straight away. The answer and strategy appear, the child types it, and it comes back three questions later.</li>
  <li>Accuracy first, then speed. There's no countdown. An answer slower than 6 seconds (the limit in the Year 4 Multiplication Tables Check) still counts, but the tree can't grow past a sprout until it comes quickly.</li>
  <li>Little and often. About 20 questions, a few minutes a day. A table unlocks when most planted trees have sprouted.</li></ol>`);
}

/* flows */
async function boot(){
  try{localStorage.removeItem('times-table-forest-v1')}catch(e){}   // progress from the old device-only version
  try{me=await api('/me')}catch(e){me={role:null};flash=e.message}
  if(me.role==='child')await enterChild();
  else if(me.role==='parent')await enterParent();
  else{const f=flash;go('welcome');if(f){flash=f;render()}}
}
async function enterChild(){
  try{kid=await api('/child/state')}catch(e){return signedOut(e)}
  loadPending();
  // answers saved on this device but not yet on the server win over the server copy
  Object.assign(kid.facts,pending.facts);if(pending.meta)Object.assign(kid,pending.meta);
  if(hasPending())flush();
  picked=[];plan=[];go(kid.assessedAt?'home':'assessPick');
}
async function enterParent(){
  try{kids=(await api('/parent/children')).children}catch(e){return signedOut(e)}
  go('parent');
}
function signedOut(e){me={role:null};kid=null;go('welcome');if(e){flash=e.status===401?'':e.message;render()}}

async function submitForm(name,f){
  const v=n=>(f.elements[n]?f.elements[n].value:'').trim();
  busy=true;flash='';
  try{
    switch(name){
      case 'childLogin':
        if(!v('username')||!v('password'))throw new Error('Type your username and password.');
        await api('/child/login',{username:v('username'),password:v('password')});me={role:'child'};busy=false;return enterChild();
      case 'recover':{
        if(!v('username')||!v('code'))throw new Error('Type your username and recovery code.');
        const r=await api('/child/recover',{username:v('username'),code:v('code')});me={role:'child'};
        card=r.card;cardFor='child';busy=false;return go('card');
      }
      case 'parentLogin':
        await api('/parent/login',{email:v('email'),password:f.elements.password.value});me=await api('/me');busy=false;return enterParent();
      case 'signup':
        await api('/parent/signup',{email:v('email'),password:f.elements.password.value,consent:f.elements.consent.checked});me=await api('/me');busy=false;return enterParent();
      case 'addChild':{
        if(!v('name'))return document.getElementById('nm').focus();
        const r=await api('/parent/children',{name:v('name')});card=r.card;cardFor='parent';busy=false;return go('card');
      }
    }
  }catch(e){
    flash=e.message;busy=false;
    // keep what was typed, apart from passwords
    const keep={};for(const el of f.elements)if(el.name&&el.type!=='password')keep[el.name]=el.type==='checkbox'?el.checked:el.value;
    render();
    const nf=app.querySelector('form');
    if(nf)for(const n in keep){const el=nf.elements[n];if(el)el[el.type==='checkbox'?'checked':'value']=keep[n]}
  }
}

async function parentAction(act,id){
  if(!armed||armed.id!==id||armed.act!==act){armed={id,act};return render()}
  armed=null;
  try{
    if(act==='kid-reset'){const r=await api(`/parent/children/${id}/reset`,{});card=r.card;cardFor='parent';return go('card')}
    if(act==='kid-reassess')await api(`/parent/children/${id}/reassess`,{});
    if(act==='kid-remove')await api(`/parent/children/${id}`,{},'DELETE');
    await enterParent();
  }catch(e){flash=e.message;render()}
}

/* events */
app.addEventListener('submit',e=>{
  e.preventDefault();if(busy)return;
  const f=e.target.closest('[data-form]');if(f)submitForm(f.dataset.form,f);
});
app.addEventListener('click',e=>{
  const kb=e.target.closest('[data-key]');if(kb)return press(kb.dataset.key);
  const b=e.target.closest('[data-act]');if(!b)return;
  const act=b.dataset.act;
  if(!act.startsWith('kid-'))armed=null;
  switch(act){
    case 'go':go(b.dataset.to);break;
    case 'mode':grownupMode=b.dataset.mode;flash='';render();break;
    case 'how':howSheet();break;
    case 'logout':
      flush().finally(()=>api('/logout',{}).catch(()=>{}).finally(()=>{kid=null;kids=[];signedOut()}));break;
    case 'play':startRound();break;
    case 'home':go('home');break;
    case 'quit':round=null;go(kid.assessedAt?'home':'assessPick');break;
    case 'gotit':round.items[round.i].seen=true;round.mode='ask';renderPlay();round.start=performance.now();break;
    case 'cell':cellSheet(+b.dataset.a,+b.dataset.b);break;
    case 'pick-t':{const t=+b.dataset.t;picked=picked.includes(t)?picked.filter(x=>x!==t):[...picked,t];plan=buildAssessment(picked);render();break}
    case 'assess-start':startAssessment();break;
    case 'assess-skip':assessResult=applyAssessment(kid,[],{});flush();go('assessResult');break;
    case 'print':printCard();break;
    case 'season':kid.theme=b.dataset.s;saveMeta();render();break;
    case 'install':installSheet();break;
    case 'install-hide':LS.set('ttf-install-hide',String(Date.now()+14*864e5));render();break;
    case 'card-done':card=null;cardFile=null;if(cardFor==='child')enterChild();else enterParent();break;
    case 'kid-reset':case 'kid-reassess':case 'kid-remove':parentAction(act,+b.dataset.id);break;
  }
});
document.addEventListener('keydown',e=>{
  if(view!=='play'||document.querySelector('.sheet-bg'))return;
  if(/^[0-9]$/.test(e.key))press(e.key);
  else if(e.key==='Backspace')press('del');
  else if(e.key==='Enter'){if(round&&round.mode==='intro')document.querySelector('[data-act=gotit]').click();else press('go')}
  else return;
  e.preventDefault();   // stop Enter also "clicking" whichever on-screen key has focus
});

render();
boot();
