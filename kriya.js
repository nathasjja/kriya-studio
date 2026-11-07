/* KRIYĀ website bridge.
 * The pages are the same as the Apps Script ones; this file swaps google.script.run
 * for plain HTTPS calls to the script's /exec link (set in config.js), so visitors
 * never land on a Google page and need no Google account. */
(function () {
  var API = window.KRIYA_API || '';

  var TIMEOUT = 40000; // the app gives up at 30 s; this is the backstop for every page

  function call(fn, args) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT) : null;
    return fetch(API, {
      signal: ctl ? ctl.signal : undefined,
      method: 'POST',
      // text/plain keeps this a "simple" request, so the browser sends it straight through
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: fn, args: args || [] }),
      credentials: 'omit',
      redirect: 'follow'
    }).then(function (r) {
      if (!r.ok) throw new Error('The studio sheet did not answer (' + r.status + '). Please try again.');
      return r.json();
    }, function (e) {
      if (e && e.name === 'AbortError') throw new Error('The studio sheet is taking too long to answer. Please try again.');
      throw new Error("Can't reach the studio right now. Check your connection and try again.");
    }).then(function (j) {
      if (timer) clearTimeout(timer);
      if (!j || !j.ok) throw new Error((j && j.error) || 'Something went wrong. Please try again.');
      return j.data;
    }, function (e) { if (timer) clearTimeout(timer); throw e; });
  }

  // Same shape as google.script.run: .withSuccessHandler(f).withFailureHandler(g).api_x(...)
  function runner() {
    var ok = function () { }, bad = function () { };
    var p = new Proxy({}, {
      get: function (_, k) {
        if (k === 'withSuccessHandler') return function (f) { ok = f; return p; };
        if (k === 'withFailureHandler') return function (f) { bad = f; return p; };
        if (k === 'withUserObject') return function () { return p; };
        return function () {
          var args = Array.prototype.slice.call(arguments);
          call(String(k), args).then(function (d) { ok(d); }, function (e) { bad(e); });
        };
      }
    });
    return p;
  }
  window.google = { script: { get run() { return runner(); } } };

  function runMain() {
    var src = document.getElementById('kriya-main');
    var s = document.createElement('script');
    s.text = src.textContent;
    document.body.appendChild(s);
  }

  function screen(html) {
    var el = document.getElementById('kriya-wait');
    if (!el) {
      el = document.createElement('div');
      el.id = 'kriya-wait';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;inset:0;z-index:99;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:24px;text-align:center;background:#12130E;color:#F3F0E8;font:500 15px/1.5 "DM Mono",ui-monospace,monospace';
      document.body.appendChild(el);
    }
    el.innerHTML = html;
    return el;
  }
  var mark = '<div style="font:800 44px/0.9 \'Bricolage Grotesque\',system-ui,sans-serif;font-stretch:75%;letter-spacing:-0.01em">KRIY&#256;</div>';
  function wait() { screen(mark + '<div style="color:#A6A79A">opening&hellip;</div>'); }
  function done() { var el = document.getElementById('kriya-wait'); if (el) el.remove(); }
  function fail(msg) {
    var el = screen(mark + '<div style="max-width:320px">' + String(msg).replace(/</g, '&lt;') + '</div>' +
      '<button type="button" style="font:inherit;font-weight:500;background:#DCFF3E;color:#12130E;border:0;border-radius:12px;padding:14px 22px;min-height:48px;cursor:pointer">Try again</button>');
    el.querySelector('button').onclick = function () { location.reload(); };
  }

  window.KRIYA = {
    call: call,
    start: function (page) {
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[-\w]+\/exec$/.test(API)) {
        return fail('This website is not connected to the studio sheet yet. Put the script link in config.js.');
      }
      if (page === 'app') { window.__BOOT = { url: location.href.split(/[?#]/)[0] }; return runMain(); }
      wait();
      var q = new URLSearchParams(location.search);
      var boot = page === 'quote' ? call('api_bootQuote', [q.get('q') || '', q.get('k') || '']) : call('api_bootRequest', []);
      boot.then(function (b) { window.__BOOT = b; done(); runMain(); }, function (e) { fail(e.message); });
    }
  };
})();
