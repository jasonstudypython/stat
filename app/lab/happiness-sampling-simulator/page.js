"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createSeededRandom, mean, sampleNormal, standardDeviation } from "../_shared/stats";

const HAPPY_FREQUENCIES = [3, 11, 63, 207, 492, 2252, 3396, 5575, 3551, 642, 113];
const MAX_ROUNDS = 1000;
const TARGET_ROUNDS = 1000;
const T_CRITICAL_95 = { 4: 2.776, 29: 2.045, 99: 1.984, 299: 1.968 };

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function populationStd(values, center = mean(values)) {
  return Math.sqrt(values.reduce((sum, value) => sum + (value - center) ** 2, 0) / values.length);
}

function normalPdf(value) {
  return Math.exp(-0.5 * value ** 2) / Math.sqrt(2 * Math.PI);
}

function normalCdf(value) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const coefficients = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429];
  const erf = 1 - coefficients.reduceRight((acc, coefficient) => (acc * t + coefficient) * t, 0) * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

function logGamma(value) {
  const coefficients = [676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7];
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  let adjusted = value - 1;
  let accumulator = 0.9999999999998099;
  coefficients.forEach((coefficient, index) => { accumulator += coefficient / (adjusted + index + 1); });
  const temp = adjusted + coefficients.length - 0.5;
  return 0.9189385332046727 + (adjusted + 0.5) * Math.log(temp) - temp + Math.log(accumulator);
}

function tPdf(value, df) {
  const numerator = Math.exp(logGamma((df + 1) / 2));
  const denominator = Math.sqrt(df * Math.PI) * Math.exp(logGamma(df / 2));
  return (numerator / denominator) * (1 + value ** 2 / df) ** (-(df + 1) / 2);
}

function tCdf(value, df) {
  if (value === 0) return 0.5;
  const upper = Math.min(Math.abs(value), 12);
  const steps = 400;
  const width = upper / steps;
  let area = 0;
  for (let index = 0; index <= steps; index += 1) {
    const weight = index === 0 || index === steps ? 1 : index % 2 === 0 ? 2 : 4;
    area += weight * tPdf(index * width, df);
  }
  const probability = 0.5 + (area * width / 3) * (value < 0 ? -1 : 1);
  return clamp(probability, 0, 1);
}

function makeKnownPopulation() {
  return HAPPY_FREQUENCIES.flatMap((count, value) => Array(count).fill(value));
}

function makeVirtualPopulation(center, spread) {
  const random = createSeededRandom(20261104 + Math.round(center * 100) + Math.round(spread * 1000));
  const values = Array.from({ length: 12000 }, () => sampleNormal(random, center, spread));
  const generatedMean = mean(values);
  return values.map((value) => value + center - generatedMean);
}

function makeRounds(population, sampleSize, seed) {
  const random = createSeededRandom(seed);
  return Array.from({ length: MAX_ROUNDS }, (_, index) => {
    const values = Array.from({ length: sampleSize }, () => population[Math.floor(random() * population.length)]);
    return { id: index + 1, values, mean: mean(values), std: standardDeviation(values) };
  });
}

function ticks(start, end, count = 6) {
  const step = (end - start) / count;
  return Array.from({ length: count + 1 }, (_, index) => start + index * step);
}

function histogram(values, start, end, binCount) {
  const width = (end - start) / binCount || 1;
  const counts = Array(binCount).fill(0);
  values.forEach((value) => {
    const index = clamp(Math.floor((value - start) / width), 0, binCount - 1);
    counts[index] += 1;
  });
  return counts.map((count, index) => ({ x0: start + index * width, x1: start + (index + 1) * width, count }));
}

function axisRange(values, fallback, padding = 0.08) {
  if (!values.length) return fallback;
  const low = Math.min(...values, fallback[0]);
  const high = Math.max(...values, fallback[1]);
  const extra = Math.max((high - low) * padding, 0.15);
  return [low - extra, high + extra];
}

function PopulationPlot({ population, round, transform, center, spread, virtual }) {
  const width = 820;
  const height = 460;
  const left = 58;
  const right = 22;
  const top = 42;
  const bottom = 376;
  const convert = (value) => transform === "raw" ? value : transform === "center" ? value - center : (value - center) / spread;
  const rawRange = virtual ? [center - spread * 4, center + spread * 4] : [-0.5, 10.5];
  const range = [convert(rawRange[0]), convert(rawRange[1])];
  const axisTicks = !virtual && transform === "raw"
    ? Array.from({ length: 11 }, (_, value) => value)
    : ticks(range[0], range[1], 8);
  const rawBars = virtual
    ? histogram(population, rawRange[0], rawRange[1], 88)
    : HAPPY_FREQUENCIES.map((count, value) => ({ x0: value - 0.38, x1: value + 0.38, count, value }));
  const bars = rawBars.map((bar) => ({ ...bar, x0: convert(bar.x0), x1: convert(bar.x1) }));
  const maxCount = Math.max(...bars.map((bar) => bar.count), 1);
  const x = (value) => left + ((value - range[0]) / (range[1] - range[0])) * (width - left - right);
  const highlighted = round?.values.map(convert) || [];
  const highlightedCounts = highlighted.reduce((counts, value) => {
    const key = Math.round(value * 20) / 20;
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map());
  const maxHighlightedStack = Math.max(...highlightedCounts.values(), 1);
  const highlightedGap = Math.min(13, (bottom - top - 18) / maxHighlightedStack);
  const highlightedRadius = highlighted.length >= 300 ? 3.2 : highlighted.length >= 100 ? 4.2 : 6;
  const selectedStacks = new Map();

  return (
    <svg className="happysim-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="행복감 모집단과 현재 표본">
      {axisTicks.map((tick) => (
        <g key={tick}>
          <line x1={x(tick)} x2={x(tick)} y1={top} y2={bottom} className="happysim-grid" />
          <text x={x(tick)} y="411" textAnchor="middle" className="happysim-tick">{!virtual && transform === "raw" ? tick : tick.toFixed(2)}</text>
        </g>
      ))}
      {bars.map((bar, index) => {
        const barHeight = (bar.count / maxCount) * (bottom - top) * 0.88;
        const centerX = (x(bar.x0) + x(bar.x1)) / 2;
        const labelY = Math.max(top + 12, bottom - barHeight - 8);
        return (
          <g key={index}>
            <rect x={x(bar.x0) + 1} y={bottom - barHeight} width={Math.max(x(bar.x1) - x(bar.x0) - 2, 1)} height={barHeight} className="happysim-pop-bar" />
            {!virtual ? (
              <text x={centerX} y={labelY} textAnchor="middle" className="happysim-frequency-label">
                {`${bar.count.toLocaleString()} · ${(bar.count / population.length * 100).toFixed(1)}%`}
              </text>
            ) : null}
          </g>
        );
      })}
      <line x1={left} x2={width - right} y1={bottom} y2={bottom} className="happysim-axis" />
      {!virtual ? <text x={left} y={top - 13} className="happysim-frequency-caption">빈도 · 비율</text> : null}
      <line x1={x(convert(center))} x2={x(convert(center))} y1={top} y2={bottom} className="happysim-mean-line" />
      {highlighted.map((value, index) => {
        const key = Math.round(value * 20) / 20;
        const level = selectedStacks.get(key) || 0;
        selectedStacks.set(key, level + 1);
        return <circle key={`${key}-${index}`} cx={x(value)} cy={bottom - highlightedRadius - level * highlightedGap} r={highlightedRadius} className="happysim-selected-dot" />;
      })}
      <text x={width / 2} y="448" textAnchor="middle" className="happysim-axis-label">
        {transform === "raw" ? "전반적 행복감" : transform === "center" ? "평균중심화 행복감" : "표준화 행복감 (z)"}
      </text>
    </svg>
  );
}

function SamplingPlot({ values, current, transform, reference, showReference, showCurve, displayMode, sampleSize, populationMode, center, spread }) {
  const width = 820;
  const height = 460;
  const left = 58;
  const right = 22;
  const top = 42;
  const bottom = 376;
  const range = transform === "raw" ? [3.5, 9.5] : transform === "center" ? [-3, 3] : [-4.5, 4.5];
  const x = (value) => left + ((value - range[0]) / (range[1] - range[0])) * (width - left - right);
  const useDots = displayMode === "dots" || (displayMode === "auto" && values.length <= 200);
  const visibleValues = values.filter((value) => value >= range[0] && value <= range[1]);
  const binCount = sampleSize >= 100 ? 72 : sampleSize >= 30 ? 48 : 24;
  const bars = histogram(visibleValues, range[0], range[1], binCount);
  const maxBar = Math.max(...bars.map((bar) => bar.count), 1);
  const dotBins = new Map();
  const dotBinCount = sampleSize >= 300 ? 180 : sampleSize >= 100 ? 120 : sampleSize >= 30 ? 72 : 40;
  const dotWidth = (range[1] - range[0]) / dotBinCount;
  const df = sampleSize - 1;
  const critical = populationMode === "known" ? 1.96 : T_CRITICAL_95[df];
  const standardError = spread / Math.sqrt(sampleSize);
  const distributionCenter = transform === "raw" ? center : 0;
  const distributionScale = transform === "standard" ? 1 : standardError;
  const criticalLow = distributionCenter - critical * distributionScale;
  const criticalHigh = distributionCenter + critical * distributionScale;
  const curvePoints = Array.from({ length: 241 }, (_, index) => {
    const value = range[0] + index * (range[1] - range[0]) / 240;
    const statistic = (value - distributionCenter) / distributionScale;
    const density = populationMode === "known" ? normalPdf(statistic) : tPdf(statistic, df);
    return { value, density };
  });
  const peakDensity = populationMode === "known" ? normalPdf(0) : tPdf(0, df);
  const curvePath = curvePoints.map((point, index) => `${index ? "L" : "M"} ${x(point.value).toFixed(2)} ${(bottom - (point.density / peakDensity) * (bottom - top) * 0.78).toFixed(2)}`).join(" ");

  return (
    <svg className="happysim-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="표집분포 누적 그래프">
      <rect x={left} y={top} width={Math.max(x(criticalLow) - left, 0)} height={bottom - top} className="happysim-rejection-area" />
      <rect x={x(criticalHigh)} y={top} width={Math.max(width - right - x(criticalHigh), 0)} height={bottom - top} className="happysim-rejection-area" />
      {ticks(range[0], range[1]).map((tick) => (
        <g key={tick}>
          <line x1={x(tick)} x2={x(tick)} y1={top} y2={bottom} className="happysim-grid" />
          <text x={x(tick)} y="411" textAnchor="middle" className="happysim-tick">{tick.toFixed(2)}</text>
        </g>
      ))}
      {!useDots && bars.map((bar, index) => {
        const barHeight = (bar.count / maxBar) * (bottom - top) * 0.88;
        return <rect key={index} x={x(bar.x0) + 1} y={bottom - barHeight} width={Math.max(x(bar.x1) - x(bar.x0) - 2, 1)} height={barHeight} className="happysim-sampling-bar" />;
      })}
      {useDots && visibleValues.map((value, index) => {
        const bin = Math.floor((value - range[0]) / dotWidth);
        const level = dotBins.get(bin) || 0;
        dotBins.set(bin, level + 1);
        const cappedLevel = Math.min(level, 45);
        return <circle key={index} cx={x(range[0] + (bin + 0.5) * dotWidth)} cy={bottom - 7 - cappedLevel * 6.6} r={index === visibleValues.length - 1 ? 5.8 : 4.2} className={index === visibleValues.length - 1 ? "happysim-sample-dot is-current" : "happysim-sample-dot"} />;
      })}
      <line x1={left} x2={width - right} y1={bottom} y2={bottom} className="happysim-axis" />
      {showCurve ? <path d={curvePath} className="happysim-probability-curve" /> : null}
      <line x1={x(criticalLow)} x2={x(criticalLow)} y1={top} y2={bottom} className="happysim-critical-line" />
      <line x1={x(criticalHigh)} x2={x(criticalHigh)} y1={top} y2={bottom} className="happysim-critical-line" />
      <text x={x(criticalLow)} y={top + 14} textAnchor="end" className="happysim-critical-label">2.5%</text>
      <text x={x(criticalHigh)} y={top + 14} textAnchor="start" className="happysim-critical-label">2.5%</text>
      {showReference && reference >= range[0] && reference <= range[1] ? (
        <g>
          <line x1={x(reference)} x2={x(reference)} y1={top} y2={bottom} className="happysim-reference-line" />
          <text x={x(reference)} y="31" textAnchor="middle" className="happysim-reference-label">특정값 {reference.toFixed(2)}</text>
        </g>
      ) : null}
      {current !== null && current >= range[0] && current <= range[1] ? <circle cx={x(current)} cy={bottom - 8} r="7" className="happysim-current-marker" /> : null}
      <text x={width / 2} y="448" textAnchor="middle" className="happysim-axis-label">
        {transform === "raw" ? "표본평균" : transform === "center" ? "평균중심화된 표본평균" : "표준화 통계량"}
      </text>
    </svg>
  );
}

export default function HappinessSamplingSimulatorPage() {
  const [populationMode, setPopulationMode] = useState("known");
  const [virtualMean, setVirtualMean] = useState(6.67);
  const [virtualStd, setVirtualStd] = useState(1.3);
  const [sampleSize, setSampleSize] = useState(30);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [transform, setTransform] = useState("raw");
  const [displayMode, setDisplayMode] = useState("auto");
  const [referenceValue, setReferenceValue] = useState(7);
  const [showReference, setShowReference] = useState(true);
  const [showCurve, setShowCurve] = useState(true);
  const timerRef = useRef(null);

  const knownPopulation = useMemo(makeKnownPopulation, []);
  const population = useMemo(
    () => populationMode === "known" ? knownPopulation : makeVirtualPopulation(virtualMean, Math.max(virtualStd, 0.1)),
    [knownPopulation, populationMode, virtualMean, virtualStd],
  );
  const popMean = useMemo(() => mean(population), [population]);
  const popStd = useMemo(() => populationStd(population, popMean), [population, popMean]);
  const rounds = useMemo(
    () => makeRounds(population, sampleSize, 9187 + sampleSize * 31 + (populationMode === "known" ? 0 : 10000)),
    [population, populationMode, sampleSize],
  );
  const currentRound = step ? rounds[step - 1] : null;
  const visibleRounds = rounds.slice(0, step);
  const statisticFor = (round) => {
    if (transform === "raw") return round.mean;
    if (transform === "center") return round.mean - popMean;
    const denominator = populationMode === "known" ? popStd : Math.max(round.std, 0.0001);
    return (round.mean - popMean) / (denominator / Math.sqrt(sampleSize));
  };
  const samplingValues = visibleRounds.map(statisticFor);
  const inferentialSpread = populationMode === "known" ? popStd : virtualStd;
  const referenceTestStatistic = (referenceValue - popMean) / (inferentialSpread / Math.sqrt(sampleSize));
  const referencePValue = populationMode === "known"
    ? 2 * (1 - normalCdf(Math.abs(referenceTestStatistic)))
    : 2 * (1 - tCdf(Math.abs(referenceTestStatistic), sampleSize - 1));
  const referenceStatistic = transform === "raw"
    ? referenceValue
    : transform === "center"
      ? referenceValue - popMean
      : referenceTestStatistic;
  const currentStatistic = currentRound ? statisticFor(currentRound) : null;
  const confidenceCritical = populationMode === "known" ? 1.96 : T_CRITICAL_95[sampleSize - 1];
  const confidenceScale = transform === "standard" ? 1 : inferentialSpread / Math.sqrt(sampleSize);
  const confidenceCenter = transform === "raw" ? popMean : 0;
  const confidenceInterval = [
    confidenceCenter - confidenceCritical * confidenceScale,
    confidenceCenter + confidenceCritical * confidenceScale,
  ];

  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [populationMode, virtualMean, virtualStd, sampleSize]);

  useEffect(() => {
    if (!playing) return undefined;
    timerRef.current = window.setInterval(() => {
      setStep((current) => {
        const next = Math.min(current + 5, TARGET_ROUNDS);
        if (next >= TARGET_ROUNDS) setPlaying(false);
        return next;
      });
    }, 80);
    return () => window.clearInterval(timerRef.current);
  }, [playing]);

  const reset = () => { setPlaying(false); setStep(0); };
  const oneSample = () => { setPlaying(false); setStep((current) => Math.min(current + 1, TARGET_ROUNDS)); };

  return (
    <main className="rr-shell happysim-shell">
      <header className="rr-header happysim-header">
        <div><p className="eyebrow">Basic Statistics</p><h1>행복감 표집분포 시뮬레이터</h1></div>
        <Link className="secondary-button regswitch-home-button" href="/lab">메인으로</Link>
      </header>

      <section className="happysim-toolbar">
        <div className="happysim-field wide">
          <span>모집단 설정</span>
          <div className="happysim-segmented">
            <button type="button" className={populationMode === "known" ? "active" : ""} onClick={() => setPopulationMode("known")}>분산을 알고 있음</button>
            <button type="button" className={populationMode === "unknown" ? "active" : ""} onClick={() => setPopulationMode("unknown")}>분산을 모름</button>
          </div>
        </div>
        <label className="happysim-field"><span>표본크기 n</span><select value={sampleSize} onChange={(event) => setSampleSize(Number(event.target.value))}>{[5, 30, 100, 300].map((value) => <option key={value}>{value}</option>)}</select></label>
        <div className="happysim-field"><span>전체 시행</span><strong className="happysim-fixed-value">1,000회</strong></div>
        <label className="happysim-field"><span>좌표 변환</span><select value={transform} onChange={(event) => setTransform(event.target.value)}><option value="raw">원점수</option><option value="center">평균중심화</option><option value="standard">표준화</option></select></label>
        <label className="happysim-field"><span>누적 표현</span><select value={displayMode} onChange={(event) => setDisplayMode(event.target.value)}><option value="auto">자동</option><option value="dots">도트</option><option value="histogram">히스토그램</option></select></label>
      </section>

      {populationMode === "unknown" ? (
        <section className="happysim-virtual-note">
          <div><strong>가상 모집단</strong><span>입력한 표본통계량을 모집단 모수의 추정값으로 사용합니다.</span></div>
          <label>입력 평균 <input type="number" step="0.1" value={virtualMean} onChange={(event) => setVirtualMean(Number(event.target.value))} /></label>
          <label>입력 표준편차 <input type="number" min="0.1" max="5" step="0.1" value={virtualStd} onChange={(event) => setVirtualStd(clamp(Number(event.target.value), 0.1, 5))} /></label>
        </section>
      ) : null}

      <section className="happysim-grid-layout">
        <article className="happysim-card">
          <div className="happysim-card-head"><div><span>01 · 모집단과 표집</span><h2>{populationMode === "known" ? "happy.csv 모집단" : "추정값으로 만든 가상 모집단"}</h2></div><p>μ={popMean.toFixed(2)} · σ={popStd.toFixed(2)} · N={population.length.toLocaleString()}</p></div>
          <PopulationPlot population={population} round={currentRound} transform={transform} center={popMean} spread={popStd} virtual={populationMode === "unknown"} />
        </article>
        <article className="happysim-card">
          <div className="happysim-card-head"><div><span>02 · 표집분포 누적</span><h2>{displayMode === "auto" ? (step <= 200 ? "도트로 쌓는 중" : "히스토그램으로 전환") : displayMode === "dots" ? "도트 플롯" : "히스토그램"}</h2></div><p>{step.toLocaleString()} / {TARGET_ROUNDS.toLocaleString()}회</p></div>
          <SamplingPlot values={samplingValues} current={currentStatistic} transform={transform} reference={referenceStatistic} showReference={showReference} showCurve={showCurve} displayMode={displayMode} sampleSize={sampleSize} populationMode={populationMode} center={popMean} spread={inferentialSpread} />
        </article>
      </section>

      <section className="happysim-control-deck">
        <div className="happysim-run-controls">
          <button type="button" onClick={oneSample} disabled={step >= TARGET_ROUNDS}>1회 표집</button>
          <button type="button" className="primary" onClick={() => setPlaying((value) => !value)} disabled={step >= TARGET_ROUNDS}>{playing ? "일시정지" : "실행"}</button>
          <button type="button" onClick={() => { setPlaying(false); setStep(TARGET_ROUNDS); }}>즉시 완료</button>
          <button type="button" onClick={reset}>초기화</button>
        </div>
        <label className="happysim-speed"><div><span>시행 탐색</span><strong>{step.toLocaleString()}회</strong></div><input type="range" min="0" max={TARGET_ROUNDS} step="1" value={step} onChange={(event) => { setPlaying(false); setStep(Number(event.target.value)); }} /><small>0회</small><small>1,000회</small></label>
        <div className="happysim-reference-control">
          <label><span>특정값</span><input type="number" step="0.1" value={referenceValue} onChange={(event) => setReferenceValue(Number(event.target.value))} /></label>
          <div className="happysim-display-checks">
            <label className="happysim-check"><input type="checkbox" checked={showReference} onChange={(event) => setShowReference(event.target.checked)} /><span>수직선 표시</span></label>
            <label className="happysim-check"><input type="checkbox" checked={showCurve} onChange={(event) => setShowCurve(event.target.checked)} /><span>확률분포 곡선 표시</span></label>
          </div>
        </div>
      </section>

      <section className="happysim-stats">
        <article><span>현재 표본평균</span><strong>{currentRound ? currentRound.mean.toFixed(3) : "-"}</strong></article>
        <article><span>현재 표본표준편차</span><strong>{currentRound ? currentRound.std.toFixed(3) : "-"}</strong></article>
        <article><span>{transform === "standard" ? (populationMode === "known" ? "현재 Z" : "현재 t") : "현재 표시값"}</span><strong>{currentStatistic === null ? "-" : currentStatistic.toFixed(3)}</strong></article>
        <article><span>표본평균의 평균</span><strong>{samplingValues.length ? mean(visibleRounds.map((round) => round.mean)).toFixed(3) : "-"}</strong></article>
        <article><span>표집분포 중앙 95% 구간</span><strong>{`[${confidenceInterval[0].toFixed(3)}, ${confidenceInterval[1].toFixed(3)}]`}</strong></article>
        <article className="happysim-pvalue"><span>특정값의 양측 유의확률</span><strong>p = {referencePValue < 0.001 ? "< .001" : referencePValue.toFixed(3).replace(/^0/, "")}</strong><small>{referencePValue < 0.05 ? "5% 수준에서 유의" : "5% 수준에서 유의하지 않음"}</small></article>
      </section>
    </main>
  );
}
