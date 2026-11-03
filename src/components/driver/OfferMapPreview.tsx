"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import dynamic from "next/dynamic";
import type { LeafletOfferInnerMapProps, LocationPoint } from "./LeafletOfferInnerMap";

export type { LocationPoint };

export interface OfferMapPreviewProps extends LeafletOfferInnerMapProps {
  className?: string;
}

class OfferMapErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("[OfferMapPreview Error]", error.message, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div
            className="w-full bg-slate-100 rounded-2xl flex items-center justify-center text-xs text-slate-400 border border-slate-200"
            style={{ height: "115px", minHeight: "115px" }}
          >
            Map preview unavailable
          </div>
        )
      );
    }
    return this.props.children;
  }
}

const DynamicLeafletOfferMap = dynamic(
  () => import("./LeafletOfferInnerMap"),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full bg-slate-100 rounded-2xl flex items-center justify-center text-xs text-slate-400 border border-slate-200 animate-pulse"
        style={{ height: "115px", minHeight: "115px" }}
      >
        Loading route map...
      </div>
    ),
  }
);

export default function OfferMapPreview(props: OfferMapPreviewProps) {
  return (
    <OfferMapErrorBoundary>
      <DynamicLeafletOfferMap {...props} />
    </OfferMapErrorBoundary>
  );
}
