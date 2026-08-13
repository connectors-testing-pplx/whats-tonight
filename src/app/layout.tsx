import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProvider } from '@/lib/store/AppStore';
import { BottomNav } from '@/components/BottomNav';

export const metadata: Metadata = {
  title: "What's Tonight?",
  description:
    'Four to six things worth watching tonight, with the ratings and reviews that actually help you decide.',
  applicationName: "What's Tonight?",
  manifest: '/manifest.webmanifest',
  // Lets Papa add it to his home screen and have it open without browser chrome.
  appleWebApp: {
    capable: true,
    title: "What's Tonight?",
    statusBarStyle: 'default',
  },
  // Phone numbers in synopses being auto-linked on iOS looks broken.
  formatDetection: { telephone: false, date: false, address: false, email: false },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Pinch-zoom stays available — disabling it is an accessibility failure,
  // and the 16px input rule already prevents the unwanted auto-zoom.
  maximumScale: 5,
  userScalable: true,
  // Required for env(safe-area-inset-*) to report real values on iPhone.
  viewportFit: 'cover',
  themeColor: '#F6F4F0',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          <div className="pad-nav min-h-dvh">{children}</div>
          <BottomNav />
        </AppProvider>
      </body>
    </html>
  );
}
