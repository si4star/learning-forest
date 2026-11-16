// What is soil?: creatures hide at the edges of the sections. Tap one to meet it and count it as found.
(()=>{const lurks=[...document.querySelectorAll('.lurk')],found=new Set(),count=document.getElementById('found');
 const say=document.createElement('div');say.className='lurk-say';say.hidden=true;say.setAttribute('role','status');document.body.appendChild(say);
 let open=null;
 const close=()=>{say.hidden=true;open=null};
 function show(b){
  found.add(b.dataset.who);b.classList.add('found');b.setAttribute('aria-label',b.dataset.who);count.textContent=found.size;
  say.innerHTML='<b></b><span></span><small></small>';
  say.querySelector('b').textContent=b.dataset.who;say.querySelector('span').textContent=b.dataset.say;
  say.querySelector('small').textContent=found.size===lurks.length?`You found all ${lurks.length}!`:`Found ${found.size} of ${lurks.length}`;
  say.hidden=false;
  const r=b.getBoundingClientRect(),w=say.offsetWidth,m=8;
  const x=Math.max(m,Math.min(innerWidth-w-m,r.left+r.width/2-w/2));
  let y=r.bottom+8;if(y+say.offsetHeight>innerHeight-m)y=r.top-say.offsetHeight-8;
  say.style.left=(x+scrollX)+'px';say.style.top=(y+scrollY)+'px';open=b}
 lurks.forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();open===b?close():show(b)}));
 document.addEventListener('click',close);addEventListener('resize',close);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});

 // The torch: everything goes dark except a circle of light where you point (mouse) or touch (finger),
 // starting in the middle of the screen. Creatures caught in the beam light up.
 const dark=document.createElement('div');dark.className='torch-dark';dark.hidden=true;dark.setAttribute('aria-hidden','true');document.body.appendChild(dark);
 const btn=document.createElement('button');btn.type='button';btn.className='torch-btn';btn.setAttribute('aria-pressed','false');
 btn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 3h10l-2 6v11a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V9z" fill="currentColor"/><circle cx="12" cy="13" r="1.6" fill="#888"/></svg><span>Torch</span>';
 document.body.appendChild(btn);
 let on=false,tx=innerWidth/2,ty=innerHeight/2,raf=0;
 const R=100;   // how near the middle of the beam a creature has to be to light up
 function paint(){raf=0;dark.style.setProperty('--tx',tx+'px');dark.style.setProperty('--ty',ty+'px');
  lurks.forEach(b=>{const r=b.getBoundingClientRect();b.classList.toggle('lit',on&&Math.hypot(r.left+r.width/2-tx,r.top+r.height/2-ty)<R)})}
 const queue=()=>{if(on&&!raf)raf=requestAnimationFrame(paint)};
 const aim=(x,y)=>{tx=x;ty=y;queue()};
 addEventListener('pointermove',e=>aim(e.clientX,e.clientY),{passive:true});
 addEventListener('pointerdown',e=>aim(e.clientX,e.clientY),{passive:true});
 addEventListener('touchmove',e=>{const t=e.touches[0];if(t)aim(t.clientX,t.clientY)},{passive:true});
 addEventListener('scroll',queue,{passive:true});
 btn.addEventListener('click',e=>{e.stopPropagation();on=!on;btn.setAttribute('aria-pressed',String(on));dark.hidden=!on;
  if(on){tx=innerWidth/2;ty=innerHeight/2;paint()}else lurks.forEach(b=>b.classList.remove('lit'))});
})();
