"use client";

const MAX_IMAGE_SIZE = 1600;
const IMAGE_QUALITY = 0.82;
const MAX_INPUT_BYTES = 12 * 1024 * 1024;

type CloudinaryUploadResponse = {
  secure_url?: string;
  public_id?: string;
  width?: number;
  height?: number;
  bytes?: number;
  original_filename?: string;
  error?: {
    message?: string;
  };
};

export function isCloudinaryUploadConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET);
}

export async function uploadCloudinarySongImage(file: File) {
  if (!isCloudinaryUploadConfigured()) {
    throw new Error("이미지 업로드 설정이 아직 준비되지 않았습니다.");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 업로드할 수 있습니다.");
  }

  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("이미지는 12MB 이하 파일만 업로드할 수 있습니다.");
  }

  const resizedFile = await resizeImage(file);
  const formData = new FormData();
  formData.append("file", resizedFile);
  formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );
  const data = (await response.json()) as CloudinaryUploadResponse;

  if (!response.ok || !data.secure_url) {
    throw new Error(data.error?.message || "이미지를 업로드하지 못했습니다.");
  }

  return {
    url: data.secure_url,
    publicId: data.public_id,
    width: data.width,
    height: data.height,
    bytes: data.bytes,
    originalFilename: data.original_filename,
  };
}

async function resizeImage(file: File) {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_IMAGE_SIZE / image.width, MAX_IMAGE_SIZE / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("이미지를 처리하지 못했습니다.");
  }

  context.drawImage(image, 0, 0, width, height);
  const blob = await canvasToBlob(canvas, "image/webp", IMAGE_QUALITY).catch(() => canvasToBlob(canvas, "image/jpeg", IMAGE_QUALITY));
  const extension = blob.type === "image/jpeg" ? "jpg" : "webp";
  return new File([blob], `${stripExtension(file.name) || "song-image"}.${extension}`, { type: blob.type || "image/webp" });
}

async function loadImage(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("이미지를 압축하지 못했습니다."));
        }
      },
      type,
      quality,
    );
  });
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").trim();
}
