export function DiagramLegend() {
  return (
    <div className="absolute bottom-2 left-2 bg-white border border-gray-200 rounded-lg p-3 shadow-sm text-[10px] space-y-1.5 z-10">
      <p className="font-bold text-xs text-equinix-navy">Legend</p>
      <div className="flex items-center gap-2">
        <div className="w-8 h-0 border-t-2 border-black" />
        <span className="text-gray-600">Physical / L2 Connection</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-8 h-0 border-t-2 border-dashed border-black" />
        <span className="text-gray-600">Virtual / L3 Connection</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-3 bg-equinix-black rounded-sm" />
        <span className="text-gray-600">Equinix Product</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-3 bg-aws rounded-sm" />
        <span className="text-gray-600">Cloud Provider</span>
      </div>
    </div>
  );
}
