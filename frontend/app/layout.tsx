import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata = {
  title: "SafeGate — Dispatcher Authorization Control Hub",
  description: "Secure VC/DID delivery authorization dispatcher console",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="layout-container">
          <Sidebar />
          <main className="main-content">
            <header className="main-header">
              <div className="header-title">
                <h1>SafeGate Control Console</h1>
                <p className="header-subtitle">Cryptographic W3C VC/DID Delivery Authorizations</p>
              </div>
              <div className="connection-badge">
                <span className="status-dot pulse"></span>
                <span>Registry Node Active</span>
              </div>
            </header>
            <div className="page-wrapper">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
