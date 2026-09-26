type Diagram = HTMLElement | SVGSVGElement;

const diagrams = new Map<Diagram, boolean>(
  Array.from(document.querySelectorAll<Diagram>("[data-diagram]"), (element) => [element, false]),
);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function update(element: Diagram, inView: boolean) {
  const running = inView && !document.hidden && !reducedMotion.matches;
  element.style.setProperty("--diagram-play-state", running ? "running" : "paused");

  // Pause the SVG clock too; CSS play state does not control SMIL packets.
  if (element instanceof SVGSVGElement) {
    if (running) element.unpauseAnimations();
    else element.pauseAnimations();
  }
}

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const element = entry.target as Diagram;
    diagrams.set(element, entry.isIntersecting);
    update(element, entry.isIntersecting);
  }
});

// Start paused until the observer has established which diagrams are visible.
for (const element of diagrams.keys()) {
  update(element, false);
  observer.observe(element);
}

function updateAll() {
  for (const [element, inView] of diagrams) update(element, inView);
}

document.addEventListener("visibilitychange", updateAll);
reducedMotion.addEventListener("change", updateAll);
