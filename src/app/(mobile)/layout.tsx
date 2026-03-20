export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mobile-shell">
      <main className="mobile-main">{children}</main>
    </div>
  );
}
