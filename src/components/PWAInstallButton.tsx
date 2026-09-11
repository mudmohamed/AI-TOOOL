/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  Download,
  Smartphone,
  X,
  Share2,
  PlusSquare,
  Check,
  Monitor,
  ExternalLink,
  Copy,
  CheckCheck,
} from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // If already running as an installed standalone PWA
  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold">
        <Check className="w-3.5 h-3.5 text-emerald-400" />
        <span className="hidden sm:inline">Installed &amp; Standalone</span>
        <span className="sm:hidden">Installed</span>
      </div>
    );
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (!success) {
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const isIframe = typeof window !== 'undefined' && window.self !== window.top;

  return (
    <>
      <button
        id="pwa-install-app-btn"
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 sm:gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-slate-950 px-3 sm:px-3.5 py-1.5 text-xs font-extrabold shadow-md shadow-emerald-950/60 transition-all cursor-pointer ring-1 ring-emerald-300"
        title="Install Deriv Terminal on your phone or desktop for full-screen native experience"
      >
        <Download className="w-3.5 h-3.5 stroke-[2.5]" />
        <span>Install App</span>
      </button>

      {/* Comprehensive In-App PWA Install Guide Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold">
                  <Download className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    Install Deriv Terminal App
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Standalone Fullscreen PWA with zero browser address bar
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* If inside iframe preview: Direct Open in New Tab prompt */}
            {isIframe && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <ExternalLink className="w-4 h-4 text-amber-400 shrink-0" />
                  Preview Frame Detected
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Browsers require opening the app directly in a full browser tab to trigger the native installation prompt.
                </p>
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold font-mono transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open App in New Tab to Install
                </a>
              </div>
            )}

            {/* Step-by-Step Instructions */}
            <div className="space-y-3">
              {/* Chrome / Edge on Desktop */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Monitor className="w-4 h-4 text-cyan-400" />
                  <span>Desktop (Chrome, Edge, Brave, Opera)</span>
                </div>
                <p className="text-[11px] text-slate-400 pl-6 leading-relaxed">
                  Look at the right side of your browser URL bar for the <strong>Install icon (⊕ or computer screen)</strong>, or click menu (⋮) &rarr; <strong>"Install Deriv Matrix..."</strong>
                </p>
              </div>

              {/* Android */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>Android (Chrome or Samsung Internet)</span>
                </div>
                <p className="text-[11px] text-slate-400 pl-6 leading-relaxed">
                  Tap browser menu (⋮) &rarr; <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>. Launches with native app icon.
                </p>
              </div>

              {/* iOS Safari */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Share2 className="w-4 h-4 text-purple-400" />
                  <span>Apple iPhone / iPad (Safari)</span>
                </div>
                <p className="text-[11px] text-slate-400 pl-6 leading-relaxed">
                  Tap the <strong>Share</strong> button (box with up arrow) in the bottom toolbar &rarr; scroll down &rarr; tap <strong>"Add to Home Screen"</strong>.
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono font-bold text-slate-200 transition cursor-pointer"
              >
                {copied ? (
                  <>
                    <CheckCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-400" />
                    <span>Copy App URL</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
