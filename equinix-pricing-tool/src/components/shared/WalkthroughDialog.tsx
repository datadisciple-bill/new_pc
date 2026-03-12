import { useState, useEffect, useCallback, useRef } from 'react';

const WALKTHROUGH_DISMISSED_KEY = 'walkthrough-dismissed';

export function hasSeenWalkthrough(): boolean {
  return localStorage.getItem(WALKTHROUGH_DISMISSED_KEY) === '1';
}

interface WalkthroughStep {
  title: string;
  description: string;
  icon: string;
  tip?: string;
  /** data-walkthrough attribute value to spotlight on this step */
  target?: string;
  /** Where to position the dialog relative to the spotlight */
  dialogPosition?: 'center' | 'right' | 'left' | 'below';
}

const STEPS: WalkthroughStep[] = [
  {
    title: 'Welcome',
    description:
      'This tool helps Equinix Presales Solutions Architects build branded network diagrams with real-time pricing. Walk through each step to design a solution, then export a pricing sheet.',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1',
    dialogPosition: 'center',
  },
  {
    title: 'Select Metros',
    description:
      'Start by choosing one or more Equinix metro locations (e.g. DA, DC, LD). Each metro becomes a container on your diagram where you add services.',
    icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
    tip: 'On desktop, metros are in the left panel. On mobile, use the Metros tab.',
    target: 'metros-panel',
    dialogPosition: 'right',
  },
  {
    title: 'Add Services',
    description:
      'Within each metro, add Equinix services: Fabric Ports, Network Edge virtual devices, Internet Access, Cloud Router, Colocation, and more. Configure bandwidth, redundancy, and device options.',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    tip: 'Drag between service handles on the diagram to create connections automatically.',
    target: 'services-panel',
    dialogPosition: 'right',
  },
  {
    title: 'Diagram Toolbar',
    description:
      'The diagram toolbar lets you toggle pricing overlays, undo changes, reset layout, and add elements like text boxes, local sites, annotation markers, and multipoint networks. You can also export the diagram as a PNG image.',
    icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z',
    tip: 'Use the Align dropdown to choose from 9 layout strategies including Hub & Spoke and Group by Region.',
    target: 'diagram-toolbar',
    dialogPosition: 'below',
  },
  {
    title: 'Connection Routing',
    description:
      'Connections attach to node handles on the left and right by default. To change which side a connection attaches to, right-click its label on the diagram. A menu lets you pin the A-Side or Z-Side to any edge — left, right, top, or bottom.',
    icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
    tip: 'Color-coded labels appear at each end of the line so you know which side is A-Side (blue) and Z-Side (green).',
    dialogPosition: 'center',
  },
  {
    title: 'Collapsible Panels',
    description:
      'Need more diagram space? The Metros panel on the left and the Pricing panel on the right can each be collapsed. Click the arrow at the top of either panel to collapse it into a thin vertical tab. Click the tab to expand it again.',
    icon: 'M4 6h16M4 12h8m-8 6h16',
    tip: 'Your collapsed/expanded preference is remembered across sessions.',
    dialogPosition: 'center',
  },
  {
    title: 'Pricing & Export',
    description:
      'View real-time pricing for all configured services and connections. Toggle between cached and live pricing modes. Export your full pricing sheet as a CSV file, or save/load projects as JSON.',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    tip: 'Click the version number in the header to see the changelog. Click the Equinix logo to replay this walkthrough.',
    target: 'header-actions',
    dialogPosition: 'below',
  },
];

/** Padding around the spotlight cutout */
const SPOT_PAD = 8;

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function WalkthroughDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [spotRect, setSpotRect] = useState<SpotlightRect | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  // Find and measure the target element for the current step
  const updateSpotlight = useCallback(() => {
    if (!current.target) {
      setSpotRect(null);
      return;
    }
    const el = document.querySelector(`[data-walkthrough="${current.target}"]`);
    if (!el) {
      setSpotRect(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    setSpotRect({
      top: rect.top - SPOT_PAD,
      left: rect.left - SPOT_PAD,
      width: rect.width + SPOT_PAD * 2,
      height: rect.height + SPOT_PAD * 2,
    });
  }, [current.target]);

  // Re-measure on step change + window resize
  useEffect(() => {
    updateSpotlight();
    window.addEventListener('resize', updateSpotlight);
    return () => window.removeEventListener('resize', updateSpotlight);
  }, [updateSpotlight]);

  const handleDismiss = () => {
    localStorage.setItem(WALKTHROUGH_DISMISSED_KEY, '1');
    onClose();
  };

  // Compute dialog positioning style based on spotlight location
  const getDialogStyle = (): React.CSSProperties => {
    if (!spotRect || current.dialogPosition === 'center') {
      return {}; // default: centered via flexbox
    }

    const style: React.CSSProperties = { position: 'fixed', margin: 0 };
    const dialogW = 420; // approx max-w-md
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (current.dialogPosition === 'right') {
      // Place dialog to the right of the spotlight
      const left = spotRect.left + spotRect.width + 24;
      if (left + dialogW < vw - 16) {
        style.left = left;
        style.top = Math.max(16, Math.min(spotRect.top, vh - 400));
      }
      // Fallback: if it doesn't fit right, center it
      else {
        return {};
      }
    } else if (current.dialogPosition === 'left') {
      const right = vw - spotRect.left + 24;
      if (right + dialogW < vw - 16) {
        style.right = right;
        style.top = Math.max(16, Math.min(spotRect.top, vh - 400));
      } else {
        return {};
      }
    } else if (current.dialogPosition === 'below') {
      style.top = spotRect.top + spotRect.height + 16;
      // Center horizontally relative to spotlight, clamped to viewport
      const centerX = spotRect.left + spotRect.width / 2 - dialogW / 2;
      style.left = Math.max(16, Math.min(centerX, vw - dialogW - 16));
    }

    return style;
  };

  const dialogStyle = getDialogStyle();
  const isPositioned = Object.keys(dialogStyle).length > 0;

  return (
    <>
      {/* Spotlight overlay — dims everything except the target */}
      {spotRect ? (
        <>
          {/* Dark overlay with cutout via clip-path */}
          <div
            className="fixed inset-0 z-[48] transition-all duration-300"
            style={{
              background: 'rgba(0,0,0,0.55)',
              clipPath: `polygon(
                0% 0%, 0% 100%, 100% 100%, 100% 0%,
                0% 0%,
                ${spotRect.left}px ${spotRect.top}px,
                ${spotRect.left}px ${spotRect.top + spotRect.height}px,
                ${spotRect.left + spotRect.width}px ${spotRect.top + spotRect.height}px,
                ${spotRect.left + spotRect.width}px ${spotRect.top}px,
                ${spotRect.left}px ${spotRect.top}px,
                0% 0%
              )`,
              pointerEvents: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          />
          {/* Glowing border around the spotlight area */}
          <div
            className="fixed z-[49] rounded-lg transition-all duration-300 pointer-events-none"
            style={{
              top: spotRect.top,
              left: spotRect.left,
              width: spotRect.width,
              height: spotRect.height,
              border: '2px solid #00A85F',
              boxShadow: '0 0 16px rgba(0,168,95,0.4), inset 0 0 4px rgba(0,168,95,0.1)',
            }}
          />
        </>
      ) : (
        /* No spotlight — simple dark overlay */
        <div className="fixed inset-0 bg-black/50 z-[48]" />
      )}

      {/* Dialog */}
      <div
        className={`fixed z-50 ${isPositioned ? '' : 'inset-0 flex items-center justify-center p-4'}`}
      >
        <div
          ref={dialogRef}
          className="bg-white rounded-lg shadow-xl w-full max-w-md"
          style={dialogStyle}
        >
          {/* Header */}
          <div className="bg-equinix-black text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold">Getting Started</h2>
              <span className="text-[10px] text-gray-400">
                {step + 1} / {STEPS.length}
              </span>
            </div>
            <button
              onClick={handleDismiss}
              title="Skip walkthrough"
              className="text-gray-400 hover:text-white text-xs"
            >
              Skip
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-gray-100">
            <div
              className="h-full bg-equinix-green transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-equinix-green"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={current.icon}
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  {current.title}
                </h3>
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                  {current.description}
                </p>
              </div>
            </div>

            {current.tip && (
              <div className="bg-green-50 border border-green-200 rounded-md px-3 py-2">
                <p className="text-xs text-green-800">
                  <span className="font-semibold">Tip:</span> {current.tip}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 flex items-center justify-between">
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={isFirst}
              title="Go to previous step"
              className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-0 disabled:pointer-events-none transition-opacity"
            >
              Back
            </button>

            {/* Dots */}
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  title={`Go to step ${i + 1}: ${STEPS[i].title}`}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === step ? 'bg-equinix-green' : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                />
              ))}
            </div>

            {isLast ? (
              <button
                onClick={handleDismiss}
                title="Close walkthrough and start using the app"
                className="px-4 py-2 bg-equinix-green text-white text-sm font-medium rounded-md hover:opacity-90"
              >
                Get Started
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => s + 1)}
                title="Go to next step"
                className="px-4 py-2 bg-equinix-black text-white text-sm font-medium rounded-md hover:bg-gray-800"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
