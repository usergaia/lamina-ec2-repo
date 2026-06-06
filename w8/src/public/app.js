fetch("data.json")
  .then((res) => res.json())
  .then((data) => {
    setText("quote", data.quote);
    setText("category", toList(data.category).join(" · "));
    setText("author", data.author);
    setText("work", data.work);
    setText("date", data.date);
  });

function setText(id, value) {
  const el = document.getElementById(id);
  el.textContent = value || "";
  el.hidden = !value;
}

function toList(value) {
  return [].concat(value ?? []).filter(Boolean);
}
