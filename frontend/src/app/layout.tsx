import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nearby Restaurant Finder | Top 10 Google Maps & NestJS & PostgreSQL',
  description: 'Find top 10 nearest restaurants based on current user location using Google Maps Places API, NestJS, and PostgreSQL.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-emerald-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
