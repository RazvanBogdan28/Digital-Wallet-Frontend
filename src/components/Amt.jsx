import { formatMoney } from '../lib/format';
import { usePrivacy } from '../lib/privacy';

// A money value that respects the "hide amounts" toggle.
export default function Amt({ value, currency, signed = false }) {
  const { hidden } = usePrivacy();
  if (hidden) return <span aria-label="Amount hidden">••••</span>;
  return <>{formatMoney(value, currency, { signed })}</>;
}
