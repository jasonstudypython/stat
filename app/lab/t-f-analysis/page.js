"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import fatData from "../../../data_mdis_fat.json";
import { downloadCsv } from "../_shared/csv";
import { mean, normalCdf, sampleVariance, standardDeviation } from "../_shared/stats";
import { useMobileFitScale } from "../_shared/useMobileFitScale";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

function hexToRgba(hex, alpha) {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
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

function compressSignedTValue(value) {
  const sign = value < 0 ? -1 : 1;
  return sign * Math.log10(1 + Math.abs(value));
}

function buildCompressedTTicks(observedT, expandedMax) {
  const positiveReferenceTicks = [0, 1, 2, 4, 8];
  const magnitudeTicks = [16, 32, 64, 128, 256];
  const signedMagnitudeTicks = magnitudeTicks.flatMap((value) => [-value, value]);
  const observedRounded =
    Math.abs(observedT) >= 10 ? Math.round(observedT) : Number(observedT.toFixed(1));

  return Array.from(
    new Set(
      [...positiveReferenceTicks, ...positiveReferenceTicks.map((value) => -value), ...signedMagnitudeTicks, observedRounded]
        .map((value) => Number(value.toFixed(6)))
        .filter((value) => value >= -expandedMax && value <= expandedMax)
    )
  ).sort((a, b) => a - b);
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

const MOBILE_TF_SECTIONS = [
  { key: "t-compare", groupTitle: "t검정", sectionTitle: "집단 비교" },
  { key: "t-dist", groupTitle: "t검정", sectionTitle: "t분포" },
  { key: "f-compare", groupTitle: "F검정", sectionTitle: "집단 비교" },
  { key: "f-dist", groupTitle: "F검정", sectionTitle: "F분포" },
];

export default function TFAnalysisPage() {
  const mobileFit = useMobileFitScale(820, 560);
  const [alpha, setAlpha] = useState(0.05);
  const [analysisMode, setAnalysisMode] = useState("t");
  const [showStatisticScale, setShowStatisticScale] = useState(false);
  const [showJitter, setShowJitter] = useState(false);
  const varianceSquareWidthRatio = mobileFit.height !== null ? 0.65 : 0.52;

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth <= 820) {
      setShowStatisticScale(true);
    }
  }, []);

  const maleFat = useMemo(() => fatData.male.map(Number), []);
  const femaleFat = useMemo(() => fatData.female.map(Number), []);

  const stats = useMemo(() => {
    const maleMean = mean(maleFat);
    const femaleMean = mean(femaleFat);
    const overallMean = mean([...maleFat, ...femaleFat]);
    const maleVar = sampleVariance(maleFat);
    const femaleVar = sampleVariance(femaleFat);
    const n1 = maleFat.length;
    const n2 = femaleFat.length;
    const ssBetween = n1 * (maleMean - overallMean) ** 2 + n2 * (femaleMean - overallMean) ** 2;
    const ssWithin = (n1 - 1) * maleVar + (n2 - 1) * femaleVar;
    const msBetween = ssBetween / 1;
    const pooledVariance = ssWithin / (n1 + n2 - 2);
    const standardError = Math.sqrt(pooledVariance * (1 / n1 + 1 / n2));
    const tValue = (maleMean - femaleMean) / standardError;
    const df = n1 + n2 - 2;
    const pValue = 2 * (1 - normalCdf(Math.abs(tValue)));
    const fValue = msBetween / pooledVariance;

    return {
      maleMean,
      femaleMean,
      overallMean,
      msBetween,
      pooledVariance,
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
    const expandedMax = Math.max(5, Math.abs(stats.tValue) * 1.08);
    const paddedMax = compressSignedTValue(expandedMax) + 0.45;
    return [-paddedMax, paddedMax];
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
    const curveMax = Math.max(5, criticalT * 2.6);
    const xValues = Array.from({ length: 1200 }, (_, index) => -curveMax + ((curveMax * 2) * index) / 1199);
    const yValues = xValues.map((x) => (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x));
    const mappedXValues = xValues.map((x) => (showStatisticScale ? compressSignedTValue(x) : x));
    const mappedNegativeCriticalT = showStatisticScale ? compressSignedTValue(-criticalT) : -criticalT;
    const mappedCriticalT = showStatisticScale ? compressSignedTValue(criticalT) : criticalT;
    const mappedObservedT = showStatisticScale ? compressSignedTValue(stats.tValue) : stats.tValue;

    return {
      traces: [
        {
          type: "scatter",
          mode: "lines",
          x: mappedXValues,
          y: yValues,
          line: { color: "#3f72af", width: 3 },
          hovertemplate: "t=%{x:.2f}<br>밀도=%{y:.3f}<extra></extra>",
          showlegend: false,
        },
        {
          type: "scatter",
          mode: "lines",
          x: mappedXValues.filter((_, index) => xValues[index] <= -criticalT),
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
          x: mappedXValues.filter((_, index) => xValues[index] >= criticalT),
          y: yValues.filter((_, index) => xValues[index] >= criticalT),
          fill: "tozeroy",
          fillcolor: "rgba(248,118,104,0.34)",
          line: { color: "rgba(0,0,0,0)", width: 0 },
          hoverinfo: "skip",
          showlegend: false,
        },
      ],
      shapes: [
        { type: "line", x0: mappedNegativeCriticalT, x1: mappedNegativeCriticalT, y0: 0, y1: 0.7, line: { color: "#ef4444", width: 2, dash: "dash" } },
        { type: "line", x0: mappedCriticalT, x1: mappedCriticalT, y0: 0, y1: 0.7, line: { color: "#ef4444", width: 2, dash: "dash" } },
        { type: "line", x0: mappedObservedT, x1: mappedObservedT, y0: 0, y1: 0.7, line: { color: "#112d4e", width: 3 } },
      ],
      annotations: [
        { x: mappedNegativeCriticalT, y: 0.66, text: `-${criticalT.toFixed(2)}`, showarrow: false, font: { size: 12, color: "#ef4444" } },
        { x: mappedCriticalT, y: 0.66, text: `${criticalT.toFixed(2)}`, showarrow: false, font: { size: 12, color: "#ef4444" } },
        {
          x: Math.max(tAxisRange[0] + 0.2, Math.min(tAxisRange[1] - 0.2, mappedObservedT)),
          y: 0.58,
          text: `관측 t=${stats.tValue.toFixed(2)}`,
          showarrow: false,
          font: { size: 16, color: "#112d4e" },
          bgcolor: "rgba(255,255,255,0.98)",
          bordercolor: "rgba(17,45,78,0.22)",
          borderwidth: 1.5,
          borderpad: 4,
          visible: showStatisticScale,
        },
      ],
    };
  }, [criticalT, showStatisticScale, stats.tValue, tAxisRange]);

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

  const tAxisSpec = useMemo(() => {
    if (!showStatisticScale) {
      return { range: tAxisRange, tickmode: "auto" };
    }

    const expandedMax = Math.max(5, Math.abs(stats.tValue) * 1.08);
    const uniqueTicks = buildCompressedTTicks(stats.tValue, expandedMax);

    return {
      range: tAxisRange,
      tickmode: "array",
      tickvals: uniqueTicks.map((value) => compressSignedTValue(value)),
      ticktext: uniqueTicks.map((value) => {
        if (Math.abs(value) >= 10) return `${Number(value.toFixed(0))}`;
        return `${Number(value.toFixed(1))}`;
      }),
    };
  }, [showStatisticScale, stats.tValue, tAxisRange]);

  const meanDifference = Math.abs(stats.femaleMean - stats.maleMean);
  const lowerMean = Math.min(stats.maleMean, stats.femaleMean);
  const upperMean = Math.max(stats.maleMean, stats.femaleMean);
  const compareYRange = useMemo(() => {
    const allValues = [...maleFat, ...femaleFat];
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const padding = Math.max(3, (maxValue - minValue) * 0.08);
    return [minValue - padding, maxValue + padding];
  }, [femaleFat, maleFat]);
  const fVarianceGuide = useMemo(() => {
    const maleSd = standardDeviation(maleFat);
    const femaleSd = standardDeviation(femaleFat);
    const betweenColor = "#06b6d4";
    const withinColor = "#f97316";

    return {
      between: [
        { x: 0.445, start: stats.maleMean, end: stats.overallMean, color: betweenColor },
        { x: 0.555, start: stats.overallMean, end: stats.femaleMean, color: betweenColor },
      ],
      maleWithin: [
        { x: 0.13, end: stats.maleMean - maleSd * 1.0, color: withinColor, centerX: 0.18 },
        { x: 0.16, end: stats.maleMean - maleSd * 2.0, color: withinColor, centerX: 0.18 },
        { x: 0.20, end: stats.maleMean + maleSd * 1.9, color: withinColor, centerX: 0.18 },
        { x: 0.24, end: stats.maleMean + maleSd * 1.1, color: withinColor, centerX: 0.18 },
      ],
      femaleWithin: [
        { x: 0.765, end: stats.femaleMean - femaleSd * 1.1, color: withinColor, centerX: 0.825 },
        { x: 0.805, end: stats.femaleMean - femaleSd * 1.95, color: withinColor, centerX: 0.825 },
        { x: 0.845, end: stats.femaleMean + femaleSd * 1.9, color: withinColor, centerX: 0.825 },
        { x: 0.885, end: stats.femaleMean + femaleSd * 1.1, color: withinColor, centerX: 0.825 },
      ],
    };
  }, [femaleFat, maleFat, stats.femaleMean, stats.maleMean, stats.overallMean]);

  const valueToPaperY = (value) =>
    (value - compareYRange[0]) / Math.max(compareYRange[1] - compareYRange[0], 1);

  const createVarianceSquare = ({ x, start, end, color, centerX = x }) => {
    const lowPaper = valueToPaperY(Math.min(start, end));
    const highPaper = valueToPaperY(Math.max(start, end));
    const side = Math.max(highPaper - lowPaper, 0.028);
    const squareWidth = Math.max(side * varianceSquareWidthRatio, 0.022);
    const x0 = x <= centerX ? x : x - squareWidth;
    return {
      type: "rect",
      xref: "paper",
      yref: "paper",
      x0,
      x1: x0 + squareWidth,
      y0: lowPaper,
      y1: highPaper,
      fillcolor: hexToRgba(color, 0.14),
      line: { color, width: 1 },
      layer: "below",
    };
  };

  const buildCompareLayout = (mode) => ({
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
        visible: mode === "f",
      },
      {
        type: "line",
        xref: "paper",
        x0: 0.085,
        x1: 0.445,
        y0: stats.maleMean,
        y1: stats.maleMean,
        line: { color: "#ef4444", width: 3 },
        visible: true,
      },
      {
        type: "line",
        xref: "paper",
        x0: 0.555,
        x1: 0.915,
        y0: stats.femaleMean,
        y1: stats.femaleMean,
        line: { color: "#2563eb", width: 3 },
        visible: true,
      },
      ...(mode === "f"
        ? [
            ...fVarianceGuide.between.map((guide) => createVarianceSquare(guide)),
            ...fVarianceGuide.maleWithin.map((guide) =>
              createVarianceSquare({ ...guide, start: stats.maleMean }),
            ),
            ...fVarianceGuide.femaleWithin.map((guide) =>
              createVarianceSquare({ ...guide, start: stats.femaleMean }),
            ),
          ]
        : []),
    ],
    annotations: [
      {
        x: 0.5,
        xref: "paper",
        y: upperMean,
        yref: "y",
        ax: 0.5,
        axref: "paper",
        ay: lowerMean,
        ayref: "y",
        text: "",
        showarrow: true,
        arrowside: "end+start",
        arrowhead: 3,
        startarrowhead: 3,
        arrowsize: 1,
        startarrowsize: 1,
        arrowwidth: 2.5,
        arrowcolor: "#60a5fa",
        visible: mode === "t",
      },
      {
        x: 0.535,
        xref: "paper",
        y: (stats.maleMean + stats.femaleMean) / 2,
        yref: "y",
        text: meanDifference.toFixed(2),
        showarrow: false,
        xanchor: "left",
        yanchor: "middle",
        font: { size: 14, color: "#374151" },
        bgcolor: "rgba(255,255,255,0.92)",
        bordercolor: "rgba(96,165,250,0.22)",
        borderpad: 2,
        visible: mode === "t",
      },
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
        visible: mode === "f",
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
      ...(mode === "f"
        ? [
            {
              x: 0.595,
              xref: "paper",
              y: stats.overallMean + 0.2,
              yref: "y",
              text: "집단간 차이 제곱",
              showarrow: false,
              xanchor: "left",
              yanchor: "bottom",
              font: { size: 13, color: "#06b6d4" },
              bgcolor: "rgba(255,255,255,0.9)",
              bordercolor: "rgba(6,182,212,0.18)",
              borderpad: 2,
            },
            {
              x: 0.285,
              xref: "paper",
              y: stats.maleMean - standardDeviation(maleFat) * 2.05,
              yref: "y",
              text: "집단내 차이 제곱",
              showarrow: false,
              xanchor: "left",
              yanchor: "middle",
              font: { size: 13, color: "#f97316" },
              bgcolor: "rgba(255,255,255,0.9)",
              bordercolor: "rgba(249,115,22,0.18)",
              borderpad: 2,
            },
            ...fVarianceGuide.between.map((guide) => ({
              x: guide.x,
              xref: "paper",
              y: guide.end,
              yref: "y",
              ax: guide.x,
              axref: "paper",
              ay: guide.start,
              ayref: "y",
              text: "",
              showarrow: true,
              arrowside: "end+start",
              arrowhead: 3,
              startarrowhead: 3,
              arrowsize: 1,
              startarrowsize: 1,
              arrowwidth: 2.4,
              arrowcolor: guide.color,
            })),
            ...fVarianceGuide.maleWithin.map((guide) => ({
              x: guide.x,
              xref: "paper",
              y: guide.end,
              yref: "y",
              ax: guide.x,
              axref: "paper",
              ay: stats.maleMean,
              ayref: "y",
              text: "",
              showarrow: true,
              arrowside: "end+start",
              arrowhead: 3,
              startarrowhead: 3,
              arrowsize: 1,
              startarrowsize: 1,
              arrowwidth: 2.1,
              arrowcolor: guide.color,
            })),
            ...fVarianceGuide.femaleWithin.map((guide) => ({
              x: guide.x,
              xref: "paper",
              y: guide.end,
              yref: "y",
              ax: guide.x,
              axref: "paper",
              ay: stats.femaleMean,
              ayref: "y",
              text: "",
              showarrow: true,
              arrowside: "end+start",
              arrowhead: 3,
              startarrowhead: 3,
              arrowsize: 1,
              startarrowsize: 1,
              arrowwidth: 2.1,
              arrowcolor: guide.color,
            })),
          ]
        : []),
    ],
    xaxis: {
      title: { text: "성별", standoff: 16 },
      showgrid: false,
      tickfont: { size: 14 },
    },
    yaxis: {
      title: { text: "체지방률", standoff: 14 },
      range: compareYRange,
      showgrid: true,
      gridcolor: "rgba(17,45,78,0.08)",
      tickfont: { size: 14 },
    },
    uirevision: `tf-compare-${showJitter ? "jitter" : "violin"}-${mode}`,
  });

  const buildDistributionLayout = (mode) => ({
    autosize: true,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(255,255,255,0.98)",
    font: { family: "Pretendard, Noto Sans KR, sans-serif", color: "#112d4e", size: 15 },
    margin: { l: 68, r: 24, t: 22, b: 58 },
    showlegend: false,
    shapes: mode === "t" ? tPlot.shapes : fPlot.shapes,
    annotations: mode === "t" ? tPlot.annotations : fPlot.annotations,
    xaxis:
      mode === "t"
        ? {
            title: { text: "t 값", standoff: 14 },
            ...tAxisSpec,
            showgrid: true,
            gridcolor: "rgba(17,45,78,0.08)",
            tickangle: 0,
            automargin: true,
          }
        : {
            title: { text: "F 값", standoff: 14 },
            ...fAxisSpec,
            showgrid: true,
            gridcolor: "rgba(17,45,78,0.08)",
            tickangle: 0,
            automargin: true,
          },
    yaxis: {
      title: { text: "밀도", standoff: 12 },
      ...(mode === "f" ? { range: [0, 4] } : { range: [0, 0.7] }),
      showgrid: true,
      gridcolor: "rgba(17,45,78,0.08)",
      showline: true,
      linecolor: "#112d4e",
      linewidth: 2,
      zeroline: false,
    },
    uirevision: `tf-dist-${mode}-${alpha}-${showStatisticScale}`,
  });

  const mobileSections = MOBILE_TF_SECTIONS.map((section) => {
    if (section.key === "t-compare") {
      return {
        ...section,
        data: compareTraces,
        layout: buildCompareLayout("t"),
        metrics: [
          { label: "남성과 여성의 평균 차이", value: meanDifference.toFixed(2) },
          { label: "t 통계량", value: stats.tValue.toFixed(2) },
          { label: "유의확률 p", value: stats.pValue < 0.001 ? "0.000" : stats.pValue.toFixed(3) },
        ],
      };
    }

    if (section.key === "t-dist") {
      return {
        ...section,
        data: tPlot.traces,
        layout: buildDistributionLayout("t"),
      };
    }

    if (section.key === "f-compare") {
      return {
        ...section,
        data: compareTraces,
        layout: buildCompareLayout("f"),
        metrics: [
          { label: "집단간 평균제곱합", value: stats.msBetween.toFixed(2) },
          { label: "집단내 평균제곱합", value: stats.pooledVariance.toFixed(2) },
          { label: "F 통계량", value: stats.fValue.toFixed(2) },
          { label: "자유도", value: `1, ${stats.df}` },
        ],
      };
    }

    return {
      ...section,
      data: fPlot.traces,
      layout: buildDistributionLayout("f"),
    };
  });

  return (
    <main className="rr-shell tf-shell">
      <header className="rr-header tf-header">
        <div>
          <p className="eyebrow">GRAPH</p>
          <h1>t검정과 F검정</h1>
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
                "t-f-analysis-jamovi.csv",
                [
                  ...maleFat.map((value) => ({ sex_code: 0, sex_label: "male", body_fat: value })),
                  ...femaleFat.map((value) => ({ sex_code: 1, sex_label: "female", body_fat: value })),
                ],
                [
                  { label: "sex_code", value: "sex_code" },
                  { label: "sex_label", value: "sex_label" },
                  { label: "body_fat", value: (row) => row.body_fat.toFixed(6) },
                ],
              )
            }
          >
            CSV 다운로드
          </button>
        </div>
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
              layout={buildCompareLayout(analysisMode)}
              config={{
                displayModeBar: false,
                responsive: true,
                showTips: true,
                doubleClick: "reset+autosize",
              }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>

          <section className={`tf-metric-grid ${analysisMode === "t" ? "is-three" : ""}`}>
            {analysisMode === "t" ? (
              <article className="tf-metric-card">
                <span>남성과 여성의 평균 차이</span>
                <strong>{meanDifference.toFixed(2)}</strong>
              </article>
            ) : (
              <>
                <article className="tf-metric-card">
                  <span>집단간 평균제곱합</span>
                  <strong>{stats.msBetween.toFixed(2)}</strong>
                </article>
                <article className="tf-metric-card">
                  <span>집단내 평균제곱합</span>
                  <strong>{stats.pooledVariance.toFixed(2)}</strong>
                </article>
              </>
            )}
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
                        ...tAxisSpec,
                        showgrid: true,
                        gridcolor: "rgba(17,45,78,0.08)",
                        tickangle: 0,
                        automargin: true,
                      }
                    : {
                        title: { text: "F 값", standoff: 14 },
                        ...fAxisSpec,
                        showgrid: true,
                        gridcolor: "rgba(17,45,78,0.08)",
                        tickangle: 0,
                        automargin: true,
                      },
                yaxis: {
                  title: { text: "밀도", standoff: 12 },
                  ...(analysisMode === "f" ? { range: [0, 4] } : { range: [0, 0.7] }),
                  showgrid: true,
                  gridcolor: "rgba(17,45,78,0.08)",
                  showline: true,
                  linecolor: "#112d4e",
                  linewidth: 2,
                  zeroline: false,
                },
                uirevision: `tf-dist-${analysisMode}-${alpha}-${showStatisticScale}`,
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
        </article>
      </section>

      <div
        ref={mobileFit.frameRef}
        className="tf-mobile-fit-frame"
        data-ready={mobileFit.ready ? "true" : "false"}
        style={mobileFit.height ? { height: `${mobileFit.height}px` } : undefined}
      >
        <div
          ref={mobileFit.contentRef}
          className="tf-mobile-fit-inner"
          style={{ transform: `scale(${mobileFit.scale})` }}
        >
          <section className="tf-mobile-stack">
            {mobileSections.map((section) => (
              <article key={section.key} className="rr-graph-card tf-mobile-section">
                <div className="rr-graph-head tf-mobile-head">
                  <div>
                    <p className="panel-label">{section.groupTitle}</p>
                    <h2 className="regswitch-title">{section.sectionTitle}</h2>
                  </div>
                </div>

                <div className={section.metrics ? "tf-plot-wrap tf-mobile-plot" : "tf-small-plot tf-mobile-side-plot"}>
                  <Plot
                    data={section.data}
                    layout={section.layout}
                    config={{
                      displayModeBar: false,
                      responsive: true,
                      showTips: true,
                      doubleClick: "reset+autosize",
                    }}
                    style={{ width: "100%", height: "100%" }}
                  />
                </div>

                {section.metrics ? (
                  <section className={`tf-metric-grid tf-mobile-metric-grid ${section.metrics.length === 3 ? "is-three" : ""}`}>
                    {section.metrics.map((metric) => (
                      <article key={metric.label} className="tf-metric-card">
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                      </article>
                    ))}
                  </section>
                ) : null}
              </article>
            ))}
          </section>

          <div className="tf-mobile-footer">
            <Link className="secondary-button regswitch-home-button" href="/lab">
              메인으로
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
