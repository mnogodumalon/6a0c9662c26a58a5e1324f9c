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
import { lookupKey, lookupKeys } from '@/lib/formatters';

// Empty PROXY_BASE → relative URLs (dashboard and form-proxy share the domain).
const PROXY_BASE = '';
const APP_ID = '6a0c963b2b58ecdaddd9c45a';
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

export default function PublicFormMotivkatalog() {
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
          <h1 className="text-2xl font-bold text-foreground">Motivkatalog — Formular</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded-xl border border-border p-6 shadow-md">
          <div className="space-y-2">
            <Label htmlFor="beschreibung">Beschreibung</Label>
            <Textarea
              id="beschreibung"
              placeholder=""
              value={fields.beschreibung ?? ''}
              onChange={e => setFields(f => ({ ...f, beschreibung: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kategorie">Kategorie</Label>
            <Select
              value={lookupKey(fields.kategorie) ?? ''}
              onValueChange={v => setFields(f => ({ ...f, kategorie: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="kategorie"><SelectValue placeholder="" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="natur_landschaft">Natur & Landschaft</SelectItem>
                <SelectItem value="stadtansichten">Stadtansichten</SelectItem>
                <SelectItem value="abstrakt">Abstrakt</SelectItem>
                <SelectItem value="tiere">Tiere</SelectItem>
                <SelectItem value="architektur">Architektur</SelectItem>
                <SelectItem value="kunst_illustration">Kunst & Illustration</SelectItem>
                <SelectItem value="sonstiges">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="max_breite_cm">Maximale Druckbreite (cm)</Label>
            <Input
              id="max_breite_cm"
              type="number"
              step="any"
              min={0}
              placeholder=""
              value={fields.max_breite_cm ?? ''}
              onChange={e => { const n = e.target.value ? Math.max(0, Number(e.target.value)) : undefined; setFields(f => ({ ...f, max_breite_cm: n })); }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max_hoehe_cm">Maximale Druckhöhe (cm)</Label>
            <Input
              id="max_hoehe_cm"
              type="number"
              step="any"
              min={0}
              placeholder=""
              value={fields.max_hoehe_cm ?? ''}
              onChange={e => { const n = e.target.value ? Math.max(0, Number(e.target.value)) : undefined; setFields(f => ({ ...f, max_hoehe_cm: n })); }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="material">Verfügbare Materialien</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="material_leinwand"
                  checked={lookupKeys(fields.material).includes('leinwand')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.material);
                      const next = checked ? [...current, 'leinwand'] : current.filter(k => k !== 'leinwand');
                      return { ...f, material: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="material_leinwand" className="font-normal">Leinwand</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="material_fotopaier"
                  checked={lookupKeys(fields.material).includes('fotopaier')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.material);
                      const next = checked ? [...current, 'fotopaier'] : current.filter(k => k !== 'fotopaier');
                      return { ...f, material: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="material_fotopaier" className="font-normal">Fotopapier</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="material_acrylglas"
                  checked={lookupKeys(fields.material).includes('acrylglas')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.material);
                      const next = checked ? [...current, 'acrylglas'] : current.filter(k => k !== 'acrylglas');
                      return { ...f, material: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="material_acrylglas" className="font-normal">Acrylglas</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="material_aluminium_dibond"
                  checked={lookupKeys(fields.material).includes('aluminium_dibond')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.material);
                      const next = checked ? [...current, 'aluminium_dibond'] : current.filter(k => k !== 'aluminium_dibond');
                      return { ...f, material: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="material_aluminium_dibond" className="font-normal">Aluminium-Dibond</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="material_tapete"
                  checked={lookupKeys(fields.material).includes('tapete')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.material);
                      const next = checked ? [...current, 'tapete'] : current.filter(k => k !== 'tapete');
                      return { ...f, material: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="material_tapete" className="font-normal">Tapete</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="material_pvc_plane"
                  checked={lookupKeys(fields.material).includes('pvc_plane')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.material);
                      const next = checked ? [...current, 'pvc_plane'] : current.filter(k => k !== 'pvc_plane');
                      return { ...f, material: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="material_pvc_plane" className="font-normal">PVC-Plane</Label>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="preis_pro_qm">Preis pro m² (€)</Label>
            <Input
              id="preis_pro_qm"
              type="number"
              step="any"
              min={0}
              placeholder=""
              value={fields.preis_pro_qm ?? ''}
              onChange={e => { const n = e.target.value ? Math.max(0, Number(e.target.value)) : undefined; setFields(f => ({ ...f, preis_pro_qm: n })); }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="aktiv">Motiv aktiv (im Angebot verfügbar)</Label>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="aktiv"
                checked={!!fields.aktiv}
                onCheckedChange={(v) => setFields(f => ({ ...f, aktiv: !!v }))}
              />
              <Label htmlFor="aktiv" className="font-normal">Motiv aktiv (im Angebot verfügbar)</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="motivname">Motivname</Label>
            <Input
              id="motivname"
              placeholder=""
              value={fields.motivname ?? ''}
              onChange={e => setFields(f => ({ ...f, motivname: e.target.value }))}
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
