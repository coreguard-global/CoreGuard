/* Progressive enhancement: keep committed DDE engines, fixtures and bilingual controls intact. */
(function () {
  var file = location.pathname.split('/').pop();
  if (file !== 'DDE-SDK-REFERENCE.html' && file !== 'DDE-API-REFERENCE.html') return;
  var sdk = file === 'DDE-SDK-REFERENCE.html';
  var script = document.currentScript;
  var base = script ? script.src.replace(/assets\/coreguard-reference\.js.*$/, '') : '/CoreGuard/';
  var css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = base + 'assets/coreguard-reference.css'; document.head.appendChild(css);
  document.body.classList.add('cg-reference');
  var nav = document.querySelector('body > nav');
  if (nav) nav.classList.add('cg-ref-nav');
  var cover = document.querySelector('body > header.wrap');
  if (!cover) return;
  cover.classList.add('cg-ref-cover');
  var identity = document.createElement('div'); identity.className = 'cg-ref-identity';
  identity.innerHTML = '<img src="' + base + 'assets/cg-shield.png" alt="CoreGuard shield"><div><strong>CoreGuard</strong><span>VERIFY • PROTECT • EMPOWER</span></div>';
  var crumbs = document.createElement('div'); crumbs.className = 'cg-ref-breadcrumb';
  var actions = document.createElement('div'); actions.className = 'cg-ref-actions';
  var facts = document.createElement('div'); facts.className = 'cg-ref-facts';
  cover.insertBefore(crumbs, cover.firstChild); cover.insertBefore(identity, cover.firstChild);
  cover.appendChild(actions); cover.appendChild(facts);
  document.querySelectorAll('.card > table').forEach(function (table) { table.parentElement.classList.add('cg-ref-table'); });
  function update() {
    var ar = document.documentElement.lang === 'ar';
    crumbs.innerHTML = '<a href="' + base + 'DOCS.html">' + (ar ? 'التوثيق' : 'Documentation') + '</a><span>/</span><span>DDE / 1</span><span>/</span><span>' + (sdk ? 'SDK' : 'API') + '</span>';
    actions.innerHTML = '<a href="#playground">' + (ar ? 'جرّب المثال' : 'Run the example') + '<span aria-hidden="true">↓</span></a><a href="' + base + (sdk ? 'DDE-API-REFERENCE.html' : 'DDE-SDK-REFERENCE.html') + '">' + (ar ? 'افتح مرجع ' : 'Open ') + (sdk ? 'API' : 'SDK') + '<span aria-hidden="true">↗</span></a><a href="https://github.com/coreguard-global/CoreGuard/tree/main/packages/delivery" target="_blank" rel="noreferrer">' + (ar ? 'المصدر الأصلي' : 'View source') + '<span aria-hidden="true">↗</span></a>';
    var rows = sdk ? [['verifyFixture', ar ? 'فحص سلامة الأدلة' : 'Evidence integrity'], ['releaseWhen', ar ? 'بوابة إفراج مشروطة' : 'Predicate-based release'], ['HOLD / RELEASE / REFUSED', ar ? 'حالات واضحة، من غير استنتاج خفي' : 'Explicit gate states']] : [['POST /verify', ar ? 'فحص الأدلة' : 'Evidence verification'], ['POST /peoples-court', ar ? 'تصنيف الأدلة، مش حكم' : 'Evidence projection, not adjudication'], ['GET /health', ar ? 'حالة المحرك' : 'Engine health']];
    facts.innerHTML = rows.map(function (row) { return '<div><strong dir="ltr">' + row[0] + '</strong><span>' + row[1] + '</span></div>'; }).join('');
  }
  update();
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
})();
