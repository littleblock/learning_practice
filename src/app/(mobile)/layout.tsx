import { MobileShellHeader } from "@/features/mobile/components/mobile-shell-header";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mobile-shell">
      <MobileShellHeader />
      <main className="mobile-main">{children}</main>
    </div>
  );
}
