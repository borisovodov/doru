export interface StatusBarProps {
  text: string;
}

export function StatusBar({ text }: StatusBarProps) {
  return (
    <div className="status-bar">
      <span>{text}</span>
    </div>
  );
}
