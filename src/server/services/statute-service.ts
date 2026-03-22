import { DocumentProcessStatus, JobType } from "@prisma/client";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

import { STATUTE_MAX_SIZE_BYTES } from "@/shared/constants/app";
import {
  statuteListQuerySchema,
  statuteUploadMetadataSchema,
} from "@/shared/schemas/statute";
import type { StatuteDocumentListItem } from "@/shared/types/domain";
import { chunkText } from "@/shared/utils/chunking";
import { isAllowedStatuteFile } from "@/shared/utils/file";
import { resolvePagination } from "@/shared/utils/pagination";
import { prisma } from "@/server/db/client";
import { logger } from "@/server/logger";
import { enqueueJob } from "@/server/repositories/job-repository";
import { embedTexts } from "@/server/services/ai-service";
import { assertBankExists } from "@/server/services/bank-service";
import {
  rebuildQuestionMatchesForBank,
  saveStatuteChunkEmbedding,
} from "@/server/services/matching-service";
import {
  deleteStoredFile,
  readStoredFile,
  saveUploadedFile,
} from "@/server/storage/file-storage";

async function extractDocumentText(storagePath: string, fileName: string) {
  const buffer = await readStoredFile(storagePath);
  const lowerFileName = fileName.toLowerCase();

  if (lowerFileName.endsWith(".txt") || lowerFileName.endsWith(".md")) {
    return buffer.toString("utf8");
  }

  if (lowerFileName.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (lowerFileName.endsWith(".pdf")) {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  }

  throw new Error("当前文件格式暂不支持解析");
}

export async function listStatuteDocuments(bankId: string, rawQuery: unknown) {
  const query = statuteListQuerySchema.parse(rawQuery);
  const where = { bankId };
  const total = await prisma.statuteDocument.count({ where });
  const { page, pageSize, skip, take } = resolvePagination(
    query.page,
    query.pageSize,
    total,
  );

  const items = await prisma.statuteDocument.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take,
    select: {
      id: true,
      title: true,
      fileName: true,
      fileSize: true,
      status: true,
      lastError: true,
      createdAt: true,
    },
  });

  return {
    items: items.map(
      (item) =>
        ({
          ...item,
          createdAt: item.createdAt.toISOString(),
        }) satisfies StatuteDocumentListItem,
    ),
    total,
    page,
    pageSize,
  };
}

export async function uploadStatuteDocument(
  bankId: string,
  title: string,
  file: File,
) {
  const metadata = statuteUploadMetadataSchema.parse({ title });
  await assertBankExists(bankId);

  if (file.size > STATUTE_MAX_SIZE_BYTES) {
    throw new Error("法条资料文件过大，请控制在 20MB 以内");
  }

  if (!isAllowedStatuteFile(file.name)) {
    throw new Error("仅支持 txt、md、docx、pdf 文件");
  }

  const storagePath = await saveUploadedFile(file, "statutes");

  const document = await prisma.statuteDocument.create({
    data: {
      bankId,
      title: metadata.title,
      fileName: file.name,
      fileMime: file.type || "application/octet-stream",
      fileSize: file.size,
      storagePath,
      status: DocumentProcessStatus.PENDING,
    },
  });

  await enqueueJob(JobType.PROCESS_STATUTE_DOCUMENT, {
    documentId: document.id,
  });

  return document;
}

export async function deleteStatuteDocumentById(
  bankId: string,
  documentId: string,
) {
  const document = await prisma.statuteDocument.findFirst({
    where: {
      id: documentId,
      bankId,
    },
  });

  if (!document) {
    throw new Error("法条资料不存在");
  }

  await prisma.statuteDocument.delete({
    where: {
      id: documentId,
    },
  });

  await deleteStoredFile(document.storagePath);
  await enqueueJob(JobType.REBUILD_QUESTION_MATCH, { bankId });
}

export async function processStatuteDocument(documentId: string) {
  const document = await prisma.statuteDocument.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    return;
  }

  await prisma.statuteDocument.update({
    where: { id: documentId },
    data: {
      status: DocumentProcessStatus.PROCESSING,
      lastError: null,
    },
  });

  try {
    const text = await extractDocumentText(
      document.storagePath,
      document.fileName,
    );
    const chunks = chunkText(text);

    await prisma.$transaction([
      prisma.statuteChunk.deleteMany({
        where: {
          documentId,
        },
      }),
      prisma.statuteDocument.update({
        where: {
          id: documentId,
        },
        data: {
          extractedText: text,
          status: DocumentProcessStatus.READY,
          lastError: null,
        },
      }),
      prisma.statuteChunk.createMany({
        data: chunks.map((chunk) => ({
          bankId: document.bankId,
          documentId,
          chunkIndex: chunk.index,
          content: chunk.content,
          preview: chunk.preview,
        })),
      }),
    ]);

    const savedChunks = await prisma.statuteChunk.findMany({
      where: {
        documentId,
      },
      orderBy: {
        chunkIndex: "asc",
      },
      select: {
        id: true,
        content: true,
      },
    });

    const embeddings = await embedTexts(
      savedChunks.map((chunk) => chunk.content),
    );

    for (let index = 0; index < savedChunks.length; index += 1) {
      await saveStatuteChunkEmbedding(savedChunks[index].id, embeddings[index]);
    }

    await enqueueJob(JobType.REBUILD_QUESTION_MATCH, {
      bankId: document.bankId,
    });
  } catch (error) {
    logger.error({ error, documentId }, "法条资料处理失败");

    await prisma.statuteDocument.update({
      where: { id: documentId },
      data: {
        status: DocumentProcessStatus.FAILED,
        lastError: error instanceof Error ? error.message : "未知错误",
      },
    });

    throw error;
  }
}

export async function rebuildMatchesForBank(
  bankId: string,
  questionIds?: string[],
) {
  await rebuildQuestionMatchesForBank(bankId, questionIds);
}
