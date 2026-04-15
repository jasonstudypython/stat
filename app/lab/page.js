"use client";

import Link from "next/link";

const LAB_PAGES = [
  {
    href: "/lab/basic-stats-1-scatter-bridge",
    eyebrow: "INTRODUCTION",
    title: "공부시간과 성적 분포",
    description: "Y 데이터 / 평균선 / 회귀선 / 예측값",
    accent: "is-lilac",
  },
  {
    href: "/lab/basic-stats-1-regressions",
    eyebrow: "INTRODUCTION",
    title: "회귀분석의 종류",
    description: "단순 / 다중 / 로지스틱 / 다항 / 포아송 / 지수",
    accent: "is-blue",
  },
  {
    href: "/lab/rotating-regression",
    eyebrow: "INTRODUCTION",
    title: "회귀선 회전과 오차",
    description: "기울기 변화 / RSS / 접선 기울기",
    accent: "is-coral",
  },
  {
    href: "/lab/korean-height-distribution",
    eyebrow: "BASIC STATISTICS",
    title: "대한민국 성인 키 분포",
    description: "집단 / 변환 / 히스토그램 / 지터 / 신뢰구간",
    accent: "is-emerald",
  },
  {
    href: "/lab/sample-mean-distribution",
    eyebrow: "BASIC STATISTICS",
    title: "표본평균의 분포",
    description: "모집단 / 현재 표본 / 표본평균 분포",
    accent: "is-sky",
  },
  {
    href: "/lab/t-f-analysis",
    eyebrow: "BASIC STATISTICS",
    title: "t검정과 F검정",
    description: "t검정 / F검정 / 알파레벨 / 통계량 표시",
    accent: "is-coral",
  },
  {
    href: "/lab/mean-difference-distribution",
    eyebrow: "BASIC STATISTICS",
    title: "영가설 분포",
    description: "실제 분포 / 영가설 분포 / t분포 / 표집 크기",
    accent: "is-blue",
  },
  {
    href: "/lab/covariance-correlation-products",
    eyebrow: "REGRESSION",
    title: "공분산과 상관계수",
    description: "사례 선택 / 내적 계산 / t값 표시",
    accent: "is-sky",
  },
  {
    href: "/lab/regression-1-ols-intro",
    eyebrow: "REGRESSION",
    title: "OLS와 최소제곱법",
    description: "최소제곱법 / 모형 유의성 / 잔차 기본가정",
    accent: "is-coral",
  },
  {
    href: "/lab/multiple-regression-collinearity",
    eyebrow: "REGRESSION",
    title: "다중회귀분석과 공선성",
    description: "회귀평면 / 통제 / 공선성",
    accent: "is-amber",
  },
  {
    href: "/lab/mediation-effect",
    eyebrow: "REGRESSION",
    title: "매개효과",
    description: "X→M / X→Y / X+M→Y",
    accent: "is-lilac",
  },
  {
    href: "/lab/gender-moderation-effect",
    eyebrow: "REGRESSION",
    title: "조절효과와 성별",
    description: "모형 / 상호작용 / 플롯",
    accent: "is-blue",
  },
];

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="lab-index-card-arrow-icon">
      <path d="M7 17L17 7" />
      <path d="M8 7H17V16" />
    </svg>
  );
}

export default function LabIndexPage() {
  const orderedPages = [1, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((index) => LAB_PAGES[index]);

  return (
    <main className="rr-shell lab-index-shell">
      <header className="rr-header lab-index-header">
        <div>
          <p className="eyebrow">Graph Lab</p>
          <h1>통계 그래프 메인</h1>
        </div>
        <Link className="secondary-button lab-index-home" href="/">
          홈으로
        </Link>
      </header>

      <section className="lab-index-grid">
        {orderedPages.map((page, index) => (
          <Link key={page.href} href={page.href} className={`lab-index-card ${page.accent}`}>
            <div className="lab-index-card-glow" aria-hidden="true" />
            <div className="lab-index-card-top">
              <p className="eyebrow">{page.eyebrow}</p>
              <span className="lab-index-card-number">{String(index + 1).padStart(2, "0")}</span>
            </div>
            <div className="lab-index-card-main">
              <h3>{page.title}</h3>
              <p>{page.description}</p>
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
        <p>ⓒ 2026 김준성. All rights reserved.</p>
      </footer>
    </main>
  );
}
