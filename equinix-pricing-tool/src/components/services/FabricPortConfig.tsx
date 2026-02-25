import type { ServiceSelection, FabricPortConfig as FPConfig } from '@/types/config';
import { PORT_SPEEDS, PORT_PRODUCTS } from '@/constants/serviceDefaults';
import { ServiceCard } from './ServiceCard';

interface Props {
  service: ServiceSelection;
  metroCode: string;
  onUpdate: (config: Record<string, unknown>) => void;
  onRemove: () => void;
}

export function FabricPortConfig({ service, onUpdate, onRemove }: Props) {
  const config = service.config as FPConfig;

  const handleTypeChange = (newType: string) => {
    const updates: Record<string, unknown> = { type: newType };
    if (newType === 'REDUNDANT') {
      // Redundant means a pair (Primary + Secondary) — enforce even quantity
      const qty = config.quantity < 2 ? 2 : config.quantity % 2 !== 0 ? config.quantity + 1 : config.quantity;
      updates.quantity = qty;
    } else {
      // Switching to Primary or Secondary — reset to 1
      updates.quantity = 1;
    }
    onUpdate(updates);
  };

  const handleQuantityChange = (raw: string) => {
    let qty = Math.max(1, parseInt(raw) || 1);
    // Redundant ports come in pairs — enforce multiples of 2
    if (config.type === 'REDUNDANT') {
      qty = Math.max(2, qty % 2 !== 0 ? qty + 1 : qty);
    }
    onUpdate({ quantity: Math.min(qty, 10) });
  };

  return (
    <ServiceCard title="Fabric Port" pricing={service.pricing} onRemove={onRemove} quantity={config.quantity}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Speed</label>
          <select
            value={config.speed}
            onChange={(e) => onUpdate({ speed: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
          >
            {PORT_SPEEDS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Port Product</label>
          <select
            value={config.portProduct}
            onChange={(e) => onUpdate({ portProduct: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
          >
            {PORT_PRODUCTS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Redundancy</label>
          <select
            value={config.type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
          >
            <option value="PRIMARY">Primary</option>
            <option value="SECONDARY">Secondary</option>
            <option value="REDUNDANT">Redundant</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Encapsulation</label>
          <select
            value={config.encapsulation}
            onChange={(e) => onUpdate({ encapsulation: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
          >
            <option value="DOT1Q">Dot1q</option>
            <option value="QINQ">QinQ</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
          <input
            type="number"
            min={config.type === 'REDUNDANT' ? 2 : 1}
            max={10}
            step={config.type === 'REDUNDANT' ? 2 : 1}
            value={config.quantity}
            onChange={(e) => handleQuantityChange(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
          />
          {config.type === 'REDUNDANT' && (
            <p className="text-[9px] text-gray-400 mt-0.5">Pairs of 2 (Primary + Secondary)</p>
          )}
        </div>
      </div>
    </ServiceCard>
  );
}
