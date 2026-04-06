"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import fatData from "../../../data_mdis_fat.json";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

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

function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * absX);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
      Math.exp(-absX * absX);
  return sign * y;
}

function normalCdf(x) {
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
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

function compressFValue(value) {
  return Math.log10(1 + Math.max(0, value));
}

const ALPHA_OPTIONS = [
  { value: 0.1, label: "10%" },
  { value: 0.05, label: "5%" },
  { value: 0.01, label: "1%" },
];

const CRITICAL_T = {
  0.1: 1.645,
  0.05: 1.96,
  0.01: 2.576,
};

export default function TFAnalysisPage() {
  const [alpha, setAlpha] = useState(0.05);
  const [analysisMode, setAnalysisMode] = useState("t");
  const [showStatisticScale, setShowStatisticScale] = useState(false);
  const [showJitter, setShowJitter] = useState(true);

  const maleFat = useMemo(() => fatData.male.map(Number), []);
  const femaleFat = useMemo(() => fatData.female.map(Number), []);

  const stats = useMemo(() => {
    const maleMean = mean(maleFat);
    const femaleMean = mean(femaleFat);
    const maleVar = variance(maleFat);
    const femaleVar = variance(femaleFat);
    const n1 = maleFat.length;
    const n2 = femaleFat.length;
    const pooledVariance = (((n1 - 1) * maleVar) + ((n2 - 1) * femaleVar)) / (n1 + n2 - 2);
    const standardError = Math.sqrt(pooledVariance * (1 / n1 + 1 / n2));
    const tValue = (maleMean - femaleMean) / standardError;
    const df = n1 + n2 - 2;
    const pValue = 2 * (1 - normalCdf(Math.abs(tValue)));
    const fValue = tValue ** 2;

    return {
      maleMean,
      femaleMean,
      overallMean: mean([...maleFat, ...femaleFat]),
      tValue,
      fValue,
      df,
      pValue,
    };
  }, [femaleFat, maleFat]);

  const criticalT = CRITICAL_T[alpha];
  const criticalF = criticalT ** 2;

  const tAxisRange = useMemo(() => {
    if (!showStatisticScale) return [-5, 5];
    const padding = Math.max(6, Math.abs(stats.tValue) * 0.08);
    return [Math.min(-5, stats.tValue - padding), Math.max(5, stats.tValue + padding)];
  }, [showStatisticScale, stats.tValue]);

  const fAxisRange = useMemo(() => {
    if (!showStatisticScale) return [0, 8];
    return [0, Math.max(8, stats.fValue * 1.08)];
  }, [showStatisticScale, stats.fValue]);

  const compareTraces = useMemo(() => {
    return [
      {
        type: "violin",
        name: "남성",
        x: Array(maleFat.length).fill("남성"),
        y: maleFat,
        width: 0.38,
        box: { visible: !showJitter },
        meanline: { visible: !showJitter },
        line: { color: showJitter ? "rgba(0,0,0,0)" : "#ef4444", width: 2 },
        fillcolor: showJitter ? "rgba(0,0,0,0)" : "rgba(248,118,104,0.22)",
        opacity: showJitter ? 1 : 0.82,
        points: showJitter ? "all" : false,
        jitter: 0.24,
        pointpos: 0,
        marker: {
          color: "rgba(248,118,104,0.40)",
          size: 4.8,
          line: { color: "#ef4444", width: 0.55 },
        },
        hovertemplate: "남성<br>체지방률=%{y:.1f}<extra></extra>",
      },
      {
        type: "violin",
        name: "여성",
        x: Array(femaleFat.length).fill("여성"),
        y: femaleFat,
        width: 0.38,
        box: { visible: !showJitter },
        meanline: { visible: !showJitter },
        line: { color: showJitter ? "rgba(0,0,0,0)" : "#2563eb", width: 2 },
        fillcolor: showJitter ? "rgba(0,0,0,0)" : "rgba(99,102,241,0.22)",
        opacity: showJitter ? 1 : 0.82,
        points: showJitter ? "all" : false,
        jitter: 0.24,
        pointpos: 0,
        marker: {
          color: "rgba(99,102,241,0.34)",
          size: 4.8,
          line: { color: "#2563eb", width: 0.55 },
        },
        hovertemplate: "여성<br>체지방률=%{y:.1f}<extra></extra>",
      },
    ];
  }, [femaleFat, maleFat, showJitter]);

  const tPlot = useMemo(() => {
    const xValues = Array.from({ length: 1000 }, (_, index) => -5 + (10 * index) / 999);
    const yValues = xValues.map((x) => (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x));

    return {
      traces: [
        {
          type: "scatter",
          mode: "lines",
          x: xValues,
          y: yValues,
          line: { color: "#3f72af", width: 3 },
          hovertemplate: "t=%{x:.2f}<br>밀도=%{y:.3f}<extra></extra>",
          showlegend: false,
        },
        {
          type: "scatter",
          mode: "lines",
          x: xValues.filter((x) => x <= -criticalT),
          y: yValues.filter((_, index) => xValues[index] <= -criticalT),
          fill: "tozeroy",
          fillcolor: "rgba(248,118,104,0.34)",
          line: { color: "rgba(0,0,0,0)", width: 0 },
          hoverinfo: "skip",
          showlegend: false,
        },
        {
          type: "scatter",
          mode: "lines",
          x: xValues.filter((x) => x >= criticalT),
          y: yValues.filter((_, index) => xValues[index] >= criticalT),
          fill: "tozeroy",
          fillcolor: "rgba(248,118,104,0.34)",
          line: { color: "rgba(0,0,0,0)", width: 0 },
          hoverinfo: "skip",
          showlegend: false,
        },
      ],
      shapes: [
        { type: "line", x0: -criticalT, x1: -criticalT, y0: 0, y1: 0.7, line: { color: "#ef4444", width: 2, dash: "dash" } },
        { type: "line", x0: criticalT, x1: criticalT, y0: 0, y1: 0.7, line: { color: "#ef4444", width: 2, dash: "dash" } },
        { type: "line", x0: stats.tValue, x1: stats.tValue, y0: 0, y1: 0.7, line: { color: "#112d4e", width: 3 } },
      ],
      annotations: [
        { x: -criticalT, y: 0.66, text: `-${criticalT.toFixed(2)}`, showarrow: false, font: { size: 12, color: "#ef4444" } },
        { x: criticalT, y: 0.66, text: `${criticalT.toFixed(2)}`, showarrow: false, font: { size: 12, color: "#ef4444" } },
        {
          x: Math.max(tAxisRange[0] + 0.3, Math.min(tAxisRange[1] - 0.3, stats.tValue)),
          y: 0.58,
          text: `관측 t=${stats.tValue.toFixed(2)}`,
          showarrow: false,
          font: { size: 12, color: "#112d4e" },
          bgcolor: "rgba(255,255,255,0.92)",
          bordercolor: "rgba(17,45,78,0.08)",
          borderpad: 3,
        },
      ],
    };
  }, [criticalT, stats.tValue, tAxisRange]);

  const fPlot = useMemo(() => {
    const xValues = Array.from({ length: 1000 }, (_, index) => 0.001 + (8 * index) / 999);
    const yValues = xValues.map((x) => fPdf(x, 1, stats.df));
    const observedX = showStatisticScale ? stats.fValue : Math.min(stats.fValue, 7.7);
    const mappedXValues = xValues.map((x) => (showStatisticScale ? compressFValue(x) : x));
    const mappedCriticalF = showStatisticScale ? compressFValue(criticalF) : criticalF;
    const mappedObservedX = showStatisticScale
      ? compressFValue(observedX)
      : Math.max(0.2, Math.min(fAxisRange[1] - 0.2, observedX));

    return {
      traces: [
        {
          type: "scatter",
          mode: "lines",
          x: mappedXValues,
          y: yValues,
          line: { color: "#3f72af", width: 3 },
          hovertemplate: "F=%{x:.2f}<br>밀도=%{y:.3f}<extra></extra>",
          showlegend: false,
        },
        {
          type: "scatter",
          mode: "lines",
          x: mappedXValues.filter((_, index) => xValues[index] >= criticalF),
          y: yValues.filter((_, index) => xValues[index] >= criticalF),
          fill: "tozeroy",
          fillcolor: "rgba(248,118,104,0.34)",
          line: { color: "rgba(0,0,0,0)", width: 0 },
          hoverinfo: "skip",
          showlegend: false,
        },
      ],
      shapes: [
        { type: "line", x0: mappedCriticalF, x1: mappedCriticalF, y0: 0, y1: 4, line: { color: "#ef4444", width: 2, dash: "dash" } },
        {
          type: "line",
          x0: mappedObservedX,
          x1: mappedObservedX,
          y0: 0,
          y1: 4,
          line: { color: "#112d4e", width: 3 },
          visible: showStatisticScale,
        },
      ],
      annotations: [
        { x: mappedCriticalF, y: 3.82, text: `${criticalF.toFixed(2)}`, showarrow: false, font: { size: 12, color: "#ef4444" } },
        {
          x: mappedObservedX,
          y: 3.36,
          text: `관측 F=${stats.fValue.toFixed(2)}`,
          showarrow: false,
          xanchor: stats.fValue > 8 ? "right" : "center",
          font: { size: 12, color: "#112d4e" },
          bgcolor: "rgba(255,255,255,0.92)",
          bordercolor: "rgba(17,45,78,0.08)",
          borderpad: 3,
          visible: showStatisticScale,
        },
      ],
    };
  }, [criticalF, fAxisRange, showStatisticScale, stats.df, stats.fValue]);

  const fAxisSpec = useMemo(() => {
    if (!showStatisticScale) {
      return { range: fAxisRange, tickmode: "auto" };
    }
    const tickCandidates = [0, 0.5, 1, 2, 4, 8, 16, 64, 256, 1024, 4096, 16384, stats.fValue];
    const uniqueTicks = Array.from(
      new Set(
        tickCandidates
          .filter((value) => value >= 0 && value <= stats.fValue * 1.05 + 1)
          .map((value) => Number(value.toFixed(6)))
      )
    ).sort((a, b) => a - b);

    return {
      range: [0, compressFValue(Math.max(8, stats.fValue * 1.08))],
      tickmode: "array",
      tickvals: uniqueTicks.map((value) => compressFValue(value)),
      ticktext: uniqueTicks.map((value) => {
        if (value >= 1000) return `${Math.round(value)}`;
        if (value >= 10) return `${Number(value.toFixed(0))}`;
        return `${Number(value.toFixed(1))}`;
      }),
    };
  }, [fAxisRange, showStatisticScale, stats.fValue]);

  return (
    <main className="rr-shell tf-shell">
      <header className="rr-header tf-header">
        <div>
          <p className="eyebrow">GRAPH</p>
          <h1>t검정과 F검정</h1>
        </div>
        <Link className="secondary-button regswitch-home-button" href="/lab">
          메인으로
        </Link>
      </header>

      <section className="tf-layout tf-layout-two-up">
        <article className="rr-graph-card tf-main-card">
          <div className="rr-graph-head">
            <div>
              <p className="panel-label">Graph</p>
              <h2 className="regswitch-title">{analysisMode === "t" ? "독립표본 t-검정" : "F검정"}</h2>
              <p className="regswitch-formula">
                {analysisMode === "t"
                  ? "H₀: 평균 차이 = 0 / H₁: 평균 차이 ≠ 0"
                  : "F = 집단간 오차 / 집단내 오차"}
              </p>
            </div>
            <div className="tf-analysis-toggle">
              <button
                type="button"
                className={analysisMode === "t" ? "active" : ""}
                onClick={() => setAnalysisMode("t")}
              >
                t검정
              </button>
              <button
                type="button"
                className={analysisMode === "f" ? "active" : ""}
                onClick={() => setAnalysisMode("f")}
              >
                F검정
              </button>
            </div>
            <label className={`tf-stat-toggle ${showJitter ? "active" : ""}`}>
              <input
                type="checkbox"
                checked={showJitter}
                onChange={() => setShowJitter((value) => !value)}
              />
              <span>지터 표시</span>
            </label>
          </div>

          <div className="tf-plot-wrap">
            <Plot
              data={compareTraces}
              layout={{
                autosize: true,
                violinmode: "group",
                violingap: 0.08,
                violingroupgap: 0.04,
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: "rgba(255,255,255,0.98)",
                font: { family: "Pretendard, Noto Sans KR, sans-serif", color: "#112d4e", size: 16 },
                margin: { l: 72, r: 42, t: 24, b: 68 },
                showlegend: false,
                shapes: [
                  {
                    type: "line",
                    xref: "paper",
                    x0: 0,
                    x1: 1,
                    y0: stats.overallMean,
                    y1: stats.overallMean,
                    line: { color: "#8b5cf6", width: 2 },
                    visible: analysisMode === "f",
                  },
                  {
                    type: "line",
                    xref: "paper",
                    x0: 0.085,
                    x1: 0.255,
                    y0: stats.maleMean,
                    y1: stats.maleMean,
                    line: { color: "#ef4444", width: 3 },
                    visible: true,
                  },
                  {
                    type: "line",
                    xref: "paper",
                    x0: 0.745,
                    x1: 0.915,
                    y0: stats.femaleMean,
                    y1: stats.femaleMean,
                    line: { color: "#2563eb", width: 3 },
                    visible: true,
                  },
                ],
                annotations: [
                  {
                    x: 0.97,
                    xref: "paper",
                    y: stats.overallMean,
                    text: `전체평균 ${stats.overallMean.toFixed(2)}`,
                    showarrow: false,
                    xanchor: "right",
                    yanchor: "middle",
                    font: { size: 12, color: "#8b5cf6" },
                    bgcolor: "rgba(255,255,255,0.92)",
                    bordercolor: "rgba(139,92,246,0.14)",
                    borderpad: 2,
                    visible: analysisMode === "f",
                  },
                  {
                    x: 0.275,
                    xref: "paper",
                    y: stats.maleMean,
                    text: stats.maleMean.toFixed(2),
                    showarrow: false,
                    xanchor: "left",
                    yanchor: "middle",
                    font: { size: 12, color: "#ef4444" },
                    bgcolor: "rgba(255,255,255,0.92)",
                    bordercolor: "rgba(239,68,68,0.14)",
                    borderpad: 2,
                    visible: true,
                  },
                  {
                    x: 0.935,
                    xref: "paper",
                    y: stats.femaleMean,
                    text: stats.femaleMean.toFixed(2),
                    showarrow: false,
                    xanchor: "left",
                    yanchor: "middle",
                    font: { size: 12, color: "#2563eb" },
                    bgcolor: "rgba(255,255,255,0.92)",
                    bordercolor: "rgba(37,99,235,0.14)",
                    borderpad: 2,
                    visible: true,
                  },
                ],
                xaxis: {
                  title: { text: "성별", standoff: 16 },
                  showgrid: false,
                  tickfont: { size: 14 },
                },
                yaxis: {
                  title: { text: "체지방률", standoff: 14 },
                  showgrid: true,
                  gridcolor: "rgba(17,45,78,0.08)",
                  tickfont: { size: 14 },
                },
                uirevision: `tf-compare-${showJitter ? "jitter" : "violin"}-${analysisMode}`,
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>

          <section className="tf-metric-grid">
            <article className="tf-metric-card">
              <span>남성 평균</span>
              <strong>{stats.maleMean.toFixed(2)}</strong>
            </article>
            <article className="tf-metric-card">
              <span>여성 평균</span>
              <strong>{stats.femaleMean.toFixed(2)}</strong>
            </article>
            <article className="tf-metric-card">
              <span>{analysisMode === "t" ? "t 통계량" : "F 통계량"}</span>
              <strong>{analysisMode === "t" ? stats.tValue.toFixed(2) : stats.fValue.toFixed(2)}</strong>
            </article>
            <article className="tf-metric-card">
              <span>{analysisMode === "t" ? "유의확률 p" : "자유도"}</span>
              <strong>{analysisMode === "t" ? (stats.pValue < 0.001 ? "0.000" : stats.pValue.toFixed(3)) : `1, ${stats.df}`}</strong>
            </article>
          </section>
        </article>

        <article className="rr-graph-card tf-small-card">
          <div className="rr-graph-head">
            <div>
              <p className="panel-label">Graph</p>
              <h2 className="regswitch-title">{analysisMode === "t" ? "t-분포" : "F-분포"}</h2>
              <p className="regswitch-formula">
                {analysisMode === "t" ? "양측검정 기각역" : "집단간 오차 / 집단내 오차"}
              </p>
            </div>
            <div className="tf-alpha-toggle">
              {ALPHA_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={alpha === option.value ? "active" : ""}
                  onClick={() => setAlpha(option.value)}
                >
                  α {option.label}
                </button>
              ))}
            </div>
            <label className={`tf-stat-toggle ${showStatisticScale ? "active" : ""}`}>
              <input
                type="checkbox"
                checked={showStatisticScale}
                onChange={() => setShowStatisticScale((value) => !value)}
              />
              <span>통계량 표시</span>
            </label>
          </div>

          <div className="tf-small-plot tf-side-plot">
            <Plot
              data={analysisMode === "t" ? tPlot.traces : fPlot.traces}
              layout={{
                autosize: true,
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: "rgba(255,255,255,0.98)",
                font: { family: "Pretendard, Noto Sans KR, sans-serif", color: "#112d4e", size: 15 },
                margin: { l: 68, r: 24, t: 22, b: 58 },
                showlegend: false,
                shapes: analysisMode === "t" ? tPlot.shapes : fPlot.shapes,
                annotations: analysisMode === "t" ? tPlot.annotations : fPlot.annotations,
                xaxis:
                  analysisMode === "t"
                    ? {
                        title: { text: "t 값", standoff: 14 },
                        range: tAxisRange,
                        showgrid: true,
                        gridcolor: "rgba(17,45,78,0.08)",
                      }
                    : {
                        title: { text: "F 값", standoff: 14 },
                        ...fAxisSpec,
                        showgrid: true,
                        gridcolor: "rgba(17,45,78,0.08)",
                      },
                yaxis: {
                  title: { text: "밀도", standoff: 12 },
                  ...(analysisMode === "f" ? { range: [0, 4] } : { range: [0, 0.7] }),
                  showgrid: true,
                  gridcolor: "rgba(17,45,78,0.08)",
                },
                uirevision: `tf-dist-${analysisMode}-${alpha}-${showStatisticScale}`,
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </article>
      </section>
    </main>
  );
}
