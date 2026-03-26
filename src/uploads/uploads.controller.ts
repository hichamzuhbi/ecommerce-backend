import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
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
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { multerOptions } from './multer.config';
import { UploadsService } from './uploads.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

interface UploadedImage {
  filename: string;
}

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
  @UseInterceptors(FileInterceptor('file', multerOptions))
  uploadImage(@UploadedFile() file: UploadedImage): { url: string } {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    return this.uploadsService.buildSingleImageResponse(file.filename);
  }

  @Post('images')
  @ApiOperation({ summary: 'Upload multiple images (Admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
      required: ['files'],
    },
  })
  @UseInterceptors(FilesInterceptor('files', 5, multerOptions))
  uploadImages(@UploadedFiles() files: UploadedImage[]): { urls: string[] } {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one image file is required');
    }

    return this.uploadsService.buildMultipleImagesResponse(
      files.map((file) => file.filename),
    );
  }
}
