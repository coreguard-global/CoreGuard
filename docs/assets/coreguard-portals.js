/* Presentation only: retain original guide content and public/private request behavior. */
(function(){
  var here=location.pathname.split('/').pop();
  if(here!=='DOCS.html'&&here!=='PARTNER.html')return;
  var src=document.currentScript.src,base=src.replace(/assets\/coreguard-portals\.js.*$/,'');
  var css=document.createElement('link');css.rel='stylesheet';css.href=base+'assets/coreguard-portals.css';document.head.appendChild(css);
  document.body.classList.add('cg-portal');
  var hero=document.querySelector('.hero .hg>div');
  if(hero){var mark=document.createElement('img');mark.src=base+'assets/cg-shield.png';mark.alt='CoreGuard shield';mark.className='portal-mark';hero.prepend(mark);var motto=document.createElement('p');motto.className='portal-motto';motto.textContent='VERIFY • PROTECT • EMPOWER';mark.after(motto);var heading=hero.querySelector('h1');if(heading)heading.innerHTML=here==='DOCS.html'?'CoreGuard<br><em>Developer Guide.</em>':'CoreGuard<br><em>Partner Program.</em>';}
  var REPO='https://github.com/coreguard-global/CoreGuard/blob/main/';
  function source(parent,path,label){if(!parent)return;var a=document.createElement('a');a.href=REPO+path;a.className='portal-source';a.textContent=label+' · .md ↗';a.target='_blank';a.rel='noreferrer';parent.appendChild(a);}
  var buttons=document.querySelector('.hero .btns');
  if(buttons){var sources=document.createElement('div');sources.className='portal-sources';buttons.after(sources);source(sources,here==='DOCS.html'?'docs/DEVELOPER-QUICKSTART.md':'docs/PARTNERSHIPS.md',here==='DOCS.html'?'Developer quickstart source':'Partnership record');source(sources,'docs/AGENT-COMMERCE-PARTNER-FUNDING-ONE-PAGER-2026-11-16.md','Agent Commerce brief');var next=document.createElement('a');next.href='https://coreguard-trust-and-defense.lovable.app/developments#issues';next.textContent='Upcoming projects ↗';sources.appendChild(next);}
  if(here==='DOCS.html'){
    var topics={start:['docs/DEVELOPER-QUICKSTART.md','Quickstart source'],products:['docs/PRODUCTS.md','Product catalog source'],verify:['docs/HOW-TO-EVALUATE.md','Evaluation source'],company:['docs/PARTNERSHIPS.md','Partnership source']};
    Object.keys(topics).forEach(function(id){var el=document.getElementById(id);if(el)source(el,topics[id][0],topics[id][1]);});
    document.querySelectorAll('.dc').forEach(function(el,i){var n=document.createElement('span');n.className='portal-number';n.textContent=String(i+1).padStart(2,'0')+' / COREGUARD';el.prepend(n);});
  }else{
    document.querySelectorAll('.g4 .c').forEach(function(el,i){var n=document.createElement('span');n.className='portal-number';n.textContent='0'+(i+1)+' / COLLABORATION';el.prepend(n);});
    source(document.querySelector('#apply .hg>div'),'docs/AGENT-COMMERCE-PILOT-PLAN-2026-11-16.md','Pilot plan source');
  }
})();
