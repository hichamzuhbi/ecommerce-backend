import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { extname } from 'path';
import { randomUUID } from 'crypto';

interface UploadFilePayload {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

@Injectable()
export class UploadsService {
  private readonly bucketName = 'products';

  async uploadSingleImage(file: UploadFilePayload): Promise<{ url: string }> {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new Error('Invalid file payload');
    }

    const storagePath = this.generateStoragePath(file.originalname);
    const supabase = this.createSupabaseClient();

    const { error: uploadError } = await supabase.storage
      .from(this.bucketName)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
        cacheControl: '3600',
      });

    if (uploadError) {
      throw new Error(`Supabase upload failed: ${uploadError.message}`);
    }

    const { data } = supabase.storage
      .from(this.bucketName)
      .getPublicUrl(storagePath);

    const publicUrl = data?.publicUrl?.trim();
    if (!publicUrl) {
      throw new Error('Failed to generate public URL for uploaded image');
    }

    return { url: publicUrl };
  }

  getImageUrl(filename: string): string {
    const normalizedFilename = filename.replace(/^\/+/, '');
    const relativePath = `/uploads/${normalizedFilename}`;
    const configuredBaseUrl = process.env.APP_URL?.trim();

    if (!configuredBaseUrl) {
      return relativePath;
    }

    return `${configuredBaseUrl.replace(/\/+$/, '')}${relativePath}`;
  }

  private createSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL?.trim();
    const supabaseKey = process.env.SUPABASE_KEY?.trim();

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Missing SUPABASE_URL or SUPABASE_KEY environment variables',
      );
    }

    return createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  private generateStoragePath(originalname: string): string {
    const rawExtension = extname(originalname).toLowerCase();
    const extension = rawExtension || '.jpg';
    const timestamp = Date.now();

    return `products/${timestamp}-${randomUUID()}${extension}`;
  }
}
