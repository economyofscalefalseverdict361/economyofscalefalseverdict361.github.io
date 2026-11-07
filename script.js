const themeToggle = document.querySelector(".theme-toggle");
const themeIcon = document.querySelector(".theme-icon");
const ideaText = document.querySelector(".idea-text");
const ideaButton = document.querySelector(".idea-button");

themeToggle.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark-theme");
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute("aria-label", isDark ? "라이트 모드 켜기" : "다크 모드 켜기");
  themeIcon.textContent = isDark ? "☼" : "◐";
});

const ideas = [
  "작은 시작도 시작이다.",
  "호기심이 다음 장면을 만든다.",
  "완벽보다 꾸준함을 선택하기.",
  "오늘의 실험이 내일의 감각이 된다.",
  "일단 만들고, 천천히 다듬기."
];

ideaButton.addEventListener("click", () => {
  const currentIdea = ideaText.textContent;
  const options = ideas.filter((idea) => idea !== currentIdea);
  ideaText.textContent = options[Math.floor(Math.random() * options.length)];
});
