import { useState, useRef } from 'react';
import { useConfigStore } from '@/store/configStore';
import { usePricing } from '@/hooks/usePricing';
import { downloadProjectFile, parseProjectFile, type ParseResult } from '@/utils/configSerializer';

interface HeaderActionsMenuProps {
  onImport: (result: ParseResult) => void;
  onRefreshClick: () => void;
  cacheBadge: string;
  cacheBadgeAccent?: boolean;
}

export function HeaderActionsMenu({ onImport, onRefreshClick, cacheBadge, cacheBadgeAccent }: HeaderActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const project = useConfigStore((s) => s.project);
  const hasMetros = project.metros.length > 0;
  const { exportCsv, summary } = usePricing();
  const hasItems = summary.metroSubtotals.some((m) => m.lineItems.length > 0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const close = () => setOpen(false);

  const handleSave = () => { downloadProjectFile(project); close(); };
  const handleLoad = () => { fileInputRef.current?.click(); close(); };
  const handleExport = () => { exportCsv(); close(); };
  const handleRefresh = () => { onRefreshClick(); close(); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    onImport(parseProjectFile(text));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-2 text-gray-300 hover:text-white rounded-md hover:bg-gray-700 transition-colors"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 w-48 bg-white text-gray-800 rounded-md shadow-lg ring-1 ring-black/10 z-20 overflow-hidden"
          >
            <MenuItem onClick={handleSave} disabled={!hasMetros} label="Save project" />
            <MenuItem onClick={handleLoad} label="Load project" />
            <MenuItem onClick={handleExport} disabled={!hasItems} label="Export CSV" />
            <div className="border-t border-gray-200" />
            <MenuItem onClick={handleRefresh} label={cacheBadge} accent={cacheBadgeAccent} subdued />
          </div>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}

function MenuItem({
  onClick,
  disabled,
  label,
  accent,
  subdued,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  accent?: boolean;
  subdued?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
        accent ? 'text-yellow-600' : subdued ? 'text-gray-500' : ''
      }`}
    >
      {label}
    </button>
  );
}
