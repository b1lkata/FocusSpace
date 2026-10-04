export type RepeatMode = 'off' | 'all' | 'one';
export function nextRepeat(value:RepeatMode):RepeatMode { return value==='off'?'all':value==='all'?'one':'off'; }
export function shuffledUpcoming<T>(queue:readonly T[], current:number, random= Math.random) { const result=[...queue];for(let index=result.length-1;index>current+1;index--){const other=current+1+Math.floor(random()*(index-current));[result[index],result[other]]=[result[other],result[index]];}return result; }
export function endedIndex(current:number,count:number,repeat:RepeatMode) { if(!count)return -1;if(repeat==='one')return current;if(current+1<count)return current+1;return repeat==='all'?0:-1; }
