export function renderData(quote, date) {
  const data = { quote: quote.quote, date };
  if (quote.author) data.author = quote.author;
  if (quote.work) data.work = quote.work;
  if (quote.category && quote.category.length) data.category = quote.category;
  return JSON.stringify(data);
}
