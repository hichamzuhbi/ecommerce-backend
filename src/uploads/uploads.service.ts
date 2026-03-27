import { Injectable } from '@nestjs/common';

@Injectable()
export class UploadsService {
  getImageUrl(filename: string): string {
    const normalizedFilename = filename.replace(/^\/+/, '');
    const relativePath = `/uploads/${normalizedFilename}`;

    const configuredBaseUrl = process.env.APP_URL?.trim();

    if (!configuredBaseUrl) {
      return relativePath;
    }

    return `${configuredBaseUrl.replace(/\/+$/, '')}${relativePath}`;
  }

  buildSingleImageResponse(filename: string): { url: string } {
    return { url: this.getImageUrl(filename) };
  }

  buildMultipleImagesResponse(filenames: string[]): { urls: string[] } {
    return { urls: filenames.map((filename) => this.getImageUrl(filename)) };
  }
}
