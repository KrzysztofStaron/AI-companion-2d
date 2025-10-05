// Examples of how to use the FrameExtractor and Character classes

import { FrameExtractor } from "../pre-processing/split";
import { CharacterManager, AnimationType } from "../components/Character";

/**
 * EXAMPLE 1: Using FrameExtractor to split sprite sheets
 */
export async function exampleFrameExtractor() {
  const extractor = new FrameExtractor();

  // Extract frames from a sprite sheet
  const baseFrames = await extractor.extractFrames("/base.png", 2, 2, "character-base");
  const talkingFrames = await extractor.extractFrames("/talkingAnimation.png", 3, 1, "character-talking");

  console.log(`Extracted ${baseFrames.length} base frames`);
  console.log(`Extracted ${talkingFrames.length} talking frames`);

  // Get individual frames
  const firstFrame = extractor.getFrame("/base.png", 0);
  const allFrames = extractor.getAllFrames("/talkingAnimation.png");

  console.log(`First frame data URL length: ${firstFrame?.length || 0}`);
  console.log(`All talking frames: ${allFrames?.length || 0}`);

  // Cache management
  console.log(`Current cache size: ${extractor.getCacheSize()}`);
  extractor.clearCache(); // Clear all cache
  // extractor.clearCache("/base.png"); // Clear specific sprite sheet
}

/**
 * EXAMPLE 2: Using CharacterManager for animation control
 */
export function exampleCharacterManager() {
  // Create animation configurations
  const animations = {
    idle: {
      frames: [], // Your base frames here
      frameDuration: 500,
      loop: true,
    },
    talking: {
      frames: [], // Your talking frames here
      frameDuration: 200,
      loop: true,
    },
    walking: {
      frames: [], // Your walking frames here
      frameDuration: 150,
      loop: true,
    },
    dancing: {
      frames: [], // Your dancing frames here
      frameDuration: 300,
      loop: true,
    },
  };

  const character = new CharacterManager(animations);

  // Control animations
  character.playAnimation("idle");
  console.log(`Current state: ${character.getState()}`);
  console.log(`Current frame index: ${character.getCurrentFrameIndex()}`);

  // Pause and resume
  setTimeout(() => {
    character.pauseAnimation();
    console.log(`After pause: ${character.getState()}`);

    setTimeout(() => {
      character.resumeAnimation();
      console.log(`After resume: ${character.getState()}`);
    }, 1000);
  }, 2000);

  // Listen to frame changes
  character.playAnimation("talking", frameIndex => {
    console.log(`Talking frame changed to: ${frameIndex}`);
    const currentFrame = character.getCurrentFrame();
    if (currentFrame) {
      // Do something with the current frame
      console.log(`Current frame data URL length: ${currentFrame.length}`);
    }
  });

  // Stop animation
  setTimeout(() => {
    character.stopAnimation();
    console.log(`Final state: ${character.getState()}`);
  }, 5000);
}

/**
 * EXAMPLE 3: Advanced usage with callbacks and custom configurations
 */
export function exampleAdvancedUsage() {
  const extractor = new FrameExtractor();

  // Extract frames asynchronously
  Promise.all([
    extractor.extractFrames("/base.png", 2, 2),
    extractor.extractFrames("/talkingAnimation.png", 3, 1),
  ]).then(([baseFrames, talkingFrames]) => {
    const animations = {
      idle: {
        frames: baseFrames,
        frameDuration: 500,
        loop: true,
        onComplete: () => console.log("Idle animation completed (looped)"),
      },
      talking: {
        frames: talkingFrames,
        frameDuration: 200,
        loop: true,
        onFrameChange: frameIndex => {
          console.log(`Frame ${frameIndex} of talking animation`);
        },
      },
    };

    const character = new CharacterManager(animations);

    // Start talking animation
    character.playAnimation("talking");

    // Custom frame access
    const specificFrame = character.getCurrentFrame();
    if (specificFrame) {
      // Save or manipulate the current frame
      console.log(`Current frame for saving: ${specificFrame.substring(0, 50)}...`);
    }
  });
}

/**
 * EXAMPLE 4: Performance monitoring
 */
export function examplePerformanceMonitoring() {
  const extractor = new FrameExtractor();

  console.log(`Initial cache size: ${extractor.getCacheSize()}`);

  // Extract multiple sprite sheets
  Promise.all([
    extractor.extractFrames("/sprite1.png", 2, 2, "sprite1"),
    extractor.extractFrames("/sprite2.png", 3, 1, "sprite2"),
    extractor.extractFrames("/sprite3.png", 2, 3, "sprite3"),
  ]).then(() => {
    console.log(`Cache size after extraction: ${extractor.getCacheSize()}`);

    // Get cached frames (no re-processing)
    const cachedFrames1 = extractor.getAllFrames("sprite1");
    const cachedFrames2 = extractor.getAllFrames("sprite2");

    console.log(`Cached frames 1: ${cachedFrames1?.length || 0}`);
    console.log(`Cached frames 2: ${cachedFrames2?.length || 0}`);

    // Clear specific cache
    extractor.clearCache("sprite1");
    console.log(`Cache size after clearing sprite1: ${extractor.getCacheSize()}`);
  });
}
