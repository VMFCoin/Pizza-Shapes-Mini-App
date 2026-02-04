import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import ContextProvider from '@/providers/ContextProvider';

// Farcaster Mini App embed metadata
const fcMiniApp = {
  version: "1",
  imageUrl: "https://pizza-shapes-mini-app.vercel.app/og.png",
  button: {
    title: "Connect Dots",
    action: {
      type: "launch_frame",
      name: "Pizza Dots",
      url: "https://pizza-shapes-mini-app.vercel.app",
      splashImageUrl: "https://pizza-shapes-mini-app.vercel.app/splash.png",
      splashBackgroundColor: "#1A1A2E"
    }
  }
};

export const metadata: Metadata = {
  title: 'PIZZA DOTS',
  description: 'A competitive arcade puzzle where sharp connections turn dots into pizza slices. No RNG. No mercy. Just clean lines and high scores.',
  metadataBase: new URL('https://pizza-shapes-mini-app.vercel.app'),
  openGraph: {
    title: 'PIZZA DOTS',
    description: 'A competitive arcade puzzle where sharp connections turn dots into pizza slices. No RNG. No mercy. Just clean lines and high scores.',
    images: ['/og.png'],
  },
  other: {
    'fc:miniapp': JSON.stringify(fcMiniApp),
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersObj = await headers();
  const cookies = headersObj.get('cookie');

  return (
    <html lang="en">
      <body className="min-h-screen bg-game-dark text-white antialiased flex flex-col items-center px-2">
        <ContextProvider cookies={cookies}>
          <div className="w-full max-w-md mx-auto">
            {children}
          </div>
        </ContextProvider>
      </body>
    </html>
  );
}
