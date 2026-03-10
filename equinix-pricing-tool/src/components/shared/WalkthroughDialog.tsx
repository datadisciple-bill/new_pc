import { useState } from 'react';

const WALKTHROUGH_DISMISSED_KEY = 'walkthrough-dismissed';

export function hasSeenWalkthrough(): boolean {
  return localStorage.getItem(WALKTHROUGH_DISMISSED_KEY) === '1';
}

interface WalkthroughStep {
  title: string;
  description: string;
  icon: string;
  tip?: string;
}

const STEPS: WalkthroughStep[] = [
  {
    title: 'Welcome',
    description:
      'This tool helps Equinix Presales Solutions Architects build branded network diagrams with real-time pricing. Walk through each step to design a solution, then export a pricing sheet.',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1',
  },
  {
    title: 'Select Metros',
    description:
      'Start by choosing one or more Equinix metro locations (e.g. DA, DC, LD). Each metro becomes a container on your diagram where you add services.',
    icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
    tip: 'On desktop, metros are in the left panel. On mobile, use the Metros tab.',
  },
  {
    title: 'Add Services',
    description:
      'Within each metro, add Equinix services: Fabric Ports, Network Edge virtual devices, Internet Access, Cloud Router, Colocation, and more. Configure bandwidth, redundancy, and device options.',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    tip: 'Drag between service handles on the diagram to create connections automatically.',
  },
  {
    title: 'Network Diagram',
    description:
      'Your services appear on a branded Equinix network diagram. Drag to reposition metros and nodes. Drag between handles to create Virtual Connections or Cross Connects. Add text boxes, local sites, and annotation markers.',
    icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z',
    tip: 'Use the toolbar to add text boxes, local sites, cloud labels, and export as PNG.',
  },
  {
    title: 'Pricing & Export',
    description:
      'View real-time pricing for all configured services and connections. Toggle between cached and live pricing modes. Export your full pricing sheet as a CSV file, or save/load projects as JSON.',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    tip: 'Click the version number in the header to see the changelog.',
  },
];

export function WalkthroughDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  const handleDismiss = () => {
    localStorage.setItem(WALKTHROUGH_DISMISSED_KEY, '1');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
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
  );
}
