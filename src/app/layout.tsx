import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Hummify - Music Guessing Game',
  description: 'A fun music guessing game where you try to identify songs from short snippets',
  icons: {
    icon: '/hummify-logo.png',
    apple: '/hummify-logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-background text-white min-h-screen`}>
        {children}
      </body>
    </html>
  );
} 