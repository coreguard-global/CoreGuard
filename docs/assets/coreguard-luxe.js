(function(){
  if(document.getElementById("cg-bar"))return;
  var s=document.currentScript&&document.currentScript.src,base=s?s.replace(/assets\/coreguard-luxe\.js.*$/,""):"/CoreGuard/";
  var SITE="https://coreguard-trust-and-defense.lovable.app",here=location.pathname.split("/").pop()||"index.html";
  var nav=[["Home","index.html"],["Products","PRODUCTS.html"],["Quickstart","QUICKSTART.html"],["Playground","PLAYGROUND.html"],["Governance","GOVERNANCE-DASHBOARD.html"],["Brand","BRAND.html"]];
  var bar=document.createElement("header");bar.id="cg-bar";
  bar.innerHTML='<div class="in"><a class="logo" href="'+base+'index.html"><img src="'+base+'assets/favicon.svg" alt="CoreGuard shield"><span>COREGUARD<small>VERIFY • PROTECT • EMPOWER</small></span></a><button class="tg" aria-label="Menu">☰</button><nav>'+nav.map(function(n){return '<a href="'+base+n[1]+'"'+(here===n[1]?' class="on"':'')+'>'+n[0]+'</a>';}).join("")+'</nav><div class="cta"><a class="p" href="'+SITE+'/scf-46">SCF #46 Application</a><a class="s" href="'+SITE+'/partners">Become a partner</a></div></div>';
  bar.querySelector(".tg").onclick=function(){bar.classList.toggle("open");};
  var foot=document.createElement("footer");foot.id="cg-foot";
  foot.innerHTML='<div class="in"><div><b>CoreGuard</b> — More than security. It\'s trust.<div class="tl">VERIFY • PROTECT • EMPOWER</div></div><div><a href="'+SITE+'">Website</a><a href="'+SITE+'/products">Command Center</a><a href="'+SITE+'/investors">Investors</a><a href="'+SITE+'/scf-46">SCF #46</a><a href="'+SITE+'/partners">Partners</a><a href="https://github.com/coreguard-global">GitHub</a></div></div>';
  function mount(){document.body.insertBefore(bar,document.body.firstChild);document.body.appendChild(foot);}
  document.body?mount():document.addEventListener("DOMContentLoaded",mount);
})();
