// Sends app traffic that arrives at the home page on to the app:
// QR cards printed before the move (/#qr=...), and apps installed before the move (they open /).
(function () {
  var installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (/^#qr=/.test(location.hash) || installed) location.replace('/app/' + location.hash);
})();
