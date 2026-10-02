import MoneyOperationSheet from './MoneyOperationSheet';
import { getSession } from '../lib/api';

export default function DepositSheet(props) {
  return (
      <MoneyOperationSheet
          key={`deposit:${getSession()?.userId}:${props.wallet.id}`}
          {...props}
          kind="deposit"
      />
  );
}