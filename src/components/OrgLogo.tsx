/**
 * Square counterpart to Avatar: workspaces read as things, people as faces, so
 * this stays rounded-square while Avatar is a circle.
 */
export function OrgLogo({
  name,
  url,
  size = 24,
}: {
  name?: string | null | undefined;
  url?: string | null | undefined;
  size?: number | undefined;
}) {
  const label = name || "Workspace";
  if (url) {
    return (
      <img
        src={url}
        alt={label}
        title={label}
        width={size}
        height={size}
        className="shrink-0 rounded-md border border-border bg-background object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      title={label}
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-surface font-semibold text-muted-foreground"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
    >
      {label.trim().charAt(0).toUpperCase()}
    </span>
  );
}
