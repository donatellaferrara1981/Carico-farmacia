/**
 * Lista antibiotici, antifungini e antivirali (classi ATC J01, J02, J05)
 * rilevanti per il contesto ospedaliero e per i report ICA.
 * Il riconoscimento è case-insensitive sul principio_attivo.
 */

export type ClasseAntibiotico =
  | 'beta-lattamici'
  | 'aminoglicosidi'
  | 'chinolonici'
  | 'glicopeptidi'
  | 'macrolidi'
  | 'carbapenemi'
  | 'tetracicline'
  | 'lincosamidi'
  | 'ossazolidinoni'
  | 'polimixine'
  | 'sulfonamidi'
  | 'nitrofurani'
  | 'nitroimidazoli'
  | 'antifungini'
  | 'antivirali'
  | 'altri';

interface EntryAntibiotico {
  pattern: RegExp;
  classe: ClasseAntibiotico;
}

const ENTRIES: EntryAntibiotico[] = [
  // ── Beta-lattamici ─────────────────────────────────────────────
  { pattern: /amoxicillin/i,           classe: 'beta-lattamici' },
  { pattern: /ampicillin/i,            classe: 'beta-lattamici' },
  { pattern: /piperacillin/i,          classe: 'beta-lattamici' },
  { pattern: /tazobactam/i,            classe: 'beta-lattamici' },
  { pattern: /sulbactam/i,             classe: 'beta-lattamici' },
  { pattern: /clavulan/i,              classe: 'beta-lattamici' },
  { pattern: /oxacillin/i,             classe: 'beta-lattamici' },
  { pattern: /cefaloss?in/i,           classe: 'beta-lattamici' },
  { pattern: /cefazolin/i,             classe: 'beta-lattamici' },
  { pattern: /cefurox/i,               classe: 'beta-lattamici' },
  { pattern: /ceftriax/i,              classe: 'beta-lattamici' },
  { pattern: /cefotax/i,               classe: 'beta-lattamici' },
  { pattern: /ceftazidim/i,            classe: 'beta-lattamici' },
  { pattern: /cefepim/i,               classe: 'beta-lattamici' },
  { pattern: /ceftarolin/i,            classe: 'beta-lattamici' },
  { pattern: /ceftoloz/i,              classe: 'beta-lattamici' },
  { pattern: /ceftazidim.*avibactam/i, classe: 'beta-lattamici' },
  { pattern: /cefiderocol/i,           classe: 'beta-lattamici' },
  { pattern: /aztreonam/i,             classe: 'beta-lattamici' },

  // ── Carbapenemi ────────────────────────────────────────────────
  { pattern: /meropenem/i,             classe: 'carbapenemi' },
  { pattern: /imipenem/i,              classe: 'carbapenemi' },
  { pattern: /ertapenem/i,             classe: 'carbapenemi' },
  { pattern: /doripenem/i,             classe: 'carbapenemi' },

  // ── Aminoglicosidi ─────────────────────────────────────────────
  { pattern: /gentamicin/i,            classe: 'aminoglicosidi' },
  { pattern: /amikacin/i,              classe: 'aminoglicosidi' },
  { pattern: /tobramicin/i,            classe: 'aminoglicosidi' },
  { pattern: /netilmicin/i,            classe: 'aminoglicosidi' },
  { pattern: /streptomicin/i,          classe: 'aminoglicosidi' },

  // ── Chinolonici / Fluorochinoloni ──────────────────────────────
  { pattern: /ciprofloxacin/i,         classe: 'chinolonici' },
  { pattern: /levofloxacin/i,          classe: 'chinolonici' },
  { pattern: /moxifloxacin/i,          classe: 'chinolonici' },
  { pattern: /norfloxacin/i,           classe: 'chinolonici' },
  { pattern: /ofloxacin/i,             classe: 'chinolonici' },

  // ── Glicopeptidi ───────────────────────────────────────────────
  { pattern: /vancomicin/i,            classe: 'glicopeptidi' },
  { pattern: /teicoplanin/i,           classe: 'glicopeptidi' },
  { pattern: /dalbavancin/i,           classe: 'glicopeptidi' },
  { pattern: /oritavancin/i,           classe: 'glicopeptidi' },

  // ── Macrolidi ──────────────────────────────────────────────────
  { pattern: /azitromicin/i,           classe: 'macrolidi' },
  { pattern: /claritromicin/i,         classe: 'macrolidi' },
  { pattern: /eritromicin/i,           classe: 'macrolidi' },
  { pattern: /spiramicin/i,            classe: 'macrolidi' },

  // ── Lincosamidi ────────────────────────────────────────────────
  { pattern: /clindamicin/i,           classe: 'lincosamidi' },
  { pattern: /lincomicin/i,            classe: 'lincosamidi' },

  // ── Ossazolidinoni ─────────────────────────────────────────────
  { pattern: /linezolid/i,             classe: 'ossazolidinoni' },
  { pattern: /tedizolid/i,             classe: 'ossazolidinoni' },

  // ── Polimixine ─────────────────────────────────────────────────
  { pattern: /colistin/i,              classe: 'polimixine' },
  { pattern: /polimixina/i,            classe: 'polimixine' },
  { pattern: /polymyxin/i,             classe: 'polimixine' },

  // ── Tetracicline ───────────────────────────────────────────────
  { pattern: /doxiciclin/i,            classe: 'tetracicline' },
  { pattern: /tetraciclina/i,          classe: 'tetracicline' },
  { pattern: /tigeciclina/i,           classe: 'tetracicline' },
  { pattern: /minociclin/i,            classe: 'tetracicline' },
  { pattern: /omadaciclin/i,           classe: 'tetracicline' },
  { pattern: /eravaciclin/i,           classe: 'tetracicline' },

  // ── Sulfonamidi / Trimetoprim ──────────────────────────────────
  { pattern: /trimetoprim/i,           classe: 'sulfonamidi' },
  { pattern: /sulfametox/i,            classe: 'sulfonamidi' },
  { pattern: /cotrimox/i,              classe: 'sulfonamidi' },

  // ── Nitrofurani ────────────────────────────────────────────────
  { pattern: /nitrofurantoina/i,       classe: 'nitrofurani' },

  // ── Nitroimidazoli ─────────────────────────────────────────────
  { pattern: /metronidazol/i,          classe: 'nitroimidazoli' },
  { pattern: /tinidazol/i,             classe: 'nitroimidazoli' },
  { pattern: /ornidazol/i,             classe: 'nitroimidazoli' },

  // ── Antifungini ────────────────────────────────────────────────
  { pattern: /fluconazol/i,            classe: 'antifungini' },
  { pattern: /voriconazol/i,           classe: 'antifungini' },
  { pattern: /itraconazol/i,           classe: 'antifungini' },
  { pattern: /posaconazol/i,           classe: 'antifungini' },
  { pattern: /isavuconazol/i,          classe: 'antifungini' },
  { pattern: /caspofungin/i,           classe: 'antifungini' },
  { pattern: /micafungin/i,            classe: 'antifungini' },
  { pattern: /anidulafungin/i,         classe: 'antifungini' },
  { pattern: /amfotericina/i,          classe: 'antifungini' },
  { pattern: /nistatin/i,              classe: 'antifungini' },

  // ── Antivirali ─────────────────────────────────────────────────
  { pattern: /aciclovir/i,             classe: 'antivirali' },
  { pattern: /valaciclovir/i,          classe: 'antivirali' },
  { pattern: /ganciclovir/i,           classe: 'antivirali' },
  { pattern: /valganciclovir/i,        classe: 'antivirali' },
  { pattern: /foscarnet/i,             classe: 'antivirali' },
  { pattern: /cidofovir/i,             classe: 'antivirali' },
  { pattern: /oseltamivir/i,           classe: 'antivirali' },
  { pattern: /remdesivir/i,            classe: 'antivirali' },

  // ── Nomi commerciali nota AIFA / uso ospedaliero ───────────────
  { pattern: /zavicefta/i,             classe: 'beta-lattamici' },  // ceftazidima/avibactam
  { pattern: /zerbaxa/i,               classe: 'beta-lattamici' },  // ceftolozano/tazobactam
  { pattern: /fetcroja/i,              classe: 'beta-lattamici' },  // cefiderocol
  { pattern: /recarbrio/i,             classe: 'carbapenemi'    },  // imipenem/cilastatina/relebactam
  { pattern: /vabomere/i,              classe: 'carbapenemi'    },  // meropenem/vaborbactam
  { pattern: /xerava/i,                classe: 'tetracicline'   },  // eravacicline
  { pattern: /nuzyra/i,                classe: 'tetracicline'   },  // omadacicline
  { pattern: /zinforo/i,               classe: 'beta-lattamici' },  // ceftarolina
  { pattern: /orbactiv/i,              classe: 'glicopeptidi'   },  // oritavancin
  { pattern: /dalvance/i,              classe: 'glicopeptidi'   },  // dalbavancin
  { pattern: /sivextro/i,              classe: 'ossazolidinoni' },  // tedizolid
  { pattern: /cresemba/i,              classe: 'antifungini'    },  // isavuconazolo
  { pattern: /noxafil/i,               classe: 'antifungini'    },  // posaconazolo
  { pattern: /vfend/i,                 classe: 'antifungini'    },  // voriconazolo
  { pattern: /ecalta/i,                classe: 'antifungini'    },  // anidulafungin
  { pattern: /mycamine/i,              classe: 'antifungini'    },  // micafungin
  { pattern: /cancidas/i,              classe: 'antifungini'    },  // caspofungin
  { pattern: /abelcet/i,               classe: 'antifungini'    },  // amfotericina B lipidica
  { pattern: /ambisome/i,              classe: 'antifungini'    },  // amfotericina B liposomiale
  { pattern: /veklury/i,               classe: 'antivirali'     },  // remdesivir
  { pattern: /tamiflu/i,               classe: 'antivirali'     },  // oseltamivir
  { pattern: /valcyte/i,               classe: 'antivirali'     },  // valganciclovir
  { pattern: /cymevene/i,              classe: 'antivirali'     },  // ganciclovir
  { pattern: /dificlir/i,              classe: 'altri'          },  // fidaxomicin

  // ── Altri antibiotici ──────────────────────────────────────────
  { pattern: /daptomicin/i,            classe: 'altri' },
  { pattern: /rifampicin/i,            classe: 'altri' },
  { pattern: /rifaximina/i,            classe: 'altri' },
  { pattern: /fosfomicin/i,            classe: 'altri' },
  { pattern: /cloramfenicol/i,         classe: 'altri' },
  { pattern: /mupirocin/i,             classe: 'altri' },
  { pattern: /fidaxomicin/i,           classe: 'altri' },
];

export interface InfoAntibiotico {
  isAntibiotico: boolean;
  classe: ClasseAntibiotico | null;
}

export function classificaFarmaco(principioAttivo: string): InfoAntibiotico {
  for (const entry of ENTRIES) {
    if (entry.pattern.test(principioAttivo)) {
      return { isAntibiotico: true, classe: entry.classe };
    }
  }
  return { isAntibiotico: false, classe: null };
}

/**
 * Farmaci ad alto costo / uso ristretto ospedaliero
 * Includono: last-resort, costi elevati, soggetti a Nota AIFA o PHT.
 * Richiedono prescrizione motivata.
 */
const ALTO_COSTO_PATTERNS: RegExp[] = [
  // ── Carbapenemi ───────────────────────────────────────────────
  /meropenem/i, /imipenem/i, /ertapenem/i, /doripenem/i,

  // ── Glicopeptidi ──────────────────────────────────────────────
  /vancomicin/i, /teicoplanin/i, /dalbavancin/i, /oritavancin/i,

  // ── Ossazolidinoni ────────────────────────────────────────────
  /linezolid/i, /tedizolid/i,

  // ── Polimixine (last resort) ───────────────────────────────────
  /colistin/i, /polimixina/i, /polymyxin/i,

  // ── Lipopeptidi ───────────────────────────────────────────────
  /daptomicin/i,

  // ── Beta-lattamici nuova generazione ──────────────────────────
  /ceftoloz/i, /ceftazidim.*avibactam/i, /cefiderocol/i, /ceftarolin/i,
  /aztreonam.*avibactam/i,

  // ── Tetracicline nuove generazione ────────────────────────────
  /tigeciclina/i, /omadaciclin/i, /eravaciclin/i,

  // ── Echinocandine (antifungini) ───────────────────────────────
  /caspofungin/i, /micafungin/i, /anidulafungin/i,

  // ── Azoli sistemici ───────────────────────────────────────────
  /voriconazol/i, /posaconazol/i, /isavuconazol/i,

  // ── Amfotericina B ────────────────────────────────────────────
  /amfotericina/i,  // nome italiano (Amphotericin B)

  // ── Fluorochinoloni (Nota AIFA — uso ristretto) ───────────────
  /ciprofloxacin/i, /levofloxacin/i, /moxifloxacin/i,

  // ── Fosfomicina (uso ospedaliero riservato) ───────────────────
  /fosfomicin/i,

  // ── Antivirali critici ────────────────────────────────────────
  /ganciclovir/i, /valganciclovir/i, /foscarnet/i, /cidofovir/i, /remdesivir/i,

  // ── Altri uso ristretto ───────────────────────────────────────
  /fidaxomicin/i,

  // ── Nomi commerciali ─────────────────────────────────────────
  /zavicefta/i,   // ceftazidima/avibactam
  /zerbaxa/i,     // ceftolozano/tazobactam
  /fetcroja/i,    // cefiderocolo
  /recarbrio/i,   // imipenem/cilastatina/relebactam
  /vabomere/i,    // meropenem/vaborbactam
  /xerava/i,      // eravacicline
  /nuzyra/i,      // omadacicline
  /zinforo/i,     // ceftarolina
  /orbactiv/i,    // oritavancin
  /dalvance/i,    // dalbavancin
  /sivextro/i,    // tedizolid
  /cresemba/i,    // isavuconazolo
  /noxafil/i,     // posaconazolo
  /vfend/i,       // voriconazolo
  /ecalta/i,      // anidulafungin
  /mycamine/i,    // micafungin
  /cancidas/i,    // caspofungin
  /abelcet/i,     // amfotericina B lipidica
  /ambisome/i,    // amfotericina B liposomiale
  /veklury/i,     // remdesivir
  /tamiflu/i,     // oseltamivir (scorte strategiche)
  /cymevene/i,    // ganciclovir
  /valcyte/i,     // valganciclovir
  /dificlir/i,    // fidaxomicin
];

export function isAltoCosto(principioAttivo: string): boolean {
  return ALTO_COSTO_PATTERNS.some((p) => p.test(principioAttivo));
}

export const CLASSE_LABEL: Record<ClasseAntibiotico, string> = {
  'beta-lattamici':  'Beta-lattamici',
  'aminoglicosidi':  'Aminoglicosidi',
  'chinolonici':     'Chinolonici',
  'glicopeptidi':    'Glicopeptidi',
  'macrolidi':       'Macrolidi',
  'carbapenemi':     'Carbapenemi',
  'tetracicline':    'Tetracicline',
  'lincosamidi':     'Lincosamidi',
  'ossazolidinoni':  'Ossazolidinoni',
  'polimixine':      'Polimixine',
  'sulfonamidi':     'Sulfonamidi / Trimetoprim',
  'nitrofurani':     'Nitrofurani',
  'nitroimidazoli':  'Nitroimidazoli',
  'antifungini':     'Antifungini',
  'antivirali':      'Antivirali',
  'altri':           'Altri antibiotici',
};
