import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Rechnungsverwaltung, Auftragsverwaltung, Kundenverwaltung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId, createRecordUrl, cleanFieldsForApi, getUserProfile, LivingAppsService } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ComputedContext } from '@/config/form-enhancements/types';
import { applyFieldOrder, flattenFieldOrder, applyDefaults, evalComputed, numberInputProps, clampNumberValue, classifyComputed, extractApplookupRefs, mergeApplookupRefs, resolveApplookupRef } from '@/config/form-enhancements/types';
import { formEnhancements, computedDeps, computedApplookupRefs } from '@/config/form-enhancements/Rechnungsverwaltung';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/Combobox';
import { AuftragsverwaltungDialog } from '@/components/dialogs/AuftragsverwaltungDialog';
import { KundenverwaltungDialog } from '@/components/dialogs/KundenverwaltungDialog';
import { DatePicker } from '@/components/DatePicker';
import { Checkbox } from '@/components/ui/checkbox';
import { IconCamera, IconChevronDown, IconCircleCheck, IconClipboard, IconFileText, IconLoader2, IconPhotoPlus, IconSparkles, IconUpload, IconX } from '@tabler/icons-react';
import { fileToDataUri, extractFromInput, extractPhotoMeta, reverseGeocode } from '@/lib/ai';
import { lookupKey } from '@/lib/formatters';

interface RechnungsverwaltungDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: Rechnungsverwaltung['fields']) => Promise<void>;
  defaultValues?: Rechnungsverwaltung['fields'];
  auftragsverwaltungList: Auftragsverwaltung[];
  kundenverwaltungList: Kundenverwaltung[];
  enablePhotoScan?: boolean;
  enablePhotoLocation?: boolean;
}

export function RechnungsverwaltungDialog({ open, onClose, onSubmit, defaultValues, auftragsverwaltungList, kundenverwaltungList, enablePhotoScan = true, enablePhotoLocation = true }: RechnungsverwaltungDialogProps) {
  const [fields, setFields] = useState<Partial<Rechnungsverwaltung['fields']>>({});
  const [saving, setSaving] = useState(false);
  // Inline-Create state for "Auftragsverwaltung" target. The dropdown's
  // "+ Neuer …" option opens a sub-dialog; on submit we POST, add the new
  // record to the local `extraAuftragsverwaltung` list, and select it in
  // the originating Combobox via the captured `createAuftragsverwaltungField`.
  const [createAuftragsverwaltungOpen, setCreateAuftragsverwaltungOpen] = useState(false);
  const [createAuftragsverwaltungInitial, setCreateAuftragsverwaltungInitial] = useState('');
  const [createAuftragsverwaltungField, setCreateAuftragsverwaltungField] = useState<string>('');
  const [extraAuftragsverwaltung, setExtraAuftragsverwaltung] = useState< Auftragsverwaltung[]>([]);
  const auftragsverwaltungListAll = useMemo(
    () => [...auftragsverwaltungList, ...extraAuftragsverwaltung],
    [auftragsverwaltungList, extraAuftragsverwaltung],
  );
  function openCreateAuftragsverwaltung(fieldKey: string, q: string) {
    setCreateAuftragsverwaltungField(fieldKey);
    setCreateAuftragsverwaltungInitial(q);
    setCreateAuftragsverwaltungOpen(true);
  }
  // Inline-Create state for "Kundenverwaltung" target. The dropdown's
  // "+ Neuer …" option opens a sub-dialog; on submit we POST, add the new
  // record to the local `extraKundenverwaltung` list, and select it in
  // the originating Combobox via the captured `createKundenverwaltungField`.
  const [createKundenverwaltungOpen, setCreateKundenverwaltungOpen] = useState(false);
  const [createKundenverwaltungInitial, setCreateKundenverwaltungInitial] = useState('');
  const [createKundenverwaltungField, setCreateKundenverwaltungField] = useState<string>('');
  const [extraKundenverwaltung, setExtraKundenverwaltung] = useState< Kundenverwaltung[]>([]);
  const kundenverwaltungListAll = useMemo(
    () => [...kundenverwaltungList, ...extraKundenverwaltung],
    [kundenverwaltungList, extraKundenverwaltung],
  );
  function openCreateKundenverwaltung(fieldKey: string, q: string) {
    setCreateKundenverwaltungField(fieldKey);
    setCreateKundenverwaltungInitial(q);
    setCreateKundenverwaltungOpen(true);
  }
  const [aiOpen, setAiOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [usePersonalInfo, setUsePersonalInfo] = useState(() => {
    try { return localStorage.getItem('ai-use-personal-info') === 'true'; } catch { return false; }
  });
  const [showProfileInfo, setShowProfileInfo] = useState(false);
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [aiText, setAiText] = useState('');

  // Computed-field plumbing. Pure no-op when formEnhancements.computed is {}.
  // The number renderer uses computedValues only as a fallback when the user
  // hasn't typed anything — clearing the input always restores the computation.
  // computedContext exposes applookup list props so { kind: 'applookup', ... }
  // operands can resolve to numeric fields on the target record.
  const computedContext = useMemo<ComputedContext>(() => ({
    lookupLists: {
      'auftrag': auftragsverwaltungList,
      'kunde': kundenverwaltungList,
    },
  }), [auftragsverwaltungList, kundenverwaltungList, ]);
  const computedValues = useMemo<Record<string, number | null>>(() => {
    let out: Record<string, number | null> = {};
    const entries = Object.entries(formEnhancements.computed);
    for (let i = 0; i < 5; i++) {
      const merged: Record<string, unknown> = { ...(fields as Record<string, unknown>) };
      for (const [k, v] of Object.entries(out)) {
        if (v === null) continue;
        const cur = merged[k];
        if (cur === undefined || cur === null || cur === '') merged[k] = v;
      }
      const next: Record<string, number | null> = {};
      let changed = false;
      for (const [key, spec] of entries) {
        const v = evalComputed(spec, merged, computedContext);
        next[key] = v;
        if (v !== out[key]) changed = true;
      }
      out = next;
      if (!changed) break;
    }
    return out;
  }, [fields, computedContext]);

  useEffect(() => {
    if (open) {
      setFields(applyDefaults((defaultValues ?? {}) as Record<string, unknown>, formEnhancements.defaults) as Partial<Rechnungsverwaltung['fields']>);
      setPreview(null);
      setScanSuccess(false);
      setAiText('');
    }
  }, [open, defaultValues]);
  useEffect(() => {
    try { localStorage.setItem('ai-use-personal-info', String(usePersonalInfo)); } catch {}
  }, [usePersonalInfo]);
  async function handleShowProfileInfo() {
    if (showProfileInfo) { setShowProfileInfo(false); return; }
    setProfileLoading(true);
    try {
      const p = await getUserProfile();
      setProfileData(p);
    } catch {
      setProfileData(null);
    } finally {
      setProfileLoading(false);
      setShowProfileInfo(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // Fill empty number slots from computed values; user-typed values always win.
      // CRITICAL: only backend-mapped keys may be backfilled. Virtual computeds
      // (sub-agent invents `_netto`, `_bestellung_gesamtbetrag` etc. for the
      // "Berechnungen" display) have no backend counterpart — writing them
      // triggers a 422 from the Living-Apps API ("field does not exist").
      const merged = { ...fields };
      for (const [key, val] of Object.entries(computedValues)) {
        if (val === null) continue;
        if (!backendFieldSet.has(key)) continue;
        const cur = (merged as Record<string, unknown>)[key];
        if (cur === undefined || cur === null || cur === '') {
          (merged as Record<string, unknown>)[key] = val;
        }
      }
      const clean = cleanFieldsForApi(merged, 'rechnungsverwaltung');
      await onSubmit(clean as Rechnungsverwaltung['fields']);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleAiExtract(file?: File) {
    if (!file && !aiText.trim()) return;
    setScanning(true);
    setScanSuccess(false);
    try {
      let uri: string | undefined;
      let gps: { latitude: number; longitude: number } | null = null;
      let geoAddr = '';
      const parts: string[] = [];
      if (file) {
        const [dataUri, meta] = await Promise.all([fileToDataUri(file), extractPhotoMeta(file)]);
        uri = dataUri;
        if (file.type.startsWith('image/')) setPreview(uri);
        gps = enablePhotoLocation ? meta?.gps ?? null : null;
        if (gps) {
          geoAddr = await reverseGeocode(gps.latitude, gps.longitude);
          parts.push(`Location coordinates: ${gps.latitude}, ${gps.longitude}`);
          if (geoAddr) parts.push(`Reverse-geocoded address: ${geoAddr}`);
        }
        if (meta?.dateTime) {
          parts.push(`Date taken: ${meta.dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')}`);
        }
      }
      const contextParts: string[] = [];
      if (parts.length) {
        contextParts.push(`<photo-metadata>\nThe following metadata was extracted from the photo\'s EXIF data:\n${parts.join('\n')}\n</photo-metadata>`);
      }
      contextParts.push(`<available-records field="auftrag" entity="Auftragsverwaltung">\n${JSON.stringify(auftragsverwaltungList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      contextParts.push(`<available-records field="kunde" entity="Kundenverwaltung">\n${JSON.stringify(kundenverwaltungList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      if (usePersonalInfo) {
        try {
          const profile = await getUserProfile();
          contextParts.push(`<user-profile>\nThe following is the logged-in user\'s personal information. Use this to pre-fill relevant fields like name, email, address, company etc. when appropriate:\n${JSON.stringify(profile, null, 2)}\n</user-profile>`);
        } catch (err) {
          console.warn('Failed to fetch user profile:', err);
        }
      }
      const photoContext = contextParts.length ? contextParts.join('\n') : undefined;
      const schema = `{\n  "rechnungsnummer": string | null, // Rechnungsnummer\n  "rechnungsdatum": string | null, // YYYY-MM-DD\n  "faelligkeitsdatum": string | null, // YYYY-MM-DD\n  "auftrag": string | null, // Display name from Auftragsverwaltung (see <available-records>)\n  "kunde": string | null, // Display name from Kundenverwaltung (see <available-records>)\n  "nettobetrag": number | null, // Nettobetrag (€)\n  "mwst_satz": LookupValue | null, // MwSt.-Satz (select one key: "mwst_19" | "mwst_7" | "mwst_0") mapping: mwst_19=19 %, mwst_7=7 %, mwst_0=0 %\n  "mwst_betrag": number | null, // MwSt.-Betrag (€)\n  "gesamtbetrag": number | null, // Gesamtbetrag (€)\n  "zahlungsart": LookupValue | null, // Zahlungsart (select one key: "ueberweisung" | "lastschrift" | "kreditkarte" | "paypal" | "bar") mapping: ueberweisung=Überweisung, lastschrift=Lastschrift, kreditkarte=Kreditkarte, paypal=PayPal, bar=Bar\n  "zahlungsstatus": LookupValue | null, // Zahlungsstatus (select one key: "offen" | "teilweise_bezahlt" | "bezahlt" | "ueberfaellig" | "storniert") mapping: offen=Offen, teilweise_bezahlt=Teilweise bezahlt, bezahlt=Bezahlt, ueberfaellig=Überfällig, storniert=Storniert\n  "zahlungsdatum": string | null, // YYYY-MM-DD\n  "rechnungsanmerkungen": string | null, // Anmerkungen zur Rechnung\n}`;
      const raw = await extractFromInput<Record<string, unknown>>(schema, {
        dataUri: uri,
        userText: aiText.trim() || undefined,
        photoContext,
        intent: DIALOG_INTENT,
      });
      setFields(prev => {
        const merged = { ...prev } as Record<string, unknown>;
        function matchName(name: string, candidates: string[]): boolean {
          const n = name.toLowerCase().trim();
          return candidates.some(c => c.toLowerCase().includes(n) || n.includes(c.toLowerCase()));
        }
        const applookupKeys = new Set<string>(["auftrag", "kunde"]);
        for (const [k, v] of Object.entries(raw)) {
          if (applookupKeys.has(k)) continue;
          if (v != null) merged[k] = v;
        }
        const auftragName = raw['auftrag'] as string | null;
        if (auftragName) {
          const auftragMatch = auftragsverwaltungList.find(r => matchName(auftragName!, [String(r.fields.auftragsnummer ?? '')]));
          if (auftragMatch) merged['auftrag'] = createRecordUrl(APP_IDS.AUFTRAGSVERWALTUNG, auftragMatch.record_id);
        }
        const kundeName = raw['kunde'] as string | null;
        if (kundeName) {
          const kundeMatch = kundenverwaltungList.find(r => matchName(kundeName!, [[r.fields.vorname ?? '', r.fields.nachname ?? ''].filter(Boolean).join(' ')]));
          if (kundeMatch) merged['kunde'] = createRecordUrl(APP_IDS.KUNDENVERWALTUNG, kundeMatch.record_id);
        }
        return merged as Partial<Rechnungsverwaltung['fields']>;
      });
      setAiText('');
      setScanSuccess(true);
      setTimeout(() => setScanSuccess(false), 3000);
    } catch (err) {
      console.error('Scan fehlgeschlagen:', err);
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleAiExtract(f);
    e.target.value = '';
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      handleAiExtract(file);
    }
  }, []);

  const DIALOG_INTENT = defaultValues ? 'Rechnungsverwaltung bearbeiten' : 'Rechnungsverwaltung hinzufügen';

  const fieldBlocks: Record<string, React.ReactNode> = {
    'rechnungsnummer': (
      <div key="rechnungsnummer" className="space-y-1.5">
        <Label htmlFor="rechnungsnummer">Rechnungsnummer</Label>
        <Input
          id="rechnungsnummer"
          placeholder="z. B. R-2025-001"
          value={fields.rechnungsnummer ?? ''}
          onChange={e => setFields(f => ({ ...f, rechnungsnummer: e.target.value }))}
        />
      </div>
    ),
    'rechnungsdatum': (
      <div key="rechnungsdatum" className="space-y-1.5">
        <Label htmlFor="rechnungsdatum">Rechnungsdatum</Label>
        <DatePicker
          id="rechnungsdatum"
          placeholder="Wann wurde die Rechnung gestellt?"
          mode="date"
          value={fields.rechnungsdatum ?? null}
          onChange={v => setFields(f => ({ ...f, rechnungsdatum: v ?? undefined }))}
        />
      </div>
    ),
    'faelligkeitsdatum': (
      <div key="faelligkeitsdatum" className="space-y-1.5">
        <Label htmlFor="faelligkeitsdatum">Fälligkeitsdatum</Label>
        <DatePicker
          id="faelligkeitsdatum"
          placeholder="Fällig in wie vielen Tagen?"
          mode="date"
          value={fields.faelligkeitsdatum ?? null}
          onChange={v => setFields(f => ({ ...f, faelligkeitsdatum: v ?? undefined }))}
        />
      </div>
    ),
    'auftrag': (
      <div key="auftrag" className="space-y-1.5">
        <Label htmlFor="auftrag">Auftrag</Label>
        <Combobox
          id="auftrag"
          placeholder="Welcher Auftrag?"
          items={auftragsverwaltungListAll.map(r => ({
            id: r.record_id,
            label: String(r.fields.auftragsnummer ?? r.record_id),
          }))}
          value={extractRecordId(fields.auftrag)}
          onChange={id => setFields(f => ({ ...f, auftrag: id ? createRecordUrl(APP_IDS.AUFTRAGSVERWALTUNG, id) : undefined }))}
          searchPlaceholder="Suchen…"
          emptyText="Kein Treffer"
          onCreateNew={(q) => openCreateAuftragsverwaltung("auftrag", q)}
          createLabel="Neu in Auftragsverwaltung"
        />
      </div>
    ),
    'kunde': (
      <div key="kunde" className="space-y-1.5">
        <Label htmlFor="kunde">Kunde</Label>
        <Combobox
          id="kunde"
          placeholder="Rechnungsempfänger?"
          items={kundenverwaltungListAll.map(r => ({
            id: r.record_id,
            label: String(r.fields.vorname ?? r.record_id),
          }))}
          value={extractRecordId(fields.kunde)}
          onChange={id => setFields(f => ({ ...f, kunde: id ? createRecordUrl(APP_IDS.KUNDENVERWALTUNG, id) : undefined }))}
          searchPlaceholder="Suchen…"
          emptyText="Kein Treffer"
          onCreateNew={(q) => openCreateKundenverwaltung("kunde", q)}
          createLabel="Neu in Kundenverwaltung"
        />
      </div>
    ),
    'nettobetrag': (
      <div key="nettobetrag" className="space-y-1.5">
        <Label htmlFor="nettobetrag">Nettobetrag (€)</Label>
        <Input
          id="nettobetrag"
          type="number"
          step="any"
          {...numberInputProps(formEnhancements, 'nettobetrag')}
          placeholder="z. B. 500,00"
          value={fields.nettobetrag !== undefined ? fields.nettobetrag : (computedValues['nettobetrag'] ?? '')}
          onChange={e => setFields(f => ({ ...f, nettobetrag: clampNumberValue(formEnhancements, 'nettobetrag', e.target.value) }))}
        />
      </div>
    ),
    'mwst_satz': (
      <div key="mwst_satz" className="space-y-1.5">
        <Label htmlFor="mwst_satz">MwSt.-Satz</Label>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.mwst_satz) === 'mwst_19'}
            onClick={() => setFields(f => ({ ...f, mwst_satz: (lookupKey(f.mwst_satz) === 'mwst_19' ? undefined : 'mwst_19') as any }))}
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.mwst_satz) === 'mwst_19'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            19 %
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.mwst_satz) === 'mwst_7'}
            onClick={() => setFields(f => ({ ...f, mwst_satz: (lookupKey(f.mwst_satz) === 'mwst_7' ? undefined : 'mwst_7') as any }))}
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.mwst_satz) === 'mwst_7'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            7 %
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.mwst_satz) === 'mwst_0'}
            onClick={() => setFields(f => ({ ...f, mwst_satz: (lookupKey(f.mwst_satz) === 'mwst_0' ? undefined : 'mwst_0') as any }))}
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.mwst_satz) === 'mwst_0'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            0 %
          </button>
        </div>
      </div>
    ),
    'mwst_betrag': (
      <div key="mwst_betrag" className="space-y-1.5">
        <Label htmlFor="mwst_betrag">MwSt.-Betrag (€)</Label>
        <Input
          id="mwst_betrag"
          type="number"
          step="any"
          {...numberInputProps(formEnhancements, 'mwst_betrag')}
          placeholder="Wird automatisch berechnet"
          value={fields.mwst_betrag !== undefined ? fields.mwst_betrag : (computedValues['mwst_betrag'] ?? '')}
          onChange={e => setFields(f => ({ ...f, mwst_betrag: clampNumberValue(formEnhancements, 'mwst_betrag', e.target.value) }))}
        />
      </div>
    ),
    'gesamtbetrag': (
      <div key="gesamtbetrag" className="space-y-1.5">
        <Label htmlFor="gesamtbetrag">Gesamtbetrag (€)</Label>
        <Input
          id="gesamtbetrag"
          type="number"
          step="any"
          {...numberInputProps(formEnhancements, 'gesamtbetrag')}
          placeholder="Wird automatisch berechnet"
          value={fields.gesamtbetrag !== undefined ? fields.gesamtbetrag : (computedValues['gesamtbetrag'] ?? '')}
          onChange={e => setFields(f => ({ ...f, gesamtbetrag: clampNumberValue(formEnhancements, 'gesamtbetrag', e.target.value) }))}
        />
      </div>
    ),
    'zahlungsart': (
      <div key="zahlungsart" className="space-y-1.5">
        <Label htmlFor="zahlungsart">Zahlungsart</Label>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.zahlungsart) === 'ueberweisung'}
            onClick={() => setFields(f => ({ ...f, zahlungsart: (lookupKey(f.zahlungsart) === 'ueberweisung' ? undefined : 'ueberweisung') as any }))}
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.zahlungsart) === 'ueberweisung'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            Überweisung
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.zahlungsart) === 'lastschrift'}
            onClick={() => setFields(f => ({ ...f, zahlungsart: (lookupKey(f.zahlungsart) === 'lastschrift' ? undefined : 'lastschrift') as any }))}
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.zahlungsart) === 'lastschrift'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            Lastschrift
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.zahlungsart) === 'kreditkarte'}
            onClick={() => setFields(f => ({ ...f, zahlungsart: (lookupKey(f.zahlungsart) === 'kreditkarte' ? undefined : 'kreditkarte') as any }))}
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.zahlungsart) === 'kreditkarte'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            Kreditkarte
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.zahlungsart) === 'paypal'}
            onClick={() => setFields(f => ({ ...f, zahlungsart: (lookupKey(f.zahlungsart) === 'paypal' ? undefined : 'paypal') as any }))}
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.zahlungsart) === 'paypal'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            PayPal
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.zahlungsart) === 'bar'}
            onClick={() => setFields(f => ({ ...f, zahlungsart: (lookupKey(f.zahlungsart) === 'bar' ? undefined : 'bar') as any }))}
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.zahlungsart) === 'bar'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            Bar
          </button>
        </div>
      </div>
    ),
    'zahlungsstatus': (
      <div key="zahlungsstatus" className="space-y-1.5">
        <Label htmlFor="zahlungsstatus">Zahlungsstatus</Label>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.zahlungsstatus) === 'offen'}
            onClick={() => setFields(f => ({ ...f, zahlungsstatus: (lookupKey(f.zahlungsstatus) === 'offen' ? undefined : 'offen') as any }))}
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.zahlungsstatus) === 'offen'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            Offen
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.zahlungsstatus) === 'teilweise_bezahlt'}
            onClick={() => setFields(f => ({ ...f, zahlungsstatus: (lookupKey(f.zahlungsstatus) === 'teilweise_bezahlt' ? undefined : 'teilweise_bezahlt') as any }))}
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.zahlungsstatus) === 'teilweise_bezahlt'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            Teilweise bezahlt
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.zahlungsstatus) === 'bezahlt'}
            onClick={() => setFields(f => ({ ...f, zahlungsstatus: (lookupKey(f.zahlungsstatus) === 'bezahlt' ? undefined : 'bezahlt') as any }))}
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.zahlungsstatus) === 'bezahlt'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            Bezahlt
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.zahlungsstatus) === 'ueberfaellig'}
            onClick={() => setFields(f => ({ ...f, zahlungsstatus: (lookupKey(f.zahlungsstatus) === 'ueberfaellig' ? undefined : 'ueberfaellig') as any }))}
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.zahlungsstatus) === 'ueberfaellig'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            Überfällig
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.zahlungsstatus) === 'storniert'}
            onClick={() => setFields(f => ({ ...f, zahlungsstatus: (lookupKey(f.zahlungsstatus) === 'storniert' ? undefined : 'storniert') as any }))}
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.zahlungsstatus) === 'storniert'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            Storniert
          </button>
        </div>
      </div>
    ),
    'zahlungsdatum': (
      <div key="zahlungsdatum" className="space-y-1.5">
        <Label htmlFor="zahlungsdatum">Zahlungsdatum</Label>
        <DatePicker
          id="zahlungsdatum"
          placeholder="Wann bezahlt?"
          mode="date"
          value={fields.zahlungsdatum ?? null}
          onChange={v => setFields(f => ({ ...f, zahlungsdatum: v ?? undefined }))}
        />
      </div>
    ),
    'rechnungsanmerkungen': (
      <div key="rechnungsanmerkungen" className="space-y-1.5">
        <Label htmlFor="rechnungsanmerkungen">Anmerkungen zur Rechnung</Label>
        <Textarea
          id="rechnungsanmerkungen"
          placeholder="Zahlungsbedingungen, Referenzen..."
          value={fields.rechnungsanmerkungen ?? ''}
          onChange={e => setFields(f => ({ ...f, rechnungsanmerkungen: e.target.value }))}
          rows={3}
        />
      </div>
    ),
  };
  const orderedFields = applyFieldOrder(Object.keys(fieldBlocks), formEnhancements.fieldOrder);
  const orderedFieldsKey = orderedFields.map((it) => typeof it === 'string' ? it : it.row.join('+')).join(',');

  // Render-Modell für Computed-Felder:
  //
  //   • BACKEND-FELDER mit computed-Eintrag (z.B. gesamtpreis bei einer
  //     Katzenpension) bleiben als normales Eingabe-Feld stehen. Der Number-
  //     Input nutzt den computed-Wert als Vorschlag, der User kann jederzeit
  //     überschreiben (clearing → restore computed).
  //   • VIRTUELLE computed-Keys (Eintrag in formEnhancements.computed, ABER
  //     kein passendes Backend-Feld in orderedFields) erscheinen NICHT als
  //     Input, sondern unten als kompakte 'Berechnungen'-Übersicht oder als
  //     Inline-Hint unter dem letzten beitragenden Input.
  const FIELD_LABELS: Record<string, string> = {"rechnungsnummer": "Rechnungsnummer", "rechnungsdatum": "Rechnungsdatum", "faelligkeitsdatum": "Fälligkeitsdatum", "auftrag": "Auftrag", "kunde": "Kunde", "nettobetrag": "Nettobetrag (€)", "mwst_satz": "MwSt.-Satz", "mwst_betrag": "MwSt.-Betrag (€)", "gesamtbetrag": "Gesamtbetrag (€)", "zahlungsart": "Zahlungsart", "zahlungsstatus": "Zahlungsstatus", "zahlungsdatum": "Zahlungsdatum", "rechnungsanmerkungen": "Anmerkungen zur Rechnung"};
  const CURRENCY_KEYS = new Set<string>(["nettobetrag", "mwst_betrag", "gesamtbetrag"]);
  // Applookup-Referenz-Labels: pro applookup-Feld in dieser Form (ownKey)
  // eine Map { lookupKey: label } für ALLE Felder des Target-Schemas. Wird
  // beim Render-Walk gefiltert auf die in der computed-Formel tatsächlich
  // referenzierten lookupKeys (siehe applookupRefs unten).
  const APPLOOKUP_LABELS: Record<string, Record<string, string>> = {"auftrag": {"auftragsnummer": "Auftragsnummer", "auftragsdatum": "Auftragsdatum", "status": "Auftragsstatus", "kunde": "Kunde", "motive": "Motive", "breite_cm": "Gewünschte Breite (cm)", "hoehe_cm": "Gewünschte Höhe (cm)", "anzahl": "Anzahl", "material_auswahl": "Gewähltes Material", "wunschlieferdatum": "Wunschlieferdatum", "montage_gewuenscht": "Montage gewünscht", "lieferadresse_abweichend": "Abweichende Lieferadresse", "lieferstrasse": "Lieferstraße", "lieferhausnummer": "Lieferhausnummer", "lieferpostleitzahl": "Lieferpostleitzahl", "lieferort": "Lieferort", "sonderwuensche": "Sonderwünsche", "interne_notizen": "Interne Notizen"}, "kunde": {"vorname": "Vorname", "nachname": "Nachname", "unternehmen": "Unternehmen / Firma", "kundentyp": "Kundentyp", "email": "E-Mail-Adresse", "telefon": "Telefonnummer", "strasse": "Straße", "hausnummer": "Hausnummer", "postleitzahl": "Postleitzahl", "ort": "Ort", "land": "Land", "anmerkungen": "Anmerkungen zum Kunden"}};
  const inputFields = useMemo(() => flattenFieldOrder(orderedFields), [orderedFieldsKey]);
  const backendFieldSet = useMemo(() => new Set(inputFields), [inputFields.join(',')]);
  const virtualComputed = useMemo(
    () => Object.fromEntries(
      Object.entries(formEnhancements.computed).filter(([k]) => !backendFieldSet.has(k)),
    ),
    [backendFieldSet],
  );
  const virtualFormEnhancements = useMemo(
    () => ({ ...formEnhancements, computed: virtualComputed }),
    [virtualComputed],
  );
  const computedLayout = useMemo(
    () => classifyComputed(virtualFormEnhancements, inputFields, computedDeps),
    [virtualFormEnhancements, inputFields.join(',')],
  );
  // Applookup-Referenzen: pro ownKey (Lookup-Feld im Form) die Liste der
  // lookupKeys, die in irgendeiner computed-Formel referenziert werden.
  // MODUS-1: aus dem Spec-Tree extrahiert. MODUS-2: aus dem Build-Time-
  // Export computedApplookupRefs (parse-formulas hat Regex-Pairs gesammelt).
  // Pro (ownKey, lookupKey)-Paar nur einmal; pro ownKey können aber mehrere
  // lookupKeys gleichzeitig auftauchen (z.B. einzelpreis UND karten10_preis
  // beim Yoga-Kurs), und alle werden separat als Inline-Hint gerendert.
  const applookupRefs = useMemo(
    () => mergeApplookupRefs(
      extractApplookupRefs(formEnhancements.computed),
      computedApplookupRefs,
    ),
    [],
  );
  function summaryLabel(k: string): string {
    if (FIELD_LABELS[k]) return FIELD_LABELS[k];
    // Leading underscore(s) als Virtual-Marker abstreifen; Unterstriche zu
    // Leerzeichen, jedes Wort kapitalisieren. Umlaute kommen vom Sub-Agent
    // direkt im Key (z. B. `_buchung_dauer_nächte`) — JS/TS/Vite unterstützen
    // Unicode-Identifier nativ, daher keine ASCII-Transliteration nötig.
    return k.replace(/^_+/, '')
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  function formatSummaryValue(k: string, v: unknown): string {
    if (v === undefined || v === null || v === '' || (typeof v === 'number' && !Number.isFinite(v))) return '—';
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return String(v);
    // Backend-Feld mit €-Label ODER virtueller Computed-Key, dessen Name nach Geld aussieht.
    const looksLikeCurrency = CURRENCY_KEYS.has(k) || /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k);
    if (looksLikeCurrency) {
      return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
  }

  return (
    <>
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b flex flex-row items-center gap-3 space-y-0">
          <DialogTitle className="flex-1 truncate text-left">{DIALOG_INTENT}</DialogTitle>
          {enablePhotoScan && (
            <button
              type="button"
              onClick={() => setAiOpen(o => !o)}
              aria-expanded={aiOpen}
              aria-controls="ai-fill-panel"
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all mr-7 shadow-sm ${
                aiOpen
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                  : 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15 hover:border-primary/50'
              }`}
            >
              <IconSparkles className={`h-3.5 w-3.5 ${aiOpen ? '' : 'text-primary'}`} />
              <span className="hidden sm:inline">KI-Ausfüllen</span>
              <IconChevronDown className={`h-3 w-3 transition-transform ${aiOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </DialogHeader>
        {enablePhotoScan && aiOpen && (
          <div id="ai-fill-panel" className="border-b bg-muted/20 px-6 py-4 space-y-3">
            <p className="text-xs text-muted-foreground">Versteht Fotos, Dokumente und Text und füllt alles für dich aus</p>
            <div className="flex items-start gap-2 pl-0.5">
              <Checkbox
                id="ai-use-personal-info"
                checked={usePersonalInfo}
                onCheckedChange={(v) => setUsePersonalInfo(!!v)}
                className="mt-0.5"
              />
              <span className="text-xs text-muted-foreground leading-snug">
                <Label htmlFor="ai-use-personal-info" className="text-xs font-normal text-muted-foreground cursor-pointer inline">
                  KI-Assistent darf zusätzlich Informationen zu meiner Person verwenden
                </Label>
                {' '}
                <button type="button" onClick={handleShowProfileInfo} className="text-xs text-primary hover:underline whitespace-nowrap">
                  {profileLoading ? 'Lade...' : '(mehr Infos)'}
                </button>
              </span>
            </div>
            {showProfileInfo && (
              <div className="rounded-md border bg-muted/50 p-2 text-xs max-h-40 overflow-y-auto">
                <p className="font-medium mb-1">Folgende Infos über dich können von der KI genutzt werden:</p>
                {profileData ? Object.values(profileData).map((v, i) => (
                  <span key={i}>{i > 0 && ", "}{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                )) : (
                  <span className="text-muted-foreground">Profil konnte nicht geladen werden</span>
                )}
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !scanning && fileInputRef.current?.click()}
              className={`
                relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
                ${scanning
                  ? 'border-primary/40 bg-primary/5'
                  : scanSuccess
                    ? 'border-green-500/40 bg-green-50/50 dark:bg-green-950/20'
                    : dragOver
                      ? 'border-primary bg-primary/10 scale-[1.01]'
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              {scanning ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <IconLoader2 className="h-7 w-7 text-primary animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">KI analysiert...</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Felder werden automatisch ausgefüllt</p>
                  </div>
                </div>
              ) : scanSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <IconCircleCheck className="h-7 w-7 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Felder ausgefüllt!</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Prüfe die Werte und passe sie ggf. an</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/8 flex items-center justify-center">
                    <IconPhotoPlus className="h-7 w-7 text-primary/70" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Foto oder Dokument hierher ziehen oder auswählen</p>
                  </div>
                </div>
              )}

              {preview && !scanning && (
                <div className="absolute top-2 right-2">
                  <div className="relative group">
                    <img src={preview} alt="" className="h-10 w-10 rounded-md object-cover border shadow-sm" />
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setPreview(null); }}
                      className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-muted-foreground/80 text-white flex items-center justify-center"
                    >
                      <IconX className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); cameraInputRef.current?.click(); }}>
                <IconCamera className="h-3.5 w-3.5 mr-1" />Kamera
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <IconUpload className="h-3.5 w-3.5 mr-1" />Foto wählen
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => {
                  e.stopPropagation();
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'application/pdf,.pdf';
                    fileInputRef.current.click();
                    setTimeout(() => { if (fileInputRef.current) fileInputRef.current.accept = 'image/*,application/pdf'; }, 100);
                  }
                }}>
                <IconFileText className="h-3.5 w-3.5 mr-1" />Dokument
              </Button>
            </div>

            <div className="relative">
              <Textarea
                placeholder="Text eingeben oder einfügen, z.B. Notizen, E-Mails, Beschreibungen..."
                value={aiText}
                onChange={e => {
                  setAiText(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = Math.min(Math.max(el.scrollHeight, 56), 96) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && aiText.trim() && !scanning) {
                    e.preventDefault();
                    handleAiExtract();
                  }
                }}
                disabled={scanning}
                rows={2}
                className="pr-12 resize-none text-sm overflow-y-auto"
              />
              <button
                type="button"
                className="absolute right-2 top-2 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                disabled={scanning}
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) setAiText(prev => prev ? prev + '\n' + text : text);
                  } catch {}
                }}
                title="Paste"
              >
                <IconClipboard className="h-4 w-4" />
              </button>
            </div>
            {aiText.trim() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-9 text-xs"
                disabled={scanning}
                onClick={() => handleAiExtract()}
              >
                <IconSparkles className="h-3.5 w-3.5 mr-1.5" />Analysieren
              </Button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0 min-w-0">
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-4 min-w-0">
            {(() => {
              const renderField = (k: string) => {
                const inlineHints = computedLayout.anchors[k] ?? [];
                const refs = applookupRefs[k] ?? [];
                return (
                  <div key={k} className="space-y-1.5 min-w-0">
                    {fieldBlocks[k]}
                    {refs.map(({ lookupKey }) => {
                      // Show the live numeric value the formula will pull from
                      // the selected lookup target (e.g. "Monatspreis: 34,90 €"
                      // under the Tarif combobox). Hidden while no lookup is
                      // selected or the target field is non-numeric.
                      const v = resolveApplookupRef(k, lookupKey, fields as Record<string, unknown>, computedContext);
                      if (v === null) return null;
                      const lbl = APPLOOKUP_LABELS[k]?.[lookupKey] ?? lookupKey;
                      const text = formatSummaryValue(lookupKey, v);
                      return (
                        <div key={`alh-${k}-${lookupKey}`} className="flex items-center gap-1.5 pl-3 text-xs text-muted-foreground">
                          <span className="text-primary/70">→</span>
                          <span>{lbl}</span>
                          <span className="ml-auto font-medium tabular-nums text-foreground">{text}</span>
                        </div>
                      );
                    })}
                    {inlineHints.map((cKey) => {
                      const v = computedValues[cKey];
                      const text = formatSummaryValue(cKey, v);
                      if (text === '—') return null;
                      return (
                        <div key={cKey} className="flex items-center gap-1.5 pl-3 text-xs text-muted-foreground">
                          <span className="text-primary/70">→</span>
                          <span>{summaryLabel(cKey)}</span>
                          <span className="ml-auto font-medium tabular-nums text-foreground">{text}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              };
              return orderedFields.map((item, idx) => {
                if (typeof item === 'string') return renderField(item);
                const cols = item.cols ?? `repeat(${item.row.length}, minmax(0, 1fr))`;
                return (
                  <div key={`row-${idx}`} className="grid gap-3" style={{ gridTemplateColumns: cols }}>
                    {item.row.map(renderField)}
                  </div>
                );
              });
            })()}
            {(computedLayout.aggregates.length > 0 || computedLayout.finalTotal) && (
              <div className="mt-6 pt-4 border-t border-border space-y-1.5">
                {computedLayout.aggregates.length > 0 && (
                  <dl className="space-y-1.5 pb-2">
                    {computedLayout.aggregates.map((k) => {
                      const userVal = (fields as Record<string, unknown>)[k];
                      const computed = computedValues[k];
                      const v = userVal !== undefined && userVal !== null && userVal !== '' ? userVal : computed;
                      return (
                        <div key={k} className="flex justify-between items-baseline gap-3">
                          <dt className="text-sm text-muted-foreground truncate">{summaryLabel(k)}</dt>
                          <dd className="text-sm font-medium tabular-nums whitespace-nowrap">{formatSummaryValue(k, v)}</dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
                {computedLayout.finalTotal && (() => {
                  const k = computedLayout.finalTotal;
                  const userVal = (fields as Record<string, unknown>)[k];
                  const computed = computedValues[k];
                  const v = userVal !== undefined && userVal !== null && userVal !== '' ? userVal : computed;
                  // Innere Border nur wenn aggregates existieren — sonst hätten wir
                  // zwei direkt aufeinanderfolgende Striche (Outer + Inner) mit nur
                  // einer Aggregat-Zeile dazwischen → zu viel visuelles Rauschen.
                  const sep = computedLayout.aggregates.length > 0 ? 'pt-3 border-t border-border' : 'pt-1';
                  return (
                    <div className={`flex justify-between items-baseline gap-3 ${sep}`}>
                      <span className="text-base font-semibold text-foreground">{summaryLabel(k)}</span>
                      <span className="text-lg font-bold tabular-nums whitespace-nowrap text-foreground">{formatSummaryValue(k, v)}</span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          <DialogFooter className="sticky bottom-0 border-t bg-background/95 backdrop-blur px-6 py-3 gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button
              type="submit"
              disabled={saving}
            >
              {saving ? 'Speichern...' : defaultValues ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {createAuftragsverwaltungOpen && (
      <AuftragsverwaltungDialog
        open={createAuftragsverwaltungOpen}
        onClose={() => setCreateAuftragsverwaltungOpen(false)}
        onSubmit={async (newFields) => {
          const result = await LivingAppsService.createAuftragsverwaltungEntry(newFields as any) as { id?: string };
          if (result?.id) {
            const newRec = { record_id: result.id, fields: newFields } as unknown as Auftragsverwaltung;
            setExtraAuftragsverwaltung(prev => [...prev, newRec]);
            const url = createRecordUrl(APP_IDS.AUFTRAGSVERWALTUNG, result.id);
            setFields(prev => ({ ...prev, [createAuftragsverwaltungField]: url } as any));
          }
          setCreateAuftragsverwaltungOpen(false);
        }}
        defaultValues={createAuftragsverwaltungInitial
          ? ({ auftragsnummer: createAuftragsverwaltungInitial } as any)
          : undefined}
        kundenverwaltungList={kundenverwaltungList}
        motivkatalogList={[]}
      />
    )}
    {createKundenverwaltungOpen && (
      <KundenverwaltungDialog
        open={createKundenverwaltungOpen}
        onClose={() => setCreateKundenverwaltungOpen(false)}
        onSubmit={async (newFields) => {
          const result = await LivingAppsService.createKundenverwaltungEntry(newFields as any) as { id?: string };
          if (result?.id) {
            const newRec = { record_id: result.id, fields: newFields } as unknown as Kundenverwaltung;
            setExtraKundenverwaltung(prev => [...prev, newRec]);
            const url = createRecordUrl(APP_IDS.KUNDENVERWALTUNG, result.id);
            setFields(prev => ({ ...prev, [createKundenverwaltungField]: url } as any));
          }
          setCreateKundenverwaltungOpen(false);
        }}
        defaultValues={createKundenverwaltungInitial
          ? ({ vorname: createKundenverwaltungInitial } as any)
          : undefined}
      />
    )}
    </>
  );
}