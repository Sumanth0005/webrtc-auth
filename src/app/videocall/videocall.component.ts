import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  OnDestroy,
} from '@angular/core';
import { Router } from '@angular/router';
import { WebrtcService } from '../webrtc.service';
import { Subscription } from 'rxjs';
import { FaceExpresionService } from '../face-expresion.service';

@Component({
  selector: 'app-videocall',
  templateUrl: './videocall.component.html',
  styleUrls: ['./videocall.component.css'],
})
export class VideocallComponent implements OnInit, OnDestroy {
toggleScreenShare() {
throw new Error('Method not implemented.');
}
  @ViewChild('localVideo', { static: false })
  localVideoRef!: ElementRef<HTMLVideoElement>;

  localStream!: MediaStream;
  remoteStreams: { id: string; stream: MediaStream }[] = [];
  peerConnections: { [id: string]: RTCPeerConnection } = {};
  users: string[] = ['You'];
  userNames: { [id: string]: string } = {};

  roomId = '';
  isMicMuted = false;
  isCameraOff = false;
  copied: boolean = false;
  showLeaveConfirm = false;
  showCopiedToast = false;
  showParticipants: boolean = false;
  isScreenSharing = false;
  screenTrack: MediaStreamTrack | null = null;

  mediaRecorder!: MediaRecorder;
  recordedChunks: Blob[] = [];
  isRecording: boolean = false;
  detectedExpression: string = '';
  private subscriptions: Subscription[] = [];

  constructor(
    private api: WebrtcService,
    private router: Router,
    private faceservice: FaceExpresionService
  ) {}

  ngOnInit(): void {
    this.api.connect();
    this.subscribeToSocketEvents();
  }

  ngOnDestroy(): void {
    this.cleanup();
    this.api.disconnect();
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  toggleChat() {
    alert('Chat feature coming soon!');
  }

  subscribeToSocketEvents() {
    this.subscriptions.push(
      this.api.onUserJoined().subscribe((id: string) => {
        if (!this.peerConnections[id]) {
          this.createOffer(id);
          this.userNames[id] = `User ${Object.keys(this.userNames).length + 1}`;
          this.users.push(this.userNames[id]);
        }
      }),

      this.api.onOffer().subscribe(async ({ from, offer }) => {
        await this.createAnswer(from, offer);
      }),

      this.api.onAnswer().subscribe(async ({ from, answer }) => {
        await this.peerConnections[from]?.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
      }),

      this.api.onIceCandidate().subscribe(async ({ from, candidate }) => {
        if (candidate && this.peerConnections[from]) {
          await this.peerConnections[from].addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        }
      }),

      this.api.onUserLeft().subscribe((id: string) => {
        if (this.peerConnections[id]) {
          this.peerConnections[id].close();
          delete this.peerConnections[id];
          this.remoteStreams = this.remoteStreams.filter((s) => s.id !== id);
          this.users = this.users.filter((user) => user !== this.userNames[id]);
          delete this.userNames[id];
        }
      })
    );
  }

  async createRoom() {
    if (!this.roomId) {
      this.roomId = Math.random().toString(36).substring(2, 8);
    }
    await this.initMedia();
    this.api.joinRoom(this.roomId);
  }

  async joinRoom() {
    if (!this.roomId) return;
    await this.initMedia();
    this.api.joinRoom(this.roomId);
  }

  async initMedia() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      const video = this.localVideoRef?.nativeElement;
      if (video) {
        video.srcObject = this.localStream;
        video.play();
      }
    } catch (err) {
      alert('Camera or microphone access denied.');
      console.error(err);
    }
  }

  async createOffer(peerId: string) {
    const pc = this.createPeerConnection(peerId);
    this.localStream
      .getTracks()
      .forEach((track) => pc.addTrack(track, this.localStream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.api.sendOffer(peerId, offer);
  }

  async createAnswer(peerId: string, offer: RTCSessionDescriptionInit) {
    const pc = this.createPeerConnection(peerId);
    this.localStream
      .getTracks()
      .forEach((track) => pc.addTrack(track, this.localStream));
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.api.sendAnswer(peerId, answer);
  }

  createPeerConnection(peerId: string): RTCPeerConnection {
    if (this.peerConnections[peerId]) return this.peerConnections[peerId];

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    this.peerConnections[peerId] = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.api.sendIceCandidate(peerId, event.candidate);
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      const exists = this.remoteStreams.some((s) => s.stream.id === stream.id);
      if (!exists) {
        this.remoteStreams.push({ id: peerId, stream });
      }
    };

    return pc;
  }

  toggleMic() {
    if (!this.localStream) return;
    this.isMicMuted = !this.isMicMuted;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMicMuted;
    });
  }

  toggleCamera() {
    if (!this.localStream) return;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      this.isCameraOff = !videoTrack.enabled;
    }
  }

  toggleParticipants() {
    this.showParticipants = !this.showParticipants;
  }

  cancelLeave() {
    this.showLeaveConfirm = false;
  }

  confirmLeave() {
    this.cleanup();
    this.api.leaveRoom(this.roomId);
    this.showLeaveConfirm = false;
  }

  leaveCall() {
    const confirmLeave = window.confirm(
      'Are you sure you want to leave the call?'
    );
    if (confirmLeave) {
      this.confirmLeave();
    }
  }

  cleanup() {
    if (this.isRecording) {
      this.stopRecording();
    }

    this.localStream?.getTracks().forEach((track) => track.stop());
    Object.values(this.peerConnections).forEach((pc) => pc.close());
    this.peerConnections = {};
    this.remoteStreams = [];
    this.users = ['You'];
    this.userNames = {};
  }

  getRoomLink(): string {
    return `${window.location.origin}/meet/${this.roomId}`;
  }

  copyRoomLink() {
    const link = this.getRoomLink();
    navigator.clipboard.writeText(link).then(() => {
      this.copied = true;
      this.showCopiedToast = true;

      setTimeout(() => {
        this.copied = false;
        this.showCopiedToast = false;
      }, 2000);
    });
  }

  startRecording() {
    if (!this.localStream) return;

    const combinedStream = new MediaStream([
      ...this.localStream.getTracks(),
      ...this.remoteStreams.flatMap((s) => s.stream.getTracks()),
    ]);

    this.mediaRecorder = new MediaRecorder(combinedStream);
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.recordedChunks.push(event.data);
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meeting-${this.roomId}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };

    this.recordedChunks = [];
    this.mediaRecorder.start();
    this.isRecording = true;
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
  }

  getExpressionEmoji(expression: string): string {
    switch (expression.toLowerCase()) {
      case 'happy':
        return '😄';
      case 'sad':
        return '😢';
      case 'angry':
        return '😠';
      case 'surprised':
        return '😲';
      case 'neutral':
        return '😐';
      default:
        return '🙂';
    }
  }

  trackByStreamId(index: number, item: { id: string; stream: MediaStream }) {
    return item.id;
  }
}
