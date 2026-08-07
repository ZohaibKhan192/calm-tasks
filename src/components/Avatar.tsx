import { initials } from "@/lib/format";

export function Avatar({
  name,
  email,
  url,
  size = 24,
}: {
  name?: string | null | undefined;
  email?: string | null | undefined;
  url?: string | null | undefined;
  size?: number | undefined;
}) {
  const label = name || email || "Unassigned";
  if (url) {
    return (
      <img
        src={url}
        alt={label}
        title={label}
        width={size}
        height={size}
        className="rounded-full border border-border object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      title={label}
      className="inline-flex items-center justify-center rounded-full border border-border bg-surface font-medium text-muted-foreground"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {initials(name, email)}
    </span>
  );
}
