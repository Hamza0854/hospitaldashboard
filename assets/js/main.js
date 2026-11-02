/* ==========================================================================
   Adam eHospital Suite — Global script
   Shared: theme, sidebar, dropdown-safe helpers
   Page-specific blocks run only if their elements exist on the page.
   ========================================================================== */
(function () {
  'use strict';

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const html = document.documentElement;
  const body = document.body;
  const DESKTOP = 1200;

  /* ---------- Theme (light / dark) ---------- */
  const themeBtn = $('#themeToggle');
  const setThemeIcon = () => {
    if (!themeBtn) return;
    const dark = html.getAttribute('data-bs-theme') === 'dark';
    themeBtn.innerHTML = dark ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon-stars"></i>';
    themeBtn.setAttribute('aria-pressed', String(dark));
  };
  setThemeIcon();
  themeBtn?.addEventListener('click', () => {
    const next = html.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-bs-theme', next);
    store.set('ke-theme', next);
    setThemeIcon();
  });

  /* ---------- Sidebar ---------- */
  const toggle = $('#sidebarToggle');
  if (html.classList.contains('pre-collapsed')) {
    body.classList.add('sidebar-collapsed');
    html.classList.remove('pre-collapsed');
  }

  const closeMobile = () => {
    body.classList.remove('sidebar-open');
    toggle?.setAttribute('aria-expanded', 'false');
  };

  toggle?.addEventListener('click', () => {
    if (window.innerWidth >= DESKTOP) {
      const collapsed = body.classList.toggle('sidebar-collapsed');
      store.set('ke-sidebar', collapsed ? 'collapsed' : 'expanded');
      toggle.setAttribute('aria-expanded', String(!collapsed));
    } else {
      const open = body.classList.toggle('sidebar-open');
      toggle.setAttribute('aria-expanded', String(open));
    }
  });

  $$('[data-sidebar-close]').forEach(el => el.addEventListener('click', closeMobile));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMobile(); });
  window.addEventListener('resize', () => { if (window.innerWidth >= DESKTOP) closeMobile(); });

  // Close drawer after tapping a link on mobile
  $$('.sidebar .nav-item-link').forEach(a => a.addEventListener('click', () => {
    if (window.innerWidth < DESKTOP) closeMobile();
  }));

  /* ---------- Footer year ---------- */
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ======================= DASHBOARD PAGE ======================= */

  /* Greeting + date */
  const greet = $('#greeting');
  if (greet) {
    const h = new Date().getHours();
    greet.textContent = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }
  const dateEl = $('#todayDate');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    dateEl.setAttribute('datetime', now.toISOString().slice(0, 10));
  }

  /* Subscription notice */
  const subAlert = $('#subAlert');
  if (subAlert) {
    const expiry = new Date(subAlert.dataset.expiry + 'T23:59:59');
    const days = Math.ceil((expiry - new Date()) / 86400000);
    const badge = $('#subDays');
    if (badge) badge.textContent = days > 0 ? `(${days} day${days === 1 ? '' : 's'} left)` : '(expired)';

    if (sessionStorage.getItem('ke-sub-dismissed') === '1') subAlert.remove();

    $('#subAlertClose')?.addEventListener('click', () => {
      subAlert.classList.add('is-hiding');
      try { sessionStorage.setItem('ke-sub-dismissed', '1'); } catch (e) {}
      setTimeout(() => subAlert.remove(), 300);
    });
  }

  /* Animated counters */
  const counters = $$('[data-count]');
  const animate = el => {
    const target = +el.dataset.count;
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.textContent = prefix + target.toLocaleString() + suffix; return; }
    const dur = 1200, start = performance.now();
    const tick = t => {
      const p = Math.min((t - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(target * eased).toLocaleString() + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (counters.length) {
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => { if (en.isIntersecting) { animate(en.target); io.unobserve(en.target); } });
      }, { threshold: .4 });
      counters.forEach(c => io.observe(c));
    } else counters.forEach(animate);
  }

  /* Module grid: search, category chips, favourites */
  const grid = $('#moduleGrid');
  if (grid) {
    const cards   = $$('.module-card', grid);
    const search  = $('#moduleSearch');
    const chips   = $$('.chip');
    const countEl = $('#moduleCount');
    const empty   = $('#emptyState');
    const emptyTx = $('#emptyText');
    const total   = cards.length;
    const FAV_KEY = 'ke-favourites';

    let favs = [];
    try { favs = JSON.parse(store.get(FAV_KEY)) || []; } catch (e) { favs = []; }
    let filter = 'all';

    const nameOf = card => $('.module-title', card).textContent.trim();

    cards.forEach((card, i) => {
      card.style.setProperty('--i', i);
      const btn = $('.fav-btn', card);
      const on = favs.includes(nameOf(card));
      btn.setAttribute('aria-pressed', String(on));
      btn.innerHTML = `<i class="bi ${on ? 'bi-star-fill' : 'bi-star'}"></i>`;
      btn.addEventListener('click', () => {
        const name = nameOf(card);
        const active = favs.includes(name);
        favs = active ? favs.filter(n => n !== name) : favs.concat(name);
        store.set(FAV_KEY, JSON.stringify(favs));
        btn.setAttribute('aria-pressed', String(!active));
        btn.innerHTML = `<i class="bi ${!active ? 'bi-star-fill' : 'bi-star'}"></i>`;
        
        if (filter === 'favourites') apply();
      });
    });

    const apply = () => {
      const q = (search?.value || '').trim().toLowerCase();
      let shown = 0;
      cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        const matchQ = !q || text.includes(q);
        const matchF = filter === 'all'
          || (filter === 'favourites' ? favs.includes(nameOf(card)) : card.dataset.category === filter);
        const visible = matchQ && matchF;
        card.classList.toggle('is-hidden', !visible);
        if (visible) shown++;
      });
      if (countEl) countEl.textContent = shown === total ? `${total} modules available` : `Showing ${shown} of ${total} modules`;
      if (empty) {
        empty.hidden = shown !== 0;
        if (emptyTx) emptyTx.textContent = filter === 'favourites' && !q
          ? 'Tap the star on any module to pin it here.'
          : 'Try a different keyword or category.';
      }
    };

    search?.addEventListener('input', apply);
    search?.addEventListener('keydown', e => { if (e.key === 'Escape') { search.value = ''; apply(); } });

    chips.forEach(chip => chip.addEventListener('click', () => {
      chips.forEach(c => { c.classList.remove('active'); c.setAttribute('aria-selected', 'false'); });
      chip.classList.add('active');
      chip.setAttribute('aria-selected', 'true');
      filter = chip.dataset.filter;
      apply();
    }));

    $('#resetFilters')?.addEventListener('click', () => {
      if (search) search.value = '';
      chips[0]?.click();
    });

    // Press "/" anywhere to jump to module search
    document.addEventListener('keydown', e => {
      const typing = /input|textarea|select/i.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
      if (e.key === '/' && !typing && search) { e.preventDefault(); search.focus(); }
    });
  }
})();
