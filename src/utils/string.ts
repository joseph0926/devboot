function stringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  const longerLength = longer.length;

  if (longerLength === 0) {
    return 1.0;
  }

  const editDistance = editDistanceSimple(longer, shorter);
  return (longerLength - editDistance) / longerLength;
}

function editDistanceSimple(str1: string, str2: string): number {
  if (str1 === str2) return 0;
  if (str1.length === 0) return str2.length;
  if (str2.length === 0) return str1.length;

  let distance = 0;
  const len = Math.max(str1.length, str2.length);

  for (let i = 0; i < len; i++) {
    if (str1[i] !== str2[i]) {
      distance++;
    }
  }

  distance += Math.abs(str1.length - str2.length);

  return distance;
}

export function findSimilar(
  target: string,
  candidates: string[],
  maxResults: number = 3
): string[] {
  if (candidates.length === 0) return [];

  const normalizedTarget = target.toLowerCase().replace(/-/g, "");

  const scored = candidates.map((candidate) => {
    const normalizedCandidate = candidate.toLowerCase().replace(/-/g, "");
    let score = 0;

    if (normalizedCandidate === normalizedTarget) {
      score = 100;
    } else if (normalizedCandidate.startsWith(normalizedTarget)) {
      score = 90 - (normalizedCandidate.length - normalizedTarget.length);
    } else if (candidate.includes("-")) {
      const abbreviation = candidate
        .split("-")
        .map((part) => part[0] || "")
        .join("")
        .toLowerCase();

      if (abbreviation === normalizedTarget) {
        score = 80;
      }
    } else if (normalizedCandidate.includes(normalizedTarget)) {
      score = 70 - (normalizedCandidate.length - normalizedTarget.length);
    } else {
      const similarity = stringSimilarity(
        normalizedTarget,
        normalizedCandidate
      );
      if (similarity > 0.6) {
        score = similarity * 60;
      }
    }

    return { candidate, score };
  });

  return scored
    .filter((item) => item.score > 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((item) => item.candidate);
}
