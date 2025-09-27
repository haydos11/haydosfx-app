export function rangeToStartDate(range: string): string | null {
  const lower = (range || "").toLowerCase();
  const today = new Date();
  const yyyy = today.getFullYear();

  if (lower === "ytd") return `${yyyy}-01-01`;
  if (!lower || lower === "max") return null;

  const m = lower.match(/^(\d+)(m|y)$/);
  if (!m) return null;

  const n = parseInt(m[1], 10);
  const unit = m[2];
  const d = new Date(today);
  if (unit === "y") d.setFullYear(d.getFullYear() - n);
  else d.setMonth(d.getMonth() - n);

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
