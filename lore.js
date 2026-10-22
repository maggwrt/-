/** Story layer for Zov Zemli. Native dialogs, local journal and opt-in audio. */
export function createLore({ state, save, onMission, getHeroScene = () => null, pauseLab = () => {}, announce = () => {} }) {
  if (!state || typeof state !== 'object') throw new TypeError('createLore needs a state object');
  const ids = ['accepted', 'cipher', 'firstTrial', 'alternative', 'verified', 'completed'];
  const messages = {
    accepted: ['Команда вышла на связь', 'У нас появился общий вопрос: как доставить маяк к станции?'],
    cipher: ['Сигнал прочитан', 'Команда восстановила сообщение по правилу замены букв.'],
    firstTrial: ['Первое наблюдение', 'В журнале появились результаты завершённого опыта.'],
    alternative: ['Проверена другая возможность', 'Изменённые настройки дали другой результат. Одного опыта было недостаточно.'],
    verified: ['Запись архива исправлена', 'Команда сопоставила объяснение с наблюдениями и восстановила алгоритм исследования.'],
    completed: ['Маяк доставлен', 'Первая станция снова на связи. Объяснение команды сохранено в атласе.'],
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const short = (value, limit = 600) => typeof value === 'string' ? value.slice(0, limit) : '';
  const record = value => value && typeof value === 'object' && !Array.isArray(value);
  const story = record(state.story) ? state.story : {};
  state.story = story;
  story.introSeen = story.introSeen === true;
  story.sound = story.sound === true;
  story.deliveryPending = story.deliveryPending === true;
  story.milestones = Array.isArray(story.milestones) ? [...new Set(story.milestones.filter(id => ids.includes(id)))] : [];
  story.journal = Array.isArray(story.journal) ? story.journal.filter(entry => record(entry) && ids.includes(entry.id)).map(entry => ({id:entry.id, at:short(entry.at,50), note:short(entry.note)})).slice(-24) : [];

  let disposed = false;
  let introIndex = 0;
  let hasStartedIntro = false;
  let introReplay = false;
  let draftTeam = short(state.team, 50);
  let diaryEntry = '00';
  let context;
  let soundBusy = false;
  const playing = new Set();
  const uid = 'luma-lore';
  const $ = (selector, root = document) => root.querySelector(selector);
  const introDialog = document.createElement('dialog');
  introDialog.id = `${uid}-intro`;
  introDialog.className = 'lore-dialog lore-intro';
  introDialog.setAttribute('aria-labelledby', `${uid}-intro-title`);
  const diaryDialog = document.createElement('dialog');
  diaryDialog.id = `${uid}-diary`;
  diaryDialog.className = 'lore-dialog lore-diary';
  diaryDialog.setAttribute('aria-labelledby', `${uid}-diary-title`);
  document.body.append(introDialog, diaryDialog);

  function persist() {
    try { save?.(); }
    catch (_) { announce('Не удалось сохранить дневник в браузере. Не закрывайте страницу до выгрузки атласа.'); }
  }
  function restored() { return Boolean(state.mission?.record && !story.deliveryPending); }
  function hero(method, value) {
    try { getHeroScene()?.[method]?.(value); } catch (_) { /* Story remains available without WebGL. */ }
  }
  function syncHero() {
    hero('setStoryState', { awakened: story.introSeen || Number(state.mission?.unlocked)>0 || Boolean(state.mission?.record) || (hasStartedIntro && introIndex > 0), signalRestored: restored() });
  }
  function portrait(awake = true, expression = 'curious') {
    return `<svg class="lore-portrait ${awake?'is-awake':'is-asleep'}" viewBox="0 0 240 205" aria-hidden="true">
      <path class="lore-portrait-wire" d="M125 40V19m-33 31-3-11m76 99 16 12v18"/>
      <circle class="lore-antenna" cx="125" cy="15" r="6"/>
      <rect class="lore-portrait-shell" x="48" y="40" width="145" height="114" rx="28" transform="rotate(-3 120 100)"/>
      <rect class="lore-portrait-ear" x="35" y="78" width="17" height="40" rx="8"/>
      <rect class="lore-portrait-ear" x="190" y="72" width="17" height="40" rx="8"/>
      <rect class="lore-portrait-screen" x="63" y="57" width="115" height="77" rx="18" transform="rotate(-3 120 95)"/>
      ${awake ? expression==='happy' ? '<path class="lore-face" d="M88 92q6-14 13 0m35-2q6-14 13 0M108 113q12 11 24-2"/>' : '<path class="lore-face" d="M92 88v8m50-10v8M113 111q8 4 15-1"/>' : '<path class="lore-face lore-sleep-face" d="M85 94h15m35-2h15"/>'}
      <path class="lore-portrait-wire" d="M99 154v12m45-13v12"/>
      <rect class="lore-portrait-body" x="79" y="165" width="84" height="28" rx="11"/>
      <circle class="lore-portrait-badge" cx="121" cy="179" r="7"/>
      <path class="lore-portrait-pencil" d="M31 157l23-7 16 30-23 7z"/>
    </svg>`;
  }
  function closeOtherDialogs(except) {
    for (const dialog of document.querySelectorAll('dialog[open]')) {
      if (dialog !== except) dialog.close();
    }
  }
  function showDialog(dialog) {
    try { pauseLab(); } catch (_) {}
    closeOtherDialogs(dialog);
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
  }
  function focusIntroTitle() {
    $(`#${uid}-intro-title`, introDialog)?.focus({preventScroll:true});
  }
  function renderIntro({ focus = true } = {}) {
    if (disposed) return;
    const titles = ['Полевой терминал. Канал 01.', 'Сигнал?.. Вы меня видите?', 'Экспедиция ещё не закончена.', 'Как мне звать вашу команду?', 'Хорошо, что теперь я не один.'];
    let content = '';
    if (introIndex === 0) {
      content = '<p class="lore-terminal-line"><span aria-hidden="true">●</span> Станция молчит · архив недоступен</p><p>На краю Туманного поля сохранился старый терминал экспедиции «Зов Земли». На экране появился слабый сигнал.</p><p>Кажется, кто-то пытается с вами связаться.</p>';
    } else if (introIndex === 1) {
      content = '<p class="lore-voice">«Подождите. Вы меня видите? Я ЛУМА — исследовательский робот. Кажется, связь наконец появилась».</p><p>«Я вернулся, чтобы закончить экспедицию. Но после сбоя мои наблюдения смешались с предположениями. Я больше не уверен, каким записям можно доверять».</p>';
    } else if (introIndex === 2) {
      content = '<p>«Пять исследовательских станций замолчали. Природа работает как прежде — повреждены наши приборы, программы и записи».</p><div class="lore-station-dots" aria-label="Пять станций исследовательской сети"><span class="is-first">01</span><i></i><span>02</span><i></i><span>03</span><i></i><span>04</span><i></i><span>05</span></div><p>«Помогите восстановить сигналы и собрать атлас для следующей команды. В нём должны остаться не только ответы, но и способы их проверить».</p>';
    } else if (introIndex === 3) {
      content = `<p>«Мне понадобится команда, которая умеет задавать вопросы, пробовать и договариваться. Как записать вас в журнал?»</p><label class="lore-field" for="${uid}-team">Название команды <span>· можно придумать позже</span><input id="${uid}-team" name="team" maxlength="50" autocomplete="off" value="${esc(draftTeam)}" placeholder="Например, Искатели сигналов"></label><p class="lore-small">Придумайте общее название без фамилий и других личных данных. Оно сохранится только в этом браузере.</p>`;
    } else {
      content = `<p class="lore-registration"><span class="lore-led" aria-hidden="true"></span> Команда «${esc(short(state.team,50) || 'Исследователи')}» зарегистрирована.</p><p class="lore-voice">«Хорошо, что теперь я не один. Начнём с Туманного поля: там ещё можно перехватить сообщение станции».</p><div class="lore-plan"><span>Расшифровать сигнал</span><span aria-hidden="true">→</span><span>Проверить в опыте</span><span aria-hidden="true">→</span><span>Сохранить открытие</span></div>`;
    }
    const label = introIndex === 0 ? 'Установить связь →' : introIndex === 4 ? 'Отправиться в Туманное поле →' : 'Продолжить →';
    introDialog.innerHTML = `<div class="lore-dialog-top"><span class="lore-eyebrow">${introReplay?'Повтор знакомства':'Первый контакт'} / ${String(introIndex+1).padStart(2,'0')} из 05</span><button type="button" class="lore-close" data-lore-internal="close-intro" aria-label="Закрыть знакомство">×</button></div>
      <form id="${uid}-intro-form" class="lore-intro-form"><div class="lore-intro-grid"><div class="lore-terminal ${introIndex===0?'is-offline':''}"><div class="lore-terminal-status"><span class="lore-led" aria-hidden="true"></span>${introIndex===0?'ОЖИДАНИЕ СВЯЗИ':'ЛУМА · НА СВЯЗИ'}</div>${portrait(introIndex>0,introIndex===4?'happy':'curious')}<span class="lore-terminal-id">LUMA / FIELD UNIT 01</span></div><div class="lore-intro-copy"><h2 id="${uid}-intro-title" tabindex="-1">${titles[introIndex]}</h2>${content}</div></div>
      <div class="lore-progress" aria-label="Шаг знакомства ${introIndex+1} из 5">${titles.map((_,i)=>`<span class="${i===introIndex?'is-current':i<introIndex?'is-done':''}"></span>`).join('')}</div>
      <div class="lore-actions"><button type="button" class="lore-text-button" data-lore-internal="skip">${introReplay?'К миссии без повтора':'Пропустить знакомство'}</button><div>${introIndex>0?'<button type="button" class="lore-secondary" data-lore-internal="back">← Назад</button>':''}<button type="submit" class="lore-primary">${label}</button></div></div></form>`;
    $(`#${uid}-intro-form`,introDialog).addEventListener('submit',event => {event.preventDefault();nextIntro();});
    $(`#${uid}-team`,introDialog)?.addEventListener('input',event => {draftTeam=event.target.value.slice(0,50);});
    if (focus) focusIntroTitle();
  }
  function captureTeam() {
    const input = $(`#${uid}-team`,introDialog);
    if (input && introDialog.open) {
      draftTeam = input.value.slice(0,50);
      state.team = draftTeam.trim();
      persist();
    }
  }
  function nextIntro() {
    captureTeam();
    if (introIndex === 4) { finishIntro(); return; }
    introIndex += 1;
    if (introIndex===1) { hero('setEmotion','curious'); playCue('startup'); }
    renderIntro(); syncHero();
  }
  function finishIntro() {
    captureTeam(); story.introSeen = true; persist();
    introDialog.close(); syncHero();
    hero('setEmotion','happy');
    try { onMission?.(); } catch (_) { announce('Откройте первую миссию на карте экспедиции.'); }
  }
  function startIntro({replay=false}={}) {
    if (disposed) return;
    if (replay || story.introSeen || !hasStartedIntro) introIndex=0;
    hasStartedIntro=true; introReplay=Boolean(replay || story.introSeen);
    draftTeam=short(state.team,50);
    renderIntro({focus:false});showDialog(introDialog);focusIntroTitle();syncHero();
  }

  function diaryEntries() {
    const available00=story.introSeen || Number(state.mission?.unlocked)>0;
    return [
      {id:'00',name:'Почему я вернулся',open:available00},
      {id:'01',name:'Туманное поле',open:restored()},
      {id:'02',name:'Башня Часовщика',open:false},
      {id:'03',name:'Горный перевал',open:false},
      {id:'04',name:'Подводная пещера',open:false},
      {id:'05',name:'Пещера Теней',open:false},
    ];
  }
  function diaryDetail(entries) {
    const selected=entries.find(entry=>entry.id===diaryEntry&&entry.open);
    if (!selected) return '<div class="lore-diary-empty"><p>Первая запись появится после знакомства с ЛУМОЙ.</p><button type="button" class="lore-secondary" data-lore-action="intro">Познакомиться с ЛУМОЙ →</button></div>';
    if (selected.id==='00') return '<article class="lore-diary-detail"><span class="lore-eyebrow">Запись 00 / из полевого журнала</span><h3>Почему я вернулся</h3><p>Мы отправились в экспедицию, чтобы объяснить, как устроены знакомые явления. Я сохранял всё: наблюдения, догадки, красивые ответы. После сбоя они перемешались.</p><p>Я вернулся за самым важным — за основанием доверять своим записям. Теперь у меня есть команда. Мы будем спрашивать, проверять и оставлять понятный след для тех, кто придёт после нас.</p><p class="lore-signature">ЛУМА, исследовательская единица 01</p></article>';
    const count=Array.isArray(state.mission?.record?.trials)?state.mission.record.trials.length:0;
    return `<article class="lore-diary-detail"><span class="lore-eyebrow">Запись 01 / сигнал восстановлен</span><h3>Туманное поле</h3><p class="lore-voice">«Раньше я выбирал самый уверенный ответ. Сегодня — тот, который выдержал проверку».</p><p>Команда восстановила сообщение, сопоставила результаты опытов и доставила маяк на станцию. В атласе осталось объяснение: теперь его сможет проверить другой исследователь.</p>${count?`<p class="lore-small">В сохранённой странице атласа: ${count} ${count===1?'опыт':count>=2&&count<=4?'опыта':'опытов'}.</p>`:''}<p class="lore-signature">ЛУМА, после восстановления первого сигнала</p></article>`;
  }
  function renderDiary() {
    const entries=diaryEntries();
    if(!entries.some(e=>e.id===diaryEntry&&e.open)) diaryEntry=restored()?'01':'00';
    const logs=story.milestones.filter(id=>id!=='completed'||restored());
    diaryDialog.innerHTML=`<div class="lore-dialog-top"><span class="lore-eyebrow">Экспедиционный журнал</span><button type="button" class="lore-close" data-lore-internal="close-diary" aria-label="Закрыть дневник">×</button></div><h2 id="${uid}-diary-title" class="lore-diary-title" tabindex="-1">Дневник ЛУМЫ</h2><p class="lore-diary-intro">Записываю не только открытия, но и то, как мы к ним пришли.</p><div class="lore-diary-layout"><nav class="lore-entry-list" aria-label="Записи дневника">${entries.map(entry=>`<button type="button" data-lore-entry="${entry.id}" class="lore-entry-button ${entry.id===diaryEntry&&entry.open?'is-selected':''}" ${entry.open?'':'disabled'} aria-pressed="${entry.id===diaryEntry&&entry.open?'true':'false'}"><span class="lore-entry-number">${entry.id}</span><span><strong>${entry.name}</strong><small>${entry.open?'Открыть запись':'Запись пока недоступна'}</small></span><span class="lore-entry-state" aria-hidden="true">${entry.open?'↗':'—'}</span></button>`).join('')}</nav><div class="lore-entry-content">${diaryDetail(entries)}</div></div>${logs.length?`<section class="lore-log" aria-labelledby="${uid}-log-title"><h3 id="${uid}-log-title">Следы нашей работы</h3><ol>${logs.map(id=>`<li><span class="lore-log-dot" aria-hidden="true"></span><div><strong>${messages[id][0]}</strong><p>${messages[id][1]}</p></div></li>`).join('')}</ol></section>`:''}<div class="lore-diary-footer"><button type="button" class="lore-text-button" data-lore-action="intro">Повторить знакомство</button><p>Записи сохраняются в этом браузере.</p></div>`;
  }
  function openDiary() {
    if(disposed)return;
    captureTeam(); diaryEntry=restored()?'01':'00';renderDiary();showDialog(diaryDialog);
    $(`#${uid}-diary-title`,diaryDialog)?.focus({preventScroll:true});
  }
  function markMilestone(id,contextData={}) {
    if(disposed||!ids.includes(id)||story.milestones.includes(id))return false;
    if(id==='completed'&&!restored())return false;
    story.milestones.push(id);
    story.journal.push({id,at:new Date().toISOString(),note:short(contextData?.note)||messages[id][1]});
    story.journal=story.journal.slice(-24);persist();
    if(id==='completed')hero('setEmotion','happy');
    playCue(id==='completed'?'signal':id==='cipher'?'decoded':'checkpoint');
    sync();return true;
  }

  function effectiveSound(){return Boolean(story.sound&&context&&context.state==='running');}
  function stopSounds(){
    for(const oscillator of playing){try{oscillator.stop();}catch(_){}try{oscillator.disconnect();}catch(_){}}
    playing.clear();
  }
  async function toggleSound(){
    if(disposed||soundBusy)return;
    soundBusy=true;
    try{
      if(effectiveSound()){
        story.sound=false;stopSounds();await context.suspend();persist();
      }else{
        const Audio=window.AudioContext||window.webkitAudioContext;
        if(!Audio)throw new Error('Web Audio unavailable');
        if(!context||context.state==='closed')context=new Audio();
        await context.resume();
        if(context.state!=='running')throw new Error('Audio blocked');
        story.sound=true;persist();playCue('startup');
      }
    }catch(_){story.sound=false;stopSounds();persist();announce('Звук недоступен. Экспедиция продолжится без звуковых сигналов.');}
    finally{soundBusy=false;syncSoundButtons();}
  }
  function playCue(name){
    if(disposed||!effectiveSound())return false;
    const notes={startup:[392,523.25,659.25],decoded:[659.25,783.99],checkpoint:[523.25,659.25],signal:[392,523.25,659.25,783.99]}[name];
    if(!notes)return false;
    try{
      const now=context.currentTime;
      notes.forEach((frequency,index)=>{
        const oscillator=context.createOscillator(),gain=context.createGain(),start=now+index*.13;
        oscillator.type='sine';oscillator.frequency.value=frequency;
        gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.022,start+.015);gain.gain.exponentialRampToValueAtTime(.0001,start+.16);
        oscillator.connect(gain);gain.connect(context.destination);oscillator.start(start);oscillator.stop(start+.18);playing.add(oscillator);
        oscillator.onended=()=>{playing.delete(oscillator);oscillator.disconnect();gain.disconnect();};
      });return true;
    }catch(_){story.sound=false;persist();syncSoundButtons();return false;}
  }
  function syncSoundButtons(){
    const enabled=effectiveSound();
    for(const button of document.querySelectorAll('[data-lore-action="sound"]')){
      button.setAttribute('aria-pressed',String(enabled));
      const label=$('[data-lore-sound-label]',button)||button;
      label.textContent=enabled?'Звук: вкл.':'Включить звук';
      button.title=enabled?'Выключить звуки экспедиции':'Включить тихие звуковые сигналы';
    }
  }
  function sync(){
    if(disposed)return;
    syncHero();syncSoundButtons();
    if(diaryDialog.open)renderDiary();
  }
  function clickHandler(event){
    const target=event.target.closest('[data-lore-action],[data-lore-internal],[data-lore-entry]');
    if(!target)return;
    if(target.hasAttribute('data-lore-entry')){
      if(target.disabled)return;diaryEntry=target.dataset.loreEntry;renderDiary();
      const selected=$(`[data-lore-entry="${diaryEntry}"]`,diaryDialog);selected?.focus();return;
    }
    const action=target.dataset.loreAction;
    if(action==='intro'){event.preventDefault();startIntro({replay:true});}
    else if(action==='diary'){event.preventDefault();openDiary();}
    else if(action==='sound'){event.preventDefault();toggleSound();}
    const internal=target.dataset.loreInternal;
    if(internal==='close-intro'){captureTeam();introDialog.close();}
    else if(internal==='close-diary')diaryDialog.close();
    else if(internal==='skip')finishIntro();
    else if(internal==='back'){captureTeam();introIndex=Math.max(0,introIndex-1);renderIntro();syncHero();}
  }
  async function visibilityHandler(){
    if(!context||disposed)return;
    try{
      if(document.hidden){stopSounds();await context.suspend();}
      else if(story.sound)await context.resume();
    }catch(_){}
    syncSoundButtons();
  }
  function introCancel(){captureTeam();}
  document.addEventListener('click',clickHandler);
  document.addEventListener('visibilitychange',visibilityHandler);
  introDialog.addEventListener('cancel',introCancel);
  introDialog.addEventListener('close',syncHero);
  function dispose(){
    if(disposed)return;disposed=true;
    document.removeEventListener('click',clickHandler);document.removeEventListener('visibilitychange',visibilityHandler);
    introDialog.removeEventListener('cancel',introCancel);introDialog.removeEventListener('close',syncHero);
    if(introDialog.open)introDialog.close();if(diaryDialog.open)diaryDialog.close();
    introDialog.remove();diaryDialog.remove();stopSounds();
    if(context&&context.state!=='closed')context.close().catch(()=>{});
  }
  sync();
  return {startIntro,markMilestone,openDiary,sync,playCue,dispose};
}
