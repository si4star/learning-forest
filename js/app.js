const ORDER=[10,2,5,11,3,4,9,6,8,12,7];         // unlock order: anchors first, 7s last
const HINT_ORDER=[10,2,5,11,4,3,9,8,6,12,7];    // which factor gives the easiest strategy
const ROUND=20, SLOW=6000, QUICK=3000;
const INTERVAL_DAYS={2:1,3:3,4:7,5:21};
const STAGES=['Not planted','Seed','Sprout','Sapling','Tree','Great tree'];
const COLOURS=['#3F8F3A','#2E7DA6','#C2702E','#8A4FB0','#C44569','#5E7A22'];
const ALL=[];for(let a=2;a<=12;a++)for(let b=a;b<=12;b++)ALL.push(a+'x'+b);
const parse=k=>k.split('x').map(Number);
const key=(a,b)=>Math.min(a,b)+'x'+Math.max(a,b);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tree=(s,cls='')=>`<svg class="${cls}" aria-hidden="true"><use href="#t${s}"/></svg>`;

/* storage: per device */
const SKEY='times-table-forest-v1';
let store={players:[],current:null}, canSave=true;
try{const r=localStorage.getItem(SKEY);if(r)store=JSON.parse(r)}catch(e){canSave=false}
function save(){if(!canSave)return;try{localStorage.setItem(SKEY,JSON.stringify(store))}catch(e){canSave=false}}

function today(){const d=new Date();d.setHours(0,0,0,0);return d.getTime()}
function dueFor(box){if(box<=1)return Date.now();const d=new Date(today());d.setDate(d.getDate()+INTERVAL_DAYS[box]);return d.getTime()}
const player=()=>store.players.find(p=>p.id===store.current);
const fact=(p,k)=>p.facts[k]||{box:0,due:0};
const tablesOn=p=>ORDER.slice(0,p.unlocked);
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
  if(p.unlocked>=ORDER.length)return null;
  const un=ALL.filter(k=>isUnlocked(p,k));
  if(un.some(k=>fact(p,k).box===0))return null;
  if(un.filter(k=>fact(p,k).box>=2).length/un.length>=0.8){p.unlocked++;return ORDER[p.unlocked-1]}
  return null;
}

/* views */
const app=document.getElementById('app');
let view='players', round=null, summary=null, removeArmed=false;

function render(){
  if(!store.current||!player())view='players';
  ({players:renderPlayers,home:renderHome,play:renderPlay,summary:renderSummary})[view]();
}

function renderPlayers(){
  app.innerHTML=`<main class="screen scroll">
    <header class="brand">${tree(5)}<h1>Times Table Forest</h1></header>
    <p class="lead">Every times table fact is a tree. Get it right on the right day and it grows.</p>
    <h2>Who's playing?</h2>
    <div class="plist">${store.players.map(p=>`<button class="pbtn" data-act="pick" data-id="${p.id}" style="--pc:${p.colour}">
      <span class="pdot"></span><span class="pname">${esc(p.name)}</span><span class="pmeta">${planted(p)} of 66 planted</span></button>`).join('')}</div>
    <div class="add"><label for="nm" class="vh">Player name</label>
      <input id="nm" maxlength="16" placeholder="Add a player" autocomplete="off" enterkeyhint="done">
      <button data-act="add">Add</button></div>
    ${canSave?'':'<p class="warn">This browser blocks saving, so progress resets when the page closes.</p>'}
    <button class="link" data-act="how">How the method works</button>
  </main>`;
  document.getElementById('nm').addEventListener('keydown',e=>{if(e.key==='Enter')addPlayer()});
}
function addPlayer(){
  const el=document.getElementById('nm'),name=el.value.trim();if(!name)return el.focus();
  const p={id:Date.now().toString(36),name,colour:COLOURS[store.players.length%COLOURS.length],facts:{},unlocked:2,streak:0,lastDay:0};
  store.players.push(p);store.current=p.id;save();view='home';render();
}

function renderHome(){
  const p=player(),now=Date.now(),un=ALL.filter(k=>isUnlocked(p,k));
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
  const next=ORDER[p.unlocked];
  app.innerHTML=`<main class="screen scroll">
    <header class="bar"><button class="icon" data-act="players" aria-label="Change player">‹</button>
      <h1>${esc(p.name)}'s forest</h1><button class="icon" data-act="how" aria-label="How it works">?</button></header>
    <section class="today"><p class="status">${status}</p>
      <p class="streak">${p.streak>1?`${p.streak} days in a row`:'Play a little every day to keep the forest growing.'}</p>
      <button class="cta" data-act="play">${label}</button></section>
    <section class="forest" aria-label="Times table forest">${g}</section>
    <div class="legend">${[1,2,3,4,5].map(s=>`<span>${tree(s)}${STAGES[s]}</span>`).join('')}</div>
    <p class="tables">Planted: the ${on.slice().sort((x,y)=>x-y).join(', ')} times tables.${next?` Next up: the ${next} times table.`:' Every table is planted.'}</p>
    <button class="link danger ${removeArmed?'armed':''}" data-act="remove">${removeArmed?`Tap again to remove ${esc(p.name)} and their forest`:`Remove ${esc(p.name)}`}</button>
  </main>`;
}

function startRound(){
  const p=player();round={items:buildRound(p),i:0,input:'',mode:'ask',lock:false,res:{asked:0,right:0,quick:0,grown:0}};
  view='play';nextItem();
}
function nextItem(){
  const r=round;
  if(r.i>=r.items.length)return finishRound();
  const it=r.items[r.i];
  const [x,y]=parse(it.k);[it.a,it.b]=Math.random()<.5?[x,y]:[y,x];
  r.input='';r.lock=false;r.mode=(it.isNew&&!it.seen)?'intro':'ask';
  renderPlay();
  if(r.mode==='ask')r.start=performance.now();
}
function renderPlay(){
  const r=round,it=r.items[r.i],pct=Math.round(r.i/r.items.length*100);
  let stage;
  if(r.mode==='intro'){
    stage=`<div class="intro">${tree(1)}<p class="tag">New seed</p><p class="eq">${it.a} × ${it.b} = ${it.a*it.b}</p>
      <p class="hint">${hint(it.a,it.b)}</p><button class="cta" data-act="gotit">Got it</button></div>`;
  }else{
    stage=`<p class="q">${it.a} × ${it.b}</p><div class="ans" id="ans" aria-live="polite">${r.input}</div>
      <div id="msg">${r.mode==='fix'?fixHtml(it):'<p class="msg"></p>'}</div>`;
  }
  const keys=[1,2,3,4,5,6,7,8,9].map(n=>`<button class="key" data-key="${n}">${n}</button>`).join('')+
    `<button class="key" data-key="del" aria-label="Delete">⌫</button><button class="key" data-key="0">0</button><button class="key go" data-key="go">Go</button>`;
  app.innerHTML=`<main class="screen play">
    <header class="pbar"><button class="icon" data-act="quit" aria-label="Stop round">×</button>
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
function submit(){
  const r=round,it=r.items[r.i];if(!r.input)return;
  const ansEl=document.getElementById('ans'),msg=document.getElementById('msg');
  const correct=Number(r.input)===it.a*it.b;
  if(r.mode==='fix'){
    if(correct){r.i++;nextItem()}
    else{r.input='';ansEl.textContent='';ansEl.classList.remove('shake');void ansEl.offsetWidth;ansEl.classList.add('wrong','shake')}
    return;
  }
  const ms=performance.now()-r.start,p=player(),f={...fact(p,it.k)},before=f.box;
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
    p.facts[it.k]=f;save();
    r.lock=true;ansEl.classList.add('right');
    msg.innerHTML=`<p class="msg">${ms<=QUICK?'<span class="quick">Quick!</span>':f.box>before?'Growing':'Right'}</p>`;
    setTimeout(()=>{r.i++;nextItem()},ms<=QUICK?550:750);
  }else{
    f.box=1;f.due=Date.now();p.facts[it.k]=f;save();
    requeue({k:it.k,retry:true},3);
    r.mode='fix';r.input='';ansEl.textContent='';ansEl.classList.add('wrong','shake');
    msg.innerHTML=fixHtml(it);
  }
}
function finishRound(){
  const p=player(),t=today();
  if(p.lastDay!==t){p.streak=Math.round((t-p.lastDay)/864e5)===1?p.streak+1:1;p.lastDay=t}
  summary={...round.res,unlocked:checkUnlock(p)};save();round=null;view='summary';render();
}
function renderSummary(){
  const s=summary;
  app.innerHTML=`<main class="screen"><div class="done">${tree(s.grown?4:2,'big')}<h1>Round done</h1>
    <div class="stats"><span><b>${s.right}</b> of ${s.asked} right</span><span><b>${s.quick}</b> quick answers</span>
      <span><b>${s.grown}</b> ${s.grown===1?'tree':'trees'} grew</span></div>
    ${s.unlocked?`<p class="unlock">The ${s.unlocked} times table is now planted.</p>`:''}
    <button class="cta" data-act="home">Back to the forest</button>
    <button class="cta quiet" data-act="play">Play again</button></div></main>`;
}

/* sheets */
function sheet(html){
  const bg=document.createElement('div');bg.className='sheet-bg';
  bg.innerHTML=`<div class="sheet" role="dialog" aria-modal="true">${html}<button class="cta quiet" data-act="close">Close</button></div>`;
  bg.addEventListener('click',e=>{if(e.target===bg||e.target.dataset.act==='close')bg.remove()});
  document.body.appendChild(bg);bg.querySelector('[data-act=close]').focus();
}
function cellSheet(a,b){
  const s=fact(player(),key(a,b)).box;
  sheet(`<p class="eq">${a} × ${b} = ${a*b}</p><p>${b} × ${a} is the same tree.</p><p class="hint">${hint(a,b)}</p><p>Stage: ${STAGES[s]}.</p>`);
}
function howSheet(){
  sheet(`<h2>How the method works</h2><ol>
  <li>Recall, not reading. Every question is answered from memory. Pulling a fact out of memory is what makes it stick.</li>
  <li>Spaced repetition. A right answer sends the fact away for longer each time: same round, 1 day, 3 days, 7 days, then 21 days. Each check grows the tree a stage. A wrong answer sends it back to a seed.</li>
  <li>Easy facts first, hard facts built from them. Tables unlock in this order: 10, 2, 5, 11, 3, 4, 9, 6, 8, 12, 7. New seeds come with a strategy, like "×9 is ×10 take away one".</li>
  <li>6 × 7 and 7 × 6 are one tree. That turns 121 facts into 66.</li>
  <li>Mistakes are fixed straight away. The answer and strategy appear, the child types it, and it comes back three questions later.</li>
  <li>Accuracy first, then speed. There's no countdown. An answer slower than 6 seconds (the limit in the Year 4 Multiplication Tables Check) still counts, but the tree can't grow past a sprout until it comes quickly.</li>
  <li>Little and often. About 20 questions, a few minutes a day. A table unlocks when most planted trees have sprouted.</li></ol>
  <p class="hint">Progress is saved on this device only.</p>`);
}

/* events */
app.addEventListener('click',e=>{
  const kb=e.target.closest('[data-key]');if(kb)return press(kb.dataset.key);
  const b=e.target.closest('[data-act]');if(!b)return;
  const act=b.dataset.act;
  if(act!=='remove')removeArmed=false;
  switch(act){
    case 'pick':store.current=b.dataset.id;save();view='home';render();break;
    case 'add':addPlayer();break;
    case 'how':howSheet();break;
    case 'players':view='players';render();break;
    case 'play':startRound();break;
    case 'home':view='home';render();break;
    case 'quit':round=null;view='home';render();break;
    case 'gotit':round.items[round.i].seen=true;round.mode='ask';renderPlay();round.start=performance.now();break;
    case 'cell':cellSheet(+b.dataset.a,+b.dataset.b);break;
    case 'remove':
      if(!removeArmed){removeArmed=true;render()}
      else{store.players=store.players.filter(p=>p.id!==store.current);store.current=null;removeArmed=false;save();view='players';render()}
      break;
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

if(store.current&&player())view='home';
render();
