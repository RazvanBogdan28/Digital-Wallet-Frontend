import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react';
import Amt from './Amt';
import { formatDay, formatTime } from '../lib/format';

const ICONS = { in: ArrowDownLeft, out: ArrowUpRight, internal: ArrowLeftRight };

export default function Ledger({ rows, empty }) {
  if (!rows.length) return <p className="empty">{empty}</p>;

  return (
    <div className="ledger">
      <div className="ledger-head" aria-hidden="true">
        <span>Date</span>
        <span>Details</span>
        <span>Status</span>
        <span className="right">Amount</span>
      </div>
      <ul className="ledger-list">
        {rows.map((row) => {
          const Icon = ICONS[row.dir];
          return (
            <li key={row.id} className="ledger-row">
              <div className="l-date">
                <span>{formatDay(row.createdAt)}</span>
                <span className="l-time">{formatTime(row.createdAt)}</span>
              </div>
              <div className="l-main">
                <span className={`l-icon l-${row.dir}`}>
                  <Icon size={16} aria-hidden="true" />
                </span>
                <div className="l-text">
                  <p className="l-title">{row.title}</p>
                  <p className="l-detail">{row.detail}</p>
                </div>
              </div>
              <div className="l-status">
                {row.status && <span className={`status status-${row.status.toLowerCase()}`}>{row.status}</span>}
              </div>
              <div className={`l-amount l-${row.dir}`}>
                <Amt value={row.amount} currency={row.currency} signed={row.dir !== 'internal'} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
