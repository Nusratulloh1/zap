-- Photo Moment (vision §C15): фото компании, прикреплённое к закрытому счёту.
-- Относительный путь внутри UPLOAD_DIR; NULL — фото не добавляли.
ALTER TABLE "Split" ADD COLUMN "photoPath" TEXT;
