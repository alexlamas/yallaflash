import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Store the mock function in a hoisted variable
const mockCreate = vi.hoisted(() => vi.fn());
const mockGetTransliterationPrompt = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockCreate,
      };
    },
  };
});

vi.mock("../transliterationService", () => ({
  TransliterationService: {
    getTransliterationPrompt: mockGetTransliterationPrompt,
  },
}));

// Import after mocking
import { ClaudeService } from "../claudeService";

describe("ClaudeService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: "test-api-key" };

    // Default mock for transliteration prompt
    mockGetTransliterationPrompt.mockResolvedValue(
      "TRANSLITERATION RULES:\nUse these specific transliterations for Arabic letters: ا=a, ب=b\n\nSome notes"
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("chatCompletion", () => {
    it("should return text response from Claude", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "Hello, world!" }],
      });

      const result = await ClaudeService.chatCompletion("Say hello");

      expect(result).toBe("Hello, world!");
      expect(mockCreate).toHaveBeenCalledWith({
        model: "claude-sonnet-5",
        max_tokens: 1000,
        messages: [{ role: "user", content: "Say hello" }],
      });
    });

    it("should throw generic error when ANTHROPIC_API_KEY is not configured", async () => {
      delete process.env.ANTHROPIC_API_KEY;

      // chatCompletion catches errors and throws a generic message
      await expect(ClaudeService.chatCompletion("Say hello")).rejects.toThrow(
        "Failed to get completion from Claude"
      );
    });

    it("should throw error when Claude returns empty content", async () => {
      mockCreate.mockResolvedValue({
        content: [],
      });

      await expect(ClaudeService.chatCompletion("Say hello")).rejects.toThrow(
        "Failed to get completion from Claude"
      );
    });

    it("should throw error when Claude returns null content", async () => {
      mockCreate.mockResolvedValue({
        content: null,
      });

      await expect(ClaudeService.chatCompletion("Say hello")).rejects.toThrow(
        "Failed to get completion from Claude"
      );
    });

    it("should throw error when API call fails", async () => {
      mockCreate.mockRejectedValue(new Error("API Error"));

      await expect(ClaudeService.chatCompletion("Say hello")).rejects.toThrow(
        "Failed to get completion from Claude"
      );
    });

    it("should return empty string for non-text content types", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "image", data: "..." }],
      });

      const result = await ClaudeService.chatCompletion("Generate image");

      expect(result).toBe("");
    });
  });

  describe("generateSentence", () => {
    const validJsonResponse = JSON.stringify({
      arabic: "أنا بحب الميّ",
      transliteration: "ana bhibb el-mayy",
      english: "I love water",
    });

    it("should generate a sentence with word only", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: validJsonResponse }],
      });

      const result = await ClaudeService.generateSentence("ميّ");

      expect(result).toEqual({
        arabic: "أنا بحب الميّ",
        transliteration: "ana bhibb el-mayy",
        english: "I love water",
      });
      expect(mockGetTransliterationPrompt).toHaveBeenCalled();
    });

    it("should include english meaning in prompt when provided", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: validJsonResponse }],
      });

      await ClaudeService.generateSentence("ميّ", "water");

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: "user",
              content: expect.stringContaining('English meaning: "water"'),
            },
          ],
        })
      );
    });

    it("should include word type in context when provided", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: validJsonResponse }],
      });

      await ClaudeService.generateSentence("ميّ", "water", "noun");

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: "user",
              content: expect.stringContaining("Word type: noun"),
            },
          ],
        })
      );
    });

    it("should include notes in context when provided", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: validJsonResponse }],
      });

      await ClaudeService.generateSentence("ميّ", "water", "noun", "Lebanese dialect");

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: "user",
              content: expect.stringContaining("Additional notes: Lebanese dialect"),
            },
          ],
        })
      );
    });

    it("should use existing data prompt when existingData is provided", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: validJsonResponse }],
      });

      await ClaudeService.generateSentence("ميّ", undefined, undefined, undefined, {
        english: "I love water",
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: "user",
              content: expect.stringContaining("Provided sentence parts:"),
            },
          ],
        })
      );
    });

    it("should include all existing fields in prompt", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: validJsonResponse }],
      });

      await ClaudeService.generateSentence("ميّ", undefined, undefined, undefined, {
        arabic: "أنا بحب الميّ",
        transliteration: "ana bhibb el-mayy",
        english: "I love water",
      });

      const callArg = mockCreate.mock.calls[0][0];
      const prompt = callArg.messages[0].content;

      expect(prompt).toContain('English: "I love water"');
      expect(prompt).toContain('Transliteration: "ana bhibb el-mayy"');
      expect(prompt).toContain('Arabic: "أنا بحب الميّ"');
    });

    it("should not send sampling params (rejected by claude-sonnet-5)", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: validJsonResponse }],
      });

      await ClaudeService.generateSentence("ميّ");

      expect(mockCreate).toHaveBeenCalledWith(
        expect.not.objectContaining({
          temperature: expect.anything(),
        })
      );
    });

    it("should throw error for invalid JSON response", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "This is not JSON" }],
      });

      await expect(ClaudeService.generateSentence("ميّ")).rejects.toThrow(
        "Invalid response format from Claude"
      );
    });

    it("should throw error when API key is missing", async () => {
      delete process.env.ANTHROPIC_API_KEY;

      await expect(ClaudeService.generateSentence("ميّ")).rejects.toThrow(
        "ANTHROPIC_API_KEY is not configured"
      );
    });

    it("should throw error when API call fails", async () => {
      mockCreate.mockRejectedValue(new Error("Rate limited"));

      await expect(ClaudeService.generateSentence("ميّ")).rejects.toThrow(
        "Rate limited"
      );
    });

    it("should throw error when Claude returns empty content", async () => {
      mockCreate.mockResolvedValue({
        content: [],
      });

      await expect(ClaudeService.generateSentence("ميّ")).rejects.toThrow(
        "No content in Claude response"
      );
    });

    it("should ignore empty existing data fields", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: validJsonResponse }],
      });

      await ClaudeService.generateSentence("ميّ", undefined, undefined, undefined, {
        english: "",
        transliteration: "   ",
        arabic: "",
      });

      // Should use the "generate new" prompt since all existing fields are empty
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: "user",
              content: expect.stringContaining("Create a simple, clear example sentence"),
            },
          ],
        })
      );
    });

    it("should include transliteration rules in prompt", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: validJsonResponse }],
      });

      await ClaudeService.generateSentence("ميّ");

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: "user",
              content: expect.stringContaining("TRANSLITERATION RULES:"),
            },
          ],
        })
      );
    });

    it("should handle partial JSON response fields", async () => {
      // Claude might return a valid JSON but with different field names or structure
      const partialResponse = JSON.stringify({
        arabic: "مرحبا",
        transliteration: "marhaba",
        english: "hello",
      });

      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: partialResponse }],
      });

      const result = await ClaudeService.generateSentence("مرحبا");

      expect(result.arabic).toBe("مرحبا");
      expect(result.transliteration).toBe("marhaba");
      expect(result.english).toBe("hello");
    });

    it("should handle JSON with extra whitespace", async () => {
      const responseWithWhitespace = `
        {
          "arabic": "مرحبا",
          "transliteration": "marhaba",
          "english": "hello"
        }
      `;

      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: responseWithWhitespace }],
      });

      const result = await ClaudeService.generateSentence("مرحبا");

      expect(result.arabic).toBe("مرحبا");
    });

    it("should propagate TransliterationService errors", async () => {
      mockGetTransliterationPrompt.mockRejectedValue(
        new Error("Database connection failed")
      );

      await expect(ClaudeService.generateSentence("ميّ")).rejects.toThrow(
        "Database connection failed"
      );
    });
  });
});
