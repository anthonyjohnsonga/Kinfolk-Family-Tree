import { useRef, useState } from 'react';
import type { Tree } from '../types';
import { api } from '../api';

export function GedcomImportButton({
  label,
  className,
  disabled,
  onImported,
  onError,
}: {
  label: string;
  className?: string;
  disabled?: boolean;
  onImported: (tree: Tree) => void;
  onError: (message: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function importGedcom(file: File) {
    setBusy(true);
    onError('');
    try {
      const imported = await api<Tree>('/api/trees/import', {
        method: 'POST',
        body: JSON.stringify({ gedcom: await file.text() }),
      });
      onImported(imported);
    } catch (x) {
      onError((x as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={disabled || busy}
        onClick={() => fileRef.current?.click()}
      >
        {busy ? 'Importing…' : label}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".ged,text/plain"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void importGedcom(file);
        }}
      />
    </>
  );
}
