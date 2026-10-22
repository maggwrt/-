'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const panel = $('#panel');
const body = $('#panel-body');
const alphabet = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
const key = 'zov-zemli-v1';
let state = {};
try { state = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (_) {}
let watched = false;
let motionTimer;
let toastTimer;
function save() {
  try { localStorage.setItem(key, JSON.stringify(state)); }
  catch (_) { toast('Браузер не сохранил данные. Скачайте запись из атласа.'); }
}
function toast(message) {
  const el = $('#toast'); el.textContent = message; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 4500);
}
function updateProgress() {
  $('#progress').textContent = `Восстановлено ${state.entry ? 1 : 0} из 5 сигналов`;
  $('#first-status').textContent = state.entry ? 'Сигнал восстановлен' : 'Можно начать';
}
function openPanel(title, label, content) {
  clearTimeout(motionTimer); watched = false;
  $('#panel-label').textContent = label;
  body.innerHTML = `<section class="dialog-content"><h2 id="panel-title">${title}</h2>${content}</section>`;
  if (!panel.open) panel.showModal();
  panel.scrollTop = 0;
}
function mission() {
  openPanel('Сообщение сквозь туман', 'Миссия 01 · Информатика', `
    <p class="note">ЛУМА: «Сообщение станции сохранилось, но буквы заменены. Помогите прочитать ключевое слово».</p>
    <p>В шифре Цезаря каждую букву сдвинули на <strong>3 позиции вперёд</strong>. Для расшифровки двигайтесь на 3 позиции назад. После «Я» снова идёт «А». Используем алфавит без «Ё».</p>
    <div class="alphabet">${alphabet.split('').join(' ')}</div>
    <p class="cipher-text">НСЗ</p>
    <form id="cipher-form"><div class="form-row"><label for="cipher-answer">Какое слово зашифровано?<input id="cipher-answer" autocomplete="off" maxlength="20" required placeholder="Введите три буквы"></label><button class="button-primary" type="submit">Проверить</button></div><p id="cipher-feedback" class="feedback" role="status"></p></form>
    <p class="small">Это учебная модель шифра: она не подходит для защиты важных данных. Следующую часть миссии лучше выполнять вместе с командой.</p>`);
  $('#cipher-form').addEventListener('submit', event => {
    event.preventDefault(); const correct = $('#cipher-answer').value.trim().toUpperCase() === 'КОД';
    const feedback = $('#cipher-feedback'); feedback.classList.toggle('error', !correct);
    feedback.textContent = correct ? 'Верно: КОД. Сообщение восстановлено — можно перейти к наблюдению.' : 'Пока не совпало. Найдите «Н» в алфавите и отсчитайте три позиции назад. Повторите для остальных букв.';
    if (correct && !$('#next-step')) {
      const next = document.createElement('button'); next.id = 'next-step'; next.type = 'button'; next.className = 'button-primary'; next.textContent = 'Перейти к исследованию →'; next.addEventListener('click', observation); $('#cipher-form').after(next);
    }
  });
}
function observation() {
  openPanel('Как сравнить движение?', 'Миссия 01 · Физика', `
    <p class="note">ЛУМА: «Два маячка движутся по одинаковым дорожкам. Какой проходит путь быстрее? Сначала предположите, затем проверьте».</p>
    <p>Оба маячка стартуют одновременно. Длины дорожек одинаковы. Нажмите «Начать наблюдение» и дождитесь завершения.</p>
    <div id="motion" aria-label="Модель движения двух маячков по одинаковым дорожкам"><div class="lane"><span class="runner a">А</span></div><div class="lane"><span class="runner b">Б</span></div></div>
    <button type="button" class="button-outline" id="run-motion">Начать наблюдение</button><p id="motion-status" class="small" role="status"></p>
    <form id="observation-form"><fieldset style="border:0;padding:0;margin:18px 0"><legend>Какой вывод подтверждает наблюдение?</legend>
    <label class="radio-choice"><input type="radio" name="conclusion" value="a" required> Маячок А проходит тот же путь за меньшее время.</label>
    <label class="radio-choice"><input type="radio" name="conclusion" value="b"> Маячок Б быстрее, потому что его цвет темнее.</label>
    <label class="radio-choice"><input type="radio" name="conclusion" value="c"> Для сравнения достаточно знать только цвет маячков.</label></fieldset>
    <label for="reason">Обсудите с командой: почему сравнение было справедливым?<textarea id="reason" maxlength="1500" required placeholder="Что было одинаковым? Что вы наблюдали?"></textarea></label><button class="button-primary" type="submit">Сохранить открытие в атлас</button><p id="observation-feedback" class="feedback" role="status"></p></form>
    <p class="small">Демонстрационная задача. Физическое содержание будет уточняться совместно с автором физической части проекта. Нейросеть к прототипу не подключена.</p>`);
  $('#run-motion').addEventListener('click', () => {
    clearTimeout(motionTimer); watched = false;
    const motion = $('#motion'); motion.classList.remove('running'); void motion.offsetWidth; motion.classList.add('running');
    $('#motion-status').textContent = 'Наблюдение идёт…';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    motionTimer = setTimeout(() => {
      watched = true;
      const status = $('#motion-status'); if (status) status.textContent = 'А завершил путь за 2 секунды, Б — за 4 секунды. Длины дорожек одинаковы.';
    }, reducedMotion ? 100 : 4100);
  });
  $('#observation-form').addEventListener('submit', event => {
    event.preventDefault(); const feedback = $('#observation-feedback'); feedback.classList.add('error');
    if (!watched) { feedback.textContent = 'Сначала запустите наблюдение и дождитесь результата.'; return; }
    if ($('input[name="conclusion"]:checked').value !== 'a') { feedback.textContent = 'Проверьте, какие данные относятся к движению: длина пути, время или цвет?'; return; }
    const reason = $('#reason').value.trim();
    if (!reason) { feedback.textContent = 'Добавьте объяснение команды перед сохранением.'; return; }
    state.entry = { date: new Date().toISOString(), reason }; save(); updateProgress(); atlas(); toast('Первый сигнал восстановлен. Открытие добавлено в атлас.');
  });
}
function atlas() {
  openPanel('Наш атлас', 'Наблюдения команды', state.entry ? `
    <article class="atlas-entry"><h3>01 · Туманное поле</h3><p><strong>Информатика:</strong> расшифровано слово «КОД» с помощью сдвига на три позиции назад.</p><p><strong>Наблюдение:</strong> два маячка прошли одинаковый путь за 2 и 4 секунды. Маячок А двигался быстрее.</p><p><strong>Объяснение команды:</strong></p><p id="saved-reason"></p></article><button class="button-primary" type="button" id="download-atlas">Скачать запись</button><p class="small">Записи хранятся только в этом браузере. Их не видят другие команды или учитель. При очистке данных браузера записи могут исчезнуть.</p>` : '<p>Пока здесь нет записей. В первой миссии вы расшифруете сообщение, сравните движение маячков и сохраните объяснение команды.</p><button class="button-primary" type="button" id="atlas-start">Начать первую миссию →</button>');
  if (state.entry) {
    $('#saved-reason').textContent = state.entry.reason;
    $('#download-atlas').addEventListener('click', () => {
      const text = `Зов Земли — Атлас восстановленных сигналов\n\n01. Туманное поле\nШифр: НСЗ → КОД (сдвиг −3, русский алфавит без Ё).\nНаблюдение: одинаковый путь; А — 2 с, Б — 4 с. А движется быстрее.\n\nОбъяснение команды:\n${state.entry.reason}\n`;
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'atlas-luma.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  } else $('#atlas-start').addEventListener('click', mission);
}
function team() {
  openPanel('Наша команда', 'Договоритесь перед стартом', `
    <p>Работайте по 3–4 человека. Выберите, кто начнёт с каждой роли. На следующей станции поменяйтесь.</p><ul><li><strong>Исследователь</strong> — предлагает наблюдение и следит за условиями.</li><li><strong>Специалист по данным</strong> — помогает с таблицами и алгоритмами.</li><li><strong>Проверяющий</strong> — проверяет объяснения и предложения помощника.</li><li><strong>Координатор</strong> — помогает договориться и представить результат.</li></ul><p class="note">Каждый участвует в обсуждении. Роли распределяют ответственность, а не право думать.</p><form id="team-form"><label for="team-name">Название команды — без фамилий и личных данных<input id="team-name" maxlength="50" placeholder="Например, Искатели сигналов"></label><button class="button-primary" type="submit">Сохранить название</button></form>`);
  $('#team-name').value = typeof state.team === 'string' ? state.team : '';
  $('#team-form').addEventListener('submit', event => { event.preventDefault(); state.team = $('#team-name').value.trim(); save(); panel.close(); toast('Название команды сохранено в этом браузере.'); });
}
function teacher() {
  openPanel('О проекте', 'Для учителя', '<p>«Зов Земли» — прототип межпредметного проекта по физике и информатике для 6 класса. Команда помогает роботу ЛУМЕ восстановить исследовательские сигналы и собирает цифровой атлас.</p><h3>Что доступно сейчас</h3><ul><li>Карта пяти станций и первая демонстрационная миссия.</li><li>Шифр Цезаря и качественное сравнение движения.</li><li>Атлас с сохранением в браузере и выгрузкой записи.</li><li>Памятка по командным ролям.</li></ul><h3>На что обратить внимание</h3><p>Наблюдайте, как ученики обосновывают выводы, предлагают варианты, объясняют решение и договариваются. Успешное прохождение само по себе не является диагностикой 4К.</p><p class="note">Нейросеть не подключена. Остальные станции, окончательные физические задания и методика апробации ещё разрабатываются.</p><p class="small">Иллюстрация ЛУМЫ взята из сгенерированного визуального эскиза. Ресурс не собирает данные на сервере и не содержит аналитики.</p>');
}
const screens = { mission, atlas, team, teacher };
document.addEventListener('click', event => {
  const button = event.target.closest('[data-open]'); if (button) screens[button.dataset.open]();
  const station = event.target.closest('[data-station]'); if (station) toast(`${station.dataset.station}: задания этой станции ещё готовятся.`);
});
$('#close-panel').addEventListener('click', () => panel.close());
panel.addEventListener('close', () => { clearTimeout(motionTimer); watched = false; });
updateProgress();
