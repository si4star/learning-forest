// How does a tree work? Page script, imported by scripts/import-trees.mjs.
// Analytics removed on this site; diagrams still call track(), which does nothing.
function track(){}
// hero
const tree=document.getElementById('hero-tree'),go=document.getElementById('go');
go.addEventListener('click',()=>{const on=tree.classList.toggle('on');track('diagram_used',{diagram:'hero',state:on?'on':'off'});go.setAttribute('aria-pressed',on);go.textContent=on?'Switch the tree off':'Switch the tree on'});
tree.querySelectorAll('.hot').forEach(h=>{const jump=()=>{const t=document.getElementById(h.dataset.go);t.scrollIntoView();t.querySelector('h2').setAttribute('tabindex','-1');t.querySelector('h2').focus({preventScroll:true})};
  h.addEventListener('click',jump);h.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();jump()}})});

// nav highlight
const nav=document.getElementById('nav'),links=[...nav.querySelectorAll('a')];
const seen=new Set();const io=new IntersectionObserver(es=>{es.forEach(en=>{if(en.isIntersecting){if(!seen.has(en.target.id)){seen.add(en.target.id);track('tree_section_reached',{section:en.target.id,sections_seen:seen.size})}links.forEach(l=>{const m=l.hash==='#'+en.target.id;l.setAttribute('aria-current',m?'true':'false');if(m)nav.scrollTo({left:l.offsetLeft-nav.clientWidth/2+l.clientWidth/2,behavior:'smooth'})})}})},{rootMargin:'-45% 0px -50% 0px'});
document.querySelectorAll('section.zone').forEach(s=>io.observe(s));

// generic state diagrams
document.querySelectorAll('.fig .ctl button[data-state]').forEach(b=>b.addEventListener('click',()=>{
  const f=b.closest('.fig'),s=b.dataset.state; f.dataset.state=s;
  f.querySelectorAll('.ctl button[data-state]').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));
  f.querySelectorAll('[data-show]').forEach(el=>{el.style.display=el.dataset.show.split(' ').includes(s)?'':'none'});
  f.querySelectorAll('[data-hl]').forEach(el=>el.classList.toggle('dim',s!=='all'&&!el.dataset.hl.split(' ').includes(s)));
  f.querySelector('.cap').textContent=b.dataset.say;
  track('diagram_used',{diagram:f.dataset.fig,state:s});
}));
const NS='http://www.w3.org/2000/svg';
function el(tag,attrs){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);return e}

// grow
(()=>{const f=document.getElementById('fig-grow');if(!f)return;let y=0;const MAX=6;
 const g=f.querySelector('#grow-tree'),rings=f.querySelector('#grow-rings'),cap=f.querySelector('.cap'),btn=f.querySelector('[data-act=grow]');
 function draw(){const s=.7+.1*y;g.setAttribute('transform',`translate(120 200) scale(${s}) translate(-120 -200)`);
  rings.replaceChildren();const n=y+1,R=14+11*(n-1);
  rings.appendChild(el('circle',{cx:300,cy:110,r:R+7,fill:'#5E3E27'}));
  for(let k=n-1;k>=0;k--)rings.appendChild(el('circle',{cx:300,cy:110,r:14+11*k,fill:k===n-1?'#EFD9AE':'#E6CC9C',stroke:k===n-1?'#F6C343':'#C9A676','stroke-width':k===n-1?3:1.5}));
  rings.appendChild(el('circle',{cx:300,cy:110,r:3,fill:'#4A2E1A'}));
  const rg=f.querySelector('#grow-roots');rg.replaceChildren();
  const L=34+13*y,w=3+y*.8,DEEP=244,rc='#C9A06A',tip=[];
  const add=d=>rg.appendChild(el('path',{d,fill:'none',stroke:rc,'stroke-width':w,'stroke-linecap':'round'}));
  [-1,1].forEach(k=>{
    add(`M120 202 C${120+k*L*.3} 206 ${120+k*L*.7} 210 ${120+k*L} 212`);tip.push([120+k*L,212]);
    const l2=L*.72;add(`M120 204 C${120+k*l2*.3} 214 ${120+k*l2*.7} 222 ${120+k*l2} 226`);tip.push([120+k*l2,226]);
    const sx=120+k*L*.5,sd=Math.min(DEEP-2,222+5*y);if(y>0){add(`M${sx} 209 L${sx+k*3} ${sd}`);tip.push([sx+k*3,sd])}
  });
  const cd=Math.min(DEEP-2,226+4*y);add(`M120 204 L120 ${cd}`);tip.push([120,cd]);
  tip.forEach(([x,yy])=>rg.appendChild(el('circle',{cx:x,cy:yy,r:5,fill:'#F6C343',stroke:'#8A6A10','stroke-width':1.5})));
  btn.disabled=y>=MAX;
  cap.textContent=y===0?'A young tree in its first year. The yellow dots are its growing tips. Its trunk slice has one ring.':
   `Year ${y+1}: the tips grew, so the tree is taller and wider, and its roots spread further sideways. They stay in the top 60 cm or so, where there’s air. The growing layer under the bark added ring number ${y+1}, shown in yellow, so the trunk is fatter.`+(y>=MAX?' That’s enough growing for now. Press Start again.':'')}
 f.querySelector('[data-act=grow]').addEventListener('click',()=>{if(y<MAX){y++;draw();track('diagram_used',{diagram:'grow',state:String(y+1)})}});
 f.querySelector('[data-act=reset]').addEventListener('click',()=>{y=0;draw();btn.focus()});
 draw()})();

// light
(()=>{const f=document.getElementById('fig-light');if(!f)return;const r=f.querySelector('#light-range'),cap=f.querySelector('.cap'),
 sun=f.querySelector('#light-sun'),beams=f.querySelector('#light-beams'),o2=f.querySelector('#light-o2'),fill=f.querySelector('#light-fill');
 function draw(){const L=+r.value,net=100*(1-Math.exp(-L/30))-12,h=Math.max(net,0)/88*104;
  sun.style.opacity=.15+.85*L/100;beams.style.opacity=L/100;o2.style.opacity=net>0?.3+.7*net/88:0;
  fill.setAttribute('height',Math.max(h,.1));fill.setAttribute('y',227-h);
  let t;if(L===0)t='Dark. No sugar is being made, and the leaf is still burning a little sugar for energy, so it’s using up its savings.';
  else if(L<=10)t='Dim light. The leaf makes only a little more sugar than it burns.';
  else if(L<60)t='More light, more sugar. The meter is climbing fast.';
  else t='Lots of light. The leaf is now making sugar as fast as it can, so extra sunshine hardly helps.';
  cap.textContent=t;r.setAttribute('aria-valuetext',L+' percent sunshine')}
 r.addEventListener('input',draw);r.addEventListener('change',()=>track('diagram_used',{diagram:f.dataset.fig,state:r.value}));draw()})();

// seasons
(()=>{const f=document.getElementById('fig-season');if(!f)return;
 const M=['January','February','March','April','May','June','July','August','September','October','November','December'];
 const S=['Bare branches. The buds are asleep and counting up cold days.','Still bare. Buds keep counting cold days so they don’t open too early.','Buds are swelling. They’ve had enough cold, and it’s warming up.','Budburst! Soft, bright new leaves unfold.','Leaves are fully out, making food as fast as they can.','The longest days. The tree is growing and filling its piggy bank.','Long, warm days. Busy growing and saving.','Growth slows down, and the tree starts making next year’s buds.','The nights are getting longer. The tree notices and gets ready for winter.','Leaves change colour as the tree takes the goodness back out of them.','Leaves fall. The buds are sealed up tight for winter.','Deep winter sleep.'];
 const C=[null,null,null,['#A8D66B',.8],['#4E9F46',1],['#3E8E41',1],['#3E8E41',1],['#3E8E41',1],['#5E9A3A',1],['#E08A2E',1],['#C8702A',.35],null];
 const r=f.querySelector('#season-range'),cap=f.querySelector('.cap'),crown=f.querySelector('#season-crown'),buds=f.querySelector('#season-buds'),fall=f.querySelector('#season-fall'),day=f.querySelector('#season-day');
 const fmt=h=>{let hh=Math.floor(h),mm=Math.round((h-hh)*60);if(mm===60){hh++;mm=0}return hh+' h'+(mm?' '+mm+' min':'')};
 function draw(){const m=+r.value,d=(m+.5)*30.4,rad=Math.PI/180,dec=23.44*Math.sin(2*Math.PI*(284+d)/365)*rad,lat=55*rad,cw=(Math.sin(-0.833*rad)-Math.sin(lat)*Math.sin(dec))/(Math.cos(lat)*Math.cos(dec)),h=2*Math.acos(Math.max(-1,Math.min(1,cw)))/rad/15;
  f.querySelector('#season-month').textContent=M[m];
  day.setAttribute('x',222+176*(12-h/2)/24);day.setAttribute('width',176*h/24);
  f.querySelector('#season-hours').textContent='Daylight: '+fmt(h);f.querySelector('#season-night').textContent='Night: '+fmt(24-h);
  const c=C[m];crown.style.display=c?'':'none';if(c){crown.setAttribute('fill',c[0]);crown.style.opacity=c[1]}
  buds.style.display=(m<=2||m>=10)?'':'none';buds.setAttribute('fill',m===2?'#D0503E':'#8A4A3A');
  fall.style.display=(m===9||m===10)?'':'none';
  cap.textContent=M[m]+': about '+fmt(h)+' of daylight. '+S[m];r.setAttribute('aria-valuetext',M[m])}
 r.addEventListener('input',draw);r.addEventListener('change',()=>track('diagram_used',{diagram:f.dataset.fig,state:r.value}));draw()})();

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
 if(on){light(chip);pressed=kw;if(!chip._t){chip._t=1;track('grown_up_word',{term:chip.querySelector('dfn').textContent})}showBubble(kw,chip)}else{chip.classList.remove('lit');pressed=null;hideBubble()}}
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

// scroll progress down the tree
const pb=document.getElementById('progress');
const setP=()=>{const h=document.documentElement.scrollHeight-innerHeight;pb.style.width=(h>0?Math.min(100,scrollY/h*100):0)+'%'};
addEventListener('scroll',setP,{passive:true});setP();


// back to top
(()=>{const b=document.getElementById('totop'),h1=document.getElementById('t'),cons=document.getElementById('consent');
 const upd=()=>{b.hidden=scrollY<innerHeight*1.2||(cons&&!cons.hidden)};
 addEventListener('scroll',upd,{passive:true});upd();
 if(cons)new MutationObserver(upd).observe(cons,{attributes:true,attributeFilter:['hidden']});
 b.addEventListener('click',()=>{track('back_to_top',{from_percent:Math.round(scrollY/(document.documentElement.scrollHeight-innerHeight)*100)});
  scrollTo({top:0});h1.setAttribute('tabindex','-1');h1.focus({preventScroll:true})});
})();
