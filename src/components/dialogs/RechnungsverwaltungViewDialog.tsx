import type { Rechnungsverwaltung, Auftragsverwaltung, Kundenverwaltung } from '@/types/app';
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

interface RechnungsverwaltungViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Rechnungsverwaltung | null;
  onEdit: (record: Rechnungsverwaltung) => void;
  auftragsverwaltungList: Auftragsverwaltung[];
  kundenverwaltungList: Kundenverwaltung[];
}

export function RechnungsverwaltungViewDialog({ open, onClose, record, onEdit, auftragsverwaltungList, kundenverwaltungList }: RechnungsverwaltungViewDialogProps) {
  function getAuftragsverwaltungDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return auftragsverwaltungList.find(r => r.record_id === id)?.fields.auftragsnummer ?? '—';
  }

  function getKundenverwaltungDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return kundenverwaltungList.find(r => r.record_id === id)?.fields.vorname ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rechnungsverwaltung anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Rechnungsnummer</Label>
            <p className="text-sm">{record.fields.rechnungsnummer ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Rechnungsdatum</Label>
            <p className="text-sm">{formatDate(record.fields.rechnungsdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fälligkeitsdatum</Label>
            <p className="text-sm">{formatDate(record.fields.faelligkeitsdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Auftrag</Label>
            <p className="text-sm">{getAuftragsverwaltungDisplayName(record.fields.auftrag)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kunde</Label>
            <p className="text-sm">{getKundenverwaltungDisplayName(record.fields.kunde)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nettobetrag (€)</Label>
            <p className="text-sm">{record.fields.nettobetrag ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">MwSt.-Satz</Label>
            <Badge variant="secondary">{record.fields.mwst_satz?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">MwSt.-Betrag (€)</Label>
            <p className="text-sm">{record.fields.mwst_betrag ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Gesamtbetrag (€)</Label>
            <p className="text-sm">{record.fields.gesamtbetrag ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Zahlungsart</Label>
            <Badge variant="secondary">{record.fields.zahlungsart?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Zahlungsstatus</Label>
            <Badge variant="secondary">{record.fields.zahlungsstatus?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Zahlungsdatum</Label>
            <p className="text-sm">{formatDate(record.fields.zahlungsdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Anmerkungen zur Rechnung</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.rechnungsanmerkungen ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}