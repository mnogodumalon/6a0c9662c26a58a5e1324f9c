import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichAuftragsverwaltung, enrichProduktionsplanung, enrichRechnungsverwaltung } from '@/lib/enrich';
import type { EnrichedAuftragsverwaltung, EnrichedProduktionsplanung, EnrichedRechnungsverwaltung } from '@/types/enriched';
import type { Auftragsverwaltung, Rechnungsverwaltung } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AuftragsverwaltungDialog } from '@/components/dialogs/AuftragsverwaltungDialog';
import { RechnungsverwaltungDialog } from '@/components/dialogs/RechnungsverwaltungDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  IconAlertCircle,
  IconTool,
  IconRefresh,
  IconCheck,
  IconPlus,
  IconPencil,
  IconTrash,
  IconReceipt,
  IconChartBar,
  IconClipboardList,
  IconCurrencyEuro,
  IconClock,
  IconTruck,
  IconChevronRight,
} from '@tabler/icons-react';

const APPGROUP_ID = '6a0c9662c26a58a5e1324f9c';
const REPAIR_ENDPOINT = '/claude/build/repair';

const STATUS_COLUMNS = [
  { key: 'neu', label: 'Neu', color: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  { key: 'in_bearbeitung', label: 'In Bearbeitung', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  { key: 'in_produktion', label: 'In Produktion', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  { key: 'versandbereit', label: 'Versandbereit', color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  { key: 'abgeschlossen', label: 'Abgeschlossen', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  { key: 'storniert', label: 'Storniert', color: 'bg-red-100 text-red-700', dot: 'bg-red-400' },
];

function statusColor(key: string | undefined) {
  return STATUS_COLUMNS.find(s => s.key === key) ?? STATUS_COLUMNS[0];
}

export default function DashboardOverview() {
  const {
    kundenverwaltung, motivkatalog, auftragsverwaltung, produktionsplanung, rechnungsverwaltung,
    kundenverwaltungMap, motivkatalogMap, auftragsverwaltungMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedAuftragsverwaltung = enrichAuftragsverwaltung(auftragsverwaltung, { kundenverwaltungMap, motivkatalogMap });
  const enrichedProduktionsplanung = enrichProduktionsplanung(produktionsplanung, { auftragsverwaltungMap });
  const enrichedRechnungsverwaltung = enrichRechnungsverwaltung(rechnungsverwaltung, { auftragsverwaltungMap, kundenverwaltungMap });

  // ALL hooks before early returns
  const [auftragDialogOpen, setAuftragDialogOpen] = useState(false);
  const [editAuftrag, setEditAuftrag] = useState<EnrichedAuftragsverwaltung | null>(null);
  const [deleteAuftrag, setDeleteAuftrag] = useState<EnrichedAuftragsverwaltung | null>(null);
  const [rechnungDialogOpen, setRechnungDialogOpen] = useState(false);
  const [editRechnung, setEditRechnung] = useState<EnrichedRechnungsverwaltung | null>(null);
  const [activeTab, setActiveTab] = useState<'auftraege' | 'produktion' | 'rechnungen'>('auftraege');

  const byStatus = useMemo(() => {
    const map: Record<string, EnrichedAuftragsverwaltung[]> = {};
    STATUS_COLUMNS.forEach(s => { map[s.key] = []; });
    enrichedAuftragsverwaltung.forEach(a => {
      const k = a.fields.status?.key ?? 'neu';
      if (map[k]) map[k].push(a);
      else map['neu'].push(a);
    });
    return map;
  }, [enrichedAuftragsverwaltung]);

  const offeneRechnungen = useMemo(() =>
    enrichedRechnungsverwaltung.filter(r => r.fields.zahlungsstatus?.key === 'offen' || r.fields.zahlungsstatus?.key === 'ueberfaellig'),
    [enrichedRechnungsverwaltung]);

  const umsatzGesamt = useMemo(() =>
    enrichedRechnungsverwaltung.reduce((sum, r) => sum + (r.fields.gesamtbetrag ?? 0), 0),
    [enrichedRechnungsverwaltung]);

  const inProduktion = useMemo(() =>
    enrichedProduktionsplanung.filter(p => p.fields.druckstatus?.key === 'in_druck' || p.fields.druckstatus?.key === 'geplant'),
    [enrichedProduktionsplanung]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const handleAuftragCreate = async (fields: Auftragsverwaltung['fields']) => {
    await LivingAppsService.createAuftragsverwaltungEntry(fields);
    fetchAll();
  };

  const handleAuftragEdit = async (fields: Auftragsverwaltung['fields']) => {
    if (!editAuftrag) return;
    await LivingAppsService.updateAuftragsverwaltungEntry(editAuftrag.record_id, fields);
    fetchAll();
  };

  const handleAuftragDelete = async () => {
    if (!deleteAuftrag) return;
    await LivingAppsService.deleteAuftragsverwaltungEntry(deleteAuftrag.record_id);
    setDeleteAuftrag(null);
    fetchAll();
  };

  const handleRechnungCreate = async (fields: Rechnungsverwaltung['fields']) => {
    await LivingAppsService.createRechnungsverwaltungEntry(fields);
    fetchAll();
  };

  const handleRechnungEdit = async (fields: Rechnungsverwaltung['fields']) => {
    if (!editRechnung) return;
    await LivingAppsService.updateRechnungsverwaltungEntry(editRechnung.record_id, fields);
    fetchAll();
  };

  const activeAuftraege = enrichedAuftragsverwaltung.filter(a => a.fields.status?.key !== 'abgeschlossen' && a.fields.status?.key !== 'storniert');

  return (
    <div className="space-y-6">
      {/* Workflow-Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <a href="#/intents/auftragserfassung" className="flex items-center gap-4 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow no-underline">
          <div className="flex-shrink-0 p-2 bg-primary/10 rounded-lg">
            <IconClipboardList size={24} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-foreground truncate">Neuen Auftrag erfassen</div>
            <div className="text-sm text-muted-foreground truncate">Kunde auswählen, Motiv wählen & Auftrag anlegen</div>
          </div>
          <IconChevronRight size={18} className="text-muted-foreground flex-shrink-0" />
        </a>
        <a href="#/intents/auftragsabschluss" className="flex items-center gap-4 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow no-underline">
          <div className="flex-shrink-0 p-2 bg-primary/10 rounded-lg">
            <IconCheck size={24} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-foreground truncate">Auftrag abschließen</div>
            <div className="text-sm text-muted-foreground truncate">Produktion planen, Rechnung erstellen & fertigstellen</div>
          </div>
          <IconChevronRight size={18} className="text-muted-foreground flex-shrink-0" />
        </a>
      </div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">WandArt Manager</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Auftrags- & Produktionsübersicht</p>
        </div>
        <Button onClick={() => { setEditAuftrag(null); setAuftragDialogOpen(true); }} className="shrink-0">
          <IconPlus size={16} className="mr-1.5 shrink-0" />
          Neuer Auftrag
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Aktive Aufträge"
          value={String(activeAuftraege.length)}
          description="Offen & in Arbeit"
          icon={<IconClipboardList size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="In Produktion"
          value={String(inProduktion.length)}
          description="Geplant & im Druck"
          icon={<IconClock size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Offene Rechnungen"
          value={String(offeneRechnungen.length)}
          description="Offen & überfällig"
          icon={<IconReceipt size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Gesamtumsatz"
          value={umsatzGesamt >= 1000 ? `${(umsatzGesamt / 1000).toFixed(1)}k €` : formatCurrency(umsatzGesamt)}
          description="Alle Rechnungen"
          icon={<IconCurrencyEuro size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border">
        {([
          { key: 'auftraege', label: 'Auftrags-Pipeline', icon: IconChartBar },
          { key: 'produktion', label: 'Produktion', icon: IconClock },
          { key: 'rechnungen', label: 'Rechnungen', icon: IconReceipt },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon size={15} className="shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Auftrags-Pipeline (Kanban) */}
      {activeTab === 'auftraege' && (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {STATUS_COLUMNS.filter(s => s.key !== 'storniert').map(col => {
              const items = byStatus[col.key] ?? [];
              return (
                <div key={col.key} className="w-64 flex flex-col gap-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{col.label}</span>
                    <span className="ml-auto text-xs font-medium text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">{items.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.map(auftrag => (
                      <AuftragCard
                        key={auftrag.record_id}
                        auftrag={auftrag}
                        onEdit={() => { setEditAuftrag(auftrag); setAuftragDialogOpen(true); }}
                        onDelete={() => setDeleteAuftrag(auftrag)}
                      />
                    ))}
                    {items.length === 0 && (
                      <div className="rounded-xl border border-dashed border-border h-20 flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">Leer</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Produktion */}
      {activeTab === 'produktion' && (
        <div className="space-y-3">
          {enrichedProduktionsplanung.length === 0 ? (
            <EmptyState icon={<IconClock size={48} stroke={1.5} className="text-muted-foreground" />} text="Keine Produktionseinträge vorhanden" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Prod.-Nr.</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Auftrag</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Drucker</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Druckdatum</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Mitarbeiter</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">QS</th>
                  </tr>
                </thead>
                <tbody>
                  {enrichedProduktionsplanung.map(p => {
                    const ds = p.fields.druckstatus?.key;
                    const dsLabel = p.fields.druckstatus?.label ?? '—';
                    const dsColor =
                      ds === 'in_druck' ? 'bg-amber-100 text-amber-700' :
                      ds === 'freigegeben' ? 'bg-green-100 text-green-700' :
                      ds === 'qualitaetspruefung' ? 'bg-blue-100 text-blue-700' :
                      ds === 'nacharbeit_erforderlich' ? 'bg-red-100 text-red-700' :
                      ds === 'druck_abgeschlossen' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-slate-100 text-slate-700';
                    return (
                      <tr key={p.record_id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                        <td className="py-2.5 px-3 font-medium">{p.fields.produktionsnummer ?? '—'}</td>
                        <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[120px]">{p.auftragName || '—'}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${dsColor}`}>{dsLabel}</span>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">{p.fields.drucker?.label ?? '—'}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{formatDate(p.fields.geplantes_druckdatum)}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{p.fields.zustaendiger_mitarbeiter ?? '—'}</td>
                        <td className="py-2.5 px-3">
                          {p.fields.qualitaetspruefung_bestanden === true
                            ? <IconCheck size={16} className="text-green-500" />
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Rechnungen */}
      {activeTab === 'rechnungen' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => { setEditRechnung(null); setRechnungDialogOpen(true); }}>
              <IconPlus size={14} className="mr-1.5" />
              Neue Rechnung
            </Button>
          </div>
          {enrichedRechnungsverwaltung.length === 0 ? (
            <EmptyState icon={<IconReceipt size={48} stroke={1.5} className="text-muted-foreground" />} text="Keine Rechnungen vorhanden" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Nr.</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Kunde</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Datum</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Fälligkeit</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Betrag</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                    <th className="py-2 px-3 font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {enrichedRechnungsverwaltung.map(r => {
                    const zs = r.fields.zahlungsstatus?.key;
                    const zsLabel = r.fields.zahlungsstatus?.label ?? '—';
                    const zsColor =
                      zs === 'bezahlt' ? 'bg-green-100 text-green-700' :
                      zs === 'ueberfaellig' ? 'bg-red-100 text-red-700' :
                      zs === 'offen' ? 'bg-amber-100 text-amber-700' :
                      zs === 'teilweise_bezahlt' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-700';
                    return (
                      <tr key={r.record_id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                        <td className="py-2.5 px-3 font-medium">{r.fields.rechnungsnummer ?? '—'}</td>
                        <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[140px]">{r.kundeName || '—'}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{formatDate(r.fields.rechnungsdatum)}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{formatDate(r.fields.faelligkeitsdatum)}</td>
                        <td className="py-2.5 px-3 font-medium">{formatCurrency(r.fields.gesamtbetrag)}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${zsColor}`}>{zsLabel}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <button
                            onClick={() => { setEditRechnung(r); setRechnungDialogOpen(true); }}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                            title="Bearbeiten"
                          >
                            <IconPencil size={14} className="text-muted-foreground" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <AuftragsverwaltungDialog
        open={auftragDialogOpen}
        onClose={() => { setAuftragDialogOpen(false); setEditAuftrag(null); }}
        onSubmit={editAuftrag ? handleAuftragEdit : handleAuftragCreate}
        defaultValues={editAuftrag?.fields}
        kundenverwaltungList={kundenverwaltung}
        motivkatalogList={motivkatalog}
        enablePhotoScan={AI_PHOTO_SCAN['Auftragsverwaltung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Auftragsverwaltung']}
      />

      <RechnungsverwaltungDialog
        open={rechnungDialogOpen}
        onClose={() => { setRechnungDialogOpen(false); setEditRechnung(null); }}
        onSubmit={editRechnung ? handleRechnungEdit : handleRechnungCreate}
        defaultValues={editRechnung?.fields}
        auftragsverwaltungList={auftragsverwaltung}
        kundenverwaltungList={kundenverwaltung}
        enablePhotoScan={AI_PHOTO_SCAN['Rechnungsverwaltung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Rechnungsverwaltung']}
      />

      <ConfirmDialog
        open={!!deleteAuftrag}
        title="Auftrag löschen"
        description={`Auftrag "${deleteAuftrag?.fields.auftragsnummer ?? ''}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
        onConfirm={handleAuftragDelete}
        onClose={() => setDeleteAuftrag(null)}
      />
    </div>
  );
}

function AuftragCard({
  auftrag,
  onEdit,
  onDelete,
}: {
  auftrag: EnrichedAuftragsverwaltung;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const st = statusColor(auftrag.fields.status?.key);
  const dimension = auftrag.fields.breite_cm && auftrag.fields.hoehe_cm
    ? `${auftrag.fields.breite_cm} × ${auftrag.fields.hoehe_cm} cm`
    : null;

  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-foreground truncate min-w-0">
          {auftrag.fields.auftragsnummer ?? '—'}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-1 rounded-md hover:bg-muted transition-colors"
            title="Bearbeiten"
          >
            <IconPencil size={13} className="text-muted-foreground" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded-md hover:bg-destructive/10 transition-colors"
            title="Löschen"
          >
            <IconTrash size={13} className="text-destructive/70" />
          </button>
        </div>
      </div>

      {auftrag.kundeName && (
        <p className="text-xs text-muted-foreground truncate mb-1">{auftrag.kundeName}</p>
      )}

      <div className="flex flex-wrap gap-1 mt-2">
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium ${st.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
          {auftrag.fields.status?.label ?? 'Neu'}
        </span>
        {auftrag.fields.material_auswahl && (
          <span className="px-1.5 py-0.5 rounded-md text-xs bg-muted text-muted-foreground">
            {auftrag.fields.material_auswahl.label}
          </span>
        )}
      </div>

      {dimension && (
        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
          <IconTruck size={11} className="shrink-0" />
          {dimension}
        </p>
      )}

      {auftrag.fields.wunschlieferdatum && (
        <p className="text-xs text-muted-foreground mt-1">
          Lieferung: {formatDate(auftrag.fields.wunschlieferdatum)}
        </p>
      )}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      {icon}
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="flex gap-3 overflow-hidden">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-64 w-64 rounded-xl shrink-0" />)}
      </div>
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          if (content.startsWith('[DONE]')) { setRepairDone(true); setRepairing(false); }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) setRepairFailed(true);
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte lade die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktiere den Support.</p>}
    </div>
  );
}
