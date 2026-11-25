import { describe, expect, it } from "vitest";
import { isMsg, MAX_TEXT } from "../src/shared/messages";
import { latestAnswer, selectionText } from "../src/shared/extract";

describe("message validation", () => {
  it("accepts well-formed messages and rejects the rest", () => {
    expect(isMsg({ type: "pair", code: "123456" })).toBe(true);
    expect(isMsg({ type: "pair", code: "12345a" })).toBe(false);
    expect(isMsg({ type: "page-text", text: "x".repeat(MAX_TEXT + 1), site: "a", mode: "answer" })).toBe(false);
    expect(isMsg({ type: "set-run", state: "sideways" })).toBe(false);
    expect(isMsg({ type: "eval", code: "alert(1)" })).toBe(false);
    expect(isMsg(null)).toBe(false);
  });
});

describe("extraction", () => {
  it("takes the latest assistant answer, never user messages", () => {
    document.body.innerHTML = `<div data-message-author-role="assistant">old</div><div data-message-author-role="user">mine</div><div data-message-author-role="assistant">new answer</div>`;
    expect(latestAnswer(document, "chatgpt.com")?.textContent).toBe("new answer");
    expect(latestAnswer(document, "unknown.example")?.textContent).toBe("new answer");
  });
  it("ignores selections inside form fields", () => {
    document.body.innerHTML = `<textarea id="t">secret draft</textarea>`;
    const t = document.getElementById("t") as HTMLTextAreaElement;
    t.focus(); t.select();
    expect(selectionText(document)).toBe("");
  });
});
