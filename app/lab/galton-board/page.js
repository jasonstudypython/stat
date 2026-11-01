"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TOP_Y = 104;
const MAX_VISIBLE_STACK_HEIGHT = 202;
const ROW_OPTIONS = [10, 20];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function binomialProbabilities(n, p) {
  const probabilities = Array(n + 1).fill(0);
  if (p <= 0) {
    probabilities[0] = 1;
    return probabilities;
  }
  if (p >= 1) {
    probabilities[n] = 1;
    return probabilities;
  }

  probabilities[0] = (1 - p) ** n;
  for (let k = 0; k < n; k += 1) {
    probabilities[k + 1] = probabilities[k] * ((n - k) / (k + 1)) * (p / (1 - p));
  }
  return probabilities;
}

function normalPdf(value, mean, std) {
  const safeStd = Math.max(std, 1e-6);
  const z = (value - mean) / safeStd;
  return Math.exp(-0.5 * z ** 2) / (safeStd * Math.sqrt(2 * Math.PI));
}

function observedStats(counts, total) {
  if (!total) return { mean: 0, std: 0 };
  const avg = counts.reduce((sum, count, k) => sum + count * k, 0) / total;
  const variance = counts.reduce((sum, count, k) => sum + count * (k - avg) ** 2, 0) / total;
  return { mean: avg, std: Math.sqrt(variance) };
}

function createBall(id, rows, p, startTime, duration) {
  let rights = 0;
  const decisions = [];
  for (let row = 0; row < rows; row += 1) {
    const right = Math.random() < p;
    if (right) rights += 1;
    decisions.push(right ? 1 : 0);
  }
  return { id, rows, decisions, result: rights, startTime, duration };
}

function boardGeometry(rows) {
  const rowGap = 24;
  const horizontalGap = 48;
  const boardWidth = Math.max(680, rows * horizontalGap + 200);
  const centerX = boardWidth / 2;
  const bottomPegY = TOP_Y + Math.max(rows - 1, 0) * rowGap;
  const stackBaseY = rows === 1 ? TOP_Y + 290 : bottomPegY + 220;
  const boardHeight = stackBaseY + 78;
  return { rowGap, horizontalGap, bottomPegY, stackBaseY, boardHeight, boardWidth, centerX };
}

function ballPosition(ball, now) {
  const { rowGap, horizontalGap, stackBaseY, centerX } = boardGeometry(ball.rows);
  const progress = clamp((now - ball.startTime) / ball.duration, 0, 1);
  const points = [{ x: centerX, y: TOP_Y - 46 }];
  let rights = 0;
  ball.decisions.forEach((decision, row) => {
    points.push({
      x: centerX + (rights - row / 2) * horizontalGap,
      y: TOP_Y + row * rowGap,
      isCollision: true,
    });
    rights += decision;
    points.push({
      x: centerX + (rights - (row + 1) / 2) * horizontalGap,
      y: TOP_Y + row * rowGap + rowGap * 0.7,
    });
  });
  points.push({
    x: centerX + (ball.result - ball.rows / 2) * horizontalGap,
    y: stackBaseY - 8,
  });

  const segmentCount = points.length - 1;
  const exactSegment = progress * segmentCount;
  const segment = Math.min(Math.floor(exactSegment), segmentCount - 1);
  const local = exactSegment - segment;
  const easedY = local ** 1.48;

  const from = points[segment];
  const to = points[segment + 1];
  const smoothX = local * local * (3 - 2 * local);
  const sway = from.isCollision ? Math.sin(local * Math.PI) * 2.4 : 0;
  return {
    x: from.x + (to.x - from.x) * smoothX + sway,
    y: from.y + (to.y - from.y) * easedY,
    progress,
  };
}

function smoothPath(points) {
  if (points.length < 2) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    path += ` Q ${current.x} ${current.y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  return `${path} T ${last.x} ${last.y}`;
}

function GaltonBoardSvg({
  mode,
  rows,
  p,
  counts,
  activeBalls,
  now,
  showBinomial,
  showNormal,
}) {
  const { rowGap, horizontalGap, bottomPegY, stackBaseY, boardHeight, boardWidth, centerX } = boardGeometry(rows);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const probabilities = useMemo(() => binomialProbabilities(rows, p), [rows, p]);
  const expectedCounts = probabilities.map((probability) => probability * Math.max(total, 1));
  const maxReferenceCount = Math.max(1, ...counts, ...expectedCounts);
  const ballRadius = rows <= 1 ? 8 : rows <= 5 ? 7 : rows <= 10 ? 5.8 : rows <= 20 ? 4.5 : 3.6;
  const columnStep = ballRadius * 1.58;
  const columns = 2;
  const maxLayers = Math.max(1, Math.ceil(maxReferenceCount / columns));
  const verticalStep = Math.min(ballRadius * 1.5, MAX_VISIBLE_STACK_HEIGHT / maxLayers);
  const outcomeX = (k) => centerX + (k - rows / 2) * horizontalGap;
  const countHeight = (count) => Math.ceil(count / columns) * verticalStep;
  const wallTopY = Math.max(bottomPegY + 22, stackBaseY - MAX_VISIBLE_STACK_HEIGHT - 10);
  const wallHalfWidth = ((columns - 1) * columnStep) / 2 + ballRadius + 1.5;
  const binCompartments = counts.map((_, k) => ({
    left: outcomeX(k) - wallHalfWidth,
    right: outcomeX(k) + wallHalfWidth,
  }));

  const pegs = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column <= row; column += 1) {
      pegs.push({
        key: `${row}-${column}`,
        row,
        x: centerX + (column - row / 2) * horizontalGap,
        y: TOP_Y + row * rowGap,
      });
    }
  }

  const stackedBalls = [];
  counts.forEach((count, k) => {
    const center = outcomeX(k);
    for (let index = 0; index < count; index += 1) {
      const layer = Math.floor(index / columns);
      const slot = index % columns;
      const alternatingOffset = layer % 2 ? columnStep * 0.28 : 0;
      const jitterSeed = Math.sin((k + 1) * 91.17 + (index + 1) * 17.31);
      const jitter = jitterSeed * ballRadius * 0.12;
      stackedBalls.push({
        key: `${k}-${index}`,
        x: center + (slot - (columns - 1) / 2) * columnStep + alternatingOffset + jitter,
        y: stackBaseY - ballRadius - layer * verticalStep - (slot % 2) * ballRadius * 0.35,
        r: ballRadius,
      });
    }
  });

  const empiricalPoints = counts.map((count, k) => ({
    x: outcomeX(k),
    y: stackBaseY - countHeight(count) - ballRadius * 1.8,
  }));
  const binomialPoints = expectedCounts.map((count, k) => ({
    x: outcomeX(k),
    y: stackBaseY - (count / maxReferenceCount) * MAX_VISIBLE_STACK_HEIGHT - ballRadius * 2.2,
  }));
  const theoreticalMean = rows * p;
  const theoreticalStd = Math.sqrt(rows * p * (1 - p));
  const normalPoints = Array.from({ length: 180 }, (_, index) => {
    const value = (rows * index) / 179;
    const expected = normalPdf(value, theoreticalMean, theoreticalStd) * Math.max(total, 1);
    return {
      x: outcomeX(value),
      y: stackBaseY - (expected / maxReferenceCount) * MAX_VISIBLE_STACK_HEIGHT - ballRadius * 2.2,
    };
  });
  const normalApproximationOk = rows * p >= 5 && rows * (1 - p) >= 5;

  return (
    <svg className="galton-board-svg" style={{ width: `${boardWidth}px` }} viewBox={`0 0 ${boardWidth} ${boardHeight}`} role="img" aria-label="갈톤보드 시뮬레이션">
      <defs>
        <radialGradient id="galtonBallFill" cx="34%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#ffd2cc" />
          <stop offset="38%" stopColor="#f58b7f" />
          <stop offset="100%" stopColor="#d9564b" />
        </radialGradient>
        <radialGradient id="galtonMovingBallFill" cx="32%" cy="26%" r="74%">
          <stop offset="0%" stopColor="#ffe7e3" />
          <stop offset="36%" stopColor="#ff665c" />
          <stop offset="100%" stopColor="#c82028" />
        </radialGradient>
        <filter id="galtonBallShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#7f1d1d" floodOpacity="0.28" />
        </filter>
      </defs>

      <rect x="18" y="18" width={boardWidth - 36} height={boardHeight - 36} rx="34" className="galton-board-backdrop" />
      <line x1="60" x2={boardWidth - 60} y1={stackBaseY} y2={stackBaseY} className="galton-stack-baseline" />

      <g className="galton-funnel" aria-hidden="true">
        <path d={`M ${centerX - 38} 28 L ${centerX - 12} 57 L ${centerX - 8} 68 L ${centerX + 8} 68 L ${centerX + 12} 57 L ${centerX + 38} 28`} />
        <line x1={centerX - 38} x2={centerX + 38} y1="28" y2="28" />
      </g>
      <circle cx={centerX} cy={TOP_Y - 46} r="7" fill="url(#galtonMovingBallFill)" filter="url(#galtonBallShadow)" className="galton-waiting-ball" />

      {pegs.map((peg) => (
        <g key={peg.key} className="galton-peg" style={{ animationDelay: `${peg.row * 24}ms` }}>
          <circle cx={peg.x} cy={peg.y} r="7.5" />
          <circle cx={peg.x - 2.2} cy={peg.y - 2.4} r="2" className="galton-peg-highlight" />
        </g>
      ))}

      {total > 0 ? <path d={`${smoothPath(empiricalPoints)} L ${empiricalPoints.at(-1).x} ${stackBaseY} L ${empiricalPoints[0].x} ${stackBaseY} Z`} className="galton-empirical-envelope" /> : null}

      {stackedBalls.map((ball) => (
        <circle key={ball.key} cx={ball.x} cy={ball.y} r={ball.r} fill="url(#galtonBallFill)" className="galton-stacked-ball" />
      ))}

      <g className="galton-bin-walls" aria-hidden="true">
        {binCompartments.map((compartment, index) => (
          <g key={index}>
            <line x1={compartment.left} x2={compartment.left} y1={wallTopY} y2={stackBaseY} className="galton-bin-wall" />
            <line x1={compartment.right} x2={compartment.right} y1={wallTopY} y2={stackBaseY} className="galton-bin-wall" />
          </g>
        ))}
        {binCompartments.slice(0, -1).map((compartment, index) => (
          <line
            key={`cap-${index}`}
            x1={compartment.right}
            x2={binCompartments[index + 1].left}
            y1={wallTopY}
            y2={wallTopY}
            className="galton-bin-wall galton-bin-cap"
          />
        ))}
      </g>

      {showBinomial && total > 0 ? (
        <>
          <path d={smoothPath(binomialPoints)} className="galton-binomial-curve" />
          {binomialPoints.map((point, k) => <circle key={k} cx={point.x} cy={point.y} r="3.6" className="galton-binomial-point" />)}
        </>
      ) : null}

      {showNormal && rows > 1 && total > 0 ? (
        <path d={smoothPath(normalPoints)} className={`galton-normal-curve${normalApproximationOk ? "" : " is-weak"}`} />
      ) : null}

      {activeBalls.map((ball) => {
        if (now < ball.startTime) return null;
        const position = ballPosition(ball, now);
        const landingScale = position.progress > 0.92 ? 1 - (position.progress - 0.92) * 3.2 : 1;
        return (
          <circle
            key={ball.id}
            cx={position.x}
            cy={position.y}
            r={7 * clamp(landingScale, 0.72, 1)}
            fill="url(#galtonMovingBallFill)"
            filter="url(#galtonBallShadow)"
            className="galton-moving-ball"
          />
        );
      })}

      {counts.map((count, k) => (
        <g key={k}>
          <line x1={outcomeX(k)} x2={outcomeX(k)} y1={stackBaseY + 2} y2={stackBaseY + 10} className="galton-bin-tick" />
          <text x={outcomeX(k)} y={stackBaseY + 29} className="galton-bin-label" textAnchor="middle">{k}</text>
          <text x={outcomeX(k)} y={stackBaseY + 50} className={`galton-count-label${count ? " has-count" : ""}`} textAnchor="middle">{count}</text>
        </g>
      ))}

      <text x="54" y="54" className="galton-board-caption">{mode === "bernoulli" ? "한 번의 베르누이 시행" : `${rows}번의 독립적인 베르누이 시행`}</text>
      <text x={boardWidth - 54} y="54" className="galton-board-caption is-right" textAnchor="end">오른쪽 확률 p={p.toFixed(2)}</text>
      {showNormal && rows > 1 && !normalApproximationOk ? (
        <text x={boardWidth - 54} y="78" className="galton-normal-warning" textAnchor="end">정규근사 조건이 충분하지 않습니다</text>
      ) : null}
    </svg>
  );
}

export default function GaltonBoardPage() {
  const [mode, setMode] = useState("binomial");
  const [selectedRows, setSelectedRows] = useState(10);
  const [p, setP] = useState(0.5);
  const [counts, setCounts] = useState(() => Array(11).fill(0));
  const [activeBalls, setActiveBalls] = useState([]);
  const [now, setNow] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showBinomial, setShowBinomial] = useState(true);
  const [showNormal, setShowNormal] = useState(true);
  const nextIdRef = useRef(1);
  const landedIdsRef = useRef(new Set());
  const rows = mode === "bernoulli" ? 1 : selectedRows;

  const reset = useCallback(() => {
    setCounts(Array(rows + 1).fill(0));
    setActiveBalls([]);
    setIsPlaying(false);
    landedIdsRef.current.clear();
    setNow(performance.now());
  }, [rows]);

  useEffect(() => {
    reset();
  }, [mode, selectedRows, p, reset]);

  const launch = useCallback((amount) => {
    const start = performance.now();
    const duration = (620 + rows * 190) / speed;
    const spacing = Math.max(32, 86 / speed);
    const nextBalls = Array.from({ length: amount }, (_, index) =>
      createBall(nextIdRef.current++, rows, p, start + index * spacing, duration),
    );
    setActiveBalls((current) => [...current, ...nextBalls]);
    setNow(start);
  }, [p, rows, speed]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = window.setInterval(() => launch(1), Math.max(80, 260 / speed));
    return () => window.clearInterval(timer);
  }, [isPlaying, launch, speed]);

  useEffect(() => {
    if (activeBalls.length === 0) return undefined;
    let frameId;
    const animate = (time) => {
      setNow(time);
      setActiveBalls((current) => {
        const finished = current.filter((ball) => time >= ball.startTime + ball.duration);
        const newlyLanded = finished.filter((ball) => !landedIdsRef.current.has(ball.id));
        if (newlyLanded.length > 0) {
          newlyLanded.forEach((ball) => landedIdsRef.current.add(ball.id));
          setCounts((currentCounts) => {
            const next = [...currentCounts];
            newlyLanded.forEach((ball) => {
              next[ball.result] = (next[ball.result] || 0) + 1;
            });
            return next;
          });
        }
        return finished.length > 0 ? current.filter((ball) => time < ball.startTime + ball.duration) : current;
      });
      frameId = window.requestAnimationFrame(animate);
    };
    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [activeBalls.length]);

  const total = counts.reduce((sum, count) => sum + count, 0);
  const stats = observedStats(counts, total);
  const theoreticalMean = rows * p;

  return (
    <main className="rr-shell galton-shell">
      <header className="rr-header galton-header">
        <div>
          <p className="eyebrow">Basic Statistics</p>
          <h1>갈톤보드 시뮬레이터</h1>
        </div>
        <Link className="secondary-button regswitch-home-button" href="/lab">메인으로</Link>
      </header>

      <section className="galton-layout">
        <div className="galton-main-column">
          <article className="galton-stage-card">
            <GaltonBoardSvg
              mode={mode}
              rows={rows}
              p={p}
              counts={counts}
              activeBalls={activeBalls}
              now={now}
              showBinomial={showBinomial}
              showNormal={showNormal}
            />
          </article>

          <section className="galton-stats-grid">
            <article><span>도착한 공</span><strong>{total.toLocaleString()}개</strong></article>
            <article><span>관측 평균</span><strong>{total ? stats.mean.toFixed(2) : "-"}</strong></article>
            <article><span>이론 평균 np</span><strong>{theoreticalMean.toFixed(2)}</strong></article>
          </section>
        </div>

        <aside className="galton-controls">
          <article className="galton-control-card">
            <span className="galton-control-label">분포 모드</span>
            <div className="galton-segmented">
              <button type="button" className={mode === "bernoulli" ? "active" : ""} onClick={() => setMode("bernoulli")}>베르누이</button>
              <button type="button" className={mode === "binomial" ? "active" : ""} onClick={() => setMode("binomial")}>이항분포</button>
            </div>
          </article>

          <article className={`galton-control-card${mode === "bernoulli" ? " is-disabled" : ""}`}>
            <span className="galton-control-label">핀 줄 수 n</span>
            <div className="galton-row-options">
              {ROW_OPTIONS.map((option) => (
                <button key={option} type="button" disabled={mode === "bernoulli"} className={selectedRows === option ? "active" : ""} onClick={() => setSelectedRows(option)}>{option}</button>
              ))}
            </div>
          </article>

          <article className="galton-control-card">
            <div className="galton-control-head"><span className="galton-control-label">오른쪽 이동 확률 p</span><strong>{p.toFixed(2)}</strong></div>
            <input type="range" min="0.05" max="0.95" step="0.05" value={p} onChange={(event) => setP(Number(event.target.value))} />
            <div className="galton-probability-presets">
              {[0.25, 0.5, 0.75].map((value) => <button key={value} type="button" className={p === value ? "active" : ""} onClick={() => setP(value)}>p={value.toFixed(2)}</button>)}
            </div>
          </article>

          <article className="galton-control-card">
            <span className="galton-control-label">공 투입</span>
            <div className="galton-launch-grid">
              <button type="button" onClick={() => launch(1)}>1개</button>
              <button type="button" onClick={() => launch(100)}>100개</button>
              <button type="button" className={isPlaying ? "active" : ""} onClick={() => setIsPlaying((value) => !value)}>{isPlaying ? "정지" : "연속"}</button>
            </div>
            <button type="button" className="galton-reset-button" onClick={reset}>초기화</button>
          </article>

          <article className="galton-control-card">
            <div className="galton-control-head"><span className="galton-control-label">애니메이션 속도</span><strong>{speed.toFixed(1)}×</strong></div>
            <input type="range" min="0.5" max="2.5" step="0.5" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
          </article>

          <article className="galton-control-card galton-display-options">
            <label><input type="checkbox" checked={showBinomial} onChange={(event) => setShowBinomial(event.target.checked)} /><span>이론적 이항분포</span></label>
            <label><input type="checkbox" checked={showNormal} disabled={rows === 1} onChange={(event) => setShowNormal(event.target.checked)} /><span>정규분포 근사곡선</span></label>
          </article>
        </aside>
      </section>
    </main>
  );
}
