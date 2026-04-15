"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { downloadCsv } from "../_shared/csv";
import { useMobileFitScale } from "../_shared/useMobileFitScale";

const REG1_OLS_POINTS = [
  { x: 3.496714153, y: 3.4475037704 },
  { x: 2.8617356988, y: 4.3570069417 },
  { x: 3.6476885381, y: 3.8170956567 },
  { x: 4.5230298564, y: 3.7326594637 },
  { x: 2.7658466253, y: 3.7941957687 },
  { x: 2.7658630431, y: 2.7725096965 },
  { x: 4.5792128155, y: 4.3940382053 },
  { x: 3.7674347292, y: 2.9038823026 },
  { x: 2.5305256141, y: 2.6011697826 },
  { x: 3.5425600436, y: 3.8697106397 },
  { x: 2.5365823072, y: 3.6375244436 },
  { x: 2.5342702464, y: 3.3528192638 },
  { x: 3.2419622716, y: 3.5631569946 },
  { x: 1.0867197553, y: 2.3928080299 },
  { x: 1.2750821675, y: 1.8982800886 },
  { x: 2.4377124708, y: 2.8589341312 },
  { x: 1.9871688797, y: 2.7632650544 },
  { x: 3.3142473326, y: 4.1856847794 },
  { x: 2.0919759245, y: 3.217797107 },
  { x: 1.5876962987, y: 1.9123280717 },
  { x: 4.4656487689, y: 4.3948663692 },
  { x: 2.7742236995, y: 3.1945707095 },
  { x: 3.0675282047, y: 3.1953031022 },
  { x: 1.5752518138, y: 3.0934640513 },
  { x: 2.4556172755, y: 3.743308399 },
  { x: 3.1109225897, y: 4.0211013544 },
  { x: 1.8490064226, y: 2.5048944497 },
  { x: 3.3756980183, y: 3.5332428212 },
  { x: 2.3993613101, y: 3.3653123707 },
  { x: 2.7083062502, y: 3.8419256887 },
];

const INTERCEPT = 1.7956648002398894;
const SLOPE = 0.5511242797154046;
const ERROR_LABEL_INDEX = 7;
const MODE_ESTIMATE = "추정과 오차";
const MODE_OLS = "최소제곱법";
const MODE_MODEL = "모형의 설명력과 유의성";
const OLS_SLOPE_MIN = 0;
const OLS_SLOPE_MAX = SLOPE * 2;
const DEFAULT_OLS_ANGLE_PROGRESS = 0.5;
const MODEL_ALPHA = 0.05;
const MODE_REJECTION = "잔차와 회귀분석의 기본가정";

function arrowHeadPoints(x, y, angleRad, size = 10) {
  const left = angleRad + Math.PI * 0.82;
  const right = angleRad - Math.PI * 0.82;
  return `${x},${y} ${x + Math.cos(left) * size},${y - Math.sin(left) * size} ${x + Math.cos(right) * size},${y - Math.sin(right) * size}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalPdf(value, mean, stdDev) {
  const safeStd = Math.max(stdDev, 1e-6);
  const z = (value - mean) / safeStd;
  return Math.exp(-0.5 * z * z) / (safeStd * Math.sqrt(2 * Math.PI));
}

function erfApprox(value) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
      Math.exp(-x * x);
  return sign * y;
}

function normalCdf(value, mean = 0, stdDev = 1) {
  const safeStd = Math.max(stdDev, 1e-6);
  return 0.5 * (1 + erfApprox((value - mean) / (safeStd * Math.sqrt(2))));
}

function buildOlsVectors(points, slope) {
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  return points.map((point, index) => {
    const predicted = meanY + slope * (point.x - meanX);
    return {
      index,
      point,
      predicted,
      sstValue: Math.abs(point.y - meanY),
      ssrValue: Math.abs(predicted - meanY),
      sseValue: Math.abs(point.y - predicted),
    };
  });
}

function logGamma(z) {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    0.000009984369578019572,
    0.00000015056327351493116,
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

function betaFunction(a, b) {
  return Math.exp(logGamma(a) + logGamma(b) - logGamma(a + b));
}

function fPdf(x, d1, d2) {
  if (x <= 0) return 0;
  const a = d1 / 2;
  const b = d2 / 2;
  const numerator = (d1 / d2) ** a * x ** (a - 1);
  const denominator = betaFunction(a, b) * (1 + (d1 / d2) * x) ** (a + b);
  return numerator / denominator;
}

function approximateFCritical(alpha, d1, d2, maxX = 14, steps = 6000) {
  const dx = maxX / steps;
  let area = 0;
  for (let index = 1; index <= steps; index += 1) {
    const x0 = (index - 1) * dx;
    const x1 = index * dx;
    area += ((fPdf(x0, d1, d2) + fPdf(x1, d1, d2)) / 2) * dx;
    if (area >= 1 - alpha) {
      return x1;
    }
  }
  return maxX;
}

function approximateFPValue(fValue, d1, d2, maxX = 60, steps = 12000) {
  if (fValue <= 0) {
    return 1;
  }

  const upperBound = Math.max(maxX, fValue * 1.5);
  const dx = upperBound / steps;
  let tailArea = 0;

  for (let index = 1; index <= steps; index += 1) {
    const x0 = (index - 1) * dx;
    const x1 = index * dx;
    if (x1 <= fValue) {
      continue;
    }

    const start = Math.max(x0, fValue);
    tailArea += ((fPdf(start, d1, d2) + fPdf(x1, d1, d2)) / 2) * (x1 - start);
  }

  return Math.max(0, Math.min(1, tailArea));
}

function OlsErrorCurve({ width, height, values, currentSlope, showCurrentPoint = true }) {
  const paddingLeft = 58;
  const paddingRight = 24;
  const paddingTop = 18;
  const paddingBottom = 42;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const minX = Math.min(...values.map((item) => item.slope));
  const maxX = Math.max(...values.map((item) => item.slope));
  const minY = 0;
  const rawMaxY = Math.max(...values.map((item) => item.sse));
  const maxY = Math.max(14, Math.ceil(rawMaxY / 5) * 5);
  const ySpan = maxY - minY;
  const xToPx = (value) => paddingLeft + ((value - minX) / (maxX - minX)) * plotWidth;
  const yToPx = (value) => paddingTop + plotHeight - ((value - minY) / ySpan) * plotHeight;
  const path = values
    .map((item, index) => `${index === 0 ? "M" : "L"} ${xToPx(item.slope)} ${yToPx(item.sse)}`)
    .join(" ");
  const currentPoint =
    values.reduce(
      (closest, item) => (Math.abs(item.slope - currentSlope) < Math.abs(closest.slope - currentSlope) ? item : closest),
      values[0]
    ) ?? values[0];
  const xTicks = [
    minX,
    minX + (maxX - minX) * 0.25,
    SLOPE,
    minX + (maxX - minX) * 0.75,
    maxX,
  ];
  const yTicks = [0, maxY / 2, maxY];

  return (
    <svg className="reg1intro-mini-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="오차제곱합 그래프">
      {xTicks.map((tick) => (
        <g key={`x-${tick}`}>
          <line x1={xToPx(tick)} y1={paddingTop} x2={xToPx(tick)} y2={height - paddingBottom} className="reg1intro-mini-grid" />
          <text x={xToPx(tick)} y={height - 18} className="reg1intro-mini-tick" textAnchor="middle">
            {tick.toFixed(2)}
          </text>
        </g>
      ))}
      {yTicks.map((tick, index) => (
        <g key={`y-${index}`}>
          <line x1={paddingLeft} y1={yToPx(tick)} x2={width - paddingRight} y2={yToPx(tick)} className="reg1intro-mini-grid" />
          <text x={paddingLeft - 12} y={yToPx(tick) + 4} className="reg1intro-mini-tick" textAnchor="end">
            {tick.toFixed(0)}
          </text>
        </g>
      ))}
      <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} className="reg1intro-mini-axis" />
      <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={height - paddingBottom} className="reg1intro-mini-axis" />
      <path d={path} className="reg1intro-mini-curve" />
      {showCurrentPoint ? (
        <>
          <line
            x1={xToPx(currentPoint.slope)}
            y1={yToPx(currentPoint.sse)}
            x2={xToPx(currentPoint.slope)}
            y2={height - paddingBottom}
            className="reg1intro-mini-guide"
          />
          <circle cx={xToPx(currentPoint.slope)} cy={yToPx(currentPoint.sse)} r="5.5" className="reg1intro-mini-point" />
        </>
      ) : null}
      <text x={width / 2} y={height - 2} className="reg1intro-mini-label" textAnchor="middle">
        x의 기울기
      </text>
      <text
        x="18"
        y={height / 2}
        className="reg1intro-mini-label"
        textAnchor="middle"
        transform={`rotate(-90 18 ${height / 2})`}
      >
        오차제곱합
      </text>
    </svg>
  );
}

function FDistributionCurve({ width, height, fValue, criticalValue }) {
  const paddingLeft = 58;
  const paddingRight = 24;
  const paddingTop = 18;
  const paddingBottom = 42;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const maxX = Math.max(10, fValue * 1.15, criticalValue * 1.25);
  const xValues = Array.from({ length: 700 }, (_, index) => 0.001 + (index / 699) * maxX);
  const yValues = xValues.map((value) => fPdf(value, 1, REG1_OLS_POINTS.length - 2));
  const maxY = 1;
  const xToPx = (value) => paddingLeft + (value / maxX) * plotWidth;
  const yToPx = (value) => paddingTop + plotHeight - (value / maxY) * plotHeight;
  const curvePath = xValues.map((value, index) => `${index === 0 ? "M" : "L"} ${xToPx(value)} ${yToPx(yValues[index])}`).join(" ");
  const rejectionPath = [
    `M ${xToPx(criticalValue)} ${yToPx(0)}`,
    ...xValues
      .map((value, index) => ({ value, density: yValues[index] }))
      .filter((entry) => entry.value >= criticalValue)
      .map((entry) => `L ${xToPx(entry.value)} ${yToPx(entry.density)}`),
    `L ${xToPx(maxX)} ${yToPx(0)}`,
    "Z",
  ].join(" ");
  const currentX = Math.min(fValue, maxX);
  const currentY = fPdf(currentX, 1, REG1_OLS_POINTS.length - 2);
  const xTicks = [0, 2, 4, 6, 8, 10].filter((tick) => tick <= maxX);
  const yTicks = [0, maxY * 0.33, maxY * 0.66].map((tick) => Number(tick.toFixed(2)));

  return (
    <svg className="reg1intro-mini-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="F 분포 그래프">
      {xTicks.map((tick) => (
        <g key={`fx-${tick}`}>
          <line x1={xToPx(tick)} y1={paddingTop} x2={xToPx(tick)} y2={height - paddingBottom} className="reg1intro-mini-grid" />
          <text x={xToPx(tick)} y={height - 18} className="reg1intro-mini-tick" textAnchor="middle">
            {tick}
          </text>
        </g>
      ))}
      {yTicks.map((tick, index) => (
        <g key={`fy-${index}`}>
          <line x1={paddingLeft} y1={yToPx(tick)} x2={width - paddingRight} y2={yToPx(tick)} className="reg1intro-mini-grid" />
          <text x={paddingLeft - 12} y={yToPx(tick) + 4} className="reg1intro-mini-tick" textAnchor="end">
            {tick.toFixed(2)}
          </text>
        </g>
      ))}
      <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} className="reg1intro-mini-axis" />
      <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={height - paddingBottom} className="reg1intro-mini-axis" />
      <path d={rejectionPath} className="reg1intro-mini-rejection" />
      <path d={curvePath} className="reg1intro-mini-curve" />
      <line x1={xToPx(criticalValue)} y1={paddingTop} x2={xToPx(criticalValue)} y2={height - paddingBottom} className="reg1intro-mini-critical" />
      <line x1={xToPx(currentX)} y1={paddingTop} x2={xToPx(currentX)} y2={height - paddingBottom} className="reg1intro-mini-guide" />
      <circle cx={xToPx(currentX)} cy={yToPx(currentY)} r="5.5" className="reg1intro-mini-point" />
      <text x={xToPx(criticalValue)} y={paddingTop + 14} className="reg1intro-mini-tick" textAnchor="middle">
        {criticalValue.toFixed(2)}
      </text>
      <text x={xToPx(currentX)} y={paddingTop + 34} className="reg1intro-mini-tick" textAnchor="middle">
        F={fValue.toFixed(2)}
      </text>
      <text x={width / 2} y={height - 2} className="reg1intro-mini-label" textAnchor="middle">
        F값
      </text>
    </svg>
  );
}

function RegressionScatterSvg({
  points,
  mode,
  step,
  sst,
  ssr,
  sse,
  olsVisibleCount,
  showSquares,
  showErrorValues,
  olsAngleProgress,
  rejectionX,
  rejectionStep,
  showAllRejectionCurves,
  compact = false,
}) {
  const width = compact ? 900 : 900;
  const height = compact ? 600 : 760;
  const paddingLeft = compact ? 82 : 92;
  const paddingRight = compact ? 28 : 42;
  const paddingTop = compact ? 24 : 42;
  const paddingBottom = compact ? 60 : 84;
  const xMin = 0;
  const xMax = 5;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;

  const showEstimateMode = mode === MODE_ESTIMATE;
  const showOlsModes = mode === MODE_OLS || mode === MODE_MODEL;
  const showRejectionMode = mode === MODE_REJECTION;
  const showRejectionStepOne = showRejectionMode && rejectionStep === 1;
  const showRejectionStepTwo = showRejectionMode && rejectionStep === 2;
  const showRejectionStepThree = showRejectionMode && rejectionStep === 3;
  const rejectionResidualScale = 1;
  const showStepOne = showEstimateMode && step >= 1;
  const showStepTwo = showEstimateMode && step >= 2;
  const showStepThree = showEstimateMode && step >= 3;
  const showStepFour = showEstimateMode && step >= 4;
  const shadowY = showStepThree ? null : showStepTwo ? INTERCEPT : 0;

  const rejectionVectorsBase = buildOlsVectors(points, SLOPE).map((item) => ({
    ...item,
    residual: item.point.y - item.predicted,
    residualDisplay: (item.point.y - item.predicted) * rejectionResidualScale,
  }));
  const residualExtent = 2.5;
  const displayYMin = showRejectionMode && !showRejectionStepOne ? -residualExtent : 0;
  const displayYMax = showRejectionMode && !showRejectionStepOne ? residualExtent : 5;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const xToPx = (value) => paddingLeft + ((value - xMin) / (xMax - xMin)) * plotWidth;
  const yToPx = (value) =>
    paddingTop + (1 - (value - displayYMin) / (displayYMax - displayYMin)) * plotHeight;
  const xTicks = [0, 1, 2, 3, 4, 5];
  const yTicks =
    showRejectionMode && !showRejectionStepOne
      ? [
          -Math.ceil(residualExtent),
          -Math.ceil(residualExtent / 2),
          0,
          Math.ceil(residualExtent / 2),
          Math.ceil(residualExtent),
        ]
      : [0, 1, 2, 3, 4, 5];
  const squareLegendItems = [
    sst ? { key: "sst", label: "SST", className: "reg1intro-sst-square" } : null,
    ssr ? { key: "ssr", label: "SSR", className: "reg1intro-ssr-square" } : null,
    sse ? { key: "sse", label: "SSE", className: "reg1intro-sse-square" } : null,
  ].filter(Boolean);

  const estimateAngle = Math.atan(SLOPE);
  const interceptPointX = xToPx(0);
  const interceptPointY = yToPx(INTERCEPT);
  const arcRadius = 62;
  const arcCenterOffsetX = 10;
  const arcCenterX = interceptPointX + arcCenterOffsetX;
  const arcEndX = arcCenterX + Math.cos(estimateAngle) * arcRadius;
  const arcEndY = interceptPointY - Math.sin(estimateAngle) * arcRadius;
  const estimateLineStart = { x: 0, y: INTERCEPT };
  const estimateLineEnd = { x: 5, y: INTERCEPT + SLOPE * 5 };

  const olsSlope = OLS_SLOPE_MIN + (OLS_SLOPE_MAX - OLS_SLOPE_MIN) * olsAngleProgress;
  const olsIntercept = meanY - olsSlope * meanX;
  const olsLineStart = { x: 0, y: meanY + olsSlope * (0 - meanX) };
  const olsLineEnd = { x: 5, y: meanY + olsSlope * (5 - meanX) };
  const olsVectors = buildOlsVectors(points, olsSlope);
  const fixedLabelVectors = buildOlsVectors(points, SLOPE);
  const fixedOrderIndices = [...fixedLabelVectors]
    .sort((a, b) => b.sseValue - a.sseValue)
    .map((item) => item.index);
  const displayedIntercept = showEstimateMode ? INTERCEPT : olsIntercept;
  const displayedSlope = showEstimateMode ? SLOPE : olsSlope;
  const equationLabel = `Ŷ = ${displayedIntercept.toFixed(3)} + ${displayedSlope.toFixed(3)}X`;

  const olsVisibleIndices = new Set(
    fixedOrderIndices.slice(0, olsVisibleCount)
  );
  const olsLabeledIndices = new Set(
    fixedOrderIndices.slice(0, Math.min(3, olsVisibleCount))
  );

  const showMeanLine = showOlsModes && (sst || ssr);
  const showRegressionLine = (showEstimateMode && step >= 3) || (showOlsModes && (ssr || sse));
  const residualStd = Math.sqrt(
    points.reduce((sum, point) => {
      const predicted = INTERCEPT + SLOPE * point.x;
      return sum + (point.y - predicted) ** 2;
    }, 0) / Math.max(points.length - 2, 1)
  );
  const sortedPoints = rejectionVectorsBase
    .map((item) => ({ ...item.point, index: item.index }))
    .sort((left, right) => left.x - right.x || left.y - right.y);
  const activeRejectionX = clamp(rejectionX, xMin, xMax);
  const nearestRejectionPoint = sortedPoints.reduce(
    (closest, point) =>
      Math.abs(point.x - activeRejectionX) < Math.abs(closest.x - activeRejectionX) ? point : closest,
    sortedPoints[0]
  );
  const showRejectionDistribution = Math.abs(nearestRejectionPoint.x - activeRejectionX) <= 0.055;
  const rejectionAnchorX = showRejectionDistribution ? nearestRejectionPoint.x : activeRejectionX;
  const rejectionMeanY = showRejectionStepOne ? INTERCEPT + SLOPE * rejectionAnchorX : 0;
  const rejectionCritical = showRejectionStepOne ? 1.96 * residualStd : 1.96 * residualStd * rejectionResidualScale;
  const rejectionLower = rejectionMeanY - rejectionCritical;
  const rejectionUpper = rejectionMeanY + rejectionCritical;
  const histogramAnchorX = 4.55;
  const showRejectionVisual = showRejectionStepThree ? true : showRejectionDistribution;
  const curveAnchorX = showRejectionStepThree ? histogramAnchorX : rejectionAnchorX;
  const rejectionCurveMaxWidth = showRejectionStepThree ? 104 : 48;
  const buildRejectionSegments = (meanYValue) => {
    const segments = [];
    for (
      let sampleY = Math.max(displayYMin, meanYValue - residualStd * 3);
      sampleY <= Math.min(displayYMax, meanYValue + residualStd * 3);
      sampleY += 0.03
    ) {
      segments.push({
        y: sampleY,
        width:
          (normalPdf(sampleY, meanYValue, residualStd) /
            normalPdf(meanYValue, meanYValue, residualStd)) *
          rejectionCurveMaxWidth,
      });
    }
    return segments;
  };
  const rejectionSegments = buildRejectionSegments(rejectionMeanY);
  const buildRejectionCurvePath = (anchorXValue, meanYValue) =>
    buildRejectionSegments(meanYValue)
      .map((segment, index) => `${index === 0 ? "M" : "L"} ${xToPx(anchorXValue) - segment.width} ${yToPx(segment.y)}`)
      .join(" ");
  const rejectionLeftPath = rejectionSegments
    .map(
      (segment, index) =>
        `${index === 0 ? "M" : "L"} ${xToPx(curveAnchorX) - segment.width} ${yToPx(segment.y)}`
    )
    .join(" ");
  const rejectionRightPath = rejectionSegments
    .map(
      (segment, index) =>
        `${index === 0 ? "M" : "L"} ${xToPx(curveAnchorX) + segment.width} ${yToPx(segment.y)}`
    )
    .join(" ");
  const buildRejectionTailPath = (startY, endY) => {
    const tailSegments = rejectionSegments.filter((segment) => segment.y >= startY && segment.y <= endY);
    if (tailSegments.length < 2) return null;
    const centerPath = tailSegments
      .map(
        (segment, index) =>
          `${index === 0 ? "M" : "L"} ${xToPx(curveAnchorX)} ${yToPx(segment.y)}`
      )
      .join(" ");
    const leftPath = [...tailSegments]
      .reverse()
      .map((segment) => `L ${xToPx(curveAnchorX) - segment.width} ${yToPx(segment.y)}`)
      .join(" ");
    return `${centerPath} ${leftPath} Z`;
  };
  const lowerTailPath = buildRejectionTailPath(
    Math.max(displayYMin, rejectionMeanY - residualStd * 3),
    Math.min(displayYMax, rejectionLower)
  );
  const upperTailPath = buildRejectionTailPath(
    Math.max(displayYMin, rejectionUpper),
    Math.min(displayYMax, rejectionMeanY + residualStd * 3)
  );
  const residualBinSize = 0.18;
  const histogramStacks = new Map();
  const residualHistogramPoints = rejectionVectorsBase.map((item) => {
    const binValue = Math.round(item.residualDisplay / residualBinSize) * residualBinSize;
    const count = histogramStacks.get(binValue) ?? 0;
    histogramStacks.set(binValue, count + 1);
    return {
      index: item.index,
      x: histogramAnchorX - count * 0.12,
      y: binValue,
    };
  });
  const activeHistogramPoint =
    residualHistogramPoints.find((item) => item.index === nearestRejectionPoint.index) ?? residualHistogramPoints[0];
  return (
    <svg className="reg1intro-plot-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="회귀 그래프">
      <defs>
        <clipPath id="reg1intro-plot-clip">
          <rect x={paddingLeft} y={paddingTop} width={plotWidth} height={plotHeight} />
        </clipPath>
      </defs>
      {xTicks.map((tick) => (
        <g key={`grid-${tick}`}>
          <line x1={xToPx(tick)} y1={paddingTop} x2={xToPx(tick)} y2={height - paddingBottom} className="reg1intro-grid-line" />
          <text x={xToPx(tick)} y={height - 28} className="reg1intro-tick" textAnchor="middle">
            {showRejectionStepThree ? "" : tick}
          </text>
        </g>
      ))}
      {yTicks.map((tick) => (
        <g key={`y-grid-${tick}`}>
          <line x1={paddingLeft} y1={yToPx(tick)} x2={width - paddingRight} y2={yToPx(tick)} className="reg1intro-grid-line" />
          <text x={48} y={yToPx(tick) + 6} className="reg1intro-tick" textAnchor="middle">
            {tick}
          </text>
        </g>
      ))}

      {showOlsModes ? (
        <text
          x={width - paddingRight - 12}
          y={height - paddingBottom - 18}
          className="reg1intro-equation-label"
          textAnchor="end"
        >
          {equationLabel}
        </text>
      ) : null}

      <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} className="reg1intro-axis" />
      <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={height - paddingBottom} className="reg1intro-axis" />

      <g clipPath="url(#reg1intro-plot-clip)">
      {showRejectionMode && !showRejectionStepOne ? (
        <line x1={paddingLeft} y1={yToPx(0)} x2={width - paddingRight} y2={yToPx(0)} className="reg1intro-ms-mean-line" />
      ) : null}
      {showOlsModes && showSquares
        ? olsVectors.map(({ index, point, predicted }) => {
            if (!olsVisibleIndices.has(index)) {
              return null;
            }

            const squares = [];
            const addSquare = (topValue, bottomValue, className) => {
              const side = Math.abs(yToPx(topValue) - yToPx(bottomValue));
              if (side < 4) {
                return;
              }
              const anchorX = xToPx(point.x);
              const topPx = Math.min(yToPx(topValue), yToPx(bottomValue));
              const rightRoom = width - paddingRight - anchorX;
              const rectX = rightRoom >= side + 6 ? anchorX : anchorX - side;
              squares.push(<rect key={`${className}-${index}`} x={rectX} y={topPx} width={side} height={side} className={className} />);
            };

            if (sst) {
              addSquare(meanY, point.y, "reg1intro-sst-square");
            }
            if (ssr) {
              addSquare(meanY, predicted, "reg1intro-ssr-square");
            }
            if (sse) {
              addSquare(predicted, point.y, "reg1intro-sse-square");
            }

            return <g key={`square-${index}`}>{squares}</g>;
          })
        : null}

      {showOlsModes
        ? olsVectors.map(({ index, point, predicted }) => {
            if (!olsVisibleIndices.has(index)) {
              return null;
            }

            const activeCount = Number(Boolean(sst)) + Number(Boolean(ssr)) + Number(Boolean(sse));
            const offsetUnit = activeCount > 1 ? 4 : 0;
            const sstX = xToPx(point.x) - offsetUnit;
            const ssrX = xToPx(point.x);
            const sseX = xToPx(point.x) + offsetUnit;

            return (
              <g key={`ols-${index}`}>
                {sst ? <line x1={sstX} y1={yToPx(meanY)} x2={sstX} y2={yToPx(point.y)} className="reg1intro-sst-line" /> : null}
                {ssr ? <line x1={ssrX} y1={yToPx(meanY)} x2={ssrX} y2={yToPx(predicted)} className="reg1intro-ssr-line" /> : null}
                {sse ? <line x1={sseX} y1={yToPx(predicted)} x2={sseX} y2={yToPx(point.y)} className="reg1intro-sse-line" /> : null}
                {showErrorValues && olsLabeledIndices.has(index) && sst ? (
                  <text
                    x={sstX - 10}
                    y={(yToPx(meanY) + yToPx(point.y)) / 2 + (index === fixedOrderIndices[0] ? -10 : 5)}
                    className="reg1intro-sst-value"
                    textAnchor="end"
                  >
                    {(point.y - meanY).toFixed(2)}
                  </text>
                ) : null}
                {showErrorValues && olsLabeledIndices.has(index) && ssr ? (
                  <text
                    x={ssrX + 10}
                    y={(yToPx(meanY) + yToPx(predicted)) / 2 + 5}
                    className="reg1intro-ssr-value"
                    textAnchor="start"
                  >
                    {(predicted - meanY).toFixed(2)}
                  </text>
                ) : null}
                {showErrorValues && olsLabeledIndices.has(index) && sse ? (
                  <text
                    x={sseX + 10}
                    y={(yToPx(predicted) + yToPx(point.y)) / 2 + 5}
                    className="reg1intro-sse-value"
                    textAnchor="start"
                  >
                    {(point.y - predicted).toFixed(2)}
                  </text>
                ) : null}
              </g>
            );
          })
        : null}

      {showMeanLine ? <line x1={paddingLeft} y1={yToPx(meanY)} x2={width - paddingRight} y2={yToPx(meanY)} className="reg1intro-ms-mean-line" /> : null}

      {showStepTwo ? (
        <>
          <line x1={paddingLeft} y1={yToPx(INTERCEPT)} x2={width - paddingRight} y2={yToPx(INTERCEPT)} className="reg1intro-intercept-line" />
          <line x1={paddingLeft + 22} y1={yToPx(0)} x2={paddingLeft + 22} y2={yToPx(INTERCEPT)} className="reg1intro-intercept-arrow" />
          <polygon points={arrowHeadPoints(paddingLeft + 22, yToPx(INTERCEPT), Math.PI / 2, 10)} className="reg1intro-intercept-arrowhead" />
          <text x={paddingLeft + 36} y={(yToPx(0) + yToPx(INTERCEPT)) / 2 + 6} className="reg1intro-intercept-label" textAnchor="start">
            절편(a)
          </text>
        </>
      ) : null}

      {showRegressionLine || showRejectionStepOne ? (
        <line
          x1={xToPx(showEstimateMode ? estimateLineStart.x : showRejectionStepOne ? estimateLineStart.x : olsLineStart.x)}
          y1={yToPx(showEstimateMode ? estimateLineStart.y : showRejectionStepOne ? estimateLineStart.y : olsLineStart.y)}
          x2={xToPx(showEstimateMode ? estimateLineEnd.x : showRejectionStepOne ? estimateLineEnd.x : olsLineEnd.x)}
          y2={yToPx(showEstimateMode ? estimateLineEnd.y : showRejectionStepOne ? estimateLineEnd.y : olsLineEnd.y)}
          className={showOlsModes ? "reg1intro-ms-regression-line" : "reg1intro-regression-line"}
        />
      ) : null}

      {showRejectionMode ? (
        <>
          {showAllRejectionCurves && !showRejectionStepThree
            ? sortedPoints.map((point) => (
                <path
                  key={`rejection-curve-all-${point.index}`}
                  d={buildRejectionCurvePath(point.x, showRejectionStepOne ? INTERCEPT + SLOPE * point.x : 0)}
                  className="reg1intro-rejection-curve reg1intro-rejection-curve-all"
                />
              ))
            : null}
          {showRejectionVisual && lowerTailPath ? <path d={lowerTailPath} className="reg1intro-rejection-tail" /> : null}
          {showRejectionVisual && upperTailPath ? <path d={upperTailPath} className="reg1intro-rejection-tail" /> : null}
          {showRejectionVisual ? <path d={rejectionLeftPath} className="reg1intro-rejection-curve" /> : null}
          {showRejectionVisual ? (
            <>
              <line
                x1={xToPx(curveAnchorX)}
                y1={yToPx(rejectionLower)}
                x2={xToPx(curveAnchorX) - 12}
                y2={yToPx(rejectionLower)}
                className="reg1intro-rejection-divider"
              />
              <line
                x1={xToPx(curveAnchorX)}
                y1={yToPx(rejectionUpper)}
                x2={xToPx(curveAnchorX) - 12}
                y2={yToPx(rejectionUpper)}
                className="reg1intro-rejection-divider"
              />
            </>
          ) : null}
          {!showRejectionStepThree ? (
            <circle
              cx={xToPx(activeRejectionX)}
              cy={yToPx(rejectionMeanY)}
              r="8.8"
              className="reg1intro-rejection-point"
            />
          ) : null}
          {showRejectionVisual && !showRejectionStepThree ? (
            <>
              <line
                x1={xToPx(showRejectionStepThree ? activeHistogramPoint.x : rejectionAnchorX)}
                y1={yToPx(showRejectionStepOne ? nearestRejectionPoint.y : showRejectionStepThree ? activeHistogramPoint.y : 0)}
                x2={xToPx(showRejectionStepThree ? activeHistogramPoint.x : rejectionAnchorX)}
                y2={yToPx(showRejectionStepOne ? rejectionMeanY : showRejectionStepThree ? 0 : nearestRejectionPoint.y - (INTERCEPT + SLOPE * nearestRejectionPoint.x))}
                className="reg1intro-guide-line reg1intro-guide-line-active"
              />
              {showRejectionStepOne ? (
                <text
                  x={xToPx(rejectionAnchorX) + 14}
                  y={yToPx((nearestRejectionPoint.y + rejectionMeanY) / 2) + 6}
                  className="reg1intro-error-label"
                  textAnchor="start"
                >
                  {(nearestRejectionPoint.y - rejectionMeanY).toFixed(2)}
                </text>
              ) : showRejectionStepTwo ? (
                <text
                  x={xToPx(rejectionAnchorX) + 14}
                  y={yToPx((nearestRejectionPoint.y - (INTERCEPT + SLOPE * nearestRejectionPoint.x)) / 2) + 6}
                  className="reg1intro-error-label"
                  textAnchor="start"
                >
                  {(nearestRejectionPoint.y - (INTERCEPT + SLOPE * nearestRejectionPoint.x)).toFixed(2)}
                </text>
              ) : showRejectionStepThree ? (
                <text
                  x={xToPx(activeHistogramPoint.x) + 14}
                  y={yToPx(activeHistogramPoint.y / 2) + 6}
                  className="reg1intro-error-label"
                  textAnchor="start"
                >
                  {(nearestRejectionPoint.y - (INTERCEPT + SLOPE * nearestRejectionPoint.x)).toFixed(2)}
                </text>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {showStepThree ? (
        <>
          <path d={`M ${arcCenterX + arcRadius} ${interceptPointY} A ${arcRadius} ${arcRadius} 0 0 0 ${arcEndX} ${arcEndY}`} className="reg1intro-slope-arc" />
          <polygon points={arrowHeadPoints(arcEndX, arcEndY, estimateAngle + Math.PI / 2, 8)} className="reg1intro-slope-arrowhead" />
          <text x={interceptPointX + 88} y={interceptPointY - 18} className="reg1intro-slope-label" textAnchor="start">
            회귀계수(b)
          </text>
        </>
      ) : null}

      {showStepOne
        ? points.map((point, index) => {
            const predictedY = INTERCEPT + SLOPE * point.x;
            const baselineY = showStepThree ? predictedY : shadowY;
            const lineMidY = (baselineY + point.y) / 2;
            return (
              <g key={`shadow-${index}`}>
                <line
                  x1={xToPx(point.x)}
                  y1={yToPx(baselineY)}
                  x2={xToPx(point.x)}
                  y2={yToPx(point.y)}
                  className={showStepFour ? "reg1intro-guide-line reg1intro-guide-line-active" : "reg1intro-guide-line"}
                />
                <circle cx={xToPx(point.x)} cy={yToPx(baselineY)} r="8.5" className="reg1intro-shadow-point" />
                {showStepFour && index === ERROR_LABEL_INDEX ? (
                  <text x={xToPx(point.x) + 14} y={yToPx(lineMidY) + 6} className="reg1intro-error-label" textAnchor="start">
                    오차(e)
                  </text>
                ) : null}
              </g>
            );
          })
        : null}

      {showRejectionStepOne
        ? points.map((point, index) => (
            <circle key={`point-${index}`} cx={xToPx(point.x)} cy={yToPx(point.y)} r="8.5" className="reg1intro-point" />
          ))
        : showRejectionStepTwo
          ? rejectionVectorsBase.map((item) => (
              <circle key={`residual-${item.index}`} cx={xToPx(item.point.x)} cy={yToPx(item.residual)} r="8.5" className="reg1intro-point" />
            ))
          : showRejectionStepThree
            ? residualHistogramPoints
                .filter((item) => item.index !== nearestRejectionPoint.index)
                .map((item) => (
                  <circle
                    key={`residual-hist-${item.index}`}
                    cx={xToPx(item.x)}
                    cy={yToPx(item.y)}
                    r="7.6"
                    className="reg1intro-point"
                  />
                ))
            : points.map((point, index) => (
                <circle key={`point-${index}`} cx={xToPx(point.x)} cy={yToPx(point.y)} r="8.5" className="reg1intro-point" />
              ))}
      {showRejectionStepThree ? (
        <>
          <line
            x1={xToPx(activeHistogramPoint.x)}
            y1={yToPx(activeHistogramPoint.y)}
            x2={xToPx(activeHistogramPoint.x)}
            y2={yToPx(0)}
            className="reg1intro-guide-line reg1intro-guide-line-active"
          />
          <circle
            cx={xToPx(activeHistogramPoint.x)}
            cy={yToPx(activeHistogramPoint.y)}
            r="8.8"
            className="reg1intro-rejection-point"
          />
          <text
            x={xToPx(activeHistogramPoint.x) + 14}
            y={yToPx(activeHistogramPoint.y / 2) + 6}
            className="reg1intro-error-label"
            textAnchor="start"
          >
            {(nearestRejectionPoint.y - (INTERCEPT + SLOPE * nearestRejectionPoint.x)).toFixed(2)}
          </text>
        </>
      ) : null}
      </g>

      {showRejectionStepTwo || showRejectionStepThree ? (
        <>
          <line x1={paddingLeft} y1={yToPx(rejectionLower)} x2={width - paddingRight} y2={yToPx(rejectionLower)} className="reg1intro-rejection-threshold" />
          <line x1={paddingLeft} y1={yToPx(rejectionUpper)} x2={width - paddingRight} y2={yToPx(rejectionUpper)} className="reg1intro-rejection-threshold" />
        </>
      ) : null}
      {!showRejectionStepThree ? (
        <text x={width / 2} y={height - 6} className="reg1intro-axis-label" textAnchor="middle">
          X
        </text>
      ) : null}
      {showOlsModes && showSquares && squareLegendItems.length > 0 ? (
        <g
          className="reg1intro-square-legend"
          transform={`translate(${paddingLeft + 14}, ${paddingTop + 10})`}
        >
          {squareLegendItems.map((item, index) => (
            <g key={item.key} transform={`translate(0, ${index * 24})`}>
              <rect x="0" y="0" width="14" height="14" rx="4" className={item.className} />
              <text x="22" y="11" className="reg1intro-square-legend-label">
                {item.label}
              </text>
            </g>
          ))}
        </g>
      ) : null}
      <text x="22" y={height / 2} className="reg1intro-axis-label" textAnchor="middle" transform={`rotate(-90 22 ${height / 2})`}>
        {showRejectionMode && !showRejectionStepOne ? "잔차" : "Y"}
      </text>
    </svg>
  );
}

export default function Regression1OlsIntroPage() {
  const mobileFit = useMobileFitScale(820, 560);
  const points = useMemo(() => REG1_OLS_POINTS, []);
  const [mode, setMode] = useState(MODE_ESTIMATE);
  const [step, setStep] = useState(0);
  const [modelMetric, setModelMetric] = useState("r2");
  const [sst, setSst] = useState(false);
  const [ssr, setSsr] = useState(false);
  const [sse, setSse] = useState(false);
  const [olsVisibleCount, setOlsVisibleCount] = useState(0);
  const [showSquares, setShowSquares] = useState(false);
  const [showErrorValues, setShowErrorValues] = useState(false);
  const [olsAngleProgress, setOlsAngleProgress] = useState(DEFAULT_OLS_ANGLE_PROGRESS);
  const [rejectionX, setRejectionX] = useState(0);
  const [rejectionStep, setRejectionStep] = useState(1);
  const [showAllRejectionCurves, setShowAllRejectionCurves] = useState(false);

  const formulaDisplay =
    step >= 4
      ? { abstract: "Y = a + bX + e", actual: "Ŷ = 1.796 + 0.551X + 오차" }
      : step >= 3
        ? { abstract: "Y = a + bX", actual: "Ŷ = 1.796 + 0.551X" }
        : step >= 2
          ? { abstract: "Y = a + X", actual: "Ŷ = 1.796 + X" }
          : step >= 1
            ? { abstract: "Y = X", actual: "Ŷ = X" }
            : { abstract: "Y =", actual: "Ŷ =" };

  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const sortedPointsByX = useMemo(
    () => [...points].sort((left, right) => left.x - right.x || left.y - right.y),
    [points]
  );
  const activeRejectionSample = sortedPointsByX.reduce(
    (closest, point) =>
      Math.abs(point.x - rejectionX) < Math.abs(closest.x - rejectionX) ? point : closest,
    sortedPointsByX[0]
  );
  const showActiveRejectionSample = Math.abs(activeRejectionSample.x - rejectionX) <= 0.055;
  const currentRejectionX = showActiveRejectionSample ? activeRejectionSample.x : rejectionX;
  const activePredictedY = INTERCEPT + SLOPE * currentRejectionX;
  const activeResidual = showActiveRejectionSample ? activeRejectionSample.y - activePredictedY : null;
  const activeResidualZ = Math.abs(activeResidual ?? 0) / Math.max(
    Math.sqrt(
      points.reduce((sum, point) => {
        const predicted = INTERCEPT + SLOPE * point.x;
        return sum + (point.y - predicted) ** 2;
      }, 0) / Math.max(points.length - 2, 1)
    ),
    1e-6
  );
  const activeResidualP = showActiveRejectionSample ? 2 * (1 - normalCdf(activeResidualZ)) : null;
  const fixedOrderIndices = useMemo(
    () =>
      [...buildOlsVectors(points, SLOPE)]
        .sort((a, b) => b.sseValue - a.sseValue)
        .map((item) => item.index),
    [points]
  );
  const effectiveOlsAngleProgress = mode === MODE_MODEL ? DEFAULT_OLS_ANGLE_PROGRESS : olsAngleProgress;
  const olsSlope = OLS_SLOPE_MIN + (OLS_SLOPE_MAX - OLS_SLOPE_MIN) * effectiveOlsAngleProgress;
  const olsVectors = buildOlsVectors(points, olsSlope);
  const effectiveVisibleCount = mode === MODE_MODEL ? points.length : olsVisibleCount;
  const selectedIndices = fixedOrderIndices.slice(0, effectiveVisibleCount);
  const selectedIndexSet = new Set(selectedIndices);
  const visibleVectors = fixedOrderIndices
    .slice(0, effectiveVisibleCount)
    .map((index) => olsVectors.find((item) => item.index === index))
    .filter(Boolean);

  const sstSum = visibleVectors.reduce((sum, item) => sum + (item.point.y - meanY) ** 2, 0);
  const ssrSum = visibleVectors.reduce((sum, item) => sum + (item.predicted - meanY) ** 2, 0);
  const sseSum = visibleVectors.reduce((sum, item) => sum + (item.point.y - item.predicted) ** 2, 0);
  const mst = visibleVectors.length > 1 ? sstSum / (visibleVectors.length - 1) : 0;
  const msr = visibleVectors.length > 0 ? ssrSum : 0;
  const mse = visibleVectors.length > 2 ? sseSum / (visibleVectors.length - 2) : 0;
  const rSquared = sstSum > 0 ? ssrSum / sstSum : 0;
  const fValue = mse > 0 ? msr / mse : 0;
  const fCritical = approximateFCritical(MODEL_ALPHA, 1, Math.max(visibleVectors.length - 2, 1));
  const fPValue = approximateFPValue(fValue, 1, Math.max(visibleVectors.length - 2, 1));
  const fPValueLabel = fPValue < 0.001 ? "p<.001" : `p=${fPValue.toFixed(3)}`;

  const curveValues = Array.from({ length: 81 }, (_, index) => {
    const slope = OLS_SLOPE_MIN + (index / 80) * (OLS_SLOPE_MAX - OLS_SLOPE_MIN);
    const vectors = buildOlsVectors(points, slope);
    const sseValue = vectors.reduce(
      (sum, item) =>
        selectedIndexSet.has(item.index) ? sum + (item.point.y - item.predicted) ** 2 : sum,
      0,
    );
    return { slope, sse: sseValue };
  });
  const mobileOlsVisibleVectors = fixedOrderIndices
    .slice(0, points.length)
    .map((index) => olsVectors.find((item) => item.index === index))
    .filter(Boolean);
  const mobileOlsSseSum = mobileOlsVisibleVectors.reduce((sum, item) => sum + (item.point.y - item.predicted) ** 2, 0);
  const mobileOlsMse =
    mobileOlsVisibleVectors.length > 2 ? mobileOlsSseSum / (mobileOlsVisibleVectors.length - 2) : 0;
  const mobileCurveValues = Array.from({ length: 81 }, (_, index) => {
    const slope = OLS_SLOPE_MIN + (index / 80) * (OLS_SLOPE_MAX - OLS_SLOPE_MIN);
    const vectors = buildOlsVectors(points, slope);
    const sseValue = vectors.reduce((sum, item) => sum + (item.point.y - item.predicted) ** 2, 0);
    return { slope, sse: sseValue };
  });
  const mobileModelBaseVectors = buildOlsVectors(points, SLOPE);
  const mobileModelVisibleVectors = fixedOrderIndices
    .slice(0, points.length)
    .map((index) => mobileModelBaseVectors.find((item) => item.index === index))
    .filter(Boolean);
  const mobileModelSstSum = mobileModelVisibleVectors.reduce((sum, item) => sum + (item.point.y - meanY) ** 2, 0);
  const mobileModelSsrSum = mobileModelVisibleVectors.reduce((sum, item) => sum + (item.predicted - meanY) ** 2, 0);
  const mobileModelSseSum = mobileModelVisibleVectors.reduce((sum, item) => sum + (item.point.y - item.predicted) ** 2, 0);
  const mobileModelMsr = mobileModelVisibleVectors.length > 0 ? mobileModelSsrSum : 0;
  const mobileModelMse =
    mobileModelVisibleVectors.length > 2 ? mobileModelSseSum / (mobileModelVisibleVectors.length - 2) : 0;
  const mobileModelFValue = mobileModelMse > 0 ? mobileModelMsr / mobileModelMse : 0;
  const mobileModelFCritical = approximateFCritical(MODEL_ALPHA, 1, Math.max(mobileModelVisibleVectors.length - 2, 1));
  const graphTitle =
    mode === MODE_REJECTION
      ? rejectionStep === 1
        ? "회귀식과 잔차"
        : rejectionStep === 2
          ? "잔차의 분산"
          : "잔차와 정규분포"
      : mode === MODE_OLS
        ? "최소제곱법"
        : mode === MODE_MODEL
          ? "모형의 설명력과 유의성"
          : "회귀식";

  const mobileSections = [
    {
      id: "estimate",
      groupTitle: "OLS와 최소제곱법",
      sectionTitle: "추정과 오차",
      content: (
        <>
          <div className="reg1intro-plot-wrap reg1intro-mobile-plot">
            <RegressionScatterSvg
              points={points}
              mode={MODE_ESTIMATE}
              step={4}
              sst={false}
              ssr={false}
              sse={false}
              olsVisibleCount={0}
              showSquares={false}
              showErrorValues={false}
              olsAngleProgress={DEFAULT_OLS_ANGLE_PROGRESS}
              rejectionX={0}
              rejectionStep={1}
              showAllRejectionCurves={false}
              compact
            />
          </div>
          <div className="reg1intro-control-card reg1intro-formula-card">
            <p className="reg1intro-formula-abstract">Y = a + bX + e</p>
            <p className="reg1intro-formula-actual">Ŷ = 1.796 + 0.551X + 오차</p>
          </div>
        </>
      ),
    },
    {
      id: "ols",
      groupTitle: "OLS와 최소제곱법",
      sectionTitle: "최소제곱법",
      content: (
        <>
          <div className="reg1intro-plot-wrap reg1intro-mobile-plot">
            <RegressionScatterSvg
              points={points}
              mode={MODE_OLS}
              step={0}
              sst={false}
              ssr={false}
              sse
              olsVisibleCount={30}
              showSquares
              showErrorValues={false}
              olsAngleProgress={olsAngleProgress}
              rejectionX={0}
              rejectionStep={1}
              showAllRejectionCurves={false}
              compact
            />
          </div>
          <div className="reg1intro-bottom-slider reg1intro-mobile-slider">
            <label className="reg1intro-control-label" htmlFor="reg1intro-mobile-angle-slider">
              회귀선 각도
            </label>
            <input
              id="reg1intro-mobile-angle-slider"
              className="reg1intro-slider"
              type="range"
              min="0"
              max="100"
              value={Math.round(olsAngleProgress * 100)}
              onChange={(event) => setOlsAngleProgress(Number(event.target.value) / 100)}
            />
          </div>
          <div className="reg1intro-mobile-panel">
            <div className="reg1intro-ols-metrics">
              <div className="reg1intro-ols-metric-row">
                <div className="reg1intro-ols-metric-cell">
                  <span>SSE</span>
                  <strong>{mobileOlsSseSum.toFixed(2)}</strong>
                </div>
                <div className="reg1intro-ols-metric-cell">
                  <span>MSE (df={Math.max(mobileOlsVisibleVectors.length - 2, 0)})</span>
                  <strong>{mobileOlsMse.toFixed(2)}</strong>
                </div>
              </div>
            </div>
            <div className="reg1intro-control-card">
              <OlsErrorCurve width={360} height={220} values={mobileCurveValues} currentSlope={olsSlope} showCurrentPoint />
            </div>
          </div>
        </>
      ),
    },
    {
      id: "model",
      groupTitle: "OLS와 최소제곱법",
      sectionTitle: "모형의 설명력과 유의성",
      content: (
        <div className="reg1intro-mobile-rejection-stack">
          <article className="rr-graph-card reg1intro-mobile-subsection">
            <div className="rr-graph-head reg1intro-mobile-subhead">
              <div>
                <p className="panel-label">Graph</p>
                <h3>R제곱</h3>
              </div>
            </div>
            <div className="reg1intro-plot-wrap reg1intro-mobile-plot">
              <RegressionScatterSvg
                points={points}
                mode={MODE_MODEL}
                step={0}
                sst
                ssr
                sse={false}
                olsVisibleCount={points.length}
                showSquares
                showErrorValues={false}
                olsAngleProgress={DEFAULT_OLS_ANGLE_PROGRESS}
                rejectionX={0}
                rejectionStep={1}
                showAllRejectionCurves={false}
                compact
              />
            </div>
            <div className="reg1intro-control-card reg1intro-model-formula-card reg1intro-mobile-formula-only">
              <div className="reg1intro-model-formula-block">
                <p className="reg1intro-model-formula-abstract">R² = SSR / SST</p>
              </div>
            </div>
          </article>
          <article className="rr-graph-card reg1intro-mobile-subsection">
            <div className="rr-graph-head reg1intro-mobile-subhead">
              <div>
                <p className="panel-label">Graph</p>
                <h3>F</h3>
              </div>
            </div>
            <div className="reg1intro-plot-wrap reg1intro-mobile-plot reg1intro-mobile-fplot">
              <RegressionScatterSvg
                points={points}
                mode={MODE_MODEL}
                step={0}
                sst={false}
                ssr
                sse
                olsVisibleCount={points.length}
                showSquares
                showErrorValues={false}
                olsAngleProgress={DEFAULT_OLS_ANGLE_PROGRESS}
                rejectionX={0}
                rejectionStep={1}
                showAllRejectionCurves={false}
                compact
              />
            </div>
            <div className="reg1intro-control-card reg1intro-model-formula-card reg1intro-mobile-formula-only">
              <div className="reg1intro-model-formula-block">
                <p className="reg1intro-model-formula-abstract">F = MSR / MSE</p>
                <p className="reg1intro-model-formula-note">MSR = SSR / df, MSE = SSE / df</p>
              </div>
            </div>
          </article>
        </div>
      ),
    },
    {
      id: "rejection",
      groupTitle: "OLS와 최소제곱법",
      sectionTitle: "잔차와 기본가정",
      content: (
        <div className="reg1intro-mobile-rejection-stack">
          {[
            { id: "residual", title: "잔차", stepValue: 1 },
            { id: "residual-plot", title: "잔차 그래프", stepValue: 2 },
            { id: "residual-dist", title: "잔차 분포 그래프", stepValue: 3 },
          ].map((item) => (
            <article key={item.id} className="rr-graph-card reg1intro-mobile-subsection">
              <div className="rr-graph-head reg1intro-mobile-subhead">
                <div>
                  <p className="panel-label">Graph</p>
                  <h3>{item.title}</h3>
                </div>
              </div>
              <div className="reg1intro-plot-wrap reg1intro-mobile-plot">
                <RegressionScatterSvg
                  points={points}
                  mode={MODE_REJECTION}
                  step={0}
                  sst={false}
                  ssr={false}
                  sse={false}
                  olsVisibleCount={0}
                  showSquares={false}
                  showErrorValues={false}
                  olsAngleProgress={DEFAULT_OLS_ANGLE_PROGRESS}
                  rejectionX={rejectionX}
                  rejectionStep={item.stepValue}
                  showAllRejectionCurves
                  compact
                />
              </div>
              <div className="reg1intro-bottom-slider reg1intro-mobile-slider">
                <label className="reg1intro-control-label" htmlFor={`reg1intro-mobile-rejection-slider-${item.id}`}>
                  X 위치
                </label>
                <input
                  id={`reg1intro-mobile-rejection-slider-${item.id}`}
                  className="reg1intro-slider"
                  type="range"
                  min="0"
                  max="5"
                  step="0.01"
                  value={rejectionX}
                  onChange={(event) => setRejectionX(Number(event.target.value))}
                />
              </div>
            </article>
          ))}
        </div>
      ),
    },
  ];

  return (
    <main className="rr-shell reg1intro-shell">
      <header className="rr-header reg1intro-header">
        <div>
          <p className="eyebrow">GRAPH</p>
          <h1>최소제곱법과 회귀모형</h1>
        </div>
        <div className="lab-header-action-stack">
          <Link className="secondary-button regswitch-home-button" href="/lab">
          메인으로
          </Link>
          <button
            type="button"
            className="secondary-button regswitch-home-button"
            onClick={() =>
              downloadCsv("regression-1-ols-intro-jamovi.csv", REG1_OLS_POINTS, [
                { label: "x_value", value: (row) => row.x.toFixed(6) },
                { label: "y_value", value: (row) => row.y.toFixed(6) },
              ])
            }
          >
            CSV 다운로드
          </button>
        </div>
      </header>

      <section className="reg1intro-layout">
        <article className="rr-graph-card reg1intro-main-card">
          <div className="rr-graph-head">
            <div>
              <p className="panel-label">Graph</p>
              <h2 className="regswitch-title">{graphTitle}</h2>
            </div>
          </div>
          <div className="reg1intro-plot-wrap">
            <RegressionScatterSvg
              points={points}
              mode={mode}
              step={step}
              sst={sst}
              ssr={ssr}
              sse={sse}
              olsVisibleCount={effectiveVisibleCount}
              showSquares={showSquares}
              showErrorValues={showErrorValues}
              olsAngleProgress={effectiveOlsAngleProgress}
              rejectionX={rejectionX}
              rejectionStep={rejectionStep}
              showAllRejectionCurves={showAllRejectionCurves}
            />
          </div>
          {mode === MODE_OLS ? (
            <div className="reg1intro-bottom-slider">
              <label className="reg1intro-control-label" htmlFor="reg1intro-angle-slider">
                회귀선 각도
              </label>
              <input
                id="reg1intro-angle-slider"
                className="reg1intro-slider"
                type="range"
                min="0"
                max="100"
                value={Math.round(olsAngleProgress * 100)}
                onChange={(event) => setOlsAngleProgress(Number(event.target.value) / 100)}
              />
            </div>
          ) : mode === MODE_REJECTION ? (
            <div className="reg1intro-bottom-slider">
              <div className="reg1intro-stepper">
                <button
                  type="button"
                  className={`reg1intro-step-pill ${rejectionStep === 1 ? "active" : ""}`}
                  onClick={() => setRejectionStep(1)}
                >
                  잔차
                </button>
                <button
                  type="button"
                  className={`reg1intro-step-pill ${rejectionStep === 2 ? "active" : ""}`}
                  onClick={() => setRejectionStep(2)}
                >
                  잔차 그래프
                </button>
                <button
                  type="button"
                  className={`reg1intro-step-pill ${rejectionStep === 3 ? "active" : ""}`}
                  onClick={() => setRejectionStep(3)}
                >
                  잔차 분포
                </button>
              </div>
              <label className="reg1intro-control-label" htmlFor="reg1intro-rejection-slider">
                X 위치
              </label>
              <input
                id="reg1intro-rejection-slider"
                className="reg1intro-slider"
                type="range"
                min="0"
                max="5"
                step="0.01"
                value={rejectionX}
                onChange={(event) => setRejectionX(Number(event.target.value))}
              />
            </div>
          ) : null}
        </article>

        <aside className="rr-graph-card reg1intro-side-card" aria-label="옵션과 정보 영역">
          <div className="reg1intro-side-stack">
            <div className="reg1intro-control-card">
              <label className="reg1intro-control-label" htmlFor="reg1intro-mode">
                설명 단계
              </label>
              <select
                id="reg1intro-mode"
                className="meandiff-select reg1intro-select"
                value={mode}
                onChange={(event) => {
                  const nextMode = event.target.value;
                  setMode(nextMode);
                  if (nextMode === MODE_ESTIMATE) {
                    setSst(false);
                    setSsr(false);
                    setSse(false);
                    setOlsVisibleCount(0);
                    setShowSquares(false);
                  } else if (nextMode === MODE_OLS) {
                    setStep(0);
                  } else if (nextMode === MODE_REJECTION) {
                    setStep(0);
                    setRejectionX(0);
                    setRejectionStep(1);
                    setShowAllRejectionCurves(false);
                  } else {
                    setStep(0);
                    setModelMetric("r2");
                    setSst(true);
                    setSsr(true);
                    setSse(false);
                    setOlsVisibleCount(points.length);
                  }
                }}
              >
                <option value={MODE_ESTIMATE}>추정과 오차</option>
                <option value={MODE_OLS}>최소제곱법</option>
                <option value={MODE_MODEL}>모형의 설명력과 유의성</option>
                <option value={MODE_REJECTION}>잔차와 회귀분석의 기본가정</option>
              </select>

              {mode === MODE_ESTIMATE ? (
                <>
                <div className="reg1intro-stepper-head">
                    <button type="button" className="reg1intro-step-reset" onClick={() => setStep(0)}>
                      초기화
                    </button>
                  </div>
                  <div className="reg1intro-stepper reg1intro-stepper-two">
                    <button type="button" className={`reg1intro-step-pill ${step === 1 ? "active" : ""}`} onClick={() => setStep(1)}>
                      X
                    </button>
                    <button type="button" className={`reg1intro-step-pill ${step === 2 ? "active" : ""}`} onClick={() => setStep(2)}>
                      a
                    </button>
                    <button type="button" className={`reg1intro-step-pill ${step === 3 ? "active" : ""}`} onClick={() => setStep(3)}>
                      b
                    </button>
                    <button type="button" className={`reg1intro-step-pill ${step === 4 ? "active" : ""}`} onClick={() => setStep(4)}>
                      e
                    </button>
                  </div>
                </>
              ) : mode === MODE_OLS ? (
                <>
                  <div className="reg1intro-steps-inline reg1intro-steps-inline-ms">
                    <button type="button" className={`corr-toggle-button ${sst ? "active" : ""}`} onClick={() => setSst((prev) => !prev)}>
                      SST
                    </button>
                    <button type="button" className={`corr-toggle-button ${ssr ? "active" : ""}`} onClick={() => setSsr((prev) => !prev)}>
                      SSR
                    </button>
                    <button type="button" className={`corr-toggle-button ${sse ? "active" : ""}`} onClick={() => setSse((prev) => !prev)}>
                      SSE
                    </button>
                  </div>
                  <div className="reg1intro-slider-wrap">
                    <label className="reg1intro-control-label" htmlFor="reg1intro-ols-slider">
                      오차 표시
                    </label>
                    <input
                      id="reg1intro-ols-slider"
                      className="reg1intro-slider"
                      type="range"
                      min="0"
                      max={points.length}
                      value={olsVisibleCount}
                      onChange={(event) => setOlsVisibleCount(Number(event.target.value))}
                    />
                    <div className="reg1intro-slider-meta">
                      <span>{olsVisibleCount}개 표시</span>
                    </div>
                    <div className="reg1intro-toggle-grid">
                      <button
                        type="button"
                        className={`corr-toggle-button ${showSquares ? "active" : ""}`}
                        onClick={() => setShowSquares((prev) => !prev)}
                      >
                        제곱합 표시
                      </button>
                      <button
                        type="button"
                        className={`corr-toggle-button ${showErrorValues ? "active" : ""}`}
                        onClick={() => setShowErrorValues((prev) => !prev)}
                      >
                        오차값 표시
                      </button>
                    </div>
                  </div>

                  <div className="reg1intro-ols-metrics">
                    {sst ? (
                      <div className="reg1intro-ols-metric-row">
                        <div className="reg1intro-ols-metric-cell">
                          <span>SST</span>
                          <strong>{sstSum.toFixed(2)}</strong>
                        </div>
                        <div className="reg1intro-ols-metric-cell">
                          <span>MST (df={Math.max(visibleVectors.length - 1, 0)})</span>
                          <strong>{mst.toFixed(2)}</strong>
                        </div>
                      </div>
                    ) : null}
                    {ssr ? (
                      <div className="reg1intro-ols-metric-row">
                        <div className="reg1intro-ols-metric-cell">
                          <span>SSR</span>
                          <strong>{ssrSum.toFixed(2)}</strong>
                        </div>
                        <div className="reg1intro-ols-metric-cell">
                          <span>MSR (df=1)</span>
                          <strong>{msr.toFixed(2)}</strong>
                        </div>
                      </div>
                    ) : null}
                    {sse ? (
                      <div className="reg1intro-ols-metric-row">
                        <div className="reg1intro-ols-metric-cell">
                          <span>SSE</span>
                          <strong>{sseSum.toFixed(2)}</strong>
                        </div>
                        <div className="reg1intro-ols-metric-cell">
                          <span>MSE (df={Math.max(visibleVectors.length - 2, 0)})</span>
                          <strong>{mse.toFixed(2)}</strong>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="reg1intro-control-card">
                    <OlsErrorCurve
                      width={360}
                      height={220}
                      values={curveValues}
                      currentSlope={olsSlope}
                      showCurrentPoint={ssr || sse}
                    />
                  </div>
                </>
              ) : mode === MODE_REJECTION ? (
                <>
                <div className="reg1intro-stepper reg1intro-rejection-stepper">
                  <button
                    type="button"
                    className={`reg1intro-step-pill ${rejectionStep === 1 ? "active" : ""}`}
                    onClick={() => setRejectionStep(1)}
                  >
                    잔차
                  </button>
                  <button
                    type="button"
                    className={`reg1intro-step-pill ${rejectionStep === 2 ? "active" : ""}`}
                    onClick={() => setRejectionStep(2)}
                  >
                    잔차 그래프
                  </button>
                  <button
                    type="button"
                    className={`reg1intro-step-pill ${rejectionStep === 3 ? "active" : ""}`}
                    onClick={() => setRejectionStep(3)}
                  >
                    잔차 분포
                  </button>
                </div>
                <div className="reg1intro-toggle-grid reg1intro-toggle-grid-single">
                  <button
                    type="button"
                    className={`reg1intro-step-pill ${showAllRejectionCurves ? "active" : ""}`}
                    onClick={() => setShowAllRejectionCurves((current) => !current)}
                  >
                    정규 분포 표시
                  </button>
                </div>
                {false && (
                <div className="reg1intro-ols-metrics">
                  <div className="reg1intro-ols-metric-row">
                    <div className="reg1intro-ols-metric-cell">
                      <span>현재 X</span>
                      <strong>{activeRejectionSample.x.toFixed(2)}</strong>
                    </div>
                    <div className="reg1intro-ols-metric-cell">
                      <span>95% 기각역</span>
                      <strong>표시</strong>
                    </div>
                  </div>
                </div>
                )}
                <div className="reg1intro-ols-metrics">
                  <div className="reg1intro-ols-metric-row">
                    <div className="reg1intro-ols-metric-cell">
                      <span>현재 X</span>
                      <strong>{currentRejectionX.toFixed(2)}</strong>
                    </div>
                    <div className="reg1intro-ols-metric-cell">
                      <span>현재 예측값 Ŷ</span>
                      <strong>{activePredictedY.toFixed(2)}</strong>
                    </div>
                  </div>
                  <div className="reg1intro-ols-metric-row">
                    <div className="reg1intro-ols-metric-cell">
                      <span>현재 실제값 Y</span>
                      <strong>{showActiveRejectionSample ? activeRejectionSample.y.toFixed(2) : ""}</strong>
                    </div>
                    <div className="reg1intro-ols-metric-cell">
                      <span>현재 잔차 e</span>
                      <strong>{showActiveRejectionSample ? activeResidual.toFixed(2) : ""}</strong>
                    </div>
                  </div>
                  <div className="reg1intro-ols-metric-row">
                    <div className="reg1intro-ols-metric-cell">
                      <span>p(양측)</span>
                      <strong>{showActiveRejectionSample ? (activeResidualP < 0.001 ? "p<.001" : activeResidualP.toFixed(3)) : ""}</strong>
                    </div>
                  </div>
                </div>
                </>
              ) : (
                <>
                  <div className="reg1intro-stepper">
                    <button
                      type="button"
                      className={`reg1intro-step-pill ${modelMetric === "r2" ? "active" : ""}`}
                      onClick={() => {
                        setModelMetric("r2");
                        setSst(true);
                        setSsr(true);
                        setSse(false);
                      }}
                    >
                      R제곱
                    </button>
                    <button
                      type="button"
                      className={`reg1intro-step-pill ${modelMetric === "f" ? "active" : ""}`}
                      onClick={() => {
                        setModelMetric("f");
                        setSst(false);
                        setSsr(true);
                        setSse(true);
                      }}
                    >
                      F
                    </button>
                  </div>
                  <div className="reg1intro-slider-wrap">
                    <div className="reg1intro-toggle-grid">
                      <button
                        type="button"
                        className={`corr-toggle-button ${showSquares ? "active" : ""}`}
                        onClick={() => setShowSquares((prev) => !prev)}
                      >
                        제곱합 표시
                      </button>
                      <button
                        type="button"
                        className={`corr-toggle-button ${showErrorValues ? "active" : ""}`}
                        onClick={() => setShowErrorValues((prev) => !prev)}
                      >
                        오차값 표시
                      </button>
                    </div>
                  </div>

                  <div className="reg1intro-ols-metrics">
                    <div className="reg1intro-ols-metric-row">
                      {modelMetric === "r2" ? (
                        <>
                          <div className="reg1intro-ols-metric-cell">
                            <span>SST</span>
                            <strong>{sstSum.toFixed(2)}</strong>
                          </div>
                          <div className="reg1intro-ols-metric-cell">
                            <span>SSR</span>
                            <strong>{ssrSum.toFixed(2)}</strong>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="reg1intro-ols-metric-cell">
                            <span>MSR (df=1)</span>
                            <strong>{msr.toFixed(2)}</strong>
                          </div>
                          <div className="reg1intro-ols-metric-cell">
                            <span>MSE (df={Math.max(visibleVectors.length - 2, 0)})</span>
                            <strong>{mse.toFixed(2)}</strong>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="reg1intro-ols-metric-row">
                      <div
                        className={`reg1intro-ols-metric-cell ${modelMetric === "f" ? "is-f-summary" : ""}`}
                        data-f-label="F값/p값"
                      >
                        <span>{modelMetric === "r2" ? "R제곱" : "F값"}</span>
                        <strong>{modelMetric === "r2" ? rSquared.toFixed(3) : `${fValue.toFixed(2)} / ${fPValueLabel}`}</strong>
                      </div>
                      <div className="reg1intro-ols-metric-cell">
                        <span>{modelMetric === "r2" ? "설명된 비율" : "기각역 임계값"}</span>
                        <strong>{modelMetric === "r2" ? `${(rSquared * 100).toFixed(1)}%` : fCritical.toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>

                  {modelMetric === "r2" ? (
                    <div className="reg1intro-control-card reg1intro-model-formula-card">
                      <div className="reg1intro-model-formula-block">
                        <p className="reg1intro-model-formula-abstract">R² = SSR / SST</p>
                        <p className="reg1intro-model-formula-actual">
                          {rSquared.toFixed(3)} = {ssrSum.toFixed(2)} / {sstSum.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="reg1intro-control-card">
                        <FDistributionCurve width={360} height={200} fValue={fValue} criticalValue={fCritical} />
                      </div>
                      <div className="reg1intro-control-card reg1intro-model-formula-card">
                        <div className="reg1intro-model-formula-block">
                          <p className="reg1intro-model-formula-abstract">F = MSR / MSE</p>
                          <p className="reg1intro-model-formula-actual">
                            {fValue.toFixed(2)} = {msr.toFixed(2)} / {mse.toFixed(2)}
                          </p>
                          <p className="reg1intro-model-formula-note">MSR = SSR / df, MSE = SSE / df</p>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {mode === MODE_ESTIMATE ? (
              <div className="reg1intro-control-card reg1intro-formula-card">
                <p className="reg1intro-formula-abstract">{formulaDisplay.abstract}</p>
                <p className="reg1intro-formula-actual">{formulaDisplay.actual}</p>
              </div>
            ) : null}

            <div className="reg1intro-spacer" />
          </div>
        </aside>
      </section>

      <div
        ref={mobileFit.frameRef}
        className="reg1intro-mobile-fit-frame"
        data-ready={mobileFit.ready ? "true" : "false"}
        style={mobileFit.height ? { height: `${mobileFit.height}px` } : undefined}
      >
        <div
          ref={mobileFit.contentRef}
          className="reg1intro-mobile-fit-inner"
          data-ready={mobileFit.ready ? "true" : "false"}
          style={{ transform: `scale(${mobileFit.scale})` }}
        >
          <section className="reg1intro-mobile-stack">
            {mobileSections.map((section) => (
              <article key={section.id} className="rr-graph-card reg1intro-mobile-section">
                <div className="rr-graph-head reg1intro-mobile-head">
                  <div>
                    <p className="panel-label">{section.groupTitle}</p>
                    <h2>{section.sectionTitle}</h2>
                  </div>
                </div>
                {section.content}
              </article>
            ))}
            <div className="reg1intro-mobile-footer">
              <Link className="secondary-button regswitch-home-button" href="/lab">
                메인으로
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
