/** Skeleton block. Always shaped like the content it replaces. */
export function Skeleton({
  h = 20,
  w = '100%',
  radius = 8,
  className = '',
}: {
  h?: number | string;
  w?: number | string;
  radius?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`bg-line-3 ${className}`}
      style={{ height: h, width: w, borderRadius: radius }}
    />
  );
}
