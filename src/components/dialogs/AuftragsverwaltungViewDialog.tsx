import type { Auftragsverwaltung, Kundenverwaltung, Motivkatalog } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

interface AuftragsverwaltungViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Auftragsverwaltung | null;
  onEdit: (record: Auftragsverwaltung) => void;
  kundenverwaltungList: Kundenverwaltung[];
  motivkatalogList: Motivkatalog[];
}

export function AuftragsverwaltungViewDialog({ open, onClose, record, onEdit, kundenverwaltungList, motivkatalogList }: AuftragsverwaltungViewDialogProps) {
  function getKundenverwaltungDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return kundenverwaltungList.find(r => r.record_id === id)?.fields.vorname ?? '—';
  }

  function getMotivkatalogDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return motivkatalogList.find(r => r.record_id === id)?.fields.motivname ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Auftragsverwaltung anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Auftragsnummer</Label>
            <p className="text-sm">{record.fields.auftragsnummer ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Auftragsdatum</Label>
            <p className="text-sm">{formatDate(record.fields.auftragsdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Auftragsstatus</Label>
            <Badge variant="secondary">{record.fields.status?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kunde</Label>
            <p className="text-sm">{getKundenverwaltungDisplayName(record.fields.kunde)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Motive</Label>
            <p className="text-sm">{getMotivkatalogDisplayName(record.fields.motive)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Gewünschte Breite (cm)</Label>
            <p className="text-sm">{record.fields.breite_cm ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Gewünschte Höhe (cm)</Label>
            <p className="text-sm">{record.fields.hoehe_cm ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Anzahl</Label>
            <p className="text-sm">{record.fields.anzahl ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Gewähltes Material</Label>
            <Badge variant="secondary">{record.fields.material_auswahl?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Wunschlieferdatum</Label>
            <p className="text-sm">{formatDate(record.fields.wunschlieferdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Montage gewünscht</Label>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              record.fields.montage_gewuenscht ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {record.fields.montage_gewuenscht ? 'Ja' : 'Nein'}
            </span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Abweichende Lieferadresse</Label>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              record.fields.lieferadresse_abweichend ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {record.fields.lieferadresse_abweichend ? 'Ja' : 'Nein'}
            </span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Lieferstraße</Label>
            <p className="text-sm">{record.fields.lieferstrasse ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Lieferhausnummer</Label>
            <p className="text-sm">{record.fields.lieferhausnummer ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Lieferpostleitzahl</Label>
            <p className="text-sm">{record.fields.lieferpostleitzahl ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Lieferort</Label>
            <p className="text-sm">{record.fields.lieferort ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Sonderwünsche</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.sonderwuensche ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Interne Notizen</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.interne_notizen ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}