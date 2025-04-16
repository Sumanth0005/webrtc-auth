import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FaceDetectService } from '../face-detect.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-face-auth',
  templateUrl: './face-auth.component.html',
  styleUrls: ['./face-auth.component.css']
})
export class FaceAuthComponent implements OnInit {
  @ViewChild('videoElement') videoElementRef!: ElementRef<HTMLVideoElement>;

  roomId = '';
  result = '';
  isLoading = false;
  cameraAccessDenied = false;

  constructor(
    private faceService: FaceDetectService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  async ngOnInit() {
    this.roomId = this.route.snapshot.paramMap.get('roomId') || '';

    try {
      await this.faceService.loadModels();
      await this.faceService.loadReferenceImages();
      await this.startVideo();
      this.faceService.createCanvasOverlay(this.videoElementRef.nativeElement);
    } catch (error) {
      console.error('Init error:', error);
      this.result = 'Initialization failed. Check console for details.';
    }
  }

  async startVideo() {
    try {
      const video = this.videoElementRef.nativeElement;
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      await video.play();
    } catch (error) {
      console.error('Webcam error:', error);
      this.result = '🚫 Cannot access webcam. Please check camera permissions.';
      this.cameraAccessDenied = true;
    }
  }

  async verify() {
    if (this.cameraAccessDenied) {
      this.result = '🚫 Cannot verify without webcam access.';
      return;
    }

    this.isLoading = true;
    this.result = '🔍 Verifying...';

    try {
      const result = await this.faceService.verify(this.videoElementRef.nativeElement);

      if (result.matched) {
        this.result = `✅ Face matched: ${result.label}`;
        setTimeout(() => {
          this.router.navigate(['/call', this.roomId]);
        }, 500);
      } else {
        this.result = '❌ Face not recognized. Please try again.';
      }
    } catch (error) {
      console.error('Verification error:', error);
      this.result = '⚠️ Error verifying face. Please try again.';
    }

    this.isLoading = false;
  }
}
