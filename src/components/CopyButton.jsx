import { Copy } from 'lucide-react';
import { useToast } from './Toast';

export default function CopyButton({ value, message = 'Copied', iconOnly = false, label = 'Copy wallet number', children }) {
  const toast = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(String(value));
      toast(message);
    } catch {
      toast('Copy failed. Select the number and copy it manually.', 'error');
    }
  }

  return (
    <button
      type="button"
      className={`btn btn-quiet btn-small ${iconOnly ? 'btn-icon' : ''}`.trim()}
      onClick={copy}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
    >
      <Copy size={15} aria-hidden="true" />
      {!iconOnly && children}
    </button>
  );
}
