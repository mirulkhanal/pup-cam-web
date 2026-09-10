import { useEffect, useRef } from 'react';

type Props = {
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  className?: string;
};

/** Plays remote/local media. Uses <audio> when the stream has no video. */
export function VideoView({ stream, muted = false, mirror = false, className }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const hasVideo = Boolean(stream?.getVideoTracks().length);
  const hasAudio = Boolean(stream?.getAudioTracks().length);

  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;

    if (hasVideo && video) {
      video.srcObject = stream;
      void video.play().catch(() => {
        /* autoplay may require a gesture; muted local preview is fine */
      });
    }

    if (!hasVideo && hasAudio && audio) {
      audio.srcObject = stream;
      void audio.play().catch((err) => {
        console.warn('audio play blocked', err);
      });
    }
  }, [stream, hasVideo, hasAudio, muted]);

  if (!hasVideo && hasAudio) {
    return <audio ref={audioRef} className={className} autoPlay playsInline muted={muted} />;
  }

  return (
    <video
      ref={videoRef}
      className={className}
      autoPlay
      playsInline
      muted={muted}
      style={mirror ? { transform: 'scaleX(-1)' } : undefined}
    />
  );
}
