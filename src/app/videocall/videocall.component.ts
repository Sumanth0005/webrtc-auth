import { Component, ElementRef, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { WebrtcService } from '../webrtc.service';

@Component({
  selector: 'app-videocall',
  templateUrl: './videocall.component.html',
  styleUrls: ['./videocall.component.css']
})
export class VideocallComponent  implements OnInit, OnDestroy {
  @ViewChild('localVideo', { static: false }) localVideoRef!: ElementRef<HTMLVideoElement>;

  localStream!: MediaStream;
  remoteStreams: { id: string, stream: MediaStream }[] = [];
  peerConnections: { [id: string]: RTCPeerConnection } = {};
  users: string[] = ['You'];

  roomId = '';
  isMicMuted = false;
  isCameraOff = false;
  isDarkMode = false;
  showLeaveConfirm = false;
  showCopiedToast = false;

  constructor(private api: WebrtcService, private router: Router) {}

  ngOnInit(): void {
    this.api.connect(); // Ensure socket is ready
    this.subscribeToSocketEvents();

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      this.isDarkMode = true;
      document.documentElement.classList.add('dark');
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
    this.api.disconnect();
  }

  subscribeToSocketEvents() {
    this.api.onUserJoined().subscribe((id: string) => {
      this.createOffer(id);
      this.users.push(`User ${this.users.length}`);

    });

    this.api.onOffer().subscribe(async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
      await this.createAnswer(from, offer);
    });

    this.api.onAnswer().subscribe(async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
      await this.peerConnections[from]?.setRemoteDescription(new RTCSessionDescription(answer));
    });

    this.api.onIceCandidate().subscribe(async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      if (candidate && this.peerConnections[from]) {
        await this.peerConnections[from].addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    this.api.onUserLeft().subscribe((id: string) => {
      if (this.peerConnections[id]) {
        this.peerConnections[id].close();
        delete this.peerConnections[id];
        this.remoteStreams = this.remoteStreams.filter(s => s.id !== id);
        this.users.pop();
      }
    });
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
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
    this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.api.sendOffer(peerId, offer);
  }

  async createAnswer(peerId: string, offer: RTCSessionDescriptionInit) {
    const pc = this.createPeerConnection(peerId);
    this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream));
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.api.sendAnswer(peerId, answer);
  }

  createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });
    this.peerConnections[peerId] = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.api.sendIceCandidate(peerId, event.candidate);
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      const exists = this.remoteStreams.some(s => s.stream.id === stream.id);
      if (!exists) {
        this.remoteStreams.push({ id: peerId, stream });
      }
    };

    return pc;
  }

  toggleMic() {
    if (!this.localStream) return;
    this.isMicMuted = !this.isMicMuted;
    this.localStream.getAudioTracks().forEach(track => {
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

  leaveCall() {
    this.showLeaveConfirm = true;
  }

  cancelLeave() {
    this.showLeaveConfirm = false;
  }

  confirmLeave() {
    this.cleanup();
    this.api.leaveRoom(this.roomId);
    this.showLeaveConfirm = false;
  }

  cleanup() {
    this.localStream?.getTracks().forEach(track => track.stop());
    Object.values(this.peerConnections).forEach(pc => pc.close());
    this.peerConnections = {};
    this.remoteStreams = [];
    this.users = ['You'];
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    if (this.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
  }

  getRoomLink(): string {
    return `${window.location.origin}/meet/${this.roomId}`;

  }

  copyRoomLink() {
    navigator.clipboard.writeText(this.getRoomLink()).then(() => {
      this.showCopiedToast = true;
      setTimeout(() => this.showCopiedToast = false, 2000);
    });
  }

  trackByStreamId(index: number, item: { id: string, stream: MediaStream }) {
    return item.id;
  }
}
