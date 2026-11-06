import type { MarketItem, MarketPoint } from "../types";

const price = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function Sparkline({ points, label }: { points?: MarketPoint[]; label: string }) {
  const usable = points?.filter(point => Number.isFinite(point.value) && point.value > 0) ?? [];
  if (usable.length < 2) return null;
  const min = Math.min(...usable.map(point => point.value)), max = Math.max(...usable.map(point => point.value));
  const y = (value: number) => max === min ? 25 : 45 - (value - min) * 40 / (max - min);
  const path = usable.map((point, index) => `${index ? "L" : "M"}${(5 + index * 270 / (usable.length - 1)).toFixed(2)},${y(point.value).toFixed(2)}`).join(" ");
  return <svg className="receipt-sparkline" viewBox="0 0 280 50" role="img" aria-label={label}>
    <title>{label}: ${price(usable[0].value)} to ${price(usable.at(-1)!.value)}</title>
    <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    <circle cx="275" cy={y(usable.at(-1)!.value)} r="2.5" fill="currentColor" />
  </svg>;
}

function Performance({ item, period, change, history }: { item: MarketItem; period: "DAY" | "WEEK"; change: number | null | undefined; history?: MarketPoint[] }) {
  const valid = change != null && Number.isFinite(change) && change > -100 && item.value != null;
  const rounded = valid ? Math.round(change * 100) / 100 : 0;
  const direction = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  const points = valid ? item.value! * change / (100 + change) : null;
  return <div className="receipt-stock-period" data-period={period.toLowerCase()}>
    <div className="receipt-stock-performance">
      <span className="receipt-stock-period-name">{period}</span>
      {valid ? <>
        <strong className="receipt-stock-return" data-direction={direction} aria-label={`${direction === "flat" ? "Unchanged" : direction === "up" ? "Up" : "Down"} ${Math.abs(rounded).toFixed(2)} percent`}>
          <span aria-hidden="true">{direction === "up" ? "▲" : direction === "down" ? "▼" : "―"}</span>{" "}{Math.abs(rounded).toFixed(2)}%
        </strong>
        <span className="receipt-stock-dollars">{points! < -0.005 ? "−" : points! > 0.005 ? "+" : ""}${price(Math.abs(points!))}</span>
      </> : <span className="receipt-stock-unavailable">Unavailable</span>}
    </div>
    <Sparkline points={history} label={`${item.symbol} ${period === "DAY" ? "1D" : "1W"} price trend`} />
  </div>;
}

export function MarketSnapshot({ items }: { items: MarketItem[] }) {
  if (!items.length) return <p className="receipt-empty">No tracked stocks selected.</p>;
  return <div className="receipt-stocks">{items.map(item => <section className="receipt-stock" aria-label={`${item.symbol} performance`} key={item.symbol}>
    <div className="receipt-stock-heading">
      <strong className="receipt-stock-symbol">{item.symbol}</strong>
      {item.value == null ? <span className="receipt-stock-unavailable">Unavailable</span> : <strong className="receipt-stock-price">${price(item.value)}</strong>}
    </div>
    {item.value != null && <div className="receipt-stock-history">
      <Performance item={item} period="DAY" change={item.change} history={item.dayHistory} />
      <Performance item={item} period="WEEK" change={item.weekChange} history={item.weekHistory} />
    </div>}
  </section>)}</div>;
}
