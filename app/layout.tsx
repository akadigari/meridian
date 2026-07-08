import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Meridian - Reform-Turnaround Macro Screen',
  description:
    'Screens every country on the reform-turnaround playbook: inflation falling, honest currency, bond-market trust, fiscal balance, serious reformer. A discretionary heuristic, not financial advice.',
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
                  <small>reform-turnaround screen · sovereign depths observatory</small>
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
          <span className="mono">Ψ</span> public-data macro screen · a heuristic, not financial advice · methodology,
          caveats and the honest backtest live <a href="/methodology">here</a>
        </footer>
      </body>
    </html>
  );
}
