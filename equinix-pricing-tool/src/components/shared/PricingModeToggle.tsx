import { useState } from 'react';
import { useConfigStore } from '@/store/configStore';
import { LivePricingCredentialDialog } from './LivePricingCredentialDialog';

export function PricingModeToggle() {
  const pricingMode = useConfigStore((s) => s.ui.pricingMode);
  const setPricingMode = useConfigStore((s) => s.setPricingMode);
  const [showCredentialDialog, setShowCredentialDialog] = useState(false);

  const isLive = pricingMode === 'live';

  const handleClick = () => {
    if (isLive) {
      setPricingMode('cached');
    } else {
      setShowCredentialDialog(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border ${
          isLive
            ? 'bg-green-900/40 border-green-500/50 text-green-400 hover:bg-green-900/60'
            : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white hover:border-gray-500'
        }`}
        title={isLive ? 'Switch to cached pricing' : 'Switch to live API pricing'}
      >
        {isLive && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
          </span>
        )}
        {isLive ? 'Live' : 'Cached'}
      </button>

      {showCredentialDialog && (
        <LivePricingCredentialDialog
          onAuthenticated={() => {
            setPricingMode('live');
            setShowCredentialDialog(false);
          }}
          onCancel={() => setShowCredentialDialog(false)}
        />
      )}
    </>
  );
}
