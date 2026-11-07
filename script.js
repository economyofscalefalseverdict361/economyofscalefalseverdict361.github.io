const API_URL = "https://api.github.com/search/repositories";
const PAGE_SIZE = 30;

const form = document.querySelector("#search-form");
const searchInput = document.querySelector("#search-input");
const filters = document.querySelector(".language-filters");
const grid = document.querySelector("#repo-grid");
const summary = document.querySelector("#results-summary");
const updated = document.querySelector("#last-updated");
const loadMoreButton = document.querySelector("#load-more");
const resultsNote = document.querySelector("#results-note");

let activeLanguage = "";
let searchTerm = "";
let currentPage = 1;
let totalCount = 0;
let requestController;

const numberFormat = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const dateFormat = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric" });

function formatStars(count) {
  return numberFormat.format(count);
}

function formatUpdatedAt(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "업데이트 날짜 없음" : `업데이트 ${dateFormat.format(date)}`;
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createRepositoryCard(repository, index) {
  const card = makeElement("article", "repo-card");
  card.style.setProperty("--card-index", String(index % PAGE_SIZE));

  const top = makeElement("div", "repo-card-top");
  const rank = makeElement("span", "repo-rank", `NO. ${String(index + 1).padStart(2, "0")}`);
  const starCount = makeElement("span", "repo-stars");
  starCount.setAttribute("aria-label", `${repository.stargazers_count} stars`);
  starCount.append(makeElement("span", "star-icon", "★"), document.createTextNode(` ${formatStars(repository.stargazers_count)}`));
  top.append(rank, starCount);

  const title = makeElement("h3", "repo-name");
  const link = makeElement("a", "", `${repository.owner.login} / ${repository.name}`);
  link.href = repository.html_url;
  link.target = "_blank";
  link.rel = "noreferrer";
  title.append(link);

  const description = makeElement("p", "repo-description", repository.description || "저장소 설명이 아직 등록되지 않았습니다.");
  const details = makeElement("div", "repo-details");
  const language = makeElement("span", "repo-language", repository.language || "언어 미지정");
  if (repository.language) {
    const languageDot = makeElement("span", "language-dot");
    languageDot.setAttribute("aria-hidden", "true");
    language.prepend(languageDot);
  }
  const updatedLabel = makeElement("span", "repo-updated", formatUpdatedAt(repository.updated_at));
  details.append(language, updatedLabel);

  const footer = makeElement("div", "repo-card-footer");
  const forks = makeElement("span", "", `⑂ ${formatStars(repository.forks_count)} forks`);
  const openLink = makeElement("a", "repo-open", "저장소 보기 ↗");
  openLink.href = repository.html_url;
  openLink.target = "_blank";
  openLink.rel = "noreferrer";
  footer.append(forks, openLink);

  card.append(top, title, description, details, footer);
  return card;
}

function setLoading(isLoading, append = false) {
  grid.setAttribute("aria-busy", String(isLoading));
  loadMoreButton.disabled = isLoading;
  if (isLoading && !append) {
    grid.replaceChildren();
    for (let index = 0; index < 6; index += 1) {
      const skeleton = makeElement("div", "repo-skeleton");
      skeleton.setAttribute("aria-hidden", "true");
      grid.append(skeleton);
    }
    summary.textContent = "공개 저장소를 불러오고 있어요...";
    loadMoreButton.hidden = true;
  }
}

function errorMessage(response, payload) {
  if (response.status === 403 || response.status === 429) {
    return "GitHub API 요청 한도에 도달했어요. 잠시 후 다시 시도해 주세요.";
  }
  if (response.status === 422) {
    return "검색어를 확인해 주세요. GitHub 검색 형식과 맞지 않을 수 있어요.";
  }
  return payload?.message || `저장소를 불러오지 못했어요 (HTTP ${response.status}).`;
}

async function loadRepositories({ append = false } = {}) {
  requestController?.abort();
  const controller = new AbortController();
  requestController = controller;
  const requestedPage = append ? currentPage + 1 : 1;
  setLoading(true, append);
  if (!append) resultsNote.textContent = "별이 많은 저장소부터 보여드립니다.";

  const qualifiers = ["stars:>0", "fork:false", "archived:false"];
  if (activeLanguage) qualifiers.push(`language:${activeLanguage}`);
  const query = [searchTerm.trim(), ...qualifiers].filter(Boolean).join(" ");
  const params = new URLSearchParams({
    q: query,
    sort: "stars",
    order: "desc",
    per_page: String(PAGE_SIZE),
    page: String(requestedPage)
  });

  try {
    const response = await fetch(`${API_URL}?${params}`, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(errorMessage(response, payload));

    const items = payload.items || [];
    currentPage = requestedPage;
    totalCount = payload.total_count || 0;
    const startIndex = (requestedPage - 1) * PAGE_SIZE;
    const cards = items.map((repository, index) => createRepositoryCard(repository, startIndex + index));

    if (!append) grid.replaceChildren(...cards);
    else grid.append(...cards);

    const shownCount = grid.querySelectorAll(".repo-card").length;
    summary.textContent = totalCount
      ? `${numberFormat.format(totalCount)}개 이상의 저장소 · ${shownCount}개 표시 중`
      : "검색 결과가 없습니다.";
    updated.textContent = `조회 ${new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`;
    resultsNote.textContent = "GitHub 공개 저장소를 별 개수 순으로 정렬했습니다.";
    loadMoreButton.hidden = shownCount >= totalCount || items.length < PAGE_SIZE || requestedPage >= 10;
    if (requestedPage >= 10 && shownCount < totalCount) {
      resultsNote.textContent = "GitHub 검색 API는 한 검색에서 최대 1,000개의 결과를 제공합니다.";
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    if (!append) {
      grid.replaceChildren();
      const errorCard = makeElement("div", "error-card");
      errorCard.append(
        makeElement("span", "error-icon", "!"),
        makeElement("h3", "", "저장소를 불러오지 못했어요"),
        makeElement("p", "", error.message),
        makeElement("button", "retry-button", "다시 시도")
      );
      errorCard.querySelector("button").addEventListener("click", () => loadRepositories());
      grid.append(errorCard);
      summary.textContent = "GitHub 연결을 확인해 주세요.";
      resultsNote.textContent = "네트워크 상태를 확인한 뒤 다시 시도할 수 있어요.";
    } else {
      resultsNote.textContent = error.message;
    }
    loadMoreButton.hidden = true;
  } finally {
    if (!controller.signal.aborted) setLoading(false, true);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  searchTerm = searchInput.value;
  loadRepositories();
});

filters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-language]");
  if (!button) return;
  activeLanguage = button.dataset.language;
  const activeButton = filters.querySelector(".is-active");
  activeButton?.classList.remove("is-active");
  activeButton?.setAttribute("aria-pressed", "false");
  button.classList.add("is-active");
  button.setAttribute("aria-pressed", "true");
  loadRepositories();
});

loadMoreButton.addEventListener("click", () => loadRepositories({ append: true }));

loadRepositories();
