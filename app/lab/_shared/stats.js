export function createSeededRandom(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function sampleNormal(random, mean = 0, std = 1) {
  const u1 = Math.max(random(), 1e-12);
  const u2 = random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * std;
}

export function linspace(start, end, count) {
  if (count <= 1) return [start];
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, index) => start + step * index);
}

export function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function standardDeviation(values, center) {
  const variance = values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function solveMatrix(matrix, vector) {
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

export function invertMatrix(matrix) {
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

export function erf(value) {
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

export function normalCdf(value) {
  return 0.5 * (1 + erf(value / Math.sqrt(2)));
}

export function formatNumber(value, digits = 3) {
  return value.toFixed(digits);
}

export function formatPValue(value) {
  if (value < 0.0005) {
    return "0.000";
  }

  return value.toFixed(3);
}
