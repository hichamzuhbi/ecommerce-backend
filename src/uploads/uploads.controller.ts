import {
  BadRequestException,
  Controller,
  InternalServerErrorException,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

interface UploadedImageFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

@ApiTags('uploads')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('image')
  @ApiOperation({ summary: 'Upload single image (Admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 2 * 1024 * 1024,
        files: 1,
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
    }),
  )
  async uploadImage(
    @UploadedFile() file: UploadedImageFile,
  ): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    try {
      return await this.uploadsService.uploadSingleImage(file);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to upload image';
      throw new InternalServerErrorException(message);
    }
  }
}
