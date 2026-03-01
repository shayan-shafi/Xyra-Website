"use client";

interface CompactCardProps {
  title: string;
  description?: string;
}

export default function CompactCard({
  title,
  description = "",
}: CompactCardProps) {
  return (
    <div className="row-span-1 bg-white border border-black p-3 md:p-5 h-full flex flex-col justify-center overflow-hidden">

      <h3 className="font-serif text-base md:text-xl text-black mb-1 truncate">
        {title}
      </h3>
      {description && (
        <p className="font-mono text-[10px] md:text-xs text-black/40 line-clamp-1 md:line-clamp-2">
          {description}
        </p>
      )}
    </div>
  );
}
