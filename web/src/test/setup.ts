import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// jsdom has no canvas: without this, getContext logs a "not implemented" error.
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = () => null;
}

afterEach(() => {
  localStorage.clear();
});

// jsdom has no modal dialogs: toggle `open` (its UA style hides a closed <dialog>) and fire `close`.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement, returnValue?: string) {
    if (!this.hasAttribute("open")) return;
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
