import { MobileShellHeader } from "@/features/mobile/components/mobile-shell-header";
import { MobileBusyProvider } from "@/features/mobile/components/mobile-busy-provider";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MobileBusyProvider>
      <div className="mobile-shell">
        <MobileShellHeader />
        <main className="mobile-main">{children}</main>
      </div>
    </MobileBusyProvider>
  );
}
