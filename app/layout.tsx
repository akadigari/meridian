import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Meridian - a living atlas of countries fixing themselves',
  description:
    'A free, auto-updating research tool that watches every country on the reform-turnaround playbook: inflation falling, honest currency, bond-market trust, fiscal balance, serious reformer. Public data plus AI, built for learning, not trading.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href="/" style={{ textDecoration: 'none' }}>
              <div className="brand">
                <span className="trident">Ψ</span>
                <span>
                  MERIDIAN
                  <small>a living atlas of countries fixing themselves · auto-updating · public data + AI</small>
                </span>
              </div>
            </Link>
            <nav className="nav">
              <Link href="/">Screen</Link>
              <Link href="/compare">Compare</Link>
              <Link href="/analyst">AI Analyst</Link>
              <Link href="/methodology">Methodology</Link>
            </nav>
          </div>
        </header>
        <div className="meander" />
        <main className="container">{children}</main>
        <footer className="site-footer">
          <span className="mono">Ψ</span> a free research tool for watching countries fix (or break) themselves · data
          refreshes automatically every week · built for curiosity, not trading, and never financial advice · how it
          works, the jargon glossary, and the honest backtest live <a href="/methodology">here</a>
        </footer>
      </body>
    </html>
  );
}
