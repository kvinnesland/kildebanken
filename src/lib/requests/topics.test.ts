import { describe, expect, it } from "vitest";
import { isRequestTopic, REQUEST_TOPICS } from "./topics";

describe("isRequestTopic", () => {
  it("godtar alle 21 nøklene fra SPEC-V1.md 9.1", () => {
    expect(REQUEST_TOPICS.length).toBe(21);
    for (const topic of REQUEST_TOPICS) {
      expect(isRequestTopic(topic)).toBe(true);
    }
  });

  it("avviser en visningsstreng eller ukjent nøkkel", () => {
    expect(isRequestTopic("Helse")).toBe(false);
    expect(isRequestTopic("sports")).toBe(false);
  });
});
