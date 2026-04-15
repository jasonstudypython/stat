"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { downloadCsv } from "../_shared/csv";
import { useMobileFitScale } from "../_shared/useMobileFitScale";

const MOBILE_SCATTER_SECTIONS = [
  {
    id: "regression",
    groupTitle: "단순 회귀분석",
    sectionTitle: "회귀선",
    toggles: {
      showObservations: true,
      showXSpread: true,
      showXMeanLine: true,
      showYMeanLine: true,
      showRegressionLine: true,
      showPrediction: false,
      showSlopeArrows: false,
      progressValue: 0,
    },
  },
  {
    id: "prediction",
    groupTitle: "단순 회귀분석",
    sectionTitle: "예측값",
    toggles: {
      showObservations: true,
      showXSpread: true,
      showXMeanLine: true,
      showYMeanLine: true,
      showRegressionLine: true,
      showPrediction: true,
      showSlopeArrows: false,
      progressValue: 56,
    },
  },
  {
    id: "slope",
    groupTitle: "단순 회귀분석",
    sectionTitle: "회귀선의 기울기",
    toggles: {
      showObservations: true,
      showXSpread: true,
      showXMeanLine: true,
      showYMeanLine: true,
      showRegressionLine: true,
      showPrediction: true,
      showSlopeArrows: true,
      progressValue: 56,
    },
  },
];

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

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  const avg = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / Math.max(values.length - 1, 1);
  return Math.sqrt(variance);
}

function fitSimpleRegression(points) {
  const xMean = mean(points.map((point) => point.x));
  const yMean = mean(points.map((point) => point.y));
  let numerator = 0;
  let denominator = 0;

  for (const point of points) {
    numerator += (point.x - xMean) * (point.y - yMean);
    denominator += (point.x - xMean) ** 2;
  }

  const slope = numerator / denominator;
  const intercept = yMean - slope * xMean;

  return { slope, intercept, xMean, yMean };
}

function rescale(values, targetMean, targetStd) {
  const currentMean = mean(values);
  const currentStd = standardDeviation(values) || 1;
  return values.map((value) => ((value - currentMean) / currentStd) * targetStd + targetMean);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createStudyDataset() {
  const random = createSeededRandom(20260325);
  const rawX = Array.from({ length: 30 }, () => sampleNormal(random, 0, 1));
  const scaledX = rescale(rawX, 4, 1.5).map((value) => clamp(value, 0.5, 8.5));
  const errorTerms = Array.from({ length: 30 }, () => sampleNormal(random, 0, 1));
  const rawY = scaledX.map((x, index) => 85 + 3.04 * (x - 4) + errorTerms[index] * 2.35);
  let scaledY = rescale(rawY, 85, 5).map((value) => clamp(value, 70, 100));
  const maxIndex = scaledY.indexOf(Math.max(...scaledY));
  scaledY = scaledY.map((value, index) => (index === maxIndex ? 100 : value));
  const yOnlyJitter = Array.from({ length: 30 }, () => 525 + sampleNormal(random, 0, 16));

  return scaledX.map((x, index) => ({
    id: index + 1,
    x: Number(x.toFixed(2)),
    y: Number(scaledY[index].toFixed(2)),
    yOnlyX: Number(yOnlyJitter[index].toFixed(2)),
  }));
}

function scale(value, domainMin, domainMax, rangeMin, rangeMax) {
  return rangeMin + ((value - domainMin) / (domainMax - domainMin || 1)) * (rangeMax - rangeMin);
}

function ScatterBridgeFigure({
  points,
  stats,
  showObservations,
  showXSpread,
  showXMeanLine,
  showYMeanLine,
  showRegressionLine,
  showPrediction,
  showSlopeArrows,
  progressValue,
}) {
  const svgId = useId().replace(/:/g, "");
  const rightArrowId = `${svgId}-arrow-right`;
  const upArrowId = `${svgId}-arrow-up`;

  const xMin = 0;
  const yMin = 68;
  const yMax = 102;
  const xAtScore100 = (100 - stats.intercept) / stats.slope;
  const xMax = Math.max(8.5, Math.ceil(xAtScore100 * 10) / 10);

  const plotLeft = 110;
  const plotRight = 960;
  const plotTop = 28;
  const plotBottom = 640;

  const meanX = scale(stats.xMean, xMin, xMax, plotLeft, plotRight);
  const meanY = scale(stats.yMean, yMin, yMax, plotBottom, plotTop);
  const lineX1 = 0;
  const lineX2 = xAtScore100;
  const lineY1 = stats.intercept + stats.slope * lineX1;
  const lineY2 = stats.intercept + stats.slope * lineX2;

  const predictionX = lineX1 + (progressValue / 100) * (lineX2 - lineX1);
  const predictionY = stats.intercept + stats.slope * predictionX;
  const predictionPointX = scale(predictionX, xMin, xMax, plotLeft, plotRight);
  const predictionPointY = scale(predictionY, yMin, yMax, plotBottom, plotTop);

  const highlightedStep = useMemo(() => {
    const xStart = 5;
    const xEnd = 6;
    const yStart = stats.intercept + stats.slope * xStart;
    const yEnd = stats.intercept + stats.slope * xEnd;
    return {
      sx: scale(xStart, xMin, xMax, plotLeft, plotRight),
      ex: scale(xEnd, xMin, xMax, plotLeft, plotRight),
      sy: scale(yStart, yMin, yMax, plotBottom, plotTop),
      ey: scale(yEnd, yMin, yMax, plotBottom, plotTop),
    };
  }, [plotBottom, plotLeft, plotRight, plotTop, stats.intercept, stats.slope, xMax, yMax, yMin]);

  return (
    <svg
      viewBox="0 0 1040 720"
      className="scatter-bridge-svg"
      role="img"
      aria-label="공부시간과 성적 산점도"
    >
      <defs>
        <marker
          id={rightArrowId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="0"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#d97706" />
        </marker>
        <marker
          id={upArrowId}
          viewBox="0 0 10 10"
          refX="5"
          refY="1"
          markerWidth="8"
          markerHeight="8"
          orient="0"
        >
          <path d="M 0 10 L 5 0 L 10 10 z" fill="#d97706" />
        </marker>
      </defs>

      <rect
        x={plotLeft - 26}
        y={plotTop - 18}
        width={plotRight - plotLeft + 52}
        height={plotBottom - plotTop + 34}
        rx="34"
        className="scatter-bridge-backdrop"
      />

      {Array.from({ length: 6 }, (_, index) => (
        <line
          key={`h-${index}`}
          x1={plotLeft}
          y1={plotTop + index * ((plotBottom - plotTop) / 6)}
          x2={plotRight}
          y2={plotTop + index * ((plotBottom - plotTop) / 6)}
          className="scatter-bridge-grid"
        />
      ))}

      {showXSpread
        ? Array.from({ length: Math.floor(xMax) + 1 }, (_, index) => (
            <line
              key={`v-${index}`}
              x1={scale(index, xMin, xMax, plotLeft, plotRight)}
              y1={plotTop}
              x2={scale(index, xMin, xMax, plotLeft, plotRight)}
              y2={plotBottom}
              className="scatter-bridge-grid"
            />
          ))
        : null}

      <line x1={plotLeft} y1={plotBottom} x2={plotRight} y2={plotBottom} className="scatter-bridge-axis" />
      <line x1={plotLeft} y1={plotTop} x2={plotLeft} y2={plotBottom} className="scatter-bridge-axis" />

      {showXMeanLine ? (
        <>
          <line x1={meanX} y1={plotTop} x2={meanX} y2={plotBottom} className="scatter-bridge-mean-line" />
          <text x={meanX + 12} y={plotTop + 24} className="scatter-bridge-mean-text">
            X 평균
          </text>
        </>
      ) : null}

      {showYMeanLine ? (
        <>
          <line x1={plotLeft} y1={meanY} x2={plotRight} y2={meanY} className="scatter-bridge-mean-line" />
          <text x={plotLeft + 16} y={meanY - 12} className="scatter-bridge-mean-text">
            Y 평균
          </text>
        </>
      ) : null}

      {showRegressionLine ? (
        <>
          <line
            x1={scale(lineX1, xMin, xMax, plotLeft, plotRight)}
            y1={scale(lineY1, yMin, yMax, plotBottom, plotTop)}
            x2={scale(lineX2, xMin, xMax, plotLeft, plotRight)}
            y2={scale(lineY2, yMin, yMax, plotBottom, plotTop)}
            className="scatter-bridge-regression"
          />
          {showXSpread
            ? points.map((point) => {
                const x = scale(point.x, xMin, xMax, plotLeft, plotRight);
                const predictedY = stats.intercept + stats.slope * point.x;
                return (
                  <line
                    key={`residual-${point.id}`}
                    x1={x}
                    y1={scale(point.y, yMin, yMax, plotBottom, plotTop)}
                    x2={x}
                    y2={scale(predictedY, yMin, yMax, plotBottom, plotTop)}
                    className="scatter-bridge-residual"
                  />
                );
              })
            : null}
        </>
      ) : null}

      {showSlopeArrows && showRegressionLine && showXSpread && highlightedStep ? (
        <g>
          <line
            x1={highlightedStep.sx}
            y1={highlightedStep.sy}
            x2={highlightedStep.ex - 6}
            y2={highlightedStep.sy}
            className="scatter-bridge-step-arrow"
            markerEnd={`url(#${rightArrowId})`}
          />
          <line
            x1={highlightedStep.ex}
            y1={highlightedStep.sy}
            x2={highlightedStep.ex}
            y2={highlightedStep.ey}
            className="scatter-bridge-step-arrow"
            markerEnd={`url(#${upArrowId})`}
          />
        </g>
      ) : null}

      {showSlopeArrows && showRegressionLine && showXSpread && highlightedStep ? (
        <text
          x={highlightedStep.ex + 12}
          y={(highlightedStep.sy + highlightedStep.ey) / 2 + 6}
          className="scatter-bridge-step-label"
        >
          {`${stats.slope.toFixed(2)}점`}
        </text>
      ) : null}

      {showObservations
        ? points.map((point) => {
            const x = showXSpread ? scale(point.x, xMin, xMax, plotLeft, plotRight) : point.yOnlyX;
            const y = scale(point.y, yMin, yMax, plotBottom, plotTop);

            return (
              <circle
                key={point.id}
                cx={x}
                cy={y}
                r="8.5"
                className="scatter-bridge-dot"
                style={{ transition: "cx 700ms ease, cy 700ms ease, opacity 220ms ease" }}
              />
            );
          })
        : null}

      {showPrediction && showXSpread ? (
        <circle
          cx={predictionPointX}
          cy={predictionPointY}
          r="12"
          className="scatter-bridge-prediction-dot"
        />
      ) : null}

      {showXSpread
        ? Array.from({ length: Math.floor(xMax) + 1 }, (_, index) => (
            <text
              key={`x-tick-${index}`}
              x={scale(index, xMin, xMax, plotLeft, plotRight)}
              y={plotBottom + 34}
              textAnchor="middle"
              className="scatter-bridge-tick"
            >
              {index}
            </text>
          ))
        : null}

      {[70, 75, 80, 85, 90, 95, 100].map((value) => (
        <text
          key={`y-tick-${value}`}
          x={plotLeft - 22}
          y={scale(value, yMin, yMax, plotBottom, plotTop) + 6}
          textAnchor="end"
          className="scatter-bridge-tick"
        >
          {value}
        </text>
      ))}

      {showXSpread ? (
        <text x={(plotLeft + plotRight) / 2} y="712" textAnchor="middle" className="scatter-bridge-label">
          공부시간 (시간)
        </text>
      ) : null}
      <text
        x="48"
        y={(plotTop + plotBottom) / 2}
        textAnchor="middle"
        className="scatter-bridge-label"
        transform={`rotate(-90 48 ${(plotTop + plotBottom) / 2})`}
      >
        성적
      </text>
    </svg>
  );
}

function ScatterBridgeSummaryPanel({ stats }) {
  return (
    <section className="rr-step-slider regswitch-value-card scatter-bridge-panel">
      <span>요약 정보</span>
      <div className="regswitch-value-grid">
        <div>
          <small>성적 평균</small>
          <strong>{stats.yMean.toFixed(2)}점</strong>
        </div>
        <div>
          <small>성적 표준편차</small>
          <strong>{stats.yStd.toFixed(2)}점</strong>
        </div>
        <div>
          <small>공부시간 평균</small>
          <strong>{stats.xMean.toFixed(2)}시간</strong>
        </div>
        <div>
          <small>공부시간 표준편차</small>
          <strong>{stats.xStd.toFixed(2)}시간</strong>
        </div>
      </div>
    </section>
  );
}

function ScatterBridgePredictionPanel({ stats, predictionX }) {
  const predictionY = stats.intercept + stats.slope * predictionX;

  return (
    <section className="rr-step-slider regswitch-value-card scatter-bridge-panel">
      <span>예측값 위치</span>
      <div className="regswitch-value-grid">
        <div>
          <small>공부시간 X</small>
          <strong>{predictionX.toFixed(2)}시간</strong>
        </div>
        <div>
          <small>예측 성적</small>
          <strong>{predictionY.toFixed(2)}점</strong>
        </div>
      </div>
      <p>성적 = β₀ + β₁ × 공부시간</p>
      <p className="regswitch-equation-value">
        {`${predictionY.toFixed(2)} = ${stats.intercept.toFixed(2)} + ${stats.slope.toFixed(2)}×${predictionX.toFixed(2)}`}
      </p>
    </section>
  );
}

function ScatterBridgeSlopePanel({ stats }) {
  return (
    <section className="rr-step-slider regswitch-value-card scatter-bridge-panel">
      <span>회귀선의 기울기</span>
      <div className="regswitch-value-grid">
        <div>
          <small>기울기 값</small>
          <strong>{stats.slope.toFixed(2)}점</strong>
        </div>
        <div>
          <small>해석</small>
          <strong>{`공부시간 1시간 증가 시 성적은 ${stats.slope.toFixed(2)}점 증가`}</strong>
        </div>
      </div>
    </section>
  );
}

function renderMobileScatterPanel(sectionId, stats, predictionX) {
  if (sectionId === "regression") {
    return <ScatterBridgeSummaryPanel stats={stats} />;
  }

  if (sectionId === "prediction") {
    return <ScatterBridgePredictionPanel stats={stats} predictionX={predictionX} />;
  }

  return <ScatterBridgeSlopePanel stats={stats} />;
}

export default function BasicStatsScatterBridgePage() {
  const mobileFit = useMobileFitScale(820, 560);
  const [showObservations, setShowObservations] = useState(true);
  const [showXSpread, setShowXSpread] = useState(false);
  const [showXMeanLine, setShowXMeanLine] = useState(false);
  const [showYMeanLine, setShowYMeanLine] = useState(false);
  const [showRegressionLine, setShowRegressionLine] = useState(false);
  const [showPrediction, setShowPrediction] = useState(false);
  const [showSlopeArrows, setShowSlopeArrows] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [mobilePredictionProgress, setMobilePredictionProgress] = useState(56);

  const points = useMemo(() => createStudyDataset(), []);
  const stats = useMemo(() => {
    const regression = fitSimpleRegression(points);
    return {
      ...regression,
      xStd: standardDeviation(points.map((point) => point.x)),
      yStd: standardDeviation(points.map((point) => point.y)),
    };
  }, [points]);

  const xAtScore100 = (100 - stats.intercept) / stats.slope;
  const predictionX = (progressValue / 100) * xAtScore100;
  const predictionY = stats.intercept + stats.slope * predictionX;
  const mobilePredictionX = (mobilePredictionProgress / 100) * xAtScore100;

  const toggleItems = [
    {
      label: "Y 데이터",
      active: showObservations,
      kind: "dot",
      onClick: () => setShowObservations((value) => !value),
    },
    {
      label: "X 데이터",
      active: showXSpread,
      kind: "x",
      onClick: () => setShowXSpread((value) => !value),
    },
    {
      label: "X 평균선",
      active: showXMeanLine,
      kind: "mean",
      onClick: () => setShowXMeanLine((value) => !value),
    },
    {
      label: "Y 평균선",
      active: showYMeanLine,
      kind: "mean",
      onClick: () => setShowYMeanLine((value) => !value),
    },
    {
      label: "회귀선",
      active: showRegressionLine,
      kind: "line",
      onClick: () => setShowRegressionLine((value) => !value),
    },
    {
      label: "예측값",
      active: showPrediction,
      kind: "prediction",
      onClick: () => setShowPrediction((value) => !value),
    },
    {
      label: "회귀선의 기울기",
      active: showSlopeArrows,
      kind: "step",
      onClick: () => setShowSlopeArrows((value) => !value),
    },
  ];

  return (
    <main className="rr-shell regswitch-shell scatter-bridge-shell">
      <header className="rr-header">
        <div>
          <p className="eyebrow">GRAPH</p>
          <h1>단순 회귀분석</h1>
        </div>
        <div className="lab-header-action-stack">
          <Link className="secondary-button regswitch-home-button" href="/lab">
            메인으로
          </Link>
          <button
            type="button"
            className="secondary-button regswitch-home-button"
            onClick={() =>
              downloadCsv("basic-stats-1-scatter-bridge-jamovi.csv", points, [
                { label: "study_hours", value: (row) => row.x.toFixed(6) },
                { label: "score", value: (row) => row.y.toFixed(6) },
              ])
            }
          >
            CSV 다운로드
          </button>
        </div>
      </header>

      <section className="regswitch-layout">
        <article className="rr-graph-card regswitch-stage scatter-bridge-stage">
          <div className="rr-graph-head scatter-bridge-head">
            <div>
              <p className="panel-label">Graph</p>
              <h2 className="regswitch-title">단순 회귀분석</h2>
              <p className="regswitch-formula">성적 = β₀ + β₁ × 공부시간 + ε</p>
            </div>
          </div>

          <div className="scatter-bridge-display-options" role="group" aria-label="표시 옵션">
            {toggleItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className={item.active ? "active" : ""}
                onClick={item.onClick}
              >
                <span className={`scatter-bridge-toggle-mark ${item.kind}`} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="scatter-bridge-plot-wrap">
            <ScatterBridgeFigure
              points={points}
              stats={stats}
              showObservations={showObservations}
              showXSpread={showXSpread}
              showXMeanLine={showXMeanLine}
              showYMeanLine={showYMeanLine}
              showRegressionLine={showRegressionLine}
              showPrediction={showPrediction}
              showSlopeArrows={showSlopeArrows}
              progressValue={progressValue}
            />
          </div>

          <section className="regswitch-slider-card">
            <div className="regswitch-slider-head">
              <span>예측값 이동</span>
              <strong>{`${predictionY.toFixed(2)} = ${stats.intercept.toFixed(2)} + ${stats.slope.toFixed(2)}×${predictionX.toFixed(2)}`}</strong>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={progressValue}
              onChange={(event) => setProgressValue(Number(event.target.value))}
            />
          </section>
        </article>

        <aside className="regswitch-panel">
          <ScatterBridgeSummaryPanel stats={stats} />
          <ScatterBridgePredictionPanel stats={stats} predictionX={predictionX} />
        </aside>
      </section>

      <div
        ref={mobileFit.frameRef}
        className="scatter-bridge-mobile-fit-frame"
        data-ready={mobileFit.ready ? "true" : "false"}
        style={mobileFit.height ? { height: `${mobileFit.height}px` } : undefined}
      >
        <div
          ref={mobileFit.contentRef}
          className="scatter-bridge-mobile-fit-inner"
          style={{ transform: `scale(${mobileFit.scale})` }}
        >
          <section className="scatter-bridge-mobile-stack">
            {MOBILE_SCATTER_SECTIONS.map((section) => {
              const sectionProgress =
                section.id === "prediction" ? mobilePredictionProgress : section.toggles.progressValue;
              const sectionPredictionX = (sectionProgress / 100) * xAtScore100;

              return (
                <article key={section.id} className="rr-graph-card scatter-bridge-mobile-section">
                  <div className="rr-graph-head scatter-bridge-mobile-head">
                    <div>
                      <p className="panel-label">{section.groupTitle}</p>
                      <h2>{section.sectionTitle}</h2>
                    </div>
                  </div>

                  <div className="scatter-bridge-plot-wrap">
                    <ScatterBridgeFigure
                      points={points}
                      stats={stats}
                      showObservations={section.toggles.showObservations}
                      showXSpread={section.toggles.showXSpread}
                      showXMeanLine={section.toggles.showXMeanLine}
                      showYMeanLine={section.toggles.showYMeanLine}
                      showRegressionLine={section.toggles.showRegressionLine}
                      showPrediction={section.toggles.showPrediction}
                      showSlopeArrows={section.toggles.showSlopeArrows}
                      progressValue={sectionProgress}
                    />
                  </div>

                  {section.id === "prediction" ? (
                    <section className="regswitch-slider-card scatter-bridge-mobile-slider">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={mobilePredictionProgress}
                        onChange={(event) => setMobilePredictionProgress(Number(event.target.value))}
                        aria-label="예측값 이동"
                      />
                    </section>
                  ) : null}

                  {renderMobileScatterPanel(section.id, stats, sectionPredictionX)}
                </article>
              );
            })}
          </section>

          <div className="scatter-bridge-mobile-footer">
            <Link className="secondary-button" href="/lab">
              메인으로
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
