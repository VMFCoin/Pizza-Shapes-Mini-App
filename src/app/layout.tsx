import type { Metadata } from 'next';
import './globals.css';

// Farcaster Mini App embed metadata
const fcMiniApp = {
  version: "1",
  imageUrl: "https://pizza-shapes-mini-app.vercel.app/og-image.png",
  button: {
    title: "Play Now",
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
  title: 'Pizza Dots - Dots & Boxes on Base',
  description: 'A multiplayer, turn-based strategy game. Capture pizza slices and earn $PIZZA rewards on Base mainnet.',
  metadataBase: new URL('https://pizza-shapes-mini-app.vercel.app'),
  openGraph: {
    title: 'Pizza Dots',
    description: 'Capture pizza slices and earn $PIZZA rewards!',
    images: ['/og-image.png'],
  },
  other: {
    'fc:miniapp': JSON.stringify(fcMiniApp),
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-game-dark text-white antialiased flex flex-col items-center">
        <div className="w-full max-w-lg mx-auto">
          {children}
        </div>
      </body>
    </html>
  );
}
