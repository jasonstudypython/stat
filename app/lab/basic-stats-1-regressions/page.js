"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
});

const VIEW_OPTIONS = [
  { key: "simple", label: "단순" },
  { key: "multiple", label: "다중" },
  { key: "logistic", label: "로지스틱" },
  { key: "polynomial", label: "다항" },
  { key: "poisson", label: "포아송" },
  { key: "exponential", label: "지수" },
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

function linspace(start, end, count) {
  if (count <= 1) return [start];
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, index) => start + step * index);
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / Math.max(values.length - 1, 1);
  return Math.sqrt(variance);
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function fitLinearRegression(xValues, yValues) {
  const n = xValues.length;
  const sumX = xValues.reduce((sum, value) => sum + value, 0);
  const sumY = yValues.reduce((sum, value) => sum + value, 0);
  const sumXX = xValues.reduce((sum, value) => sum + value * value, 0);
  const sumXY = xValues.reduce((sum, value, index) => sum + value * yValues[index], 0);
  const coefficients = solveLinearSystem(
    [
      [n, sumX],
      [sumX, sumXX],
    ],
    [sumY, sumXY],
  );

  return {
    intercept: coefficients[0],
    slope: coefficients[1],
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

    if (Math.abs(augmented[maxRow][pivotIndex]) < 1e-12) return null;
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

function fitBinaryLogistic(xValues, yValues, iterations = 25) {
  const xMean = mean(xValues);
  const xStd = Math.max(standardDeviation(xValues), 1e-6);
  const normalizedX = xValues.map((value) => (value - xMean) / xStd);
  let intercept = 0;
  let slope = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let h00 = 0;
    let h01 = 0;
    let h11 = 0;
    let g0 = 0;
    let g1 = 0;

    for (let index = 0; index < normalizedX.length; index += 1) {
      const x = normalizedX[index];
      const y = yValues[index];
      const probability = Math.min(Math.max(sigmoid(intercept + slope * x), 1e-6), 1 - 1e-6);
      const weight = probability * (1 - probability);
      const residual = y - probability;

      g0 += residual;
      g1 += residual * x;
      h00 += weight;
      h01 += weight * x;
      h11 += weight * x * x;
    }

    const delta = solveLinearSystem(
      [
        [h00, h01],
        [h01, h11],
      ],
      [g0, g1],
    );

    if (!delta) break;
    intercept += delta[0];
    slope += delta[1];
  }

  return {
    intercept: intercept - (slope * xMean) / xStd,
    slope: slope / xStd,
  };
}

function fitPoissonRegression(xValues, yValues, iterations = 30) {
  let intercept = Math.log(Math.max(mean(yValues), 1e-6));
  let slope = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let h00 = 0;
    let h01 = 0;
    let h11 = 0;
    let g0 = 0;
    let g1 = 0;

    for (let index = 0; index < xValues.length; index += 1) {
      const x = xValues[index];
      const y = yValues[index];
      const mu = Math.max(Math.exp(intercept + slope * x), 1e-6);
      const residual = y - mu;

      g0 += residual;
      g1 += residual * x;
      h00 += mu;
      h01 += mu * x;
      h11 += mu * x * x;
    }

    const delta = solveLinearSystem(
      [
        [h00, h01],
        [h01, h11],
      ],
      [g0, g1],
    );

    if (!delta) break;
    intercept += delta[0];
    slope += delta[1];
  }

  return { intercept, slope };
}

function samplePoisson(random, lambda) {
  const limit = Math.exp(-lambda);
  let product = 1;
  let count = 0;
  while (product > limit) {
    count += 1;
    product *= Math.max(random(), 1e-12);
  }
  return count - 1;
}

function buildScenes() {
  const random = createSeededRandom(42);

  const simpleSample = Array.from({ length: 30 }, () => {
    const value = Math.min(Math.max(sampleNormal(random, 3, 1), 0), 5);
    return value;
  });
  const simpleY = simpleSample.map((value) => value * 0.5 + 2);
  const simpleErrors = Array.from({ length: 30 }, () => sampleNormal(random, 0, 0.5));
  const simpleObserved = simpleY.map((value, index) => value + simpleErrors[index]);
  const simpleLineX = linspace(0, 5, 120);
  const simpleLineY = simpleLineX.map((x) => 0.5 * x + 2);

  const multiX1 = Array.from({ length: 30 }, () => sampleNormal(random, 10, 2));
  const multiX2 = Array.from({ length: 30 }, () => sampleNormal(random, 20, 3));
  const multiY = multiX1.map(
    (x1, index) => 2 * x1 + 3 * multiX2[index] + 5 + sampleNormal(random, 0, 5),
  );
  const multiCoefficients = solveLinearSystem(
    [
      [30, multiX1.reduce((a, b) => a + b, 0), multiX2.reduce((a, b) => a + b, 0)],
      [
        multiX1.reduce((a, b) => a + b, 0),
        multiX1.reduce((sum, value) => sum + value * value, 0),
        multiX1.reduce((sum, value, index) => sum + value * multiX2[index], 0),
      ],
      [
        multiX2.reduce((a, b) => a + b, 0),
        multiX1.reduce((sum, value, index) => sum + value * multiX2[index], 0),
        multiX2.reduce((sum, value) => sum + value * value, 0),
      ],
    ],
    [
      multiY.reduce((a, b) => a + b, 0),
      multiX1.reduce((sum, value, index) => sum + value * multiY[index], 0),
      multiX2.reduce((sum, value, index) => sum + value * multiY[index], 0),
    ],
  );
  const multiIntercept = multiCoefficients[0];
  const multiB1 = multiCoefficients[1];
  const multiB2 = multiCoefficients[2];
  const multiPredictions = multiX1.map(
    (x1, index) => multiIntercept + multiB1 * x1 + multiB2 * multiX2[index],
  );
  const multiX1Grid = linspace(Math.min(...multiX1), Math.max(...multiX1), 30);
  const multiX2Grid = linspace(Math.min(...multiX2), Math.max(...multiX2), 30);
  const multiSurface = multiX2Grid.map((x2) =>
    multiX1Grid.map((x1) => multiIntercept + multiB1 * x1 + multiB2 * x2),
  );
  const x2Mean = mean(multiX2);
  const multiGuideX = multiX1Grid;
  const multiGuideY = multiGuideX.map(() => x2Mean);
  const multiGuideZ = multiGuideX.map((x1) => multiIntercept + multiB1 * x1 + multiB2 * x2Mean);

  const logisticPositive = Array.from({ length: 150 }, () => sampleNormal(random, 38, 0.6));
  const logisticNegative = Array.from({ length: 150 }, () => sampleNormal(random, 36.5, 0.6));
  const logisticX = [...logisticPositive, ...logisticNegative];
  const logisticY = [...Array(150).fill(1), ...Array(150).fill(0)];
  const logisticFit = fitBinaryLogistic(logisticX, logisticY);
  const logisticCurveX = linspace(Math.min(...logisticX), Math.max(...logisticX), 300);
  const logisticCurveY = logisticCurveX.map((x) => sigmoid(logisticFit.intercept + logisticFit.slope * x));
  const logisticCurveLogit = logisticCurveY.map((p) => Math.log(p / (1 - p)));
  const logisticAdjusted = logisticY.map((value) => (value === 1 ? 0.99 : 0.01));
  const logisticPointLogit = logisticAdjusted.map((p) => Math.log(p / (1 - p)));

  const commonX = linspace(0, 10, 80);
  const polyObserved = commonX.map(
    (x) => 0.5 * x * x - 1.2 * x + 2 + sampleNormal(random, 0, 6),
  );
  const polyCoefficients = solveLinearSystem(
    [
      [80, commonX.reduce((a, b) => a + b, 0), commonX.reduce((sum, x) => sum + x * x, 0)],
      [
        commonX.reduce((a, b) => a + b, 0),
        commonX.reduce((sum, x) => sum + x * x, 0),
        commonX.reduce((sum, x) => sum + x * x * x, 0),
      ],
      [
        commonX.reduce((sum, x) => sum + x * x, 0),
        commonX.reduce((sum, x) => sum + x * x * x, 0),
        commonX.reduce((sum, x) => sum + x * x * x * x, 0),
      ],
    ],
    [
      polyObserved.reduce((a, b) => a + b, 0),
      polyObserved.reduce((sum, y, index) => sum + commonX[index] * y, 0),
      polyObserved.reduce((sum, y, index) => sum + commonX[index] * commonX[index] * y, 0),
    ],
  );
  const smoothX = linspace(0, 10, 300);
  const polyFitY = smoothX.map(
    (x) => polyCoefficients[0] + polyCoefficients[1] * x + polyCoefficients[2] * x * x,
  );

  const poissonLambda = commonX.map((x) => Math.exp(0.6 + 0.25 * x));
  const poissonObserved = poissonLambda.map((lambda) => samplePoisson(random, lambda));
  const poissonFit = fitPoissonRegression(commonX, poissonObserved);
  const poissonFitY = smoothX.map((x) => Math.exp(poissonFit.intercept + poissonFit.slope * x));

  const expObserved = commonX.map((x) => {
    const trueValue = 2 * Math.exp(0.3 * x);
    return Math.max(trueValue * (1 + 0.15 * sampleNormal(random, 0, 1)), 0.05);
  });
  const expLogY = expObserved.map((value) => Math.log(value));
  const expFit = solveLinearSystem(
    [
      [80, commonX.reduce((a, b) => a + b, 0)],
      [commonX.reduce((a, b) => a + b, 0), commonX.reduce((sum, x) => sum + x * x, 0)],
    ],
    [
      expLogY.reduce((a, b) => a + b, 0),
      expLogY.reduce((sum, y, index) => sum + commonX[index] * y, 0),
    ],
  );
  const expA = Math.exp(expFit[0]);
  const expB = expFit[1];
  const expFitY = smoothX.map((x) => expA * Math.exp(expB * x));

  return {
    simple: {
      title: "단순회귀분석",
      description: "관측값과 이론 회귀선, 그리고 오차선을 같이 보여주는 기본 예시입니다.",
      formula: "y = β₀ + β₁x + ε",
      dimension: "2d",
      sliderLabel: "예측값 이동",
      xDomain: [0, 5],
      yDomain: [0, 5],
      pointAt(progress) {
        const x = progress * 5;
        const y = 0.5 * x + 2;
        return {
          x,
          y,
          cards: [
            { label: "X", value: x.toFixed(2) },
            { label: "예측 Y", value: y.toFixed(2) },
          ],
          equationValue: `${y.toFixed(2)} = 2.00 + 0.50×${x.toFixed(2)} + 0`,
        };
      },
      plot(progress) {
        const highlight = this.pointAt(progress);
        return {
          data: [
            {
              type: "scatter",
              mode: "markers",
              x: simpleSample,
              y: simpleObserved,
              name: "관측값",
              marker: { color: "salmon", size: 11, opacity: 0.84 },
            },
            {
              type: "scatter",
              mode: "lines",
              x: simpleLineX,
              y: simpleLineY,
              name: "회귀선",
              line: { color: "cornflowerblue", width: 4 },
              visible: "legendonly",
            },
            {
              type: "scatter",
              mode: "lines",
              x: simpleSample.flatMap((x, index) => [x, x, null]),
              y: simpleY.flatMap((y, index) => [y, simpleObserved[index], null]),
              name: "오차",
              line: { color: "gray", width: 1.8, dash: "dash" },
              hoverinfo: "skip",
              visible: "legendonly",
            },
            {
              type: "scatter",
              mode: "markers",
              x: [highlight.x],
              y: [highlight.y],
              name: "예측값",
              marker: { color: "#ef4444", size: 16 },
              visible: "legendonly",
            },
          ],
          layout: {
            xaxis: {
              title: { text: "X", standoff: 18 },
              range: [0, 5],
              automargin: true,
              scaleanchor: "y",
              scaleratio: 1,
            },
            yaxis: {
              title: { text: "Y", standoff: 16 },
              range: [0, 5],
              automargin: true,
            },
          },
          currentPoint: highlight,
        };
      },
    },
    multiple: {
      title: "독립변수가 2개인 다중회귀분석",
      description: "3D 산점도 위에 회귀평면을 얹고, x2 평균 단면선을 따라 빨간 점이 이동합니다.",
      formula: "y = β₀ + β₁x1 + β₂x2 + ε",
      coefficients: {
        intercept: multiIntercept,
        b1: multiB1,
        b2: multiB2,
      },
      coefficientsText: {
        intercept: multiIntercept.toFixed(2),
        b1: multiB1.toFixed(2),
        b2: multiB2.toFixed(2),
      },
      dimension: "3d",
      sliderLabel: "예측값 이동",
      pointAt(progress) {
        const index = Math.round(progress * (multiGuideX.length - 1));
        return {
          x: multiGuideX[index],
          y: multiGuideY[index],
          z: multiGuideZ[index],
          cards: [
            { label: "X1", value: multiGuideX[index].toFixed(2) },
            { label: "X2", value: multiGuideY[index].toFixed(2) },
            { label: "예측 y", value: multiGuideZ[index].toFixed(2) },
          ],
          equationValue: `${multiGuideZ[index].toFixed(2)} = ${multiIntercept.toFixed(2)} + ${multiB1.toFixed(2)}×${multiGuideX[index].toFixed(2)} + ${multiB2.toFixed(2)}×${multiGuideY[index].toFixed(2)} + 0`,
        };
      },
      plot(progress) {
        const highlight = this.pointAt(progress);
        return {
          data: [
            {
              type: "scatter3d",
              mode: "markers",
              x: multiX1,
              y: multiX2,
              z: multiY,
              name: "관측값",
              marker: { color: "salmon", size: 4, opacity: 0.82 },
            },
              {
                type: "surface",
                x: multiX1Grid,
                y: multiX2Grid,
                z: multiSurface,
                opacity: 0.34,
                showscale: false,
                colorscale: "Blues",
                name: "회귀평면",
                showlegend: true,
                visible: "legendonly",
              },
              {
                type: "scatter3d",
                mode: "lines",
              x: multiX1.flatMap((x1, index) => [x1, x1, null]),
              y: multiX2.flatMap((x2) => [x2, x2, null]),
              z: multiY.flatMap((y, index) => [y, multiPredictions[index], null]),
              name: "오차",
              line: { color: "gray", width: 2 },
              hoverinfo: "skip",
              visible: "legendonly",
            },
              {
                type: "scatter3d",
                mode: "markers",
                x: [highlight.x],
                y: [highlight.y],
                z: [highlight.z],
                name: "예측값",
                marker: { color: "#ef4444", size: 7 },
                visible: "legendonly",
              },
            ],
            layout: {
              scene: {
                xaxis: { title: { text: "X1" } },
                yaxis: { title: { text: "X2" } },
                zaxis: { title: { text: "y" } },
                aspectmode: "cube",
                camera: { eye: { x: 1.7, y: -1.95, z: 0.9 } },
              },
            },
          currentPoint: highlight,
        };
      },
    },
    logistic: {
      title: "로지스틱 회귀",
      description: "왼쪽은 logit 직선, 오른쪽은 확률 곡선입니다. 같은 x 위치를 빨간 점으로 같이 보여줍니다.",
      formula: "P(Y=1|X) = 1 / (1 + e^-(β₀ + β₁x))",
      dimension: "subplot",
      sliderLabel: "예측값 이동",
      pointAt(progress) {
        const x = logisticCurveX[0] + progress * (logisticCurveX.at(-1) - logisticCurveX[0]);
        const probability = sigmoid(logisticFit.intercept + logisticFit.slope * x);
        const logit = Math.log(probability / (1 - probability));
        return {
          x,
          probability,
          logit,
          cards: [
            { label: "체온 X", value: x.toFixed(2) },
            { label: "logit", value: logit.toFixed(2) },
            { label: "양성 확률", value: probability.toFixed(3) },
          ],
          equationValue: `${probability.toFixed(3)} = 1 / (1 + e^-(${logisticFit.intercept.toFixed(2)} + ${logisticFit.slope.toFixed(2)}×${x.toFixed(2)}))`,
        };
      },
      plot(progress) {
        const highlight = this.pointAt(progress);
        return {
          data: [
            {
              type: "scatter",
              mode: "markers",
              x: logisticX,
              y: logisticPointLogit,
              xaxis: "x",
              yaxis: "y",
              name: "관측값 (logit)",
              marker: { color: "salmon", size: 8, opacity: 0.28 },
            },
            {
              type: "scatter",
              mode: "lines",
              x: logisticCurveX,
              y: logisticCurveLogit,
              xaxis: "x",
              yaxis: "y",
              name: "logit 직선",
              line: { color: "cornflowerblue", width: 4 },
              visible: "legendonly",
            },
            {
              type: "scatter",
              mode: "markers",
              x: [highlight.x],
              y: [highlight.logit],
              xaxis: "x",
              yaxis: "y",
              name: "예측값",
              marker: { color: "#ef4444", size: 14 },
              visible: "legendonly",
            },
            {
              type: "scatter",
              mode: "markers",
              x: logisticX,
              y: logisticY,
              xaxis: "x2",
              yaxis: "y2",
              name: "관측값",
              marker: { color: "salmon", size: 8, opacity: 0.3 },
              showlegend: false,
            },
            {
              type: "scatter",
              mode: "lines",
              x: logisticCurveX,
              y: logisticCurveY,
              xaxis: "x2",
              yaxis: "y2",
              name: "로지스틱 곡선",
              line: { color: "cornflowerblue", width: 4 },
              showlegend: false,
              visible: "legendonly",
            },
            {
              type: "scatter",
              mode: "markers",
              x: [highlight.x],
              y: [highlight.probability],
              xaxis: "x2",
              yaxis: "y2",
              name: "예측값",
              marker: { color: "#ef4444", size: 14 },
              showlegend: false,
              visible: "legendonly",
            },
          ],
          layout: {
            xaxis: {
              domain: [0, 0.47],
              title: { text: "체온", standoff: 18 },
              range: [34, 40],
              automargin: true,
              scaleanchor: "y",
              scaleratio: 1,
            },
            yaxis: {
              title: { text: "logit(P)", standoff: 16 },
              range: [-6, 6],
              automargin: true,
            },
            xaxis2: {
              domain: [0.54, 1],
              title: { text: "체온", standoff: 18 },
              range: [34, 40],
              automargin: true,
              scaleanchor: "y2",
              scaleratio: 1,
            },
            yaxis2: {
              title: { text: "양성 확률", standoff: 16 },
              range: [-0.15, 1.15],
              automargin: true,
            },
            annotations: [
              { text: "logit 함수", x: 0.22, y: 1.08, xref: "paper", yref: "paper", showarrow: false },
              { text: "로지스틱 함수", x: 0.78, y: 1.08, xref: "paper", yref: "paper", showarrow: false },
            ],
          },
          currentPoint: highlight,
        };
      },
    },
    polynomial: {
      title: "다항회귀분석 (2차)",
      description: "2차 곡선이 데이터 흐름을 어떻게 따라가는지 보여주는 예시입니다.",
      formula: "y = β₀ + β₁x + β₂x² + ε",
      dimension: "2d",
      sliderLabel: "예측값 이동",
      pointAt(progress) {
        const x = smoothX[0] + progress * (smoothX.at(-1) - smoothX[0]);
        const y = polyCoefficients[0] + polyCoefficients[1] * x + polyCoefficients[2] * x * x;
        return {
          x,
          y,
          cards: [
            { label: "x", value: x.toFixed(2) },
            { label: "예측 y", value: y.toFixed(2) },
          ],
          equationValue: `${y.toFixed(2)} = ${polyCoefficients[0].toFixed(2)} + ${polyCoefficients[1].toFixed(2)}×${x.toFixed(2)} + ${polyCoefficients[2].toFixed(2)}×${x.toFixed(2)}² + 0`,
        };
      },
      plot(progress) {
        const highlight = this.pointAt(progress);
        return {
          data: [
            {
              type: "scatter",
              mode: "markers",
              x: commonX,
              y: polyObserved,
              name: "관측값",
              marker: { color: "salmon", size: 9, opacity: 0.78 },
            },
            {
              type: "scatter",
              mode: "lines",
              x: smoothX,
              y: polyFitY,
              name: "다항 회귀곡선",
              line: { color: "cornflowerblue", width: 4 },
              visible: "legendonly",
            },
            {
              type: "scatter",
              mode: "markers",
              x: [highlight.x],
              y: [highlight.y],
              name: "예측값",
              marker: { color: "#ef4444", size: 16 },
              visible: "legendonly",
            },
          ],
          layout: {
            xaxis: {
              title: { text: "x", standoff: 18 },
              range: [0, 10],
              automargin: true,
              scaleanchor: "y",
              scaleratio: 1,
            },
            yaxis: {
              title: { text: "y", standoff: 16 },
              automargin: true,
            },
          },
          currentPoint: highlight,
        };
      },
    },
    poisson: {
      title: "포아송회귀분석",
      description: "카운트 데이터에 맞춘 GLM 곡선을 따라 빨간 점이 이동합니다.",
      formula: "log(λ) = β₀ + β₁x",
      dimension: "2d",
      sliderLabel: "예측값 이동",
      pointAt(progress) {
        const x = smoothX[0] + progress * (smoothX.at(-1) - smoothX[0]);
        const y = Math.exp(poissonFit.intercept + poissonFit.slope * x);
        return {
          x,
          y,
          cards: [
            { label: "x", value: x.toFixed(2) },
            { label: "예측 λ", value: y.toFixed(2) },
          ],
          equationValue: `${y.toFixed(2)} = exp(${poissonFit.intercept.toFixed(2)} + ${poissonFit.slope.toFixed(2)}×${x.toFixed(2)})`,
        };
      },
      plot(progress) {
        const highlight = this.pointAt(progress);
        return {
          data: [
            {
              type: "scatter",
              mode: "markers",
              x: commonX,
              y: poissonObserved,
              name: "관측값",
              marker: { color: "salmon", size: 9, opacity: 0.8 },
            },
            {
              type: "scatter",
              mode: "lines",
              x: smoothX,
              y: poissonFitY,
              name: "포아송 회귀곡선",
              line: { color: "cornflowerblue", width: 4 },
              visible: "legendonly",
            },
            {
              type: "scatter",
              mode: "markers",
              x: [highlight.x],
              y: [highlight.y],
              name: "예측값",
              marker: { color: "#ef4444", size: 16 },
              visible: "legendonly",
            },
          ],
          layout: {
            xaxis: {
              title: { text: "x", standoff: 18 },
              range: [0, 10],
              automargin: true,
              scaleanchor: "y",
              scaleratio: 1,
            },
            yaxis: {
              title: { text: "count", standoff: 16 },
              automargin: true,
            },
          },
          currentPoint: highlight,
        };
      },
    },
    exponential: {
      title: "지수회귀분석",
      description: "지수적으로 커지는 패턴 위를 따라 빨간 점이 이동합니다.",
      formula: "y = aeᵇˣ",
      dimension: "2d",
      sliderLabel: "예측값 이동",
      pointAt(progress) {
        const x = smoothX[0] + progress * (smoothX.at(-1) - smoothX[0]);
        const y = expA * Math.exp(expB * x);
        return {
          x,
          y,
          cards: [
            { label: "x", value: x.toFixed(2) },
            { label: "예측 y", value: y.toFixed(2) },
          ],
          equationValue: `${y.toFixed(2)} = ${expA.toFixed(2)}e^(${expB.toFixed(2)}×${x.toFixed(2)})`,
        };
      },
      plot(progress) {
        const highlight = this.pointAt(progress);
        return {
          data: [
            {
              type: "scatter",
              mode: "markers",
              x: commonX,
              y: expObserved,
              name: "관측값",
              marker: { color: "salmon", size: 9, opacity: 0.8 },
            },
            {
              type: "scatter",
              mode: "lines",
              x: smoothX,
              y: expFitY,
              name: "지수 회귀곡선",
              line: { color: "cornflowerblue", width: 4 },
              visible: "legendonly",
            },
            {
              type: "scatter",
              mode: "markers",
              x: [highlight.x],
              y: [highlight.y],
              name: "예측값",
              marker: { color: "#ef4444", size: 16 },
              visible: "legendonly",
            },
          ],
          layout: {
            xaxis: {
              title: { text: "x", standoff: 18 },
              range: [0, 10],
              automargin: true,
              scaleanchor: "y",
              scaleratio: 1,
            },
            yaxis: {
              title: { text: "y", standoff: 16 },
              automargin: true,
            },
          },
          currentPoint: highlight,
        };
      },
    },
  };
}

function buildStandaloneLogisticScene() {
  const random = createSeededRandom(42);
  const logisticPositive = Array.from({ length: 150 }, () => sampleNormal(random, 38, 0.6));
  const logisticNegative = Array.from({ length: 150 }, () => sampleNormal(random, 36.5, 0.6));
  const logisticX = [...logisticPositive, ...logisticNegative];
  const logisticY = [...Array(150).fill(1), ...Array(150).fill(0)];
  const logisticFit = fitBinaryLogistic(logisticX, logisticY);
  const linearFit = fitLinearRegression(logisticX, logisticY);
  const logisticCurveX = linspace(Math.min(...logisticX), Math.max(...logisticX), 300);
  const logisticCurveY = logisticCurveX.map((x) => sigmoid(logisticFit.intercept + logisticFit.slope * x));
  const linearCurveY = logisticCurveX.map((x) => linearFit.intercept + linearFit.slope * x);

  return {
    title: "로지스틱 회귀분석",
    description: "같은 데이터에서 선형 예측선과 로지스틱 함수를 적용한 곡선을 비교하는 예시입니다.",
    formula: "P(Y=1|X) = 1 / (1 + e^-(β₀ + β₁x))",
    dimension: "2d",
    sliderLabel: "예측값 이동",
    pointAt(progress, logisticApplied = false) {
      const x = logisticCurveX[0] + progress * (logisticCurveX.at(-1) - logisticCurveX[0]);
      const probability = sigmoid(logisticFit.intercept + logisticFit.slope * x);
      const linear = linearFit.intercept + linearFit.slope * x;
      const y = logisticApplied ? probability : linear;
      return {
        x,
        y,
        probability,
        linear,
        cards: [
          { label: "체온 X", value: x.toFixed(2) },
          {
            label: logisticApplied ? "양성 확률" : "선형 예측값",
            value: y.toFixed(logisticApplied ? 3 : 2),
          },
        ],
        equationValue: logisticApplied
          ? `${probability.toFixed(3)} = 1 / (1 + e^-(${logisticFit.intercept.toFixed(2)} + ${logisticFit.slope.toFixed(2)}×${x.toFixed(2)}))`
          : `${linear.toFixed(2)} = ${linearFit.intercept.toFixed(2)} + ${linearFit.slope.toFixed(2)}×${x.toFixed(2)}`,
      };
    },
    plot(progress, logisticApplied = false) {
      const highlight = this.pointAt(progress, logisticApplied);
      return {
        data: [
          {
            type: "scatter",
            mode: "markers",
            x: logisticX,
            y: logisticY,
            name: "관측값",
            marker: { color: "salmon", size: 8, opacity: 0.35 },
          },
          {
            type: "scatter",
            mode: "lines",
            x: logisticCurveX,
            y: logisticApplied ? logisticCurveY : linearCurveY,
            name: "회귀선",
            line: { color: "cornflowerblue", width: 4 },
            visible: "legendonly",
          },
          {
            type: "scatter",
            mode: "markers",
            x: [highlight.x],
            y: [highlight.y],
            name: "예측값",
            marker: { color: "#ef4444", size: 14 },
            visible: "legendonly",
          },
          {
            type: "scatter",
            mode: "markers",
            x: [logisticCurveX.at(-1)],
            y: [1.05],
            name: "로지스틱 함수 적용",
            marker: { size: 10, color: "rgba(0,0,0,0)" },
            hoverinfo: "skip",
            visible: logisticApplied ? true : "legendonly",
          },
        ],
        layout: {
          xaxis: {
            title: { text: "체온", standoff: 18 },
            range: [34, 40],
            automargin: true,
          },
          yaxis: {
            title: {
              text: logisticApplied ? "코로나 검사 양성 확률" : "선형 예측값",
              standoff: 16,
            },
            range: [-0.15, 1.15],
            automargin: true,
          },
        },
        currentPoint: highlight,
      };
    },
  };
}

export default function BasicStatsRegressionPage() {
  const scenes = useMemo(() => {
    const baseScenes = buildScenes();
    return {
      ...baseScenes,
      logistic: buildStandaloneLogisticScene(),
    };
  }, []);
  const [viewKey, setViewKey] = useState("simple");
  const [progressValue, setProgressValue] = useState(0);
  const [traceVisibility, setTraceVisibility] = useState({});
  const [hoveredPrediction, setHoveredPrediction] = useState(null);
  const [logisticApplied, setLogisticApplied] = useState(false);
  const plotRevision = useRef(0);

  const activeScene = scenes[viewKey];
  const progress = progressValue / 100;
  const basePlot =
    viewKey === "logistic" ? activeScene.plot(progress, logisticApplied) : activeScene.plot(progress);
  const visibilityForView = traceVisibility[viewKey] || {};
  const plot = {
    ...basePlot,
    data: basePlot.data.map((trace, index) => {
      const nextVisible = visibilityForView[index];
      return {
        ...trace,
        visible: nextVisible ?? trace.visible,
      };
    }),
  };
  const currentPoint =
    viewKey === "multiple" && hoveredPrediction ? hoveredPrediction : plot.currentPoint;

  if (viewKey === "multiple") {
    const predictionTraceIndex = plot.data.length - 1;
    plot.data[predictionTraceIndex] = {
      ...plot.data[predictionTraceIndex],
      x: [currentPoint.x],
      y: [currentPoint.y],
      z: [currentPoint.z],
    };
  }

  const setTraceVisibilityForView = (index, visible) => {
    setTraceVisibility((current) => ({
      ...current,
      [viewKey]: {
        ...(current[viewKey] || {}),
        [index]: visible,
      },
    }));
  };

  return (
    <main className="rr-shell regswitch-shell">
      <header className="rr-header">
        <div>
          <p className="eyebrow">Basic Statistics 1</p>
          <h1>회귀분석의 종류</h1>
        </div>
        <Link className="secondary-button regswitch-home-button" href="/lab">
          메인으로
        </Link>
      </header>

      <section className="regswitch-layout">
        <article className="rr-graph-card regswitch-stage">
            <div className="rr-graph-head">
              <div>
                <p className="panel-label">Graph</p>
                <h2 className="regswitch-title">{activeScene.title}</h2>
                <p className="regswitch-formula">{activeScene.formula}</p>
              </div>
            </div>

            <div
              className={`regswitch-plot-wrap ${
              activeScene.dimension === "subplot" ? "is-subplot" : ""
            }`}
          >
            <Plot
              data={plot.data}
              layout={{
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: "rgba(0,0,0,0)",
                margin: { l: 88, r: 28, t: 24, b: 84 },
                autosize: true,
                font: { family: "Pretendard, Noto Sans KR, sans-serif", color: "#112d4e", size: 16 },
                uirevision: `${viewKey}-legend-lock`,
                legend: {
                  orientation: "h",
                  yanchor: "bottom",
                  y: 1.02,
                  xanchor: "left",
                  x: 0,
                },
                ...plot.layout,
              }}
              config={{
                responsive: true,
                displaylogo: false,
                modeBarButtonsToRemove: ["lasso2d", "select2d"],
              }}
                revision={plotRevision.current}
                style={{ width: "100%", height: "100%" }}
                onHover={(event) => {
                  if (viewKey !== "multiple") return;
                  const point = event?.points?.[0];
                  if (!point) return;
                  const x = Number(point.x);
                  const y = Number(point.y);
                  if (![x, y].every(Number.isFinite)) return;
                  const z =
                    scenes.multiple.coefficients.intercept +
                    scenes.multiple.coefficients.b1 * x +
                    scenes.multiple.coefficients.b2 * y;
                  setHoveredPrediction({
                    x,
                    y,
                    z,
                    cards: [
                      { label: "X1", value: x.toFixed(2) },
                      { label: "X2", value: y.toFixed(2) },
                      { label: "예측 y", value: z.toFixed(2) },
                    ],
                    equationValue: `${z.toFixed(2)} = ${scenes.multiple.coefficientsText.intercept} + ${scenes.multiple.coefficientsText.b1}×${x.toFixed(2)} + ${scenes.multiple.coefficientsText.b2}×${y.toFixed(2)} + 0`,
                  });
                }}
                onUnhover={() => {
                  if (viewKey === "multiple") {
                    setHoveredPrediction(null);
                  }
                }}
                onLegendClick={(event) => {
                  const traceIndex = event.curveNumber;
                  if (viewKey === "logistic" && traceIndex === 3) {
                    setLogisticApplied((current) => !current);
                    return false;
                  }
                  const currentVisible = plot.data[traceIndex]?.visible;
                  const nextVisible =
                    currentVisible === "legendonly" ? true : "legendonly";
                setTraceVisibilityForView(traceIndex, nextVisible);
                return false;
              }}
              onLegendDoubleClick={() => false}
            />
          </div>

            <section className="regswitch-slider-card">
              <div className="regswitch-slider-head">
                <span>{activeScene.sliderLabel}</span>
                <strong>{currentPoint.equationValue.split(" = ").at(-1)}</strong>
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
            <section className="rr-step-slider">
              <span>회귀분석 전환</span>
              <div className="regswitch-buttons">
                {VIEW_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={viewKey === option.key ? "active" : ""}
                    onClick={() => {
                      setHoveredPrediction(null);
                      setLogisticApplied(false);
                      setViewKey(option.key);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="rr-step-slider regswitch-value-card">
              <span>예측값 위치</span>
              <div className="regswitch-value-grid">
                {currentPoint.cards.map((item) => (
                  <div key={item.label}>
                    <small>{item.label}</small>
                    <strong>{item.value}</strong>
                </div>
              ))}
              </div>
              <p>{activeScene.formula}</p>
              <p className="regswitch-equation-value">{currentPoint.equationValue}</p>
            </section>
        </aside>
      </section>
    </main>
  );
}
