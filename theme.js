try {
  const salvo = localStorage.getItem("tema");
  document.documentElement.dataset.theme = salvo === "light" ? "light" : "dark";
} catch (e) {
  document.documentElement.dataset.theme = "dark";
}
