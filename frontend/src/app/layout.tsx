import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { OutletProvider } from '@/context/OutletContext';
import { PWAProvider } from '@/context/PWAContext';
import OfflineBanner from '@/components/common/OfflineBanner';
import PWAInstallBanner from '@/components/common/PWAInstallBanner';

export const metadata: Metadata = {
  title: 'CB Hotel Management | Enterprise Hospitality ERP',
  description: 'CB Hotel Management system with multi-outlet operations.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-512.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CB Hotel Management',
  },
};

export const viewport: Viewport = {
  themeColor: '#F5F3EE',
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
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="bg-[#F5F3EE] text-[#1C1C1C] min-h-screen antialiased selection:bg-[#F1E4C5] selection:text-[#B8862D]">
        <PWAProvider>
          <AuthProvider>
            <OutletProvider>
              <OfflineBanner />
              <PWAInstallBanner />
              {children}
            </OutletProvider>
          </AuthProvider>
        </PWAProvider>
      </body>
    </html>
  );
}
