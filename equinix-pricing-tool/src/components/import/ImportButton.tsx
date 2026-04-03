import { useConfigStore } from '@/store/configStore';

interface ImportButtonProps {
  onClick: () => void;
}

export function ImportButton({ onClick }: ImportButtonProps) {
  const isAuthenticated = useConfigStore((s) => s.auth.isAuthenticated);

  if (!isAuthenticated) return null;

  return (
    <button
      onClick={onClick}
      title="Import existing Equinix environment"
      className="px-3 py-1.5 text-[10px] font-medium rounded-md shadow-sm border bg-white border-gray-300 transition-colors hover:bg-gray-50 flex items-center gap-1"
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
      Import
    </button>
  );
}
