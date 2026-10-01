/* Blush Wine — progressive enhancement.
   The site is fully readable without JS; everything here is optional.
   No data is transmitted or stored — forms and the booking flow are mock-ups. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  /* ---------------------------------------------------- Mobile drawer ---- */
  var burger = document.querySelector('[data-burger]');
  var drawer = document.querySelector('[data-drawer]');
  if (burger && drawer) {
    var setDrawer = function (open) {
      burger.setAttribute('aria-expanded', String(open));
      drawer.classList.toggle('is-open', open);
      drawer.setAttribute('aria-hidden', String(!open));
      document.body.classList.toggle('is-locked', open);
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    setDrawer(false);
    burger.addEventListener('click', function () {
      setDrawer(burger.getAttribute('aria-expanded') !== 'true');
    });
    drawer.addEventListener('click', function (e) { if (e.target.closest('a')) setDrawer(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') { setDrawer(false); burger.focus(); }
    });
    var mq = window.matchMedia('(min-width: 1040px)');
    var onChange = function () { if (mq.matches) setDrawer(false); };
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
  }

  /* ------------------------------------------------------ Header state ---- */
  var header = document.querySelector('[data-header]');
  if (header) {
    var ticking = false;
    var sync = function () { header.classList.toggle('is-stuck', window.scrollY > 12); ticking = false; };
    sync();
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(sync); }
    }, { passive: true });
  }

  /* ---------------------------------------------------- Reveal on scroll -- */
  var targets = document.querySelectorAll('[data-reveal]');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (targets.length) {
    if (reduce || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(targets, function (el) { el.classList.add('is-in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          var delay = parseInt(el.getAttribute('data-reveal-delay') || '0', 10);
          setTimeout(function () { el.classList.add('is-in'); }, delay);
          io.unobserve(el);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      Array.prototype.forEach.call(targets, function (el) { io.observe(el); });
    }
  }

  /* ----------------------------------------------- Generic mock forms ----- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-demo-form]'), function (form) {
    var status = form.querySelector('[data-form-status]');
    var msg = form.getAttribute('data-demo-msg') ||
      'Thanks — this is a preview form, so nothing has been sent yet. To confirm your booking please call us on 0484 188 798.';
    var announce = function () {
      if (!status) return;
      status.classList.add('is-visible');
      status.textContent = msg;
      status.setAttribute('tabindex', '-1');
      status.focus();
    };
    form.addEventListener('submit', function (e) { e.preventDefault(); if (form.checkValidity && !form.checkValidity()) { form.reportValidity(); return; } announce(); });
  });

  /* ------------------------------------------------ Newsletter (mock) ----- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-newsletter]'), function (form) {
    var msg = form.querySelector('[data-newsletter-msg]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.querySelector('input[type="email"]');
      if (email && email.value && email.checkValidity()) {
        if (msg) msg.textContent = 'Cheers! You’re on the list — see you on a Thursday.';
        form.reset();
      } else {
        if (msg) msg.textContent = 'Please enter a valid email address.';
        if (email) email.focus();
      }
    });
  });

  /* ---------------------------------------------- Map (click-to-load) ---- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-map]'), function (mapEl) {
    var loadBtn = mapEl.querySelector('[data-map-load]');
    if (!loadBtn) return;
    loadBtn.addEventListener('click', function () {
      var consent = mapEl.querySelector('[data-map-consent]');
      var iframe = document.createElement('iframe');
      iframe.src = mapEl.getAttribute('data-map-src');
      iframe.title = mapEl.getAttribute('data-map-title') || 'Map';
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      if (consent) consent.remove();
      mapEl.appendChild(iframe);
    });
  });

  /* ==================================================== Booking widget ==== */
  var root = document.querySelector('[data-booking]');
  if (!root) return;

  var state = { date: null, time: null, party: 2 };
  var TIMES = {
    'Lunch': ['12:00', '12:30', '1:00', '1:30', '2:00'],
    'Dinner': ['5:30', '6:00', '6:30', '7:00', '7:30', '8:00', '8:30']
  };
  var DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var viewYear = today.getFullYear(), viewMonth = today.getMonth();
  var maxDate = new Date(today.getFullYear(), today.getMonth() + 3, 0);

  var calTitle = root.querySelector('[data-cal-title]');
  var calGrid = root.querySelector('[data-cal-grid]');
  var prevBtn = root.querySelector('[data-cal-prev]');
  var nextBtn = root.querySelector('[data-cal-next]');
  var timeWrap = root.querySelector('[data-times]');
  var stepVal = root.querySelector('[data-party-val]');
  var partyMinus = root.querySelector('[data-party="-"]');
  var partyPlus = root.querySelector('[data-party="+"]');
  var continueBtn = root.querySelector('[data-continue]');

  function fmtDate(d) { return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear(); }
  function fmtParty(n) { return n >= 12 ? '12+ guests' : (n + (n === 1 ? ' guest' : ' guests')); }
  function sameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

  /* ----- Calendar render ----- */
  function renderCal() {
    if (!calGrid) return;
    calTitle.textContent = MONTHS[viewMonth] + ' ' + viewYear;
    calGrid.innerHTML = '';
    DOW.forEach(function (d) {
      var h = document.createElement('div'); h.className = 'cal__dow'; h.textContent = d; calGrid.appendChild(h);
    });
    var first = new Date(viewYear, viewMonth, 1);
    var startPad = first.getDay();
    var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (var p = 0; p < startPad; p++) { calGrid.appendChild(document.createElement('div')); }
    for (var day = 1; day <= daysInMonth; day++) {
      var cellDate = new Date(viewYear, viewMonth, day);
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'cal__day'; btn.textContent = day;
      if (cellDate < today || cellDate > maxDate) { btn.disabled = true; }
      if (sameDay(cellDate, today)) btn.classList.add('is-today');
      if (sameDay(cellDate, state.date)) btn.classList.add('is-selected');
      btn.setAttribute('aria-label', fmtDate(cellDate));
      (function (dt) {
        btn.addEventListener('click', function () {
          state.date = dt;
          renderCal(); update();
        });
      })(cellDate);
      calGrid.appendChild(btn);
    }
    var firstOfView = new Date(viewYear, viewMonth, 1);
    prevBtn.disabled = (firstOfView <= new Date(today.getFullYear(), today.getMonth(), 1));
    var lastOfView = new Date(viewYear, viewMonth + 1, 0);
    nextBtn.disabled = (lastOfView >= maxDate);
  }
  if (prevBtn) prevBtn.addEventListener('click', function () { viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } renderCal(); });
  if (nextBtn) nextBtn.addEventListener('click', function () { viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } renderCal(); });

  /* ----- Time chips ----- */
  function renderTimes() {
    if (!timeWrap) return;
    timeWrap.innerHTML = '';
    Object.keys(TIMES).forEach(function (grp) {
      var label = document.createElement('p'); label.className = 'chip__group-label'; label.textContent = grp; timeWrap.appendChild(label);
      var row = document.createElement('div'); row.className = 'chips';
      TIMES[grp].forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'chip'; b.textContent = t + (grp === 'Lunch' ? 'pm' : 'pm');
        if (state.time === (grp + '|' + t)) b.classList.add('is-selected');
        b.addEventListener('click', function () {
          state.time = grp + '|' + t;
          renderTimes(); update();
        });
        row.appendChild(b);
      });
      timeWrap.appendChild(row);
    });
  }
  function timeLabel() {
    if (!state.time) return null;
    var parts = state.time.split('|');
    return parts[1] + 'pm';
  }

  /* ----- Party stepper ----- */
  function renderParty() {
    if (!stepVal) return;
    stepVal.innerHTML = (state.party >= 12 ? '12+' : state.party) + '<small>' + (state.party === 1 ? 'guest' : 'guests') + '</small>';
    if (partyMinus) partyMinus.disabled = state.party <= 1;
    if (partyPlus) partyPlus.disabled = state.party >= 12;
  }
  if (partyMinus) partyMinus.addEventListener('click', function () { if (state.party > 1) { state.party--; renderParty(); update(); } });
  if (partyPlus) partyPlus.addEventListener('click', function () { if (state.party < 12) { state.party++; renderParty(); update(); } });

  /* ----- Summary + step machine ----- */
  var sumDate = root.querySelector('[data-sum-date]');
  var sumTime = root.querySelector('[data-sum-time]');
  var sumParty = root.querySelector('[data-sum-party]');
  function setSum(el, val) {
    if (!el) return;
    if (val) { el.textContent = val; el.classList.remove('v--empty'); }
    else { el.textContent = 'Not selected'; el.classList.add('v--empty'); }
  }
  function update() {
    setSum(sumDate, state.date ? fmtDate(state.date) : null);
    setSum(sumTime, timeLabel());
    setSum(sumParty, fmtParty(state.party));
    if (continueBtn) continueBtn.disabled = !(state.date && state.time);
  }

  var panes = root.querySelectorAll('[data-pane]');
  var stepTabs = root.querySelectorAll('[data-step]');
  function goStep(n) {
    Array.prototype.forEach.call(panes, function (p) { p.classList.toggle('is-active', p.getAttribute('data-pane') === String(n)); });
    Array.prototype.forEach.call(stepTabs, function (t) { t.setAttribute('aria-current', String(t.getAttribute('data-step') === String(n))); });
    root.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
  if (continueBtn) continueBtn.addEventListener('click', function () { if (!continueBtn.disabled) goStep(2); });
  Array.prototype.forEach.call(root.querySelectorAll('[data-back]'), function (b) {
    b.addEventListener('click', function () { goStep(parseInt(b.getAttribute('data-back'), 10)); });
  });

  /* ----- Confirm ----- */
  var detailsForm = root.querySelector('[data-details-form]');
  if (detailsForm) {
    detailsForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!detailsForm.checkValidity()) { detailsForm.reportValidity(); return; }
      var name = (detailsForm.querySelector('#b-name') || {}).value || '';
      var ref = 'BW-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + (100 + Math.floor(Math.random() * 900));
      var c = root.querySelector('[data-confirm]');
      if (c) {
        var set = function (sel, val) { var el = c.querySelector(sel); if (el) el.textContent = val; };
        set('[data-c-name]', name.split(' ')[0] || 'there');
        set('[data-c-ref]', ref);
        set('[data-c-date]', state.date ? fmtDate(state.date) : '—');
        set('[data-c-time]', timeLabel() || '—');
        set('[data-c-party]', fmtParty(state.party));
      }
      goStep(3);
    });
  }
  var resetBtn = root.querySelector('[data-reset]');
  if (resetBtn) resetBtn.addEventListener('click', function () {
    state = { date: null, time: null, party: 2 };
    if (detailsForm) detailsForm.reset();
    renderCal(); renderTimes(); renderParty(); update(); goStep(1);
  });

  renderCal(); renderTimes(); renderParty(); update();
})();
