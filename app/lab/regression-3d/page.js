"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { downloadCsv } from "../_shared/csv";

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
});

const CAMERA_PRESETS = {
  diagonal: { x: 1.55, y: 1.45, z: 0.95 },
  x1: { x: 0.15, y: 2.2, z: 0.8 },
  top: { x: 0.02, y: 0.1, z: 2.35 },
  side: { x: 2.2, y: 0.12, z: 0.72 },
};

const SCENE_PRESETS = {
  overview: {
    label: "기본 보기",
    camera: "diagonal",
    showPoints: true,
    showPlane: true,
    showSlices: true,
  },
  x1Effect: {
    label: "x1 효과 강조",
    camera: "x1",
    showPoints: true,
    showPlane: true,
    showSlices: true,
  },
  planeOnly: {
    label: "평면 읽기",
    camera: "top",
    showPoints: false,
    showPlane: true,
    showSlices: true,
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

function solveLinearSystem3x3(matrix, vector) {
  const a = matrix.map((row) => [...row]);
  const b = [...vector];

  for (let i = 0; i < 3; i += 1) {
    let pivot = i;
    for (let row = i + 1; row < 3; row += 1) {
      if (Math.abs(a[row][i]) > Math.abs(a[pivot][i])) {
        pivot = row;
      }
    }

    if (pivot !== i) {
      [a[i], a[pivot]] = [a[pivot], a[i]];
      [b[i], b[pivot]] = [b[pivot], b[i]];
    }

    const pivotValue = a[i][i];
    for (let col = i; col < 3; col += 1) {
      a[i][col] /= pivotValue;
    }
    b[i] /= pivotValue;

    for (let row = 0; row < 3; row += 1) {
      if (row === i) continue;
      const factor = a[row][i];
      for (let col = i; col < 3; col += 1) {
        a[row][col] -= factor * a[i][col];
      }
      b[row] -= factor * b[i];
    }
  }

  return b;
}

function linspace(start, end, count) {
  if (count === 1) return [start];
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, index) => start + step * index);
}

function buildRegressionScene() {
  const random = createSeededRandom(42);
  const rows = Array.from({ length: 100 }, () => {
    const x1 = sampleNormal(random, 5, 2);
    const x2 = sampleNormal(random, 7, 1.5);
    const y = 60 + 2 * x1 + 1.5 * x2 + sampleNormal(random, 0, 2);
    return { x1, x2, y };
  });

  let sumX1 = 0;
  let sumX2 = 0;
  let sumY = 0;
  let sumX1Sq = 0;
  let sumX2Sq = 0;
  let sumX1X2 = 0;
  let sumX1Y = 0;
  let sumX2Y = 0;

  rows.forEach(({ x1, x2, y }) => {
    sumX1 += x1;
    sumX2 += x2;
    sumY += y;
    sumX1Sq += x1 * x1;
    sumX2Sq += x2 * x2;
    sumX1X2 += x1 * x2;
    sumX1Y += x1 * y;
    sumX2Y += x2 * y;
  });

  const [b0, b1, b2] = solveLinearSystem3x3(
    [
      [rows.length, sumX1, sumX2],
      [sumX1, sumX1Sq, sumX1X2],
      [sumX2, sumX1X2, sumX2Sq],
    ],
    [sumY, sumX1Y, sumX2Y],
  );

  const x1Values = rows.map((row) => row.x1);
  const x2Values = rows.map((row) => row.x2);
  const yValues = rows.map((row) => row.y);

  const x1Min = Math.min(...x1Values);
  const x1Max = Math.max(...x1Values);
  const x2Min = Math.min(...x2Values);
  const x2Max = Math.max(...x2Values);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);

  const x1Range = linspace(x1Min, x1Max, 30);
  const x2Range = linspace(x2Min, x2Max, 30);
  const surfaceZ = x2Range.map((x2) =>
    x1Range.map((x1) => b0 + b1 * x1 + b2 * x2),
  );

  const sliceValues = linspace(x2Min, x2Max, 4);

  return {
    coefficients: { b0, b1, b2 },
    sampleSize: rows.length,
    ranges: {
      x1: [x1Min, x1Max],
      x2: [x2Min, x2Max],
      y: [yMin, yMax],
    },
    pointTrace: {
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
      name: "관측값",
      hovertemplate:
        "공부시간: %{x:.2f}<br>수면시간: %{y:.2f}<br>시험점수: %{z:.2f}<extra></extra>",
    },
    planeTrace: {
      type: "surface",
      x: x1Range,
      y: x2Range,
      z: surfaceZ,
      opacity: 0.48,
      colorscale: "Blues",
      showscale: false,
      name: "회귀평면",
      hovertemplate:
        "공부시간: %{x:.2f}<br>수면시간: %{y:.2f}<br>예측점수: %{z:.2f}<extra></extra>",
    },
    sliceTraces: sliceValues.map((sliceValue, index) => ({
      type: "scatter3d",
      mode: "lines",
      x: x1Range,
      y: x1Range.map(() => sliceValue),
      z: x1Range.map((x1) => b0 + b1 * x1 + b2 * sliceValue),
      line: {
        width: 6,
        color: ["#f8fafc", "#dbeafe", "#bfdbfe", "#93c5fd"][index],
      },
      name: `x2=${sliceValue.toFixed(1)}`,
      hovertemplate:
        "공부시간: %{x:.2f}<br>수면시간 고정: %{y:.2f}<br>예측점수: %{z:.2f}<extra></extra>",
    })),
  };
}

export default function Regression3DPage() {
  const scene = useMemo(() => buildRegressionScene(), []);
  const [showPoints, setShowPoints] = useState(true);
  const [showPlane, setShowPlane] = useState(true);
  const [showSlices, setShowSlices] = useState(true);
  const [cameraKey, setCameraKey] = useState("diagonal");

  const traces = useMemo(() => {
    const items = [];
    if (showPoints) items.push(scene.pointTrace);
    if (showPlane) items.push(scene.planeTrace);
    if (showSlices) items.push(...scene.sliceTraces);
    return items;
  }, [scene, showPlane, showPoints, showSlices]);

  const applyPreset = (presetKey) => {
    const preset = SCENE_PRESETS[presetKey];
    setCameraKey(preset.camera);
    setShowPoints(preset.showPoints);
    setShowPlane(preset.showPlane);
    setShowSlices(preset.showSlices);
  };

  return (
    <main className="rr-shell">
      <header className="rr-header">
        <div>
          <p className="eyebrow">Next.js Plotly Demo</p>
          <h1>다중회귀 3D 시각화</h1>
          <p className="rr-subtitle">
            이전에 주신 Python Plotly 코드를 기준으로 만든 Next.js 버전입니다.
            `rotating-regression`과 같은 밝은 강의형 레이아웃 안에서, 3D 회귀평면과
            단면선을 강의 중 바로 조절할 수 있게 정리했습니다.
          </p>
        </div>
        <div className="lab-header-action-stack">
          <Link className="secondary-button" href="/lab">
          데이터랩으로
          </Link>
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              downloadCsv(
                "regression-3d-jamovi.csv",
                scene.pointTrace.x.map((x1, index) => ({
                  x1,
                  x2: scene.pointTrace.y[index],
                  y: scene.pointTrace.z[index],
                })),
                [
                  { label: "study_hours", value: (row) => row.x1.toFixed(6) },
                  { label: "sleep_hours", value: (row) => row.x2.toFixed(6) },
                  { label: "score", value: (row) => row.y.toFixed(6) },
                ],
              )
            }
          >
            CSV 다운로드
          </button>
        </div>
      </header>

      <section className="rr-graph-card rr3d-stage-card">
        <div className="rr-graph-head">
          <div>
            <p className="panel-label">다중회귀 그래프</p>
            <p className="rr3d-caption">
              관측값, 회귀평면, x2 고정 단면선을 한 장면에서 보고 마우스로 직접
              회전할 수 있습니다.
            </p>
          </div>
          <div className="rr-legend">
            <span className="is-point">관측값</span>
            <span className="rr3d-legend-surface">회귀평면</span>
            <span className="rr3d-legend-slice">단면선</span>
          </div>
        </div>

        <Plot
          data={traces}
          layout={{
            title: {
              text: "다중회귀 3D 시각화 (x2 통제 후 x1의 효과)",
              font: {
                size: 26,
                color: "#112d4e",
              },
            },
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            margin: { l: 0, r: 0, t: 66, b: 0 },
            showlegend: false,
            scene: {
              bgcolor: "rgba(0,0,0,0)",
              xaxis: {
                title: "공부시간 (x1)",
                gridcolor: "rgba(17, 45, 78, 0.12)",
                zerolinecolor: "rgba(17, 45, 78, 0.16)",
                showbackground: true,
                backgroundcolor: "rgba(245,248,252,0.9)",
                color: "#112d4e",
              },
              yaxis: {
                title: "수면시간 (x2)",
                gridcolor: "rgba(17, 45, 78, 0.12)",
                zerolinecolor: "rgba(17, 45, 78, 0.16)",
                showbackground: true,
                backgroundcolor: "rgba(248,250,253,0.95)",
                color: "#112d4e",
              },
              zaxis: {
                title: "시험점수 (y)",
                gridcolor: "rgba(17, 45, 78, 0.12)",
                zerolinecolor: "rgba(17, 45, 78, 0.16)",
                showbackground: true,
                backgroundcolor: "rgba(248,250,253,0.95)",
                color: "#112d4e",
              },
              camera: {
                eye: CAMERA_PRESETS[cameraKey],
              },
            },
          }}
          config={{
            responsive: true,
            displaylogo: false,
            modeBarButtonsToRemove: ["lasso3d", "select2d"],
          }}
          style={{ width: "100%", height: "760px" }}
        />
      </section>

      <section className="rr-metrics">
        <article>
          <span>절편 b0</span>
          <strong>{scene.coefficients.b0.toFixed(3)}</strong>
        </article>
        <article>
          <span>x1 계수 b1</span>
          <strong>{scene.coefficients.b1.toFixed(3)}</strong>
        </article>
        <article>
          <span>x2 계수 b2</span>
          <strong>{scene.coefficients.b2.toFixed(3)}</strong>
        </article>
        <article>
          <span>표본 수</span>
          <strong>{scene.sampleSize}</strong>
        </article>
      </section>

      <section className="rr-stepper rr3d-control-band">
        <div className="rr-step-slider">
          <span>장면 preset</span>
          <div className="rr3d-chip-row">
            {Object.entries(SCENE_PRESETS).map(([key, preset]) => (
              <button key={key} type="button" onClick={() => applyPreset(key)}>
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rr-step-slider">
          <span>카메라 시점</span>
          <div className="rr3d-chip-row">
            <button type="button" onClick={() => setCameraKey("diagonal")}>
              기본
            </button>
            <button type="button" onClick={() => setCameraKey("x1")}>
              x1 보기
            </button>
            <button type="button" onClick={() => setCameraKey("side")}>
              옆면 보기
            </button>
            <button type="button" onClick={() => setCameraKey("top")}>
              위에서 보기
            </button>
          </div>
        </div>

        <div className="rr-step-slider">
          <span>표시 요소</span>
          <div className="rr3d-toggle-grid">
            <label>
              <input
                type="checkbox"
                checked={showPoints}
                onChange={(event) => setShowPoints(event.target.checked)}
              />
              <strong>관측값</strong>
            </label>
            <label>
              <input
                type="checkbox"
                checked={showPlane}
                onChange={(event) => setShowPlane(event.target.checked)}
              />
              <strong>회귀평면</strong>
            </label>
            <label>
              <input
                type="checkbox"
                checked={showSlices}
                onChange={(event) => setShowSlices(event.target.checked)}
              />
              <strong>단면선</strong>
            </label>
          </div>
        </div>
      </section>

      <section className="rr-note">
        x1 범위는 <strong>{scene.ranges.x1[0].toFixed(2)}</strong>에서{" "}
        <strong>{scene.ranges.x1[1].toFixed(2)}</strong>, x2 범위는{" "}
        <strong>{scene.ranges.x2[0].toFixed(2)}</strong>에서{" "}
        <strong>{scene.ranges.x2[1].toFixed(2)}</strong>입니다. y는{" "}
        <strong>{scene.ranges.y[0].toFixed(2)}</strong>에서{" "}
        <strong>{scene.ranges.y[1].toFixed(2)}</strong> 사이에 분포합니다.
      </section>

      <section className="rr-table-card">
        <table className="rr-table">
          <thead>
            <tr>
              <th>항목</th>
              <th>설명</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>관측값</td>
              <td>실제 데이터 포인트입니다. x1, x2, y의 결합 분포를 보여줍니다.</td>
            </tr>
            <tr>
              <td>회귀평면</td>
              <td>OLS로 적합한 예측 면입니다. 두 독립변수가 동시에 y를 설명합니다.</td>
            </tr>
            <tr>
              <td>x2 고정 단면선</td>
              <td>x2를 일정하게 두었을 때 x1이 증가하면 y가 어떻게 변하는지 읽게 해줍니다.</td>
            </tr>
            <tr>
              <td>시점 전환</td>
              <td>같은 모델이라도 각도를 바꾸면 평면과 산점도의 관계를 더 선명하게 설명할 수 있습니다.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  );
}
