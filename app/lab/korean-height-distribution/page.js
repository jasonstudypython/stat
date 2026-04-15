"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import rawHeightData from "../../../data_mdis_height.json";
import { downloadCsv } from "../_shared/csv";
import { mean, normalCdf, standardDeviation } from "../_shared/stats";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const GROUPS = {
  male: {
    label: "남성",
    sex: "남",
    color: "rgba(248,118,104,0.36)",
    line: "#ef4444",
    fill95: "rgba(239,68,68,0.46)",
    fill99: "rgba(239,68,68,0.58)",
  },
  female: {
    label: "여성",
    sex: "여",
    color: "rgba(99,102,241,0.28)",
    line: "#3f72af",
    fill95: "rgba(59,130,246,0.42)",
    fill99: "rgba(59,130,246,0.54)",
  },
};

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function skewness(values) {
  const n = values.length;
  if (n < 3) return 0;
  const avg = mean(values);
  const std = standardDeviation(values);
  if (!std) return 0;
  const scaledThirdMoment =
    values.reduce((sum, value) => sum + ((value - avg) / std) ** 3, 0) / n;
  return (Math.sqrt(n * (n - 1)) / (n - 2)) * scaledThirdMoment;
}

function kurtosis(values) {
  const n = values.length;
  if (n < 4) return 0;
  const avg = mean(values);
  const std = standardDeviation(values);
  if (!std) return 0;
  const g2 = values.reduce((sum, value) => sum + ((value - avg) / std) ** 4, 0) / n - 3;
  return (((n + 1) * g2 + 6) * (n - 1)) / ((n - 2) * (n - 3));
}

function normalPdf(x, avg, std) {
  const safeStd = std || 1;
  const z = (x - avg) / safeStd;
  return Math.exp(-0.5 * z ** 2) / (safeStd * Math.sqrt(2 * Math.PI));
}

function kernelDensity(values, points, bandwidth) {
  const n = values.length;
  const safeBandwidth = bandwidth || 1;
  return points.map((point) => {
    let sum = 0;
    for (const value of values) {
      const z = (point - value) / safeBandwidth;
      sum += Math.exp(-0.5 * z ** 2);
    }
    return sum / (n * safeBandwidth * Math.sqrt(2 * Math.PI));
  });
}

function createJitter(index, sex) {
  const seed = Math.sin((index + 1) * (sex === "남" ? 11.3 : 17.7)) * 10000;
  const noise = (seed - Math.floor(seed) - 0.5) * 0.024;
  return noise;
}

function formatAxisLabel(mode) {
  if (mode === "centered") return "평균중심화 키(cm)";
  if (mode === "zscore") return "표준점수(z)";
  return "키(cm)";
}

function formatRange(mode, values) {
  if (mode === "raw") return [125, 205];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.12 || 1;
  return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10];
}

function histogramBinSpec(mode, rawMean, rawStd) {
  const rawStart = 125;
  const rawEnd = 205;
  const rawBinSize = (rawEnd - rawStart) / 60;

  if (mode === "centered") {
    return {
      start: rawStart - rawMean,
      end: rawEnd - rawMean,
      size: rawBinSize,
    };
  }

  if (mode === "zscore") {
    const safeStd = rawStd || 1;
    return {
      start: (rawStart - rawMean) / safeStd,
      end: (rawEnd - rawMean) / safeStd,
      size: rawBinSize / safeStd,
    };
  }

  return {
    start: rawStart,
    end: rawEnd,
    size: rawBinSize,
  };
}

function createTickSpec(mode, range) {
  if (mode === "centered") {
    return { tickmode: "linear", tick0: Math.floor(range[0] / 10) * 10, dtick: 10 };
  }
  if (mode === "zscore") {
    return { tickmode: "linear", tick0: Math.floor(range[0] / 2) * 2, dtick: 2 };
  }
  return {};
}

function transformValues(values, mode) {
  const avg = mean(values);
  const std = standardDeviation(values) || 1;
  if (mode === "centered") return values.map((value) => value - avg);
  if (mode === "zscore") return values.map((value) => (value - avg) / std);
  return values;
}

function transformSingleValue(value, meanValue, stdValue, mode) {
  if (mode === "centered") return value - meanValue;
  if (mode === "zscore") return (value - meanValue) / (stdValue || 1);
  return value;
}

function bandwidthFrom(values) {
  const std = standardDeviation(values) || 1;
  return 1.06 * std * values.length ** (-1 / 5);
}

function formatCaseLabel(mode, rawValue, transformedValue) {
  if (mode === "centered") return `${transformedValue.toFixed(2)}cm`;
  if (mode === "zscore") {
    const pValue = 2 * (1 - normalCdf(Math.abs(transformedValue)));
    const roundedP = pValue < 0.001 ? "p<.001" : `p=${pValue.toFixed(3)}`;
    return `z=${transformedValue.toFixed(2)}, ${roundedP}`;
  }
  return `${rawValue.toFixed(1)}cm`;
}

function buildTailTrace({ label, color, xValues, yValues }) {
  if (xValues.length < 2) return null;
  return {
    type: "scatter",
    mode: "lines",
    name: label,
    x: xValues,
    y: yValues,
    fill: "tozeroy",
    line: { color, width: 0 },
    fillcolor: color,
    hoverinfo: "skip",
    showlegend: false,
  };
}

export default function KoreanHeightDistributionPage() {
  const [groupMode, setGroupMode] = useState("male");
  const [viewMode, setViewMode] = useState("histogram");
  const [transformMode, setTransformMode] = useState("raw");
  const [scaleMode, setScaleMode] = useState("frequency");
  const [showNormal, setShowNormal] = useState(false);
  const [showKde, setShowKde] = useState(false);
  const [showMean, setShowMean] = useState(false);
  const [caseHeight, setCaseHeight] = useState("174");
  const [showCase, setShowCase] = useState(false);
  const [showStdBand, setShowStdBand] = useState(false);
  const [show95, setShow95] = useState(false);
  const [show99, setShow99] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const updateViewport = () => setIsMobileViewport(window.innerWidth <= 820);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const grouped = useMemo(() => {
    const male = rawHeightData.filter((row) => row.sex === "남").map((row) => Number(row.height));
    const female = rawHeightData.filter((row) => row.sex === "여").map((row) => Number(row.height));
    return { male, female };
  }, []);

  const activeKeys = groupMode === "both" ? ["male", "female"] : [groupMode];
  const isDensity = scaleMode === "density";
  const parsedCaseHeight = Number(caseHeight);
  const hasValidCase = Number.isFinite(parsedCaseHeight);

  const prepared = useMemo(() => {
    const result = {};
    for (const key of activeKeys) {
      const source = grouped[key];
      const values = transformValues(source, transformMode);
      result[key] = {
        values,
        rawMean: mean(source),
        rawStd: standardDeviation(source) || 1,
        mean: mean(values),
        std: standardDeviation(values) || 1,
        bandwidth: bandwidthFrom(values),
      };
    }
    return result;
  }, [activeKeys, grouped, transformMode]);

  const comparisonRangeValues = useMemo(() => {
    if (transformMode === "raw") return activeKeys.flatMap((key) => prepared[key].values);
    return ["male", "female"].flatMap((key) => transformValues(grouped[key], transformMode));
  }, [activeKeys, grouped, prepared, transformMode]);

  const xRange = formatRange(transformMode, comparisonRangeValues);
  const xTickSpec = createTickSpec(transformMode, xRange);
  const xGrid = Array.from({ length: 240 }, (_, index) => xRange[0] + ((xRange[1] - xRange[0]) * index) / 239);

  const traces = useMemo(() => {
    const nextTraces = [];

    for (const key of activeKeys) {
      const meta = GROUPS[key];
      const current = prepared[key];
      const currentBin = histogramBinSpec(transformMode, current.rawMean, current.rawStd);

      if (viewMode === "histogram") {
        nextTraces.push({
          type: "histogram",
          name: meta.label,
          x: current.values,
          opacity: groupMode === "both" ? 0.56 : 0.78,
          histnorm: isDensity ? "probability density" : "",
          marker: { color: meta.color, line: { color: meta.line, width: 1 } },
          xbins: currentBin,
          hovertemplate: `${meta.label}<br>x=%{x:.2f}<br>${isDensity ? "밀도" : "빈도"}=%{y:.3f}<extra></extra>`,
        });
      } else {
        nextTraces.push({
          type: "scatter",
          mode: "markers",
          name: meta.label,
          x: current.values,
          y: current.values.map((_, index) => createJitter(index, meta.sex)),
          marker: {
            color: meta.color,
            size: 7,
            line: { color: meta.line, width: 0.55 },
          },
          hovertemplate: `${meta.label}<br>x=%{x:.2f}<extra></extra>`,
        });
      }

      if (viewMode === "histogram") {
        const curveY = xGrid.map((x) =>
          normalPdf(x, current.mean, current.std) * (isDensity ? 1 : current.values.length * currentBin.size)
        );

        if (show95 || show99) {
          const intervals = [
            { enabled: show95, z: 1.96, fill: meta.fill95, label: "95% 기각역" },
            { enabled: show99, z: 2.576, fill: meta.fill99, label: "99% 기각역" },
          ];

          for (const interval of intervals) {
            if (!interval.enabled) continue;
            const low = current.mean - interval.z * current.std;
            const high = current.mean + interval.z * current.std;
            const leftXs = xGrid.filter((x) => x <= low);
            const rightXs = xGrid.filter((x) => x >= high);
            const leftTrace = buildTailTrace({
              label: `${meta.label} ${interval.label}`,
              color: interval.fill,
              xValues: leftXs,
              yValues: leftXs.map(
                (x) => normalPdf(x, current.mean, current.std) * (isDensity ? 1 : current.values.length * currentBin.size)
              ),
            });
            const rightTrace = buildTailTrace({
              label: `${meta.label} ${interval.label}`,
              color: interval.fill,
              xValues: rightXs,
              yValues: rightXs.map(
                (x) => normalPdf(x, current.mean, current.std) * (isDensity ? 1 : current.values.length * currentBin.size)
              ),
            });
            if (leftTrace) nextTraces.push(leftTrace);
            if (rightTrace) nextTraces.push(rightTrace);
          }
        }

        if (showNormal) {
          nextTraces.push({
            type: "scatter",
            mode: "lines",
            name: `${meta.label} 정규분포곡선`,
            x: xGrid,
            y: curveY,
            line: { color: meta.line, width: 3 },
            hovertemplate: `${meta.label} 정규분포곡선<br>x=%{x:.2f}<br>y=%{y:.3f}<extra></extra>`,
          });
        }
      }

      if (viewMode === "histogram" && showKde) {
        nextTraces.push({
          type: "scatter",
          mode: "lines",
          name: `${meta.label} KDE`,
          x: xGrid,
          y: kernelDensity(current.values, xGrid, current.bandwidth).map((value) =>
            value * (isDensity ? 1 : current.values.length * currentBin.size)
          ),
          line: { color: meta.line, width: 3, dash: "dash" },
          hovertemplate: `${meta.label} KDE<br>x=%{x:.2f}<br>y=%{y:.3f}<extra></extra>`,
        });
      }
    }

    return nextTraces;
  }, [activeKeys, groupMode, isDensity, prepared, show95, show99, showKde, showNormal, transformMode, viewMode, xGrid]);

  const plotShapes = useMemo(() => {
    const shapes = [];

    if (showMean) {
      for (const key of activeKeys) {
        const meta = GROUPS[key];
        const current = prepared[key];
        shapes.push({
          type: "line",
          xref: "x",
          yref: "paper",
          x0: current.mean,
          x1: current.mean,
          y0: 0,
          y1: 1,
          line: { color: meta.line, width: 2, dash: "dot" },
        });
      }
    }

    if (showCase && hasValidCase) {
      for (const key of activeKeys) {
        const meta = GROUPS[key];
        const current = prepared[key];
        const transformedCase = transformSingleValue(parsedCaseHeight, current.rawMean, current.rawStd, transformMode);
        shapes.push({
          type: "line",
          xref: "x",
          yref: "paper",
          x0: transformedCase,
          x1: transformedCase,
          y0: 0,
          y1: 1,
          line: { color: meta.line, width: 3 },
        });
      }
    }

    return shapes;
  }, [activeKeys, hasValidCase, parsedCaseHeight, prepared, showCase, showMean, transformMode]);

  const plotAnnotations = useMemo(() => {
    const annotations = [];

    if (showCase && hasValidCase) {
      for (const key of activeKeys) {
        const meta = GROUPS[key];
        const current = prepared[key];
        const transformedCase = transformSingleValue(parsedCaseHeight, current.rawMean, current.rawStd, transformMode);
        annotations.push({
          x: transformedCase,
          y: 1,
          yref: "paper",
          text: `${meta.label} ${formatCaseLabel(transformMode, parsedCaseHeight, transformedCase)}`,
          showarrow: false,
          yshift: 24,
          font: { size: 18, color: meta.line },
          bgcolor: "rgba(255,255,255,0.92)",
          bordercolor: "rgba(17,45,78,0.08)",
          borderpad: 4,
        });
      }
    }

    const intervalRows = [
      showStdBand ? { label: "±1 표준편차", multiplier: 1 } : null,
      show95 ? { label: "95% 신뢰구간", z: 1.96 } : null,
      show99 ? { label: "99% 신뢰구간", z: 2.576 } : null,
    ].filter(Boolean);
    const intervalTopY = 0.035 + Math.max(intervalRows.length - 1, 0) * 0.05;

    activeKeys.forEach((key, groupIndex) => {
      const meta = GROUPS[key];
      const current = prepared[key];

      intervalRows.forEach((interval, intervalIndex) => {
        const distance = (interval.multiplier || interval.z) * current.std;
        const low = current.mean - distance;
        const high = current.mean + distance;
        const y = intervalTopY - intervalIndex * 0.05 + groupIndex * 0.032;

        annotations.push({
          x: high,
          y,
          xref: "x",
          yref: "paper",
          ax: low,
          ay: y,
          axref: "x",
          ayref: "paper",
          text: "",
          showarrow: true,
          arrowhead: 2,
          arrowside: "start+end",
          arrowwidth: 1.8,
          arrowcolor: meta.line,
        });

        annotations.push({
          x: (low + high) / 2,
          y: y + 0.018,
          xref: "x",
          yref: "paper",
          text: interval.label,
          showarrow: false,
          font: { size: 12, color: meta.line },
          bgcolor: "rgba(255,255,255,0.92)",
          bordercolor: "rgba(17,45,78,0.08)",
          borderpad: 3,
        });
      });
    });

    return annotations;
  }, [activeKeys, hasValidCase, parsedCaseHeight, prepared, showCase, show95, show99, showStdBand, transformMode]);

  const metricCards = useMemo(() => {
    return activeKeys.map((key) => {
      const meta = GROUPS[key];
      const current = prepared[key];
      const intervals = [];
      if (showStdBand) {
        intervals.push({
          label: "±1SD",
          low: current.mean - current.std,
          high: current.mean + current.std,
        });
      }
      if (show95) {
        intervals.push({
          label: "95%",
          low: current.mean - 1.96 * current.std,
          high: current.mean + 1.96 * current.std,
        });
      }
      if (show99) {
        intervals.push({
          label: "99%",
          low: current.mean - 2.576 * current.std,
          high: current.mean + 2.576 * current.std,
        });
      }
      return {
        key,
        label: meta.label,
        mean: current.mean,
        std: current.std,
        median: median(current.values),
        min: Math.min(...current.values),
        max: Math.max(...current.values),
        skewness: skewness(current.values),
        kurtosis: kurtosis(current.values),
        n: current.values.length,
        intervals,
      };
    });
  }, [activeKeys, prepared, show95, show99, showStdBand]);

  const mobileSections = useMemo(() => {
    const configs = [
      { key: "male", groupMode: "male", scaleMode: "frequency", title: "남성" },
      { key: "female", groupMode: "female", scaleMode: "frequency", title: "여성" },
      { key: "both", groupMode: "both", scaleMode: "density", title: "전체" },
    ];

    return configs.map((config) => {
      const sectionKeys = config.groupMode === "both" ? ["male", "female"] : [config.groupMode];
      const sectionPrepared = {};

      for (const key of sectionKeys) {
        const source = grouped[key];
        const values = transformValues(source, transformMode);
        sectionPrepared[key] = {
          values,
          rawMean: mean(source),
          rawStd: standardDeviation(source) || 1,
          mean: mean(values),
          std: standardDeviation(values) || 1,
          bandwidth: bandwidthFrom(values),
        };
      }

      const comparisonValues =
        transformMode === "raw"
          ? sectionKeys.flatMap((key) => sectionPrepared[key].values)
          : (config.groupMode === "both" ? ["male", "female"] : sectionKeys).flatMap((key) =>
              transformValues(grouped[key], transformMode),
            );

      const sectionRange = formatRange(transformMode, comparisonValues);
      const sectionTickSpec = createTickSpec(transformMode, sectionRange);
      const sectionGrid = Array.from(
        { length: 240 },
        (_, index) => sectionRange[0] + ((sectionRange[1] - sectionRange[0]) * index) / 239,
      );
      const isDensitySection = config.scaleMode === "density";
      const sectionTraces = [];

      for (const key of sectionKeys) {
        const meta = GROUPS[key];
        const current = sectionPrepared[key];
        const currentBin = histogramBinSpec(transformMode, current.rawMean, current.rawStd);

        sectionTraces.push({
          type: "histogram",
          name: meta.label,
          x: current.values,
          opacity: config.groupMode === "both" ? 0.56 : 0.78,
          histnorm: isDensitySection ? "probability density" : "",
          marker: { color: meta.color, line: { color: meta.line, width: 1 } },
          xbins: currentBin,
          hovertemplate: `${meta.label}<br>x=%{x:.2f}<br>${isDensitySection ? "밀도" : "빈도"}=%{y:.3f}<extra></extra>`,
        });

        const curveY = sectionGrid.map((x) =>
          normalPdf(x, current.mean, current.std) *
          (isDensitySection ? 1 : current.values.length * currentBin.size),
        );

        const low = current.mean - 1.96 * current.std;
        const high = current.mean + 1.96 * current.std;
        const leftXs = sectionGrid.filter((x) => x <= low);
        const rightXs = sectionGrid.filter((x) => x >= high);
        const leftTrace = buildTailTrace({
          label: `${meta.label} 95% 신뢰구간`,
          color: meta.fill95,
          xValues: leftXs,
          yValues: leftXs.map((x) =>
            normalPdf(x, current.mean, current.std) *
            (isDensitySection ? 1 : current.values.length * currentBin.size),
          ),
        });
        const rightTrace = buildTailTrace({
          label: `${meta.label} 95% 신뢰구간`,
          color: meta.fill95,
          xValues: rightXs,
          yValues: rightXs.map((x) =>
            normalPdf(x, current.mean, current.std) *
            (isDensitySection ? 1 : current.values.length * currentBin.size),
          ),
        });
        if (leftTrace) sectionTraces.push(leftTrace);
        if (rightTrace) sectionTraces.push(rightTrace);

        sectionTraces.push({
          type: "scatter",
          mode: "lines",
          name: `${meta.label} 정규분포곡선`,
          x: sectionGrid,
          y: curveY,
          line: { color: meta.line, width: 3 },
          hovertemplate: `${meta.label} 정규분포곡선<br>x=%{x:.2f}<br>y=%{y:.3f}<extra></extra>`,
        });
      }

      const sectionShapes = sectionKeys.map((key) => {
        const meta = GROUPS[key];
        const current = sectionPrepared[key];
        return {
          type: "line",
          xref: "x",
          yref: "paper",
          x0: current.mean,
          x1: current.mean,
          y0: 0,
          y1: 1,
          line: { color: meta.line, width: 2, dash: "dot" },
        };
      });

      const sectionMetrics = sectionKeys.map((key) => {
        const meta = GROUPS[key];
        const current = sectionPrepared[key];
        return {
          key,
          label: meta.label,
          mean: current.mean,
          std: current.std,
          median: median(current.values),
          n: current.values.length,
          low95: current.mean - 1.96 * current.std,
          high95: current.mean + 1.96 * current.std,
        };
      });

      return {
        ...config,
        plot: {
          data: sectionTraces,
          layout: {
            autosize: true,
            barmode: config.groupMode === "both" ? "overlay" : "relative",
            bargap: 0.03,
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(255,255,255,0.98)",
            font: { family: "Pretendard, Noto Sans KR, sans-serif", color: "#112d4e", size: 16 },
            margin: { l: 72, r: 28, t: 24, b: 72 },
            legend: {
              orientation: "h",
              x: 0,
              y: 1.12,
              bgcolor: "rgba(255,255,255,0.0)",
            },
            shapes: sectionShapes,
            xaxis: {
              title: { text: formatAxisLabel(transformMode), standoff: 18 },
              range: sectionRange,
              showgrid: true,
              gridcolor: "rgba(17,45,78,0.08)",
              zeroline: transformMode !== "raw",
              zerolinecolor: "rgba(17,45,78,0.18)",
              tickfont: { size: 14 },
              ...sectionTickSpec,
            },
            yaxis: {
              title: { text: isDensitySection ? "밀도" : "빈도", standoff: 14 },
              rangemode: "tozero",
              showgrid: true,
              gridcolor: "rgba(17,45,78,0.08)",
              tickfont: { size: 14 },
            },
            hovermode: "x unified",
            showlegend: true,
            uirevision: `heightdist-mobile-${config.groupMode}-${transformMode}-${config.scaleMode}`,
          },
        },
        metrics: sectionMetrics,
      };
    });
  }, [grouped, transformMode]);

  if (isMobileViewport) {
    return (
      <main className="rr-shell regswitch-shell heightdist-shell heightdist-mobile-shell">
        <section className="heightdist-mobile-transform">
          <span>변환</span>
          <select
            className="heightdist-select"
            value={transformMode}
            onChange={(event) => setTransformMode(event.target.value)}
          >
            <option value="raw">원자료</option>
            <option value="centered">평균중심화</option>
            <option value="zscore">표준점수</option>
          </select>
        </section>

        <div className="heightdist-mobile-stack">
          {mobileSections.map((section) => (
            <section key={section.key} className="heightdist-mobile-section">
              <div className="heightdist-mobile-head">
                <p className="panel-label">Graph</p>
                <h2 className="regswitch-title">대한민국 성인 {section.title} 키 분포</h2>
                <p className="regswitch-formula">
                  히스토그램 / {section.scaleMode === "density" ? "밀도" : "빈도"}
                </p>
              </div>

              <div className="regswitch-plot-wrap is-subplot heightdist-plot-wrap">
                <Plot
                  data={section.plot.data}
                  layout={section.plot.layout}
                  config={{
                    displayModeBar: false,
                    responsive: true,
                    showTips: true,
                    doubleClick: "reset+autosize",
                  }}
                  style={{ width: "100%", height: "100%" }}
                />
              </div>

              <section className="heightdist-metrics heightdist-mobile-metrics">
                {section.metrics.map((card) => (
                  <article key={`${section.key}-${card.key}`}>
                    <span>{card.label}</span>
                    <strong>
                      {[
                        `평균 ${card.mean.toFixed(2)}`,
                        `표준편차 ${card.std.toFixed(2)}`,
                        `중앙값 ${card.median.toFixed(2)}`,
                        `N ${card.n}`,
                        `95% CI ${card.low95.toFixed(2)} ~ ${card.high95.toFixed(2)}`,
                      ].join(" / ")}
                    </strong>
                  </article>
                ))}
              </section>
            </section>
          ))}
        </div>

        <div className="heightdist-mobile-footer">
          <Link className="secondary-button regswitch-home-button" href="/lab">
            메인으로
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="rr-shell regswitch-shell heightdist-shell">
      <header className="rr-header heightdist-header">
        <div>
          <p className="eyebrow">GRAPH</p>
          <h1>대한민국 성인 키 분포</h1>
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
                "korean-height-distribution-jamovi.csv",
                rawHeightData.map((row) => ({
                  sex_code: row.sex === "남" ? 0 : 1,
                  sex_label: row.sex,
                  height_cm: Number(row.height),
                })),
                [
                  { label: "sex_code", value: "sex_code" },
                  { label: "sex_label", value: "sex_label" },
                  { label: "height_cm", value: (row) => row.height_cm.toFixed(6) },
                ],
              )
            }
          >
            CSV 다운로드
          </button>
        </div>
      </header>

      <section className="regswitch-layout heightdist-layout">
        <article className="rr-graph-card regswitch-stage heightdist-stage">
          <div className="rr-graph-head">
            <div>
              <p className="panel-label">Graph</p>
              <h2 className="regswitch-title">
                대한민국 성인 {groupMode === "male" ? "남성" : groupMode === "female" ? "여성" : "전체"} 키 분포
              </h2>
              <p className="regswitch-formula">{viewMode === "histogram" ? "히스토그램" : "지터 그래프"}</p>
            </div>
          </div>

          <div className={`regswitch-plot-wrap ${viewMode === "jitter" ? "" : "is-subplot"} heightdist-plot-wrap`}>
            <Plot
              data={traces}
              layout={{
                autosize: true,
                barmode: groupMode === "both" && viewMode === "histogram" ? "overlay" : "relative",
                bargap: 0.03,
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: "rgba(255,255,255,0.98)",
                font: { family: "Pretendard, Noto Sans KR, sans-serif", color: "#112d4e", size: 16 },
                margin: { l: 72, r: 28, t: 24, b: 72 },
                legend: {
                  orientation: "h",
                  x: 0,
                  y: 1.14,
                  bgcolor: "rgba(255,255,255,0.0)",
                },
                shapes: plotShapes,
                annotations: plotAnnotations,
                xaxis: {
                  title: { text: formatAxisLabel(transformMode), standoff: 18 },
                  range: xRange,
                  showgrid: true,
                  gridcolor: "rgba(17,45,78,0.08)",
                  zeroline: transformMode !== "raw",
                  zerolinecolor: "rgba(17,45,78,0.18)",
                  tickfont: { size: 14 },
                  ...xTickSpec,
                },
                yaxis:
                  viewMode === "histogram"
                    ? {
                        title: { text: isDensity ? "밀도" : "빈도(명)", standoff: 14 },
                        rangemode: "tozero",
                        showgrid: true,
                        gridcolor: "rgba(17,45,78,0.08)",
                        tickfont: { size: 14 },
                      }
                    : {
                        title: { text: "" },
                        range: [-0.16, 0.16],
                        showgrid: false,
                        showticklabels: false,
                        zeroline: false,
                      },
                hovermode: "x unified",
                showlegend: true,
                uirevision: `heightdist-${groupMode}-${viewMode}-${transformMode}-${scaleMode}`,
              }}
              config={{
                displayModeBar: false,
                responsive: true,
                showTips: true,
                doubleClick: "reset+autosize",
              }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>

          <section className="heightdist-metrics">
            {metricCards.map((card) => (
              <article key={card.key}>
                <span>{card.label}</span>
                <strong>
                  {[
                    `평균 ${card.mean.toFixed(2)}`,
                    `표준편차 ${card.std.toFixed(2)}`,
                    `중앙값 ${card.median.toFixed(2)}`,
                    `최소 ${card.min.toFixed(2)}`,
                    `최대 ${card.max.toFixed(2)}`,
                    `왜도 ${card.skewness.toFixed(2)}`,
                    `첨도 ${card.kurtosis.toFixed(2)}`,
                    `N ${card.n}`,
                    ...card.intervals.map(
                      (interval) =>
                        `${interval.label}${interval.label === "±1SD" ? "" : " CI"} ${interval.low.toFixed(2)} ~ ${interval.high.toFixed(2)}`
                    ),
                  ].join(" / ")}
                </strong>
              </article>
            ))}
          </section>
        </article>

        <aside className="regswitch-panel">
          <section className="rr-step-slider">
            <span>집단 선택</span>
            <select className="heightdist-select" value={groupMode} onChange={(event) => setGroupMode(event.target.value)}>
              <option value="male">남성</option>
              <option value="female">여성</option>
              <option value="both">전체</option>
            </select>
          </section>

          <section className="rr-step-slider">
            <span>표현 방식</span>
            <div className="regswitch-buttons">
              <button
                type="button"
                className={viewMode === "histogram" ? "active" : ""}
                onClick={() => setViewMode("histogram")}
              >
                히스토그램
              </button>
              <button
                type="button"
                className={viewMode === "jitter" ? "active" : ""}
                onClick={() => setViewMode("jitter")}
              >
                지터 그래프
              </button>
            </div>
          </section>

          <section className="rr-step-slider">
            <span>세로축 기준</span>
            <div className="regswitch-buttons">
              <button
                type="button"
                className={scaleMode === "frequency" ? "active" : ""}
                onClick={() => setScaleMode("frequency")}
              >
                빈도
              </button>
              <button
                type="button"
                className={scaleMode === "density" ? "active" : ""}
                onClick={() => setScaleMode("density")}
              >
                밀도
              </button>
            </div>
          </section>

          <section className="rr-step-slider">
            <span>변환</span>
            <select
              className="heightdist-select"
              value={transformMode}
              onChange={(event) => setTransformMode(event.target.value)}
            >
              <option value="raw">원자료</option>
              <option value="centered">평균중심화</option>
              <option value="zscore">표준점수</option>
            </select>
          </section>

          <section className="rr-step-slider">
            <div className="heightdist-case-toggle">
              <span>케이스</span>
              <label className="heightdist-inline-check">
                <input type="checkbox" checked={showCase} onChange={() => setShowCase((value) => !value)} />
                <strong>표시</strong>
              </label>
            </div>
            {showCase ? (
              <div className="heightdist-case-input">
                <input type="number" step="0.1" value={caseHeight} onChange={(event) => setCaseHeight(event.target.value)} />
                <span>cm</span>
              </div>
            ) : null}
          </section>

          <section className="rr-step-slider">
            <span>표시 옵션</span>
            <div className="regswitch-toggle-list">
              <label>
                <input type="checkbox" checked={showNormal} onChange={() => setShowNormal((value) => !value)} />
                <strong>정규분포곡선</strong>
              </label>
              <label>
                <input type="checkbox" checked={showKde} onChange={() => setShowKde((value) => !value)} />
                <strong>KDE</strong>
              </label>
              <label>
                <input type="checkbox" checked={showMean} onChange={() => setShowMean((value) => !value)} />
                <strong>평균선</strong>
              </label>
              <label>
                <input type="checkbox" checked={showStdBand} onChange={() => setShowStdBand((value) => !value)} />
                <strong>±1 표준편차</strong>
              </label>
              <label>
                <input type="checkbox" checked={show95} onChange={() => setShow95((value) => !value)} />
                <strong>95% 신뢰구간</strong>
              </label>
              <label>
                <input type="checkbox" checked={show99} onChange={() => setShow99((value) => !value)} />
                <strong>99% 신뢰구간</strong>
              </label>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
