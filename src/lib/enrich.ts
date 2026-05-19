import type { EnrichedAuftragsverwaltung, EnrichedProduktionsplanung, EnrichedRechnungsverwaltung } from '@/types/enriched';
import type { Auftragsverwaltung, Kundenverwaltung, Motivkatalog, Produktionsplanung, Rechnungsverwaltung } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface AuftragsverwaltungMaps {
  kundenverwaltungMap: Map<string, Kundenverwaltung>;
  motivkatalogMap: Map<string, Motivkatalog>;
}

export function enrichAuftragsverwaltung(
  auftragsverwaltung: Auftragsverwaltung[],
  maps: AuftragsverwaltungMaps
): EnrichedAuftragsverwaltung[] {
  return auftragsverwaltung.map(r => ({
    ...r,
    kundeName: resolveDisplay(r.fields.kunde, maps.kundenverwaltungMap, 'vorname', 'nachname'),
    motiveName: resolveDisplay(r.fields.motive, maps.motivkatalogMap, 'motivname'),
  }));
}

interface ProduktionsplanungMaps {
  auftragsverwaltungMap: Map<string, Auftragsverwaltung>;
}

export function enrichProduktionsplanung(
  produktionsplanung: Produktionsplanung[],
  maps: ProduktionsplanungMaps
): EnrichedProduktionsplanung[] {
  return produktionsplanung.map(r => ({
    ...r,
    auftragName: resolveDisplay(r.fields.auftrag, maps.auftragsverwaltungMap, 'auftragsnummer'),
  }));
}

interface RechnungsverwaltungMaps {
  auftragsverwaltungMap: Map<string, Auftragsverwaltung>;
  kundenverwaltungMap: Map<string, Kundenverwaltung>;
}

export function enrichRechnungsverwaltung(
  rechnungsverwaltung: Rechnungsverwaltung[],
  maps: RechnungsverwaltungMaps
): EnrichedRechnungsverwaltung[] {
  return rechnungsverwaltung.map(r => ({
    ...r,
    auftragName: resolveDisplay(r.fields.auftrag, maps.auftragsverwaltungMap, 'auftragsnummer'),
    kundeName: resolveDisplay(r.fields.kunde, maps.kundenverwaltungMap, 'vorname', 'nachname'),
  }));
}
