import { Navbar } from "./Navbar";
import { MobileTabBar } from "./MobileTabBar";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="kf-shell relative flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">{children}</main>
      <MobileTabBar />
    </div>
  );
}
