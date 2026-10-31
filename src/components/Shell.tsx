export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="glass card empty">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
