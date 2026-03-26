/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { BadRequestException } from '@nestjs/common';
import { diskStorage, Options } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const uploadsDir = join(process.cwd(), 'public', 'uploads');

const ensureUploadDir = (): void => {
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }
};

const generateFilename = (originalname: string): string => {
  const name = originalname.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.-]/g, '');
  const fileExt = extname(name);
  const baseName = name.replace(fileExt, '').toLowerCase();
  const timestamp = Date.now();

  return `${baseName}-${timestamp}${fileExt.toLowerCase()}`;
};

export const multerOptions: Options = {
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(
        new BadRequestException(
          'Invalid file type. Only jpg, jpeg, png, and webp are allowed.',
        ),
        false,
      );
      return;
    }

    cb(null, true);
  },
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      ensureUploadDir();
      cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
      cb(null, generateFilename(file.originalname));
    },
  }),
};
