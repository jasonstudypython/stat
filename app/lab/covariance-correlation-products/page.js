"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { downloadCsv } from "../_shared/csv";

const DATASETS = [
  {
    id: "case1",
    title: "사례1",
    x: [1, -2, 0, 2, 1, -1, -1],
    y: [2, -1, 0, 1, -1, -2, 1],
  },
  {
    id: "case2",
    title: "사례2",
    x: [10, -20, 0, 20, 10, -10, -10],
    y: [20, -10, 0, 10, -10, -20, 10],
  },
  {
    id: "case3",
    title: "사례3",
    x: [1, -2, 0, 2, 3, -1, -3],
    y: [2, -1, 0, 1, 3, -2, -3],
  },
];

const CRITICAL_T_BY_DF = {
  5: 2.571,
};

const PRODUCT_COLORS = ["#ef4444", "#2563eb", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#0ea5e9"];

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStd(values) {
  if (values.length <= 1) return 0;
  const average = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function covariance(x, y) {
  const xMean = mean(x);
  const yMean = mean(y);
  return x.reduce((sum, value, index) => sum + (value - xMean) * (y[index] - yMean), 0) / (x.length - 1);
}

function correlation(x, y) {
  const sx = sampleStd(x);
  const sy = sampleStd(y);
  if (sx === 0 || sy === 0) return 0;
  return covariance(x, y) / (sx * sy);
}

function tFromCorrelation(r, n) {
  if (Math.abs(r) >= 1) return r > 0 ? Infinity : -Infinity;
  return r * Math.sqrt((n - 2) / (1 - r ** 2));
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

  let series = 0.9999999999998099;
  const shifted = z - 1;

  for (let index = 0; index < coefficients.length; index += 1) {
    series += coefficients[index] / (shifted + index + 1);
  }

  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(series);
}

function tPdf(x, df) {
  const numerator = Math.exp(logGamma((df + 1) / 2));
  const denominator = Math.sqrt(df * Math.PI) * Math.exp(logGamma(df / 2));
  return (numerator / denominator) * (1 + (x ** 2) / df) ** (-(df + 1) / 2);
}

function betaContinuedFraction(a, b, x) {
  const maxIterations = 200;
  const epsilon = 3e-14;
  const minimum = 1e-30;
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < minimum) d = minimum;
  d = 1 / d;
  let h = d;

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const twice = iteration * 2;
    let aa = (iteration * (b - iteration) * x) / ((qam + twice) * (a + twice));
    d = 1 + aa * d;
    if (Math.abs(d) < minimum) d = minimum;
    c = 1 + aa / c;
    if (Math.abs(c) < minimum) c = minimum;
    d = 1 / d;
    h *= d * c;

    aa = (-((a + iteration) * (qab + iteration) * x)) / ((a + twice) * (qap + twice));
    d = 1 + aa * d;
    if (Math.abs(d) < minimum) d = minimum;
    c = 1 + aa / c;
    if (Math.abs(c) < minimum) c = minimum;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }

  return h;
}

function regularizedIncompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const betaFactor = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) {
    return (betaFactor * betaContinuedFraction(a, b, x)) / a;
  }
  return 1 - (betaFactor * betaContinuedFraction(b, a, 1 - x)) / b;
}

function tCdf(tValue, df) {
  if (!Number.isFinite(tValue)) return tValue > 0 ? 1 : 0;
  const x = df / (df + tValue ** 2);
  const incomplete = regularizedIncompleteBeta(x, df / 2, 0.5);
  if (tValue >= 0) {
    return 1 - 0.5 * incomplete;
  }
  return 0.5 * incomplete;
}

function twoTailedPFromT(tValue, df) {
  if (!Number.isFinite(tValue)) return 0;
  const cumulative = tCdf(Math.abs(tValue), df);
  return Math.max(0, Math.min(1, 2 * (1 - cumulative)));
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "∞";
  return value.toFixed(digits);
}

function createIntegerTicks(limit) {
  const ticks = [];
  const step = limit > 8 ? 5 : limit > 4 ? 2 : 1;
  const boundedLimit = limit > 8 ? Math.floor(limit / 5) * 5 : limit > 4 ? Math.floor(limit / 2) * 2 : limit;
  for (let value = -boundedLimit; value <= boundedLimit; value += step) {
    ticks.push(value);
  }
  return ticks;
}

function arrowHeadPoints(x, y, direction, size = 10) {
  if (direction === "right") {
    return `${x},${y} ${x - size},${y - size * 0.6} ${x - size},${y + size * 0.6}`;
  }
  if (direction === "left") {
    return `${x},${y} ${x + size},${y - size * 0.6} ${x + size},${y + size * 0.6}`;
  }
  if (direction === "up") {
    return `${x},${y} ${x - size * 0.6},${y + size} ${x + size * 0.6},${y + size}`;
  }
  return `${x},${y} ${x - size * 0.6},${y - size} ${x + size * 0.6},${y - size}`;
}

function pointQuadrant(point) {
  if (point.x === 0 && point.y === 0) return 0;
  if (point.x >= 0 && point.y >= 0) return 1;
  if (point.x < 0 && point.y >= 0) return 2;
  if (point.x < 0 && point.y < 0) return 3;
  return 4;
}

function buildDisplayOrder(points) {
  return points
    .map((point, index) => ({ ...point, originalIndex: index }))
    .sort((a, b) => {
      const quadrantDiff = pointQuadrant(a) - pointQuadrant(b);
      if (quadrantDiff !== 0) return quadrantDiff;
      if (a.x !== b.x) return a.x - b.x;
      if (a.y !== b.y) return b.y - a.y;
      return a.originalIndex - b.originalIndex;
    });
}

function CoordinateInnerProductSvg({ dataset, showDecorations, visibleCount, currentProductSum }) {
  const width = 620;
  const height = 620;
  const paddingLeft = 72;
  const paddingRight = 32;
  const paddingTop = 40;
  const paddingBottom = 64;
  const xMean = mean(dataset.x);
  const yMean = mean(dataset.y);
  const centered = dataset.x.map((xValue, index) => ({
    x: xValue - xMean,
    y: dataset.y[index] - yMean,
    product: (xValue - xMean) * (dataset.y[index] - yMean),
  }));
  const orderedPoints = buildDisplayOrder(centered);
  const activePointKeys = new Set(showDecorations ? orderedPoints.slice(0, visibleCount).map((point) => point.originalIndex) : []);
  const maxAbs = Math.max(
    3,
    Math.ceil(Math.max(...centered.map((point) => Math.max(Math.abs(point.x), Math.abs(point.y)))) + 0.5)
  );
  const ticks = createIntegerTicks(maxAbs);
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const xToPx = (value) => paddingLeft + ((value + maxAbs) / (maxAbs * 2)) * plotWidth;
  const yToPx = (value) => paddingTop + ((maxAbs - value) / (maxAbs * 2)) * plotHeight;
  const originX = xToPx(0);
  const originY = yToPx(0);

  return (
    <svg className="corr-plot-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="좌표와 내적 그래프">
      {ticks.map((tick) => {
        const x = xToPx(tick);
        const y = yToPx(tick);
        return (
          <g key={`grid-${tick}`}>
            <line x1={x} y1={paddingTop} x2={x} y2={height - paddingBottom} className="corr-grid-line" />
            <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} className="corr-grid-line" />
            <text x={x} y={height - 22} className="corr-tick" textAnchor="middle">
              {tick}
            </text>
            <text x={38} y={y + 6} className="corr-tick" textAnchor="middle">
              {tick}
            </text>
          </g>
        );
      })}

      <line x1={paddingLeft} y1={originY} x2={width - paddingRight} y2={originY} className="corr-axis" />
      <line x1={originX} y1={paddingTop} x2={originX} y2={height - paddingBottom} className="corr-axis" />

      <text x={width - paddingRight} y={paddingTop - 10} className="corr-observed-label" textAnchor="end">
        {`현재 내적의 합 ${formatNumber(currentProductSum)}`}
      </text>

      {showDecorations
        ? centered.map((point, index) => {
            if (!activePointKeys.has(index)) return null;
            const pointX = xToPx(point.x);
            const pointY = yToPx(point.y);
            const rectX = Math.min(originX, pointX);
            const rectY = Math.min(originY, pointY);
            const rectWidth = Math.abs(pointX - originX);
            const rectHeight = Math.abs(pointY - originY);
            const strokeColor = PRODUCT_COLORS[index % PRODUCT_COLORS.length];
            const horizontalDirection = point.x >= 0 ? "right" : "left";
            const verticalDirection = point.y >= 0 ? "up" : "down";
            const pointRadius = 10;
            const horizontalOffset = ((index % 3) - 1) * 4;
            const verticalOffset = ((index % 3) - 1) * 4;
            const hasHorizontal = point.x !== 0;
            const hasVertical = point.y !== 0;
            const horizontalEndX = point.x >= 0 ? pointX - pointRadius - 4 : pointX + pointRadius + 4;
            const verticalEndY = point.y >= 0 ? pointY + pointRadius + 4 : pointY - pointRadius - 4;
            const hasArea = rectWidth > 18 && rectHeight > 18;
            const productLabelX = hasArea ? rectX + rectWidth / 2 : pointX + (point.x >= 0 ? 20 : -20);
            const productLabelY = hasArea ? rectY + rectHeight / 2 + 5 : pointY + (point.y >= 0 ? 22 : -18);
            return (
              <g key={`decor-${index}`}>
                <rect
                  x={rectX}
                  y={rectY}
                  width={rectWidth}
                  height={rectHeight}
                  className={point.product >= 0 ? "corr-product-box is-positive" : "corr-product-box is-negative"}
                />
                {hasHorizontal ? (
                  <>
                    <line
                      x1={originX}
                      y1={originY + horizontalOffset}
                      x2={horizontalEndX}
                      y2={originY + horizontalOffset}
                      className="corr-guide-line x-guide"
                      style={{ stroke: strokeColor }}
                    />
                    <polygon points={arrowHeadPoints(horizontalEndX, originY + horizontalOffset, horizontalDirection, 10)} fill={strokeColor} />
                  </>
                ) : null}
                {hasVertical ? (
                  <>
                    <line
                      x1={pointX + verticalOffset}
                      y1={originY}
                      x2={pointX + verticalOffset}
                      y2={verticalEndY}
                      className="corr-guide-line y-guide"
                      style={{ stroke: strokeColor }}
                    />
                    <polygon points={arrowHeadPoints(pointX + verticalOffset, verticalEndY, verticalDirection, 10)} fill={strokeColor} />
                  </>
                ) : null}
                <text
                  x={productLabelX}
                  y={productLabelY}
                  className="corr-product-label"
                  textAnchor={hasArea ? "middle" : point.x >= 0 ? "start" : "end"}
                  style={{ fill: strokeColor }}
                >
                  {`xy=${formatNumber(point.product)}`}
                </text>
              </g>
            );
          })
        : null}

      {centered.map((point, index) => (
        <g key={`point-${index}`}>
          <circle cx={xToPx(point.x)} cy={yToPx(point.y)} r="10" className="corr-point" />
          <text
            x={xToPx(point.x) + (point.x >= 0 ? 14 : -14)}
            y={yToPx(point.y) + (point.y >= 0 ? -12 : 24)}
            textAnchor={point.x >= 0 ? "start" : "end"}
            className="corr-point-label"
          >
            ({formatNumber(point.x, 0)}, {formatNumber(point.y, 0)})
          </text>
        </g>
      ))}

      <text x={width / 2} y={height - 6} className="corr-axis-label" textAnchor="middle">
        X
      </text>
      <text x="18" y={height / 2} className="corr-axis-label" textAnchor="middle" transform={`rotate(-90 18 ${height / 2})`}>
        Y
      </text>
    </svg>
  );
}

function TDistributionSvg({ tValue, df, showObserved }) {
  const width = 620;
  const height = 620;
  const paddingLeft = 72;
  const paddingRight = 28;
  const paddingTop = 40;
  const paddingBottom = 64;
  const criticalT = CRITICAL_T_BY_DF[df] ?? 1.96;
  const axisLimit = Math.max(4, Math.ceil(Math.abs(tValue)) + 1.5);
  const xValues = [];
  for (let x = -axisLimit; x <= axisLimit; x += 0.02) {
    xValues.push(x);
  }
  const pdfValues = xValues.map((x) => tPdf(x, df));
  const maxPdf = Math.max(...pdfValues, 0.7);
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const xToPx = (value) => paddingLeft + ((value + axisLimit) / (axisLimit * 2)) * plotWidth;
  const yToPx = (value) => paddingTop + (1 - value / maxPdf) * plotHeight;

  const buildAreaPath = (predicate) => {
    const points = xValues
      .map((x, index) => ({ x, y: pdfValues[index] }))
      .filter((point) => predicate(point.x));
    if (points.length === 0) return "";
    const startX = xToPx(points[0].x);
    const endX = xToPx(points[points.length - 1].x);
    const baselineY = yToPx(0);
    const curvePath = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${xToPx(point.x)} ${yToPx(point.y)}`)
      .join(" ");
    return `${curvePath} L ${endX} ${baselineY} L ${startX} ${baselineY} Z`;
  };

  const curvePath = xValues
    .map((x, index) => `${index === 0 ? "M" : "L"} ${xToPx(x)} ${yToPx(pdfValues[index])}`)
    .join(" ");

  const observedTailLeft = showObserved && Number.isFinite(tValue) ? buildAreaPath((x) => x <= -Math.abs(tValue)) : "";
  const observedTailRight = showObserved && Number.isFinite(tValue) ? buildAreaPath((x) => x >= Math.abs(tValue)) : "";
  const pValue = showObserved ? twoTailedPFromT(tValue, df) : null;
  const observedLabelX = Math.max(paddingLeft + 96, xToPx(tValue) - 14);

  return (
    <svg className="corr-plot-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="t분포 그래프">
      {[-axisLimit, -criticalT, 0, criticalT, axisLimit].map((tick) => (
        <g key={`tick-${tick}`}>
          <line x1={xToPx(tick)} y1={paddingTop} x2={xToPx(tick)} y2={height - paddingBottom} className="corr-grid-line" />
        </g>
      ))}
      {[0.25, 0.5, 0.75].map((ratio) => {
        const y = paddingTop + ratio * plotHeight;
        return <line key={`h-${ratio}`} x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} className="corr-grid-line" />;
      })}

      <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} className="corr-axis" />
      <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={height - paddingBottom} className="corr-axis" />

      <path d={buildAreaPath((x) => x <= -criticalT)} className="corr-tail-fill" />
      <path d={buildAreaPath((x) => x >= criticalT)} className="corr-tail-fill" />
      {observedTailLeft ? <path d={observedTailLeft} className="corr-tail-fill" /> : null}
      {observedTailRight ? <path d={observedTailRight} className="corr-tail-fill" /> : null}
      <path d={curvePath} className="corr-curve" />

      <line x1={xToPx(-criticalT)} y1={paddingTop} x2={xToPx(-criticalT)} y2={height - paddingBottom} className="corr-critical-line" />
      <line x1={xToPx(criticalT)} y1={paddingTop} x2={xToPx(criticalT)} y2={height - paddingBottom} className="corr-critical-line" />
      {showObserved ? (
        <line x1={xToPx(tValue)} y1={paddingTop} x2={xToPx(tValue)} y2={height - paddingBottom} className="corr-observed-line" />
      ) : null}

      <text x={xToPx(-criticalT)} y="72" className="corr-critical-label" textAnchor="middle">
        -{formatNumber(criticalT)}
      </text>
      <text x={xToPx(criticalT)} y="72" className="corr-critical-label" textAnchor="middle">
        {formatNumber(criticalT)}
      </text>
      {showObserved ? (
        <text x={observedLabelX} y="98" className="corr-observed-label" textAnchor="end">
          {`t=${formatNumber(tValue)}`}
        </text>
      ) : null}
      {showObserved && pValue !== null ? (
        <text x={observedLabelX} y="126" className="corr-observed-label" textAnchor="end">
          {`p=${pValue < 0.001 ? "<.001" : formatNumber(pValue, 3)}`}
        </text>
      ) : null}

      {[-axisLimit, -criticalT, 0, criticalT, axisLimit].map((tick) => (
        <text key={`x-${tick}`} x={xToPx(tick)} y={height - 22} className="corr-tick" textAnchor="middle">
          {Number.isInteger(tick) ? tick : tick.toFixed(1)}
        </text>
      ))}

      <text x={width / 2} y={height - 6} className="corr-axis-label" textAnchor="middle">
        t 값
      </text>
      <text x="18" y={height / 2} className="corr-axis-label" textAnchor="middle" transform={`rotate(-90 18 ${height / 2})`}>
        밀도
      </text>
    </svg>
  );
}

export default function CovarianceCorrelationProductsPage() {
  const [datasetId, setDatasetId] = useState(DATASETS[0].id);
  const [showDecorations, setShowDecorations] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const [showTLine, setShowTLine] = useState(false);
  const dataset = useMemo(() => DATASETS.find((item) => item.id === datasetId) ?? DATASETS[0], [datasetId]);

  const stats = useMemo(() => {
    const xMean = mean(dataset.x);
    const yMean = mean(dataset.y);
    const centeredProducts = dataset.x.map((xValue, index) => (xValue - xMean) * (dataset.y[index] - yMean));
    const productSum = centeredProducts.reduce((sum, value) => sum + value, 0);
    const sx = sampleStd(dataset.x);
    const sy = sampleStd(dataset.y);
    const cov = covariance(dataset.x, dataset.y);
    const r = correlation(dataset.x, dataset.y);
    const tValue = tFromCorrelation(r, dataset.x.length);
    const standardError = Math.sqrt((1 - r ** 2) / Math.max(dataset.x.length - 2, 1));
    return { productSum, sx, sy, cov, r, tValue, n: dataset.x.length, standardError };
  }, [dataset]);

  const displayOrder = useMemo(() => {
    const xMean = mean(dataset.x);
    const yMean = mean(dataset.y);
    const centered = dataset.x.map((xValue, index) => ({
      x: xValue - xMean,
      y: dataset.y[index] - yMean,
      product: (xValue - xMean) * (dataset.y[index] - yMean),
    }));
    return buildDisplayOrder(centered);
  }, [dataset]);

  const currentProductSum = useMemo(() => {
    if (!showDecorations || visibleCount <= 0) return 0;
    return displayOrder.slice(0, visibleCount).reduce((sum, point) => sum + point.product, 0);
  }, [displayOrder, showDecorations, visibleCount]);

  useEffect(() => {
    setShowDecorations(false);
    setVisibleCount(0);
    setShowTLine(false);
  }, [datasetId]);

  return (
    <main className="rr-shell tf-shell corr-shell">
      <header className="rr-header tf-header corr-header">
        <div>
          <p className="eyebrow">GRAPH</p>
          <h1>공분산과 상관계수</h1>
        </div>
        <div className="lab-header-action-stack">
          <Link className="secondary-button regswitch-home-button" href="/lab">
          메인으로
          </Link>
          <button
            type="button"
            className="secondary-button regswitch-home-button"
            onClick={() =>
              downloadCsv(
                `covariance-correlation-products-${dataset.id}-jamovi.csv`,
                dataset.x.map((xValue, index) => ({
                  dataset_id: dataset.id,
                  x_value: xValue,
                  y_value: dataset.y[index],
                })),
                [
                  { label: "dataset_id", value: "dataset_id" },
                  { label: "x_value", value: (row) => row.x_value.toFixed(6) },
                  { label: "y_value", value: (row) => row.y_value.toFixed(6) },
                ],
              )
            }
          >
            CSV 다운로드
          </button>
        </div>
      </header>

      <section className="corr-control-row">
        <div className="corr-control-chip">
          <select className="meandiff-select corr-select" value={datasetId} onChange={(event) => setDatasetId(event.target.value)}>
            {DATASETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </div>

        <div className="corr-formula-card" aria-label="공식 정보">
          <span>공분산 = Σ(xy) / (n - 1)</span>
          <strong>상관계수 = 공분산 / (표준편차X × 표준편차Y)</strong>
          <div className="corr-formula-rich">
            <div className="corr-formula-block">
              <span>공분산</span>
              <strong>공분산 = Σ(xy) / (n - 1)</strong>
              <em>{`${formatNumber(stats.cov)} = ${formatNumber(stats.productSum)} / ${stats.n - 1}`}</em>
            </div>
            <div className="corr-formula-block">
              <span>상관계수</span>
              <strong>상관계수 = 공분산 / (표준편차X × 표준편차Y)</strong>
              <em>{`${formatNumber(stats.r)} = ${formatNumber(stats.cov)} / (${formatNumber(stats.sx)} × ${formatNumber(stats.sy)})`}</em>
            </div>
            <div className="corr-formula-block">
              <span>t 값</span>
              <strong>t = (r - ρ₀) / (√(1 - r²) / √(n - 2))</strong>
              <em>{`${formatNumber(stats.tValue)} = (${formatNumber(stats.r)} - 0) / (${formatNumber(Math.sqrt(1 - stats.r ** 2))} / ${formatNumber(Math.sqrt(stats.n - 2))})`}</em>
            </div>
          </div>
        </div>

        <button
          type="button"
          className={`corr-toggle-button ${showDecorations ? "active" : ""}`}
          onClick={() =>
            setShowDecorations((prev) => {
              const next = !prev;
              setVisibleCount(next ? 1 : 0);
              return next;
            })
          }
          aria-pressed={showDecorations}
        >
          내적 계산 표시
        </button>

        <button
          type="button"
          className={`corr-toggle-button ${showDecorations ? "" : "disabled"}`}
          onClick={() => {
            if (!showDecorations) return;
            setVisibleCount((prev) => Math.min(displayOrder.length, prev + 1));
          }}
          disabled={!showDecorations || visibleCount >= displayOrder.length}
        >
          다음
        </button>
      </section>

      <section className="tf-layout tf-layout-two-up corr-layout">
        <article className="rr-graph-card tf-main-card corr-card">
          <div className="rr-graph-head">
            <div>
              <p className="panel-label">Graph</p>
              <h2 className="regswitch-title">{dataset.title}</h2>
            </div>
          </div>
          <div className="corr-plot-wrap">
            <CoordinateInnerProductSvg
              dataset={dataset}
              showDecorations={showDecorations}
              visibleCount={visibleCount}
              currentProductSum={currentProductSum}
            />
          </div>
        </article>

        <article className="rr-graph-card tf-main-card corr-card">
          <div className="rr-graph-head">
            <div>
              <p className="panel-label">Graph</p>
              <h2 className="regswitch-title">상관계수의 통계적 유의성</h2>
            </div>
            <button
              type="button"
              className={`corr-toggle-button ${showTLine ? "active" : ""}`}
              onClick={() => setShowTLine((prev) => !prev)}
              aria-pressed={showTLine}
            >
              t값 표시
            </button>
          </div>
          <div className="corr-plot-wrap">
            <TDistributionSvg tValue={stats.tValue} df={stats.n - 2} showObserved={showTLine} />
          </div>
        </article>
      </section>

      <section className="corr-metric-grid">
        <article className="tf-metric-card">
          <span>내적의 합</span>
          <strong>{formatNumber(stats.productSum)}</strong>
        </article>
        <article className="tf-metric-card">
          <span>X 표준편차</span>
          <strong>{formatNumber(stats.sx)}</strong>
        </article>
        <article className="tf-metric-card">
          <span>Y 표준편차</span>
          <strong>{formatNumber(stats.sy)}</strong>
        </article>
        <article className="tf-metric-card">
          <span>공분산</span>
          <strong>{formatNumber(stats.cov)}</strong>
        </article>
        <article className="tf-metric-card">
          <span>상관계수</span>
          <strong>{formatNumber(stats.r)}</strong>
        </article>
        <article className="tf-metric-card">
          <span>t 값</span>
          <strong>{formatNumber(stats.tValue)}</strong>
        </article>
      </section>
    </main>
  );
}
