import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CircleNotchIcon, PlusIcon, WarningCircle, Package, Image, Check, PencilSimple, X } from "@phosphor-icons/react";
import { Word, WordType } from "../types/word";
import { useAIUsage } from "../hooks/useAIUsage";
import { PackService, PackWord } from "../services/packService";
import { useWords } from "../contexts/WordsContext";

type Mode = "single" | "bulk";
type BulkStep = "input" | "preview";

interface ExtractedWord {
  id: string;
  english: string;
  arabic: string;
  transliteration: string;
  type: WordType;
  isDuplicate: boolean;
}

interface AddWordDialogProps {
  onWordAdded: (word: Word) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialImage?: File | null;
  initialText?: string;
}

export default function AddWordDialog({
  onWordAdded,
  open: controlledOpen,
  onOpenChange,
  initialImage,
  initialText,
}: AddWordDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (isControlled) {
      onOpenChange?.(value);
    } else {
      setInternalOpen(value);
    }
  };
  const [mode, setMode] = useState<Mode>("single");

  // Single mode state
  const [inputText, setInputText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [previewWord, setPreviewWord] = useState<Partial<Word> | null>(null);
  const [searchResults, setSearchResults] = useState<PackWord[]>([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Bulk mode state
  const [bulkStep, setBulkStep] = useState<BulkStep>("input");
  const [bulkText, setBulkText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedWords, setExtractedWords] = useState<ExtractedWord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { usage, isUnlimited, refresh: refreshUsage } = useAIUsage();
  const { words: existingWords } = useWords();

  const wordTypes: WordType[] = ["noun", "verb", "adjective", "phrase"];

  // Handle initial values from drops
  useEffect(() => {
    if (open && (initialImage || initialText)) {
      setMode("bulk");
      setBulkStep("input");

      if (initialImage) {
        // Convert image file to data URL for preview
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreview(e.target?.result as string);
          setBulkText("");
        };
        reader.readAsDataURL(initialImage);
      } else if (initialText) {
        setBulkText(initialText);
        setImagePreview(null);
      }
    }
  }, [open, initialImage, initialText]);

  // Debounced search for pack words
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!inputText || inputText.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await PackService.searchPackWords(inputText, 5);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [inputText]);

  const handleSelectPackWord = (packWord: PackWord) => {
    setPreviewWord({
      english: packWord.english,
      arabic: packWord.arabic,
      transliteration: packWord.transliteration || "",
      type: packWord.type || "noun",
    });
    setSearchResults([]);
  };

  const handleGenerate = async () => {
    setError(null);
    setLimitReached(false);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/words/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          text: inputText,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.limitReached) {
          setLimitReached(true);
          setError(errorData.error || "Monthly AI limit reached");
          return;
        }
        throw new Error(errorData.error || "Failed to generate translation");
      }

      const word = await response.json();
      setPreviewWord(word);
      refreshUsage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generating translation");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!previewWord) return;

    try {
      const requestBody = {
        text: previewWord.english,
        confirmed: true,
        word: previewWord,
      };

      const response = await fetch("/api/words/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Check for duplicate word error
        if (errorData.details?.includes("duplicate") || errorData.details?.includes("unique")) {
          setError("You already have this word in your vocabulary");
          return;
        }
        throw new Error(errorData.error || "Failed to save word");
      }

      const savedWord = await response.json();
      onWordAdded(savedWord);
      setOpen(false);
      setInputText("");
      setPreviewWord(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save word");
    }
  };

  const handleClose = () => {
    setOpen(false);
    setInputText("");
    setPreviewWord(null);
    setError(null);
    setLimitReached(false);
    setSearchResults([]);
    // Reset bulk state
    setBulkStep("input");
    setBulkText("");
    setImagePreview(null);
    setExtractedWords([]);
    setSelectedIds(new Set());
    setEditingId(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      // Clear state when opening
      setError(null);
      setLimitReached(false);
    }
  };

  // Check if a word is a duplicate
  const isDuplicateWord = useCallback(
    (english: string, arabic: string) => {
      const normalizedEnglish = english.toLowerCase().trim();
      const normalizedArabic = arabic.trim();
      return existingWords.some(
        (w) =>
          w.english.toLowerCase().trim() === normalizedEnglish ||
          w.arabic.trim() === normalizedArabic
      );
    },
    [existingWords]
  );

  // Handle image file selection
  const handleImageSelect = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    setError(null);
  };

  // Handle drag and drop
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleImageSelect(file);
    }
  };

  // Handle bulk extraction
  const handleBulkExtract = async () => {
    setError(null);
    setLimitReached(false);
    setIsGenerating(true);

    try {
      const body: { text?: string; image?: string } = {};

      if (imagePreview) {
        body.image = imagePreview;
      } else if (bulkText.trim()) {
        body.text = bulkText.trim();
      } else {
        setError("Please enter text or upload an image");
        setIsGenerating(false);
        return;
      }

      const response = await fetch("/api/words/bulk-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.limitReached) {
          setLimitReached(true);
          setError(errorData.error || "AI limit reached");
          return;
        }
        throw new Error(errorData.error || "Failed to extract words");
      }

      const data = await response.json();
      const words: ExtractedWord[] = data.words.map(
        (w: Omit<ExtractedWord, "id" | "isDuplicate">, i: number) => ({
          ...w,
          id: `extracted-${i}-${Date.now()}`,
          isDuplicate: isDuplicateWord(w.english, w.arabic),
        })
      );

      setExtractedWords(words);
      // Select all non-duplicate words by default
      setSelectedIds(new Set(words.filter((w) => !w.isDuplicate).map((w) => w.id)));
      setBulkStep("preview");
      refreshUsage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error extracting words");
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle word selection
  const toggleWordSelection = (id: string) => {
    const word = extractedWords.find((w) => w.id === id);
    if (word?.isDuplicate) return; // Can't select duplicates

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Update extracted word
  const updateExtractedWord = (id: string, field: keyof ExtractedWord, value: string) => {
    setExtractedWords((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        const updated = { ...w, [field]: value };
        // Recheck duplicate status if english or arabic changed
        if (field === "english" || field === "arabic") {
          updated.isDuplicate = isDuplicateWord(
            field === "english" ? value : w.english,
            field === "arabic" ? value : w.arabic
          );
        }
        return updated;
      })
    );
  };

  // Save selected words
  const handleBulkSave = async () => {
    const wordsToSave = extractedWords.filter(
      (w) => selectedIds.has(w.id) && !w.isDuplicate
    );

    if (wordsToSave.length === 0) {
      setError("No words selected to save");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      for (const word of wordsToSave) {
        const response = await fetch("/api/words/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            text: word.english,
            confirmed: true,
            word: {
              english: word.english,
              arabic: word.arabic,
              transliteration: word.transliteration,
              type: word.type,
            },
          }),
        });

        if (response.ok) {
          const savedWord = await response.json();
          onWordAdded(savedWord);
        }
      }

      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save words");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2 rounded-full">
            <PlusIcon weight="bold" />
            <span className="hidden text-sm sm:block">New word</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className={mode === "bulk" && bulkStep === "preview" ? "max-w-2xl" : ""}>
        <DialogHeader>
          <DialogTitle>New {mode === "bulk" ? "words" : "word"}</DialogTitle>
          <DialogDescription>
            {mode === "single"
              ? !previewWord
                ? "We'll translate it to Lebanese Arabic for you."
                : "Review and edit the translation before saving."
              : bulkStep === "input"
              ? "Paste text or upload an image to extract multiple words."
              : `Found ${extractedWords.length} words. Select which to save.`}
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => {
              setMode("single");
              setError(null);
            }}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              mode === "single"
                ? "bg-white text-heading shadow-sm"
                : "text-subtle hover:text-body"
            }`}
          >
            Single
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("bulk");
              setError(null);
            }}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              mode === "bulk"
                ? "bg-white text-heading shadow-sm"
                : "text-subtle hover:text-body"
            }`}
          >
            Bulk
          </button>
        </div>

        {/* Single mode - input */}
        {mode === "single" && !previewWord && (
          <div className="space-y-4">
            <div className="relative">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!isGenerating && inputText.trim()) {
                    handleGenerate();
                  }
                }}
              >
                <Input
                  placeholder="Enter word in English or Arabic..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onBlur={() => {
                    // Delay to allow click on dropdown items
                    setTimeout(() => setSearchResults([]), 150);
                  }}
                  disabled={isGenerating}
                />
              </form>

              {/* Pack word search results dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border rounded-lg shadow-lg overflow-hidden">
                  <div className="px-3 py-1.5 bg-gray-50 border-b">
                    <span className="text-xs font-medium text-subtle">Found in packs</span>
                  </div>
                  <div className="divide-y max-h-48 overflow-y-auto">
                    {searchResults.map((word) => (
                      <button
                        key={word.id}
                        type="button"
                        onClick={() => handleSelectPackWord(word)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
                      >
                        <Package className="w-4 h-4 text-disabled flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-heading">{word.english}</span>
                            <span className="text-disabled">·</span>
                            <span className="font-arabic text-body">{word.arabic}</span>
                          </div>
                          {word.transliteration && (
                            <div className="text-xs text-subtle">{word.transliteration}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && (
              limitReached ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                  <div className="flex items-start gap-3">
                    <WarningCircle className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" weight="fill" />
                    <div className="text-sm">
                      <p className="font-medium text-rose-800">Monthly limit reached</p>
                      <p className="text-rose-700 mt-1">
                        You&apos;ve used all your free AI translations this month. Your limit resets next month.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-red-500">{error}</p>
              )
            )}

            <div className="flex items-center justify-between gap-2">
              {usage && !isUnlimited && !limitReached && (
                <span className="text-xs text-muted-foreground">
                  {usage.count}/{usage.limit} AI uses this month
                </span>
              )}
              {!usage && <span />}
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !inputText.trim() || limitReached}
                >
                  {isGenerating ? (
                    <>
                      <CircleNotchIcon className="mr-2 h-4 w-4 animate-spin" />
                      Translating...
                    </>
                  ) : (
                    "Generate"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Single mode - preview */}
        {mode === "single" && previewWord && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <div className="space-y-4">
              <p className="text-xs text-subtle">Check translations — AI can make mistakes</p>
              <div className="grid gap-4">
                <div>
                  <Input
                    placeholder="English"
                    value={previewWord.english}
                    onChange={(e) =>
                      setPreviewWord((prev) => ({
                        ...prev,
                        english: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Input
                    placeholder="Arabic"
                    value={previewWord.arabic}
                    onChange={(e) =>
                      setPreviewWord((prev) => ({
                        ...prev,
                        arabic: e.target.value,
                      }))
                    }
                    dir="rtl"
                    className="font-arabic text-lg"
                  />
                </div>
                <div>
                  <Input
                    placeholder="Transliteration"
                    value={previewWord.transliteration}
                    onChange={(e) =>
                      setPreviewWord((prev) => ({
                        ...prev,
                        transliteration: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Select
                    value={previewWord.type}
                    onValueChange={(value) =>
                      setPreviewWord((prev) => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {wordTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPreviewWord(null)}
                >
                  Back
                </Button>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit">Save word</Button>
              </div>
            </div>
          </form>
        )}

        {/* Bulk mode - input */}
        {mode === "bulk" && bulkStep === "input" && (
          <div className="space-y-4">
            {/* Text area or image upload */}
            <div className="space-y-3">
              <textarea
                placeholder="Paste text containing words you want to learn..."
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                disabled={isGenerating || !!imagePreview}
                className="w-full h-32 px-3 py-2 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                maxLength={500}
              />

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-subtle">or</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Image upload zone */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageSelect(file);
                }}
                className="hidden"
              />

              {imagePreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Upload preview"
                    className="w-full h-32 object-cover rounded-lg border"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  disabled={isGenerating}
                  className={`w-full h-20 border-2 border-dashed rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
                    isDragging
                      ? "border-blue-500 bg-blue-50 text-blue-600"
                      : "text-subtle hover:border-gray-400 hover:text-body"
                  }`}
                >
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image className="w-5 h-5" aria-hidden="true" />
                  <span className="text-sm">{isDragging ? "Drop image here" : "Drop image or click to upload"}</span>
                </button>
              )}
            </div>

            {/* Character count for text */}
            {bulkText && !imagePreview && (
              <p className="text-xs text-subtle text-right">{bulkText.length}/500 characters</p>
            )}

            {error && (
              limitReached ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                  <div className="flex items-start gap-3">
                    <WarningCircle className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" weight="fill" />
                    <div className="text-sm">
                      <p className="font-medium text-rose-800">Not enough AI uses</p>
                      <p className="text-rose-700 mt-1">{error}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-red-500">{error}</p>
              )
            )}

            <div className="flex items-center justify-between gap-2">
              {usage && !isUnlimited && !limitReached && (
                <span className="text-xs text-muted-foreground">
                  {usage.count}/{usage.limit} AI uses (bulk costs 2)
                </span>
              )}
              {!usage && <span />}
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleBulkExtract}
                  disabled={isGenerating || (!bulkText.trim() && !imagePreview) || limitReached}
                >
                  {isGenerating ? (
                    <>
                      <CircleNotchIcon className="mr-2 h-4 w-4 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    "Extract words"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk mode - preview */}
        {mode === "bulk" && bulkStep === "preview" && (
          <div className="space-y-4">
            <p className="text-xs text-subtle">Check translations — AI can make mistakes</p>
            {/* Word list with checkboxes */}
            <div className="max-h-80 overflow-y-auto border rounded-lg divide-y">
              {extractedWords.map((word) => (
                <div
                  key={word.id}
                  className={`p-3 ${word.isDuplicate ? "opacity-50 bg-gray-50" : ""}`}
                >
                  {editingId === word.id ? (
                    // Editing mode
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          value={word.english}
                          onChange={(e) => updateExtractedWord(word.id, "english", e.target.value)}
                          placeholder="English"
                          className="text-sm"
                        />
                        <Input
                          value={word.arabic}
                          onChange={(e) => updateExtractedWord(word.id, "arabic", e.target.value)}
                          placeholder="Arabic"
                          dir="rtl"
                          className="text-sm font-arabic"
                        />
                        <Input
                          value={word.transliteration}
                          onChange={(e) => updateExtractedWord(word.id, "transliteration", e.target.value)}
                          placeholder="Transliteration"
                          className="text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={word.type}
                          onValueChange={(value) => updateExtractedWord(word.id, "type", value)}
                        >
                          <SelectTrigger className="w-32 h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {wordTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          Done
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Display mode
                    <div
                      onClick={() => !word.isDuplicate && toggleWordSelection(word.id)}
                      className={`flex items-center gap-3 ${!word.isDuplicate ? "cursor-pointer" : ""}`}
                    >
                      <div
                        className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                          word.isDuplicate
                            ? "bg-gray-200 border-gray-300"
                            : selectedIds.has(word.id)
                            ? "bg-emerald-500 border-emerald-500"
                            : "border-gray-300"
                        }`}
                      >
                        {selectedIds.has(word.id) && <Check className="w-3 h-3 text-white" weight="bold" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-heading">{word.english}</span>
                          <span className="text-disabled">·</span>
                          <span className="font-arabic text-body">{word.arabic}</span>
                          <span className="text-disabled">·</span>
                          <span className="text-sm text-subtle">{word.transliteration}</span>
                        </div>
                      </div>

                      {word.isDuplicate ? (
                        <span className="text-xs text-amber-600 flex-shrink-0">Already saved</span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(word.id);
                          }}
                          className="p-1.5 text-subtle hover:text-body hover:bg-gray-100 rounded"
                        >
                          <PencilSimple className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex justify-between items-center gap-2">
              <span className="text-sm text-subtle">
                {selectedIds.size} of {extractedWords.filter((w) => !w.isDuplicate).length} selected
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setBulkStep("input");
                    setExtractedWords([]);
                    setSelectedIds(new Set());
                    setEditingId(null);
                  }}
                >
                  Back
                </Button>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleBulkSave}
                  disabled={isSaving || selectedIds.size === 0}
                >
                  {isSaving ? (
                    <>
                      <CircleNotchIcon className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    `Save ${selectedIds.size} word${selectedIds.size !== 1 ? "s" : ""}`
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
