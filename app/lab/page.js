import Link from "next/link";

const LAB_PAGES = [
  { href: "/lab/basic-stats-1-scatter-bridge", eyebrow: "INTRODUCTION", title: "회귀분석의 의미" },
  { href: "/lab/basic-stats-1-regressions", eyebrow: "INTRODUCTION", title: "회귀분석의 종류" },
  { href: "/lab/rotating-regression", eyebrow: "INTRODUCTION", title: "회귀분석과 오차" },
  { href: "/lab/korean-height-distribution", eyebrow: "BASIC STATISTICS", title: "확률 분포" },
  { href: "/lab/sample-mean-distribution", eyebrow: "BASIC STATISTICS", title: "표본평균의 분포" },
  { href: "/lab/t-f-analysis", eyebrow: "BASIC STATISTICS", title: "t검정과 F검정" },
  { href: "/lab/mean-difference-distribution", eyebrow: "BASIC STATISTICS", title: "영가설 분포" },
  { href: "/lab/covariance-correlation-products", eyebrow: "REGRESSION", title: "공분산과 상관계수" },
  { href: "/lab/regression-1-ols-intro", eyebrow: "REGRESSION", title: "최소제곱법과 회귀모형" },
  { href: "/lab/multiple-regression-collinearity", eyebrow: "REGRESSION", title: "다중회귀분석과 공선성" },
  { href: "/lab/mediation-effect", eyebrow: "REGRESSION", title: "매개효과" },
  { href: "/lab/gender-moderation-effect", eyebrow: "REGRESSION", title: "조절효과" },
];

const ORDERED_PAGES = [1, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((index) => LAB_PAGES[index]);

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="lab-index-card-arrow-icon">
      <path d="M7 17L17 7" />
      <path d="M8 7H17V16" />
    </svg>
  );
}

export default function LabIndexPage() {
  return (
    <main className="rr-shell lab-index-shell">
      <header className="rr-header lab-index-header">
        <div>
          <p className="eyebrow">Graph Lab</p>
          <h1>통계 그래프 메인</h1>
        </div>
        <Link className="secondary-button lab-index-home" href="/">
          메인으로
        </Link>
      </header>

      <section className="lab-index-grid">
        {ORDERED_PAGES.map((page, index) => (
          <Link key={page.href} href={page.href} className="lab-index-card">
            <div className="lab-index-card-top">
              <p className="eyebrow">{page.eyebrow}</p>
              <span className="lab-index-card-number">{String(index + 1).padStart(2, "0")}</span>
            </div>
            <div className="lab-index-card-main">
              <h3>{page.title}</h3>
            </div>
            <div className="lab-index-card-footer" aria-hidden="true">
              <span className="lab-index-card-arrow-shell">
                <ArrowIcon />
              </span>
            </div>
          </Link>
        ))}
      </section>

      <footer className="site-footer site-footer-lab">
        <p>© 2026 김준성. All rights reserved.</p>
      </footer>
    </main>
  );
}
