import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDashboardData } from '@/hooks/useDashboardData';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { KundenverwaltungDialog } from '@/components/dialogs/KundenverwaltungDialog';
import { MotivkatalogDialog } from '@/components/dialogs/MotivkatalogDialog';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { Kundenverwaltung, Motivkatalog } from '@/types/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  IconUser,
  IconPhoto,
  IconCheck,
  IconPlus,
  IconArrowRight,
  IconArrowLeft,
  IconRefresh,
  IconRuler,
  IconCalendar,
  IconTruck,
  IconPrinter,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Kunde' },
  { label: 'Motiv & Details' },
  { label: 'Zusammenfassung' },
];

function formatCurrency(value: number): string {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function AuftragserfassungPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { kundenverwaltung, motivkatalog, loading, error, fetchAll } = useDashboardData();

  // Step state — initialize from URL param
  const [step, setStep] = useState<number>(() => {
    const urlStep = parseInt(searchParams.get('step') ?? '', 10);
    return urlStep >= 1 && urlStep <= 3 ? urlStep : 1;
  });

  // Step 1: Kunde
  const [selectedKundeId, setSelectedKundeId] = useState<string | null>(() => searchParams.get('kundeId'));
  const [kundeDialogOpen, setKundeDialogOpen] = useState(false);

  // Step 2: Motiv & Details
  const [selectedMotivId, setSelectedMotivId] = useState<string | null>(null);
  const [motivDialogOpen, setMotivDialogOpen] = useState(false);
  const [breiteCm, setBreiteCm] = useState<string>('');
  const [hoeheCm, setHoeheCm] = useState<string>('');
  const [anzahl, setAnzahl] = useState<string>('1');
  const [wunschlieferdatum, setWunschlieferdatum] = useState<string>('');
  const [montageGewuenscht, setMontageGewuenscht] = useState<boolean>(false);
  const [sonderwuensche, setSonderwuensche] = useState<string>('');

  // Step 3: Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  // Sync step to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (step > 1) {
      params.set('step', String(step));
    } else {
      params.delete('step');
    }
    if (selectedKundeId) {
      params.set('kundeId', selectedKundeId);
    } else {
      params.delete('kundeId');
    }
    setSearchParams(params, { replace: true });
  }, [step, selectedKundeId, searchParams, setSearchParams]);

  // Derived data
  const selectedKunde: Kundenverwaltung | undefined = useMemo(
    () => kundenverwaltung.find(k => k.record_id === selectedKundeId),
    [kundenverwaltung, selectedKundeId]
  );

  const activeMotivs: Motivkatalog[] = useMemo(
    () => motivkatalog.filter(m => m.fields.aktiv === true),
    [motivkatalog]
  );

  const selectedMotiv: Motivkatalog | undefined = useMemo(
    () => motivkatalog.find(m => m.record_id === selectedMotivId),
    [motivkatalog, selectedMotivId]
  );

  // Live price calculation
  const gesamtpreis: number | null = useMemo(() => {
    const b = parseFloat(breiteCm);
    const h = parseFloat(hoeheCm);
    const a = parseInt(anzahl, 10);
    const p = selectedMotiv?.fields.preis_pro_qm;
    if (!isNaN(b) && !isNaN(h) && !isNaN(a) && p != null && b > 0 && h > 0 && a > 0) {
      return p * (b / 100) * (h / 100) * a;
    }
    return null;
  }, [breiteCm, hoeheCm, anzahl, selectedMotiv]);

  function handleSelectKunde(id: string) {
    setSelectedKundeId(id);
    setStep(2);
  }

  function handleSelectMotiv(id: string) {
    setSelectedMotivId(id);
  }

  async function handleCreateAuftrag() {
    if (!selectedKundeId || !selectedMotivId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const fields: Record<string, unknown> = {
        auftragsdatum: today,
        status: 'neu',
        kunde: createRecordUrl(APP_IDS.KUNDENVERWALTUNG, selectedKundeId),
        motive: [createRecordUrl(APP_IDS.MOTIVKATALOG, selectedMotivId)],
        montage_gewuenscht: montageGewuenscht,
      };
      if (breiteCm) fields.breite_cm = parseFloat(breiteCm);
      if (hoeheCm) fields.hoehe_cm = parseFloat(hoeheCm);
      if (anzahl) fields.anzahl = parseInt(anzahl, 10);
      if (wunschlieferdatum) fields.wunschlieferdatum = wunschlieferdatum;
      if (sonderwuensche.trim()) fields.sonderwuensche = sonderwuensche;

      const result = await LivingAppsService.createAuftragsverwaltungEntry(fields as Parameters<typeof LivingAppsService.createAuftragsverwaltungEntry>[0]);
      // Result is an object keyed by record_id
      const entries = Object.entries(result as Record<string, unknown>);
      const newId = entries[0]?.[0] ?? 'unbekannt';
      setCreatedOrderId(newId);
      await fetchAll();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Fehler beim Erstellen des Auftrags.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setStep(1);
    setSelectedKundeId(null);
    setSelectedMotivId(null);
    setBreiteCm('');
    setHoeheCm('');
    setAnzahl('1');
    setWunschlieferdatum('');
    setMontageGewuenscht(false);
    setSonderwuensche('');
    setSubmitError(null);
    setCreatedOrderId(null);
  }

  const kundeName = selectedKunde
    ? [selectedKunde.fields.vorname, selectedKunde.fields.nachname].filter(Boolean).join(' ') || selectedKunde.fields.unternehmen || '—'
    : '—';

  return (
    <IntentWizardShell
      title="Neuen Auftrag erfassen"
      subtitle="Schritt fur Schritt zum fertigen Druckauftrag"
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ===================== STEP 1: Kunde ===================== */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <IconUser size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-base">Kunde auswahlen</h2>
              <p className="text-xs text-muted-foreground">Wahle einen bestehenden Kunden oder lege einen neuen an</p>
            </div>
          </div>

          {selectedKundeId && selectedKunde && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconUser size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{kundeName}</p>
                {selectedKunde.fields.unternehmen && (
                  <p className="text-xs text-muted-foreground truncate">{selectedKunde.fields.unternehmen}</p>
                )}
                {selectedKunde.fields.email && (
                  <p className="text-xs text-muted-foreground truncate">{selectedKunde.fields.email}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 text-primary">
                <IconCheck size={16} stroke={2.5} />
                <span className="text-xs font-medium">Ausgewahlt</span>
              </div>
            </div>
          )}

          <EntitySelectStep
            items={kundenverwaltung.map(k => ({
              id: k.record_id,
              title: [k.fields.vorname, k.fields.nachname].filter(Boolean).join(' ') || k.fields.unternehmen || '—',
              subtitle: k.fields.unternehmen || undefined,
              stats: k.fields.email ? [{ label: 'E-Mail', value: k.fields.email }] : undefined,
              icon: <IconUser size={18} className="text-primary" />,
            }))}
            onSelect={handleSelectKunde}
            searchPlaceholder="Kunde suchen..."
            emptyIcon={<IconUser size={32} />}
            emptyText="Noch kein Kunde vorhanden. Lege jetzt einen an."
            createLabel="Neuen Kunden anlegen"
            onCreateNew={() => setKundeDialogOpen(true)}
            createDialog={
              <KundenverwaltungDialog
                open={kundeDialogOpen}
                onClose={() => setKundeDialogOpen(false)}
                onSubmit={async (fields) => {
                  const result = await LivingAppsService.createKundenverwaltungEntry(fields);
                  const entries = Object.entries(result as Record<string, unknown>);
                  const newId = entries[0]?.[0];
                  await fetchAll();
                  if (newId) {
                    setSelectedKundeId(newId);
                  }
                }}
              />
            }
          />

          {selectedKundeId && (
            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep(2)} className="gap-2">
                Weiter zu Motiv & Details
                <IconArrowRight size={16} />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ===================== STEP 2: Motiv & Details ===================== */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <IconPhoto size={18} className="text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-base">Motiv & Details</h2>
                <p className="text-xs text-muted-foreground">Wahle ein Motiv und gib die Auftragsdetails ein</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="gap-1.5 text-muted-foreground">
              <IconArrowLeft size={14} />
              <span className="text-xs">Kunde andern</span>
            </Button>
          </div>

          {/* Selected customer hint */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-sm">
            <IconUser size={14} className="text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Kunde:</span>
            <span className="font-medium truncate">{kundeName}</span>
          </div>

          {/* Motiv grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Motiv auswahlen</h3>
              <Button variant="outline" size="sm" onClick={() => setMotivDialogOpen(true)} className="gap-1.5 text-xs">
                <IconPlus size={14} />
                Neues Motiv anlegen
              </Button>
            </div>

            <MotivkatalogDialog
              open={motivDialogOpen}
              onClose={() => setMotivDialogOpen(false)}
              onSubmit={async (fields) => {
                const result = await LivingAppsService.createMotivkatalogEntry(fields);
                const entries = Object.entries(result as Record<string, unknown>);
                const newId = entries[0]?.[0];
                await fetchAll();
                if (newId) {
                  setSelectedMotivId(newId);
                }
              }}
              enablePhotoScan
              enablePhotoLocation={false}
            />

            {activeMotivs.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-xl">
                <IconPhoto size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Keine aktiven Motive vorhanden.</p>
                <Button variant="outline" size="sm" onClick={() => setMotivDialogOpen(true)} className="mt-3 gap-1.5">
                  <IconPlus size={14} />
                  Neues Motiv anlegen
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeMotivs.map(motiv => {
                  const isSelected = selectedMotivId === motiv.record_id;
                  return (
                    <button
                      key={motiv.record_id}
                      type="button"
                      onClick={() => handleSelectMotiv(motiv.record_id)}
                      className={`w-full text-left rounded-xl border p-4 transition-all overflow-hidden ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border bg-card hover:border-primary/30 hover:bg-accent'
                      }`}
                    >
                      {motiv.fields.vorschaubild && (
                        <div className="w-full h-28 rounded-lg overflow-hidden mb-3 bg-muted">
                          <img
                            src={motiv.fields.vorschaubild}
                            alt={motiv.fields.motivname ?? ''}
                            className="w-full h-full object-cover"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">
                            {motiv.fields.motivname ?? '—'}
                          </p>
                          {motiv.fields.kategorie && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {motiv.fields.kategorie.label}
                            </p>
                          )}
                          {motiv.fields.preis_pro_qm != null && (
                            <p className="text-xs font-semibold text-primary mt-1">
                              {formatCurrency(motiv.fields.preis_pro_qm)}/m²
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                            <IconCheck size={12} stroke={2.5} className="text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Order detail fields */}
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <IconRuler size={16} className="text-muted-foreground" />
              Auftragsdetails
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="breite_cm">Breite (cm)</Label>
                <Input
                  id="breite_cm"
                  type="number"
                  min={1}
                  step="any"
                  placeholder="z. B. 100"
                  value={breiteCm}
                  onChange={e => setBreiteCm(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hoehe_cm">Hohe (cm)</Label>
                <Input
                  id="hoehe_cm"
                  type="number"
                  min={1}
                  step="any"
                  placeholder="z. B. 80"
                  value={hoeheCm}
                  onChange={e => setHoeheCm(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="anzahl">Anzahl</Label>
                <Input
                  id="anzahl"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="1"
                  value={anzahl}
                  onChange={e => setAnzahl(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wunschlieferdatum" className="flex items-center gap-1.5">
                <IconCalendar size={14} className="text-muted-foreground" />
                Wunschlieferdatum
              </Label>
              <Input
                id="wunschlieferdatum"
                type="date"
                value={wunschlieferdatum}
                onChange={e => setWunschlieferdatum(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="montage_gewuenscht"
                checked={montageGewuenscht}
                onCheckedChange={v => setMontageGewuenscht(!!v)}
              />
              <Label htmlFor="montage_gewuenscht" className="font-normal flex items-center gap-1.5 cursor-pointer">
                <IconTruck size={14} className="text-muted-foreground" />
                Montage gewunscht
              </Label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sonderwuensche">Sonderwunsche</Label>
              <Textarea
                id="sonderwuensche"
                placeholder="Besondere Anforderungen, Hinweise..."
                value={sonderwuensche}
                onChange={e => setSonderwuensche(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Live price preview */}
          {selectedMotiv && (
            <div className={`rounded-xl border p-4 ${gesamtpreis != null ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Gesamtpreis</p>
                  {gesamtpreis != null ? (
                    <p className="text-2xl font-bold text-primary mt-0.5">{formatCurrency(gesamtpreis)}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">Bitte Breite, Hohe und Anzahl eingeben</p>
                  )}
                </div>
                {gesamtpreis != null && (
                  <div className="text-right text-xs text-muted-foreground space-y-0.5">
                    <p>{formatCurrency(selectedMotiv.fields.preis_pro_qm ?? 0)}/m²</p>
                    <p>{breiteCm} × {hoeheCm} cm × {anzahl} Stk.</p>
                    <p className="font-medium">{((parseFloat(breiteCm) / 100) * (parseFloat(hoeheCm) / 100)).toFixed(4)} m²/Stk.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
              <IconArrowLeft size={16} />
              Zuruck
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!selectedMotivId}
              className="gap-2"
            >
              Weiter zur Zusammenfassung
              <IconArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ===================== STEP 3: Zusammenfassung ===================== */}
      {step === 3 && (
        <div className="space-y-6">
          {createdOrderId ? (
            /* Success state */
            <div className="flex flex-col items-center text-center py-8 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <IconCheck size={32} stroke={2.5} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Auftrag erstellt!</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Auftrag wurde erfolgreich angelegt.
                </p>
                <p className="text-xs text-muted-foreground mt-1 font-mono bg-muted px-2 py-1 rounded inline-block mt-2">
                  ID: {createdOrderId}
                </p>
              </div>
              <div className="flex gap-3 mt-2">
                <Button variant="outline" onClick={handleReset} className="gap-2">
                  <IconRefresh size={16} />
                  Weiteren Auftrag erfassen
                </Button>
                <Button asChild>
                  <a href="#/auftragsverwaltung" className="gap-2 inline-flex items-center">
                    <IconPrinter size={16} />
                    Zur Auftragsliste
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <IconCheck size={18} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-base">Zusammenfassung</h2>
                  <p className="text-xs text-muted-foreground">Pruf deine Eingaben und erstelle den Auftrag</p>
                </div>
              </div>

              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="px-4 py-3 bg-muted/30 border-b">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Auftragsubersicht</p>
                </div>
                <div className="divide-y">
                  {/* Kunde */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <IconUser size={15} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Kunde</p>
                      <p className="text-sm font-medium truncate">{kundeName}</p>
                      {selectedKunde?.fields.unternehmen && (
                        <p className="text-xs text-muted-foreground truncate">{selectedKunde.fields.unternehmen}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-xs text-primary shrink-0"
                    >
                      Andern
                    </button>
                  </div>

                  {/* Motiv */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <IconPhoto size={15} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Motiv</p>
                      <p className="text-sm font-medium truncate">{selectedMotiv?.fields.motivname ?? '—'}</p>
                      {selectedMotiv?.fields.kategorie && (
                        <p className="text-xs text-muted-foreground truncate">{selectedMotiv.fields.kategorie.label}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-xs text-primary shrink-0"
                    >
                      Andern
                    </button>
                  </div>

                  {/* Abmessungen */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <IconRuler size={15} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Abmessungen & Menge</p>
                      <p className="text-sm font-medium">
                        {breiteCm && hoeheCm
                          ? `${breiteCm} × ${hoeheCm} cm`
                          : '—'}
                        {anzahl && parseInt(anzahl, 10) > 1 ? ` · ${anzahl} Stk.` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Lieferdatum */}
                  {wunschlieferdatum && (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <IconCalendar size={15} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Wunschlieferdatum</p>
                        <p className="text-sm font-medium">{formatDate(wunschlieferdatum)}</p>
                      </div>
                    </div>
                  )}

                  {/* Montage */}
                  {montageGewuenscht && (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <IconTruck size={15} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Montage</p>
                        <p className="text-sm font-medium">Montage gewunscht</p>
                      </div>
                    </div>
                  )}

                  {/* Sonderwunsche */}
                  {sonderwuensche.trim() && (
                    <div className="px-4 py-3">
                      <p className="text-xs text-muted-foreground mb-1">Sonderwunsche</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{sonderwuensche}</p>
                    </div>
                  )}
                </div>

                {/* Gesamtpreis */}
                {gesamtpreis != null && (
                  <div className="flex items-center justify-between px-4 py-4 bg-primary/5 border-t border-primary/20">
                    <span className="text-sm font-semibold text-foreground">Gesamtpreis</span>
                    <span className="text-xl font-bold text-primary">{formatCurrency(gesamtpreis)}</span>
                  </div>
                )}
              </div>

              {submitError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {submitError}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                  <IconArrowLeft size={16} />
                  Zuruck
                </Button>
                <Button
                  onClick={handleCreateAuftrag}
                  disabled={submitting || !selectedKundeId || !selectedMotivId}
                  className="gap-2"
                >
                  {submitting ? (
                    <>
                      <IconRefresh size={16} className="animate-spin" />
                      Wird erstellt...
                    </>
                  ) : (
                    <>
                      <IconCheck size={16} />
                      Auftrag erstellen
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </IntentWizardShell>
  );
}
