import { CircleAlert } from 'lucide-react';

export default function FormError({ children }) {
  if (!children) return null;
  return (
    <p className="form-error" role="alert">
      <CircleAlert size={16} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
