import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PermitAI — AI building-permit compliance agent',
  description:
    'An AI agent that checks building permit applications against the applicable codes and returns a yes/no decision in seconds — with the exact violations and corrections needed to resubmit. Advisory only; not a permit authority.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
