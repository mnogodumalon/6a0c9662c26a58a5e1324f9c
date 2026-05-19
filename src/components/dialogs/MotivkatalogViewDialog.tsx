import type { Motivkatalog } from '@/types/app';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil, IconFileText } from '@tabler/icons-react';

interface MotivkatalogViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Motivkatalog | null;
  onEdit: (record: Motivkatalog) => void;
}

export function MotivkatalogViewDialog({ open, onClose, record, onEdit }: MotivkatalogViewDialogProps) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Motivkatalog anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Beschreibung</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.beschreibung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kategorie</Label>
            <Badge variant="secondary">{record.fields.kategorie?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Maximale Druckbreite (cm)</Label>
            <p className="text-sm">{record.fields.max_breite_cm ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Maximale Druckhöhe (cm)</Label>
            <p className="text-sm">{record.fields.max_hoehe_cm ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Verfügbare Materialien</Label>
            <p className="text-sm">{Array.isArray(record.fields.material) ? record.fields.material.map((v: any) => v?.label ?? v).join(', ') : '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Preis pro m² (€)</Label>
            <p className="text-sm">{record.fields.preis_pro_qm ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vorschaubild</Label>
            {record.fields.vorschaubild ? (
              <div className="relative w-full rounded-lg bg-muted overflow-hidden border">
                <img src={record.fields.vorschaubild} alt="" className="w-full h-auto object-contain" />
              </div>
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Motiv aktiv (im Angebot verfügbar)</Label>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              record.fields.aktiv ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {record.fields.aktiv ? 'Ja' : 'Nein'}
            </span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Motivname</Label>
            <p className="text-sm">{record.fields.motivname ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}