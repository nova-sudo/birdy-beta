import React from "react";

import { Progress } from "@/components/ui/progress"; // Adjust import based on your project structure

/**
 * @param {{ progress: number }} props
 */
export function Loading({ progress }) {
  return (
    <div className="min-h-dvh w-full flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
        <div className="flex flex-col items-center gap-8 w-full max-w-md px-6">
          {/* Animated logo/icon */}
            <div className="w-16 h-16 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <style>{`
              @keyframes fly {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-8px); }
              }
              @keyframes wingFlap {
                0%, 100% { transform: rotateZ(0deg); }
                50% { transform: rotateZ(15deg); }
              }
              .bird-body {
                animation: fly 2s ease-in-out infinite;
              }
              .bird-wing-left {
                animation: wingFlap 0.6s ease-in-out infinite;
                transform-origin: 35px 40px;
              }
              .bird-wing-right {
                animation: wingFlap 0.6s ease-in-out infinite;
                transform-origin: 65px 40px;
              }
                `}</style>
              </defs>
  
              {/* Body */}
              <g className="bird-body">
                <circle cx="50" cy="45" r="12" fill="currentColor" className="text-purple-700" />
                {/* Head */}
                <circle cx="50" cy="32" r="10" fill="currentColor" className="text-purple-700" />
                {/* Eye */}
                <circle cx="53" cy="30" r="2" fill="white" />
                {/* Beak */}
                <polygon points="60,30 65,29 60,31" fill="currentColor" className="text-purple-700" />
                {/* Tail */}
                <polygon points="38,50 28,55 30,48" fill="currentColor" className="text-purple-700/70" />
              </g>
  
              {/* Left Wing */}
              <g className="bird-wing-left">
                <ellipse cx="40" cy="42" rx="8" ry="14" fill="currentColor" className="text-purple-700/80" />
              </g>
  
              {/* Right Wing */}
              <g className="bird-wing-right">
                <ellipse cx="60" cy="42" rx="8" ry="14" fill="currentColor" className="text-purple-700/80" />
              </g>
            </svg>
              </div>
  
              {/* Main text */}
          <div className="flex flex-col gap-3 text-center">
            <h2 className="text-2xl font-bold text-foreground">Loading your contacts</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Preparing your data. This should only take a moment.
            </p>
          </div>
  
          {/* Progress bar container */}
          <div className="w-full flex flex-col gap-2">
            <Progress value={progress} className="w-full h-2" showLabel={false} />
            <p className="text-xs text-muted-foreground text-center font-medium">{Math.round(progress)}% complete</p>
          </div>
  
          {/* Loading dots animation */}
          <div className="flex gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse"
              style={{ animationDelay: "0.2s" }}
            />
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-primary/20 animate-pulse"
              style={{ animationDelay: "0.4s" }}
            />
          </div>
        </div>
      </div>
  );
}