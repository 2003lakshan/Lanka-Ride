"use client";

import { useState, useRef, useEffect } from "react";
import { Compass, Image as ImageIcon, MapPin, Mountain, Palmtree, Waves } from "lucide-react";

interface PackageImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  category?: string;
  fill?: boolean;
}

export default function PackageImage({ src, alt, className = "", category }: PackageImageProps) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  // Check if src is clearly invalid (e.g. an HTML webpage URL rather than an image)
  const isHtmlWebpage = src && !src.startsWith("data:") && (
    src.includes("/things-to-do-") ||
    src.endsWith("/") ||
    src.includes(".html") ||
    !src.match(/\.(jpeg|jpg|png|webp|avif|svg)(\?.*)?$/i) && !src.includes("images.unsplash.com") && !src.includes("gstatic.com") && !src.startsWith("/uploads/")
  );

  const shouldFallback = error || !src || isHtmlWebpage;

  const getCategoryFallback = () => {
    const cat = (category || "").toLowerCase();
    if (cat.includes("beach") || cat.includes("island")) {
      return {
        bg: "from-teal-600 via-cyan-700 to-blue-900",
        icon: <Waves size={36} className="text-white/80" />,
        label: "Coastal Tour"
      };
    }
    if (cat.includes("hill") || cat.includes("ella") || cat.includes("kandy")) {
      return {
        bg: "from-emerald-700 via-teal-800 to-slate-900",
        icon: <Mountain size={36} className="text-white/80" />,
        label: "Highland & Tea Country"
      };
    }
    if (cat.includes("safari")) {
      return {
        bg: "from-amber-700 via-orange-800 to-stone-900",
        icon: <Compass size={36} className="text-white/80" />,
        label: "Wildlife Safari"
      };
    }
    return {
      bg: "from-blue-700 via-indigo-800 to-slate-900",
      icon: <Palmtree size={36} className="text-white/80" />,
      label: "Sri Lanka Tour"
    };
  };

  if (shouldFallback) {
    const fb = getCategoryFallback();
    return (
      <div className={`w-full h-full bg-gradient-to-br ${fb.bg} flex flex-col items-center justify-center p-4 text-center select-none ${className}`}>
        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xs mb-2">
          {fb.icon}
        </div>
        <span className="text-xs font-extrabold uppercase tracking-widest text-white/90 drop-shadow-sm">{fb.label}</span>
        <span className="text-[11px] text-white/70 line-clamp-1 max-w-[80%] mt-0.5">{alt}</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden w-full h-full bg-slate-100 ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 bg-slate-200 animate-pulse flex items-center justify-center text-slate-400">
          <ImageIcon size={28} />
        </div>
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

