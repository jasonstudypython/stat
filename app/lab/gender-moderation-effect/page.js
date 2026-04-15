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
  standardDeviation,
} from "../_shared/stats";

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
});

const GROUP_OPTIONS = [
  { key: "all", label: "남+여" },
  { key: "male", label: "남" },
  { key: "female", label: "여" },
];

const EFFECT_OPTIONS = [
  { key: "full", label: "조절효과 모형" },
  { key: "xMain", label: "독립변수의 효과" },
  { key: "zMain", label: "조절변수의 주효과" },
  { key: "interaction", label: "상호작용 효과" },
  { key: "moderationModel", label: "조절효과 플롯" },
];

const PLOT_STYLE_OPTIONS = [
  { key: "interaction", label: "interaction plot" },
  { key: "simpleSlopes", label: "simple slopes plot" },
];

const MOBILE_EFFECT_SECTIONS = [
  { key: "full", plotStyle: "interaction", groupTitle: "조절효과 분석", sectionTitle: "조절효과 모형" },
  { key: "xMain", plotStyle: "interaction", groupTitle: "조절효과 분석", sectionTitle: "성별이 남성(=0)일 경우" },
  {
    key: "zMain",
    plotStyle: "interaction",
    groupTitle: "조절효과 분석",
    sectionTitle: "성별이 여성(=1)일 경우 조절변수의 주효과",
  },
  {
    key: "interaction",
    plotStyle: "interaction",
    groupTitle: "조절효과 분석",
    sectionTitle: "성별이 여성(=1)일 경우 상호작용항의 조절효과",
  },
  {
    key: "moderationModel",
    plotStyle: "interaction",
    groupTitle: "조절효과 시각화",
    sectionTitle: "interaction plot",
  },
  {
    key: "moderationModel",
    plotStyle: "simpleSlopes",
    groupTitle: "조절효과 시각화",
    sectionTitle: "simple slopes plot",
  },
];

const COLOR_BY_GROUP = {
  male: "#2f6fb2",
  female: "#f28c28",
};

function formatLabelValue(value) {
  return formatNumber(value).replace(".", ",");
}

function buildModerationScene() {
  const random = createSeededRandom(100);
  const rows = Array.from({ length: 200 }, () => {
    const x = 1 + random() * 9;
    const z = random() < 0.5 ? 0 : 1;
    const y = 30 + 2 * x + 15 * z + 3 * (x * z) + sampleNormal(random, 0, 8);
    return {
      x,
      z,
      y,
      groupKey: z === 0 ? "male" : "female",
      groupLabel: z === 0 ? "남" : "여",
    };
  });

  const xValues = rows.map((row) => row.x);
  const zValues = rows.map((row) => row.z);
  const xzValues = rows.map((row) => row.x * row.z);
  const yValues = rows.map((row) => row.y);

  const sumX = xValues.reduce((sum, value) => sum + value, 0);
  const sumZ = zValues.reduce((sum, value) => sum + value, 0);
  const sumXZ = xzValues.reduce((sum, value) => sum + value, 0);
  const sumY = yValues.reduce((sum, value) => sum + value, 0);
  const sumXSq = xValues.reduce((sum, value) => sum + value * value, 0);
  const sumZSq = zValues.reduce((sum, value) => sum + value * value, 0);
  const sumXZSq = xzValues.reduce((sum, value) => sum + value * value, 0);
  const sumXZPair = xValues.reduce((sum, value, index) => sum + value * zValues[index], 0);
  const sumXXZ = xValues.reduce((sum, value, index) => sum + value * xzValues[index], 0);
  const sumZXZ = zValues.reduce((sum, value, index) => sum + value * xzValues[index], 0);
  const sumXY = xValues.reduce((sum, value, index) => sum + value * yValues[index], 0);
  const sumZY = zValues.reduce((sum, value, index) => sum + value * yValues[index], 0);
  const sumXZY = xzValues.reduce((sum, value, index) => sum + value * yValues[index], 0);

  const xtx = [
    [rows.length, sumX, sumZ, sumXZ],
    [sumX, sumXSq, sumXZPair, sumXXZ],
    [sumZ, sumXZPair, sumZSq, sumZXZ],
    [sumXZ, sumXXZ, sumZXZ, sumXZSq],
  ];

  const coefficients = solveMatrix(xtx, [sumY, sumXY, sumZY, sumXZY]);
  const inverse = invertMatrix(xtx);
  const predictions = rows.map(
    (row) => coefficients[0] + coefficients[1] * row.x + coefficients[2] * row.z + coefficients[3] * row.x * row.z,
  );
  const residuals = yValues.map((value, index) => value - predictions[index]);
  const rss = residuals.reduce((sum, value) => sum + value * value, 0);
  const xMean = mean(xValues);
  const yMean = mean(yValues);
  const xSd = standardDeviation(xValues, xMean);
  const ySd = standardDeviation(yValues, yMean);
  const tss = yValues.reduce((sum, value) => sum + (value - yMean) ** 2, 0);
  const sigmaSquared = rss / (rows.length - 4);
  const explainedSumSquares = tss - rss;
  const fValue = (explainedSumSquares / 3) / sigmaSquared;
  const standardErrors = inverse.map((row, index) => Math.sqrt(Math.max(row[index], 0) * sigmaSquared));
  const tValues = coefficients.map((coefficient, index) =>
    standardErrors[index] === 0 ? 0 : coefficient / standardErrors[index],
  );
  const pValues = tValues.map((value) => 2 * (1 - normalCdf(Math.abs(value))));

  return {
    rows,
    coefficients,
    standardErrors,
    tValues,
    pValues,
    r2: 1 - rss / tss,
    adjustedR2: 1 - (1 - rss / tss) * ((rows.length - 1) / (rows.length - 4)),
    fValue,
    xLine: linspace(0, 10, 100),
    xMean,
    xSd,
    yMean,
    ySd,
  };
}

function buildPlot(scene, groupFilter, effectView, plotStyle) {
  const rows =
    groupFilter === "all"
      ? scene.rows
      : scene.rows.filter((row) => row.groupKey === groupFilter);

  const traces = [];
  const isSimpleSlopes = effectView === "moderationModel" && plotStyle === "simpleSlopes";
  const showScatter = effectView !== "moderationModel";
  const simpleSlopeLineX = isSimpleSlopes ? linspace(-2.5, 2.5, 100) : scene.xLine;

  if (showScatter && groupFilter === "all") {
    ["male", "female"].forEach((groupKey) => {
      const groupRows = scene.rows.filter((row) => row.groupKey === groupKey);
      traces.push({
        type: "scatter",
        mode: "markers",
        x: groupRows.map((row) => row.x),
        y: groupRows.map((row) => row.y),
        marker: {
          size: 8,
          color: effectView === "full" ? "rgba(148, 163, 184, 0.78)" : COLOR_BY_GROUP[groupKey],
          opacity: 0.72,
        },
        name: groupKey === "male" ? "남(코딩:0)" : "여(코딩:1)",
        hovertemplate: "공부시간: %{x:.2f}<br>성적: %{y:.2f}<extra></extra>",
      });
    });
  } else if (showScatter) {
    traces.push({
      type: "scatter",
      mode: "markers",
      x: rows.map((row) => row.x),
      y: rows.map((row) => row.y),
      marker: {
        size: 8,
        color: effectView === "full" ? "rgba(148, 163, 184, 0.78)" : COLOR_BY_GROUP[groupFilter],
        opacity: 0.72,
      },
      name: groupFilter === "male" ? "남(코딩:0)" : "여(코딩:1)",
      hovertemplate: "공부시간: %{x:.2f}<br>성적: %{y:.2f}<extra></extra>",
    });
  }

  const [b0, b1, b2, b3] = scene.coefficients;
  const lineWidth = 4;
  const layoutExtras = {};

  const pushLine = (zValue, color, yFunction, lineOptions = {}) => {
    const xValuesForLine = isSimpleSlopes ? simpleSlopeLineX : scene.xLine;
    traces.push({
      type: "scatter",
      mode: "lines",
      x: xValuesForLine,
      y: xValuesForLine.map((x) =>
        isSimpleSlopes
          ? (
              yFunction(scene.xMean + x * scene.xSd, zValue) -
              yFunction(scene.xMean, zValue)
            ) / scene.ySd
          : yFunction(x, zValue),
      ),
      line: {
        width: lineWidth,
        color,
        dash: lineOptions.dash ?? "solid",
      },
      hovertemplate: isSimpleSlopes
        ? "표준화 공부시간: %{x:.2f}<br>표준화 예측 성적: %{y:.2f}<extra></extra>"
        : "공부시간: %{x:.2f}<br>예측 성적: %{y:.2f}<extra></extra>",
      showlegend: lineOptions.showlegend ?? false,
      name: lineOptions.name,
    });
  };

  const groupsToShow = groupFilter === "all" ? [0, 1] : [groupFilter === "male" ? 0 : 1];

  if (effectView === "full") {
    // Keep only the scatter so the full-model step works as a conceptual overview.
  } else if (effectView === "moderationModel") {
    groupsToShow.forEach((z) => {
      pushLine(
        z,
        COLOR_BY_GROUP[z === 0 ? "male" : "female"],
        (x, group) => b0 + b1 * x + b2 * group + b3 * x * group,
        {
          showlegend: true,
          name: z === 0 ? "남성" : "여성",
        },
      );
    });
  } else if (effectView === "xMain") {
    pushLine(0, "#2563eb", (x) => b0 + b1 * x);
    traces.push({
      type: "scatter",
      mode: "lines",
      x: [0, 10],
      y: [b0, b0],
      line: {
        width: 2.5,
        color: "rgba(37, 99, 235, 0.72)",
        dash: "dot",
      },
      hoverinfo: "skip",
      showlegend: false,
    });
    const fillStartX = 0;
    const fillEndX = 1.92;
    const fillEndBaseX = 1.96;
    const fillSteps = 20;
    const fillXUpper = linspace(fillStartX, fillEndX, fillSteps);
    const fillXLower = linspace(fillStartX, fillEndBaseX, fillSteps);
    const interceptBandY = fillXLower.map(() => b0);
    const slopeLineY = fillXUpper.map((x) => b0 + b1 * x);
    const upperEndY = slopeLineY[slopeLineY.length - 1];
    const lowerEndY = interceptBandY[interceptBandY.length - 1];

    traces.push({
      type: "scatter",
      mode: "lines",
      x: [...fillXUpper, ...fillXLower.slice().reverse()],
      y: [...slopeLineY, ...interceptBandY.slice().reverse()],
      fill: "toself",
      fillcolor: "rgba(37, 99, 235, 0.12)",
      line: {
        width: 0,
        color: "rgba(0,0,0,0)",
      },
      hoverinfo: "skip",
      showlegend: false,
    });

    layoutExtras.annotations = [
      {
        x: 0.28,
        y: b0,
        ax: 0.28,
        ay: 0,
        xref: "x",
        yref: "y",
        axref: "x",
        ayref: "y",
        showarrow: true,
        arrowhead: 3,
        arrowsize: 1,
        arrowwidth: 2.5,
        arrowcolor: "#111111",
        text: "",
      },
      {
        x: 0.28,
        y: b0 / 2,
        xref: "x",
        yref: "y",
        showarrow: false,
        text: `절편 (${formatNumber(b0)})`,
        font: {
          size: 21,
          color: "#111111",
        },
        xanchor: "left",
        yanchor: "middle",
        xshift: 12,
      },
      {
        x: fillEndX - 0.02,
        y: upperEndY - 0.15,
        ax: fillEndBaseX - 0.03,
        ay: lowerEndY + 0.15,
        xref: "x",
        yref: "y",
        axref: "x",
        ayref: "y",
        showarrow: true,
        arrowhead: 3,
        arrowsize: 1,
        arrowwidth: 2.2,
        arrowcolor: "#2563eb",
        text: "",
      },
      {
        x: 2.05,
        y: b0 + b1 * 2.05 + 0.45,
        xref: "x",
        yref: "y",
        showarrow: false,
        text: `공부시간 (${formatNumber(b1)})`,
        font: {
          size: 21,
          color: "#2563eb",
        },
        xanchor: "left",
        yanchor: "middle",
        textangle: -11,
        bgcolor: "rgba(255,255,255,0)",
        borderwidth: 0,
      },
    ];
  } else if (effectView === "zMain") {
    groupsToShow.forEach((z) => {
      pushLine(
        z,
        COLOR_BY_GROUP[z === 0 ? "male" : "female"],
        (x, group) => b0 + b1 * x + b2 * group,
        { dash: z === 1 ? "dot" : "solid" },
      );
    });

    if (groupFilter === "all") {
      const arrowX = 0.35;
      const yStart = b0 + b1 * arrowX;
      const yEnd = yStart + b2;
      layoutExtras.annotations = [
        {
          x: arrowX,
          y: yEnd,
          ax: arrowX,
          ay: yStart,
          xref: "x",
          yref: "y",
          axref: "x",
          ayref: "y",
          showarrow: true,
          arrowhead: 3,
          arrowsize: 1,
          arrowwidth: 2.5,
          arrowcolor: "#112d4e",
          text: "",
        },
        {
          x: arrowX,
          y: (yStart + yEnd) / 2,
          xref: "x",
          yref: "y",
          showarrow: false,
          text: `성별 (+${formatNumber(b2)})`,
          font: {
            size: 21,
            color: "#112d4e",
          },
          xanchor: "left",
          yanchor: "middle",
          xshift: 12,
        },
      ];
    }
  } else {
    groupsToShow.forEach((z) => {
      pushLine(
        z,
        COLOR_BY_GROUP[z === 0 ? "male" : "female"],
        (x, group) => b0 + b1 * x + b2 * group + b3 * x * group,
      );
    });

    if (groupsToShow.includes(1)) {
      const fillStartX = 0;
      const fillEndX = 1.92;
      const fillEndBaseX = 2.02;
      const fillSteps = 20;
      const fillXUpper = linspace(fillStartX, fillEndX, fillSteps);
      const fillXLower = linspace(fillStartX, fillEndBaseX, fillSteps);
      const baseLineY = fillXLower.map((x) => b0 + b1 * x + b2);
      const interactionLineY = fillXUpper.map((x) => b0 + b1 * x + b2 + b3 * x);
      const upperEndY = interactionLineY[interactionLineY.length - 1];
      const lowerEndY = baseLineY[baseLineY.length - 1];

      pushLine(
        1,
        "rgba(242, 140, 40, 0.72)",
        (x, group) => b0 + b1 * x + b2 * group,
        { dash: "dot" },
      );
      traces.push({
        type: "scatter",
        mode: "lines",
        x: [
          ...fillXUpper,
          ...fillXLower.slice().reverse(),
        ],
        y: [
          ...interactionLineY,
          ...baseLineY.slice().reverse(),
        ],
        fill: "toself",
        fillcolor: "rgba(220, 38, 38, 0.18)",
        line: {
          width: 0,
          color: "rgba(0,0,0,0)",
        },
        hoverinfo: "skip",
        showlegend: false,
      });
      layoutExtras.annotations = [
        {
          x: fillEndX - 0.02,
          y: upperEndY - 0.15,
          ax: fillEndBaseX - 0.03,
          ay: lowerEndY + 0.15,
          xref: "x",
          yref: "y",
          axref: "x",
          ayref: "y",
          showarrow: true,
          arrowhead: 3,
          arrowsize: 1,
          arrowwidth: 2.2,
          arrowcolor: "#dc2626",
          text: "",
        },
        {
          x: 2.2,
          y: b0 + b1 * 2.2 + b2 + b3 * 2.2 + 1.5,
          xref: "x",
          yref: "y",
          showarrow: false,
          text: `상호작용(+${formatNumber(b3)})`,
          font: {
            size: 21,
            color: "#dc2626",
          },
          xanchor: "left",
          yanchor: "middle",
          textangle: -23,
          bgcolor: "rgba(255,255,255,0)",
          borderwidth: 0,
        },
      ];
    }
  }

  const titleMap = {
    full: "조절효과 모형",
    xMain: "성별이 남성(=0)일 경우",
    zMain: "성별이 여성(=1)일 경우 조절변수의 주효과",
    interaction: "성별이 여성(=1)일 경우 상호작용항의 조절효과",
    moderationModel: "조절효과 플롯",
  };

  return {
    data: traces,
    layout: {
      title: {
        text: titleMap[effectView],
        font: { size: 24, color: "#112d4e" },
      },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(242, 247, 252, 0.9)",
      margin: { l: 46, r: 18, t: 54, b: 44 },
      showlegend: true,
      legend: {
        x: 0.02,
        y: 0.98,
        xanchor: "left",
        yanchor: "top",
        orientation: "v",
        bgcolor: "rgba(255,255,255,0.78)",
        bordercolor: "rgba(17,45,78,0.08)",
        borderwidth: 1,
        font: {
          size: 21,
          color: "#112d4e",
        },
      },
      ...layoutExtras,
      xaxis: {
        title: { text: isSimpleSlopes ? "표준화 공부시간" : "공부시간" },
        showgrid: true,
        gridwidth: 2,
        gridcolor: "rgba(120, 185, 255, 0.34)",
        zeroline: true,
        zerolinecolor: "rgba(120, 185, 255, 0.3)",
        ticks: "outside",
        ticklen: 6,
        color: "#112d4e",
        range: isSimpleSlopes ? [-2.6, 2.6] : [0, 10],
      },
      yaxis: {
        title: { text: isSimpleSlopes ? "표준화 성적" : "성적" },
        showgrid: true,
        gridwidth: 2,
        gridcolor: "rgba(120, 185, 255, 0.34)",
        zeroline: true,
        zerolinecolor: "rgba(120, 185, 255, 0.3)",
        ticks: "outside",
        ticklen: 6,
        color: "#112d4e",
        range: isSimpleSlopes ? [-2.6, 2.6] : [0, 100],
      },
    },
  };
}

function buildFormulaCards(scene) {
  const [b0, b1, b2, b3] = scene.coefficients;

  return [
    {
      key: "overall",
      title: "전체 회귀식",
      dependent: "성적(Y) =",
      intercept: `절편(${formatNumber(b0)})`,
      independent: `${formatNumber(b1)}×공부시간(X)`,
      moderator: `${formatNumber(b2)}×성별(W)`,
      interaction: `${formatNumber(b3)}×상호작용항(X×W)`,
    },
    {
      key: "male",
      title: "남성인 경우",
      dependent: "성적(Y) =",
      intercept: `${formatNumber(b0)}`,
      independent: `${formatNumber(b1)}×공부시간(X)`,
      moderator: `${formatNumber(b2)}×0 = 0`,
      interaction: `${formatNumber(b3)}×(X×0) = 0`,
      reduced: `성적(Y) = ${formatNumber(b0)} + ${formatNumber(b1)}×공부시간(X) + 0 + 0`,
    },
    {
      key: "female",
      title: "여성인 경우",
      dependent: "성적(Y) =",
      intercept: `${formatNumber(b0)}`,
      independent: `${formatNumber(b1)}×X`,
      moderator: `${formatNumber(b2)}×1 = ${formatNumber(b2)}`,
      interaction: `${formatNumber(b3)}×(X×1) = ${formatNumber(b3)}×X`,
      reduced: `성적(Y) = ${formatNumber(b0)} + ${formatNumber(b1)}×X + ${formatNumber(b2)} + ${formatNumber(b3)}×X`,
    },
  ];
}

function buildStageCards() {
  return {
    full: {
      expressions: [
        {
          key: "formula",
          cards: [
            "종속변수",
            "절편",
            "회귀계수×독립변수",
            "회귀계수×조절변수",
            "회귀계수×상호작용항",
          ],
          operators: ["=", "+", "+", "+"],
        },
        {
          key: "concept",
          cards: [
            "성적",
            "27.558",
            "2.335×공부시간",
            "16.921×성별",
            "2.643×(공부시간×성별)",
          ],
          operators: ["=", "+", "+", "+"],
        },
      ],
    },
    xMain: {
      expressions: [
        {
          key: "male-case",
          title: "성별이 남성 (=0)인 경우 :",
          cards: [
            "성적",
            "27.558",
            "2.335×공부시간",
            "16.921×0",
            "2.643×(공부시간×0)",
          ],
          operators: ["=", "+", "+", "+"],
        },
      ],
    },
    zMain: {
      expressions: [
        {
          key: "female-case",
          title: "성별이 여성 (=1)인 경우 :",
          cards: [
            "성적",
            "27.558",
            "2.335×공부시간",
            "16.921×1",
            "2.643×(공부시간×1)",
          ],
          operators: ["=", "+", "+", "+"],
        },
      ],
    },
    interaction: {
      expressions: [
        {
          key: "interaction-case",
          title: "성별이 여성 (=1)인 경우 :",
          cards: [
            "성적",
            "27.558",
            "2.335×공부시간",
            "16.921",
            "2.643×공부시간",
          ],
          operators: ["=", "+", "+", "+"],
        },
      ],
    },
  };
}

function buildExpressionItems(expression) {
  const items = [];

  expression.cards.forEach((card, index) => {
    items.push({ type: "card", value: card, key: `${expression.key}-card-${card}` });

    if (expression.operators[index]) {
      items.push({
        type: "operator",
        value: expression.operators[index],
        key: `${expression.key}-operator-${expression.operators[index]}-${index}`,
      });
    }
  });

  return items;
}

export default function GenderModerationEffectPage() {
  const scene = useMemo(() => buildModerationScene(), []);
  const mobileFit = useMobileFitScale(820, 560);
  const formulaCards = useMemo(() => buildFormulaCards(scene), [scene]);
  const stageCards = useMemo(() => buildStageCards(), []);
  const fullModelExpressions = useMemo(
    () => stageCards.full.expressions.map((expression) => buildExpressionItems(expression)),
    [stageCards],
  );
  const xMainExpressions = useMemo(
    () => stageCards.xMain.expressions.map((expression) => buildExpressionItems(expression)),
    [stageCards],
  );
  const zMainExpressions = useMemo(
    () => stageCards.zMain.expressions.map((expression) => buildExpressionItems(expression)),
    [stageCards],
  );
  const interactionExpressions = useMemo(
    () => stageCards.interaction.expressions.map((expression) => buildExpressionItems(expression)),
    [stageCards],
  );
  const [groupFilter, setGroupFilter] = useState("all");
  const [effectView, setEffectView] = useState("full");
  const [plotStyle, setPlotStyle] = useState("interaction");

  const plot = buildPlot(scene, groupFilter, effectView, plotStyle);

  const coefficientRows = [
    { name: "const", coef: formatNumber(scene.coefficients[0], 3), stderr: formatNumber(scene.standardErrors[0], 3), t: formatNumber(scene.tValues[0], 3), p: formatPValue(scene.pValues[0]) },
    { name: "공부시간", coef: formatNumber(scene.coefficients[1], 3), stderr: formatNumber(scene.standardErrors[1], 3), t: formatNumber(scene.tValues[1], 3), p: formatPValue(scene.pValues[1]) },
    { name: "성별", coef: formatNumber(scene.coefficients[2], 3), stderr: formatNumber(scene.standardErrors[2], 3), t: formatNumber(scene.tValues[2], 3), p: formatPValue(scene.pValues[2]) },
    { name: "상호작용항", coef: formatNumber(scene.coefficients[3], 3), stderr: formatNumber(scene.standardErrors[3], 3), t: formatNumber(scene.tValues[3], 3), p: formatPValue(scene.pValues[3]) },
  ];

  const renderExpressionSequence = (expressionItems, currentView) => (
    <div className="modlab-expression-strip" aria-label="단계 수식">
      {expressionItems.map((item) => {
        const isCancelledZero =
          currentView === "xMain" &&
          item.type === "card" &&
          (item.value === "16.921×0" || item.value === "2.643×(공부시간×0)");
        const isEmphasisCard =
          item.type === "card" &&
          (
            item.value === "성적" ||
            item.value === "27.558" ||
            item.value === "2.335×공부시간" ||
            (currentView === "zMain" && item.value === "16.921×1") ||
            (currentView === "interaction" &&
              (item.value === "16.921" || item.value === "2.643×공부시간"))
          );

        return item.type === "operator" ? (
          <span key={item.key} className="modlab-expression-operator">
            {item.value}
          </span>
        ) : (
          <article
            key={item.key}
            className={`modlab-expression-card${isEmphasisCard ? " is-emphasis" : ""}${isCancelledZero ? " is-cancelled-zero" : ""}`}
          >
            {currentView === "zMain" && item.value === "16.921×1" ? (
              <span className="modlab-expression-note">성별(여성=1)의 효과</span>
            ) : null}
            {currentView === "interaction" && item.value === "2.643×공부시간" ? (
              <span className="modlab-expression-note">상호작용항의 조절효과</span>
            ) : null}
            <p>{item.value}</p>
            {isCancelledZero ? (
              <>
                <span className="modlab-cancel-slash" aria-hidden="true" />
                <span className="modlab-cancel-zero" aria-hidden="true">
                  0
                </span>
              </>
            ) : null}
          </article>
        );
      })}
    </div>
  );

  const renderFormulaArea = (currentView) => {
    if (currentView === "moderationModel") {
      return null;
    }

    const isOverviewView =
      currentView === "full" || currentView === "xMain" || currentView === "zMain" || currentView === "interaction";

    return (
      <div className="mediation-results-block mediation-results-block-summary">
        {isOverviewView ? (
          <div className="modlab-expression-stack">
            <div className="modlab-expression-strip" aria-label="전체모형 일반식">
              {fullModelExpressions[0].map((item) =>
                item.type === "operator" ? (
                  <span key={item.key} className="modlab-expression-operator">
                    {item.value}
                  </span>
                ) : (
                  <article key={item.key} className="modlab-expression-card">
                    <p>{item.value}</p>
                  </article>
                ),
              )}
            </div>

            <div className="mediation-results-block modlab-inline-results-block">
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
                  {coefficientRows.map((row) => (
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

            <div className="modlab-expression-strip" aria-label="전체모형 개념식">
              {fullModelExpressions[1].map((item) =>
                item.type === "operator" ? (
                  <span key={item.key} className="modlab-expression-operator">
                    {item.value}
                  </span>
                ) : (
                  <article key={item.key} className="modlab-expression-card">
                    <p>{item.value}</p>
                  </article>
                ),
              )}
            </div>

            {(currentView === "xMain"
              ? xMainExpressions
              : currentView === "zMain"
                ? zMainExpressions
                : interactionExpressions
            ).map((expression, expressionIndex) => (
              <div key={`${currentView}-expression-${expressionIndex}`} className="modlab-expression-stack">
                <p className="mediation-results-label">
                  {
                    (
                      currentView === "xMain"
                        ? stageCards.xMain.expressions
                        : currentView === "zMain"
                          ? stageCards.zMain.expressions
                          : stageCards.interaction.expressions
                    )[expressionIndex].title
                  }
                </p>
                {renderExpressionSequence(expression, currentView)}
              </div>
            ))}
          </div>
        ) : (
          <>
            <p className="mediation-results-label">공식 분해</p>
            <div className="modlab-formula-matrix">
              {formulaCards.map((card) => (
                <section key={card.key} className="modlab-formula-row-group">
                  <div className="modlab-formula-mini-card is-title">
                    <span className="modlab-formula-mini-label">구분</span>
                    <strong>{card.title}</strong>
                  </div>
                  <div className="modlab-formula-mini-card">
                    <span className="modlab-formula-mini-label">종속변수</span>
                    <code>{card.dependent}</code>
                  </div>
                  <div className="modlab-formula-mini-card">
                    <span className="modlab-formula-mini-label">절편</span>
                    <code>{card.intercept}</code>
                  </div>
                  <div className="modlab-formula-mini-card">
                    <span className="modlab-formula-mini-label">독립변수</span>
                    <code>{card.independent}</code>
                  </div>
                  <div className="modlab-formula-mini-card">
                    <span className="modlab-formula-mini-label">조절변수</span>
                    <code>{card.moderator}</code>
                  </div>
                  <div className="modlab-formula-mini-card">
                    <span className="modlab-formula-mini-label">상호작용항</span>
                    <code>{card.interaction}</code>
                  </div>
                  {card.reduced ? (
                    <div className="modlab-formula-mini-card is-wide">
                      <span className="modlab-formula-mini-label">정리된 식</span>
                      <code>{card.reduced}</code>
                    </div>
                  ) : null}
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderResultsPanel = (currentView) => {
    const showTables = currentView === "moderationModel";

    return (
      <section className="rr-step-slider multireg2-value-card multireg2-results-card">
        {showTables ? (
          <>
            <div className="mediation-results-block">
              <p className="mediation-results-label">모형</p>
              <table className="multireg2-table multireg2-model-table modlab-model-table">
                <thead>
                  <tr>
                    <th>R제곱</th>
                    <th>수정된 R제곱</th>
                    <th>F</th>
                    <th>p</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{formatNumber(scene.r2)}</td>
                    <td>{formatNumber(scene.adjustedR2)}</td>
                    <td>{formatNumber(scene.fValue, 1)}</td>
                    <td>0.000</td>
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
                  {coefficientRows.map((row) => (
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
          </>
        ) : null}

        {renderFormulaArea(currentView)}
      </section>
    );
  };

  const renderMobileResultsPanel = (currentView) => {
    if (currentView === "full") {
      return (
        <section className="rr-step-slider multireg2-value-card multireg2-results-card">
          <div className="mediation-results-block mediation-results-block-summary">
            <div className="modlab-expression-stack">
              <div className="modlab-expression-strip" aria-label="전체모형 일반식">
                {fullModelExpressions[0].map((item) =>
                  item.type === "operator" ? (
                    <span key={item.key} className="modlab-expression-operator">
                      {item.value}
                    </span>
                  ) : (
                    <article key={item.key} className="modlab-expression-card">
                      <p>{item.value}</p>
                    </article>
                  ),
                )}
              </div>

              <div className="mediation-results-block modlab-inline-results-block">
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
                    {coefficientRows.map((row) => (
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

              <div className="modlab-expression-strip" aria-label="전체모형 개념식">
                {fullModelExpressions[1].map((item) =>
                  item.type === "operator" ? (
                    <span key={item.key} className="modlab-expression-operator">
                      {item.value}
                    </span>
                  ) : (
                    <article key={item.key} className="modlab-expression-card">
                      <p>{item.value}</p>
                    </article>
                  ),
                )}
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (currentView === "moderationModel") {
      return (
        <section className="rr-step-slider multireg2-value-card multireg2-results-card">
          <div className="mediation-results-block">
            <p className="mediation-results-label">모형</p>
            <table className="multireg2-table multireg2-model-table modlab-model-table">
              <thead>
                <tr>
                  <th>R제곱</th>
                  <th>수정된 R제곱</th>
                  <th>F</th>
                  <th>p</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{formatNumber(scene.r2)}</td>
                  <td>{formatNumber(scene.adjustedR2)}</td>
                  <td>{formatNumber(scene.fValue, 1)}</td>
                  <td>0.000</td>
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
                {coefficientRows.map((row) => (
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
      );
    }

    const expressionSets =
      currentView === "xMain"
        ? xMainExpressions
        : currentView === "zMain"
          ? zMainExpressions
          : interactionExpressions;
    const expressionMeta =
      currentView === "xMain"
        ? stageCards.xMain.expressions
        : currentView === "zMain"
          ? stageCards.zMain.expressions
          : stageCards.interaction.expressions;

    return (
      <section className="rr-step-slider multireg2-value-card multireg2-results-card">
        <div className="mediation-results-block mediation-results-block-summary">
          <div className="modlab-expression-stack">
            {expressionSets.map((expression, expressionIndex) => (
              <div key={`${currentView}-mobile-expression-${expressionIndex}`} className="modlab-expression-stack">
                <p className="mediation-results-label">{expressionMeta[expressionIndex].title}</p>
                {renderExpressionSequence(expression, currentView)}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const mobileSections = MOBILE_EFFECT_SECTIONS.map((section, index) => ({
    id: `${section.key}-${section.plotStyle}-${index}`,
    groupTitle: section.groupTitle,
    sectionTitle: section.sectionTitle,
    effectView: section.key,
    plot: buildPlot(scene, "all", section.key, section.plotStyle),
  }));

  return (
    <main className="rr-shell multireg2-shell modlab-shell">
      <header className="rr-header multireg2-header">
        <div>
          <p className="eyebrow">Moderation Lab</p>
          <h1>조절(Moderation) 효과</h1>
        </div>
        <div className="modlab-header-actions">
          <Link className="secondary-button" href="/lab">
            메인으로
          </Link>
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              downloadCsv("gender-moderation-effect-jamovi.csv", scene.rows, [
                { label: "study_hours", value: (row) => row.x.toFixed(6) },
                { label: "gender_code", value: "z" },
                { label: "score", value: (row) => row.y.toFixed(6) },
              ])
            }
          >
            CSV 다운로드
          </button>
        </div>
      </header>

      <section className="multireg2-layout modlab-layout">
        <article className="rr-graph-card multireg2-stage">
          <div className="rr-graph-head multireg2-stage-head">
            <div>
              <p className="panel-label">Graph</p>
              <h2>
                {effectView === "full" || effectView === "xMain" || effectView === "zMain" || effectView === "interaction"
                  ? "조절효과 분석"
                  : effectView === "moderationModel"
                    ? "조절효과 시각화"
                    : "성별에 따른 조절효과 분해"}
              </h2>
            </div>
          </div>

          <div className="multireg2-plot-wrap mediation-plot-wrap">
            <Plot
              data={plot.data}
              layout={{
                font: {
                  family: "Pretendard, Noto Sans KR, sans-serif",
                  color: "#112d4e",
                  size: 16,
                },
                ...plot.layout,
              }}
              config={{
                responsive: true,
                showTips: true,
                doubleClick: "reset+autosize",
                displaylogo: false,
                modeBarButtonsToRemove: ["lasso2d", "select2d"],
              }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </article>

        <aside className="multireg2-panel">
          <section className="rr-step-slider multireg2-control-card">
            <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
              {GROUP_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </section>

          <section className="rr-step-slider multireg2-control-card">
            <select value={effectView} onChange={(event) => setEffectView(event.target.value)}>
              {EFFECT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </section>

          {effectView === "moderationModel" ? (
            <section className="rr-step-slider multireg2-control-card">
              <div className="modlab-toggle-group" role="tablist" aria-label="플롯 변경">
                {PLOT_STYLE_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`corr-toggle-button${plotStyle === option.key ? " active" : ""}`}
                    onClick={() => setPlotStyle(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {renderResultsPanel(effectView)}
        </aside>
      </section>

      <div
        ref={mobileFit.frameRef}
        className="modlab-mobile-fit-frame"
        data-ready={mobileFit.ready ? "true" : "false"}
        style={mobileFit.height ? { height: `${mobileFit.height}px` } : undefined}
      >
        <div
          ref={mobileFit.contentRef}
          className="modlab-mobile-fit-inner"
          style={{ transform: `scale(${mobileFit.scale})` }}
        >
          <section className="modlab-mobile-stack">
            {mobileSections.map((section) => (
              <article key={section.id} className="rr-graph-card modlab-mobile-section">
                <div className="rr-graph-head multireg2-stage-head modlab-mobile-head">
                  <div>
                    <p className="panel-label">{section.groupTitle}</p>
                    <h2>{section.sectionTitle}</h2>
                  </div>
                </div>

                <div className="multireg2-plot-wrap mediation-plot-wrap modlab-mobile-plot">
                  <Plot
                    data={section.plot.data}
                    layout={{
                      font: {
                        family: "Pretendard, Noto Sans KR, sans-serif",
                        color: "#112d4e",
                        size: 14,
                      },
                      ...section.plot.layout,
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

                <div className="modlab-mobile-cards">{renderMobileResultsPanel(section.effectView)}</div>
              </article>
            ))}
          </section>

          <div className="modlab-mobile-footer">
            <Link className="secondary-button" href="/lab">
              메인으로
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
