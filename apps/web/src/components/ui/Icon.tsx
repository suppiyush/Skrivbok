/**
 * Material Symbols icon.
 *
 * The designs name icons by their Material Symbols ligature (`dashboard`,
 * `local_fire_department`), so the component takes that name directly rather
 * than wrapping each one in a React component.
 *
 * Decorative by default: an icon beside a text label is announced twice
 * otherwise. Pass `label` when the icon is the only thing carrying meaning.
 */
type Props = {
  name: string;
  size?: number;
  className?: string;
  label?: string;
  style?: React.CSSProperties;
};

export function Icon({ name, size = 20, className = '', label, style }: Props) {
  return (
    <span
      className={`ms ${className}`}
      style={{ fontSize: size, ...style }}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    >
      {name}
    </span>
  );
}
