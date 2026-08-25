/**
 * Kartica sa brojem po dizajnu: mono mikro-labela, veliki mono broj, mali
 * podnaslov. Dizajn ima cetiri (watch time, completion, published, errors) —
 * prikazujemo samo one za koje STVARNO imamo podatak, bez izmisljene analitike.
 */
export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border-kf-line bg-kf-surface rounded-kf-card border px-5 py-4.5">
      <div className="kf-micro">{label}</div>
      <div className="mt-3 font-mono text-[27px] leading-none tracking-[-0.03em]">{value}</div>
      {sub && <div className="text-kf-mut mt-1.5 text-[12px]">{sub}</div>}
    </div>
  );
}
