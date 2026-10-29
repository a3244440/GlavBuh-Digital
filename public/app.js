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
    active.style.clipPath = `inset(5px ${right}px 5px ${tab.offsetLeft}px round 99px)`;
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

// Анимации главной в духе галерейных сайтов: заголовки по словам, буквы собираются при прокрутке,
// огромные слова разъезжаются, карточка летит, тёмная панель раскрывается, папки шагов уходят стопкой.
// При «уменьшить движение» ничего не запускается, страница остаётся статичной и читаемой.
if (!reducedMotion) {
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const wide = () => innerWidth > 960;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const eachText = (root, fn) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(fn);
  };

  // Заголовки поднимаются по словам из-под маски
  const wordObserver = 'IntersectionObserver' in window && new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('in');
    wordObserver.unobserve(entry.target);
  }), { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('main h1, main h2:not([data-scatter]):not(.mega):not(.giant)').forEach(heading => {
    let index = 0;
    eachText(heading, node => {
      const fragment = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { fragment.append(part); return; }
        const outer = document.createElement('span'); outer.className = 'w';
        const inner = document.createElement('span'); inner.className = 'wi'; inner.textContent = part;
        inner.style.setProperty('--i', index++);
        outer.append(inner); fragment.append(outer);
      });
      node.replaceWith(fragment);
    });
    heading.classList.add('split');
    if (wordObserver) wordObserver.observe(heading); else heading.classList.add('in');
  });

  // Буквы разбросаны и собираются в текст по мере прокрутки
  const scatters = [...document.querySelectorAll('[data-scatter], .giant')].map(block => {
    const chars = [];
    eachText(block, node => {
      const fragment = document.createDocumentFragment();
      [...node.textContent].forEach(char => {
        if (/\s/.test(char)) { fragment.append(char); return; }
        const span = document.createElement('span');
        span.className = 'ch'; span.textContent = char;
        span.setAttribute('aria-hidden', 'true');
        chars.push({ span, x: (Math.random() - 0.5) * 260, y: (Math.random() - 0.3) * 220, r: (Math.random() - 0.5) * 70 });
        fragment.append(span);
      });
      node.replaceWith(fragment);
    });
    block.setAttribute('aria-label', block.textContent.replace(/\s+/g, ' ').trim());
    return { block, chars };
  });

  const mega = [...document.querySelectorAll('.mega span')];
  const fly = document.querySelector('.fly');
  const bigwords = document.querySelector('.bigwords-in');
  const panel = document.querySelector('[data-bloom]');
  const folders = [...document.querySelectorAll('.folder')];
  const photo = document.querySelector('[data-photo]');
  const photoFrame = photo?.querySelector('.panel-photo-in');
  const photoImg = photo?.querySelector('img');
  const heroCards = [...document.querySelectorAll('.hp')];
  let pointerX = 0, pointerY = 0;

  let frame = 0;
  const render = () => {
    frame = 0;
    const vh = innerHeight;
    scatters.forEach(({ block, chars }) => {
      const top = block.getBoundingClientRect().top;
      const k = 1 - clamp((top - vh * 0.3) / (vh * 0.6));
      const e = 1 - Math.pow(1 - k, 3), rest = 1 - e;
      chars.forEach(({ span, x, y, r }) => { span.style.transform = rest > 0.001 ? `translate(${(x * rest).toFixed(1)}px,${(y * rest).toFixed(1)}px) rotate(${(r * rest).toFixed(1)}deg)` : ''; span.style.opacity = (0.15 + 0.85 * e).toFixed(2); });
    });
    if (bigwords) {
      const box = bigwords.getBoundingClientRect();
      const k = clamp((vh - box.top) / (box.height + vh));
      mega.forEach((line, i) => { line.style.transform = `translateX(${((i % 2 ? -1 : 1) * (0.5 - k) * 18).toFixed(2)}vw)`; });
      if (fly && wide()) {
        // Карточка идёт по дуге слева направо и переворачивается
        const x = -10 + k * 78, y = Math.sin(k * Math.PI) * -22 + k * 10;
        fly.style.transform = `translate(${x.toFixed(2)}vw, ${y.toFixed(2)}vh) rotate(${(-18 + k * 44).toFixed(1)}deg)`;
      }
    }
    if (panel) {
      const k = clamp((vh - panel.getBoundingClientRect().top) / (vh * 0.8));
      panel.style.transform = `scale(${(0.86 + 0.14 * k).toFixed(4)})`;
      panel.style.borderRadius = `${Math.round(80 - 52 * k)}px`;
    }
    if (photoFrame) {
      // Фото раскрывается из узкого окна во всю ширину и чуть отдаляется
      const k = clamp((vh - photo.getBoundingClientRect().top) / (vh * 0.9));
      const e = 1 - Math.pow(1 - k, 2), rest = 1 - e;
      photoFrame.style.clipPath = `inset(${(rest * 22).toFixed(2)}% ${(rest * 28).toFixed(2)}% round ${Math.round(18 + rest * 40)}px)`;
      photoImg.style.transform = `scale(${(1 + rest * 0.35).toFixed(4)})`;
    }
    if (heroCards.length && wide()) {
      // Карточки с фото следуют за курсором и разлетаются при прокрутке
      const k = clamp(scrollY / vh);
      heroCards.forEach((card, i) => {
        const side = i % 2 ? 1 : -1, depth = 14 + i * 8;
        card.style.transform = `translate(${(pointerX * depth + side * k * 260).toFixed(1)}px, ${(pointerY * depth - k * 180).toFixed(1)}px) rotate(${(side * k * 18).toFixed(2)}deg)`;
      });
    }
    if (wide()) folders.forEach((folder, i) => {
      // Следующая папка наезжает: текущая уменьшается, наклоняется и темнеет
      const next = folders[i + 1];
      if (!next) { folder.style.transform = ''; folder.style.filter = ''; return; }
      const covered = clamp((vh - next.getBoundingClientRect().top) / (vh - 110));
      folder.style.transform = covered ? `translateY(${(-covered * 30).toFixed(1)}px) scale(${(1 - covered * 0.08).toFixed(4)}) rotate(${(-covered * 3).toFixed(2)}deg)` : '';
      folder.style.filter = covered ? `brightness(${(1 - covered * 0.35).toFixed(3)})` : '';
    });
  };
  const kick = () => { if (!frame) frame = requestAnimationFrame(render); };
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick);
  render();
  if (fine && heroCards.length) addEventListener('pointermove', event => {
    pointerX = event.clientX / innerWidth - 0.5; pointerY = event.clientY / innerHeight - 0.5;
    if (scrollY < innerHeight) kick();
  }, { passive: true });

  // Шлейф за курсором: цепочка линий догоняет указатель
  if (fine) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'trail'); svg.setAttribute('aria-hidden', 'true');
    document.body.append(svg);
    const total = 22, points = Array.from({ length: total + 1 }, () => ({ x: -50, y: -50 }));
    const lines = Array.from({ length: total }, (_, i) => {
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('stroke-width', (2.4 * (1 - i / total) + 0.4).toFixed(2));
      line.setAttribute('stroke-opacity', (1 - i / total).toFixed(2));
      svg.append(line);
      return line;
    });
    let target = null, idle = 0, running = 0;
    const step = () => {
      points[0].x += (target.x - points[0].x) * 0.55;
      points[0].y += (target.y - points[0].y) * 0.55;
      let moving = Math.abs(target.x - points[0].x) + Math.abs(target.y - points[0].y);
      for (let i = 1; i <= total; i++) {
        const a = points[i - 1], b = points[i];
        b.x += (a.x - b.x) * 0.42; b.y += (a.y - b.y) * 0.42;
        moving += Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      }
      lines.forEach((line, i) => {
        line.setAttribute('x1', points[i].x); line.setAttribute('y1', points[i].y);
        line.setAttribute('x2', points[i + 1].x); line.setAttribute('y2', points[i + 1].y);
      });
      running = moving > 0.5 || Date.now() - idle < 120 ? requestAnimationFrame(step) : 0;
    };
    addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse') return;
      if (!target) points.forEach(p => { p.x = event.clientX; p.y = event.clientY; });
      target = { x: event.clientX, y: event.clientY };
      idle = Date.now();
      if (!running) running = requestAnimationFrame(step);
    }, { passive: true });
  }
}
