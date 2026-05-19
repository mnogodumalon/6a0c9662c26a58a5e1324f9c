// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface Kundenverwaltung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    unternehmen?: string;
    kundentyp?: LookupValue;
    email?: string;
    telefon?: string;
    strasse?: string;
    hausnummer?: string;
    postleitzahl?: string;
    ort?: string;
    land?: string;
    anmerkungen?: string;
  };
}

export interface Motivkatalog {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    beschreibung?: string;
    kategorie?: LookupValue;
    max_breite_cm?: number;
    max_hoehe_cm?: number;
    material?: LookupValue[];
    preis_pro_qm?: number;
    vorschaubild?: string;
    aktiv?: boolean;
    motivname?: string;
  };
}

export interface Auftragsverwaltung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    auftragsnummer?: string;
    auftragsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    status?: LookupValue;
    kunde?: string; // applookup -> URL zu 'Kundenverwaltung' Record
    motive?: string;
    breite_cm?: number;
    hoehe_cm?: number;
    anzahl?: number;
    material_auswahl?: LookupValue;
    wunschlieferdatum?: string; // Format: YYYY-MM-DD oder ISO String
    montage_gewuenscht?: boolean;
    lieferadresse_abweichend?: boolean;
    lieferstrasse?: string;
    lieferhausnummer?: string;
    lieferpostleitzahl?: string;
    lieferort?: string;
    sonderwuensche?: string;
    interne_notizen?: string;
  };
}

export interface Produktionsplanung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    tatsaechliches_druckdatum?: string; // Format: YYYY-MM-DD oder ISO String
    drucker?: LookupValue;
    zustaendiger_mitarbeiter?: string;
    druckstatus?: LookupValue;
    qualitaetspruefung_bestanden?: boolean;
    produktionsanmerkungen?: string;
    produktionsnummer?: string;
    auftrag?: string; // applookup -> URL zu 'Auftragsverwaltung' Record
    geplantes_druckdatum?: string; // Format: YYYY-MM-DD oder ISO String
  };
}

export interface Rechnungsverwaltung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    rechnungsnummer?: string;
    rechnungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    faelligkeitsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    auftrag?: string; // applookup -> URL zu 'Auftragsverwaltung' Record
    kunde?: string; // applookup -> URL zu 'Kundenverwaltung' Record
    nettobetrag?: number;
    mwst_satz?: LookupValue;
    mwst_betrag?: number;
    gesamtbetrag?: number;
    zahlungsart?: LookupValue;
    zahlungsstatus?: LookupValue;
    zahlungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    rechnungsanmerkungen?: string;
  };
}

export const APP_IDS = {
  KUNDENVERWALTUNG: '6a0c963019308b30eb172e5a',
  MOTIVKATALOG: '6a0c963b2b58ecdaddd9c45a',
  AUFTRAGSVERWALTUNG: '6a0c963cb70cf78c53ae48f5',
  PRODUKTIONSPLANUNG: '6a0c963da5117dc0bec710a2',
  RECHNUNGSVERWALTUNG: '6a0c963dfa85ba0c705b1848',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'kundenverwaltung': {
    kundentyp: [{ key: "privatkunde", label: "Privatkunde" }, { key: "geschaeftskunde", label: "Geschäftskunde" }],
  },
  'motivkatalog': {
    kategorie: [{ key: "natur_landschaft", label: "Natur & Landschaft" }, { key: "stadtansichten", label: "Stadtansichten" }, { key: "abstrakt", label: "Abstrakt" }, { key: "tiere", label: "Tiere" }, { key: "architektur", label: "Architektur" }, { key: "kunst_illustration", label: "Kunst & Illustration" }, { key: "sonstiges", label: "Sonstiges" }],
    material: [{ key: "leinwand", label: "Leinwand" }, { key: "fotopaier", label: "Fotopapier" }, { key: "acrylglas", label: "Acrylglas" }, { key: "aluminium_dibond", label: "Aluminium-Dibond" }, { key: "tapete", label: "Tapete" }, { key: "pvc_plane", label: "PVC-Plane" }],
  },
  'auftragsverwaltung': {
    status: [{ key: "neu", label: "Neu" }, { key: "in_bearbeitung", label: "In Bearbeitung" }, { key: "in_produktion", label: "In Produktion" }, { key: "versandbereit", label: "Versandbereit" }, { key: "abgeschlossen", label: "Abgeschlossen" }, { key: "storniert", label: "Storniert" }],
    material_auswahl: [{ key: "leinwand", label: "Leinwand" }, { key: "fotopaier", label: "Fotopaier" }, { key: "acrylglas", label: "Acrylglas" }, { key: "aluminium_dibond", label: "Aluminium-Dibond" }, { key: "tapete", label: "Tapete" }, { key: "pvc_plane", label: "PVC-Plane" }],
  },
  'produktionsplanung': {
    drucker: [{ key: "vertikaldrucker_1", label: "Vertikaldrucker 1" }, { key: "vertikaldrucker_2", label: "Vertikaldrucker 2" }, { key: "vertikaldrucker_3", label: "Vertikaldrucker 3" }],
    druckstatus: [{ key: "geplant", label: "Geplant" }, { key: "in_druck", label: "In Druck" }, { key: "druck_abgeschlossen", label: "Druck abgeschlossen" }, { key: "qualitaetspruefung", label: "Qualitätsprüfung" }, { key: "freigegeben", label: "Freigegeben" }, { key: "nacharbeit_erforderlich", label: "Nacharbeit erforderlich" }],
  },
  'rechnungsverwaltung': {
    mwst_satz: [{ key: "mwst_19", label: "19 %" }, { key: "mwst_7", label: "7 %" }, { key: "mwst_0", label: "0 %" }],
    zahlungsart: [{ key: "ueberweisung", label: "Überweisung" }, { key: "lastschrift", label: "Lastschrift" }, { key: "kreditkarte", label: "Kreditkarte" }, { key: "paypal", label: "PayPal" }, { key: "bar", label: "Bar" }],
    zahlungsstatus: [{ key: "offen", label: "Offen" }, { key: "teilweise_bezahlt", label: "Teilweise bezahlt" }, { key: "bezahlt", label: "Bezahlt" }, { key: "ueberfaellig", label: "Überfällig" }, { key: "storniert", label: "Storniert" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'kundenverwaltung': {
    'vorname': 'string/text',
    'nachname': 'string/text',
    'unternehmen': 'string/text',
    'kundentyp': 'lookup/radio',
    'email': 'string/email',
    'telefon': 'string/tel',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'postleitzahl': 'string/text',
    'ort': 'string/text',
    'land': 'string/text',
    'anmerkungen': 'string/textarea',
  },
  'motivkatalog': {
    'beschreibung': 'string/textarea',
    'kategorie': 'lookup/select',
    'max_breite_cm': 'number',
    'max_hoehe_cm': 'number',
    'material': 'multiplelookup/checkbox',
    'preis_pro_qm': 'number',
    'vorschaubild': 'file',
    'aktiv': 'bool',
    'motivname': 'string/text',
  },
  'auftragsverwaltung': {
    'auftragsnummer': 'string/text',
    'auftragsdatum': 'date/date',
    'status': 'lookup/select',
    'kunde': 'applookup/select',
    'motive': 'multipleapplookup/select',
    'breite_cm': 'number',
    'hoehe_cm': 'number',
    'anzahl': 'number',
    'material_auswahl': 'lookup/select',
    'wunschlieferdatum': 'date/date',
    'montage_gewuenscht': 'bool',
    'lieferadresse_abweichend': 'bool',
    'lieferstrasse': 'string/text',
    'lieferhausnummer': 'string/text',
    'lieferpostleitzahl': 'string/text',
    'lieferort': 'string/text',
    'sonderwuensche': 'string/textarea',
    'interne_notizen': 'string/textarea',
  },
  'produktionsplanung': {
    'tatsaechliches_druckdatum': 'date/date',
    'drucker': 'lookup/select',
    'zustaendiger_mitarbeiter': 'string/text',
    'druckstatus': 'lookup/select',
    'qualitaetspruefung_bestanden': 'bool',
    'produktionsanmerkungen': 'string/textarea',
    'produktionsnummer': 'string/text',
    'auftrag': 'applookup/select',
    'geplantes_druckdatum': 'date/date',
  },
  'rechnungsverwaltung': {
    'rechnungsnummer': 'string/text',
    'rechnungsdatum': 'date/date',
    'faelligkeitsdatum': 'date/date',
    'auftrag': 'applookup/select',
    'kunde': 'applookup/select',
    'nettobetrag': 'number',
    'mwst_satz': 'lookup/radio',
    'mwst_betrag': 'number',
    'gesamtbetrag': 'number',
    'zahlungsart': 'lookup/select',
    'zahlungsstatus': 'lookup/select',
    'zahlungsdatum': 'date/date',
    'rechnungsanmerkungen': 'string/textarea',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateKundenverwaltung = StripLookup<Kundenverwaltung['fields']>;
export type CreateMotivkatalog = StripLookup<Motivkatalog['fields']>;
export type CreateAuftragsverwaltung = StripLookup<Auftragsverwaltung['fields']>;
export type CreateProduktionsplanung = StripLookup<Produktionsplanung['fields']>;
export type CreateRechnungsverwaltung = StripLookup<Rechnungsverwaltung['fields']>;