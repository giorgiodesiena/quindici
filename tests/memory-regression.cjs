// Eseguire con Node: node tests/memory-regression.cjs [percorso/index.html]
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const file = process.argv[2] || path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(file, "utf8");
const script = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)[1];
new vm.Script(script);
const code = script.slice(0, script.lastIndexOf('\ndocument.body.dataset.schermata = "inizio";'));

function harness(date = "2026-09-30") {
  let current = new Date(date + "T12:00:00").getTime();
  let seed = 123456;
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [current])); }
    static now() { return current; }
  }
  const nodes = new Map();
  function element() {
    return { style: {}, dataset: {}, value: "", textContent: "", innerHTML: "",
      disabled: false, children: [], classList: {add(){},remove(){},toggle(){}},
      addEventListener(){}, setAttribute(){}, removeAttribute(){}, focus(){},
      appendChild(n){this.children.push(n);}, querySelectorAll(){return [];},
      querySelector(){return element();}, scrollIntoView(){}, select(){} };
  }
  const storage = new Map();
  const context = vm.createContext({
    Date: Clock, Math: Object.assign(Object.create(Math), {random() {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 4294967296;
    }}),
    console, Set, Map, setInterval(){return 1;}, clearInterval(){}, setTimeout(){return 1;}, clearTimeout(){},
    navigator: {}, window: {addEventListener(){}, alert(){}, open(){}},
    localStorage: {getItem(k){return storage.get(k) || null;},
      setItem(k,v){storage.set(k,v);}, removeItem(k){storage.delete(k);}},
    document: {body: element(), head:element(), addEventListener(){},
      getElementById(id){if(!nodes.has(id))nodes.set(id,element()); return nodes.get(id);},
      querySelectorAll(){return [];}, querySelector(){return element();}, createElement:element}
  });
  vm.runInContext(code, context);
  const state = vm.runInContext("stato", context);
  const catalog = vm.runInContext("SCHEDE_PAROLE", context);
  return {context, state, catalog, storage, nodes,
    run(s){return vm.runInContext(s,context);},
    setDate(d){current=new Date(d+"T12:00:00").getTime();}};
}

function probe(number, score, mode = "media", tier = 2, seconds = 120) {
  return {numero:number,punti:score,livello:mode,fasciaParole:tier,secondi:seconds,
    tempoStudio:seconds,tempoRecuperoEffettivo:90,versioneLessico:2,
    durataAttivaSessione:number*210,sessioneId:"partita",listaId:"lista"};
}
function successfulDays(h, recall = 5, mode = "media", tier = 2) {
  for(let i=20;i<=24;i++){
    const key="2026-09-"+i;
    h.state.giorni.push({data:key,tentativi:[probe(1,8,mode,tier),probe(2,12,mode,tier),probe(3,15,mode,tier)],
      richiamo:i===20?null:{da:"2026-09-"+(i-1),punti:recall,puntiSpontanei:recall},completatoAl:3});
  }
  h.state.giorni.push({data:"2026-09-25",tentativi:[],richiamo:{da:"2026-09-24",punti:recall,puntiSpontanei:recall}});
}

async function main() {
  const lex = harness();
  const entries = Object.values(lex.catalog);
  const counts = {media:entries.filter(p=>p.livello==="media").length,
    difficile:entries.filter(p=>p.livello==="difficile").length};
  assert(counts.media >= 600 && counts.difficile >= 600, "Varietà sufficiente per oltre 30 liste quotidiane");
  for(const excluded of ["medio","attivo","mica","bisogna","creato","consumato","pulcinaio","borraccetta"]){
    assert(!lex.catalog[excluded], excluded+" non deve essere estratta");
  }
  const leaks = [];
  for(const entry of entries){
    const hint=lex.context.formaIndizioRecupero(entry.parola,0);
    const detail=lex.context.formaIndizioRecupero(entry.parola,1);
    assert(hint.length>8 && detail.length>15);
    assert(!hint.includes("Forma della parola") && !detail.startsWith("Finisce con"),entry.parola);
    const normalize=lex.context.normalizza;
    const words=(hint+" "+detail).split(/[^a-zA-ZÀ-ÿ-]+/).map(normalize);
    if(words.includes(normalize(entry.parola))) leaks.push(entry.parola);
  }
  assert.deepEqual(leaks,[], "Gli indizi non devono contenere la risposta");
  console.log("Vocabolario:",counts);

  for(const mode of ["media","mix","difficile"]){
    for(let tier=0;tier<3;tier++){
      const h=harness("2026-08-01");
      h.state.difficolta=mode; h.state.fasciaParole=tier;
      const dates=[];
      for(let day=1;day<=35;day++){
        const d=new Date(2026,7,day,12);
        const key=h.context.chiaveData(d); h.setDate(key);
        const words=h.context.pescaParole();
        assert.equal(words.length,15); assert.equal(new Set(words).size,15);
        assert.equal(h.state.paroleNuoveLista,15);
        const recent=dates.slice(-30).flat();
        for(const word of words) assert(!recent.includes(word),"Ripetizione entro 30 giorni: "+word);
        dates.push(words);
        const difficult=words.filter(w=>h.catalog[h.context.normalizza(w)].livello==="difficile").length;
        assert.equal(difficult,mode==="mix"?[5,7,9][tier]:mode==="difficile"?15:0);
      }
    }
  }
  // Anche con il vocabolario recente esaurito: 15 parole, mai quelle di ieri.
  const exhausted=harness();
  exhausted.state.difficolta="media";
  const all=Object.values(exhausted.catalog).filter(p=>p.livello==="media").map(p=>p.parola);
  exhausted.state.storicoListe=[{data:"2026-09-28",parole:all}];
  exhausted.state.serie={data:"2026-09-29",parole:all.slice(0,15)};
  const fallback=exhausted.context.pescaParole();
  assert.equal(fallback.length,15);
  assert(fallback.every(w=>!all.slice(0,15).includes(w)));
  assert.equal(exhausted.state.paroleNuoveLista,0);
  console.log("PASS: 315 liste, varietà, livelli e assenza di ripetizioni recenti");

  for(const date of ["2026-09-30","2026-09-28","2026-10-26","2027-01-01"]){
    const h=harness(date);
    const yesterday=h.context.chiaveSpostata(date,-1);
    const previous=all.slice(0,15), today=all.slice(15,30);
    h.state.serie={data:yesterday,parole:previous};
    assert.equal(h.context.serieDaRichiamare().data,yesterday);
    h.state.dataSessione=date; h.state.parole=today;
    await h.context.salvaSerie();
    assert.equal(h.context.serieDaRichiamare().data,yesterday);
    h.state.serie=JSON.parse(h.storage.get("quindici:serie"));
    h.state.pendente=JSON.parse(h.storage.get("quindici:pendente"));
    assert.equal(h.context.serieDaRichiamare().parole.join(),previous.join());
    h.state.parole=all.slice(30,45);
    await h.context.salvaSerie();
    assert.equal(h.state.serie.parole.join(),today.join(),"La seconda partita non sovrascrive la prima lista");
    h.state.giorni=[{data:date,tentativi:[],richiamo:{da:yesterday,punti:0}}];
    assert.equal(h.context.serieDaRichiamare(),null,"Zero è un richiamo svolto, non mancante");
  }
  const legacy=harness();
  legacy.state.serie={data:"2026-09-30",parole:all.slice(15,30)};
  legacy.state.giorni=[{data:"2026-09-29",richiamo:null,tentativi:[probe(1,7)]}];
  legacy.state.storicoListe=[{data:"2026-09-29",listaId:"lista",parole:all.slice(0,15)}];
  assert.equal(legacy.context.serieDaRichiamare().parole.join(),all.slice(0,15).join());
  console.log("PASS: richiamo dopo nuova partita, riapertura, lunedì, cambio mese/anno e liste precedenti");

  const adaptation=harness(); successfulDays(adaptation);
  const next=adaptation.context.calcolaPrescrizioneGiornaliera();
  assert.equal(next.livello,"mix"); assert.equal(next.secondi,120); assert.equal(next.fasciaParole,0);
  const missing=harness(); successfulDays(missing);
  for(const d of missing.state.giorni)d.richiamo=null;
  assert.equal(missing.context.calcolaPrescrizioneGiornaliera().livello,"media");
  const low=harness(); successfulDays(low,1);
  assert.equal(low.context.calcolaPrescrizioneGiornaliera().livello,"media");
  const gradual=harness(); successfulDays(gradual,5,"media",0);
  const step=gradual.context.calcolaPrescrizioneGiornaliera();
  assert.equal(step.livello,"media"); assert.equal(step.fasciaParole,1); assert.equal(step.secondi,120);
  const saved={data:"2026-09-30",livello:"media",secondi:150,fasciaParole:1};
  gradual.state.prescrizioneGiornaliera=saved;
  assert.equal(gradual.context.calcolaPrescrizioneGiornaliera(),saved);
  const fatigue=harness(); successfulDays(fatigue);
  for(const day of fatigue.state.giorni){
    for(const trial of day.tentativi)trial.durataAttivaSessione=2400;
  }
  const easier=fatigue.context.calcolaPrescrizioneGiornaliera();
  assert.equal(easier.livello,"media"); assert.equal(easier.secondi,150);
  console.log("PASS: Mix senza ridurre il tempo, gradualità, richiami mancanti e impostazione stabile nel giorno");

  const spaced=harness();
  spaced.state.giorni=[{data:"2026-09-29",tentativi:[],ripassiBrevi:{parole:["cane","gatto","mucca"],prove:[{punti:2}]} }];
  const list=["cane","gatto","mucca","pecora","asino"];
  const comparison=spaced.context.confrontoRipassoDelGiornoPrima("2026-09-29",list,["CANE","cane","pecora","falso"]);
  assert.equal(comparison.totaleRipassate,3); assert.equal(comparison.ricordateRipassate,1);
  assert.equal(comparison.totaleAltre,2); assert.equal(comparison.ricordateAltre,1);
  const zero=spaced.context.confrontoRipassoDelGiornoPrima("2026-09-29",list,[]);
  assert.equal(zero.ricordateRipassate,0);
  spaced.state.giorni[0].ripassiBrevi.prove=[];
  assert.equal(spaced.context.confrontoRipassoDelGiornoPrima("2026-09-29",list,[]),null);
  spaced.state.giorni[0].ripassiBrevi.prove=[{punti:2}];
  spaced.state.origineRichiamo="2026-09-29";
  spaced.state.parole=list;
  spaced.state.scritte=["cane","pecora"];
  spaced.state.rinforziSerieRichiamata=[];
  spaced.run("disegnaProgressi=()=>{}; aggiornaPannelloRichiamo=()=>{};");
  spaced.context.registraRichiamo(2,["gatto","mucca","asino"]);
  await spaced.context.salvaGiorni();
  const stored=JSON.parse(spaced.storage.get("quindici:giorni"));
  const recall=stored.find(d=>d.data==="2026-09-30").richiamo;
  assert.equal(recall.puntiSpontanei,2);
  assert.equal(recall.confrontoRipasso.ricordateRipassate,1);
  assert.equal(recall.confrontoRipasso.ricordateAltre,1);
  assert.equal(spaced.state.pendente,null);
  console.log("PASS: confronto spontaneo ripassate/altre, duplicati, zero e ripassi non svolti");

  const routing=harness();
  routing.run("partitaSospesaValida = () => ({stato:{}}); riprendiPartita = () => {globalThis.ripresa=true;}; iniziaSessione = () => {throw new Error('Nuova partita non richiesta');}");
  routing.context.avviaGiocoDiOggi(); assert(routing.context.ripresa);
  const finished=harness();
  finished.state.giorni=[{data:"2026-09-30",tentativi:[probe(1,15)],richiamo:null}];
  finished.run("mostraSchermata=(s)=>{globalThis.schermata=s;}; disegnaProgressi=()=>{}; aggiornaPannelliNuovi=()=>{}; iniziaSessione=()=>{throw new Error('Partita gia giocata');};");
  finished.context.avviaGiocoDiOggi();
  assert.equal(finished.context.schermata,"inizio");
  console.log("PASS: dopo il richiamo riprende la partita sospesa");

  // Il resoconto resta quotidiano anche domenica e a fine mese.
  for(const date of ["2026-09-27","2026-09-28","2026-09-30","2026-10-01"]){
    const h=harness(date);
    h.state.giorni=[{data:date,tentativi:[probe(1,8),probe(2,15)],richiamo:null,completatoAl:2}];
    const report=h.context.testoRiepilogo();
    assert(!report.includes("Settimana:"));
    assert.equal((report.match(/📅/g)||[]).length,1);
    assert(report.includes("15 parole su 15"));
  }
  console.log("PASS: riepilogo sempre solo del giorno corrente");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
