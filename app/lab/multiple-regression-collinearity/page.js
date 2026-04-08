"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
});

const MODE_OPTIONS = [
  { key: "multiple", label: "다중회귀분석" },
  { key: "collinearity", label: "공선성" },
];

const MULTIPLE_VIEW_OPTIONS = [
  { key: "overview", label: "회귀평면" },
  { key: "x2Control", label: "x2 통제" },
  { key: "x1Control", label: "x1 통제" },
];

const COLLINEARITY_VIEW_OPTIONS = [
  { key: "correlation", label: "상관관계분석" },
  { key: "regression", label: "회귀분석" },
];

const CAMERA_PRESETS = {
  overview: { x: 0.45, y: -1.77, z: 0.48 },
  x2Control: { x: 0, y: -1.48, z: -0.1 },
  x1Control: { x: -1.58, y: -0.08, z: -0.18 },
  collinearityRegression: { x: -1.46, y: -1.34, z: 0.78 },
};

const CAMERA_CENTER_PRESETS = {
  overview: { x: 0, y: 0, z: -0.2 },
  x2Control: { x: 0, y: 0, z: -0.2 },
  x1Control: { x: 0, y: 0, z: -0.18 },
  collinearityRegression: { x: 0, y: 0, z: -0.08 },
};

const MULTIPLE_REGRESSION_RESULTS = {
  model: [
    { label: "R²", value: "0.803" },
    { label: "수정된 R²", value: "0.799" },
    { label: "F", value: "198.2" },
    { label: "p", value: "0.000" },
  ],
  coefficients: [
    { name: "const", coef: "59.1614", stderr: "1.303", t: "45.419", p: "0.000" },
    { name: "x1", coef: "2.2261", stderr: "0.120", t: "18.533", p: "0.000" },
    { name: "x2", coef: "1.4836", stderr: "0.153", t: "9.728", p: "0.000" },
  ],
};

const COLLINEARITY_CORRELATION_RESULTS = {
  model: [
    { label: "상관계수 r", value: "0.996" },
    { label: "p", value: "0.000" },
  ],
  matrix: [
    { name: "x1", x1: "1.000", x2: "0.996***" },
    { name: "x2", x1: "0.996***", x2: "1.000" },
  ],
};

const COLLINEARITY_REGRESSION_RESULTS = {
  model: [
    { label: "R제곱", value: "0.902" },
    { label: "수정된 R제곱", value: "0.900" },
    { label: "F", value: "448.4" },
    { label: "p", value: "0.000" },
  ],
  coefficients: [
    { name: "const", coef: "59.0469", stderr: "0.615", t: "95.988", p: "0.000" },
    { name: "x1", coef: "2.3734", stderr: "1.361", t: "1.743", p: "0.084" },
    { name: "x2", coef: "1.3363", stderr: "1.525", t: "0.876", p: "0.383" },
  ],
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

function linspace(start, end, count) {
  if (count <= 1) return [start];
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, index) => start + step * index);
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function solveMatrix(matrix, vector) {
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let pivotIndex = 0; pivotIndex < size; pivotIndex += 1) {
    let maxRow = pivotIndex;
    for (let rowIndex = pivotIndex + 1; rowIndex < size; rowIndex += 1) {
      if (Math.abs(augmented[rowIndex][pivotIndex]) > Math.abs(augmented[maxRow][pivotIndex])) {
        maxRow = rowIndex;
      }
    }

    [augmented[pivotIndex], augmented[maxRow]] = [augmented[maxRow], augmented[pivotIndex]];
    const pivot = augmented[pivotIndex][pivotIndex];

    for (let columnIndex = pivotIndex; columnIndex <= size; columnIndex += 1) {
      augmented[pivotIndex][columnIndex] /= pivot;
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

function invertMatrix(matrix) {
  const size = matrix.length;
  const augmented = matrix.map((row, rowIndex) => [
    ...row,
    ...Array.from({ length: size }, (_, columnIndex) => (rowIndex === columnIndex ? 1 : 0)),
  ]);

  for (let pivotIndex = 0; pivotIndex < size; pivotIndex += 1) {
    let maxRow = pivotIndex;
    for (let rowIndex = pivotIndex + 1; rowIndex < size; rowIndex += 1) {
      if (Math.abs(augmented[rowIndex][pivotIndex]) > Math.abs(augmented[maxRow][pivotIndex])) {
        maxRow = rowIndex;
      }
    }

    [augmented[pivotIndex], augmented[maxRow]] = [augmented[maxRow], augmented[pivotIndex]];
    const pivot = augmented[pivotIndex][pivotIndex];

    for (let columnIndex = 0; columnIndex < size * 2; columnIndex += 1) {
      augmented[pivotIndex][columnIndex] /= pivot;
    }

    for (let rowIndex = 0; rowIndex < size; rowIndex += 1) {
      if (rowIndex === pivotIndex) continue;
      const factor = augmented[rowIndex][pivotIndex];
      for (let columnIndex = 0; columnIndex < size * 2; columnIndex += 1) {
        augmented[rowIndex][columnIndex] -= factor * augmented[pivotIndex][columnIndex];
      }
    }
  }

  return augmented.map((row) => row.slice(size));
}

function correlation(valuesA, valuesB) {
  const meanA = mean(valuesA);
  const meanB = mean(valuesB);
  let numerator = 0;
  let denomA = 0;
  let denomB = 0;

  for (let index = 0; index < valuesA.length; index += 1) {
    const centeredA = valuesA[index] - meanA;
    const centeredB = valuesB[index] - meanB;
    numerator += centeredA * centeredB;
    denomA += centeredA * centeredA;
    denomB += centeredB * centeredB;
  }

  return numerator / Math.sqrt(denomA * denomB);
}

function erf(value) {
  const sign = value < 0 ? -1 : 1;
  const absolute = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * absolute);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absolute * absolute));
  return sign * y;
}

function normalCdf(value) {
  return 0.5 * (1 + erf(value / Math.sqrt(2)));
}

function formatNumber(value, digits = 3) {
  return value.toFixed(digits);
}

function formatPValue(value) {
  if (value < 0.0005) {
    return "0.000";
  }

  return value.toFixed(3);
}

function formatSignificanceStars(value) {
  if (value < 0.001) {
    return "***";
  }

  if (value < 0.01) {
    return "**";
  }

  if (value < 0.05) {
    return "*";
  }

  return "";
}

function buildRegressionDataset(rows) {
  const x1Values = rows.map((row) => row.x1);
  const x2Values = rows.map((row) => row.x2);
  const yValues = rows.map((row) => row.y);

  const sumX1 = x1Values.reduce((sum, value) => sum + value, 0);
  const sumX2 = x2Values.reduce((sum, value) => sum + value, 0);
  const sumY = yValues.reduce((sum, value) => sum + value, 0);
  const sumX1Sq = x1Values.reduce((sum, value) => sum + value * value, 0);
  const sumX2Sq = x2Values.reduce((sum, value) => sum + value * value, 0);
  const sumX1X2 = x1Values.reduce((sum, value, index) => sum + value * x2Values[index], 0);
  const sumX1Y = x1Values.reduce((sum, value, index) => sum + value * yValues[index], 0);
  const sumX2Y = x2Values.reduce((sum, value, index) => sum + value * yValues[index], 0);

  const xtx = [
    [rows.length, sumX1, sumX2],
    [sumX1, sumX1Sq, sumX1X2],
    [sumX2, sumX1X2, sumX2Sq],
  ];
  const xty = [sumY, sumX1Y, sumX2Y];
  const coefficients = solveMatrix(xtx, xty);
  const inverse = invertMatrix(xtx);
  const predictions = rows.map(
    (row) => coefficients[0] + coefficients[1] * row.x1 + coefficients[2] * row.x2,
  );
  const residuals = yValues.map((value, index) => value - predictions[index]);
  const rss = residuals.reduce((sum, value) => sum + value * value, 0);
  const yMean = mean(yValues);
  const tss = yValues.reduce((sum, value) => sum + (value - yMean) ** 2, 0);
  const degreesOfFreedom = rows.length - 3;
  const sigmaSquared = rss / degreesOfFreedom;
  const explainedSumSquares = tss - rss;
  const fValue = (explainedSumSquares / 2) / sigmaSquared;
  const standardErrors = inverse.map((row, index) => Math.sqrt(Math.max(row[index], 0) * sigmaSquared));
  const tValues = coefficients.map((coefficient, index) =>
    standardErrors[index] === 0 ? 0 : coefficient / standardErrors[index],
  );
  const pValues = tValues.map((tValue) => 2 * (1 - normalCdf(Math.abs(tValue))));
  const variableCorrelation = correlation(x1Values, x2Values);
  const correlationTValue =
    variableCorrelation * Math.sqrt((rows.length - 2) / Math.max(1 - variableCorrelation ** 2, 1e-12));
  const correlationPValue = 2 * (1 - normalCdf(Math.abs(correlationTValue)));

  return {
    rows,
    coefficients: {
      b0: coefficients[0],
      b1: coefficients[1],
      b2: coefficients[2],
    },
    standardErrors: {
      b0: standardErrors[0],
      b1: standardErrors[1],
      b2: standardErrors[2],
    },
    tValues: {
      b0: tValues[0],
      b1: tValues[1],
      b2: tValues[2],
    },
    pValues: {
      b0: pValues[0],
      b1: pValues[1],
      b2: pValues[2],
    },
    r2: 1 - rss / tss,
    adjustedR2: 1 - (1 - rss / tss) * ((rows.length - 1) / (rows.length - 3)),
    fValue,
    modelPValue: 0,
    correlation: variableCorrelation,
    correlationPValue,
    ranges: {
      x1: [Math.min(...x1Values), Math.max(...x1Values)],
      x2: [Math.min(...x2Values), Math.max(...x2Values)],
      y: [Math.min(...yValues), Math.max(...yValues)],
    },
  };
}

function buildTeachingScenes() {
  const teachingRandom = createSeededRandom(42);
  const baseRows = Array.from({ length: 100 }, () => {
    const x1 = sampleNormal(teachingRandom, 5, 2);
    const x2 = sampleNormal(teachingRandom, 7, 1.5);
    const y = 60 + 2 * x1 + 1.5 * x2 + sampleNormal(teachingRandom, 0, 2);
    return { x1, x2, y };
  });

  const multiple = buildRegressionDataset(baseRows);
  const x1Range = linspace(multiple.ranges.x1[0], multiple.ranges.x1[1], 30);
  const x2Range = linspace(multiple.ranges.x2[0], multiple.ranges.x2[1], 30);
  const surface = x2Range.map((x2) =>
    x1Range.map((x1) => multiple.coefficients.b0 + multiple.coefficients.b1 * x1 + multiple.coefficients.b2 * x2),
  );
  const x2FixedValues = linspace(multiple.ranges.x2[0], multiple.ranges.x2[1], 5);
  const x1FixedValues = linspace(0, multiple.ranges.x1[1], 5);

  const collinearityRandom = createSeededRandom(42);
  const collinearityRows = Array.from({ length: 100 }, () => {
    const x1 = sampleNormal(collinearityRandom, 5, 2);
    const x2 = x1 * 0.9 + sampleNormal(collinearityRandom, 0, 0.15);
    const y = 60 + 2 * x1 + 1.5 * x2 + sampleNormal(collinearityRandom, 0, 2);
    return { x1, x2, y };
  });
  const collinearity = buildRegressionDataset(collinearityRows);
  const collinearityX1Range = linspace(collinearity.ranges.x1[0], collinearity.ranges.x1[1], 30);
  const collinearityX2Range = linspace(collinearity.ranges.x2[0], collinearity.ranges.x2[1], 30);
  const collinearitySurface = collinearityX2Range.map((x2) =>
    collinearityX1Range.map(
      (x1) => collinearity.coefficients.b0 + collinearity.coefficients.b1 * x1 + collinearity.coefficients.b2 * x2,
    ),
  );

  return {
    multiple: {
      ...multiple,
      x1Range,
      x2Range,
      surface,
      x2FixedValues,
      x1FixedValues,
    },
    collinearity: {
      ...collinearity,
      x1Range: collinearityX1Range,
      x2Range: collinearityX2Range,
      surface: collinearitySurface,
    },
  };
}

function buildMultiplePlot(scene, viewKey) {
  const { rows, x1Range, x2Range, surface, x2FixedValues, x1FixedValues, coefficients } = scene;
  const data = [
    {
      type: "scatter3d",
      mode: "markers",
      x: rows.map((row) => row.x1),
      y: rows.map((row) => row.x2),
      z: rows.map((row) => row.y),
      name: "관측값",
      marker: {
        size: 4,
        color: "salmon",
        opacity: 0.74,
      },
      hovertemplate:
        "공부시간: %{x:.2f}<br>수면시간: %{y:.2f}<br>시험점수: %{z:.2f}<extra></extra>",
    },
    {
      type: "surface",
      x: x1Range,
      y: x2Range,
      z: surface,
      opacity: 0.42,
      colorscale: "Blues",
      showscale: false,
      name: "회귀평면",
      hovertemplate:
        "공부시간: %{x:.2f}<br>수면시간: %{y:.2f}<br>예측점수: %{z:.2f}<extra></extra>",
    },
  ];

  if (viewKey === "x2Control") {
    x2FixedValues.forEach((value, index) => {
      data.push({
        type: "scatter3d",
        mode: "lines",
        x: x1Range,
        y: x1Range.map(() => value),
        z: x1Range.map((x1) => coefficients.b0 + coefficients.b1 * x1 + coefficients.b2 * value),
        name: `x2=${value.toFixed(1)}`,
        line: {
          width: 6,
          color: ["#1d4ed8", "#2563eb", "#0ea5e9", "#14b8a6", "#7c3aed"][index],
        },
        hovertemplate:
          "공부시간: %{x:.2f}<br>고정된 수면시간: %{y:.2f}<br>예측점수: %{z:.2f}<extra></extra>",
      });
    });
  }

  if (viewKey === "x1Control") {
    x1FixedValues.forEach((value, index) => {
      data.push({
        type: "scatter3d",
        mode: "lines",
        x: x2Range.map(() => value),
        y: x2Range,
        z: x2Range.map((x2) => coefficients.b0 + coefficients.b1 * value + coefficients.b2 * x2),
        name: `x1=${value.toFixed(1)}`,
        line: {
          width: 6,
          color: ["#1d4ed8", "#2563eb", "#0ea5e9", "#14b8a6", "#7c3aed"][index],
        },
        hovertemplate:
          "고정된 공부시간: %{x:.2f}<br>수면시간: %{y:.2f}<br>예측점수: %{z:.2f}<extra></extra>",
      });
    });
  }

  const titles = {
    overview: "x1과 x2가 시험점수에 미치는 영향",
    x2Control: "x2를 통제한 상태에서 x1의 효과",
    x1Control: "x1을 통제한 상태에서 x2의 효과",
  };

  return {
    data,
    layout: {
      title: {
        text: titles[viewKey],
        font: { size: 24, color: "#112d4e" },
      },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 0, r: 0, t: 54, b: 42 },
      showlegend: viewKey !== "overview",
      legend: {
        bgcolor: "rgba(255,255,255,0.82)",
        bordercolor: "rgba(17,45,78,0.08)",
        borderwidth: 1,
      },
      scene: {
        bgcolor: "rgba(0,0,0,0)",
        xaxis: {
          title: { text: "공부시간 (x<sub>1</sub>)" },
          showgrid: true,
          gridwidth: 2,
          gridcolor: "rgba(17, 45, 78, 0.28)",
          zeroline: true,
          zerolinecolor: "rgba(17, 45, 78, 0.26)",
          ticks: "outside",
          ticklen: 6,
          nticks: 6,
          color: "#112d4e",
          showbackground: true,
          backgroundcolor: "rgba(238, 244, 250, 0.98)",
        },
        yaxis: {
          title: { text: "수면시간 (x<sub>2</sub>)" },
          showgrid: true,
          gridwidth: 2,
          gridcolor: "rgba(17, 45, 78, 0.28)",
          zeroline: true,
          zerolinecolor: "rgba(17, 45, 78, 0.26)",
          ticks: "outside",
          ticklen: 6,
          nticks: 6,
          color: "#112d4e",
          showbackground: true,
          backgroundcolor: "rgba(238, 244, 250, 0.98)",
        },
        zaxis: {
          title: { text: "시험점수 (y)" },
          showgrid: true,
          gridwidth: 2,
          gridcolor: "rgba(17, 45, 78, 0.28)",
          zeroline: true,
          zerolinecolor: "rgba(17, 45, 78, 0.26)",
          ticks: "outside",
          ticklen: 6,
          nticks: 7,
          color: "#112d4e",
          showbackground: true,
          backgroundcolor: "rgba(242, 247, 252, 0.98)",
        },
        camera: {
          eye: CAMERA_PRESETS[viewKey],
          center: CAMERA_CENTER_PRESETS[viewKey],
        },
      },
    },
  };
}

function buildCollinearityPlot(scene, viewKey) {
  const x1Values = scene.rows.map((row) => row.x1);
  const x2Values = scene.rows.map((row) => row.x2);
  const yValues = scene.rows.map((row) => row.y);

  if (viewKey === "correlation") {
    return {
      data: [
        {
          type: "scatter",
          mode: "markers",
          x: x1Values,
          y: x2Values,
          marker: {
            size: 10,
            color: "salmon",
            opacity: 0.82,
            line: {
              width: 1,
              color: "rgba(255,255,255,0.85)",
            },
          },
          hovertemplate:
            "공부시간: %{x:.2f}<br>복습시간: %{y:.2f}<extra></extra>",
        },
      ],
      layout: {
        title: {
          text: "공부시간(x1)과 복습시간(x2)의 상관관계",
          font: { size: 24, color: "#112d4e" },
        },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        margin: { l: 62, r: 24, t: 54, b: 58 },
        xaxis: {
          title: { text: "공부시간 (x₁)" },
          showgrid: true,
          gridcolor: "rgba(17, 45, 78, 0.14)",
          zeroline: false,
          ticks: "outside",
          ticklen: 6,
          color: "#112d4e",
        },
        yaxis: {
          title: { text: "복습시간 (x₂)" },
          showgrid: true,
          gridcolor: "rgba(17, 45, 78, 0.14)",
          zeroline: false,
          ticks: "outside",
          ticklen: 6,
          color: "#112d4e",
        },
      },
    };
  }

  return {
    data: [
      {
        type: "scatter3d",
        mode: "markers",
        x: x1Values,
        y: x2Values,
        z: yValues,
        marker: {
          size: 4,
          color: "salmon",
          opacity: 0.74,
        },
        hovertemplate:
          "공부시간: %{x:.2f}<br>복습시간: %{y:.2f}<br>시험점수: %{z:.2f}<extra></extra>",
      },
      {
        type: "surface",
        x: scene.x1Range,
        y: scene.x2Range,
        z: scene.surface,
        opacity: 0.4,
        colorscale: "Blues",
        showscale: false,
        hovertemplate:
          "공부시간: %{x:.2f}<br>복습시간: %{y:.2f}<br>예측점수: %{z:.2f}<extra></extra>",
      },
    ],
    layout: {
      title: {
        text: "공부시간과 복습시간이 시험점수에 미치는 영향",
        font: { size: 24, color: "#112d4e" },
      },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 0, r: 0, t: 54, b: 42 },
      showlegend: false,
      scene: {
        bgcolor: "rgba(0,0,0,0)",
        aspectmode: "cube",
        xaxis: {
          title: { text: "공부시간 (x<sub>1</sub>)" },
          showgrid: true,
          gridwidth: 2,
          gridcolor: "rgba(17, 45, 78, 0.28)",
          zeroline: true,
          zerolinecolor: "rgba(17, 45, 78, 0.26)",
          ticks: "outside",
          ticklen: 6,
          nticks: 6,
          color: "#112d4e",
          showbackground: true,
          backgroundcolor: "rgba(238, 244, 250, 0.98)",
        },
        yaxis: {
          title: { text: "복습시간 (x<sub>2</sub>)" },
          showgrid: true,
          gridwidth: 2,
          gridcolor: "rgba(17, 45, 78, 0.28)",
          zeroline: true,
          zerolinecolor: "rgba(17, 45, 78, 0.26)",
          ticks: "outside",
          ticklen: 6,
          nticks: 6,
          color: "#112d4e",
          showbackground: true,
          backgroundcolor: "rgba(238, 244, 250, 0.98)",
        },
        zaxis: {
          title: { text: "시험점수 (y)" },
          showgrid: true,
          gridwidth: 2,
          gridcolor: "rgba(17, 45, 78, 0.28)",
          zeroline: true,
          zerolinecolor: "rgba(17, 45, 78, 0.26)",
          ticks: "outside",
          ticklen: 6,
          nticks: 7,
          color: "#112d4e",
          showbackground: true,
          backgroundcolor: "rgba(242, 247, 252, 0.98)",
        },
        camera: {
          eye: CAMERA_PRESETS.collinearityRegression,
          center: CAMERA_CENTER_PRESETS.collinearityRegression,
        },
      },
    },
  };
}

export default function MultipleRegressionCollinearityPage() {
  const scenes = useMemo(() => buildTeachingScenes(), []);
  const [mode, setMode] = useState("multiple");
  const [multipleView, setMultipleView] = useState("overview");
  const [collinearityView, setCollinearityView] = useState("correlation");

  const activeCollinearityScene = scenes.collinearity;
  const activePlot =
    mode === "multiple"
      ? buildMultiplePlot(scenes.multiple, multipleView)
      : buildCollinearityPlot(activeCollinearityScene, collinearityView);
  const multipleModelLabels = MULTIPLE_REGRESSION_RESULTS.model.map((item) => item.label);
  const multipleModelValues = MULTIPLE_REGRESSION_RESULTS.model.map((item) => item.value);
  const activeCollinearityModelRows =
    collinearityView === "correlation"
      ? COLLINEARITY_CORRELATION_RESULTS.model
      : COLLINEARITY_REGRESSION_RESULTS.model;
  const activeCollinearityModelLabels = activeCollinearityModelRows.map((item) => item.label);
  const activeCollinearityModelValues = activeCollinearityModelRows.map((item) => item.value);

  return (
    <main className="rr-shell multireg2-shell">
      <header className="rr-header multireg2-header">
        <div>
          <p className="eyebrow">Regression Lab</p>
          <h1>다중회귀분석과 공선성</h1>
        </div>
        <Link className="secondary-button" href="/lab">
          메인으로
        </Link>
      </header>

      <section className="multireg2-layout">
        <article className="rr-graph-card multireg2-stage">
          <div className="rr-graph-head multireg2-stage-head">
            <div>
              <p className="panel-label">Graph</p>
              <h2>
                {mode === "multiple"
                  ? "다중회귀분석의 회귀계수 해석"
                  : "공선성의 분석 결과 해석"}
              </h2>
            </div>
          </div>

          <div className="multireg2-plot-wrap">
            <Plot
              data={activePlot.data}
              layout={{
                font: {
                  family: "Pretendard, Noto Sans KR, sans-serif",
                  color: "#112d4e",
                  size: 16,
                },
                ...activePlot.layout,
              }}
              config={{
                responsive: true,
                displaylogo: false,
                modeBarButtonsToRemove: ["lasso2d", "select2d", "lasso3d"],
              }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </article>

        <aside className="multireg2-panel">
          <section className="rr-step-slider multireg2-control-card">
            <select value={mode} onChange={(event) => setMode(event.target.value)}>
              {MODE_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </section>

          <section className="rr-step-slider multireg2-control-card">
            <select
              value={mode === "multiple" ? multipleView : collinearityView}
              onChange={(event) => {
                if (mode === "multiple") {
                  setMultipleView(event.target.value);
                } else {
                  setCollinearityView(event.target.value);
                }
              }}
            >
              {(mode === "multiple" ? MULTIPLE_VIEW_OPTIONS : COLLINEARITY_VIEW_OPTIONS).map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </section>

          {mode === "multiple" ? (
            <section className="rr-step-slider multireg2-value-card multireg2-results-card">
              <div className="mediation-results-block">
                <p className="mediation-results-label">모형</p>
                <table className="multireg2-table multireg2-model-table modlab-model-table">
                  <thead>
                    <tr>
                      {multipleModelLabels.map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {multipleModelValues.map((value, index) => (
                        <td key={`${multipleModelLabels[index]}-${value}`}>{value}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mediation-results-block">
                <p className="mediation-results-label">회귀계수</p>
                <table className="multireg2-table multireg2-coef-table">
                  <thead>
                    <tr>
                      <th>구분</th>
                      <th>회귀계수</th>
                      <th>표준오차</th>
                      <th>t</th>
                      <th>p</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MULTIPLE_REGRESSION_RESULTS.coefficients.map((row) => (
                      <tr key={row.name}>
                        <td>{row.name}</td>
                        <td>{row.coef}</td>
                        <td>{row.stderr}</td>
                        <td>{row.t}</td>
                        <td>{row.p}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section className="rr-step-slider multireg2-value-card multireg2-results-card">
              <div className="mediation-results-block">
                <p className="mediation-results-label">모형</p>
                <table
                  className={`multireg2-table multireg2-model-table modlab-model-table ${
                    activeCollinearityModelRows.length === 2 ? "is-two-column" : ""
                  }`}
                >
                  <thead>
                    <tr>
                      {activeCollinearityModelLabels.map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {activeCollinearityModelValues.map((value, index) => (
                        <td key={`${activeCollinearityModelLabels[index]}-${value}`}>{value}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              {collinearityView === "correlation" ? (
                <div className="mediation-results-block mediation-results-block-summary">
                  <p className="mediation-results-label">상관행렬</p>
                  <table className="multireg2-table multireg2-coef-table mediation-summary-table">
                    <thead>
                      <tr>
                        <th>변수</th>
                        <th>x1</th>
                        <th>x2</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COLLINEARITY_CORRELATION_RESULTS.matrix.map((row) => (
                        <tr key={row.name}>
                          <td>{row.name}</td>
                          <td>{row.x1}</td>
                          <td>{row.x2}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="multireg2-note">*** p&lt;0.001, ** p&lt;0.01, * p&lt;0.05</p>
                </div>
              ) : (
                <div className="mediation-results-block">
                  <p className="mediation-results-label">회귀계수</p>
                  <table className="multireg2-table multireg2-coef-table">
                    <thead>
                      <tr>
                        <th>구분</th>
                        <th>회귀계수</th>
                        <th>표준오차</th>
                        <th>t</th>
                        <th>p</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COLLINEARITY_REGRESSION_RESULTS.coefficients.map((row) => (
                        <tr key={row.name}>
                          <td>{row.name}</td>
                          <td>{row.coef}</td>
                          <td>{row.stderr}</td>
                          <td>{row.t}</td>
                          <td>{row.p}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}
