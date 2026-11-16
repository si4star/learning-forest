// Explainer pages (How do fungi work?, What is soil?): section links, diagrams, grown-up words, progress and back to top.
// The same behaviour as How does a tree work? (public/trees/trees.js), without that page's own diagrams.

// section links: highlight the one you're reading
const nav=document.getElementById('nav'),links=[...nav.querySelectorAll('a')];
const io=new IntersectionObserver(es=>{es.forEach(en=>{if(en.isIntersecting){links.forEach(l=>{const m=l.hash==='#'+en.target.id;l.setAttribute('aria-current',m?'true':'false');if(m)nav.scrollTo({left:l.offsetLeft-nav.clientWidth/2+l.clientWidth/2,behavior:'smooth'})})}})},{rootMargin:'-45% 0px -50% 0px'});
document.querySelectorAll('section.zone').forEach(s=>io.observe(s));

// diagrams: each button shows its state
document.querySelectorAll('.fig .ctl button[data-state]').forEach(b=>b.addEventListener('click',()=>{
  const f=b.closest('.fig'),s=b.dataset.state; f.dataset.state=s;
  f.querySelectorAll('.ctl button[data-state]').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));
  f.querySelectorAll('[data-show]').forEach(el=>{el.style.display=el.dataset.show.split(' ').includes(s)?'':'none'});
  f.querySelectorAll('[data-hl]').forEach(el=>el.classList.toggle('dim',s!=='all'&&!el.dataset.hl.split(' ').includes(s)));
  f.querySelector('.cap').textContent=b.dataset.say;
}));

// grown-up words: tap the words in the text to light up the grown-up word
let pressed=null;
const bubble=document.createElement('div');bubble.className='bubble';bubble.setAttribute('aria-hidden','true');bubble.hidden=true;document.body.appendChild(bubble);
function showBubble(kw,chip){
 bubble.innerHTML='<mark></mark>';bubble.firstChild.textContent=chip.querySelector('dfn').textContent;bubble.hidden=false;
 bubble.classList.remove('pop','below');
 const r=kw.getClientRects()[0]||kw.getBoundingClientRect(),hdr=document.querySelector('.bar').getBoundingClientRect().bottom;
 const below=r.top-bubble.offsetHeight-14<hdr;bubble.classList.toggle('below',below);
 const w=bubble.offsetWidth,m=8;let x=r.left+r.width/2-w/2;x=Math.max(m,Math.min(innerWidth-w-m,x));
 const y=below?r.bottom+10:r.top-bubble.offsetHeight-10;
 bubble.style.left=(x+scrollX)+'px';bubble.style.top=(y+scrollY)+'px';
 bubble.style.setProperty('--ax',(r.left+r.width/2-x)+'px');
 void bubble.offsetWidth;bubble.classList.add('pop')}
function hideBubble(){bubble.hidden=true}
addEventListener('resize',()=>{if(pressed){pressed.setAttribute('aria-pressed','false');document.getElementById(pressed.dataset.gw).classList.remove('lit');pressed=null}hideBubble()});
function light(chip){chip.classList.remove('lit');void chip.offsetWidth;chip.classList.add('lit')}
function toggle(kw){const chip=document.getElementById(kw.dataset.gw);if(!chip)return;
 if(pressed&&pressed!==kw){pressed.setAttribute('aria-pressed','false');document.getElementById(pressed.dataset.gw).classList.remove('lit')}
 const on=kw.getAttribute('aria-pressed')!=='true';kw.setAttribute('aria-pressed',on?'true':'false');
 if(on){light(chip);pressed=kw;showBubble(kw,chip)}else{chip.classList.remove('lit');pressed=null;hideBubble()}}
document.querySelectorAll('.kw').forEach(kw=>{const chip=document.getElementById(kw.dataset.gw);
 // mouse: hover shows it, moving away hides it
 kw.addEventListener('pointerenter',ev=>{if(ev.pointerType==='mouse'&&kw.getAttribute('aria-pressed')!=='true')toggle(kw)});
 kw.addEventListener('pointerleave',ev=>{if(ev.pointerType==='mouse'&&kw.getAttribute('aria-pressed')==='true')toggle(kw)});
 // touch and pen: tap to toggle
 kw.addEventListener('pointerdown',ev=>{kw._pt=ev.pointerType});
 kw.addEventListener('click',()=>{if(kw._pt&&kw._pt!=='mouse')toggle(kw);kw._pt=null});
 // keyboard: focus shows it, Enter or Space toggles
 kw.addEventListener('focus',()=>{if(!kw._pt&&kw.matches(':focus-visible')&&kw.getAttribute('aria-pressed')!=='true')toggle(kw)});
 kw.addEventListener('blur',()=>{if(kw.getAttribute('aria-pressed')==='true'&&kw._pt!=='touch')toggle(kw)});
 kw.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();toggle(kw)}else if(ev.key==='Escape'&&kw.getAttribute('aria-pressed')==='true')toggle(kw)});
 chip.addEventListener('mouseenter',()=>kw.classList.add('hint'));chip.addEventListener('mouseleave',()=>kw.classList.remove('hint'));
});

// scroll progress down the page
const pb=document.getElementById('progress');
const setP=()=>{const h=document.documentElement.scrollHeight-innerHeight;pb.style.width=(h>0?Math.min(100,scrollY/h*100):0)+'%'};
addEventListener('scroll',setP,{passive:true});setP();

// back to top
(()=>{const b=document.getElementById('totop'),h1=document.getElementById('t');
 const upd=()=>{b.hidden=scrollY<innerHeight*1.2};
 addEventListener('scroll',upd,{passive:true});upd();
 b.addEventListener('click',()=>{scrollTo({top:0});h1.setAttribute('tabindex','-1');h1.focus({preventScroll:true})});
})();
