import type { Metadata, Viewport } from 'next';
import './globals.css';
import { OutletProvider } from '@/context/OutletContext';
import { PWAProvider } from '@/context/PWAContext';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import PWAInstallBanner from '@/components/common/PWAInstallBanner';
import OfflineBanner from '@/components/common/OfflineBanner';

export const metadata: Metadata = {
  title: 'APEX | Multi-Outlet Restaurant ERP & Central Purchase',
  description: 'Enterprise Multi-Outlet Restaurant ERP with Central Purchase Control, Bi-Monthly Closing Engine, and Real-Time Inventory Control.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-512.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'APEX ERP',
  },
};

export const viewport: Viewport = {
  themeColor: '#0c0c0e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="bg-[#0c0c0e] text-[#f5f5f7] min-h-screen flex flex-col antialiased selection:bg-[#d4a437]/30 selection:text-[#f3c969]">
        <PWAProvider>
          <OutletProvider>
            <div className="flex flex-col min-h-screen max-w-7xl mx-auto w-full relative">
              <Header />
              <OfflineBanner />
              <PWAInstallBanner />
              <main className="flex-1 pb-24 md:pb-8 pt-4 px-4 sm:px-6">
                {children}
              </main>
              <BottomNav />
            </div>
          </OutletProvider>
        </PWAProvider>
      </body>
    </html>
  );
}
