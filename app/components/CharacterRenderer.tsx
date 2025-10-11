"use client";

import { useEffect, useRef } from "react";

type CharacterRendererProps = {
  baseImageUrl?: string;
};

export default function CharacterRenderer({ baseImageUrl }: CharacterRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const talkingAnimationRef = useRef<number | null>(null);

  // Store image references for animation
  const bodyImg = useRef<HTMLImageElement | null>(null);
  const headImg = useRef<HTMLImageElement | null>(null);
  const eyesImg = useRef<HTMLImageElement | null>(null);
  const mouthImg1 = useRef<HTMLImageElement | null>(null);
  const mouthImg2 = useRef<HTMLImageElement | null>(null);
  const hairImg = useRef<HTMLImageElement | null>(null);

  // Talking animation function
  const startTalkingAnimation = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let startTime = Date.now();
    const mouthFrameDuration = 200; // Switch mouth every 200ms
    const amplitudeX = 1.5; // Horizontal wobble amplitude
    const amplitudeY = 3; // Vertical wobble amplitude

    const animate = () => {
      const elapsed = Date.now() - startTime;

      // Calculate aggressive elastic head wobble with multiple frequencies
      const wobbleX =
        Math.sin(elapsed * 0.015) * amplitudeX +
        Math.sin(elapsed * 0.025) * amplitudeX * 0.5 +
        Math.sin(elapsed * 0.035) * amplitudeX * 0.3;
      const wobbleY =
        Math.cos(elapsed * 0.012) * amplitudeY +
        Math.cos(elapsed * 0.022) * amplitudeY * 0.6 +
        Math.cos(elapsed * 0.032) * amplitudeY * 0.4;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw body (no animation)
      if (bodyImg.current?.complete) {
        ctx.drawImage(bodyImg.current, 0, 0, 300, 300);
      }

      // Draw head group with talking animation and wobble
      if (headImg.current?.complete) {
        ctx.save();
        ctx.translate(wobbleX, wobbleY + 3);
        ctx.drawImage(headImg.current, 0, 0, 300, 300);
        ctx.restore();
      }

      if (eyesImg.current?.complete) {
        ctx.save();
        ctx.translate(wobbleX, wobbleY + 3);
        ctx.drawImage(eyesImg.current, 0, 0, 300, 300);
        ctx.restore();
      }

      // Alternate between mouth1 and mouth2 for talking animation
      const mouthFrame = Math.floor(elapsed / mouthFrameDuration) % 2;
      const currentMouth = mouthFrame === 0 ? mouthImg1.current : mouthImg2.current;

      if (currentMouth?.complete) {
        ctx.save();
        ctx.translate(wobbleX, wobbleY + 3);
        ctx.drawImage(currentMouth, 0, 0, 300, 300);
        ctx.restore();
      }

      if (hairImg.current?.complete) {
        ctx.save();
        ctx.translate(wobbleX, wobbleY + 3);
        ctx.drawImage(hairImg.current, 0, 0, 300, 300);
        ctx.restore();
      }

      // Draw 2 dots with wobble
      ctx.save();
      ctx.translate(wobbleX, wobbleY + 3);
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(130, 140, 2.5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(170, 140, 2.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();

      // Continue animation
      talkingAnimationRef.current = requestAnimationFrame(animate);
    };

    animate();
  };

  const stopTalkingAnimation = () => {
    if (talkingAnimationRef.current) {
      cancelAnimationFrame(talkingAnimationRef.current);
      talkingAnimationRef.current = null;
    }

    // Return to static pose
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw static character
      if (bodyImg.current?.complete) {
        ctx.drawImage(bodyImg.current, 0, 0, 300, 300);
      }

      if (headImg.current?.complete) {
        ctx.drawImage(headImg.current, 0, 3, 300, 300);
      }

      if (eyesImg.current?.complete) {
        ctx.drawImage(eyesImg.current, 0, 3, 300, 300);
      }

      if (mouthImg1.current?.complete) {
        ctx.drawImage(mouthImg1.current, 0, 3, 300, 300);
      }

      if (hairImg.current?.complete) {
        ctx.drawImage(hairImg.current, 0, 3, 300, 300);
      }

      // Draw 2 dots
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(130, 143, 2.5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(170, 143, 2.5, 0, 2 * Math.PI);
      ctx.fill();
    }
  };

  // Draw character on canvas using SVG elements
  useEffect(() => {
    if (baseImageUrl && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Set canvas size
      canvas.width = 300;
      canvas.height = 300;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Group 1: Body (just body)
      const bodyImgElement = document.createElement("img") as HTMLImageElement;
      bodyImgElement.onload = () => {
        bodyImg.current = bodyImgElement;
        ctx.drawImage(bodyImgElement, 0, 0, 300, 300);

        // Group 2: Head (head + eyes + mouth + hair)
        const headImgElement = document.createElement("img") as HTMLImageElement;
        headImgElement.onload = () => {
          headImg.current = headImgElement;
          ctx.drawImage(headImgElement, 0, 0, 300, 300);

          const eyesImgElement = document.createElement("img") as HTMLImageElement;
          eyesImgElement.onload = () => {
            eyesImg.current = eyesImgElement;
            ctx.drawImage(eyesImgElement, 0, 0, 300, 300);

            const mouthImg1Element = document.createElement("img") as HTMLImageElement;
            mouthImg1Element.onload = () => {
              mouthImg1.current = mouthImg1Element;
              ctx.drawImage(mouthImg1Element, 0, 0, 300, 300);

              const mouthImg2Element = document.createElement("img") as HTMLImageElement;
              mouthImg2Element.onload = () => {
                mouthImg2.current = mouthImg2Element;

                const hairImgElement = document.createElement("img") as HTMLImageElement;
                hairImgElement.onload = () => {
                  hairImg.current = hairImgElement;
                  ctx.drawImage(hairImgElement, 0, 0, 300, 300);

                  // Draw painted eyes (2 dots) at the start
                  ctx.fillStyle = "#000000";
                  ctx.beginPath();
                  ctx.arc(130, 143, 2.5, 0, 2 * Math.PI);
                  ctx.fill();

                  ctx.beginPath();
                  ctx.arc(170, 143, 2.5, 0, 2 * Math.PI);
                  ctx.fill();
                };
                hairImgElement.src = "/hair.svg";
              };
              mouthImg2Element.src = "/mouth2.png";
            };
            mouthImg1Element.src = "/mouth1.svg";
          };
          eyesImgElement.src = "/eyes.svg";
        };
        headImgElement.src = "/head.svg";
      };
      bodyImgElement.src = "/body.png";
    }
  }, [baseImageUrl]);

  // Expose animation functions globally for TTS integration
  useEffect(() => {
    // Make animation functions available globally for TTS integration
    (window as any).startTalkingAnimation = startTalkingAnimation;
    (window as any).stopTalkingAnimation = stopTalkingAnimation;

    return () => {
      // Cleanup global functions
      delete (window as any).startTalkingAnimation;
      delete (window as any).stopTalkingAnimation;
    };
  }, []);

  return (
    <div className="relative">
      <div className="character-display">
        <canvas ref={canvasRef} width={300} height={300} className="mx-auto border border-white/20 rounded-lg" />
        <audio ref={audioRef} />
        <div className="text-xs text-white/50 text-center mt-4">Character Generated</div>
      </div>
    </div>
  );
}
