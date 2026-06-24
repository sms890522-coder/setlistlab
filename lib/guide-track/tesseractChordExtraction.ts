import {
  dedupeChords,
  extractChordCandidatesFromText,
  normalizeChord,
  type ChordCandidate,
} from "@/lib/music/chords";

export type TesseractExtractedChord = ChordCandidate & {
  source: "tesseract";
};

export type ExtractedChordResult = {
  chords: TesseractExtractedChord[];
  rawText: string;
  manualMode: boolean;
  warnings: string[];
  provider: "tesseract" | "none";
};

export function getGuideTrackOcrProvider(): "tesseract" | "none" {
  const provider = process.env.NEXT_PUBLIC_GUIDE_TRACK_OCR_PROVIDER?.trim().toLowerCase();
  return provider === "none" ? "none" : "tesseract";
}

export async function extractChordsWithTesseract(input: {
  imageUrl: string;
  onProgress?: (progress: number, status?: string) => void;
}): Promise<ExtractedChordResult> {
  if (getGuideTrackOcrProvider() === "none") {
    return {
      chords: [],
      rawText: "",
      manualMode: true,
      warnings: ["자동 코드 추출이 비활성화되어 있어 수동 입력으로 진행합니다."],
      provider: "none",
    };
  }

  input.onProgress?.(3, "OCR 엔진을 준비하는 중입니다.");

  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (message) => {
      if (typeof message.progress !== "number") return;
      input.onProgress?.(Math.round(message.progress * 100), translateTesseractStatus(message.status));
    },
  });

  try {
    await worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#b/()-.+susmajdimaugminadd♭♯|, ",
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      preserve_interword_spaces: "1",
    });

    input.onProgress?.(12, "악보 이미지에서 텍스트를 읽는 중입니다.");
    const result = await worker.recognize(input.imageUrl);
    const rawText = result.data.text ?? "";
    const wordConfidenceByChord = collectWordConfidence(result.data.blocks);
    const chords = extractChordCandidatesFromText(rawText).map((candidate) => {
      const confidence = Math.max(candidate.confidence, wordConfidenceByChord.get(candidate.chord) ?? 0);
      return {
        ...candidate,
        source: "tesseract" as const,
        confidence,
        needsReview: confidence < 0.7,
      };
    });
    const deduped = dedupeChords(chords) as TesseractExtractedChord[];
    const warnings: string[] = [
      "OCR 결과는 정확하지 않을 수 있으니 저장 전 반드시 코드를 확인해 주세요.",
      "저작권이 있는 악보 이미지는 권리자의 허락 범위 안에서만 사용해 주세요.",
    ];

    if (deduped.length === 0) {
      warnings.unshift("코드를 자동으로 찾지 못했습니다. 악보 이미지가 흐리거나 코드가 작으면 인식이 어려울 수 있습니다.");
    }

    input.onProgress?.(100, "코드 후보 정리를 마쳤습니다.");
    return {
      chords: deduped,
      rawText,
      manualMode: deduped.length === 0,
      warnings,
      provider: "tesseract",
    };
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

function collectWordConfidence(blocks: Tesseract.Block[] | null) {
  const confidenceByChord = new Map<string, number>();
  if (!blocks) return confidenceByChord;

  blocks.forEach((block) => {
    block.paragraphs?.forEach((paragraph) => {
      paragraph.lines?.forEach((line) => {
        line.words?.forEach((word) => {
          const chord = normalizeChord(word.text);
          if (!chord) return;
          const confidence = Math.min(0.99, Math.max(0, (word.confidence ?? 0) / 100));
          const current = confidenceByChord.get(chord) ?? 0;
          if (confidence > current) confidenceByChord.set(chord, confidence);
        });
      });
    });
  });

  return confidenceByChord;
}

function translateTesseractStatus(status?: string) {
  if (!status) return "OCR을 진행하는 중입니다.";
  if (status.includes("loading")) return "OCR 데이터를 불러오는 중입니다.";
  if (status.includes("initializing")) return "OCR 엔진을 초기화하는 중입니다.";
  if (status.includes("recognizing")) return "악보 이미지에서 텍스트를 읽는 중입니다.";
  return "OCR을 진행하는 중입니다.";
}
