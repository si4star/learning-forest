// Admin dashboard. Uses the grown-up login from the app; the server only answers for emails in ADMIN_EMAILS.
// Everything is built with textContent, never innerHTML, so nothing from the database can run as code.
(function () {
  const $ = id => document.getElementById(id);
  const el = (tag, props = {}, kids = []) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
  const date = t => t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const when = t => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  async function api(path, method = 'GET', body) {
    const res = await fetch('/api' + path, { method, credentials: 'same-origin',
      headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error || `Something went wrong (${res.status}).`); e.status = res.status; throw e; }
    return data;
  }
  function download(name, data) {
    const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), download: name });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  const today = () => new Date().toISOString().slice(0, 10);

  async function start() {
    let stats;
    try { stats = await api('/admin/stats'); }
    catch (e) {
      $('gate').hidden = false;
      const msg = $('gate-msg');
      if (e.status === 401) msg.append('Log in to ', el('a', { href: '/app/', textContent: 'the app' }), ' as a grown-up with an admin email, then come back to this page.');
      else msg.textContent = e.status === 403 ? 'This grown-up account is not an admin. Admin emails are set in the ADMIN_EMAILS setting in Cloudflare.' : e.message;
      return;
    }
    const me = await api('/me').catch(() => ({}));
    $('who').textContent = me.email ? `Signed in as ${me.email}` : '';
    $('dash').hidden = false;
    showStats(stats);
    loadLog();
  }

  function showStats(s) {
    const tile = (n, label, warn) => el('div', { className: 'tile' + (warn && n ? ' warn' : '') }, [el('b', { textContent: n.toLocaleString('en-GB') }), el('span', { textContent: label })]);
    $('tiles').replaceChildren(
      tile(s.accounts, 'grown-up accounts'), tile(s.accountsActive30, 'grown-ups active in 30 days'),
      tile(s.pupils, 'pupils'), tile(s.pupilsInClasses, 'pupils in classes'),
      tile(s.pupilsActive7, 'pupils played in 7 days'), tile(s.pupilsActive30, 'pupils played in 30 days'),
      tile(s.classes, 'classes'), tile(s.classDevices, 'class devices'),
      tile(s.answers7, 'answers in 7 days'), tile(s.answers30, 'answers in 30 days'),
      tile(s.reminders, 'daily reminders set'),
      tile(s.pupilsDeletedWithin30, 'pupils deleted within 30 days (unused)', true),
      tile(s.accountsDeletedWithin30, 'accounts deleted within 30 days (unused)', true));
    $('weeks').tBodies[0].replaceChildren(...s.weeks.slice().reverse().map(w => el('tr', {}, [
      el('td', { textContent: date(w.from + 7 * 864e5) }), ...[w.accounts, w.pupils, w.activePupils, w.answers].map(n => el('td', { className: 'num', textContent: n.toLocaleString('en-GB') }))])));
  }

  async function loadLog() {
    const { log } = await api('/admin/log');
    $('log').tBodies[0].replaceChildren(...(log.length ? log.map(l => el('tr', {}, [el('td', { textContent: when(l.at) }), el('td', { textContent: l.admin }), el('td', { textContent: l.action }), el('td', { textContent: l.detail })]))
      : [el('tr', {}, [el('td', { colSpan: 4, className: 'muted', textContent: 'Nothing yet.' })])]));
  }

  // accounts
  $('acc-form').addEventListener('submit', async e => {
    e.preventDefault();
    $('acc-msg').textContent = '';
    try {
      const { accounts } = await api('/admin/accounts?q=' + encodeURIComponent($('acc-q').value.trim()));
      $('acc-table').hidden = !accounts.length;
      if (!accounts.length) $('acc-msg').textContent = 'No accounts match.';
      else if (accounts.length === 50) $('acc-msg').textContent = 'Showing the 50 most recently used. Search to narrow it down.';
      $('acc-table').tBodies[0].replaceChildren(...accounts.map(accountRow));
    } catch (err) { $('acc-msg').textContent = err.message; }
  });
  function accountRow(a) {
    const acts = el('div', { className: 'acts' }), out = el('div');
    const exp = el('button', { type: 'button', textContent: 'Export data' });
    exp.onclick = async () => { try { download(`learning-forest-account-${a.id}-${today()}.json`, await api(`/admin/accounts/${a.id}/export`)); out.replaceChildren(el('p', { className: 'ok', textContent: 'Downloaded. Send it to the person who asked, then delete your copy.' })); loadLog(); } catch (e) { out.replaceChildren(el('p', { className: 'err', textContent: e.message })); } };
    const del = el('button', { type: 'button', className: 'danger', textContent: 'Delete…' });
    del.onclick = () => {
      const input = el('input', { placeholder: 'Type the email to confirm', autocomplete: 'off' });
      const go = el('button', { type: 'button', className: 'danger', textContent: `Delete account, ${a.pupils} ${a.pupils === 1 ? 'pupil' : 'pupils'} and ${a.classes} ${a.classes === 1 ? 'class' : 'classes'}` });
      const msg = el('p', { className: 'err' });
      go.onclick = async () => {
        msg.textContent = '';
        try { const r = await api(`/admin/accounts/${a.id}`, 'DELETE', { confirm: input.value.trim().toLowerCase() });
          row.replaceChildren(el('td', { colSpan: 6, className: 'ok', textContent: `Deleted ${a.email}: ${r.pupils} ${r.pupils === 1 ? 'pupil' : 'pupils'}, ${r.classes} ${r.classes === 1 ? 'class' : 'classes'}. Confirm to them by email.` })); loadLog(); }
        catch (e) { msg.textContent = e.message; input.focus(); }   // keep the box, so they can try again
      };
      out.replaceChildren(el('div', { className: 'confirm' }, [input, go]), msg); input.focus();
    };
    acts.append(exp, del);
    const row = el('tr', {}, [el('td', { textContent: a.email }), el('td', { className: 'num', textContent: a.pupils }), el('td', { className: 'num', textContent: a.classes }),
      el('td', { textContent: date(a.createdAt) }), el('td', { textContent: date(a.lastSeen) }), el('td', {}, [acts, out])]);
    return row;
  }

  // pupils
  $('pupil-form').addEventListener('submit', async e => {
    e.preventDefault();
    const out = $('pupil-out');
    try {
      const p = await api('/admin/pupil?username=' + encodeURIComponent($('pupil-u').value.trim()));
      const msg = el('div');
      const exp = el('button', { type: 'button', textContent: 'Export data' });
      exp.onclick = async () => { try { download(`learning-forest-pupil-${p.id}-${today()}.json`, await api(`/admin/pupils/${p.id}/export`)); msg.replaceChildren(el('p', { className: 'ok', textContent: 'Downloaded.' })); loadLog(); } catch (e) { msg.replaceChildren(el('p', { className: 'err', textContent: e.message })); } };
      let armed = false;
      const del = el('button', { type: 'button', className: 'danger', textContent: 'Delete this pupil' });
      del.onclick = async () => {
        if (!armed) { armed = true; del.textContent = `Tap again to delete ${p.name} and all their data`; return; }
        try { await api(`/admin/pupils/${p.id}`, 'DELETE', {}); out.replaceChildren(el('p', { className: 'ok', textContent: `Deleted ${p.name} (${p.username}).` })); loadLog(); }
        catch (e) { msg.replaceChildren(el('p', { className: 'err', textContent: e.message })); }
      };
      out.replaceChildren(el('div', { className: 'pupil-card' }, [
        el('p', {}, [el('b', { textContent: p.name }), ` · ${p.username}`]),
        el('p', { className: 'muted', textContent: `Account: ${p.accountEmail}${p.className ? ` · Class: ${p.className}` : ''} · Added ${date(p.createdAt)} · Last played ${date(p.lastPlayed)}` }),
        el('div', { className: 'acts' }, [exp, del]), msg]));
    } catch (err) { out.replaceChildren(el('p', { className: 'err', textContent: err.message })); }
  });

  // notices
  $('emails').addEventListener('click', async () => {
    try {
      const { emails } = await api('/admin/emails');
      const text = emails.join(', ');
      $('emails-out').value = text; $('emails-out').hidden = false;
      try { await navigator.clipboard.writeText(text); $('emails-msg').textContent = `${emails.length} addresses copied.`; }
      catch { $('emails-out').select(); $('emails-msg').textContent = `${emails.length} addresses. Copy them from the box.`; }
      loadLog();
    } catch (e) { $('emails-msg').textContent = e.message; }
  });

  start();
})();
