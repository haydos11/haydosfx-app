"use client";

export default function UpcomingEvents() {
  return (
    <div className="bg-zinc-900 p-4 rounded-xl">
      <h2 className="text-lg font-semibold mb-3">
        Upcoming News & Market Events
      </h2>

      <div className="flex flex-col items-center justify-center py-6 text-sm text-slate-400">
        <div className="text-xl mb-2">📰</div>
        <div>Economic calendar integration</div>
        <div className="text-xs text-slate-500 mt-1">
          Coming soon
        </div>
      </div>
    </div>
  );
}