"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const POPULATION_OPTIONS = [
  { key: "normal", label: "정규형" },
  { key: "bimodal", label: "이봉형" },
  { key: "skewed", label: "비대칭형" },
];

const SAMPLE_SIZES = [3, 10, 30];
const MAX_ROUNDS = 320;
const CONFIDENCE_OPTIONS = [
  { key: "none", label: "기각역 없음" },
  { key: "95", label: "95% 신뢰수준" },
  { key: "99", label: "99% 신뢰수준" },
];
const T_CRITICAL_LOOKUP = {
  "95": {
    2: 4.303,
    9: 2.262,
    29: 2.045,
  },
  "99": {
    2: 9.925,
    9: 3.25,
    29: 2.756,
  },
};

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function sampleNormal(random, mean = 0, std = 1) {
  const u1 = Math.max(random(), 1e-12);
  const u2 = random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * std;
}

function roundToHalf(value) {
  return Math.round(value * 2) / 2;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / Math.max(values.length - 1, 1);
  return Math.sqrt(variance);
}

function normalPdf(x, avg, std) {
  const safeStd = Math.max(std, 1e-6);
  const z = (x - avg) / safeStd;
  return Math.exp(-0.5 * z ** 2) / (safeStd * Math.sqrt(2 * Math.PI));
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

  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  }

  let adjusted = value - 1;
  let accumulator = 0.9999999999998099;
  coefficients.forEach((coefficient, index) => {
    accumulator += coefficient / (adjusted + index + 1);
  });

  const temp = adjusted + coefficients.length - 0.5;
  return (
    0.9189385332046727 +
    (adjusted + 0.5) * Math.log(temp) -
    temp +
    Math.log(accumulator)
  );
}

function tPdf(x, df) {
  const safeDf = Math.max(df, 1);
  const numerator = Math.exp(logGamma((safeDf + 1) / 2));
  const denominator =
    Math.sqrt(safeDf * Math.PI) * Math.exp(logGamma(safeDf / 2));
  return numerator / denominator * Math.pow(1 + (x ** 2) / safeDf, -(safeDf + 1) / 2);
}

function getCriticalT(confidenceLevel, df) {
  const exact = T_CRITICAL_LOOKUP[confidenceLevel]?.[df];
  if (exact) return exact;
  if (confidenceLevel === "95") return 1.96;
  if (confidenceLevel === "99") return 2.576;
  return null;
}

function createPopulation(type) {
  const random = createSeededRandom(type === "normal" ? 4242 : type === "bimodal" ? 9898 : 7373);
  const values = [];

  if (type === "normal") {
    for (let index = 0; index < 100; index += 1) {
      values.push(roundToHalf(Math.min(182, Math.max(160, sampleNormal(random, 170, 4.6)))));
    }
  } else if (type === "bimodal") {
    for (let index = 0; index < 50; index += 1) {
      values.push(roundToHalf(Math.min(180, Math.max(160, sampleNormal(random, 166.5, 1.8)))));
    }
    for (let index = 0; index < 50; index += 1) {
      values.push(roundToHalf(Math.min(184, Math.max(166, sampleNormal(random, 175, 1.9)))));
    }
  } else {
    for (let index = 0; index < 100; index += 1) {
      const base = 161 + Math.pow(random(), 1.8) * 18.5;
      values.push(roundToHalf(Math.min(184, Math.max(160, base + sampleNormal(random, 0, 0.6)))));
    }
  }

  return values.sort((left, right) => left - right);
}

function sampleIndicesWithReplacement(random, size, upperBound) {
  return Array.from({ length: size }, () => Math.floor(random() * upperBound));
}

function createSamplingRounds(population, sampleSize, type) {
  const random = createSeededRandom(
    sampleSize * 1000 + (type === "normal" ? 11 : type === "bimodal" ? 29 : 47),
  );

  return Array.from({ length: MAX_ROUNDS }, () => {
    const indices = sampleIndicesWithReplacement(
      random,
      Math.min(sampleSize, population.length),
      population.length,
    );
    const values = indices.map((index) => population[index]).sort((left, right) => left - right);
    return {
      indices,
      values,
      mean: mean(values),
    };
  });
}

function xPosition(value, range, width, paddingLeft, paddingRight) {
  const usableWidth = width - paddingLeft - paddingRight;
  const ratio = (value - range[0]) / Math.max(range[1] - range[0], 1e-6);
  return paddingLeft + ratio * usableWidth;
}

function yPosition(value, maxValue, height, paddingTop, paddingBottom) {
  const usableHeight = height - paddingTop - paddingBottom;
  const ratio = value / Math.max(maxValue, 1);
  return height - paddingBottom - ratio * usableHeight;
}

function formatNumber(value, digits = 2) {
  return value.toFixed(digits);
}

function buildHistogramDots(values, binWidth, rangeStart) {
  const counts = new Map();
  return values.map((value, index) => {
    const binIndex = Math.floor((value - rangeStart) / binWidth);
    const stackLevel = (counts.get(binIndex) || 0) + 1;
    counts.set(binIndex, stackLevel);
    return {
      key: `${binIndex}-${index}`,
      x: rangeStart + binIndex * binWidth + binWidth / 2,
      y: stackLevel,
    };
  });
}

function getMaxBinCount(values, binWidth, rangeStart) {
  const counts = new Map();
  let maxCount = 0;
  values.forEach((value) => {
    const binIndex = Math.floor((value - rangeStart) / binWidth);
    const nextCount = (counts.get(binIndex) || 0) + 1;
    counts.set(binIndex, nextCount);
    if (nextCount > maxCount) maxCount = nextCount;
  });
  return maxCount;
}

function createTicks(start, end, step) {
  const ticks = [];
  for (let tick = Math.ceil(start / step) * step; tick <= end; tick += step) {
    ticks.push(tick);
  }
  return ticks;
}

function PanelFrame({ title, subtitle, children }) {
  return (
    <article className="samplemean-card">
      <div className="samplemean-card-head">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {children}
    </article>
  );
}

function PopulationPlot({ population, highlightedIndices }) {
  const width = 760;
  const height = 500;
  const range = [159, 183];
  const topPadding = 82;
  const plotBottomPadding = 84;
  const binWidth = 1;
  const dots = buildHistogramDots(population, binWidth, range[0]);
  const yMax = (Math.max(...dots.map((point) => point.y), 1) + 1) * 1.45;
  const avg = mean(population);
  const ticks = createTicks(range[0], range[1], 2);
  const baselineY = height - plotBottomPadding;

  return (
    <svg className="samplemean-mini-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="모집단 분포">
      {ticks.map((tick) => {
        const x = xPosition(tick, range, width, 52, 24);
        return (
          <g key={tick}>
            <line x1={x} y1={topPadding} x2={x} y2={baselineY} className="samplemean-grid-vertical" />
            <text x={x} y="442" className="samplemean-tick" textAnchor="middle">
              {tick}
            </text>
          </g>
        );
      })}
      {[0.25, 0.5, 0.75].map((ratio) => {
        const y = topPadding + ratio * (baselineY - topPadding);
        return <line key={ratio} x1="52" y1={y} x2="736" y2={y} className="samplemean-grid" />;
      })}
      <line x1="52" y1={baselineY} x2="736" y2={baselineY} className="samplemean-axis" />
      <line x1="52" y1={topPadding} x2="52" y2={baselineY} className="samplemean-axis" />
      <line
        x1={xPosition(avg, range, width, 52, 24)}
        x2={xPosition(avg, range, width, 52, 24)}
        y1={topPadding}
        y2={baselineY}
        className="samplemean-mean-line"
      />
      {dots.map((point, index) => (
        <circle
          key={point.key}
          cx={xPosition(point.x, range, width, 52, 24)}
          cy={yPosition(point.y, yMax, height, topPadding, plotBottomPadding)}
          r={highlightedIndices.has(index) ? 8.8 : 6.4}
          className={highlightedIndices.has(index) ? "samplemean-dot is-highlight" : "samplemean-dot"}
        />
      ))}
      <text x="390" y="480" className="samplemean-axis-label" textAnchor="middle">
        키 (cm)
      </text>
      <text x="18" y="230" className="samplemean-axis-label" textAnchor="middle" transform="rotate(-90 18 230)">
        count
      </text>
    </svg>
  );
}

function CurrentSampleStrip({ sampleValues, sampleSize }) {
  const width = 1280;
  const height = 180;
  const range = [159, 183];
  const avg = sampleValues.length > 0 ? mean(sampleValues) : null;
  const ticks = createTicks(range[0], range[1], 2);
  const random = createSeededRandom(sampleValues.length * 97 + sampleSize * 13 + 7);
  const dots = sampleValues.map((value, index) => ({
    key: `${value}-${index}`,
    x: value,
    yOffset: (random() - 0.5) * 28,
  }));

  return (
    <article className="samplemean-strip-card">
      <svg className="samplemean-strip-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="현재 표본">
        {ticks.map((tick) => {
          const x = xPosition(tick, range, width, 56, 26);
          return (
            <g key={tick}>
              <line x1={x} y1="28" x2={x} y2="112" className="samplemean-grid-vertical" />
              <text x={x} y="146" className="samplemean-tick" textAnchor="middle">
                {tick}
              </text>
            </g>
          );
        })}
        <line x1="56" y1="112" x2="1254" y2="112" className="samplemean-axis" />
        <line
          x1={avg === null ? 56 : xPosition(avg, range, width, 56, 26)}
          x2={avg === null ? 56 : xPosition(avg, range, width, 56, 26)}
          y1="28"
          y2="112"
          className="samplemean-mean-line"
        />
        {dots.map((point) => (
          <circle
            key={point.key}
            cx={xPosition(point.x, range, width, 56, 26)}
            cy={82 + point.yOffset}
            r="7.2"
            className="samplemean-dot is-highlight"
          />
        ))}
        <text x="655" y="172" className="samplemean-axis-label" textAnchor="middle">
          키 (cm)
        </text>
        {avg !== null ? (
          <text x="655" y="24" className="samplemean-current-label" textAnchor="middle">
            {`현재 표본 (n=${sampleSize}) · 표본평균 ${formatNumber(avg, 2)}`}
          </text>
        ) : null}
      </svg>
    </article>
  );
}

function SampleMeanDistributionPlot({
  rounds,
  step,
  sampleMeanCenter,
  theoreticalSe,
  baseStackMax,
  confidenceLevel,
}) {
  const width = 760;
  const height = 500;
  const sampleMeans = rounds.slice(0, step).map((round) => round.mean);
  const range = [159, 183];
  const topPadding = 82;
  const binWidth = 1;
  const dots = sampleMeans.length > 0 ? buildHistogramDots(sampleMeans, binWidth, range[0]) : [];
  const currentStackMax = dots.length > 0 ? Math.max(...dots.map((point) => point.y), 1) + 1 : 2;
  const yMax = Math.max(baseStackMax, currentStackMax) * 1.35;
  const ticks = createTicks(range[0], range[1], 2);
  const df = Math.max((rounds[0]?.values.length || 2) - 1, 1);
  const criticalT = confidenceLevel === "none" ? null : getCriticalT(confidenceLevel, df);
  const criticalBounds =
    criticalT === null
      ? null
      : {
          left: sampleMeanCenter - criticalT * theoreticalSe,
          right: sampleMeanCenter + criticalT * theoreticalSe,
        };

  const curve = [];
  for (let x = range[0]; x <= range[1]; x += 0.05) {
    const standardized = (x - sampleMeanCenter) / Math.max(theoreticalSe, 1e-6);
    curve.push({ x, y: tPdf(standardized, df) });
  }
  const curveYMax = Math.max(...curve.map((point) => point.y), 1e-6);
  const plotBottomPadding = 84;
  const baselineY = height - plotBottomPadding;
  const toCurveX = (value) => xPosition(value, range, width, 52, 24);
  const toCurveY = (value) => yPosition((value / curveYMax) * yMax, yMax, height, topPadding, plotBottomPadding);
  const buildTailPath = (points, closeX) => {
    if (points.length === 0) return null;
    const startX = toCurveX(points[0].x);
    const segments = points
      .map((point, index) => `${index === 0 ? `M ${startX} ${baselineY} L ${toCurveX(point.x)} ${toCurveY(point.y)}` : `L ${toCurveX(point.x)} ${toCurveY(point.y)}`}`)
      .join(" ");
    return `${segments} L ${closeX} ${baselineY} Z`;
  };
  const leftTailPoints = criticalBounds ? curve.filter((point) => point.x <= criticalBounds.left) : [];
  const rightTailPoints = criticalBounds ? curve.filter((point) => point.x >= criticalBounds.right) : [];
  const leftTailPath = criticalBounds ? buildTailPath(leftTailPoints, toCurveX(criticalBounds.left)) : null;
  const rightTailPath = criticalBounds ? buildTailPath(rightTailPoints, toCurveX(range[1])) : null;

  return (
    <svg className="samplemean-mini-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="표본평균의 분포">
      {ticks.map((tick) => {
        const x = xPosition(tick, range, width, 52, 24);
        return (
          <g key={tick}>
            <line x1={x} y1={topPadding} x2={x} y2={baselineY} className="samplemean-grid-vertical" />
            <text x={x} y="442" className="samplemean-tick" textAnchor="middle">
              {formatNumber(tick, 0)}
            </text>
          </g>
        );
      })}
      {[0.25, 0.5, 0.75].map((ratio) => {
        const y = topPadding + ratio * (baselineY - topPadding);
        return <line key={ratio} x1="52" y1={y} x2="736" y2={y} className="samplemean-grid" />;
      })}
      <line x1="52" y1={baselineY} x2="736" y2={baselineY} className="samplemean-axis" />
      <line x1="52" y1={topPadding} x2="52" y2={baselineY} className="samplemean-axis" />
      <line
        x1={xPosition(sampleMeanCenter, range, width, 52, 24)}
        x2={xPosition(sampleMeanCenter, range, width, 52, 24)}
        y1={topPadding}
        y2={baselineY}
        className="samplemean-mean-line"
      />
      {leftTailPath ? <path d={leftTailPath} className="samplemean-critical-fill" /> : null}
      {rightTailPath ? <path d={rightTailPath} className="samplemean-critical-fill" /> : null}
      <path
        d={curve
          .map((point, index) => {
            return `${index === 0 ? "M" : "L"} ${toCurveX(point.x)} ${toCurveY(point.y)}`;
          })
          .join(" ")}
        className="samplemean-curve"
      />
      {dots.map((point, index) => (
        <circle
          key={point.key}
          cx={xPosition(point.x, range, width, 52, 24)}
          cy={yPosition(point.y, yMax, height, topPadding, plotBottomPadding)}
          r={index === dots.length - 1 ? 9.6 : 7.4}
          className={index === dots.length - 1 ? "samplemean-dot is-current" : "samplemean-dot is-samplemean"}
        />
      ))}
      <g className="samplemean-legend" transform="translate(520 76)">
        <line x1="0" y1="0" x2="42" y2="0" className="samplemean-curve" />
        <text x="54" y="6" className="samplemean-legend-label">
          t 분포곡선
        </text>
      </g>
      <text x="390" y="480" className="samplemean-axis-label" textAnchor="middle">
        평균 키 (cm)
      </text>
      <text x="18" y="230" className="samplemean-axis-label" textAnchor="middle" transform="rotate(-90 18 230)">
        count
      </text>
    </svg>
  );
}

export default function SampleMeanDistributionPage() {
  const [populationType, setPopulationType] = useState("normal");
  const [sampleSize, setSampleSize] = useState(3);
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [confidenceLevel, setConfidenceLevel] = useState("none");
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  const population = useMemo(() => createPopulation(populationType), [populationType]);
  const rounds = useMemo(
    () => createSamplingRounds(population, sampleSize, populationType),
    [population, populationType, sampleSize],
  );

  useEffect(() => {
    const updateViewport = () => setIsMobileViewport(window.innerWidth <= 820);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    setStep(0);
    setIsPlaying(false);
  }, [populationType, sampleSize]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    if (step >= MAX_ROUNDS) {
      setIsPlaying(false);
      return undefined;
    }

    const timer = window.setInterval(() => {
      setStep((current) => {
        if (current >= MAX_ROUNDS) {
          window.clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, 220);

    return () => window.clearInterval(timer);
  }, [isPlaying, step]);

  const currentRound = step > 0 ? rounds[step - 1] : null;
  const highlightedIndices = new Set(currentRound ? currentRound.indices : []);
  const populationMean = mean(population);
  const populationStd = standardDeviation(population);
  const populationBaseStackMax = getMaxBinCount(population, 1, 159) + 1;
  const sampleMeans = rounds.slice(0, step).map((round) => round.mean);
  const currentSampleMean = currentRound ? currentRound.mean : null;
  const meanOfMeans = sampleMeans.length > 0 ? mean(sampleMeans) : null;
  const theoreticalSe = populationStd / Math.sqrt(sampleSize);
  const empiricalSe = standardDeviation(sampleMeans);
  const sampleMeanCenter = meanOfMeans ?? populationMean;

  if (isMobileViewport) {
    return (
      <main className="rr-shell samplemean-shell samplemean-mobile-shell">
        <section className="samplemean-mobile-controls">
          <article className="rr-step-slider">
            <span>모집단모양</span>
            <select
              className="samplemean-select"
              value={populationType}
              onChange={(event) => setPopulationType(event.target.value)}
            >
              {POPULATION_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </article>

          <article className="rr-step-slider">
            <span>표집크기</span>
            <select
              className="samplemean-select"
              value={String(sampleSize)}
              onChange={(event) => setSampleSize(Number(event.target.value))}
            >
              {SAMPLE_SIZES.map((size) => (
                <option key={size} value={String(size)}>
                  n={size}
                </option>
              ))}
            </select>
          </article>
        </section>

        <section className="samplemean-mobile-stack">
          <PanelFrame
            title="모집단 분포"
            subtitle={`성인 남성 100명의 키 분포 · 평균 ${formatNumber(populationMean, 2)} · 표준편차 ${formatNumber(populationStd, 2)}`}
          >
            <PopulationPlot population={population} highlightedIndices={highlightedIndices} />
          </PanelFrame>

          <section className="samplemean-sample-strip">
            <CurrentSampleStrip sampleValues={currentRound ? currentRound.values : []} sampleSize={sampleSize} />
          </section>

          <PanelFrame title="표본평균의 분포" subtitle={`반복 ${step}회 누적 · 95% 신뢰수준`}>
            <div className="samplemean-distribution-wrap">
              <SampleMeanDistributionPlot
                rounds={rounds}
                step={step}
                sampleMeanCenter={sampleMeanCenter}
                theoreticalSe={theoreticalSe}
                baseStackMax={populationBaseStackMax}
                confidenceLevel="95"
              />
            </div>
          </PanelFrame>

          <section className="samplemean-mobile-run-row">
            <article className="regswitch-slider-card samplemean-slider-card samplemean-mobile-run-card">
              <div className="regswitch-slider-head">
                <span>반복 표집</span>
                <strong>{step}회</strong>
              </div>
              <div className="samplemean-mobile-run-inline">
                <input
                  type="range"
                  min="0"
                  max={String(MAX_ROUNDS)}
                  value={step}
                  onChange={(event) => setStep(Number(event.target.value))}
                />
                <button type="button" className={isPlaying ? "active" : ""} onClick={() => setIsPlaying((value) => !value)}>
                  {isPlaying ? "정지" : "재생"}
                </button>
              </div>
            </article>
          </section>

          <article className="samplemean-info-card samplemean-mobile-info-card">
            <div className="samplemean-info-grid samplemean-mobile-info-grid">
              <article className="samplemean-info-item">
                <span>모평균</span>
                <strong>{formatNumber(populationMean, 2)}</strong>
              </article>
              <article className="samplemean-info-item">
                <span>표본평균분포의 평균</span>
                <strong>{meanOfMeans === null ? "-" : formatNumber(meanOfMeans, 2)}</strong>
              </article>
              <article className="samplemean-info-item">
                <span>이론적 표준오차</span>
                <strong>{formatNumber(theoreticalSe, 2)}</strong>
              </article>
              <article className="samplemean-info-item">
                <span>경험적 표준오차</span>
                <strong>{formatNumber(empiricalSe, 2)}</strong>
              </article>
            </div>
          </article>
        </section>

        <div className="samplemean-mobile-footer">
          <Link className="secondary-button regswitch-home-button" href="/lab">
            메인으로
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="rr-shell samplemean-shell">
      <header className="rr-header samplemean-header">
        <div>
          <p className="eyebrow">Graph</p>
          <h1>표본평균의 분포</h1>
          <p className="regswitch-formula">반복 표집과 중심극한정리</p>
        </div>
        <div className="lab-header-action-stack">
          <Link className="secondary-button regswitch-home-button" href="/lab">
          메인으로
          </Link>
        </div>
      </header>

      <section className="samplemean-content-grid">
        <div className="samplemean-main">
          <section className="samplemean-layout is-two-up">
            <PanelFrame
              title="모집단 분포"
              subtitle={`성인 남성 100명의 키 분포 · 평균 ${formatNumber(populationMean, 2)} · 표준편차 ${formatNumber(populationStd, 2)}`}
            >
              <PopulationPlot population={population} highlightedIndices={highlightedIndices} />
            </PanelFrame>

            <PanelFrame title="표본평균의 분포" subtitle={`반복 ${step}회 누적`}>
              <div className="samplemean-distribution-wrap">
                <div className="samplemean-confidence-toggle" role="group" aria-label="기각역 선택">
                  {CONFIDENCE_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={confidenceLevel === option.key ? "active" : ""}
                      onClick={() => setConfidenceLevel(option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <SampleMeanDistributionPlot
                  rounds={rounds}
                  step={step}
                  sampleMeanCenter={sampleMeanCenter}
                  theoreticalSe={theoreticalSe}
                  baseStackMax={populationBaseStackMax}
                  confidenceLevel={confidenceLevel}
                />
              </div>
            </PanelFrame>
          </section>

          <section className="samplemean-sample-strip">
            <CurrentSampleStrip sampleValues={currentRound ? currentRound.values : []} sampleSize={sampleSize} />
          </section>
        </div>

        <aside className="samplemean-controls samplemean-controls-side">
          <article className="rr-step-slider">
            <span>모집단 모양</span>
            <select className="samplemean-select" value={populationType} onChange={(event) => setPopulationType(event.target.value)}>
              {POPULATION_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </article>

          <article className="rr-step-slider">
            <span>표집 크기</span>
            <select
              className="samplemean-select"
              value={String(sampleSize)}
              onChange={(event) => setSampleSize(Number(event.target.value))}
            >
              {SAMPLE_SIZES.map((size) => (
                <option key={size} value={String(size)}>
                  n={size}
                </option>
              ))}
            </select>
          </article>

          <article className="rr-step-slider">
            <span>실행</span>
            <div className="regswitch-buttons">
              <button type="button" onClick={() => setStep((value) => Math.min(MAX_ROUNDS, value + 1))}>
                다음
              </button>
              <button type="button" className={isPlaying ? "active" : ""} onClick={() => setIsPlaying((value) => !value)}>
                {isPlaying ? "정지" : "재생"}
              </button>
            </div>
          </article>

          <article className="regswitch-slider-card samplemean-slider-card">
            <div className="regswitch-slider-head">
              <span>반복 표집</span>
              <strong>{step}회</strong>
            </div>
            <input
              type="range"
              min="0"
              max={String(MAX_ROUNDS)}
              value={step}
              onChange={(event) => setStep(Number(event.target.value))}
            />
          </article>
          <article className="samplemean-info-card">
            <div className="samplemean-info-grid">
              <article className="samplemean-info-item">
                <span>모평균</span>
                <strong>{formatNumber(populationMean, 2)}</strong>
              </article>
              <article className="samplemean-info-item">
                <span>표본평균분포의 평균</span>
                <strong>{meanOfMeans === null ? "-" : formatNumber(meanOfMeans, 2)}</strong>
              </article>
              <article className="samplemean-info-item">
                <span>이론적 표준오차</span>
                <strong>{formatNumber(theoreticalSe, 2)}</strong>
              </article>
              <article className="samplemean-info-item">
                <span>경험적 표준오차</span>
                <strong>{formatNumber(empiricalSe, 2)}</strong>
              </article>
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}
