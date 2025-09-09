// adjust threshold logic here
exports.computeThreshold=(level)=> {
  // example: level1:50, level2:100, then double; you can change formula
  if (level === 1) return 5;
  if (level === 2) return 100;
  return computeThreshold(level - 1) * 2; // or any sequence you want
}

