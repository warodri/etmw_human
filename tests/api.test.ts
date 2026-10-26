import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("POST /api/v1/tag", () => {
  it("returns the reference tagging", async () => {
    const response = await request(app)
      .post("/api/v1/tag")
      .send({ sentence: "I am a person" })
      .expect(200);

    expect(
      response.body.data.tokens.map(
        (token: { word: string; category: string }) => [
          token.word,
          token.category
        ]
      )
    ).toEqual([
      ["I", "personal pronoun"],
      ["am", "auxiliary verb"],
      ["a", "article"],
      ["person", "noun"]
    ]);
    expect(response.body.data.stats.wordCount).toBe(4);
    expect(response.headers["x-request-id"]).toBeDefined();
  });

  it("rejects an empty sentence", async () => {
    const response = await request(app)
      .post("/api/v1/tag")
      .send({ sentence: "   " })
      .expect(400);

    expect(response.body.error.message).toBe("Request validation failed");
    expect(response.body.error.details[0].path).toBe("sentence");
  });

  it("rejects malformed payloads", async () => {
    const response = await request(app)
      .post("/api/v1/tag")
      .send({ sentence: 42 })
      .expect(400);

    expect(response.body.error.message).toBe("Request validation failed");
  });

  it("batch tags up to fifty sentences", async () => {
    const response = await request(app)
      .post("/api/v1/tag/batch")
      .send({ sentences: ["I am a person", "She has eaten the cake."] })
      .expect(200);

    expect(response.body.meta.count).toBe(2);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0].tokens[0].category).toBe("personal pronoun");
  });

  it("exposes vocabulary metadata and grouped array data", async () => {
    const response = await request(app)
      .get("/api/v1/vocabulary")
      .expect(200);

    expect(response.body.data.size).toBeGreaterThan(300);
    expect(response.body.data.categories.noun).toBeGreaterThan(200);
    expect(Array.isArray(response.body.data.groups)).toBe(true);

    const nounGroup = response.body.data.groups.find(
      (group: { category: string }) => group.category === "noun"
    );

    expect(nounGroup.count).toBeGreaterThan(200);
    expect(nounGroup.words).toContain("person");
    expect(nounGroup.words).toContain("cake");
  });

  it("serves the browser UI", async () => {
    const response = await request(app).get("/").expect(200);

    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.text).toContain("Add a sentence");
    expect(response.text).toContain("Generate a sentence");
  });

  it("reports health", async () => {
    const response = await request(app).get("/health").expect(200);

    expect(response.body.status).toBe("ok");
  });

  it("returns a structured 404", async () => {
    const response = await request(app).get("/missing").expect(404);

    expect(response.body.error.message).toContain("was not found");
  });
});
