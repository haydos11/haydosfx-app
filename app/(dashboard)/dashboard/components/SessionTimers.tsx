"use client";

import { useEffect, useState } from "react";

function getCountdown(targetHour: number) {

  const now = new Date();
  const target = new Date();

  target.setUTCHours(targetHour, 0, 0, 0);

  if (target < now) target.setUTCDate(target.getUTCDate() + 1);

  const diff = target.getTime() - now.getTime();

  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);

  return `${hours}h ${mins}m`;
}

export default function SessionTimers() {

  const [countdown, setCountdown] = useState("");

  useEffect(() => {

    const timer = setInterval(() => {
      setCountdown(getCountdown(13)); // NY open
    }, 1000);

    return () => clearInterval(timer);

  }, []);

  return (
    <div className="bg-zinc-900 p-4 rounded-xl">

      <h2 className="text-lg font-semibold mb-3">Session Timers</h2>

      <div className="space-y-2 text-sm">

        <div>London Open: 08:00 UTC</div>
        <div>New York Open: {countdown}</div>
        <div>Tokyo Open: 00:00 UTC</div>

      </div>

    </div>
  );
}