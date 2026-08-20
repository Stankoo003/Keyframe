-- CreateTable
CREATE TABLE "Subtitle" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subtitle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subtitle_videoId_idx" ON "Subtitle"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "Subtitle_videoId_lang_key" ON "Subtitle"("videoId", "lang");

-- AddForeignKey
ALTER TABLE "Subtitle" ADD CONSTRAINT "Subtitle_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
