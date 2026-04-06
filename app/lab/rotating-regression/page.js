"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const X_VALUES = [1, 1.5, 2, 2.5, 3];
const Y_VALUES = [1, 2, 2, 3, 3];
const SLOPE_STATES = [
  { slope: -1, label: "m = -1", rss: 10.3 },
  { slope: 0, label: "m = 0", rss: 2.8 },
  { slope: 1, label: "최적회귀선", rss: 0.3 },
  { slope: 2, label: "m = 2", rss: 2.8 },
  { slope: 3, label: "m = 3", rss: 10.3 },
];

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function fitOptimalLine(xValues, yValues) {
  const xMean = mean(xValues);
  const yMean = mean(yValues);
  let numerator = 0;
  let denominator = 0;

  for (let index = 0; index < xValues.length; index += 1) {
    numerator += (xValues[index] - xMean) * (yValues[index] - yMean);
    denominator += (xValues[index] - xMean) ** 2;
  }

  const slope = numerator / denominator;
  const intercept = yMean - slope * xMean;
  return { slope, intercept, xMean, yMean };
}

function quadraticFit(xs, ys) {
  const sum = (values) => values.reduce((acc, value) => acc + value, 0);
  const n = xs.length;
  const sx = sum(xs);
  const sx2 = sum(xs.map((x) => x ** 2));
  const sx3 = sum(xs.map((x) => x ** 3));
  const sx4 = sum(xs.map((x) => x ** 4));
  const sy = sum(ys);
  const sxy = sum(xs.map((x, index) => x * ys[index]));
  const sx2y = sum(xs.map((x, index) => x ** 2 * ys[index]));

  const matrix = [
    [sx4, sx3, sx2, sx2y],
    [sx3, sx2, sx, sxy],
    [sx2, sx, n, sy],
  ];

  for (let pivot = 0; pivot < 3; pivot += 1) {
    let maxRow = pivot;
    for (let row = pivot + 1; row < 3; row += 1) {
      if (Math.abs(matrix[row][pivot]) > Math.abs(matrix[maxRow][pivot])) {
        maxRow = row;
      }
    }
    [matrix[pivot], matrix[maxRow]] = [matrix[maxRow], matrix[pivot]];

    const divisor = matrix[pivot][pivot] || 1;
    for (let col = pivot; col < 4; col += 1) {
      matrix[pivot][col] /= divisor;
    }

    for (let row = 0; row < 3; row += 1) {
      if (row === pivot) continue;
      const factor = matrix[row][pivot];
      for (let col = pivot; col < 4; col += 1) {
        matrix[row][col] -= factor * matrix[pivot][col];
      }
    }
  }

  return {
    a: matrix[0][3],
    b: matrix[1][3],
    c: matrix[2][3],
  };
}

function evaluateQuadratic(curve, x) {
  return curve.a * x ** 2 + curve.b * x + curve.c;
}

function derivativeQuadratic(curve, x) {
  return 2 * curve.a * x + curve.b;
}

function residualStats(slope, intercept) {
  const predicted = X_VALUES.map((x) => slope * x + intercept);
  const residuals = Y_VALUES.map((y, index) => y - predicted[index]);
  const squared = residuals.map((value) => value ** 2);
  const rss = squared.reduce((sum, value) => sum + value, 0);
  const absSum = residuals.reduce((sum, value) => sum + Math.abs(value), 0);

  return {
    predicted,
    residuals,
    squared,
    rss,
    absSum,
  };
}

function scaleLinear(value, domainMin, domainMax, rangeMin, rangeMax) {
  const ratio = (value - domainMin) / (domainMax - domainMin || 1);
  return rangeMin + ratio * (rangeMax - rangeMin);
}

function normalizeSignedZero(value) {
  return Math.abs(value) < 0.0000001 ? 0 : value;
}

function RegressionPlot({ slope, intercept, optimalSlope, optimalIntercept, xRange, yRange }) {
  const left = 84;
  const right = 560;
  const top = 34;
  const bottom = 402;

  const toX = (value) => scaleLinear(value, xRange[0], xRange[1], left, right);
  const toY = (value) => scaleLinear(value, yRange[0], yRange[1], bottom, top);
  const currentStats = residualStats(slope, intercept);

  return (
    <svg viewBox="0 0 620 450" className="rr-svg" role="img" aria-label="회귀선과 잔차 그래프">
      <defs>
        <clipPath id="rr-regression-clip">
          <rect x={left} y={top} width={right - left} height={bottom - top} />
        </clipPath>
      </defs>
      <rect x="0" y="0" width="620" height="450" rx="26" className="rr-plot-bg" />
      <line x1={left} y1={bottom} x2={right} y2={bottom} className="rr-axis" />
      <line x1={left} y1={top} x2={left} y2={bottom} className="rr-axis" />

      {Array.from({ length: 4 }, (_, index) => {
        const value = xRange[0] + ((xRange[1] - xRange[0]) * (index + 1)) / 5;
        const x = toX(value);
        return <line key={`vx-${value}`} x1={x} y1={top} x2={x} y2={bottom} className="rr-grid" />;
      })}

      {Array.from({ length: 4 }, (_, index) => {
        const value = yRange[0] + ((yRange[1] - yRange[0]) * (index + 1)) / 5;
        const y = toY(value);
        return <line key={`hy-${value}`} x1={left} y1={y} x2={right} y2={y} className="rr-grid" />;
      })}

      {[0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((value) => (
        <text key={`xt-${value}`} x={toX(value)} y={bottom + 26} textAnchor="middle" className="rr-tick">
          {value}
        </text>
      ))}

      {[-1, 0, 1, 2, 3, 4, 5].map((value) => (
        <text key={`yt-${value}`} x={left - 18} y={toY(value) + 6} textAnchor="end" className="rr-tick">
          {value}
        </text>
      ))}

      <g clipPath="url(#rr-regression-clip)">
        <line
          x1={toX(xRange[0])}
          y1={toY(optimalSlope * xRange[0] + optimalIntercept)}
          x2={toX(xRange[1])}
          y2={toY(optimalSlope * xRange[1] + optimalIntercept)}
          className="rr-optimal-line"
        />

        <line
          x1={toX(xRange[0])}
          y1={toY(slope * xRange[0] + intercept)}
          x2={toX(xRange[1])}
          y2={toY(slope * xRange[1] + intercept)}
          className="rr-current-line"
        />

        {X_VALUES.map((x, index) => (
          <line
            key={`residual-${x}-${index}`}
            x1={toX(x)}
            y1={toY(Y_VALUES[index])}
            x2={toX(x)}
            y2={toY(currentStats.predicted[index])}
            className="rr-residual-line"
          />
        ))}

        {X_VALUES.map((x, index) => (
          <circle key={`point-${x}-${index}`} cx={toX(x)} cy={toY(Y_VALUES[index])} r="7" className="rr-point" />
        ))}
      </g>

      <text x="322" y="446" textAnchor="middle" className="rr-axis-label">
        x
      </text>
      <text x="18" y="220" textAnchor="middle" className="rr-axis-label" transform="rotate(-90 18 220)">
        y
      </text>
    </svg>
  );
}

function RssPlot({ states, currentSlope, currentRss, tangentSlope, showTangent }) {
  const left = 84;
  const right = 560;
  const top = 34;
  const bottom = 402;
  const slopes = states.map((state) => state.slope);
  const rssValues = states.map((state) => state.rss);
  const xRange = [-1.2, 3.2];
  const yRange = [0, 11.5];
  const curve = quadraticFit(slopes, rssValues);

  const toX = (value) => scaleLinear(value, xRange[0], xRange[1], left, right);
  const toY = (value) => scaleLinear(value, yRange[0], yRange[1], bottom, top);

  const curvePoints = Array.from({ length: 200 }, (_, index) => {
    const x = xRange[0] + ((xRange[1] - xRange[0]) * index) / 199;
    const y = evaluateQuadratic(curve, x);
    return `${index === 0 ? "M" : "L"} ${toX(x)} ${toY(y)}`;
  }).join(" ");

  const tangentX1 = xRange[0];
  const tangentX2 = xRange[1];
  const tangentY1 = currentRss + tangentSlope * (tangentX1 - currentSlope);
  const tangentY2 = currentRss + tangentSlope * (tangentX2 - currentSlope);

  return (
    <svg viewBox="0 0 620 450" className="rr-svg" role="img" aria-label="오차제곱합 변화 그래프">
      <defs>
        <clipPath id="rr-rss-clip">
          <rect x={left} y={top} width={right - left} height={bottom - top} />
        </clipPath>
      </defs>
      <rect x="0" y="0" width="620" height="450" rx="26" className="rr-plot-bg" />
      <line x1={left} y1={bottom} x2={right} y2={bottom} className="rr-axis" />
      <line x1={left} y1={top} x2={left} y2={bottom} className="rr-axis" />

      {Array.from({ length: 4 }, (_, index) => {
        const value = xRange[0] + ((xRange[1] - xRange[0]) * (index + 1)) / 5;
        const x = toX(value);
        return <line key={`rvx-${value}`} x1={x} y1={top} x2={x} y2={bottom} className="rr-grid" />;
      })}

      {Array.from({ length: 4 }, (_, index) => {
        const value = yRange[0] + ((yRange[1] - yRange[0]) * (index + 1)) / 5;
        const y = toY(value);
        return <line key={`rhy-${value}`} x1={left} y1={y} x2={right} y2={y} className="rr-grid" />;
      })}

      {[-1, 0, 1, 2, 3].map((value) => (
        <text key={`rx-${value}`} x={toX(value)} y={bottom + 26} textAnchor="middle" className="rr-tick">
          {value}
        </text>
      ))}

      {[0, 2.5, 5, 7.5, 10].map((value) => (
        <text key={`ry-${value}`} x={left - 18} y={toY(value) + 6} textAnchor="end" className="rr-tick">
          {value}
        </text>
      ))}

      <g clipPath="url(#rr-rss-clip)">
        <path d={curvePoints} className="rr-rss-line" />

        {showTangent ? (
          <line
            x1={toX(tangentX1)}
            y1={toY(tangentY1)}
            x2={toX(tangentX2)}
            y2={toY(tangentY2)}
            className="rr-tangent-line"
          />
        ) : null}

        {states.map((state) => (
          <circle key={`rss-point-${state.slope}`} cx={toX(state.slope)} cy={toY(state.rss)} r="6" className="rr-point" />
        ))}

        <circle cx={toX(currentSlope)} cy={toY(currentRss)} r="8" className="rr-rss-point" />
      </g>

      {states.map((state) => (
        <text key={`rss-label-${state.slope}`} x={toX(state.slope) + 10} y={toY(state.rss) + 6} className="rr-rss-label">
          ({state.rss})
        </text>
      ))}

      <text x="322" y="446" textAnchor="middle" className="rr-axis-label">
        x의 기울기
      </text>
      <text x="18" y="220" textAnchor="middle" className="rr-axis-label" transform="rotate(-90 18 220)">
        오차제곱합
      </text>
    </svg>
  );
}

export default function RotatingRegressionPage() {
  const [currentSlope, setCurrentSlope] = useState(1);
  const optimal = useMemo(() => fitOptimalLine(X_VALUES, Y_VALUES), []);
  const rssCurve = useMemo(
    () => quadraticFit(SLOPE_STATES.map((state) => state.slope), SLOPE_STATES.map((state) => state.rss)),
    []
  );
  const currentIntercept = optimal.yMean - currentSlope * optimal.xMean;
  const currentStats = residualStats(currentSlope, currentIntercept);
  const currentRss = evaluateQuadratic(rssCurve, currentSlope);
  const tangentSlope = normalizeSignedZero(derivativeQuadratic(rssCurve, currentSlope));
  const nearestStage = SLOPE_STATES.reduce((closest, state) => {
    if (!closest) return state;
    return Math.abs(state.slope - currentSlope) < Math.abs(closest.slope - currentSlope) ? state : closest;
  }, null);
  const showTangent = nearestStage ? Math.abs(nearestStage.slope - currentSlope) <= 0.04 : false;
  const currentLabel = nearestStage && showTangent ? nearestStage.label : `m = ${currentSlope.toFixed(2)}`;
  const xRange = [0.5, 3.5];
  const yRange = [-1.5, 5.5];

  return (
    <main className="rr-shell regswitch-shell rr-rotating-page">
      <header className="rr-header">
        <div>
          <p className="eyebrow">GRAPH</p>
          <h1>오차와 회귀선의 변화</h1>
        </div>
        <Link className="secondary-button regswitch-home-button" href="/lab">
          메인으로
        </Link>
      </header>

      <section className="rr-graphs">
        <article className="rr-graph-card">
          <div className="rr-graph-head">
            <p className="panel-label">기울기별 회귀선</p>
            <div className="rr-legend">
              <span className="is-optimal">최적 회귀선</span>
              <span className="is-current">현재 회귀선</span>
              <span className="is-point">관측값</span>
            </div>
          </div>
          <RegressionPlot
            slope={currentSlope}
            intercept={currentIntercept}
            optimalSlope={optimal.slope}
            optimalIntercept={optimal.intercept}
            xRange={xRange}
            yRange={yRange}
          />
        </article>

        <article className="rr-graph-card">
          <div className="rr-graph-head">
            <p className="panel-label">오차의 변화</p>
            <div className="rr-legend">
              <span className="is-rss">오차제곱합 곡선</span>
              <span className="is-rss-point">현재 위치</span>
              <span className="is-tangent">접선</span>
            </div>
          </div>
          <RssPlot
            states={SLOPE_STATES}
            currentSlope={currentSlope}
            currentRss={currentRss}
            tangentSlope={tangentSlope}
            showTangent={showTangent}
          />
        </article>
      </section>

      <section className="rr-metrics">
        <article>
          <span>회귀선의 기울기</span>
          <strong>{currentSlope.toFixed(2)}</strong>
        </article>
        <article>
          <span>현재 절편</span>
          <strong>{currentIntercept.toFixed(2)}</strong>
        </article>
        <article>
          <span>오차제곱합 RSS</span>
          <strong>{currentRss.toFixed(2)}</strong>
        </article>
        <article>
          <span>접선의 기울기</span>
          <strong>{tangentSlope.toFixed(2)}</strong>
        </article>
      </section>

      <section className="rr-metrics rr-metrics-single">
        <article>
          <span>현재 회귀식</span>
          <strong>{`Y=${currentSlope.toFixed(2)} X + ${currentIntercept.toFixed(2)}`}</strong>
        </article>
      </section>

      <section className="rr-stepper">
        <button
          type="button"
          onClick={() => setCurrentSlope((value) => Math.max(-1, Number((value - 0.1).toFixed(2))))}
        >
          이전 단계
        </button>
        <label className="rr-step-slider">
          <span>기울기 단계</span>
          <input
            type="range"
            min="-1"
            max="3"
            step="0.01"
            value={currentSlope}
            onChange={(event) => setCurrentSlope(Number(event.target.value))}
          />
          <strong>{currentLabel}</strong>
        </label>
        <button
          type="button"
          onClick={() => setCurrentSlope((value) => Math.min(3, Number((value + 0.1).toFixed(2))))}
        >
          다음 단계
        </button>
      </section>
    </main>
  );
}
