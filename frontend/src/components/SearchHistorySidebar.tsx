'use client';

import React from 'react';
import { History, MapPin, Clock, ArrowRight } from 'lucide-react';
import { SearchHistoryRecord } from '../lib/api';

interface SearchHistorySidebarProps {
  history: SearchHistoryRecord[];
  onSelectHistory: (lat: number, lng: number) => void;
}

export default function SearchHistorySidebar({ history, onSelectHistory }: SearchHistorySidebarProps) {
  return (
    <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
        <History className="w-5 h-5 text-emerald-400" />
        <h2 className="text-base font-bold text-white">Search History (PostgreSQL)</h2>
      </div>

      {history.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-400 text-xs">
          <Clock className="w-8 h-8 text-gray-600 mb-2 stroke-[1.5]" />
          <p>No recent location searches stored in database yet.</p>
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto max-h-[460px] pr-1">
          {history.map((item) => {
            const dateStr = new Date(item.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={item.id}
                onClick={() => onSelectHistory(item.latitude, item.longitude)}
                className="p-3 rounded-xl bg-gray-900/60 hover:bg-gray-800 border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer group flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-200">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
                    <span>{dateStr}</span>
                    <span>•</span>
                    <span className="text-emerald-400/80 font-medium">{item.resultsCount} restaurants</span>
                  </div>
                </div>

                <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 flex items-center justify-center transition-colors">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
