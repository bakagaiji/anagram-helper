
"use client";

import { useEffect, useState } from "react";

interface SavedCandidate {
  id: string;
  phrase: string[];
  remaining: string[];
  cursor: number;
  createdAt: number;
}

function normalizeInput(text: string) {
  return text
    .replace(/[\u30A1-\u30F6]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 0x60)
    )
    .replace(/\s/g, "");
}

function sortJapanese(chars: string[]) {
  return [...chars].sort((a, b) =>
    a.localeCompare(b, "ja")
  );
}

function splitPhrase(text: string, merge: boolean): string[] {
  const chars = [...text];
  if (!merge) {
    return chars;
  }

  // 小文字を直前の文字と結合する
  const result: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    if (/[ゃゅょぁぃぅぇぉっ]/.test(chars[i]) && result.length > 0) {
      // 小文字なので直前の文字と結合
      result[result.length - 1] += chars[i];
    } else {
      result.push(chars[i]);
    }
  }
  return result;
}

const STORAGE_KEY = "anagram_candidates";

export default function Home() {
  const [source, setSource] = useState("");
  const [remaining, setRemaining] = useState<string[]>([]);
  const [phrase, setPhrase] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const [mergeSmallChars, setMergeSmallChars] = useState(false);
  const [candidates, setCandidates] = useState<SavedCandidate[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setCandidates(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load candidates:", e);
      }
    }
  }, []);

  useEffect(() => {
    const normalized = normalizeInput(source);
    const split = splitPhrase(normalized, mergeSmallChars);

    setRemaining(sortJapanese([...split]));
    setPhrase([]);
    setCursor(0);
  }, [source, mergeSmallChars]);

  const saveCandidate = () => {
    if (phrase.length === 0) {
      alert("作成中のフレーズが空です。");
      return;
    }

    const newCandidate: SavedCandidate = {
      id: Date.now().toString(),
      phrase: [...phrase],
      remaining: [...remaining],
      cursor: cursor,
      createdAt: Date.now(),
    };

    const updatedCandidates = [newCandidate, ...candidates];
    setCandidates(updatedCandidates);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updatedCandidates)
    );
  };

  const restoreCandidate = (candidate: SavedCandidate) => {
    setPhrase([...candidate.phrase]);
    setRemaining([...candidate.remaining]);
    setCursor(candidate.cursor);
  };

  const deleteCandidate = (id: string) => {
    const updatedCandidates = candidates.filter(
      (c) => c.id !== id
    );
    setCandidates(updatedCandidates);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updatedCandidates)
    );
  };

  if (!mounted) {
    return null;
  }

  const moveToPhrase = (index: number) => {
    const char = remaining[index];

    const nextRemaining = [...remaining];
    nextRemaining.splice(index, 1);

    setRemaining(nextRemaining);
    setPhrase((prev) => {
      const updated = [...prev];
      updated.splice(cursor, 0, char);
      return updated;
    });
    setCursor((prev) => prev + 1);
  };

  const moveBackToRemaining = (index: number) => {
    const char = phrase[index];

    const nextPhrase = [...phrase];
    nextPhrase.splice(index, 1);

    setPhrase(nextPhrase);
    setRemaining((prev) =>
      sortJapanese([...prev, char])
    );
    
    // カーソルを調整
    if (index < cursor) {
      setCursor((prev) => prev - 1);
    }
  };

  const clearPhrase = () => {
    setRemaining((prev) =>
      sortJapanese([...prev, ...phrase])
    );
    setPhrase([]);
    setCursor(0);
  };

  return (
    <main className="p-10 max-w-5xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">
        日本語アナグラム作成支援くん
      </h1>

      <div className="border rounded p-4 mb-6">
        <h2 className="font-bold mb-2">
          A：元となる語句
        </h2>

        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="ひらがな・カタカナを入力"
          className="w-full h-24 border rounded p-2 mb-3"
        />

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={mergeSmallChars}
            onChange={(e) => setMergeSmallChars(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm text-gray-700">
            小文字を前の文字と結合する
          </span>
        </label>
      </div>

      <div className="border rounded p-4 mb-6">
        <h2 className="font-bold mb-2">
          B：残り文字
        </h2>

        <div className="flex flex-wrap gap-2">
          {remaining.map((char, index) => (
            <button
              key={`${char}-${index}`}
              onClick={() => moveToPhrase(index)}
              className="rounded bg-blue-500 px-3 py-2 text-white hover:bg-blue-600"
            >
              {char}
            </button>
          ))}
        </div>
      </div>

      <div className="border rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">
            C：作成中
          </h2>

          <div className="flex gap-2">
            <button
              onClick={saveCandidate}
              className="rounded bg-green-500 px-3 py-2 text-white hover:bg-green-600"
            >
              保存
            </button>
            <button
              onClick={clearPhrase}
              className="rounded bg-gray-500 px-3 py-2 text-white hover:bg-gray-600"
            >
              クリア
            </button>
          </div>
        </div>

        {/* カーソル表示 */}
        <div className="mb-4 p-3 bg-blue-50 rounded font-mono text-lg">
          {phrase.map((char, index) => (
            <span key={index}>
              <span
                onClick={() => setCursor(index)}
                className="inline-block px-1 cursor-pointer hover:bg-blue-200 rounded"
                title="クリックしてカーソル位置を変更"
              >
                {char}
              </span>
              {cursor === index + 1 && (
                <span className="inline-block bg-orange-400 w-1 h-6 ml-1 animate-pulse"></span>
              )}
            </span>
          ))}
          {cursor === phrase.length && (
            <span className="inline-block bg-orange-400 w-1 h-6 ml-1 animate-pulse"></span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 min-h-[60px]">
          {phrase.map((char, index) => (
            <button
              key={`${char}-${index}`}
              onClick={() =>
                moveBackToRemaining(index)
              }
              className="rounded bg-orange-500 px-3 py-2 text-white hover:bg-orange-600"
            >
              {char}
            </button>
          ))}
        </div>

        <div className="mt-4 text-lg">
          {phrase.join("")}
        </div>
      </div>

      {candidates.length > 0 && (
        <div className="border rounded p-4 mt-6">
          <h2 className="font-bold mb-4">
            保存候補 ({candidates.length})
          </h2>

          <div className="space-y-3">
            {candidates.map((candidate) => (
              <div
                key={candidate.id}
                className="border rounded p-3 bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold">
                      候補: {candidate.phrase.join("")}
                    </p>
                    <p className="text-sm text-gray-600">
                      残: {candidate.remaining.join("")}
                    </p>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() =>
                        restoreCandidate(candidate)
                      }
                      className="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
                    >
                      復元
                    </button>
                    <button
                      onClick={() =>
                        deleteCandidate(candidate.id)
                      }
                      className="rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
                    >
                      削除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

