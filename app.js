import { createLore } from './lore.js?v=story-1';

'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const alphabet = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
const STORAGE_KEY = 'zov-zemli-expedition-v2';
const labels = ['Задача', 'Сигнал', '3D-лаборатория', 'Проверка', 'Атлас'];
const roles = ['Исследователь', 'Специалист по данным', 'Проверяющий', 'Координатор'];
const algorithm = ['Расшифровать сообщение', 'Задать одинаковый путь и выбрать скорости', 'Предположить результат и провести опыт', 'Сравнить времена; при необходимости повторить', 'Обосновать выбор и сохранить вывод'];
const format = n => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const winner = trial => Math.abs(trial.timeA - trial.timeB) < 1e-8 ? 'equal' : trial.timeA < trial.timeB ? 'a' : 'b';
const winnerText = value => ({ a:'А раньше', b:'Б раньше', equal:'Одновременно' }[value]);
const clean = value => typeof value === 'string' ? value.slice(0, 6000) : '';
let legacy = {};
let raw = {};
try { legacy = JSON.parse(localStorage.getItem('zov-zemli-v1') || '{}') || {}; } catch (_) {}
try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch (_) {}
const loaded = raw.mission && typeof raw.mission === 'object' ? raw.mission : {};
const state = {
  team: clean(raw.team || legacy.team),
  story: raw.story && typeof raw.story === 'object' && !Array.isArray(raw.story) ? raw.story : {},
  mission: {
    step: Math.max(0, Math.min(4, Math.floor(Number(loaded.step) || 0))),
    unlocked: Math.max(0, Math.min(4, Math.floor(Number(loaded.unlocked) || 0))),
    fields: loaded.fields && typeof loaded.fields === 'object' && !Array.isArray(loaded.fields) ? loaded.fields : {},
    trials: Array.isArray(loaded.trials) ? loaded.trials.filter(t => t && t.distance === 12 && Number.isFinite(t.speedA) && t.speedA >= 1 && t.speedA <= 4 && Number.isFinite(t.speedB) && t.speedB >= 1 && t.speedB <= 4 && Math.abs(t.timeA - 12/t.speedA) < 1e-6 && Math.abs(t.timeB - 12/t.speedB) < 1e-6).slice(-100) : [],
    order: Array.isArray(loaded.order) && [...loaded.order].sort().join() === '0,1,2,3,4' ? loaded.order : [2,0,4,1,3],
    record: loaded.record && typeof loaded.record === 'object' && Array.isArray(loaded.record.trials) && loaded.record.trials.length > 0 && loaded.record.trials.every(t=>t&&Number.isFinite(t.speedA)&&Number.isFinite(t.speedB)&&Number.isFinite(t.timeA)&&Number.isFinite(t.timeB)) && Array.isArray(loaded.record.algorithm) && typeof loaded.record.conclusion === 'string' && loaded.record.reflections && typeof loaded.record.reflections === 'object' ? loaded.record : null,
  }
};
const m = state.mission;
if(!m.record)state.story.deliveryPending=false;
// Recover safely if an old or damaged draft points past its available evidence.
if (!m.trials.length && m.unlocked > 2) m.unlocked = 2;
if (m.trials.length && new Set(m.trials.map(winner)).size < 2 && m.unlocked > 2) m.unlocked = 2;
m.step = Math.min(m.step, m.unlocked);
let editingRecord = false;
const field = (key, fallback = '') => typeof m.fields[key] === 'string' ? m.fields[key] : fallback;
let storageAvailable = true;
let toastTimer;
let heroScene;
let labScene;
let labGeneration = 0;
let labReady = false;
let activeRun = null;
let fallbackTimer;
let clockTimer;
let paused = false;
let fallbackElapsed = 0;
let fallbackStart = 0;
let sceneModule;
let lore;
let deliveryScene;
let deliveryGeneration = 0;
let deliveryBusy = false;
let deliveryTimer;
let deliverySceneReady = false;
const panel = $('#panel');
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (_) { storageAvailable = false; const note = $('#save-note'); if (note) note.textContent = 'Браузер не разрешил сохранение. В конце скачайте результат, прежде чем закрыть страницу.'; }
}
function toast(message) {
  $('#toast').textContent = message; $('#toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 4500);
}
function loadSceneModule() {
  if (!sceneModule) sceneModule = import('./scene.js?v=story-1').catch(error => { sceneModule = null; throw error; });
  return sceneModule;
}
function signalRestored() { return Boolean(m.record && !state.story.deliveryPending); }
function updateProgress() {
  const restored = signalRestored();
  const progress = $('#progress');
  if (progress) progress.textContent = `Восстановлено ${restored ? 1 : 0} из 5 сигналов`;
  const statusProgress = $('#home-status-progress');
  if (statusProgress) statusProgress.textContent = `${restored ? 1 : 0} / 5`;
  $('#first-status').textContent = restored ? 'Сигнал восстановлен' : state.story.deliveryPending ? 'Маяк готов к отправке' : 'Можно начать';
  $('.station.active').classList.toggle('is-restored', restored);
  $('#home-story-status').textContent = restored ? 'Туманное поле снова на связи. В дневнике ЛУМЫ появилась первая восстановленная запись.' : state.story.deliveryPending ? 'Протокол готов. Осталось доставить маяк и включить станцию.' : 'Карта сохранилась. Записи требуют проверки. ЛУМА ждёт вашу команду.';
  heroScene?.setStoryState({signalRestored: restored, awakened: Boolean(state.story.introSeen || m.unlocked || m.record)});
  lore?.sync();
  $('#hero-cta').textContent = m.record ? 'Вернуться к первой миссии' : m.unlocked ? 'Продолжить экспедицию' : 'Начать экспедицию';
  const dashboardNote = $('#current-stage-note');
  const dashboardCta = $('#dashboard-cta');
  if (dashboardNote) dashboardNote.textContent = restored ? 'Станция на связи' : state.story.deliveryPending ? 'Осталось отправить маяк' : m.unlocked ? 'Продолжить черновик' : 'Можно начать';
  if (dashboardCta) dashboardCta.textContent = restored ? 'Посмотреть результат' : m.unlocked ? 'Продолжить миссию' : 'Начать миссию';
}
function home(scrollToRoute = false) {
  cleanupDelivery(); cleanupLab(); $('#mission-view').hidden = true; $('#home-view').hidden = false;
  document.title = 'Зов Земли — исследуем вместе с ЛУМОЙ';
  history.replaceState(null, '', scrollToRoute ? '#route' : '#home');
  requestAnimationFrame(() => scrollToRoute ? $('#route').scrollIntoView({block:'start'}) : window.scrollTo({top:0,behavior:'instant'}));
  updateProgress();
}
function requestMission() {
  if (!state.story.introSeen) { if(panel.open)panel.close(); lore.startIntro(); return; }
  openMission();
}
function openMission() {
  if (panel.open) panel.close();
  $('#home-view').hidden = true; $('#mission-view').hidden = false;
  history.replaceState(null, '', '#mission');
  document.title = 'Миссия 01 · Туманное поле — Зов Земли';
  renderStep(); window.scrollTo({ top:0, behavior:'instant' });
}
function feedback(id, text, error = true) {
  const el = $(id); if (!el) return;
  el.textContent = text; el.className = `inline-feedback ${error ? 'is-error' : 'is-success'}`;
}
function luma(text) {
  return `<div class="luma-note"><span class="luma-avatar" aria-hidden="true">L<span>••</span></span><div><strong>ЛУМА · на связи</strong><p>${text}</p></div></div>`;
}
function stageHeader(number, title, description) {
  return `<div class="stage-header"><p class="eyebrow">Шаг ${number} из 5</p><h2 id="stage-title" tabindex="-1">${title}</h2><p>${description}</p></div>`;
}
function actions(back, next, nextLabel = 'Продолжить →', disabled = false) {
  return `<div class="stage-actions">${back !== null ? `<button type="button" class="button-secondary" data-step="${back}">← Назад</button>` : '<span></span>'}${next !== null ? `<button type="button" class="button-primary" id="stage-next" data-advance="${next}" ${disabled ? 'disabled' : ''}>${nextLabel}</button>` : ''}</div>`;
}
function goStep(step, unlock = false) {
  if (step < 0 || step > 4 || (!unlock && step > m.unlocked)) return;
  m.step = step; if (unlock) m.unlocked = Math.max(m.unlocked, step);
  save(); renderStep(); $('#stage-title')?.focus({preventScroll:true});
  $('#mission-view').scrollIntoView({block:'start',behavior:'instant'});
}
function renderStep() {
  cleanupDelivery();cleanupLab();
  $('#mission-layout').classList.remove('is-finale');
  if (m.step > m.unlocked) m.step = m.unlocked;
  $('#mission-steps').innerHTML = labels.map((label, i) => `<li><button type="button" data-step="${i}" class="${i === m.step ? 'current' : i < m.step ? 'done' : ''}" ${i > m.unlocked ? 'disabled' : ''} ${i === m.step ? 'aria-current="step"' : ''}><span>${i < m.step ? '✓' : String(i+1).padStart(2,'0')}</span>${label}</button></li>`).join('');
  $('#mission-layout').classList.toggle('is-lab', m.step === 2);
  $('#mission-aside').innerHTML = `<p class="eyebrow">Полевые заметки</p><h3>${['Мы снова в экспедиции','Терминал принимает сигнал','Испытательный стенд ожил','Протокол требует проверки','Маяк ждёт отправки'][m.step]}</h3><p>${['Вы исследуете одну задачу вместе. Каждый может предложить идею и задать вопрос.','Шифр — это правило замены. Зная правило, можно восстановить исходное сообщение.','3 м/с означает: за каждую секунду тележка проходит 3 метра. В модели скорости постоянны.','Один удачный опыт не доказывает, что результат будет таким при любых настройках.','Объясните, что наблюдали, почему приняли решение и как помогли друг другу.'][m.step]}</p><div class="aside-divider"></div><p class="small">${state.team ? `Команда «${escapeHtml(state.team)}»` : 'Назовите свою команду в разделе «Команда».'}</p><p class="small">${m.trials.length ? `Завершено опытов: ${m.trials.length}` : 'Ваши наблюдения появятся в журнале.'}</p>`;
  [renderBrief, renderCipher, renderLab, renderVerification, renderJournal][m.step]();
}
function renderBrief() {
  $('#stage-content').innerHTML = stageHeader(1, 'Станция скрылась в тумане', 'Восстановите первый сигнал исследовательской сети.') + luma(`${state.team ? `Команда «${escapeHtml(state.team)}», ` : ''}мы у Туманного поля. Из-за тумана я не вижу дальнюю станцию. Две тележки могут отвезти туда маяк, но мой архив не подсказывает, какой довериться. Давайте проверим вместе.`) + `
    <div class="brief-grid"><article class="info-card"><span class="task-label">Ваша задача</span><h3>Доставить маяк к молчащей станции</h3><p>Откройте входящий сигнал, испытайте тележки и подготовьте протокол. По вашему решению ЛУМА отправит маяк к станции.</p></article><article class="info-card"><span class="task-label">Общий результат</span><h3>Первая страница атласа</h3><p>В ней останутся прогнозы, результаты 3D-опытов, алгоритм и объяснение вашей команды.</p></article></div>
    <h3>Кто за что отвечает?</h3><p>Распределите роли. Если вас трое, две роли можно совместить. На следующей станции поменяйтесь.</p><div class="role-grid">${roles.map((r,i)=>`<article class="role-card"><span>0${i+1}</span><h4>${r}</h4><p>${['Предлагает, что и как проверить.','Записывает данные и помогает с алгоритмом.','Ищет основания для выводов.','Помогает договориться и объяснить решение.'][i]}</p></article>`).join('')}</div>
    <label class="field">Название команды <span class="muted">· можно придумать позже</span><input id="brief-team" maxlength="50" value="${escapeHtml(state.team)}" placeholder="Например, Искатели сигналов" autocomplete="off"></label>
    <p class="small">Используйте название команды без фамилий. Роль — ответственность за часть работы; обсуждать и принимать решения могут все.</p>` + actions(null,1,'Принять миссию →');
  $('#brief-team').addEventListener('input', e => { state.team=e.target.value.trim(); save(); });
}
function decode(text, shift) {
  return [...text].map(c => alphabet.includes(c) ? alphabet[(alphabet.indexOf(c)+shift+alphabet.length)%alphabet.length] : c).join('');
}
function renderCipher() {
  $('#stage-content').innerHTML = stageHeader(2, 'Восстановите входящий сигнал', 'В архиве сохранился ключ к сообщению. Терминал ждёт расшифровки.') + luma('При передаче каждую букву заменили буквой на три позиции вперёд. Найдите обратный сдвиг — и сообщение снова станет понятным.') + `
    <div class="cipher-box"><span class="task-label">Перехваченный сигнал</span><p class="cipher-message">ПГУЫУЦХ</p><span class="small">Русский алфавит без «Ё» · после «Я» снова идёт «А»</span></div>
    <div class="cipher-tool"><div class="cipher-dial" id="cipher-dial" aria-hidden="true"><span>А · Б · В · Г · Д · Е</span><strong id="dial-key">0</strong><span>СДВИГ ПРИ ЧТЕНИИ</span></div><div><label class="range-field" for="cipher-key">Выберите сдвиг для чтения <output id="cipher-key-value">0</output><input type="range" id="cipher-key" min="-5" max="5" step="1" value="${escapeHtml(field('cipherKey','0'))}"></label><p class="small">Попробуйте сдвинуть буквы в обратную сторону. Например, при сдвиге −3 буква «Г» превращается в «А».</p><div class="decoded-preview" aria-live="polite"><span class="task-label">Декодер</span><strong id="decoded-preview"></strong></div></div></div>
    <details class="hint-box"><summary>Посмотреть алфавит и подсказку</summary><p class="alphabet-scroll">${alphabet.split('').join(' ')}</p><p>Найдите «П» и сделайте три шага назад. Получится первая буква исходного слова. Повторите правило для остальных букв.</p></details>
    <form id="cipher-form"><label class="field" for="cipher-answer">Какое слово получилось?<input id="cipher-answer" data-field="cipherAnswer" value="${escapeHtml(field('cipherAnswer'))}" maxlength="30" autocomplete="off" required placeholder="Запишите расшифрованное слово"></label><p class="small">Прочитайте слово вслух и объясните друг другу, как его восстановили. Этот простой шифр используется для обучения, не для защиты важных данных.</p><div class="stage-actions"><button type="button" class="button-secondary" data-step="0">← Назад</button><button type="submit" class="button-primary">Проверить сигнал →</button></div><p class="inline-feedback" id="cipher-feedback" role="status"></p></form>`;
  const update = () => { const n=Number($('#cipher-key').value); $('#cipher-key-value').textContent=n>0?`+${n}`:n; $('#dial-key').textContent=n>0?`+${n}`:n; $('#decoded-preview').textContent=decode('ПГУЫУЦХ',n); $('#cipher-dial').style.setProperty('--dial-turn',`${n*11}deg`); m.fields.cipherKey=String(n); save(); };
  $('#cipher-key').addEventListener('input',update); update();
  $('#cipher-form').addEventListener('submit',e=>{e.preventDefault();const answer=$('#cipher-answer').value.trim().toUpperCase();if(Number($('#cipher-key').value)!==-3||answer!=='МАРШРУТ'){feedback('#cipher-feedback','Проверьте направление сдвига: при передаче было +3, при чтении нужен обратный шаг.');return;}m.fields.cipherAnswer=answer;lore.markMilestone('cipher');goStep(2,true);});
}
function sufficientTrials() { return m.trials.length >= 2 && new Set(m.trials.map(winner)).size >= 2; }
function renderLab() {
  const speedA = field('speedA','3'), speedB = field('speedB','2');
  $('#stage-content').innerHTML = stageHeader(3, 'Терминал восстановлен. Испытаем тележки.', 'Сделайте прогноз, проведите опыт, затем измените настройки и проверьте результат.') + luma('Входящий сигнал прочитан: «МАРШРУТ». До станции — 12 метров. Тележки стартуют одновременно. Кому доверим маяк? Сначала соберём данные — мне нужны хотя бы два опыта с разным результатом.') + `
    <div class="lab-grid"><div><div class="lab-viewport"><div class="viewport-toolbar"><span class="pill">Терминал включён · маршрут 12 м</span><span class="lab-time" id="lab-clock">0,0 с</span></div><div class="lab-scene" id="lab-scene" role="img" aria-label="Трёхмерная модель: две тележки на параллельных дорожках одинаковой длины"></div><div class="fallback-tracks" id="fallback-tracks" hidden><p class="small">3D недоступно на этом устройстве. Плоская модель сохраняет те же условия и результаты.</p><div class="fallback-lane"><span class="fallback-cart cart-a" id="fallback-a">А</span></div><div class="fallback-lane"><span class="fallback-cart cart-b" id="fallback-b">Б</span></div></div><div class="scene-controls" role="group" aria-label="Камера"><button type="button" class="button-secondary" data-view="perspective" aria-pressed="true">Объём</button><button type="button" class="button-secondary" data-view="top" aria-pressed="false">Сверху</button><button type="button" class="button-secondary" data-view="side" aria-pressed="false">Сбоку</button><label class="fog-control"><input type="checkbox" id="fog-toggle" checked> Туман</label></div></div><p class="small" id="scene-instructions">Сцену можно вращать перетаскиванием. Колесо мыши приближает камеру; на телефоне используйте кнопки вида.</p><p class="lab-status" id="lab-status" role="status">Подготавливаем полевой стенд…</p></div>
    <aside class="lab-controls"><p class="eyebrow">Условия опыта</p><label class="range-field speed-a" for="speed-a">Тележка А <output id="speed-a-value">${escapeHtml(speedA)} м/с</output><input id="speed-a" type="range" min="1" max="4" step="0.5" value="${escapeHtml(speedA)}"></label><label class="range-field speed-b" for="speed-b">Тележка Б <output id="speed-b-value">${escapeHtml(speedB)} м/с</output><input id="speed-b" type="range" min="1" max="4" step="0.5" value="${escapeHtml(speedB)}"></label><p class="small">3 м/с: за каждую секунду тележка проходит 3 метра.</p><label class="field" for="prediction">Ваш прогноз<select id="prediction"><option value="">Сначала предположите…</option><option value="a">А приедет раньше</option><option value="b">Б приедет раньше</option><option value="equal">Приедут одновременно</option></select></label><button type="button" class="button-primary" id="run-experiment" disabled>Запустить опыт →</button><div class="experiment-actions"><button type="button" class="button-secondary" id="pause-experiment" disabled>Пауза</button><button type="button" class="button-secondary" id="reset-experiment">На старт</button></div><p class="small">Изменяйте настройки до запуска. Во время опыта они зафиксированы.</p></aside></div>
    <p class="small model-note">Условия модели: прямые одинаковые дорожки, одновременный старт, постоянные скорости. Сопротивление и разгон не учитываются.</p><div class="experiment-summary" id="experiment-summary"></div><div class="section-heading journal-heading"><h3>Журнал наблюдений</h3><span class="small" id="trial-count"></span></div><div class="trial-table-wrap" id="trial-table"></div><p class="inline-feedback" id="trial-feedback" role="status"></p>` + actions(1,3,'Проверить объяснение →',!sufficientTrials());
  renderTrials();
  $('#prediction').value=field('prediction');
  ['a','b'].forEach(letter => $('#speed-'+letter).addEventListener('input',event=>{
    const v=Number(event.target.value); $('#speed-'+letter+'-value').textContent=format(v)+' м/с';m.fields[letter==='a'?'speedA':'speedB']=String(v);$('#prediction').value='';m.fields.prediction='';save();
  }));
  $('#prediction').addEventListener('change',e=>{m.fields.prediction=e.target.value;save();});
  $('#run-experiment').addEventListener('click',runExperiment);
  $('#pause-experiment').addEventListener('click',togglePause);
  $('#reset-experiment').addEventListener('click',resetExperiment);
  $$('[data-view]').forEach(button=>button.addEventListener('click',()=>{labScene?.setView(button.dataset.view);$$('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));
  $('#fog-toggle').addEventListener('change',e=>labScene?.setFog(e.target.checked));
  initLab();
}
async function initLab() {
  const generation=labGeneration;
  try {
    const {createExpeditionScene}=await loadSceneModule();
    if(generation!==labGeneration||$('#mission-view').hidden||m.step!==2)return;
    labScene=createExpeditionScene($('#lab-scene'),{mode:'lab',onComplete:finishExperiment,onError:()=>{if(generation===labGeneration)enableFallback();}});
    if(generation!==labGeneration){labScene.dispose();labScene=null;return;}
    labScene.setFog(true);labScene.setStoryState({awakened:true,signalRestored:false});labScene.setEmotion('curious');
    $('#lab-status').textContent='Стенд готов. Выберите скорости и сделайте прогноз.';
  } catch (_) { if(generation!==labGeneration)return;enableFallback(); }
  labReady=true; if($('#run-experiment'))$('#run-experiment').disabled=false;
}
function enableFallback() {
  labScene?.dispose();labScene=null;clearInterval(fallbackTimer);clearInterval(clockTimer);activeRun=null;paused=false;
  const host=$('#lab-scene');if(!host)return;
  host.style.visibility='hidden';$('#fallback-tracks').hidden=false;$('#scene-instructions').textContent='Плоская модель: сравнивайте движение по одинаковым дорожкам.';$$('[data-view], #fog-toggle').forEach(el=>el.disabled=true);
  $('#lab-status').textContent='Доступна плоская модель. Выберите скорости и сделайте прогноз.';labReady=true;setRunningUI(false);
}
function setRunningUI(running) {
  if(!$('#run-experiment'))return;
  $('#run-experiment').disabled=running||!labReady;
  ['#speed-a','#speed-b','#prediction'].forEach(id=>$(id).disabled=running);
  $('#pause-experiment').disabled=!running;
  $('#pause-experiment').textContent='Пауза';
}
function lumaSpeak(text, emotion = 'curious') {
  const el=$('#stage-content .luma-note p');if(el)el.textContent=text;
  labScene?.setEmotion(emotion);
}
function runExperiment() {
  if(activeRun||!labReady)return;
  const prediction=$('#prediction').value;
  if(!prediction){feedback('#trial-feedback','Сначала выберите прогноз. Его можно проверить — угадывать не обязательно.');$('#prediction').focus();return;}
  const speedA=Number($('#speed-a').value),speedB=Number($('#speed-b').value);
  lumaSpeak(m.trials.length ? 'Вы изменили или повторили настройки. Проверим, сохраняется ли прежний результат. Я фиксирую прогноз команды.' : 'Прогноз записан. Я держу связь, а вы наблюдайте за обеими тележками.','thinking');
  activeRun={speedA,speedB,distance:12,prediction};paused=false;setRunningUI(true);feedback('#trial-feedback','Идёт наблюдение. Настройки зафиксированы.',false);
  $('#lab-status').textContent='Тележки стартовали одновременно. Наблюдайте за движением.';
  $('#experiment-summary').textContent='';
  if(labScene){labScene.run(activeRun);clockTimer=setInterval(()=>{const el=$('#lab-clock'),host=$('#lab-scene');if(el&&host)el.textContent=format(Number(host.dataset.elapsed||0))+' с';},120);}
  else {fallbackElapsed=0;fallbackStart=performance.now();fallbackTimer=setInterval(tickFallback,50);}
}
function tickFallback(){
  if(!activeRun||paused)return;
  const seconds=fallbackElapsed+(performance.now()-fallbackStart)/1000;
  $('#lab-clock').textContent=format(Math.min(seconds,Math.max(12/activeRun.speedA,12/activeRun.speedB)))+' с';
  for(const letter of ['a','b']){const v=activeRun[letter==='a'?'speedA':'speedB'];$('#fallback-'+letter).style.left=`calc(${Math.min(v*seconds/12,1)*100}% - ${Math.min(v*seconds/12,1)*36}px)`;}
  if(seconds>=Math.max(12/activeRun.speedA,12/activeRun.speedB))finishExperiment({...activeRun,timeA:12/activeRun.speedA,timeB:12/activeRun.speedB});
}
function finishExperiment(result){
  if(!activeRun||m.step!==2||$('#mission-view').hidden)return;
  clearInterval(fallbackTimer);clearInterval(clockTimer);
  // Fixed-distance uniform motion is the single source of recorded results.
  const trial={...activeRun,timeA:activeRun.distance/activeRun.speedA,timeB:activeRun.distance/activeRun.speedB};
  if(Math.abs(result.timeA-trial.timeA)>1e-5||Math.abs(result.timeB-trial.timeB)>1e-5){resetExperiment();feedback('#trial-feedback','Не удалось подтвердить результаты модели. Повторите опыт.');return;}
  m.trials.push(trial);m.fields.prediction=activeRun.prediction;activeRun=null;paused=false;save();setRunningUI(false);
  $('#lab-clock').textContent=format(Math.max(trial.timeA,trial.timeB))+' с';
  $('#lab-status').textContent='Опыт завершён. Результат добавлен в журнал.';
  const resultName=winnerText(winner(trial)), matched=trial.prediction===winner(trial);
  $('#experiment-summary').innerHTML=`<div class="mini-stat"><span>Тележка А</span><strong>${format(trial.timeA)} с</strong></div><div class="mini-stat"><span>Тележка Б</span><strong>${format(trial.timeB)} с</strong></div><div class="prediction-result"><strong>${resultName}</strong><p>${matched?'Прогноз подтвердился. Теперь проверьте другие настройки.':'Прогноз изменился после проверки. Это полезный результат исследования.'}</p></div>`;
  lore.markMilestone('firstTrial');if(sufficientTrials())lore.markMilestone('alternative');
  lumaSpeak(matched ? (sufficientTrials() ? 'Теперь у нас есть разные результаты. Хорошо, что мы проверили другие настройки. Можно готовить протокол.' : 'Прогноз подтвердился. Но один опыт описывает только эти настройки. Что изменим для следующей проверки?') : 'Моя память тоже иногда подсказывает слишком уверенный ответ. Хорошо, что мы проверили его до отправки маяка. Пересмотрим предположение?',matched?'happy':'uncertain');
  renderTrials();
}
function togglePause(){
  if(!activeRun)return;paused=!paused;
  if(labScene){paused?labScene.pause():labScene.resume();}
  else if(paused){fallbackElapsed+=(performance.now()-fallbackStart)/1000;}else{fallbackStart=performance.now();}
  $('#pause-experiment').textContent=paused?'Продолжить':'Пауза';$('#lab-status').textContent=paused?'Опыт на паузе. Условия сохранены.':'Наблюдение продолжается.';
}
function resetExperiment(){
  clearInterval(fallbackTimer);clearInterval(clockTimer);activeRun=null;paused=false;labScene?.reset();
  if($('#lab-clock'))$('#lab-clock').textContent='0,0 с';
  ['a','b'].forEach(l=>{const el=$('#fallback-'+l);if(el)el.style.left='0%';});setRunningUI(false);
  if($('#lab-status'))$('#lab-status').textContent='Тележки на старте. Прошлые опыты остаются в журнале.';
}
function cleanupLab(){
  labGeneration++;clearInterval(fallbackTimer);clearInterval(clockTimer);activeRun=null;paused=false;labReady=false;
  if(labScene){labScene.dispose();labScene=null;}
}
function renderTrials(){
  const host=$('#trial-table');if(!host)return;
  $('#trial-count').textContent=`Опытов: ${m.trials.length}`;
  host.innerHTML=m.trials.length?`<table class="trial-table"><caption class="sr-only">Результаты наблюдений на одинаковом пути 12 метров</caption><thead><tr><th scope="col">Опыт</th><th scope="col">А, м/с</th><th scope="col">Б, м/с</th><th scope="col">А, с</th><th scope="col">Б, с</th><th scope="col">Прогноз</th><th scope="col">Наблюдение</th></tr></thead><tbody>${m.trials.map((t,i)=>`<tr><td>${i+1}</td><td>${format(t.speedA)}</td><td>${format(t.speedB)}</td><td>${format(t.timeA)}</td><td>${format(t.timeB)}</td><td>${winnerText(t.prediction)||'—'}</td><td><strong>${winnerText(winner(t))}</strong></td></tr>`).join('')}</tbody></table>`:'<div class="empty-state"><span aria-hidden="true">→</span><p>Первый опыт начнётся с вашего предположения.<br>Результаты появятся здесь автоматически.</p></div>';
  const enough=sufficientTrials();$('#stage-next').disabled=!enough;
  feedback('#trial-feedback',enough?'Два разных результата получены. Теперь можно проверить объяснение.':m.trials.length?'Измените настройки так, чтобы результат был другим: например, поменяйте скорости местами или сделайте их равными.':'Проведите хотя бы два опыта с разным результатом.',false);
}
function assistantClaim(){
  const first=m.trials[0];if(!first)return '';
  return winner(first)==='equal'?'В первом опыте тележки приехали одновременно. Значит, они будут приезжать одновременно при любых настройках.':`В первом опыте тележка ${winner(first).toUpperCase()==='A'?'А':'Б'} приехала раньше. Значит, она всегда будет быстрее второй тележки — настройки можно больше не проверять.`;
}
function renderVerification(){
  $('#stage-content').innerHTML=stageHeader(4,'Подготовьте протокол ЛУМЫ','Проверьте запись архива и восстановите порядок исследования перед отправкой маяка.')+luma('Архив автоматически обобщил наш первый опыт. Раньше я бы просто поверил этой записи. А теперь хочу проверить её вместе с вами. Найдите подходящий опыт.')+`
    <article class="version-card"><span class="scenario-label">Сценарная версия для проверки</span><blockquote>${assistantClaim()}</blockquote><p class="small">Это заранее подготовленная реплика для задания. Живая нейросеть к сайту пока не подключена.</p></article>
    <form id="verification-form"><fieldset class="plain-fieldset"><legend>Можно ли принять такой вывод?</legend><div class="choice-grid"><label class="radio-card"><input type="radio" name="verdict" value="accept" ${field('verdict')==='accept'?'checked':''} required> Да, одного опыта достаточно для всех настроек.</label><label class="radio-card"><input type="radio" name="verdict" value="check" ${field('verdict')==='check'?'checked':''}> Нужно сопоставить его с другими опытами.</label></div></fieldset><label class="field" for="counter-trial">Какой опыт опровергает слово «всегда»?<select id="counter-trial" data-field="counterTrial" required><option value="">Выберите из своего журнала…</option>${m.trials.map((t,i)=>`<option value="${i}" ${field('counterTrial')===String(i)?'selected':''}>Опыт ${i+1}: ${winnerText(winner(t))}; А=${format(t.speedA)}, Б=${format(t.speedB)} м/с</option>`).join('')}</select></label><label class="field" for="evidence">Объясните, почему версия не выдержала проверку<textarea id="evidence" data-field="evidence" minlength="10" maxlength="2000" required placeholder="Сравните конкретные опыты. Что изменилось и что это показало?">${escapeHtml(field('evidence'))}</textarea></label>
    <h3>Подготовьте протокол ЛУМЫ</h3><p>Переставьте шаги стрелками. По этому протоколу я проверю решение перед отправкой маяка, а следующая команда сможет повторить нашу работу.</p><ol class="algorithm-list" id="algorithm-list"></ol><p class="inline-feedback" id="verification-feedback" role="status"></p><div class="stage-actions"><button type="button" class="button-secondary" data-step="2">← К опытам</button><button type="submit" class="button-primary">Проверить и перейти к атласу →</button></div></form>`;
  renderAlgorithm();
  $$('input[name="verdict"]').forEach(el=>el.addEventListener('change',e=>{m.fields.verdict=e.target.value;save();}));
  $('#verification-form').addEventListener('submit',e=>{
    e.preventDefault();m.fields.verdict=$('input[name="verdict"]:checked')?.value||'';
    const index=Number($('#counter-trial').value),trial=m.trials[index];
    if(m.fields.verdict!=='check'){feedback('#verification-feedback','Один опыт описывает выбранные условия. Сравните его с опытом, где результат изменился.');return;}
    if(!trial||winner(trial)===winner(m.trials[0])){feedback('#verification-feedback','Выберите опыт с результатом, который отличается от первого. Он помогает проверить слово «всегда».');return;}
    if(m.order.some((n,i)=>n!==i)){feedback('#verification-feedback','Проверьте алгоритм: сначала нужно прочитать сообщение и задать условия, затем провести опыт и сравнить данные.');return;}
    m.fields.evidence=$('#evidence').value.trim();if(m.fields.evidence.length<10){feedback('#verification-feedback','Допишите объяснение с опорой на выбранный опыт.');return;}lore.markMilestone('verified');goStep(4,true);
  });
}
function renderAlgorithm(){
  $('#algorithm-list').innerHTML=m.order.map((id,i)=>`<li class="algorithm-item"><span class="algorithm-index">${i+1}</span><span>${algorithm[id]}</span><div class="algorithm-order"><button type="button" class="icon-button" data-move="${i}" data-direction="-1" ${i===0?'disabled':''} aria-label="Переместить шаг «${algorithm[id]}» вверх">↑</button><button type="button" class="icon-button" data-move="${i}" data-direction="1" ${i===4?'disabled':''} aria-label="Переместить шаг «${algorithm[id]}» вниз">↓</button></div></li>`).join('');
  $$('[data-move]').forEach(button=>button.addEventListener('click',()=>{const i=Number(button.dataset.move),j=i+Number(button.dataset.direction);[m.order[i],m.order[j]]=[m.order[j],m.order[i]];save();renderAlgorithm();$('#algorithm-list').querySelectorAll('.algorithm-item')[j].querySelector('button:not([disabled])')?.focus();}));
}
const reflectionLabels=[['critical','Какой вывод подтвердили или изменили после проверки?'],['creative','Какой другой опыт предложили и зачем?'],['communication','Как объяснили решение другим участникам?'],['cooperation','Как договорились и чем помог каждый?']];
function renderJournal(){
  if(m.record && !editingRecord){if(state.story.deliveryPending)renderDelivery();else renderCompletion();return;}
  const last=m.trials.at(-1);
  $('#stage-content').innerHTML=stageHeader(5,'Сохраните своё открытие','Соберите данные и объяснение в первую страницу общего атласа.')+luma('Вы восстановили сообщение и проверили свои идеи. Теперь оставьте записи так, чтобы следующая команда поняла не только ответ, но и способ проверки.')+`
    <div class="journal-summary"><span class="task-label">Последний завершённый опыт · путь 12 м</span><div class="journal-grid"><p><strong>Тележка А</strong><br>${format(last.speedA)} м/с → ${format(last.timeA)} с</p><p><strong>Тележка Б</strong><br>${format(last.speedB)} м/с → ${format(last.timeB)} с</p></div></div>
    <form id="journal-form"><label class="field" for="final-choice">Кого отправите к станции при этих настройках?<select id="final-choice" data-field="finalChoice" required><option value="">Выберите решение…</option><option value="a">Тележку А — она придёт раньше</option><option value="b">Тележку Б — она придёт раньше</option><option value="equal">Подойдёт любая — время одинаковое</option></select></label><label class="field" for="conclusion">Объяснение команды<textarea id="conclusion" data-field="conclusion" required minlength="20" maxlength="3000" placeholder="На какие данные вы опираетесь? При каких условиях справедлив ваш вывод?">${escapeHtml(field('conclusion'))}</textarea></label>
    <h3>Как вы работали вместе?</h3><p>Вспомните конкретные действия. Короткого примера достаточно.</p><div class="reflection-grid">${reflectionLabels.map(([id,label])=>`<label class="field">${label}<textarea data-field="${id}" minlength="3" maxlength="1000" required rows="3" placeholder="Ваш пример…">${escapeHtml(field(id))}</textarea></label>`).join('')}</div><p class="small">Здесь сохраняются ваши ответы для обсуждения с учителем. Автоматические оценки 4К не выставляются.</p><p class="inline-feedback" id="journal-feedback" role="status"></p><div class="stage-actions"><button type="button" class="button-secondary" data-step="3">← Назад</button><button type="submit" class="button-primary">Отправить маяк и сохранить запись →</button></div></form>`;
  $('#final-choice').value=field('finalChoice');
  $('#journal-form').addEventListener('submit',e=>{e.preventDefault();
    if($('#final-choice').value!==winner(last)){feedback('#journal-feedback','Сопоставьте решение со временем в последнем опыте. При одинаковом пути раньше придёт тележка с меньшим временем.');return;}
    m.fields.finalChoice=$('#final-choice').value;m.fields.conclusion=$('#conclusion').value.trim();
    if(m.fields.conclusion.length<20){feedback('#journal-feedback','Добавьте объяснение с конкретными данными и условиями сравнения.');return;}
    for(const [id] of reflectionLabels){const el=$(`[data-field="${id}"]`);m.fields[id]=el.value.trim();if(m.fields[id].length<3){feedback('#journal-feedback','Добавьте короткий пример в каждое поле о совместной работе.');el.focus();return;}}
    const wasRestored=signalRestored();
    m.record={date:new Date().toISOString(),team:state.team,cipher:'ПГУЫУЦХ → МАРШРУТ; сдвиг −3',trials:m.trials.map(t=>({...t})),evidence:field('evidence'),counterTrial:Number(field('counterTrial')),algorithm:algorithm.slice(),choice:field('finalChoice'),conclusion:field('conclusion'),reflections:Object.fromEntries(reflectionLabels.map(([id,label])=>[label,field(id)]))};
    editingRecord=false;if(wasRestored){save();updateProgress();renderCompletion();$('#stage-title').focus({preventScroll:true});}else{state.story.deliveryPending=true;save();updateProgress();renderDelivery({autoStart:true});}
  });
}
function cleanupDelivery(){
  deliveryGeneration++;clearTimeout(deliveryTimer);deliveryBusy=false;deliverySceneReady=false;
  if(deliveryScene){deliveryScene.dispose();deliveryScene=null;}
}
async function renderDelivery({autoStart=false}={}){
  cleanupDelivery();cleanupLab();
  const generation=deliveryGeneration;
  const record=m.record,last=record?.trials?.at(-1);
  if(!record||!last){$('#stage-content').innerHTML=stageHeader(5,'Нужны данные для отправки','В сохранённой записи не хватает завершённых опытов.')+'<button type="button" class="button-primary" data-step="2">Вернуться к наблюдениям</button>';return;}
  const cart=record.choice==='b'?'b':'a';
  const chosenName=cart==='a'?'А':'Б';
  const wasRestored=signalRestored();
  let isFallback=false,completed=false;
  $('#mission-layout').classList.add('is-finale');
  $('#stage-content').innerHTML=stageHeader(5,'Отправляем маяк к станции','Ваши данные превратились в решение. Теперь ЛУМА выполнит подготовленный протокол.')+luma(`${record.choice==='equal'?'При этих настройках обе тележки подходят. Для доставки возьмём А.':`Отправляем тележку ${chosenName}: при выбранных настройках она пройдёт путь раньше.`} Протокол проверен, маяк закреплён. Команда, начинаем?`)+`
    <div class="delivery-stage"><div class="delivery-toolbar"><span class="pill">Экспедиция «Зов Земли» · доставка маяка</span><span class="delivery-signal" id="delivery-signal">Станция молчит</span></div><div id="delivery-scene" class="delivery-scene" role="img" aria-label="Сюжетная доставка маяка выбранной тележкой к станции"></div><div class="delivery-flat" id="delivery-flat" hidden><p class="small">Схематичная доставка · 3D недоступно на этом устройстве</p><div class="delivery-flat-track"><span id="delivery-flat-cart" class="delivery-flat-cart ${cart==='b'?'is-b':''}">${chosenName}<i aria-label="маяк">◉</i></span><span class="delivery-flat-station" id="delivery-flat-station"><i></i>Станция 01</span></div></div><ol class="delivery-phases"><li id="delivery-phase-1" class="is-current">Протокол проверен</li><li id="delivery-phase-2">Маяк в пути</li><li id="delivery-phase-3">Связь восстановлена</li></ol></div>
    <p id="delivery-status" class="delivery-status" role="status">Подготавливаем отправку…</p><p class="small">Выбор основан на последнем опыте: А — ${format(last.speedA)} м/с и ${format(last.timeA)} с; Б — ${format(last.speedB)} м/с и ${format(last.timeB)} с. Доставка показана как короткая сюжетная сцена; результаты опытов остаются в журнале.</p><div class="record-actions"><button type="button" id="start-delivery" class="button-primary" disabled>Отправить маяк →</button><button type="button" id="skip-delivery" class="button-secondary">Пропустить анимацию</button><button type="button" id="delivery-finish" class="button-primary" hidden>Открыть первую запись атласа →</button></div><div class="recovered-note" id="delivery-diary-reveal" hidden><span class="eyebrow">Фрагмент архива восстановлен</span><p>В дневнике ЛУМЫ открылась запись о Туманном поле.</p><button type="button" class="text-link" data-lore-action="diary">Прочитать запись →</button></div><button type="button" class="text-link delivery-home" data-action="home">Вернуться к карте</button>`;
  function current(){return generation===deliveryGeneration&&!$('#mission-view').hidden&&Boolean($('#delivery-status'));}
  function completeSequence(){
    if(!current()||completed)return;
    completed=true;deliveryBusy=false;clearTimeout(deliveryTimer);
    state.story.deliveryPending=false;save();lore.markMilestone('completed');if(wasRestored)lore.playCue('signal');updateProgress();
    deliveryScene?.setStoryState({signalRestored:true,awakened:true});deliveryScene?.setEmotion('happy');
    $('#delivery-flat')?.classList.add('is-delivered');$('#delivery-flat-station')?.classList.add('is-lit');
    $('#delivery-signal').textContent='Станция 01 · на связи';$('#delivery-signal').classList.add('is-restored');
    $('#delivery-status').textContent='Маяк установлен. Туманное поле снова на связи. Первая запись архива восстановлена.';
    for(const id of ['1','2','3']){$('#delivery-phase-'+id).className='is-complete';}
    $('#start-delivery').hidden=true;$('#skip-delivery').hidden=true;$('#delivery-finish').hidden=false;$('#delivery-diary-reveal').hidden=false;
    $('#stage-content .luma-note p').textContent='Сигнал принят! Мы сделали это вместе. Я сохранил ваши наблюдения и восстановил первую страницу своего дневника.';
  }
  function startFlatAnimation(){
    if(!current()||completed)return;
    clearTimeout(deliveryTimer);$('#delivery-status').textContent='Тележка доставляет маяк. Продолжаем сцену в схематичном виде.';
    $('#delivery-flat').classList.add('is-moving');
    deliveryTimer=setTimeout(completeSequence,matchMedia('(prefers-reduced-motion: reduce)').matches?0:3600);
  }
  function enableDeliveryFallback(){
    if(!current()||completed)return;
    isFallback=true;deliveryScene?.dispose();deliveryScene=null;
    $('#delivery-scene').style.visibility='hidden';$('#delivery-flat').hidden=false;
    deliverySceneReady=true;$('#start-delivery').disabled=deliveryBusy;
    if(deliveryBusy)startFlatAnimation();else $('#delivery-status').textContent='Маяк готов. Доступна схематичная доставка с тем же решением команды.';
  }
  async function startSequence(){
    if(!current()||completed||deliveryBusy||!deliverySceneReady)return;
    deliveryBusy=true;$('#start-delivery').disabled=true;
    $('#delivery-phase-1').className='is-complete';$('#delivery-phase-2').className='is-current';
    $('#delivery-status').textContent=`Тележка ${chosenName} отправилась к станции. ЛУМА держит связь.`;
    lore.playCue('checkpoint');
    if(isFallback){startFlatAnimation();return;}
    try{
      const result=await deliveryScene.deliverBeacon({cart,speedA:last.speedA,speedB:last.speedB,distance:12});
      if(!current()||completed)return;
      if(result.delivered)completeSequence();
      else if(!isFallback){deliveryBusy=false;$('#start-delivery').disabled=false;$('#delivery-status').textContent='Отправка остановлена. Запись сохранена; маяк можно отправить снова.';}
    }catch(_){if(current()&&!completed)enableDeliveryFallback();}
  }
  $('#start-delivery').addEventListener('click',startSequence);
  $('#skip-delivery').addEventListener('click',()=>{if(!current())return;deliveryScene?.reset();completeSequence();});
  $('#delivery-finish').addEventListener('click',()=>{renderCompletion();$('#stage-title')?.focus({preventScroll:true});});
  try{
    const {createExpeditionScene}=await loadSceneModule();
    if(!current()||completed)return;
    deliveryScene=createExpeditionScene($('#delivery-scene'),{mode:'delivery',onError:enableDeliveryFallback});
    deliveryScene.setStoryState({awakened:true,signalRestored:false});deliveryScene.setFog(true);
    deliverySceneReady=true;$('#start-delivery').disabled=false;$('#delivery-status').textContent='Протокол принят. Тележка и маяк готовы к отправке.';
  }catch(_){if(current())enableDeliveryFallback();}
  if(autoStart&&current()&&!completed)startSequence();
}

function renderCompletion(){
  cleanupDelivery();$('#mission-layout').classList.remove('is-finale');
  const record=m.record;
  $('#stage-content').innerHTML=`<div class="success-banner"><div class="signal-complete" aria-hidden="true">◉</div><p class="eyebrow">Первый сигнал восстановлен</p><h2 id="stage-title" tabindex="-1">У станции снова есть связь.</h2><p>Маяк доставлен. Туманное поле снова на связи, а ваши записи помогут следующей экспедиции.</p></div>`+luma('Мы проверяли, меняли предположения и договаривались. Теперь этим записям можно дать дорогу. Спасибо, команда!')+`<article class="atlas-entry"><p class="eyebrow">Страница 01 · Туманное поле</p><h3>Ваше объяснение</h3><p>${escapeHtml(record.conclusion)}</p><span class="pill">Завершено опытов: ${record.trials?.length||0}</span></article><div class="record-actions"><button type="button" class="button-primary" data-export="txt">Скачать страницу атласа ↓</button><button type="button" class="button-secondary" data-action="edit-record">Обновить объяснение</button><button type="button" class="button-secondary" data-open="atlas">Посмотреть весь результат</button></div><div class="recovered-note"><span class="eyebrow">Дневник ЛУМЫ · запись 01 восстановлена</span><p>«Раньше я выбирал самый уверенный ответ. Сегодня ваша команда выбрала тот, который выдержал проверку».</p><button type="button" class="text-link" data-lore-action="diary">Открыть дневник →</button></div><div class="record-actions"><button type="button" class="button-secondary" data-action="replay-delivery">Ещё раз посмотреть доставку маяка</button></div><div class="stage-actions"><button type="button" class="text-link" data-step="2">Вернуться в лабораторию</button><button type="button" class="text-link" data-action="home">На карту экспедиции →</button></div><p class="small">${storageAvailable?'Запись сохранена в этом браузере.':'Автосохранение недоступно.'} Скачайте её, чтобы передать учителю. Другие станции будут добавлены позже.</p>`;
}
function openPanel(title,label,html){
  if(activeRun&&!paused)togglePause();
  $('#panel-label').textContent=label;$('#panel-body').innerHTML=`<section class="dialog-content"><h2 id="panel-title">${title}</h2>${html}</section>`;if(!panel.open)panel.showModal();panel.scrollTop=0;
}
function atlas(){
  const record=m.record;
  const pendingNote = record && state.story.deliveryPending ? '<p class="note">Запись проверена и сохранена. Осталось отправить маяк и восстановить связь со станцией.</p><button type="button" class="button-primary" data-action="resume-delivery">Продолжить доставку →</button>' : '';
  const draftNote = record && record.trials.length !== m.trials.length ? '<p class="note">В черновике есть новые опыты. Чтобы включить их в сохранённую страницу, обновите объяснение.</p><button type="button" class="button-secondary" data-action="edit-record">Обновить страницу атласа</button>' : '';
  const recordHtml=record?`<article class="atlas-entry"><p class="eyebrow">01 · Туманное поле</p><h3>Сообщение сквозь туман</h3><p><strong>Команда:</strong> ${escapeHtml(record.team||'Исследователи')}</p><p><strong>Сигнал:</strong> ${escapeHtml(record.cipher)}</p><p><strong>Опыты:</strong> ${record.trials.length} · одинаковый путь 12 м</p><div class="trial-table-wrap"><table class="trial-table"><thead><tr><th scope="col">Опыт</th><th scope="col">А, м/с</th><th scope="col">Б, м/с</th><th scope="col">А, с</th><th scope="col">Б, с</th></tr></thead><tbody>${record.trials.map((t,i)=>`<tr><td>${i+1}</td><td>${format(t.speedA)}</td><td>${format(t.speedB)}</td><td>${format(t.timeA)}</td><td>${format(t.timeB)}</td></tr>`).join('')}</tbody></table></div><p><strong>Проверка версии:</strong> ${escapeHtml(record.evidence)}</p><h3>Вывод</h3><p>${escapeHtml(record.conclusion)}</p><h3>Командная работа</h3>${Object.entries(record.reflections||{}).map(([label,text])=>`<p><strong>${escapeHtml(label)}</strong><br>${escapeHtml(text)}</p>`).join('')}</article><div class="record-actions"><button class="button-primary" type="button" data-export="txt">Скачать TXT ↓</button><button class="button-secondary" type="button" data-export="json">Данные опытов · JSON ↓</button></div>`:`<div class="empty-state"><h3>Первая страница ещё впереди</h3><p>${m.trials.length?`В черновике уже ${m.trials.length} опытов. Продолжите миссию, чтобы сохранить общий вывод.`:'Расшифруйте сигнал, испытайте тележки и объясните результат.'}</p><button class="button-primary" type="button" data-action="open-mission">${m.unlocked?'Продолжить':'Начать'} миссию →</button></div>`;
  const legacyHtml=legacy.entry?.reason?`<details class="hint-box"><summary>Запись из предыдущего прототипа</summary><p>${escapeHtml(legacy.entry.reason)}</p></details>`:'';
  openPanel('Наш атлас','Открытия вашей команды',pendingNote+recordHtml+draftNote+legacyHtml+'<p class="small">Данные хранятся только в этом браузере. Они не отправляются учителю автоматически. Скачайте файл, чтобы сохранить копию или передать результат.</p>');
}
function exportRecord(type){
  if(!m.record)return;
  const r=m.record;
  const text=type==='json'?JSON.stringify(r,null,2):`ЗОВ ЗЕМЛИ — АТЛАС ВОССТАНОВЛЕННЫХ СИГНАЛОВ\nСтанция 01. Туманное поле\nКоманда: ${r.team||'Исследователи'}\n\nСИГНАЛ\n${r.cipher}\n\nНАБЛЮДЕНИЯ В МОДЕЛИ\nПуть 12 м, одинаковый для обеих тележек; одновременный старт; постоянные скорости.\n${r.trials.map((t,i)=>`Опыт ${i+1}: А=${format(t.speedA)} м/с, Б=${format(t.speedB)} м/с; времена А=${format(t.timeA)} с, Б=${format(t.timeB)} с. Прогноз: ${winnerText(t.prediction)}. Наблюдение: ${winnerText(winner(t))}.`).join('\n')}\n\nПРОВЕРКА СЦЕНАРНОЙ ВЕРСИИ\n${r.evidence}\nОпыт для проверки: ${r.counterTrial+1}.\n\nАЛГОРИТМ\n${r.algorithm.map((s,i)=>`${i+1}. ${s}`).join('\n')}\n\nОБЪЯСНЕНИЕ КОМАНДЫ\n${r.conclusion}\n\nКОМАНДНАЯ РАБОТА\n${Object.entries(r.reflections).map(([k,v])=>`${k}\n${v}`).join('\n\n')}\n\nВремя записи (UTC): ${r.date}\n`;
  const url=URL.createObjectURL(new Blob([type==='json'?text:'\uFEFF'+text],{type:type==='json'?'application/json;charset=utf-8':'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`zov-zemli-mission-01.${type}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function team(){
  openPanel('Наша команда','Вместе легче проверять идеи',`<p>Выберите, кто начнёт с каждой роли. На следующей станции поменяйтесь. Если вас трое, две роли можно совместить.</p><ul>${roles.map((r,i)=>`<li><strong>${r}</strong> — ${['предлагает наблюдение и следит за условиями.','помогает с таблицей, шифром и алгоритмом.','сопоставляет версии с данными.','помогает договориться и представить решение.'][i]}</li>`).join('')}</ul><p class="note">Каждый участвует в обсуждении. Роли не ограничивают право задавать вопросы и предлагать решения.</p><form id="team-form"><label class="field">Название команды — без фамилий<input id="team-name" value="${escapeHtml(state.team)}" maxlength="50" placeholder="Например, Искатели сигналов"></label><button class="button-primary" type="submit">Сохранить название</button></form>`);
  $('#team-form').addEventListener('submit',e=>{e.preventDefault();state.team=$('#team-name').value.trim();save();panel.close();if(!$('#mission-view').hidden&&m.step===0)renderStep();toast('Название команды сохранено.');});
}
function teacher(){
  openPanel('Первая станция: как провести занятие','Для учителя',`<p>«Сообщение сквозь туман» — законченный пробный этап межпредметного проекта для 6 класса. Ориентир: одно занятие 35–45 минут, с корректировкой по темпу группы.</p><h3>Порядок работы</h3><ol><li>Распределить роли и сформулировать общую задачу.</li><li>Восстановить сообщение по шифру Цезаря.</li><li>Сделать прогноз и провести минимум два опыта с разными исходами.</li><li>Проверить чрезмерное обобщение по данным; собрать алгоритм.</li><li>Объяснить выбор для последних настроек, выполнить рефлексию и скачать страницу атласа.</li></ol><h3>Физическая модель</h3><p>Обе тележки движутся равномерно по прямым дорожкам длиной 12 м и начинают одновременно. Скорости задаются от 1 до 4 м/с. Время определяется как путь, делённый на скорость; требовать формулу от детей для прохождения не нужно. Разгон, трение и сопротивление не моделируются. Это наблюдения в цифровой модели, а не реальные измерения природы.</p><h3>Информатика</h3><p>Правило кодирования и декодирования; организация данных в таблице; составление алгоритма; представление результата.</p><h3>Материал для наблюдения 4К</h3><p>Смотрите, как дети проверяют предположения, предлагают другой опыт, объясняют вывод и договариваются. Ответы рефлексии сохраняются в атлас. Автоматической диагностики или оценки развития 4К нет.</p><p class="note">Версия помощника на шаге 4 — сценарное задание. Подключённой нейросети нет. Физическое содержание подлежит совместному согласованию с автором физической части ВКР.</p><h3>История экспедиции</h3><p>Вступление запускается при первом входе в миссию. Его можно пропустить или повторить с главной. Проверенные задания приводят к сюжетной доставке маяка; её можно пропустить без потери результата. Дневник раскрывает записи по реальному прогрессу. Звук по умолчанию выключен.</p><h3>Доступность и данные</h3><p>Камера управляется мышью или кнопками видов. Если WebGL недоступен, предлагается плоская модель с теми же условиями. Черновик хранится в браузере, без регистрации, аналитики и отправки на сервер. Итог выгружается в TXT или JSON.</p>`);
}
async function initHero(){
  const mount=$('#hero-scene');
  try{const {createExpeditionScene}=await loadSceneModule();heroScene=createExpeditionScene(mount,{mode:'hero',onError:()=>{mount.hidden=true;$('#hero-fallback').hidden=false;$('#hero-hint').textContent='ЛУМА готов к экспедиции';}});lore?.sync();$('#hero-fallback').hidden=true;$('#hero-hint').textContent=matchMedia('(pointer:fine)').matches?'Подвигайте мышью — ЛУМА вас заметит':'ЛУМА готов к экспедиции';}
  catch(_){mount.hidden=true;$('#hero-fallback').hidden=false;}
  const art=$('#hero-interactive');const area=$('.hero');const reduced=matchMedia('(prefers-reduced-motion: reduce)');let pointerFrame;
  area.addEventListener('pointermove',event=>{if(event.pointerType==='touch'||reduced.matches)return;const rect=area.getBoundingClientRect();const x=(event.clientX-rect.left)/rect.width*2-1,y=(event.clientY-rect.top)/rect.height*2-1;cancelAnimationFrame(pointerFrame);pointerFrame=requestAnimationFrame(()=>{art.style.setProperty('--pointer-x',String(x));art.style.setProperty('--pointer-y',String(y));heroScene?.setPointer(x,-y);});});
  area.addEventListener('pointerleave',()=>{cancelAnimationFrame(pointerFrame);art.style.setProperty('--pointer-x','0');art.style.setProperty('--pointer-y','0');heroScene?.setPointer(0,0);});
}
const screens={atlas,team,teacher};
document.addEventListener('click',event=>{
  const menu = event.target.closest('[data-menu-toggle]');
  if (menu) {
    const header = $('#site-header');
    const open = header.classList.toggle('is-menu-open');
    header.dataset.menuOpen = String(open);
    menu.setAttribute('aria-expanded', String(open));
    return;
  }
  const open=event.target.closest('[data-open]');if(open){screens[open.dataset.open]?.();return;}
  const action=event.target.closest('[data-action]');if(action){event.preventDefault();if(action.dataset.action==='edit-record'){if(panel.open)panel.close();editingRecord=true;m.step=4;openMission();}else if(action.dataset.action==='replay-delivery'||action.dataset.action==='resume-delivery'){if(panel.open)panel.close();m.step=4;openMission();renderDelivery({autoStart:true});}else if(action.dataset.action==='open-mission')requestMission();else if(action.dataset.action==='route')home(true);else home();return;}
  const step=event.target.closest('[data-step]');if(step&&!step.disabled){goStep(Number(step.dataset.step));return;}
  const next=event.target.closest('[data-advance]');if(next&&!next.disabled){const n=Number(next.dataset.advance);if(n===3&&!sufficientTrials())return;if(n===1)lore.markMilestone('accepted');goStep(n,true);return;}
  const station=event.target.closest('[data-station]');if(station){toast(`${station.dataset.station}: эта станция появится в следующем этапе.`);return;}
  const download=event.target.closest('[data-export]');if(download)exportRecord(download.dataset.export);
});
document.addEventListener('input',event=>{const el=event.target;if(el.dataset.field){m.fields[el.dataset.field]=el.value;save();}});
document.addEventListener('change',event=>{const el=event.target;if(el.dataset.field){m.fields[el.dataset.field]=el.value;save();}});
$('#close-panel').addEventListener('click',()=>panel.close());
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&activeRun&&!paused){togglePause();toast('Опыт поставлен на паузу. Продолжите, когда вернётесь.');}
});
window.addEventListener('pagehide',()=>{save();cleanupDelivery();cleanupLab();heroScene?.dispose();heroScene=null;});
window.addEventListener('pageshow',event=>{if(event.persisted){initHero();if(!$('#mission-view').hidden)renderStep();}});
lore=createLore({state,save,onMission:openMission,getHeroScene:()=>heroScene,pauseLab:()=>{if(activeRun&&!paused)togglePause();},announce:toast});
updateProgress();initHero();
if(location.hash==='#mission')openMission();
