import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata = {
  title: "SafeGate — Authorization Console",
  description: "Cryptographic W3C VC/DID delivery authorization system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="layout-container">
          <Sidebar />
          <main className="main-content">
            <header className="main-header">
              <div className="header-left">
                <h1>SafeGate Control Console</h1>
                <p>Cryptographic W3C VC/DID Delivery Authorizations</p>
              </div>
              <div className="header-right">
                <div className="status-pill">
                  <span className="dot" style={{ width: 6, height: 6 }} />
                  Registry Node Active
                </div>
              </div>
            </header>
            <div className="page-wrapper">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
