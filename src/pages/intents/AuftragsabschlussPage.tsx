import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { AuftragsverwaltungDialog } from '@/components/dialogs/AuftragsverwaltungDialog';
import { ProduktionsplanungDialog } from '@/components/dialogs/ProduktionsplanungDialog';
import { RechnungsverwaltungDialog } from '@/components/dialogs/RechnungsverwaltungDialog';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { Auftragsverwaltung, Produktionsplanung, Rechnungsverwaltung, Kundenverwaltung, Motivkatalog } from '@/types/app';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  IconPackage,
  IconPrinter,
  IconFileInvoice,
  IconCircleCheck,
  IconPlus,
  IconPencil,
  IconArrowRight,
  IconArrowLeft,
  IconRefresh,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Auftrag' },
  { label: 'Produktion' },
  { label: 'Rechnung & Abschluss' },
];

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'dd.MM.yyyy');
  } catch {
    return dateStr;
  }
}

function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

export default function AuftragsabschlussPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Step state — read from URL on mount
  const [step, setStep] = useState<number>(() => {
    const urlStep = parseInt(searchParams.get('step') ?? '', 10);
    return urlStep >= 1 && urlStep <= 3 ? urlStep : 1;
  });

  // Selected order ID — read from URL on mount
  const [selectedAuftragId, setSelectedAuftragId] = useState<string | null>(
    () => searchParams.get('auftragId') ?? null
  );

  // Data state
  const [auftraege, setAuftraege] = useState<Auftragsverwaltung[]>([]);
  const [produktionRecords, setProduktionRecords] = useState<Produktionsplanung[]>([]);
  const [rechnungen, setRechnungen] = useState<Rechnungsverwaltung[]>([]);
  const [kunden, setKunden] = useState<Kundenverwaltung[]>([]);
  const [motive, setMotive] = useState<Motivkatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Dialog open states
  const [auftragDialogOpen, setAuftragDialogOpen] = useState(false);
  const [produktionDialogOpen, setProduktionDialogOpen] = useState(false);
  const [rechnungDialogOpen, setRechnungDialogOpen] = useState(false);

  // Completion state
  const [abschlussSuccess, setAbschlussSuccess] = useState(false);
  const [abschlussLoading, setAbschlussLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [auftraegeRaw, produktionRaw, rechnungenRaw, kundenRaw, motiveRaw] = await Promise.all([
        LivingAppsService.getAuftragsverwaltung(),
        LivingAppsService.getProduktionsplanung(),
        LivingAppsService.getRechnungsverwaltung(),
        LivingAppsService.getKundenverwaltung(),
        LivingAppsService.getMotivkatalog(),
      ]);
      setAuftraege(auftraegeRaw);
      setProduktionRecords(produktionRaw);
      setRechnungen(rechnungenRaw);
      setKunden(kundenRaw);
      setMotive(motiveRaw);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Sync step and auftragId to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (step > 1) {
      params.set('step', String(step));
    } else {
      params.delete('step');
    }
    if (selectedAuftragId) {
      params.set('auftragId', selectedAuftragId);
    } else {
      params.delete('auftragId');
    }
    setSearchParams(params, { replace: true });
  }, [step, selectedAuftragId, searchParams, setSearchParams]);

  // Derived: selected order
  const selectedAuftrag = selectedAuftragId
    ? auftraege.find(a => a.record_id === selectedAuftragId) ?? null
    : null;

  // Derived: production records for selected order
  const selectedAuftragUrl = selectedAuftragId
    ? createRecordUrl(APP_IDS.AUFTRAGSVERWALTUNG, selectedAuftragId)
    : null;

  const produktionForAuftrag = produktionRecords.filter(p => {
    if (!selectedAuftragUrl) return false;
    return p.fields.auftrag === selectedAuftragUrl;
  });

  const existingProduktion = produktionForAuftrag[0] ?? null;

  // Derived: invoices for selected order
  const rechnungForAuftrag = rechnungen.filter(r => {
    if (!selectedAuftragUrl) return false;
    return r.fields.auftrag === selectedAuftragUrl;
  });

  const existingRechnung = rechnungForAuftrag[0] ?? null;

  // Derived: kunde ID of selected order
  const selectedKundeId = selectedAuftrag
    ? extractRecordId(selectedAuftrag.fields.kunde)
    : null;

  // Handlers
  const handleSelectAuftrag = (id: string) => {
    setSelectedAuftragId(id);
    setAbschlussSuccess(false);
    setStep(2);
  };

  const handleAbschliessen = async () => {
    if (!selectedAuftragId) return;
    setAbschlussLoading(true);
    try {
      await LivingAppsService.updateAuftragsverwaltungEntry(selectedAuftragId, {
        status: 'abgeschlossen',
      });
      await fetchAll();
      setAbschlussSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Abschließen des Auftrags'));
    } finally {
      setAbschlussLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedAuftragId(null);
    setAbschlussSuccess(false);
    setStep(1);
  };

  // ---- RENDER ----

  return (
    <IntentWizardShell
      title="Auftrag abschließen"
      subtitle="Produktion planen, Rechnung erstellen und Auftrag als abgeschlossen markieren"
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ===== STEP 1: Auftrag auswählen ===== */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">Auftrag auswählen</h2>
            <p className="text-sm text-muted-foreground">
              Wähle den Auftrag, den du abschließen möchtest.
            </p>
          </div>

          <EntitySelectStep
            items={auftraege.map(a => ({
              id: a.record_id,
              title: a.fields.auftragsnummer ?? `Auftrag ${a.record_id.slice(-6)}`,
              subtitle: a.fields.auftragsdatum
                ? formatDate(a.fields.auftragsdatum)
                : undefined,
              status: a.fields.status
                ? { key: a.fields.status.key, label: a.fields.status.label }
                : undefined,
              stats: [
                {
                  label: 'Kunde',
                  value: (() => {
                    const kundeId = extractRecordId(a.fields.kunde);
                    if (!kundeId) return '—';
                    const k = kunden.find(kd => kd.record_id === kundeId);
                    if (!k) return kundeId.slice(-6);
                    return [k.fields.vorname, k.fields.nachname].filter(Boolean).join(' ')
                      || k.fields.unternehmen
                      || kundeId.slice(-6);
                  })(),
                },
                ...(a.fields.breite_cm && a.fields.hoehe_cm
                  ? [{ label: 'Maße', value: `${a.fields.breite_cm} × ${a.fields.hoehe_cm} cm` }]
                  : []),
                ...(a.fields.anzahl !== undefined
                  ? [{ label: 'Anzahl', value: String(a.fields.anzahl) }]
                  : []),
              ],
              icon: <IconPackage size={20} className="text-primary" />,
            }))}
            onSelect={handleSelectAuftrag}
            searchPlaceholder="Auftrag suchen..."
            emptyText="Keine Aufträge gefunden."
            emptyIcon={<IconPackage size={32} />}
            createLabel="Neuen Auftrag anlegen"
            onCreateNew={() => setAuftragDialogOpen(true)}
            createDialog={
              <AuftragsverwaltungDialog
                open={auftragDialogOpen}
                onClose={() => setAuftragDialogOpen(false)}
                onSubmit={async (fields) => {
                  await LivingAppsService.createAuftragsverwaltungEntry(fields);
                  await fetchAll();
                  setAuftragDialogOpen(false);
                }}
                kundenverwaltungList={kunden}
                motivkatalogList={motive}
                enablePhotoScan={AI_PHOTO_SCAN['Auftragsverwaltung']}
                enablePhotoLocation={AI_PHOTO_LOCATION['Auftragsverwaltung']}
              />
            }
          />
        </div>
      )}

      {/* ===== STEP 2: Produktion planen ===== */}
      {step === 2 && selectedAuftrag && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">Produktion planen</h2>
            <p className="text-sm text-muted-foreground">
              Plane die Produktion für den ausgewählten Auftrag.
            </p>
          </div>

          {/* Selected order summary */}
          <div className="p-4 rounded-xl border bg-card overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconPackage size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate">
                    {selectedAuftrag.fields.auftragsnummer ?? `Auftrag ${selectedAuftragId?.slice(-6)}`}
                  </span>
                  {selectedAuftrag.fields.status && (
                    <StatusBadge
                      statusKey={selectedAuftrag.fields.status.key}
                      label={selectedAuftrag.fields.status.label}
                    />
                  )}
                </div>
                <div className="flex gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                  {selectedAuftrag.fields.breite_cm && selectedAuftrag.fields.hoehe_cm && (
                    <span>
                      Maße: <span className="text-foreground font-medium">
                        {selectedAuftrag.fields.breite_cm} × {selectedAuftrag.fields.hoehe_cm} cm
                      </span>
                    </span>
                  )}
                  {selectedAuftrag.fields.anzahl !== undefined && (
                    <span>
                      Anzahl: <span className="text-foreground font-medium">{selectedAuftrag.fields.anzahl}</span>
                    </span>
                  )}
                  {selectedAuftrag.fields.auftragsdatum && (
                    <span>
                      Datum: <span className="text-foreground font-medium">
                        {formatDate(selectedAuftrag.fields.auftragsdatum)}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Production record */}
          {existingProduktion ? (
            <div className="p-4 rounded-xl border bg-card overflow-hidden">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <IconPrinter size={18} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">
                      {existingProduktion.fields.produktionsnummer ?? 'Produktionsplanung'}
                    </span>
                    {existingProduktion.fields.druckstatus && (
                      <StatusBadge
                        statusKey={existingProduktion.fields.druckstatus.key}
                        label={existingProduktion.fields.druckstatus.label}
                      />
                    )}
                  </div>
                  <div className="flex gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                    {existingProduktion.fields.geplantes_druckdatum && (
                      <span>
                        Geplanter Druck: <span className="text-foreground font-medium">
                          {formatDate(existingProduktion.fields.geplantes_druckdatum)}
                        </span>
                      </span>
                    )}
                    {existingProduktion.fields.zustaendiger_mitarbeiter && (
                      <span>
                        Mitarbeiter: <span className="text-foreground font-medium">
                          {existingProduktion.fields.zustaendiger_mitarbeiter}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-xl border border-dashed bg-muted/30 text-center">
              <div className="flex justify-center mb-2 opacity-40">
                <IconPrinter size={28} />
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Noch keine Produktionsplanung für diesen Auftrag vorhanden.
              </p>
            </div>
          )}

          {/* Action button for production dialog */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => setProduktionDialogOpen(true)}
          >
            {existingProduktion ? (
              <>
                <IconPencil size={16} />
                Produktionsplanung bearbeiten
              </>
            ) : (
              <>
                <IconPlus size={16} />
                Produktionsplanung anlegen
              </>
            )}
          </Button>

          <ProduktionsplanungDialog
            open={produktionDialogOpen}
            onClose={() => setProduktionDialogOpen(false)}
            onSubmit={async (fields) => {
              if (existingProduktion) {
                await LivingAppsService.updateProduktionsplanungEntry(existingProduktion.record_id, fields);
              } else {
                await LivingAppsService.createProduktionsplanungEntry(fields);
              }
              await fetchAll();
              setProduktionDialogOpen(false);
            }}
            defaultValues={
              existingProduktion
                ? existingProduktion.fields
                : selectedAuftragId
                ? { auftrag: createRecordUrl(APP_IDS.AUFTRAGSVERWALTUNG, selectedAuftragId) }
                : undefined
            }
            auftragsverwaltungList={auftraege}
            enablePhotoScan={AI_PHOTO_SCAN['Produktionsplanung']}
            enablePhotoLocation={AI_PHOTO_LOCATION['Produktionsplanung']}
          />

          {/* Navigation */}
          <div className="flex justify-between pt-2">
            <Button
              variant="ghost"
              className="gap-2"
              onClick={() => setStep(1)}
            >
              <IconArrowLeft size={16} />
              Zurück
            </Button>
            <Button
              className="gap-2"
              onClick={() => setStep(3)}
            >
              Weiter zu Rechnung
              <IconArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ===== STEP 3: Rechnung erstellen & Abschließen ===== */}
      {step === 3 && selectedAuftrag && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">Rechnung erstellen & Auftrag abschließen</h2>
            <p className="text-sm text-muted-foreground">
              Erstelle die Rechnung und schließe den Auftrag ab.
            </p>
          </div>

          {/* Selected order summary */}
          <div className="p-4 rounded-xl border bg-card overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconPackage size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate">
                    {selectedAuftrag.fields.auftragsnummer ?? `Auftrag ${selectedAuftragId?.slice(-6)}`}
                  </span>
                  {selectedAuftrag.fields.status && (
                    <StatusBadge
                      statusKey={selectedAuftrag.fields.status.key}
                      label={selectedAuftrag.fields.status.label}
                    />
                  )}
                </div>
                <div className="flex gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                  {selectedAuftrag.fields.breite_cm && selectedAuftrag.fields.hoehe_cm && (
                    <span>
                      Maße: <span className="text-foreground font-medium">
                        {selectedAuftrag.fields.breite_cm} × {selectedAuftrag.fields.hoehe_cm} cm
                      </span>
                    </span>
                  )}
                  {selectedAuftrag.fields.anzahl !== undefined && (
                    <span>
                      Anzahl: <span className="text-foreground font-medium">{selectedAuftrag.fields.anzahl}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Invoice section */}
          {existingRechnung ? (
            <div className="p-4 rounded-xl border bg-card overflow-hidden">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <IconFileInvoice size={18} className="text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">
                      {existingRechnung.fields.rechnungsnummer ?? 'Rechnung'}
                    </span>
                    {existingRechnung.fields.zahlungsstatus && (
                      <StatusBadge
                        statusKey={existingRechnung.fields.zahlungsstatus.key}
                        label={existingRechnung.fields.zahlungsstatus.label}
                      />
                    )}
                  </div>
                  <div className="flex gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                    {existingRechnung.fields.gesamtbetrag !== undefined && (
                      <span>
                        Gesamt: <span className="text-foreground font-medium text-base">
                          {formatCurrency(existingRechnung.fields.gesamtbetrag)}
                        </span>
                      </span>
                    )}
                    {existingRechnung.fields.faelligkeitsdatum && (
                      <span>
                        Fällig: <span className="text-foreground font-medium">
                          {formatDate(existingRechnung.fields.faelligkeitsdatum)}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-xl border border-dashed bg-muted/30 text-center">
              <div className="flex justify-center mb-2 opacity-40">
                <IconFileInvoice size={28} />
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Noch keine Rechnung für diesen Auftrag vorhanden.
              </p>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setRechnungDialogOpen(true)}
              >
                <IconPlus size={16} />
                Rechnung erstellen
              </Button>
            </div>
          )}

          {existingRechnung && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setRechnungDialogOpen(true)}
            >
              <IconPencil size={16} />
              Rechnung bearbeiten
            </Button>
          )}

          <RechnungsverwaltungDialog
            open={rechnungDialogOpen}
            onClose={() => setRechnungDialogOpen(false)}
            onSubmit={async (fields) => {
              if (existingRechnung) {
                await LivingAppsService.updateRechnungsverwaltungEntry(existingRechnung.record_id, fields);
              } else {
                await LivingAppsService.createRechnungsverwaltungEntry(fields);
              }
              await fetchAll();
              setRechnungDialogOpen(false);
            }}
            defaultValues={
              existingRechnung
                ? existingRechnung.fields
                : {
                    auftrag: selectedAuftragId
                      ? createRecordUrl(APP_IDS.AUFTRAGSVERWALTUNG, selectedAuftragId)
                      : undefined,
                    kunde: selectedKundeId
                      ? createRecordUrl(APP_IDS.KUNDENVERWALTUNG, selectedKundeId)
                      : undefined,
                    rechnungsdatum: format(new Date(), 'yyyy-MM-dd'),
                  }
            }
            auftragsverwaltungList={auftraege}
            kundenverwaltungList={kunden}
            enablePhotoScan={AI_PHOTO_SCAN['Rechnungsverwaltung']}
            enablePhotoLocation={AI_PHOTO_LOCATION['Rechnungsverwaltung']}
          />

          {/* Abschließen section */}
          {abschlussSuccess ? (
            <div className="p-6 rounded-xl border border-green-200 bg-green-50 text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <IconCircleCheck size={24} className="text-green-600" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-green-800 text-base">
                  Auftrag erfolgreich abgeschlossen!
                </h3>
                <p className="text-sm text-green-700 mt-1">
                  Der Auftrag wurde als "Abgeschlossen" markiert.
                </p>
              </div>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleReset}
              >
                <IconRefresh size={16} />
                Weiteren Auftrag abschließen
              </Button>
            </div>
          ) : (
            <div className="pt-2 space-y-3">
              <Button
                className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                onClick={handleAbschliessen}
                disabled={abschlussLoading}
              >
                {abschlussLoading ? (
                  <>Wird abgeschlossen...</>
                ) : (
                  <>
                    <IconCircleCheck size={18} />
                    Auftrag als "Abgeschlossen" markieren
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Navigation */}
          {!abschlussSuccess && (
            <div className="flex justify-start pt-1">
              <Button
                variant="ghost"
                className="gap-2"
                onClick={() => setStep(2)}
              >
                <IconArrowLeft size={16} />
                Zurück
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Fallback if step 2 or 3 with no selected order */}
      {step > 1 && !selectedAuftrag && (
        <div className="text-center py-12 space-y-3">
          <p className="text-sm text-muted-foreground">
            Kein Auftrag ausgewählt. Bitte gehe zurück zu Schritt 1.
          </p>
          <Button variant="outline" className="gap-2" onClick={() => setStep(1)}>
            <IconArrowLeft size={16} />
            Zurück zu Schritt 1
          </Button>
        </div>
      )}
    </IntentWizardShell>
  );
}
