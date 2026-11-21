import React from "react";
import Image from "next/image";
import Link from "next/link";

export interface BrandLogoProps {
  /**
   * "full": Full logo graphic containing the "A" pin and "At Your Service" script.
   * "icon": Simplified "A" map-pin icon graphic only.
   * "mobile-header": Simplified icon + readable HTML text ("At Your Service" + "Powered by Pexora").
   * "desktop-header": Full logo graphic + readable "Powered by Pexora" subtitle beneath.
   * "responsive-header": Automatically switches between mobile-header and desktop-header.
   * "icon-with-text": Simplified icon + readable HTML text.
   */
  variant?: "full" | "icon" | "mobile-header" | "desktop-header" | "responsive-header" | "icon-with-text";
  
  /**
   * "light" for white/light backgrounds (default)
   * "dark" for navy #102A43 or dark backgrounds (uses white text/airplane treatment)
   */
  theme?: "light" | "dark";

  /**
   * Whether to display "Powered by Pexora" tagline beneath where space allows.
   * Default: true
   */
  showTagline?: boolean;

  /**
   * Size presets affecting logo height
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl";

  /**
   * Whether to wrap in a Link to "/" with accessible aria-label
   * Default: true
   */
  linkToHome?: boolean;

  /**
   * Next.js Image priority
   */
  priority?: boolean;

  /**
   * Additional container CSS classes
   */
  className?: string;
}

export default function BrandLogo({
  variant = "responsive-header",
  theme = "light",
  showTagline = true,
  size = "md",
  linkToHome = true,
  priority = true,
  className = ""
}: BrandLogoProps) {
  const isDark = theme === "dark";

  // Asset paths
  const fullLogoSrc = isDark
    ? "/brand/at-your-service-full-logo-dark.png"
    : "/brand/at-your-service-full-logo.png";

  const iconSrc = isDark
    ? "/brand/at-your-service-icon-dark.png"
    : "/brand/at-your-service-icon.png";

  // Height sizing
  const fullHeights = {
    xs: { h: 28, w: 55, text: "text-[9px]" },
    sm: { h: 36, w: 71, text: "text-[10px]" },
    md: { h: 44, w: 87, text: "text-[10px]" },
    lg: { h: 54, w: 106, text: "text-xs" },
    xl: { h: 68, w: 134, text: "text-sm" },
  };

  const iconHeights = {
    xs: { h: 26, w: 21, text: "text-sm", sub: "text-[9px]" },
    sm: { h: 32, w: 25, text: "text-base", sub: "text-[10px]" },
    md: { h: 38, w: 30, text: "text-lg", sub: "text-[11px]" },
    lg: { h: 48, w: 38, text: "text-xl", sub: "text-xs" },
    xl: { h: 60, w: 47, text: "text-2xl", sub: "text-sm" },
  };

  const fSize = fullHeights[size] || fullHeights.md;
  const iSize = iconHeights[size] || iconHeights.md;

  const taglineClasses = isDark
    ? "text-slate-400 font-medium tracking-wide"
    : "text-slate-500 font-medium tracking-wide";

  const brandAccentClasses = isDark ? "text-[#E5A72C] font-bold" : "text-[#2563EB] font-bold";

  // Tagline element
  const Tagline = ({ customClass = "" }: { customClass?: string }) => (
    <span className={`${fSize.text} ${taglineClasses} ${customClass} leading-tight truncate`}>
      Powered by <span className={brandAccentClasses}>Pexora</span>
    </span>
  );

  // 1. Variant: Pure Icon
  if (variant === "icon") {
    const content = (
      <div className={`relative inline-flex items-center shrink-0 ${className}`}>
        <Image
          src={iconSrc}
          alt="At Your Service Map Pin Icon"
          width={iSize.w}
          height={iSize.h}
          className="object-contain"
          priority={priority}
        />
      </div>
    );

    return linkToHome ? (
      <Link href="/" aria-label="At Your Service – Powered by Pexora Homepage" className="inline-flex shrink-0">
        {content}
      </Link>
    ) : content;
  }

  // 2. Variant: Pure Full Logo
  if (variant === "full") {
    const content = (
      <div className={`flex flex-col items-start shrink-0 ${className}`}>
        <Image
          src={fullLogoSrc}
          alt="At Your Service – Powered by Pexora"
          width={fSize.w}
          height={fSize.h}
          className="object-contain"
          priority={priority}
        />
        {showTagline && <Tagline customClass="mt-0.5 pl-0.5" />}
      </div>
    );

    return linkToHome ? (
      <Link href="/" aria-label="At Your Service – Powered by Pexora Homepage" className="inline-flex shrink-0 group">
        {content}
      </Link>
    ) : content;
  }

  // 3. Variant: Mobile Header (Icon + HTML text)
  if (variant === "mobile-header") {
    const content = (
      <div className={`flex items-center gap-2 shrink-0 min-w-0 ${className}`}>
        <Image
          src={iconSrc}
          alt="At Your Service Map Pin Icon"
          width={iSize.w}
          height={iSize.h}
          className="object-contain shrink-0"
          priority={priority}
        />
        <div className="flex flex-col min-w-0">
          <span
            className={`font-black ${iSize.text} tracking-tight leading-none truncate ${
              isDark ? "text-white" : "text-[#102A43]"
            }`}
          >
            At Your Service
          </span>
          {showTagline && (
            <span className={`${iSize.sub} ${taglineClasses} leading-tight mt-0.5 truncate`}>
              Powered by <span className={brandAccentClasses}>Pexora</span>
            </span>
          )}
        </div>
      </div>
    );

    return linkToHome ? (
      <Link href="/" aria-label="At Your Service – Powered by Pexora Homepage" className="inline-flex shrink-0 min-w-0 group">
        {content}
      </Link>
    ) : content;
  }

  // 4. Variant: Desktop Header (Full logo + tagline)
  if (variant === "desktop-header") {
    const content = (
      <div className={`flex flex-col items-start shrink-0 ${className}`}>
        <Image
          src={fullLogoSrc}
          alt="At Your Service"
          width={fSize.w}
          height={fSize.h}
          className="object-contain"
          priority={priority}
        />
        {showTagline && <Tagline customClass="mt-0.5 pl-0.5" />}
      </div>
    );

    return linkToHome ? (
      <Link href="/" aria-label="At Your Service – Powered by Pexora Homepage" className="inline-flex shrink-0 group">
        {content}
      </Link>
    ) : content;
  }

  // 5. Variant: Icon With Text (general layout)
  if (variant === "icon-with-text") {
    const content = (
      <div className={`flex items-center gap-2.5 shrink-0 min-w-0 ${className}`}>
        <Image
          src={iconSrc}
          alt="At Your Service"
          width={iSize.w}
          height={iSize.h}
          className="object-contain shrink-0"
          priority={priority}
        />
        <div className="flex flex-col min-w-0">
          <span
            className={`font-black ${iSize.text} tracking-tight leading-tight truncate ${
              isDark ? "text-white" : "text-[#102A43]"
            }`}
          >
            At Your Service
          </span>
          {showTagline && (
            <span className={`${iSize.sub} ${taglineClasses} leading-tight truncate`}>
              Powered by <span className={brandAccentClasses}>Pexora</span>
            </span>
          )}
        </div>
      </div>
    );

    return linkToHome ? (
      <Link href="/" aria-label="At Your Service – Powered by Pexora Homepage" className="inline-flex shrink-0 min-w-0 group">
        {content}
      </Link>
    ) : content;
  }

  // 6. Variant: Responsive Header (Requirement 1 & 2)
  // On desktop (lg+ >= 1024px): shows the full "At Your Service" logo with its brand name
  // On mobile (< 1024px, including 320px & 375px): shows simplified "A" pin icon beside readable "At Your Service" text
  const responsiveContent = (
    <div className={`shrink-0 flex items-center min-w-0 ${className}`}>
      
      {/* Mobile/Tablet View (< 1024px) */}
      <div className="flex lg:hidden items-center gap-2 min-w-0">
        <Image
          src={iconSrc}
          alt="At Your Service Logo"
          width={iconHeights.sm.w}
          height={iconHeights.sm.h}
          className="object-contain shrink-0"
          priority={priority}
        />
        <div className="flex flex-col min-w-0">
          <span
            className={`font-black text-sm sm:text-base tracking-tight leading-none truncate ${
              isDark ? "text-white" : "text-[#102A43]"
            }`}
          >
            At Your Service
          </span>
          {showTagline && (
            <span className={`text-[10px] sm:text-[11px] ${taglineClasses} leading-tight mt-0.5 truncate`}>
              Powered by <span className={brandAccentClasses}>Pexora</span>
            </span>
          )}
        </div>
      </div>

      {/* Desktop View (>= 1024px) */}
      <div className="hidden lg:flex flex-col items-start min-w-0">
        <Image
          src={fullLogoSrc}
          alt="At Your Service – Powered by Pexora"
          width={fullHeights.md.w}
          height={fullHeights.md.h}
          className="object-contain"
          priority={priority}
        />
        {showTagline && (
          <span className="text-[10px] font-semibold text-slate-500 tracking-wider mt-0.5 pl-0.5 leading-tight">
            Powered by <span className={brandAccentClasses}>Pexora</span>
          </span>
        )}
      </div>

    </div>
  );

  return linkToHome ? (
    <Link
      href="/"
      aria-label="At Your Service – Powered by Pexora Homepage"
      className="inline-flex shrink-0 min-w-0 group"
    >
      {responsiveContent}
    </Link>
  ) : responsiveContent;
}

