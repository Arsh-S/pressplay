import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { Header } from '@/components/header';

export const metadata: Metadata = {
  title: 'PRessPlay',
  description: 'Auto-generated demo videos for every pull request',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white">
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
