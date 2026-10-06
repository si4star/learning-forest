const ORDER=[10,2,5,11,3,4,9,6,8,12,7];         // unlock order: anchors first, 7s last
const HINT_ORDER=[10,2,5,11,4,3,9,8,6,12,7];    // which factor gives the easiest strategy
const ROUND=20, SLOW=6000, QUICK=3000;
const ASSESS_MIN=5, PASS=0.8;                    // starting check: at least 5 facts per table, 80% to pass
const INTERVAL_DAYS={2:1,3:3,4:7,5:21};
const STAGES=['Not planted','Seed','Sprout','Sapling','Tree','Great tree'];
// Practice check: the same shape as the Year 4 Multiplication Tables Check
const MOCK_N=25, MOCK_MS=6000, MOCK_PAUSE=3000, MOCK_TREES=34;
const HEAVY=[6,7,8,9,12];   // weighted more heavily in the real check
// A forest friend moves in when every fact in a table is a Tree or Great tree
const FRIENDS={10:['🦉','an owl'],2:['🐿️','a squirrel'],5:['🦔','a hedgehog'],11:['🐇','a rabbit'],3:['🦊','a fox'],
  4:['🐦','a robin'],9:['🦌','a deer'],6:['🦡','a badger'],8:['🦋','a butterfly'],12:['🐸','a frog'],7:['🐞','a ladybird']};
const friendName=t=>FRIENDS[t][1].split(' ')[1];
// Shown before a newly planted table, with three worked examples
const TABLE_INTROS={10:'To times by 10, count in tens.',2:'To times by 2, double the number.',
  5:'To times by 5, times by 10, then halve it.',11:'To times by 11, write the digit twice.',
  3:'To times by 3, double the number, then add one more lot.',4:'To times by 4, double it, then double again.',
  9:'To times by 9, times by 10, then take one lot away.',6:'To times by 6, times by 5, then add one more lot.',
  8:'To times by 8, double it three times.',12:'To times by 12, times by 10 and by 2, then add them.',
  7:'To times by 7, times by 5 and by 2, then add them.'};
const VAPID_PUBLIC_KEY='BFXwFsqbBKnp3g-1oVvI3UoYA31muXHWVXfwVK-6fo6YkYhG7SiOZmTtv04UMQMbGR1JekoavPmquSnJv82b31Q';
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
let pending=null, flushing=null, syncTimer=null, unsaved=false, offline=false, needLogin=false;
const emptyPending=()=>({facts:{},answers:[],meta:null});
const pkey=()=>'ttf-pending-'+kid.id;
function loadPending(){try{pending=JSON.parse(localStorage.getItem(pkey()))||emptyPending()}catch(e){pending=emptyPending()}}
function storePending(){try{localStorage.setItem(pkey(),JSON.stringify(pending))}catch(e){}}
const hasPending=()=>pending&&(pending.meta||pending.answers.length||Object.keys(pending.facts).length);
function queue(){storePending();storeSnap();clearTimeout(syncTimer);syncTimer=setTimeout(flush,400)}
// The last known forest is kept on the device so a round can be played with no connection.
function storeSnap(){if(kid)LS.set('ttf-snap',JSON.stringify({kid}))}
function readSnap(){try{return JSON.parse(LS.get('ttf-snap'))}catch(e){return null}}
function saveFact(k){pending.facts[k]=kid.facts[k];queue()}
function logAnswer(a){pending.answers.push(a);queue()}
function saveMeta(){pending.meta={tables:kid.tables,streak:kid.streak,lastDay:kid.lastDay,assessedAt:kid.assessedAt,theme:kid.theme||'auto',extra:kid.extra};queue()}
async function flush(){
  if(flushing)await flushing;
  if(!kid||!hasPending())return true;
  const sending=pending;pending=emptyPending();
  const body={facts:sending.facts,answers:sending.answers.slice(0,200)};
  if(sending.meta)body.meta=sending.meta;
  pending.answers=sending.answers.slice(200);
  flushing=api('/child/sync',body).then(()=>{unsaved=false;offline=false;needLogin=false;storePending();if(pending.answers.length)queue();return true},e=>{
    pending={facts:{...sending.facts,...pending.facts},answers:sending.answers.concat(pending.answers),meta:pending.meta||sending.meta};
    storePending();unsaved=true;if(e.status===401)needLogin=true;return false;
  }).finally(()=>{flushing=null});
  return flushing;
}
window.addEventListener('online',()=>flush().then(ok=>{if(ok){offline=false;if(view==='home'||view==='hub')render()}}));
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

// The same strategies as hint(), as steps the child works through, typing each small answer.
// The last step's answer is always the product.
function walkSteps(a,b,force){
  const s=force??(HINT_ORDER.indexOf(a)<=HINT_ORDER.indexOf(b)?a:b), n=s===a?b:a, p=a*b;
  const st=(say,q,ans)=>({say,q,ans});
  switch(s){
    case 10:return [st(`${n} lots of 10 is ${n} tens.`,`${n} tens`,p)];
    case 2:return [st('Times 2 means double it.',`double ${n}`,p)];
    case 5:return [st('Times 10 first.',`10 × ${n}`,10*n),st('5 is half of 10, so halve it.',`half of ${10*n}`,p)];
    case 11:return n<=9?[st('Times 11 with one digit: write the digit twice.',`write ${n} twice`,p)]
      :[st('Times 10 first.',`10 × ${n}`,10*n),st(`11 lots is one more ${n}.`,`${10*n} + ${n}`,p)];
    case 4:return [st('Times 4 is double, then double again.',`double ${n}`,2*n),st('Now double it again.',`double ${2*n}`,p)];
    case 3:return [st('Double it first.',`double ${n}`,2*n),st(`3 lots is one more ${n}.`,`${2*n} + ${n}`,p)];
    case 9:return [st('Times 10 first.',`10 × ${n}`,10*n),st(`9 lots is one ${n} less, so take one ${n} away.`,`${10*n} − ${n}`,p)];
    case 8:return [st('Times 8 is double, double, double.',`double ${n}`,2*n),st('Double again.',`double ${2*n}`,4*n),st('And double once more.',`double ${4*n}`,p)];
    case 6:return [st('Times 5 first.',`5 × ${n}`,5*n),st(`6 lots is one more ${n}.`,`${5*n} + ${n}`,p)];
    case 12:return [st('Times 10 first.',`10 × ${n}`,10*n),st(`Now 2 × ${n}.`,`2 × ${n}`,2*n),st('Add them together.',`${10*n} + ${2*n}`,p)];
    case 7:return [st('Times 5 first.',`5 × ${n}`,5*n),st(`Now 2 × ${n}.`,`2 × ${n}`,2*n),st('Add them together.',`${5*n} + ${2*n}`,p)];
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
  p.extra={...p.extra,intros:passed.slice(),friends:[],restDay:null};   // tables they know need no introduction
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
const LS={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const isMobile=()=>isIOS()||/android|mobile/i.test(navigator.userAgent);
const canInstall=()=>!standalone()&&(!!installEvt||isIOS());
const bannerHidden=()=>Date.now()<Number(LS.get('ttf-install-hide')||0);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;if(['hub','home','welcome'].includes(view))render();autoInstallSheet()});
window.addEventListener('appinstalled',()=>{installEvt=null;document.querySelector('.sheet-bg')?.remove();if(['hub','home','welcome'].includes(view))render()});
const installBanner=()=>canInstall()&&!bannerHidden()?`<div class="install"><p><b>This works best as an app.</b> Install it and it opens full screen from your home screen.</p>
  <button class="go" data-act="install">Install</button><button class="x" data-act="install-hide" aria-label="Not now">×</button></div>`:'';
function autoInstallSheet(){
  // pops up once per device on phones and tablets
  if(!isMobile()||!canInstall()||LS.get('ttf-install-seen')||!['hub','home','welcome'].includes(view)||document.querySelector('.sheet-bg'))return;
  LS.set('ttf-install-seen','1');installSheet();
}
const shareIcon='<svg class="share" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
function installSheet(){
  if(installEvt)return sheet(`<h2>Install the times tables app</h2>
    <p>It works best as an app: it opens full screen from your home screen, and updates itself.</p>
    <button class="cta" data-act="install-go">Install</button>`);
  sheet(`<h2>Install the times tables app</h2>
    <p>It works best as an app. In Safari:</p>
    <ol class="install-steps"><li>Tap the Share button ${shareIcon} (bottom of the screen on iPhone, top on iPad).</li>
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
const SAFE_TO_UPDATE=new Set(['loading','welcome','hub','home','parent','assessPick','mockIntro']);
if('serviceWorker' in navigator&&VERSION!=='__V__'){
  navigator.serviceWorker.register('/app/sw.js',{scope:'/app/'}).then(reg=>{
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
let view='loading', me={role:null}, kid=null, kids=[], classes=[], card=null, cardFor='parent';
// classDev: this device is set up for a class (pupils log in with name + pictures)
let classDev=null, classInfo=null, pupil=null, picks=[], picMsg='', openClass=null, classCards=[];
const PICS=[['🦊','fox'],['🐸','frog'],['🦉','owl'],['🍎','apple'],['🍓','strawberry'],['🚂','train'],
  ['🚀','rocket'],['⭐','star'],['🌈','rainbow'],['⚽','ball'],['🎈','balloon'],['🐝','bee']];
const picsHtml=ps=>ps?ps.map(i=>`<span class="pic" role="img" aria-label="${PICS[i][1]}">${PICS[i][0]}</span>`).join(''):'';
let round=null, summary=null, assessResult=null, mockResult=null, picked=[], plan=[], armed=null, flash='', busy=false;

function render(){
  applySeason();
  ({loading:renderLoading,welcome:renderWelcome,childLogin:renderChildLogin,recover:renderRecover,
    grownup:renderGrownup,parent:renderParent,card:renderCard,scan:renderScan,
    classPick:renderClassPick,classPics:renderClassPics,classAdmin:renderClassAdmin,classCards:renderClassCards,
    assessPick:renderAssessPick,assessResult:renderAssessResult,
    hub:renderHub,home:renderHome,play:renderPlay,summary:renderSummary,mockIntro:renderMockIntro,mockResult:renderMockResult})[view]();
  syncWakeLock();
}
function go(v){if(v!=='scan')stopScan();view=v;flash='';armed=null;render();maybeUpdate();autoInstallSheet()}
const err=()=>flash?`<p class="err" role="alert">${esc(flash)}</p>`:'';
const back=(to,label='Back')=>`<button class="icon" data-act="go" data-to="${to}" aria-label="${label}">‹</button>`;

function renderLoading(){app.innerHTML=`<main class="screen"><div class="done">${tree(5,'big')}</div></main>`}

function renderWelcome(){
  app.innerHTML=`<main class="screen scroll">
    <header class="brand">${tree(5)}<div><p class="brand-kicker">by The Tree Fella</p><h1>The Learning Forest</h1></div></header>
    <p class="lead">Log in with your Forest Pass to grow your times tables.</p>
    ${installBanner()}
    ${err()}
    <div class="stack">
      <button class="cta" data-act="go" data-to="childLogin">I'm playing</button>
      <button class="cta quiet" data-act="go" data-to="grownup">I'm a grown-up</button>
    </div>
    <button class="link" data-act="how">How the times tables method works</button>
  </main>`;
}

// Show/hide for password boxes; type="button" so it never submits the form
const pwToggle='<button type="button" class="pw-toggle" data-act="pw" aria-pressed="false" aria-label="Show password">Show</button>';
function togglePw(b){
  const input=b.parentElement.querySelector('input'),show=input.type==='password';
  input.type=show?'text':'password';
  b.textContent=show?'Hide':'Show';b.setAttribute('aria-pressed',String(show));b.setAttribute('aria-label',show?'Hide password':'Show password');
  input.focus();
}

function renderChildLogin(){
  app.innerHTML=`<main class="screen scroll">
    <header class="bar">${back('welcome')}<h1>Log in</h1><span class="icon-gap"></span></header>
    <p class="lead">Your username and password are on your Forest Pass card.</p>
    ${canScan()?'<div class="stack"><button class="cta quiet" data-act="scan">📷 Scan my Forest Pass</button></div><p class="or">or type them in</p>':''}
    <form class="form" data-form="childLogin" novalidate>
      <label>Username<input name="username" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" required></label>
      <label>Password<span class="pw"><input name="password" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" required>${pwToggle}</span>
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
      <label>Password<span class="pw"><input name="password" type="password" autocomplete="${up?'new-password':'current-password'}" minlength="10" required>${pwToggle}</span>
        ${up?'<span class="field-hint">At least 10 characters.</span>':''}</label>
      ${up?`<label class="check"><input type="checkbox" name="consent"> I'm the parent or carer of the children I'll add, or their teacher.</label>
      <p class="hint small">We store your email, each child's first name or nickname, and their times table answers. If a daily reminder is turned on, we also store that device's notification address and chosen time. Failed logins are kept for a day to stop guessing. No ads, no tracking. <a href="/school-pack/privacy.html" target="_blank" rel="noopener">Privacy notice</a></p>`:''}
      ${err()}
      <button class="cta" ${busy?'disabled':''}>${up?'Create account':'Log in'}</button>
    </form>
  </main>`;
}

function kidActions(c,a){
  return `<button class="link" data-act="tricky" data-id="${c.id}">Tricky facts</button>
        <button class="link" data-act="rename" data-id="${c.id}">Rename</button>
        ${c.classId?`<button class="link" data-act="kid-pics" data-id="${c.id}">${a==='kid-pics'?'Tap again: new pictures':'New pictures'}</button>`:''}
        <button class="link" data-act="kid-qr" data-id="${c.id}">${a==='kid-qr'?'Tap again: new QR card (the old one stops working)':'New QR card'}</button>
        ${c.classId?'':`<button class="link" data-act="kid-reset" data-id="${c.id}">${a==='kid-reset'?'Tap again: new password and card':'New Forest Pass'}</button>`}
        <button class="link" data-act="kid-reassess" data-id="${c.id}">${a==='kid-reassess'?'Tap again: wipe progress and redo the check':'Redo starting check'}</button>
        <button class="link danger ${a==='kid-remove'?'armed':''}" data-act="kid-remove" data-id="${c.id}">${a==='kid-remove'?`Tap again to remove ${esc(c.name)} and their forest`:'Remove'}</button>`;
}
const kidMeta=c=>`${c.assessedAt?`${c.planted} of 66 planted`:'Starting check not done yet'}${c.lastPlayed?` · last played ${ago(c.lastPlayed)}`:''}`;
const deviceBanner=()=>classDev?`<div class="install"><p><b>This device is set up for ${esc(classDev.className)}.</b> When nobody is logged in, it shows the class's name tiles.</p>
  <button class="go" data-act="leave-device">Stop</button></div>`:'';
function renderParent(){
  const family=kids.filter(c=>!c.classId);
  const rows=family.map(c=>{
    const a=armed&&armed.id===c.id?armed.act:null;
    return `<li class="kid">
      <div class="kid-hd"><span class="pname">${esc(c.name)}</span><span class="pmeta">${esc(c.username)}</span></div>
      <p class="pmeta">${c.assessedAt?`${c.planted} of 66 planted`:'Starting check not done yet'}${c.lastPlayed?` · last played ${ago(c.lastPlayed)}`:''}</p>
      <div class="kid-acts">${kidActions(c,a)}</div></li>`;
  }).join('');
  const classRows=classes.map(k=>{const n=kids.filter(c=>c.classId===k.id).length;
    return `<li><button class="menu-row" data-act="open-class" data-id="${k.id}"><span>${esc(k.name)}</span>
      <span class="pmeta">${n} ${n===1?'pupil':'pupils'}${k.devices?` · ${k.devices} ${k.devices===1?'device':'devices'}`:''} ›</span></button></li>`}).join('');
  app.innerHTML=`<main class="screen scroll">
    <header class="bar"><span class="pill-gap"></span><h1>Your children</h1><button class="pill" data-act="logout">Log out</button></header>
    ${deviceBanner()}
    <p class="hint">Children log in at <b>${esc(appHost())}</b> with the username and password on their Forest Pass, or by scanning its QR code.</p>
    ${err()}
    ${family.length?`<ul class="kids">${rows}</ul>`:'<p class="lead">Add a child to make their Forest Pass.</p>'}
    <form class="add" data-form="addChild" novalidate><label for="nm" class="vh">Child's first name or nickname</label>
      <input id="nm" name="name" maxlength="20" placeholder="First name or nickname" autocomplete="off" enterkeyhint="done">
      <button ${busy?'disabled':''}>Add</button></form>
    <h2>Classes</h2>
    <p class="hint small">For schools: pupils log in on class devices by tapping their name and three pictures.</p>
    ${classRows?`<ul class="menu class-list">${classRows}</ul>`:''}
    <form class="add" data-form="addClass" novalidate><label for="cn" class="vh">Class name</label>
      <input id="cn" name="name" maxlength="30" placeholder="Class name, e.g. Oak class" autocomplete="off" enterkeyhint="done">
      <button ${busy?'disabled':''}>Add</button></form>
    <p class="hint small">Signed in as ${esc(me.email||'')}</p>
    <p class="ver">Version ${esc(VERSION)}</p>
  </main>`;
}
function renderClassAdmin(){
  const k=classes.find(x=>x.id===openClass);if(!k)return go('parent');
  const pupils=kids.filter(c=>c.classId===k.id);
  const armedFor=(id,act)=>armed&&armed.id===id&&armed.act===act;
  const rows=pupils.map(c=>{const a=armed&&armed.id===c.id?armed.act:null;
    return `<li class="kid"><div class="kid-hd"><span class="pname">${esc(c.name)}</span><span class="pics-row">${picsHtml(c.pics)}</span></div>
      <p class="pmeta">${esc(c.username)} · ${kidMeta(c)}</p><div class="kid-acts">${kidActions(c,a)}</div></li>`}).join('');
  app.innerHTML=`<main class="screen scroll">
    <header class="bar">${back('parent')}<h1>${esc(k.name)}</h1><span class="icon-gap"></span></header>
    ${err()}
    <div class="stack">
      ${pupils.length?`<button class="cta" data-act="class-cards" data-id="${k.id}">${armedFor(k.id,'class-cards')?'Tap again: new cards for everyone (old QR codes stop working)':'Print login cards'}</button>`:''}
      <button class="cta quiet" data-act="class-device" data-id="${k.id}">${armedFor(k.id,'class-device')?'Tap again: this device becomes a class device and you\'ll be logged out':'Use this device for '+esc(k.name)}</button>
    </div>
    <p class="hint small">${k.devices?`${k.devices} ${k.devices===1?'device is':'devices are'} set up for this class. <button class="link inline" data-act="class-signout" data-id="${k.id}">${armedFor(k.id,'class-signout')?'Tap again to sign them all out':'Sign out all class devices'}</button>`:'No devices are set up for this class yet.'}</p>
    <h2>Pupils</h2>
    ${pupils.length?`<ul class="kids">${rows}</ul>`:'<p class="lead">Add the class\'s first names below.</p>'}
    <form class="form" data-form="addPupils" data-id="${k.id}" novalidate>
      <label>Add pupils<textarea name="names" rows="5" placeholder="One first name or nickname per line"></textarea>
        <span class="field-hint">Use first names or initials only. If two pupils share a name, add a surname initial, like "Bob A" and "Bob B". Each pupil gets three pictures and a QR code.</span></label>
      <button class="cta" ${busy?'disabled':''}>Add pupils</button>
    </form>
    <button class="link danger ${armedFor(k.id,'class-delete')?'armed':''}" data-act="class-delete" data-id="${k.id}">${armedFor(k.id,'class-delete')?`Tap again to delete ${esc(k.name)} and all ${pupils.length} pupils' data. This can't be undone.`:'Delete this class and all its pupils'}</button>
  </main>`;
}
function renderClassCards(){
  const k=classes.find(x=>x.id===openClass);
  app.innerHTML=`<main class="screen scroll cards-page">
    <header class="bar no-print">${back('classAdmin')}<h1>Login cards</h1><span class="icon-gap"></span></header>
    <p class="hint no-print">Print these and cut them out. In class: tap your name, then your three pictures in order. At home: scan the QR code. ${standalone()?'To print, open the site in a browser on a computer.':''}</p>
    <div class="stack no-print"><button class="cta" data-act="print-cards">Print</button></div>
    <div class="class-cards">${classCards.map(c=>`<article class="lcard">
      <div class="lcard-hd">${tree(5)}<div><p class="pass-label">${esc(k?k.name:'')}</p><p class="pass-name">${esc(c.name)}</p></div></div>
      <div class="lcard-body"><div><p class="pmeta">My pictures</p><p class="pics-row big">${picsHtml(c.pics)}</p>
        <p class="pmeta">Username: <b>${esc(c.username)}</b></p></div>
        <figure class="lcard-qr"><div data-qr="${esc(c.qr)}"></div><figcaption>Scan to log in</figcaption></figure></div>
    </article>`).join('')}</div>
  </main>`;
  for(const el of app.querySelectorAll('[data-qr]'))makeQr(el.dataset.qr).then(q=>{el.innerHTML=q.createSvgTag({cellSize:3,margin:2,scalable:true})}).catch(()=>{});
}
function renderClassPick(){
  const c={className:classInfo?.device?.className||classDev?.className||'',pupils:classInfo?.pupils||[]};
  app.innerHTML=`<main class="screen scroll">
    <header class="brand">${tree(5)}<h1>${esc(c.className)}</h1></header>
    <p class="lead">Tap your name.</p>
    ${err()}
    <div class="name-grid">${c.pupils.map((p,i)=>`<button class="name-tile" data-act="pick-pupil" data-id="${p.id}" style="--tile:var(--t${i%6})">${esc(p.name)}</button>`).join('')}</div>
    ${c.pupils.length?'':'<p class="hint">No pupils in this class yet. A grown-up can add them.</p>'}
    <div class="class-foot">${canScan()?'<button class="link" data-act="scan">📷 Scan a card</button>':''}<button class="link" data-act="go" data-to="grownup">Grown-ups</button></div>
  </main>`;
}
function renderClassPics(){
  app.innerHTML=`<main class="screen scroll">
    <header class="bar">${back('classPick','Not me')}<h1>Hi ${esc(pupil.name)}!</h1><span class="icon-gap"></span></header>
    <p class="lead center">Tap your 3 pictures in order.</p>
    <div class="pic-slots" id="slots" aria-live="polite">${[0,1,2].map(i=>`<span class="slot">${picks[i]!==undefined?PICS[picks[i]][0]:''}</span>`).join('')}</div>
    <p class="err center" role="alert">${esc(picMsg)}</p>
    <div class="pic-grid">${PICS.map(([e,n],i)=>`<button class="pic-key" data-act="pic" data-i="${i}" aria-label="${n}">${e}</button>`).join('')}</div>
    <div class="stack"><button class="cta quiet" data-act="pic-undo" ${picks.length?'':'disabled'}>⌫ Undo</button></div>
  </main>`;
}
async function pickPic(i){
  if(picks.length>=3||busy)return;
  picks.push(i);picMsg='';render();
  if(picks.length<3)return;
  busy=true;
  try{await api('/class/login',{child:pupil.id,pics:picks});busy=false;me={role:'child'};picks=[];return enterChild()}
  catch(e){
    busy=false;picks=[];
    picMsg=e.status===429?'Too many tries. Ask your teacher for help.':e.status===401?'Not quite. Try again.':e.message;
    render();document.getElementById('slots')?.classList.add('shake');
  }
}
async function enterClass(){
  try{classInfo=await api('/class')}catch(e){classInfo=null}
  if(!classInfo?.device){classDev=null;return go('welcome')}
  classDev=classInfo.device;picks=[];pupil=null;go('classPick');
}
function renameSheet(id){
  const c=kids.find(k=>k.id===id);if(!c)return;
  const bg=sheet(`<h2>Rename ${esc(c.name)}</h2>
    <form class="form" id="renameForm" novalidate><label>Name<input id="renameName" name="name" maxlength="20" value="${esc(c.name)}" autocomplete="off"></label>
      <span class="field-hint">${c.classId?'Names in a class must be different, e.g. "Bob A" and "Bob B". ':''}Progress, pictures and QR code stay the same.</span>
      <p class="err" id="renameErr" role="alert"></p><button class="cta">Save</button></form>`);
  bg.querySelector('#renameForm').addEventListener('submit',async e=>{
    e.preventDefault();
    try{await api(`/parent/children/${id}/name`,{name:bg.querySelector('#renameName').value});bg.remove();await loadParent();render()}
    catch(err){bg.querySelector('#renameErr').textContent=err.message}
  });
}
async function classAction(act,id){
  if(!armed||armed.id!==id||armed.act!==act){armed={id,act};return render()}
  armed=null;
  try{
    if(act==='class-device'){const r=await api(`/parent/classes/${id}/device`,{});classDev=r.device;me={role:null};kids=[];classes=[];return enterClass()}
    if(act==='class-signout'){await api(`/parent/classes/${id}/devices/signout`,{});await loadParent();if(classDev?.classId===id)classDev=null;return render()}
    if(act==='class-delete'){await api(`/parent/classes/${id}`,{},'DELETE');await loadParent();return go('parent')}
    if(act==='class-cards'){
      const pupils=kids.filter(c=>c.classId===id);
      classCards=[];
      for(const c of pupils){const r=await api(`/parent/children/${c.id}/qr`,{});classCards.push({...r.card,pics:c.pics})}
      return go('classCards');
    }
  }catch(e){flash=e.message;render()}
}

function ago(t){const d=Math.round((today()-new Date(t).setHours(0,0,0,0))/864e5);return d<=0?'today':d===1?'yesterday':`${d} days ago`}

/* QR login: the Forest Pass carries a QR code of a link with the child's login key.
   The two small libraries load only when a card or the scanner is shown. */
const QRGEN_SRC='/app/js/vendor/qrcode-generator-1.5.2.min.js', JSQR_SRC='/app/js/vendor/jsqr-1.4.0.min.js';
const scripts={};
function loadScript(src){
  return scripts[src]??=new Promise((ok,no)=>{
    const el=document.createElement('script');el.src=src;el.onload=ok;
    el.onerror=()=>{delete scripts[src];el.remove();no(new Error("Couldn't load. Check the internet connection."))};
    document.head.appendChild(el);
  });
}
const qrLink=t=>`${location.origin}/app/#qr=${t}`;
const appHost=()=>location.host+'/app';   // the address printed on cards
async function makeQr(t){await loadScript(QRGEN_SRC);const q=qrcode(0,'M');q.addData(qrLink(t));q.make();return q}
// accepts a scanned link or a bare key
const qrKey=s=>{const m=/[#?&]qr=([A-Za-z0-9_-]{30,60})/.exec(s||'')||/^([A-Za-z0-9_-]{30,60})$/.exec(s||'');return m?m[1]:null};
async function qrLogin(key){
  stopScan();
  try{await api('/child/qr',{key});me={role:'child'};return enterChild()}
  catch(e){go('childLogin');flash=e.status===0?e.message:"That QR code didn't work. Ask a grown-up for a new Forest Pass.";render()}
}

// a card scanned while the app is already open only changes the #part of the address
window.addEventListener('hashchange',()=>{
  const k=qrKey(location.hash);if(!k)return;
  history.replaceState(null,'',location.pathname+location.search);
  if(round)clearTimeout(round.timer);round=null;
  flush().finally(()=>qrLogin(k));
});

/* scanner: the device camera, read a few times a second until a Forest Pass QR code is found */
let scan=null;
const canScan=()=>!!navigator.mediaDevices?.getUserMedia;
async function startScan(){
  go('scan');
  try{
    const [stream]=await Promise.all([navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false}),loadScript(JSQR_SRC)]);
    const video=document.getElementById('scanVideo');
    if(view!=='scan'||!video){stream.getTracks().forEach(t=>t.stop());return}
    scan={stream,video,canvas:document.createElement('canvas'),timer:0};
    video.srcObject=stream;await video.play();
    scanTick();
  }catch(e){
    stopScan();go('childLogin');
    flash=e.name==='NotAllowedError'?'The camera isn\'t allowed. Type your username and password instead.':e.name==='NotFoundError'?'No camera found. Type your username and password instead.':e.message;
    render();
  }
}
function scanTick(){
  if(!scan)return;
  const {video,canvas}=scan;
  if(video.readyState>=2&&video.videoWidth){
    const k=Math.min(1,640/Math.max(video.videoWidth,video.videoHeight));
    canvas.width=Math.round(video.videoWidth*k);canvas.height=Math.round(video.videoHeight*k);
    const g=canvas.getContext('2d',{willReadFrequently:true});g.drawImage(video,0,0,canvas.width,canvas.height);
    const img=g.getImageData(0,0,canvas.width,canvas.height);
    const found=jsQR(img.data,img.width,img.height,{inversionAttempts:'dontInvert'});
    const key=found&&qrKey(found.data);
    if(key)return qrLogin(key);
  }
  scan.timer=setTimeout(scanTick,150);
}
function stopScan(){if(!scan)return;clearTimeout(scan.timer);scan.stream.getTracks().forEach(t=>t.stop());scan=null}
function renderScan(){
  app.innerHTML=`<main class="screen scroll">
    <header class="bar">${back('childLogin')}<h1>Scan your card</h1><span class="icon-gap"></span></header>
    <div class="scanbox"><video id="scanVideo" muted playsinline autoplay></video><div class="scanframe" aria-hidden="true"></div></div>
    <p class="lead center">Hold your Forest Pass up so the square code fits inside the frame.</p>
  </main>`;
}

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
  text(c.name,275,222,64,600,INK,c.qr?380:640);
  if(c.qr){
    const q=await makeQr(c.qr).catch(()=>null);
    if(q){
      const n=q.getModuleCount(),size=230,cell=size/(n+4),x0=W-110-size,y0=78;
      g.fillStyle='#fff';g.fillRect(x0,y0,size,size);g.fillStyle='#000';
      for(let r=0;r<n;r++)for(let col=0;col<n;col++)if(q.isDark(r,col))g.fillRect(x0+(col+2)*cell,y0+(r+2)*cell,Math.ceil(cell),Math.ceil(cell));
      g.textAlign='center';text('Scan to log in',x0+size/2,y0+size+30,26,400,MUTED);g.textAlign='left';
    }
  }
  const rows=c.password?[['Website',appHost(),44],['Username',c.username,60],['Password',c.password,60],['Recovery code',c.recovery,60]]
    :[['Website',appHost(),44],['Username',c.username,60],['Password','Same as before',44]];
  rows.forEach(([label,value,size],i)=>{const top=380+i*165;text(label,110,top,34,400,MUTED);text(value,110,top+70,size,600,INK,780)});
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
    <p class="lead">${c.password?"Write this down or print it now. The password can't be shown again.":'Print or save this card. The QR code on the old card no longer works.'}</p>
    <section class="pass" id="pass">
      <div class="pass-hd">${tree(5)}<div class="pass-who"><p class="pass-label">Forest Pass</p><p class="pass-name">${esc(c.name)}</p></div>
        ${c.qr?'<figure class="pass-qr"><div id="passQr" role="img" aria-label="QR code to log in"></div><figcaption>Scan to log in</figcaption></figure>':''}</div>
      <dl>
        <dt>Website</dt><dd>${esc(appHost())}</dd>
        <dt>Username</dt><dd class="cred">${esc(c.username)}</dd>
        ${c.password?`<dt>Password</dt><dd class="cred">${esc(c.password)}</dd>
        <dt>Recovery code</dt><dd class="cred">${esc(c.recovery)}</dd>`:'<dt>Password</dt><dd>Same as before</dd>'}
      </dl>
      <ul class="pass-rules">
        <li>Keep this card safe at home.</li>
        <li>Never tell a friend your password.</li>
        <li>Lost your password? Use the recovery code.</li>
      </ul>
    </section>
    <div class="stack">
      <button class="cta quiet" data-act="print">Print or save card</button>
      <label class="check"><input type="checkbox" id="wrote"> ${!c.password?"We've printed or saved it.":cardFor==='parent'?"We've written it down or printed it.":"I've written it down."}</label>
      <button class="cta" data-act="card-done" id="cardDone" disabled>${cardFor==='parent'?'Done':'Go to my forest'}</button>
    </div>
  </main>`;
  document.getElementById('wrote').addEventListener('change',e=>{document.getElementById('cardDone').disabled=!e.target.checked});
  cardFile=null;const forCard=c;drawCard(c).then(f=>{if(card===forCard)cardFile=f}).catch(()=>{});
  if(c.qr)makeQr(c.qr).then(q=>{const el=document.getElementById('passQr');if(el&&card===forCard)el.innerHTML=q.createSvgTag({cellSize:4,margin:2,scalable:true})}).catch(()=>{});
}

function renderAssessPick(){
  app.innerHTML=`<main class="screen scroll">
    <header class="bar">${back('hub','All modules')}<h1>Hello ${esc(kid.name)}</h1><span class="icon-gap"></span></header>
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

// The pupil's home: pick a module. Modules with a login live in this app; the others are web pages.
function renderHub(){
  const p=kid,planted=ALL.filter(k=>fact(p,k).box>0).length;
  app.innerHTML=`<main class="screen scroll">
    <header class="bar start"><h1>Hi ${esc(p.name)}</h1>${classDev?'<button class="pill" data-act="logout">I\'m done</button>':''}<button class="icon" data-act="settings" aria-label="Settings">${cogIcon}</button></header>
    ${installBanner()}
    <p class="lead">What would you like to learn?</p>
    <div class="mods">
      <button class="mod" data-act="mod-tables"><span class="emo" aria-hidden="true">✖️</span><span><b>Grow your times tables</b><small>${p.assessedAt?`${planted} of 66 trees planted`:'Start with a quick check'}</small></span></button>
      <a class="mod" href="/app/trees/"><span class="emo" aria-hidden="true">🌳</span><span><b>How does a tree work?</b><small>121 questions and 19 diagrams to play with</small></span></a>
      <div class="mod soon" aria-disabled="true"><span class="emo" aria-hidden="true">🪱</span><span><b>What is soil?</b><small>Coming soon</small></span></div>
    </div>
  </main>`;
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
  const next=nextTable(p),trees=ALL.filter(k=>fact(p,k).box>=4).length,friends=p.extra.friends||[];
  const restRecent=p.extra.restDay&&today()-p.extra.restDay<7*864e5;
  const mock=mockReady(p)?'<button class="cta quiet" data-act="mock-intro">📝 Practice check</button>'
    :!next?`<p class="hint small center">The practice check opens when ${MOCK_TREES} trees have grown. You have ${trees}.</p>`:'';
  app.innerHTML=`<main class="screen scroll">
    <header class="bar start">${back('hub','All modules')}<h1>${esc(p.name)}'s forest</h1>${classDev?'<button class="pill" data-act="logout">I\'m done</button>':''}<button class="icon" data-act="settings" aria-label="Settings">${cogIcon}</button></header>
    ${installBanner()}
    ${needLogin?'<p class="warn">Your login has run out. <button class="link inline" data-act="logout">Log in again</button> to save your answers.</p>'
      :offline?'<p class="warn">You\'re offline. You can still play, and your answers will save when you\'re back online.</p>'
      :unsaved?'<p class="warn">Some answers haven\'t saved yet. They\'ll save when the internet is back.</p>':''}
    <section class="today"><p class="status">${status}</p>
      <p class="streak">${p.streak>1?`${p.streak} days in a row${restRecent?' · rest day used this week':''}`:'Play a little every day to keep the forest growing.'}</p>
      <div class="stack tight"><button class="cta" data-act="play">${label}</button>${mock}</div></section>
    <section class="forest" aria-label="Times table forest">${g}</section>
    <div class="legend">${[1,2,3,4,5].map(s=>`<span>${tree(s)}${STAGES[s]}</span>`).join('')}</div>
    <section class="friends" aria-labelledby="ff"><h2 id="ff">Forest friends</h2>
      ${friends.length?`<ul>${friends.map(t=>`<li><span class="emo" aria-hidden="true">${FRIENDS[t][0]}</span>${friendName(t)}<small>${t}s</small></li>`).join('')}</ul>`
        :'<p class="hint small">Grow every tree in a times table into a Tree and a forest friend moves in.</p>'}</section>
    <p class="tables">Planted: the ${on.slice().sort((x,y)=>x-y).join(', ')} times tables.${next?` Next up: the ${next} times table.`:' Every table is planted.'}</p>
    <button class="link" data-act="bests">⏱ Personal bests</button>
  </main>`;
}

// The total shown is fixed when the round starts. Every new fact comes back once later in the round
// (asked again if right, corrected if wrong), so those slots are counted up front. Corrections for
// facts the child already had are "extra goes": they don't change the total.
const pendingIntro=p=>ORDER.find(t=>p.tables.includes(t)&&!(p.extra.intros||[]).includes(t));
function startRound(){
  const t=pendingIntro(kid);if(t!==undefined)return startTableIntro(t);
  const items=buildRound(kid);
  round={items,planned:items.length+items.filter(x=>x.isNew).length,i:0,input:'',mode:'ask',lock:false,res:{asked:0,right:0,quick:0,grown:0}};
  view='play';nextItem();
}
// A newly planted table starts with its strategy and three worked examples.
function startTableIntro(t){
  round={items:[2,3,4].map(n=>({k:key(t,n),example:true,a:t,b:n})),planned:3,i:0,input:'',mode:'ask',lock:false,tableIntro:t};
  view='play';nextItem();
}
function finishTableIntro(){
  kid.extra.intros=[...(kid.extra.intros||[]),round.tableIntro];saveMeta();round=null;startRound();
}
function startAssessment(){
  round={items:plan.map(x=>({...x})),planned:plan.length,i:0,input:'',mode:'ask',lock:false,assess:true,results:{}};
  view='play';nextItem();
}
function nextItem(){
  const r=round;
  if(r.i>=r.items.length)return r.mock?finishMock():r.tableIntro?finishTableIntro():r.assess?finishAssessment():finishRound();
  const it=r.items[r.i];
  if(!it.example){const [x,y]=parse(it.k);[it.a,it.b]=Math.random()<.5?[x,y]:[y,x]}
  // grown trees are sometimes asked the other ways round: 6 × ? = 42 or 42 ÷ 6
  it.shape='mul';
  if(!r.assess&&!r.mock&&!it.isNew&&!it.example&&fact(kid,it.k).box>=4){const x=Math.random();it.shape=x<1/3?'missing':x<2/3?'div':'mul'}
  r.input='';r.lock=false;r.mode='ask';
  if(it.example)startWalk('example');
  else if(it.isNew&&!it.seen)startWalk('intro');
  renderPlay();
  if(r.mode==='ask')askNow(it);
}
const answerOf=it=>it.shape==='mul'?it.a*it.b:it.b;
const qText=it=>it.shape==='missing'?`${it.a} × ? = ${it.a*it.b}`:it.shape==='div'?`${it.a*it.b} ÷ ${it.a}`:`${it.a} × ${it.b}`;
function askNow(it){
  const r=round;r.start=performance.now();
  if(r.mock)startMockClock();
}
function renderPlay(){
  syncWakeLock();
  const r=round,it=r.items[r.i],done=r.items.slice(0,r.i).filter(x=>!x.extra).length;
  const pct=Math.round(Math.min(1,done/r.planned)*100),count=it.extra?done:Math.min(done+1,r.planned);
  let stage;
  const walkDone=r.mode==='walk'&&r.walk.i>=r.walk.steps.length;
  const paused=r.mode==='pause';
  if(r.mode==='walk')stage=walkHtml(it);
  else if(paused)stage=`<p class="tag">Practice check</p><p class="pause-msg">Next question…</p>`;
  else stage=`${r.mock?'<p class="tag">Practice check</p><div class="clock" aria-hidden="true"><div class="clock-fill" id="clock"></div></div>'
      :r.assess?'<p class="tag">Starting check</p>':it.extra?'<p class="tag">Extra go</p>':''}<p class="q ${it.shape==='missing'?'long':''}">${qText(it)}</p><div class="ans" id="ans" aria-live="polite">${r.input}</div>
      <div id="msg"><p class="msg"></p></div>`;
  const keys=[1,2,3,4,5,6,7,8,9].map(n=>`<button class="key" data-key="${n}">${n}</button>`).join('')+
    `<button class="key" data-key="del" aria-label="Delete">⌫</button><button class="key" data-key="0">0</button><button class="key go" data-key="go">Go</button>`;
  app.innerHTML=`<main class="screen play">
    <header class="pbar"><button class="icon" data-act="quit" aria-label="Stop">×</button>
      <div class="track"><div class="fill" style="width:${pct}%"></div></div><span class="count">${count}/${r.planned}</span>
</header>
    <section class="stage">${stage}</section>
    <section class="pad ${walkDone||paused?'off':''}">${keys}</section></main>`;
}

/* Strategy walk-through: shown for a new seed ('intro') and after a wrong answer ('fix').
   One step at a time; a wrong step shows its answer and the child types it. */
function startWalk(kind){
  const it=round.items[round.i];round.mode='walk';round.input='';round.lock=false;
  round.walk={kind,steps:walkSteps(it.a,it.b,kind==='example'?round.tableIntro:undefined),i:0,reveal:false};
}
function walkHtml(it){
  const w=round.walk,cur=w.steps[w.i],done=!cur;
  const past=w.steps.slice(0,w.i).map(s=>`<li class="past"><span>${s.q} = <b>${s.ans}</b></span></li>`).join('');
  const now=cur?`<li class="now"><span class="say">${cur.say}</span>
      <span class="step-eq">${cur.q} = <span class="ans sm" id="ans" aria-live="polite">${round.input}</span></span>
      ${w.reveal?`<span class="reveal">It's ${cur.ans}. Type ${cur.ans}.</span>`:''}</li>`:'';
  const ex=w.kind==='example',last=round.i>=round.items.length-1;
  const tag=ex?`The ${round.tableIntro} times table`:w.kind==='intro'?`${tree(1)} New seed`:"Let's work it out";
  const btn=ex?(last?'Start my round':'Next example'):w.kind==='intro'?'Got it':'Carry on';
  return `<div class="walk">
    <p class="tag">${tag}</p>
    ${ex?`<p class="intro-line">${TABLE_INTROS[round.tableIntro]}</p>`:''}
    <p class="walk-q">${it.a} × ${it.b}${done?` = ${it.a*it.b}`:''}</p>
    <ol class="steps">${past}${now}</ol>
    ${done?`<button class="cta" data-act="walk-next">${btn}</button>`:''}</div>`;
}
function walkSubmit(){
  const r=round,w=r.walk,s=w.steps[w.i];
  if(Number(r.input)===s.ans){w.i++;w.reveal=false;r.input='';return renderPlay()}
  w.reveal=true;r.input='';renderPlay();
  const a=document.getElementById('ans');if(a)a.classList.add('wrong','shake');
}
function walkNext(){
  const r=round,it=r.items[r.i];
  if(r.walk.kind==='intro'){it.seen=true;r.mode='ask';r.walk=null;renderPlay();askNow(it)}
  else{r.i++;nextItem()}
}

function press(k){
  const r=round;if(!r||r.lock||(r.mode==='walk'&&r.walk.i>=r.walk.steps.length))return;
  if(k==='del')r.input=r.input.slice(0,-1);
  else if(k==='go')return r.mode==='walk'?(r.input&&walkSubmit()):submit();
  else if(r.input.length<3)r.input+=k;
  const a=document.getElementById('ans');if(a){a.textContent=r.input;a.classList.remove('wrong','shake')}
}
function requeue(item,gap){
  const r=round,later=r.items.slice(r.i+1);
  if(later.some(x=>x.k===item.k)){if(!item.extra)r.planned--;return}   // a counted slot that isn't needed
  r.items.splice(Math.min(r.items.length,r.i+1+gap),0,item);
}
const kindOf=it=>it.mock?'mock':it.assess?'assess':it.practice?'practice':it.reask?'reask':it.retry?'retry':it.isNew?'new':'review';
function submit(){
  const r=round,it=r.items[r.i];if(!r.input)return;
  const ansEl=document.getElementById('ans'),msg=document.getElementById('msg');
  const correct=Number(r.input)===answerOf(it);
  const ms=performance.now()-r.start;
  logAnswer({fact:it.k,a:it.a,b:it.b,given:Number(r.input),correct,ms:Math.min(Math.round(ms),36e5),kind:kindOf(it),shape:it.shape,at:Date.now()});
  if(r.mock)return mockAnswered(correct,Number(r.input));
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
    requeue({k:it.k,retry:true,extra:!it.isNew},3);   // a new fact's comeback slot is already counted
    r.lock=true;ansEl.classList.add('wrong','shake');
    msg.innerHTML='<p class="msg">Not quite.</p>';
    setTimeout(()=>{if(round!==r)return;startWalk('fix');renderPlay()},700);
  }
}
function finishRound(){
  const p=kid,t=today();
  if(p.lastDay!==t){
    // one missed day a week doesn't break the run
    const gap=Math.round((t-p.lastDay)/864e5),rest=p.extra.restDay;
    if(gap===1)p.streak++;
    else if(gap===2&&p.streak>0&&(!rest||t-rest>=7*864e5)){p.streak++;p.extra.restDay=addDays(t,-1)}
    else p.streak=1;
    p.lastDay=t;
  }
  summary={...round.res,unlocked:checkUnlock(p),friends:newFriends(p)};saveMeta();round=null;view='summary';render();
  flush().then(ok=>{if(!ok&&view==='summary')render()});
}
const tableGrown=(p,t)=>ALL.filter(k=>parse(k).includes(t)).every(k=>fact(p,k).box>=4);
function newFriends(p){
  const got=ORDER.filter(t=>!(p.extra.friends||[]).includes(t)&&tableGrown(p,t));
  p.extra.friends=[...(p.extra.friends||[]),...got];return got;
}

/* practice check: 25 questions, 6 seconds each, 3-second pause, no feedback until the end,
   like the real check. It doesn't change any trees. */
function mockReady(p){return p.tables.length===ORDER.length&&ALL.filter(k=>fact(p,k).box>=4).length>=MOCK_TREES}
function buildMock(){
  const pool=ALL.map(k=>({k,w:parse(k).some(n=>HEAVY.includes(n))?2:1})),items=[];
  while(items.length<MOCK_N){
    let x=Math.random()*pool.reduce((s,f)=>s+f.w,0),i=0;
    while((x-=pool[i].w)>0)i++;
    items.push({k:pool.splice(i,1)[0].k,mock:true});
  }
  return items;
}
function startMock(){
  round={items:buildMock(),planned:MOCK_N,i:0,input:'',mode:'ask',lock:false,mock:true,results:[]};
  view='play';nextItem();
}
function startMockClock(){
  const r=round;clearTimeout(r.timer);
  const el=document.getElementById('clock');
  if(el){el.style.animation='none';void el.offsetWidth;el.style.animation=`clock ${MOCK_MS}ms linear forwards`}
  r.timer=setTimeout(()=>{
    if(round!==r||r.mode!=='ask')return;
    const it=r.items[r.i];
    logAnswer({fact:it.k,a:it.a,b:it.b,given:null,correct:false,ms:MOCK_MS,kind:'mock',shape:'mul',at:Date.now()});
    mockAnswered(false,null);
  },MOCK_MS);
}
function mockAnswered(correct,given){
  const r=round,it=r.items[r.i];clearTimeout(r.timer);
  r.results.push({a:it.a,b:it.b,correct,given});
  if(r.i>=r.items.length-1)return finishMock();
  r.mode='pause';r.lock=true;renderPlay();
  r.timer=setTimeout(()=>{if(round===r){r.i++;nextItem()}},MOCK_PAUSE);
}
function finishMock(){
  const r=round,score=r.results.filter(x=>x.correct).length;
  kid.extra.mocks=[...(kid.extra.mocks||[]),{at:Date.now(),score}].slice(-10);saveMeta();
  mockResult={score,missed:r.results.filter(x=>!x.correct)};round=null;go('mockResult');flush();
}
function renderMockIntro(){
  app.innerHTML=`<main class="screen scroll"><div class="done">${tree(5,'big')}<h1>Practice check</h1>
    <p class="lead center">This is like the Year 4 Multiplication Tables Check.</p>
    <ul class="rules"><li><b>${MOCK_N}</b> questions</li><li><b>6 seconds</b> to answer each one</li><li>A short pause between questions</li><li>Your score comes at the end</li></ul>
    <p class="hint center">It's just practice. Your trees won't change.</p>
    <button class="cta" data-act="mock-start">Start</button>
    <button class="cta quiet" data-act="home">Not now</button></div></main>`;
}
function renderMockResult(){
  const s=mockResult;
  const msg=s.score===MOCK_N?'Every one right!':s.score>=20?'Brilliant work.':s.score>=13?'Good going. Keep growing your forest.':'Keep playing your daily rounds and try again soon.';
  app.innerHTML=`<main class="screen scroll"><div class="done">${tree(s.score>=20?5:4,'big')}<h1>${s.score} out of ${MOCK_N}</h1>
    <p class="lead center">${msg} The real check has no pass mark.</p>
    ${s.missed.length?`<h2 class="mini">To practise</h2><ul class="missed">${s.missed.map(m=>`<li><span>${m.a} × ${m.b} = <b>${m.a*m.b}</b></span><small>${m.given===null?'no answer':'you said '+m.given}</small></li>`).join('')}</ul>`:''}
    <button class="cta" data-act="home">Back to the forest</button></div></main>`;
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
    ${(s.friends||[]).map(t=>`<p class="friend-new"><span class="emo" aria-hidden="true">${FRIENDS[t][0]}</span> ${FRIENDS[t][1][0].toUpperCase()+FRIENDS[t][1].slice(1)} has moved into your forest! Every ${t}s tree has grown.</p>`).join('')}
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
    if(act==='season')return pickSeason(e.target.closest('[data-act]').dataset.s,bg);
    if(act==='how'){bg.remove();return howSheet()}
    if(act==='logout'){bg.remove();return logout()}
    if(act==='reminder-on')return setReminder(bg);
    if(act==='reminder-off')return clearReminder(bg);
    if(e.target===bg||act==='close'){bg.remove();maybeUpdate()}
  });
  document.body.appendChild(bg);bg.querySelector('[data-act=close]').focus();
  return bg;
}
// Daily reminders are hidden for now: setting them up is a grown-up's job, and where that lives is being rethought.
// The code and the reminders Worker stay; turn this on to show the setting again.
const SHOW_REMINDERS=false;
/* settings: the cog on the module screen and the forest screen. They apply to the whole app. Add new settings here as sections or menu rows. */
const cogIcon='<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
function settingsSheet(){
  const t=kid.theme||'auto';
  sheet(`<h2>Settings</h2>
    <section class="set"><h3>Forest season</h3>
      <div class="seasons" role="group" aria-label="Forest season">${SEASONS.map(([k,l])=>
        `<button data-act="season" data-s="${k}" aria-pressed="${t===k}">${l}</button>`).join('')}</div>
      <p class="hint small">Auto follows the time of year.</p></section>
    ${SHOW_REMINDERS?`<section class="set"><h3>Daily reminder</h3>${reminderHtml()}</section>`:''}
    <nav class="menu"><button class="menu-row" data-act="how"><span>How the times tables method works</span><span class="chev" aria-hidden="true">›</span></button>
      <button class="menu-row" data-act="logout"><span>Log out</span><span class="pmeta">${esc(kid.username)}</span></button></nav>`);
}
/* daily reminder: a push subscription for this device, sent by the reminders Worker */
const pushable=()=>'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
function reminderSaved(){try{const r=JSON.parse(LS.get('ttf-reminder'));return r&&r.kid===kid.id?r:null}catch(e){return null}}
function reminderHtml(){
  if(!pushable())return `<p class="hint small">${isIOS()&&!standalone()?'Install the app first, then reminders can be turned on here.':'This device can\'t show reminders.'}</p>`;
  if(Notification.permission==='denied')return '<p class="hint small">Notifications are switched off for this app in the device settings.</p>';
  const saved=reminderSaved();
  if(saved)return `<p class="rem-on">On, at ${esc(saved.time)} each day</p><button class="toggle" data-act="reminder-off">Turn off</button>`;
  return `<div class="rem"><label for="remTime" class="vh">Reminder time</label><input type="time" id="remTime" value="17:00">
    <button class="toggle" data-act="reminder-on">Turn on</button></div>
    <p class="hint small">Ask a grown-up to set this up. One reminder a day, only if you haven't played yet.</p><p class="err small" id="remErr"></p>`;
}
const b64uBytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
async function setReminder(bg){
  const time=bg.querySelector('#remTime')?.value||'17:00',errEl=bg.querySelector('#remErr');
  try{
    if(await Notification.requestPermission()!=='granted')throw new Error("Notifications weren't allowed.");
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64uBytes(VAPID_PUBLIC_KEY)});
    const j=sub.toJSON();
    await api('/child/reminder',{endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth,time,tz:Intl.DateTimeFormat().resolvedOptions().timeZone});
    LS.set('ttf-reminder',JSON.stringify({kid:kid.id,time}));
    bg.remove();settingsSheet();
  }catch(e){if(errEl)errEl.textContent=e.message||"Couldn't turn reminders on."}
}
async function clearReminder(bg){
  try{
    const sub=await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if(sub){await api('/child/reminder/off',{endpoint:sub.endpoint}).catch(()=>{});await sub.unsubscribe().catch(()=>{})}
  }catch(e){}
  LS.del('ttf-reminder');bg.remove();settingsSheet();
}

/* personal bests (child) and tricky facts (grown-up) */
const factText=k=>{const [a,b]=parse(k);return `${a} × ${b}`};
const secs=ms=>(ms/1000).toFixed(1)+' s';
async function bestsSheet(){
  const bg=sheet('<h2>Personal bests</h2><div id="bests"><p class="hint">Loading…</p></div>'),el=bg.querySelector('#bests');
  try{
    const s=await api('/child/stats');
    el.innerHTML=!s.quickest.length?'<p class="hint">Play a round this week to set your first bests.</p>':`
      <h3>Quickest this week</h3><ul class="bests">${s.quickest.map(q=>`<li><span>${factText(q.fact)}</span><b>${secs(q.ms)}</b></li>`).join('')}</ul>
      ${s.faster.length?`<h3>Getting faster</h3><ul class="bests">${s.faster.map(q=>`<li><span>${factText(q.fact)}</span><b>${secs(q.before)} → ${secs(q.after)}</b></li>`).join('')}</ul>`:''}
      <p class="hint small">${s.rightThisWeek} right answers in the last 7 days.</p>`;
  }catch(e){el.innerHTML=`<p class="hint">${e.status===0?'Personal bests need the internet.':esc(e.message)}</p>`}
}
async function trickySheet(id){
  const c=kids.find(k=>k.id===id);
  const bg=sheet(`<h2>${esc(c?c.name:'')}: tricky facts</h2><div id="tricky"><p class="hint">Loading…</p></div>`),el=bg.querySelector('#tricky');
  try{
    const t=await api(`/parent/children/${id}/tricky`);
    const pct=t.week.asked?Math.round(t.week.right/t.week.asked*100):0;
    el.innerHTML=`<p>${t.week.asked?`This week: ${t.week.asked} questions, ${pct}% right.`:'No questions answered this week.'}</p>
      ${t.facts.length?`<p class="hint small">Most often wrong, then slowest, over the last 30 days. Good ones to practise together.</p>
        <ul class="tricky">${t.facts.map(f=>`<li><span class="tf">${factText(f.fact)} = ${parse(f.fact)[0]*parse(f.fact)[1]}</span>
          <span class="pmeta">wrong ${f.wrong} of ${f.asked}${f.avgMs?` · usually ${secs(f.avgMs)}`:''} · ${STAGES[f.box]}</span></li>`).join('')}</ul>`
        :'<p class="hint">Nothing tricky in the last 30 days.</p>'}
      ${t.mocks.length?`<h3>Practice checks</h3><ul class="bests">${t.mocks.slice().reverse().map(m=>`<li><span>${new Date(m.at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span><b>${m.score} / ${MOCK_N}</b></li>`).join('')}</ul>`:''}`;
  }catch(e){el.innerHTML=`<p class="hint">${esc(e.message)}</p>`}
}

function pickSeason(s,bg){
  kid.theme=s;saveMeta();render();
  bg.querySelectorAll('[data-act=season]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.s===s)));
}

function cellSheet(a,b){
  const s=fact(kid,key(a,b)).box;
  sheet(`<p class="eq">${a} × ${b} = ${a*b}</p><p>${b} × ${a} is the same tree.</p><p class="hint">${hint(a,b)}</p><p>Stage: ${STAGES[s]}.</p>`);
}
// How the method works: one short card per idea, swiped through (or Back / Next), closable at any point
const HOW=[
  ['🌱','A starting check','Pick the tables you think you know, then answer a few questions on each. Only the ones you really know are planted.'],
  ['🧠','From memory','Every answer comes from memory. Pulling a fact out of memory is what makes it stick.'],
  ['📅','Spaced out','A right answer sends a fact away for longer: 1 day, 3 days, 7 days, then 21 days. Each check grows the tree. A wrong answer sends it back to a seed.'],
  ['🧩','Easy facts first','Tables open in this order: 10, 2, 5, 11, 3, 4, 9, 6, 8, 12, 7. New facts are worked out from ones you know, like "×9 is ×10 take away one".'],
  ['🔁','One tree, both ways','6 × 7 and 7 × 6 are the same tree. That turns 121 facts into 66.'],
  ['🛠️','Mistakes fixed straight away','Work it out step by step. It comes back three questions later.'],
  ['⏱️','Right first, then quick','No countdown. But a tree only grows past a sprout once you can answer in 6 seconds, like the Year 4 check.'],
  ['☀️','Little and often','About 20 questions, a few minutes a day. Missing one day a week doesn\'t break your run.'],
  ['➗','Every way round','Grown trees are also asked as 6 × ? = 42 or 42 ÷ 6.'],
  ['🦊','Friends and the practice check','Grow a whole table and a forest friend moves in. Grow most of the forest and a practice check opens.'],
];
function howSheet(){
  const bg=sheet(`<h2>How the method works</h2>
    <div class="how" tabindex="0" aria-label="How the method works, ${HOW.length} cards. Swipe or use the arrow keys.">${HOW.map(([e,t,x],i)=>
      `<section class="how-card" aria-label="${i+1} of ${HOW.length}"><span class="how-emo" aria-hidden="true">${e}</span><h3>${t}</h3><p>${x}</p></section>`).join('')}</div>
    <div class="how-nav"><button class="pill" data-how="-1">‹ Back</button><span class="how-dots" aria-hidden="true">${HOW.map(()=>'<i></i>').join('')}</span><button class="pill" data-how="1">Next ›</button></div>`);
  const track=bg.querySelector('.how'),dots=[...bg.querySelectorAll('.how-dots i')],[prev,next]=bg.querySelectorAll('[data-how]');
  const at=()=>Math.round(track.scrollLeft/track.clientWidth);
  const go=i=>track.scrollTo({left:i*track.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  const show=()=>{const i=at();dots.forEach((d,k)=>d.classList.toggle('on',k===i));prev.disabled=i===0;next.textContent=i===HOW.length-1?'Done':'Next ›'};
  track.addEventListener('scroll',show,{passive:true});
  prev.addEventListener('click',()=>go(at()-1));
  next.addEventListener('click',()=>{if(at()===HOW.length-1){bg.remove();maybeUpdate()}else go(at()+1)});
  track.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();go(at()+1)}else if(e.key==='ArrowLeft'){e.preventDefault();go(at()-1)}});
  show();
}

/* flows */
async function boot(){
  try{localStorage.removeItem('times-table-forest-v1')}catch(e){}   // progress from the old device-only version
  const linkKey=qrKey(location.hash);
  if(linkKey){history.replaceState(null,'',location.pathname+location.search);return qrLogin(linkKey)}   // opened from a scanned Forest Pass
  try{me=await api('/me')}catch(e){
    if(e.status===0&&readSnap()){me={role:'child'};return enterChild()}   // offline: open the last forest on this device
    me={role:null};flash=e.message;
  }
  classDev=me.device||null;
  if(me.role==='child')await enterChild();
  else if(me.role==='parent')await enterParent();
  else if(classDev)await enterClass();
  else{const f=flash;go('welcome');if(f){flash=f;render()}}
}
async function enterChild(){
  try{kid=await api('/child/state');offline=false}catch(e){
    const snap=readSnap();
    if(e.status===0&&snap?.kid){kid=snap.kid;offline=true}else return signedOut(e);
  }
  kid.extra=kid.extra||{};
  // a reminder set up before the app moved (to /app, /tables, then back to /app) belonged to an old service worker
  if(reminderSaved()&&pushable())navigator.serviceWorker.ready.then(r=>r.pushManager.getSubscription()).then(sub=>{if(!sub)LS.del('ttf-reminder')}).catch(()=>{});
  loadPending();
  // answers saved on this device but not yet on the server win over the server copy
  Object.assign(kid.facts,pending.facts);if(pending.meta)Object.assign(kid,pending.meta);
  kid.extra=kid.extra||{};
  if(!kid.extra.intros)kid.extra.intros=kid.assessedAt?kid.tables.slice():[];   // children from before table intros
  if(!kid.extra.friends)kid.extra.friends=[];
  storeSnap();
  if(hasPending()&&!offline)flush();
  picked=[];plan=[];go('hub');
}
async function loadParent(){const r=await api('/parent/children');kids=r.children;classes=r.classes||[]}
async function enterParent(){
  if(me.device!==undefined)classDev=me.device;
  try{await loadParent()}catch(e){return signedOut(e)}
  go(view==='classAdmin'&&classes.some(k=>k.id===openClass)?'classAdmin':'parent');
}
function signedOut(e){
  me={role:null};kid=null;offline=false;needLogin=false;
  if(classDev&&!e)return enterClass();   // shared class device: back to the name tiles
  go('welcome');if(e){flash=e.status===401?'':e.message;render()}
}

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
      case 'addClass':{
        if(!v('name'))return document.getElementById('cn').focus();
        const k=await api('/parent/classes',{name:v('name')});await loadParent();busy=false;openClass=k.id;return go('classAdmin');
      }
      case 'addPupils':{
        const names=(f.elements.names.value||'').split(/\n|,/).map(x=>x.trim()).filter(Boolean);
        if(!names.length)throw new Error('Type one first name per line.');
        const r=await api(`/parent/classes/${f.dataset.id}/pupils`,{names});await loadParent();busy=false;
        classCards=r.cards;return go('classCards');
      }
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
    if(act==='kid-qr'){const r=await api(`/parent/children/${id}/qr`,{});card=r.card;cardFor='parent';return go('card')}
    if(act==='kid-pics'){await api(`/parent/children/${id}/pics`,{});await loadParent();return render()}
    if(act==='kid-reassess')await api(`/parent/children/${id}/reassess`,{});
    if(act==='kid-remove')await api(`/parent/children/${id}`,{},'DELETE');
    await loadParent();render();
  }catch(e){flash=e.message;render()}
}

function logout(){
  flush().finally(()=>api('/logout',{}).catch(()=>{}).finally(()=>{LS.del('ttf-snap');kid=null;kids=[];signedOut()}));
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
  if(!act.startsWith('kid-')&&!act.startsWith('class-'))armed=null;
  switch(act){
    case 'go':go(b.dataset.to);break;
    case 'mode':grownupMode=b.dataset.mode;flash='';render();break;
    case 'how':howSheet();break;
    case 'settings':settingsSheet();break;
    case 'logout':logout();break;
    case 'play':startRound();break;
    case 'home':go('home');break;
    case 'mod-tables':go(kid.assessedAt?'home':'assessPick');break;
    case 'quit':if(round)clearTimeout(round.timer);round=null;go(kid.assessedAt?'home':'assessPick');break;
    case 'pw':e.preventDefault();togglePw(b);break;
    case 'mock-intro':go('mockIntro');break;
    case 'mock-start':startMock();break;
    case 'bests':bestsSheet();break;
    case 'tricky':trickySheet(+b.dataset.id);break;
    case 'walk-next':walkNext();break;
    case 'cell':cellSheet(+b.dataset.a,+b.dataset.b);break;
    case 'pick-t':{const t=+b.dataset.t;picked=picked.includes(t)?picked.filter(x=>x!==t):[...picked,t];plan=buildAssessment(picked);render();break}
    case 'assess-start':startAssessment();break;
    case 'assess-skip':assessResult=applyAssessment(kid,[],{});flush();go('assessResult');break;
    case 'print':printCard();break;
    case 'install':installSheet();break;
    case 'install-hide':LS.set('ttf-install-hide',String(Date.now()+14*864e5));render();break;
    case 'card-done':card=null;cardFile=null;if(cardFor==='child')enterChild();else enterParent();break;
    case 'kid-reset':case 'kid-reassess':case 'kid-remove':case 'kid-qr':case 'kid-pics':parentAction(act,+b.dataset.id);break;
    case 'open-class':openClass=+b.dataset.id;go('classAdmin');break;
    case 'rename':renameSheet(+b.dataset.id);break;
    case 'class-device':case 'class-signout':case 'class-delete':case 'class-cards':classAction(act,+b.dataset.id);break;
    case 'print-cards':window.print();break;
    case 'pick-pupil':pupil=classInfo.pupils.find(p=>p.id===+b.dataset.id);picks=[];picMsg='';go('classPics');break;
    case 'pic':pickPic(+b.dataset.i);break;
    case 'pic-undo':picks.pop();picMsg='';render();break;
    case 'leave-device':api('/parent/device/leave',{}).then(()=>{classDev=null;render()},e=>{flash=e.message;render()});break;
    case 'scan':startScan();break;
  }
});
document.addEventListener('keydown',e=>{
  if(view!=='play'||document.querySelector('.sheet-bg'))return;
  if(/^[0-9]$/.test(e.key))press(e.key);
  else if(e.key==='Backspace')press('del');
  else if(e.key==='Enter'){const next=document.querySelector('[data-act=walk-next]');if(next)next.click();else press('go')}
  else return;
  e.preventDefault();   // stop Enter also "clicking" whichever on-screen key has focus
});

render();
boot();
