"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import {
  HandLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

import { NormalizedLandmark } from "@mediapipe/tasks-vision";

// Simple custom heuristic translation mapping for demo purposes.
// In a real application, this would be a sophisticated model (e.g., TensorFlow.js)
// taking normalized landmarks as input.
const heuristicTranslation = (landmarks: NormalizedLandmark[][]) => {
  if (!landmarks || landmarks.length === 0) return "";

  // Example dummy logic:
  // We can measure distance between thumb tip (4) and index finger tip (8)
  const thumbTip = landmarks[0][4];
  const indexTip = landmarks[0][8];

  if (!thumbTip || !indexTip) return "";

  const distance = Math.sqrt(
    Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2)
  );

  // Pinch gesture
  if (distance < 0.05) {
    return "Pinch / Yes";
  }

  // Open hand
  return "Hello";
};

export default function SignLanguageTranslator() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [translation, setTranslation] = useState<string>("Waiting for input...");
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);

  // Initialize MediaPipe HandLandmarker
  useEffect(() => {
    const initHandLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
        });
        setHandLandmarker(landmarker);
      } catch (error) {
        console.error("Error initializing HandLandmarker:", error);
      }
    };

    initHandLandmarker();
  }, []);

  // Web Speech API execution
  const speakTranslation = useCallback((text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      if (text && text !== "No hands detected" && text !== "Waiting for input...") {
        // Cancel any ongoing speech so it doesn't queue up too much
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
      }
    }
  }, []);

  const startWebcam = useCallback(() => {
    setIsWebcamActive(true);
  }, []);

  const stopWebcam = useCallback(() => {
    setIsWebcamActive(false);
    setTranslation("Waiting for input...");
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }
  }, []);

  // Frame processing loop
  useEffect(() => {
    let animationFrameId: number;

    const processVideo = async () => {
      if (
        isWebcamActive &&
        webcamRef.current &&
        webcamRef.current.video &&
        webcamRef.current.video.readyState === 4 &&
        handLandmarker &&
        canvasRef.current
      ) {
        const video = webcamRef.current.video;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        // Match canvas dimensions to video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        if (ctx) {
          const startTimeMs = performance.now();
          const results = handLandmarker.detectForVideo(video, startTimeMs);

          ctx.save();
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (results.landmarks && results.landmarks.length > 0) {
            const drawingUtils = new DrawingUtils(ctx);
            for (const landmarks of results.landmarks) {
              drawingUtils.drawConnectors(
                landmarks,
                HandLandmarker.HAND_CONNECTIONS,
                { color: "#00FF00", lineWidth: 5 }
              );
              drawingUtils.drawLandmarks(landmarks, {
                color: "#FF0000",
                lineWidth: 2,
              });
            }

            // Run simple heuristic translation
            const detectedText = heuristicTranslation(results.landmarks);
            if (detectedText) {
              setTranslation((prev) => {
                if (prev !== detectedText) {
                  speakTranslation(detectedText);
                }
                return detectedText;
              });
            }
          } else {
            setTranslation("No hands detected");
          }

          ctx.restore();
        }
      }

      animationFrameId = requestAnimationFrame(processVideo);
    };

    if (isWebcamActive) {
      processVideo();
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isWebcamActive, handLandmarker, speakTranslation]);

  return (
    <div className="flex flex-col items-center gap-6 p-4 w-full max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between w-full items-center gap-4">
        <h1 className="text-2xl font-bold">Sign Language Translator</h1>
        <div className="flex gap-2">
          {!isWebcamActive ? (
            <button
              onClick={startWebcam}
              disabled={!handLandmarker}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {handLandmarker ? "Start Camera" : "Loading Model..."}
            </button>
          ) : (
            <button
              onClick={stopWebcam}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
            >
              Stop Camera
            </button>
          )}
        </div>
      </div>

      <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg border border-gray-700 flex items-center justify-center">
        {isWebcamActive ? (
          <>
            <Webcam
              ref={webcamRef}
              audio={false}
              className="absolute top-0 left-0 w-full h-full object-cover"
              videoConstraints={{ facingMode: "user" }}
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full object-cover z-10"
            />
          </>
        ) : (
          <p className="text-gray-400">Camera is inactive</p>
        )}
      </div>

      <div className="w-full bg-gray-100 dark:bg-gray-800 p-6 rounded-xl shadow-inner min-h-[120px] flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Translation
        </h3>
        <p className="text-xl font-medium">
          {translation}
        </p>
      </div>
    </div>
  );
}
