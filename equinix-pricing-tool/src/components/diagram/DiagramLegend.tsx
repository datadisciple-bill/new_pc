export function DiagramLegend() {
  return (
    <div className="absolute bottom-2 left-2 bg-white border border-gray-200 rounded-lg p-3 shadow-sm text-[10px] space-y-1.5 z-10 diagram-legend">
      <p className="font-bold text-xs text-equinix-navy">Legend</p>
      <div className="flex items-center gap-2">
        <div className="w-8 h-0 border-t-2 border-black" />
        <span className="text-gray-600">Inter-metro L2 Connection</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-8 h-0 border-t-2 border-dashed border-black" />
        <span className="text-gray-600">Inter-metro L3 Connection</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-8 h-0 border-t-2 border-equinix-green" />
        <span className="text-gray-600">Intra-metro Connection</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-8 flex flex-col gap-px">
          <div className="h-0 border-t-[1.5px] border-black" />
          <div className="h-0 border-t-[1.5px] border-black" />
        </div>
        <span className="text-gray-600">Redundant Connection</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-8 h-0 border-t-2 border-gray-500" />
        <span className="text-gray-600">Local Site Connection</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-3 bg-equinix-black rounded-sm" />
        <span className="text-gray-600">Equinix Product</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-3 bg-aws rounded-sm" />
        <span className="text-gray-600">Cloud Provider</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-3 bg-gray-200 rounded-sm border border-gray-400" />
        <span className="text-gray-600">Local Site</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[8px] font-bold bg-equinix-red text-white rounded px-1">HA</span>
        <span className="text-gray-600">High Availability Pair</span>
      </div>
    </div>
  );
}
