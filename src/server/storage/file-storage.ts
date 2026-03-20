import fs from "node:fs/promises";
import path from "node:path";

import { nanoid } from "nanoid";

import { getServerEnv } from "@/server/env";

export async function ensureUploadDirectory(category: string) {
  const root = getServerEnv().UPLOAD_DIR;
  const target = path.join(root, category);
  await fs.mkdir(target, { recursive: true });
  return target;
}

export async function saveUploadedFile(file: File, category: string) {
  const targetDirectory = await ensureUploadDirectory(category);
  const timestamp = Date.now();
  const safeFileName = `${timestamp}-${nanoid(8)}-${file.name}`;
  const filePath = path.join(targetDirectory, safeFileName);
  const arrayBuffer = await file.arrayBuffer();

  await fs.writeFile(filePath, Buffer.from(arrayBuffer));

  return filePath;
}

export async function readStoredFile(storagePath: string) {
  return fs.readFile(storagePath);
}

export async function deleteStoredFile(storagePath: string) {
  try {
    await fs.unlink(storagePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
