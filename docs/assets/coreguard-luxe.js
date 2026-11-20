/* CoreGuard Luxe v3 — VERIFY • PROTECT • EMPOWER */
(function(){
  if(document.getElementById("cg-bar"))return;
  var s=document.currentScript&&document.currentScript.src,base=s?s.replace(/assets\/coreguard-luxe\.js.*$/,""):"/CoreGuard/";
  var SITE="https://coreguard-trust-and-defense.lovable.app",here=location.pathname.split("/").pop()||"index.html",A=base+"assets/";
  // Tab icon + phone icons = the real CoreGuard shield
  [].slice.call(document.querySelectorAll('link[rel~="icon"],link[rel="apple-touch-icon"]')).forEach(function(l){l.parentNode.removeChild(l);});
  [["icon","image/png","32x32","favicon-32.png"],["icon","image/png","512x512","icon-512.png"],["apple-touch-icon","image/png","180x180","apple-touch-icon.png"]].forEach(function(d){var l=document.createElement("link");l.rel=d[0];l.type=d[1];l.sizes=d[2];l.href=A+d[3];document.head.appendChild(l);});
  if(!document.querySelector('meta[name="theme-color"]')){var m=document.createElement("meta");m.name="theme-color";m.content="#0B0F14";document.head.appendChild(m);}
  if(document.title&&document.title.indexOf("CoreGuard")<0)document.title+=" · CoreGuard";
  var nav=[["Home","index.html"],["Products","PRODUCTS.html"],["Organization","ORGANIZATION.html"],["Investors","INVESTORS.html"],["Docs","DOCS.html"],["Quickstart","QUICKSTART.html"],["Playground","PLAYGROUND.html"],["Governance","GOVERNANCE-DASHBOARD.html"],["Brand","BRAND.html"]];
  var bar=document.createElement("header");bar.id="cg-bar";
  bar.innerHTML='<div class="in"><a class="logo" href="'+base+'index.html"><img src="'+A+'cg-shield.png" alt="CoreGuard shield"><span>CORE<b>GUARD</b><small>VERIFY • PROTECT • EMPOWER</small></span></a><button class="tg" aria-label="Menu">☰</button><nav>'+nav.map(function(n){return '<a href="'+base+n[1]+'"'+(here===n[1]?' class="on"':'')+'>'+n[0]+'</a>';}).join("")+'<a href="'+SITE+'/products">Dashboard ↗</a></nav><div class="cta"><a class="p" href="'+SITE+'/scf-46">SCF #46 Application</a><a class="s" href="'+SITE+'/partners">Become a partner</a></div></div>';
  bar.querySelector(".tg").onclick=function(){bar.classList.toggle("open");};
  var foot=document.createElement("footer");foot.id="cg-foot";
  foot.innerHTML='<div class="in"><div class="brandrow"><img src="'+A+'cg-shield.png" alt=""><div><b>CoreGuard</b> — More than security. It\'s trust.<div class="tl">VERIFY • PROTECT • EMPOWER</div></div></div><div><a href="'+SITE+'">Website</a><a href="'+SITE+'/products">Dashboard</a><a href="'+SITE+'/investors">Investors</a><a href="'+SITE+'/scf-46">SCF #46</a><a href="'+SITE+'/partners">Partners</a><a href="https://github.com/coreguard-global">GitHub</a></div><div class="copy">© '+new Date().getFullYear()+' CoreGuard · Open source · Evidence over narrative</div></div>';
  var prog=document.createElement("div");prog.id="cg-prog";
  function mount(){
    document.body.insertBefore(bar,document.body.firstChild);document.body.appendChild(foot);document.body.appendChild(prog);
    addEventListener("scroll",function(){var h=document.documentElement;prog.style.width=(h.scrollTop/((h.scrollHeight-h.clientHeight)||1)*100)+"%";},{passive:true});
    if("IntersectionObserver" in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target);}});},{threshold:.08});
      [].slice.call(document.querySelectorAll(".card,.tile,section,table,.panel")).forEach(function(el){if(el.getBoundingClientRect().top>innerHeight){el.classList.add("cg-rv");io.observe(el);}});}
  }
  document.body?mount():document.addEventListener("DOMContentLoaded",mount);
})();
