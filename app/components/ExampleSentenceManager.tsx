import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  PencilSimple,
  Trash,
  Check,
  X,
  CircleNotch,
  Sparkle,
  Coin,
} from "@phosphor-icons/react";
import { Sentence, SentenceInput } from "../types/word";
import { SentenceService } from "../services/sentenceService";
import { useToast } from "@/hooks/use-toast";

interface ExampleSentenceManagerProps {
  wordId: string;
  wordArabic: string;
  wordEnglish: string;
  wordType?: string;
  wordNotes?: string;
}

export function ExampleSentenceManager({
  wordId,
  wordArabic,
  wordEnglish,
  wordType,
  wordNotes,
}: ExampleSentenceManagerProps) {
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editFormData, setEditFormData] = useState<SentenceInput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Load sentences on mount
  useEffect(() => {
    if (wordId) {
      loadSentences();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordId]);

  const loadSentences = async () => {
    try {
      const loaded = await SentenceService.getSentencesForWord(wordId);
      setSentences(loaded);
    } catch {
      toast({
        variant: "destructive",
        title: "Failed to load sentences",
      });
    }
  };

  const handleAddNew = () => {
    setIsAddingNew(true);
    setEditingId(null);
    setEditFormData({
      arabic: "",
      transliteration: "",
      english: "",
    });
  };

  const handleEdit = (sentence: Sentence) => {
    setEditingId(sentence.id);
    setIsAddingNew(false);
    setEditFormData({
      arabic: sentence.arabic,
      transliteration: sentence.transliteration,
      english: sentence.english,
    });
  };

  const handleSave = async () => {
    if (!editFormData) return;
    setIsSaving(true);
    setError(null);

    try {
      if (isAddingNew) {
        // Create new sentence
        const created = await SentenceService.createSentence(editFormData, wordId);
        if (created) {
          setSentences([...sentences, created]);
        }
      } else if (editingId) {
        // Update existing sentence
        const updated = await SentenceService.updateSentence(editingId, editFormData);
        if (updated) {
          setSentences(sentences.map(s => s.id === editingId ? updated : s));
        }
      }
      setEditingId(null);
      setIsAddingNew(false);
      setEditFormData(null);
    } catch {
      setError("Failed to save sentence");
      toast({
        variant: "destructive",
        title: "Failed to save sentence",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsAddingNew(false);
    setEditFormData(null);
    setError(null);
  };

  const handleDelete = async (sentenceId: string) => {
    const success = await SentenceService.deleteSentence(sentenceId);
    if (success) {
      setSentences(sentences.filter(s => s.id !== sentenceId));
    }
  };

  const handleGenerateSentence = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-sentence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          word: wordArabic,
          english: wordEnglish,
          type: wordType,
          notes: wordNotes,
          existingData: {
            arabic: editFormData?.arabic || "",
            transliteration: editFormData?.transliteration || "",
            english: editFormData?.english || "",
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `API Error: ${response.status}`);
      }

      const data = await response.json();
      setEditFormData({
        arabic: data.arabic || "",
        transliteration: data.transliteration,
        english: data.english,
      });
    } catch {
      setError("Failed to generate example sentence. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const isEditing = editingId !== null || isAddingNew;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium">Example sentences</label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddNew}
          disabled={isEditing}
          className="flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Add Example
        </Button>
      </div>

      {/* Add new sentence form */}
      {isAddingNew && (
        <div className="border rounded-lg p-4 space-y-3 border-violet-200 bg-violet-50/50">
          {error && (
            <div className="text-red-500 text-sm p-2 bg-red-50 rounded">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm text-gray-500">Arabic</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGenerateSentence}
                disabled={isGenerating}
                className="flex items-center gap-1 text-violet-600 hover:text-violet-700"
              >
                {isGenerating ? (
                  <CircleNotch className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkle className="w-3 h-3" />
                )}
                Generate with Claude
                <span className="flex items-center gap-0.5 text-purple-600 ml-0.5">
                  <Coin className="h-3 w-3" weight="fill" />
                  <span className="text-xs">1</span>
                </span>
              </Button>
            </div>
            <Textarea
              value={editFormData?.arabic || ""}
              onChange={(e) =>
                setEditFormData((prev) =>
                  prev ? { ...prev, arabic: e.target.value } : null
                )
              }
              dir="rtl"
              className="font-arabic text-lg"
              placeholder="أدخل الجملة بالعربية"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-500">Transliteration</label>
            <Input
              value={editFormData?.transliteration || ""}
              onChange={(e) =>
                setEditFormData((prev) =>
                  prev ? { ...prev, transliteration: e.target.value } : null
                )
              }
              placeholder="Enter transliteration"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-500">English</label>
            <Textarea
              value={editFormData?.english || ""}
              onChange={(e) =>
                setEditFormData((prev) =>
                  prev ? { ...prev, english: e.target.value } : null
                )
              }
              placeholder="Enter English translation"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
            >
              <X className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSave}
              disabled={!editFormData?.transliteration || !editFormData?.english || isSaving}
            >
              {isSaving ? (
                <CircleNotch className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Existing sentences */}
      {sentences.map((sentence) => (
        <div key={sentence.id} className="border rounded-lg p-4 space-y-3">
          {editingId === sentence.id ? (
            <>
              {error && (
                <div className="text-red-500 text-sm p-2 bg-red-50 rounded">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-gray-500">Arabic</label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateSentence}
                    disabled={isGenerating}
                    className="flex items-center gap-1 text-violet-600 hover:text-violet-700"
                  >
                    {isGenerating ? (
                      <CircleNotch className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkle className="w-3 h-3" />
                    )}
                    Generate with Claude
                    <span className="flex items-center gap-0.5 text-purple-600 ml-0.5">
                      <Coin className="h-3 w-3" weight="fill" />
                      <span className="text-xs">1</span>
                    </span>
                  </Button>
                </div>
                <Textarea
                  value={editFormData?.arabic || ""}
                  onChange={(e) =>
                    setEditFormData((prev) =>
                      prev ? { ...prev, arabic: e.target.value } : null
                    )
                  }
                  dir="rtl"
                  className="font-arabic text-lg"
                  placeholder="أدخل الجملة بالعربية"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-500">Transliteration</label>
                <Input
                  value={editFormData?.transliteration || ""}
                  onChange={(e) =>
                    setEditFormData((prev) =>
                      prev ? { ...prev, transliteration: e.target.value } : null
                    )
                  }
                  placeholder="Enter transliteration"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-500">English</label>
                <Textarea
                  value={editFormData?.english || ""}
                  onChange={(e) =>
                    setEditFormData((prev) =>
                      prev ? { ...prev, english: e.target.value } : null
                    )
                  }
                  placeholder="Enter English translation"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                >
                  <X className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSave}
                  disabled={!editFormData?.transliteration || !editFormData?.english || isSaving}
                >
                  {isSaving ? (
                    <CircleNotch className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                {sentence.arabic && (
                  <p className="font-arabic text-lg">{sentence.arabic}</p>
                )}
                <p className="text-sm text-gray-500">
                  {sentence.transliteration}
                </p>
                <p className="text-sm">{sentence.english}</p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(sentence)}
                  disabled={isEditing}
                >
                  <PencilSimple className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(sentence.id)}
                  disabled={isEditing}
                >
                  <Trash className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
