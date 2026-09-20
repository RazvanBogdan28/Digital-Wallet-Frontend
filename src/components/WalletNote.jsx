import Guilloche from './Guilloche';
import { CURRENCY_INFO, formatMoney, splitAmount } from '../lib/format';
import { usePrivacy } from '../lib/privacy';

// A wallet drawn as a banknote: the currency sets the ink, the wallet id seeds the pattern.
export default function WalletNote({ wallet, large = false }) {
  const info = CURRENCY_INFO[wallet.currency];
  const { hidden } = usePrivacy();
  const { whole, cents } = splitAmount(wallet.balance);

  return (
    <article className={`note note-${wallet.currency.toLowerCase()} ${large ? 'note-large' : ''}`.trim()}>
      <Guilloche variant="note" seed={wallet.id} />
      <div className="note-frame" />
      <div className="note-top">
        <span className="note-code">{wallet.currency}</span>
        <span className="note-name">{info.name}</span>
      </div>
      <span className="note-serial">No. {wallet.id}</span>
      <p
        className="note-balance"
        aria-label={hidden ? 'Balance hidden' : `Balance ${formatMoney(wallet.balance, wallet.currency)}`}
      >
        {hidden ? (
          <span className="note-whole">••••</span>
        ) : (
          <>
            {info.before && <span className="note-sym">{info.symbol}</span>}
            <span className="note-whole">{whole}</span>
            <span className="note-cents">.{cents}</span>
            {!info.before && <span className="note-sym note-sym-after">{info.symbol}</span>}
          </>
        )}
      </p>
    </article>
  );
}
