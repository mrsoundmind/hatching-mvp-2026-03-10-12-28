import { ChevronDown } from "lucide-react";

export function AppHeader() {
  return (
    <header className="h-16 hatchin-border border-b flex items-center justify-between px-6 hatchin-bg-dark">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-hatchin-blue to-hatchin-green rounded-lg flex items-center justify-center">
            <span className="text-white font-semibold text-sm">H</span>
          </div>
          <span className="font-semibold text-lg hatchin-text">Hatchin</span>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button className="flex items-center gap-2 hatchin-text-muted hover:text-hatchin-text transition-colors">
          <div className="w-6 h-6 rounded-full hatchin-bg-blue flex items-center justify-center">
            <span className="text-white text-xs font-medium">S</span>
          </div>
          <span className="text-sm">Welcome, Shashank</span>
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    </header>
  );
}
