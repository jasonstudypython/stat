"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import rawHeightData from "../../../data_mdis_height.json";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const MAX_ROUNDS = 320;
const SAMPLE_SIZE_OPTIONS = [5, 10, 20, 30];
const CRITICAL_T_005 = {
  8: 2.306,
  18: 2.101,
  38: 2.024,
  58: 2.002,
};

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values) {
  const avg = mean(values);
  return values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / Math.max(values.length - 1, 1);
}

function standardDeviation(values) {
  return Math.sqrt(variance(values));
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function sampleNormal(random, avg = 0, std = 1) {
  const u1 = Math.max(random(), 1e-12);
  const u2 = random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return avg + z * std;
}

function logGamma(z) {
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

  if (z < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  }

  let x = 0.9999999999998099;
  const adjusted = z - 1;
  for (let index = 0; index < coefficients.length; index += 1) {
    x += coefficients[index] / (adjusted + index + 1);
  }

  const t = adjusted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (adjusted + 0.5) * Math.log(t) - t + Math.log(x);
}

function tPdf(x, df) {
  const numerator = Math.exp(logGamma((df + 1) / 2));
  const denominator = Math.sqrt(df * Math.PI) * Math.exp(logGamma(df / 2));
  return numerator / denominator * (1 + (x ** 2) / df) ** (-(df + 1) / 2);
}

function buildFilledCurvePath(points, range, width, height, yMax) {
  if (points.length === 0) return "";
  const startX = xPosition(points[0].x, range, width, 56, 24);
  const endX = xPosition(points[points.length - 1].x, range, width, 56, 24);
  const baselineY = yPosition(0, yMax, height, 52, 92);
  const curvePath = points
    .map((point, index) => {
      const x = xPosition(point.x, range, width, 56, 24);
      const y = yPosition(point.displayY, yMax, height, 52, 92);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  return `${curvePath} L ${endX} ${baselineY} L ${startX} ${baselineY} Z`;
}

function createSyntheticPopulation(avg, std, size, seed) {
  const random = createSeededRandom(seed);
  const rawValues = Array.from({ length: size }, () => sampleNormal(random, 0, 1));
  const rawMean = mean(rawValues);
  const rawStd = Math.max(standardDeviation(rawValues), 1e-6);
  const scaled = rawValues.map((value) => ((value - rawMean) / rawStd) * std + avg);

  // Keep the synthetic groups visually close to a smooth normal shape
  // without extreme tails dominating the small sample illustration.
  const lowerBound = avg - std * 2.35;
  const upperBound = avg + std * 2.35;
  const clipped = scaled.map((value) => Math.min(upperBound, Math.max(lowerBound, value)));

  const clippedMean = mean(clipped);
  const clippedStd = Math.max(standardDeviation(clipped), 1e-6);
  return clipped
    .map((value) => ((value - clippedMean) / clippedStd) * std + avg)
    .sort((a, b) => a - b);
}

function sampleWithReplacement(values, size, random) {
  return Array.from({ length: size }, () => values[Math.floor(random() * values.length)]);
}

function createSamplingRounds(malePopulation, femalePopulation, sampleSize, seed) {
  const random = createSeededRandom(seed);

  return Array.from({ length: MAX_ROUNDS }, () => {
    const maleSample = sampleWithReplacement(malePopulation, sampleSize, random);
    const femaleSample = sampleWithReplacement(femalePopulation, sampleSize, random);
    const maleMean = mean(maleSample);
    const femaleMean = mean(femaleSample);
    const maleVar = variance(maleSample);
    const femaleVar = variance(femaleSample);
    const pooledVariance = (((sampleSize - 1) * maleVar) + ((sampleSize - 1) * femaleVar)) / Math.max(2 * sampleSize - 2, 1);
    const standardError = Math.sqrt(pooledVariance * (2 / sampleSize));
    const diff = maleMean - femaleMean;
    const tValue = diff / Math.max(standardError, 1e-6);

    return {
      maleMean,
      femaleMean,
      diff,
      tValue,
    };
  });
}

function buildCenteredOffsets(count) {
  const offsets = [];
  for (let index = 0; index < count; index += 1) {
    if (index === 0) {
      offsets.push(0);
      continue;
    }
    const level = Math.ceil(index / 2);
    offsets.push((index % 2 === 1 ? 1 : -1) * level);
  }
  return offsets;
}

function buildViolinDots(values, center, binSize = 1, xStep = 0.026) {
  const bins = new Map();
  values.forEach((value, index) => {
    const binIndex = Math.floor(value / binSize);
    const group = bins.get(binIndex) || [];
    group.push({ value, index });
    bins.set(binIndex, group);
  });

  const points = [];
  Array.from(bins.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([binIndex, group]) => {
      const offsets = buildCenteredOffsets(group.length);
      const binCenter = binIndex * binSize + binSize / 2;
      group.forEach((item, index) => {
        points.push({
          key: `${center}-${item.index}`,
          x: center + offsets[index] * xStep,
          y: binCenter,
        });
      });
    });

  return points;
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

function createTicks(start, end, step) {
  const ticks = [];
  for (let tick = Math.ceil(start / step) * step; tick <= end; tick += step) {
    ticks.push(Number(tick.toFixed(6)));
  }
  return ticks;
}

function quantile(sortedValues, q) {
  if (sortedValues.length === 0) return 0;
  const index = (sortedValues.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const ratio = index - lower;
  return sortedValues[lower] * (1 - ratio) + sortedValues[upper] * ratio;
}

function formatNumber(value, digits = 2) {
  return value.toFixed(digits);
}

function DistributionSvg({ mode, visibleRounds, allRounds, sampleSize, assumedActualDifference }) {
  const width = 600;
  const height = 560;

  if (mode === "difference") {
    const allValues = allRounds.map((round) => round.diff);
    const range = [
      Math.floor((Math.min(...allValues) - 1.2) * 2) / 2,
      Math.ceil((Math.max(...allValues) + 1.2) * 2) / 2,
    ];
    const binWidth = 0.25;
    const dots = visibleRounds.length > 0 ? buildHistogramDots(visibleRounds.map((round) => round.diff), binWidth, range[0]) : [];
    const baseStackMax = Math.max(getMaxBinCount(allValues, binWidth, range[0]) + 1, 4);
    const currentStackMax = dots.length > 0 ? Math.max(...dots.map((point) => point.y), 1) + 1 : 2;
    const yMax = Math.max(baseStackMax, currentStackMax) * 1.25;
    const ticks = createTicks(range[0], range[1], 1);
    const markerX = assumedActualDifference;

    return (
      <svg className="samplemean-mini-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="평균 차이의 표집 분포">
        {ticks.map((tick) => {
          const x = xPosition(tick, range, width, 56, 24);
          return (
            <g key={tick}>
              <line x1={x} y1="52" x2={x} y2="468" className="samplemean-grid-vertical" />
              <text x={x} y="500" className="samplemean-tick" textAnchor="middle">
                {tick}
              </text>
            </g>
          );
        })}
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = 52 + ratio * 416;
          return <line key={ratio} x1="56" y1={y} x2="576" y2={y} className="samplemean-grid" />;
        })}
        <line x1="56" y1="468" x2="576" y2="468" className="samplemean-axis" />
        <line x1="56" y1="52" x2="56" y2="468" className="samplemean-axis" />
        <line
          x1={xPosition(markerX, range, width, 56, 24)}
          x2={xPosition(markerX, range, width, 56, 24)}
          y1="52"
          y2="468"
          className="samplemean-mean-line"
        />
        {dots.map((point) => (
          <circle
            key={point.key}
            cx={xPosition(point.x, range, width, 56, 24)}
            cy={yPosition(point.y, yMax, height, 52, 92)}
            r="7.2"
            className="samplemean-dot"
          />
        ))}
        <text
          x={xPosition(markerX, range, width, 56, 24)}
          y="74"
          className="samplemean-annotation"
          textAnchor="middle"
        >
          {markerX.toFixed(2)}
        </text>
        <text x="316" y="540" className="samplemean-axis-label" textAnchor="middle">
          평균 차이 (cm)
        </text>
        {mode === "t" ? (
          <>
            <rect x="242" y="520" width="148" height="32" fill="rgba(255,255,255,0.96)" />
            <text x="316" y="540" className="samplemean-axis-label" textAnchor="middle">
              t값
            </text>
          </>
        ) : null}
        {mode === "t" ? (
          <>
            <rect x="236" y="518" width="160" height="36" fill="rgba(255,255,255,1)" />
            <text x="316" y="540" className="samplemean-axis-label" textAnchor="middle">
              t값
            </text>
          </>
        ) : null}
        {mode === "t" ? (
          <>
            <rect x="232" y="516" width="168" height="40" fill="rgba(255,255,255,1)" />
            <text x="316" y="540" className="samplemean-axis-label" textAnchor="middle">
              t값
            </text>
          </>
        ) : null}
        <text x="18" y="260" className="samplemean-axis-label" textAnchor="middle" transform="rotate(-90 18 260)">
          표집 횟수
        </text>
      </svg>
    );
  }

  const allValues = allRounds.map((round) => (mode === "t" ? round.tValue : round.diff));
  const range = [
    Math.floor((Math.min(...allValues) - 1.2) * 2) / 2,
    Math.ceil((Math.max(...allValues) + 1.2) * 2) / 2,
  ];
  const binWidth = mode === "t" ? 0.15 : 0.25;
  const dots =
    visibleRounds.length > 0
      ? buildHistogramDots(visibleRounds.map((round) => (mode === "t" ? round.tValue : round.diff)), binWidth, range[0])
      : [];
  const baseStackMax = Math.max(getMaxBinCount(allValues, binWidth, range[0]) + 1, 4);
  const currentStackMax = dots.length > 0 ? Math.max(...dots.map((point) => point.y), 1) + 1 : 2;
  const yMax = Math.max(baseStackMax, currentStackMax) * 1.25;
  const ticks = createTicks(range[0], range[1], 1);
  const empiricalMean = assumedActualDifference;
  const empiricalStd = Math.max(standardDeviation(allValues), 0.45);
  const df = sampleSize * 2 - 2;
  const scale = Math.max(empiricalStd, 0.5);
  const curve = [];
  for (let x = range[0]; x <= range[1]; x += 0.05) {
    const standardized = (x - empiricalMean) / scale;
    curve.push({ x, y: tPdf(standardized, df) / scale });
  }
  const curveYMax = Math.max(...curve.map((point) => point.y), 1e-6);

  return (
    <svg className="samplemean-mini-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="t 분포와 표집 통계량">
      {ticks.map((tick) => {
        const x = xPosition(tick, range, width, 56, 24);
        return (
          <g key={tick}>
            <line x1={x} y1="52" x2={x} y2="468" className="samplemean-grid-vertical" />
            <text x={x} y="500" className="samplemean-tick" textAnchor="middle">
              {tick}
            </text>
          </g>
        );
      })}
      {[0.25, 0.5, 0.75].map((ratio) => {
        const y = 52 + ratio * 416;
        return <line key={ratio} x1="56" y1={y} x2="576" y2={y} className="samplemean-grid" />;
      })}
      <line x1="56" y1="468" x2="576" y2="468" className="samplemean-axis" />
      <line x1="56" y1="52" x2="56" y2="468" className="samplemean-axis" />
      <path
        d={curve
          .map((point, index) => {
            const x = xPosition(point.x, range, width, 56, 24);
            const y = yPosition((point.y / curveYMax) * (yMax * 0.72), yMax, height, 52, 92);
            return `${index === 0 ? "M" : "L"} ${x} ${y}`;
          })
          .join(" ")}
        className="samplemean-curve"
      />
      <line
        x1={xPosition(empiricalMean, range, width, 56, 24)}
        x2={xPosition(empiricalMean, range, width, 56, 24)}
        y1="52"
        y2="468"
        className="samplemean-mean-line"
      />
      {dots.map((point) => (
        <circle
          key={point.key}
          cx={xPosition(point.x, range, width, 56, 24)}
          cy={yPosition(point.y, yMax, height, 52, 92)}
          r="7.2"
          className="samplemean-dot"
        />
      ))}
      <text x={xPosition(empiricalMean, range, width, 56, 24)} y="74" className="samplemean-annotation" textAnchor="middle">
        {empiricalMean.toFixed(2)}
      </text>
      <text x="316" y="540" className="samplemean-axis-label" textAnchor="middle">
        t 값
      </text>
      {showTCurve ? (
        <>
          <rect x="210" y="522" width="212" height="30" fill="rgba(255,255,255,1)" />
          <text x="316" y="540" className="samplemean-axis-label" textAnchor="middle">
            t값
          </text>
        </>
      ) : null}
      <text x="18" y="260" className="samplemean-axis-label" textAnchor="middle" transform="rotate(-90 18 260)">
        표집 횟수
      </text>
    </svg>
  );
}

function DistributionSvgClean({ mode, visibleRounds, allRounds, sampleSize, assumedActualDifference }) {
  const width = 600;
  const height = 560;
  const allValues = allRounds.map((round) => (mode === "t" ? round.tValue : round.diff));
  const range = [
    Math.floor((Math.min(...allValues) - 1.2) * 2) / 2,
    Math.ceil((Math.max(...allValues) + 1.2) * 2) / 2,
  ];
  const binWidth = mode === "t" ? 0.15 : 0.25;
  const dots =
    visibleRounds.length > 0
      ? buildHistogramDots(visibleRounds.map((round) => (mode === "t" ? round.tValue : round.diff)), binWidth, range[0])
      : [];
  const baseStackMax = Math.max(getMaxBinCount(allValues, binWidth, range[0]) + 1, 4);
  const currentStackMax = dots.length > 0 ? Math.max(...dots.map((point) => point.y), 1) + 1 : 2;
  const yMax = Math.max(baseStackMax, currentStackMax) * 1.25;
  const ticks = createTicks(range[0], range[1], 1);
  const markerX = mode === "t" ? mean(allRounds.map((round) => round.tValue)) : assumedActualDifference;
  const showTCurve = mode === "t";
  const empiricalStd = Math.max(standardDeviation(allValues), 0.45);
  const df = sampleSize * 2 - 2;
  const theoreticalStd = df > 2 ? Math.sqrt(df / (df - 2)) : 1;
  const scale = Math.max(empiricalStd / theoreticalStd, 0.45);
  const curve = [];

  for (let x = range[0]; x <= range[1]; x += 0.05) {
    const standardized = (x - markerX) / scale;
    curve.push({ x, y: tPdf(standardized, df) / scale });
  }

  const curveYMax = Math.max(...curve.map((point) => point.y), 1e-6);

  return (
    <svg className="samplemean-mini-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="평균 차이 표집 분포">
      {ticks.map((tick) => {
        const x = xPosition(tick, range, width, 56, 24);
        return (
          <g key={tick}>
            <line x1={x} y1="52" x2={x} y2="468" className="samplemean-grid-vertical" />
            <text x={x} y="500" className="samplemean-tick" textAnchor="middle">
              {tick}
            </text>
          </g>
        );
      })}
      {[0.25, 0.5, 0.75].map((ratio) => {
        const y = 52 + ratio * 416;
        return <line key={ratio} x1="56" y1={y} x2="576" y2={y} className="samplemean-grid" />;
      })}
      <line x1="56" y1="468" x2="576" y2="468" className="samplemean-axis" />
      <line x1="56" y1="52" x2="56" y2="468" className="samplemean-axis" />
      {showTCurve ? (
        <path
          d={curve
            .map((point, index) => {
              const x = xPosition(point.x, range, width, 56, 24);
              const y = yPosition((point.y / curveYMax) * (yMax * 0.72), yMax, height, 52, 92);
              return `${index === 0 ? "M" : "L"} ${x} ${y}`;
            })
            .join(" ")}
          className="samplemean-curve"
        />
      ) : null}
      <line
        x1={xPosition(markerX, range, width, 56, 24)}
        x2={xPosition(markerX, range, width, 56, 24)}
        y1="52"
        y2="468"
        className="samplemean-mean-line"
      />
      {dots.map((point) => (
        <circle
          key={point.key}
          cx={xPosition(point.x, range, width, 56, 24)}
          cy={yPosition(point.y, yMax, height, 52, 92)}
          r="7.2"
          className="samplemean-dot"
        />
      ))}
      <text x={xPosition(markerX, range, width, 56, 24)} y="74" className="samplemean-annotation" textAnchor="middle">
        {markerX.toFixed(2)}
      </text>
      <text x="316" y="540" className="samplemean-axis-label" textAnchor="middle">
        {showTCurve ? "t값" : "평균 차이 (cm)"}
      </text>
      <text x="18" y="260" className="samplemean-axis-label" textAnchor="middle" transform="rotate(-90 18 260)">
        표집 횟수
      </text>
    </svg>
  );
}

function DistributionSvgFinal({ mode, visibleRounds, allRounds, sampleSize, assumedActualDifference }) {
  const width = 600;
  const height = 560;
  const allValues = allRounds.map((round) => round.diff);
  const range = [
    Math.floor((Math.min(...allValues) - 1.2) * 2) / 2,
    Math.ceil((Math.max(...allValues) + 1.2) * 2) / 2,
  ];
  const binWidth = 0.25;
  const dots = visibleRounds.length > 0 ? buildHistogramDots(visibleRounds.map((round) => round.diff), binWidth, range[0]) : [];
  const baseStackMax = Math.max(getMaxBinCount(allValues, binWidth, range[0]) + 1, 4);
  const currentStackMax = dots.length > 0 ? Math.max(...dots.map((point) => point.y), 1) + 1 : 2;
  const yMax = Math.max(baseStackMax, currentStackMax) * 1.25;
  const ticks = createTicks(range[0], range[1], 1);
  const markerX = mode === "t" ? mean(allRounds.map((round) => round.tValue)) : assumedActualDifference;
  const showTCurve = mode === "t";
  const empiricalStd = Math.max(standardDeviation(allValues), 0.45);
  const df = sampleSize * 2 - 2;
  const theoreticalStd = df > 2 ? Math.sqrt(df / (df - 2)) : 1;
  const scale = Math.max(empiricalStd / theoreticalStd, 0.45);
  const curve = [];

  for (let x = range[0]; x <= range[1]; x += 0.05) {
    const standardized = (x - markerX) / scale;
    curve.push({ x, y: tPdf(standardized, df) / scale });
  }

  const curveYMax = Math.max(...curve.map((point) => point.y), 1e-6);

  return (
    <svg className="samplemean-mini-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="평균 차이 표집 분포">
      {ticks.map((tick) => {
        const x = xPosition(tick, range, width, 56, 24);
        return (
          <g key={tick}>
            <line x1={x} y1="52" x2={x} y2="468" className="samplemean-grid-vertical" />
            <text x={x} y="500" className="samplemean-tick" textAnchor="middle">
              {tick}
            </text>
          </g>
        );
      })}
      {[0.25, 0.5, 0.75].map((ratio) => {
        const y = 52 + ratio * 416;
        return <line key={ratio} x1="56" y1={y} x2="576" y2={y} className="samplemean-grid" />;
      })}
      <line x1="56" y1="468" x2="576" y2="468" className="samplemean-axis" />
      <line x1="56" y1="52" x2="56" y2="468" className="samplemean-axis" />
      {showTCurve ? (
        <path
          d={curve
            .map((point, index) => {
              const x = xPosition(point.x, range, width, 56, 24);
              const y = yPosition((point.y / curveYMax) * (yMax * 0.72), yMax, height, 52, 92);
              return `${index === 0 ? "M" : "L"} ${x} ${y}`;
            })
            .join(" ")}
          className="samplemean-curve"
        />
      ) : null}
      <line
        x1={xPosition(markerX, range, width, 56, 24)}
        x2={xPosition(markerX, range, width, 56, 24)}
        y1="52"
        y2="468"
        className="samplemean-mean-line"
      />
      {dots.map((point) => (
        <circle
          key={point.key}
          cx={xPosition(point.x, range, width, 56, 24)}
          cy={yPosition(point.y, yMax, height, 52, 92)}
          r="7.2"
          className="samplemean-dot"
        />
      ))}
      <text x={xPosition(markerX, range, width, 56, 24)} y="74" className="samplemean-annotation" textAnchor="middle">
        {markerX.toFixed(2)}
      </text>
      <text x="316" y="540" className="samplemean-axis-label" textAnchor="middle">
        {showTCurve ? "t값" : "평균 차이 (cm)"}
      </text>
      <text x="18" y="260" className="samplemean-axis-label" textAnchor="middle" transform="rotate(-90 18 260)">
        표집 횟수
      </text>
    </svg>
  );
}

function DistributionSvgFinal2({ mode, visibleRounds, allRounds, sampleSize, assumedActualDifference }) {
  const width = 600;
  const height = 560;
  const showTCurve = mode === "t";
  const allDiffs = allRounds.map((round) => round.diff);
  const visibleDiffs = visibleRounds.map((round) => round.diff);
  const diffMean = mean(allDiffs);
  const diffStd = Math.max(standardDeviation(allDiffs), 1e-6);
  const empiricalTMean = mean(allRounds.map((round) => round.tValue));
  const empiricalTStd = Math.max(standardDeviation(allRounds.map((round) => round.tValue)), 0.6);
  const mapDiffToTScale = (value) => ((value - diffMean) / diffStd) * empiricalTStd + empiricalTMean;
  const displayedValues = showTCurve ? allDiffs.map(mapDiffToTScale) : allDiffs;
  const visibleValues = showTCurve ? visibleDiffs.map(mapDiffToTScale) : visibleDiffs;
  const sortedValues = [...displayedValues].sort((a, b) => a - b);
  const empiricalMean = mean(displayedValues);
  const minValue = sortedValues[0];
  const maxValue = sortedValues[sortedValues.length - 1];
  const qLow = quantile(sortedValues, 0.02);
  const qHigh = quantile(sortedValues, 0.98);
  const spreadFromCenter = Math.max(
    empiricalMean - minValue,
    maxValue - empiricalMean,
    empiricalMean - qLow,
    qHigh - empiricalMean,
    showTCurve ? 2.2 : 4
  );
  const rangePadding = showTCurve ? 0.5 : 0.8;
  const range = [empiricalMean - spreadFromCenter - rangePadding, empiricalMean + spreadFromCenter + rangePadding];
  const binCount = 24;
  const binWidth = (range[1] - range[0]) / binCount;
  const dots = visibleValues.length > 0 ? buildHistogramDots(visibleValues, binWidth, range[0]) : [];
  const baseStackMax = Math.max(getMaxBinCount(displayedValues, binWidth, range[0]) + 1, 4);
  const currentStackMax = dots.length > 0 ? Math.max(...dots.map((point) => point.y), 1) + 1 : 2;
  const yMax = Math.max(baseStackMax, currentStackMax) * 1.25;
  const tickCount = 7;
  const ticks = Array.from({ length: tickCount }, (_, index) => range[0] + ((range[1] - range[0]) * index) / (tickCount - 1));
  const markerX = empiricalMean;
  const df = sampleSize * 2 - 2;
  const displayedStd = Math.max(standardDeviation(displayedValues), showTCurve ? 0.6 : 0.45);
  const theoreticalStd = df > 2 ? Math.sqrt(df / (df - 2)) : 1;
  const scale = Math.max(displayedStd / theoreticalStd, 0.6);
  const curve = [];

  for (let x = range[0]; x <= range[1]; x += 0.05) {
    const standardized = (x - markerX) / scale;
    curve.push({ x, y: tPdf(standardized, df) / scale });
  }

  const curveYMax = Math.max(...curve.map((point) => point.y), 1e-6);

  return (
    <svg className="samplemean-mini-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="평균 차이 표집 분포">
      {ticks.map((tick) => {
        const x = xPosition(tick, range, width, 56, 24);
        return (
          <g key={tick}>
            <line x1={x} y1="52" x2={x} y2="468" className="samplemean-grid-vertical" />
            <text x={x} y="500" className="samplemean-tick" textAnchor="middle">
              {showTCurve ? tick.toFixed(1) : tick.toFixed(1)}
            </text>
          </g>
        );
      })}
      {[0.25, 0.5, 0.75].map((ratio) => {
        const y = 52 + ratio * 416;
        return <line key={ratio} x1="56" y1={y} x2="576" y2={y} className="samplemean-grid" />;
      })}
      <line x1="56" y1="468" x2="576" y2="468" className="samplemean-axis" />
      <line x1="56" y1="52" x2="56" y2="468" className="samplemean-axis" />
      {showTCurve ? (
        <path
          d={curve
            .map((point, index) => {
              const x = xPosition(point.x, range, width, 56, 24);
              const y = yPosition((point.y / curveYMax) * (yMax * 0.72), yMax, height, 52, 92);
              return `${index === 0 ? "M" : "L"} ${x} ${y}`;
            })
            .join(" ")}
          className="samplemean-curve"
        />
      ) : null}
      <line
        x1={xPosition(markerX, range, width, 56, 24)}
        x2={xPosition(markerX, range, width, 56, 24)}
        y1="52"
        y2="468"
        className="samplemean-mean-line"
      />
      {dots.map((point) => (
        <circle
          key={point.key}
          cx={xPosition(point.x, range, width, 56, 24)}
          cy={yPosition(point.y, yMax, height, 52, 92)}
          r="7.2"
          className="samplemean-dot"
        />
      ))}
      <text x={xPosition(markerX, range, width, 56, 24)} y="74" className="samplemean-annotation" textAnchor="middle">
        {markerX.toFixed(2)}
      </text>
      <text x="316" y="540" className="samplemean-axis-label" textAnchor="middle">
        {showTCurve ? "t값" : "평균 차이 (cm)"}
      </text>
      <text x="18" y="260" className="samplemean-axis-label" textAnchor="middle" transform="rotate(-90 18 260)">
        표집 횟수
      </text>
    </svg>
  );
}

function DistributionSvgFinal3({ mode, visibleRounds, allRounds, sampleSize, centerValue = null, forceCenterZero = false }) {
  const width = 600;
  const height = 560;
  const showTCurve = mode === "t";
  const fixedRange = showTCurve ? [-3.5, 9.9] : [-7.8, 21.7];
  const allDiffs = allRounds.map((round) => round.diff);
  const visibleDiffs = visibleRounds.map((round) => round.diff);
  const diffMean = mean(allDiffs);
  const diffStd = Math.max(standardDeviation(allDiffs), 1e-6);
  const empiricalTMean = forceCenterZero ? 0 : mean(allRounds.map((round) => round.tValue));
  const empiricalTStd = Math.max(standardDeviation(allRounds.map((round) => round.tValue)), 0.6);
  const mapDiffToTScale = (value) => ((value - diffMean) / diffStd) * empiricalTStd + empiricalTMean;
  const displayedValuesRaw = showTCurve ? allDiffs.map(mapDiffToTScale) : allDiffs;
  const visibleValuesRaw = showTCurve ? visibleDiffs.map(mapDiffToTScale) : visibleDiffs;
  const displayedValues = displayedValuesRaw.filter((value) => value >= fixedRange[0] && value <= fixedRange[1]);
  const visibleValues = visibleValuesRaw.filter((value) => value >= fixedRange[0] && value <= fixedRange[1]);
  const sortedValues = [...displayedValues].sort((a, b) => a - b);
  const empiricalMean = centerValue ?? mean(displayedValues);
  const range = fixedRange;
  const binCount = 24;
  const binWidth = (range[1] - range[0]) / binCount;
  const dots = visibleValues.length > 0 ? buildHistogramDots(visibleValues, binWidth, range[0]) : [];
  const baseStackMax = Math.max(getMaxBinCount(displayedValues, binWidth, range[0]) + 1, 4);
  const currentStackMax = dots.length > 0 ? Math.max(...dots.map((point) => point.y), 1) + 1 : 2;
  const yMax = Math.max(baseStackMax, currentStackMax) * 1.25;
  const tickCount = 7;
  const ticks = Array.from({ length: tickCount }, (_, index) => range[0] + ((range[1] - range[0]) * index) / (tickCount - 1));
  const markerX = centerValue ?? empiricalMean;
  const df = sampleSize * 2 - 2;
  const displayedStd = Math.max(standardDeviation(displayedValues), showTCurve ? 0.6 : 0.45);
  const theoreticalStd = df > 2 ? Math.sqrt(df / (df - 2)) : 1;
  const scale = Math.max(displayedStd / theoreticalStd, 0.6);
  const criticalT = CRITICAL_T_005[df] ?? 1.96;
  const curve = [];

  for (let x = range[0]; x <= range[1]; x += 0.05) {
    const standardized = (x - markerX) / scale;
    curve.push({ x, y: tPdf(standardized, df) / scale });
  }

  const curveYMax = Math.max(...curve.map((point) => point.y), 1e-6);
  const curveWithDisplayY = curve.map((point) => ({
    ...point,
    displayY: (point.y / curveYMax) * (yMax * 0.72),
  }));
  const criticalLow = markerX - criticalT * scale;
  const criticalHigh = markerX + criticalT * scale;
  const leftTailPath = buildFilledCurvePath(
    curveWithDisplayY.filter((point) => point.x <= criticalLow),
    range,
    width,
    height,
    yMax
  );
  const rightTailPath = buildFilledCurvePath(
    curveWithDisplayY.filter((point) => point.x >= criticalHigh),
    range,
    width,
    height,
    yMax
  );

  return (
    <svg className="samplemean-mini-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="평균 차이 표집 분포">
      {ticks.map((tick) => {
        const x = xPosition(tick, range, width, 56, 24);
        return (
          <g key={`${mode}-${tick.toFixed(2)}`}>
            <line x1={x} y1="52" x2={x} y2="468" className="samplemean-grid-vertical" />
            <text x={x} y="500" className="samplemean-tick" textAnchor="middle">
              {tick.toFixed(1)}
            </text>
          </g>
        );
      })}
      {[0.25, 0.5, 0.75].map((ratio) => {
        const y = 52 + ratio * 416;
        return <line key={ratio} x1="56" y1={y} x2="576" y2={y} className="samplemean-grid" />;
      })}
      <line x1="56" y1="468" x2="576" y2="468" className="samplemean-axis" />
      <line x1="56" y1="52" x2="56" y2="468" className="samplemean-axis" />
      {showTCurve && leftTailPath ? <path d={leftTailPath} fill="rgba(248,118,104,0.28)" stroke="none" /> : null}
      {showTCurve && rightTailPath ? <path d={rightTailPath} fill="rgba(248,118,104,0.28)" stroke="none" /> : null}
      {showTCurve ? (
        <path
          d={curveWithDisplayY
            .map((point, index) => {
              const x = xPosition(point.x, range, width, 56, 24);
              const y = yPosition(point.displayY, yMax, height, 52, 92);
              return `${index === 0 ? "M" : "L"} ${x} ${y}`;
            })
            .join(" ")}
          className="samplemean-curve"
        />
      ) : null}
      <line
        x1={xPosition(markerX, range, width, 56, 24)}
        x2={xPosition(markerX, range, width, 56, 24)}
        y1="52"
        y2="468"
        className="samplemean-mean-line"
      />
      {dots.map((point) => (
        <circle
          key={point.key}
          cx={xPosition(point.x, range, width, 56, 24)}
          cy={yPosition(point.y, yMax, height, 52, 92)}
          r="6.6"
          className="samplemean-dot"
        />
      ))}
      <text x={xPosition(markerX, range, width, 56, 24)} y="74" className="samplemean-annotation" textAnchor="middle">
        {markerX.toFixed(2)}
      </text>
      <text x="316" y="540" className="samplemean-axis-label" textAnchor="middle">
        {showTCurve ? "t값" : "평균 차이 (cm)"}
      </text>
      <text x="18" y="260" className="samplemean-axis-label" textAnchor="middle" transform="rotate(-90 18 260)">
        표집 횟수
      </text>
    </svg>
  );
}

export default function MeanDifferenceDistributionPage() {
  const [sampleSize, setSampleSize] = useState(10);
  const [roundsShown, setRoundsShown] = useState(0);
  const [populationMode, setPopulationMode] = useState("actual");
  const [distributionMode, setDistributionMode] = useState("difference");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const updateMobile = () => setIsMobile(window.innerWidth <= 820);
    updateMobile();
    window.addEventListener("resize", updateMobile);
    return () => window.removeEventListener("resize", updateMobile);
  }, []);

  const effectiveSampleSize = isMobile ? 10 : sampleSize;
  const effectiveDistributionMode = isMobile ? "t" : distributionMode;

  const grouped = useMemo(() => {
    const male = rawHeightData.filter((row) => row.sex === "남").map((row) => Number(row.height));
    const female = rawHeightData.filter((row) => row.sex === "여").map((row) => Number(row.height));
    return { male, female };
  }, []);

  const baseStats = useMemo(() => {
    return {
      maleMean: mean(grouped.male),
      femaleMean: mean(grouped.female),
      maleStd: standardDeviation(grouped.male),
      femaleStd: standardDeviation(grouped.female),
      pooledMean: mean([...grouped.male, ...grouped.female]),
    };
  }, [grouped]);

  const populations = useMemo(() => {
    const useNull = populationMode === "null";
    const maleMean = useNull ? baseStats.pooledMean : baseStats.maleMean;
    const femaleMean = useNull ? baseStats.pooledMean : baseStats.femaleMean;
    return {
      male: createSyntheticPopulation(maleMean, baseStats.maleStd, 100, useNull ? 1301 : 1101),
      female: createSyntheticPopulation(femaleMean, baseStats.femaleStd, 100, useNull ? 2301 : 2101),
    };
  }, [baseStats, populationMode]);

  const rounds = useMemo(
    () =>
      createSamplingRounds(
        populations.male,
        populations.female,
        effectiveSampleSize,
        7000 + effectiveSampleSize * 17 + (populationMode === "null" ? 1 : 0)
      ),
    [effectiveSampleSize, populationMode, populations]
  );

  const visibleRounds = rounds.slice(0, roundsShown);
  const malePopulationMean = mean(populations.male);
  const femalePopulationMean = mean(populations.female);
  const meanDifference = femalePopulationMean - malePopulationMean;
  const cardMeanDifference = malePopulationMean - femalePopulationMean;
  const meanArrowX = 0.5;
  const meanArrowMid = (malePopulationMean + femalePopulationMean) / 2;
  const pooledPopulationVariance =
    (
      ((effectiveSampleSize - 1) * variance(populations.male)) +
      ((effectiveSampleSize - 1) * variance(populations.female))
    ) / Math.max(2 * effectiveSampleSize - 2, 1);
  const effectiveStandardError = Math.sqrt(pooledPopulationVariance * (2 / effectiveSampleSize));
  const effectiveTValue = cardMeanDifference / Math.max(effectiveStandardError, 1e-6);
  const desktopPooledPopulationVariance =
    (
      ((sampleSize - 1) * variance(populations.male)) +
      ((sampleSize - 1) * variance(populations.female))
    ) / Math.max(2 * sampleSize - 2, 1);
  const desktopStandardError = Math.sqrt(desktopPooledPopulationVariance * (2 / sampleSize));
  const desktopTValue = cardMeanDifference / Math.max(desktopStandardError, 1e-6);
  const leftPlotData = useMemo(() => {
    const maleDots = buildViolinDots(populations.male, 0);
    const femaleDots = buildViolinDots(populations.female, 1);
    return {
      maleDots,
      femaleDots,
      yRange: [
        Math.floor(Math.min(...populations.male, ...populations.female) - 4),
        Math.ceil(Math.max(...populations.male, ...populations.female) + 4),
      ],
    };
  }, [populations]);

  const summaryText = useMemo(() => {
    if (roundsShown === 0) {
      return effectiveDistributionMode === "difference"
        ? "반복 표집을 시작하면 평균 차이 도트가 쌓입니다."
        : "반복 표집을 시작하면 t 값 도트가 쌓입니다.";
    }
    const current = visibleRounds[visibleRounds.length - 1];
    return effectiveDistributionMode === "difference"
      ? `현재 평균 차이 ${formatNumber(current.diff)}cm`
      : `현재 t 값 ${formatNumber(current.tValue)}`;
  }, [effectiveDistributionMode, roundsShown, visibleRounds]);

  return (
    <main className="rr-shell tf-shell meandiff-shell">
      <header className="rr-header tf-header meandiff-header">
        <div>
          <p className="eyebrow">GRAPH</p>
          <h1>영가설 분포</h1>
        </div>
        <div className="lab-header-action-stack">
          <Link className="secondary-button regswitch-home-button" href="/lab">
          메인으로
          </Link>
        </div>
      </header>

      <section className="tf-layout tf-layout-two-up">
        <article className="rr-graph-card tf-main-card">
          <div className="rr-graph-head">
            <div>
              <p className="panel-label">Graph</p>
              <h2 className="regswitch-title">
                {populationMode === "actual" ? "남성과 여성의 키 분포" : "평균 차이가 0인 영가설의 분포"}
              </h2>
              <p className="regswitch-formula">
                남성 평균 {formatNumber(malePopulationMean)}cm / 여성 평균 {formatNumber(femalePopulationMean)}cm
              </p>
            </div>
            {isMobile ? (
              <div className="meandiff-mobile-select-row">
                <select
                  className="meandiff-select"
                  value={populationMode}
                  onChange={(event) => {
                    setPopulationMode(event.target.value);
                    setRoundsShown(0);
                  }}
                >
                  <option value="actual">실제 분포</option>
                  <option value="null">영가설 분포</option>
                </select>
              </div>
            ) : (
              <div className="tf-analysis-toggle">
                <button
                  type="button"
                  className={populationMode === "actual" ? "active" : ""}
                  onClick={() => {
                    setPopulationMode("actual");
                    setRoundsShown(0);
                  }}
                >
                  실제 분포
                </button>
                <button
                  type="button"
                  className={populationMode === "null" ? "active" : ""}
                  onClick={() => {
                    setPopulationMode("null");
                    setRoundsShown(0);
                  }}
                >
                  영가설 분포
                </button>
              </div>
            )}
          </div>

          {isMobile ? (
            <section className="tf-metric-grid is-three meandiff-mobile-metrics">
              <article className="tf-metric-card">
                <span>평균 차이</span>
                <strong>{formatNumber(cardMeanDifference)}</strong>
              </article>
              <article className="tf-metric-card">
                <span>표준오차</span>
                <strong>{formatNumber(effectiveStandardError)}</strong>
              </article>
              <article className="tf-metric-card">
                <span>평균 차이의 t값</span>
                <strong>{formatNumber(effectiveTValue)}</strong>
              </article>
            </section>
          ) : null}

          <div className="tf-plot-wrap meandiff-left-plot">
            <Plot
              data={[
                {
                  type: "violin",
                  x0: 0,
                  y: populations.male,
                  width: 0.56,
                  line: { color: "#ef4444", width: 2 },
                  fillcolor: "rgba(248,118,104,0.22)",
                  box: { visible: false },
                  meanline: { visible: false },
                  points: false,
                  hovertemplate: "남성<br>키=%{y:.1f}cm<extra></extra>",
                  showlegend: false,
                },
                {
                  type: "scatter",
                  mode: "markers",
                  x: leftPlotData.maleDots.map((point) => point.x),
                  y: leftPlotData.maleDots.map((point) => point.y),
                  marker: {
                    size: 9.4,
                    color: "rgba(248,118,104,0.72)",
                    line: { color: "rgba(255,255,255,0.92)", width: 1 },
                  },
                  hovertemplate: "남성<br>키=%{y:.1f}cm<extra></extra>",
                  showlegend: false,
                },
                {
                  type: "violin",
                  x0: 1,
                  y: populations.female,
                  width: 0.56,
                  line: { color: "#2563eb", width: 2 },
                  fillcolor: "rgba(99,102,241,0.22)",
                  box: { visible: false },
                  meanline: { visible: false },
                  points: false,
                  hovertemplate: "여성<br>키=%{y:.1f}cm<extra></extra>",
                  showlegend: false,
                },
                {
                  type: "scatter",
                  mode: "markers",
                  x: leftPlotData.femaleDots.map((point) => point.x),
                  y: leftPlotData.femaleDots.map((point) => point.y),
                  marker: {
                    size: 9.4,
                    color: "rgba(99,102,241,0.68)",
                    line: { color: "rgba(255,255,255,0.92)", width: 1 },
                  },
                  hovertemplate: "여성<br>키=%{y:.1f}cm<extra></extra>",
                  showlegend: false,
                },
              ]}
              layout={{
                autosize: true,
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: "rgba(255,255,255,0.98)",
                font: { family: "Pretendard, Noto Sans KR, sans-serif", color: "#112d4e", size: 16 },
                margin: { l: 70, r: 36, t: 24, b: 68 },
                showlegend: false,
                shapes: [
                  {
                    type: "line",
                    x0: -0.2,
                    x1: 0.2,
                    y0: malePopulationMean,
                    y1: malePopulationMean,
                    line: { color: "#ef4444", width: 3 },
                  },
                  {
                    type: "line",
                    x0: 0.8,
                    x1: 1.2,
                    y0: femalePopulationMean,
                    y1: femalePopulationMean,
                    line: { color: "#2563eb", width: 3 },
                  },
                  {
                    type: "line",
                    x0: meanArrowX,
                    x1: meanArrowX,
                    y0: malePopulationMean,
                    y1: femalePopulationMean,
                    line: { color: "#0f766e", width: 3 },
                  },
                ],
                annotations: [
                  {
                    x: 0.24,
                    y: malePopulationMean,
                    text: formatNumber(malePopulationMean),
                    showarrow: false,
                    xanchor: "left",
                    yanchor: "middle",
                    font: { size: 12, color: "#ef4444" },
                    bgcolor: "rgba(255,255,255,0.92)",
                    bordercolor: "rgba(239,68,68,0.14)",
                    borderpad: 2,
                  },
                  {
                    x: 1.24,
                    y: femalePopulationMean,
                    text: formatNumber(femalePopulationMean),
                    showarrow: false,
                    xanchor: "left",
                    yanchor: "middle",
                    font: { size: 12, color: "#2563eb" },
                    bgcolor: "rgba(255,255,255,0.92)",
                    bordercolor: "rgba(37,99,235,0.14)",
                    borderpad: 2,
                  },
                  {
                    x: meanArrowX,
                    y: femalePopulationMean,
                    axref: "x",
                    ayref: "y",
                    ax: meanArrowX,
                    ay: meanArrowMid,
                    text: "",
                    showarrow: true,
                    arrowhead: 3,
                    arrowsize: 1,
                    arrowwidth: 2,
                    arrowcolor: "#0f766e",
                  },
                  {
                    x: meanArrowX,
                    y: malePopulationMean,
                    axref: "x",
                    ayref: "y",
                    ax: meanArrowX,
                    ay: meanArrowMid,
                    text: "",
                    showarrow: true,
                    arrowhead: 3,
                    arrowsize: 1,
                    arrowwidth: 2,
                    arrowcolor: "#0f766e",
                  },
                  {
                    x: meanArrowX + 0.08,
                    y: meanArrowMid,
                    text: `${formatNumber(meanDifference)}cm`,
                    showarrow: false,
                    xanchor: "left",
                    yanchor: "middle",
                    font: { size: 13, color: "#0f766e" },
                    bgcolor: "rgba(255,255,255,0.94)",
                    bordercolor: "rgba(15,118,110,0.18)",
                    borderpad: 3,
                  },
                ],
                xaxis: {
                  title: { text: "집단", standoff: 14 },
                  tickmode: "array",
                  tickvals: [0, 1],
                  ticktext: ["남성", "여성"],
                  range: [-0.5, 1.5],
                  showgrid: false,
                },
                yaxis: {
                  title: { text: "키 (cm)", standoff: 14 },
                  range: leftPlotData.yRange,
                  showgrid: true,
                  gridcolor: "rgba(17,45,78,0.08)",
                },
                uirevision: `meandiff-left-${populationMode}`,
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>

          {!isMobile ? (
          <section className="tf-metric-grid is-three">
            <article className="tf-metric-card">
              <span>평균 차이</span>
              <strong>{formatNumber(cardMeanDifference)}</strong>
            </article>
            <article className="tf-metric-card">
              <span>평균 차이의 표준오차</span>
              <strong>{formatNumber(desktopStandardError)}</strong>
            </article>
            <article className="tf-metric-card">
              <span>평균 차이의 t값</span>
              <strong>{formatNumber(desktopTValue)}</strong>
            </article>
          </section>
          ) : null}
        </article>

        <article className="rr-graph-card tf-small-card">
          <div className="rr-graph-head">
            <div>
              <p className="panel-label">Graph</p>
              <h2 className="regswitch-title">
                {distributionMode === "difference" ? "평균 차이의 표집 분포" : "t값의 표집 분포"}
              </h2>
            </div>
            {!isMobile ? (
            <div className="meandiff-control-row">
                <select
                  className="meandiff-select"
                  value={effectiveSampleSize}
                  onChange={(event) => {
                    setSampleSize(Number(event.target.value));
                    setRoundsShown(0);
                  }}
                  disabled={isMobile}
                >
                  {SAMPLE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      표집 크기 {option}
                    </option>
                  ))}
                </select>
              <div className="tf-analysis-toggle" style={isMobile ? { display: "none" } : undefined}>
                <button
                  type="button"
                  className="meandiff-hidden-toggle"
                  onClick={() => setDistributionMode("difference")}
                >
                  실제 분포
                </button>
                <button
                  type="button"
                  className={distributionMode === "t" ? "active" : ""}
                  onClick={() => setDistributionMode((current) => (current === "t" ? "difference" : "t"))}
                >
                  t분포 곡선
                </button>
              </div>
            </div>
            ) : null}
          </div>

          <div className="tf-small-plot tf-side-plot meandiff-svg-wrap">
            <DistributionSvgFinal3
              mode={effectiveDistributionMode}
              visibleRounds={visibleRounds}
              allRounds={rounds}
              sampleSize={effectiveSampleSize}
              centerValue={populationMode === "null" ? 0 : effectiveDistributionMode === "t" ? effectiveTValue : null}
              forceCenterZero={populationMode === "null"}
            />
            <div className="meandiff-axis-caption" aria-hidden="true">
              {effectiveDistributionMode === "t" ? "t값" : "평균 차이 (cm)"}
            </div>
          </div>

          <section className="regswitch-slider-card meandiff-slider-card">
            <div className="regswitch-slider-head">
              <span>반복 표집</span>
              <strong>{roundsShown}회</strong>
            </div>
            <input
              type="range"
              min="0"
              max={String(MAX_ROUNDS)}
              step="1"
              value={roundsShown}
              onChange={(event) => setRoundsShown(Number(event.target.value))}
            />
          </section>
        </article>
      </section>
    </main>
  );
}
