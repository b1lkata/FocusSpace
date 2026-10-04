export function shuffledSuggestions<T>(values: readonly T[], random: () => number = Math.random): T[] {
 const result = [...values];
 for (let index = result.length - 1; index > 0; index--) {
  const other = Math.floor(random() * (index + 1));
  [result[index], result[other]] = [result[other], result[index]];
 }
 // Avoid repeating the same presentation on consecutive opens.
 if (result.length > 1 && result.every((value, index) => value === values[index])) result.push(result.shift()!);
 return result;
}
