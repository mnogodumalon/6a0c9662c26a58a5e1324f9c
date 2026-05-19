import type { Auftragsverwaltung, Produktionsplanung, Rechnungsverwaltung } from './app';

export type EnrichedAuftragsverwaltung = Auftragsverwaltung & {
  kundeName: string;
  motiveName: string;
};

export type EnrichedProduktionsplanung = Produktionsplanung & {
  auftragName: string;
};

export type EnrichedRechnungsverwaltung = Rechnungsverwaltung & {
  auftragName: string;
  kundeName: string;
};
