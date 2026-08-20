import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Permit AI — Building Permit Pre-Check',
  description:
    'Advisory AI pre-check for building permit applications. Instant PASS/FAIL with exact code violations and grounded citations. Not a permit authority.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
