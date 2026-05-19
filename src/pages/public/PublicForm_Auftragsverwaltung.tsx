import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/DatePicker';
import { lookupKey } from '@/lib/formatters';

// Empty PROXY_BASE → relative URLs (dashboard and form-proxy share the domain).
const PROXY_BASE = '';
const APP_ID = '6a0c963cb70cf78c53ae48f5';
const SUBMIT_PATH = `/rest/apps/${APP_ID}/records`;
const ALTCHA_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/altcha/dist/altcha.min.js';

async function submitPublicForm(fields: Record<string, unknown>, captchaToken: string) {
  const res = await fetch(`${PROXY_BASE}/api${SUBMIT_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Captcha-Token': captchaToken,
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Submission failed');
  }
  return res.json();
}


function cleanFields(fields: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    if (typeof value === 'object' && !Array.isArray(value) && 'key' in (value as any)) {
      cleaned[key] = (value as any).key;
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map(item =>
        typeof item === 'object' && item !== null && 'key' in item ? item.key : item
      );
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export default function PublicFormAuftragsverwaltung() {
  const [fields, setFields] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captchaRef = useRef<HTMLElement | null>(null);

  // Load the ALTCHA web component script once per page.
  useEffect(() => {
    if (document.querySelector(`script[src="${ALTCHA_SCRIPT_SRC}"]`)) return;
    const s = document.createElement('script');
    s.src = ALTCHA_SCRIPT_SRC;
    s.defer = true;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    const hash = window.location.hash;
    const qIdx = hash.indexOf('?');
    if (qIdx === -1) return;
    const params = new URLSearchParams(hash.slice(qIdx + 1));
    const prefill: Record<string, any> = {};
    params.forEach((value, key) => { prefill[key] = value; });
    if (Object.keys(prefill).length) setFields(prev => ({ ...prefill, ...prev }));
  }, []);

  function readCaptchaToken(): string | null {
    const el = captchaRef.current as any;
    if (!el) return null;
    return el.value || el.getAttribute('value') || null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = readCaptchaToken();
    if (!token) {
      setError('Bitte warte auf die Spam-Prüfung und versuche es erneut.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitPublicForm(cleanFields(fields), token);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Etwas ist schiefgelaufen. Bitte versuche es erneut.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">Vielen Dank!</h2>
          <p className="text-muted-foreground">Deine Eingabe wurde erfolgreich übermittelt.</p>
          <Button variant="outline" className="mt-4" onClick={() => { setSubmitted(false); setFields({}); }}>
            Weitere Eingabe
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Auftragsverwaltung — Formular</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded-xl border border-border p-6 shadow-md">
          <div className="space-y-2">
            <Label htmlFor="auftragsnummer">Auftragsnummer</Label>
            <Input
              id="auftragsnummer"
              placeholder=""
              value={fields.auftragsnummer ?? ''}
              onChange={e => setFields(f => ({ ...f, auftragsnummer: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auftragsdatum">Auftragsdatum</Label>
            <DatePicker
              id="auftragsdatum"
              placeholder=""
              mode="date"
              value={fields.auftragsdatum ?? null}
              onChange={v => setFields(f => ({ ...f, auftragsdatum: v ?? undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Auftragsstatus</Label>
            <Select
              value={lookupKey(fields.status) ?? ''}
              onValueChange={v => setFields(f => ({ ...f, status: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="status"><SelectValue placeholder="" /></SelectTrigger>
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
          <div className="space-y-2">
            <Label htmlFor="motive">Motive</Label>
            <Input
              id="motive"
              value={fields.motive ?? ''}
              onChange={e => setFields(f => ({ ...f, motive: e.target.value }))}
              placeholder="Record URL"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="breite_cm">Gewünschte Breite (cm)</Label>
            <Input
              id="breite_cm"
              type="number"
              step="any"
              min={0}
              placeholder=""
              value={fields.breite_cm ?? ''}
              onChange={e => { const n = e.target.value ? Math.max(0, Number(e.target.value)) : undefined; setFields(f => ({ ...f, breite_cm: n })); }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hoehe_cm">Gewünschte Höhe (cm)</Label>
            <Input
              id="hoehe_cm"
              type="number"
              step="any"
              min={0}
              placeholder=""
              value={fields.hoehe_cm ?? ''}
              onChange={e => { const n = e.target.value ? Math.max(0, Number(e.target.value)) : undefined; setFields(f => ({ ...f, hoehe_cm: n })); }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="anzahl">Anzahl</Label>
            <Input
              id="anzahl"
              type="number"
              step="any"
              min={0}
              placeholder=""
              value={fields.anzahl ?? ''}
              onChange={e => { const n = e.target.value ? Math.max(0, Number(e.target.value)) : undefined; setFields(f => ({ ...f, anzahl: n })); }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="material_auswahl">Gewähltes Material</Label>
            <Select
              value={lookupKey(fields.material_auswahl) ?? ''}
              onValueChange={v => setFields(f => ({ ...f, material_auswahl: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="material_auswahl"><SelectValue placeholder="" /></SelectTrigger>
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
          <div className="space-y-2">
            <Label htmlFor="wunschlieferdatum">Wunschlieferdatum</Label>
            <DatePicker
              id="wunschlieferdatum"
              placeholder=""
              mode="date"
              value={fields.wunschlieferdatum ?? null}
              onChange={v => setFields(f => ({ ...f, wunschlieferdatum: v ?? undefined }))}
            />
          </div>
          <div className="space-y-2">
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
          <div className="space-y-2">
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
          <div className="space-y-2">
            <Label htmlFor="lieferstrasse">Lieferstraße</Label>
            <Input
              id="lieferstrasse"
              placeholder=""
              value={fields.lieferstrasse ?? ''}
              onChange={e => setFields(f => ({ ...f, lieferstrasse: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lieferhausnummer">Lieferhausnummer</Label>
            <Input
              id="lieferhausnummer"
              placeholder=""
              value={fields.lieferhausnummer ?? ''}
              onChange={e => setFields(f => ({ ...f, lieferhausnummer: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lieferpostleitzahl">Lieferpostleitzahl</Label>
            <Input
              id="lieferpostleitzahl"
              placeholder=""
              value={fields.lieferpostleitzahl ?? ''}
              onChange={e => setFields(f => ({ ...f, lieferpostleitzahl: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lieferort">Lieferort</Label>
            <Input
              id="lieferort"
              placeholder=""
              value={fields.lieferort ?? ''}
              onChange={e => setFields(f => ({ ...f, lieferort: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sonderwuensche">Sonderwünsche</Label>
            <Textarea
              id="sonderwuensche"
              placeholder=""
              value={fields.sonderwuensche ?? ''}
              onChange={e => setFields(f => ({ ...f, sonderwuensche: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="interne_notizen">Interne Notizen</Label>
            <Textarea
              id="interne_notizen"
              placeholder=""
              value={fields.interne_notizen ?? ''}
              onChange={e => setFields(f => ({ ...f, interne_notizen: e.target.value }))}
              rows={3}
            />
          </div>

          <altcha-widget
            ref={captchaRef as any}
            challengeurl={`${PROXY_BASE}/api/_challenge?path=${encodeURIComponent(SUBMIT_PATH)}`}
            auto="onsubmit"
            hidefooter
          />

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Wird gesendet...' : 'Absenden'}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Powered by Klar
        </p>
      </div>
    </div>
  );
}
