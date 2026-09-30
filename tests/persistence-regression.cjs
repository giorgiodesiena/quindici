// Synthetic-only regression tests. Run: node tests/persistence-regression.cjs [index.html]
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const file = process.argv[2] || path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)[1];
new vm.Script(script);
const bootIndex = script.lastIndexOf('\ndocument.body.dataset.schermata = "inizio";');
assert(bootIndex > 0, 'Application bootstrap marker must exist');
const code = script.slice(0, bootIndex);
const TODAY = '2026-09-30';
const YESTERDAY = '2026-09-29';
const DRAFT = 'quindici:bozza-richiamo-v1';
const REVIEW = 'quindici:ripasso-breve-v1';
const GAME = 'quindici:partita-in-pausa-v1';
const JOURNAL = 'quindici:ripristino-in-corso-v1';
const WORDS = ['cane','gatto','mucca','pecora','asino','pane','latte','mele','pasta','sapone','chiavi','borsa','acqua','libro','giardino'];
const clone = value => JSON.parse(JSON.stringify(value));

function harness(injectedStorage = new Map()) {
  const storage = new Map(injectedStorage);
  const nodes = new Map();
  let current = new Date(TODAY + 'T12:00:00').getTime();
  let reloads = 0;
  let writes = 0;
  let failureAt = Infinity;
  let alwaysFailWrites = false;
  let confirmations = true;
  let seed = 123456;
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [current])); }
    static now() { return current; }
  }
  function eventTarget(target) {
    const listeners = new Map();
    target.addEventListener = (type, listener) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    };
    target.dispatchEvent = event => {
      if (!event.target) event.target = target;
      event.currentTarget = target;
      if (!event.preventDefault) event.preventDefault = () => {};
      for (const listener of listeners.get(event.type) || []) listener.call(target, event);
      if (event.bubbles && target.parentNode) target.parentNode.dispatchEvent(event);
      return true;
    };
    return target;
  }
  function matches(node, selector) {
    if (selector.startsWith('.')) return node.className.split(/\s+/).includes(selector.slice(1));
    if (selector.startsWith('#')) return node.id === selector.slice(1);
    return node.tagName.toLowerCase() === selector.toLowerCase();
  }
  function descendants(root) {
    const result = [];
    for (const child of root.children) result.push(child, ...descendants(child));
    return result;
  }
  function element(tag = 'div') {
    const node = eventTarget({tagName: tag.toUpperCase(), id: '', className: '', style: {}, dataset: {}, value: '',
      textContent: '', hidden: false, disabled: false, readOnly: false, children: [], parentNode: null,
      setAttribute(name, value) { this[name] = value; }, removeAttribute(name) { delete this[name]; },
      focus() {}, scrollIntoView() {}, select() {}, click() { this.dispatchEvent({type:'click', bubbles:true}); },
      appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
      remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(item => item !== this); },
      querySelectorAll(selector) { return descendants(this).filter(child => matches(child, selector)); },
      querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }});
    let markup = '';
    Object.defineProperty(node, 'innerHTML', {get() { return markup; }, set(value) { markup = value; node.children = []; }});
    node.classList = {
      add(name) { if (!matches(node, '.' + name)) node.className += ' ' + name; },
      remove(name) { node.className = node.className.split(/\s+/).filter(item => item !== name).join(' '); },
      contains(name) { return matches(node, '.' + name); },
      toggle(name) { if (this.contains(name)) this.remove(name); else this.add(name); }
    };
    return node;
  }
  const document = eventTarget({body: element('body'), head: element('head'), hidden: false,
    getElementById(id) {
      if (!nodes.has(id)) { const node = element(); node.id = id; nodes.set(id, node); }
      return nodes.get(id);
    },
    querySelectorAll(selector) {
      const found = new Set();
      for (const root of nodes.values()) {
        if (matches(root, selector)) found.add(root);
        for (const node of root.querySelectorAll(selector)) found.add(node);
      }
      return Array.from(found);
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || element(); }, createElement: element});
  document.body.dataset.schermata = 'inizio';
  const window = eventTarget({scrollTo() {}, alert() {}, open() {}, confirm() { return confirmations; },
    location: {reload() { reloads++; }}});
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) {
      writes++;
      if (alwaysFailWrites || writes === failureAt) throw new Error('Synthetic quota failure');
      storage.set(String(key), String(value));
    },
    removeItem(key) { storage.delete(key); }
  };
  const context = vm.createContext({Date:Clock, Math:Object.assign(Object.create(Math), {random() {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296;
  }}), console, Set, Map, Blob, URL, navigator:{}, window, document, localStorage,
  setInterval() { return 1; }, clearInterval() {}, setTimeout() { return 1; }, clearTimeout() {}});
  vm.runInContext(code, context);
  // Charts are unrelated to storage; retain all workflow, scoring, validation and save functions.
  vm.runInContext('disegnaProgressi = () => {};', context);
  return {context, state:vm.runInContext('stato', context), storage, document, window,
    run(source) { return vm.runInContext(source, context); },
    node(id) { return document.getElementById(id); },
    input(id, value) { const node = document.getElementById(id); node.value = value; node.dispatchEvent({type:'input', bubbles:true}); },
    read(key) { return JSON.parse(localStorage.getItem(key)); },
    put(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
    advance(ms) { current += ms; },
    failAfterWrites(count) { failureAt = writes + count; },
    failEveryWrite(value = true) { alwaysFailWrites = value; },
    setConfirm(value) { confirmations = value; },
    get reloads() { return reloads; }, get writes() { return writes; }};
}

function recallHarness(storage) {
  const h = harness(storage);
  h.state.serie = {data:YESTERDAY, parole:WORDS.slice(), listaId:'synthetic-yesterday'};
  h.put('quindici:serie', h.state.serie);
  return h;
}

async function reopen(h) {
  const resumed = harness(h.storage);
  await resumed.context.caricaTutto();
  return resumed;
}

async function completeFixture() {
  const h = harness();
  h.state.giorni = [{data:TODAY, tentativi:[{numero:1,punti:8,livello:'media',secondi:120,mancate:[0,1]}],richiamo:null,completatoAl:null}];
  h.state.serie = {data:TODAY,parole:WORDS.slice(),listaId:'synthetic-today'};
  h.state.pendente = {data:YESTERDAY,parole:WORDS.slice(),listaId:'synthetic-yesterday'};
  h.state.vitaStorico = [{data:TODAY,tipo:'spesa',tentativi:[{numero:1,punti:2}],elementi:['pane','latte'],valori:['pane','latte']}];
  h.state.sessioniLivello = {media:4,mix:2,difficile:0};
  h.state.paroleRecenti = WORDS.slice();
  h.state.storicoListe = [{data:YESTERDAY,parole:WORDS.slice(),listaId:'synthetic-yesterday'}];
  h.state.prescrizioneGiornaliera = {data:TODAY,livello:'media',secondi:120,fasciaParole:0};
  Object.assign(h.state, {parole:WORDS.slice(),scritte:['cane'],sessioneId:'synthetic-session',dataSessione:TODAY,
    tentativo:1,secondiTentativo:120,secondiRimasti:30,secondiTotaliFase:120,secondiUsatiRecupero:0,
    inizioSessioneTimestamp:Date.parse(TODAY + 'T10:00:00Z'),inizioTentativoTimestamp:Date.parse(TODAY + 'T10:00:00Z'),
    fase:'studio',partitaInCorso:true});
  h.document.body.dataset.schermata = 'studio';
  h.context.salvaPartitaInCorso();
  h.state.partitaInCorso = false;
  h.document.body.dataset.schermata = 'inizio';
  h.put(REVIEW,{data:TODAY,parole:WORDS.slice(0,3),intervallo:60,prontoAl:Date.parse(TODAY + 'T11:00:00Z'),prove:[],fase:'attesa',testoInCorso:'cane, ga'});
  h.put(DRAFT,{versione:1,tipo:'libero',data:TODAY,origine:YESTERDAY,parole:WORDS.slice(),scritte:['cane'],testoInCorso:'gat',revisione:false});
  h.put('unrelated:settings',{untouched:true});
  return {h, backup:await h.context.creaCopiaBackup()};
}

const tests = [];
function test(name, work) { tests.push({name, work}); }

test('Yesterday free recall: committed answers and unfinished input survive reopening', async () => {
  const h = recallHarness();
  h.context.iniziaRichiamo();
  h.input('casella','cane'); h.context.aggiungiScritta();
  h.input('casella','gatto'); h.context.aggiungiScritta();
  h.input('casella','peco');
  assert.deepEqual(h.read(DRAFT).scritte,['cane','gatto']);
  assert.equal(h.read(DRAFT).testoInCorso,'peco');
  const resumed = await reopen(h);
  resumed.context.iniziaRichiamo();
  assert.equal(resumed.document.body.dataset.schermata,'ripeti');
  assert.deepEqual(clone(resumed.state.scritte),['cane','gatto']);
  assert.equal(resumed.node('casella').value,'peco');
  assert.equal(resumed.state.origineRichiamo,YESTERDAY);
});

test('Revision field edits and revision screen survive reopening', async () => {
  const h = recallHarness(); h.context.iniziaRichiamo();
  h.input('casella','canne'); h.context.aggiungiScritta();
  h.input('casella','gatto'); h.context.aggiungiScritta();
  h.state.dettaturaUsata = true; h.context.mostraRevisioneRisposte();
  const fields = h.document.querySelectorAll('.campo-revisione');
  assert.equal(fields.length,2);
  fields[0].value='cane'; fields[0].dispatchEvent({type:'input',bubbles:true});
  fields[1].value='gatto corretto'; fields[1].dispatchEvent({type:'input',bubbles:true});
  assert.deepEqual(h.read(DRAFT).scritte,['cane','gatto corretto']);
  const resumed = await reopen(h); resumed.context.iniziaRichiamo();
  assert.equal(resumed.node('revisione-risposte').style.display,'block');
  assert.equal(resumed.state.dettaturaUsata,true);
  assert.deepEqual(resumed.document.querySelectorAll('.campo-revisione').map(node=>node.value),['cane','gatto corretto']);
});

test('Free recall drafts are rejected when stale, from another source or for another list', async () => {
  const mutations=[
    draft=>{draft.data=YESTERDAY;}, draft=>{draft.origine='2026-09-28';},
    draft=>{draft.parole.reverse();}, draft=>{draft.versione=2;}
  ];
  for (const mutate of mutations) {
    const h=recallHarness(); h.context.iniziaRichiamo();
    h.input('casella','cane'); h.context.aggiungiScritta(); h.input('casella','unsubmitted');
    const draft=h.read(DRAFT); mutate(draft); h.put(DRAFT,draft);
    const resumed=await reopen(h); resumed.context.iniziaRichiamo();
    assert.deepEqual(clone(resumed.state.scritte),[],String(mutate));
    assert.equal(resumed.node('casella').value,'',String(mutate));
  }
});

test('Completed free recall removes its draft and never reopens the free-answer screen', async () => {
  const h=recallHarness(); h.context.iniziaRichiamo();
  h.input('casella','cane'); h.context.aggiungiScritta();
  const previousDraft=h.read(DRAFT);
  h.context.registraRichiamo(1,WORDS.slice(1));
  await h.run('codaSalvataggioGiorni'); await Promise.resolve();
  assert.equal(h.read(DRAFT),null);
  assert.equal(h.run('bozzeInMemoria.has(CHIAVE_BOZZA_RICHIAMO)'),false);
  // Simulate an obsolete old draft left behind independently of the completed result.
  h.put(DRAFT,previousDraft);
  const resumed=await reopen(h); resumed.context.iniziaRichiamo();
  assert.equal(resumed.document.body.dataset.schermata,'esito');
  assert.equal(resumed.state.giorni[0].richiamo.punti,1);
});

test('Guided recall restores typed and confirmed answers without scoring twice', async () => {
  const h = recallHarness();
  const recovery = h.context.creaRecuperoGuidato(['cane','gatto']);
  h.state.giorni=[{data:TODAY,tentativi:[],richiamo:{da:YESTERDAY,punti:0,puntiSpontanei:0,paroleOrigine:WORDS.slice(),risposteInserite:[],recuperoGuidato:recovery}}];
  await h.context.salvaGiorni(); h.context.apriRecuperoGuidato();
  h.input('risposta-recupero','ca');
  const typed=await reopen(h); typed.context.apriRecuperoGuidato();
  assert.equal(typed.node('risposta-recupero').value,'ca');
  assert.equal(typed.node('risposta-recupero').readOnly,false);
  const word=typed.state.giorni[0].richiamo.recuperoGuidato.parole[0];
  typed.input('risposta-recupero',word); await typed.context.completaParolaRecupero();
  assert.equal(typed.read(DRAFT).confermata,true);
  const confirmed=await reopen(typed); confirmed.context.apriRecuperoGuidato();
  assert.equal(confirmed.node('risposta-recupero').value,word);
  assert.equal(confirmed.node('risposta-recupero').readOnly,true);
  assert.equal(confirmed.state.rispostaRecuperoConfermata,true);
  assert.equal(confirmed.state.giorni[0].richiamo.recuperoGuidato.indice,0);
  await confirmed.context.completaParolaRecupero();
  assert.equal(confirmed.state.giorni[0].richiamo.recuperoGuidato.indice,1);
  assert.equal(confirmed.state.giorni[0].richiamo.recuperoGuidato.ritrovateConIndizio,1);
  await confirmed.context.completaParolaRecupero();
  assert.equal(confirmed.state.giorni[0].richiamo.recuperoGuidato.indice,1);
});

test('Short review restores unfinished text, clears it after scoring and prevents a duplicate score', async () => {
  const h=harness();
  h.put(REVIEW,{data:TODAY,parole:WORDS.slice(0,3),intervallo:60,prontoAl:Date.parse(TODAY+'T10:00:00Z'),prove:[],fase:'attesa'});
  h.context.apriRipassoBreve(); h.input('risposta-ripasso-breve','cane, gat');
  assert.equal(h.read(REVIEW).testoInCorso,'cane, gat');
  const resumed=await reopen(h); resumed.context.apriRipassoBreve();
  assert.equal(resumed.node('risposta-ripasso-breve').value,'cane, gat');
  resumed.input('risposta-ripasso-breve','cane, gatto'); resumed.context.controllaRipassoBreve();
  await resumed.run('codaSalvataggioGiorni');
  assert.equal(resumed.read(REVIEW).testoInCorso,'');
  assert.equal(resumed.read(REVIEW).prove[0].punti,2);
  resumed.context.controllaRipassoBreve();
  assert.equal(resumed.read(REVIEW).prove.length,1);
  resumed.node('chiudi-ripasso-breve').click();
  const next=await reopen(resumed); next.context.apriRipassoBreve();
  assert.equal(next.node('risposta-ripasso-breve').value,'');
});

test('Backup round trip includes all 11 known keys and no unrelated values', async () => {
  const {h,backup}=await completeFixture();
  const keys=clone(h.run('CHIAVI_BACKUP'));
  assert.equal(keys.length,11); assert.equal(Object.keys(backup.dati).length,11);
  assert.deepEqual(Object.keys(backup.dati).sort(),keys.sort());
  for (const key of keys) assert.notEqual(backup.dati[key],null,key+' fixture must be populated');
  assert(!Object.hasOwn(backup.dati,'unrelated:settings'));
  const parsed=h.context.leggiFileBackup(JSON.stringify(backup));
  assert.deepEqual(clone(parsed),clone(backup));
  assert.deepEqual(clone(parsed.dati['quindici:giorni'][0].tentativi[0].mancate),[0,1]);
  const target=harness(); target.put('unrelated:settings',{target:true});
  await target.context.applicaCopiaBackup(parsed);
  for (const key of keys) assert.deepEqual(target.read(key),clone(backup.dati[key]),key);
  assert.deepEqual(target.read('unrelated:settings'),{target:true});
  assert(!target.storage.has(JOURNAL));
  assert.equal(target.run('ripristinoBackupInCorso'),true);
});

test('Backup exports latest unfinished free recall even if every localStorage write fails', async () => {
  const h=recallHarness(); h.context.iniziaRichiamo();
  h.input('casella','cane'); h.context.aggiungiScritta();
  h.input('casella','old text');
  const durableBefore=h.storage.get(DRAFT);
  h.failEveryWrite();
  h.input('casella','gatto'); h.context.aggiungiScritta();
  h.input('casella','unfinished after quota failure');
  assert.equal(h.storage.get(DRAFT),durableBefore,'Injected quota failure must leave old durable draft');
  assert.equal(h.node('avviso-salvataggio').hidden,false);
  const backup=await h.context.creaCopiaBackup();
  assert.deepEqual(clone(backup.dati[DRAFT].scritte),['cane','gatto']);
  assert.equal(backup.dati[DRAFT].testoInCorso,'unfinished after quota failure');
  const parsed=h.context.leggiFileBackup(JSON.stringify(backup));
  assert.equal(parsed.dati[DRAFT].testoInCorso,'unfinished after quota failure');
});

test('Backup exports latest unfinished short review despite persistent storage failure', async () => {
  const h=harness();
  h.put(REVIEW,{data:TODAY,parole:WORDS.slice(0,3),intervallo:60,prontoAl:Date.parse(TODAY+'T10:00:00Z'),prove:[],fase:'attesa'});
  h.context.apriRipassoBreve(); h.failEveryWrite();
  h.input('risposta-ripasso-breve','cane, gatto, unfinished');
  const backup=await h.context.creaCopiaBackup();
  assert.equal(backup.dati[REVIEW].testoInCorso,'cane, gatto, unfinished');
});

test('Malformed JSON, wrong version, oversized files, null scores and invalid dates are rejected', async () => {
  const {h,backup}=await completeFixture();
  for (const malformed of ['{','null','[]','42']) assert.throws(()=>h.context.leggiFileBackup(malformed));
  const mutations=[
    b=>{b.versione=2;}, b=>{b.dati['quindici:giorni'][0].tentativi[0].punti=null;},
    b=>{b.dati['quindici:giorni'][0].richiamo={punti:null,da:YESTERDAY};},
    b=>{b.dati['quindici:giorni'][0].tentativi[0].punti=16;},
    b=>{b.dati['quindici:giorni'][0].tentativi[0].punti='<img src=x onerror=alert(1)>';},
    b=>{b.dati['quindici:giorni'][0].tentativi[0].mancate=[null];},
    b=>{b.dati['quindici:giorni'][0].aiuti=[null];},
    b=>{delete b.dati['quindici:giorni'][0].richiamo;},
    b=>{b.dati['quindici:giorni'][0].data='2026-02-30';},
    b=>{b.dati['quindici:giorni'].push(clone(b.dati['quindici:giorni'][0]));},
    b=>{b.dati['unknown:key']=[];}, b=>{delete b.dati[GAME];},
    b=>{b.dati[GAME].stato.fase='not-a-real-phase';}
  ];
  for (const mutate of mutations) {
    const changed=clone(backup); mutate(changed);
    assert.throws(()=>h.context.leggiFileBackup(JSON.stringify(changed)), undefined, String(mutate));
  }
  assert.throws(()=>h.context.leggiFileBackup(' '.repeat(h.run('MAX_BYTE_BACKUP')+1)));
  const prototypePayload=clone(backup);
  prototypePayload.dati['quindici:giorni'][0].unsafe=JSON.parse('{"__proto__":{"polluted":true}}');
  assert.throws(()=>h.context.leggiFileBackup(JSON.stringify(prototypePayload)));
  const tooDeep=clone(backup); let nested=tooDeep.dati['quindici:giorni'][0];
  for (let depth=0;depth<25;depth++) { nested.child={}; nested=nested.child; }
  assert.throws(()=>h.context.leggiFileBackup(JSON.stringify(tooDeep)));
});

test('Failure after several writes rolls back every key and preserves unrelated storage', async () => {
  const {backup}=await completeFixture(); const h=harness();
  h.put('quindici:giorni',[{data:YESTERDAY,tentativi:[],richiamo:null}]);
  h.put('quindici:vita',[]); h.put('unrelated:settings',{keep:true});
  const before=new Map(h.storage);
  h.failAfterWrites(5);
  await assert.rejects(h.context.applicaCopiaBackup(backup),/Ripristino non riuscito/);
  assert.deepEqual(h.storage,before);
  assert.equal(h.run('ripristinoBackupInCorso'),false);
});

test('Interrupted journal recovery restores original strings and deletes originally absent keys', async () => {
  const {backup}=await completeFixture(); const h=harness();
  h.put('quindici:giorni',[{data:YESTERDAY,tentativi:[],richiamo:null}]);
  h.put('unrelated:settings',{keep:true});
  const before=new Map(h.storage); const original=h.context.fotografiaDepositoLocale();
  h.put(JOURNAL,{versione:1,prima:original});
  for (const key of Object.keys(backup.dati)) h.put(key,backup.dati[key]);
  const restarted=harness(h.storage);
  assert.equal(restarted.context.recuperaRipristinoInterrotto(),true);
  assert.deepEqual(restarted.storage,before);
  assert.equal(restarted.context.recuperaRipristinoInterrotto(),false);
});

test('Preview cancellation and confirmation refusal leave storage unchanged', async () => {
  const {backup}=await completeFixture(); const h=harness();
  h.put('unrelated:settings',{keep:true}); const before=new Map(h.storage);
  const text=JSON.stringify(backup); const file={size:Buffer.byteLength(text),text:async()=>text};
  await h.context.preparaRipristinoBackup({target:{files:[file]}});
  assert.equal(h.node('anteprima-backup').hidden,false); assert.deepEqual(h.storage,before);
  h.context.annullaAnteprimaBackup();
  assert.equal(h.node('anteprima-backup').hidden,true); assert.equal(h.run('backupDaRipristinare'),null);
  await h.context.confermaRipristinoBackup(); assert.deepEqual(h.storage,before); assert.equal(h.reloads,0);
  await h.context.preparaRipristinoBackup({target:{files:[file]}}); h.setConfirm(false);
  await h.context.confermaRipristinoBackup(); assert.deepEqual(h.storage,before); assert.equal(h.reloads,0);
  // Cancelling while file.text is pending must invalidate the late preview.
  let resolveText; const pendingFile={size:text.length,text:()=>new Promise(resolve=>{resolveText=resolve;})};
  const pending=h.context.preparaRipristinoBackup({target:{files:[pendingFile]}});
  h.context.annullaAnteprimaBackup(); resolveText(text); await pending;
  assert.equal(h.run('backupDaRipristinare'),null); assert.deepEqual(h.storage,before);
});

test('Confirmation double click reloads once and cannot overwrite the imported backup', async () => {
  const {backup}=await completeFixture(); const h=harness(); const text=JSON.stringify(backup);
  await h.context.preparaRipristinoBackup({target:{files:[{size:text.length,text:async()=>text}]}});
  await Promise.all([h.context.confermaRipristinoBackup(),h.context.confermaRipristinoBackup()]);
  assert.equal(h.reloads,1);
  const after=new Map(h.storage);
  h.state.modalita='richiamo'; h.document.body.dataset.schermata='ripeti';
  h.context.salvaRichiamiInCorso(); h.context.salvaPartitaInCorso();
  assert.deepEqual(h.storage,after);
  await assert.rejects(h.context.applicaCopiaBackup(backup),/già in corso/);
});

test('Concurrent direct restores allow exactly one transaction', async () => {
  const {backup}=await completeFixture(); const h=harness();
  const results=await Promise.allSettled([h.context.applicaCopiaBackup(backup),h.context.applicaCopiaBackup(backup)]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(results.filter(result=>result.status==='rejected').length,1);
});

async function main() {
  let failures=0;
  for (const {name,work} of tests) {
    try { await work(); console.log('PASS:',name); }
    catch (error) { failures++; console.error('FAIL:',name); console.error(error.stack); }
  }
  console.log(`${tests.length-failures}/${tests.length} persistence tests passed; fixed date ${TODAY}; synthetic storage only.`);
  if (failures) process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
