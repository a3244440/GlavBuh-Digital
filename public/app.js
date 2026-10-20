const root = document.documentElement;
root.classList.add('js');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Появление при прокрутке: прячем только то, что ниже первого экрана, поэтому страница читается и без анимации.
if ('IntersectionObserver' in window && !reducedMotion) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.remove('pre'); observer.unobserve(entry.target); }
  }), { rootMargin: '0px 0px -50px 0px' });
  document.querySelectorAll('.reveal').forEach((node, index) => {
    if (node.getBoundingClientRect().top > innerHeight) {
      node.classList.add('pre');
      node.style.transitionDelay = `${(index % 3) * 60}ms`;
      observer.observe(node);
    }
  });
}

// Шапка и подсветка активного пункта меню
const header = document.querySelector('.header');
addEventListener('scroll', () => header.classList.toggle('scrolled', scrollY > 8), { passive: true });
const menuNav = document.querySelector('.menu');
const pill = menuNav?.querySelector('.mp');
function placePill(link) {
  if (!pill) return;
  if (!link) { pill.style.opacity = '0'; return; }
  pill.style.opacity = '1';
  pill.style.width = `${link.offsetWidth}px`;
  pill.style.transform = `translateX(${link.offsetLeft}px)`;
}
const activeLink = menuNav?.querySelector('a.on');
placePill(activeLink);
menuNav?.querySelectorAll('a').forEach(link => link.addEventListener('pointerenter', () => placePill(link)));
menuNav?.addEventListener('pointerleave', () => placePill(activeLink));
addEventListener('resize', () => placePill(activeLink));
document.fonts?.ready.then(() => placePill(activeLink));

// Мобильное меню: нижняя шторка
const menu = document.querySelector('.menu-toggle');
const drawer = document.querySelector('#drawer');
const scrim = document.querySelector('.scrim');
function openMenu() {
  scrim.hidden = false;
  requestAnimationFrame(() => scrim.classList.add('on'));
  drawer.classList.add('open');
  menu.setAttribute('aria-expanded', 'true');
  menu.setAttribute('aria-label', 'Закрыть меню');
  drawer.querySelector('a')?.focus({ preventScroll: true });
}
function closeMenu() {
  if (!drawer.classList.contains('open')) return;
  drawer.classList.remove('open');
  scrim.classList.remove('on');
  setTimeout(() => { scrim.hidden = true; }, reducedMotion ? 0 : 300);
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', 'Открыть меню');
}
menu.addEventListener('click', () => (drawer.classList.contains('open') ? closeMenu() : openMenu()));
scrim.addEventListener('click', closeMenu);
drawer.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && drawer.classList.contains('open')) { closeMenu(); menu.focus(); } });

// Демонстрационная доска задач в окне платформы
const board = document.querySelector('#board');
const app = document.querySelector('#app');
if (app && !reducedMotion) app.classList.add('enter');
if (board && !reducedMotion) {
  const columns = [...board.querySelectorAll('.col')];
  const log = document.querySelector('#log');
  const done = document.querySelector('#k-done');
  const names = { 'АК': 'Айгерим К.', 'ДС': 'Данияр С.', 'ЕМ': 'Елена М.', 'НБ': 'Нурлан Б.' };
  const verbs = ['принял документы', 'провёл в учёте', 'подготовил отчётность', 'закрыл задачу'];
  const counts = () => columns.forEach(column => { column.querySelector('h4 b').textContent = column.querySelectorAll('.card').length; });
  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(board);
  function addLog(card, step) {
    const entry = document.createElement('p');
    entry.className = 'new';
    const who = card.dataset.who;
    const avatar = document.createElement('i'); avatar.textContent = who;
    const text = document.createElement('span'); text.textContent = `${names[who]} ${verbs[step]}`;
    const detail = document.createElement('small'); detail.textContent = `${card.querySelector('b').textContent} · ${card.querySelector('.t').textContent}`;
    text.append(detail); entry.append(avatar, text);
    log.prepend(entry);
    requestAnimationFrame(() => requestAnimationFrame(() => entry.classList.remove('new')));
    while (log.children.length > 6) log.lastElementChild.remove();
  }
  function move() {
    if (document.hidden || !visible) return;
    const from = Math.floor(Math.random() * 3);
    const card = columns[from].querySelector('.card:last-of-type');
    if (!card) return;
    const cards = [...board.querySelectorAll('.card')];
    const before = new Map(cards.map(item => [item, item.getBoundingClientRect()]));
    const target = columns[from + 1];
    target.insertBefore(card, target.querySelector('.card'));
    if (target.querySelectorAll('.card').length > 4) columns[0].append(target.querySelector('.card:last-of-type'));
    counts();
    // FLIP: карточки плавно доезжают до нового места
    cards.forEach(item => {
      const a = before.get(item), b = item.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      if (dx || dy) item.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: item === card ? 620 : 420, easing: 'cubic-bezier(.77,0,.175,1)' });
    });
    card.animate([{ boxShadow: '0 0 0 2px #E1232B, 0 12px 24px -10px rgba(16,21,28,.3)' }, { boxShadow: '0 0 0 1px #E0E4E9' }], { duration: 1400, easing: 'ease-out' });
    addLog(card, from + 1);
    if (from === 2) done.textContent = String(Number(done.textContent) + 1);
  }
  setInterval(move, 1700);
}

// Вкладки возможностей платформы
document.querySelectorAll('[data-tabs]').forEach(block => {
  const tabs = [...block.querySelectorAll('[role="tab"]')];
  const panels = [...block.querySelectorAll('[role="tabpanel"]')];
  const list = block.querySelector('.tabs:not(.tabs-active)');
  const active = block.querySelector('.tabs-active');
  let current = 0, timer;
  function clip(index) {
    const tab = tabs[index];
    const right = list.offsetWidth - tab.offsetLeft - tab.offsetWidth;
    active.style.clipPath = `inset(5px ${right}px 5px ${tab.offsetLeft}px round 10px)`;
  }
  function select(index, focus) {
    tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; });
    panels.forEach((panel, i) => {
      panel.toggleAttribute('data-inactive', i !== index);
      if (i === index && index !== current && !reducedMotion) { panel.classList.remove('swap'); void panel.offsetWidth; panel.classList.add('swap'); }
    });
    current = index;
    clip(index);
    if (focus) tabs[index].focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => { clearInterval(timer); select(index); });
    tab.addEventListener('keydown', event => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      event.preventDefault(); clearInterval(timer);
      select((current + step + tabs.length) % tabs.length, true);
    });
  });
  select(0);
  // Ширина вкладок меняется после загрузки шрифтов и при ресайзе
  if ('ResizeObserver' in window) new ResizeObserver(() => clip(current)).observe(list);
  else addEventListener('resize', () => clip(current));
  document.fonts?.ready.then(() => clip(current));
  if (!reducedMotion) {
    timer = setInterval(() => { if (!document.hidden) select((current + 1) % tabs.length); }, 4800);
    block.addEventListener('pointerenter', () => clearInterval(timer), { once: true });
  }
});

// Счётчики в цифрах о компании
if (!reducedMotion && 'IntersectionObserver' in window) {
  const counter = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    counter.unobserve(entry.target);
    const node = entry.target, to = Number(node.dataset.count), suffix = node.dataset.suffix || '';
    const from = to > 1000 ? to - 15 : 0, start = performance.now();
    const tick = now => {
      const k = Math.min(1, (now - start) / 1400), eased = 1 - Math.pow(1 - k, 4);
      node.textContent = Math.round(from + (to - from) * eased) + suffix;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { threshold: 0.4 });
  document.querySelectorAll('[data-count]').forEach(node => counter.observe(node));
}

// Заявка
const form = document.querySelector('#lead-form');
form?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const button = form.querySelector('button');
  const status = document.querySelector('#form-status');
  button.disabled = true;
  status.textContent = 'Отправляем заявку…';
  try {
    const response = await fetch('/api/leads', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form))), signal: AbortSignal.timeout(18000)
    });
    const result = await response.json();
    status.textContent = result.message;
    if (response.ok) form.reset();
  } catch {
    status.textContent = 'Не удалось подтвердить отправку. Проверьте соединение. Перед повторной отправкой убедитесь, что заявка не была получена.';
  } finally { button.disabled = false; }
});
