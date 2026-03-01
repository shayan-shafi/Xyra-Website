"use client";


interface VoiceIndicatorProps {
  transcriptText?: string;
  showTranscript?: boolean;
}

export default function VoiceIndicator({
  transcriptText = "",
  showTranscript = false,
}: VoiceIndicatorProps) {
  return (
    <div className="w-full h-full bg-white/95 flex items-center justify-center">

      <div className="text-center space-y-6">
        {/* Concentric rings */}
        <div className="relative w-24 h-24 mx-auto">
          <div className="absolute inset-0 rounded-full border-4 border-black animate-ping opacity-30" />
          <div className="absolute inset-2 rounded-full border-2 border-black/50" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-black" />
          </div>
        </div>

        {/* Text */}
        <div className="space-y-2 px-8 max-w-md mx-auto">
          <h2 className="text-2xl font-serif text-black">Listening...</h2>
          {showTranscript && transcriptText ? (
            <p className="font-mono text-sm text-black/60 leading-relaxed">
              &ldquo;{transcriptText}&rdquo;
            </p>
          ) : (
            <p className="text-black/40 font-mono text-sm">
              Speak your command
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
