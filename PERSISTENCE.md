# Salvataggio dei richiami e copie di sicurezza

Le risposte del richiamo libero, le correzioni in revisione, la parola in scrittura
nel recupero guidato e il testo del piccolo ripasso si salvano sul dispositivo.
Le bozze del richiamo libero si riprendono solo per lo stesso giorno e la stessa
lista ancora da richiamare: non diventano un nuovo punteggio dopo il completamento.
Gli errori di scrittura nel deposito vengono segnalati; nessun browser può garantire
il recupero dopo una chiusura se lo spazio di salvataggio è negato o esaurito.

In fondo alla pagina, aprire **Copia di sicurezza dei progressi**:

1. **Salva una copia** scarica un file JSON. Verificarne la presenza in Download/File
   e conservarne una copia fuori dal telefono.
2. **Ripristina una copia salvata** legge e verifica un file creato dal gioco.
3. Il ripristino richiede una conferma: **sostituisce**, non unisce, i dati del
   dispositivo. Prima di confermare, esportare i progressi attuali.

Il file contiene risultati, parole, risposte e bozze. Non è cifrato e non viene
inviato automaticamente a un server. L'esportazione non è un backup automatico
periodico: occorre conservare il file scaricato.

Il ripristino sul sito pubblico usa soltanto le undici chiavi di deposito del
gioco. Un registro temporaneo permette di recuperare i valori precedenti se una
scrittura fallisce o se la pagina si chiude a metà operazione. Il registro resta
sul dispositivo fino al completamento del recupero; non viene esportato. Per
sicurezza, una memoria insufficiente può impedire il ripristino senza sostituire
i dati attuali. L'eventuale vecchia anteprima con `window.storage` non supporta
l'importazione: usare il sito pubblico.

## Verifiche

Dalla cartella del gioco, con Node.js:

```text
node tests/memory-regression.cjs
node tests/persistence-regression.cjs
```

I test usano dati sintetici, non lo storico del giocatore. Coprono le bozze,
il file completo, dati non validi, annullamento, mancanza di spazio, ripristino
interrotto e richieste concorrenti. La suite precedente controlla anche la
selezione delle parole, l'adattamento e i riepiloghi giornalieri.

Controllo manuale eseguito: apertura della sezione e download JSON nel browser
desktop, più layout a 390 pixel di larghezza. Il comportamento del selettore
File/Download va verificato sul telefono reale; non è stato simulato iOS o Android.
