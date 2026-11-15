import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/geist-mono";
import "./style.css";

const tabs = [...document.querySelectorAll<HTMLButtonElement>("[role='tab']")];

const activateTab = (selected: HTMLButtonElement) => {
  for (const tab of tabs) {
    const active = tab === selected;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    const panel = document.getElementById(tab.getAttribute("aria-controls") ?? "");
    if (panel) panel.hidden = !active;
  }
};

for (const [index, tab] of tabs.entries()) {
  tab.addEventListener("click", () => activateTab(tab));
  tab.addEventListener("keydown", (event) => {
    let nextIndex: number;
    switch (event.key) {
      case "ArrowDown":
        nextIndex = (index + 1) % tabs.length;
        break;
      case "ArrowUp":
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const next = tabs[nextIndex];
    activateTab(next);
    next.focus();
  });
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
  button.addEventListener("click", async () => {
    const code = document.getElementById(button.dataset.copy ?? "");
    const status = document.getElementById("copy-status");
    if (!code || !status) return;
    try {
      await navigator.clipboard.writeText(code.textContent ?? "");
      button.textContent = "Copied ✓";
      status.textContent = "Configuration copied to clipboard.";
      window.setTimeout(() => {
        button.textContent = "Copy";
      }, 2200);
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(code);
      selection?.removeAllRanges();
      selection?.addRange(range);
      status.textContent = "Copy unavailable. The configuration is selected; copy it manually.";
      button.textContent = "Select & copy";
    }
  });
}

const demoButton = document.querySelector<HTMLButtonElement>("#demo-button");
const output = document.getElementById("terminal-output");
const note = document.getElementById("terminal-note");
const label = document.getElementById("run-label");
const firstRun = output?.innerHTML ?? "";
let restored = false;

demoButton?.addEventListener("click", () => {
  if (!output || !note || !label) return;
  restored = !restored;
  output.innerHTML = restored
    ? `<p><span class="terminal-muted">→</span> Checking task inputs</p>
       <p><span class="terminal-green">✓</span> Matching task found in remote cache</p>
       <p><span class="terminal-green">↓</span> Artifacts restored from R2</p>
       <p><span class="terminal-green">✓</span> app:build output ready</p>`
    : firstRun;
  note.innerHTML = `<span class="terminal-green">●</span> ${restored ? "Same inputs. Saved work. Onward." : "Work done. Work remembered."}`;
  label.textContent = restored ? "02 / NEXT MACHINE" : "01 / FIRST RUN";
  demoButton.innerHTML = `${restored ? "Back to the first run" : "Try the next build"} <span aria-hidden="true">↻</span>`;
});
