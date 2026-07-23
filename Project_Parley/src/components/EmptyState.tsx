type Props = { title: string; hint?: string; action?: React.ReactNode };

export default function EmptyState({ title, hint, action }: Props) {
  return (
    <div className="card flex flex-col items-center gap-3 p-12 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      {hint && <p className="max-w-md text-sm text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
