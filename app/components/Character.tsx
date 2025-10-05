"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";

export type AnimationType = "idle" | "talking" | "walking" | "dancing";
export type CharacterState = "playing" | "paused" | "stopped";

export interface AnimationConfig {
  frames: string[];
  frameDuration: number; // milliseconds per frame
  loop: boolean;
  onComplete?: () => void;
  onFrameChange?: (frameIndex: number) => void;
}

export interface CharacterProps {
  baseFrames: string[];
  talkingFrames?: string[];
  walkingFrames?: string[];
  dancingFrames?: string[];
  initialAnimation?: AnimationType;
  className?: string;
  style?: React.CSSProperties;
  width?: number;
  height?: number;
}

// Character class for managing character state and animations
export class CharacterManager {
  private currentAnimation: AnimationConfig | null = null;
  private animationTimer: NodeJS.Timeout | null = null;
  private currentFrameIndex = 0;
  private state: CharacterState = "stopped";
  private onFrameChange?: (frameIndex: number) => void;

  constructor(private animations: Record<AnimationType, AnimationConfig>) {}

  playAnimation(type: AnimationType, onFrameChange?: (frameIndex: number) => void): void {
    if (this.currentAnimation) {
      this.stopAnimation();
    }

    const animation = this.animations[type];
    if (!animation) {
      console.warn(`Animation type "${type}" not found`);
      return;
    }

    this.currentAnimation = animation;
    this.currentFrameIndex = 0;
    this.state = "playing";
    this.onFrameChange = onFrameChange;

    this.startAnimationLoop();
  }

  pauseAnimation(): void {
    if (this.state === "playing" && this.animationTimer) {
      clearInterval(this.animationTimer);
      this.state = "paused";
    }
  }

  resumeAnimation(): void {
    if (this.state === "paused" && this.currentAnimation) {
      this.state = "playing";
      this.startAnimationLoop();
    }
  }

  stopAnimation(): void {
    if (this.animationTimer) {
      clearInterval(this.animationTimer);
      this.animationTimer = null;
    }
    this.currentAnimation = null;
    this.currentFrameIndex = 0;
    this.state = "stopped";
    this.onFrameChange = undefined;
  }

  getCurrentFrame(): string | null {
    if (!this.currentAnimation) return null;
    return this.currentAnimation.frames[this.currentFrameIndex] || null;
  }

  getCurrentFrameIndex(): number {
    return this.currentFrameIndex;
  }

  getState(): CharacterState {
    return this.state;
  }

  getAnimationType(): AnimationType | null {
    if (!this.currentAnimation) return null;
    return (
      (Object.keys(this.animations).find(
        key => this.animations[key as AnimationType] === this.currentAnimation
      ) as AnimationType) || null
    );
  }

  private startAnimationLoop(): void {
    if (!this.currentAnimation) return;

    this.animationTimer = setInterval(() => {
      if (!this.currentAnimation) return;

      // Move to next frame
      this.currentFrameIndex++;

      // Check if animation should loop or end
      if (this.currentFrameIndex >= this.currentAnimation.frames.length) {
        if (this.currentAnimation.loop) {
          this.currentFrameIndex = 0;
        } else {
          this.stopAnimation();
          if (this.currentAnimation.onComplete) {
            this.currentAnimation.onComplete();
          }
          return;
        }
      }

      // Notify frame change
      if (this.onFrameChange) {
        this.onFrameChange(this.currentFrameIndex);
      }
    }, this.currentAnimation.frameDuration);
  }
}

// React component that uses the CharacterManager
export function Character({
  baseFrames,
  talkingFrames = [],
  walkingFrames = [],
  dancingFrames = [],
  initialAnimation = "idle",
  className = "",
  style = {},
  width = 200,
  height = 200,
}: CharacterProps) {
  const managerRef = useRef<CharacterManager | null>(null);
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [animationState, setAnimationState] = useState<CharacterState>("stopped");

  // Initialize character manager
  useEffect(() => {
    const animations: Record<AnimationType, AnimationConfig> = {
      idle: {
        frames: baseFrames,
        frameDuration: 500,
        loop: true,
      },
      talking: {
        frames: talkingFrames.length > 0 ? talkingFrames : baseFrames,
        frameDuration: 200,
        loop: true,
      },
      walking: {
        frames: walkingFrames.length > 0 ? walkingFrames : baseFrames,
        frameDuration: 150,
        loop: true,
      },
      dancing: {
        frames: dancingFrames.length > 0 ? dancingFrames : baseFrames,
        frameDuration: 300,
        loop: true,
      },
    };

    managerRef.current = new CharacterManager(animations);

    // Start initial animation
    if (baseFrames.length > 0) {
      managerRef.current.playAnimation(initialAnimation, frameIndex => {
        setCurrentFrame(managerRef.current?.getCurrentFrame() || null);
        setAnimationState(managerRef.current?.getState() || "stopped");
      });
    }

    return () => {
      managerRef.current?.stopAnimation();
    };
  }, [baseFrames, talkingFrames, walkingFrames, dancingFrames, initialAnimation]);

  const playAnimation = useCallback((type: AnimationType) => {
    managerRef.current?.playAnimation(type, frameIndex => {
      setCurrentFrame(managerRef.current?.getCurrentFrame() || null);
      setAnimationState(managerRef.current?.getState() || "stopped");
    });
  }, []);

  const pauseAnimation = useCallback(() => {
    managerRef.current?.pauseAnimation();
    setAnimationState(managerRef.current?.getState() || "stopped");
  }, []);

  const resumeAnimation = useCallback(() => {
    managerRef.current?.resumeAnimation();
    setAnimationState(managerRef.current?.getState() || "stopped");
  }, []);

  const stopAnimation = useCallback(() => {
    managerRef.current?.stopAnimation();
    setCurrentFrame(null);
    setAnimationState("stopped");
  }, []);

  return {
    // Render function
    render: () => (
      <div className={`character-container ${className}`} style={style}>
        {currentFrame ? (
          <Image
            src={currentFrame}
            alt="Character animation"
            width={width}
            height={height}
            className="mx-auto"
            unoptimized
          />
        ) : (
          <div className="mx-auto bg-gray-200 flex items-center justify-center text-gray-500" style={{ width, height }}>
            No animation loaded
          </div>
        )}

        {/* Animation controls (optional - can be used for debugging) */}
        <div className="flex gap-2 mt-2 justify-center">
          <button
            onClick={() => playAnimation("idle")}
            className={`px-3 py-1 text-sm rounded ${
              animationState === "playing" && managerRef.current?.getAnimationType() === "idle"
                ? "bg-blue-600 text-white"
                : "bg-gray-200"
            }`}
          >
            Idle
          </button>
          <button
            onClick={() => playAnimation("talking")}
            className={`px-3 py-1 text-sm rounded ${
              animationState === "playing" && managerRef.current?.getAnimationType() === "talking"
                ? "bg-blue-600 text-white"
                : "bg-gray-200"
            }`}
          >
            Talking
          </button>
          <button
            onClick={() => playAnimation("walking")}
            className={`px-3 py-1 text-sm rounded ${
              animationState === "playing" && managerRef.current?.getAnimationType() === "walking"
                ? "bg-blue-600 text-white"
                : "bg-gray-200"
            }`}
          >
            Walking
          </button>
          <button
            onClick={() => playAnimation("dancing")}
            className={`px-3 py-1 text-sm rounded ${
              animationState === "playing" && managerRef.current?.getAnimationType() === "dancing"
                ? "bg-blue-600 text-white"
                : "bg-gray-200"
            }`}
          >
            Dancing
          </button>
          {animationState === "playing" ? (
            <button onClick={pauseAnimation} className="px-3 py-1 text-sm rounded bg-yellow-600 text-white">
              Pause
            </button>
          ) : (
            <button onClick={resumeAnimation} className="px-3 py-1 text-sm rounded bg-green-600 text-white">
              Play
            </button>
          )}
          <button onClick={stopAnimation} className="px-3 py-1 text-sm rounded bg-red-600 text-white">
            Stop
          </button>
        </div>

        {/* Animation state info */}
        <div className="text-xs text-gray-500 text-center mt-1">
          State: {animationState} | Frame: {managerRef.current?.getCurrentFrameIndex() || 0}
        </div>
      </div>
    ),

    // Animation control methods
    playAnimation,
    pauseAnimation,
    resumeAnimation,
    stopAnimation,

    // State getters
    getCurrentFrame: () => currentFrame,
    getAnimationState: () => animationState,
    getCurrentFrameIndex: () => managerRef.current?.getCurrentFrameIndex() || 0,
    getAnimationType: () => managerRef.current?.getAnimationType() || null,

    // Manager instance for advanced usage
    manager: managerRef.current,
  };
}

// Hook version for functional components
export function useCharacter(
  baseFrames: string[],
  talkingFrames: string[] = [],
  walkingFrames: string[] = [],
  dancingFrames: string[] = [],
  initialAnimation: AnimationType = "idle"
) {
  const managerRef = useRef<CharacterManager | null>(null);
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [animationState, setAnimationState] = useState<CharacterState>("stopped");

  useEffect(() => {
    const animations: Record<AnimationType, AnimationConfig> = {
      idle: {
        frames: baseFrames,
        frameDuration: 500,
        loop: true,
      },
      talking: {
        frames: talkingFrames.length > 0 ? talkingFrames : baseFrames,
        frameDuration: 200,
        loop: true,
      },
      walking: {
        frames: walkingFrames.length > 0 ? walkingFrames : baseFrames,
        frameDuration: 150,
        loop: true,
      },
      dancing: {
        frames: dancingFrames.length > 0 ? dancingFrames : baseFrames,
        frameDuration: 300,
        loop: true,
      },
    };

    managerRef.current = new CharacterManager(animations);

    if (baseFrames.length > 0) {
      managerRef.current.playAnimation(initialAnimation, frameIndex => {
        setCurrentFrame(managerRef.current?.getCurrentFrame() || null);
        setAnimationState(managerRef.current?.getState() || "stopped");
      });
    }

    return () => {
      managerRef.current?.stopAnimation();
    };
  }, [baseFrames, talkingFrames, walkingFrames, dancingFrames, initialAnimation]);

  const playAnimation = useCallback((type: AnimationType) => {
    managerRef.current?.playAnimation(type, frameIndex => {
      setCurrentFrame(managerRef.current?.getCurrentFrame() || null);
      setAnimationState(managerRef.current?.getState() || "stopped");
    });
  }, []);

  const pauseAnimation = useCallback(() => {
    managerRef.current?.pauseAnimation();
    setAnimationState(managerRef.current?.getState() || "stopped");
  }, []);

  const resumeAnimation = useCallback(() => {
    managerRef.current?.resumeAnimation();
    setAnimationState(managerRef.current?.getState() || "stopped");
  }, []);

  const stopAnimation = useCallback(() => {
    managerRef.current?.stopAnimation();
    setCurrentFrame(null);
    setAnimationState("stopped");
  }, []);

  return {
    currentFrame,
    animationState,
    playAnimation,
    pauseAnimation,
    resumeAnimation,
    stopAnimation,
    getCurrentFrameIndex: () => managerRef.current?.getCurrentFrameIndex() || 0,
    getAnimationType: () => managerRef.current?.getAnimationType() || null,
    manager: managerRef.current,
  };
}
