import { useState } from 'react';
import { useConfigStore } from '@/store/configStore';
import { usePricing } from '@/hooks/usePricing';
import { BANDWIDTH_OPTIONS, CLOUD_SERVICE_PROFILES } from '@/constants/serviceDefaults';
import { formatCurrency } from '@/utils/priceCalculator';
import type { VirtualConnection, EndpointType } from '@/types/config';

export function VirtualConnectionConfig() {
  const metros = useConfigStore((s) => s.project.metros);
  const connections = useConfigStore((s) => s.project.connections);
  const addConnection = useConfigStore((s) => s.addConnection);
  const removeConnection = useConfigStore((s) => s.removeConnection);
  const { fetchPriceForConnection } = usePricing();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'EVPL_VC' as VirtualConnection['type'],
    aSideMetro: '',
    aSideType: 'PORT' as EndpointType,
    aSideServiceId: '',
    zSideMetro: '',
    zSideType: 'SERVICE_PROFILE' as EndpointType,
    zSideServiceId: '',
    zSideProfile: '',
    bandwidth: 1000,
    redundant: false,
  });

  const allServices = metros.flatMap((m) =>
    m.services.map((s) => ({ ...s, metroCode: m.metroCode, metroName: m.metroName }))
  );

  const handleAdd = () => {
    const connId = addConnection({
      name: form.name || `${form.type} Connection`,
      type: form.type,
      aSide: {
        metroCode: form.aSideMetro,
        type: form.aSideType,
        serviceId: form.aSideServiceId,
      },
      zSide: {
        metroCode: form.zSideMetro || form.aSideMetro,
        type: form.zSideType,
        serviceId: form.zSideServiceId || form.zSideProfile,
        serviceProfileName: form.zSideType === 'SERVICE_PROFILE'
          ? CLOUD_SERVICE_PROFILES.find((p) => p.name === form.zSideProfile)?.name
          : undefined,
      },
      bandwidthMbps: form.bandwidth,
      redundant: form.redundant,
    });
    fetchPriceForConnection(connId, form.bandwidth);
    setShowForm(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-4">
        <h3 className="font-bold text-sm text-equinix-navy">Virtual Connections</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-xs font-medium bg-equinix-black text-white rounded-md hover:bg-gray-800"
        >
          + Add Connection
        </button>
      </div>

      {showForm && (
        <div className="mx-4 border border-gray-200 rounded-lg p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Connection Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., DC to AWS"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as VirtualConnection['type'] })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
              >
                <option value="EVPL_VC">EVPL (Layer 2)</option>
                <option value="IP_VC">IP (Layer 3 / FCR)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Bandwidth</label>
              <select
                value={form.bandwidth}
                onChange={(e) => setForm({ ...form, bandwidth: parseInt(e.target.value) })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
              >
                {BANDWIDTH_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b >= 1000 ? `${b / 1000} Gbps` : `${b} Mbps`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* A-Side */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-equinix-green">A-Side (Origin)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <select
                  value={form.aSideMetro}
                  onChange={(e) => setForm({ ...form, aSideMetro: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                >
                  <option value="">Metro...</option>
                  {metros.map((m) => (
                    <option key={m.metroCode} value={m.metroCode}>{m.metroCode} - {m.metroName}</option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={form.aSideServiceId}
                  onChange={(e) => {
                    const svc = allServices.find((s) => s.id === e.target.value);
                    setForm({ ...form, aSideServiceId: e.target.value, aSideType: svc ? (svc.type === 'CLOUD_ROUTER' ? 'CLOUD_ROUTER' : 'PORT') : 'PORT' });
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                >
                  <option value="">Service...</option>
                  {allServices.filter((s) => !form.aSideMetro || s.metroCode === form.aSideMetro).map((s) => (
                    <option key={s.id} value={s.id}>{s.type} ({s.metroCode})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Z-Side */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-equinix-green">Z-Side (Destination)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <select
                  value={form.zSideType}
                  onChange={(e) => setForm({ ...form, zSideType: e.target.value as EndpointType })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                >
                  <option value="SERVICE_PROFILE">Cloud Provider</option>
                  <option value="PORT">Fabric Port</option>
                  <option value="NETWORK_EDGE">Network Edge</option>
                  <option value="CLOUD_ROUTER">Cloud Router</option>
                </select>
              </div>
              <div>
                {form.zSideType === 'SERVICE_PROFILE' ? (
                  <select
                    value={form.zSideProfile}
                    onChange={(e) => setForm({ ...form, zSideProfile: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                  >
                    <option value="">Provider...</option>
                    {CLOUD_SERVICE_PROFILES.map((p) => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={form.zSideServiceId}
                    onChange={(e) => setForm({ ...form, zSideServiceId: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                  >
                    <option value="">Service...</option>
                    {allServices.map((s) => (
                      <option key={s.id} value={s.id}>{s.type} ({s.metroCode})</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.redundant}
              onChange={(e) => setForm({ ...form, redundant: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-xs text-gray-600">Redundant Connection</span>
          </label>

          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!form.aSideMetro || (!form.zSideServiceId && !form.zSideProfile)}
              className="px-4 py-1.5 text-xs font-medium bg-equinix-green text-white rounded-md hover:bg-green-600 disabled:opacity-50"
            >
              Add Connection
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Existing connections */}
      <div className="space-y-2 px-4">
        {connections.length === 0 && !showForm && (
          <p className="text-center text-gray-400 text-sm py-4">No connections yet</p>
        )}
        {connections.map((conn) => (
          <div key={conn.id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-equinix-navy">{conn.name || conn.type}</p>
              <p className="text-xs text-gray-500">
                {conn.aSide.metroCode} → {conn.zSide.serviceProfileName || conn.zSide.metroCode}
                {' · '}
                {conn.bandwidthMbps >= 1000 ? `${conn.bandwidthMbps / 1000} Gbps` : `${conn.bandwidthMbps} Mbps`}
                {conn.redundant && ' · Redundant'}
              </p>
              {conn.pricing && (
                <p className="text-xs text-gray-500 mt-0.5">
                  MRC: {formatCurrency(conn.pricing.mrc)}
                </p>
              )}
            </div>
            <button
              onClick={() => removeConnection(conn.id)}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
