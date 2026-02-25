import { useState, useCallback, useEffect } from 'react';
import { useConfigStore } from '@/store/configStore';
import { getDefaultPricing, setDefaultPricing } from '@/data/defaultPricing';
import { saveCachedOptions, loadCachedOptions } from '@/api/cache';
import type { DeviceType, SoftwarePackage, Metro } from '@/types/equinix';
import { PORT_SPEEDS, PORT_PRODUCTS, BANDWIDTH_OPTIONS } from '@/constants/serviceDefaults';

// ── Types ────────────────────────────────────────────────────────────────────

interface PriceEntry {
  mrc: number;
  nrc: number;
}

type PricingSection = 'fabricPorts' | 'virtualConnections' | 'cloudRouter' | 'networkEdge';

// ── Main Component ───────────────────────────────────────────────────────────

type AdminSection = 'metros' | 'pricing' | 'deviceTypes';

export function DataEditor() {
  const [activeSection, setActiveSection] = useState<AdminSection>('metros');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const tabs: { id: AdminSection; label: string }[] = [
    { id: 'metros', label: 'Metros' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'deviceTypes', label: 'Device Types' },
  ];

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <header className="bg-equinix-black text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold">Equinix</h1>
          <span className="text-xs text-gray-400">Data Editor</span>
        </div>
        <a
          href="#/"
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          Back to App
        </a>
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-4">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeSection === tab.id
                  ? 'border-equinix-green text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Save status banner */}
      {saveStatus === 'saved' && (
        <div className="bg-green-50 border-b border-green-200 px-4 py-2 text-sm text-green-700">
          Changes saved successfully.
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700">
          Failed to save changes. Try again.
        </div>
      )}

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4">
        {activeSection === 'metros' && (
          <MetroEditor saveStatus={saveStatus} setSaveStatus={setSaveStatus} />
        )}
        {activeSection === 'pricing' && (
          <PricingEditor saveStatus={saveStatus} setSaveStatus={setSaveStatus} />
        )}
        {activeSection === 'deviceTypes' && (
          <DeviceTypeEditor saveStatus={saveStatus} setSaveStatus={setSaveStatus} />
        )}
      </div>
    </div>
  );
}

// ── Metro Editor ─────────────────────────────────────────────────────────────

const REGION_COLORS: Record<string, string> = {
  AMER: 'bg-blue-50 text-blue-700',
  EMEA: 'bg-amber-50 text-amber-700',
  APAC: 'bg-green-50 text-green-700',
};

function MetroEditor({
  saveStatus,
  setSaveStatus,
}: {
  saveStatus: string;
  setSaveStatus: (s: 'idle' | 'saving' | 'saved' | 'error') => void;
}) {
  const storeMetros = useConfigStore((s) => s.cache.metros);
  const setMetros = useConfigStore((s) => s.setMetros);
  const [metros, setLocalMetros] = useState<Metro[]>(() => [...storeMetros]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formRegion, setFormRegion] = useState<Metro['region']>('AMER');

  const filtered = search
    ? metros.filter((m) =>
        m.code.toLowerCase().includes(search.toLowerCase()) ||
        m.name.toLowerCase().includes(search.toLowerCase())
      )
    : metros;

  const regionCounts = metros.reduce((acc, m) => {
    acc[m.region] = (acc[m.region] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const openCreateForm = useCallback(() => {
    setFormCode('');
    setFormName('');
    setFormRegion('AMER');
    setEditingIndex(null);
    setShowForm(true);
  }, []);

  const openEditForm = useCallback((index: number) => {
    const m = metros[index];
    setFormCode(m.code);
    setFormName(m.name);
    setFormRegion(m.region);
    setEditingIndex(index);
    setShowForm(true);
  }, [metros]);

  const handleFormSave = useCallback(() => {
    if (!formCode || !formName) return;
    const metro: Metro = {
      code: formCode.toUpperCase(),
      name: formName,
      region: formRegion,
      connectedMetros: editingIndex !== null ? metros[editingIndex].connectedMetros : [],
    };
    setLocalMetros((prev) => {
      if (editingIndex !== null) {
        const copy = [...prev];
        copy[editingIndex] = metro;
        return copy;
      }
      return [...prev, metro];
    });
    setShowForm(false);
    setEditingIndex(null);
  }, [formCode, formName, formRegion, editingIndex, metros]);

  const handleDelete = useCallback((index: number) => {
    setLocalMetros((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    try {
      setMetros(metros);
      const cached = await loadCachedOptions();
      if (cached) {
        await saveCachedOptions({ ...cached, metros, cachedAt: Date.now() });
      } else {
        const deviceTypes = useConfigStore.getState().cache.deviceTypes;
        const serviceProfiles = useConfigStore.getState().cache.serviceProfiles;
        await saveCachedOptions({
          cachedAt: Date.now(),
          metros,
          deviceTypes,
          serviceProfiles,
          routerPackages: [],
          eiaLocations: [],
        });
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
    }
  }, [metros, setMetros, setSaveStatus]);

  const handleExportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(metros, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'metros.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [metros]);

  const handleImportJSON = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          setLocalMetros(data);
        }
      } catch {
        alert('Invalid JSON file');
      }
    };
    input.click();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Metros</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {metros.length} metros — AMER {regionCounts['AMER'] ?? 0}, EMEA {regionCounts['EMEA'] ?? 0}, APAC {regionCounts['APAC'] ?? 0}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleImportJSON}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Import JSON
          </button>
          <button
            onClick={handleExportJSON}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Export JSON
          </button>
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="px-3 py-1.5 text-xs font-medium text-white bg-equinix-green rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save to App'}
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search metros..."
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-equinix-green"
        />
        <button
          onClick={openCreateForm}
          className="px-3 py-1.5 text-xs font-medium text-white bg-equinix-black rounded-md hover:bg-gray-800"
        >
          + Add Metro
        </button>
      </div>

      {/* Add/edit form */}
      {showForm && (
        <div className="bg-white rounded-lg border-2 border-equinix-green p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">
            {editingIndex !== null ? 'Edit Metro' : 'New Metro'}
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Code</label>
              <input
                type="text"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="DC"
                maxLength={5}
                className="w-full px-3 py-1.5 text-sm font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-equinix-green"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Washington, D.C."
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-equinix-green"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Region</label>
              <select
                value={formRegion}
                onChange={(e) => setFormRegion(e.target.value as Metro['region'])}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-equinix-green"
              >
                <option value="AMER">AMER</option>
                <option value="EMEA">EMEA</option>
                <option value="APAC">APAC</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleFormSave}
              disabled={!formCode || !formName}
              className="px-4 py-2 text-sm font-medium text-white bg-equinix-black rounded-md hover:bg-gray-800 disabled:opacity-50"
            >
              {editingIndex !== null ? 'Update' : 'Add Metro'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingIndex(null); }}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Metro list */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2 font-medium text-gray-700 w-20">Code</th>
              <th className="text-left px-4 py-2 font-medium text-gray-700">Name</th>
              <th className="text-left px-4 py-2 font-medium text-gray-700 w-24">Region</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {filtered
              .sort((a, b) => a.region.localeCompare(b.region) || a.code.localeCompare(b.code))
              .map((metro) => {
                const origIndex = metros.indexOf(metro);
                return (
                  <tr key={metro.code} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-1.5 font-mono font-medium text-gray-900">{metro.code}</td>
                    <td className="px-4 py-1.5 text-gray-700">{metro.name}</td>
                    <td className="px-4 py-1.5">
                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${REGION_COLORS[metro.region] ?? 'bg-gray-50 text-gray-700'}`}>
                        {metro.region}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => openEditForm(origIndex)}
                          className="p-1 text-gray-300 hover:text-equinix-green transition-colors"
                          title="Edit"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(origIndex)}
                          className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                  {search ? 'No metros match your search.' : 'No metros loaded. Add one above or import a JSON file.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Pricing Editor ───────────────────────────────────────────────────────────

function PricingEditor({
  saveStatus,
  setSaveStatus,
}: {
  saveStatus: string;
  setSaveStatus: (s: 'idle' | 'saving' | 'saved' | 'error') => void;
}) {
  const [pricingData, setPricingData] = useState(() => {
    const current = getDefaultPricing();
    return {
      fabricPorts: { ...current?.fabricPorts } as Record<string, PriceEntry>,
      virtualConnections: { ...current?.virtualConnections } as Record<string, PriceEntry>,
      cloudRouter: { ...current?.cloudRouter } as Record<string, PriceEntry>,
      networkEdge: { ...current?.networkEdge } as Record<string, PriceEntry>,
    };
  });

  const [activeTab, setActiveTab] = useState<PricingSection>('fabricPorts');
  const [newNEKey, setNewNEKey] = useState('');

  const updatePrice = useCallback((section: PricingSection, key: string, field: 'mrc' | 'nrc', value: number) => {
    setPricingData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: { ...prev[section][key], [field]: value },
      },
    }));
  }, []);

  const deletePrice = useCallback((section: PricingSection, key: string) => {
    setPricingData((prev) => {
      const updated = { ...prev[section] };
      delete updated[key];
      return { ...prev, [section]: updated };
    });
  }, []);

  const addPrice = useCallback((section: PricingSection, key: string) => {
    if (!key) return;
    setPricingData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: { mrc: 0, nrc: 0 },
      },
    }));
  }, []);

  // Ensure all standard port and VC keys exist
  useEffect(() => {
    setPricingData((prev) => {
      const ports = { ...prev.fabricPorts };
      for (const speed of PORT_SPEEDS) {
        for (const prod of PORT_PRODUCTS) {
          const key = `${speed}_${prod.value}`;
          if (!ports[key]) ports[key] = { mrc: 0, nrc: 0 };
        }
      }
      const vcs = { ...prev.virtualConnections };
      for (const bw of BANDWIDTH_OPTIONS) {
        const key = String(bw);
        if (!vcs[key]) vcs[key] = { mrc: 0, nrc: 0 };
      }
      const fcr = { ...prev.cloudRouter };
      for (const pkg of ['LAB', 'BASIC', 'STANDARD', 'ADVANCED', 'PREMIUM']) {
        if (!fcr[pkg]) fcr[pkg] = { mrc: 0, nrc: 0 };
      }
      return { ...prev, fabricPorts: ports, virtualConnections: vcs, cloudRouter: fcr };
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    try {
      setDefaultPricing(pricingData);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
    }
  }, [pricingData, setSaveStatus]);

  const handleExportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(pricingData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pricing.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [pricingData]);

  const handleImportJSON = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        setPricingData({
          fabricPorts: data.fabricPorts ?? {},
          virtualConnections: data.virtualConnections ?? {},
          cloudRouter: data.cloudRouter ?? {},
          networkEdge: data.networkEdge ?? {},
        });
      } catch {
        alert('Invalid JSON file');
      }
    };
    input.click();
  }, []);

  const tabs: { id: PricingSection; label: string }[] = [
    { id: 'fabricPorts', label: 'Fabric Ports' },
    { id: 'virtualConnections', label: 'Virtual Connections' },
    { id: 'cloudRouter', label: 'Cloud Router' },
    { id: 'networkEdge', label: 'Network Edge' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Pricing Data</h2>
        <div className="flex gap-2">
          <button
            onClick={handleImportJSON}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Import JSON
          </button>
          <button
            onClick={handleExportJSON}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Export JSON
          </button>
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="px-3 py-1.5 text-xs font-medium text-white bg-equinix-green rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save to App'}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Edit pricing values below. "Save to App" applies changes to the current session.
        Use Export/Import to persist pricing across sessions.
      </p>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Pricing table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2 font-medium text-gray-700">Key</th>
              <th className="text-right px-4 py-2 font-medium text-gray-700 w-36">MRC ($)</th>
              <th className="text-right px-4 py-2 font-medium text-gray-700 w-36">NRC ($)</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(pricingData[activeTab])
              .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
              .map(([key, entry]) => (
              <PriceRow
                key={key}
                label={formatPriceKey(activeTab, key)}
                mrc={entry.mrc}
                nrc={entry.nrc}
                onMrcChange={(v) => updatePrice(activeTab, key, 'mrc', v)}
                onNrcChange={(v) => updatePrice(activeTab, key, 'nrc', v)}
                onDelete={() => deletePrice(activeTab, key)}
              />
            ))}
            {Object.keys(pricingData[activeTab]).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No pricing data. Add entries below or import a JSON file.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add custom entry (for NE or any section) */}
      {activeTab === 'networkEdge' && (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={newNEKey}
            onChange={(e) => setNewNEKey(e.target.value)}
            placeholder="e.g. CSR1000V_IPBASE_12"
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-equinix-green"
          />
          <button
            onClick={() => { addPrice('networkEdge', newNEKey); setNewNEKey(''); }}
            disabled={!newNEKey}
            className="px-3 py-1.5 text-xs font-medium text-white bg-equinix-black rounded-md hover:bg-gray-800 disabled:opacity-50"
          >
            Add Entry
          </button>
        </div>
      )}
    </div>
  );
}

function PriceRow({
  label,
  mrc,
  nrc,
  onMrcChange,
  onNrcChange,
  onDelete,
}: {
  label: string;
  mrc: number;
  nrc: number;
  onMrcChange: (v: number) => void;
  onNrcChange: (v: number) => void;
  onDelete: () => void;
}) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-2 text-gray-800 font-mono text-xs">{label}</td>
      <td className="px-4 py-1.5">
        <input
          type="number"
          value={mrc || ''}
          onChange={(e) => onMrcChange(Number(e.target.value) || 0)}
          placeholder="0"
          className="w-full text-right px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-equinix-green"
        />
      </td>
      <td className="px-4 py-1.5">
        <input
          type="number"
          value={nrc || ''}
          onChange={(e) => onNrcChange(Number(e.target.value) || 0)}
          placeholder="0"
          className="w-full text-right px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-equinix-green"
        />
      </td>
      <td className="px-2 py-1.5 text-center">
        <button
          onClick={onDelete}
          className="text-gray-300 hover:text-red-500 transition-colors"
          title="Remove"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </td>
    </tr>
  );
}

function formatPriceKey(section: PricingSection, key: string): string {
  if (section === 'fabricPorts') {
    // "10G_STANDARD" → "10G Standard"
    const [speed, ...rest] = key.split('_');
    const product = rest.join('_').replace(/_/g, ' ');
    return `${speed} ${product.charAt(0)}${product.slice(1).toLowerCase()}`;
  }
  if (section === 'virtualConnections') {
    const bw = Number(key);
    if (bw >= 1000) return `${bw / 1000} Gbps`;
    return `${bw} Mbps`;
  }
  if (section === 'cloudRouter') {
    return key.charAt(0) + key.slice(1).toLowerCase();
  }
  // networkEdge: "CSR1000V_IPBASE_12" → "CSR1000V / IPBASE / 12mo"
  const parts = key.split('_');
  if (parts.length >= 3) {
    const term = parts.pop();
    const pkg = parts.pop();
    const device = parts.join('_');
    return `${device} / ${pkg} / ${term}mo`;
  }
  return key;
}

// ── Device Type Editor ───────────────────────────────────────────────────────

function DeviceTypeEditor({
  saveStatus,
  setSaveStatus,
}: {
  saveStatus: string;
  setSaveStatus: (s: 'idle' | 'saving' | 'saved' | 'error') => void;
}) {
  const storeDeviceTypes = useConfigStore((s) => s.cache.deviceTypes);
  const setDeviceTypes = useConfigStore((s) => s.setDeviceTypes);
  const [deviceTypes, setLocalDeviceTypes] = useState<DeviceType[]>(() => [...storeDeviceTypes]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Blank device type for the form
  const blankDevice: DeviceType = {
    deviceTypeCode: '',
    name: '',
    vendor: '',
    category: 'ROUTER',
    availableMetros: [],
    softwarePackages: [],
    coreCounts: [2, 4, 8],
  };
  const [formData, setFormData] = useState<DeviceType>({ ...blankDevice });
  const [packagesText, setPackagesText] = useState('');
  const [metrosText, setMetrosText] = useState('');

  const openCreateForm = useCallback(() => {
    setFormData({ ...blankDevice });
    setPackagesText('');
    setMetrosText('');
    setEditingIndex(null);
    setShowForm(true);
  }, []);

  const openEditForm = useCallback((index: number) => {
    const dt = deviceTypes[index];
    setFormData({ ...dt });
    setPackagesText(dt.softwarePackages.map((p) => `${p.code}:${p.name}`).join('\n'));
    setMetrosText(dt.availableMetros.join(', '));
    setEditingIndex(index);
    setShowForm(true);
  }, [deviceTypes]);

  const handleFormSave = useCallback(() => {
    // Parse software packages from text
    const packages: SoftwarePackage[] = packagesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [code, ...rest] = line.split(':');
        return { code: code.trim(), name: rest.join(':').trim() || code.trim() };
      });

    // Parse metros from text
    const metros = metrosText
      .split(/[,\s]+/)
      .map((m) => m.trim().toUpperCase())
      .filter(Boolean);

    const updated: DeviceType = {
      ...formData,
      softwarePackages: packages,
      availableMetros: metros,
    };

    setLocalDeviceTypes((prev) => {
      if (editingIndex !== null) {
        const copy = [...prev];
        copy[editingIndex] = updated;
        return copy;
      }
      return [...prev, updated];
    });

    setShowForm(false);
    setEditingIndex(null);
  }, [formData, packagesText, metrosText, editingIndex]);

  const handleDelete = useCallback((index: number) => {
    setLocalDeviceTypes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    try {
      // Update Zustand store
      setDeviceTypes(deviceTypes);

      // Update IndexedDB cache
      const cached = await loadCachedOptions();
      if (cached) {
        await saveCachedOptions({ ...cached, deviceTypes, cachedAt: Date.now() });
      } else {
        const metros = useConfigStore.getState().cache.metros;
        const serviceProfiles = useConfigStore.getState().cache.serviceProfiles;
        await saveCachedOptions({
          cachedAt: Date.now(),
          metros,
          deviceTypes,
          serviceProfiles,
          routerPackages: [],
          eiaLocations: [],
        });
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
    }
  }, [deviceTypes, setDeviceTypes, setSaveStatus]);

  const handleExportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(deviceTypes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deviceTypes.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [deviceTypes]);

  const handleImportJSON = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          setLocalDeviceTypes(data);
        }
      } catch {
        alert('Invalid JSON file');
      }
    };
    input.click();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Network Edge Device Types</h2>
          <p className="text-xs text-gray-500 mt-0.5">{deviceTypes.length} device types loaded</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleImportJSON}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Import JSON
          </button>
          <button
            onClick={handleExportJSON}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Export JSON
          </button>
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="px-3 py-1.5 text-xs font-medium text-white bg-equinix-green rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save to App'}
          </button>
        </div>
      </div>

      <button
        onClick={openCreateForm}
        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-equinix-green hover:text-equinix-green transition-colors"
      >
        + Add Device Type
      </button>

      {/* Form dialog */}
      {showForm && (
        <DeviceTypeForm
          formData={formData}
          setFormData={setFormData}
          packagesText={packagesText}
          setPackagesText={setPackagesText}
          metrosText={metrosText}
          setMetrosText={setMetrosText}
          isEditing={editingIndex !== null}
          onSave={handleFormSave}
          onCancel={() => { setShowForm(false); setEditingIndex(null); }}
        />
      )}

      {/* Device type list */}
      <div className="space-y-2">
        {deviceTypes.map((dt, i) => (
          <div
            key={`${dt.deviceTypeCode}-${i}`}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-gray-900">{dt.deviceTypeCode}</span>
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                    dt.category === 'ROUTER' ? 'bg-blue-50 text-blue-700' :
                    dt.category === 'FIREWALL' ? 'bg-red-50 text-red-700' :
                    dt.category === 'SDWAN' ? 'bg-purple-50 text-purple-700' :
                    'bg-gray-50 text-gray-700'
                  }`}>{dt.category}</span>
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{dt.name}</p>
                <p className="text-xs text-gray-400">{dt.vendor}</p>
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <span>{dt.softwarePackages.length} package{dt.softwarePackages.length !== 1 ? 's' : ''}</span>
                  <span>{dt.availableMetros.length} metro{dt.availableMetros.length !== 1 ? 's' : ''}</span>
                  <span>Cores: {dt.coreCounts.join(', ')}</span>
                </div>
              </div>
              <div className="flex gap-1 ml-3">
                <button
                  onClick={() => openEditForm(i)}
                  className="p-1.5 text-gray-400 hover:text-equinix-green transition-colors"
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(i)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}

        {deviceTypes.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            No device types loaded. Add one above or import a JSON file.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Device Type Form ─────────────────────────────────────────────────────────

function DeviceTypeForm({
  formData,
  setFormData,
  packagesText,
  setPackagesText,
  metrosText,
  setMetrosText,
  isEditing,
  onSave,
  onCancel,
}: {
  formData: DeviceType;
  setFormData: (d: DeviceType) => void;
  packagesText: string;
  setPackagesText: (t: string) => void;
  metrosText: string;
  setMetrosText: (t: string) => void;
  isEditing: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="bg-white rounded-lg border-2 border-equinix-green p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">
        {isEditing ? 'Edit Device Type' : 'New Device Type'}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Device Type Code</label>
          <input
            type="text"
            value={formData.deviceTypeCode}
            onChange={(e) => setFormData({ ...formData, deviceTypeCode: e.target.value })}
            placeholder="e.g. CSR1000V"
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-equinix-green"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Cisco CSR 1000V"
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-equinix-green"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Vendor</label>
          <input
            type="text"
            value={formData.vendor}
            onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
            placeholder="e.g. Cisco"
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-equinix-green"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as DeviceType['category'] })}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-equinix-green"
          >
            <option value="ROUTER">Router</option>
            <option value="FIREWALL">Firewall</option>
            <option value="SDWAN">SD-WAN</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Core Counts (comma-separated)</label>
        <input
          type="text"
          value={formData.coreCounts.join(', ')}
          onChange={(e) => setFormData({
            ...formData,
            coreCounts: e.target.value.split(',').map((s) => Number(s.trim())).filter((n) => n > 0),
          })}
          placeholder="2, 4, 8, 16"
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-equinix-green"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Software Packages (one per line, format: CODE:Name)
        </label>
        <textarea
          value={packagesText}
          onChange={(e) => setPackagesText(e.target.value)}
          placeholder={'IPBASE:IP Base\nAPPX:AppX\nSECURITY:Security'}
          rows={4}
          className="w-full px-3 py-1.5 text-sm font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-equinix-green"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Available Metros (comma-separated codes, leave empty for all)
        </label>
        <input
          type="text"
          value={metrosText}
          onChange={(e) => setMetrosText(e.target.value)}
          placeholder="DC, SV, NY, DA, CH"
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-equinix-green"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={!formData.deviceTypeCode || !formData.name}
          className="px-4 py-2 text-sm font-medium text-white bg-equinix-black rounded-md hover:bg-gray-800 disabled:opacity-50"
        >
          {isEditing ? 'Update' : 'Add Device Type'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
