"use client";

import { useEffect, useState } from "react";

const PRESET_DATASETS = {
  study: {
    name: "공부시간과 성적",
    description: "단순회귀와 잔차, 애니메이션 전개를 보여주기 좋은 예제입니다.",
    rows: [
      { hours: 1, attendance: 72, score: 48 },
      { hours: 2, attendance: 75, score: 52 },
      { hours: 2.5, attendance: 78, score: 58 },
      { hours: 3, attendance: 80, score: 61 },
      { hours: 4, attendance: 82, score: 66 },
      { hours: 4.5, attendance: 86, score: 70 },
      { hours: 5, attendance: 87, score: 74 },
      { hours: 5.5, attendance: 89, score: 77 },
      { hours: 6, attendance: 90, score: 81 },
      { hours: 6.5, attendance: 92, score: 85 },
      { hours: 7, attendance: 93, score: 88 },
      { hours: 8, attendance: 95, score: 94 },
    ],
  },
  happiness: {
    name: "행복조사 예시",
    description: "기초통계, 산점도, 다중회귀를 한 플랫폼에서 확인하기 위한 예제입니다.",
    rows: [
      { meaning: 4.2, achievement: 3.9, autonomy: 3.6, happiness: 3.8 },
      { meaning: 4.5, achievement: 4.1, autonomy: 3.8, happiness: 4.0 },
      { meaning: 3.8, achievement: 3.4, autonomy: 3.1, happiness: 3.3 },
      { meaning: 4.8, achievement: 4.4, autonomy: 4.2, happiness: 4.5 },
      { meaning: 3.6, achievement: 3.2, autonomy: 3.0, happiness: 3.1 },
      { meaning: 4.1, achievement: 3.8, autonomy: 3.5, happiness: 3.7 },
      { meaning: 4.9, achievement: 4.6, autonomy: 4.3, happiness: 4.6 },
      { meaning: 4.3, achievement: 4.0, autonomy: 3.7, happiness: 3.9 },
      { meaning: 3.9, achievement: 3.5, autonomy: 3.4, happiness: 3.4 },
      { meaning: 4.7, achievement: 4.3, autonomy: 4.0, happiness: 4.3 },
      { meaning: 3.7, achievement: 3.3, autonomy: 3.2, happiness: 3.2 },
      { meaning: 4.4, achievement: 4.2, autonomy: 3.9, happiness: 4.1 },
    ],
  },
  leadership: {
    name: "리더십과 혁신행동",
    description: "다중회귀 계수와 회귀평면 뷰를 보여주기 위한 예제입니다.",
    rows: [
      { leadership: 3.2, safety: 3.0, support: 2.9, innovation: 3.1 },
      { leadership: 3.5, safety: 3.3, support: 3.1, innovation: 3.4 },
      { leadership: 3.8, safety: 3.6, support: 3.5, innovation: 3.7 },
      { leadership: 4.0, safety: 3.8, support: 3.6, innovation: 3.9 },
      { leadership: 4.3, safety: 4.0, support: 3.8, innovation: 4.1 },
      { leadership: 4.5, safety: 4.2, support: 4.0, innovation: 4.4 },
      { leadership: 4.7, safety: 4.4, support: 4.1, innovation: 4.6 },
      { leadership: 4.9, safety: 4.5, support: 4.3, innovation: 4.8 },
      { leadership: 3.4, safety: 3.1, support: 3.0, innovation: 3.2 },
      { leadership: 4.1, safety: 3.9, support: 3.7, innovation: 4.0 },
      { leadership: 3.7, safety: 3.4, support: 3.3, innovation: 3.5 },
      { leadership: 4.6, safety: 4.3, support: 4.1, innovation: 4.5 },
    ],
  },
};

const VIEW_MODES = [
  { key: "histogram", label: "히스토그램" },
  { key: "scatter", label: "산점도" },
  { key: "simple", label: "단순회귀" },
  { key: "multiple", label: "다중회귀" },
  { key: "residuals", label: "잔차" },
];

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
}

function standardDeviation(values) {
  return Math.sqrt(variance(values));
}

function correlation(xValues, yValues) {
  if (xValues.length !== yValues.length || xValues.length < 2) return 0;
  const xMean = mean(xValues);
  const yMean = mean(yValues);
  let numerator = 0;
  let xDenominator = 0;
  let yDenominator = 0;

  for (let index = 0; index < xValues.length; index += 1) {
    const xDiff = xValues[index] - xMean;
    const yDiff = yValues[index] - yMean;
    numerator += xDiff * yDiff;
    xDenominator += xDiff ** 2;
    yDenominator += yDiff ** 2;
  }

  if (!xDenominator || !yDenominator) return 0;
  return numerator / Math.sqrt(xDenominator * yDenominator);
}

function simpleRegression(rows, xKey, yKey) {
  const pairs = rows
    .map((row) => ({ x: Number(row[xKey]), y: Number(row[yKey]) }))
    .filter((pair) => Number.isFinite(pair.x) && Number.isFinite(pair.y));

  if (pairs.length < 2) return null;

  const xValues = pairs.map((pair) => pair.x);
  const yValues = pairs.map((pair) => pair.y);
  const xMean = mean(xValues);
  const yMean = mean(yValues);
  let numerator = 0;
  let denominator = 0;

  for (const pair of pairs) {
    numerator += (pair.x - xMean) * (pair.y - yMean);
    denominator += (pair.x - xMean) ** 2;
  }

  if (!denominator) return null;

  const slope = numerator / denominator;
  const intercept = yMean - slope * xMean;
  const predicted = pairs.map((pair) => intercept + slope * pair.x);
  const residuals = pairs.map((pair, index) => pair.y - predicted[index]);
  const totalSumSquares = yValues.reduce((sum, value) => sum + (value - yMean) ** 2, 0);
  const residualSumSquares = residuals.reduce((sum, value) => sum + value ** 2, 0);

  return {
    pairs,
    slope,
    intercept,
    r: correlation(xValues, yValues),
    rSquared: totalSumSquares ? 1 - residualSumSquares / totalSumSquares : 0,
    residualPoints: pairs.map((pair, index) => ({
      predicted: predicted[index],
      residual: residuals[index],
    })),
  };
}

function solveLinearSystem(matrix, vector) {
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let pivotIndex = 0; pivotIndex < size; pivotIndex += 1) {
    let maxRow = pivotIndex;
    for (let rowIndex = pivotIndex + 1; rowIndex < size; rowIndex += 1) {
      if (Math.abs(augmented[rowIndex][pivotIndex]) > Math.abs(augmented[maxRow][pivotIndex])) {
        maxRow = rowIndex;
      }
    }

    if (Math.abs(augmented[maxRow][pivotIndex]) < 1e-10) return null;
    [augmented[pivotIndex], augmented[maxRow]] = [augmented[maxRow], augmented[pivotIndex]];
    const pivotValue = augmented[pivotIndex][pivotIndex];

    for (let columnIndex = pivotIndex; columnIndex <= size; columnIndex += 1) {
      augmented[pivotIndex][columnIndex] /= pivotValue;
    }

    for (let rowIndex = 0; rowIndex < size; rowIndex += 1) {
      if (rowIndex === pivotIndex) continue;
      const factor = augmented[rowIndex][pivotIndex];
      for (let columnIndex = pivotIndex; columnIndex <= size; columnIndex += 1) {
        augmented[rowIndex][columnIndex] -= factor * augmented[pivotIndex][columnIndex];
      }
    }
  }

  return augmented.map((row) => row[size]);
}

function multipleRegression(rows, predictorKeys, targetKey) {
  const filteredRows = rows.filter((row) =>
    predictorKeys.every((key) => Number.isFinite(Number(row[key]))) &&
    Number.isFinite(Number(row[targetKey]))
  );

  if (filteredRows.length <= predictorKeys.length + 1) return null;

  const designMatrix = filteredRows.map((row) => [1, ...predictorKeys.map((key) => Number(row[key]))]);
  const targets = filteredRows.map((row) => Number(row[targetKey]));
  const columnCount = predictorKeys.length + 1;
  const xtx = Array.from({ length: columnCount }, () => Array(columnCount).fill(0));
  const xty = Array(columnCount).fill(0);

  for (let rowIndex = 0; rowIndex < designMatrix.length; rowIndex += 1) {
    const designRow = designMatrix[rowIndex];
    for (let colIndex = 0; colIndex < columnCount; colIndex += 1) {
      xty[colIndex] += designRow[colIndex] * targets[rowIndex];
      for (let innerIndex = 0; innerIndex < columnCount; innerIndex += 1) {
        xtx[colIndex][innerIndex] += designRow[colIndex] * designRow[innerIndex];
      }
    }
  }

  const coefficients = solveLinearSystem(xtx, xty);
  if (!coefficients) return null;

  const predictions = designMatrix.map((designRow) =>
    designRow.reduce((sum, value, index) => sum + value * coefficients[index], 0)
  );
  const residuals = targets.map((value, index) => value - predictions[index]);
  const targetMean = mean(targets);
  const totalSumSquares = targets.reduce((sum, value) => sum + (value - targetMean) ** 2, 0);
  const residualSumSquares = residuals.reduce((sum, value) => sum + value ** 2, 0);

  return {
    coefficients,
    predictorKeys,
    targetKey,
    rSquared: totalSumSquares ? 1 - residualSumSquares / totalSumSquares : 0,
    residualPoints: predictions.map((predicted, index) => ({
      predicted: predicted[index],
      residual: residuals[index],
    })),
  };
}

function getNumericColumns(rows) {
  if (!rows.length) return [];
  return Object.keys(rows[0]).filter((key) =>
    rows.every((row) => Number.isFinite(Number(row[key])))
  );
}

function parseCsvText(text) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());
    return headers.reduce((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

function createHistogram(values, binCount = 6) {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = max === min ? 1 : (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    start: min + width * index,
    end: min + width * (index + 1),
    count: 0,
  }));

  values.forEach((value) => {
    const rawIndex = width === 0 ? 0 : Math.floor((value - min) / width);
    const safeIndex = Math.min(binCount - 1, Math.max(0, rawIndex));
    bins[safeIndex].count += 1;
  });

  return bins;
}

function projectPoint(x, y, z, rotation) {
  const theta = (rotation * Math.PI) / 180;
  const xRotated = x * Math.cos(theta) - y * Math.sin(theta);
  const yRotated = x * Math.sin(theta) + y * Math.cos(theta);
  return {
    x: 420 + xRotated * 120,
    y: 360 - z * 120 + yRotated * 42,
  };
}

function ChartLegend({ items }) {
  return (
    <div className="lab-legend">
      {items.map((item) => (
        <div key={item.label} className="lab-legend-item">
          <span className={`lab-legend-swatch ${item.swatchClass}`} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function HistogramChart({ values, variable }) {
  const bins = createHistogram(values);
  const maxCount = Math.max(...bins.map((bin) => bin.count), 1);

  return (
    <div className="lab-viz-stack">
      <div className="lab-viz-caption">
        <div>
          <p className="lab-viz-kicker">Distribution</p>
          <h3>{variable} 히스토그램</h3>
        </div>
        <ChartLegend items={[{ label: "구간별 빈도", swatchClass: "is-bar" }]} />
      </div>

      <svg viewBox="0 0 1040 620" className="lab-svg lab-svg-large">
        <defs>
          <linearGradient id="hist-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8ec5ff" />
            <stop offset="100%" stopColor="#3f72af" />
          </linearGradient>
        </defs>
        <line x1="110" y1="520" x2="940" y2="520" className="lab-axis-dark" />
        <line x1="110" y1="100" x2="110" y2="520" className="lab-axis-dark" />
        {bins.map((bin, index) => {
          const x = 138 + index * (760 / bins.length);
          const barWidth = 760 / bins.length - 18;
          const height = (bin.count / maxCount) * 300;
          const y = 520 - height;

          return (
            <g key={`${bin.start}-${index}`}>
              <rect x={x} y={y} width={barWidth} height={height} rx="24" fill="url(#hist-fill)" />
              <text x={x + barWidth / 2} y="550" textAnchor="middle" className="lab-tick-dark">
                {bin.start.toFixed(1)}
              </text>
              <text x={x + barWidth / 2} y={y - 14} textAnchor="middle" className="lab-value-dark">
                {bin.count}
              </text>
            </g>
          );
        })}
        <text x="520" y="585" textAnchor="middle" className="lab-label-dark">
          {variable}
        </text>
        <text x="40" y="320" textAnchor="middle" className="lab-label-dark" transform="rotate(-90 40 320)">
          빈도
        </text>
      </svg>
    </div>
  );
}

function ScatterScene({ pairs, xLabel, yLabel, line, progress = 100, showLine = false }) {
  const xValues = pairs.map((pair) => pair.x);
  const yValues = pairs.map((pair) => pair.y);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const eased = progress / 100;

  const scaleX = (value) => 140 + ((value - xMin) / (xMax - xMin || 1)) * 720;
  const scaleY = (value) => 500 - ((value - yMin) / (yMax - yMin || 1)) * 320;
  const centerX = 500;

  return (
    <svg viewBox="0 0 1040 620" className="lab-svg lab-svg-large">
      <rect x="110" y="70" width="820" height="470" rx="28" className="lab-viz-backdrop" />
      {Array.from({ length: 5 }, (_, index) => (
        <line
          key={`h-${index}`}
          x1="110"
          y1={140 + index * 80}
          x2="930"
          y2={140 + index * 80}
          className="lab-grid-line"
        />
      ))}
      {Array.from({ length: 6 }, (_, index) => (
        <line
          key={`v-${index}`}
          x1={170 + index * 120}
          y1="70"
          x2={170 + index * 120}
          y2="540"
          className="lab-grid-line"
        />
      ))}
      <line x1="110" y1="520" x2="930" y2="520" className="lab-axis-dark" />
      <line x1="110" y1="90" x2="110" y2="520" className="lab-axis-dark" />
      {showLine && line ? (
        <line
          x1={scaleX(line.x1)}
          y1={scaleY(line.y1)}
          x2={scaleX(line.x2)}
          y2={scaleY(line.y2)}
          className="lab-regression-line-strong"
          style={{ opacity: Math.max(0, (progress - 35) / 65) }}
        />
      ) : null}
      {pairs.map((pair, index) => {
        const targetX = scaleX(pair.x);
        const targetY = scaleY(pair.y);
        const animatedX = centerX + (targetX - centerX) * eased;
        const animatedY = 500 + (targetY - 500) * Math.max(0.15, eased);

        return (
          <circle
            key={`${pair.x}-${pair.y}-${index}`}
            cx={animatedX}
            cy={animatedY}
            r="10"
            className="lab-dot-strong"
          />
        );
      })}
      <text x="520" y="585" textAnchor="middle" className="lab-label-dark">
        {xLabel}
      </text>
      <text x="40" y="320" textAnchor="middle" className="lab-label-dark" transform="rotate(-90 40 320)">
        {yLabel}
      </text>
    </svg>
  );
}

function ResidualChart({ points }) {
  const predictedValues = points.map((point) => point.predicted);
  const residualValues = points.map((point) => point.residual);
  const xMin = Math.min(...predictedValues);
  const xMax = Math.max(...predictedValues);
  const maxAbsResidual = Math.max(...residualValues.map((value) => Math.abs(value)), 1);

  const scaleX = (value) => 140 + ((value - xMin) / (xMax - xMin || 1)) * 720;
  const scaleY = (value) => 315 - (value / maxAbsResidual) * 180;

  return (
    <div className="lab-viz-stack">
      <div className="lab-viz-caption">
        <div>
          <p className="lab-viz-kicker">Residuals</p>
          <h3>예측값 대비 잔차</h3>
        </div>
        <ChartLegend items={[{ label: "잔차 점", swatchClass: "is-residual" }]} />
      </div>

      <svg viewBox="0 0 1040 620" className="lab-svg lab-svg-large">
        <line x1="110" y1="520" x2="930" y2="520" className="lab-axis-dark" />
        <line x1="110" y1="90" x2="110" y2="520" className="lab-axis-dark" />
        <line x1="110" y1="315" x2="930" y2="315" className="lab-zero-line-strong" />
        {points.map((point, index) => (
          <circle
            key={`${point.predicted}-${point.residual}-${index}`}
            cx={scaleX(point.predicted)}
            cy={scaleY(point.residual)}
            r="10"
            className="lab-residual-dot-strong"
          />
        ))}
        <text x="520" y="585" textAnchor="middle" className="lab-label-dark">
          예측값
        </text>
        <text x="40" y="320" textAnchor="middle" className="lab-label-dark" transform="rotate(-90 40 320)">
          잔차
        </text>
      </svg>
    </div>
  );
}

function MultipleRegressionStage({ rows, predictors, targetKey, coefficients, rotation, progress }) {
  const xKey = predictors[0];
  const yKey = predictors[1] || predictors[0];
  const zKey = targetKey;

  const xValues = rows.map((row) => Number(row[xKey]));
  const yValues = rows.map((row) => Number(row[yKey]));
  const zValues = rows.map((row) => Number(row[zKey]));
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const zMin = Math.min(...zValues);
  const zMax = Math.max(...zValues);

  const normalize = (value, min, max) => ((value - min) / (max - min || 1)) * 2 - 1;
  const planeCorners = [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
  ];

  const planePoints = planeCorners.map((corner) => {
    const actualX = xMin + ((corner.x + 1) / 2) * (xMax - xMin || 1);
    const actualY = yMin + ((corner.y + 1) / 2) * (yMax - yMin || 1);
    const zValue = coefficients[0] + coefficients[1] * actualX + coefficients[2] * actualY;
    const projected = projectPoint(corner.x, corner.y, normalize(zValue, zMin, zMax), rotation);
    return `${projected.x},${projected.y}`;
  });

  return (
    <div className="lab-viz-stack">
      <div className="lab-viz-caption">
        <div>
          <p className="lab-viz-kicker">Regression Plane</p>
          <h3>다중회귀 평면 시각화</h3>
        </div>
        <ChartLegend
          items={[
            { label: "관측치", swatchClass: "is-point" },
            { label: "회귀평면", swatchClass: "is-plane" },
          ]}
        />
      </div>

      <svg viewBox="0 0 1040 620" className="lab-svg lab-svg-large">
        <line x1="170" y1="520" x2="900" y2="520" className="lab-axis-dark" />
        <line x1="170" y1="520" x2="140" y2="160" className="lab-axis-dark" />
        <line x1="170" y1="520" x2="520" y2="580" className="lab-axis-dark" />
        <polygon
          points={planePoints.join(" ")}
          className="lab-plane"
          style={{ opacity: 0.3 + (progress / 100) * 0.45 }}
        />
        {rows.map((row, index) => {
          const normalizedX = normalize(Number(row[xKey]), xMin, xMax);
          const normalizedY = normalize(Number(row[yKey]), yMin, yMax);
          const normalizedZ = normalize(Number(row[zKey]), zMin, zMax);
          const projected = projectPoint(normalizedX, normalizedY, normalizedZ, rotation);

          return (
            <circle
              key={`${row[xKey]}-${row[yKey]}-${row[zKey]}-${index}`}
              cx={projected.x}
              cy={projected.y}
              r="10"
              className="lab-dot-strong"
            />
          );
        })}
        <text x="520" y="605" textAnchor="middle" className="lab-label-dark">
          {xKey}
        </text>
        <text x="120" y="150" textAnchor="middle" className="lab-label-dark">
          {zKey}
        </text>
        <text x="930" y="535" textAnchor="middle" className="lab-label-dark">
          {yKey}
        </text>
      </svg>
    </div>
  );
}

export default function LabPage() {
  const [datasetKey, setDatasetKey] = useState("study");
  const [rows, setRows] = useState(PRESET_DATASETS.study.rows);
  const [viewMode, setViewMode] = useState("simple");
  const [csvText, setCsvText] = useState("");
  const [message, setMessage] = useState("");
  const [controlsOpen, setControlsOpen] = useState(true);
  const [xVariable, setXVariable] = useState("");
  const [yVariable, setYVariable] = useState("");
  const [histogramVariable, setHistogramVariable] = useState("");
  const [predictors, setPredictors] = useState([]);
  const [animationProgress, setAnimationProgress] = useState(70);
  const [rotation, setRotation] = useState(28);

  const numericColumns = getNumericColumns(rows);

  useEffect(() => {
    if (!numericColumns.length) return;
    setXVariable((current) => (numericColumns.includes(current) ? current : numericColumns[0]));
    setHistogramVariable((current) => (numericColumns.includes(current) ? current : numericColumns[0]));
    setYVariable((current) =>
      numericColumns.includes(current)
        ? current
        : numericColumns[Math.min(1, numericColumns.length - 1)] || numericColumns[0]
    );
    setPredictors((current) => {
      const valid = current.filter((value) => numericColumns.includes(value));
      if (valid.length) return valid.slice(0, 3);
      return numericColumns.slice(0, Math.min(2, numericColumns.length));
    });
  }, [rows]);

  const histogramValues = histogramVariable
    ? rows.map((row) => Number(row[histogramVariable])).filter((value) => Number.isFinite(value))
    : [];
  const simpleResult =
    xVariable && yVariable && xVariable !== yVariable
      ? simpleRegression(rows, xVariable, yVariable)
      : null;
  const activePredictors = predictors.filter((value) => value && value !== yVariable).slice(0, 2);
  const multipleResult =
    activePredictors.length >= 2 && yVariable
      ? multipleRegression(rows, activePredictors, yVariable)
      : null;
  const descriptiveValues = xVariable
    ? rows.map((row) => Number(row[xVariable])).filter((value) => Number.isFinite(value))
    : [];

  const descriptiveStats = {
    count: descriptiveValues.length,
    mean: mean(descriptiveValues),
    standardDeviation: standardDeviation(descriptiveValues),
    min: descriptiveValues.length ? Math.min(...descriptiveValues) : 0,
    max: descriptiveValues.length ? Math.max(...descriptiveValues) : 0,
  };

  const handlePresetChange = (event) => {
    const nextKey = event.target.value;
    setDatasetKey(nextKey);
    setRows(PRESET_DATASETS[nextKey].rows);
    setMessage("");
  };

  const applyCsvText = () => {
    const parsedRows = parseCsvText(csvText);
    if (!parsedRows.length) {
      setMessage("CSV 형식을 확인해주세요. 최소 헤더와 한 줄 이상의 데이터가 필요합니다.");
      return;
    }
    setRows(parsedRows);
    setMessage(`${parsedRows.length}개 행을 불러왔습니다.`);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    const parsedRows = parseCsvText(text);
    if (!parsedRows.length) {
      setMessage("업로드한 CSV를 읽지 못했습니다.");
      return;
    }
    setRows(parsedRows);
    setMessage(`${parsedRows.length}개 행을 CSV에서 불러왔습니다.`);
  };

  const togglePredictor = (column) => {
    setPredictors((current) =>
      current.includes(column)
        ? current.filter((value) => value !== column)
        : [...current, column].slice(0, 3)
    );
  };

  const chartSubtitle =
    viewMode === "multiple"
      ? "회귀평면을 돌려 보며 변수 간 관계를 입체적으로 설명합니다."
      : "그래프가 화면의 중심이 되도록 구성한 강의용 비주얼 스테이지입니다.";

  return (
    <main className="lab-shell lab-shell-cinematic">
      <header className="lab-header lab-header-cinematic">
        <div>
          <p className="eyebrow">Unified Data Lab</p>
          <h1>통계 시각화 스테이지</h1>
          <p className="lab-header-text">
            PPT를 대체하는 것이 아니라, PPT에서 꺼내 온 핵심 그래프와 분석 장면을 더 크고 더
            아름답게 보여주기 위한 프로토타입입니다.
          </p>
        </div>
        <div className="lab-header-actions">
          <button
            type="button"
            className="lab-ghost-button"
            onClick={() => setControlsOpen((value) => !value)}
          >
            {controlsOpen ? "옵션 접기" : "옵션 열기"}
          </button>
          <a className="secondary-button" href="/">
            홈으로
          </a>
        </div>
      </header>

      <section className={`lab-stage-layout ${controlsOpen ? "with-controls" : "controls-collapsed"}`}>
        <section className="lab-visual-stage">
          <div className="lab-visual-topline">
            <div>
              <p className="panel-label">Visualization</p>
              <h2>{VIEW_MODES.find((mode) => mode.key === viewMode)?.label}</h2>
              <p className="lab-help">{chartSubtitle}</p>
            </div>
            <div className="lab-top-badges">
              <span>{PRESET_DATASETS[datasetKey].name}</span>
              <span>{rows.length} rows</span>
              <span>{numericColumns.length} numeric variables</span>
            </div>
          </div>

          <div className="lab-hero-viz">
            {viewMode === "histogram" && histogramValues.length ? (
              <HistogramChart values={histogramValues} variable={histogramVariable} />
            ) : null}
            {(viewMode === "scatter" || viewMode === "simple") && simpleResult ? (
              <div className="lab-viz-stack">
                <div className="lab-viz-caption">
                  <div>
                    <p className="lab-viz-kicker">Animated Scatter</p>
                    <h3>{viewMode === "simple" ? "회귀선이 나타나는 산점도" : "산점도"}</h3>
                  </div>
                  <ChartLegend
                    items={[
                      { label: "관측치", swatchClass: "is-point" },
                      ...(viewMode === "simple" ? [{ label: "회귀 예측선", swatchClass: "is-line" }] : []),
                    ]}
                  />
                </div>
                <ScatterScene
                  pairs={simpleResult.pairs}
                  xLabel={xVariable}
                  yLabel={yVariable}
                  progress={animationProgress}
                  showLine={viewMode === "simple"}
                  line={{
                    x1: Math.min(...simpleResult.pairs.map((point) => point.x)),
                    y1:
                      simpleResult.intercept +
                      simpleResult.slope * Math.min(...simpleResult.pairs.map((point) => point.x)),
                    x2: Math.max(...simpleResult.pairs.map((point) => point.x)),
                    y2:
                      simpleResult.intercept +
                      simpleResult.slope * Math.max(...simpleResult.pairs.map((point) => point.x)),
                  }}
                />
              </div>
            ) : null}
            {viewMode === "multiple" && multipleResult ? (
              <MultipleRegressionStage
                rows={rows}
                predictors={multipleResult.predictorKeys}
                targetKey={yVariable}
                coefficients={multipleResult.coefficients}
                rotation={rotation}
                progress={animationProgress}
              />
            ) : null}
            {viewMode === "residuals" && (multipleResult || simpleResult) ? (
              <ResidualChart
                points={multipleResult?.residualPoints || simpleResult?.residualPoints || []}
              />
            ) : null}
          </div>

          <div className="lab-stage-bottom">
            <article className="lab-insight-card">
              <p className="panel-label">설명 포인트</p>
              <p>
                현재 데이터셋에서 <strong>{xVariable || "X"}</strong>와 <strong>{yVariable || "Y"}</strong>
                의 관계는 <strong>{simpleResult ? `${simpleResult.r.toFixed(3)}의 상관` : "계산 대기"}</strong>
                로 나타납니다.
              </p>
            </article>
            <article className="lab-insight-card">
              <p className="panel-label">애니메이션</p>
              <div className="lab-slider-wrap">
                <label>
                  <span>전개 정도</span>
                  <strong>{animationProgress}%</strong>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={animationProgress}
                  onChange={(event) => setAnimationProgress(Number(event.target.value))}
                />
              </div>
              {viewMode === "multiple" ? (
                <div className="lab-slider-wrap">
                  <label>
                    <span>평면 회전</span>
                    <strong>{rotation}°</strong>
                  </label>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    value={rotation}
                    onChange={(event) => setRotation(Number(event.target.value))}
                  />
                </div>
              ) : null}
            </article>
            <article className="lab-insight-card">
              <p className="panel-label">핵심 수치</p>
              <div className="lab-compact-stats">
                <div><span>평균</span><strong>{descriptiveStats.mean.toFixed(2)}</strong></div>
                <div><span>표준편차</span><strong>{descriptiveStats.standardDeviation.toFixed(2)}</strong></div>
                <div>
                  <span>R²</span>
                  <strong>
                    {multipleResult
                      ? multipleResult.rSquared.toFixed(3)
                      : simpleResult
                        ? simpleResult.rSquared.toFixed(3)
                        : "0.000"}
                  </strong>
                </div>
              </div>
            </article>
          </div>
        </section>

        <aside className={`lab-control-rail ${controlsOpen ? "open" : "closed"}`}>
          <div className="lab-control-inner">
            <div className="lab-panel lab-panel-dark">
              <p className="panel-label">Preset</p>
              <label className="lab-field">
                <span>예제 데이터셋</span>
                <select value={datasetKey} onChange={handlePresetChange}>
                  {Object.entries(PRESET_DATASETS).map(([key, dataset]) => (
                    <option key={key} value={key}>
                      {dataset.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="lab-help">{PRESET_DATASETS[datasetKey].description}</p>
            </div>

            <div className="lab-panel lab-panel-dark">
              <p className="panel-label">View</p>
              <div className="lab-tablist">
                {VIEW_MODES.map((mode) => (
                  <button
                    key={mode.key}
                    type="button"
                    className={viewMode === mode.key ? "active" : ""}
                    onClick={() => setViewMode(mode.key)}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="lab-panel lab-panel-dark">
              <p className="panel-label">Variables</p>
              <label className="lab-field">
                <span>히스토그램 변수</span>
                <select value={histogramVariable} onChange={(event) => setHistogramVariable(event.target.value)}>
                  {numericColumns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </label>
              <label className="lab-field">
                <span>X 변수</span>
                <select value={xVariable} onChange={(event) => setXVariable(event.target.value)}>
                  {numericColumns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </label>
              <label className="lab-field">
                <span>Y 변수</span>
                <select value={yVariable} onChange={(event) => setYVariable(event.target.value)}>
                  {numericColumns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </label>
              <div className="lab-field">
                <span>다중회귀 독립변수</span>
                <div className="lab-checkbox-grid">
                  {numericColumns
                    .filter((column) => column !== yVariable)
                    .map((column) => (
                      <label key={column}>
                        <input
                          type="checkbox"
                          checked={predictors.includes(column)}
                          onChange={() => togglePredictor(column)}
                        />
                        <span>{column}</span>
                      </label>
                    ))}
                </div>
              </div>
            </div>

            <div className="lab-panel lab-panel-dark">
              <p className="panel-label">Input</p>
              <label className="lab-field">
                <span>CSV 업로드</span>
                <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} />
              </label>
              <label className="lab-field">
                <span>직접 입력 또는 붙여넣기</span>
                <textarea
                  value={csvText}
                  onChange={(event) => setCsvText(event.target.value)}
                  placeholder={"hours,attendance,score\n2,75,52\n4,82,66"}
                />
              </label>
              <button type="button" className="primary-button lab-action" onClick={applyCsvText}>
                입력 데이터 적용
              </button>
              {message ? <p className="lab-message">{message}</p> : null}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
