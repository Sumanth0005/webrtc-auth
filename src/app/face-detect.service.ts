// face-detect.service.ts
import { Injectable } from '@angular/core';
import * as faceapi from 'face-api.js';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface ImageMetadata {
  _id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class FaceDetectService {
  referenceDescriptors: Map<string, Float32Array> = new Map();
  isModelsLoaded = false;

  private readonly backendUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  async loadModels(): Promise<void> {
    if (this.isModelsLoaded) return;

    const MODEL_URL = '/assets/models';
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);

    this.isModelsLoaded = true;
    console.log('✅ Face-api.js models loaded');
  }

  async loadReferenceImages(): Promise<void> {
    try {
      const metadata: ImageMetadata[] = await firstValueFrom(
        this.http.get<ImageMetadata[]>(`${this.backendUrl}/images`)
      );

      if (!metadata.length) {
        console.warn('⚠️ No image metadata found from backend');
        return;
      }

      console.log('📥 Retrieved image metadata:', metadata);

      for (const meta of metadata) {
        const imageUrl = `${this.backendUrl}/image/${meta._id}`;
        const img = await this.loadImage(imageUrl);

        if (!img) {
          console.warn(`⚠️ Failed to load image: ${imageUrl}`);
          continue;
        }

        const detection = await faceapi
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          this.referenceDescriptors.set(meta.name, detection.descriptor);
          console.log(`✅ Descriptor loaded for: ${meta.name}`);
        } else {
          console.warn(`⚠️ No face detected in image: ${meta.name}`);
        }
      }

      console.log('✅ All reference descriptors loaded');
    } catch (error) {
      console.error('❌ Error loading reference images:', error);
    }
  }

  private loadImage(url: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;

      img.onload = () => resolve(img);
      img.onerror = (err) => {
        console.error(`❌ Failed to load image from ${url}`, err);
        resolve(null);
      };
    });
  }

  async verify(
    video: HTMLVideoElement
  ): Promise<{ matched: boolean; label?: string }> {
    console.log('🔍 Starting face verification...');

    if (!this.referenceDescriptors.size) {
      console.warn('⚠️ No reference descriptors loaded');
      return { matched: false };
    }

    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      console.warn('⚠️ No face detected in live video');
      return { matched: false };
    }

    console.log('✅ Face detected in live video');

    let bestMatch = { label: '', distance: Infinity };

    for (const [label, refDescriptor] of this.referenceDescriptors) {
      const distance = faceapi.euclideanDistance(
        refDescriptor,
        detection.descriptor
      );
      console.log(`🔎 Distance to ${label}: ${distance}`);

      if (distance < bestMatch.distance) {
        bestMatch = { label, distance };
      }
    }

    const isMatch = bestMatch.distance < 0.6; // You can change to 0.75 temporarily if needed
    console.log(
      `🧠 Best match: ${bestMatch.label}, Distance: ${bestMatch.distance}, Matched: ${isMatch}`
    );

    return isMatch
      ? { matched: true, label: bestMatch.label }
      : { matched: false };
  }

  createCanvasOverlay(video: HTMLVideoElement): void {
    const canvas = faceapi.createCanvasFromMedia(video);
    document.getElementById('video-container')?.appendChild(canvas);

    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);

    setInterval(async () => {
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks();

      const resized = faceapi.resizeResults(detections, displaySize);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resized);
        faceapi.draw.drawFaceLandmarks(canvas, resized);
      }
    }, 200);
  }
}
