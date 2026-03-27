import { Injectable } from '@nestjs/common';

@Injectable()
export class UploadsService {
  getImageUrl(filename: string): string {
    const baseUrl = 'https://ecommerce-backend-1-kxpv.onrender.com/api';
    return `${baseUrl}/uploads/${filename}`;
  }

  buildSingleImageResponse(filename: string): { url: string } {
    return { url: this.getImageUrl(filename) };
  }

  buildMultipleImagesResponse(filenames: string[]): { urls: string[] } {
    return { urls: filenames.map((filename) => this.getImageUrl(filename)) };
  }
}
