import Link from "next/link";

function HeroGraphVisual() {
  return (
    <svg viewBox="0 0 560 360" className="home-hero-visual" aria-hidden="true">
      <defs>
        <linearGradient id="heroLine" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--home-hero-line-start)" />
          <stop offset="100%" stopColor="var(--home-hero-line-end)" />
        </linearGradient>
      </defs>

      <rect x="24" y="24" width="512" height="312" rx="34" className="home-hero-visual-bg" />

      {[88, 148, 208, 268].map((y) => (
        <line
          key={`grid-y-${y}`}
          x1="64"
          y1={y}
          x2="500"
          y2={y}
          className="home-hero-grid-line"
        />
      ))}
      {[116, 192, 268, 344, 420].map((x) => (
        <line
          key={`grid-x-${x}`}
          x1={x}
          y1="64"
          x2={x}
          y2="296"
          className="home-hero-grid-line"
        />
      ))}

      <line x1="64" y1="296" x2="500" y2="296" className="home-hero-axis-line" />
      <line x1="64" y1="64" x2="64" y2="296" className="home-hero-axis-line" />

      <path
        d="M64 296 L112 262 L164 244 L210 226 L260 196 L310 182 L360 146 L412 120 L458 104 L500 82"
        className="home-hero-area"
      />
      <path
        d="M64 296 L112 262 L164 244 L210 226 L260 196 L310 182 L360 146 L412 120 L458 104 L500 82"
        className="home-hero-line"
      />

      {[
        [112, 262],
        [164, 244],
        [210, 226],
        [260, 196],
        [310, 182],
        [360, 146],
        [412, 120],
        [458, 104],
      ].map(([x, y]) => (
        <circle key={`hero-dot-${x}`} cx={x} cy={y} r="8" className="home-hero-dot" />
      ))}

      <circle cx="360" cy="146" r="11" className="home-hero-dot-active" />
      <circle cx="360" cy="146" r="20" className="home-hero-dot-pulse" />

      <g className="home-hero-floating-bars">
        <rect x="430" y="180" width="16" height="66" rx="8" />
        <rect x="454" y="156" width="16" height="90" rx="8" />
        <rect x="478" y="132" width="16" height="114" rx="8" />
      </g>
    </svg>
  );
}

function GraphLabCardVisual() {
  return (
    <svg viewBox="0 0 320 210" className="home-link-visual" aria-hidden="true">
      <defs>
        <linearGradient id="homeCardBlue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--home-card-blue-start)" />
          <stop offset="100%" stopColor="var(--home-card-blue-end)" />
        </linearGradient>
      </defs>
      <rect x="18" y="18" width="284" height="174" rx="28" fill="url(#homeCardBlue)" opacity="0.95" />
      <line x1="48" y1="160" x2="270" y2="160" stroke="var(--home-visual-axis)" strokeWidth="4" strokeLinecap="round" />
      <line x1="48" y1="46" x2="48" y2="160" stroke="var(--home-visual-axis)" strokeWidth="4" strokeLinecap="round" />
      <path
        d="M58 146 L102 118 L140 124 L188 86 L232 94 L264 58"
        fill="none"
        stroke="var(--home-visual-accent)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[58, 102, 140, 188, 232, 264].map((x, index) => (
        <circle
          key={`dot-${x}`}
          cx={x}
          cy={[146, 118, 124, 86, 94, 58][index]}
          r="8.5"
          fill="var(--home-visual-surface)"
          stroke="var(--home-visual-dot-stroke)"
          strokeWidth="4"
        />
      ))}
      <rect x="192" y="36" width="78" height="34" rx="17" fill="var(--home-visual-axis)" />
      <text
        x="231"
        y="58"
        textAnchor="middle"
        fill="var(--home-visual-surface)"
        fontSize="18"
        fontWeight="800"
        className="home-link-visual-text"
      >
        LAB
      </text>
    </svg>
  );
}

function JamoviCardVisual() {
  return (
    <svg viewBox="0 0 320 210" className="home-link-visual" aria-hidden="true">
      <defs>
        <linearGradient id="homeCardGreen" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--home-card-green-start)" />
          <stop offset="100%" stopColor="var(--home-card-green-end)" />
        </linearGradient>
      </defs>
      <rect x="18" y="18" width="284" height="174" rx="28" fill="url(#homeCardGreen)" opacity="0.96" />
      <rect x="48" y="46" width="224" height="118" rx="22" fill="var(--home-visual-surface)" opacity="0.94" />
      <rect x="62" y="62" width="104" height="12" rx="6" fill="var(--home-card-green-end)" />
      <rect x="62" y="88" width="84" height="12" rx="6" fill="var(--home-card-green-soft)" />
      <rect x="62" y="114" width="92" height="12" rx="6" fill="var(--home-card-green-soft)" />
      <rect x="188" y="72" width="18" height="64" rx="9" fill="var(--home-card-green-strong)" />
      <rect x="214" y="96" width="18" height="40" rx="9" fill="var(--home-card-green-mid)" />
      <rect x="240" y="82" width="18" height="54" rx="9" fill="var(--home-card-green-end)" />
      <circle cx="90" cy="146" r="10" fill="var(--home-card-green-strong)" opacity="0.18" />
      <circle cx="120" cy="146" r="10" fill="var(--home-card-green-strong)" opacity="0.18" />
      <circle cx="150" cy="146" r="10" fill="var(--home-card-green-strong)" opacity="0.18" />
      <text
        x="160"
        y="184"
        textAnchor="middle"
        fill="var(--home-card-green-text)"
        fontSize="18"
        fontWeight="800"
        className="home-link-visual-text"
      >
        jamovi
      </text>
    </svg>
  );
}

function ProcessCardVisual() {
  return (
    <svg viewBox="0 0 320 210" className="home-link-visual" aria-hidden="true">
      <defs>
        <linearGradient id="homeCardPeach" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--home-card-peach-start)" />
          <stop offset="100%" stopColor="var(--home-card-peach-end)" />
        </linearGradient>
      </defs>
      <rect x="18" y="18" width="284" height="174" rx="28" fill="url(#homeCardPeach)" opacity="0.96" />
      <circle cx="90" cy="108" r="34" fill="var(--home-visual-surface)" opacity="0.92" />
      <circle cx="90" cy="108" r="16" fill="var(--home-hero-line-end)" opacity="0.88" />
      <path d="M144 72 H248" stroke="var(--home-card-peach-strong)" strokeWidth="8" strokeLinecap="round" />
      <path d="M144 108 H224" stroke="var(--home-card-peach-strong)" strokeWidth="8" strokeLinecap="round" />
      <path d="M144 144 H258" stroke="var(--home-card-peach-strong)" strokeWidth="8" strokeLinecap="round" />
      <circle cx="266" cy="72" r="8" fill="var(--home-card-peach-strong)" />
      <circle cx="234" cy="108" r="8" fill="var(--home-card-peach-strong)" />
      <circle cx="276" cy="144" r="8" fill="var(--home-card-peach-strong)" />
      <text
        x="160"
        y="186"
        textAnchor="middle"
        fill="var(--home-card-peach-text)"
        fontSize="18"
        fontWeight="800"
        className="home-link-visual-text"
      >
        PROCESS Macro
      </text>
    </svg>
  );
}

function LinkCard({ href, title, description, external = false, children }) {
  const props = external ? { href, target: "_blank", rel: "noreferrer" } : { href };
  const Component = external ? "a" : Link;

  return (
    <Component className="home-link-card" {...props}>
      <div className="home-link-card-frame">{children}</div>
      <div className="home-link-card-copy">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="home-link-card-footer" aria-hidden="true">
        <span className="home-link-card-arrow">↗</span>
      </div>
    </Component>
  );
}

export default function HomePage() {
  return (
    <main className="home-shell">
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow">HANYANG UNIVERSITY</p>
          <h1>조직연구방법론</h1>
          <p className="home-hero-text">통계분석 수업을 위한 보조자료</p>
        </div>
        <div className="home-hero-stage">
          <HeroGraphVisual />
        </div>
      </section>

      <section className="home-link-grid">
        <LinkCard href="/lab" title="Graph Lab" description="통계·회귀 그래프 실습 페이지">
          <GraphLabCardVisual />
        </LinkCard>
        <LinkCard
          href="https://www.jamovi.org/"
          title="jamovi"
          description="통계 분석용 GUI 소프트웨어"
          external
        >
          <JamoviCardVisual />
        </LinkCard>
        <LinkCard
          href="https://haskayne.ucalgary.ca/CCRAM/resource-hub"
          title="PROCESS Macro"
          description="매개·조절 효과 분석용 확장 도구"
          external
        >
          <ProcessCardVisual />
        </LinkCard>
      </section>

      <footer className="site-footer">
        <p>© 2026 김준성. All rights reserved.</p>
      </footer>
    </main>
  );
}
