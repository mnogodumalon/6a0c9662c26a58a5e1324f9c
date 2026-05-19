import type { Produktionsplanung, Auftragsverwaltung } from '@/types/app';
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

interface ProduktionsplanungViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Produktionsplanung | null;
  onEdit: (record: Produktionsplanung) => void;
  auftragsverwaltungList: Auftragsverwaltung[];
}

export function ProduktionsplanungViewDialog({ open, onClose, record, onEdit, auftragsverwaltungList }: ProduktionsplanungViewDialogProps) {
  function getAuftragsverwaltungDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return auftragsverwaltungList.find(r => r.record_id === id)?.fields.auftragsnummer ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Produktionsplanung anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tatsächliches Druckdatum</Label>
            <p className="text-sm">{formatDate(record.fields.tatsaechliches_druckdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Verwendeter Drucker</Label>
            <Badge variant="secondary">{record.fields.drucker?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Zuständiger Mitarbeiter</Label>
            <p className="text-sm">{record.fields.zustaendiger_mitarbeiter ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Druckstatus</Label>
            <Badge variant="secondary">{record.fields.druckstatus?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Qualitätsprüfung bestanden</Label>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              record.fields.qualitaetspruefung_bestanden ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {record.fields.qualitaetspruefung_bestanden ? 'Ja' : 'Nein'}
            </span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Anmerkungen zur Produktion</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.produktionsanmerkungen ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Produktionsnummer</Label>
            <p className="text-sm">{record.fields.produktionsnummer ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Auftrag</Label>
            <p className="text-sm">{getAuftragsverwaltungDisplayName(record.fields.auftrag)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Geplantes Druckdatum</Label>
            <p className="text-sm">{formatDate(record.fields.geplantes_druckdatum)}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}