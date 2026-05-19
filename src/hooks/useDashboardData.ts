import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Kundenverwaltung, Motivkatalog, Auftragsverwaltung, Produktionsplanung, Rechnungsverwaltung } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [kundenverwaltung, setKundenverwaltung] = useState<Kundenverwaltung[]>([]);
  const [motivkatalog, setMotivkatalog] = useState<Motivkatalog[]>([]);
  const [auftragsverwaltung, setAuftragsverwaltung] = useState<Auftragsverwaltung[]>([]);
  const [produktionsplanung, setProduktionsplanung] = useState<Produktionsplanung[]>([]);
  const [rechnungsverwaltung, setRechnungsverwaltung] = useState<Rechnungsverwaltung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [kundenverwaltungData, motivkatalogData, auftragsverwaltungData, produktionsplanungData, rechnungsverwaltungData] = await Promise.all([
        LivingAppsService.getKundenverwaltung(),
        LivingAppsService.getMotivkatalog(),
        LivingAppsService.getAuftragsverwaltung(),
        LivingAppsService.getProduktionsplanung(),
        LivingAppsService.getRechnungsverwaltung(),
      ]);
      setKundenverwaltung(kundenverwaltungData);
      setMotivkatalog(motivkatalogData);
      setAuftragsverwaltung(auftragsverwaltungData);
      setProduktionsplanung(produktionsplanungData);
      setRechnungsverwaltung(rechnungsverwaltungData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [kundenverwaltungData, motivkatalogData, auftragsverwaltungData, produktionsplanungData, rechnungsverwaltungData] = await Promise.all([
          LivingAppsService.getKundenverwaltung(),
          LivingAppsService.getMotivkatalog(),
          LivingAppsService.getAuftragsverwaltung(),
          LivingAppsService.getProduktionsplanung(),
          LivingAppsService.getRechnungsverwaltung(),
        ]);
        setKundenverwaltung(kundenverwaltungData);
        setMotivkatalog(motivkatalogData);
        setAuftragsverwaltung(auftragsverwaltungData);
        setProduktionsplanung(produktionsplanungData);
        setRechnungsverwaltung(rechnungsverwaltungData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const kundenverwaltungMap = useMemo(() => {
    const m = new Map<string, Kundenverwaltung>();
    kundenverwaltung.forEach(r => m.set(r.record_id, r));
    return m;
  }, [kundenverwaltung]);

  const motivkatalogMap = useMemo(() => {
    const m = new Map<string, Motivkatalog>();
    motivkatalog.forEach(r => m.set(r.record_id, r));
    return m;
  }, [motivkatalog]);

  const auftragsverwaltungMap = useMemo(() => {
    const m = new Map<string, Auftragsverwaltung>();
    auftragsverwaltung.forEach(r => m.set(r.record_id, r));
    return m;
  }, [auftragsverwaltung]);

  return { kundenverwaltung, setKundenverwaltung, motivkatalog, setMotivkatalog, auftragsverwaltung, setAuftragsverwaltung, produktionsplanung, setProduktionsplanung, rechnungsverwaltung, setRechnungsverwaltung, loading, error, fetchAll, kundenverwaltungMap, motivkatalogMap, auftragsverwaltungMap };
}