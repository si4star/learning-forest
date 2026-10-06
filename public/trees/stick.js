// How does a tree work?: the site header and the page's section bar stick to the top together
// (.lf-stick). Its height goes in --stick-h so the sticky section headings sit just below it.
(function () {
  var s = document.querySelector('.lf-stick');
  if (!s) return;
  var set = function () { document.documentElement.style.setProperty('--stick-h', s.offsetHeight + 'px'); };
  set();
  addEventListener('resize', set);
  if (window.ResizeObserver) new ResizeObserver(set).observe(s);
})();
