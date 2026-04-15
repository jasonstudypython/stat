"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { downloadCsv } from "../_shared/csv";
import { useMobileFitScale } from "../_shared/useMobileFitScale";
import {
  createSeededRandom,
  formatNumber,
  formatPValue,
  invertMatrix,
  linspace,
  mean,
  normalCdf,
  sampleNormal,
  solveMatrix,
} from "../_shared/stats";

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
});

const MEDIATION_TITLE_FONT = { size: 24, color: "#112d4e" };
const MEDIATION_2D_GRID_COLOR = "rgba(120, 185, 255, 0.34)";
const MEDIATION_2D_ZERO_COLOR = "rgba(120, 185, 255, 0.3)";
const MEDIATION_2D_BG_COLOR = "rgba(242, 247, 252, 0.9)";

const STEP_OPTIONS = [
  { key: "xToM", label: "독립변수(X) → 매개변수(M)" },
  { key: "xToY", label: "독립변수(X) → 종속변수(Y)" },
  { key: "mediation", label: "독립변수(X), 매개변수(M) → 종속변수(Y)" },
];

const MOBILE_STEP_SECTIONS = [
  { key: "xToM", groupTitle: "1단계", sectionTitle: "독립변수(X) → 매개변수(M)" },
  { key: "xToY", groupTitle: "2단계", sectionTitle: "독립변수(X) → 종속변수(Y)" },
  { key: "mediation", groupTitle: "3단계", sectionTitle: "독립변수(X), 매개변수(M) → 종속변수(Y)" },
];

const MEDIATION_CAMERA_EYE = { x: 0.08, y: -1.58, z: -0.15 };
const MEDIATION_CAMERA_CENTER = { x: 0, y: 0, z: -0.1 };

function buildSimpleRegression(rows, predictorKey, outcomeKey) {
  const xValues = rows.map((row) => row[predictorKey]);
  const yValues = rows.map((row) => row[outcomeKey]);
  const xMean = mean(xValues);
  const yMean = mean(yValues);
  const sxx = xValues.reduce((sum, value) => sum + (value - xMean) ** 2, 0);
  const sxy = xValues.reduce((sum, value, index) => sum + (value - xMean) * (yValues[index] - yMean), 0);
  const slope = sxy / sxx;
  const intercept = yMean - slope * xMean;
  const predictions = xValues.map((value) => intercept + slope * value);
  const residuals = yValues.map((value, index) => value - predictions[index]);
  const rss = residuals.reduce((sum, value) => sum + value * value, 0);
  const tss = yValues.reduce((sum, value) => sum + (value - yMean) ** 2, 0);
  const regressionSumSquares = tss - rss;
  const r2 = 1 - rss / tss;
  const adjustedR2 = 1 - (1 - r2) * ((rows.length - 1) / (rows.length - 2));
  const sigmaSquared = rss / (rows.length - 2);
  const interceptStdErr = Math.sqrt(sigmaSquared * (1 / rows.length + (xMean * xMean) / sxx));
  const slopeStdErr = Math.sqrt(sigmaSquared / sxx);
  const interceptT = intercept / interceptStdErr;
  const slopeT = slope / slopeStdErr;
  const interceptP = 2 * (1 - normalCdf(Math.abs(interceptT)));
  const slopeP = 2 * (1 - normalCdf(Math.abs(slopeT)));
  const fValue = regressionSumSquares / sigmaSquared;

  return {
    intercept,
    slope,
    standardErrors: {
      intercept: interceptStdErr,
      slope: slopeStdErr,
    },
    tValues: {
      intercept: interceptT,
      slope: slopeT,
    },
    pValues: {
      intercept: interceptP,
      slope: slopeP,
    },
    r2,
    adjustedR2,
    fValue,
    modelPValue: slopeP,
    lineX: linspace(Math.min(...xValues), Math.max(...xValues), 40),
    xRange: [Math.min(...xValues), Math.max(...xValues)],
    yRange: [Math.min(...yValues), Math.max(...yValues)],
  };
}

function buildMultipleRegression(rows) {
  const xValues = rows.map((row) => row.x);
  const mValues = rows.map((row) => row.m);
  const yValues = rows.map((row) => row.y);

  const sumX = xValues.reduce((sum, value) => sum + value, 0);
  const sumM = mValues.reduce((sum, value) => sum + value, 0);
  const sumY = yValues.reduce((sum, value) => sum + value, 0);
  const sumXSq = xValues.reduce((sum, value) => sum + value * value, 0);
  const sumMSq = mValues.reduce((sum, value) => sum + value * value, 0);
  const sumXM = xValues.reduce((sum, value, index) => sum + value * mValues[index], 0);
  const sumXY = xValues.reduce((sum, value, index) => sum + value * yValues[index], 0);
  const sumMY = mValues.reduce((sum, value, index) => sum + value * yValues[index], 0);

  const xtx = [
    [rows.length, sumX, sumM],
    [sumX, sumXSq, sumXM],
    [sumM, sumXM, sumMSq],
  ];
  const xty = [sumY, sumXY, sumMY];
  const coefficients = solveMatrix(xtx, xty);
  const inverse = invertMatrix(xtx);
  const predictions = rows.map((row) => coefficients[0] + coefficients[1] * row.x + coefficients[2] * row.m);
  const residuals = yValues.map((value, index) => value - predictions[index]);
  const rss = residuals.reduce((sum, value) => sum + value * value, 0);
  const yMean = mean(yValues);
  const tss = yValues.reduce((sum, value) => sum + (value - yMean) ** 2, 0);
  const sigmaSquared = rss / (rows.length - 3);
  const explainedSumSquares = tss - rss;
  const fValue = (explainedSumSquares / 2) / sigmaSquared;
  const standardErrors = inverse.map((row, index) => Math.sqrt(Math.max(row[index], 0) * sigmaSquared));
  const tValues = coefficients.map((coefficient, index) =>
    standardErrors[index] === 0 ? 0 : coefficient / standardErrors[index],
  );
  const pValues = tValues.map((value) => 2 * (1 - normalCdf(Math.abs(value))));

  return {
    coefficients,
    standardErrors,
    tValues,
    pValues,
    r2: 1 - rss / tss,
    adjustedR2: 1 - (1 - rss / tss) * ((rows.length - 1) / (rows.length - 3)),
    fValue,
    modelPValue: 0,
    xRange: linspace(Math.min(...xValues), Math.max(...xValues), 30),
    mRange: linspace(Math.min(...mValues), Math.max(...mValues), 30),
  };
}

function buildMediationScenes() {
  const random = createSeededRandom(42);
  const rows = Array.from({ length: 250 }, () => {
    const x = sampleNormal(random, 0, 1);
    const m = 1.0 * x + sampleNormal(random, 0, 0.5);
    const y = 0.8 * m + sampleNormal(random, 0, 0.6);
    return { x, m, y };
  });

  const xToM = buildSimpleRegression(rows, "x", "m");
  const xToY = buildSimpleRegression(rows, "x", "y");
  const mediation = buildMultipleRegression(rows);
  const mediationSurface = mediation.mRange.map((m) =>
    mediation.xRange.map((x) => mediation.coefficients[0] + mediation.coefficients[1] * x + mediation.coefficients[2] * m),
  );
  const mFixedValues = linspace(
    Math.min(...rows.map((row) => row.m)),
    Math.max(...rows.map((row) => row.m)),
    5,
  );

  return {
    rows,
    xToM,
    xToY,
    mediation: {
      ...mediation,
      surface: mediationSurface,
      mFixedValues,
    },
  };
}

function buildSimplePlot(rows, regression, predictorKey, outcomeKey, labels) {
  const xPadding = (regression.xRange[1] - regression.xRange[0]) * 0.08;
  const yPadding = (regression.yRange[1] - regression.yRange[0]) * 0.08;

  return {
    data: [
      {
        type: "scatter",
        mode: "markers",
        x: rows.map((row) => row[predictorKey]),
        y: rows.map((row) => row[outcomeKey]),
        marker: {
          size: 9,
          color: "salmon",
          opacity: 0.78,
          line: {
            width: 1,
            color: "rgba(255,255,255,0.85)",
          },
        },
        hovertemplate: `${labels.x}: %{x:.2f}<br>${labels.y}: %{y:.2f}<extra></extra>`,
      },
      {
        type: "scatter",
        mode: "lines",
        x: regression.lineX,
        y: regression.lineX.map((value) => regression.intercept + regression.slope * value),
        line: {
          width: 5,
          color: "#1d4ed8",
        },
        hovertemplate: `${labels.x}: %{x:.2f}<br>${labels.y} 예측값: %{y:.2f}<extra></extra>`,
      },
    ],
    layout: {
      title: {
        text: labels.title,
        font: MEDIATION_TITLE_FONT,
      },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: MEDIATION_2D_BG_COLOR,
      margin: { l: 48, r: 20, t: 54, b: 44 },
      showlegend: false,
      xaxis: {
        title: { text: labels.x },
        showgrid: true,
        gridwidth: 2,
        gridcolor: MEDIATION_2D_GRID_COLOR,
        zeroline: true,
        zerolinecolor: MEDIATION_2D_ZERO_COLOR,
        ticks: "outside",
        ticklen: 6,
        color: "#112d4e",
        linecolor: MEDIATION_2D_GRID_COLOR,
        mirror: true,
        range: [regression.xRange[0] - xPadding, regression.xRange[1] + xPadding],
      },
      yaxis: {
        title: { text: labels.y },
        showgrid: true,
        gridwidth: 2,
        gridcolor: MEDIATION_2D_GRID_COLOR,
        zeroline: true,
        zerolinecolor: MEDIATION_2D_ZERO_COLOR,
        ticks: "outside",
        ticklen: 6,
        color: "#112d4e",
        linecolor: MEDIATION_2D_GRID_COLOR,
        mirror: true,
        range: [regression.yRange[0] - yPadding, regression.yRange[1] + yPadding],
        scaleanchor: "x",
        scaleratio: 1,
      },
    },
  };
}

function buildMediationPlot(scene, rows) {
  return {
    data: [
      {
        type: "scatter3d",
        mode: "markers",
        x: rows.map((row) => row.x),
        y: rows.map((row) => row.m),
        z: rows.map((row) => row.y),
        marker: {
          size: 2.8,
          color: "salmon",
          opacity: 0.74,
        },
        hovertemplate: "X: %{x:.2f}<br>M: %{y:.2f}<br>Y: %{z:.2f}<extra></extra>",
      },
      {
        type: "surface",
        x: scene.xRange,
        y: scene.mRange,
        z: scene.surface,
        opacity: 0.4,
        colorscale: "Blues",
        showscale: false,
        hovertemplate: "X: %{x:.2f}<br>M: %{y:.2f}<br>Y 예측값: %{z:.2f}<extra></extra>",
      },
      ...scene.mFixedValues.map((mValue) => ({
        type: "scatter3d",
        mode: "lines",
        x: scene.xRange,
        y: scene.xRange.map(() => mValue),
        z: scene.xRange.map(
          (xValue) => scene.coefficients[0] + scene.coefficients[1] * xValue + scene.coefficients[2] * mValue,
        ),
        line: {
          width: 5,
          color: "#1d4ed8",
        },
        hovertemplate: "X: %{x:.2f}<br>고정된 M: %{y:.2f}<br>Y 예측값: %{z:.2f}<extra></extra>",
        showlegend: false,
      })),
    ],
    layout: {
      title: {
        text: "독립변수(X), 매개변수(M) → 종속변수(Y)",
        font: MEDIATION_TITLE_FONT,
      },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 0, r: 0, t: 54, b: 42 },
      showlegend: false,
      scene: {
        bgcolor: "rgba(0,0,0,0)",
        aspectmode: "cube",
        xaxis: {
          title: { text: "독립변수 (X)" },
          showgrid: true,
          gridwidth: 2,
          gridcolor: "rgba(17, 45, 78, 0.28)",
          zeroline: true,
          zerolinecolor: "rgba(17, 45, 78, 0.26)",
          ticks: "outside",
          ticklen: 6,
          color: "#112d4e",
          showbackground: true,
          backgroundcolor: "rgba(238, 244, 250, 0.98)",
        },
        yaxis: {
          title: { text: "매개변수 (M)" },
          showgrid: true,
          gridwidth: 2,
          gridcolor: "rgba(17, 45, 78, 0.28)",
          zeroline: true,
          zerolinecolor: "rgba(17, 45, 78, 0.26)",
          ticks: "outside",
          ticklen: 6,
          color: "#112d4e",
          showbackground: true,
          backgroundcolor: "rgba(238, 244, 250, 0.98)",
        },
        zaxis: {
          title: { text: "종속변수 (Y)" },
          showgrid: true,
          gridwidth: 2,
          gridcolor: "rgba(17, 45, 78, 0.28)",
          zeroline: true,
          zerolinecolor: "rgba(17, 45, 78, 0.26)",
          ticks: "outside",
          ticklen: 6,
          color: "#112d4e",
          showbackground: true,
          backgroundcolor: "rgba(242, 247, 252, 0.98)",
        },
        camera: {
          eye: MEDIATION_CAMERA_EYE,
          center: MEDIATION_CAMERA_CENTER,
        },
      },
    },
  };
}

function buildModelRows(stepKey, scenes) {
  if (stepKey === "xToM") {
    return [
      { label: "R제곱", value: formatNumber(scenes.xToM.r2) },
      { label: "수정된 R제곱", value: formatNumber(scenes.xToM.adjustedR2) },
      { label: "F", value: formatNumber(scenes.xToM.fValue, 1) },
      { label: "p", value: formatPValue(scenes.xToM.modelPValue) },
    ];
  }

  if (stepKey === "xToY") {
    return [
      { label: "R제곱", value: formatNumber(scenes.xToY.r2) },
      { label: "수정된 R제곱", value: formatNumber(scenes.xToY.adjustedR2) },
      { label: "F", value: formatNumber(scenes.xToY.fValue, 1) },
      { label: "p", value: formatPValue(scenes.xToY.modelPValue) },
    ];
  }

  return [
    { label: "R제곱", value: formatNumber(scenes.mediation.r2) },
    { label: "수정된 R제곱", value: formatNumber(scenes.mediation.adjustedR2) },
    { label: "F", value: formatNumber(scenes.mediation.fValue, 1) },
    { label: "p", value: "0.000" },
  ];
}

function buildCoefficientRows(stepKey, scenes) {
  if (stepKey === "xToM") {
    return [
      {
        name: "const",
        coef: formatNumber(scenes.xToM.intercept, 4),
        stderr: formatNumber(scenes.xToM.standardErrors.intercept, 3),
        t: formatNumber(scenes.xToM.tValues.intercept, 3),
        p: formatPValue(scenes.xToM.pValues.intercept),
      },
      {
        name: "X",
        coef: formatNumber(scenes.xToM.slope, 4),
        stderr: formatNumber(scenes.xToM.standardErrors.slope, 3),
        t: formatNumber(scenes.xToM.tValues.slope, 3),
        p: formatPValue(scenes.xToM.pValues.slope),
      },
    ];
  }

  if (stepKey === "xToY") {
    return [
      {
        name: "const",
        coef: formatNumber(scenes.xToY.intercept, 4),
        stderr: formatNumber(scenes.xToY.standardErrors.intercept, 3),
        t: formatNumber(scenes.xToY.tValues.intercept, 3),
        p: formatPValue(scenes.xToY.pValues.intercept),
      },
      {
        name: "X",
        coef: formatNumber(scenes.xToY.slope, 4),
        stderr: formatNumber(scenes.xToY.standardErrors.slope, 3),
        t: formatNumber(scenes.xToY.tValues.slope, 3),
        p: formatPValue(scenes.xToY.pValues.slope),
      },
    ];
  }

  return [
    {
      name: "const",
      coef: formatNumber(scenes.mediation.coefficients[0], 4),
      stderr: formatNumber(scenes.mediation.standardErrors[0], 3),
      t: formatNumber(scenes.mediation.tValues[0], 3),
      p: formatPValue(scenes.mediation.pValues[0]),
    },
    {
      name: "X",
      coef: formatNumber(scenes.mediation.coefficients[1], 4),
      stderr: formatNumber(scenes.mediation.standardErrors[1], 3),
      t: formatNumber(scenes.mediation.tValues[1], 3),
      p: formatPValue(scenes.mediation.pValues[1]),
    },
    {
      name: "M",
      coef: formatNumber(scenes.mediation.coefficients[2], 4),
      stderr: formatNumber(scenes.mediation.standardErrors[2], 3),
      t: formatNumber(scenes.mediation.tValues[2], 3),
      p: formatPValue(scenes.mediation.pValues[2]),
    },
  ];
}

function buildStepSummaryRows(scenes) {
  return [
    {
      category: "X→M",
      r2: formatNumber(scenes.xToM.r2),
      fp: `${formatNumber(scenes.xToM.fValue, 1)} / ${formatPValue(scenes.xToM.modelPValue)}`,
      variable: "X",
      coef: formatNumber(scenes.xToM.slope, 3),
      tp: `${formatNumber(scenes.xToM.tValues.slope, 3)} / ${formatPValue(scenes.xToM.pValues.slope)}`,
      groupSize: 1,
    },
    {
      category: "X→Y",
      r2: formatNumber(scenes.xToY.r2),
      fp: `${formatNumber(scenes.xToY.fValue, 1)} / ${formatPValue(scenes.xToY.modelPValue)}`,
      variable: "X",
      coef: formatNumber(scenes.xToY.slope, 3),
      tp: `${formatNumber(scenes.xToY.tValues.slope, 3)} / ${formatPValue(scenes.xToY.pValues.slope)}`,
      groupSize: 1,
    },
    {
      category: "X+M→Y",
      r2: formatNumber(scenes.mediation.r2),
      fp: `${formatNumber(scenes.mediation.fValue, 1)} / 0.000`,
      variable: "X",
      coef: formatNumber(scenes.mediation.coefficients[1], 3),
      tp: `${formatNumber(scenes.mediation.tValues[1], 3)} / ${formatPValue(scenes.mediation.pValues[1])}`,
      groupSize: 2,
    },
    {
      category: "X+M→Y",
      r2: formatNumber(scenes.mediation.r2),
      fp: `${formatNumber(scenes.mediation.fValue, 1)} / 0.000`,
      variable: "M",
      coef: formatNumber(scenes.mediation.coefficients[2], 3),
      tp: `${formatNumber(scenes.mediation.tValues[2], 3)} / ${formatPValue(scenes.mediation.pValues[2])}`,
      groupSize: 2,
    },
  ];
}

export default function MediationEffectPage() {
  const scenes = useMemo(() => buildMediationScenes(), []);
  const mobileFit = useMobileFitScale(820, 560);
  const [step, setStep] = useState("xToM");
  const allStepSummaryRows = buildStepSummaryRows(scenes);
  const buildStepState = (stepKey) => {
    const plot =
      stepKey === "xToM"
        ? buildSimplePlot(scenes.rows, scenes.xToM, "x", "m", {
            x: "독립변수 (X)",
            y: "매개변수 (M)",
            title: "독립변수(X) → 매개변수(M)",
          })
        : stepKey === "xToY"
          ? buildSimplePlot(scenes.rows, scenes.xToY, "x", "y", {
              x: "독립변수 (X)",
              y: "종속변수 (Y)",
              title: "독립변수(X) → 종속변수(Y)",
            })
          : buildMediationPlot(scenes.mediation, scenes.rows);

    const modelRows = buildModelRows(stepKey, scenes);
    const coefficientRows = buildCoefficientRows(stepKey, scenes);
    const summaryRows =
      stepKey === "xToM" ? allStepSummaryRows.slice(0, 1) : stepKey === "xToY" ? allStepSummaryRows.slice(0, 2) : allStepSummaryRows;
    const title =
      stepKey === "xToM"
        ? "독립변수가 매개변수에 미치는 영향"
        : stepKey === "xToY"
          ? "독립변수가 종속변수에 미치는 영향"
          : "매개효과";

    return {
      plot,
      modelRows,
      coefficientRows,
      summaryRows,
      modelLabels: modelRows.map((row) => row.label),
      modelValues: modelRows.map((row) => row.value),
      title,
    };
  };

  const activeState = buildStepState(step);
  const mobileSections = MOBILE_STEP_SECTIONS.map((section) => ({
    ...section,
    state: buildStepState(section.key),
  }));

  return (
    <main className="rr-shell multireg2-shell">
      <header className="rr-header multireg2-header">
        <div>
          <p className="eyebrow">Mediation Lab</p>
          <h1>매개(Mediation) 효과</h1>
        </div>
        <div className="lab-header-action-stack">
          <Link className="secondary-button" href="/lab">
          메인으로
          </Link>
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              downloadCsv("mediation-effect-jamovi.csv", scenes.rows, [
                { label: "independent_x", value: (row) => row.x.toFixed(6) },
                { label: "mediator_m", value: (row) => row.m.toFixed(6) },
                { label: "dependent_y", value: (row) => row.y.toFixed(6) },
              ])
            }
          >
            CSV 다운로드
          </button>
        </div>
      </header>

      <section className="multireg2-layout">
        <article className="rr-graph-card multireg2-stage">
          <div className="rr-graph-head multireg2-stage-head">
            <div>
              <p className="panel-label">Graph</p>
              <h2>{activeState.title}</h2>
            </div>
          </div>

          <div className="multireg2-plot-wrap mediation-plot-wrap">
            <Plot
              data={activeState.plot.data}
              layout={{
                font: {
                  family: "Pretendard, Noto Sans KR, sans-serif",
                  color: "#112d4e",
                  size: 16,
                },
                ...activeState.plot.layout,
              }}
              config={{
                responsive: true,
                showTips: true,
                doubleClick: "reset+autosize",
                displaylogo: false,
                modeBarButtonsToRemove: ["lasso2d", "select2d", "lasso3d"],
              }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </article>

        <aside className="multireg2-panel">
          <section className="rr-step-slider multireg2-control-card">
            <select value={step} onChange={(event) => setStep(event.target.value)}>
              {STEP_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </section>

          <section className="rr-step-slider multireg2-value-card multireg2-results-card">
              <div className="mediation-results-block">
                <p className="mediation-results-label">모형</p>
                <table
                  className={`multireg2-table multireg2-model-table modlab-model-table ${
                    activeState.modelRows.length === 2 ? "is-two-column" : ""
                  }`}
                >
                  <thead>
                    <tr>
                      {activeState.modelLabels.map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {activeState.modelValues.map((value, index) => (
                        <td key={`${activeState.modelLabels[index]}-${value}`}>{value}</td>
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
                  {activeState.coefficientRows.map((row) => (
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

            <div className="mediation-results-block mediation-results-block-summary">
              <p className="mediation-results-label">단계별 분석</p>
              <table className="multireg2-table multireg2-coef-table mediation-summary-table">
                <thead>
                  <tr>
                    <th>구분</th>
                    <th>R제곱</th>
                    <th>F/p값</th>
                    <th>변수</th>
                    <th>회귀계수</th>
                    <th>t/p값</th>
                  </tr>
                </thead>
                <tbody>
                  {activeState.summaryRows.map((row, index) => (
                    <tr key={`${row.category}-${row.variable}-${index}`}>
                      {row.groupSize === 2 && row.variable === "X" ? (
                        <>
                          <td rowSpan={2}>{row.category}</td>
                          <td rowSpan={2}>{row.r2}</td>
                          <td rowSpan={2}>{row.fp}</td>
                        </>
                      ) : null}
                      {row.groupSize === 1 ? (
                        <>
                          <td>{row.category}</td>
                          <td>{row.r2}</td>
                          <td>{row.fp}</td>
                        </>
                      ) : null}
                      <td>{row.variable}</td>
                      <td>{row.coef}</td>
                      <td>{row.tp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </aside>
      </section>

      <div
        ref={mobileFit.frameRef}
        className="mediation-mobile-fit-frame"
        data-ready={mobileFit.ready ? "true" : "false"}
        style={mobileFit.height ? { height: `${mobileFit.height}px` } : undefined}
      >
        <div
          ref={mobileFit.contentRef}
          className="mediation-mobile-fit-inner"
          style={{ transform: `scale(${mobileFit.scale})` }}
        >
          <section className="mediation-mobile-stack">
            {mobileSections.map((section) => (
              <article key={section.key} className="rr-graph-card mediation-mobile-section">
                <div className="rr-graph-head multireg2-stage-head mediation-mobile-head">
                  <div>
                    <p className="panel-label">{section.groupTitle}</p>
                    <h2>{section.sectionTitle}</h2>
                  </div>
                </div>

                <div className="multireg2-plot-wrap mediation-plot-wrap mediation-mobile-plot">
                  <Plot
                    data={section.state.plot.data}
                    layout={{
                      font: {
                        family: "Pretendard, Noto Sans KR, sans-serif",
                        color: "#112d4e",
                        size: 14,
                      },
                      ...section.state.plot.layout,
                      margin: { l: 36, r: 14, t: 48, b: 36 },
                    }}
                    config={{
                      responsive: true,
                      showTips: true,
                      doubleClick: "reset+autosize",
                      displaylogo: false,
                      displayModeBar: false,
                    }}
                    style={{ width: "100%", height: "100%" }}
                  />
                </div>

                <section className="rr-step-slider multireg2-value-card multireg2-results-card mediation-mobile-cards">
                  <div className="mediation-results-block">
                    <p className="mediation-results-label">모형</p>
                    <table
                      className={`multireg2-table multireg2-model-table modlab-model-table ${
                        section.state.modelRows.length === 2 ? "is-two-column" : ""
                      }`}
                    >
                      <thead>
                        <tr>
                          {section.state.modelLabels.map((label) => (
                            <th key={label}>{label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {section.state.modelValues.map((value, index) => (
                            <td key={`${section.state.modelLabels[index]}-${value}`}>{value}</td>
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
                        {section.state.coefficientRows.map((row) => (
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

                  <div className="mediation-results-block mediation-results-block-summary">
                    <p className="mediation-results-label">단계별 분석</p>
                    <table className="multireg2-table multireg2-coef-table mediation-summary-table">
                      <thead>
                        <tr>
                          <th>구분</th>
                          <th>R제곱</th>
                          <th>F/p값</th>
                          <th>변수</th>
                          <th>회귀계수</th>
                          <th>t/p값</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.state.summaryRows.map((row, index) => (
                          <tr key={`${row.category}-${row.variable}-${index}`}>
                            {row.groupSize === 2 && row.variable === "X" ? (
                              <>
                                <td rowSpan={2}>{row.category}</td>
                                <td rowSpan={2}>{row.r2}</td>
                                <td rowSpan={2}>{row.fp}</td>
                              </>
                            ) : null}
                            {row.groupSize === 1 ? (
                              <>
                                <td>{row.category}</td>
                                <td>{row.r2}</td>
                                <td>{row.fp}</td>
                              </>
                            ) : null}
                            <td>{row.variable}</td>
                            <td>{row.coef}</td>
                            <td>{row.tp}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </article>
            ))}
          </section>

          <div className="mediation-mobile-footer">
            <Link className="secondary-button" href="/lab">
              메인으로
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
