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
})();
