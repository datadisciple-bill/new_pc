import { useState } from 'react';
import { useConfigStore } from '@/store/configStore';
import { NETWORK_TYPES, NETWORK_SCOPES } from '@/constants/serviceDefaults';
import { SERVICE_TYPE_LABELS, NETWORK_NODE_COLORS } from '@/constants/brandColors';
import { ConfirmDeleteButton } from '@/components/shared/ConfirmDeleteButton';
import type { MultipointNetworkType, MultipointNetworkScope, MultipointNetwork } from '@/types/config';

interface NetworkForm {
  name: string;
  type: MultipointNetworkType;
  scope: MultipointNetworkScope;
  region: string;
}

const EMPTY_FORM: NetworkForm = {
  name: 'Multipoint Network',
  type: 'EVPLAN',
  scope: 'LOCAL',
  region: '',
};

const REGIONS = [
  { value: 'AMER', label: 'Americas (AMER)' },
  { value: 'EMEA', label: 'Europe/Middle East/Africa (EMEA)' },
  { value: 'APAC', label: 'Asia Pacific (APAC)' },
] as const;

export function MultipointNetworkManager() {
  const networks = useConfigStore((s) => s.project.networks);
  const addNetwork = useConfigStore((s) => s.addNetwork);
  const removeNetwork = useConfigStore((s) => s.removeNetwork);
  const updateNetwork = useConfigStore((s) => s.updateNetwork);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NetworkForm>({ ...EMPTY_FORM });

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(false);
  };

  const handleAdd = () => {
    const id = addNetwork(300, 200, form.type);
    updateNetwork(id, {
      name: form.name,
      type: form.type,
      scope: form.scope,
      region: form.scope === 'REGIONAL' ? form.region : undefined,
    });
    resetForm();
  };

  const handleEdit = (network: MultipointNetwork) => {
    setEditingId(network.id);
    setForm({
      name: network.name,
      type: network.type,
      scope: network.scope,
      region: network.region ?? '',
    });
    setShowForm(true);
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    updateNetwork(editingId, {
      name: form.name,
      type: form.type,
      scope: form.scope,
      region: form.scope === 'REGIONAL' ? form.region : undefined,
    });
    resetForm();
  };

  const selectedType = NETWORK_TYPES.find((t) => t.value === form.type);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="font-bold text-sm text-equinix-navy">Multipoint Networks</h3>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="px-2.5 py-1 text-xs font-medium bg-equinix-black text-white rounded-md hover:bg-gray-800"
        >
          + Add Network
        </button>
      </div>

      {showForm && (
        <div className="mx-4 border border-gray-200 rounded-lg p-3 space-y-3">
          <p className="text-xs font-bold text-equinix-navy">
            {editingId ? 'Edit Network' : 'New Network'}
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Network Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., DC E-LAN"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Network Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as MultipointNetworkType })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
            >
              {NETWORK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {selectedType && (
              <p className="text-[10px] text-gray-400 mt-1">{selectedType.description}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Scope</label>
            <select
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value as MultipointNetworkScope })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
            >
              {NETWORK_SCOPES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {form.scope === 'REGIONAL' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Region</label>
              <select
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
              >
                <option value="">Select region...</option>
                {REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          )}

          <p className="text-[10px] text-gray-400 italic">Network creation is free. Connections to the network are priced individually.</p>

          <div className="flex gap-2">
            <button
              onClick={editingId ? handleSaveEdit : handleAdd}
              disabled={!form.name || (form.scope === 'REGIONAL' && !form.region)}
              className="px-4 py-1.5 text-xs font-medium bg-equinix-green text-white rounded-md hover:bg-green-600 disabled:opacity-50"
            >
              {editingId ? 'Save Changes' : 'Add Network'}
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

      {/* Existing networks */}
      <div className="space-y-2 px-4">
        {networks.length === 0 && !showForm && (
          <p className="text-center text-gray-400 text-sm py-4">No multipoint networks</p>
        )}
        {networks.map((network) => {
          const color = NETWORK_NODE_COLORS[network.type] ?? '#0067B8';
          const typeLabel = SERVICE_TYPE_LABELS[network.type] ?? network.type;
          const scopeLabel = NETWORK_SCOPES.find((s) => s.value === network.scope)?.label ?? network.scope;
          return (
            <div key={network.id} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <p className="text-sm font-medium text-equinix-navy truncate">{network.name}</p>
                  </div>
                  <p className="text-xs text-gray-500 truncate ml-4.5">
                    {typeLabel} · {scopeLabel}
                    {network.region ? ` · ${network.region}` : ''}
                  </p>
                  <p className="text-[10px] text-gray-400 ml-4.5 italic">Network is free</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  <button
                    onClick={() => handleEdit(network)}
                    className="text-gray-400 hover:text-equinix-green transition-colors p-1"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <ConfirmDeleteButton
                    onDelete={() => removeNetwork(network.id)}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
