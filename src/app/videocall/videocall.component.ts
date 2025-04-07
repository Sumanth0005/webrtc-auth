import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  OnDestroy,
} from '@angular/core';
import { Router } from '@angular/router';
import { WebrtcService } from '../webrtc.service';

@Component({
  selector: 'app-videocall',
  templateUrl: './videocall.component.html',
  styleUrls: ['./videocall.component.css'],
})
export class VideocallComponent implements OnInit, OnDestroy {
toggleChat() {
throw new Error('Method not implemented.');
}
  @ViewChild('localVideo', { static: false })
  localVideoRef!: ElementRef<HTMLVideoElement>;

  localStream!: MediaStream;
  remoteStreams: { id: string; stream: MediaStream }[] = [];
  peerConnections: { [id: string]: RTCPeerConnection } = {};
  users: string[] = ['You'];

  roomId = '';
  isMicMuted = false;
  isCameraOff = false;
  copied: boolean = false;
  showLeaveConfirm = false;
  showCopiedToast = false;
  showParticipants: any;
  isScreenSharing = false;
  screenTrack: MediaStreamTrack | null = null;

  constructor(private api: WebrtcService, private router: Router) {}

  ngOnInit(): void {
    this.api.connect();
    this.subscribeToSocketEvents();
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

    this.api.onOffer().subscribe(async ({ from, offer }) => {
      await this.createAnswer(from, offer);
    });

    this.api.onAnswer().subscribe(async ({ from, answer }) => {
      await this.peerConnections[from]?.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    });

    this.api.onIceCandidate().subscribe(async ({ from, candidate }) => {
      if (candidate && this.peerConnections[from]) {
        await this.peerConnections[from].addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      }
    });

    this.api.onUserLeft().subscribe((id: string) => {
      if (this.peerConnections[id]) {
        this.peerConnections[id].close();
        delete this.peerConnections[id];
        this.remoteStreams = this.remoteStreams.filter((s) => s.id !== id);
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
    this.localStream?.getTracks().forEach((track) => track.stop());
    Object.values(this.peerConnections).forEach((pc) => pc.close());
    this.peerConnections = {};
    this.remoteStreams = [];
    this.users = ['You'];
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
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }


  trackByStreamId(index: number, item: { id: string; stream: MediaStream }) {
    return item.id;
  }

  async toggleScreenShare() {
    if (!this.isScreenSharing) {
      try {
        const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
        const screenVideoTrack = screenStream.getVideoTracks()[0];
        this.screenTrack = screenVideoTrack;

        Object.values(this.peerConnections).forEach((pc) => {
          const senders = pc.getSenders().filter(sender => sender.track?.kind === 'video');
          if (senders.length) {
            senders[0].replaceTrack(screenVideoTrack);
          }
        });

        const video = this.localVideoRef?.nativeElement;
        if (video) {
          video.srcObject = screenStream;
          video.play();
        }

        this.isScreenSharing = true;

        screenVideoTrack.onended = () => {
          this.stopScreenShare();
        };
      } catch (error) {
        console.error('Error during screen sharing:', error);
      }
    } else {
      this.stopScreenShare();
    }
  }

  stopScreenShare() {
    if (this.screenTrack) {
      this.screenTrack.stop();
    }

    const webcamTrack = this.localStream.getVideoTracks()[0];
    Object.values(this.peerConnections).forEach((pc) => {
      const senders = pc.getSenders().filter(sender => sender.track?.kind === 'video');
      if (senders.length) {
        senders[0].replaceTrack(webcamTrack);
      }
    });

    const video = this.localVideoRef?.nativeElement;
    if (video) {
      video.srcObject = this.localStream;
      video.play();
    }

    this.isScreenSharing = false;
  }
}