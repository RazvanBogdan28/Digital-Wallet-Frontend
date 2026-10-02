import MoneyOperationSheet from './MoneyOperationSheet';
import { getSession } from '../lib/api';

export default function SendSheet(props) {
  return (
      <MoneyOperationSheet
          key={`transfer:${getSession()?.userId}:${props.wallet.id}`}
          {...props}
          kind="transfer"
      />
  );
}