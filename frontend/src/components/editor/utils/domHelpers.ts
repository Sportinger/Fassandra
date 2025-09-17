export const highlightAndScroll = (selector: string, highlightClass: string, timeoutMs = 800) => {
  try {
    const element = document.querySelector(selector) as HTMLElement | null;
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add(highlightClass);
    window.setTimeout(() => element.classList.remove(highlightClass), timeoutMs);
  } catch {
    // Ignore DOM failures (detached documents, etc.)
  }
};

export const scrollSidebarItemIntoView = (
  cardSelector: string,
  containerSelector = '.rightSidebar .rightSidebarInner',
  delayMs = 50,
) => {
  window.setTimeout(() => {
    try {
      const container = document.querySelector(containerSelector) as HTMLElement | null;
      const card = document.querySelector(cardSelector) as HTMLElement | null;
      if (container && card) {
        card.scrollIntoView({ block: 'nearest' });
      }
    } catch {
      // Non-fatal: sidebar container likely missing
    }
  }, delayMs);
};
