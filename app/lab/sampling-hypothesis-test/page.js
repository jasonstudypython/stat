"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import rawHeightData from "../../../data_mdis_height.json";
import { createSeededRandom, mean, standardDeviation } from "../_shared/stats";

const SAMPLE_SIZES = [3, 30, 300];
const MAX_ROUNDS = 320;
const T_CRITICAL = { 3: 4.303, 30: 2.045, 300: 1.968 };
const NULL_MEAN = 160.56;
const POPULATION_RANGE = [125, 205];
const DISTRIBUTION_RANGE = [-25, 10];

function populationStandardDeviation(values, center) {
  return Math.sqrt(values.reduce((sum, value) => sum + (value - center) ** 2, 0) / values.length);
}

function logGamma(value) {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  let adjusted = value - 1;
  let accumulator = 0.9999999999998099;
  coefficients.forEach((coefficient, index) => {
    accumulator += coefficient / (adjusted + index + 1);
  });
  const temp = adjusted + coefficients.length - 0.5;
  return 0.9189385332046727 + (adjusted + 0.5) * Math.log(temp) - temp + Math.log(accumulator);
}

function tPdf(value, df) {
  const numerator = Math.exp(logGamma((df + 1) / 2));
  const denominator = Math.sqrt(df * Math.PI) * Math.exp(logGamma(df / 2));
  return (numerator / denominator) * (1 + value ** 2 / df) ** (-(df + 1) / 2);
}

function normalPdf(value) {
  return Math.exp(-0.5 * value ** 2) / Math.sqrt(2 * Math.PI);
}

function xPosition(value, width, left = 52, right = 24, range = DISTRIBUTION_RANGE) {
  return left + ((value - range[0]) / (range[1] - range[0])) * (width - left - right);
}

function createTicks(range, step) {
  const ticks = [];
  for (let tick = Math.ceil(range[0] / step) * step; tick <= range[1]; tick += step) ticks.push(tick);
  return ticks;
}

function createRounds(population, sampleSize) {
  const random = createSeededRandom(5107 + sampleSize * 991);
  return Array.from({ length: MAX_ROUNDS }, (_, roundIndex) => {
    const indices = Array.from({ length: sampleSize }, () => Math.floor(random() * population.length));
    const values = indices.map((index) => population[index]).sort((left, right) => left - right);
    return {
      id: roundIndex + 1,
      indices,
      values,
      mean: mean(values),
      std: standardDeviation(values),
    };
  });
}

function buildHistogram(values, binWidth = 1) {
  const counts = new Map();
  values.forEach((value) => {
    const bin = Math.floor((value - POPULATION_RANGE[0]) / binWidth);
    counts.set(bin, (counts.get(bin) || 0) + 1);
  });
  return Array.from(counts, ([bin, count]) => ({
    x0: POPULATION_RANGE[0] + bin * binWidth,
    x1: POPULATION_RANGE[0] + (bin + 1) * binWidth,
    count,
  }));
}

function PopulationHistogram({ population, currentRound, populationMean }) {
  const width = 760;
  const height = 470;
  const top = 50;
  const bottom = 390;
  const bars = buildHistogram(population);
  const maxCount = Math.max(...bars.map((bar) => bar.count));
  const highlighted = new Map();
  currentRound?.values.forEach((value) => highlighted.set(value, (highlighted.get(value) || 0) + 1));

  return (
    <svg className="samplingtest-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="대한민국 성인 남성 키 모집단 히스토그램">
      {[0.25, 0.5, 0.75].map((ratio) => (
        <line key={ratio} x1="52" x2="736" y1={top + ratio * (bottom - top)} y2={top + ratio * (bottom - top)} className="samplingtest-grid" />
      ))}
      {createTicks(POPULATION_RANGE, 10).map((tick) => (
        <g key={tick}>
          <line x1={xPosition(tick, width, 52, 24, POPULATION_RANGE)} x2={xPosition(tick, width, 52, 24, POPULATION_RANGE)} y1={top} y2={bottom} className="samplingtest-grid" />
          <text x={xPosition(tick, width, 52, 24, POPULATION_RANGE)} y="420" textAnchor="middle" className="samplingtest-tick">{tick}</text>
        </g>
      ))}
      {bars.map((bar) => {
        const x = xPosition(bar.x0, width, 52, 24, POPULATION_RANGE);
        const barWidth = xPosition(bar.x1, width, 52, 24, POPULATION_RANGE) - x;
        const barHeight = (bar.count / maxCount) * (bottom - top);
        return <rect key={bar.x0} x={x + 1} y={bottom - barHeight} width={Math.max(barWidth - 2, 1)} height={barHeight} className="samplingtest-bar" />;
      })}
      <line x1="52" x2="736" y1={bottom} y2={bottom} className="samplingtest-axis" />
      <line x1={xPosition(populationMean, width, 52, 24, POPULATION_RANGE)} x2={xPosition(populationMean, width, 52, 24, POPULATION_RANGE)} y1={top} y2={bottom} className="samplingtest-population-mean" />
      {Array.from(highlighted.entries()).map(([value, count]) => (
        <g key={value}>
          {Array.from({ length: count }, (_, index) => (
            <circle key={index} cx={xPosition(value, width, 52, 24, POPULATION_RANGE)} cy={bottom - 11 - index * 13} r="5.5" className="samplingtest-selected-dot" />
          ))}
        </g>
      ))}
      <text x="394" y="456" textAnchor="middle" className="samplingtest-axis-label">키 (cm)</text>
    </svg>
  );
}

function DistributionPlot({ visibleRounds, currentRound, sampleSize, mode, nullMean, nullPopulationStd }) {
  const width = 760;
  const height = 470;
  const top = 50;
  const bottom = 390;
  const df = sampleSize - 1;
  const critical = mode === "t" ? T_CRITICAL[sampleSize] : 1.96;
  const currentSe = currentRound
    ? (mode === "t" ? currentRound.std : nullPopulationStd) / Math.sqrt(sampleSize)
    : nullPopulationStd / Math.sqrt(sampleSize);
  const leftCritical = -critical * currentSe;
  const rightCritical = critical * currentSe;
  const curvePoints = Array.from({ length: 201 }, (_, index) => DISTRIBUTION_RANGE[0] + index * (DISTRIBUTION_RANGE[1] - DISTRIBUTION_RANGE[0]) / 200);
  const curvePath = (round) => {
    const standardError = Math.max((mode === "t" ? round.std : nullPopulationStd) / Math.sqrt(sampleSize), 0.08);
    const peak = mode === "t" ? tPdf(0, df) : normalPdf(0);
    return curvePoints.map((difference, index) => {
      const scaledStatistic = difference / standardError;
      const density = mode === "t" ? tPdf(scaledStatistic, df) : normalPdf(scaledStatistic);
      const y = bottom - (density / peak) * (bottom - top) * 0.78;
      return `${index === 0 ? "M" : "L"} ${xPosition(difference, width).toFixed(2)} ${y.toFixed(2)}`;
    }).join(" ");
  };
  const criticalBoundsFor = (round) => {
    const standardError = Math.max((mode === "t" ? round.std : nullPopulationStd) / Math.sqrt(sampleSize), 0.08);
    return critical * standardError;
  };
  const fallbackRound = { std: nullPopulationStd };
  const activeRound = currentRound || fallbackRound;
  const currentDifference = currentRound ? nullMean - currentRound.mean : null;
  const currentStatistic = currentDifference === null ? null : currentDifference / Math.max(currentSe, 1e-6);
  const rejected = currentStatistic !== null && Math.abs(currentStatistic) >= critical;
  const displayedDifference = currentDifference === null
    ? null
    : Math.max(DISTRIBUTION_RANGE[0], Math.min(DISTRIBUTION_RANGE[1], currentDifference));
  const isOutsideRange = currentDifference !== null && displayedDifference !== currentDifference;

  return (
    <svg className="samplingtest-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${mode === "t" ? "t" : "z"} 표집분포 누적 그래프`}>
      <rect x="52" y={top} width={Math.max(xPosition(leftCritical, width) - 52, 0)} height={bottom - top} className="samplingtest-rejection" />
      <rect x={xPosition(rightCritical, width)} y={top} width={Math.max(736 - xPosition(rightCritical, width), 0)} height={bottom - top} className="samplingtest-rejection" />
      {[0.25, 0.5, 0.75].map((ratio) => (
        <line key={ratio} x1="52" x2="736" y1={top + ratio * (bottom - top)} y2={top + ratio * (bottom - top)} className="samplingtest-grid" />
      ))}
      {createTicks(DISTRIBUTION_RANGE, 5).map((tick) => (
        <g key={tick}>
          <line x1={xPosition(tick, width)} x2={xPosition(tick, width)} y1={top} y2={bottom} className="samplingtest-grid" />
          <text x={xPosition(tick, width)} y="420" textAnchor="middle" className="samplingtest-tick">{tick}</text>
        </g>
      ))}
      <line x1="52" x2="736" y1={bottom} y2={bottom} className="samplingtest-axis" />
      {visibleRounds.map((round, index) => {
        const bound = criticalBoundsFor(round);
        const isCurrent = index === visibleRounds.length - 1;
        return (
          <g key={`critical-${round.id}`}>
            <line x1={xPosition(-bound, width)} x2={xPosition(-bound, width)} y1={top} y2={bottom} className={isCurrent ? "samplingtest-critical-line is-current" : "samplingtest-critical-line"} />
            <line x1={xPosition(bound, width)} x2={xPosition(bound, width)} y1={top} y2={bottom} className={isCurrent ? "samplingtest-critical-line is-current" : "samplingtest-critical-line"} />
          </g>
        );
      })}
      {visibleRounds.map((round, index) => (
        <path
          key={round.id}
          d={curvePath(round)}
          className={index === visibleRounds.length - 1 ? "samplingtest-curve is-current" : "samplingtest-curve"}
        />
      ))}
      {visibleRounds.length === 0 ? <path d={curvePath(activeRound)} className="samplingtest-curve is-current" /> : null}
      <line x1={xPosition(0, width)} x2={xPosition(0, width)} y1={top} y2={bottom} className="samplingtest-null-line" />
      {currentRound ? (
        <>
          <line x1={xPosition(displayedDifference, width)} x2={xPosition(displayedDifference, width)} y1={top} y2={bottom} className={`samplingtest-stat-line${rejected ? " is-rejected" : ""}`} />
          <text
            x={xPosition(displayedDifference, width)}
            y="38"
            textAnchor={isOutsideRange ? (currentDifference < 0 ? "start" : "end") : "middle"}
            className={`samplingtest-stat-label${rejected ? " is-rejected" : ""}`}
          >
            {`${currentDifference < DISTRIBUTION_RANGE[0] ? "← " : currentDifference > DISTRIBUTION_RANGE[1] ? "→ " : ""}μ₀−x̄=${currentDifference.toFixed(2)}`}
          </text>
        </>
      ) : null}
      <text x="394" y="456" textAnchor="middle" className="samplingtest-axis-label">여성 평균 160.56 − 표본평균 (cm)</text>
    </svg>
  );
}

function SampleStrip({ round, sampleSize }) {
  const width = 1280;
  const height = 132;
  const ticks = createTicks(POPULATION_RANGE, 10);
  const random = createSeededRandom((round?.id || 0) * 101 + sampleSize);
  return (
    <section className="samplingtest-sample-card">
      <div className="samplingtest-sample-head">
        <div>
          <span>현재 표본</span>
          <strong>{round ? `${round.id}번째 표본 · n=${sampleSize}` : `표집 전 · n=${sampleSize}`}</strong>
        </div>
        <div className="samplingtest-sample-stats">
          <span>평균 <strong>{round ? round.mean.toFixed(2) : "-"}</strong></span>
          <span>표준편차 <strong>{round ? round.std.toFixed(2) : "-"}</strong></span>
        </div>
      </div>
      <svg className="samplingtest-strip" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="현재 표본 점 도표">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={xPosition(tick, width, 56, 26, POPULATION_RANGE)} x2={xPosition(tick, width, 56, 26, POPULATION_RANGE)} y1="12" y2="72" className="samplingtest-grid" />
            <text x={xPosition(tick, width, 56, 26, POPULATION_RANGE)} y="98" textAnchor="middle" className="samplingtest-tick">{tick}</text>
          </g>
        ))}
        <line x1="56" x2="1254" y1="72" y2="72" className="samplingtest-axis" />
        {round?.values.map((value, index) => (
          <circle key={`${value}-${index}`} cx={xPosition(value, width, 56, 26, POPULATION_RANGE)} cy={48 + (random() - 0.5) * 20} r="6" className="samplingtest-sample-dot" />
        ))}
        {round ? <line x1={xPosition(round.mean, width, 56, 26, POPULATION_RANGE)} x2={xPosition(round.mean, width, 56, 26, POPULATION_RANGE)} y1="12" y2="72" className="samplingtest-stat-line" /> : null}
        <text x="655" y="126" textAnchor="middle" className="samplingtest-axis-label">키 (cm)</text>
      </svg>
    </section>
  );
}

export default function SamplingHypothesisTestPage() {
  const [sampleSize, setSampleSize] = useState(3);
  const [mode, setMode] = useState("t");
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const population = useMemo(
    () => rawHeightData.filter((row) => row.sex === "남").map((row) => Number(row.height)).filter(Number.isFinite),
    [],
  );
  const nullPopulation = useMemo(
    () => rawHeightData.filter((row) => row.sex === "여").map((row) => Number(row.height)).filter(Number.isFinite),
    [],
  );
  const populationMean = useMemo(() => mean(population), [population]);
  const populationStd = useMemo(() => populationStandardDeviation(population, populationMean), [population, populationMean]);
  const nullPopulationStd = useMemo(
    () => populationStandardDeviation(nullPopulation, mean(nullPopulation)),
    [nullPopulation],
  );
  const rounds = useMemo(() => createRounds(population, sampleSize), [population, sampleSize]);
  const visibleRounds = rounds.slice(0, step);
  const currentRound = step > 0 ? rounds[step - 1] : null;
  const critical = mode === "t" ? T_CRITICAL[sampleSize] : 1.96;
  const currentSe = currentRound ? (mode === "t" ? currentRound.std : nullPopulationStd) / Math.sqrt(sampleSize) : null;
  const statistic = currentRound ? (NULL_MEAN - currentRound.mean) / Math.max(currentSe, 1e-6) : null;
  const rejected = statistic !== null && Math.abs(statistic) >= critical;

  useEffect(() => {
    setStep(0);
    setIsPlaying(false);
  }, [sampleSize, mode]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    if (step >= MAX_ROUNDS) {
      setIsPlaying(false);
      return undefined;
    }
    const timer = window.setInterval(() => {
      setStep((value) => Math.min(value + 1, MAX_ROUNDS));
    }, 90);
    return () => window.clearInterval(timer);
  }, [isPlaying, step]);

  return (
    <main className="rr-shell samplingtest-shell">
      <header className="rr-header samplingtest-header">
        <div>
          <p className="eyebrow">Basic Statistics</p>
          <h1>표집분포와 가설검정</h1>
          <p className="regswitch-formula">H₀: 여성 평균과 표본 모집단 평균의 차이는 0이다 · μ여성 − μ표본모집단 = 0</p>
        </div>
        <Link className="secondary-button regswitch-home-button" href="/lab">메인으로</Link>
      </header>

      <section className="samplingtest-controls" aria-label="표집 설정">
        <div className="samplingtest-control-group">
          <span>표집 크기</span>
          <div className="samplingtest-segmented">
            {SAMPLE_SIZES.map((size) => <button key={size} type="button" className={sampleSize === size ? "active" : ""} onClick={() => setSampleSize(size)}>n={size}</button>)}
          </div>
        </div>
        <div className="samplingtest-control-group">
          <span>분포</span>
          <div className="samplingtest-segmented">
            <button type="button" className={mode === "t" ? "active" : ""} onClick={() => setMode("t")}>t 분포</button>
            <button type="button" className={mode === "z" ? "active" : ""} onClick={() => setMode("z")}>z 분포</button>
          </div>
        </div>
        <div className="samplingtest-control-group is-run">
          <span>반복 표집</span>
          <div className="samplingtest-run-row">
            <button type="button" onClick={() => setStep((value) => Math.min(value + 1, MAX_ROUNDS))}>다음 표본</button>
            <button type="button" className={isPlaying ? "active" : ""} onClick={() => setIsPlaying((value) => !value)}>{isPlaying ? "정지" : "320회 실행"}</button>
          </div>
        </div>
        <div className="samplingtest-slider-group">
          <div><span>시행</span><strong>{step} / {MAX_ROUNDS}</strong></div>
          <input type="range" min="0" max={MAX_ROUNDS} value={step} onChange={(event) => { setStep(Number(event.target.value)); setIsPlaying(false); }} />
        </div>
      </section>

      <section className="samplingtest-grid-layout">
        <article className="samplingtest-card">
          <div className="samplingtest-card-head">
            <h2>대한민국 성인 남성의 키</h2>
            <p>표집 대상 N={population.length.toLocaleString()} · 평균 {populationMean.toFixed(2)} · 표준편차 {populationStd.toFixed(2)}</p>
          </div>
          <PopulationHistogram population={population} currentRound={currentRound} populationMean={populationMean} />
        </article>
        <article className="samplingtest-card">
          <div className="samplingtest-card-head">
            <h2>영가설 분포</h2>
            <p>{mode === "t" ? "H₀: μ여성 − μ표본모집단 = 0 · 표본 s 사용" : `H₀: μ여성 − μ표본모집단 = 0 · 여성 모집단 σ=${nullPopulationStd.toFixed(2)} 사용`}</p>
          </div>
          <DistributionPlot visibleRounds={visibleRounds} currentRound={currentRound} sampleSize={sampleSize} mode={mode} nullMean={NULL_MEAN} nullPopulationStd={nullPopulationStd} />
          <div className="samplingtest-result-row">
            <span>유의수준 α=.05 · 양측 기각역 ±{critical.toFixed(3)}</span>
            <strong className={rejected ? "is-rejected" : ""}>{statistic === null ? "표본을 뽑아 보세요" : `${mode}=${statistic.toFixed(2)} · ${rejected ? "H₀ 기각" : "H₀ 기각하지 못함"}`}</strong>
          </div>
        </article>
      </section>

      <SampleStrip round={currentRound} sampleSize={sampleSize} />
    </main>
  );
}
