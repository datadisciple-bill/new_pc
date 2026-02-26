import { useState } from 'react';
import { useConfigStore } from '@/store/configStore';
import { usePricing } from '@/hooks/usePricing';
import { BANDWIDTH_OPTIONS, CLOUD_SERVICE_PROFILES } from '@/constants/serviceDefaults';
import { SERVICE_TYPE_LABELS } from '@/constants/brandColors';
import { ConfirmDeleteButton } from '@/components/shared/ConfirmDeleteButton';
import { formatCurrency } from '@/utils/priceCalculator';
import type { VirtualConnection, EndpointType } from '@/types/config';

function serviceLabel(svc: { type: string; metroCode: string; config: Record<string, unknown> }): string {
  const typeLabel = SERVICE_TYPE_LABELS[svc.type] ?? svc.type;
  let detail = '';
  if (svc.type === 'FABRIC_PORT') {
    const c = svc.config as { speed?: string; type?: string };
    detail = ` ${c.speed ?? ''} ${c.type === 'REDUNDANT' ? 'Red.' : ''}`;
  } else if (svc.type === 'NETWORK_EDGE') {
    const c = svc.config as { deviceTypeName?: string };
    detail = c.deviceTypeName ? ` ${c.deviceTypeName}` : '';
  } else if (svc.type === 'CLOUD_ROUTER') {
    const c = svc.config as { package?: string };
    detail = ` ${c.package ?? ''}`;
  } else if (svc.type === 'COLOCATION') {
    const c = svc.config as { description?: string };
    detail = c.description ? ` ${c.description}` : '';
  }
  return `${typeLabel}${detail} (${svc.metroCode})`;
}

function endpointTypeForService(svcType: string): EndpointType {
  switch (svcType) {
    case 'CLOUD_ROUTER': return 'CLOUD_ROUTER';
    case 'NETWORK_EDGE': return 'NETWORK_EDGE';
    case 'COLOCATION': return 'COLOCATION';
    case 'NSP': return 'NSP';
    default: return 'PORT';
  }
}

interface ConnectionForm {
  name: string;
  type: VirtualConnection['type'];
  aSideMetro: string;
  aSideServiceId: string;
  zSideType: 'SERVICE' | 'SERVICE_PROFILE';
  zSideServiceId: string;
  zSideProfile: string;
  bandwidth: number;
  redundant: boolean;
  showPriceTable: boolean;
}

const EMPTY_FORM: ConnectionForm = {
  name: '', type: 'EVPL_VC', aSideMetro: '', aSideServiceId: '',
  zSideType: 'SERVICE', zSideServiceId: '', zSideProfile: '',
  bandwidth: 1000, redundant: false, showPriceTable: false,
};

export function VirtualConnectionConfig() {
  const metros = useConfigStore((s) => s.project.metros);
  const connections = useConfigStore((s) => s.project.connections);
  const addConnection = useConfigStore((s) => s.addConnection);
  const removeConnection = useConfigStore((s) => s.removeConnection);
  const updateConnection = useConfigStore((s) => s.updateConnection);
  const { fetchPriceForConnection, fetchPriceTableForConnection } = usePricing();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ConnectionForm>({ ...EMPTY_FORM });

  const allServices = metros.flatMap((m) =>
    m.services.map((s) => ({
      ...s,
      metroCode: m.metroCode,
      metroName: m.metroName,
      config: s.config as unknown as Record<string, unknown>,
    }))
  );

  // Colocation can only connect to Fabric Port or Internet Access
  const COLOCATION_ALLOWED_TYPES = new Set(['FABRIC_PORT', 'INTERNET_ACCESS']);

  // Z-Side services: exclude A-Side service itself + enforce connection rules
  const aSideService = allServices.find((s) => s.id === form.aSideServiceId);
  const zSideServices = allServices.filter((s) => {
    if (s.id === form.aSideServiceId) return false;
    // Colocation ↔ only Fabric Port and Internet Access
    if (aSideService?.type === 'COLOCATION' && !COLOCATION_ALLOWED_TYPES.has(s.type)) return false;
    if (s.type === 'COLOCATION' && aSideService && !COLOCATION_ALLOWED_TYPES.has(aSideService.type)) return false;
    return true;
  });

  // When A-side is Colocation, disable Cloud Provider z-side option
  const canSelectCloudProvider = aSideService?.type !== 'COLOCATION';

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(false);
  };

  const handleAdd = () => {
    const aSvc = allServices.find((s) => s.id === form.aSideServiceId);
    let zMetro = '';
    let zType: EndpointType;
    let zServiceId: string;
    let zProfileName: string | undefined;

    if (form.zSideType === 'SERVICE_PROFILE') {
      zMetro = aSvc?.metroCode ?? form.aSideMetro;
      zType = 'SERVICE_PROFILE';
      zServiceId = form.zSideProfile;
      zProfileName = CLOUD_SERVICE_PROFILES.find((p) => p.name === form.zSideProfile)?.name;
    } else {
      const zSvc = allServices.find((s) => s.id === form.zSideServiceId);
      zMetro = zSvc?.metroCode ?? form.aSideMetro;
      zType = zSvc ? endpointTypeForService(zSvc.type) : 'PORT';
      zServiceId = form.zSideServiceId;
    }

    const connId = addConnection({
      name: form.name || `${form.type} Connection`,
      type: form.type,
      aSide: {
        metroCode: aSvc?.metroCode ?? form.aSideMetro,
        type: aSvc ? endpointTypeForService(aSvc.type) : 'PORT',
        serviceId: form.aSideServiceId,
      },
      zSide: {
        metroCode: zMetro,
        type: zType,
        serviceId: zServiceId,
        serviceProfileName: zProfileName,
      },
      bandwidthMbps: form.bandwidth,
      redundant: form.redundant,
      showPriceTable: form.showPriceTable,
    });
    const aMetro = aSvc?.metroCode ?? form.aSideMetro;
    fetchPriceForConnection(connId, form.bandwidth, aMetro, zMetro);
    if (form.showPriceTable) {
      fetchPriceTableForConnection(connId);
    }
    resetForm();
  };

  const handleEdit = (conn: VirtualConnection) => {
    const isProfile = conn.zSide.type === 'SERVICE_PROFILE';
    setEditingId(conn.id);
    setForm({
      name: conn.name,
      type: conn.type,
      aSideMetro: conn.aSide.metroCode,
      aSideServiceId: conn.aSide.serviceId,
      zSideType: isProfile ? 'SERVICE_PROFILE' : 'SERVICE',
      zSideServiceId: isProfile ? '' : conn.zSide.serviceId,
      zSideProfile: isProfile ? (conn.zSide.serviceProfileName ?? '') : '',
      bandwidth: conn.bandwidthMbps,
      redundant: conn.redundant,
      showPriceTable: conn.showPriceTable,
    });
    setShowForm(true);
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    const aSvc = allServices.find((s) => s.id === form.aSideServiceId);
    let zMetro = '';
    let zType: EndpointType;
    let zServiceId: string;
    let zProfileName: string | undefined;

    if (form.zSideType === 'SERVICE_PROFILE') {
      zMetro = aSvc?.metroCode ?? form.aSideMetro;
      zType = 'SERVICE_PROFILE';
      zServiceId = form.zSideProfile;
      zProfileName = CLOUD_SERVICE_PROFILES.find((p) => p.name === form.zSideProfile)?.name;
    } else {
      const zSvc = allServices.find((s) => s.id === form.zSideServiceId);
      zMetro = zSvc?.metroCode ?? form.aSideMetro;
      zType = zSvc ? endpointTypeForService(zSvc.type) : 'PORT';
      zServiceId = form.zSideServiceId;
    }

    updateConnection(editingId, {
      name: form.name || `${form.type} Connection`,
      type: form.type,
      aSide: {
        metroCode: aSvc?.metroCode ?? form.aSideMetro,
        type: aSvc ? endpointTypeForService(aSvc.type) : 'PORT',
        serviceId: form.aSideServiceId,
      },
      zSide: {
        metroCode: zMetro,
        type: zType,
        serviceId: zServiceId,
        serviceProfileName: zProfileName,
      },
      bandwidthMbps: form.bandwidth,
      redundant: form.redundant,
      showPriceTable: form.showPriceTable,
    });
    const aMetroEdit = aSvc?.metroCode ?? form.aSideMetro;
    fetchPriceForConnection(editingId, form.bandwidth, aMetroEdit, zMetro);

    // Fetch or clear price table based on checkbox
    const existingConn = connections.find((c) => c.id === editingId);
    if (form.showPriceTable) {
      fetchPriceTableForConnection(editingId);
    } else if (existingConn?.showPriceTable) {
      updateConnection(editingId, { priceTable: null });
    }

    resetForm();
  };

  // Build a readable label for existing connections
  const connectionLabel = (conn: VirtualConnection) => {
    const aSvc = allServices.find((s) => s.id === conn.aSide.serviceId);
    const zSvc = allServices.find((s) => s.id === conn.zSide.serviceId);
    const aSideLabel = aSvc
      ? `${SERVICE_TYPE_LABELS[aSvc.type] ?? aSvc.type} (${conn.aSide.metroCode})`
      : conn.aSide.metroCode;
    const zSideLabel = conn.zSide.serviceProfileName
      ?? (zSvc ? `${SERVICE_TYPE_LABELS[zSvc.type] ?? zSvc.type} (${conn.zSide.metroCode})` : conn.zSide.metroCode);
    const isSameMetro = conn.aSide.metroCode === conn.zSide.metroCode;
    return `${aSideLabel} -> ${zSideLabel}${isSameMetro ? ' (local)' : ''}`;
  };

  // Toggle price table on/off for existing connection without opening full edit
  const togglePriceTable = (conn: VirtualConnection) => {
    const newVal = !conn.showPriceTable;
    updateConnection(conn.id, { showPriceTable: newVal });
    if (newVal) {
      fetchPriceTableForConnection(conn.id);
    } else {
      updateConnection(conn.id, { priceTable: null });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="font-bold text-sm text-equinix-navy">Virtual Connections</h3>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="px-2.5 py-1 text-xs font-medium bg-equinix-black text-white rounded-md hover:bg-gray-800"
        >
          + Add Connection
        </button>
      </div>

      {showForm && (
        <div className="mx-4 border border-gray-200 rounded-lg p-3 space-y-3">
          <p className="text-xs font-bold text-equinix-navy">
            {editingId ? 'Edit Connection' : 'New Connection'}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Connection Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., DC Port to NE, or DC to AT"
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
            <select
              value={form.aSideServiceId}
              onChange={(e) => {
                const svc = allServices.find((s) => s.id === e.target.value);
                setForm({
                  ...form,
                  aSideServiceId: e.target.value,
                  aSideMetro: svc?.metroCode ?? '',
                });
              }}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
            >
              <option value="">Select a service...</option>
              {metros.map((m) => (
                <optgroup key={m.metroCode} label={`${m.metroCode} — ${m.metroName}`}>
                  {allServices
                    .filter((s) => s.metroCode === m.metroCode)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {serviceLabel(s)}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Z-Side */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-equinix-green">Z-Side (Destination)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <select
                  value={form.zSideType}
                  onChange={(e) => setForm({ ...form, zSideType: e.target.value as 'SERVICE' | 'SERVICE_PROFILE', zSideServiceId: '', zSideProfile: '' })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                >
                  <option value="SERVICE">Equinix Service</option>
                  {canSelectCloudProvider && (
                    <option value="SERVICE_PROFILE">Cloud Provider</option>
                  )}
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
                    <option value="">Select a service...</option>
                    {metros.map((m) => (
                      <optgroup key={m.metroCode} label={`${m.metroCode} — ${m.metroName}`}>
                        {zSideServices
                          .filter((s) => s.metroCode === m.metroCode)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {serviceLabel(s)}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.redundant}
                onChange={(e) => setForm({ ...form, redundant: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-xs text-gray-600">Create Redundant Connections</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.showPriceTable}
                onChange={(e) => setForm({ ...form, showPriceTable: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 accent-equinix-green"
              />
              <span className="text-xs text-gray-600">Show bandwidth price table (diagram + CSV)</span>
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={editingId ? handleSaveEdit : handleAdd}
              disabled={!form.aSideServiceId || (form.zSideType === 'SERVICE' ? !form.zSideServiceId : !form.zSideProfile)}
              className="px-4 py-1.5 text-xs font-medium bg-equinix-green text-white rounded-md hover:bg-green-600 disabled:opacity-50"
            >
              {editingId ? 'Save Changes' : 'Add Connection'}
            </button>
            <button
              onClick={resetForm}
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
          <div key={conn.id} className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-equinix-navy truncate">{conn.name || conn.type}</p>
                <p className="text-xs text-gray-500 truncate">
                  {connectionLabel(conn)}
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
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <button
                  onClick={() => handleEdit(conn)}
                  className="text-gray-400 hover:text-equinix-green transition-colors p-1"
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <ConfirmDeleteButton
                  onDelete={() => removeConnection(conn.id)}
                  requiresConfirm
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </ConfirmDeleteButton>
              </div>
            </div>

            {/* Price table toggle */}
            <div className="mt-2 pt-2 border-t border-gray-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={conn.showPriceTable}
                  onChange={() => togglePriceTable(conn)}
                  className="w-3.5 h-3.5 rounded border-gray-300 accent-equinix-green"
                />
                <span className="text-[10px] text-gray-500">Show price table</span>
              </label>
              {conn.showPriceTable && conn.priceTable && (
                <div className="mt-2 overflow-x-auto">
                  <p className="text-[9px] text-gray-400 mb-1">Click a row to change bandwidth</p>
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-1.5 py-1 text-gray-500 font-medium">Bandwidth</th>
                        <th className="text-right px-1.5 py-1 text-gray-500 font-medium">MRC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conn.priceTable.map((entry) => (
                        <tr
                          key={entry.bandwidthMbps}
                          onClick={() => {
                            if (entry.bandwidthMbps !== conn.bandwidthMbps) {
                              updateConnection(conn.id, { bandwidthMbps: entry.bandwidthMbps });
                              fetchPriceForConnection(conn.id, entry.bandwidthMbps);
                            }
                          }}
                          className={`cursor-pointer ${entry.bandwidthMbps === conn.bandwidthMbps
                            ? 'bg-green-50 font-bold'
                            : 'hover:bg-gray-50'}`}
                        >
                          <td className="px-1.5 py-0.5 text-gray-700">{entry.label}</td>
                          <td className="px-1.5 py-0.5 text-right text-gray-700">
                            {formatCurrency(entry.mrc)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
