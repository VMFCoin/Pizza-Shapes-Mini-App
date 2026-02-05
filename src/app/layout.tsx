import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Nunito, Lilita_One } from 'next/font/google';
import './globals.css';
import ContextProvider from '@/providers/ContextProvider';

const nunito = Nunito({ 
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
});

const lilitaOne = Lilita_One({ 
  weight: '400',
  subsets: ['latin'],
  variable: '--font-lilita',
  display: 'swap',
});

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
      splashBackgroundColor: "#1C1917"
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
    <html lang="en" className={`${nunito.variable} ${lilitaOne.variable}`}>
      <body className="min-h-screen bg-game-dark text-game-light antialiased flex flex-col items-center px-2 font-sans">
        <ContextProvider cookies={cookies}>
          <div className="w-full max-w-md mx-auto">
            {children}
          </div>
        </ContextProvider>
      </body>
    </html>
  );
}
