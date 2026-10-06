// Home page: draws the sample forest, and opens the module named in the address (/#tables).
(function () {
  var stages = [5,4,5,3,5,4,2, 4,5,3,5,2,4,1, 5,3,4,2,1,0,1, 3,2,1,0,1,0,0];
  var g = document.getElementById('grove');
  if (g) g.innerHTML = stages.map(function (s) {
    return '<span><svg aria-hidden="true"><use href="#t' + s + '"/></svg></span>';
  }).join('');
  function openFromHash() {
    var d = location.hash && document.getElementById(location.hash.slice(1));
    if (d && d.tagName === 'DETAILS') d.open = true;
  }
  openFromHash();
  window.addEventListener('hashchange', openFromHash);
})();
