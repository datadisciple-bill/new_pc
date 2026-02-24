import type { ServiceSelection, NetworkEdgeConfig as NEConfig } from '@/types/config';
import type { DeviceType } from '@/types/equinix';
import { TERM_OPTIONS } from '@/constants/serviceDefaults';
import { ServiceCard } from './ServiceCard';

interface Props {
  service: ServiceSelection;
  metroCode: string;
  deviceTypes: DeviceType[];
  onUpdate: (config: Record<string, unknown>) => void;
  onRemove: () => void;
}

export function NetworkEdgeConfig({ service, deviceTypes, onUpdate, onRemove }: Props) {
  const config = service.config as NEConfig;

  const selectedDevice = deviceTypes.find((d) => d.deviceTypeCode === config.deviceTypeCode);

  return (
    <ServiceCard title="Network Edge" pricing={service.pricing} onRemove={onRemove}>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Device Type</label>
          <select
            value={config.deviceTypeCode}
            onChange={(e) => {
              const dt = deviceTypes.find((d) => d.deviceTypeCode === e.target.value);
              onUpdate({
                deviceTypeCode: e.target.value,
                deviceTypeName: dt?.name ?? '',
                vendorName: dt?.vendor ?? '',
                packageCode: dt ? `${dt.coreCounts[0]}` : '',
              });
            }}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
          >
            <option value="">Select device...</option>
            {deviceTypes.map((dt) => (
              <option key={dt.deviceTypeCode} value={dt.deviceTypeCode}>
                {dt.vendor} — {dt.name}
              </option>
            ))}
          </select>
        </div>

        {selectedDevice && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Package (Cores)</label>
                <select
                  value={config.packageCode}
                  onChange={(e) => onUpdate({ packageCode: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                >
                  {selectedDevice.coreCounts.map((c) => (
                    <option key={c} value={`${c}`}>{c} vCPU</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">License</label>
                <select
                  value={config.licenseType}
                  onChange={(e) => onUpdate({ licenseType: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                >
                  <option value="SUBSCRIPTION">Subscription</option>
                  <option value="BYOL">BYOL</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Term</label>
                <select
                  value={config.termLength}
                  onChange={(e) => onUpdate({ termLength: parseInt(e.target.value) })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                >
                  {TERM_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.redundant}
                    onChange={(e) => onUpdate({ redundant: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-xs text-gray-600">HA Pair</span>
                </label>
              </div>
            </div>

            {selectedDevice.softwarePackages.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Software</label>
                <select
                  value={config.softwareVersion}
                  onChange={(e) => onUpdate({ softwareVersion: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                >
                  <option value="">Default</option>
                  {selectedDevice.softwarePackages.map((sp) => (
                    <option key={sp.code} value={sp.code}>{sp.name}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}
      </div>
    </ServiceCard>
  );
}
