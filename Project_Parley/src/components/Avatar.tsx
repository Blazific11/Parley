type Props = { name: string; src?: string | null; size?: number; ring?: boolean };

export default function Avatar({ name, src, size = 40, ring = true }: Props) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  if (src) {
    return <img src={src} alt={name} width={size} height={size} className={`rounded-full object-cover ${ring ? "ring-1 ring-line" : ""}`} style={{ width: size, height: size }} />;
  }
  return (
    <div className={`flex items-center justify-center rounded-full bg-surface-2 font-semibold text-accent-from ${ring ? "ring-1 ring-line" : ""}`} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initials}
    </div>
  );
}
