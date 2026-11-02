/** 灵感列表日期，写成 M/D/YY，例如 10/19/26。 */
export function ideaListDate(createdAt) {
  const date = new Date(Number(createdAt) || Date.now());
  if (Number.isNaN(date.getTime())) return '';
  const year = String(date.getFullYear()).slice(-2);
  return `${date.getMonth() + 1}/${date.getDate()}/${year}`;
}
