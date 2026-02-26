import { useRef } from 'react';
import { useConfigStore } from '@/store/configStore';
import { downloadProjectFile, parseProjectFile, type ParseResult } from '@/utils/configSerializer';

interface ConfigExportImportProps {
  onImport: (result: ParseResult) => void;
}

export function ConfigExportImport({ onImport }: ConfigExportImportProps) {
  const project = useConfigStore((s) => s.project);
  const hasMetros = project.metros.length > 0;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    downloadProjectFile(project);
  };

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const result = parseProjectFile(text);
    onImport(result);

    // Reset so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={!hasMetros}
        className="flex items-center gap-1.5 px-3 py-2 border border-gray-500 text-gray-300 rounded-md text-sm hover:text-white hover:border-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        title="Save project configuration"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
        <span className="hidden sm:inline">Save</span>
      </button>

      {/* Load button */}
      <button
        onClick={handleLoadClick}
        className="flex items-center gap-1.5 px-3 py-2 border border-gray-500 text-gray-300 rounded-md text-sm hover:text-white hover:border-white transition-colors"
        title="Load project configuration"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <span className="hidden sm:inline">Load</span>
      </button>

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
