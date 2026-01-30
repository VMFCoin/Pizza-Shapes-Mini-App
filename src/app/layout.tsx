import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pizza Shapes - Dots & Boxes on Base',
  description: 'A multiplayer, turn-based strategy game. Capture pizza slices and earn $PIZZA rewards on Base mainnet.',
  openGraph: {
    title: 'Pizza Shapes',
    description: 'Capture pizza slices and earn $PIZZA rewards!',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-game-dark text-white antialiased">
        {children}
      </body>
    </html>
  );
}
