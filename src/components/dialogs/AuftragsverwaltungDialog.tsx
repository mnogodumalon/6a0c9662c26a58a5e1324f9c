import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Auftragsverwaltung, Kundenverwaltung, Motivkatalog } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId, createRecordUrl, cleanFieldsForApi, extractRecordIds, getUserProfile, LivingAppsService } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ComputedContext } from '@/config/form-enhancements/types';
import { applyFieldOrder, flattenFieldOrder, applyDefaults, evalComputed, numberInputProps, clampNumberValue, classifyComputed, extractApplookupRefs, mergeApplookupRefs, resolveApplookupRef } from '@/config/form-enhancements/types';
import { formEnhancements, computedDeps, computedApplookupRefs } from '@/config/form-enhancements/Auftragsverwaltung';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Combobox, MultiCombobox } from '@/components/Combobox';
import { KundenverwaltungDialog } from '@/components/dialogs/KundenverwaltungDialog';
import { MotivkatalogDialog } from '@/components/dialogs/MotivkatalogDialog';
import { DatePicker } from '@/components/DatePicker';
import { Checkbox } from '@/components/ui/checkbox';
import { IconCamera, IconChevronDown, IconCircleCheck, IconClipboard, IconFileText, IconLoader2, IconPhotoPlus, IconSparkles, IconUpload, IconX } from '@tabler/icons-react';
import { fileToDataUri, extractFromInput, extractPhotoMeta, reverseGeocode } from '@/lib/ai';
import { lookupKey } from '@/lib/formatters';

interface AuftragsverwaltungDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: Auftragsverwaltung['fields']) => Promise<void>;
  defaultValues?: Auftragsverwaltung['fields'];
  kundenverwaltungList: Kundenverwaltung[];
  motivkatalogList: Motivkatalog[];
  enablePhotoScan?: boolean;
  enablePhotoLocation?: boolean;
}

export function AuftragsverwaltungDialog({ open, onClose, onSubmit, defaultValues, kundenverwaltungList, motivkatalogList, enablePhotoScan = true, enablePhotoLocation = true }: AuftragsverwaltungDialogProps) {
  const [fields, setFields] = useState<Partial<Auftragsverwaltung['fields']>>({});
  const [saving, setSaving] = useState(false);
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
  // Inline-Create state for "Motivkatalog" target. The dropdown's
  // "+ Neuer …" option opens a sub-dialog; on submit we POST, add the new
  // record to the local `extraMotivkatalog` list, and select it in
  // the originating Combobox via the captured `createMotivkatalogField`.
  const [createMotivkatalogOpen, setCreateMotivkatalogOpen] = useState(false);
  const [createMotivkatalogInitial, setCreateMotivkatalogInitial] = useState('');
  const [createMotivkatalogField, setCreateMotivkatalogField] = useState<string>('');
  const [extraMotivkatalog, setExtraMotivkatalog] = useState< Motivkatalog[]>([]);
  const motivkatalogListAll = useMemo(
    () => [...motivkatalogList, ...extraMotivkatalog],
    [motivkatalogList, extraMotivkatalog],
  );
  function openCreateMotivkatalog(fieldKey: string, q: string) {
    setCreateMotivkatalogField(fieldKey);
    setCreateMotivkatalogInitial(q);
    setCreateMotivkatalogOpen(true);
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
      'kunde': kundenverwaltungList,
      'motive': motivkatalogList,
    },
  }), [kundenverwaltungList, motivkatalogList, ]);
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
      setFields(applyDefaults((defaultValues ?? {}) as Record<string, unknown>, formEnhancements.defaults) as Partial<Auftragsverwaltung['fields']>);
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
      const clean = cleanFieldsForApi(merged, 'auftragsverwaltung');
      await onSubmit(clean as Auftragsverwaltung['fields']);
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
      contextParts.push(`<available-records field="kunde" entity="Kundenverwaltung">\n${JSON.stringify(kundenverwaltungList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      contextParts.push(`<available-records field="motive" entity="Motivkatalog">\n${JSON.stringify(motivkatalogList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      if (usePersonalInfo) {
        try {
          const profile = await getUserProfile();
          contextParts.push(`<user-profile>\nThe following is the logged-in user\'s personal information. Use this to pre-fill relevant fields like name, email, address, company etc. when appropriate:\n${JSON.stringify(profile, null, 2)}\n</user-profile>`);
        } catch (err) {
          console.warn('Failed to fetch user profile:', err);
        }
      }
      const photoContext = contextParts.length ? contextParts.join('\n') : undefined;
      const schema = `{\n  "auftragsnummer": string | null, // Auftragsnummer\n  "auftragsdatum": string | null, // YYYY-MM-DD\n  "status": LookupValue | null, // Auftragsstatus (select one key: "neu" | "in_bearbeitung" | "in_produktion" | "versandbereit" | "abgeschlossen" | "storniert") mapping: neu=Neu, in_bearbeitung=In Bearbeitung, in_produktion=In Produktion, versandbereit=Versandbereit, abgeschlossen=Abgeschlossen, storniert=Storniert\n  "kunde": string | null, // Display name from Kundenverwaltung (see <available-records>)\n  "motive": string | null, // Display name from Motivkatalog (see <available-records>)\n  "breite_cm": number | null, // Gewünschte Breite (cm)\n  "hoehe_cm": number | null, // Gewünschte Höhe (cm)\n  "anzahl": number | null, // Anzahl\n  "material_auswahl": LookupValue | null, // Gewähltes Material (select one key: "leinwand" | "fotopaier" | "acrylglas" | "aluminium_dibond" | "tapete" | "pvc_plane") mapping: leinwand=Leinwand, fotopaier=Fotopaier, acrylglas=Acrylglas, aluminium_dibond=Aluminium-Dibond, tapete=Tapete, pvc_plane=PVC-Plane\n  "wunschlieferdatum": string | null, // YYYY-MM-DD\n  "montage_gewuenscht": boolean | null, // Montage gewünscht\n  "lieferadresse_abweichend": boolean | null, // Abweichende Lieferadresse\n  "lieferstrasse": string | null, // Lieferstraße\n  "lieferhausnummer": string | null, // Lieferhausnummer\n  "lieferpostleitzahl": string | null, // Lieferpostleitzahl\n  "lieferort": string | null, // Lieferort\n  "sonderwuensche": string | null, // Sonderwünsche\n  "interne_notizen": string | null, // Interne Notizen\n}`;
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
        const applookupKeys = new Set<string>(["kunde", "motive"]);
        for (const [k, v] of Object.entries(raw)) {
          if (applookupKeys.has(k)) continue;
          if (v != null) merged[k] = v;
        }
        const kundeName = raw['kunde'] as string | null;
        if (kundeName) {
          const kundeMatch = kundenverwaltungList.find(r => matchName(kundeName!, [[r.fields.vorname ?? '', r.fields.nachname ?? ''].filter(Boolean).join(' ')]));
          if (kundeMatch) merged['kunde'] = createRecordUrl(APP_IDS.KUNDENVERWALTUNG, kundeMatch.record_id);
        }
        const motiveName = raw['motive'] as string | null;
        if (motiveName) {
          const motiveMatch = motivkatalogList.find(r => matchName(motiveName!, [String(r.fields.motivname ?? '')]));
          if (motiveMatch) merged['motive'] = createRecordUrl(APP_IDS.MOTIVKATALOG, motiveMatch.record_id);
        }
        return merged as Partial<Auftragsverwaltung['fields']>;
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

  const DIALOG_INTENT = defaultValues ? 'Auftragsverwaltung bearbeiten' : 'Auftragsverwaltung hinzufügen';

  const fieldBlocks: Record<string, React.ReactNode> = {
    'auftragsnummer': (
      <div key="auftragsnummer" className="space-y-1.5">
        <Label htmlFor="auftragsnummer">Auftragsnummer</Label>
        <Input
          id="auftragsnummer"
          placeholder="z. B. AU-2025-001"
          value={fields.auftragsnummer ?? ''}
          onChange={e => setFields(f => ({ ...f, auftragsnummer: e.target.value }))}
        />
      </div>
    ),
    'auftragsdatum': (
      <div key="auftragsdatum" className="space-y-1.5">
        <Label htmlFor="auftragsdatum">Auftragsdatum</Label>
        <DatePicker
          id="auftragsdatum"
          placeholder="Wann wurde der Auftrag erteilt?"
          mode="date"
          value={fields.auftragsdatum ?? null}
          onChange={v => setFields(f => ({ ...f, auftragsdatum: v ?? undefined }))}
        />
      </div>
    ),
    'status': (
      <div key="status" className="space-y-1.5">
        <Label htmlFor="status">Auftragsstatus</Label>
        <Select
          value={lookupKey(fields.status) ?? ''}
          onValueChange={v => setFields(f => ({ ...f, status: v === 'none' ? undefined : v as any }))}
        >
          <SelectTrigger id="status"><SelectValue placeholder="Aktueller Bearbeitungsstand?" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">—</SelectItem>
            <SelectItem value="neu">Neu</SelectItem>
            <SelectItem value="in_bearbeitung">In Bearbeitung</SelectItem>
            <SelectItem value="in_produktion">In Produktion</SelectItem>
            <SelectItem value="versandbereit">Versandbereit</SelectItem>
            <SelectItem value="abgeschlossen">Abgeschlossen</SelectItem>
            <SelectItem value="storniert">Storniert</SelectItem>
          </SelectContent>
        </Select>
      </div>
    ),
    'kunde': (
      <div key="kunde" className="space-y-1.5">
        <Label htmlFor="kunde">Kunde</Label>
        <Combobox
          id="kunde"
          placeholder="Welcher Kunde?"
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
    'motive': (
      <div key="motive" className="space-y-1.5">
        <Label htmlFor="motive">Motive</Label>
        <MultiCombobox
          id="motive"
          placeholder="Welche Motive wählen?"
          items={motivkatalogListAll.map(r => ({
            id: r.record_id,
            label: String(r.fields.motivname ?? r.record_id),
          }))}
          values={extractRecordIds(fields.motive)}
          onChange={ids => setFields(f => ({ ...f, motive: ids.length ? ids.map(id => createRecordUrl(APP_IDS.MOTIVKATALOG, id)) as any : undefined }))}
          searchPlaceholder="Suchen…"
          emptyText="Kein Treffer"
          onCreateNew={(q) => openCreateMotivkatalog("motive", q)}
          createLabel="Neu in Motivkatalog"
        />
      </div>
    ),
    'breite_cm': (
      <div key="breite_cm" className="space-y-1.5">
        <Label htmlFor="breite_cm">Gewünschte Breite (cm)</Label>
        <Input
          id="breite_cm"
          type="number"
          step="any"
          {...numberInputProps(formEnhancements, 'breite_cm')}
          placeholder="z. B. 120"
          value={fields.breite_cm !== undefined ? fields.breite_cm : (computedValues['breite_cm'] ?? '')}
          onChange={e => setFields(f => ({ ...f, breite_cm: clampNumberValue(formEnhancements, 'breite_cm', e.target.value) }))}
        />
      </div>
    ),
    'hoehe_cm': (
      <div key="hoehe_cm" className="space-y-1.5">
        <Label htmlFor="hoehe_cm">Gewünschte Höhe (cm)</Label>
        <Input
          id="hoehe_cm"
          type="number"
          step="any"
          {...numberInputProps(formEnhancements, 'hoehe_cm')}
          placeholder="z. B. 80"
          value={fields.hoehe_cm !== undefined ? fields.hoehe_cm : (computedValues['hoehe_cm'] ?? '')}
          onChange={e => setFields(f => ({ ...f, hoehe_cm: clampNumberValue(formEnhancements, 'hoehe_cm', e.target.value) }))}
        />
      </div>
    ),
    'anzahl': (
      <div key="anzahl" className="space-y-1.5">
        <Label htmlFor="anzahl">Anzahl</Label>
        <Input
          id="anzahl"
          type="number"
          step="any"
          {...numberInputProps(formEnhancements, 'anzahl')}
          placeholder="z. B. 1"
          value={fields.anzahl !== undefined ? fields.anzahl : (computedValues['anzahl'] ?? '')}
          onChange={e => setFields(f => ({ ...f, anzahl: clampNumberValue(formEnhancements, 'anzahl', e.target.value) }))}
        />
      </div>
    ),
    'material_auswahl': (
      <div key="material_auswahl" className="space-y-1.5">
        <Label htmlFor="material_auswahl">Gewähltes Material</Label>
        <Select
          value={lookupKey(fields.material_auswahl) ?? ''}
          onValueChange={v => setFields(f => ({ ...f, material_auswahl: v === 'none' ? undefined : v as any }))}
        >
          <SelectTrigger id="material_auswahl"><SelectValue placeholder="Welches Material?" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">—</SelectItem>
            <SelectItem value="leinwand">Leinwand</SelectItem>
            <SelectItem value="fotopaier">Fotopaier</SelectItem>
            <SelectItem value="acrylglas">Acrylglas</SelectItem>
            <SelectItem value="aluminium_dibond">Aluminium-Dibond</SelectItem>
            <SelectItem value="tapete">Tapete</SelectItem>
            <SelectItem value="pvc_plane">PVC-Plane</SelectItem>
          </SelectContent>
        </Select>
      </div>
    ),
    'wunschlieferdatum': (
      <div key="wunschlieferdatum" className="space-y-1.5">
        <Label htmlFor="wunschlieferdatum">Wunschlieferdatum</Label>
        <DatePicker
          id="wunschlieferdatum"
          placeholder="Lieferwunsch?"
          mode="date"
          value={fields.wunschlieferdatum ?? null}
          onChange={v => setFields(f => ({ ...f, wunschlieferdatum: v ?? undefined }))}
        />
      </div>
    ),
    'montage_gewuenscht': (
      <div key="montage_gewuenscht" className="space-y-1.5">
        <Label htmlFor="montage_gewuenscht">Montage gewünscht</Label>
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id="montage_gewuenscht"
            checked={!!fields.montage_gewuenscht}
            onCheckedChange={(v) => setFields(f => ({ ...f, montage_gewuenscht: !!v }))}
          />
          <Label htmlFor="montage_gewuenscht" className="font-normal">Montage gewünscht</Label>
        </div>
      </div>
    ),
    'lieferadresse_abweichend': (
      <div key="lieferadresse_abweichend" className="space-y-1.5">
        <Label htmlFor="lieferadresse_abweichend">Abweichende Lieferadresse</Label>
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id="lieferadresse_abweichend"
            checked={!!fields.lieferadresse_abweichend}
            onCheckedChange={(v) => setFields(f => ({ ...f, lieferadresse_abweichend: !!v }))}
          />
          <Label htmlFor="lieferadresse_abweichend" className="font-normal">Abweichende Lieferadresse</Label>
        </div>
      </div>
    ),
    'lieferstrasse': (
      <div key="lieferstrasse" className="space-y-1.5">
        <Label htmlFor="lieferstrasse">Lieferstraße</Label>
        <Input
          id="lieferstrasse"
          placeholder="z. B. Lieferstraße 10"
          value={fields.lieferstrasse ?? ''}
          onChange={e => setFields(f => ({ ...f, lieferstrasse: e.target.value }))}
        />
      </div>
    ),
    'lieferhausnummer': (
      <div key="lieferhausnummer" className="space-y-1.5">
        <Label htmlFor="lieferhausnummer">Lieferhausnummer</Label>
        <Input
          id="lieferhausnummer"
          placeholder="z. B. 5a"
          value={fields.lieferhausnummer ?? ''}
          onChange={e => setFields(f => ({ ...f, lieferhausnummer: e.target.value }))}
        />
      </div>
    ),
    'lieferpostleitzahl': (
      <div key="lieferpostleitzahl" className="space-y-1.5">
        <Label htmlFor="lieferpostleitzahl">Lieferpostleitzahl</Label>
        <Input
          id="lieferpostleitzahl"
          placeholder="z. B. 67890"
          value={fields.lieferpostleitzahl ?? ''}
          onChange={e => setFields(f => ({ ...f, lieferpostleitzahl: e.target.value }))}
        />
      </div>
    ),
    'lieferort': (
      <div key="lieferort" className="space-y-1.5">
        <Label htmlFor="lieferort">Lieferort</Label>
        <Input
          id="lieferort"
          placeholder="z. B. Lieferstadt"
          value={fields.lieferort ?? ''}
          onChange={e => setFields(f => ({ ...f, lieferort: e.target.value }))}
        />
      </div>
    ),
    'sonderwuensche': (
      <div key="sonderwuensche" className="space-y-1.5">
        <Label htmlFor="sonderwuensche">Sonderwünsche</Label>
        <Textarea
          id="sonderwuensche"
          placeholder="Besondere Anforderungen, Fristen..."
          value={fields.sonderwuensche ?? ''}
          onChange={e => setFields(f => ({ ...f, sonderwuensche: e.target.value }))}
          rows={3}
        />
      </div>
    ),
    'interne_notizen': (
      <div key="interne_notizen" className="space-y-1.5">
        <Label htmlFor="interne_notizen">Interne Notizen</Label>
        <Textarea
          id="interne_notizen"
          placeholder="Notizen für das Team..."
          value={fields.interne_notizen ?? ''}
          onChange={e => setFields(f => ({ ...f, interne_notizen: e.target.value }))}
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
  const FIELD_LABELS: Record<string, string> = {"auftragsnummer": "Auftragsnummer", "auftragsdatum": "Auftragsdatum", "status": "Auftragsstatus", "kunde": "Kunde", "motive": "Motive", "breite_cm": "Gewünschte Breite (cm)", "hoehe_cm": "Gewünschte Höhe (cm)", "anzahl": "Anzahl", "material_auswahl": "Gewähltes Material", "wunschlieferdatum": "Wunschlieferdatum", "montage_gewuenscht": "Montage gewünscht", "lieferadresse_abweichend": "Abweichende Lieferadresse", "lieferstrasse": "Lieferstraße", "lieferhausnummer": "Lieferhausnummer", "lieferpostleitzahl": "Lieferpostleitzahl", "lieferort": "Lieferort", "sonderwuensche": "Sonderwünsche", "interne_notizen": "Interne Notizen"};
  const CURRENCY_KEYS = new Set<string>([]);
  // Applookup-Referenz-Labels: pro applookup-Feld in dieser Form (ownKey)
  // eine Map { lookupKey: label } für ALLE Felder des Target-Schemas. Wird
  // beim Render-Walk gefiltert auf die in der computed-Formel tatsächlich
  // referenzierten lookupKeys (siehe applookupRefs unten).
  const APPLOOKUP_LABELS: Record<string, Record<string, string>> = {"kunde": {"vorname": "Vorname", "nachname": "Nachname", "unternehmen": "Unternehmen / Firma", "kundentyp": "Kundentyp", "email": "E-Mail-Adresse", "telefon": "Telefonnummer", "strasse": "Straße", "hausnummer": "Hausnummer", "postleitzahl": "Postleitzahl", "ort": "Ort", "land": "Land", "anmerkungen": "Anmerkungen zum Kunden"}, "motive": {"beschreibung": "Beschreibung", "kategorie": "Kategorie", "max_breite_cm": "Maximale Druckbreite (cm)", "max_hoehe_cm": "Maximale Druckhöhe (cm)", "material": "Verfügbare Materialien", "preis_pro_qm": "Preis pro m² (€)", "vorschaubild": "Vorschaubild", "aktiv": "Motiv aktiv (im Angebot verfügbar)", "motivname": "Motivname"}};
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
    {createMotivkatalogOpen && (
      <MotivkatalogDialog
        open={createMotivkatalogOpen}
        onClose={() => setCreateMotivkatalogOpen(false)}
        onSubmit={async (newFields) => {
          const result = await LivingAppsService.createMotivkatalogEntry(newFields as any) as { id?: string };
          if (result?.id) {
            const newRec = { record_id: result.id, fields: newFields } as unknown as Motivkatalog;
            setExtraMotivkatalog(prev => [...prev, newRec]);
            const url = createRecordUrl(APP_IDS.MOTIVKATALOG, result.id);
            setFields(prev => ({ ...prev, [createMotivkatalogField]: url } as any));
          }
          setCreateMotivkatalogOpen(false);
        }}
        defaultValues={createMotivkatalogInitial
          ? ({ motivname: createMotivkatalogInitial } as any)
          : undefined}
      />
    )}
    </>
  );
}